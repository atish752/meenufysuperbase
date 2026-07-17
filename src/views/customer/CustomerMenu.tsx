import { useState, useRef, useEffect } from 'react';
import { useStore, useTranslation, getActiveRestaurantId, getActiveRestaurantInfo, isSubscriptionActive } from '../../context/RealtimeStore';
import type { MenuItem } from '../../context/RealtimeStore';
import { Search, X } from 'lucide-react';

function isRestaurantClosed(
  openTimeStr?: string,
  closeTimeStr?: string,
  daySpecificHours?: Record<string, { openTime: string; closeTime: string; closed?: boolean }>
): boolean {
  try {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];

    let finalOpenStr = openTimeStr;
    let finalCloseStr = closeTimeStr;

    if (daySpecificHours && daySpecificHours[todayName]) {
      const todayHours = daySpecificHours[todayName];
      if (todayHours.closed) return true;
      if (todayHours.openTime && todayHours.closeTime) {
        finalOpenStr = todayHours.openTime;
        finalCloseStr = todayHours.closeTime;
      }
    }

    if (!finalOpenStr || !finalCloseStr) return false;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = finalOpenStr.split(':').map(Number);
    const [closeH, closeM] = finalCloseStr.split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (openMinutes === closeMinutes) {
      return false;
    }
    if (closeMinutes > openMinutes) {
      return currentMinutes < openMinutes || currentMinutes > closeMinutes;
    } else {
      const isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      return !isOpen;
    }
  } catch (e) {
    console.error('Error parsing business hours:', e);
    return false;
  }
}

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

