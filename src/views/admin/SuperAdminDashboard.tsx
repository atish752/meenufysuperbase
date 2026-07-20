import { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import {
  LogOut, Mail, Phone, Store, Calendar,
  Check, ShieldAlert, Plus, Trash2, Key
} from 'lucide-react';

const DEFAULT_POPULAR_CUISINES = [
  { name: 'Biryani', query: 'biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=150&auto=format&fit=crop&q=60' },
  { name: 'Paneer', query: 'paneer', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=150&auto=format&fit=crop&q=60' },
  { name: 'Chicken', query: 'chicken', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=150&auto=format&fit=crop&q=60' },
  { name: 'Burger', query: 'burger', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=60' },
  { name: 'Pizza', query: 'pizza', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=60' },
  { name: 'Roll', query: 'roll', image: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=150&auto=format&fit=crop&q=60' },
  { name: 'Noodles', query: 'noodles', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=150&auto=format&fit=crop&q=60' },
  { name: 'Chilli', query: 'chilli', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=150&auto=format&fit=crop&q=60' },
  { name: 'Fried Rice', query: 'fried rice', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=150&auto=format&fit=crop&q=60' },
  { name: 'Momo', query: 'momo', image: 'https://images.unsplash.com/photo-1625220194771-7ebedd0b4869?w=150&auto=format&fit=crop&q=60' },
  { name: 'Dosa', query: 'dosa', image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=150&auto=format&fit=crop&q=60' },
  { name: 'Manchurian', query: 'manchurian', image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=150&auto=format&fit=crop&q=60' }
];

function compressImage(dataUrl: string, maxWidth: number = 500, maxHeight: number = 500, quality: number = 0.9): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = dataUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('Canvas compression fallback due to error:', err);
        resolve(dataUrl);
      }
    };
    img.onerror = (err) => {
      console.warn('Failed to load image for compression fallback:', err);
      resolve(dataUrl);
    };
  });
}

const getPlanBadge = (plan: string) => {
  const planColors: Record<string, { bg: string; color: string; border: string }> = {
    free: { bg: 'rgba(107, 114, 128, 0.12)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.3)' },
    base: { bg: 'rgba(255, 125, 0, 0.12)', color: '#ff7d00', border: '1px solid rgba(255, 125, 0, 0.3)' },
    standard: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' },
    advance: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }
  };
  const currentPlan = plan || 'free';
  const displayLabel = currentPlan === 'standard' ? 'Advance' : currentPlan;
  const colors = planColors[currentPlan] || planColors.free;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      background: colors.bg,
      color: colors.color,
      border: colors.border
    }}>
      {displayLabel} Plan
    </span>
  );
};

export default function SuperAdminDashboard() {
  const { state, dispatch, addToast } = useStore();
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [managePlan, setManagePlan] = useState<'free' | 'base' | 'standard' | 'advance'>('free');
  const [manageOrdersPlaced, setManageOrdersPlaced] = useState(0);
  const [manageRenewalDate, setManageRenewalDate] = useState('');
  const [manageCountry, setManageCountry] = useState<'IN' | 'global'>('global');
  const [manageBillingPeriod, setManageBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [showManageModal, setShowManageModal] = useState(false);

  const accounts = state.restaurantAccounts || [];

  // Auto-heal mismatches dynamically when Super Admin loads dashboard
  useEffect(() => {
    if (!state.admin?.isSuperAdmin || accounts.length === 0) return;

    import('firebase/database').then(({ get, ref, update, getDatabase }) => {
      const db = getDatabase();
      accounts.forEach(acc => {
        if (!acc.id) return;
        get(ref(db, `restaurants/${acc.id}`)).then(snap => {
          const restData = snap.val();
          if (restData) {
            let needsUpdate = false;
            const updatePayload: any = {};

            if (restData.name && restData.name !== acc.restaurantName) {
              updatePayload.restaurantName = restData.name;
              needsUpdate = true;
            }
            if (restData.phone && restData.phone !== acc.ownerPhone) {
              updatePayload.ownerPhone = restData.phone;
              needsUpdate = true;
            }
            if (restData.email && restData.email !== acc.ownerEmail) {
              updatePayload.ownerEmail = restData.email;
              needsUpdate = true;
            }
            if (restData.logo && restData.logo !== acc.logo) {
              updatePayload.logo = restData.logo;
              needsUpdate = true;
            }
            if (restData.tagline && restData.tagline !== acc.tagline) {
              updatePayload.tagline = restData.tagline;
              needsUpdate = true;
            }
            if (restData.address && restData.address !== acc.address) {
              updatePayload.address = restData.address;
              needsUpdate = true;
            }
            if (restData.latitude !== undefined && restData.latitude !== acc.latitude) {
              updatePayload.latitude = restData.latitude;
              needsUpdate = true;
            }
            if (restData.longitude !== undefined && restData.longitude !== acc.longitude) {
              updatePayload.longitude = restData.longitude;
              needsUpdate = true;
            }
            if (restData.cuisines && restData.cuisines !== acc.cuisines) {
              updatePayload.cuisines = restData.cuisines;
              needsUpdate = true;
            }
            if (restData.rating !== undefined && restData.rating !== acc.rating) {
              updatePayload.rating = restData.rating;
              needsUpdate = true;
            }
            if (restData.bannerImage && restData.bannerImage !== acc.bannerImage) {
              updatePayload.bannerImage = restData.bannerImage;
              needsUpdate = true;
            }

            if (needsUpdate) {
              console.log(`Auto-healing account ${acc.id}: ${acc.restaurantName} -> ${restData.name}`);
              update(ref(db, `restaurantAccounts/${acc.id}`), updatePayload).catch(() => {});
            }
          }
        }).catch(() => {});
      });
    }).catch(e => console.error("Firebase Database import failed:", e));
  }, [accounts.length, state.admin?.isSuperAdmin]);

  // Tabs and replies
  const [activeTab, setActiveTab] = useState<'accounts' | 'api_keys' | 'support' | 'feedback' | 'coupons' | 'cuisines'>('accounts');
  const [newCuisineName, setNewCuisineName] = useState('');
  const [newCuisineQuery, setNewCuisineQuery] = useState('');
  const [newCuisineImage, setNewCuisineImage] = useState('');
  const [uploadingCuisineImage, setUploadingCuisineImage] = useState(false);
  const [editingCuisineQuery, setEditingCuisineQuery] = useState<string | null>(null);
  const [originalQuality, setOriginalQuality] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [supportReplies, setSupportReplies] = useState<Record<string, string>>({});
  const [feedbackReplies, setFeedbackReplies] = useState<Record<string, string>>({});

  // Subscription coupons form state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscountType, setCouponDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponDiscountValue, setCouponDiscountValue] = useState(0);
  const [couponMinPlan, setCouponMinPlan] = useState<'free' | 'base' | 'standard' | 'advance'>('free');
  const [couponBillingRegion, setCouponBillingRegion] = useState<'all' | 'IN' | 'global'>('all');

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT_ADMIN' });
    addToast('info', 'Super Admin logged out.');
  };

  const [optimizingImages, setOptimizingImages] = useState(false);

  const handleOptimizeCuisines = async () => {
    if (!state.popularCuisines || state.popularCuisines.length === 0) return;
    setOptimizingImages(true);
    try {
      const newList = [];
      let count = 0;
      for (const c of state.popularCuisines) {
        if (c.image) {
          const compressed = await compressImage(c.image, 500, 500, 0.9);
          if (compressed !== c.image) {
            newList.push({ ...c, image: compressed });
            count++;
          } else {
            newList.push(c);
          }
        } else {
          newList.push(c);
        }
      }
      if (count > 0) {
        dispatch({ type: 'SET_POPULAR_CUISINES', payload: newList });
        addToast('success', `Optimized & compressed ${count} cuisine images!`);
      } else {
        addToast('info', 'All cuisine images are already optimized!');
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to optimize images.');
    } finally {
      setOptimizingImages(false);
    }
  };

  const handleOpenManageModal = (acc: any) => {
    setSelectedAccountId(acc.id);
    setSelectedAccountEmail(acc.ownerEmail);
    setManagePlan(acc.subscriptionPlan === 'advance' ? 'standard' : (acc.subscriptionPlan || 'free'));
    setManageOrdersPlaced(acc.ordersPlacedThisMonth || 0);
    setManageCountry(acc.billingCountry || 'global');
    setManageBillingPeriod(acc.billingPeriod || 'monthly');
    
    // Format renewal date for input type="date"
    const renewalMs = acc.subscriptionRenewalDate || (acc.createdAt + (acc.subscriptionPlan === 'free' ? 13 : 30) * 24 * 60 * 60 * 1000);
    const dateStr = new Date(renewalMs).toISOString().split('T')[0];
    setManageRenewalDate(dateStr);
    
    setShowManageModal(true);
  };

  const handleApplySubscriptionUpdate = () => {
    if (!selectedAccountId) return;
    
    const renewalMs = new Date(manageRenewalDate).getTime();
    if (isNaN(renewalMs)) {
      addToast('error', 'Please enter a valid renewal date.');
      return;
    }
    
    dispatch({
      type: 'SUPER_ADMIN_UPDATE_SUBSCRIPTION',
      payload: {
        id: selectedAccountId,
        subscriptionPlan: managePlan,
        ordersPlacedThisMonth: Number(manageOrdersPlaced),
        subscriptionRenewalDate: renewalMs,
        billingCountry: manageCountry,
        billingPeriod: manageBillingPeriod
      }
    });
    
    addToast('success', `Updated subscription details for ${selectedAccountEmail}!`);
    setShowManageModal(false);
  };

  const handleToggleBlock = (email: string) => {
    const account = state.restaurantAccounts.find(acc => acc.ownerEmail === email);
    if (!account) return;
    
    const nextStatus = account.status === 'active' ? 'Block' : 'Unblock';
    if (window.confirm(`Are you sure you want to ${nextStatus} ${account.restaurantName}?`)) {
      dispatch({
        type: 'SUPER_ADMIN_TOGGLE_BLOCK',
        payload: { email }
      });
      addToast('info', `${account.restaurantName} is now ${account.status === 'active' ? 'Blocked' : 'Active'}.`);
    }
  };

  const handleDeleteAccount = (accId: string, restaurantName: string) => {
    const confirm1 = window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete the account for "${restaurantName}"? \n\nThis action cannot be undone and will erase all their menus, tables, categories, orders, and customer records permanently.`);
    if (!confirm1) return;
    
    const confirm2 = window.prompt(`To confirm deletion, please type the restaurant name: "${restaurantName}"`);
    if (confirm2 !== restaurantName) {
      addToast('error', '❌ Delete verification failed. Restaurant name did not match.');
      return;
    }
    
    dispatch({ type: 'SUPER_ADMIN_DELETE_ACCOUNT', payload: accId });
    addToast('success', `Permanently deleted account for "${restaurantName}".`);
  };

  // New API Key Actions
  const handleAddApiKey = () => {
    if (!newApiKey.trim()) {
      addToast('error', 'Please enter a valid API key.');
      return;
    }
    if (state.geminiApiKeys?.includes(newApiKey.trim())) {
      addToast('error', 'This API key is already added.');
      return;
    }
    dispatch({ type: 'ADD_GEMINI_KEY', payload: newApiKey.trim() });
    addToast('success', 'Gemini API Key added successfully! 🔑');
    setNewApiKey('');
  };

  const handleRemoveApiKey = (key: string) => {
    if (window.confirm('Are you sure you want to remove this API key?')) {
      dispatch({ type: 'REMOVE_GEMINI_KEY', payload: key });
      addToast('info', 'API Key removed.');
    }
  };

  // Support replies
  const handleReplySupport = (reqId: string) => {
    const text = supportReplies[reqId]?.trim();
    if (!text) {
      addToast('error', 'Please enter a reply message.');
      return;
    }
    dispatch({
      type: 'REPLY_SUPPORT_REQUEST',
      payload: { id: reqId, replyText: text }
    });
    addToast('success', 'Reply recorded successfully!');
    setSupportReplies(prev => ({ ...prev, [reqId]: '' }));
  };

  // Feedback replies & delete
  const handleReplyFeedback = (fbId: string) => {
    const text = feedbackReplies[fbId]?.trim();
    if (!text) {
      addToast('error', 'Please enter a reply message.');
      return;
    }
    dispatch({
      type: 'REPLY_FEEDBACK',
      payload: { id: fbId, replyText: text }
    });
    addToast('success', 'Reply recorded successfully!');
    setFeedbackReplies(prev => ({ ...prev, [fbId]: '' }));
  };

  const handleDeleteFeedback = (fbId: string) => {
    if (window.confirm('Are you sure you want to delete this feedback?')) {
      dispatch({ type: 'DELETE_FEEDBACK', payload: fbId });
      addToast('info', 'Feedback deleted.');
    }
  };

  const handleAddSubscriptionCoupon = () => {
    const codeClean = couponCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!codeClean) {
      addToast('error', 'Please enter a valid coupon code.');
      return;
    }
    if (couponDiscountValue <= 0) {
      addToast('error', 'Discount value must be greater than 0.');
      return;
    }
    if (couponDiscountType === 'percentage' && couponDiscountValue > 100) {
      addToast('error', 'Percentage discount cannot exceed 100%.');
      return;
    }
    
    const list = state.subscriptionCoupons || [];
    if (list.some(c => c.code === codeClean)) {
      addToast('error', `A coupon with code "${codeClean}" already exists.`);
      return;
    }

    const newCoupon = {
      id: `sub-coupon-${Date.now()}`,
      code: codeClean,
      discountType: couponDiscountType,
      discountValue: Number(couponDiscountValue),
      minPlan: couponMinPlan,
      billingRegion: couponBillingRegion,
      createdAt: Date.now(),
      isActive: true
    };

    dispatch({ type: 'ADD_SUBSCRIPTION_COUPON', payload: newCoupon });
    addToast('success', `Subscription coupon "${codeClean}" created successfully! 🎟️`);
    setCouponCode('');
    setCouponDiscountValue(0);
  };

  const handleRemoveSubscriptionCoupon = (id: string, code: string) => {
    if (window.confirm(`Are you sure you want to delete coupon "${code}"?`)) {
      dispatch({ type: 'DELETE_SUBSCRIPTION_COUPON', payload: id });
      addToast('info', `Coupon "${code}" deleted.`);
    }
  };

  // Stats calculations
  const totalOrders = accounts.reduce((sum, a) => sum + (a.ordersPlacedThisMonth || 0), 0);
  const activeCount = accounts.filter(a => a.status === 'active').length;
  const blockedCount = accounts.filter(a => a.status === 'blocked').length;

  // Plans pricing (INR & USD)
  const PLAN_PRICES: Record<string, { inr: { monthly: number; yearly: number }; usd: { monthly: number; yearly: number } }> = {
    base:     { inr: { monthly: 1499, yearly: 14990 }, usd: { monthly: 20,  yearly: 200 } },
    standard: { inr: { monthly: 2499, yearly: 24990 }, usd: { monthly: 35,  yearly: 350 } },
    advance:  { inr: { monthly: 3999, yearly: 39990 }, usd: { monthly: 50,  yearly: 500 } },
  };

  // Calculate monthly recurring revenue (normalize annual plans by /12)
  let mrrINR = 0;
  let mrrUSD = 0;
  accounts.forEach(acc => {
    if (!acc.subscriptionPlan || acc.subscriptionPlan === 'free') return;
    const prices = PLAN_PRICES[acc.subscriptionPlan];
    if (!prices) return;
    const billingPeriod = acc.billingPeriod || 'monthly';
    const country = acc.billingCountry || 'global';
    if (country === 'IN') {
      mrrINR += billingPeriod === 'yearly' ? Math.round(prices.inr.yearly / 12) : prices.inr.monthly;
    } else {
      mrrUSD += billingPeriod === 'yearly' ? Math.round(prices.usd.yearly / 12) : prices.usd.monthly;
    }
  });

  return (
    <div style={{
      padding: '24px 20px',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            border: '1px solid var(--border-brand)',
            borderRadius: '50%',
            overflow: 'hidden',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-brand)',
            background: 'transparent'
          }}>
            <img src={state.adminTheme === 'light' ? '/meenufy_logo_light.png' : '/meenufy_logo_dark.png'} alt="Meenufy Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 900, margin: 0 }}>
              Meenufy Owner Control Center
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
              Super Admin Control Panel (atish752)
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            borderRadius: 10
          }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{
            background: 'rgba(255, 125, 0, 0.15)',
            width: 42, height: 42, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)'
          }}>
            <Store size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Restaurants</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 2 }}>{accounts.length}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            width: 42, height: 42, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)'
          }}>
            <Check size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total System Orders</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 2, color: 'var(--success)' }}>
              {totalOrders.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.12)',
            width: 42, height: 42, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e'
          }}>
            <Check size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Outlets</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 2 }}>{activeCount}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            width: 42, height: 42, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)'
          }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Blocked Outlets</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 2, color: 'var(--error)' }}>
              {blockedCount}
            </div>
          </div>
        </div>

        {/* Monthly Revenue Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.15)',
            width: 42, height: 42, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: 20
          }}>
            💰
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Monthly Revenue</div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 2, color: '#6366f1' }}>
              {mrrINR > 0 ? `₹${mrrINR.toLocaleString('en-IN')}` : ''}
              {mrrINR > 0 && mrrUSD > 0 ? ' + ' : ''}
              {mrrUSD > 0 ? `$${mrrUSD}` : ''}
              {mrrINR === 0 && mrrUSD === 0 ? '—' : ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Normalized (monthly)</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 20,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 10,
        overflowX: 'auto'
      }}>
        {[
          { id: 'accounts', label: 'Accounts Manager', count: accounts.length },
          { id: 'api_keys', label: 'Gemini API Keys', count: state.geminiApiKeys?.length || 0 },
          { id: 'support', label: 'Support Tickets', count: state.supportRequests?.filter(r => r.status === 'pending').length || 0, badgeColor: 'var(--error)' },
          { id: 'feedback', label: 'Feedback & Tickets', count: state.ownerFeedbacks?.length || 0 },
          { id: 'coupons', label: 'Subscription Coupons', count: state.subscriptionCoupons?.length || 0 },
          { id: 'cuisines', label: 'Cuisines (Mind List)', count: state.popularCuisines?.length || DEFAULT_POPULAR_CUISINES.length }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="btn"
              style={{
                background: isActive ? 'var(--brand)' : 'var(--bg-elevated)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? '1px solid var(--brand)' : '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.2)' : (tab.badgeColor || 'var(--brand-dim)'),
                  color: isActive ? '#fff' : (tab.badgeColor ? '#fff' : 'var(--brand)'),
                  padding: '2px 6px',
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 800
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Card - Dynamically Rendered based on Tab */}
      <div className="card" style={{ padding: 20 }}>
        
        {activeTab === 'accounts' && (
          <div>
            <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 16 }}>
              Registered Restaurant Owners Accounts
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Restaurant &amp; Owner</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Contact Details</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Registered On</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subscription Plan</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr key={acc.id} style={{
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                      transition: 'background 0.2s',
                      background: acc.status === 'blocked' ? 'rgba(239, 68, 68, 0.02)' : 'transparent'
                    }}>
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{acc.restaurantName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Owner: {acc.ownerName}</div>

                        {(() => {
                          const matchedStaff = (state.staffMembers || []).filter(s => s.restaurantId === acc.id);
                          if (matchedStaff.length === 0) return null;
                          return (
                            <div style={{
                              marginTop: 10,
                              padding: '8px 10px',
                              background: 'var(--bg-elevated)',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              fontSize: 11
                            }}>
                              <div style={{
                                fontWeight: 800,
                                fontSize: 9,
                                color: 'var(--brand)',
                                textTransform: 'uppercase',
                                marginBottom: 6,
                                letterSpacing: '0.05em'
                              }}>
                                REGISTERED STAFF ({matchedStaff.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {matchedStaff.map((staff, idx) => (
                                  <div key={staff.id} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    paddingBottom: 4,
                                    marginBottom: idx === matchedStaff.length - 1 ? 0 : 4,
                                    borderBottom: idx === matchedStaff.length - 1 ? 'none' : '1px dashed var(--border)'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{staff.name}</span>
                                      <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>({staff.username})</span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 9, marginTop: 1 }}>
                                      ID: {staff.id} | Perms: {staff.permissions?.join(', ') || 'none'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                          <Mail size={12} color="var(--brand)" /> <span>{acc.ownerEmail}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', marginTop: 4 }}>
                          <Phone size={12} color="var(--brand)" /> <span>{acc.ownerPhone}</span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 16px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} />
                          <span>{new Date(acc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 16px' }}>
                        <div>
                          {getPlanBadge(acc.subscriptionPlan || 'free')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                          Region: {acc.billingCountry === 'IN' ? 'India' : 'Global'} ({acc.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'})
                        </div>
                      </td>

                      <td style={{ padding: '16px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: acc.status === 'active' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: acc.status === 'active' ? '#22c55e' : 'var(--error)'
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: acc.status === 'active' ? '#22c55e' : '#ef4444'
                          }} />
                          {acc.status === 'active' ? 'Active' : 'Blocked'}
                        </span>
                      </td>

                      <td style={{ padding: '16px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenManageModal(acc)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 11, fontWeight: 700, borderColor: 'var(--border)', color: 'var(--brand)', padding: '4px 10px'
                            }}
                          >
                            Manage Plan
                          </button>

                          <button
                            onClick={() => handleToggleBlock(acc.ownerEmail)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 11, fontWeight: 700,
                              borderColor: 'var(--border)',
                              color: acc.status === 'active' ? 'var(--error)' : 'var(--success)',
                              padding: '4px 10px'
                            }}
                          >
                            {acc.status === 'active' ? 'Block' : 'Unblock'}
                          </button>

                          <button
                            onClick={() => handleDeleteAccount(acc.id, acc.restaurantName)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 11, fontWeight: 700,
                              borderColor: 'var(--border)',
                              color: 'var(--error)',
                              padding: '4px 10px'
                            }}
                          >
                            <Trash2 size={12} style={{ marginRight: 4 }} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'api_keys' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  Gemini API Keys Manager
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Add and manage multiple Gemini API keys. These keys are randomly assigned to restaurant owners when they use AI features.
                </p>
              </div>
            </div>

            {/* Add Key Form */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16, marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} color="var(--brand)" /> Add New API Key
              </h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter Gemini API Key (starts with AIzaSy...)"
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  style={{ flex: 1, minWidth: 260 }}
                />
                <button className="btn btn-primary" onClick={handleAddApiKey}>
                  Add Key
                </button>
              </div>
            </div>

            {/* Keys List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                Active Keys ({state.geminiApiKeys?.length || 0})
              </h4>
              
              {(!state.geminiApiKeys || state.geminiApiKeys.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                  No API keys configured. Restaurant AI extraction will fallback to the demo key.
                </div>
              ) : (
                state.geminiApiKeys.map((key, index) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '12px 16px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: 'rgba(255,125,0,0.1)', padding: 8, borderRadius: 6 }}>
                        <Key size={16} color="var(--brand)" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Key #{index + 1}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {key.slice(0, 8)}••••••••••••••••••••{key.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: 'var(--border)', color: 'var(--error)', padding: '6px 12px' }}
                      onClick={() => handleRemoveApiKey(key)}
                    >
                      <Trash2 size={13} style={{ marginRight: 4 }} /> Delete Key
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                AI Support Tickets
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                Submitted by restaurant owners and customers for assistance.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Column 1: Restaurant Owners */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  🏢 Restaurant Owners ({(state.supportRequests || []).filter(r => r.isCustomerTicket !== true).length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(!state.supportRequests || state.supportRequests.filter(r => r.isCustomerTicket !== true).length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      No owner tickets filed yet.
                    </div>
                  ) : (
                    state.supportRequests.filter(r => r.isCustomerTicket !== true).map(req => (
                      <div
                        key={req.id}
                        className="card"
                        style={{
                          padding: 16,
                          background: 'var(--bg-elevated)',
                          border: req.status === 'pending' ? '1px solid var(--error-dim)' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                                {req.restaurantName}
                              </span>
                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: req.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: req.status === 'pending' ? 'var(--error)' : 'var(--success)'
                              }}>
                                {req.status === 'pending' ? 'Pending' : 'Resolved'}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Owner: {req.ownerName} ({req.ownerEmail}) · Filed: {new Date(req.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, fontSize: 12, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                            AI Failure Attempts Count: <span style={{ color: 'var(--error)' }}>{req.attemptsCount || 0} times</span>
                          </div>
                          <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            "{req.message}"
                          </div>
                        </div>

                        {req.replyText && (
                          <div style={{ background: 'rgba(255, 125, 0, 0.05)', borderLeft: '3px solid var(--brand)', padding: 8, borderRadius: '0 6px 6px 0', fontSize: 11 }}>
                            <strong>Reply:</strong> <span style={{ color: 'var(--text-secondary)' }}>"{req.replyText}"</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input
                            className="input"
                            style={{ padding: '4px 10px', fontSize: 11, flex: 1, height: 28 }}
                            placeholder={req.replyText ? "Update reply..." : "Type reply..."}
                            value={supportReplies[req.id] || ''}
                            onChange={e => setSupportReplies(prev => ({ ...prev, [req.id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', height: 28, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleReplySupport(req.id)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Customers */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  👥 Customers ({(state.supportRequests || []).filter(r => r.isCustomerTicket === true).length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(!state.supportRequests || state.supportRequests.filter(r => r.isCustomerTicket === true).length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      No customer tickets filed yet.
                    </div>
                  ) : (
                    state.supportRequests.filter(r => r.isCustomerTicket === true).map(req => (
                      <div
                        key={req.id}
                        className="card"
                        style={{
                          padding: 16,
                          background: 'var(--bg-elevated)',
                          border: req.status === 'pending' ? '1px solid var(--error-dim)' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                                {req.restaurantName}
                              </span>
                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: req.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: req.status === 'pending' ? 'var(--error)' : 'var(--success)'
                              }}>
                                {req.status === 'pending' ? 'Pending' : 'Resolved'}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Cust: {req.ownerName} ({req.ownerEmail || 'No Email'}) · Filed: {new Date(req.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, fontSize: 12, border: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            "{req.message}"
                          </div>
                        </div>

                        {req.replyText && (
                          <div style={{ background: 'rgba(255, 125, 0, 0.05)', borderLeft: '3px solid var(--brand)', padding: 8, borderRadius: '0 6px 6px 0', fontSize: 11 }}>
                            <strong>Reply:</strong> <span style={{ color: 'var(--text-secondary)' }}>"{req.replyText}"</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input
                            className="input"
                            style={{ padding: '4px 10px', fontSize: 11, flex: 1, height: 28 }}
                            placeholder={req.replyText ? "Update reply..." : "Type reply..."}
                            value={supportReplies[req.id] || ''}
                            onChange={e => setSupportReplies(prev => ({ ...prev, [req.id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', height: 28, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleReplySupport(req.id)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                Feedback & Tickets
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                General feedback and suggestions submitted by restaurant owners and customers.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Column 1: Restaurant Owners */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  🏢 Restaurant Owners ({(state.ownerFeedbacks || []).filter(f => f.isCustomerTicket !== true).length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(!state.ownerFeedbacks || state.ownerFeedbacks.filter(f => f.isCustomerTicket !== true).length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      No owner feedback received yet.
                    </div>
                  ) : (
                    state.ownerFeedbacks.filter(f => f.isCustomerTicket !== true).map(fb => (
                      <div
                        key={fb.id}
                        className="card"
                        style={{
                          padding: 16,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                                {fb.restaurantName}
                              </span>
                              {fb.ticketType && (
                                <span style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 20,
                                  textTransform: 'uppercase',
                                  border: '1px solid currentColor',
                                  color: fb.ticketType === 'bug' ? 'var(--error)' :
                                         fb.ticketType === 'feature' ? 'var(--brand)' : 'var(--success)'
                                }}>
                                  {fb.ticketType}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div>👤 {fb.ownerName} ({fb.ownerEmail})</div>
                              {fb.ownerPhone && <div>📞 {fb.ownerPhone}</div>}
                              <div style={{ fontSize: 9, opacity: 0.8 }}>🕒 {new Date(fb.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10, padding: '2px 6px', height: 22, borderColor: 'var(--border)', color: 'var(--error)' }}
                            onClick={() => handleDeleteFeedback(fb.id)}
                          >
                            Delete
                          </button>
                        </div>

                        <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, fontSize: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                          "{fb.message}"
                        </div>

                        {fb.replyText && (
                          <div style={{ background: 'rgba(255, 125, 0, 0.05)', borderLeft: '3px solid var(--brand)', padding: 8, borderRadius: '0 6px 6px 0', fontSize: 11 }}>
                            <strong>Reply:</strong> <span style={{ color: 'var(--text-secondary)' }}>"{fb.replyText}"</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input
                            className="input"
                            style={{ padding: '4px 10px', fontSize: 11, flex: 1, height: 28 }}
                            placeholder={fb.replyText ? "Update reply..." : "Type reply..."}
                            value={feedbackReplies[fb.id] || ''}
                            onChange={e => setFeedbackReplies(prev => ({ ...prev, [fb.id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', height: 28, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleReplyFeedback(fb.id)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Customers */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  👥 Customers ({(state.ownerFeedbacks || []).filter(f => f.isCustomerTicket === true).length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(!state.ownerFeedbacks || state.ownerFeedbacks.filter(f => f.isCustomerTicket === true).length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      No customer feedback received yet.
                    </div>
                  ) : (
                    state.ownerFeedbacks.filter(f => f.isCustomerTicket === true).map(fb => (
                      <div
                        key={fb.id}
                        className="card"
                        style={{
                          padding: 16,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                                {fb.restaurantName}
                              </span>
                              {fb.ticketType && (
                                <span style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 20,
                                  textTransform: 'uppercase',
                                  border: '1px solid currentColor',
                                  color: fb.ticketType === 'bug' ? 'var(--error)' :
                                         fb.ticketType === 'feature' ? 'var(--brand)' : 'var(--success)'
                                }}>
                                  {fb.ticketType}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div>👤 {fb.ownerName} ({fb.ownerEmail || 'No Email'})</div>
                              {fb.ownerPhone && <div>📞 {fb.ownerPhone}</div>}
                              <div style={{ fontSize: 9, opacity: 0.8 }}>🕒 {new Date(fb.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10, padding: '2px 6px', height: 22, borderColor: 'var(--border)', color: 'var(--error)' }}
                            onClick={() => handleDeleteFeedback(fb.id)}
                          >
                            Delete
                          </button>
                        </div>

                        <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 6, fontSize: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                          "{fb.message}"
                        </div>

                        {fb.replyText && (
                          <div style={{ background: 'rgba(255, 125, 0, 0.05)', borderLeft: '3px solid var(--brand)', padding: 8, borderRadius: '0 6px 6px 0', fontSize: 11 }}>
                            <strong>Reply:</strong> <span style={{ color: 'var(--text-secondary)' }}>"{fb.replyText}"</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input
                            className="input"
                            style={{ padding: '4px 10px', fontSize: 11, flex: 1, height: 28 }}
                            placeholder={fb.replyText ? "Update reply..." : "Type reply..."}
                            value={feedbackReplies[fb.id] || ''}
                            onChange={e => setFeedbackReplies(prev => ({ ...prev, [fb.id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', height: 28, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleReplyFeedback(fb.id)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'coupons' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  Subscription Coupons Manager
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Create and manage global coupon codes that restaurant owners can apply when upgrading their plans.
                </p>
              </div>
            </div>

            {/* Create Coupon Form */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 20, marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand)' }}>
                🎟️ Create New Coupon
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="input-group">
                  <label className="input-label">Coupon Code</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. SAVE50"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Discount Type</label>
                  <select
                    className="input"
                    value={couponDiscountType}
                    onChange={e => setCouponDiscountType(e.target.value as any)}
                    style={{ padding: '4px 8px', height: 36 }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Discount Value</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={couponDiscountValue || ''}
                    onChange={e => setCouponDiscountValue(Number(e.target.value))}
                    style={{ height: 36 }}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Min Plan Required</label>
                  <select
                    className="input"
                    value={couponMinPlan}
                    onChange={e => setCouponMinPlan(e.target.value as any)}
                    style={{ padding: '4px 8px', height: 36 }}
                  >
                    <option value="free">None (Any Plan)</option>
                    <option value="base">Base Plan</option>
                    <option value="standard">Standard Plan</option>
                    <option value="advance">Advance Plan</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Billing Region</label>
                  <select
                    className="input"
                    value={couponBillingRegion}
                    onChange={e => setCouponBillingRegion(e.target.value as any)}
                    style={{ padding: '4px 8px', height: 36 }}
                  >
                    <option value="all">All Regions</option>
                    <option value="IN">India Only (INR)</option>
                    <option value="global">Global Only (USD)</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleAddSubscriptionCoupon}>
                Create Coupon
              </button>
            </div>

            {/* Coupons List */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 }}>
                Active Coupons ({state.subscriptionCoupons?.length || 0})
              </h4>
              {(!state.subscriptionCoupons || state.subscriptionCoupons.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                  No subscription coupons generated yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', opacity: 0.8 }}>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Code</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Discount</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Region</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Min Plan</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Created At</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.subscriptionCoupons.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace', fontSize: 14 }}>
                            {c.code}
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                            {c.discountType === 'percentage' ? `${c.discountValue}% Off` : `${c.discountValue} Flat Off`}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              background: c.billingRegion === 'IN' ? 'rgba(34, 197, 94, 0.1)' : c.billingRegion === 'global' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.06)',
                              color: c.billingRegion === 'IN' ? 'var(--success)' : c.billingRegion === 'global' ? 'var(--brand)' : 'var(--text-secondary)',
                            }}>
                              {c.billingRegion === 'IN' ? 'India' : c.billingRegion === 'global' ? 'Global' : 'All Regions'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textTransform: 'capitalize' }}>
                            {c.minPlan === 'free' || !c.minPlan ? 'None' : c.minPlan}
                          </td>
                          <td style={{ padding: '10px 8px', opacity: 0.8 }}>
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ borderColor: 'var(--border)', color: 'var(--error)', padding: '4px 8px' }}
                              onClick={() => handleRemoveSubscriptionCoupon(c.id, c.code)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cuisines' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  What's on Your Mind? (Cuisines Manager)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Add, remove, and manage circular cuisine items displayed at the top of the customer home page.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (window.confirm("Are you sure you want to load default popular cuisines? This will overwrite the current list.")) {
                    import('firebase/database').then(({ ref, set, getDatabase }) => {
                      const db = getDatabase();
                      set(ref(db, 'meenufy_config/popularCuisines'), DEFAULT_POPULAR_CUISINES).then(() => {
                        addToast('success', 'Popular cuisines initialized to defaults!');
                      });
                    });
                  }
                }}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                🔄 Load Defaults
              </button>
            </div>

            {/* Create Cuisine Item Form */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 20, marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand)' }}>
                {editingCuisineQuery ? '✏️ Edit Cuisine Item' : '🍕 Add New Cuisine Item'}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="input-group">
                  <label className="input-label">Cuisine Name (Display Label)</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Burger"
                    value={newCuisineName}
                    onChange={e => {
                      setNewCuisineName(e.target.value);
                      if (!newCuisineQuery && !editingCuisineQuery) {
                        setNewCuisineQuery(e.target.value.trim().toLowerCase());
                      }
                    }}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Search Query (Lowercase Keyword)</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. burger"
                    value={newCuisineQuery}
                    onChange={e => setNewCuisineQuery(e.target.value.trim().toLowerCase())}
                  />
                </div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Cuisine Image (URL or Upload File)</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      className="input"
                      type="text"
                      placeholder="Paste Image URL or upload a file"
                      value={newCuisineImage}
                      onChange={e => setNewCuisineImage(e.target.value.trim())}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="file"
                      id="cuisine-img-upload-input"
                      accept="image/*"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        setUploadingCuisineImage(true);
                        try {
                          const reader = new FileReader();
                          reader.readAsDataURL(files[0]);
                          reader.onload = (event) => {
                            const raw = event.target?.result as string;
                            if (originalQuality) {
                              setNewCuisineImage(raw);
                              setUploadingCuisineImage(false);
                              addToast('success', 'Image uploaded successfully (Original Quality)!');
                            } else {
                              compressImage(raw, 500, 500, 0.9)
                                .then(compressed => {
                                  setNewCuisineImage(compressed);
                                  setUploadingCuisineImage(false);
                                  addToast('success', 'Image uploaded and optimized successfully!');
                                })
                                .catch(err => {
                                  console.error(err);
                                  setNewCuisineImage(raw);
                                  setUploadingCuisineImage(false);
                                  addToast('success', 'Image uploaded successfully!');
                                });
                            }
                          };
                        } catch (err) {
                          console.error(err);
                          setUploadingCuisineImage(false);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="cuisine-img-upload-input"
                      className="btn btn-secondary"
                      style={{ height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, fontSize: 12, padding: '0 12px' }}
                    >
                      {uploadingCuisineImage ? 'Uploading...' : '📁 Upload'}
                    </label>
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2', marginTop: -4, marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={originalQuality}
                      onChange={e => setOriginalQuality(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--brand)', cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--text-primary)' }}>⚡ <strong>Show Original Photo Quality</strong> (Skip sizing/compression limits to show full HD original image on Customer App)</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {editingCuisineQuery ? (
                  <>
                    <button
                      className="btn btn-primary"
                      disabled={!newCuisineName.trim() || !newCuisineQuery.trim() || !newCuisineImage}
                      onClick={() => {
                        const list = [...(state.popularCuisines || [])];
                        const idx = list.findIndex(c => c.query === editingCuisineQuery);
                        if (idx !== -1) {
                          if (originalQuality) {
                            list[idx] = {
                              name: newCuisineName.trim(),
                              query: newCuisineQuery.trim(),
                              image: newCuisineImage.trim(),
                              originalQuality: true
                            };
                            dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                            addToast('success', `${newCuisineName} updated successfully (Original Quality)!`);
                          } else {
                            compressImage(newCuisineImage.trim(), 500, 500, 0.9)
                              .then(compressed => {
                                list[idx] = {
                                  name: newCuisineName.trim(),
                                  query: newCuisineQuery.trim(),
                                  image: compressed,
                                  originalQuality: false
                                };
                                dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                                addToast('success', `${newCuisineName} updated and optimized successfully!`);
                              })
                              .catch(err => {
                                console.error(err);
                                list[idx] = {
                                  name: newCuisineName.trim(),
                                  query: newCuisineQuery.trim(),
                                  image: newCuisineImage.trim(),
                                  originalQuality: false
                                };
                                dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                                addToast('success', `${newCuisineName} updated successfully!`);
                              });
                          }
                        }
                        setNewCuisineName('');
                        setNewCuisineQuery('');
                        setNewCuisineImage('');
                        setOriginalQuality(false);
                        setEditingCuisineQuery(null);
                      }}
                    >
                      Save Changes
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setNewCuisineName('');
                        setNewCuisineQuery('');
                        setNewCuisineImage('');
                        setOriginalQuality(false);
                        setEditingCuisineQuery(null);
                      }}
                    >
                      Cancel Edit
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={!newCuisineName.trim() || !newCuisineQuery.trim() || !newCuisineImage}
                    onClick={() => {
                      if (originalQuality) {
                        dispatch({
                          type: 'ADD_POPULAR_CUISINE',
                          payload: {
                            name: newCuisineName.trim(),
                            query: newCuisineQuery.trim(),
                            image: newCuisineImage.trim(),
                            originalQuality: true
                          }
                        });
                        addToast('success', `${newCuisineName} added successfully (Original Quality)!`);
                        setNewCuisineName('');
                        setNewCuisineQuery('');
                        setNewCuisineImage('');
                        setOriginalQuality(false);
                      } else {
                        compressImage(newCuisineImage.trim(), 500, 500, 0.9)
                          .then(compressed => {
                            dispatch({
                              type: 'ADD_POPULAR_CUISINE',
                              payload: {
                                name: newCuisineName.trim(),
                                query: newCuisineQuery.trim(),
                                image: compressed,
                                originalQuality: false
                              }
                            });
                            addToast('success', `${newCuisineName} added and optimized successfully!`);
                          })
                          .catch(err => {
                            console.error(err);
                            dispatch({
                              type: 'ADD_POPULAR_CUISINE',
                              payload: {
                                name: newCuisineName.trim(),
                                query: newCuisineQuery.trim(),
                                image: newCuisineImage.trim(),
                                originalQuality: false
                              }
                            });
                            addToast('success', `${newCuisineName} added successfully!`);
                          })
                          .finally(() => {
                            setNewCuisineName('');
                            setNewCuisineQuery('');
                            setNewCuisineImage('');
                            setOriginalQuality(false);
                          });
                      }
                    }}
                  >
                    Add Cuisine Item
                  </button>
                )}
              </div>
            </div>

            {/* Cuisines Grid */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
                  Active Circular Cuisines ({state.popularCuisines?.length || 0})
                </h4>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={optimizingImages || !state.popularCuisines || state.popularCuisines.length === 0}
                  onClick={handleOptimizeCuisines}
                  style={{ fontSize: 11, padding: '4px 10px', height: 28, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {optimizingImages ? '⏳ Optimizing...' : '⚡ Optimize & Compress Existing Images (~50KB each)'}
                </button>
              </div>
              
              {state.popularCuisines && state.popularCuisines.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 16
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>🌐 Zoom In All Images:</span>
                  <select
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (window.confirm(`Are you sure you want to set the zoom size of all cuisines to ${val}%?`)) {
                        const list = state.popularCuisines.map(item => ({ ...item, zoom: val }));
                        dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                        addToast('success', `Zoom size set to ${val}% for all cuisines!`);
                      }
                    }}
                    defaultValue=""
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="" disabled>Select zoom size...</option>
                    <option value={0}>0% (Normal)</option>
                    <option value={5}>5% Zoom In</option>
                    <option value={10}>10% Zoom In</option>
                    <option value={15}>15% Zoom In</option>
                    <option value={20}>20% Zoom In</option>
                    <option value={25}>25% Zoom In</option>
                    <option value={30}>30% Zoom In</option>
                    <option value={35}>35% Zoom In</option>
                    <option value={40}>40% Zoom In</option>
                    <option value={45}>45% Zoom In</option>
                    <option value={50}>50% Zoom In</option>
                  </select>
                </div>
              )}

              {(!state.popularCuisines || state.popularCuisines.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                  No popular cuisines added yet. Click "Load Defaults" to fill this section.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 16 }}>
                  {state.popularCuisines.map((c, index) => (
                    <div
                      key={c.query}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: 12,
                        textAlign: 'center',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <button
                        title="Delete Cuisine"
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '50%',
                          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#ef4444', cursor: 'pointer', fontSize: 12
                        }}
                        onClick={() => {
                          if (window.confirm(`Delete ${c.name} from Circular Cuisines?`)) {
                            dispatch({ type: 'REMOVE_POPULAR_CUISINE', payload: c.query });
                            addToast('info', `${c.name} deleted.`);
                          }
                        }}
                      >
                        ✕
                      </button>
                      <button
                        title="Edit Cuisine"
                        style={{
                          position: 'absolute', top: 4, left: 4,
                          background: 'rgba(59, 130, 246, 0.1)', border: 'none', borderRadius: '50%',
                          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#3b82f6', cursor: 'pointer', fontSize: 12
                        }}
                        onClick={() => {
                          setNewCuisineName(c.name);
                          setNewCuisineQuery(c.query);
                          setNewCuisineImage(c.image);
                          setOriginalQuality(!!c.originalQuality);
                          setEditingCuisineQuery(c.query);
                        }}
                      >
                        ✏️
                      </button>
                      <div style={{
                        width: 50, height: 50, borderRadius: '50%',
                        border: '1px solid var(--border)', overflow: 'hidden',
                        background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: 8
                      }}>
                        <img
                          src={c.image}
                          alt={c.name}
                          style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            transform: `scale(${1 + (c.zoom || 0) / 100})`,
                            transformOrigin: 'center'
                          }}
                        />
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>q: {c.query}</div>
                      {c.originalQuality && (
                        <div style={{ display: 'inline-block', fontSize: 9, background: 'rgba(255,125,0,0.12)', color: 'var(--brand)', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginTop: 4 }}>
                          ⚡ HD / Original
                        </div>
                      )}
                      
                      <div style={{ width: '100%', marginTop: 2 }}>
                        <select
                          value={c.zoom || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const list = state.popularCuisines.map((item, idx) => {
                              if (idx === index) {
                                return { ...item, zoom: val };
                              }
                              return item;
                            });
                            dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                          }}
                          style={{
                            width: '100%',
                            fontSize: '9px',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value={0}>0% Normal</option>
                          <option value={5}>5% Zoom In</option>
                          <option value={10}>10% Zoom In</option>
                          <option value={15}>15% Zoom In</option>
                          <option value={20}>20% Zoom In</option>
                          <option value={25}>25% Zoom In</option>
                          <option value={30}>30% Zoom In</option>
                          <option value={35}>35% Zoom In</option>
                          <option value={40}>40% Zoom In</option>
                          <option value={45}>45% Zoom In</option>
                          <option value={50}>50% Zoom In</option>
                        </select>
                      </div>
                      
                      {/* Rearrange position controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 6, width: '100%', justifyContent: 'center' }}>
                        <button
                          disabled={index === 0}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 4,
                            color: 'var(--text-primary)', cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: 10, padding: '2px 6px'
                          }}
                          onClick={() => {
                            const list = [...(state.popularCuisines || [])];
                            const temp = list[index];
                            list[index] = list[index - 1];
                            list[index - 1] = temp;
                            dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                          }}
                        >
                          ◀
                        </button>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 800, minWidth: 20 }}>
                          #{index + 1}
                        </span>
                        <button
                          disabled={index === state.popularCuisines.length - 1}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 4,
                            color: 'var(--text-primary)', cursor: index === state.popularCuisines.length - 1 ? 'not-allowed' : 'pointer', fontSize: 10, padding: '2px 6px'
                          }}
                          onClick={() => {
                            const list = [...(state.popularCuisines || [])];
                            const temp = list[index];
                            list[index] = list[index + 1];
                            list[index + 1] = temp;
                            dispatch({ type: 'SET_POPULAR_CUISINES', payload: list });
                          }}
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Manage Subscription Plan Modal */}
      {showManageModal && selectedAccountId && (
        <div className="modal-backdrop" onClick={() => setShowManageModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                Manage Subscription Plan
              </h3>
              <button
                onClick={() => setShowManageModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target Restaurant</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {accounts.find(a => a.id === selectedAccountId)?.restaurantName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {selectedAccountEmail}
              </div>
            </div>

            {/* Plan selection */}
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Subscription Plan</label>
              <select
                className="input"
                value={managePlan}
                onChange={e => setManagePlan(e.target.value as any)}
                style={{ fontSize: 13, fontWeight: 600, height: 36, padding: '4px 8px' }}
              >
                <option value="free">Free Trial (30 Days)</option>
                <option value="base">Standard Plan</option>
                <option value="standard">Advance Plan</option>
              </select>
            </div>

            {/* Orders Placed */}
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Orders Placed This Month</label>
              <input
                className="input"
                type="number"
                min="0"
                value={manageOrdersPlaced}
                onChange={e => setManageOrdersPlaced(Number(e.target.value))}
                style={{ fontSize: 13, fontWeight: 600, height: 36 }}
              />
            </div>

            {/* Billing Country */}
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Billing Region</label>
              <select
                className="input"
                value={manageCountry}
                onChange={e => setManageCountry(e.target.value as any)}
                style={{ fontSize: 13, fontWeight: 600, height: 36, padding: '4px 8px' }}
              >
                <option value="IN">India (INR plans)</option>
                <option value="global">Global (USD plans)</option>
              </select>
            </div>

            {/* Billing Cycle */}
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Billing Cycle</label>
              <select
                className="input"
                value={manageBillingPeriod}
                onChange={e => setManageBillingPeriod(e.target.value as any)}
                style={{ fontSize: 13, fontWeight: 600, height: 36, padding: '4px 8px' }}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Renewal Date */}
            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">Renewal Date</label>
              <input
                className="input"
                type="date"
                value={manageRenewalDate}
                onChange={e => setManageRenewalDate(e.target.value)}
                style={{ fontSize: 13, fontWeight: 600, height: 36 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowManageModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, height: 38 }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplySubscriptionUpdate}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  height: 38,
                  background: 'var(--brand)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: 'none'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
