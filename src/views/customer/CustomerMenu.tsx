import { useState } from 'react';
import { useStore, useTranslation, getActiveRestaurantId, getActiveRestaurantInfo } from '../../context/RealtimeStore';
import type { MenuItem } from '../../context/RealtimeStore';
import { Search, X } from 'lucide-react';

const VegNonVegIndicator = ({ isVeg, size = 14 }: { isVeg: boolean; size?: number }) => (
  <div style={{
    width: size,
    height: size,
    border: `1.5px solid ${isVeg ? '#22c55e' : '#ef4444'}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    borderRadius: 2,
    flexShrink: 0,
    padding: 1,
  }} title={isVeg ? 'Veg' : 'Non-Veg'}>
    <div style={{
      width: Math.max(4, size - 8),
      height: Math.max(4, size - 8),
      borderRadius: '50%',
      background: isVeg ? '#22c55e' : '#ef4444',
    }} />
  </div>
);

const FoodTrolley = ({ size = 13, color = '#000' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M6 10h2v6h10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 14h8c0-2.5-1.5-4-4-4s-4 1.5-4 4z" fill={color} />
    <path d="M13 10c0-0.5 0.5-1 1-1s1 0.5 1 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="18" r="1.5" fill={color} />
    <circle cx="16" cy="18" r="1.5" fill={color} />
  </svg>
);

export default function CustomerMenu() {
  const { state, dispatch, addToast } = useStore();
  const t = useTranslation();
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'low-high' | 'high-low'>('popular');

  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ name: string; price: number } | null>(null);
  const [variantQty, setVariantQty] = useState(1);

  const handleOpenVariantModal = (item: MenuItem) => {
    setVariantModalItem(item);
    setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
    setVariantQty(1);
  };

  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);
  const plan = restaurant.subscriptionPlan || 'free';
  const usage = restaurant.ordersPlacedThisMonth || 0;
  const limit = plan === 'free' ? 100 : plan === 'base' ? 1000 : plan === 'standard' ? 2000 : Infinity;
  const allowNegative = restaurant.allowNegativeOrders || false;

  const isLimitExceeded = usage >= limit + 100 || (usage >= limit && !allowNegative);
  const isHardLimitReached = usage >= limit + 100;

  const restaurantCategories = state.categories
    .filter(c => c.restaurantId === restaurantId)
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const allCategoriesList = [{ id: 'all', name: 'All', icon: '🍽️' }, ...restaurantCategories];
  const midpoint = Math.ceil(allCategoriesList.length / 2);
  const row1 = allCategoriesList.slice(0, midpoint);
  const row2 = allCategoriesList.slice(midpoint);

  const myPhoneIdentifier = localStorage.getItem('meenufy_customer_phone') || localStorage.getItem('meenufy_customer_guest_id') || '';
  const hasActiveOrders = state.orders.some(o => !['served', 'cancelled'].includes(o.status) && o.customerPhone === myPhoneIdentifier);

  // Schedule enforcement helper
  const nowMinutes = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const isWithinSchedule = (sch: { fromTime: string; toTime: string }) => {
    const from = toMinutes(sch.fromTime);
    const to = toMinutes(sch.toTime);
    return from <= to ? nowMinutes >= from && nowMinutes <= to : nowMinutes >= from || nowMinutes <= to;
  };

  const filteredItems = state.menuItems.filter(item => {
    if (item.restaurantId !== restaurantId) return false;
    if (!item.isAvailable) return false;
    if (vegOnly && !item.isVeg) return false;
    if (nonVegOnly && item.isVeg) return false;
    if (selectedCat !== 'all' && item.category !== selectedCat) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;

    // Schedule enforcement — check if this item is in a schedule that is currently inactive
    const itemSchedules = state.schedules.filter(s => s.targets.some(t => t.type === 'item' && t.id === item.id));
    if (itemSchedules.length > 0) {
      // At least one item-level schedule must be active
      if (!itemSchedules.some(isWithinSchedule)) return false;
    } else {
      // Fall back to category-level schedule check
      const catSchedules = state.schedules.filter(s => s.targets.some(t => t.type === 'category' && t.id === item.category));
      if (catSchedules.length > 0 && !catSchedules.some(isWithinSchedule)) return false;
    }

    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'low-high') return a.price - b.price;
    if (sortBy === 'high-low') return b.price - a.price;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return (a.rank || 0) - (b.rank || 0);
  });

  const handleAddToCart = (item: MenuItem) => {
    if (isLimitExceeded) {
      addToast('error', isHardLimitReached
        ? 'Ordering is temporarily unavailable: waiting for the restaurant owner to recharge us...'
        : 'Ordering is temporarily unavailable as this restaurant has reached its monthly order capacity limit.'
      );
      return;
    }
    if (item.variants && item.variants.length > 0) {
      handleOpenVariantModal(item);
      return;
    }
    dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: item.id, name: item.name, price: item.price, qty: 1 } });
    addToast('success', `${item.name} added to cart!`);
  };

  const getCartQty = (itemId: string) => {
    return state.cart.filter(i => i.menuItemId === itemId).reduce((sum, i) => sum + i.qty, 0);
  };

  const handleIncrement = (itemId: string, name: string, price: number) => {
    if (isLimitExceeded) {
      addToast('error', isHardLimitReached
        ? 'Ordering is temporarily unavailable: waiting for the restaurant owner to recharge us...'
        : 'Ordering is temporarily unavailable as this restaurant has reached its monthly order capacity limit.'
      );
      return;
    }
    const item = state.menuItems.find(i => i.id === itemId);
    if (item && item.variants && item.variants.length > 0) {
      handleOpenVariantModal(item);
      return;
    }
    dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: itemId, name, price, qty: 1 } });
  };

  const handleDecrement = (itemId: string) => {
    const item = state.menuItems.find(i => i.id === itemId);
    if (item && item.variants && item.variants.length > 0) {
      addToast('info', 'Please adjust quantities in the Cart Drawer.');
      return;
    }
    const cartItem = state.cart.find(i => i.menuItemId === itemId);
    if (!cartItem) return;
    dispatch({ type: 'UPDATE_CART_QTY', payload: { menuItemId: itemId, qty: cartItem.qty - 1 } });
  };

  const getRatingDetails = (itemId: string) => {
    const sum = itemId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rating = (4.0 + (sum % 10) / 10).toFixed(1);
    const reviews = 50 + (sum % 450);
    return { rating, reviews };
  };

  return (
    <div style={{ 
      animation: 'fadeIn 0.3s ease', 
      paddingBottom: 80,
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden'
    }}>
      {isLimitExceeded && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--error)',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: 600,
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          {isHardLimitReached
            ? '⚠️ Ordering is temporarily unavailable: waiting for the restaurant owner to recharge us...'
            : '⚠️ Ordering is temporarily unavailable as this restaurant has reached its monthly order capacity limit.'
          }
        </div>
      )}
      {/* Header and filters section */}
      <div style={{
        padding: '16px 16px 10px',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottom: '1px solid var(--border)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Upper Filter Row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div className="input-icon-wrap" style={{ flex: 1, minWidth: 120 }}>
            <Search size={14} className="input-icon" style={{ left: 10 }} />
            <input
              className="input"
              type="text"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 32,
                paddingRight: 24,
                paddingTop: 7,
                paddingBottom: 7,
                fontSize: 12,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Veg/Non-Veg Toggles */}
          <div style={{
            display: 'flex',
            gap: 2,
            background: 'var(--bg-secondary)',
            padding: 3,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)'
          }}>
            <button
              onClick={() => { setVegOnly(false); setNonVegOnly(false); }}
              className="btn"
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4, fontWeight: 600,
                background: (!vegOnly && !nonVegOnly) ? 'var(--brand)' : 'transparent',
                color: (!vegOnly && !nonVegOnly) ? '#000' : 'var(--text-secondary)',
              }}
            >
              {t('all')}
            </button>
            <button
              onClick={() => { setVegOnly(true); setNonVegOnly(false); }}
              className="btn"
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                background: vegOnly ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: vegOnly ? 'var(--success)' : 'var(--text-secondary)',
                border: vegOnly ? '1px solid rgba(34,197,94,0.3)' : '1px solid transparent',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
              {t('veg')}
            </button>
            <button
              onClick={() => { setVegOnly(false); setNonVegOnly(true); }}
              className="btn"
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                background: nonVegOnly ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: nonVegOnly ? 'var(--error)' : 'var(--text-secondary)',
                border: nonVegOnly ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--error)' }} />
              {t('non_veg')}
            </button>
          </div>

          {/* Sort Selector */}
          <select
            className="input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              width: 90,
              padding: '4px 8px',
              fontSize: 11,
              background: 'var(--bg-secondary)',
              cursor: 'pointer',
              height: 28,
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <option value="popular">{t('popular')}</option>
            <option value="low-high">{t('low_high')}</option>
            <option value="high-low">{t('high_low')}</option>
          </select>
        </div>

        {/* Lower Row: Category Filter Row (2 horizontal scrolling rows) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 }}>
          {/* Row 1 */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, width: '100%', maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
            {row1.map(cat => {
              const isSelected = selectedCat === cat.id;
              return (
                <button
                  key={cat.id}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    flexShrink: 0,
                    padding: '5px 14px',
                    fontSize: 11,
                    borderRadius: 'var(--radius-full)',
                    background: isSelected ? 'var(--brand)' : 'var(--bg-elevated)',
                    color: isSelected ? '#000' : 'var(--text-primary)',
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setSelectedCat(cat.id)}
                >
                  {cat.icon} {cat.name}
                </button>
              );
            })}
          </div>
          {/* Row 2 */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, width: '100%', maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
            {row2.map(cat => {
              const isSelected = selectedCat === cat.id;
              return (
                <button
                  key={cat.id}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    flexShrink: 0,
                    padding: '5px 14px',
                    fontSize: 11,
                    borderRadius: 'var(--radius-full)',
                    background: isSelected ? 'var(--brand)' : 'var(--bg-elevated)',
                    color: isSelected ? '#000' : 'var(--text-primary)',
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => setSelectedCat(cat.id)}
                >
                  {cat.icon} {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Menu items list */}
      <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sortedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No items found matching your filters.</p>
          </div>
        ) : (
          <>
            {(selectedCat === 'all' ? restaurantCategories : restaurantCategories.filter(c => c.id === selectedCat)).map(cat => {
              const catItems = sortedItems.filter(i => i.category === cat.id || (i.categories && i.categories.includes(cat.id)));
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Category Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--brand)',
                    background: 'linear-gradient(90deg, rgba(255, 125, 0, 0.15) 0%, rgba(255, 125, 0, 0) 100%)',
                    marginBottom: 4,
                  }}>
                    <h2 style={{
                      fontSize: 15,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      color: 'var(--brand)',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>{cat.icon} {cat.name}</span>
                    </h2>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#000',
                      background: 'var(--brand)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {catItems.length} {catItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Items list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {catItems.map(item => {
                      const qty = getCartQty(item.id);
                      return (
                        <div key={item.id} className="card" style={{
                          padding: 12,
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'stretch'
                                     {/* Left: Food Image */}
                          <div 
                            onClick={() => handleOpenVariantModal(item)}
                            style={{
                              width: 100,
                              height: 100,
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              position: 'relative',
                              background: 'var(--bg-elevated)',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            {item.image ? (
                              <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ fontSize: 32 }}>🍽️</div>
                            )}
                          </div>

                          {/* Right: Content details */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                            <div 
                              onClick={() => handleOpenVariantModal(item)}
                              style={{ cursor: 'pointer' }}
                            >
                              {/* Top Row: Name and Veg/Non-Veg indicator */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <h3 style={{
                                  fontSize: 14,
                                  fontFamily: 'var(--font-display)',
                                  fontWeight: 500,
                                  color: 'var(--customer-item-name-color, var(--brand))',
                                  lineHeight: 1.2,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {item.name}
                                </h3>
                                
                                <VegNonVegIndicator isVeg={item.isVeg} />
                              </div>

                              {/* Middle description */}
                              {item.description && (
                                <p style={{
                                  fontSize: 11,
                                  color: 'var(--customer-item-desc-color, var(--text-secondary))',
                                  lineHeight: 1.35,
                                  marginTop: 3,
                                  marginBottom: 4,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {item.description}
                                </p>
                              )}
                            </div>                     )}

                            {/* Bottom Row: Price, Rating, Cart controls */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                  <span className="item-price-tag" style={{ lineHeight: 1.1 }}>
                                    {item.variants && item.variants.length > 0 ? `From ₹${item.price}` : `₹${item.price}`}
                                  </span>
                                  
                                  {/* Star Rating */}
                                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1 }}>
                                    <span style={{ color: '#f59e0b' }}>★</span>
                                    <span>{getRatingDetails(item.id).rating} ({getRatingDetails(item.id).reviews})</span>
                                  </span>
                                </div>
                                
                                {item.isFeatured && (
                                  <div style={{
                                    alignSelf: 'flex-start',
                                    background: 'var(--customer-bestseller-bg, var(--brand-dim))',
                                    color: 'var(--customer-bestseller-text, var(--brand))',
                                    border: '1px solid var(--customer-bestseller-border, var(--border-brand))',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    letterSpacing: '0.02em',
                                    whiteSpace: 'nowrap',
                                    textTransform: 'uppercase'
                                  }}>
                                    {t('bestseller')}
                                  </div>
                                )}
                              </div>

                              {/* Cart Controls */}
                              <div style={{ display: 'flex', gap: 6 }}>
                                {item.variants && item.variants.length > 0 ? (
                                  <>
                                    {hasActiveOrders && (
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => handleOpenVariantModal(item)}
                                        style={{
                                          padding: '5px 10px',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          height: 28,
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--border)'
                                        }}
                                      >
                                        {t('add_on')} {qty > 0 ? `(${qty})` : ''}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenVariantModal(item)}
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        height: 28,
                                        borderRadius: '4px',
                                        background: 'var(--customer-add-to-cart-bg, #ffffff)',
                                        color: 'var(--customer-add-to-cart-text, #000000)',
                                        border: 'none',
                                      }}
                                    >
                                      {t('add')} {qty > 0 ? `(${qty})` : ''} <FoodTrolley size={18} color="var(--customer-add-to-cart-text, #000000)" />
                                    </button>
                                  </>
                                ) : qty === 0 ? (
                                  <>
                                    {hasActiveOrders && (
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                          handleAddToCart(item);
                                          addToast('success', `${item.name} added as add-on! 🛒`);
                                        }}
                                        style={{
                                          padding: '5px 10px',
                                          fontSize: 10,
                                          fontWeight: 700,
                                          height: 28,
                                          borderRadius: 'var(--radius-sm)',
                                          border: '1px solid var(--border)'
                                        }}
                                      >
                                        {t('add_on')}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleAddToCart(item)}
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        height: 28,
                                        borderRadius: '4px',
                                        background: 'var(--customer-add-to-cart-bg, #ffffff)',
                                        color: 'var(--customer-add-to-cart-text, #000000)',
                                        border: 'none',
                                      }}
                                    >
                                      {t('add')} <FoodTrolley size={18} color="var(--customer-add-to-cart-text, #000000)" />
                                    </button>
                                  </>
                                ) : (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'var(--customer-add-to-cart-bg, #ffffff)',
                                    borderRadius: 'var(--radius-sm)',
                                    overflow: 'hidden',
                                    height: 28
                                  }}>
                                    <button
                                      onClick={() => handleDecrement(item.id)}
                                      style={{
                                        width: 26, height: '100%',
                                        background: 'none', border: 'none',
                                        cursor: 'pointer', color: 'var(--customer-add-to-cart-text, #000000)',
                                        fontSize: 13, fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                      }}
                                    >−</button>
                                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--customer-add-to-cart-text, #000000)', minWidth: 16, textAlign: 'center' }}>
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => handleIncrement(item.id, item.name, item.price)}
                                      style={{
                                        width: 26, height: '100%',
                                        background: 'none', border: 'none',
                                        cursor: 'pointer', color: 'var(--customer-add-to-cart-text, #000000)',
                                        fontSize: 13, fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                      }}
                                    >+</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* Fallback: show items whose category doesn't match any known category */}
            {(() => {
              const knownCatIds = new Set(restaurantCategories.map(c => c.id));
              const uncategorized = sortedItems.filter(i => 
                !knownCatIds.has(i.category) && 
                (!i.categories || i.categories.every(cId => !knownCatIds.has(cId)))
              );
              if (uncategorized.length === 0) return null;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: '8px',
                    borderLeft: '4px solid var(--brand)',
                    background: 'linear-gradient(90deg, rgba(255, 125, 0, 0.15) 0%, rgba(255, 125, 0, 0) 100%)',
                    marginBottom: 4,
                  }}>
                    <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🍽️ All Items</span>
                    </h2>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#000', background: 'var(--brand)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {uncategorized.length} {uncategorized.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {uncategorized.map(item => {
                      const qty = getCartQty(item.id);
                      return (
                        <div key={item.id} className="card" style={{
                          padding: 12,
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          display: 'flex',
                          gap: 12,
                          alignItems:                           {/* Left: Food Image */}
                          <div 
                            onClick={() => handleOpenVariantModal(item)}
                            style={{
                              width: 100,
                              height: 100,
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              position: 'relative',
                              background: 'var(--bg-elevated)',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            {item.image ? (
                              <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ fontSize: 32 }}>🍽️</div>
                            )}
                          </div>

                          {/* Right: Content details */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                            <div 
                              onClick={() => handleOpenVariantModal(item)}
                              style={{ cursor: 'pointer' }}
                            >
                              {/* Top Row: Name and Veg/Non-Veg indicator */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <h3 style={{
                                  fontSize: 14,
                                  fontFamily: 'var(--font-display)',
                                  fontWeight: 500,
                                  color: 'var(--customer-item-name-color, var(--brand))',
                                  lineHeight: 1.2,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {item.name}
                                </h3>
                                <VegNonVegIndicator isVeg={item.isVeg} />
                              </div>

                              {/* Middle description */}
                              {item.description && (
                                <p style={{
                                  fontSize: 11,
                                  color: 'var(--customer-item-desc-color, var(--text-secondary))',
                                  lineHeight: 1.35,
                                  marginTop: 3,
                                  marginBottom: 4,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {item.description}
                                </p>
                              )}
                            </div>         </p>
                            )}

                            {/* Bottom Row: Price, Rating, Cart controls */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                  <span className="item-price-tag" style={{ lineHeight: 1.1 }}>
                                    {item.variants && item.variants.length > 0 ? `From ₹${item.price}` : `₹${item.price}`}
                                  </span>
                                  <span style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1 }}>
                                    <span style={{ color: '#f59e0b' }}>★</span>
                                    <span>{getRatingDetails(item.id).rating} ({getRatingDetails(item.id).reviews})</span>
                                  </span>
                                </div>
                                {item.isFeatured && (
                                  <div style={{
                                    alignSelf: 'flex-start',
                                    background: 'var(--customer-bestseller-bg, var(--brand-dim))',
                                    color: 'var(--customer-bestseller-text, var(--brand))',
                                    border: '1px solid var(--customer-bestseller-border, var(--border-brand))',
                                    fontSize: 8, fontWeight: 800, padding: '1px 5px',
                                    borderRadius: 3, letterSpacing: '0.02em',
                                    whiteSpace: 'nowrap', textTransform: 'uppercase'
                                  }}>
                                    {t('bestseller')}
                                  </div>
                                )}
                              </div>

                              {/* Cart Controls */}
                              <div style={{ display: 'flex', gap: 6 }}>
                                {item.variants && item.variants.length > 0 ? (
                                  <>
                                    {hasActiveOrders && (
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => handleOpenVariantModal(item)}
                                        style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                      >
                                        {t('add_on')} {qty > 0 ? `(${qty})` : ''}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenVariantModal(item)}
                                      style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, height: 28, borderRadius: '4px', background: 'var(--customer-add-to-cart-bg, #ffffff)', color: 'var(--customer-add-to-cart-text, #000000)', border: 'none' }}
                                    >
                                      {t('add')} {qty > 0 ? `(${qty})` : ''} <FoodTrolley size={18} color="var(--customer-add-to-cart-text, #000000)" />
                                    </button>
                                  </>
                                ) : qty === 0 ? (
                                  <>
                                    {hasActiveOrders && (
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => { handleAddToCart(item); addToast('success', `${item.name} added as add-on! 🛒`); }}
                                        style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                      >
                                        {t('add_on')}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleAddToCart(item)}
                                      style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, height: 28, borderRadius: '4px', background: 'var(--customer-add-to-cart-bg, #ffffff)', color: 'var(--customer-add-to-cart-text, #000000)', border: 'none' }}
                                    >
                                      {t('add')} <FoodTrolley size={18} color="var(--customer-add-to-cart-text, #000000)" />
                                    </button>
                                  </>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--customer-add-to-cart-bg, #ffffff)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: 28 }}>
                                    <button
                                      onClick={() => handleDecrement(item.id)}
                                      style={{ width: 26, height: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--customer-add-to-cart-text, #000000)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >−</button>
                                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--customer-add-to-cart-text, #000000)', minWidth: 16, textAlign: 'center' }}>{qty}</span>
                                    <button
                                      onClick={() => handleIncrement(item.id, item.name, item.price)}
                                      style={{ width: 26, height: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--customer-add-to-cart-text, #000000)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >+</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {variantModalItem && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setVariantModalItem(null)}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 20, position: 'relative' }}>
            
            <button
              onClick={() => setVariantModalItem(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
            >
              <X size={16} />
            </button>

            <div style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              position: 'relative',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              marginTop: 10
            }}>
              {variantModalItem.image ? (
                <img src={variantModalItem.image} alt={variantModalItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: 64 }}>🍽️</div>
              )}
              <div style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.8)',
              }}>
                <VegNonVegIndicator isVeg={variantModalItem.isVeg} size={14} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--brand)', textTransform: 'uppercase' }}>
                {variantModalItem.name}
              </h3>
              {variantModalItem.description && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                  {variantModalItem.description}
                </p>
              )}
            </div>

            {variantModalItem.variants && variantModalItem.variants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {t('select_option')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {variantModalItem.variants?.map((v, idx) => {
                    const isSelected = selectedVariant?.name === v.name;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedVariant(v)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                          border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? '0 0 10px rgba(255,125,0,0.15)' : 'none'
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--brand)' : 'var(--text-primary)' }}>
                          {v.name}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                          ₹{v.price}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
                height: 36,
                padding: '0 4px'
              }}>
                <button
                  onClick={() => setVariantQty(Math.max(1, variantQty - 1))}
                  style={{
                    width: 28, height: '100%',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >−</button>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>
                  {variantQty}
                </span>
                <button
                  onClick={() => setVariantQty(variantQty + 1)}
                  style={{
                    width: 28, height: '100%',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >+</button>
              </div>

              <button
                onClick={() => {
                  dispatch({
                    type: 'ADD_TO_CART',
                    payload: {
                      menuItemId: variantModalItem.id,
                      name: variantModalItem.name,
                      price: selectedVariant ? selectedVariant.price : variantModalItem.price,
                      qty: variantQty,
                      variant: selectedVariant || undefined
                    }
                  });
                  addToast('success', selectedVariant ? `${variantModalItem.name} (${selectedVariant.name}) added to cart!` : `${variantModalItem.name} added to cart!`);
                  setVariantModalItem(null);
                }}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 500,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'var(--customer-add-to-cart-bg, #ffffff)',
                  color: 'var(--customer-add-to-cart-text, #000000)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {t('add')} — ₹{(selectedVariant ? selectedVariant.price : variantModalItem.price) * variantQty} <FoodTrolley size={18} color="var(--customer-add-to-cart-text, #000000)" />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