// Reusable meal card — used in both categorized and uncategorized sections
function MealCard({
  item,
  qty,
  restaurant,
  getRatingDetails,
  handleOpenVariantModal,
  handleAddToCart,
  handleIncrement,
  handleDecrement,
  t,
}: {
  item: MenuItem;
  qty: number;
  restaurant: any;
  getRatingDetails: (id: string) => { rating: string; reviews: number };
  handleOpenVariantModal: (item: MenuItem) => void;
  handleAddToCart: (item: MenuItem) => void;
  handleIncrement: (id: string, name: string, price: number) => void;
  handleDecrement: (id: string) => void;
  t: (key: any) => string;
}) {
  const { rating, reviews } = getRatingDetails(item.id);
  const isViewOnly = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('viewOnly') === 'true';
  const isReallyClosed = isRestaurantClosed(restaurant?.openTime, restaurant?.closeTime, restaurant?.daySpecificHours) || restaurant?.isManualClosed === true;
  const isCartAllowed = (!isViewOnly || restaurant?.deliveryEnabled) && !isReallyClosed;
  return (
    <div className="card" style={{
      padding: 0,
      background: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      gap: 0,
      alignItems: 'stretch',
      overflow: 'hidden',
    }}>
      {/* Left: Food Image — taller, fills card height */}
      <div
        onClick={() => handleOpenVariantModal(item)}
        style={{
          width: 90,
          minWidth: 90,
          alignSelf: 'stretch',
          borderRadius: 0,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--bg-elevated)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {item.image ? (
          <>
            <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {restaurant.overlayLogoOnMeals && restaurant.logo && (
              <div style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '0.5px solid #fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}>
                <img src={restaurant.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 36 }}>🍽️</div>
        )}
      </div>

      {/* Right: Content details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, padding: '10px 10px 10px 10px' }}>
        {/* Top: Name + veg indicator */}
        <div
          onClick={() => handleOpenVariantModal(item)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', marginBottom: 'auto' }}
        >
          <h3 style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--brand)',
            margin: 0,
            flex: 1,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {item.name}
          </h3>
          <VegNonVegIndicator isVeg={item.isVeg} size={13} />
        </div>

        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}>
            {item.variants && item.variants.length > 0 ? `From ₹${item.price}` : `₹${item.price}`}
          </span>
          {item.isFeatured && (
            <span style={{
              background: 'var(--customer-bestseller-bg, var(--brand-dim))',
              color: 'var(--customer-bestseller-text, var(--brand))',
              border: '1px solid var(--customer-bestseller-border, var(--border-brand))',
              fontSize: 7.5, fontWeight: 800, padding: '1px 5px',
              borderRadius: 3, letterSpacing: '0.02em',
              whiteSpace: 'nowrap', textTransform: 'uppercase'
            }}>
              {t('bestseller')}
            </span>
          )}
        </div>

        {/* Bottom Row: Rating on left, Cart controls on right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 6 }}>
          {/* Rating */}
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2, lineHeight: 1, flexShrink: 0 }}>
            <span style={{ color: '#f59e0b' }}>★</span>
            <span>{rating} ({reviews})</span>
          </span>

          {/* Cart Controls */}
          {isCartAllowed && (
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {item.variants && item.variants.length > 0 ? (
                <button
                  onClick={() => handleOpenVariantModal(item)}
                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, height: 26, borderRadius: '4px', background: 'var(--customer-add-to-cart-bg, #ffffff)', color: 'var(--customer-add-to-cart-text, #000000)', border: 'none' }}
                >
                  {t('add')} {qty > 0 ? `(${qty})` : ''} <FoodTrolley size={16} color="var(--customer-add-to-cart-text, #000000)" />
                </button>
              ) : qty === 0 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => handleAddToCart(item)}
                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, height: 26, borderRadius: '4px', background: 'var(--customer-add-to-cart-bg, #ffffff)', color: 'var(--customer-add-to-cart-text, #000000)', border: 'none' }}
                >
                  {t('add')} <FoodTrolley size={16} color="var(--customer-add-to-cart-text, #000000)" />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--customer-add-to-cart-bg, #ffffff)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: 26 }}>
                  <button
                    onClick={() => handleDecrement(item.id)}
                    style={{ width: 24, height: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--customer-add-to-cart-text, #000000)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >−</button>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--customer-add-to-cart-text, #000000)', minWidth: 14, textAlign: 'center' }}>{qty}</span>
                  <button
                    onClick={() => handleIncrement(item.id, item.name, item.price)}
                    style={{ width: 24, height: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--customer-add-to-cart-text, #000000)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerMenu() {
  const { state, dispatch, addToast } = useStore();
  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);
  const isViewOnly = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('viewOnly') === 'true';
  const isReallyClosed = isRestaurantClosed(restaurant?.openTime, restaurant?.closeTime, restaurant?.daySpecificHours) || restaurant?.isManualClosed === true;
  const isCartAllowed = (!isViewOnly || restaurant?.deliveryEnabled) && !isReallyClosed;
  const t = useTranslation();
  const [showOffersModal, setShowOffersModal] = useState(false);
  const activeCoupons = (state.coupons || []).filter(c => c.isActive && (!c.restaurantId || c.restaurantId === restaurantId));
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);
  const [sortBy] = useState<'popular' | 'low-high' | 'high-low'>('popular');
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    // Reset visible count when restaurant or category filters change
    setVisibleCount(10);
  }, [restaurantId, selectedCat, search, vegOnly, nonVegOnly]);

  const [variantModalItem, setVariantModalItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ name: string; price: number } | null>(null);
  const [variantQty, setVariantQty] = useState(1);
  const [cartConflictItem, setCartConflictItem] = useState<{
    item: MenuItem;
    actionType: 'add' | 'increment';
    incrementArgs?: { name: string; price: number };
  } | null>(null);
  // Tracks which category section is visible while scrolling in "all" mode
  const [scrollActiveCat, setScrollActiveCat] = useState<string>('');
  const mealsScrollRef = useRef<HTMLDivElement>(null);

  const MESSAGES = [
    '🍳 Warming up the griddle...',
    '🥦 Gathering the freshest ingredients...',
    '🍯 Preparing the secret spices...',
    '🍽️ Setting the tables...',
    '✨ Crafting your delicious experience...',
  ];

  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    setIsTimedOut(false);
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [restaurantId]);

  const hasItems = state.menuItems.some(i => i && i.restaurantId === restaurantId);
  const hasCategories = state.categories.some(c => c && c.restaurantId === restaurantId);
  const isLoading = (!hasItems || !hasCategories) && !isTimedOut;

  const [loadingMessage, setLoadingMessage] = useState('🍳 Warming up the grills...');

  useEffect(() => {
    if (!isLoading) return;
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % MESSAGES.length;
      setLoadingMessage(MESSAGES[msgIdx]);
    }, 1800);
    return () => clearInterval(msgInterval);
  }, [isLoading]);

  const [addonModalItem, setAddonModalItem] = useState<{
    item: MenuItem;
    qty: number;
    variant?: { name: string; price: number };
  } | null>(null);
  const [selectedAddonOptions, setSelectedAddonOptions] = useState<{
    [addonId: string]: string[];
  }>({});

  const getApplicableAddons = (item: MenuItem) => {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayName = daysOfWeek[new Date().getDay()];
    
    return (state.addons || []).filter(addon => {
      const isDayActive = !addon.activeDays || addon.activeDays.length === 0 || addon.activeDays.includes(todayName);
      if (!isDayActive) return false;

      const hasMeals = Array.isArray(addon.targetMealIds) && addon.targetMealIds.length > 0;
      const hasCats = Array.isArray(addon.targetCategoryIds) && addon.targetCategoryIds.length > 0;

      if (!hasMeals && !hasCats) return true;

      const mealMatch = hasMeals && addon.targetMealIds!.includes(item.id);
      const catMatch = hasCats && addon.targetCategoryIds!.includes(item.category || '');

      return mealMatch || catMatch;
    });
  };

  const handleOpenVariantModal = (item: MenuItem) => {
    setVariantModalItem(item);
    setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
    setVariantQty(1);
  };

  const subStatus = isSubscriptionActive(restaurant);
  const isLimitExceeded = !subStatus.active;
  const isHardLimitReached = !subStatus.active;
  const limitMessage = subStatus.reason || "The admin doesn't have any plan so you cant place an order.";

  // Get counts of active/available items in each category to filter out empty ones
  const categoryItemCounts = state.menuItems.reduce((acc, item) => {
    if (item && item.restaurantId === restaurantId && item.isAvailable) {
      if (item.category) {
        acc[item.category] = (acc[item.category] || 0) + 1;
      }
      if (item.categories && Array.isArray(item.categories)) {
        item.categories.forEach(cId => {
          if (cId) acc[cId] = (acc[cId] || 0) + 1;
        });
      }
    }
    return acc;
  }, {} as Record<string, number>);

  const restaurantCategories = state.categories
    .filter(c => c && c.restaurantId === restaurantId && (categoryItemCounts[c.id] || 0) > 0)
    .sort((a, b) => ((a?.rank || 0) - (b?.rank || 0)));


  // Schedule enforcement helper
  const nowMinutes = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();
  const toMinutes = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const isWithinSchedule = (sch: { fromTime: string; toTime: string }) => {
    if (!sch) return false;
    const from = toMinutes(sch.fromTime);
    const to = toMinutes(sch.toTime);
    return from <= to ? nowMinutes >= from && nowMinutes <= to : nowMinutes >= from || nowMinutes <= to;
  };

  const filteredItems = state.menuItems.filter(item => {
    if (!item) return false;
    if (item.restaurantId !== restaurantId) return false;
    if (!item.isAvailable) return false;
    if (vegOnly && !item.isVeg) return false;
    if (nonVegOnly && item.isVeg) return false;
    // Featured category: only show featured items
    if (selectedCat === 'featured' && !item.isFeatured) return false;
    // Regular category filter
    if (selectedCat !== 'all' && selectedCat !== 'featured' && item.category !== selectedCat) return false;
    if (search && (!item.name || !item.name.toLowerCase().includes(search.toLowerCase()))) return false;

    // Schedule enforcement — check if this item is in a schedule that is currently inactive
    const itemSchedules = state.schedules.filter(s => s && s.targets && Array.isArray(s.targets) && s.targets.some(t => t && t.type === 'item' && t.id === item.id));
    if (itemSchedules.length > 0) {
      // At least one item-level schedule must be active
      if (!itemSchedules.some(isWithinSchedule)) return false;
    } else {
      // Fall back to category-level schedule check
      const catSchedules = state.schedules.filter(s => s && s.targets && Array.isArray(s.targets) && s.targets.some(t => t && t.type === 'category' && t.id === item.category));
      if (catSchedules.length > 0 && !catSchedules.some(isWithinSchedule)) return false;
    }

    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!a || !b) return 0;
    if (sortBy === 'low-high') return a.price - b.price;
    if (sortBy === 'high-low') return b.price - a.price;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return (a.rank || 0) - (b.rank || 0);
  });

  const visibleItems = sortedItems.slice(0, visibleCount);

  useEffect(() => {
    if (visibleCount >= sortedItems.length) return;
    const timer = setTimeout(() => {
      setVisibleCount(prev => prev + 20);
    }, 120);
    return () => clearTimeout(timer);
  }, [visibleCount, sortedItems.length]);

  const checkAndClearCartForDifferentRestaurant = (
    item: MenuItem,
    actionType: 'add' | 'increment',
    incrementArgs?: { name: string; price: number }
  ): boolean => {
    const cartItem = state.cart[0];
    if (cartItem) {
      const cartItemRestId = cartItem.restaurantId;
      const targetRestId = item.restaurantId || restaurantId;

      if (cartItemRestId && cartItemRestId !== targetRestId) {
        setCartConflictItem({ item, actionType, incrementArgs });
        return false;
      }
    }
    return true;
  };

  const handleAddToCart = (item: MenuItem) => {
    if (isLimitExceeded) {
      addToast('error', isHardLimitReached
        ? 'Ordering is temporarily unavailable: waiting for the restaurant owner to recharge us...'
        : 'Ordering is temporarily unavailable as this restaurant has reached its monthly order capacity limit.'
      );
      return;
    }
    if (!checkAndClearCartForDifferentRestaurant(item, 'add')) return;
    if (item.variants && item.variants.length > 0) {
      handleOpenVariantModal(item);
      return;
    }
    
    const applicable = getApplicableAddons(item);
    if (applicable.length > 0) {
      setAddonModalItem({ item, qty: 1 });
      setSelectedAddonOptions({});
      return;
    }

    dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: item.id, name: item.name, price: item.price, qty: 1, restaurantId: item.restaurantId || restaurantId } });
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
    if (!item) return;
    if (!checkAndClearCartForDifferentRestaurant(item, 'increment', { name, price })) return;
    if (item.variants && item.variants.length > 0) {
      handleOpenVariantModal(item);
      return;
    }

    const applicable = getApplicableAddons(item);
    if (applicable.length > 0) {
      setAddonModalItem({ item, qty: 1 });
      setSelectedAddonOptions({});
      return;
    }

    dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: itemId, name, price, qty: 1, restaurantId: item.restaurantId || restaurantId } });
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
    const item = state.menuItems.find(i => i.id === itemId);
    const ratingVal = item?.rating !== undefined ? Number(item.rating) : 0;
    const reviewsVal = item?.ratingsCount ?? 0;
    
    const rating = ratingVal > 0 ? ratingVal.toFixed(1) : '0.0';
    const reviews = reviewsVal;
    return { rating, reviews };
  };

  // Build sidebar list: All (highlighted), Featured (highlighted), then normal categories
  const hasFeaturedItems = state.menuItems.some(i => i && i.restaurantId === restaurantId && i.isAvailable && i.isFeatured);
  const sidebarCategories = [
    { id: 'all', name: 'All', isSpecial: true },
    ...(hasFeaturedItems ? [{ id: 'featured', name: 'Featured', isSpecial: true }] : []),
    ...restaurantCategories.map(c => ({ ...c, isSpecial: false })),
  ];

  // Scroll handler to highlight categories as the user scrolls in "All" mode
  const handleMealsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (selectedCat !== 'all') return;
    if (visibleItems.length < sortedItems.length) return; // Skip scroll updates during progressive loading
    const container = e.currentTarget;

    // If scrolled to top, highlight "All"
    if (container.scrollTop <= 10) {
      setScrollActiveCat('all');
      return;
    }

    const sections = container.querySelectorAll('[data-catid]');
    let currentCat = '';
    const containerRect = container.getBoundingClientRect();

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i] as HTMLElement;
      const rect = sec.getBoundingClientRect();
      const topOffset = rect.top - containerRect.top;
      const bottomOffset = rect.bottom - containerRect.top;

      if (topOffset <= 60 && bottomOffset > 10) {
        currentCat = sec.dataset.catid || '';
      }
    }

    if (currentCat) {
      setScrollActiveCat(currentCat);
    }
  };

  useEffect(() => {
    if (selectedCat !== 'all') {
      setScrollActiveCat('');
    } else {
      setScrollActiveCat('all');
    }
  }, [selectedCat]);

  // Shared card props for MealCard component
  const cardProps = {
    restaurant,
    getRatingDetails,
    handleOpenVariantModal,
    handleAddToCart,
    handleIncrement,
    handleDecrement,
    t,
  };

  return (
    <div style={{
      animation: 'fadeIn 0.3s ease',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      // Full page height — inner columns manage their own scroll
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {isLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {/* Frying Pan & Flipping Egg Animation Wrapper */}
          <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            {/* Spinning Neon Ring */}
            <div style={{
              position: 'absolute',
              width: 100,
              height: 100,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'var(--brand)',
              borderBottomColor: 'rgba(255, 125, 0, 0.1)',
              animation: 'spin 1.5s linear infinite',
            }} />
            
            {/* Cooking Pan & Food Icon */}
            <div style={{
              fontSize: 48,
              animation: 'cookPan 1.8s ease-in-out infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}>
              🍳
            </div>
            
            {/* Rising Steam Particles */}
            <div style={{
              position: 'absolute',
              top: 15,
              display: 'flex',
              gap: 8,
              opacity: 0.8
            }}>
              <span className="steam-particle" style={{ animationDelay: '0s' }}>☁️</span>
              <span className="steam-particle" style={{ animationDelay: '0.4s' }}>☁️</span>
              <span className="steam-particle" style={{ animationDelay: '0.8s' }}>☁️</span>
            </div>
          </div>

          <h2 style={{
            fontSize: 20,
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            color: 'var(--brand)',
            marginBottom: 8,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            textTransform: 'uppercase',
            filter: 'drop-shadow(0 0 10px rgba(255, 125, 0, 0.3))'
          }}>
            Cooking Up Your Menu
          </h2>
          
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            fontWeight: 600,
            textAlign: 'center',
            padding: '0 24px',
            lineHeight: 1.5,
            minHeight: 20,
            transition: 'all 0.3s ease-out',
            animation: 'pulseText 2s infinite'
          }}>
            {loadingMessage}
          </p>

          {/* Embedded Styles for custom loading keyframes */}
          <style>{`
            @keyframes cookPan {
              0%, 100% { transform: rotate(0deg) translateY(0); }
              25% { transform: rotate(-15deg) translateY(-8px); }
              50% { transform: rotate(15deg) translateY(2px); }
              75% { transform: rotate(-5deg) translateY(-4px); }
            }
            @keyframes pulseText {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
            .steam-particle {
              font-size: 10px;
              animation: riseSteam 1.5s ease-out infinite;
              opacity: 0;
              transform: translateY(10px);
            }
            @keyframes riseSteam {
              0% { opacity: 0; transform: translateY(15px) scale(0.6); }
              50% { opacity: 0.8; }
              100% { opacity: 0; transform: translateY(-20px) scale(1.2); }
            }
          `}</style>
        </div>
      )}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>

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
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          flexShrink: 0,
        }}>
          {limitMessage}
        </div>
      )}

      {isReallyClosed && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--error)',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: 700,
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'center',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease',
          flexShrink: 0,
        }}>
          <span>⚠️</span> The restaurant is currently closed. No new orders are being accepted.
        </div>
      )}

      {/* Header and filters section — sticky at top */}
      <div style={{
        padding: '16px 16px 10px',
        flexShrink: 0,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderBottom: '1px solid var(--border)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Offers Scrolling Ticker */}
        {activeCoupons.length > 0 && (
          <div
            onClick={() => setShowOffersModal(true)}
            style={{
              background: 'rgba(255, 125, 0, 0.06)',
              border: '1px solid rgba(255, 125, 0, 0.15)',
              padding: '6px 10px',
              cursor: 'pointer',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              position: 'relative',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none',
              marginBottom: 4,
            }}
          >
            {/* Styles for marquee animation */}
            <style>{`
              @keyframes marquee-scroll {
                0% { transform: translateX(100%); }
                100% { transform: translateX(-100%); }
              }
              .ticker-text {
                display: inline-block;
                animation: marquee-scroll 22s linear infinite;
                font-size: 11px;
                font-weight: 700;
                color: var(--brand);
                padding-left: 10%;
              }
              .ticker-text:hover {
                animation-play-state: paused;
              }
            `}</style>
            <div style={{ position: 'absolute', left: 8, background: 'var(--bg-glass)', padding: '0 4px', zIndex: 2, fontSize: 10, fontWeight: 800, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 3 }}>
              🏷️ <span style={{ textTransform: 'uppercase', fontSize: 9 }}>Offers</span>:
            </div>
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <div className="ticker-text">
                {activeCoupons.map((c, idx) => {
                  const desc = c.type === 'percentage'
                    ? `🎉 Get ${c.value}% OFF using code ${c.code}${c.minOrderAmount ? ` (Min order ₹${c.minOrderAmount})` : ''}`
                    : `🎉 Flat ₹${c.value} OFF using code ${c.code}${c.minOrderAmount ? ` (Min order ₹${c.minOrderAmount})` : ''}`;
                  return `${desc}${idx < activeCoupons.length - 1 ? '   •   ' : ''}`;
                }).join(' ')}
              </div>
            </div>
          </div>
        )}

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
        </div>
      </div>

      {/* 2-Column Content Layout — sidebar fixed, meals scrollable independently */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden', // clip children so each scrolls independently
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Left Column: Categories Vertical Bar — scrollable independently */}
        <div style={{
          width: '28%',
          minWidth: '90px',
          maxWidth: '125px',
          height: '100%',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flexShrink: 0,
        }} className="hide-scrollbar">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: sidebarCategories.length <= 8 ? 'space-evenly' : 'flex-start',
            minHeight: '100%',
            padding: '4px 0',
            boxSizing: 'border-box'
          }}>
            {sidebarCategories.map((cat, idx) => {
              // In "all" mode: highlight whichever category section is currently scrolled to
              const isSelected = selectedCat === 'all'
                ? (scrollActiveCat ? cat.id === scrollActiveCat : cat.id === 'all')
                : selectedCat === cat.id;
              const isSpecial = (cat as any).isSpecial;

              // Determine highlight color
              let activeColor = 'var(--brand)';
              let activeBg = 'rgba(255, 125, 0, 0.12)';
              let activeBorder = '3px solid var(--brand)';

              if (vegOnly) {
                activeColor = 'var(--success)';
                activeBg = 'rgba(34, 197, 94, 0.12)';
                activeBorder = '3px solid var(--success)';
              } else if (nonVegOnly) {
                activeColor = 'var(--error)';
                activeBg = 'rgba(239, 68, 68, 0.12)';
                activeBorder = '3px solid var(--error)';
              }

              // Special categories (All, Featured) always show a subtle highlight even when not selected
              const specialIdleBg = isSpecial && !isSelected ? 'rgba(255, 125, 0, 0.05)' : 'transparent';
              const specialIdleColor = isSpecial && !isSelected ? 'var(--brand)' : 'var(--text-secondary)';
              const specialIdleBorder = isSpecial && !isSelected ? '3px solid rgba(255,125,0,0.2)' : '3px solid transparent';

              // Dynamic sizing to fit many categories cleanly
              const totalCats = sidebarCategories.length;
              const verticalPadding = totalCats > 18 ? 4 : (totalCats > 10 ? 7 : 12);
              const fontSz = totalCats > 18 ? 10 : (totalCats > 10 ? 11 : 12.5);

              // Distinct horizontal line between all categories:
              // Dark mode: white line. Light mode: black line.
              const isLast = idx === sidebarCategories.length - 1;
              const separatorColor = state.customerTheme === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)';
              const borderBottomVal = isLast ? 'none' : `1px solid ${separatorColor}`;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  style={{
                    padding: `${verticalPadding}px 6px ${verticalPadding}px 10px`,
                    fontSize: fontSz,
                    fontWeight: isSelected ? 800 : (isSpecial ? 700 : 600),
                    color: isSelected ? activeColor : (isSpecial ? specialIdleColor : 'var(--text-secondary)'),
                    background: isSelected ? activeBg : (isSpecial ? specialIdleBg : 'transparent'),
                    borderRight: isSelected ? activeBorder : (isSpecial ? specialIdleBorder : '3px solid transparent'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    lineHeight: 1.2,
                    borderBottom: borderBottomVal,
                    marginBottom: cat.id === 'featured' ? 3 : 0,
                    marginTop: cat.id === 'featured' ? 1 : 0,
                  }}
                >
                  {cat.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Meals List — scrollable independently */}
        <div
          ref={mealsScrollRef}
          onScroll={handleMealsScroll}
          style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 12px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxSizing: 'border-box',
        }} className="hide-scrollbar">
          {sortedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No items found matching your filters.</p>
            </div>
          ) : selectedCat === 'featured' ? (
            /* Featured: flat list with a header */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  <span>⭐ Featured</span>
                </h2>
                <span style={{
                  fontSize: 9, fontWeight: 800, color: '#000',
                  background: 'var(--brand)', padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.04em'
                }}>
                  {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleItems.map(item => (
                  <MealCard key={item.id} item={item} qty={getCartQty(item.id)} {...cardProps} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {(selectedCat === 'all' ? restaurantCategories : restaurantCategories.filter(c => c && c.id === selectedCat)).map(cat => {
                if (!cat) return null;
                const totalCatItemsCount = sortedItems.filter(i => i && (i.category === cat.id || (i.categories && Array.isArray(i.categories) && i.categories.includes(cat.id)))).length;
                const catItems = visibleItems.filter(i => i && (i.category === cat.id || (i.categories && Array.isArray(i.categories) && i.categories.includes(cat.id))));
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id} data-catid={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                        {totalCatItemsCount} {totalCatItemsCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Items list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {catItems.map(item => (
                        <MealCard key={item.id} item={item} qty={getCartQty(item.id)} {...cardProps} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Fallback: show items whose category doesn't match any known category */}
              {(() => {
                if (selectedCat !== 'all') return null;
                const knownCatIds = new Set(restaurantCategories.filter(c => c && c.id).map(c => c.id));
                const totalUncategorizedCount = sortedItems.filter(i =>
                  i &&
                  !knownCatIds.has(i.category) &&
                  (!i.categories || !Array.isArray(i.categories) || i.categories.every(cId => !knownCatIds.has(cId)))
                ).length;
                if (totalUncategorizedCount === 0) return null;

                const uncategorizedItems = visibleItems.filter(i =>
                  i &&
                  !knownCatIds.has(i.category) &&
                  (!i.categories || !Array.isArray(i.categories) || i.categories.every(cId => !knownCatIds.has(cId)))
                );
                if (uncategorizedItems.length === 0) return null;

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
                        {totalUncategorizedCount} {totalUncategorizedCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {uncategorizedItems.map(item => (
                        <MealCard key={item.id} item={item} qty={getCartQty(item.id)} {...cardProps} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {showOffersModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowOffersModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 360, padding: 20, position: 'relative', borderRadius: 16 }}>
            <button
              onClick={() => setShowOffersModal(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'var(--border)',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 10
              }}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              🎁 Current Offers &amp; Coupons
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {activeCoupons.map(c => {
                const desc = c.type === 'percentage'
                  ? `Get ${c.value}% OFF${c.minOrderAmount ? ` on orders above ₹${c.minOrderAmount}` : ''}`
                  : `Flat ₹${c.value} OFF${c.minOrderAmount ? ` on orders above ₹${c.minOrderAmount}` : ''}`;
                return (
                  <div key={c.id} style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        color: 'var(--brand)',
                        background: 'rgba(255, 125, 0, 0.1)',
                        border: '1.5px dashed var(--brand)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontFamily: 'monospace'
                      }}>
                        {c.code}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.code);
                          addToast('success', `📋 Copied code: ${c.code}`);
                        }}
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#fff',
                          background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: 8,
                          cursor: 'pointer'
                        }}
                      >
                        Copy Code
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

            {/* Meal image */}
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
                <>
                  <img src={variantModalItem.image} alt={variantModalItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {restaurant.overlayLogoOnMeals && restaurant.logo && (
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '0.5px solid #fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}>
                      <img src={restaurant.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </>
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

            {/* Meal name */}
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--brand)', textTransform: 'uppercase', margin: 0 }}>
                {variantModalItem.name}
              </h3>
            </div>

            {/* Add to cart controls — just below name, before variants */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {isCartAllowed ? (
                <>
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
                      const applicable = getApplicableAddons(variantModalItem);
                      if (applicable.length > 0) {
                        setAddonModalItem({
                          item: variantModalItem,
                          qty: variantQty,
                          variant: selectedVariant || undefined
                        });
                        setSelectedAddonOptions({});
                        setVariantModalItem(null);
                        return;
                      }

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
                </>
              ) : (
                <div style={{ flex: 1, textAlign: 'center', padding: '8px 12px', background: 'rgba(249, 115, 22, 0.1)', color: '#ea580c', border: '1px dashed rgba(249, 115, 22, 0.3)', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                  👁️ View-Only Mode (Ordering Disabled)
                </div>
              )}
            </div>

            {/* Description — only in popup */}
            {variantModalItem.description && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {variantModalItem.description}
                </p>
              </div>
            )}

            {/* Variants */}
            {variantModalItem.variants && variantModalItem.variants.length > 0 && (
              <div style={{ marginBottom: 4 }}>
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

          </div>
        </div>
      )}

      {/* Add-on Selection Modal */}
      {addonModalItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            width: '100%',
            maxWidth: 480,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: '24px 20px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 26, fontWeight: 900, margin: 0, color: 'var(--brand)', letterSpacing: '-0.5px' }}>
                  Add Ons
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>
                  {addonModalItem.item.name}{addonModalItem.variant ? ` · ${addonModalItem.variant.name}` : ''}
                </div>
              </div>
              <button
                onClick={() => setAddonModalItem(null)}
                style={{
                  background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, flexShrink: 0, marginTop: 2
                }}
              >
                ✕
              </button>
            </div>

            {/* Applicable Addon Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, margin: '10px 0' }}>
              {getApplicableAddons(addonModalItem.item).map(addon => {
                const selections = selectedAddonOptions[addon.id] || [];
                const max = addon.maxSelections || 1;
                const min = addon.minSelections || 0;
                const isRequired = addon.isRequired || min > 0;

                return (
                  <div key={addon.id} style={{
                    background: 'var(--bg-surface)',
                    padding: 14,
                    borderRadius: 12,
                    border: '1.5px solid var(--border)'
                  }}>
                    {/* Addon Group Header info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {addon.name}
                        </span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {isRequired ? `Required · Choose at least ${min}` : `Optional · Choose up to ${max}`}
                        </div>
                      </div>
                      {isRequired && (
                        <span style={{
                          fontSize: 10, background: 'var(--brand)', color: '#fff',
                          padding: '3px 8px', borderRadius: 6, fontWeight: 800, textTransform: 'uppercase', flexShrink: 0
                        }}>
                          Required
                        </span>
                      )}
                    </div>

                    {/* Options list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(addon.options || []).map(opt => {
                        const isLinkedAvailable = !opt.linkedMealId || (() => {
                          const meal = state.menuItems.find(m => m.id === opt.linkedMealId);
                          return meal && meal.isAvailable !== false;
                        })();
                        const isAvailable = opt.isAvailable !== false && isLinkedAvailable;
                        const isChecked = selections.includes(opt.id);

                        const handleSelect = () => {
                          if (!isAvailable) return;
                          if (max === 1) {
                            setSelectedAddonOptions(p => ({
                              ...p,
                              [addon.id]: [opt.id]
                            }));
                          } else {
                            if (isChecked) {
                              setSelectedAddonOptions(p => ({
                                ...p,
                                [addon.id]: (p[addon.id] || []).filter(id => id !== opt.id)
                              }));
                            } else {
                              if ((selections).length >= max) {
                                addToast('warning', `You can select up to ${max} options for ${addon.name}.`);
                                return;
                              }
                              setSelectedAddonOptions(p => ({
                                ...p,
                                [addon.id]: [...(p[addon.id] || []), opt.id]
                              }));
                            }
                          }
                        };

                        return (
                          <div
                            key={opt.id}
                            onClick={handleSelect}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px 14px',
                              borderRadius: 10,
                              background: isChecked ? 'rgba(255, 107, 0, 0.12)' : 'var(--bg-elevated)',
                              border: isChecked ? '2px solid var(--brand)' : '1.5px solid var(--border)',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              opacity: isAvailable ? 1 : 0.5,
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type={max === 1 ? "radio" : "checkbox"}
                                name={addon.id}
                                checked={isChecked}
                                disabled={!isAvailable}
                                onChange={handleSelect}
                                style={{ margin: 0, accentColor: 'var(--brand)', width: 16, height: 16 }}
                              />
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {opt.name}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isAvailable ? 'var(--brand)' : 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                              {!isAvailable ? 'Out of Stock' : opt.price > 0 ? `+₹${opt.price}` : 'Free'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Add Action */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setAddonModalItem(null)}
                style={{ flex: 1, height: 44, borderRadius: 'var(--radius-full)' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const applicable = getApplicableAddons(addonModalItem.item);
                  for (const addon of applicable) {
                    const min = addon.minSelections || 0;
                    const isRequired = addon.isRequired || min > 0;
                    const selections = selectedAddonOptions[addon.id] || [];
                    if (isRequired && selections.length < min) {
                      addToast('error', `Please select at least ${min} option(s) for "${addon.name}".`);
                      return;
                    }
                  }

                  const addonsPayload = Object.entries(selectedAddonOptions).flatMap(([addonId, optIds]) => {
                    const addon = state.addons.find(a => a.id === addonId);
                    if (!addon) return [];
                    return optIds.map(optId => {
                      const opt = addon.options.find(o => o.id === optId);
                      if (!opt) return [];
                      return {
                        addonId: addon.id,
                        addonName: addon.name,
                        optionId: opt.id,
                        optionName: opt.name,
                        price: opt.price
                      };
                    }).flat();
                  });

                  const basePrice = addonModalItem.variant ? addonModalItem.variant.price : addonModalItem.item.price;
                  const addonsTotalPrice = addonsPayload.reduce((sum, opt) => sum + opt.price, 0);

                  dispatch({
                    type: 'ADD_TO_CART',
                    payload: {
                      menuItemId: addonModalItem.item.id,
                      name: addonModalItem.item.name,
                      price: basePrice + addonsTotalPrice,
                      qty: addonModalItem.qty,
                      variant: addonModalItem.variant || undefined,
                      addons: addonsPayload
                    }
                  });
                  addToast('success', `${addonModalItem.item.name} added to cart!`);
                  setAddonModalItem(null);
                }}
                style={{
                  flex: 2, height: 44, borderRadius: 'var(--radius-full)',
                  background: 'var(--customer-add-to-cart-bg, var(--brand))',
                  color: 'var(--customer-add-to-cart-text, #ffffff)'
                }}
              >
                Add to Cart — ₹{((addonModalItem.variant ? addonModalItem.variant.price : addonModalItem.item.price) + 
                  Object.entries(selectedAddonOptions).reduce((sum, [addonId, optIds]) => {
                    const addon = state.addons.find(a => a.id === addonId);
                    if (!addon) return sum;
                    return sum + optIds.reduce((sOpt, optId) => {
                      const opt = addon.options.find(o => o.id === optId);
                      return sOpt + (opt ? opt.price : 0);
                    }, 0);
                  }, 0)) * addonModalItem.qty}
              </button>
            </div>
          </div>
        </div>
      )}

      {cartConflictItem && (() => {
        const cartItem = state.cart[0];
        const prevRestName = state.restaurantAccounts?.find(acc => acc.id === cartItem.restaurantId)?.restaurantName || 'another restaurant';
        const currentRestName = restaurant?.name || 'this restaurant';

        return (
          <div className="modal-backdrop" style={{ zIndex: 1200 }}>
            <div className="modal-content" style={{ maxWidth: 360, padding: 24, borderRadius: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>
                Replace Cart Items?
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                Your cart contains items from <strong>{prevRestName}</strong>. 
                Would you like to clear the cart to add items from <strong>{currentRestName}</strong>, 
                or go back to <strong>{prevRestName}</strong>?
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => {
                    // 1. Clear cart
                    dispatch({ type: 'CLEAR_CART' });

                    // 2. Perform the deferred action
                    const { item, actionType, incrementArgs } = cartConflictItem;
                    if (actionType === 'add') {
                      if (item.variants && item.variants.length > 0) {
                        handleOpenVariantModal(item);
                      } else {
                        const applicable = getApplicableAddons(item);
                        if (applicable.length > 0) {
                          setAddonModalItem({ item, qty: 1 });
                          setSelectedAddonOptions({});
                        } else {
                          dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: item.id, name: item.name, price: item.price, qty: 1, restaurantId: item.restaurantId || restaurantId } });
                          addToast('success', `${item.name} added to cart!`);
                        }
                      }
                    } else if (actionType === 'increment' && incrementArgs) {
                      if (item.variants && item.variants.length > 0) {
                        handleOpenVariantModal(item);
                      } else {
                        const applicable = getApplicableAddons(item);
                        if (applicable.length > 0) {
                          setAddonModalItem({ item, qty: 1 });
                          setSelectedAddonOptions({});
                        } else {
                          dispatch({ type: 'ADD_TO_CART', payload: { menuItemId: item.id, name: incrementArgs.name, price: incrementArgs.price, qty: 1, restaurantId: item.restaurantId || restaurantId } });
                        }
                      }
                    }
                    setCartConflictItem(null);
                  }}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                    color: '#000',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255,125,0,0.2)'
                  }}
                >
                  Clear Cart &amp; Add Item
                </button>

                <button
                  onClick={() => {
                    // Go back to the previous restaurant:
                    const prevRestId = cartItem.restaurantId;
                    if (prevRestId) {
                      dispatch({ type: 'SET_ACTIVE_CUSTOMER_RESTAURANT', payload: prevRestId });
                      const newUrl = `${window.location.pathname}?restaurant=${prevRestId}`;
                      window.history.pushState({}, '', newUrl);
                    }
                    setCartConflictItem(null);
                  }}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 20,
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1.5px solid var(--border)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Go Back to {prevRestName}
                </button>

                <button
                  onClick={() => setCartConflictItem(null)}
                  style={{
                    width: '100%',
                    height: 36,
                    borderRadius: 18,
                    background: 'none',
                    color: 'var(--text-muted)',
                    border: 'none',
                    fontWeight: 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    marginTop: 4
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
