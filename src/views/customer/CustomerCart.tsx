import { useState } from 'react';
import { useStore, getActiveRestaurantInfo, getActiveRestaurantId } from '../../context/RealtimeStore';
import type { Order } from '../../context/RealtimeStore';
import { ShoppingBag, Trash2, ArrowRight, ChevronUp, MapPin, Check, X, Loader2 } from 'lucide-react';
import { hasFirebaseConfig, auth, googleProvider } from '../../utils/firebase';
import { signInWithPopup } from 'firebase/auth';

const RADAR_STYLE_ID = 'meenufy-gps-radar-styles';
if (typeof document !== 'undefined' && !document.getElementById(RADAR_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RADAR_STYLE_ID;
  style.textContent = `
    @keyframes radar-pulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 0.35; }
      100% { transform: scale(1.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
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

export default function CustomerCart() {
  const { state, dispatch, addToast } = useStore();
  
  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);

  const activeAccount = state.restaurantAccounts?.find(acc => acc.id === restaurantId);
  const plan = activeAccount?.subscriptionPlan || 'free';
  const usage = activeAccount?.ordersPlacedThisMonth || 0;
  const limit = plan === 'free' ? 100 : plan === 'base' ? 1000 : plan === 'standard' ? 2000 : Infinity;
  const isLimitExceeded = usage >= limit;

  const [open, setOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; phone: string } | null>(() => {
    const raw = localStorage.getItem('meenufy_customer_google_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleForm, setGoogleForm] = useState({ name: '', email: '', phone: '' });
  const [signingIn, setSigningIn] = useState(false);

  const [customerName, setCustomerName] = useState(() => {
    const raw = localStorage.getItem('meenufy_customer_google_user');
    if (raw) return JSON.parse(raw).name;
    return localStorage.getItem('meenufy_customer_name') || '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    const raw = localStorage.getItem('meenufy_customer_google_user');
    if (raw) return JSON.parse(raw).phone;
    return localStorage.getItem('meenufy_customer_phone') || '';
  });
  const [customerEmail, setCustomerEmail] = useState(() => {
    const raw = localStorage.getItem('meenufy_customer_google_user');
    if (raw) return JSON.parse(raw).email;
    return localStorage.getItem('meenufy_customer_email') || '';
  });
  const [redeemPointsChecked, setRedeemPointsChecked] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const [numberOfGuests, setNumberOfGuests] = useState<string>('');
  const [placing, setPlacing] = useState(false);

  // Geofence verification states
  const [locationStatus, setLocationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed' | 'denied'>('idle');
  const [distanceError, setDistanceError] = useState<number | null>(null);

  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Loyalty calculations
  const custRec = state.customers.find(c => c.phone === customerPhone.trim());
  const pointsAvailable = custRec ? (custRec.points || 0) : 0;
  const pointsVal = pointsAvailable * (restaurant.pointValueInRupees || 1);
  const discountApplied = redeemPointsChecked ? Math.min(cartTotal, pointsVal) : 0;
  const finalAmount = Math.max(0, cartTotal - discountApplied);
  const pointsEarned = restaurant.loyaltyEnabled ? Math.floor(finalAmount / 100) * (restaurant.pointsPer100Spent || 1) : 0;

  // Sum up nutrition info for all items in the cart
  const cartNutrition = state.cart.reduce((summary, cartItem) => {
    const menuItem = state.menuItems.find(item => item.id === cartItem.menuItemId);
    if (menuItem?.nutrition?.enabled) {
      const q = cartItem.qty;
      summary.enabled = true;
      if (menuItem.nutrition.calories) summary.calories += menuItem.nutrition.calories * q;
      if (menuItem.nutrition.carbs) summary.carbs += menuItem.nutrition.carbs * q;
      if (menuItem.nutrition.sugar) summary.sugar += menuItem.nutrition.sugar * q;
      if (menuItem.nutrition.protein) summary.protein += menuItem.nutrition.protein * q;
      if (menuItem.nutrition.fats) summary.fats += menuItem.nutrition.fats * q;
    }
    return summary;
  }, {
    enabled: false,
    calories: 0,
    carbs: 0,
    sugar: 0,
    protein: 0,
    fats: 0
  });

  if (cartCount === 0) return null;

  const verifyLocationAndPlaceOrder = () => {
    setLocationStatus('verifying');
    setDistanceError(null);

    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const clientLat = position.coords.latitude;
        const clientLng = position.coords.longitude;
        const targetLat = restaurant.latitude || 12.9348;
        const targetLng = restaurant.longitude || 77.6202;
        const allowedRadius = restaurant.verificationRadius || 50;

        const distance = getDistanceInMeters(clientLat, clientLng, targetLat, targetLng);

        if (distance <= allowedRadius) {
          setLocationStatus('success');
          setTimeout(() => {
            handlePlaceOrder();
            setLocationStatus('idle');
          }, 1500);
        } else {
          setDistanceError(Math.round(distance));
          setLocationStatus('failed');
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const triggerOrder = () => {
    if (restaurant.locationVerificationEnabled) {
      verifyLocationAndPlaceOrder();
    } else {
      handlePlaceOrder();
    }
  };

  const handleGoogleSignIn = async () => {
    if (hasFirebaseConfig && auth) {
      setSigningIn(true);
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        setGoogleForm({
          name: user.displayName || '',
          email: user.email || '',
          phone: ''
        });
        setShowGoogleModal(true);
        addToast('info', 'Authenticated! Please verify your phone number to complete profile.');
      } catch (err: any) {
        console.error(err);
        addToast('error', `❌ Google Sign-In failed: ${err.message || err}`);
      } finally {
        setSigningIn(false);
      }
    } else {
      // Mock mode
      setGoogleForm({ name: '', email: '', phone: '' });
      setShowGoogleModal(true);
    }
  };

  const submitGoogleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleForm.name.trim() || !googleForm.email.trim() || !googleForm.phone.trim()) {
      addToast('error', 'All fields are required.');
      return;
    }
    
    // Simulate minor delay for mock or save
    setSigningIn(true);
    setTimeout(() => {
      const user = {
        name: googleForm.name.trim(),
        email: googleForm.email.trim(),
        phone: googleForm.phone.trim()
      };
      localStorage.setItem('meenufy_customer_google_user', JSON.stringify(user));
      setCustomerName(user.name);
      setCustomerPhone(user.phone);
      setCustomerEmail(user.email);
      setGoogleUser(user);
      setSigningIn(false);
      setShowGoogleModal(false);
      addToast('success', 'Signed in successfully via Google! 🔒');
    }, 400);
  };

  const handlePlaceOrder = async () => {
    if (!state.customerTableId) { addToast('error', 'No table selected.'); return; }
    if (state.cart.length === 0) { addToast('error', 'Cart is empty.'); return; }

    const isLoginRequired = restaurant.mustLoginBeforeOrder;
    if (isLoginRequired && !googleUser) {
      addToast('error', 'You must sign in with Google to place an order.');
      return;
    }
    if (!isLoginRequired && (!customerName.trim() || !customerPhone.trim())) {
      addToast('error', 'Name and Phone number are required to place an order.');
      return;
    }

    setPlacing(true);
    await new Promise(r => setTimeout(r, 800));

    const table = state.tables.find(t => t.id === state.customerTableId);

    // Save inputs to localStorage
    if (customerName.trim()) {
      localStorage.setItem('meenufy_customer_name', customerName.trim());
    }
    if (customerPhone.trim()) {
      localStorage.setItem('meenufy_customer_phone', customerPhone.trim());
    }
    const finalEmail = customerEmail.trim();
    if (finalEmail) {
      localStorage.setItem('meenufy_customer_email', finalEmail);
    }

    const finalPhone = customerPhone.trim();

    const parsedGuests = parseInt(numberOfGuests, 10);

    const order: Order = {
      id: `ord-${Date.now()}`,
      tableNumber: table?.number || 0,
      tableId: state.customerTableId,
      restaurantId: restaurantId,
      restaurantName: restaurant.name,
      customerName: customerName.trim(),
      customerPhone: finalPhone,
      customerEmail: finalEmail || undefined,
      items: [...state.cart],
      status: 'pending',
      totalAmount: finalAmount,
      specialNote,
      numberOfGuests: !isNaN(parsedGuests) && parsedGuests > 0 ? parsedGuests : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pointsEarned,
      pointsRedeemed: redeemPointsChecked ? pointsAvailable : 0,
      pointsDiscountApplied: discountApplied,
    };

    dispatch({ type: 'PLACE_ORDER', payload: order });
    dispatch({ type: 'CLEAR_CART' });
    dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'orders' });

    addToast('success', '🎉 Order placed! Track it in My Orders.');
    setOpen(false);
    setSpecialNote('');
    setNumberOfGuests('');
    setRedeemPointsChecked(false);
    setPlacing(false);
  };

  return (
    <>
      {/* Floating Cart Button */}
      {!open && (
        <div style={{
          position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))', left: 16, right: 16,
          zIndex: 200,
          maxWidth: 448,
          margin: '0 auto',
        }}>
          <button
            className="btn btn-primary btn-full"
            onClick={() => setOpen(true)}
            style={{
              borderRadius: 16, padding: '10px 20px',
              boxShadow: '0 8px 32px rgba(255,125,0,0.35)',
              animation: 'slideInUp 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--brand)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  background: 'rgba(0,0,0,0.15)', borderRadius: 9, padding: '3px 9px',
                  fontSize: 13, fontWeight: 800, color: '#000000',
                }}>
                  {cartCount}
                </div>
                <ShoppingBag size={17} style={{ strokeWidth: 2.5, color: '#000000' }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#000000', letterSpacing: '0.2px' }}>View Cart</span>
              </div>
              {cartNutrition.enabled && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 9,
                  marginTop: 3, flexWrap: 'wrap'
                }}>
                  <span style={{
                    background: '#ffffff', color: '#1a1a1a', padding: '2px 7px',
                    borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    🔥 {Math.round(cartNutrition.calories)} kcal
                  </span>
                  <span style={{
                    background: '#ffffff', color: '#1a1a1a', padding: '2px 7px',
                    borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    🍞 {Math.round(cartNutrition.carbs)}g
                  </span>
                  <span style={{
                    background: '#ffffff', color: '#1a1a1a', padding: '2px 7px',
                    borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    💪 {Math.round(cartNutrition.protein)}g
                  </span>
                </div>
              )}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#000000' }}>₹{cartTotal}</div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--bg-secondary)',
            borderRadius: '24px 24px 0 0',
            border: '1px solid var(--border-elevated)',
            maxHeight: '90vh', overflowY: 'auto',
            animation: 'slideInUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-elevated)' }} />
            </div>

            <div style={{ padding: '16px 20px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>
                  🛒 Your Cart
                </h3>
                <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}>
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* Cart Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {state.cart.map(item => {
                  const itemKey = `${item.menuItemId}-${item.variant?.name || ''}`;
                  return (
                    <div key={itemKey} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: 'var(--bg-elevated)',
                      borderRadius: 10, border: '1px solid var(--border)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                          {item.name} {item.variant ? `(${item.variant.name})` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{item.price} each</div>
                      </div>

                      {/* Qty controls */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        background: 'var(--brand)', borderRadius: 99, overflow: 'hidden',
                      }}>
                        <button
                          onClick={() => dispatch({ type: 'UPDATE_CART_QTY', payload: { menuItemId: item.menuItemId, qty: item.qty - 1, variantName: item.variant?.name } })}
                          style={{ padding: '5px 11px', background: 'none', border: 'none', cursor: 'pointer', color: '#000', fontSize: 16, fontWeight: 700 }}
                        >−</button>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#000', minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                        <button
                          onClick={() => dispatch({ type: 'ADD_TO_CART', payload: { ...item, qty: 1 } })}
                          style={{ padding: '5px 11px', background: 'none', border: 'none', cursor: 'pointer', color: '#000', fontSize: 16, fontWeight: 700 }}
                        >+</button>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', width: 48, textAlign: 'right' }}>
                        ₹{item.price * item.qty}
                      </div>

                      <button
                        className="btn-ghost btn-icon"
                        onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: { menuItemId: item.menuItemId, variantName: item.variant?.name } })}
                        style={{ color: 'var(--error)', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Nutrition Summary Card */}
              {cartNutrition.enabled && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 125, 0, 0.1) 0%, rgba(255, 125, 0, 0.03) 100%)',
                  borderRadius: 16,
                  padding: '16px',
                  marginBottom: 20,
                  border: '1px solid rgba(255, 125, 0, 0.18)',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>📊</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                      Total Nutritional Value
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, textAlign: 'center' }}>
                    <div style={{ background: 'var(--bg-elevated)', padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Calories</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{Math.round(cartNutrition.calories)} <span style={{ fontSize: 8, fontWeight: 500 }}>kcal</span></div>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Carbs</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{Math.round(cartNutrition.carbs)}g</div>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Sugar</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{Math.round(cartNutrition.sugar)}g</div>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Protein</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{Math.round(cartNutrition.protein)}g</div>
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.2px' }}>Fats</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{Math.round(cartNutrition.fats)}g</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer details / Sign-In Status */}
              {restaurant.mustLoginBeforeOrder ? (
                googleUser ? (
                  <div style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--brand)', color: '#000',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14
                      }}>
                        {googleUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Signed in via Google</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{googleUser.name} ({googleUser.email})</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('meenufy_customer_google_user');
                        setGoogleUser(null);
                        setCustomerName('');
                        setCustomerPhone('');
                        setCustomerEmail('');
                        addToast('info', 'Signed out from Google');
                      }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--error)',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-elevated)',
                    border: '1px dashed var(--border-brand)',
                    borderRadius: 16,
                    padding: '20px 16px',
                    textAlign: 'center',
                    marginBottom: 16
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Sign in Required</div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                      This restaurant requires Google Sign-In before placing orders.
                    </p>
                    <button
                      onClick={handleGoogleSignIn}
                      className="btn"
                      type="button"
                      style={{
                        background: 'var(--customer-add-to-cart-bg, #FFFFFF)',
                        color: 'var(--customer-add-to-cart-text, #000000)',
                        border: '1px solid var(--border)',
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 99,
                        cursor: 'pointer'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                      Sign in with Google
                    </button>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div className="input-group">
                    <label className="input-label">Your Name (required)</label>
                    <input className="input" type="text" placeholder="e.g. Ananya"
                      value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Phone (required)</label>
                    <input className="input" type="tel" placeholder="+91 98765 43210"
                      value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Email (optional)</label>
                    <input className="input" type="email" placeholder="e.g. ananya@gmail.com"
                      value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Extra Details (only show when logged in or login not required) */}
              {(!restaurant.mustLoginBeforeOrder || googleUser) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div className="input-group">
                    <label className="input-label">No. of People at Table (optional)</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="99"
                      placeholder="e.g. 2"
                      value={numberOfGuests}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setNumberOfGuests(val);
                      }}
                      onKeyDown={e => {
                        if (['.', '-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
                      }}
                      style={{ appearance: 'textfield' }}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Special Instructions (optional)</label>
                    <textarea className="input" rows={2} placeholder="e.g. Less spicy, no onions..."
                      value={specialNote} onChange={e => setSpecialNote(e.target.value)}
                      style={{ resize: 'none' }} />
                  </div>
                </div>
              )}

              {/* Loyalty Program Points Redemption */}
              {restaurant.loyaltyEnabled && pointsAvailable > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.03) 100%)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 16,
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🎁</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Redeem Loyalty Points</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Use {pointsAvailable} points to get ₹{pointsVal} off!
                      </div>
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={redeemPointsChecked}
                      onChange={e => setRedeemPointsChecked(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', inset: 0, borderRadius: 24,
                      background: redeemPointsChecked ? 'var(--success)' : 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      transition: '0.2s',
                    }}>
                      <span style={{
                        position: 'absolute', left: 2, bottom: 1, width: 20, height: 20, borderRadius: '50%',
                        background: '#fff',
                        transform: redeemPointsChecked ? 'translateX(20px)' : 'translateX(0)',
                        transition: '0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }} />
                    </span>
                  </label>
                </div>
              )}

              {/* Bill summary */}
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 12,
                padding: '12px 14px', marginBottom: 16,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Subtotal ({cartCount} items)</span>
                  <span>₹{cartTotal}</span>
                </div>
                {redeemPointsChecked && discountApplied > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)', marginBottom: 6 }}>
                    <span>Loyalty Discount</span>
                    <span>-₹{discountApplied}</span>
                  </div>
                )}
                {restaurant.loyaltyEnabled && pointsEarned > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--brand)', marginBottom: 6, fontStyle: 'italic' }}>
                    <span>Points to earn:</span>
                    <span>+{pointsEarned} pts</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Total</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--brand)' }}>₹{finalAmount}</span>
                </div>
              </div>

              {isLimitExceeded ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--error)',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    textAlign: 'center'
                  }}>
                    ⚠️ Checkout is temporarily unavailable as this restaurant has reached its monthly order capacity limit. Please contact the administrator.
                  </div>
                  <button
                    className="btn btn-secondary btn-full btn-lg"
                    disabled={true}
                    style={{ cursor: 'not-allowed', opacity: 0.6 }}
                  >
                    Ordering Unavailable
                  </button>
                </div>
              ) : restaurant.mustLoginBeforeOrder && !googleUser ? (
                <button
                  className="btn btn-full btn-lg"
                  onClick={handleGoogleSignIn}
                  type="button"
                  style={{
                    background: 'var(--customer-add-to-cart-bg, #FFFFFF)',
                    color: 'var(--customer-add-to-cart-text, #000000)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google to Order
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={triggerOrder}
                  disabled={placing}
                >
                  {placing ? (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <>Place Order <ArrowRight size={17} /></>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Geofence Location Verification Modal */}
      {locationStatus !== 'idle' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 24,
            padding: '24px 20px', width: '90%', maxWidth: 360,
            border: '1px solid var(--border-elevated)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}>
            {/* Status Icons and Animations */}
            {locationStatus === 'verifying' && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, position: 'relative', height: 80, alignItems: 'center' }}>
                <div style={{
                  position: 'absolute', width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(255, 125, 0, 0.15)', border: '2px solid var(--brand)',
                  animation: 'radar-pulse 2s infinite ease-out',
                }} />
                <div style={{
                  position: 'absolute', width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(255, 125, 0, 0.25)', border: '1px solid var(--brand)',
                  animation: 'radar-pulse 2s infinite ease-out 1s',
                }} />
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 16px var(--brand)', zIndex: 2
                }}>
                  <MapPin size={16} color="#000" />
                </div>
              </div>
            )}

            {locationStatus === 'success' && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)', border: '2px solid var(--success)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--success)',
                  animation: 'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <Check size={32} />
                </div>
              </div>
            )}

            {(locationStatus === 'failed' || locationStatus === 'denied') && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)', border: '2px solid var(--error)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--error)',
                  animation: 'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <X size={32} />
                </div>
              </div>
            )}

            {/* Status Titles & Descriptions */}
            {locationStatus === 'verifying' && (
              <>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Verifying Location
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '18px' }}>
                  Verifying that you are inside the restaurant outlet to complete your order. This takes only a few seconds...
                </p>
              </>
            )}

            {locationStatus === 'success' && (
              <>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)', marginBottom: 8 }}>
                  Location Verified!
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '18px' }}>
                  Welcome to {restaurant.name}! Placing your order now...
                </p>
              </>
            )}

            {locationStatus === 'failed' && (
              <>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--error)', marginBottom: 8 }}>
                  Verification Failed
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '18px', marginBottom: 20 }}>
                  You are currently <strong>{distanceError}m</strong> away. You must be within{' '}
                  <strong>{restaurant.verificationRadius}m</strong> of the outlet to order.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary btn-full" onClick={() => setLocationStatus('idle')}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-full" onClick={verifyLocationAndPlaceOrder}>
                    Retry Verification
                  </button>
                </div>
              </>
            )}

            {locationStatus === 'denied' && (
              <>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--error)', marginBottom: 8 }}>
                  GPS Access Required
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '18px', marginBottom: 20 }}>
                  Live location is enabled for order verification. Please allow location permissions in your browser/device settings.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary btn-full" onClick={() => setLocationStatus('idle')}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-full" onClick={verifyLocationAndPlaceOrder}>
                    Retry Verification
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Simulated Google Sign-In Consent Modal */}
      {showGoogleModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }}>
          <form onSubmit={submitGoogleSignIn} style={{
            background: 'var(--bg-secondary)', borderRadius: 24,
            padding: '28px 24px', width: '90%', maxWidth: 380,
            border: '1px solid var(--border-elevated)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 6 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Google Sign-In</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', lineHeight: '18px', marginBottom: 4 }}>
              To complete your order, <strong>{restaurant.name}</strong> requires verification via Google.
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>Full Name</label>
              <input 
                type="text" 
                required 
                className="input" 
                placeholder="Atish Kumar"
                value={googleForm.name} 
                disabled={hasFirebaseConfig}
                style={{ opacity: hasFirebaseConfig ? 0.6 : 1 }}
                onChange={e => setGoogleForm({...googleForm, name: e.target.value})}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>Email Address</label>
              <input 
                type="email" 
                required 
                className="input" 
                placeholder="atish@gmail.com"
                value={googleForm.email} 
                disabled={hasFirebaseConfig}
                style={{ opacity: hasFirebaseConfig ? 0.6 : 1 }}
                onChange={e => setGoogleForm({...googleForm, email: e.target.value})}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>Phone Number</label>
              <input 
                type="tel" 
                required 
                className="input" 
                placeholder="+91 98765 43210"
                value={googleForm.phone} 
                onChange={e => setGoogleForm({...googleForm, phone: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-full" 
                onClick={() => setShowGoogleModal(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={signingIn}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {signingIn ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Login</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
