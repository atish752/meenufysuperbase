import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Mail, Lock, Eye, EyeOff, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { hasFirebaseConfig, auth, googleProvider } from '../../utils/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  updateProfile 
} from 'firebase/auth';

export default function AdminAuth() {
  const { state, dispatch, addToast } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', restaurantName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }
    if (mode === 'signup' && (!form.name || !form.restaurantName)) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    const emailLower = form.email.trim().toLowerCase();

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
        };

        if (mode === 'signup') {
          dispatch({
            type: 'UPDATE_RESTAURANT',
            payload: { name: form.restaurantName || 'My Restaurant' }
          });
        }

        dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });
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
    };

    if (mode === 'signup') {
      dispatch({
        type: 'UPDATE_RESTAURANT',
        payload: { name: form.restaurantName || 'My Restaurant' }
      });
    }

    dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });
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
      };

      if (!existingAccount) {
        dispatch({
          type: 'UPDATE_RESTAURANT',
          payload: { name: `${adminUser.name}'s Restaurant` }
        });
      }

      dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });
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
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 220, height: 80,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <img src="/meenufy_logo_dark.png" alt="Meenufy Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            Your restro's digital staff
          </p>
        </div>

        {/* Card */}
        <div className="card-glass" style={{ borderRadius: 20, padding: '32px 28px' }}>
          {/* Tab Toggle */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'var(--bg-elevated)', borderRadius: 12, padding: 4,
            marginBottom: 28,
          }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '9px 0',
                  borderRadius: 9,
                  fontWeight: 600, fontSize: 14,
                  transition: 'var(--transition)',
                  background: mode === m ? 'var(--brand)' : 'transparent',
                  color: mode === m ? '#000' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {m === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'signup' && (
              <>
                <div className="input-group">
                  <label className="input-label">Your Name</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Restaurant Name</label>
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
              <label className="input-label">Email / Username</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="input-icon" />
                <input
                  className="input"
                  type="text"
                  placeholder="owner@restaurant.com or username"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  style={{ paddingRight: 42 }}
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
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              style={{ marginTop: 8, gap: 8 }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In to Dashboard' : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {hasFirebaseConfig && (
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
          </form>
        </div>

        {/* Secure storage disclaimer */}
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,125,0,0.06)', border: '1px dashed var(--border-brand)', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            🔒 <strong style={{ color: 'var(--brand)' }}>Meenufy Admin</strong> — {hasFirebaseConfig ? 'Your account details are securely managed via Google Firebase Cloud Auth.' : 'Mock Dev Mode: Credentials and data are saved locally in this browser.'}<br />
            Sign up to manage your digital restaurant menu.
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          &copy; 2026 Meenufy. Built for restaurant owners worldwide.
        </p>
      </div>
    </div>
  );
}
