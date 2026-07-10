import { useState, useEffect } from 'react';
import { useStore, getActiveRestaurantInfo, getActiveRestaurantId } from '../../context/RealtimeStore';
import type { Order, Coupon } from '../../context/RealtimeStore';
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

export default function CustomerCart({ tableId }: { tableId?: string }) {
  const { state, dispatch, addToast } = useStore();
  
  const activeTableId = tableId || new URLSearchParams(window.location.search).get('table') || state.customerTableId || 'table-1';

  useEffect(() => {
    if (activeTableId && state.customerTableId !== activeTableId) {
      dispatch({ type: 'SET_CUSTOMER_TABLE', payload: activeTableId });
    }
  }, [activeTableId, state.customerTableId]);

  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);

  const plan = restaurant.subscriptionPlan || 'free';
  const usage = restaurant.ordersPlacedThisMonth || 0;
  const limit = plan === 'free' ? 100 : plan === 'base' ? 1000 : plan === 'standard' ? 2000 : Infinity;
  const allowNegative = restaurant.allowNegativeOrders || false;

  const isLimitExceeded = usage >= limit + 100 || (usage >= limit && !allowNegative);
  const isHardLimitReached = usage >= limit + 100;

  const [open, setOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; phone: string } | null>(() => {
    try {
      const rawGoogle = localStorage.getItem('meenufy_customer_google_user');
      if (rawGoogle) return JSON.parse(rawGoogle);
      const rawCustom = localStorage.getItem('meenufy_customer_logged_in_user');
      if (rawCustom) return JSON.parse(rawCustom);
      return null;
    } catch {
      return null;
    }
  });
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleForm, setGoogleForm] = useState({ name: '', email: '', phone: '' });
  const [signingIn, setSigningIn] = useState(false);

  const [customerName, setCustomerName] = useState(() => {
    const rawGoogle = localStorage.getItem('meenufy_customer_google_user');
    if (rawGoogle) return JSON.parse(rawGoogle).name;
    const rawCustom = localStorage.getItem('meenufy_customer_logged_in_user');
    if (rawCustom) return JSON.parse(rawCustom).name;
    return localStorage.getItem('meenufy_customer_name') || '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    const rawGoogle = localStorage.getItem('meenufy_customer_google_user');
    if (rawGoogle) return JSON.parse(rawGoogle).phone;
    const rawCustom = localStorage.getItem('meenufy_customer_logged_in_user');
    if (rawCustom) return JSON.parse(rawCustom).phone;
    return localStorage.getItem('meenufy_customer_phone') || '';
  });
  const [customerEmail, setCustomerEmail] = useState(() => {
    const rawGoogle = localStorage.getItem('meenufy_customer_google_user');
    if (rawGoogle) return JSON.parse(rawGoogle).email || '';
    const rawCustom = localStorage.getItem('meenufy_customer_logged_in_user');
    if (rawCustom) return JSON.parse(rawCustom).email || '';
    return localStorage.getItem('meenufy_customer_email') || '';
  });

  const custRec = state.customers.find(c => c && c.phone === customerPhone.trim());
  const customerAddresses = custRec?.savedAddresses || [];

  useEffect(() => {
    if (open) {
      try {
        const rawGoogle = localStorage.getItem('meenufy_customer_google_user');
        const rawCustom = localStorage.getItem('meenufy_customer_logged_in_user');
        const user = rawGoogle ? JSON.parse(rawGoogle) : (rawCustom ? JSON.parse(rawCustom) : null);
        if (user) {
          setCustomerName(user.name);
          setCustomerPhone(user.phone);
          setCustomerEmail(user.email || '');
          setGoogleUser(user);
        } else {
          setGoogleUser(null);
          setCustomerName(localStorage.getItem('meenufy_customer_name') || '');
          setCustomerPhone(localStorage.getItem('meenufy_customer_phone') || '');
          setCustomerEmail(localStorage.getItem('meenufy_customer_email') || '');
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [open]);
  const [redeemPointsChecked, setRedeemPointsChecked] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const [numberOfGuests, setNumberOfGuests] = useState<string>('');
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const isViewOnly = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('viewOnly') === 'true';
  const [orderType, setOrderType] = useState<'in-dining' | 'take-away' | 'delivery'>(() => {
    // Smart default: QR scan = in-dining, viewOnly/no-table = delivery (if enabled), else take-away
    const hasTable = !!new URLSearchParams(window.location.search).get('table');
    if (hasTable) return 'in-dining';
    if ((isViewOnly && restaurant.deliveryEnabled) || restaurant.deliveryEnabled) return 'delivery';
    return 'take-away';
  });
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'confirm' | 'upi_payment'>('cart');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [pastAddressOption, setPastAddressOption] = useState<{ fullAddress: string; lat?: number; lng?: number; name?: string } | null>(null);

  const isLoggedIn = !!googleUser;

  // Monitor customerPhone to look up previous orders' address
  useEffect(() => {
    const phoneVal = customerPhone.trim();
    if (phoneVal.length >= 10) {
      const pastDeliveryOrders = state.orders.filter(o => o.customerPhone === phoneVal && o.orderType === 'delivery' && o.deliveryAddress);
      if (pastDeliveryOrders.length > 0) {
        const latest = [...pastDeliveryOrders].sort((a, b) => b.createdAt - a.createdAt)[0];
        if (latest && latest.deliveryAddress) {
          setPastAddressOption({
            fullAddress: latest.deliveryAddress,
            lat: latest.deliveryLat,
            lng: latest.deliveryLng,
            name: latest.customerName
          });
        } else {
          setPastAddressOption(null);
        }
      } else {
        setPastAddressOption(null);
      }
    } else {
      setPastAddressOption(null);
    }
  }, [customerPhone, state.orders]);

  const handleFetchGpsLocation = () => {
    if (!navigator.geolocation) {
      addToast('error', 'Geolocation not supported by your browser.');
      return;
    }
    setLocationStatus('verifying');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDeliveryLat(lat);
        setDeliveryLng(lng);
        setLocationStatus('idle');
        addToast('success', 'GPS Coordinates captured successfully!');
        
        if (!deliveryAddress.trim()) {
          setDeliveryAddress(`[GPS Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
        }
      },
      (err) => {
        console.error(err);
        addToast('error', 'GPS access denied or timed out. Please input your address manually.');
        setLocationStatus('idle');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomerPhone(val);
    
    // Auto lookup name if phone number matches any previous order / customer
    const trimmedVal = val.trim();
    if (trimmedVal.length >= 10) {
      // Search in state.customers
      const match = state.customers.find(c => c.phone === trimmedVal);
      if (match && match.name) {
        setCustomerName(match.name);
        if (match.email) setCustomerEmail(match.email);
        addToast('success', `Welcome back, ${match.name}! Auto-filled details.`);
      } else {
        // Look up in synced orders just in case
        const orderMatch = state.orders.find(o => o.customerPhone === trimmedVal);
        if (orderMatch && orderMatch.customerName) {
          setCustomerName(orderMatch.customerName);
          if (orderMatch.customerEmail) setCustomerEmail(orderMatch.customerEmail);
          addToast('success', `Welcome back, ${orderMatch.customerName}! Auto-filled details.`);
        }
      }
    }
  };

  // Geofence verification states
  const [locationStatus, setLocationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed' | 'denied'>('idle');
  const [distanceError, setDistanceError] = useState<number | null>(null);

  const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Monitor cartTotal to invalidate applied coupon if minOrderAmount requirement or category scope is no longer met
  useEffect(() => {
    if (appliedCoupon) {
      if (cartTotal < (appliedCoupon.minOrderAmount || 0)) {
        setAppliedCoupon(null);
        setCouponError(`Promo code ${appliedCoupon.code} removed (minimum order ₹${appliedCoupon.minOrderAmount} required).`);
        addToast('error', 'Coupon removed: minimum order amount not met.');
        return;
      }
      if (Array.isArray(appliedCoupon.appliesTo)) {
        const allowedCatIds = appliedCoupon.appliesTo;
        const hasApplicableItem = state.cart.some(cartItem => {
          const menuItem = state.menuItems.find(item => item.id === cartItem.menuItemId);
          const itemCatId = menuItem ? menuItem.category : '';
          return allowedCatIds.includes(itemCatId);
        });
        if (!hasApplicableItem) {
          setAppliedCoupon(null);
          setCouponError(`Promo code ${appliedCoupon.code} removed (no applicable items in cart).`);
          addToast('error', 'Coupon removed: no applicable items in cart.');
        }
      }
    }
  }, [cartTotal, state.cart, state.menuItems, appliedCoupon, addToast]);

  // Coupon calculations
  let couponDiscount = 0;
  if (appliedCoupon) {
    let applicableTotal = cartTotal;
    if (Array.isArray(appliedCoupon.appliesTo)) {
      const allowedCatIds = appliedCoupon.appliesTo;
      applicableTotal = state.cart.reduce((sum, cartItem) => {
        const menuItem = state.menuItems.find(item => item.id === cartItem.menuItemId);
        const itemCatId = menuItem ? menuItem.category : '';
        if (allowedCatIds.includes(itemCatId)) {
          return sum + cartItem.price * cartItem.qty;
        }
        return sum;
      }, 0);
    }
    if (appliedCoupon.type === 'percentage') {
      couponDiscount = Math.round((applicableTotal * appliedCoupon.value) / 100);
    } else {
      couponDiscount = applicableTotal > 0 ? Math.min(applicableTotal, appliedCoupon.value) : 0;
    }
    couponDiscount = Math.min(cartTotal, couponDiscount);
  }
  // Delivery Fee calculation
  const distanceInKm = (() => {
    if (deliveryLat === null || deliveryLng === null) return null;
    const targetLat = restaurant.latitude || 12.9348;
    const targetLng = restaurant.longitude || 77.6202;
    return getDistanceInMeters(deliveryLat, deliveryLng, targetLat, targetLng) / 1000;
  })();

  const calculatedDeliveryCharge = (() => {
    if (orderType !== 'delivery') return 0;
    if (distanceInKm === null) return restaurant.deliveryCharge !== undefined ? restaurant.deliveryCharge : 40;
    
    const freeDist = restaurant.freeDeliveryDistance || 0;
    const freeAmt = restaurant.freeDeliveryMinAmount || 0;
    const criteria = restaurant.freeDeliveryCriteria || 'either';
    
    let qualifiesForFree = false;
    
    if (freeDist > 0 || freeAmt > 0) {
      const isDistQualified = freeDist > 0 ? (distanceInKm <= freeDist) : false;
      const isAmtQualified = freeAmt > 0 ? (cartTotal >= freeAmt) : false;
      
      if (criteria === 'both') {
        // BOTH must be true
        qualifiesForFree = (freeDist > 0 ? isDistQualified : true) && (freeAmt > 0 ? isAmtQualified : true);
      } else {
        // EITHER is true
        qualifiesForFree = isDistQualified || isAmtQualified;
      }
    }
    
    if (qualifiesForFree) return 0;
    return restaurant.deliveryCharge !== undefined ? restaurant.deliveryCharge : 40;
  })();

  const amountAfterCoupon = Math.max(0, cartTotal - couponDiscount);

  // Loyalty calculations
  const pointsAvailable = custRec ? (custRec.points || 0) : 0;
  const pointsVal = pointsAvailable * (restaurant.pointValueInRupees || 1);
  const discountApplied = redeemPointsChecked ? Math.min(amountAfterCoupon, pointsVal) : 0;
  const subtotalAndDiscount = Math.max(0, amountAfterCoupon - discountApplied);
  
  const finalAmount = subtotalAndDiscount + (orderType === 'delivery' ? calculatedDeliveryCharge : 0);
  const pointsEarned = restaurant.loyaltyEnabled ? Math.floor(subtotalAndDiscount / 100) * (restaurant.pointsPer100Spent || 1) : 0;

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
    // Delivery fields & radius verification
    if (orderType === 'delivery') {
      if (!deliveryAddress.trim()) {
        addToast('error', 'Please enter your delivery address.');
        return;
      }
      
      const targetLat = restaurant.latitude || 12.9348;
      const targetLng = restaurant.longitude || 77.6202;
      const maxRadius = restaurant.deliveryRadius || 10;

      const checkAndPlace = (lat: number, lng: number) => {
        const distanceInKm = getDistanceInMeters(lat, lng, targetLat, targetLng) / 1000;
        if (distanceInKm <= maxRadius) {
          handlePlaceOrder();
        } else {
          addToast('error', `Out of range: You are ${distanceInKm.toFixed(1)} km away. Maximum delivery radius is ${maxRadius} km.`);
          setLocationStatus('idle');
        }
      };

      if (deliveryLat !== null && deliveryLng !== null) {
        checkAndPlace(deliveryLat, deliveryLng);
      } else {
        setLocationStatus('verifying');
        if (!navigator.geolocation) {
          addToast('error', 'Location verification failed. Geolocation is not supported by your browser.');
          setLocationStatus('idle');
          return;
        }
        addToast('info', 'Capturing live GPS location to verify delivery range...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const clientLat = position.coords.latitude;
            const clientLng = position.coords.longitude;
            setDeliveryLat(clientLat);
            setDeliveryLng(clientLng);
            setLocationStatus('idle');
            checkAndPlace(clientLat, clientLng);
          },
          (error) => {
            console.error(error);
            addToast('error', 'Live location capture is mandatory for home delivery orders. Please enable GPS.');
            setLocationStatus('idle');
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
      return;
    }

    // Default In-Dining location check
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

  const handleApplyCouponCode = () => {
    const codeToApply = couponCode.trim().toUpperCase();
    if (!codeToApply) {
      setCouponError('Please enter a code.');
      return;
    }
    const found = state.coupons?.find(
      c => c.code.toUpperCase() === codeToApply && c.isActive
    );
    if (!found) {
      setCouponError('Invalid or expired coupon code.');
      return;
    }
    if (found.minOrderAmount && cartTotal < found.minOrderAmount) {
      setCouponError(`Minimum order of ₹${found.minOrderAmount} required.`);
      return;
    }
    // Enforce one-time coupon: check if this phone already used it
    if (found.isOneTime && customerPhone.trim()) {
      const alreadyUsed = state.orders.some(
        o => o.couponCodeApplied === found.code &&
             o.customerPhone === customerPhone.trim() &&
             o.restaurantId === restaurantId
      );
      if (alreadyUsed) {
        setCouponError('This coupon has already been used by your account.');
        return;
      }
    }
    // Check global usage limit
    if (found.usageLimit && (found.usageCount || 0) >= found.usageLimit) {
      setCouponError('This coupon has reached its usage limit.');
      return;
    }
    // Check category scope
    if (Array.isArray(found.appliesTo)) {
      const allowedCatIds = found.appliesTo;
      const hasApplicableItem = state.cart.some(cartItem => {
        const menuItem = state.menuItems.find(item => item.id === cartItem.menuItemId);
        const itemCatId = menuItem ? menuItem.category : '';
        return allowedCatIds.includes(itemCatId);
      });
      if (!hasApplicableItem) {
        setCouponError('This coupon is not applicable to any items in your cart.');
        return;
      }
    }
    setAppliedCoupon(found);
    setCouponError('');
    addToast('success', `🎉 Coupon ${found.code} applied successfully!`);
  };

  const handlePlaceOrder = async () => {
    if (!activeTableId) { addToast('error', 'No table selected.'); return; }
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

    const table = state.tables.find(t => t.id === activeTableId);

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
      tableNumber: orderType === 'delivery' ? 0 : (table?.number || 0),
      tableId: orderType === 'delivery' ? 'delivery' : activeTableId,
      restaurantId: restaurantId,
      restaurantName: restaurant.name,
      customerName: customerName.trim(),
      customerPhone: finalPhone,
      customerEmail: finalEmail || undefined,
      items: [...state.cart],
      status: 'pending',
      totalAmount: finalAmount,
      specialNote,
      numberOfGuests: orderType === 'delivery' ? undefined : (!isNaN(parsedGuests) && parsedGuests > 0 ? parsedGuests : undefined),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pointsEarned,
      pointsRedeemed: redeemPointsChecked ? pointsAvailable : 0,
      pointsDiscountApplied: discountApplied,
      couponCodeApplied: appliedCoupon ? appliedCoupon.code : undefined,
      couponDiscountApplied: couponDiscount > 0 ? couponDiscount : undefined,
      orderType: orderType,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
      paymentMethod: orderType === 'delivery' ? 'upi' : 'cash',
      paymentStatus: orderType === 'delivery' ? 'waiting_confirmation' : 'pending',
      deliveryLat: orderType === 'delivery' ? (deliveryLat ?? undefined) : undefined,
      deliveryLng: orderType === 'delivery' ? (deliveryLng ?? undefined) : undefined,
      deliveryCharge: orderType === 'delivery' ? calculatedDeliveryCharge : undefined,
    };

    dispatch({ type: 'PLACE_ORDER', payload: order });
    dispatch({ type: 'CLEAR_CART' });
    dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'orders' });

    // Increment coupon usageCount so one-time and limited coupons track properly
    if (appliedCoupon) {
      dispatch({ type: 'UPDATE_COUPON', payload: {
        ...appliedCoupon,
        usageCount: (appliedCoupon.usageCount || 0) + 1
      }});
    }

    addToast('success', orderType === 'delivery' ? '🎉 Order placed! Your payment confirmation has been sent to the restaurant.' : '🎉 Order placed! Track it in My Orders.');
    setOpen(false);
    setCheckoutStep('cart');
    setSpecialNote('');
    setNumberOfGuests('');
    setRedeemPointsChecked(false);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
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
                  const addonKey = (item.addons || []).map(a => a.optionId).sort().join(',');
                  const itemKey = `${item.menuItemId}-${item.variant?.name || ''}-${addonKey}`;
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
                        {item.addons && item.addons.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '2px 6px' }}>
                            {item.addons.map((addonOpt, idx) => (
                              <span key={`${addonOpt.optionId}-${idx}`} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '1px 5px', borderRadius: 4 }}>
                                + {addonOpt.optionName} {addonOpt.price > 0 ? `(₹${addonOpt.price})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>₹{item.price} each</div>
                      </div>

                      {/* Qty controls */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        background: 'var(--brand)', borderRadius: 99, overflow: 'hidden',
                      }}>
                        <button
                          onClick={() => dispatch({ type: 'UPDATE_CART_QTY', payload: { menuItemId: item.menuItemId, qty: item.qty - 1, variantName: item.variant?.name, addonKey } })}
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
                        onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: { menuItemId: item.menuItemId, variantName: item.variant?.name, addonKey } })}
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
              {googleUser ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {/* Signed In Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    animation: 'fadeIn 0.2s ease',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: 12,
                    padding: '10px 14px',
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Signed In</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{googleUser.name} ({googleUser.phone})</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('meenufy_customer_google_user');
                        localStorage.removeItem('meenufy_customer_logged_in_user');
                        localStorage.removeItem('meenufy_customer_user_logged_in');
                        setGoogleUser(null);
                        setCustomerName('');
                        setCustomerPhone('');
                        setCustomerEmail('');
                        addToast('info', 'Signed out successfully');
                      }}
                      style={{
                        background: 'none', border: 'none', color: 'var(--error)',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Sign Out
                    </button>
                  </div>

                  {/* Logged in custom options */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11 }}>No. of People (optional)</label>
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
                        style={{ appearance: 'textfield', height: 38, fontSize: 12 }}
                      />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11 }}>Special Notes (optional)</label>
                      <textarea className="input" rows={1} placeholder="Less spicy, no onions..."
                        value={specialNote} onChange={e => setSpecialNote(e.target.value)}
                        style={{ resize: 'none', height: 38, fontSize: 12, padding: '8px 10px' }} />
                    </div>

                    <div className="input-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                      <label className="input-label" style={{ fontSize: 11 }}>Promo Code</label>
                      {appliedCoupon ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--brand-dim)',
                          border: '1px solid var(--border-brand)',
                          borderRadius: 8,
                          padding: '4px 8px',
                          height: 38,
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                            {appliedCoupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedCoupon(null);
                              setCouponCode('');
                              setCouponError('');
                              addToast('info', 'Promo code removed.');
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--error)',
                              border: 'none',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 9,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            type="text"
                            className="input"
                            placeholder="Code"
                            value={couponCode}
                            onChange={e => {
                              setCouponCode(e.target.value.toUpperCase());
                              setCouponError('');
                            }}
                            style={{
                              flex: 1,
                              textTransform: 'uppercase',
                              height: 38,
                              padding: '0 8px',
                              fontSize: 12,
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleApplyCouponCode}
                            className="btn btn-primary"
                            style={{
                              height: 38,
                              padding: '0 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 10,
                              background: 'var(--brand)',
                              color: '#000',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {couponError && (
                    <div style={{ fontSize: 11, color: 'var(--error)', fontWeight: 600, marginTop: -4 }}>
                      ⚠️ {couponError}
                    </div>
                  )}

                  {appliedCoupon && (
                    <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: -4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>🎉 Coupon {appliedCoupon.code} applied: {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% Off` : `₹${appliedCoupon.value} Off`}</span>
                      {appliedCoupon.label && (
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 'normal' }}>ℹ️ {appliedCoupon.label}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : restaurant.mustLoginBeforeOrder ? (
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
                    This restaurant requires you to sign in before placing orders.
                  </p>
                  <button
                    onClick={() => {
                      setOpen(false);
                      dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'more' });
                      addToast('info', 'Please sign in or sign up here! 🔑');
                    }}
                    className="btn"
                    type="button"
                    style={{
                      background: 'var(--brand)',
                      color: '#000000',
                      border: 'none',
                      fontSize: 12, fontWeight: 800, padding: '8px 16px', borderRadius: 99,
                      cursor: 'pointer'
                    }}
                  >
                    Sign In / Sign Up
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}>
                    {/* Phone & Name */}
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11, fontWeight: 700 }}>Phone Number*</label>
                      <input className="input" type="tel" placeholder="+91 98765 43210"
                        value={customerPhone} onChange={handlePhoneChange} style={{ height: 38, fontSize: 12 }} />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11, fontWeight: 700 }}>Your Name*</label>
                      <input className="input" type="text" placeholder="e.g. Ananya"
                        value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ height: 38, fontSize: 12 }} />
                    </div>

                    {/* Email & Guests */}
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11 }}>Email (optional)</label>
                      <input className="input" type="email" placeholder="e.g. ananya@gmail.com"
                        value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={{ height: 38, fontSize: 12 }} />
                    </div>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11 }}>No. of People (optional)</label>
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
                        style={{ appearance: 'textfield', height: 38, fontSize: 12 }}
                      />
                    </div>

                    {/* Special Note & Promo Code */}
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11 }}>Special Notes (optional)</label>
                      <textarea className="input" rows={1} placeholder="Less spicy, no onions..."
                        value={specialNote} onChange={e => setSpecialNote(e.target.value)}
                        style={{ resize: 'none', height: 38, fontSize: 12, padding: '8px 10px' }} />
                    </div>
                    
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontSize: 11 }}>Promo Code</label>
                      {appliedCoupon ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--brand-dim)',
                          border: '1px solid var(--border-brand)',
                          borderRadius: 8,
                          padding: '4px 8px',
                          height: 38,
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 85 }}>
                            {appliedCoupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedCoupon(null);
                              setCouponCode('');
                              setCouponError('');
                              addToast('info', 'Promo code removed.');
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: 'var(--error)',
                              border: 'none',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 9,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            type="text"
                            className="input"
                            placeholder="Code"
                            value={couponCode}
                            onChange={e => {
                              setCouponCode(e.target.value.toUpperCase());
                              setCouponError('');
                            }}
                            style={{
                              flex: 1,
                              textTransform: 'uppercase',
                              height: 38,
                              padding: '0 8px',
                              fontSize: 12,
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleApplyCouponCode}
                            className="btn btn-primary"
                            style={{
                              height: 38,
                              padding: '0 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 10,
                              background: 'var(--brand)',
                              color: '#000',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {couponError && (
                    <div style={{ fontSize: 11, color: 'var(--error)', fontWeight: 600, marginTop: -4 }}>
                      ⚠️ {couponError}
                    </div>
                  )}

                  {appliedCoupon && (
                    <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: -4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>🎉 Coupon {appliedCoupon.code} applied: {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% Off` : `₹${appliedCoupon.value} Off`}</span>
                      {appliedCoupon.label && (
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 'normal' }}>ℹ️ {appliedCoupon.label}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Order Type Toggle */}
              {(!restaurant.mustLoginBeforeOrder || googleUser) && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 16,
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 12,
                  border: '1px solid var(--border)'
                }}>
                  <label className="input-label" style={{ fontWeight: 700, margin: 0 }}>Order Type</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(() => {
                      const opts = [];
                      if (!isViewOnly) {
                        opts.push({ value: 'in-dining', label: '🪑 In-Dining' });
                        opts.push({ value: 'take-away', label: '🛍️ Take-Away' });
                      } else {
                        opts.push({ value: 'take-away', label: '🛍️ Pick-up' });
                      }
                      if (restaurant.deliveryEnabled) {
                        opts.push({ value: 'delivery', label: '🚀 Delivery' });
                      }
                      return opts.map(opt => {
                        const isSel = orderType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setOrderType(opt.value as any);
                            }}
                            style={{
                              flex: 1,
                              padding: '10px 8px',
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 700,
                              border: isSel ? '2px solid var(--border-brand)' : '1px solid var(--border)',
                              background: isSel ? 'var(--brand-dim)' : 'var(--bg-primary)',
                              color: isSel ? 'var(--brand)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Delivery Address Input */}
              {orderType === 'delivery' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginBottom: 16,
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" style={{ fontWeight: 700, margin: 0 }}>Delivery Address</label>
                    <button
                      type="button"
                      onClick={handleFetchGpsLocation}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 10, height: 24, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                    >
                      📍 Locate Me (GPS)
                    </button>
                  </div>

                  {/* Saved Addresses for logged-in user */}
                  {isLoggedIn && customerAddresses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>Choose Saved Address:</div>
                      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }} className="hide-scrollbar">
                        {customerAddresses.map((addr: any) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              setDeliveryAddress(addr.fullAddress);
                              setDeliveryLat(addr.lat ?? null);
                              setDeliveryLng(addr.lng ?? null);
                              if (addr.name) setCustomerName(addr.name);
                              addToast('success', `Selected: ${addr.name}'s address`);
                            }}
                            style={{
                              flexShrink: 0, padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                              background: deliveryAddress === addr.fullAddress ? 'var(--brand-dim)' : 'var(--bg-primary)',
                              border: deliveryAddress === addr.fullAddress ? '1.5px solid var(--border-brand)' : '1px solid var(--border)',
                              color: deliveryAddress === addr.fullAddress ? 'var(--brand)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            🏠 {addr.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Address Auto-population Badge for Guest / Regular Users */}
                  {pastAddressOption && deliveryAddress !== pastAddressOption.fullAddress && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryAddress(pastAddressOption.fullAddress);
                          setDeliveryLat(pastAddressOption.lat ?? null);
                          setDeliveryLng(pastAddressOption.lng ?? null);
                          if (pastAddressOption.name) setCustomerName(pastAddressOption.name);
                          addToast('success', 'Auto-filled your previous order address!');
                        }}
                        style={{
                          fontSize: 10, fontWeight: 700, background: 'var(--brand-dim)', color: 'var(--brand)',
                          border: '1px solid var(--border-brand)', borderRadius: 8, padding: '6px 10px',
                          cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4,
                          outline: 'none'
                        }}
                      >
                        📋 Use Previous Address: "{pastAddressOption.fullAddress.substring(0, 32)}..."
                      </button>
                    </div>
                  )}

                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Enter complete home address with landmark details..."
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 12, resize: 'none', outline: 'none', background: 'var(--bg-primary)' }}
                  />
                  {deliveryLat && deliveryLng && (
                    <div style={{ fontSize: 9, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✅ GPS Attached: {deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}</span>
                      {distanceInKm !== null && (
                        <span>({distanceInKm.toFixed(2)} KM away)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Loyalty Program Points Redemption */}
              {restaurant.loyaltyEnabled && (
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
                  opacity: googleUser ? 1 : 0.6,
                  filter: googleUser ? 'none' : 'blur(0.5px)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🎁</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Redeem Loyalty Points</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {googleUser 
                          ? (pointsAvailable > 0 ? `Use ${pointsAvailable} points to get ₹${pointsVal} off!` : 'No points available to redeem.')
                          : 'Sign in to view and redeem your points.'
                        }
                      </div>
                    </div>
                  </div>
                  {googleUser ? (
                    pointsAvailable > 0 && (
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
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'more' });
                        addToast('info', 'Please sign in or sign up first! 🔑');
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 10, padding: '4px 8px', background: 'var(--brand)', color: '#000', border: 'none', fontWeight: 700 }}
                    >
                      Sign In
                    </button>
                  )}
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
                {appliedCoupon && couponDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--brand)', marginBottom: 6 }}>
                    <span>Promo Discount ({appliedCoupon.code})</span>
                    <span>-₹{couponDiscount}</span>
                  </div>
                )}
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
                {orderType === 'delivery' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>Delivery Charge</span>
                    <span style={{ color: calculatedDeliveryCharge === 0 ? 'var(--success)' : 'var(--text-primary)', fontWeight: calculatedDeliveryCharge === 0 ? 700 : 500 }}>
                      {calculatedDeliveryCharge === 0 ? 'Free' : `₹${calculatedDeliveryCharge}`}
                    </span>
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
                    {isHardLimitReached 
                      ? '⚠️ Checkout is temporarily unavailable: waiting for the restaurant owner to recharge us...'
                      : '⚠️ Checkout is temporarily unavailable as this restaurant has reached its monthly order capacity limit. Please contact the administrator.'
                    }
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
                  onClick={() => {
                    // Validate before showing confirm screen
                    const isLoginRequired = restaurant.mustLoginBeforeOrder;
                    if (isLoginRequired && !googleUser) {
                      addToast('error', 'You must sign in with Google to place an order.');
                      return;
                    }
                    if (!isLoginRequired && (!customerName.trim() || !customerPhone.trim())) {
                      addToast('error', 'Name and Phone number are required.');
                      return;
                    }
                    if (orderType === 'delivery' && !deliveryAddress.trim()) {
                      addToast('error', 'Please enter your delivery address.');
                      return;
                    }
                    setCheckoutStep('confirm');
                  }}
                  disabled={placing}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  Review & Confirm <ArrowRight size={17} />
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

      {/* ── STEP 2: Confirm Order Overlay ── */}
      {checkoutStep === 'confirm' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0',
            border: '1px solid var(--border-elevated)',
            width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto',
            animation: 'slideInUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            padding: '24px 20px 36px',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-elevated)' }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>Confirm Your Order</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Please review the details below before placing your order.</p>
            </div>

            {/* Order type display */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
              padding: '12px 14px', background: 'var(--bg-elevated)',
              borderRadius: 12, border: '1px solid var(--border)'
            }}>
              {[
                { value: 'in-dining', label: '🪑 In-Dining', show: !isViewOnly || !!new URLSearchParams(window.location.search).get('table') },
                { value: 'take-away', label: '🛍️ Take-Away', show: true },
                { value: 'delivery', label: '🏠 Delivery', show: !!restaurant.deliveryEnabled },
              ].filter(o => o.show).map(opt => {
                const isSel = orderType === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => setOrderType(opt.value as any)}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: isSel ? '2px solid var(--border-brand)' : '1px solid var(--border)',
                      background: isSel ? 'var(--brand-dim)' : 'var(--bg-primary)',
                      color: isSel ? 'var(--brand)' : 'var(--text-secondary)', transition: 'all 0.2s'
                    }}
                  >{opt.label}</button>
                );
              })}
            </div>

            {/* Delivery address if delivery */}
            {orderType === 'delivery' && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em' }}>📍 DELIVERING TO</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{deliveryAddress}</div>
              </div>
            )}

            {/* Items summary */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.04em' }}>YOUR ORDER — {cartCount} ITEMS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {state.cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.name} {item.variant ? `(${item.variant.name})` : ''} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>×{item.qty}</span></span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{item.price * item.qty}</span>
                  </div>
                ))}
              </div>
              {(couponDiscount > 0 || discountApplied > 0) && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
                  {couponDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--brand)' }}><span>Coupon Discount</span><span>-₹{couponDiscount}</span></div>}
                  {discountApplied > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)' }}><span>Loyalty Discount</span><span>-₹{discountApplied}</span></div>}
                </div>
              )}
            </div>

            {/* Total amount */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 24, padding: '16px 18px',
              background: 'linear-gradient(135deg, rgba(255,125,0,0.12), rgba(255,125,0,0.04))',
              border: '1px solid rgba(255,125,0,0.25)', borderRadius: 14,
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>TOTAL TO PAY</div>
                {orderType === 'delivery' && <div style={{ fontSize: 10, color: '#A855F7', marginTop: 2, fontWeight: 600 }}>📱 Via UPI after confirmation</div>}
                {orderType !== 'delivery' && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Pay at counter / table</div>}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand)' }}>₹{finalAmount}</div>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary btn-full btn-lg"
                disabled={placing}
                onClick={() => {
                  if (orderType === 'delivery') {
                    // For delivery: go to UPI payment screen
                    setCheckoutStep('upi_payment');
                  } else {
                    // In-dining / take-away: place immediately (no payment upfront)
                    triggerOrder();
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {placing ? (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.7s linear infinite' }} />
                ) : orderType === 'delivery' ? (
                  <>Proceed to Pay ₹{finalAmount} <ArrowRight size={17} /></>
                ) : (
                  <>✅ Place Order — ₹{finalAmount}</>
                )}
              </button>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => setCheckoutStep('cart')}
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                ← Go Back to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: UPI Payment Overlay (delivery only) ── */}
      {checkoutStep === 'upi_payment' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0',
            border: '1px solid var(--border-elevated)',
            width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
            animation: 'slideInUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            padding: '24px 20px 36px',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-elevated)' }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4 }}>Pay via UPI</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Scan the QR or copy the UPI ID to pay. Once done, tap the button below.</p>
            </div>

            {/* Amount badge */}
            <div style={{
              textAlign: 'center', marginBottom: 20, padding: '14px',
              background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))',
              border: '1px solid rgba(168,85,247,0.3)', borderRadius: 14,
            }}>
              <div style={{ fontSize: 11, color: '#A855F7', fontWeight: 800, letterSpacing: '0.06em', marginBottom: 4 }}>AMOUNT TO PAY</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#E9D5FF', letterSpacing: '0.02em' }}>₹{finalAmount}</div>
            </div>

            {/* UPI QR */}
            {restaurant.upiQrCode ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 180, height: 180, background: '#ffffff', padding: 10, borderRadius: 16, border: '3px solid rgba(168,85,247,0.3)', boxShadow: '0 0 30px rgba(168,85,247,0.2)' }}>
                  <img src={restaurant.upiQrCode} alt="UPI QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                QR Code not uploaded. Use the UPI ID below.
              </div>
            )}

            {/* UPI ID copy row */}
            {restaurant.upiId && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', marginBottom: 16,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>UPI ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{restaurant.upiId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(restaurant.upiId || ''); addToast('success', 'UPI ID copied! 📋'); }}
                  style={{
                    background: 'var(--brand-dim)', border: '1px solid var(--border-brand)',
                    color: 'var(--brand)', fontWeight: 800, fontSize: 12,
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer'
                  }}
                >Copy</button>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6, padding: '0 8px' }}>
              After paying, tap the button below. The restaurant will verify your payment and start preparing your order. ✅
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-full btn-lg"
                disabled={placing}
                onClick={triggerOrder}
                style={{
                  background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                  color: '#FFFFFF', fontWeight: 900, fontSize: 14,
                  border: 'none', borderRadius: 14, cursor: placing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '16px', boxShadow: '0 0 20px rgba(168,85,247,0.4)', opacity: placing ? 0.7 : 1
                }}
              >
                {placing ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  '✅ I\'ve Paid — Send Payment Confirmation'
                )}
              </button>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => setCheckoutStep('confirm')}
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}


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
