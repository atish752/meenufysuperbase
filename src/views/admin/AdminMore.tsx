import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/RealtimeStore';
import {
  Store, Save, LogOut,
  MessageSquare, Smartphone, Send, Download, QrCode, ExternalLink,
  CreditCard, Printer, Users
} from 'lucide-react';
import { auth, googleProvider, hasFirebaseConfig, db } from '../../utils/firebase';
import { signInWithPopup } from 'firebase/auth';
import { connectBluetoothPrinter, disconnectBluetoothPrinter, printThermalReceipt } from '../../utils/printReceipt';


function getQRUrl(tableId: string, restaurantId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/?view=customer&table=${tableId}&restaurant=${restaurantId}`;
}

function parseCoordsFromGmaps(url: string): { lat: number; lng: number } | null {
  try {
    const matchAt = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (matchAt) {
      return { lat: parseFloat(matchAt[1]), lng: parseFloat(matchAt[2]) };
    }
    const matchQuery = url.match(/[?&](q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (matchQuery) {
      return { lat: parseFloat(matchQuery[2]), lng: parseFloat(matchQuery[3]) };
    }
  } catch {}
  return null;
}

function cropImageSource(base64Src: string, ratio: '1:1' | '3:4' | '9:16', maxDim = 800, targetKb = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      let targetRatio = 1.0;
      if (ratio === '3:4') targetRatio = 3 / 4;
      if (ratio === '9:16') targetRatio = 9 / 16;

      // Calculate cropping bounds to match target aspect ratio
      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
      const currentRatio = img.width / img.height;

      if (currentRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
      } else if (currentRatio < targetRatio) {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
      }

      let targetWidth, targetHeight;
      if (targetRatio >= 1.0) {
        targetWidth = Math.min(sWidth, maxDim);
        targetHeight = targetWidth / targetRatio;
      } else {
        targetHeight = Math.min(sHeight, maxDim);
        targetWidth = targetHeight * targetRatio;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Src);
        return;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      const maxBase64Length = Math.round(targetKb * 1024 * 1.34);

      while (dataUrl.length > maxBase64Length && quality > 0.3) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(dataUrl);
    };
    img.onerror = (err) => reject(err);
  });
}

export default function AdminMore({ forceSection }: { forceSection?: string } = {}) {
  const { state, dispatch, addToast } = useStore();
  const [googleLinking, setGoogleLinking] = useState(false);

  const isFirebaseUser = !!state.admin?.isFirebaseUser;
  const canConnectGoogle = !isFirebaseUser && hasFirebaseConfig && !!auth && !state.admin?.isSuperAdmin && !state.admin?.isStaff;

  const handleConnectGoogle = async () => {
    if (!auth || !googleProvider) return;
    setGoogleLinking(true);
    try {
      localStorage.setItem('meenufy_auth_role', 'admin');
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      dispatch({
        type: 'LINK_GOOGLE_ACCOUNT',
        payload: {
          uid: fbUser.uid,
          name: fbUser.displayName || state.admin?.name || '',
          email: fbUser.email || state.admin?.email || '',
        }
      });
      addToast('success', '✅ Google account connected! Your data is now safely synced to the cloud.');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        addToast('error', `❌ Failed to connect Google: ${err.message || err}`);
      }
    } finally {
      setGoogleLinking(false);
    }
  };


  const isStaff = !!state.admin?.isStaff;
  const permissions = state.admin?.permissions || [];
  const currentRestaurantId = state.admin?.restaurantId || 'admin-1';
  const myStaff = state.staffMembers ? state.staffMembers.filter(s => s.restaurantId === currentRestaurantId) : [];
  const myDeliveryBoys = state.deliveryBoys ? state.deliveryBoys.filter(d => d.restaurantId === currentRestaurantId) : [];

  const getStaffLimit = (plan: string) => {
    switch (plan) {
      case 'base': return 3; // "Standard plan"
      case 'standard': return 6; // "Advance Plan"
      case 'advance': return 6;
      case 'free':
      default:
        return 3; // Return 3 for Free/Default as fallback
    }
  };
  const staffLimit = getStaffLimit(state.subscriptionPlan || 'free');

  const getDeliveryBoyLimit = (plan: string) => {
    switch (plan) {
      case 'base': return 7; // "Standard plan"
      case 'standard': return 15; // "Advance Plan"
      case 'advance': return 15;
      case 'free':
      default:
        return 2;
    }
  };
  const deliveryBoyLimit = getDeliveryBoyLimit(state.subscriptionPlan || 'free');

  const rawSections = [
    { id: 'qr', label: 'Manage QR & Tables', icon: QrCode, permission: 'qr_tables' },
    { id: 'autoprint', label: 'Autoprint KOT/Bill', icon: Printer, permission: 'outlet_setting' },
    { id: 'staff', label: 'Manage Staff', icon: Users, permission: 'owner_only' },
    { id: 'subscription', label: 'Pricing & Subscription', icon: CreditCard, permission: 'owner_only' },
    { id: 'pwa', label: 'Install App', icon: Smartphone },
    { id: 'feedback', label: 'Feedback & Tickets', icon: MessageSquare },
  ];

  const sections = rawSections.filter(sec => {
    if (isStaff) {
      if (sec.permission === 'owner_only') return false;
      if (sec.permission && !permissions.includes(sec.permission as any)) return false;
    }
    return true;
  });

  const activeAccount = state.restaurantAccounts?.find(acc => acc.id === (state.admin?.restaurantId || state.admin?.id));
  const currentRestName = activeAccount?.restaurantName || state.restaurant.name;

  const [restaurantForm, setRestaurantForm] = useState({ 
    ...state.restaurant,
    name: currentRestName
  });
  const [feedbackText, setFeedbackText] = useState('');
  const [ticketType, setTicketType] = useState<'feedback' | 'bug' | 'feature' | 'other'>('feedback');
  const [activeSection, setActiveSection] = useState<string | null>(forceSection || null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'free' | 'base' | 'standard' | 'advance' | null>(null);
  const [outletSubSection, setOutletSubSection] = useState<'menu' | 'delivery' | 'upi' | 'customization' | 'info' | 'logo_image'>('delivery');

  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  useEffect(() => {
    // Only synchronize the form ONCE after the real database data has arrived (accountsFromDb = true).
    // This prevents the form from permanently locking in the DEFAULT mock state from cache,
    // and prevents overwriting user edits on every background update.
    if (!initialDataLoaded && state.accountsFromDb) {
      const targetId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
      const freshAccount = state.restaurantAccounts?.find(acc => acc.id === targetId);
      
      setRestaurantForm({ 
        ...state.restaurant, 
        name: freshAccount?.restaurantName || state.restaurant.name,
        posterImage: freshAccount?.posterImage || state.restaurant.posterImage,
        logo: freshAccount?.logo || state.restaurant.logo,
      });
      setTableCount(state.restaurant.tableCount || 0);
      setInitialDataLoaded(true);
    }
  }, [state.restaurant, state.restaurantAccounts, state.admin, state.accountsFromDb, initialDataLoaded]);

  // Staff state hooks
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const resetStaffForm = () => {
    setEditingStaffId(null);
    setStaffName('');
    setStaffUsername('');
    setStaffPassword('');
    setStaffPermissions([]);
  };

  // Staff sub-tab state
  const [activeStaffSubTab, setActiveStaffSubTab] = useState<'manager' | 'delivery'>('manager');

  // Delivery Boy state hooks
  const [dboyName, setDboyName] = useState('');
  const [dboyUsername, setDboyUsername] = useState('');
  const [dboyPassword, setDboyPassword] = useState('');
  const [dboyPhone, setDboyPhone] = useState('');
  const [dboyPayoutPerKm, setDboyPayoutPerKm] = useState<number>(12);
  const [editingDboyId, setEditingDboyId] = useState<string | null>(null);

  const resetDboyForm = () => {
    setEditingDboyId(null);
    setDboyName('');
    setDboyUsername('');
    setDboyPassword('');
    setDboyPhone('');
    setDboyPayoutPerKm(12);
  };

  // Deep-link redirect & fallback initialization
  useEffect(() => {
    const targetSection = localStorage.getItem('meenufy_admin_more_section');
    if (targetSection && sections.some(s => s.id === targetSection)) {
      localStorage.removeItem('meenufy_admin_more_section');
      setActiveSection(targetSection);
    } else if (!activeSection && forceSection !== 'outlet' && sections.length > 0) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  const [selectedInstructionDevice, setSelectedInstructionDevice] = useState<'android' | 'ios' | 'windows' | 'mac' | 'pos'>('android');
  const [showInstructions, setShowInstructions] = useState(false);
  const [btConnecting, setBtConnecting] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [btPrinterName, setBtPrinterName] = useState('');
  const [btError, setBtError] = useState('');
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [billingPeriodToggle, setBillingPeriodToggle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgradePrice, setUpgradePrice] = useState(0);
  const [upgradeCurrency, setUpgradeCurrency] = useState('₹');

  // Force billing period to monthly for Indian accounts
  useEffect(() => {
    if (state.billingCountry === 'IN') {
      setBillingPeriodToggle('monthly');
      setSelectedBillingPeriod('monthly');
    }
  }, [state.billingCountry]);

  // Checkout coupon states
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [uploadingPoster, setUploadingPoster] = useState(false);


  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please upload an image file.');
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (event) => {
        const base64Src = event.target?.result as string;
        
        // Logo is always cropped to 1:1 ratio
        const cropped = await cropImageSource(base64Src, '1:1');
        setRestaurantForm(prev => ({ ...prev, logo: cropped }));
        dispatch({ type: 'UPDATE_RESTAURANT', payload: { logo: cropped } });
        addToast('success', '✨ Restaurant logo uploaded & saved live to cloud! 📸');
      };
    } catch (err: any) {
      console.error(err);
      addToast('error', `❌ Logo upload failed: ${err.message || err}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please upload an image file.');
      return;
    }

    setUploadingPoster(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (event) => {
        const base64Src = event.target?.result as string;
        
        // Enforce square (1:1) crop for the profile image
        const cropped = await cropImageSource(base64Src, '1:1', 1200, 300);
        setRestaurantForm(prev => ({ ...prev, posterImage: cropped, posterRatio: '1:1' }));
        dispatch({ type: 'UPDATE_RESTAURANT', payload: { posterImage: cropped, posterRatio: '1:1' } });
        addToast('success', '✨ Restaurant poster image uploaded & saved live to cloud! 📸');
      };
    } catch (err: any) {
      console.error(err);
      addToast('error', `❌ Poster upload failed: ${err.message || err}`);
    } finally {
      setUploadingPoster(false);
    }
  };

  const [uploadingUpiQr, setUploadingUpiQr] = useState(false);
  const handleUpiQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please upload an image file.');
      return;
    }
    setUploadingUpiQr(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64Src = event.target?.result as string;
        setRestaurantForm(prev => ({ ...prev, upiQrCode: base64Src }));
        addToast('success', 'UPI QR Code uploaded successfully! 📱');
        setUploadingUpiQr(false);
      };
    } catch (err: any) {
      console.error(err);
      addToast('error', `❌ UPI QR upload failed: ${err.message || err}`);
      setUploadingUpiQr(false);
    }
  };



  // Secure payment gateway checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'select' | 'paying' | 'success' | 'awaiting_razorpay'>('select');
  const [razorpaySubInput, setRazorpaySubInput] = useState('');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  useEffect(() => {
    const pendingPlan = localStorage.getItem('meenufy_pending_onboarding_payment');
    if (pendingPlan && (pendingPlan === 'base' || pendingPlan === 'standard')) {
      localStorage.removeItem('meenufy_pending_onboarding_payment');
      const price = pendingPlan === 'base' ? 2500 : 4000;
      const link = pendingPlan === 'base' ? 'https://rzp.io/rzp/tAf4cvv' : 'https://rzp.io/rzp/NJuSDUd2';
      setSelectedUpgradePlan(pendingPlan as any);
      setSelectedBillingPeriod('monthly');
      setUpgradePrice(price);
      setUpgradeCurrency('₹');
      setShowCheckout(true);
      setCheckoutStep('awaiting_razorpay');
      window.open(link, '_blank', 'noopener,noreferrer');
      addToast('info', '💳 Redirecting to secure Razorpay payment. Complete the payment, then enter the Subscription ID below.');
    }
  }, []);

  const handleCancelSubscription = async () => {
    if (!state.subscriptionId) {
      addToast('error', 'No active subscription ID found to cancel.');
      return;
    }
    
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel your subscription? " +
      "Your auto-pay mandate will be terminated immediately, and your plan will revert to the Free Plan."
    );
    
    if (!confirmCancel) return;
    
    setCancellingSubscription(true);
    addToast('info', '🔄 Processing cancellation with payment gateway...');
    
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription_id: state.subscriptionId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      dispatch({
        type: 'UPDATE_SUBSCRIPTION_PLAN',
        payload: {
          planName: 'free',
          billingPeriod: 'monthly',
          subscriptionId: null
        }
      });
      
      addToast('success', '✅ Subscription and auto-pay mandate cancelled successfully. Your account is now on the Free Plan.');
    } catch (err: any) {
      console.error('Cancellation failed:', err);
      addToast('error', `❌ Failed to cancel subscription: ${err.message || err}. Please try again or contact support.`);
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handleSelectPlan = (planName: 'free' | 'base' | 'standard' | 'advance', price: number, currency: string, billingPeriod: 'monthly' | 'yearly') => {
    if (planName === state.subscriptionPlan && billingPeriod === (state.billingPeriod || 'monthly')) {
      addToast('info', 'You are already on this plan and billing cycle.');
      return;
    }
    if (price === 0) {
      if (state.subscriptionId) {
        const confirmCancel = window.confirm(
          "You have an active auto-pay subscription. Switching to the Free Plan will cancel your active auto-pay mandate. Do you want to proceed?"
        );
        if (!confirmCancel) return;

        setCheckoutProcessing(true);
        addToast('info', '🔄 Cancelling active auto-pay subscription mandate...');

        fetch('/api/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription_id: state.subscriptionId })
        })
        .then(async (response) => {
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP ${response.status}`);
          }
          dispatch({
            type: 'UPDATE_SUBSCRIPTION_PLAN',
            payload: { planName: 'free', billingPeriod, subscriptionId: null }
          });
          addToast('success', `✅ Subscription cancelled and switched to FREE plan successfully!`);
        })
        .catch(err => {
          console.error(err);
          addToast('error', `❌ Failed to cancel auto-pay mandate: ${err.message}. Switching aborted.`);
        })
        .finally(() => {
          setCheckoutProcessing(false);
        });
      } else {
        dispatch({
          type: 'UPDATE_SUBSCRIPTION_PLAN',
          payload: { planName, billingPeriod }
        });
        addToast('success', `Plan switched to ${planName.toUpperCase()} successfully!`);
      }
      return;
    }

    // For Indian billing — open the authorized Razorpay subscription links directly
    if (state.billingCountry === 'IN' && billingPeriod === 'monthly') {
      const razorpayLinks: Record<string, string> = {
        base: 'https://rzp.io/rzp/tAf4cvv',
        standard: 'https://rzp.io/rzp/NJuSDUd2',
      };
      const link = razorpayLinks[planName];
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
        addToast('info', '💳 Redirecting to secure Razorpay payment. Return here and click "I Have Paid" after completing payment.');
        // Show the "I Have Paid" button — store pending plan upgrade
        setSelectedUpgradePlan(planName);
        setUpgradePrice(price);
        setUpgradeCurrency(currency);
        setSelectedBillingPeriod(billingPeriod);
        setShowCheckout(true);
        setCheckoutStep('awaiting_razorpay');
        return;
      }
    }

    setSelectedUpgradePlan(planName);
    setSelectedBillingPeriod(billingPeriod);
    setUpgradePrice(price);
    setUpgradeCurrency(currency);
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCheckoutStep('select');
    setCheckoutProcessing(false);
    setShowCheckout(true);
  };



  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleConfirmCheckoutPayment = async () => {
    const finalPrice = Math.max(0, upgradePrice - discountAmount);
    
    if (finalPrice === 0) {
      setCheckoutProcessing(true);
      if (selectedUpgradePlan) {
        dispatch({
          type: 'UPDATE_SUBSCRIPTION_PLAN',
          payload: { planName: selectedUpgradePlan, billingPeriod: selectedBillingPeriod, subscriptionId: null }
        });
        
        // Auto-cancel old subscription if exists
        const oldSubId = state.subscriptionId;
        if (oldSubId) {
          fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription_id: oldSubId })
          }).catch(err => console.error('Failed to cancel old subscription:', err));
        }

        addToast('success', `Plan switched to ${selectedUpgradePlan.toUpperCase()} successfully!`);
      }
      setCheckoutProcessing(false);
      setCheckoutStep('success');
      return;
    }

    setCheckoutProcessing(true);
    const scriptLoaded = await loadRazorpay();
    if (!scriptLoaded) {
      addToast('error', '❌ Failed to load Razorpay payment gateway. Please check your internet connection.');
      setCheckoutProcessing(false);
      return;
    }

    const isIndia = state.billingCountry === 'IN';
    let subscriptionId = null;

    if (isIndia && selectedUpgradePlan && selectedUpgradePlan !== 'free') {
      const planMap: Record<string, string> = {
        base: 'plan_T5jAbFzD8S6d3z',
        standard: 'plan_T5jBF3G9LNhjhq',
        advance: 'plan_T5jBpArBbXSfLz'
      };
      
      const planId = planMap[selectedUpgradePlan];
      if (planId) {
        setCheckoutStep('paying');
        try {
          addToast('info', '🔄 Setting up secure auto-pay subscription mandate...');
          
          const response = await fetch('/api/create-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              plan_id: planId
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned HTTP ${response.status}: ${errorText}`);
          }
          
          const data = await response.json();
          subscriptionId = data.id;
        } catch (err: any) {
          console.error('Auto-pay mandate setup failed:', err);
          addToast('error', `❌ Auto-pay subscription setup failed: ${err.message || err}. Please try again or contact support.`);
          setCheckoutProcessing(false);
          setCheckoutStep('select');
          return;
        }
      }
    }

    const currencyCode = isIndia ? 'INR' : 'USD';
    const options: any = {
      key: 'rzp_live_SI7eJZcqXniZIm',
      name: 'Meenufy Pay',
      description: `${selectedUpgradePlan?.toUpperCase()} Plan Subscription`,
      image: '/meenufy_logo_dark.png',
      handler: function (response: any) {
        if (selectedUpgradePlan) {
          const finalBillingPeriod = isIndia ? 'monthly' : selectedBillingPeriod;
          dispatch({
            type: 'UPDATE_SUBSCRIPTION_PLAN',
            payload: { 
              planName: selectedUpgradePlan, 
              billingPeriod: finalBillingPeriod,
              subscriptionId: subscriptionId
            }
          });
          
          const paymentIdMsg = response.razorpay_subscription_id 
            ? `Subscription ID: ${response.razorpay_subscription_id}` 
            : `Payment ID: ${response.razorpay_payment_id}`;
          
          // Auto-cancel old subscription if exists
          const oldSubId = state.subscriptionId;
          if (oldSubId && oldSubId !== subscriptionId) {
            fetch('/api/cancel-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription_id: oldSubId })
            })
            .then(res => {
              if (res.ok) {
                console.log('Old subscription successfully cancelled in background:', oldSubId);
              } else {
                console.error('Failed to cancel old subscription in background:', oldSubId);
              }
            })
            .catch(err => console.error('Error auto-cancelling old subscription:', err));
          }

          addToast('success', `Payment securely verified! Plan upgraded to ${selectedUpgradePlan.toUpperCase()} (${selectedBillingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}). ${paymentIdMsg}`);
        }
        setCheckoutProcessing(false);
        setCheckoutStep('success');
      },
      prefill: {
        name: state.admin?.name || '',
        email: state.admin?.email || '',
        contact: state.restaurant.phone || ''
      },
      notes: {
        restaurantId: state.admin?.restaurantId || 'admin-1',
        planName: selectedUpgradePlan,
        billingPeriod: selectedBillingPeriod,
        couponApplied: appliedCoupon ? appliedCoupon.code : 'none'
      },
      theme: {
        color: '#ff7d00'
      },
      modal: {
        ondismiss: function() {
          setCheckoutProcessing(false);
          setCheckoutStep('select');
        }
      }
    };

    if (subscriptionId) {
      options.subscription_id = subscriptionId;
    } else {
      const subunitMultiplier = 100;
      options.amount = Math.round(finalPrice * subunitMultiplier);
      options.currency = currencyCode;
    }

    setCheckoutStep('paying');
    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        addToast('error', `❌ Payment failed: ${resp.error.description}`);
        setCheckoutProcessing(false);
        setCheckoutStep('select');
      });
      rzp.open();
    } catch (err: any) {
      console.error('Razorpay initialization error:', err);
      addToast('error', '❌ Could not initialize Razorpay checkout.');
      setCheckoutProcessing(false);
      setCheckoutStep('select');
    }
  };

  // QR Code Manager States
  const [tableCount, setTableCount] = useState(state.restaurant.tableCount);
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const viewOnlyQRRef = useRef<HTMLCanvasElement | null>(null);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Generate QR codes
  useEffect(() => {
    if (activeSection !== 'qr') return;
    import('qrcode').then(QRCode => {
      state.tables.forEach(table => {
        const canvas = qrRefs.current[table.id];
        if (canvas) {
          const url = getQRUrl(table.id, state.admin?.restaurantId || 'admin-1');
          QRCode.toCanvas(canvas, url, {
            width: 140,
            color: { dark: '#FFFFFF', light: '#0D0D0D' },
            errorCorrectionLevel: 'M',
          });
        }
      });

      // Restaurant Menu QR Code (For Flyers & Pamphlets)
      const viewOnlyCanvas = viewOnlyQRRef.current;
      if (viewOnlyCanvas) {
        const viewOnlyUrl = `${window.location.origin}/?restaurant=${state.admin?.restaurantId || 'admin-1'}`;
        QRCode.toCanvas(viewOnlyCanvas, viewOnlyUrl, {
          width: 180,
          color: { dark: '#FFFFFF', light: '#0D0D0D' },
          errorCorrectionLevel: 'M',
        });
      }
    });
  }, [activeSection, state.tables]);

  const handleSaveRestaurant = () => {
    const targetId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
    const activeAccount = state.restaurantAccounts?.find(acc => acc.id === targetId);
    const currentName = restaurantForm.name || activeAccount?.restaurantName || state.restaurant.name;
    const currentPoster = restaurantForm.posterImage || activeAccount?.posterImage || state.restaurant.posterImage;
    const currentLogo = restaurantForm.logo || activeAccount?.logo || state.restaurant.logo;
    
    const payloadToSave = { 
      ...restaurantForm, 
      name: currentName,
      ...(currentPoster ? { posterImage: currentPoster } : {}),
      ...(currentLogo ? { logo: currentLogo } : {})
    };
    dispatch({ type: 'UPDATE_RESTAURANT', payload: payloadToSave });
    addToast('success', '✨ Restaurant settings saved & synced live to cloud!');
  };

  const handleCaptureCurrentLocation = () => {
    if (!navigator.geolocation) {
      addToast('error', 'Geolocation is not supported by your browser.');
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRestaurantForm(prev => ({
          ...prev,
          latitude: parseFloat(position.coords.latitude.toFixed(6)),
          longitude: parseFloat(position.coords.longitude.toFixed(6)),
        }));
        addToast('success', '✨ Registered current location coordinates!');
        setCapturingLocation(false);
      },
      (error) => {
        console.error(error);
        addToast('error', 'Failed to retrieve location. Make sure GPS is enabled.');
        setCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) { addToast('error', 'Please write your message or ticket description first.'); return; }
    dispatch({
      type: 'SUBMIT_FEEDBACK',
      payload: {
        message: feedbackText.trim(),
        ticketType
      }
    });
    addToast('success', 'Ticket/Feedback submitted successfully! We will get back to you shortly. 🙏');
    setFeedbackText('');
  };

  const handleInstallPWA = async () => {
    const promptObj = deferredInstallPrompt || state.deferredPrompt;
    if (promptObj) {
      promptObj.prompt();
      const { outcome } = await promptObj.userChoice;
      if (outcome === 'accepted') {
        addToast('success', 'Meenufy installed successfully! 🎉');
        dispatch({ type: 'SET_STATE', payload: { deferredPrompt: null } });
        setDeferredInstallPrompt(null);
      }
    } else {
      addToast('info', 'To install: In Chrome, tap the 3-dot menu → "Add to Home screen" or "Install App".');
    }
  };

  const handleGenerateTables = () => {
    const tables = Array.from({ length: tableCount }, (_, i) => ({
      id: `table-${i + 1}`,
      number: i + 1,
      label: `Table ${i + 1}`,
      capacity: i % 3 === 0 ? 6 : 4,
      isActive: true,
    }));
    dispatch({ type: 'SET_TABLES', payload: tables });
    dispatch({ type: 'UPDATE_RESTAURANT', payload: { tableCount } });
    addToast('success', `${tableCount} QR codes generated!`);
  };

  const downloadQR = async (tableId: string, tableLabel: string) => {
    const QRCode = await import('qrcode');
    const url = getQRUrl(tableId, state.admin?.restaurantId || 'admin-1');
    
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    await QRCode.toCanvas(tempCanvas, url, {
      width: 800,
      margin: 2,
      color: { dark: '#0D0D0D', light: '#FFFFFF' }
    });

    ctx.drawImage(tempCanvas, 100, 160);

    ctx.fillStyle = '#0D0D0D';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.restaurant.name.toUpperCase(), 500, 80);

    ctx.font = '500 24px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('Scan to View Menu & Order', 500, 130);

    ctx.fillStyle = '#e06000';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText(tableLabel.toUpperCase(), 500, 1040);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${state.restaurant.name.replace(/\s+/g, '_')}_${tableLabel.replace(/\s+/g, '_')}_QR.png`;
    a.click();
  };

  const downloadAllQRs = async () => {
    addToast('info', 'Preparing high-quality QR codes for download...');
    for (let i = 0; i < state.tables.length; i++) {
      const table = state.tables[i];
      await new Promise(r => setTimeout(r, 250));
      downloadQR(table.id, table.label);
    }
    addToast('success', 'All QR codes downloaded! 📥');
  };

  const handleLogout = () => {
    // Sign out from Firebase Auth so the session is cleared on all devices
    if (auth) auth.signOut().catch(() => {});
    dispatch({ type: 'LOGOUT_ADMIN' });
    addToast('info', 'Logged out successfully.');
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      addToast('error', 'Name is required.');
      return;
    }
    if (!staffUsername.trim()) {
      addToast('error', 'Username is required.');
      return;
    }

    const usernameConflict = state.staffMembers.some(
      s => s.username === staffUsername.trim().toLowerCase() && s.id !== editingStaffId
    );
    if (usernameConflict) {
      addToast('error', 'Username already taken by another staff member.');
      return;
    }

    if (!editingStaffId) {
      if (myStaff.length >= staffLimit) {
        addToast('error', `Upgrade to add more than ${staffLimit} staff members.`);
        return;
      }
      if (staffPassword.length < 4) {
        addToast('error', 'Password must be at least 4 characters long.');
        return;
      }

      const newStaff = {
        id: `staff-${Date.now()}`,
        name: staffName.trim(),
        username: staffUsername.trim().toLowerCase(),
        password: staffPassword,
        permissions: staffPermissions as any,
        restaurantId: currentRestaurantId,
        createdAt: Date.now()
      };

      dispatch({ type: 'ADD_STAFF_MEMBER', payload: newStaff });
      addToast('success', `Staff member ${newStaff.name} created successfully! 🎉`);
    } else {
      const existing = state.staffMembers.find(s => s.id === editingStaffId);
      if (!existing) return;

      const updatedStaff = {
        ...existing,
        name: staffName.trim(),
        permissions: staffPermissions as any,
        password: staffPassword.trim() ? staffPassword : existing.password
      };

      dispatch({ type: 'UPDATE_STAFF_MEMBER', payload: updatedStaff });
      addToast('success', `Staff member ${updatedStaff.name} updated!`);
    }

    resetStaffForm();
  };

  const handleEditStaffClick = (staff: any) => {
    setEditingStaffId(staff.id);
    setStaffName(staff.name);
    setStaffUsername(staff.username);
    setStaffPassword(staff.password || '');
    setStaffPermissions(staff.permissions || []);
  };

  const handleDeleteStaffClick = (id: string) => {
    if (confirm('Are you sure you want to delete this staff member?')) {
      dispatch({ type: 'DELETE_STAFF_MEMBER', payload: id });
      addToast('success', 'Staff member deleted successfully.');
      if (editingStaffId === id) {
        resetStaffForm();
      }
    }
  };

  const handleSaveDboy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dboyName.trim()) {
      addToast('error', 'Name is required.');
      return;
    }
    if (!dboyUsername.trim()) {
      addToast('error', 'Username/Email is required.');
      return;
    }

    const usernameConflict = (state.deliveryBoys || []).some(
      d => d.username === dboyUsername.trim().toLowerCase() && d.id !== editingDboyId
    ) || (state.staffMembers || []).some(
      s => s.username === dboyUsername.trim().toLowerCase()
    );
    if (usernameConflict) {
      addToast('error', 'Username already taken by another account.');
      return;
    }

    if (!editingDboyId) {
      if (myDeliveryBoys.length >= deliveryBoyLimit) {
        addToast('error', `Upgrade to add more than ${deliveryBoyLimit} delivery boys.`);
        return;
      }
      if (dboyPassword.length < 4) {
        addToast('error', 'Password must be at least 4 characters long.');
        return;
      }

      const newDboy = {
        id: `dboy-${Date.now()}`,
        name: dboyName.trim(),
        username: dboyUsername.trim().toLowerCase(),
        password: dboyPassword,
        phone: dboyPhone.trim(),
        restaurantId: currentRestaurantId,
        status: 'idle' as const,
        totalDeliveries: 0,
        totalEarnings: 0,
        payoutPerKm: dboyPayoutPerKm,
        createdAt: Date.now()
      };

      dispatch({ type: 'ADD_DELIVERY_BOY', payload: newDboy });
      addToast('success', `Delivery Boy ${newDboy.name} created successfully! 🚀`);
    } else {
      const existing = state.deliveryBoys.find(d => d.id === editingDboyId);
      if (!existing) return;

      const updatedDboy = {
        ...existing,
        name: dboyName.trim(),
        password: dboyPassword.trim() ? dboyPassword : existing.password,
        phone: dboyPhone.trim(),
        payoutPerKm: dboyPayoutPerKm
      };

      dispatch({ type: 'UPDATE_DELIVERY_BOY', payload: updatedDboy });
      addToast('success', `Delivery Boy ${updatedDboy.name} updated!`);
    }

    resetDboyForm();
  };

  const handleEditDboyClick = (dboy: any) => {
    setEditingDboyId(dboy.id);
    setDboyName(dboy.name);
    setDboyUsername(dboy.username);
    setDboyPassword(dboy.password || '');
    setDboyPhone(dboy.phone || '');
    setDboyPayoutPerKm(dboy.payoutPerKm || 12);
  };

  const handleDeleteDboyClick = (id: string) => {
    if (confirm('Are you sure you want to delete this delivery boy?')) {
      dispatch({ type: 'DELETE_DELIVERY_BOY', payload: id });
      addToast('success', 'Delivery boy deleted successfully.');
      if (editingDboyId === id) {
        resetDboyForm();
      }
    }
  };

  const isOnlyOutlet = forceSection === 'outlet';

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease' }}>
      {!isOnlyOutlet ? (
        <>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>More</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Settings, preferences & more</p>
          </div>

          {/* Profile Card */}
          <div className="card-brand" style={{ marginBottom: canConnectGoogle ? 8 : 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--brand-dim)', border: '2px solid var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--brand)',
              flexShrink: 0,
            }}>
              {state.admin?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{state.admin?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{state.admin?.email}</div>
              <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 2 }}>
                {state.restaurant.name}
              </div>
            </div>
            {canConnectGoogle && (
              <button
                onClick={handleConnectGoogle}
                disabled={googleLinking}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#4285F4',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '7px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: googleLinking ? 'not-allowed' : 'pointer',
                  opacity: googleLinking ? 0.7 : 1,
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(66,133,244,0.35)',
                  transition: 'all 0.2s ease',
                }}
                title="Connect your Google Account for cloud data sync"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#ffffff"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff"/>
                </svg>
                {googleLinking ? 'Linking...' : 'Connect Google'}
              </button>
            )}
          </div>
          {canConnectGoogle && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 12,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 2 }}>Data not synced to cloud</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Your account is not connected to Google. Categories, menu items & orders may not save to the cloud. Click <strong>Connect Google</strong> above to enable cloud sync and prevent data loss.
                </div>
              </div>
            </div>
          )}

          {/* Nav Buttons - Horizontal Grid for Easy Access */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 10,
            marginBottom: 20
          }}>
            {sections.map(section => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 8px',
                    gap: 8,
                    background: isActive ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    border: isActive ? '2px solid var(--brand)' : '1px solid var(--border)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                    boxShadow: isActive ? 'var(--shadow-brand)' : 'none',
                  }}
                >
                  <Icon size={20} />
                  <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{section.label}</span>
                </button>
              );
            })}
          </div>

          {/* Theme Selection Card */}
          <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>{state.adminTheme === 'light' ? '☀️' : '🌙'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Interface Theme</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Switch between Light and Dark interface colors</div>
              </div>
            </div>
            <button
              onClick={() => {
                dispatch({ type: 'TOGGLE_ADMIN_THEME' });
                addToast('success', `Theme switched to ${state.adminTheme === 'light' ? 'Dark' : 'Light'}!`);
              }}
              className="btn btn-secondary btn-sm"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {state.adminTheme === 'light' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Outlet Settings</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configure details and services for your restaurant outlet</p>
        </div>
      )}

      {/* Outlet Settings */}
      {isOnlyOutlet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          
          {/* Sub-sections grid - horizontally styled at the top */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 10,
            marginBottom: 20
          }}>
            {[
              { id: 'delivery', label: 'Home Delivery', icon: '🏠' },
              { id: 'upi', label: 'UPI ID & QR Code', icon: '💳' },
              { id: 'customization', label: 'Additional Customization', icon: '🎨' },
              { id: 'info', label: 'Outlet Information', icon: 'ℹ️' },
              { id: 'logo_image', label: 'Logo & Image', icon: '🖼️' },
            ].map(sub => {
              const isActive = outletSubSection === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setOutletSubSection(sub.id as any)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 8px',
                    gap: 8,
                    background: isActive ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    border: isActive ? '2px solid var(--brand)' : '1px solid var(--border)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                    boxShadow: isActive ? 'var(--shadow-brand)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{sub.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: isActive ? 800 : 600, textAlign: 'center' }}>{sub.label}</span>
                </button>
              );
            })}
          </div>

          <div>

              {/* 1. Home Delivery Sub-section */}
              {outletSubSection === 'delivery' && (
                <div className="card" style={{ padding: '16px', animation: 'fadeIn 0.2s ease' }}>
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🏠 Home Delivery Configuration
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Enable Home Delivery</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Allow customers to order for home delivery from the app</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRestaurantForm(prev => ({ ...prev, deliveryEnabled: !prev.deliveryEnabled }))}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: restaurantForm.deliveryEnabled ? 'var(--brand)' : 'var(--border)',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3, left: restaurantForm.deliveryEnabled ? 22 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </div>

                    {restaurantForm.deliveryEnabled && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                          <div className="input-group">
                            <label className="input-label">Delivery Radius (KM)</label>
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={100}
                              value={restaurantForm.deliveryRadius || 10}
                              onChange={e => setRestaurantForm({ ...restaurantForm, deliveryRadius: parseFloat(e.target.value) || 0 })}
                            />
                          </div>

                          <div className="input-group">
                            <label className="input-label">Standard Delivery Charge (₹)</label>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              value={restaurantForm.deliveryCharge !== undefined ? restaurantForm.deliveryCharge : 40}
                              onChange={e => setRestaurantForm({ ...restaurantForm, deliveryCharge: parseFloat(e.target.value) || 0 })}
                              placeholder="e.g. 40"
                            />
                          </div>
                        </div>

                        <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 10 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>Free Delivery Criteria</h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="input-group">
                              <label className="input-label" style={{ fontSize: 11 }}>Free Delivery Distance Limit (KM)</label>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                value={restaurantForm.freeDeliveryDistance || ''}
                                onChange={e => setRestaurantForm({ ...restaurantForm, freeDeliveryDistance: parseFloat(e.target.value) || 0 })}
                                placeholder="e.g. 5"
                              />
                            </div>
                            
                            <div className="input-group">
                              <label className="input-label" style={{ fontSize: 11 }}>Free Delivery Min Order Amount (₹)</label>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                value={restaurantForm.freeDeliveryMinAmount || ''}
                                onChange={e => setRestaurantForm({ ...restaurantForm, freeDeliveryMinAmount: parseFloat(e.target.value) || 0 })}
                                placeholder="e.g. 500"
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Enable Free Delivery by Distance</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Waive fee if customer is within the distance limit</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setRestaurantForm(prev => ({ ...prev, freeDeliveryDistanceEnabled: prev.freeDeliveryDistanceEnabled !== undefined ? !prev.freeDeliveryDistanceEnabled : false }))}
                                style={{
                                  width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                                  background: (restaurantForm.freeDeliveryDistanceEnabled ?? true) ? 'var(--brand)' : 'var(--border)',
                                  position: 'relative', transition: 'background 0.2s', flexShrink: 0
                                }}
                              >
                                <div style={{
                                  position: 'absolute', top: 2, left: (restaurantForm.freeDeliveryDistanceEnabled ?? true) ? 20 : 2,
                                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }} />
                              </button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Enable Free Delivery by Min Amount</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Waive fee if order subtotal exceeds the minimum amount</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setRestaurantForm(prev => ({ ...prev, freeDeliveryMinAmountEnabled: prev.freeDeliveryMinAmountEnabled !== undefined ? !prev.freeDeliveryMinAmountEnabled : false }))}
                                style={{
                                  width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                                  background: (restaurantForm.freeDeliveryMinAmountEnabled ?? true) ? 'var(--brand)' : 'var(--border)',
                                  position: 'relative', transition: 'background 0.2s', flexShrink: 0
                                }}
                              >
                                <div style={{
                                  position: 'absolute', top: 2, left: (restaurantForm.freeDeliveryMinAmountEnabled ?? true) ? 20 : 2,
                                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <button className="btn btn-primary btn-full" onClick={handleSaveRestaurant} style={{ marginTop: 8 }}>
                      <Save size={15} /> Save Delivery Settings
                    </button>
                  </div>
                </div>
              )}

              {/* 2. UPI ID & QR Code Sub-section */}
              {outletSubSection === 'upi' && (
                <div className="card" style={{ padding: '16px', animation: 'fadeIn 0.2s ease' }}>
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    💳 UPI ID & QR Code Settings
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="input-group">
                      <label className="input-label">UPI ID</label>
                      <div className="input-icon-wrap">
                        <span style={{ fontSize: 13, marginRight: 6, marginLeft: 10, color: 'var(--text-muted)' }}>@</span>
                        <input className="input" type="text" placeholder="e.g. restaurant@upi"
                          value={restaurantForm.upiId || ''}
                          onChange={e => setRestaurantForm({ ...restaurantForm, upiId: e.target.value })} />
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="input-label">UPI QR Code Image</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type="file"
                            id="upi-qr-upload-input"
                            accept="image/*"
                            onChange={handleUpiQrUpload}
                            style={{ display: 'none' }}
                          />
                          <label
                            htmlFor="upi-qr-upload-input"
                            className="btn btn-secondary btn-full"
                            style={{
                              height: 38,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              borderRadius: 10,
                              fontSize: 12
                            }}
                          >
                            {uploadingUpiQr ? 'Uploading...' : '📁 Upload QR Code Image'}
                          </label>
                        </div>
                      </div>
                    </div>

                    {restaurantForm.upiQrCode && (
                      <div style={{ marginTop: 10, marginBottom: 14, textAlign: 'center' }}>
                        <label className="input-label" style={{ textAlign: 'left', display: 'block', marginBottom: 6 }}>QR Code Preview</label>
                        <div style={{
                          margin: '0 auto',
                          width: 150,
                          height: 150,
                          borderRadius: 8,
                          border: '2px solid var(--brand)',
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 6
                        }}>
                          <img src={restaurantForm.upiQrCode} alt="UPI QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <button
                          onClick={() => setRestaurantForm(prev => ({ ...prev, upiQrCode: undefined }))}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--error)', marginTop: 8, fontSize: 11 }}
                        >
                          Remove QR Code
                        </button>
                      </div>
                    )}

                    <button className="btn btn-primary btn-full" onClick={handleSaveRestaurant} style={{ marginTop: 8 }}>
                      <Save size={15} /> Save UPI Settings
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Additional Customization Sub-section */}
              {outletSubSection === 'customization' && (
                <div className="card" style={{ padding: '16px', animation: 'fadeIn 0.2s ease' }}>
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 16, fontWeight: 800 }}>🎨 Additional Customization</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Customer Must Login */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Customer Must Login</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Force sign in before checking out</div>
                      </div>
                      <div 
                        className={`toggle ${restaurantForm.mustLoginBeforeOrder ? 'on' : ''}`}
                        onClick={() => setRestaurantForm(prev => ({ ...prev, mustLoginBeforeOrder: !prev.mustLoginBeforeOrder }))}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="toggle-thumb" />
                      </div>
                    </div>

                    {/* Overlay Logo on Meals */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Overlay Logo on Meals</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Show restaurant logo watermark overlay on meal photos</div>
                      </div>
                      <div 
                        className={`toggle ${restaurantForm.overlayLogoOnMeals ? 'on' : ''}`}
                        onClick={() => setRestaurantForm(prev => ({ ...prev, overlayLogoOnMeals: !prev.overlayLogoOnMeals }))}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="toggle-thumb" />
                      </div>
                    </div>

                    {/* Live Location Verification */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Live Location Verification</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Customers must be at coordinates to place order</div>
                      </div>
                      <div 
                        className={`toggle ${restaurantForm.locationVerificationEnabled ? 'on' : ''}`}
                        onClick={() => setRestaurantForm(prev => ({ ...prev, locationVerificationEnabled: !prev.locationVerificationEnabled }))}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="toggle-thumb" />
                      </div>
                    </div>

                    {restaurantForm.locationVerificationEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, borderLeft: '3px solid var(--brand)', paddingLeft: 12 }}>
                        <div className="input-group">
                          <label className="input-label">Google Maps Link</label>
                          <input
                            className="input"
                            type="text"
                            placeholder="Paste share link"
                            value={restaurantForm.googleMapsUrl || ''}
                            onChange={e => {
                              const url = e.target.value;
                              const parsed = parseCoordsFromGmaps(url);
                              if (parsed) {
                                setRestaurantForm(prev => ({
                                  ...prev,
                                  googleMapsUrl: url,
                                  latitude: parseFloat(parsed.lat.toFixed(6)),
                                  longitude: parseFloat(parsed.lng.toFixed(6)),
                                }));
                                addToast('success', 'Coordinates auto-extracted!');
                              } else {
                                setRestaurantForm(prev => ({ ...prev, googleMapsUrl: url }));
                              }
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                          <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Latitude</label>
                            <input
                              className="input"
                              type="number"
                              step="any"
                              value={restaurantForm.latitude ?? ''}
                              onChange={e => setRestaurantForm({ ...restaurantForm, latitude: parseFloat(e.target.value) || undefined })}
                            />
                          </div>
                          <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Longitude</label>
                            <input
                              className="input"
                              type="number"
                              step="any"
                              value={restaurantForm.longitude ?? ''}
                              onChange={e => setRestaurantForm({ ...restaurantForm, longitude: parseFloat(e.target.value) || undefined })}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCaptureCurrentLocation}
                            disabled={capturingLocation}
                            style={{ height: 38, padding: '0 12px' }}
                          >
                            {capturingLocation ? '...' : 'GPS'}
                          </button>
                        </div>

                        <div className="input-group">
                          <label className="input-label">Allowed Perimeter Radius (meters)</label>
                          <input
                            className="input"
                            type="number"
                            value={restaurantForm.verificationRadius ?? 50}
                            onChange={e => setRestaurantForm({ ...restaurantForm, verificationRadius: parseInt(e.target.value) || undefined })}
                          />
                        </div>
                      </div>
                    )}

                    <button className="btn btn-primary btn-full" onClick={handleSaveRestaurant} style={{ marginTop: 8 }}>
                      <Save size={15} /> Save Customization
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Outlet Information Sub-section */}
              {outletSubSection === 'info' && (
                <div className="card" style={{ padding: '16px', animation: 'fadeIn 0.2s ease' }}>
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 16, fontWeight: 800 }}>ℹ️ Outlet Information</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="input-group">
                      <label className="input-label">Restaurant Name</label>
                      <div className="input-icon-wrap">
                        <Store size={15} className="input-icon" />
                        <input className="input" type="text" value={restaurantForm.name}
                          onChange={e => setRestaurantForm({ ...restaurantForm, name: e.target.value })} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">Opens At</label>
                        <input className="input" type="time" value={restaurantForm.openTime}
                          onChange={e => setRestaurantForm({ ...restaurantForm, openTime: e.target.value })} />
                      </div>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">Closes At</label>
                        <input className="input" type="time" value={restaurantForm.closeTime}
                          onChange={e => setRestaurantForm({ ...restaurantForm, closeTime: e.target.value })} />
                      </div>
                    </div>

                    {/* Day-Specific Hours */}
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', marginBottom: 6, textTransform: 'uppercase' }}>Custom Daily Hours</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                          const customHours = (restaurantForm as any).daySpecificHours?.[day] || { openTime: '', closeTime: '', closed: false };
                          const isEnabled = !!((restaurantForm as any).daySpecificHours?.[day]);
                          
                          return (
                            <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                              <label style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={e => {
                                    const newHours = { ...(restaurantForm as any).daySpecificHours };
                                    if (e.target.checked) {
                                      newHours[day] = { openTime: restaurantForm.openTime || '11:00', closeTime: restaurantForm.closeTime || '22:00', closed: false };
                                    } else {
                                      delete newHours[day];
                                    }
                                    setRestaurantForm({ ...restaurantForm, daySpecificHours: newHours });
                                  }}
                                  style={{ accentColor: 'var(--brand)' }}
                                />
                                {day}
                              </label>
                              {isEnabled && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="time"
                                    value={customHours.openTime}
                                    onChange={e => {
                                      const newHours = { ...(restaurantForm as any).daySpecificHours };
                                      newHours[day] = { ...customHours, openTime: e.target.value };
                                      setRestaurantForm({ ...restaurantForm, daySpecificHours: newHours });
                                    }}
                                    style={{ height: 26, fontSize: 11, padding: '2px 4px' }}
                                  />
                                  <span>–</span>
                                  <input
                                    type="time"
                                    value={customHours.closeTime}
                                    onChange={e => {
                                      const newHours = { ...(restaurantForm as any).daySpecificHours };
                                      newHours[day] = { ...customHours, closeTime: e.target.value };
                                      setRestaurantForm({ ...restaurantForm, daySpecificHours: newHours });
                                    }}
                                    style={{ height: 26, fontSize: 11, padding: '2px 4px' }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Address</label>
                      <input className="input" type="text" value={restaurantForm.address}
                        onChange={e => setRestaurantForm({ ...restaurantForm, address: e.target.value })} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Phone Number</label>
                      <input className="input" type="tel" value={restaurantForm.phone}
                        onChange={e => setRestaurantForm({ ...restaurantForm, phone: e.target.value })} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Email</label>
                      <input className="input" type="email" value={restaurantForm.email}
                        onChange={e => setRestaurantForm({ ...restaurantForm, email: e.target.value })} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">FSSAI License Number</label>
                      <input className="input" type="text" value={restaurantForm.fssai || ''}
                        onChange={e => setRestaurantForm({ ...restaurantForm, fssai: e.target.value })} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">GST Number</label>
                      <input className="input" type="text" value={restaurantForm.gst || ''}
                        onChange={e => setRestaurantForm({ ...restaurantForm, gst: e.target.value })} />
                    </div>

                    {/* Outlet Location & GPS Coordinates */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginTop: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        📍 Outlet Location &amp; Map Coordinates
                      </div>
                      
                      <div className="input-group" style={{ marginBottom: 10 }}>
                        <label className="input-label">Google Maps Link (Paste share link to auto-extract GPS)</label>
                        <input
                          className="input"
                          type="text"
                          placeholder="e.g. https://maps.app.goo.gl/..."
                          value={restaurantForm.googleMapsUrl || ''}
                          onChange={e => {
                            const url = e.target.value;
                            const parsed = parseCoordsFromGmaps(url);
                            if (parsed) {
                              setRestaurantForm(prev => ({
                                ...prev,
                                googleMapsUrl: url,
                                latitude: parseFloat(parsed.lat.toFixed(6)),
                                longitude: parseFloat(parsed.lng.toFixed(6)),
                              }));
                              addToast('success', '✨ Coordinates auto-extracted from Google Maps link!');
                            } else {
                              setRestaurantForm(prev => ({ ...prev, googleMapsUrl: url }));
                            }
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label className="input-label">Latitude</label>
                          <input
                            className="input"
                            type="number"
                            step="any"
                            placeholder="e.g. 12.9348"
                            value={restaurantForm.latitude ?? ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, latitude: parseFloat(e.target.value) || undefined })}
                          />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label className="input-label">Longitude</label>
                          <input
                            className="input"
                            type="number"
                            step="any"
                            placeholder="e.g. 77.6202"
                            value={restaurantForm.longitude ?? ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, longitude: parseFloat(e.target.value) || undefined })}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleCaptureCurrentLocation}
                          disabled={capturingLocation}
                          style={{ height: 38, padding: '0 12px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {capturingLocation ? '🔄 GPS...' : '📡 Capture GPS'}
                        </button>
                      </div>

                      <div className="input-group" style={{ marginTop: 10 }}>
                        <label className="input-label">In-Dining &amp; Takeaway Order Radius (meters)</label>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          placeholder="e.g. 100"
                          value={restaurantForm.verificationRadius ?? restaurantForm.indiningRadius ?? 100}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setRestaurantForm({
                              ...restaurantForm,
                              verificationRadius: val,
                              indiningRadius: val,
                              takeawayRadius: val,
                            });
                          }}
                        />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                          Maximum allowed distance in meters from outlet location to place In-Dining or Takeaway orders.
                        </div>
                      </div>
                    </div>

                    <button className="btn btn-primary btn-full" onClick={handleSaveRestaurant} style={{ marginTop: 8 }}>
                      <Save size={15} /> Save Info Details
                    </button>
                  </div>
                </div>
              )}

              {/* 5. Logo & Image Sub-section */}
              {outletSubSection === 'logo_image' && (
                <div className="card" style={{ padding: '16px', animation: 'fadeIn 0.2s ease' }}>
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 16, fontWeight: 800 }}>🖼️ Logo & Image Settings</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Logo */}
                    <div className="input-group">
                      <label className="input-label">Restaurant Logo</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="file"
                          id="logo-upload-input"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="logo-upload-input" className="btn btn-secondary btn-full" style={{ height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>
                          {uploadingLogo ? 'Uploading...' : '📁 Upload Restaurant Logo'}
                        </label>
                      </div>
                    </div>

                    {restaurantForm.logo && (
                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <img src={restaurantForm.logo} alt="Logo" style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid var(--brand)', objectFit: 'cover' }} />
                      </div>
                    )}

                    {/* Profile Photo */}
                    <div className="input-group">
                      <label className="input-label">Restaurant Poster Image (Visible in browsing list)</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="file"
                          id="poster-upload-input"
                          accept="image/*"
                          onChange={handlePosterUpload}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="poster-upload-input" className="btn btn-secondary btn-full" style={{ height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>
                          {uploadingPoster ? 'Uploading...' : '📁 Upload Poster Image'}
                        </label>
                      </div>
                    </div>

                    {restaurantForm.posterImage && (
                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <img src={restaurantForm.posterImage} alt="Poster" style={{ width: 120, height: 120, borderRadius: 12, border: '2px solid var(--brand)', objectFit: 'cover' }} />
                      </div>
                    )}

                    <button className="btn btn-primary btn-full" onClick={handleSaveRestaurant} style={{ marginTop: 8 }}>
                      <Save size={15} /> Save Logo & Poster
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Autoprint KOT/Bill Settings */}
      {!isOnlyOutlet && activeSection === 'autoprint' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Printer size={18} color="var(--brand)" />
            <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>Autoprint KOT & Bill Settings</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Print Method Selector ── */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>🖨️ Print Method</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Choose how receipts are printed</div>
              </div>
              <div style={{ display: 'flex', gap: 0 }}>
                {[
                  { id: 'browser', label: '🌐 Browser Print', desc: 'Opens a print dialog. Works on all devices.' },
                  { id: 'bluetooth', label: '📡 Bluetooth Direct', desc: 'Sends ESC/POS directly. Needs Chrome on Android/Desktop.' }
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setRestaurantForm(prev => ({ ...prev, printMethod: method.id as 'browser' | 'bluetooth' }))}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      background: (restaurantForm.printMethod || 'browser') === method.id ? 'rgba(var(--brand-rgb, 0,0,0), 0.12)' : 'transparent',
                      border: 'none',
                      borderRight: method.id === 'browser' ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left' as const,
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: (restaurantForm.printMethod || 'browser') === method.id ? 'var(--brand)' : 'var(--text-primary)' }}>{method.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{method.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Bluetooth Pairing Panel (only when bluetooth mode selected) ── */}
            {(restaurantForm.printMethod || 'browser') === 'bluetooth' && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, border: `1px solid ${btConnected ? '#22c55e' : 'var(--border)'}`, padding: 14, transition: 'border-color 0.3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: btConnected ? '#22c55e' : '#ef4444', display: 'inline-block', boxShadow: btConnected ? '0 0 6px #22c55e' : '0 0 6px #ef4444' }} />
                      {btConnected ? `Connected: ${btPrinterName || 'Printer'}` : 'No Bluetooth Printer Connected'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {btConnected ? 'Printer is ready. You can test print or disconnect.' : 'Tap "Pair Printer" and select your thermal printer from the list.'}
                    </div>
                  </div>
                  {btConnected ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await disconnectBluetoothPrinter();
                        setBtConnected(false);
                        setBtPrinterName('');
                        setBtError('');
                        setRestaurantForm(prev => ({ ...prev, bluetoothPrinterName: '' }));
                      }}
                      style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={btConnecting}
                      onClick={async () => {
                        setBtError('');
                        setBtConnecting(true);
                        const result = await connectBluetoothPrinter();
                        setBtConnecting(false);
                        if (result.success) {
                          setBtConnected(true);
                          setBtPrinterName(result.name || 'Printer');
                          setRestaurantForm(prev => ({ ...prev, bluetoothPrinterName: result.name || 'Printer' }));
                        } else {
                          setBtError(result.error || 'Connection failed');
                        }
                      }}
                      style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, borderRadius: 8, background: btConnecting ? 'var(--bg-primary)' : 'var(--brand)', color: btConnecting ? 'var(--text-muted)' : '#000', border: 'none', cursor: btConnecting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const, minWidth: 90 }}
                    >
                      {btConnecting ? '🔄 Pairing...' : '📡 Pair Printer'}
                    </button>
                  )}
                </div>
                {btError && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#ef4444', lineHeight: 1.4 }}>
                    ⚠️ {btError}
                  </div>
                )}
                {!btConnected && !btError && (
                  <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#60a5fa', lineHeight: 1.5 }}>
                    <strong>Requirements:</strong> Use <strong>Google Chrome</strong> on Android or Desktop. Enable Bluetooth on your phone/tablet. Pair the printer with your device first via system Bluetooth settings, then tap "Pair Printer" here.
                  </div>
                )}
              </div>
            )}

            {/* ── Toggles: KOT & Bill ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Autoprint Kitchen Order Ticket (KOT)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Automatically print KOT when customer places a new order</div>
              </div>
              <div 
                className={`toggle ${restaurantForm.autoprintKotEnabled ? 'on' : ''}`}
                onClick={() => setRestaurantForm(prev => ({ ...prev, autoprintKotEnabled: !prev.autoprintKotEnabled }))}
                style={{ cursor: 'pointer' }}
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Autoprint Bill / Receipt</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Automatically print bill when admin confirms payment</div>
              </div>
              <div 
                className={`toggle ${restaurantForm.autoprintBillEnabled ? 'on' : ''}`}
                onClick={() => setRestaurantForm(prev => ({ ...prev, autoprintBillEnabled: !prev.autoprintBillEnabled }))}
                style={{ cursor: 'pointer' }}
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Ringing Pop-up Notification</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Show a Swiggy/Zomato-style ringing popup for new orders</div>
              </div>
              <div 
                className={`toggle ${restaurantForm.orderPopupEnabled !== false ? 'on' : ''}`}
                onClick={() => setRestaurantForm(prev => ({ ...prev, orderPopupEnabled: restaurantForm.orderPopupEnabled === false ? true : false }))}
                style={{ cursor: 'pointer' }}
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            {/* ── Connection Instructions (collapsible) ── */}
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', padding: 12 }}>
              <button 
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                style={{ 
                  width: '100%', background: 'none', border: 'none', display: 'flex', 
                  justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13, color: 'var(--brand)', padding: 0
                }}
              >
                <span>📋 How to Connect & Use Your Printer</span>
                <span style={{ fontSize: 10 }}>{showInstructions ? '▲' : '▼'}</span>
              </button>

              {showInstructions && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }} className="hide-scrollbar">
                    {[
                      { id: 'android', label: '🤖 Android (BT)' },
                      { id: 'ios', label: '🍎 iPhone/iPad' },
                      { id: 'windows', label: '🪟 Windows' },
                      { id: 'mac', label: '🍏 Mac' },
                      { id: 'pos', label: '🖥️ POS Terminal' }
                    ].map(dev => (
                      <button
                        key={dev.id}
                        type="button"
                        onClick={() => setSelectedInstructionDevice(dev.id as any)}
                        style={{
                          padding: '5px 10px',
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 8,
                          background: selectedInstructionDevice === dev.id ? 'var(--brand)' : 'var(--bg-primary)',
                          color: selectedInstructionDevice === dev.id ? '#000' : 'var(--text-primary)',
                          border: selectedInstructionDevice === dev.id ? 'none' : '1px solid var(--border)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {dev.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {selectedInstructionDevice === 'android' && (
                      <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <li><strong>Step 1 — Pair via System Settings:</strong> Go to phone's <em>Settings → Bluetooth</em>. Turn on Bluetooth. Select your thermal printer (e.g., <em>MTP-II</em>, <em>PT-210</em>, <em>RPP02N</em>) from the list. Enter PIN <code>0000</code> or <code>1234</code> if prompted. Wait for "Paired" status.</li>
                        <li><strong>Step 2 — Open Meenufy in Chrome:</strong> Use <strong>Google Chrome</strong> (NOT Samsung Browser or Firefox). Chrome is the only browser that supports Web Bluetooth on Android.</li>
                        <li><strong>Step 3 — Select Bluetooth Print Method:</strong> In this settings panel, tap <em>Bluetooth Direct</em> as the Print Method above.</li>
                        <li><strong>Step 4 — Tap "Pair Printer":</strong> Tap the <em>📡 Pair Printer</em> button above. Chrome will show a list of nearby Bluetooth devices. Select your printer from the list.</li>
                        <li><strong>Step 5 — Enable Autoprint Toggles:</strong> Turn on <em>Autoprint KOT</em> and/or <em>Autoprint Bill</em> toggles above and tap <em>Save Printer Preferences</em>.</li>
                        <li><strong>Step 6 — Keep Chrome Open:</strong> The Admin page must remain open on your phone/tablet while receiving orders. Receipts will print automatically! ✅</li>
                      </ol>
                    )}
                    {selectedInstructionDevice === 'ios' && (
                      <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li><strong>Web Bluetooth is NOT supported on iOS Safari or Chrome.</strong> For Bluetooth printing on iPhone/iPad, you must use a third-party app bridge.</li>
                        <li>Alternative: Connect your thermal printer to <strong>Wi-Fi</strong> (if it supports it), then use the <em>Browser Print</em> method. The print dialog will let you select a Wi-Fi printer.</li>
                        <li>Best option for iOS: Use the <em>Browser Print</em> method and connect the printer via <strong>AirPrint</strong>-compatible Wi-Fi printers only.</li>
                      </ol>
                    )}
                    {selectedInstructionDevice === 'windows' && (
                      <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li>Connect printer to PC via USB or Bluetooth. Install the manufacturer's receipt printer driver.</li>
                        <li>Go to Control Panel → Devices & Printers. Right-click the printer → Printer Properties → Preferences. Set default size to <strong>58mm x Receipt</strong> or <strong>80mm x Receipt</strong>.</li>
                        <li>Use <em>Browser Print</em> method. When a print dialog opens, select your receipt printer as default.</li>
                        <li><strong>Silent printing (no dialog):</strong> Right-click Chrome shortcut → Properties → Target field, add <code>--kiosk-printing</code> at end. Reopen Chrome → it will now print silently!</li>
                      </ol>
                    )}
                    {selectedInstructionDevice === 'mac' && (
                      <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li>Connect USB thermal printer. Go to System Settings → Printers & Scanners → Add Printer. Choose driver <strong>Generic PostScript</strong> or install CUPS driver.</li>
                        <li>Use <em>Browser Print</em> method. Safari/Chrome will invoke the print dialog on order updates.</li>
                        <li>For Bluetooth on Mac: Pair the printer via System Settings → Bluetooth, then select it in the print dialog.</li>
                      </ol>
                    )}
                    {selectedInstructionDevice === 'pos' && (
                      <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li>For Android POS machines (e.g. Sunmi, Epson, Castles), the printer is connected internally.</li>
                        <li>Go to Settings → Printing → select <strong>InnerPrinter</strong> (or local POS print service) as default.</li>
                        <li>Use <em>Browser Print</em> method. The browser print command will auto-route to the inner receipt slot.</li>
                      </ol>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Customization Details ── */}
            <div className="input-group">
              <label className="input-label">Tax Percentage (%)</label>
              <input className="input" type="number" step="0.01" min={0} max={100} value={restaurantForm.taxPercentage ?? 5}
                onChange={e => setRestaurantForm({ ...restaurantForm, taxPercentage: parseFloat(e.target.value) || 0 })} />
            </div>

            <div className="input-group">
              <label className="input-label">Printer Paper Width</label>
              <select className="input" value={restaurantForm.printWidth || '80mm'}
                onChange={e => setRestaurantForm({ ...restaurantForm, printWidth: e.target.value as '58mm' | '80mm' })}>
                <option value="58mm">58mm (Standard Small Thermal)</option>
                <option value="80mm">80mm (Standard Large Thermal)</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Receipt Header Message</label>
              <input className="input" type="text" value={restaurantForm.printHeaderMessage || ''}
                placeholder="e.g. Welcome to our restaurant!"
                onChange={e => setRestaurantForm({ ...restaurantForm, printHeaderMessage: e.target.value })} />
            </div>

            <div className="input-group">
              <label className="input-label">Receipt Footer Message</label>
              <input className="input" type="text" value={restaurantForm.printFooterMessage || ''}
                placeholder="e.g. Thank you for dining with us! Visit again."
                onChange={e => setRestaurantForm({ ...restaurantForm, printFooterMessage: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 16, background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setRestaurantForm(prev => ({ ...prev, printShowDateTime: prev.printShowDateTime !== false ? false : true }))}>
                <input 
                  type="checkbox" 
                  checked={restaurantForm.printShowDateTime !== false}
                  readOnly
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Show Date &amp; Time</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setRestaurantForm(prev => ({ ...prev, printShowOrderNumber: prev.printShowOrderNumber !== false ? false : true }))}>
                <input 
                  type="checkbox" 
                  checked={restaurantForm.printShowOrderNumber !== false}
                  readOnly
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Show Order Number</span>
              </div>
            </div>

            {/* ── Test Print Actions ── */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: 12, height: 38, fontWeight: 700 }}
                onClick={() => {
                  const mockOrder = {
                    id: 'mock-order-1234',
                    tableNumber: 3,
                    tableId: 'table-3',
                    customerName: 'Test Customer',
                    customerPhone: '9876543210',
                    items: [
                      { id: 'item-1', menuItemId: 'item-1', name: 'Paneer Tikka', price: 250, qty: 2, variant: { name: 'Full', price: 250 } },
                      { id: 'item-2', menuItemId: 'item-2', name: 'Butter Naan', price: 40, qty: 3 }
                    ],
                    totalAmount: 620,
                    status: 'pending' as const,
                    paymentStatus: 'pending' as const,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    specialNote: 'Make it spicy'
                  };
                  printThermalReceipt(mockOrder, 'kot', restaurantForm).then(r => {
                    if (r.error) addToast('info', r.error);
                    else addToast('success', '🖨️ Test KOT sent to printer!');
                  });
                }}
              >
                🖨️ Test Print KOT
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: 12, height: 38, fontWeight: 700 }}
                onClick={() => {
                  const mockOrder = {
                    id: 'mock-order-1234',
                    tableNumber: 3,
                    tableId: 'table-3',
                    customerName: 'Test Customer',
                    customerPhone: '9876543210',
                    items: [
                      { id: 'item-1', menuItemId: 'item-1', name: 'Paneer Tikka', price: 250, qty: 2, variant: { name: 'Full', price: 250 } },
                      { id: 'item-2', menuItemId: 'item-2', name: 'Butter Naan', price: 40, qty: 3 }
                    ],
                    totalAmount: 620,
                    status: 'served' as const,
                    paymentStatus: 'paid' as const,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    specialNote: 'Make it spicy'
                  };
                  printThermalReceipt(mockOrder, 'bill', restaurantForm).then(r => {
                    if (r.error) addToast('info', r.error);
                    else addToast('success', '🖨️ Test Bill sent to printer!');
                  });
                }}
              >
                🖨️ Test Print Bill
              </button>
            </div>

            {/* ── Save Button ── */}
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSaveRestaurant}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, height: 40, fontWeight: 700 }}
            >
              <Save size={16} /> Save Printer Preferences
            </button>
          </div>
        </div>
      )}

      {/* Manage Tables & QR Codes */}
      {!isOnlyOutlet && activeSection === 'qr' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode size={18} color="var(--brand)" />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Manage QR &amp; Tables</h3>
            </div>
          </div>

          {/* RESTAURANT MENU QR CODE (FOR FLYERS & SOCIAL MEDIA) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(234, 88, 12, 0.01) 100%)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 2px 8px rgba(249,115,22,0.03)'
          }}>
            <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c' }}>
                <span style={{ fontSize: 16 }}>📱</span>
                <h4 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Restaurant Menu QR Code</h4>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                <strong>Flyer & Social Media QR:</strong> Allow customers to browse and order directly from their phone. Perfect for pamphlets, banners, and social media flyers.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <a
                  href={`${window.location.origin}/?restaurant=${state.admin?.restaurantId || 'admin-1'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 10, height: 26, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <ExternalLink size={11} /> Live Preview
                </a>
                <button
                  onClick={() => {
                    const canvas = viewOnlyQRRef.current;
                    if (canvas) {
                      const link = document.createElement('a');
                      link.download = `${state.restaurant.name || 'restaurant'}_Menu_QR.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                    }
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: 10, height: 26, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#ea580c', color: '#fff', border: 'none', fontWeight: 800 }}
                >
                  📥 Download
                </button>
              </div>
            </div>
            
            <div style={{ background: '#ffffff', padding: 8, borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
              <canvas ref={viewOnlyQRRef} style={{ borderRadius: 4, display: 'block', width: 90, height: 90 }} />
            </div>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20 }}></div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: 100 }}>
              <label className="input-label">Number of Tables</label>
              <input
                className="input"
                type="number"
                min={1} max={50}
                value={tableCount}
                onChange={e => setTableCount(parseInt(e.target.value) || 1)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-primary" onClick={handleGenerateTables}>
                <QrCode size={15} /> Generate
              </button>
              <button className="btn btn-secondary" onClick={downloadAllQRs} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                📥 Download All
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Scan or share these QR codes at each table. Customers scan to order.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 12,
            }}>
              {state.tables.map(table => (
                <div key={table.id} style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 12, padding: 12, textAlign: 'center',
                  border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <canvas ref={el => { qrRefs.current[table.id] = el; }} style={{ borderRadius: 8, maxWidth: '100%', height: 'auto' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{table.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Capacity: {table.capacity}</div>
                  {/* Table status toggle */}
                  <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                    <button
                      onClick={() => dispatch({ type: 'UPDATE_TABLE_STATUS', payload: { id: table.id, status: 'active' } })}
                      style={{
                        flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 0',
                        borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: (table.status ?? 'active') === 'active' ? '#22c55e' : 'var(--bg-primary)',
                        color: (table.status ?? 'active') === 'active' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >Active</button>
                    <button
                      onClick={() => dispatch({ type: 'UPDATE_TABLE_STATUS', payload: { id: table.id, status: 'maintenance' } })}
                      style={{
                        flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 0',
                        borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: table.status === 'maintenance' ? '#eab308' : 'var(--bg-primary)',
                        color: table.status === 'maintenance' ? '#000' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >Maint.</button>
                  </div>
                  <a
                    href={getQRUrl(table.id, state.admin?.restaurantId || 'admin-1')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '5px 10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <ExternalLink size={11} /> Preview
                  </a>
                  <button
                    onClick={() => downloadQR(table.id, table.label)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '5px 10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4, fontWeight: 700 }}
                  >
                    📥 Download QR
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pricing & Subscription Plans */}
      {!isOnlyOutlet && activeSection === 'subscription' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CreditCard size={18} color="var(--brand)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Pricing &amp; Subscription</h3>
          </div>
          {(() => {
            const now = Date.now();
            let renewalDate = state.subscriptionRenewalDate || 0;
            if (state.subscriptionPlan === 'free') {
              const matchedAcc = state.restaurantAccounts?.find(a => a.id === state.admin?.id);
              const cAt = state.restaurant?.createdAt || matchedAcc?.createdAt || Date.now();
              renewalDate = cAt + 29 * 24 * 60 * 60 * 1000;
            }
            
            // Check if expired
            const isExpired = now > renewalDate;

            const cardBg = isExpired 
              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' 
              : 'linear-gradient(135deg, var(--brand) 0%, #e06000 100%)';
            const cardShadow = isExpired
              ? '0 8px 24px rgba(239, 68, 68, 0.25)'
              : '0 8px 24px rgba(255, 125, 0, 0.2)';
            
            const statusLabel = isExpired
              ? (state.subscriptionPlan === 'free' ? '⚠️ Free Trial Expired / Inactive' : '⚠️ Payment Pending / Expired')
              : 'Current Active Plan';

            const planNameFormatted = state.subscriptionPlan === 'standard' || state.subscriptionPlan === 'advance' 
              ? 'Advance' 
              : state.subscriptionPlan === 'base'
                ? 'Standard'
                : 'Free Trial';

            const renewalFormatted = isExpired
              ? 'Expired / Unpaid'
              : new Date(renewalDate).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });

            return (
              <>
                <div style={{
                  background: cardBg,
                  borderRadius: 12,
                  padding: '20px',
                  color: '#ffffff',
                  boxShadow: cardShadow,
                  marginBottom: 20,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    right: '-10px',
                    bottom: '-20px',
                    fontSize: '100px',
                    opacity: 0.1,
                    pointerEvents: 'none'
                  }}>⭐️</div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ffffff', fontWeight: 700 }}>
                    {statusLabel}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4, fontFamily: 'var(--font-display)', textTransform: 'capitalize', color: '#ffffff' }}>
                    {planNameFormatted} Plan
                  </div>

                  {/* Active Services */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Active Services
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                      {isExpired ? (
                        '❌ Services Suspended — Complete payment below to activate.'
                      ) : (
                        <>
                          {state.subscriptionPlan === 'free' && '🎁 30-Day Free Trial — All Features Unlocked'}
                          {state.subscriptionPlan === 'base' && (state.restaurant?.basePlanSelectedType || 'dining_takeaway') === 'dining_takeaway' && '🍽️ In-Dining & Takeaway Only'}
                          {state.subscriptionPlan === 'base' && (state.restaurant?.basePlanSelectedType || 'dining_takeaway') === 'delivery_only' && '🛵 Home Delivery Only'}
                          {(state.subscriptionPlan === 'standard' || state.subscriptionPlan === 'advance') && '✅ In-Dining, Takeaway & Home Delivery'}
                        </>
                      )}
                    </div>
                    {/* Inline service mode switcher for Basic plan */}
                    {!isExpired && state.subscriptionPlan === 'base' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { ref, update } = await import('firebase/database');
                              const rId = state.admin?.restaurantId || 'admin-1';
                              await update(ref(db!, `restaurants/${rId}`), { basePlanSelectedType: 'dining_takeaway' });
                              await update(ref(db!, `restaurantAccounts/${rId}`), { basePlanSelectedType: 'dining_takeaway' });
                              addToast('success', '✅ Switched to In-Dining & Takeaway.');
                            } catch (err) { console.error(err); }
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: 'none',
                            background: (state.restaurant?.basePlanSelectedType || 'dining_takeaway') === 'dining_takeaway' ? '#ffffff' : 'rgba(255,255,255,0.2)',
                            color: (state.restaurant?.basePlanSelectedType || 'dining_takeaway') === 'dining_takeaway' ? '#e06000' : '#ffffff',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🍽️ In-Dining & Takeaway
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { ref, update } = await import('firebase/database');
                              const rId = state.admin?.restaurantId || 'admin-1';
                              await update(ref(db!, `restaurants/${rId}`), { basePlanSelectedType: 'delivery_only' });
                              await update(ref(db!, `restaurantAccounts/${rId}`), { basePlanSelectedType: 'delivery_only' });
                              addToast('success', '✅ Switched to Home Delivery Only.');
                            } catch (err) { console.error(err); }
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: 'none',
                            background: (state.restaurant?.basePlanSelectedType || 'dining_takeaway') === 'delivery_only' ? '#ffffff' : 'rgba(255,255,255,0.2)',
                            color: (state.restaurant?.basePlanSelectedType || 'dining_takeaway') === 'delivery_only' ? '#e06000' : '#ffffff',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🛵 Home Delivery
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 12 }}>
                    <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                      Billing Country: <strong style={{ color: '#ffffff', fontWeight: 800 }}>{state.billingCountry === 'IN' ? 'India (INR)' : 'Global (USD)'}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                      Billing Cycle: <strong style={{ color: '#ffffff', fontWeight: 800 }}>{state.billingPeriod === 'yearly' ? 'Yearly (15% Off)' : 'Monthly'}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                      {isExpired ? 'Status:' : (state.subscriptionPlan === 'free' ? 'Trial Ends:' : 'Renews:')} <strong style={{ color: '#ffffff', fontWeight: 800 }}>{renewalFormatted}</strong>
                    </span>
                  </div>

                  {state.subscriptionPlan !== 'free' && state.subscriptionId && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255, 255, 255, 0.25)',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace' }}>
                      ID: {state.subscriptionId}
                    </span>
                    <button
                      type="button"
                      disabled={cancellingSubscription}
                      onClick={handleCancelSubscription}
                      style={{
                        background: 'rgba(239, 68, 68, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 6,
                        color: '#ffcbcb',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        (e.currentTarget as any).style.background = 'rgba(239, 68, 68, 0.45)';
                        (e.currentTarget as any).style.color = '#ffffff';
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as any).style.background = 'rgba(239, 68, 68, 0.25)';
                        (e.currentTarget as any).style.color = '#ffcbcb';
                      }}
                    >
                      {cancellingSubscription ? 'Cancelling...' : 'Cancel Auto-Pay'}
                    </button>
                  </div>
                )}
              </div>
              

            </>
            );
          })()}


          {/* Upgrade Plan Section */}
          <div style={{ marginTop: 20 }}>
            <h4 id="upgrade-plan-section-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              Upgrade or Change Subscription
            </h4>

            {/* Monthly / Yearly Billing Toggle */}
            {state.billingCountry !== 'IN' && (
              <div style={{
                display: 'flex',
                background: 'var(--bg-elevated)',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                marginBottom: '16px',
                maxWidth: '280px'
              }}>
                <button
                  type="button"
                  onClick={() => setBillingPeriodToggle('monthly')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: billingPeriodToggle === 'monthly' ? 'var(--brand)' : 'transparent',
                    color: billingPeriodToggle === 'monthly' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriodToggle('yearly')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: billingPeriodToggle === 'yearly' ? 'var(--brand)' : 'transparent',
                    color: billingPeriodToggle === 'yearly' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  Yearly <span style={{
                    fontSize: '9px',
                    background: billingPeriodToggle === 'yearly' ? 'rgba(255,255,255,0.2)' : 'rgba(255,125,0,0.15)',
                    color: billingPeriodToggle === 'yearly' ? '#ffffff' : 'var(--brand)',
                    padding: '1px 4px',
                    borderRadius: '4px'
                  }}>Save 15%</span>
                </button>
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const isYearly = billingPeriodToggle === 'yearly';
                
                const plans = state.billingCountry === 'IN' ? [
                  { name: 'free', label: '30-Day Free Trial', price: 0, currency: '₹', desc: 'Try out all features free for 30 days', saving: 0 },
                  { name: 'base', label: 'Standard plan', price: isYearly ? 25000 : 2500, currency: '₹', desc: 'Choose EITHER In-Dining & Takeaway OR Home Delivery Only', saving: 5000 },
                  { name: 'standard', label: 'Advance Plan', price: isYearly ? 40000 : 4000, currency: '₹', desc: 'Full access: In-Dining, Takeaway, and Home Delivery', saving: 8000 },
                ] : [
                  { name: 'free', label: '30-Day Free Trial', price: 0, currency: '$', desc: 'Try out all features free for 30 days', saving: 0 },
                  { name: 'base', label: 'Standard plan', price: isYearly ? 300 : 30, currency: '$', desc: 'Choose EITHER In-Dining & Takeaway OR Home Delivery Only', saving: 60 },
                  { name: 'standard', label: 'Advance Plan', price: isYearly ? 500 : 50, currency: '$', desc: 'Full access: In-Dining, Takeaway, and Home Delivery', saving: 100 },
                ];

                return plans.map(p => {
                  const isCurrent = state.subscriptionPlan === p.name && (p.name === 'free' || (state.billingPeriod || 'monthly') === billingPeriodToggle);
                  
                  return (
                    <div key={p.name} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-elevated)',
                      padding: '16px',
                      borderRadius: 12,
                      border: isCurrent ? '2px solid var(--brand)' : '1px solid var(--border)',
                      position: 'relative'
                    }}>
                      {isCurrent && (
                        <div style={{
                          position: 'absolute', top: -10, right: 12,
                          background: 'var(--brand)', color: '#fff', fontSize: 9,
                          fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                          textTransform: 'uppercase'
                        }}>
                          Current Plan
                        </div>
                      )}
                      
                      <div style={{ flex: 1, marginRight: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {p.desc}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 6 }}>
                          {p.name === 'free' && 'Trial Period: 30 Days (All features)'}
                          {p.name === 'base' && 'Allowed: EITHER In-Dining & Takeaway OR Home Delivery Only'}
                          {p.name === 'standard' && 'Allowed: All features (In-Dining, Takeaway, and Home Delivery)'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                          {p.price === 0 ? 'Free' : `${p.currency}${p.price}`}
                          {p.price > 0 && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>/{isYearly ? 'yr' : 'mo'}</span>}
                        </div>
                        
                        {isYearly && p.price > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>
                            Save {p.currency}{p.saving} on this plan!
                          </div>
                        )}
                        
                        <button
                          disabled={isCurrent}
                          onClick={() => handleSelectPlan(p.name as any, p.price, p.currency, billingPeriodToggle)}
                          className={isCurrent ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                          style={{
                            padding: '6px 12px',
                            fontSize: 11,
                            borderRadius: 8,
                            cursor: isCurrent ? 'default' : 'pointer',
                            marginTop: 4
                          }}
                        >
                          {isCurrent ? 'Active' : 'Upgrade'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Subscription FAQs / Notice Card */}
            <div className="card" style={{
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--border)',
              borderRadius: 12,
              padding: 16,
              marginTop: 20,
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-secondary)'
            }}>
              <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>ℹ️</span> Subscription & Cancellation Info
              </h5>
              <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>
                  <strong>Cancel Anytime:</strong> You can cancel your subscription at any time. There are no lock-in periods or cancellation fees.
                </li>
                <li>
                  <strong>Cancellation Process:</strong>
                  <ul style={{ paddingLeft: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li><strong>Directly:</strong> Click the <em>"Cancel Auto-Pay"</em> button on your active plan card above to stop recurring payments immediately.</li>
                    <li><strong>UPI Apps:</strong> If you subscribed using UPI (Google Pay, PhonePe, Paytm, BHIM, etc.), open your UPI app, navigate to <em>Settings/Profile &rarr; UPI Autopay / Mandates</em>, select the <em>Meenufy Pay</em> mandate, and revoke it.</li>
                    <li><strong>Cards:</strong> If subscribed via Card, you can cancel directly on our dashboard or via your bank's netbanking under <em>Manage E-Mandates</em>.</li>
                  </ul>
                </li>
                <li>
                  <strong>Upgrading or Changing Plans:</strong> You do <strong>not</strong> need to manually cancel your existing plan before choosing a new one. Simply select your desired upgrade plan and complete the checkout. Our system will <strong>automatically terminate</strong> your previous plan's auto-pay mandate in the background to ensure you are never double-billed.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}



      {/* Progressive Web App (PWA) Onboarding */}
      {!isOnlyOutlet && activeSection === 'pwa' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>Install Meenufy App</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.7 }}>
              Add Meenufy to your home screen for instant access,<br />
              offline support, and a native app experience.
            </p>
            <button className="btn btn-primary btn-lg" onClick={handleInstallPWA}>
              <Download size={18} /> Install App
            </button>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Or: Browser menu → "Add to Home Screen"
            </p>
          </div>
        </div>
      )}

      {/* Help, Feedback & Support Tickets */}
      {!isOnlyOutlet && activeSection === 'feedback' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>
            Feedback & Tickets
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Submit a ticket for bugs or request features. You can also contact support directly.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
              Ticket Type
            </label>
            <select
              className="input"
              value={ticketType}
              onChange={e => setTicketType(e.target.value as any)}
              style={{ width: '100%', height: 42, padding: '0 12px' }}
            >
              <option value="feedback">💡 Feedback & Suggestion</option>
              <option value="bug">🐛 Bug Report</option>
              <option value="feature">✨ Feature Request</option>
              <option value="other">❓ General Issue / Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
              Description / Message
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="Provide a detailed description of the issue or your suggestion..."
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              style={{ resize: 'vertical', width: '100%', padding: '10px 12px' }}
            />
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSendFeedback} style={{ marginBottom: 20 }}>
            <Send size={15} /> Submit Feedback / Ticket
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', opacity: 0.6 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or Contact Directly</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
          </div>

          {/* Contact Details Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            marginTop: 10
          }}>
            <a href="tel:9798482404" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 10, border: '1px solid var(--border)', fontSize: 12,
              color: 'var(--text)', textDecoration: 'none', background: 'var(--bg-elevated)',
              transition: 'var(--transition)'
            }}>
              <span>📞</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-muted)' }}>Call Us</div>
                <div>9798482404</div>
              </div>
            </a>

            <a href="mailto:atish2k26@gmail.com" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 10, border: '1px solid var(--border)', fontSize: 12,
              color: 'var(--text)', textDecoration: 'none', background: 'var(--bg-elevated)',
              transition: 'var(--transition)'
            }}>
              <span>✉️</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-muted)' }}>Email</div>
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 100 }}>atish2k26@gmail.com</div>
              </div>
            </a>

            <a href="https://wa.me/919798482404" target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 10, border: '1px solid var(--border)', fontSize: 12,
              color: '#25D366', textDecoration: 'none', background: 'var(--bg-elevated)',
              transition: 'var(--transition)', fontWeight: 600
            }}>
              <span>💬</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-muted)' }}>WhatsApp</div>
                <div>WhatsApp Chat</div>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* Staff Management Panel */}
      {!isOnlyOutlet && activeSection === 'staff' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Users size={18} color="var(--brand)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Manage Staff & Delivery Boys</h3>
          </div>

          {/* Sub-tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 3,
            marginBottom: 16
          }}>
            <button
              type="button"
              onClick={() => setActiveStaffSubTab('manager')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
                background: activeStaffSubTab === 'manager' ? 'var(--brand)' : 'transparent',
                color: activeStaffSubTab === 'manager' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💼 Manager Staff
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffSubTab('delivery')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
                background: activeStaffSubTab === 'delivery' ? 'var(--brand)' : 'transparent',
                color: activeStaffSubTab === 'delivery' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🛵 Delivery Boys
            </button>
          </div>

          {activeStaffSubTab === 'manager' ? (
            <>
          
          {/* Subscription Limit Warning/Info */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Subscription Plan: <strong style={{ color: 'var(--brand)', textTransform: 'uppercase' }}>{state.subscriptionPlan || 'free'} Plan</strong>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Staff Limit: {myStaff.length} / {staffLimit} active staff
              </div>
            </div>
            {myStaff.length >= staffLimit && (
              <button
                onClick={() => setActiveSection('subscription')}
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11, padding: '6px 12px', height: 'auto' }}
              >
                🚀 Upgrade Plan
              </button>
            )}
          </div>

          {/* Form to Add/Edit Staff */}
          <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
              {editingStaffId ? '✏️ Edit Staff Member' : '➕ Create Staff Member'}
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Staff Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Login ID / Username</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. johndoe"
                  value={staffUsername}
                  onChange={e => setStaffUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  disabled={!!editingStaffId}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="Minimum 4 characters"
                value={staffPassword}
                onChange={e => setStaffPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>Permissions</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {[
                  { key: 'orders', label: '🍳 Orders Board' },
                  { key: 'menu', label: '📖 Menu' },
                  { key: 'customers', label: '👥 Customers' },
                  { key: 'analysis', label: '📈 Sales Analysis' },
                  { key: 'outlet_setting', label: '⚙️ Outlet Settings' },
                  { key: 'qr_tables', label: '🪑 QR & Tables' },
                ].map(p => {
                  const isChecked = staffPermissions.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: isChecked ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                        border: isChecked ? '1px solid var(--brand)' : '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        color: isChecked ? 'var(--brand)' : 'var(--text-secondary)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...staffPermissions, p.key]
                            : staffPermissions.filter(k => k !== p.key);
                          setStaffPermissions(next);
                        }}
                        style={{ display: 'none' }}
                      />
                      <span>{isChecked ? '✓' : '○'}</span>
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, height: 38 }}
                disabled={!editingStaffId && myStaff.length >= staffLimit}
              >
                {editingStaffId ? 'Save Changes' : 'Create Staff Member'}
              </button>
              {editingStaffId && (
                <button
                  type="button"
                  onClick={resetStaffForm}
                  className="btn btn-secondary"
                  style={{ height: 38 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* List of Active Staff */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Active Staff Members ({myStaff.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myStaff.map(staff => (
                <div
                  key={staff.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {staff.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        @{staff.username}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleEditStaffClick(staff)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 10.5, height: 'auto' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStaffClick(staff.id)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px', fontSize: 10.5, height: 'auto', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  
                  {/* Permissions Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(staff.permissions || []).map(pKey => {
                      const labels: Record<string, string> = {
                        orders: '🍳 Orders Board',
                        menu: '📖 Menu',
                        customers: '👥 Customers',
                        analysis: '📈 Sales Analysis',
                        outlet_setting: '⚙️ Settings',
                        qr_tables: '🪑 QR & Tables'
                      };
                      return (
                        <span
                          key={pKey}
                          style={{
                            background: 'rgba(255, 125, 0, 0.08)',
                            color: 'var(--brand)',
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid rgba(255, 125, 0, 0.15)'
                          }}
                        >
                          {labels[pKey] || pKey}
                        </span>
                      );
                    })}
                    {(!staff.permissions || staff.permissions.length === 0) && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No permissions assigned
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {myStaff.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  No staff members created yet.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Delivery Boy Limit Header */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Subscription Plan: <strong style={{ color: '#9D4EDD', textTransform: 'uppercase' }}>{state.subscriptionPlan || 'free'} Plan</strong>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Delivery Boy Limit: {myDeliveryBoys.length} / {deliveryBoyLimit === Infinity ? 'Unlimited' : deliveryBoyLimit} active riders
              </div>
            </div>
            {myDeliveryBoys.length >= deliveryBoyLimit && (
              <button
                onClick={() => setActiveSection('subscription')}
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11, padding: '6px 12px', height: 'auto', background: '#9D4EDD', border: '1px solid #9D4EDD', color: '#fff' }}
              >
                🚀 Upgrade Plan
              </button>
            )}
          </div>

          {/* Form to Add/Edit Delivery Boy */}
          <form onSubmit={handleSaveDboy} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#9D4EDD' }}>
              {editingDboyId ? '✏️ Edit Delivery Rider' : '➕ Create Delivery Rider'}
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Rider Name</label>
                <input className="input" type="text" placeholder="e.g. David Miller" value={dboyName} onChange={e => setDboyName(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Rider Username / Email (lowercase)</label>
                <input className="input" type="text" placeholder="e.g. david_rider" value={dboyUsername} onChange={e => setDboyUsername(e.target.value)} disabled={!!editingDboyId} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Rider Password {editingDboyId && '(leave blank to keep unchanged)'}</label>
                <input className="input" type="text" placeholder="Enter rider sign in password" value={dboyPassword} onChange={e => setDboyPassword(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Rider Phone Number</label>
                <input className="input" type="tel" placeholder="e.g. +91 9876543210" value={dboyPhone} onChange={e => setDboyPhone(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Payout per Kilometer (₹)</label>
                <input className="input" type="number" step="0.5" min="1" max="100" placeholder="e.g. 12" value={dboyPayoutPerKm} onChange={e => setDboyPayoutPerKm(parseFloat(e.target.value) || 0)} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>* Recommended: ₹10 to ₹15 (ideal)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!editingDboyId && myDeliveryBoys.length >= deliveryBoyLimit}
                style={{ flex: 1, background: '#9D4EDD', color: '#fff', fontWeight: 800, border: 'none' }}
              >
                {editingDboyId ? 'Save Changes' : 'Create Delivery Rider'}
              </button>
              {editingDboyId && (
                <button
                  type="button"
                  onClick={resetDboyForm}
                  className="btn btn-secondary"
                  style={{ height: 38 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* List of Active Delivery Boys */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Active Riders ({myDeliveryBoys.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myDeliveryBoys.map(dboy => (
                <div
                  key={dboy.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {dboy.name}
                        </span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 800,
                          background: dboy.status === 'delivering' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: dboy.status === 'delivering' ? '#a855f7' : '#22c55e',
                          padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase'
                        }}>
                          {dboy.status || 'idle'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                        Username: @{dboy.username} | Payout: <strong style={{ color: 'var(--brand)' }}>₹{dboy.payoutPerKm || 12}/KM</strong>{dboy.phone && ` | Phone: ${dboy.phone}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleEditDboyClick(dboy)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 10.5, height: 'auto' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDboyClick(dboy.id)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px', fontSize: 10.5, height: 'auto', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginTop: 4, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Deliveries: <strong style={{ color: 'var(--text-primary)' }}>{dboy.totalDeliveries || 0}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Earnings: <strong style={{ color: 'var(--success)' }}>₹{dboy.totalEarnings || 0}</strong>
                    </div>
                  </div>
                </div>
              ))}
              {myDeliveryBoys.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  No delivery riders created yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )}

      {/* Logout */}
      <button
        className="btn btn-danger btn-full"
        onClick={handleLogout}
        style={{ fontSize: 14 }}
      >
        <LogOut size={16} /> Logout from Admin Panel
      </button>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Meenufy v1.0 · Built with ❤️ for restaurant owners worldwide<br />
        PWA · Works Offline · Real-time Sync
      </p>
      {/* Secure Payment Gateway Checkout Modal */}
      {showCheckout && (
        <div className="modal-backdrop" onClick={() => !checkoutProcessing && setShowCheckout(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  Secure Payment Checkout
                </h3>
              </div>
              {!checkoutProcessing && (
                <button
                  onClick={() => setShowCheckout(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}
                >
                  ✕
                </button>
              )}
            </div>

            {checkoutStep === 'select' && (
              <div>
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Amount to Pay (Subscription)</div>
                  <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4, fontFamily: 'var(--font-display)' }}>
                    <span style={{ color: 'var(--brand)' }}>
                      {upgradeCurrency}{upgradePrice}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Secured by Razorpay Pay</div>
                </div>

                <button
                  onClick={handleConfirmCheckoutPayment}
                  className="btn btn-primary btn-full"
                  style={{ height: 42, fontWeight: 700, background: 'var(--brand)', color: '#fff', border: 'none', marginTop: 8 }}
                >
                  Proceed to Pay {upgradeCurrency}{upgradePrice}
                </button>
              </div>
            )}

            {checkoutStep === 'paying' && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16
                }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    border: '3.5px solid var(--border)',
                    borderTopColor: 'var(--brand)',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                    Awaiting Payment Details...
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 260, lineHeight: 1.5 }}>
                    Please complete the transaction in the secure Razorpay checkout overlay. Do not refresh or close this tab.
                  </div>
                </div>
              </div>
            )}
            {checkoutStep === 'awaiting_razorpay' && (
              <div>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255,125,0,0.08) 0%, rgba(255,125,0,0.03) 100%)',
                  border: '1.5px solid var(--brand)',
                  borderRadius: 14,
                  padding: 18,
                  marginBottom: 20,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Complete Payment on Razorpay
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    A Razorpay payment page has opened in a new tab.<br/>
                    Complete the ₹{upgradePrice}/mo subscription there, then return here and enter your Subscription ID below.
                  </div>
                  <div style={{ marginTop: 14, padding: '8px 14px', background: 'rgba(255,125,0,0.1)', borderRadius: 8, fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>
                    📧 Your Subscription ID will be in the Razorpay confirmation email (format: sub_XXXX...)
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    Razorpay Subscription ID
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. sub_TDfCo4FNmjJ1Tz"
                    value={razorpaySubInput}
                    onChange={e => setRazorpaySubInput(e.target.value.trim())}
                    style={{ fontSize: 13, fontFamily: 'monospace' }}
                  />
                </div>

                <button
                  className="btn btn-primary btn-full"
                  disabled={!razorpaySubInput.startsWith('sub_') || razorpaySubInput.length < 10 || checkoutProcessing}
                  style={{ height: 42, fontWeight: 800, marginBottom: 10 }}
                  onClick={() => {
                    if (!selectedUpgradePlan) return;
                    setCheckoutProcessing(true);
                    // Activate the plan with the provided subscription ID
                    setTimeout(() => {
                      dispatch({
                        type: 'UPDATE_SUBSCRIPTION_PLAN',
                        payload: {
                          planName: selectedUpgradePlan,
                          billingPeriod: 'monthly',
                          subscriptionId: razorpaySubInput
                        }
                      });
                      setCheckoutProcessing(false);
                      setRazorpaySubInput('');
                      setCheckoutStep('success');
                      addToast('success', `🎉 ${selectedUpgradePlan === 'base' ? 'Standard' : 'Advance'} Plan activated successfully!`);
                    }, 800);
                  }}
                >
                  {checkoutProcessing ? '⏳ Activating...' : '✅ I Have Paid — Activate Plan'}
                </button>

                <button
                  type="button"
                  onClick={() => window.open(selectedUpgradePlan === 'base' ? 'https://rzp.io/rzp/tAf4cvv' : 'https://rzp.io/rzp/NJuSDUd2', '_blank', 'noopener,noreferrer')}
                  style={{ width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}
                >
                  🔗 Reopen Payment Page
                </button>

                <button
                  type="button"
                  onClick={() => { setShowCheckout(false); setRazorpaySubInput(''); }}
                  style={{ width: '100%', background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 0' }}
                >
                  Cancel
                </button>
              </div>
            )}


            {checkoutStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  margin: '0 auto 16px',
                  border: '2px solid #22c55e',
                  boxShadow: '0 0 15px rgba(34,197,94,0.2)'
                }}>
                  ✓
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Subscription Activated!
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                  Your plan has been upgraded to <strong style={{ textTransform: 'capitalize' }}>{selectedUpgradePlan === 'base' ? 'Standard' : selectedUpgradePlan === 'standard' ? 'Advance' : selectedUpgradePlan}</strong>. All features for your plan are now active.
                </p>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="btn btn-primary btn-full"
                  style={{ height: 38 }}
                >
                  Go to Dashboard
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
