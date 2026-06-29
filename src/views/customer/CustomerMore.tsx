import { useState, useEffect } from 'react';
import { useStore, getActiveRestaurantId, getActiveRestaurantInfo } from '../../context/RealtimeStore';
import { Download, Wifi, Gift, Crown, LogIn, LogOut, User, Lock, Sparkles } from 'lucide-react';
import { hasFirebaseConfig, auth, googleProvider } from '../../utils/firebase';
import { signInWithPopup } from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { db } from '../../utils/firebase';

interface UserLoyaltyRecord {
  restaurantId: string;
  restaurantName: string;
  points: number;
  isVip: boolean;
}

export default function CustomerMore() {
  const { state, dispatch, addToast } = useStore();
  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);

  // Auth Modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [googleStep, setGoogleStep] = useState<'none' | 'details'>('none');

  // Registration Form state
  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUniqueId, setRegUniqueId] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Login Form state
  const [loginInput, setLoginInput] = useState(''); // phone, email, or uniqueId
  const [loginPassword, setLoginPassword] = useState('');

  // Google Temp form state
  const [googleUserTemp, setGoogleUserTemp] = useState<any>(null);

  // Profile edit states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUniqueId, setEditUniqueId] = useState('');

  // Check if logged in
  const [loggedInUser, setLoggedInUser] = useState<any>(() => {
    try {
      const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
      if (savedGoogle) return JSON.parse(savedGoogle);
      const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
      if (savedCustom) return JSON.parse(savedCustom);
      return null;
    } catch {
      return null;
    }
  });

  const isLoggedIn = !!loggedInUser;
  const savedPhone = loggedInUser?.phone || '';
  const customer = state.customers.find(c => c.phone === savedPhone.trim());
  const points = customer ? (customer.points || 0) : 0;
  const isVip = customer ? !!customer.isVip : false;
  const pointVal = points * (restaurant.pointValueInRupees || 1);

  // Multi-restaurant loyalty state
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<UserLoyaltyRecord[]>([]);
  const [isLoadingLoyalty, setIsLoadingLoyalty] = useState(false);

  // Sync state back to local storage loggedInUser
  useEffect(() => {
    const checkUser = () => {
      const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
      const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
      const user = savedGoogle ? JSON.parse(savedGoogle) : (savedCustom ? JSON.parse(savedCustom) : null);
      setLoggedInUser(user);
    };
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  // Fetch loyalty programs from all restaurants
  useEffect(() => {
    if (!isLoggedIn || !savedPhone) {
      setLoyaltyPrograms([]);
      return;
    }

    if (!hasFirebaseConfig || !db) {
      // Mock mode
      const mockPrograms: UserLoyaltyRecord[] = [
        {
          restaurantId: restaurantId,
          restaurantName: restaurant.name || 'Current Restaurant',
          points: points,
          isVip: isVip
        },
        {
          restaurantId: 'admin-2',
          restaurantName: 'Cafe Delight',
          points: 120,
          isVip: false
        },
        {
          restaurantId: 'admin-3',
          restaurantName: 'Pizza Paradiso',
          points: 450,
          isVip: true
        }
      ];
      setLoyaltyPrograms(mockPrograms);
      return;
    }

    setIsLoadingLoyalty(true);
    const accountsRef = ref(db!, 'restaurantAccounts');
    get(accountsRef).then(async (snapshot) => {
      if (snapshot.exists()) {
        const accountsData = snapshot.val();
        const accounts = Object.values(accountsData) as any[];
        
        const programs: UserLoyaltyRecord[] = [];
        const cleanPhone = savedPhone.trim().replace(/[^a-zA-Z0-9]/g, '');

        for (const account of accounts) {
          const restId = account.id;
          const restName = account.restaurantName || account.id;
          
          try {
            const customerRef = ref(db!, `customers/${restId}/${cleanPhone}`);
            const custSnap = await get(customerRef);
            if (custSnap.exists()) {
              const custData = custSnap.val();
              if (custData && (custData.points > 0 || custData.isVip || restId === restaurantId)) {
                programs.push({
                  restaurantId: restId,
                  restaurantName: restName,
                  points: custData.points || 0,
                  isVip: !!custData.isVip
                });
              }
            }
          } catch (err) {
            console.error(`Failed to fetch loyalty for restaurant ${restId}:`, err);
          }
        }
        
        // Ensure current restaurant is at least represented if logged in, even if 0 points
        const hasCurrent = programs.some(p => p.restaurantId === restaurantId);
        if (!hasCurrent) {
          programs.unshift({
            restaurantId: restaurantId,
            restaurantName: restaurant.name || 'Current Restaurant',
            points: points,
            isVip: isVip
          });
        }

        setLoyaltyPrograms(programs);
      } else {
        // Fallback to only current if no other accounts
        setLoyaltyPrograms([{
          restaurantId: restaurantId,
          restaurantName: restaurant.name || 'Current Restaurant',
          points: points,
          isVip: isVip
        }]);
      }
      setIsLoadingLoyalty(false);
    }).catch(err => {
      console.error("Failed to load restaurant accounts for loyalty lookup:", err);
      // Fallback
      setLoyaltyPrograms([{
        restaurantId: restaurantId,
        restaurantName: restaurant.name || 'Current Restaurant',
        points: points,
        isVip: isVip
      }]);
      setIsLoadingLoyalty(false);
    });
  }, [isLoggedIn, savedPhone, restaurantId, points, isVip, restaurant.name]);

  const handleInstallPWA = async () => {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      console.log(`User choice for PWA install: ${outcome}`);
      dispatch({ type: 'SET_STATE', payload: { deferredPrompt: null } });
    } else {
      const msg = 'To install: In Chrome, tap the 3-dot menu → "Add to Home screen" or "Install App". Enjoy the native app experience!';
      alert(msg);
    }
  };

  const handleGoogleSignIn = async () => {
    if (hasFirebaseConfig && auth) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const matched = state.customers.find(c => c.email === user.email);

        if (matched) {
          // Exists already, log them in directly
          const localUser = {
            name: matched.name,
            phone: matched.phone,
            email: matched.email || user.email || '',
            uniqueId: matched.uniqueId || ''
          };
          localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(localUser));
          localStorage.setItem('meenufy_customer_user_logged_in', 'true');
          setLoggedInUser(localUser);
          setShowAuthModal(false);
          addToast('success', `Welcome back, ${matched.name}! Signed in via Google.`);
        } else {
          // New customer, ask for details
          setGoogleUserTemp({
            name: user.displayName || '',
            email: user.email || '',
            googleId: user.uid
          });
          setGoogleStep('details');
        }
      } catch (err: any) {
        console.error(err);
        addToast('error', `Google Sign-In failed: ${err.message}`);
      }
    } else {
      // Mock mode
      setGoogleUserTemp({ name: 'Google Mock User', email: 'google.mock@gmail.com', googleId: 'mock-google-id' });
      setGoogleStep('details');
    }
  };

  const handleGoogleCompleteDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPhone.trim()) {
      addToast('error', 'Phone number is required.');
      return;
    }

    const cleanPhone = regPhone.replace(/[^a-zA-Z0-9]/g, '');
    const matchedPhone = state.customers.find(c => c.phone === regPhone.trim());
    if (matchedPhone && (matchedPhone.googleId || matchedPhone.password)) {
      addToast('error', 'An account with this phone number already exists.');
      return;
    }

    const newUser = {
      name: googleUserTemp.name,
      email: googleUserTemp.email,
      phone: regPhone.trim(),
      uniqueId: regUniqueId.trim() || matchedPhone?.uniqueId || `user_${cleanPhone}`,
      googleId: googleUserTemp.googleId
    };

    localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(newUser));
    localStorage.setItem('meenufy_customer_user_logged_in', 'true');
    setLoggedInUser(newUser);

    // Save/Sync customer to Firebase database
    if (hasFirebaseConfig && db) {
      if (matchedPhone) {
        // Link existing guest account
        const dbCustUpdates = {
          googleId: newUser.googleId,
          name: newUser.name,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          lastVisit: Date.now()
        };
        update(ref(db, `customers/${restaurantId}/${cleanPhone}`), dbCustUpdates)
          .catch(e => console.error("Failed to update Google customer:", e));
      } else {
        const dbCust = {
          id: `cust-${Date.now()}`,
          name: newUser.name,
          phone: newUser.phone,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          googleId: newUser.googleId,
          orderCount: 0,
          totalSpent: 0,
          lastVisit: Date.now(),
          firstVisit: Date.now(),
          points: 0,
          isVip: false
        };
        set(ref(db, `customers/${restaurantId}/${cleanPhone}`), dbCust)
          .catch(e => console.error("Failed to save Google customer:", e));
      }
    }

    setShowAuthModal(false);
    setGoogleStep('none');
    setGoogleUserTemp(null);
    setRegPhone('');
    setRegUniqueId('');
    addToast('success', 'Sign up complete! Welcome to our Loyalty Program!');
  };

  const handleCustomSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !regPhone.trim() || !regPassword.trim()) {
      addToast('error', 'Name, Phone, and Password are required.');
      return;
    }

    const cleanPhone = regPhone.replace(/[^a-zA-Z0-9]/g, '');
    const matchedPhone = state.customers.find(c => c.phone === regPhone.trim());
    if (matchedPhone && (matchedPhone.password || matchedPhone.googleId)) {
      addToast('error', 'An account with this phone number already exists.');
      return;
    }
    if (regUniqueId.trim()) {
      const matchedId = state.customers.find(c => c.uniqueId === regUniqueId.trim());
      if (matchedId && matchedId.phone !== regPhone.trim()) {
        addToast('error', 'This Unique ID is already taken.');
        return;
      }
    }

    const newUser = {
      name: fullName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim() || matchedPhone?.email || '',
      uniqueId: regUniqueId.trim() || matchedPhone?.uniqueId || `user_${cleanPhone}`
    };

    localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(newUser));
    localStorage.setItem('meenufy_customer_user_logged_in', 'true');
    setLoggedInUser(newUser);

    // Save/Sync to Firebase
    if (hasFirebaseConfig && db) {
      if (matchedPhone) {
        // Register existing guest account
        const dbCustUpdates = {
          name: newUser.name,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          password: regPassword.trim(),
          lastVisit: Date.now()
        };
        update(ref(db, `customers/${restaurantId}/${cleanPhone}`), dbCustUpdates)
          .catch(e => console.error("Failed to update custom customer:", e));
      } else {
        const dbCust = {
          id: `cust-${Date.now()}`,
          name: newUser.name,
          phone: newUser.phone,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          password: regPassword.trim(),
          orderCount: 0,
          totalSpent: 0,
          lastVisit: Date.now(),
          firstVisit: Date.now(),
          points: 0,
          isVip: false
        };
        set(ref(db, `customers/${restaurantId}/${cleanPhone}`), dbCust)
          .catch(e => console.error("Failed to save custom customer:", e));
      }
    }

    setShowAuthModal(false);
    setFullName('');
    setRegPhone('');
    setRegEmail('');
    setRegUniqueId('');
    setRegPassword('');
    addToast('success', 'Account created successfully! Welcome!');
  };

  const handleCustomSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !loginPassword.trim()) {
      addToast('error', 'Please enter your login details and password.');
      return;
    }

    const input = loginInput.trim();
    const pass = loginPassword.trim();

    // Look up customer account
    const matched = state.customers.find(c => 
      c.phone === input || 
      c.email === input || 
      c.uniqueId === input
    );

    if (matched) {
      if (!matched.password) {
        addToast('error', 'This account has not set a password yet. Please use the "Sign Up" tab to register.');
        return;
      }

      if (matched.password !== pass) {
        addToast('error', 'Incorrect password. Please try again.');
        return;
      }

      const localUser = {
        name: matched.name,
        phone: matched.phone,
        email: matched.email || '',
        uniqueId: matched.uniqueId || ''
      };

      localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(localUser));
      localStorage.setItem('meenufy_customer_user_logged_in', 'true');
      setLoggedInUser(localUser);
      setShowAuthModal(false);
      setLoginInput('');
      setLoginPassword('');
      addToast('success', `Welcome back, ${matched.name}!`);
    } else {
      addToast('error', 'No registered profile found matching those details.');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('meenufy_customer_google_user');
    localStorage.removeItem('meenufy_customer_logged_in_user');
    localStorage.removeItem('meenufy_customer_user_logged_in');
    setLoggedInUser(null);
    addToast('success', 'Logged out successfully.');
  };

  const handleOpenProfile = () => {
    if (customer) {
      setEditName(customer.name || '');
      setEditPhone(customer.phone || '');
      setEditEmail(customer.email || '');
      setEditUniqueId(customer.uniqueId || '');
      setShowProfileModal(true);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const oldPhone = customer.phone.trim();
    const newPhone = editPhone.trim();
    const oldClean = oldPhone.replace(/[^a-zA-Z0-9]/g, '');
    const newClean = newPhone.replace(/[^a-zA-Z0-9]/g, '');

    if (!editName.trim() || !newPhone) {
      addToast('error', 'Name and Phone number are required.');
      return;
    }

    if (editUniqueId.trim() && editUniqueId.trim() !== customer.uniqueId) {
      const matchedId = state.customers.find(c => c.uniqueId === editUniqueId.trim());
      if (matchedId) {
        addToast('error', 'This Unique ID is already taken.');
        return;
      }
    }

    if (newPhone !== oldPhone) {
      const matchedPhone = state.customers.find(c => c.phone === newPhone);
      if (matchedPhone && (matchedPhone.password || matchedPhone.googleId)) {
        addToast('error', 'An account with this phone number already exists.');
        return;
      }
    }

    const updatedUser = {
      ...customer,
      name: editName.trim(),
      phone: newPhone,
      email: editEmail.trim(),
      uniqueId: editUniqueId.trim() || `user_${newClean}`
    };

    const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
    const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
    if (savedGoogle) {
      localStorage.setItem('meenufy_customer_google_user', JSON.stringify({
        ...JSON.parse(savedGoogle),
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        uniqueId: updatedUser.uniqueId
      }));
    }
    if (savedCustom) {
      localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify({
        ...JSON.parse(savedCustom),
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        uniqueId: updatedUser.uniqueId
      }));
    }
    setLoggedInUser(updatedUser);

    if (hasFirebaseConfig && db) {
      try {
        if (newPhone !== oldPhone) {
          const migratedCustomer = {
            ...customer,
            name: updatedUser.name,
            phone: updatedUser.phone,
            email: updatedUser.email,
            uniqueId: updatedUser.uniqueId,
            lastVisit: Date.now()
          };
          await set(ref(db, `customers/${restaurantId}/${newClean}`), migratedCustomer);
          await set(ref(db, `customers/${restaurantId}/${oldClean}`), null);
        } else {
          const dbCustUpdates = {
            name: updatedUser.name,
            email: updatedUser.email,
            uniqueId: updatedUser.uniqueId,
            lastVisit: Date.now()
          };
          await update(ref(db, `customers/${restaurantId}/${oldClean}`), dbCustUpdates);
        }
        addToast('success', 'Profile updated successfully.');
        setShowProfileModal(false);
      } catch (err: any) {
        console.error("Failed to update profile:", err);
        addToast('error', `Failed to sync profile: ${err.message}`);
      }
    } else {
      addToast('success', 'Profile updated locally (Demo mode).');
      setShowProfileModal(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!customer) return;
    if (hasFirebaseConfig && auth && db) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        const matchedGoogle = state.customers.find(c => c.googleId === user.uid && c.phone !== customer.phone);
        if (matchedGoogle) {
          addToast('error', 'This Google account is already linked to another profile.');
          return;
        }

        const cleanPhone = customer.phone.replace(/[^a-zA-Z0-9]/g, '');
        
        await update(ref(db, `customers/${restaurantId}/${cleanPhone}`), {
          googleId: user.uid,
          email: user.email || customer.email || ''
        });

        const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
        if (savedCustom) {
          const parsed = JSON.parse(savedCustom);
          localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify({
            ...parsed,
            googleId: user.uid,
            email: user.email || parsed.email || ''
          }));
        }
        setLoggedInUser({
          ...loggedInUser,
          googleId: user.uid,
          email: user.email || loggedInUser.email || ''
        });

        addToast('success', 'Google account linked successfully!');
      } catch (err: any) {
        console.error("Google link failed:", err);
        addToast('error', `Google linking failed: ${err.message}`);
      }
    } else {
      addToast('success', 'Google account linked (Demo mode).');
      setLoggedInUser({
        ...loggedInUser,
        googleId: 'mock-linked-google-id'
      });
    }
  };

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
        Info &amp; More
      </h2>

      {/* Loyalty Program Section - always visible */}
      <div style={{ marginBottom: 20 }}>
        {/* Header card - always shown */}
        <div style={{
          marginBottom: 12,
          textAlign: 'center',
          padding: '22px 20px',
          borderRadius: 16,
          border: restaurant.loyaltyEnabled
            ? '1px solid rgba(255, 125, 0, 0.3)'
            : '1px solid var(--border)',
          background: restaurant.loyaltyEnabled
            ? 'linear-gradient(135deg, rgba(255, 125, 0, 0.1) 0%, rgba(0,0,0,0) 100%)'
            : 'var(--bg-elevated)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {restaurant.loyaltyEnabled ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎁</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                Loyalty Rewards Program
              </h3>
              <p style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Earn · Collect · Redeem
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto', maxWidth: 280 }}>
                Every order earns you points. Redeem them for instant discounts on your next visit. Sign in to start earning!
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.5 }}>🔐</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Loyalty Program
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                This restaurant hasn't enabled their loyalty program yet. Check back later!
              </p>
            </>
          )}
        </div>

        {/* Points card — always rendered but locked for guests */}
        <div style={{ position: 'relative' }}>
          {/* Blurred content (points card) */}
          <div style={{
            filter: isLoggedIn ? 'none' : 'blur(6px)',
            pointerEvents: isLoggedIn ? 'auto' : 'none',
            transition: 'filter 0.3s ease',
            userSelect: isLoggedIn ? 'auto' : 'none',
          }}>
            <div className="card" style={{
              marginBottom: 0,
              border: isVip ? '1px solid #ffd700' : (restaurant.loyaltyEnabled ? '1px solid var(--border)' : '1px solid var(--border)'),
              boxShadow: isVip ? '0 0 16px rgba(255, 215, 0, 0.2)' : 'var(--shadow-sm)',
              opacity: restaurant.loyaltyEnabled ? 1 : 0.6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isVip ? '#ffd700' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Gift size={16} color={isVip ? '#ffd700' : 'var(--brand)'} />
                  My Points · {restaurant.name || 'This Restaurant'}
                </div>
                {isVip && (
                  <span style={{
                    background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                    color: '#000',
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Crown size={10} /> VIP MEMBER
                  </span>
                )}
              </div>

              {/* Points display */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12, marginBottom: 12, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Points Balance</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>
                    {isLoggedIn ? points : 250}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 }}>pts</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Cash Value</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                    ₹{isLoggedIn ? pointVal : (250 * (restaurant.pointValueInRupees || 1))}
                  </div>
                </div>
              </div>

              {/* Linked info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                <Sparkles size={12} color="var(--brand)" />
                {isLoggedIn
                  ? <>Linked: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{savedPhone}</span> · Points tracked per restaurant</>
                  : 'Points are tracked separately for each restaurant you visit.'
                }
              </div>
            </div>
          </div>

          {/* Lock overlay — shown only for guests */}
          {!isLoggedIn && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.55)',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              zIndex: 10,
              backdropFilter: 'blur(2px)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,125,0,0.15)',
                border: '1px solid rgba(255,125,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10
              }}>
                <Lock size={22} color="var(--brand)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginBottom: 4 }}>Sign in to View</div>
              <p style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.75)', marginBottom: 14, maxWidth: 200, lineHeight: 1.5 }}>
                Your loyalty points and rewards are waiting. Sign in to see your balance!
              </p>
              <button
                onClick={() => {
                  setAuthTab('signin');
                  setShowAuthModal(true);
                }}
                style={{
                  background: 'var(--brand)',
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '10px 24px',
                  borderRadius: 99,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255,125,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <LogIn size={14} /> Sign In / Sign Up
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoggedIn && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="var(--brand)" />
            Your Loyalty Memberships ({loyaltyPrograms.length})
          </h4>
          {isLoadingLoyalty ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              Loading programs...
            </div>
          ) : loyaltyPrograms.length === 0 ? (
            <div style={{ padding: '16px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              No loyalty memberships found yet. Order to start earning!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loyaltyPrograms.map((prog) => {
                const isCurrent = prog.restaurantId === restaurantId;
                return (
                  <div 
                    key={prog.restaurantId}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: isCurrent ? 'linear-gradient(135deg, rgba(255, 125, 0, 0.08) 0%, rgba(0,0,0,0) 100%)' : 'var(--bg-elevated)',
                      border: isCurrent ? '1px solid rgba(255, 125, 0, 0.4)' : '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: isCurrent ? '0 2px 10px rgba(255,125,0,0.05)' : 'none'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {prog.restaurantName}
                        {isCurrent && (
                          <span style={{ fontSize: 9, background: 'var(--brand)', color: '#000', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                            ACTIVE OUTLET
                          </span>
                        )}
                        {prog.isVip && (
                          <span style={{ color: '#ffd700', display: 'inline-flex', alignItems: 'center' }}>
                            <Crown size={11} />
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Outlet ID: {prog.restaurantId}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: isCurrent ? 'var(--brand)' : 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {prog.points} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Account Login / Signout button */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--brand-dim)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <User size={18} color="var(--brand)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isLoggedIn ? `Welcome, ${loggedInUser.name}` : 'Guest Profile'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {isLoggedIn ? `Linked: ${loggedInUser.phone}` : 'Sign in to access order history & loyalty points.'}
            </div>
          </div>
        </div>

        {isLoggedIn ? (
          <button
            onClick={handleSignOut}
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--error)', borderColor: 'var(--error)', background: 'transparent', height: 32, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        ) : (
          <button
            onClick={() => {
              setAuthTab('signin');
              setShowAuthModal(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ background: 'var(--brand)', color: '#000', height: 32, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
          >
            <LogIn size={13} /> Sign In
          </button>
        )}
      </div>

      {isLoggedIn && customer && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
            👤 Profile Settings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Name</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Phone</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.phone}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Email</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.email || 'Not provided'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Username / Unique ID</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.uniqueId || 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Google Link</span>
              <span style={{ color: customer.googleId ? 'var(--brand)' : 'var(--text-muted)', fontWeight: 600 }}>
                {customer.googleId ? '✅ Linked' : '❌ Not Linked'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleOpenProfile}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, fontSize: 11, fontWeight: 700 }}
              >
                Edit Profile details
              </button>
              {!customer.googleId && (
                <button
                  onClick={handleLinkGoogle}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, fontSize: 11, fontWeight: 800, background: 'var(--brand)', color: '#000' }}
                >
                  Link Google Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Install PWA */}
      <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 6 }}>Install this App</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Add to your home screen for quick access<br />and a native app experience.
        </p>
        <button className="btn btn-secondary btn-full" onClick={handleInstallPWA}>
          <Download size={14} /> Add to Home Screen
        </button>
      </div>

      {/* Powered by */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 99,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        }}>
          <Wifi size={12} color="var(--brand)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            Powered by <span style={{ color: 'var(--brand)' }}>Meenufy</span> — A hassle-free way
          </span>
        </div>
      </div>

      {/* CUSTOM AUTH MODAL */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="var(--brand)" />
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Customer Authentication</h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowAuthModal(false); setGoogleStep('none'); }} style={{ padding: 4 }}>
                &times;
              </button>
            </div>

            {googleStep === 'details' ? (
              <form onSubmit={handleGoogleCompleteDetailsSubmit}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Google Authentication Success!</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Logged in as: {googleUserTemp.name} ({googleUserTemp.email})</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Please link a phone number and optionally choose a Unique ID (username) to unlock rewards.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div className="input-group">
                    <label className="input-label">Phone Number (Required)</label>
                    <input className="input" type="tel" required placeholder="+91 98765 43210" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Unique ID / Username (Optional)</label>
                    <input className="input" type="text" placeholder="e.g. ananya_99" value={regUniqueId} onChange={e => setRegUniqueId(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38 }}>
                  Complete Profile &amp; Register
                </button>
              </form>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 4, marginBottom: 20 }}>
                  <button
                    onClick={() => setAuthTab('signin')}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: authTab === 'signin' ? 'var(--brand)' : 'transparent',
                      color: authTab === 'signin' ? '#000000' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >Sign In</button>
                  <button
                    onClick={() => setAuthTab('signup')}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: authTab === 'signup' ? 'var(--brand)' : 'transparent',
                      color: authTab === 'signup' ? '#000000' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >Sign Up</button>
                </div>

                {authTab === 'signin' ? (
                  <form onSubmit={handleCustomSignIn}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                      <div className="input-group">
                        <label className="input-label">Phone, Email or Unique ID</label>
                        <div style={{ position: 'relative' }}>
                          <User size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
                          <input className="input" style={{ paddingLeft: 32 }} type="text" required placeholder="Phone, email, or unique ID" value={loginInput} onChange={e => setLoginInput(e.target.value)} />
                        </div>
                      </div>
                      <div className="input-group">
                        <label className="input-label">Password</label>
                        <div style={{ position: 'relative' }}>
                          <Lock size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
                          <input className="input" style={{ paddingLeft: 32 }} type="password" required placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38, marginBottom: 16 }}>
                      Sign In
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleCustomSignUp}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                      <div className="input-group">
                        <label className="input-label">Full Name *</label>
                        <input className="input" type="text" required placeholder="Ananya Patel" value={fullName} onChange={e => setFullName(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Phone Number *</label>
                        <input className="input" type="tel" required placeholder="+91 98765 43210" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Email (Optional)</label>
                        <input className="input" type="email" placeholder="ananya@gmail.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Unique ID / Username (Optional)</label>
                        <input className="input" type="text" placeholder="ananya_99" value={regUniqueId} onChange={e => setRegUniqueId(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Password *</label>
                        <input className="input" type="password" required placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38, marginBottom: 16 }}>
                      Sign Up &amp; Register
                    </button>
                  </form>
                )}

                {/* Google SSO divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--text-muted)', fontSize: 11 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  className="btn btn-secondary btn-full"
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 12, fontWeight: 700, padding: '9px 0', borderRadius: 99,
                    cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border)'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* PROFILE EDIT MODAL */}
      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Edit Profile details</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowProfileModal(false)} style={{ padding: 4 }}>
                &times;
              </button>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div className="input-group">
                  <label className="input-label">Full Name *</label>
                  <input className="input" type="text" required value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Phone Number *</label>
                  <input className="input" type="tel" required value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unique ID / Username</label>
                  <input className="input" type="text" value={editUniqueId} onChange={e => setEditUniqueId(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38 }}>
                Save Profile changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
