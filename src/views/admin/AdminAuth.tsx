import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Eye, EyeOff } from 'lucide-react';
import { hasFirebaseConfig, auth, googleProvider, db } from '../../utils/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  updateProfile 
} from 'firebase/auth';

export default function AdminAuth() {
  const { state, dispatch, addToast } = useStore();
  const [authPortal, setAuthPortal] = useState<'manager' | 'delivery'>('manager');
  const [mode, setMode] = useState<'login' | 'signup' | 'staff_login'>('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [staffForm, setStaffForm] = useState({ username: '', password: '' });

  const [form, setForm] = useState({
    name: '', email: '', password: '', restaurantName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }
    if (authPortal === 'manager' && mode === 'signup' && (!form.name || !form.restaurantName)) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    const emailLower = form.email.trim().toLowerCase();

    // 0. Delivery Boy Login Portal Check
    if (authPortal === 'delivery') {
      try {
        let matchedBoy: any = null;
        if (hasFirebaseConfig && auth && db) {
          const { ref, get } = await import('firebase/database');
          const snapshot = await get(ref(db, 'deliveryBoys'));
          if (snapshot.exists()) {
            const data = snapshot.val();
            const boyList = Object.values(data) as any[];
            matchedBoy = boyList.find(
              b => b.username && b.username.trim().toLowerCase() === emailLower
            );
          }
        } else {
          matchedBoy = state.deliveryBoys?.find(
            b => b.username.trim().toLowerCase() === emailLower
          );
        }

        if (!matchedBoy) {
          addToast('error', '❌ No delivery rider found with this username.');
          setLoading(false);
          return;
        }

        if (matchedBoy.password !== form.password) {
          addToast('error', '❌ Incorrect password.');
          setLoading(false);
          return;
        }

        const riderUser = {
          id: matchedBoy.id,
          name: matchedBoy.name,
          email: matchedBoy.username,
          restaurantId: matchedBoy.restaurantId,
          isLoggedIn: true,
          isDeliveryBoy: true
        };

        dispatch({ type: 'LOGIN_ADMIN', payload: riderUser });
        addToast('success', `Welcome back, Rider ${riderUser.name}! 🛵`);
        setLoading(false);
        return;
      } catch (err: any) {
        console.error('Rider Login Error:', err);
        addToast('error', `❌ Rider login failed: ${err.message || err}`);
        setLoading(false);
        return;
      }
    }

    // 0. Staff Member Login Portal Check (Manager portal checks for staff username first)
    if (authPortal === 'manager') {
      try {
        let matchedStaff: any = null;
        if (hasFirebaseConfig && auth && db) {
          const { ref, get } = await import('firebase/database');
          const snapshot = await get(ref(db, 'staffMembers'));
          if (snapshot.exists()) {
            const data = snapshot.val();
            const staffList = Object.values(data) as any[];
            matchedStaff = staffList.find(
              s => s.username && s.username.trim().toLowerCase() === emailLower
            );
          }
        } else {
          matchedStaff = state.staffMembers?.find(
            s => s.username.trim().toLowerCase() === emailLower
          );
        }

        if (matchedStaff) {
          if (matchedStaff.password !== form.password) {
            addToast('error', '❌ Incorrect staff password.');
            setLoading(false);
            return;
          }
          const ownerAcc = state.restaurantAccounts?.find(acc => acc.id === matchedStaff.restaurantId);
          if (ownerAcc && ownerAcc.status === 'blocked') {
            addToast('error', '❌ Your restaurant outlet account has been blocked. Please contact support@meenufy.com');
            setLoading(false);
            return;
          }
          const staffUser = {
            id: matchedStaff.id,
            name: matchedStaff.name,
            email: matchedStaff.username,
            restaurantId: matchedStaff.restaurantId,
            isLoggedIn: true,
            isStaff: true,
            permissions: matchedStaff.permissions || []
          };
          dispatch({ type: 'LOGIN_ADMIN', payload: staffUser });
          addToast('success', `Welcome back, Staff ${staffUser.name}! 🎉`);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Staff match check error:', err);
      }
    }

    // 1. Super Admin Check
    if (emailLower === 'atish752') {
      if (form.password === 'UHI(*Y90Jjk0JKop:ki-0PIkj9OP0') {
        const superUser = {
          id: 'super-admin-atish',
          name: 'Atish (Super Admin)',
          email: 'atish752',
          restaurantId: 'super-admin',
          isLoggedIn: true,
          isSuperAdmin: true,
        };
        dispatch({ type: 'LOGIN_ADMIN', payload: superUser });
        addToast('success', 'Welcome, Super Admin Atish! 👑');
        setLoading(false);
        return;
      } else {
        addToast('error', '❌ Incorrect password for Super Admin.');
        setLoading(false);
        return;
      }
    }

    // 2. Firebase Auth Flow (if active)
    if (hasFirebaseConfig && auth) {
      try {
        let userCredential;
        if (mode === 'signup') {
          userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
          if (userCredential.user) {
            await updateProfile(userCredential.user, { displayName: form.name });
          }
        } else {
          userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
        }

        const fbUser = userCredential.user;
        const fbEmail = fbUser.email?.trim().toLowerCase() || '';
        
        let resolvedAdminId = fbUser.uid;
        if (fbEmail === 'atish3477@gmail.com' || fbEmail === 'atish3477') {
          resolvedAdminId = 'admin-1';
        } else {
          const existingAccount = state.restaurantAccounts?.find(
            acc => acc.id === fbUser.uid || 
            acc.ownerEmail.trim().toLowerCase() === fbEmail
          );
          if (existingAccount) {
            resolvedAdminId = existingAccount.id;
          }
        }

        const existingAccountForBlock = state.restaurantAccounts?.find(
          acc => acc.id === resolvedAdminId || 
          acc.ownerEmail.trim().toLowerCase() === fbEmail
        );
        if (existingAccountForBlock && existingAccountForBlock.status === 'blocked') {
          addToast('error', '❌ Your account has been blocked. Please contact support@meenufy.com');
          setLoading(false);
          await auth.signOut();
          return;
        }

        const adminUser = {
          id: resolvedAdminId,
          name: form.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Owner',
          email: fbUser.email || form.email,
          restaurantId: resolvedAdminId,
          isLoggedIn: true,
          isFirebaseUser: true,
          restaurantName: form.restaurantName || existingAccountForBlock?.restaurantName || 'My Restaurant',
          ownerPhone: existingAccountForBlock?.ownerPhone || fbUser.phoneNumber || state.restaurant.phone || '+91 99999 88888',
        };

        dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });

        if (mode === 'signup') {
          dispatch({
            type: 'UPDATE_RESTAURANT',
            payload: { name: form.restaurantName || 'My Restaurant' }
          });
        }
        // For new signups: mark onboarding as not yet completed so they see the onboarding flow
        if (mode === 'signup') {
          dispatch({ type: 'MARK_ONBOARDING_PENDING' });
        }
        addToast('success', mode === 'signup' ? `Account created! Welcome, ${adminUser.name}! 🎉` : `Welcome back, ${adminUser.name}! 🎉`);
      } catch (err: any) {
        let errMsg = err.message || 'Authentication failed.';
        if (err.code === 'auth/email-already-in-use') errMsg = 'This email is already in use.';
        if (err.code === 'auth/wrong-password') errMsg = 'Incorrect password.';
        if (err.code === 'auth/user-not-found') errMsg = 'No account found with this email.';
        if (err.code === 'auth/invalid-credential') errMsg = 'Invalid email or password.';
        addToast('error', `❌ ${errMsg}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 3. Fallback Local storage authentication
    const existingAccount = state.restaurantAccounts?.find(
      acc => acc.ownerEmail.trim().toLowerCase() === emailLower ||
      (acc.ownerEmail.trim().toLowerCase() === 'atish3477' && emailLower === 'atish3477@gmail.com')
    );

    if (existingAccount) {
      if (existingAccount.status === 'blocked') {
        addToast('error', '❌ Your account has been blocked. Please contact support@meenufy.com');
        setLoading(false);
        return;
      }

      // Password check for existing accounts
      if (mode === 'login') {
        if (existingAccount.password && existingAccount.password !== form.password) {
          addToast('error', '❌ Incorrect password.');
          setLoading(false);
          return;
        }
      }
    } else {
      // If trying to log in but account doesn't exist, block
      if (mode === 'login') {
        addToast('error', '❌ Account does not exist. Please Sign Up first.');
        setLoading(false);
        return;
      }
    }

    let adminId = existingAccount ? existingAccount.id : `admin-${Date.now()}`;
    if (emailLower === 'atish3477' || emailLower === 'atish3477@gmail.com') {
      adminId = 'admin-1';
    }
    const adminUser = {
      id: adminId,
      name: existingAccount ? existingAccount.ownerName : (form.name || form.email.split('@')[0]),
      email: form.email,
      restaurantId: adminId,
      isLoggedIn: true,
      password: form.password,
      restaurantName: form.restaurantName || existingAccount?.restaurantName || 'My Restaurant',
      ownerPhone: existingAccount?.ownerPhone || state.restaurant.phone || '+91 99999 88888',
    };

    dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });

    if (mode === 'signup') {
      dispatch({
        type: 'UPDATE_RESTAURANT',
        payload: { name: form.restaurantName || 'My Restaurant' }
      });
    }
    // For new signups: mark onboarding as not yet completed
    if (mode === 'signup' && !existingAccount) {
      dispatch({ type: 'MARK_ONBOARDING_PENDING' });
    }
    addToast('success', existingAccount ? `Welcome back, ${adminUser.name}! 🎉` : `Account created! Welcome, ${adminUser.name}! 🎉`);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const adminId = fbUser.uid;
      const fbEmail = fbUser.email?.trim().toLowerCase() || '';

      let resolvedAdminId = adminId;
      const existingAccount = state.restaurantAccounts?.find(
        acc => acc.id === adminId || 
        acc.ownerEmail.trim().toLowerCase() === fbEmail ||
        ((fbEmail === 'atish3477@gmail.com' || fbEmail === 'atish3477') && (acc.id === 'admin-1' || acc.ownerEmail.trim().toLowerCase() === 'atish3477'))
      );

      if (fbEmail === 'atish3477@gmail.com' || fbEmail === 'atish3477') {
        resolvedAdminId = 'admin-1';
      } else if (existingAccount) {
        resolvedAdminId = existingAccount.id;
      }

      if (existingAccount && existingAccount.status === 'blocked') {
        addToast('error', '❌ Your account has been blocked. Please contact support@meenufy.com');
        setLoading(false);
        await auth.signOut();
        return;
      }

      const adminUser = {
        id: resolvedAdminId,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Owner',
        email: fbUser.email || '',
        restaurantId: resolvedAdminId,
        isLoggedIn: true,
        isFirebaseUser: true,
        restaurantName: existingAccount?.restaurantName || `${fbUser.displayName || 'My'}'s Restaurant`,
        ownerPhone: existingAccount?.ownerPhone || fbUser.phoneNumber || '+91 99999 88888',
      };

      dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });

      if (!existingAccount) {
        dispatch({
          type: 'UPDATE_RESTAURANT',
          payload: { name: `${adminUser.name}'s Restaurant` }
        });
      }
      addToast('success', `Welcome back, ${adminUser.name}! 🎉`);
    } catch (err: any) {
      console.error(err);
      addToast('error', `❌ Google sign-in failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background radial glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255,125,0,0.12) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(255,125,0,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>
            Hideout Access
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
            Select portal and sign in
          </p>
        </div>

        {/* Card */}
        <div className="card-glass" style={{ borderRadius: 24, padding: '32px 28px', background: '#111111', border: '1px solid var(--border)' }}>
          
          {/* Portal Switcher */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 16, padding: 4,
            marginBottom: 28,
          }}>
            <button
              type="button"
              onClick={() => {
                setAuthPortal('manager');
                setMode('login');
                setForm({ name: '', email: '', password: '', restaurantName: '' });
              }}
              style={{
                flex: 1, padding: '12px 0',
                borderRadius: 12,
                fontWeight: 700, fontSize: 13.5,
                transition: 'var(--transition)',
                background: authPortal === 'manager' ? '#FF6B35' : 'transparent',
                color: authPortal === 'manager' ? '#FFFFFF' : '#A3A3A3',
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              🛡️ Manager
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthPortal('delivery');
                setForm({ name: '', email: '', password: '', restaurantName: '' });
              }}
              style={{
                flex: 1, padding: '12px 0',
                borderRadius: 12,
                fontWeight: 700, fontSize: 13.5,
                transition: 'var(--transition)',
                background: authPortal === 'delivery' ? '#9D4EDD' : 'transparent',
                color: authPortal === 'delivery' ? '#FFFFFF' : '#A3A3A3',
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              🚚 Delivery App
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {authPortal === 'manager' && mode === 'signup' && (
              <>
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>YOUR NAME</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>RESTAURANT NAME</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. The Grand Spice"
                    value={form.restaurantName}
                    onChange={e => setForm({ ...form, restaurantName: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="input-group">
              <label className="input-label" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>EMAIL ID</label>
              <input
                className="input"
                type="text"
                placeholder={authPortal === 'delivery' ? 'delivery@example.com' : 'admin@hideoutcafe.com'}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  style={{ paddingRight: 42, width: '100%' }}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-full"
              disabled={loading}
              style={{
                marginTop: 12,
                height: 48,
                borderRadius: 24,
                background: authPortal === 'delivery' ? '#9D4EDD' : '#FF6B35',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                'SIGN IN'
              )}
            </button>

            {authPortal === 'manager' && hasFirebaseConfig && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-full btn-lg"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Google Sign-In</span>
                </button>
              </>
            )}

            {authPortal === 'manager' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    style={{ background: 'none', border: 'none', color: '#FF6B35', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                  >
                    {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                  </button>
                </div>

                {/* Staff Member Sign In */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowStaffPanel(v => !v)}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: showStaffPanel ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${showStaffPanel ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      color: showStaffPanel ? '#A855F7' : 'var(--text-secondary)',
                      fontWeight: 700, fontSize: 12.5,
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>👤 Staff Member? Sign in here</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{showStaffPanel ? '▲' : '▼'}</span>
                  </button>

                  {showStaffPanel && (
                    <div style={{
                      marginTop: 10, padding: '14px',
                      background: 'rgba(168,85,247,0.05)',
                      border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: 12,
                      display: 'flex', flexDirection: 'column', gap: 12,
                      animation: 'fadeIn 0.2s ease'
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#A855F7', letterSpacing: '0.04em' }}>
                        🛡️ STAFF LOGIN — Use your staff ID and password provided by the restaurant owner.
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>STAFF USERNAME</label>
                        <input
                          className="input"
                          type="text"
                          placeholder="e.g. john_staff"
                          value={staffForm.username}
                          onChange={e => setStaffForm({ ...staffForm, username: e.target.value })}
                          style={{ borderColor: 'rgba(168,85,247,0.3)' }}
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>STAFF PASSWORD</label>
                        <input
                          className="input"
                          type="password"
                          placeholder="••••••••"
                          value={staffForm.password}
                          onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                          style={{ borderColor: 'rgba(168,85,247,0.3)' }}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={loading || !staffForm.username || !staffForm.password}
                        onClick={async () => {
                          if (!staffForm.username || !staffForm.password) return;
                          setLoading(true);
                          const uname = staffForm.username.trim().toLowerCase();
                          try {
                            let matchedStaff: any = null;
                            if (hasFirebaseConfig && auth && db) {
                              const { ref, get } = await import('firebase/database');
                              const snapshot = await get(ref(db, 'staffMembers'));
                              if (snapshot.exists()) {
                                const data = snapshot.val();
                                matchedStaff = Object.values(data as Record<string, any>).find(
                                  (s: any) => s.username && s.username.trim().toLowerCase() === uname
                                );
                              }
                            } else {
                              matchedStaff = state.staffMembers?.find(
                                s => s.username.trim().toLowerCase() === uname
                              );
                            }
                            if (!matchedStaff) {
                              addToast('error', '❌ No staff account found with this username.');
                              setLoading(false);
                              return;
                            }
                            if (matchedStaff.password !== staffForm.password) {
                              addToast('error', '❌ Incorrect staff password.');
                              setLoading(false);
                              return;
                            }
                            dispatch({ type: 'LOGIN_ADMIN', payload: {
                              id: matchedStaff.id,
                              name: matchedStaff.name,
                              email: matchedStaff.username,
                              restaurantId: matchedStaff.restaurantId,
                              isLoggedIn: true,
                              isStaff: true,
                              permissions: matchedStaff.permissions || []
                            }});
                            addToast('success', `Welcome, ${matchedStaff.name}! 🎉`);
                          } catch (err: any) {
                            addToast('error', `❌ Staff login failed: ${err.message || err}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        style={{
                          height: 42, borderRadius: 10,
                          background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                          color: '#FFFFFF', fontWeight: 800, fontSize: 13,
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          opacity: loading || !staffForm.username || !staffForm.password ? 0.6 : 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        {loading ? (
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                        ) : (
                          '🛡️ Sign in as Staff Member'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Secure storage disclaimer */}
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,125,0,0.06)', border: '1px dashed var(--border-brand)', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            🔒 <strong style={{ color: 'var(--brand)' }}>Meenufy Admin</strong> — {hasFirebaseConfig ? 'Your account details are securely managed via Google Firebase Cloud Auth.' : 'Mock Dev Mode: Credentials and data are saved locally in this browser.'}<br />
            Sign up to manage your digital restaurant menu.
          </p>
        </div>

        {/* Tutorial / Demo Video Link */}
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(255,125,0,0.1)',
          border: '1px solid rgba(255,125,0,0.2)',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 16 }}>📺</span>
          <a
            href="https://youtu.be/guUt96vqUcM?si=L3aLUBWrZ0yNpvMj"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: 'var(--brand)',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            Watch Meenufy Tutorial & Demo Video &rarr;
          </a>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          &copy; 2026 Meenufy. Built for restaurant owners worldwide.
        </p>
      </div>
    </div>
  );
}
