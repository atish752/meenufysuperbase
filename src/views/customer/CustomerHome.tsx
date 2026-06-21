import { useState } from 'react';
import { useStore, useTranslation, getActiveRestaurantInfo, getActiveRestaurantId } from '../../context/RealtimeStore';
import type { TableInfo, MenuItem } from '../../context/RealtimeStore';
import { MapPin, Phone, Clock, ChevronRight, Star, Utensils, X, Mail } from 'lucide-react';

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

type Props = { table?: TableInfo };

export default function CustomerHome({ table }: Props) {
  const { state, dispatch, addToast } = useStore();
  const t = useTranslation();

  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);

  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ name: string; price: number } | null>(null);
  const [variantQty, setVariantQty] = useState(1);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);

  const handleOpenVariantModal = (item: MenuItem) => {
    setVariantModalItem(item);
    setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
    setVariantQty(1);
  };

  const featuredItems = state.menuItems.filter(i => i.restaurantId === restaurantId && i.isFeatured && i.isAvailable).slice(0, 6);

  const myPhoneIdentifier = localStorage.getItem('meenufy_customer_phone') || localStorage.getItem('meenufy_customer_guest_id') || '';
  const hasActiveOrders = state.orders.some(o => !['served', 'cancelled'].includes(o.status) && o.customerPhone === myPhoneIdentifier);

  const getRatingDetails = (itemId: string) => {
    const sum = itemId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rating = (4.0 + (sum % 10) / 10).toFixed(1);
    const reviews = 50 + (sum % 450);
    return { rating, reviews };
  };

  const getCartQty = (itemId: string) => {
    return state.cart.filter(i => i.menuItemId === itemId).reduce((sum, i) => sum + i.qty, 0);
  };

  const handleIncrement = (itemId: string, name: string, price: number) => {
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

  const handleAddToCart = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      handleOpenVariantModal(item);
      return;
    }
    dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: item.id, name: item.name, price: item.price, qty: 1 } });
    addToast('success', `${item.name} added to cart!`);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Hero / Banner */}
      <div style={{
        background: 'linear-gradient(160deg, #1a0a00 0%, #0D0D0D 50%, #0a0018 100%)',
        padding: '36px 20px 28px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '120%', height: '100%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,125,0,0.18) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Top left brand name & logo */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid var(--border-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff'
          }}>
            <img src="/meenufy_icon.png" alt="Meenufy Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 900,
            color: 'var(--brand)',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase'
          }}>
            Meenufy
          </span>
        </div>

        {/* Top right buttons */}
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10
        }}>
          {/* Language Switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLangDropdown(prev => !prev)}
              style={{
                background: 'linear-gradient(135deg, var(--brand) 0%, #e06000 100%)',
                color: '#000000',
                fontSize: 11,
                fontWeight: 800,
                padding: '6px 12px',
                borderRadius: 99,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 4px 12px rgba(255, 125, 0, 0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              🌐 {
                state.language === 'en' ? 'EN' :
                state.language === 'hi' ? 'हिन्दी' :
                state.language === 'bn' ? 'বাংলা' :
                state.language === 'te' ? 'తెలుగు' :
                state.language === 'mr' ? 'मराठी' :
                state.language === 'ta' ? 'தமிழ்' : '🌐'
              }
            </button>

            {showLangDropdown && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                  onClick={() => setShowLangDropdown(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  background: 'rgba(26, 26, 26, 0.95)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 125, 0, 0.25)',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  padding: '6px 0',
                  minWidth: 160,
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  animation: 'fadeIn 0.2s ease',
                }}>
                  {[
                    { code: 'en', label: '🇺🇸 English' },
                    { code: 'hi', label: '🇮🇳 हिन्दी (Hindi)' },
                    { code: 'bn', label: '🇮🇳 বাংলা (Bengali)' },
                    { code: 'te', label: '🇮🇳 తెలుగు (Telugu)' },
                    { code: 'mr', label: '🇮🇳 मराठी (Marathi)' },
                    { code: 'ta', label: '🇮🇳 தமிழ் (Tamil)' }
                  ].map((lang) => {
                    const isSelected = state.language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          dispatch({ type: 'SET_STATE', payload: { language: lang.code } });
                          addToast('success', `Language switched to ${lang.label.split(' ')[1]}`);
                          setShowLangDropdown(false);
                        }}
                        style={{
                          background: isSelected ? 'var(--brand-dim)' : 'transparent',
                          color: isSelected ? 'var(--brand)' : '#ffffff',
                          padding: '10px 16px',
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          textAlign: 'left',
                          border: 'none',
                          width: '100%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'background 0.2s',
                        }}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Theme Switcher */}
          <button
            onClick={() => {
              dispatch({ type: 'TOGGLE_CUSTOMER_THEME' });
              addToast('info', state.customerTheme === 'dark' ? 'Switched to Light Mode ☀️' : 'Switched to Dark Mode 🌙');
            }}
            style={{
              background: 'linear-gradient(135deg, rgba(255,125,0,0.2) 0%, rgba(255,125,0,0.05) 100%)',
              color: '#fff',
              fontSize: 14,
              padding: '6px',
              borderRadius: '50%',
              border: '1px solid var(--brand)',
              boxShadow: '0 0 10px rgba(255,125,0,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              transition: 'all 0.2s ease',
            }}
            title="Toggle theme"
          >
            {state.customerTheme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Table badge */}
          {table && (
            <div style={{
              background: 'var(--brand)',
              color: '#000',
              fontSize: 11,
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 99,
              letterSpacing: '0.06em',
            }}>
              📍 {table.label}
            </div>
          )}
        </div>

        {/* Logo / Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,125,0,0.15)',
          border: '2px solid var(--border-brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 32,
          boxShadow: '0 0 30px rgba(255,125,0,0.25)',
          overflow: 'hidden',
        }}>
          {restaurant.logo ? (
            <img src={restaurant.logo} alt="Restaurant Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            '🍽️'
          )}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900,
          color: 'var(--text-primary)', marginBottom: 6,
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
        }}>
          {restaurant.name}
        </h1>

        <p style={{
          fontSize: 13, color: 'var(--brand)', fontWeight: 600,
          letterSpacing: '0.06em', marginBottom: 10,
        }}>
          {restaurant.tagline}
        </p>

        {restaurant.description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 16px' }}>
            {restaurant.description}
          </p>
        )}

        {/* Info chips */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          {restaurant.openTime && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.06)', borderRadius: 99,
              padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <Clock size={12} color="var(--brand)" /> {restaurant.openTime} – {restaurant.closeTime}
            </div>
          )}
          {restaurant.address && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.06)', borderRadius: 99,
              padding: '5px 12px', fontSize: 12, color: 'var(--text-secondary)',
            }}>
              <MapPin size={12} color="var(--brand)" /> {restaurant.address.split(',')[0]}
            </div>
          )}
        </div>

        {/* Marquee Banner */}
        {restaurant.offersMarqueeEnabled && (state.coupons?.filter(c => c.isActive).length || 0) > 0 && (
          (() => {
            const activeCoupons = state.coupons.filter(c => c.isActive);
            const marqueeText = activeCoupons.map(c =>
              `✨ Use code ${c.code} to get ${c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`} OFF${c.minOrderAmount ? ` on orders above ₹${c.minOrderAmount}` : ''}!`
            ).join('   |   ');
            return (
              <div
                onClick={() => setShowCouponsModal(true)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(90deg, rgba(255,125,0,0.15) 0%, rgba(255,125,0,0.05) 50%, rgba(255,125,0,0.15) 100%)',
                  border: '1px solid rgba(255, 125, 0, 0.25)',
                  borderRadius: 8,
                  padding: '8px 0',
                  marginTop: 16,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255,125,0,0.1)',
                  position: 'relative'
                }}
              >
                <style>{`
                  @keyframes marqueeScroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                  .marquee-track {
                    display: inline-flex;
                    white-space: nowrap;
                    animation: marqueeScroll 22s linear infinite;
                    will-change: transform;
                  }
                  .marquee-track:hover {
                    animation-play-state: paused;
                  }
                  .marquee-segment {
                    display: inline-block;
                    padding-right: 80px;
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--brand);
                    letter-spacing: 0.4px;
                  }
                `}</style>
                <div className="marquee-track">
                  <span className="marquee-segment">{marqueeText}</span>
                  <span className="marquee-segment">{marqueeText}</span>
                  <span className="marquee-segment">{marqueeText}</span>
                  <span className="marquee-segment">{marqueeText}</span>
                </div>
              </div>
            );
          })()
        )}

        {/* CTA */}
        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 20 }}
          onClick={() => dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'menu' })}
        >
          <Utensils size={18} /> {t('view_full_menu')}
        </button>

        {/* Poster Section */}
        {restaurant.posterImage && (
          <div style={{
            width: '100%',
            maxWidth: 320,
            margin: '24px auto 0',
            aspectRatio: restaurant.posterRatio === '9:16' ? '9 / 16' : (restaurant.posterRatio === '3:4' ? '3 / 4' : '1 / 1'),
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <img
              src={restaurant.posterImage}
              alt="Restaurant Promo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}
      </div>

      {/* Featured Items */}
      {featuredItems.length > 0 && (
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Star size={14} color="var(--brand)" /> {t('featured')}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--brand)', padding: '4px 0' }}
              onClick={() => dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'menu' })}
            >
              {t('see_all')} <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {featuredItems.map(item => (
              <FeaturedCard 
                key={item.id} 
                item={item} 
                onOpenVariant={handleOpenVariantModal}
                qty={getCartQty(item.id)}
                hasActiveOrders={hasActiveOrders}
                getRatingDetails={getRatingDetails}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </div>
      )}

      {/* Contact section */}
      <div style={{ padding: '20px' }}>
        <div className="card" style={{ padding: '16px', background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📍 {t('contact_and_location') || 'Contact & Location'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} className="contact-link">
                <Phone size={14} color="var(--brand)" /> {restaurant.phone}
              </a>
            )}
            {restaurant.email && (
              <a href={`mailto:${restaurant.email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} className="contact-link">
                <Mail size={14} color="var(--brand)" /> {restaurant.email}
              </a>
            )}
            {restaurant.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                <MapPin size={14} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>{restaurant.address}</span>
                  {restaurant.googleMapsUrl && (
                    <a href={restaurant.googleMapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
                      View on Google Maps →
                    </a>
                  )}
                </div>
              </div>
            )}
            {(restaurant.openTime || restaurant.closeTime) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                <Clock size={14} color="var(--brand)" />
                <span>
                  {t('business_hours') || 'Business Hours'}: {restaurant.openTime || '00:00'} – {restaurant.closeTime || '23:59'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {variantModalItem && selectedVariant && (
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

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {t('select_option')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {variantModalItem.variants?.map((v, idx) => {
                  const isSelected = selectedVariant.name === v.name;
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
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                        ₹{v.price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

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
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', minWidth: 20, textAlign: 'center' }}>
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
                      price: selectedVariant.price,
                      qty: variantQty,
                      variant: selectedVariant
                    }
                  });
                  addToast('success', `${variantModalItem.name} (${selectedVariant.name}) added to cart!`);
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
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(255,255,255,0.15)'
                }}
              >
                {t('add')} — ₹{selectedVariant.price * variantQty} <FoodTrolley size={14} color="#000" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Active Coupons Modal */}
      {showCouponsModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCouponsModal(false)}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 24, position: 'relative' }}>
            <button
              onClick={() => setShowCouponsModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 32,
                height: 32,
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
            
            <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--brand)', marginBottom: 6 }}>
              🏷️ {t('active_offers') || 'Active Offers'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Use these promo codes on checkout to grab extra savings!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }}>
              {state.coupons?.filter(c => c.isActive).map(coupon => {
                const isCopied = copiedCouponId === coupon.id;
                return (
                  <div
                    key={coupon.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px dashed var(--border-brand)',
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{
                          background: 'var(--brand-dim)',
                          color: 'var(--brand)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.5px'
                        }}>
                          {coupon.code}
                        </span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 8 }}>
                          {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                        </div>
                      </div>
                      
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code);
                          setCopiedCouponId(coupon.id);
                          setTimeout(() => setCopiedCouponId(null), 2000);
                        }}
                        style={{
                          background: isCopied ? 'var(--status-success-dim)' : 'var(--brand)',
                          color: isCopied ? 'var(--status-success)' : '#000',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
                      {coupon.minOrderAmount && (
                        <span>• Valid on orders above ₹{coupon.minOrderAmount}</span>
                      )}
                      {coupon.isOneTime && (
                        <span>• Single use per customer</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!state.coupons || state.coupons.filter(c => c.isActive).length === 0) && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No active offers available right now.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FeaturedCardProps {
  item: any;
  onOpenVariant: (item: MenuItem) => void;
  qty: number;
  hasActiveOrders: boolean;
  getRatingDetails: (itemId: string) => { rating: string; reviews: number };
  onIncrement: (itemId: string, name: string, price: number) => void;
  onDecrement: (itemId: string) => void;
  onAddToCart: (item: MenuItem) => void;
}

function FeaturedCard({
  item,
  onOpenVariant,
  qty,
  hasActiveOrders,
  getRatingDetails,
  onIncrement,
  onDecrement,
  onAddToCart
}: FeaturedCardProps) {
  const t = useTranslation();

  return (
    <div className="card" style={{
      padding: 12,
      background: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      gap: 12,
      alignItems: 'stretch'
    }}>
      {/* Left: Food Image */}
      <div style={{
        width: 100,
        height: 100,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--bg-elevated)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {item.image ? (
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ fontSize: 32 }}>🍽️</div>
        )}
      </div>

      {/* Right: Content details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        {/* Top Row: Name and Veg/Non-Veg indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h3 style={{
            fontSize: 14,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            color: 'var(--customer-item-name-color, var(--brand))',
            lineHeight: 1.2,
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

        {/* Bottom Row: Price, Rating, Cart controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 'auto' }}>
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
                    onClick={() => onOpenVariant(item)}
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
                  onClick={() => onOpenVariant(item)}
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
                      onAddToCart(item);
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
                  onClick={() => onAddToCart(item)}
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
                  onClick={() => onDecrement(item.id)}
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
                  onClick={() => onIncrement(item.id, item.name, item.price)}
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
}
