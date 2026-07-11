import { useEffect, useState, useRef } from 'react';
import { useStore, getActiveRestaurantId, getActiveRestaurantInfo } from '../../context/RealtimeStore';

function isRestaurantClosed(openTimeStr?: string, closeTimeStr?: string): boolean {
  if (!openTimeStr || !closeTimeStr) return false;
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = openTimeStr.split(':').map(Number);
    const [closeH, closeM] = closeTimeStr.split(':').map(Number);

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
import { hasFirebaseConfig } from '../../utils/firebase';
import CustomerHome from './CustomerHome';
import CustomerMenu from './CustomerMenu';
import CustomerOrders from './CustomerOrders';
import CustomerMore from './CustomerMore';
import CustomerBottomNav from './CustomerBottomNav';
import CustomerCart from './CustomerCart';
import { ShoppingBag, Clock, ChefHat, Truck, Check, X, MapPin, ChevronUp, Star, CreditCard, Coins, QrCode, ArrowLeft } from 'lucide-react';
import { playChime, triggerNotification } from '../../utils/notifications';

type Props = { tableId: string };

export default function CustomerLayout({ tableId }: Props) {
  const { state, dispatch, addToast } = useStore();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedActiveOrderIndex, setSelectedActiveOrderIndex] = useState(0);
  const [lastActiveOrdersCount, setLastActiveOrdersCount] = useState(0);
  
  // Local payment screen states (for when orders are delivered/ready)
  const [paymentOption, setPaymentOption] = useState<'none' | 'upi' | 'cash' | 'card'>('none');
  const [mealRatings, setMealRatings] = useState<Record<string, number>>({});
  const [riderRating, setRiderRating] = useState(0);
  const [riderReview, setRiderReview] = useState('');
  const [foodRating, setFoodRating] = useState(0);
  const [foodReview, setFoodReview] = useState('');
  const [ratingPopupStep, setRatingPopupStep] = useState<'success' | 'rate'>('success');
  const [dismissedFeedbacks, setDismissedFeedbacks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('meenufy_dismissed_feedbacks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Consent state for native Web Notifications
  const [notificationPermission, setNotificationPermission] = useState(() => 
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleRequestPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((perm) => {
        setNotificationPermission(perm);
        if (perm === 'granted') {
          addToast('success', '🔔 Notifications enabled successfully!');
          playChime();
        }
      });
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const isViewOnly = urlParams.get('viewOnly') === 'true' || window.location.pathname === '/home';

  useEffect(() => {
    dispatch({ type: 'SET_CUSTOMER_TABLE', payload: tableId });
    dispatch({ type: 'SET_VIEW', payload: 'customer' });

    // Always derive restaurantId from URL params (most reliable - doesn't depend on admin login state)
    const rId = urlParams.get('restaurant') || getActiveRestaurantId(state);
    const prevRestaurantId = localStorage.getItem('meenufy_active_restaurant_id');
    if (prevRestaurantId && prevRestaurantId !== rId) {
      dispatch({ type: 'CLEAR_CART' });
      addToast('info', 'Switched restaurant. Cart has been reset.');
    }
    localStorage.setItem('meenufy_active_restaurant_id', rId);

    const restaurant = getActiveRestaurantInfo(state, rId);
    if (isViewOnly && !restaurant?.deliveryEnabled) {
      dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'home' });
    }
  }, [tableId, isViewOnly, state.restaurantAccounts]);

  useEffect(() => {
    const rId = urlParams.get('restaurant') || getActiveRestaurantId(state);
    const restaurant = getActiveRestaurantInfo(state, rId);
    if (isViewOnly && !restaurant?.deliveryEnabled && state.customerTab !== 'home') {
      dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'home' });
    }
  }, [isViewOnly, state.customerTab, state.restaurantAccounts]);

  // Track the REAL viewport height via window.innerHeight (100dvh is unreliable on Android Chrome)
  // and expose it as --app-height CSS variable for the container to use.
  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    setAppHeight(); // Set immediately on mount
    window.addEventListener('resize', setAppHeight);
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);



  // Retrieve current user's phone identifier or guest fallback ID from localStorage
  const myPhoneIdentifier = localStorage.getItem('meenufy_customer_phone') || localStorage.getItem('meenufy_customer_guest_id') || '';

  // Find active orders chronologically ONLY for this customer (ignores other table guests/strangers)
  const activeOrders = state.orders
    .filter(o => (o.tableId === tableId || o.orderType === 'delivery') && !['served', 'cancelled'].includes(o.status) && o.customerPhone === myPhoneIdentifier)
    .sort((a, b) => a.createdAt - b.createdAt);

  const activeOrder = activeOrders[selectedActiveOrderIndex] || activeOrders[0];

  const rId = new URLSearchParams(window.location.search).get('restaurant') || getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, rId);
  const isClosed = (isRestaurantClosed(restaurant?.openTime, restaurant?.closeTime) || restaurant?.isManualClosed === true) && activeOrders.length === 0;

  if (isClosed) {
    return (
      <div className="customer-layout-container" style={{
        display: 'flex', flexDirection: 'column',
        height: 'var(--app-height, 100dvh)',
        width: '100%',
        background: '#0a0a0a',
        color: '#fff',
        maxWidth: 480, margin: '0 auto', position: 'relative',
        overflowY: 'auto',
        boxSizing: 'border-box',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        fontFamily: 'var(--font-body, "Inter", sans-serif)'
      }}>
        <style>{`
          @keyframes neonFlicker {
            0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
              text-shadow: 0 0 4px #fff, 0 0 10px #ff7d00, 0 0 20px #ff7d00, 0 0 30px #ff7d00;
              color: #fff;
            }
            20%, 22%, 24%, 55% {
              text-shadow: 0 0 2px rgba(255,125,0,0.2);
              color: #4a1d00;
            }
          }
          @keyframes bounceClock {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-10px) scale(1.05); }
          }
          @keyframes glowPulse {
            0%, 100% { box-shadow: 0 0 15px rgba(255,125,0,0.15); }
            50% { box-shadow: 0 0 30px rgba(255,125,0,0.35); }
          }
        `}</style>

        {/* Pulsating Clock and Glowing Sign Container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          marginBottom: 36
        }}>
          {/* Pulsating Clock */}
          <div style={{
            fontSize: 72,
            animation: 'bounceClock 3s ease-in-out infinite',
            lineHeight: 1,
            userSelect: 'none'
          }}>
            ⏰
          </div>

          {/* Neon CLOSED Sign */}
          <div style={{
            fontFamily: 'var(--font-display), "Outfit", sans-serif',
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: 'uppercase',
            animation: 'neonFlicker 3s infinite alternate',
            border: '3px solid #ff7d00',
            padding: '8px 24px',
            borderRadius: 8,
            boxShadow: '0 0 15px rgba(255,125,0,0.3), inset 0 0 10px rgba(255,125,0,0.2)',
            background: 'rgba(255, 125, 0, 0.05)',
            userSelect: 'none'
          }}>
            CLOSED
          </div>
        </div>

        {/* Message */}
        <h2 style={{
          fontFamily: 'var(--font-display), "Outfit", sans-serif',
          fontSize: 22,
          fontWeight: 800,
          textAlign: 'center',
          marginBottom: 8,
          color: '#ffffff'
        }}>
          {restaurant?.name || 'Restaurant'}
        </h2>
        <p style={{
          fontSize: 14,
          color: 'var(--text-muted, #a3a3a3)',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: 320,
          marginBottom: 32
        }}>
          We are currently closed. Please check our opening hours or get in touch with us directly below.
        </p>

        {/* Business Hours Card */}
        <div style={{
          width: '100%',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 500 }}>Opening Time</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>{restaurant?.openTime || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 500 }}>Closing Time</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>{restaurant?.closeTime || 'N/A'}</span>
          </div>
        </div>

        {/* Floating Contact Card */}
        <div style={{
          width: '100%',
          background: 'linear-gradient(135deg, rgba(255, 125, 0, 0.08) 0%, rgba(0, 0, 0, 0) 100%)',
          border: '1px solid rgba(255, 125, 0, 0.2)',
          borderRadius: 20,
          padding: 24,
          boxSizing: 'border-box',
          animation: 'glowPulse 4s infinite ease-in-out'
        }}>
          <h4 style={{
            fontFamily: 'var(--font-display), "Outfit", sans-serif',
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--brand)',
            letterSpacing: 1,
            marginBottom: 16
          }}>
            Contact Details
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {restaurant?.phone && (
              <a href={`tel:${restaurant.phone}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#fff',
                textDecoration: 'none',
                fontSize: 13,
                transition: 'color 0.2s'
              }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand)'} onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}>
                <span style={{ fontSize: 16 }}>📞</span>
                <div>
                  <div style={{ fontSize: 10, color: '#a3a3a3' }}>Call Us</div>
                  <div style={{ fontWeight: 600 }}>{restaurant.phone}</div>
                </div>
              </a>
            )}

            {restaurant?.email && (
              <a href={`mailto:${restaurant.email}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#fff',
                textDecoration: 'none',
                fontSize: 13,
                transition: 'color 0.2s'
              }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand)'} onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}>
                <span style={{ fontSize: 16 }}>✉️</span>
                <div>
                  <div style={{ fontSize: 10, color: '#a3a3a3' }}>Email Us</div>
                  <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{restaurant.email}</div>
                </div>
              </a>
            )}

            {restaurant?.address && (
              <div style={{
                display: 'flex',
                alignItems: 'start',
                gap: 12,
                fontSize: 13,
                color: '#fff'
              }}>
                <span style={{ fontSize: 16, marginTop: 2 }}>📍</span>
                <div>
                  <div style={{ fontSize: 10, color: '#a3a3a3' }}>Location</div>
                  <div style={{ fontWeight: 500, lineHeight: 1.4 }}>{restaurant.address}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);

  // Auto-open status modal when a new order is added
  useEffect(() => {
    if (activeOrders.length > lastActiveOrdersCount) {
      setSelectedActiveOrderIndex(activeOrders.length - 1);
      setShowStatusModal(true);
      // Reset local payment selection
      setPaymentOption('none');
    }
    setLastActiveOrdersCount(activeOrders.length);
  }, [activeOrders.length, lastActiveOrdersCount]);

  // Check if all active orders have been successfully delivered (status is 'ready' or 'bill_pay')
  const allActiveOrdersDelivered = activeOrders.length > 0 && activeOrders.every(o => o.status === 'ready' || o.status === 'bill_pay');

  // Check if any active order is in confirmation stage
  const isWaitingConfirmation = activeOrders.some(o => o.paymentStatus === 'waiting_confirmation');
  
  // Determine current active payment method if waiting
  const currentPaymentMethod = activeOrders.find(o => o.paymentStatus === 'waiting_confirmation')?.paymentMethod || 'none';

  // Find served orders for this table in the last 10 minutes that don't have ratings yet, specifically for this customer
  const unratedServedOrders = state.orders.filter(o => 
    (o.tableId === tableId || o.orderType === 'delivery') && 
    o.status === 'served' && 
    !o.ratings && 
    o.customerPhone === myPhoneIdentifier &&
    Date.now() - o.updatedAt < 600000 && // 10 minutes
    !dismissedFeedbacks.includes(o.id)
  );

  // Auto open/reset rating modal to success screen when payment is confirmed
  useEffect(() => {
    if (unratedServedOrders.length > 0) {
      setRatingPopupStep('success');
      setShowStatusModal(true);
    }
  }, [unratedServedOrders.length]);

  // Auto transition success screen to rating selector screen after 3 seconds
  useEffect(() => {
    if (unratedServedOrders.length > 0 && ratingPopupStep === 'success') {
      const timer = setTimeout(() => {
        setRatingPopupStep('rate');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [unratedServedOrders.length, ratingPopupStep]);

  // Watch status changes for this customer's active orders
  const activeOrdersString = JSON.stringify(
    activeOrders.map(o => ({ id: o.id, status: o.status, paymentStatus: o.paymentStatus }))
  );
  
  const prevOrdersRef = useRef<string>('');

  useEffect(() => {
    if (!prevOrdersRef.current) {
      prevOrdersRef.current = activeOrdersString;
      return;
    }
    
    try {
      const prevList = JSON.parse(prevOrdersRef.current) as { id: string; status: string; paymentStatus: string }[];
      activeOrders.forEach(order => {
        const prev = prevList.find(x => x.id === order.id);
        if (prev) {
          if (prev.status !== order.status) {
            if (order.status === 'preparing') {
              triggerNotification(
                `🍳 Order Preparing!`,
                `Your order #${order.id.slice(-4).toUpperCase()} is now being cooked in the kitchen.`
              );
            } else if (order.status === 'ready') {
              triggerNotification(
                `🛵 Order Ready!`,
                `Your order #${order.id.slice(-4).toUpperCase()} has been served to your table!`
              );
            } else if (order.status === 'served') {
              triggerNotification(
                `❤️ Order Completed!`,
                `Thank you for dining with us! Hope to see you again soon.`
              );
            }
          }
          if (prev.paymentStatus !== order.paymentStatus && order.paymentStatus === 'paid') {
            triggerNotification(
              `💳 Payment Confirmed!`,
              `Your payment for order #${order.id.slice(-4).toUpperCase()} has been approved. Thank you!`
            );
          }
        }
      });
    } catch (e) {
      console.error(e);
    }
    
    prevOrdersRef.current = activeOrdersString;
  }, [activeOrdersString]);

  const STEPS = [
    { status: 'pending', label: 'New Order', desc: 'Your order has been received', icon: ShoppingBag },
    { status: 'preparing', label: 'Preparing', desc: 'Our chef is cooking your food 🍳', icon: ChefHat },
    { status: 'ready', label: 'Ready', desc: 'Served at your table! 🛵', icon: Truck },
  ];

  const getStatusLabel = (status: string) => {
    if (status === 'pending') return 'New Order';
    if (status === 'preparing') return 'Preparing';
    if (status === 'ready') return 'Ready';
    if (status === 'bill_pay') return 'Bill & Pay';
    if (status === 'served') return 'Served';
    return status;
  };

  const getStatusDesc = (status: string) => {
    if (status === 'pending') return 'Order is placed!';
    if (status === 'preparing') return 'Cooking in the kitchen!';
    if (status === 'ready') return 'Delivered to your table!';
    if (status === 'bill_pay') return 'Waiting for payment...';
    return '';
  };

  const renderTab = () => {
    const rId = urlParams.get('restaurant') || state.activeCustomerRestaurantId;
    const hasActiveRestaurant = !!rId;

    switch (state.customerTab) {
      case 'home':
        if (hasActiveRestaurant) {
          // Show the menu for the active restaurant
          const activeRestaurantName = state.restaurantAccounts?.find(acc => acc.id === rId)?.restaurantName || state.restaurant?.name || 'Restaurant Menu';
          const activeRestaurantTagline = state.restaurantAccounts?.find(acc => acc.id === rId)?.tagline || state.restaurant?.tagline || 'Fresh & delicious meals';
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Restaurant Name Header with Back Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border)',
                position: 'sticky',
                top: 0,
                zIndex: 40
              }}>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_ACTIVE_CUSTOMER_RESTAURANT', payload: null });
                    // Clear query params to clean URL
                    const newUrl = window.location.pathname + '?view=customer';
                    window.history.pushState({}, '', newUrl);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--border)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
                    {activeRestaurantName}
                  </h2>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 1 }}>
                    {activeRestaurantTagline}
                  </p>
                </div>
              </div>
              
              {/* The Menu Content */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <CustomerMenu />
              </div>
            </div>
          );
        } else {
          // Show the Swiggy/Zomato style home screen
          return <CustomerHome />;
        }
      case 'orders': return <CustomerOrders tableId={tableId} />;
      case 'more': return <CustomerMore />;
      default: return <CustomerHome />;
    }
  };

  // Calculate total amount for all active orders
  const totalBillAmount = activeOrders.reduce((s, o) => s + o.totalAmount, 0);

  // Consolidate items for the bill summary
  const consolidatedBillItems: { name: string; qty: number; price: number; variant?: any }[] = [];
  activeOrders.forEach(o => {
    o.items.forEach(item => {
      const existing = consolidatedBillItems.find(x => x.name === item.name && x.variant?.name === item.variant?.name);
      if (existing) {
        existing.qty += item.qty;
      } else {
        consolidatedBillItems.push({ name: item.name, qty: item.qty, price: item.price, variant: item.variant });
      }
    });
  });

  const handleRequestPayment = (method: 'upi' | 'cash' | 'card') => {
    activeOrders.forEach(o => {
      dispatch({
        type: 'UPDATE_ORDER_PAYMENT',
        payload: { id: o.id, method, status: 'waiting_confirmation' }
      });
      dispatch({
        type: 'UPDATE_ORDER_STATUS',
        payload: { id: o.id, status: 'bill_pay' }
      });
    });
    addToast('success', method === 'upi' ? 'Payment submitted! Waiting for staff confirmation.' : 'Request sent! Waiter is bringing the bill.');
  };

  const handleCloseStatusModal = () => {
    if (unratedServedOrders.length > 0) {
      const idsToDismiss = unratedServedOrders.map(o => o.id);
      const updatedDismissed = [...dismissedFeedbacks, ...idsToDismiss];
      setDismissedFeedbacks(updatedDismissed);
      localStorage.setItem('meenufy_dismissed_feedbacks', JSON.stringify(updatedDismissed));
    }
    setShowStatusModal(false);
  };

  const handleRateMeals = () => {
    unratedServedOrders.forEach(o => {
      dispatch({
        type: 'RATE_ORDER',
        payload: {
          id: o.id,
          ratings: mealRatings,
          deliveryBoyRating: o.orderType === 'delivery' ? riderRating : undefined,
          deliveryBoyReview: o.orderType === 'delivery' ? riderReview : undefined,
          foodRating: o.orderType === 'delivery' ? foodRating : undefined,
          foodReview: o.orderType === 'delivery' ? foodReview : undefined
        }
      });
    });
    addToast('success', 'Thank you for your rating! ❤️');
    setMealRatings({});
    setRiderRating(0);
    setRiderReview('');
    setFoodRating(0);
    setFoodReview('');
    setShowStatusModal(false);
  };

  const hasActiveOrUnrated = activeOrders.length > 0 || unratedServedOrders.length > 0;

  return (
    <div className="customer-layout-container" style={{
      display: 'flex', flexDirection: 'column',
      height: 'var(--app-height, 100dvh)',
      width: '100%',
      background: 'var(--customer-bg-override, var(--bg-primary))',
      maxWidth: 480, margin: '0 auto', position: 'relative',
      overflow: 'hidden',
    }}>
      {isViewOnly && (
        <div style={{
          background: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
          color: '#ffffff',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '12px',
          fontWeight: 700,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(234, 88, 12, 0.3)'
        }}>
          <span style={{ fontSize: 14 }}>👁️</span>
          <span>View-Only Menu Mode (Ordering Disabled)</span>
        </div>
      )}
      {!hasFirebaseConfig && (
        <div style={{
          background: '#d97706',
          color: '#fff',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 600,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          flexShrink: 0
        }}>
          <span>⚠️ Demo Mode (Firebase Offline): Restart local server to save changes.</span>
        </div>
      )}
      {notificationPermission === 'default' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,125,0,0.15) 0%, rgba(255,125,0,0.05) 100%)',
          borderBottom: '1px solid var(--border-brand)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          animation: 'slideInDown 0.3s ease',
          zIndex: 400,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Live Updates Available</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>Enable notifications to know when your food is ready!</div>
            </div>
          </div>
          <button 
            onClick={handleRequestPermission}
            className="btn btn-primary"
            style={{
              padding: '6px 12px',
              fontSize: 11,
              background: 'var(--brand)',
              color: '#ffffff',
              fontWeight: 800,
              borderRadius: 6,
            }}
          >
            Enable
          </button>
        </div>
      )}

      {/* Page */}
      <div style={{
        flex: 1,
        minHeight: 0,
        // On menu tab: overflow:hidden so CustomerMenu manages its own column scroll independently
        overflowY: state.customerTab === 'menu' ? 'hidden' : 'auto',
        overflowX: 'hidden',
        width: '100%',
        maxWidth: '100%',
        paddingBottom: state.customerTab === 'menu' ? 0 : 'calc(68px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {renderTab()}
      </div>

      {/* Cart floating button */}
      {!isViewOnly && <CustomerCart tableId={tableId} />}

      {/* Floating Order Status Capsule */}
      {!isViewOnly && hasActiveOrUnrated && (
        <div
          onClick={() => setShowStatusModal(true)}
          style={{
            position: 'fixed',
            bottom: `calc(${(cartCount > 0 ? 142 : 82)}px + env(safe-area-inset-bottom, 0px))`,
            right: 16,
            zIndex: 200,
            background: unratedServedOrders.length > 0 
              ? 'rgba(16, 185, 129, 0.95)' 
              : (allActiveOrdersDelivered ? 'rgba(168, 85, 247, 0.95)' : 'rgba(13, 13, 13, 0.95)'),
            backdropFilter: 'blur(20px)',
            border: unratedServedOrders.length > 0 
              ? '1px solid #34d399' 
              : (allActiveOrdersDelivered ? '1px solid #c084fc' : '1px solid var(--border-brand)'),
            borderRadius: 99,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            animation: 'fadeInScale 0.3s ease',
            transition: 'all 0.3s ease'
          }}
        >
          {/* Pulsing live indicator */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: unratedServedOrders.length > 0 
              ? 'rgba(255,255,255,0.2)' 
              : (allActiveOrdersDelivered ? 'rgba(255,255,255,0.2)' : 'var(--brand-dim)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative'
          }}>
            <div className="dot-live" style={{ 
              background: unratedServedOrders.length > 0 ? '#fff' : (allActiveOrdersDelivered ? '#fff' : 'var(--brand)'), 
              width: 10, height: 10, position: 'absolute' 
            }} />
          </div>
          <div style={{ minWidth: 90 }}>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 800, 
              color: '#fff', 
              textTransform: 'uppercase', 
              letterSpacing: '0.04em', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4 
            }}>
              {unratedServedOrders.length > 0 
                ? 'Feedback 🌟' 
                : (allActiveOrdersDelivered 
                    ? (isWaitingConfirmation ? 'Verifying... ⏳' : 'Bill & Pay 💳') 
                    : `${getStatusLabel(activeOrder?.status || 'pending')} 🛵`)}
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {unratedServedOrders.length > 0 ? 'Review Meals' : `${activeOrders.length} Order(s) - Live`}
            </div>
          </div>
          <ChevronUp size={14} color="#fff" />
        </div>
      )}

      {/* Live Order Status & Payment Modal */}
      {showStatusModal && (activeOrder || unratedServedOrders.length > 0) && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && handleCloseStatusModal()}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: 24 }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ 
                  width: 8, height: 8, borderRadius: '50%', 
                  background: unratedServedOrders.length > 0 ? '#10b981' : (allActiveOrdersDelivered ? '#a855f7' : 'var(--brand)'), 
                  animation: 'pulse-dot 1.5s infinite' 
                }} />
                <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  {unratedServedOrders.length > 0 
                    ? 'Review & Feedback' 
                    : (allActiveOrdersDelivered ? 'Bill & Review' : 'Live Order Status')}
                </h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={handleCloseStatusModal} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* SWITCHER TABS (Only when not in bill stage & multiple orders exist) */}
            {unratedServedOrders.length === 0 && !allActiveOrdersDelivered && activeOrders.length > 1 && (
              <div style={{ 
                display: 'flex', 
                gap: 6, 
                marginBottom: 16, 
                padding: 4, 
                background: 'var(--bg-elevated)', 
                borderRadius: 8,
                overflowX: 'auto'
              }}>
                {activeOrders.map((ord, idx) => (
                  <button
                    key={ord.id}
                    onClick={() => setSelectedActiveOrderIndex(idx)}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: selectedActiveOrderIndex === idx ? 'var(--brand)' : 'transparent',
                      color: selectedActiveOrderIndex === idx ? '#000' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Order {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* MAIN PORTAL BODY */}
            {unratedServedOrders.length > 0 ? (
              /* --- MEAL & RESTAURANT RATING OVERLAY POPUP --- */
              ratingPopupStep === 'success' ? (
                /* Payment Success Green Screen */
                <div style={{ textAlign: 'center', padding: '20px 0', animation: 'fadeInScale 0.35s ease' }}>
                  <div style={{ 
                    width: 72, height: 72, borderRadius: '50%', 
                    background: 'rgba(16,185,129,0.1)', border: '2px solid #10b981',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#10b981', margin: '0 auto 16px',
                    animation: 'pulse-dot 1.5s infinite'
                  }}>
                    <Check size={36} strokeWidth={3} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginBottom: 6 }}>Successfully Done!</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Payment confirmed. Thank you for choosing us!
                  </p>
                  <button 
                    className="btn btn-primary"
                    style={{ background: '#10b981', border: '1px solid #059669', color: '#fff', padding: '8px 16px', borderRadius: 8 }}
                    onClick={() => setRatingPopupStep('rate')}
                  >
                    Rate Your Meals 🌟
                  </button>
                </div>
              ) : (
                /* Rating Selection Screen */
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
                    Please rate the dishes served to your table today.
                  </p>

                  {/* Items List for Rating */}
                  <div style={{ 
                    maxHeight: 220, overflowY: 'auto', 
                    background: 'var(--bg-elevated)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 12, padding: 12, textAlign: 'left',
                    marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14
                  }}>
                    {(() => {
                      const itemsToRate: { name: string; menuItemId: string }[] = [];
                      unratedServedOrders.forEach(o => {
                        o.items.forEach(i => {
                          if (!itemsToRate.some(x => x.menuItemId === i.menuItemId)) {
                            itemsToRate.push({ name: i.name, menuItemId: i.menuItemId });
                          }
                        });
                      });

                      return itemsToRate.map(item => {
                        const rating = mealRatings[item.menuItemId] || 0;
                        return (
                          <div key={item.menuItemId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {[1, 2, 3, 4, 5].map(starNum => (
                                <button
                                  key={starNum}
                                  onClick={() => setMealRatings(prev => ({ ...prev, [item.menuItemId]: starNum }))}
                                  style={{
                                    background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                                    color: starNum <= rating ? '#fbbf24' : 'var(--text-muted)',
                                    transition: 'transform 0.1s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1.0)'; }}
                                >
                                  <Star size={18} fill={starNum <= rating ? '#fbbf24' : 'none'} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Delivery Order Specific Ratings */}
                  {unratedServedOrders.some(o => o.orderType === 'delivery') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
                      
                      {/* Rider Rating */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🛵 Rate Delivery Rider</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[1, 2, 3, 4, 5].map(starNum => (
                            <button
                              key={starNum}
                              type="button"
                              onClick={() => setRiderRating(starNum)}
                              style={{
                                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                                color: starNum <= riderRating ? '#fbbf24' : 'var(--text-muted)',
                              }}
                            >
                              <Star size={18} fill={starNum <= riderRating ? '#fbbf24' : 'none'} />
                            </button>
                          ))}
                        </div>
                        <input
                          className="input"
                          type="text"
                          placeholder="Write rider review (optional)..."
                          value={riderReview}
                          onChange={e => setRiderReview(e.target.value)}
                          style={{ height: 32, fontSize: 11.5, marginTop: 4 }}
                        />
                      </div>

                      {/* Overall Food Rating */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px dashed var(--border)', paddingTop: 10, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🍔 Overall Food Rating</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[1, 2, 3, 4, 5].map(starNum => (
                            <button
                              key={starNum}
                              type="button"
                              onClick={() => setFoodRating(starNum)}
                              style={{
                                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                                color: starNum <= foodRating ? '#fbbf24' : 'var(--text-muted)',
                              }}
                            >
                              <Star size={18} fill={starNum <= foodRating ? '#fbbf24' : 'none'} />
                            </button>
                          ))}
                        </div>
                        <input
                          className="input"
                          type="text"
                          placeholder="Write overall food feedback (optional)..."
                          value={foodReview}
                          onChange={e => setFoodReview(e.target.value)}
                          style={{ height: 32, fontSize: 11.5, marginTop: 4 }}
                        />
                      </div>

                    </div>
                  )}

                  {/* Conditional Google Maps review button */}
                  {Object.values(mealRatings).some(r => r === 4 || r === 5) && (
                    <div style={{ 
                      background: 'rgba(34,197,94,0.06)', 
                      border: '1px solid rgba(34,197,94,0.2)', 
                      borderRadius: 8, padding: 12, marginBottom: 16,
                      animation: 'fadeIn 0.3s ease'
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                        We are glad you loved the food! Could you support us with a Google Maps review?
                      </div>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=Hideout+Cafe+Koramangala+Bengaluru"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-full"
                        style={{
                          background: '#fff',
                          color: '#1f2937',
                          border: '1px solid #d1d5db',
                          fontWeight: 700,
                          fontSize: 12.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        }}
                      >
                        <span style={{ display: 'flex', gap: 1 }}>
                          <span style={{ color: '#4285F4', fontWeight: 900 }}>G</span>
                          <span style={{ color: '#EA4335', fontWeight: 900 }}>o</span>
                          <span style={{ color: '#FBBC05', fontWeight: 900 }}>o</span>
                          <span style={{ color: '#4285F4', fontWeight: 900 }}>g</span>
                          <span style={{ color: '#34A853', fontWeight: 900 }}>l</span>
                          <span style={{ color: '#EA4335', fontWeight: 900 }}>e</span>
                        </span>
                        Review us on Google Maps
                      </a>
                    </div>
                  )}

                  {/* Submit ratings button */}
                  <button
                    className="btn btn-primary btn-full"
                    style={{ padding: '12px', fontWeight: 800 }}
                    onClick={handleRateMeals}
                    disabled={(() => {
                      const uniqueItemIds: string[] = [];
                      unratedServedOrders.forEach(o => {
                        o.items.forEach(i => {
                          if (!uniqueItemIds.includes(i.menuItemId)) {
                            uniqueItemIds.push(i.menuItemId);
                          }
                        });
                      });
                      const isDelivery = unratedServedOrders.some(o => o.orderType === 'delivery');
                      if (isDelivery) {
                        return riderRating === 0 || foodRating === 0;
                      }
                      return uniqueItemIds.some(id => !mealRatings[id]);
                    })()}
                  >
                    Submit Feedback
                  </button>
                </div>
              )
            ) : allActiveOrdersDelivered ? (
              /* --- BILL & PAY FLOW --- */
              <div>
                {isWaitingConfirmation ? (
                  /* Waiting Confirmation Screen */
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        border: '4px solid rgba(168,85,247,0.1)',
                        borderTop: '4px solid #a855f7',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <div style={{
                        position: 'absolute',
                        inset: 14,
                        background: 'rgba(168,85,247,0.1)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#a855f7'
                      }}>
                        <Clock size={18} />
                      </div>
                    </div>

                    <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>Waiting for Confirmation</h3>
                    
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 300, margin: '0 auto 20px' }}>
                      {currentPaymentMethod === 'upi' 
                        ? `We are confirming the UPI payment of ₹${totalBillAmount} with the cashier. Please wait.`
                        : `Waiter is bringing the bill and card/cash machine for your ₹${totalBillAmount} payment.`
                      }
                    </p>

                    <div style={{ 
                      background: 'var(--bg-elevated)', 
                      padding: 12, 
                      borderRadius: 8, 
                      border: '1px solid var(--border)', 
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      textAlign: 'left',
                      marginBottom: 16
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Active Request Details
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Method:</span>
                        <span style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)' }}>{currentPaymentMethod}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Amount Due:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{totalBillAmount}</span>
                      </div>
                    </div>
                  </div>
                ) : paymentOption === 'upi' ? (
                  /* UPI QR Screen */
                  <div style={{ animation: 'fadeIn 0.2s ease' }}>
                    <button 
                      onClick={() => setPaymentOption('none')}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: 6, 
                        background: 'none', border: 'none', color: 'var(--text-muted)', 
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 16, padding: 0
                      }}
                    >
                      <ArrowLeft size={14} /> Back to options
                    </button>

                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ 
                        background: '#fff', 
                        padding: 12, 
                        borderRadius: 12, 
                        display: 'inline-block', 
                        margin: '0 auto 12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}>
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=hideoutcafe@upi&pn=Hideout%20Cafe&am=${totalBillAmount}&cu=INR`)}`}
                          style={{ width: 160, height: 160, display: 'block' }} 
                          alt="UPI QR Code" 
                        />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Scan with GPay, PhonePe, Paytm</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>UPI ID: hideoutcafe@upi</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand)', marginTop: 4 }}>₹{totalBillAmount}</div>
                    </div>

                    <button
                      className="btn btn-full"
                      style={{
                        background: 'var(--success)',
                        color: '#fff',
                        padding: '12px',
                        fontWeight: 800,
                        fontSize: 14,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
                        marginBottom: 10
                      }}
                      onClick={() => handleRequestPayment('upi')}
                    >
                      <Check size={16} /> I Have Paid / Mark as Done
                    </button>
                  </div>
                ) : paymentOption === 'cash' || paymentOption === 'card' ? (
                  /* Cash or Card Billing Request Screen */
                  <div style={{ animation: 'fadeIn 0.2s ease' }}>
                    <button 
                      onClick={() => setPaymentOption('none')}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: 6, 
                        background: 'none', border: 'none', color: 'var(--text-muted)', 
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 16, padding: 0
                      }}
                    >
                      <ArrowLeft size={14} /> Back to options
                    </button>

                    <div style={{ 
                      background: 'var(--bg-elevated)', 
                      border: '1px solid var(--border)', 
                      borderRadius: 12, 
                      padding: 20, 
                      textAlign: 'center', 
                      marginBottom: 20 
                    }}>
                      <div style={{ 
                        width: 48, height: 48, borderRadius: '50%', 
                        background: 'rgba(255,125,0,0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--brand)', margin: '0 auto 12px'
                      }}>
                        {paymentOption === 'cash' ? <Coins size={20} /> : <CreditCard size={20} />}
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Request Bill & Pay via {paymentOption === 'cash' ? 'Cash' : 'Card'}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        A staff member will bring the invoice and collect payment at your table. The total amount is ₹{totalBillAmount}.
                      </p>
                    </div>

                    <button
                      className="btn btn-primary btn-full"
                      style={{ padding: '12px', fontWeight: 800 }}
                      onClick={() => handleRequestPayment(paymentOption)}
                    >
                      Send Bill Request
                    </button>
                  </div>
                ) : (
                  /* Main Billing Summary Screen */
                  <div>
                    {/* Bill Header */}
                    <div style={{ 
                      background: 'rgba(168,85,247,0.1)', 
                      border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: 8, 
                      padding: 12, 
                      fontSize: 12, 
                      color: '#c084fc', 
                      fontWeight: 700, 
                      textAlign: 'center', 
                      marginBottom: 16 
                    }}>
                      🎉 All your orders have been delivered! Ready to settle the bill?
                    </div>

                    {/* Consolidated items */}
                    <div style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 14,
                      marginBottom: 20
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                        Consolidated Invoice Summary
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {consolidatedBillItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                            <span>{item.name} {item.variant ? `(${item.variant.name})` : ''} ×{item.qty}</span>
                            <span style={{ fontWeight: 600 }}>₹{item.price * item.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '1px dashed var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Total Outstanding Bill</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand)' }}>₹{totalBillAmount}</span>
                      </div>
                    </div>

                    {/* Choose Payment Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button
                        className="btn btn-full"
                        style={{
                          background: '#a855f7',
                          color: '#fff',
                          padding: '12px',
                          fontWeight: 800,
                          fontSize: 13.5,
                          borderRadius: 'var(--radius-md)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          boxShadow: '0 4px 16px rgba(168,85,247,0.3)'
                        }}
                        onClick={() => setPaymentOption('upi')}
                      >
                        <QrCode size={16} /> Pay with UPI
                      </button>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          className="btn btn-secondary btn-full"
                          style={{ padding: '11px', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          onClick={() => setPaymentOption('cash')}
                        >
                          <Coins size={14} /> Bring Bill / Cash Pay
                        </button>
                        <button
                          className="btn btn-secondary btn-full"
                          style={{ padding: '11px', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          onClick={() => setPaymentOption('card')}
                        >
                          <CreditCard size={14} /> Bring Bill / Card Pay
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* --- STANDARD LIVE TIMELINE FLOW --- */
              <div>
                {/* Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: 'var(--brand)',
                    border: '1px solid var(--border-brand)', background: 'var(--brand-dim)',
                    padding: '4px 8px', borderRadius: 4, letterSpacing: '0.02em'
                  }}>
                    #{activeOrder.id.slice(-4).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    🛵 {getStatusDesc(activeOrder.status)}
                  </span>
                </div>

                {/* Order Type & Creator Label */}
                <div style={{
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Order Type:</span>
                    <span style={{ color: 'var(--brand)', textTransform: 'uppercase' }}>
                      {activeOrder.orderType === 'delivery' ? '🛵 Home Delivery' : activeOrder.orderType === 'take-away' ? '🛍️ Take-Away' : '🍽️ In-Dining'}
                    </span>
                  </div>
                  {activeOrder.isManualOrder && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Placed By:</span>
                      <span style={{ color: 'var(--success)', fontSize: 10.5 }}>👤 Restaurant Owner / Admin</span>
                    </div>
                  )}
                </div>

                {activeOrder.orderType === 'delivery' && activeOrder.deliveryOtp && activeOrder.status !== 'served' && (
                  <div style={{
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, rgba(157,78,221,0.12), rgba(157,78,221,0.06))',
                    border: '2px dashed rgba(157,78,221,0.5)',
                    padding: '16px 14px',
                    borderRadius: 14,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', gap: 8
                  }}>
                    <span style={{ fontSize: 10, color: '#A855F7', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔑 Your Delivery OTP</span>
                    <span style={{
                      fontSize: 34, fontWeight: 950, letterSpacing: '0.22em',
                      color: '#E9D5FF',
                      textShadow: '0 0 20px rgba(168,85,247,0.6)',
                      fontFamily: 'monospace'
                    }}>{activeOrder.deliveryOtp}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 260 }}>Show this OTP to the delivery rider when your food arrives. Do not share it until delivery.</span>
                  </div>
                )}

                {activeOrder.orderType === 'delivery' && activeOrder.deliveryBoyId && (
                  (() => {
                    const rider = state.deliveryBoys?.find(b => b.id === activeOrder.deliveryBoyId);
                    if (!rider) return null;

                    // Calculate distance
                    let distanceStr = '';
                    if (rider.latitude && rider.longitude && activeOrder.deliveryLat && activeOrder.deliveryLng) {
                      const meters = getDistanceInMeters(
                        rider.latitude,
                        rider.longitude,
                        activeOrder.deliveryLat,
                        activeOrder.deliveryLng
                      );
                      distanceStr = meters < 1000 ? `${Math.round(meters)} meters away` : `${(meters / 1000).toFixed(2)} km away`;
                    }

                    return (
                      <div style={{
                        marginBottom: 16,
                        background: 'rgba(157,78,221,0.08)',
                        border: '1px solid rgba(157,78,221,0.3)',
                        borderRadius: 14,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🛵 Delivery Partner Appointed</span>
                          {distanceStr && (
                            <span style={{ 
                              fontSize: 9.5, fontWeight: 900, background: 'rgba(34,197,94,0.15)', color: '#4ADE80', 
                              padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)',
                              animation: 'pulse 1.5s infinite'
                            }}>
                              {distanceStr}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Rider avatar emoji */}
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%', background: 'rgba(157,78,221,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                          }}>
                            🏍️
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)' }}>{rider.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Status: {rider.status === 'delivering' ? 'On the way 🛵' : 'Preparing to depart'}</span>
                          </div>
                          {/* Call rider button */}
                          {rider.username && (
                            <a href={`tel:${rider.username}`} style={{
                              width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ADE80',
                              border: '1px solid rgba(34,197,94,0.3)', textDecoration: 'none', fontSize: 13
                            }}>
                              📞
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4, marginBottom: 20 }}>
                  {(() => {
                    // For delivery orders: use 4-step delivery timeline
                    const isDelivery = activeOrder.orderType === 'delivery';
                    const deliverySteps = [
                      { label: 'Order Placed', desc: 'We received your order!', icon: ShoppingBag, statusMatch: 'pending' },
                      { label: 'Being Prepared', desc: 'Our chef is cooking your food 🍳', icon: ChefHat, statusMatch: 'preparing' },
                      { label: 'Out for Delivery', desc: activeOrder.deliveryBoyId
                          ? (() => { const r = state.deliveryBoys?.find(b => b.id === activeOrder.deliveryBoyId); return r ? `${r.name} is on the way! 🛵` : 'Rider is on the way! 🛵'; })()
                          : 'Getting picked up soon 🛵',
                        icon: Truck,
                        statusMatch: 'ready'
                      },
                      { label: 'Delivered', desc: 'Enjoy your meal! 🎉', icon: Truck, statusMatch: 'served' },
                    ];
                    const steps = isDelivery ? deliverySteps : STEPS.map(s => ({ ...s, statusMatch: s.status }));
                    const deliveryStatusMap: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3 };
                    const currentStepIdx = isDelivery
                      ? (deliveryStatusMap[activeOrder.status] ?? 0) + (activeOrder.deliveryStatus === 'started' ? 0 : 0)
                      : ['pending', 'preparing', 'ready'].indexOf(activeOrder.status);
                    // If delivery started, push to step 2 (Out for Delivery)
                    const effectiveStepIdx = isDelivery && activeOrder.deliveryStatus === 'started'
                      ? Math.max(currentStepIdx, 2)
                      : currentStepIdx;

                    return steps.map((step, idx) => {
                      const isCompleted = idx <= effectiveStepIdx;
                      const isCurrent = idx === effectiveStepIdx;
                      const StepIcon = step.icon;
                      return (
                        <div key={idx} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                          {/* Icon line */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: isCurrent ? (isDelivery ? '#A855F7' : 'var(--brand)') : isCompleted ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                              border: `2px solid ${isCompleted ? (isDelivery ? '#A855F7' : 'var(--brand)') : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isCurrent ? '#fff' : isCompleted ? 'var(--brand)' : 'var(--text-muted)',
                              boxShadow: isCurrent ? (isDelivery ? '0 0 12px rgba(168,85,247,0.5)' : 'var(--shadow-brand)') : 'none',
                              zIndex: 2,
                              transition: 'var(--transition)'
                            }}>
                              <StepIcon size={12} />
                            </div>
                            {idx < steps.length - 1 && (
                              <div style={{
                                width: 2, height: 32,
                                background: idx < effectiveStepIdx ? (isDelivery ? '#A855F7' : 'var(--brand)') : 'var(--border)',
                                zIndex: 1, transition: 'var(--transition)'
                              }} />
                            )}
                          </div>
                          {/* Title and details */}
                          <div style={{ paddingTop: 2, paddingBottom: 12 }}>
                            <h4 style={{
                              fontSize: 13, fontWeight: 700,
                              color: isCompleted ? 'var(--text-primary)' : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              {step.label}
                              {isCurrent && <span style={{ fontSize: 8, background: isDelivery ? 'rgba(168,85,247,0.15)' : 'var(--brand-dim)', color: isDelivery ? '#A855F7' : 'var(--brand)', padding: '1px 5px', borderRadius: 3, fontWeight: 800 }}>NOW</span>}
                            </h4>
                            <p style={{ fontSize: 10.5, color: isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)', marginTop: 1 }}>
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Items */}
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 14,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Items in this Order
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeOrder.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span>{item.name} {item.variant ? `(${item.variant.name})` : ''} ×{item.qty}</span>
                        <span style={{ fontWeight: 600 }}>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Order Amount</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--brand)' }}>₹{activeOrder.totalAmount}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-secondary btn-full"
                    style={{ padding: '10px 14px', fontSize: 13, borderRadius: 'var(--radius-md)' }}
                    onClick={() => {
                      setShowStatusModal(false);
                      dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'menu' });
                      addToast('info', 'Choose add-ons from the menu! 🛒');
                    }}
                  >
                    Add On
                  </button>
                  <button
                    className="btn btn-full"
                    style={{
                      background: '#a855f7',
                      color: '#fff',
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 4px 16px rgba(168,85,247,0.3)'
                    }}
                    onClick={() => {
                      addToast('success', 'Status is synced live with the kitchen! 🍳');
                    }}
                  >
                    <MapPin size={13} /> Live Tracking
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {!isViewOnly && <CustomerBottomNav />}
    </div>
  );
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}
