import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Eye, EyeOff } from 'lucide-react';
import { hasFirebaseConfig } from '../../utils/firebase';
import { signUpUser, signInUser, signOutUser, dbGet, supabase as supabaseClient } from '../../utils/supabase';

export default function AdminAuth() {
  const { state, dispatch, addToast } = useStore();
  const [mode, setMode] = useState<'login' | 'signup' | 'staff' | 'delivery'>('login');
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

    // 0. Delivery Boy Login Portal Check
    if (mode === 'delivery') {
      try {
        let matchedBoy: any = null;
        if (hasFirebaseConfig) {
          const data = await dbGet('deliveryBoys');
          if (data) {
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

    // 1. Staff Member Login Portal Check
    if (mode === 'staff') {
      try {
        let matchedStaff: any = null;
        if (hasFirebaseConfig) {
          const data = await dbGet('staffMembers');
          if (data) {
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
        } else {
          addToast('error', '❌ No staff account found with this username.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Staff match check error:', err);
        addToast('error', '❌ Staff login failed.');
        setLoading(false);
        return;
      }
    }

    // 2. Super Admin Check
    if (emailLower === 'atish752' || emailLower.startsWith('atish752@') || emailLower.includes('atish752')) {
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

    // 3. Supabase Auth Flow (Owner / Admin)
    if (hasFirebaseConfig) {
      try {
        let sbUser: any = null;
        if (mode === 'signup') {
          const { data, error } = await signUpUser(form.email, form.password, form.name);
          if (error) throw error;
          sbUser = data?.user;
        } else {
          const { data, error } = await signInUser(form.email, form.password);
          if (error) throw error;
          sbUser = data?.user;
        }

        const fbUser = sbUser;
        const fbEmail = fbUser?.email?.trim().toLowerCase() || '';

        let resolvedAdminId = fbUser?.id || fbEmail;
        let dbMatchedAccount: any = null;

        if (fbUser) {
          try {
            const allAccountsObj = await dbGet('restaurantAccounts');
            if (allAccountsObj) {
              if (allAccountsObj[fbUser.id]) {
                resolvedAdminId = fbUser.id;
                dbMatchedAccount = { ...allAccountsObj[fbUser.id], id: fbUser.id };
              } else {
                const matchedEntry = Object.entries(allAccountsObj).find(
                  ([_, acc]: [string, any]) => acc.ownerEmail?.trim().toLowerCase() === fbEmail
                );
                if (matchedEntry) {
                  resolvedAdminId = matchedEntry[0];
                  dbMatchedAccount = { ...(matchedEntry[1] as any), id: matchedEntry[0] };
                }
              }
            }
          } catch (dbErr) {
            console.error('Error pre-fetching restaurant account during login:', dbErr);
          }
        }

        // Fallback search in memory state if database read is skipped or failed
        if (!dbMatchedAccount) {
          const localAcc = state.restaurantAccounts?.find(
            acc => acc.id === fbUser?.id || acc.ownerEmail?.trim().toLowerCase() === fbEmail
          );
          if (localAcc) {
            resolvedAdminId = localAcc.id;
            dbMatchedAccount = localAcc;
          }
        }

        if (dbMatchedAccount && dbMatchedAccount.status === 'blocked') {
          addToast('error', '❌ Your account has been blocked. Please contact support@meenufy.com');
          setLoading(false);
          await signOutUser();
          return;
        }

        const adminUser = {
          id: resolvedAdminId,
          name: form.name || fbUser?.user_metadata?.full_name || fbUser?.email?.split('@')[0] || 'Owner',
          email: fbUser?.email || form.email,
          restaurantId: resolvedAdminId,
          isLoggedIn: true,
          isFirebaseUser: true,
          restaurantName: form.restaurantName || dbMatchedAccount?.restaurantName || 'My Restaurant',
          ownerPhone: dbMatchedAccount?.ownerPhone || fbUser?.phone || state.restaurant.phone || '+91 99999 88888',
          existingAccount: dbMatchedAccount || undefined
        };

        dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });

        if (mode === 'signup') {
          dispatch({
            type: 'UPDATE_RESTAURANT',
            payload: { name: form.restaurantName || 'My Restaurant' }
          });
          dispatch({ type: 'MARK_ONBOARDING_PENDING' });
        }
        addToast('success', mode === 'signup' ? `Account created! Welcome, ${adminUser.name}! 🎉` : `Welcome back, ${adminUser.name}! 🎉`);
      } catch (err: any) {
        let errMsg = err.message || 'Authentication failed.';
        if (err.message?.includes('already registered') || err.message?.includes('User already registered')) {
          setMode('login');
          setForm(prev => ({ ...prev, name: '', restaurantName: '' }));
          addToast('info', '📧 This email already has an account. Switched to Sign In — just enter your password!');
          setLoading(false);
          return;
        }
        if (err.message?.includes('Invalid login credentials')) errMsg = 'Invalid email or password.';
        addToast('error', `❌ ${errMsg}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 4. Fallback Local storage authentication
    const existingAccount = state.restaurantAccounts?.find(
      acc => acc.ownerEmail?.trim().toLowerCase() === emailLower ||
      (acc.ownerEmail?.trim().toLowerCase() === 'atish3477' && emailLower === 'atish3477@gmail.com')
    );

    if (existingAccount) {
      if (existingAccount.status === 'blocked') {
        addToast('error', '❌ Your account has been blocked. Please contact support@meenufy.com');
        setLoading(false);
        return;
      }

      if (mode === 'login') {
        if (existingAccount.password && existingAccount.password !== form.password) {
          addToast('error', '❌ Incorrect password.');
          setLoading(false);
          return;
        }
      }
    } else {
      if (mode === 'login') {
        addToast('error', '❌ Account does not exist. Please Sign Up first.');
        setLoading(false);
        return;
      }
    }

    let adminId = existingAccount ? existingAccount.id : `admin-${Date.now()}`;

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
      if (!existingAccount) {
        dispatch({ type: 'MARK_ONBOARDING_PENDING' });
      }
    }
    addToast('success', existingAccount ? `Welcome back, ${adminUser.name}! 🎉` : `Account created! Welcome, ${adminUser.name}! 🎉`);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!supabaseClient) return;
    setLoading(true);
    try {
      localStorage.setItem('meenufy_auth_role', 'admin');
      const { error: oauthError } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname + window.location.search
        }
      });
      if (oauthError) throw oauthError;
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const fbUser = sessionData?.session?.user;
      if (!fbUser) { setLoading(false); return; }
      const adminId = fbUser.id;
      const fbEmail = fbUser.email?.trim().toLowerCase() || '';

      let resolvedAdminId = adminId;
      let dbMatchedAccount: any = null;

      try {
        const allAccountsObj = await dbGet('restaurantAccounts');
        if (allAccountsObj) {
          if (allAccountsObj[adminId]) {
            resolvedAdminId = adminId;
            dbMatchedAccount = { ...allAccountsObj[adminId], id: adminId };
          } else {
            const matchedEntry = Object.entries(allAccountsObj).find(
              ([_, acc]: [string, any]) => acc.ownerEmail?.trim().toLowerCase() === fbEmail
            );
            if (matchedEntry) {
              resolvedAdminId = matchedEntry[0];
              dbMatchedAccount = { ...(matchedEntry[1] as any), id: matchedEntry[0] };
            }
          }
        }
      } catch (dbErr) {
        console.error('Error pre-fetching restaurant account during Google login:', dbErr);
      }

      // Fallback search in memory state if database read is skipped or failed
      if (!dbMatchedAccount) {
        const localAcc = state.restaurantAccounts?.find(
          acc => acc.id === adminId || acc.ownerEmail?.trim().toLowerCase() === fbEmail
        );
        if (localAcc) {
          resolvedAdminId = localAcc.id;
          dbMatchedAccount = localAcc;
        }
      }

      if (dbMatchedAccount && dbMatchedAccount.status === 'blocked') {
        addToast('error', '❌ Your account has been blocked. Please contact support@meenufy.com');
        setLoading(false);
        await signOutUser();
        return;
      }

      const adminUser = {
        id: resolvedAdminId,
        name: fbUser.user_metadata?.full_name || fbUser.email?.split('@')[0] || 'Owner',
        email: fbUser.email || '',
        restaurantId: resolvedAdminId,
        isLoggedIn: true,
        isFirebaseUser: true,
        restaurantName: dbMatchedAccount?.restaurantName || `${fbUser.user_metadata?.full_name || 'My'}'s Restaurant`,
        ownerPhone: dbMatchedAccount?.ownerPhone || fbUser.phone || '+91 99999 88888',
        existingAccount: dbMatchedAccount || undefined
      };

      dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });

      if (!dbMatchedAccount) {
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

  const handlePortalSwitch = (target: 'staff' | 'delivery') => {
    setMode(target);
    setForm({ name: '', email: '', password: '', restaurantName: '' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background radial glows */}
      <div style={{
        position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255,125,0,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-elevated)',
            boxShadow: '0 8px 30px rgba(255, 125, 0, 0.15)',
            border: '1px solid var(--border)',
            marginBottom: 14
          }}>
            <img src="/meenufy_logo_dark.png" alt="Meenufy Logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--brand)', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
            Meenufy
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 600 }}>
            Your restro's digital menu partner
          </p>
        </div>

        {/* Card */}
        <div className="card-glass" style={{ borderRadius: 20, padding: '28px 24px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18, textAlign: 'center', fontFamily: 'Outfit, sans-serif' }}>
            {mode === 'signup' && '✨ Create Restaurant Account'}
            {mode === 'login' && '🛡️ Restaurant Owner Sign In'}
            {mode === 'staff' && '👤 Staff Portal Access'}
            {mode === 'delivery' && '🛵 Rider Portal Access'}
          </h2>

          {/* Staff / Rider Segment switcher */}
          {(mode === 'staff' || mode === 'delivery') && (
            <div style={{
              display: 'flex', gap: 4,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 3,
              marginBottom: 18,
            }}>
              <button
                type="button"
                onClick={() => handlePortalSwitch('staff')}
                style={{
                  flex: 1, padding: '10px 0',
                  borderRadius: 10,
                  fontWeight: 700, fontSize: 12,
                  transition: 'all 0.2s',
                  background: mode === 'staff' ? 'var(--brand)' : 'transparent',
                  color: mode === 'staff' ? '#000000' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                👥 Staff
              </button>
              <button
                type="button"
                onClick={() => handlePortalSwitch('delivery')}
                style={{
                  flex: 1, padding: '10px 0',
                  borderRadius: 10,
                  fontWeight: 700, fontSize: 12,
                  transition: 'all 0.2s',
                  background: mode === 'delivery' ? '#9D4EDD' : 'transparent',
                  color: mode === 'delivery' ? '#FFFFFF' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                🏍️ Rider
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <>
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Your Name</label>
                  <input
                    className="input"
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Restaurant Name</label>
                  <input
                    className="input"
                    type="text"
                    required
                    placeholder="e.g. The Grand Spice"
                    value={form.restaurantName}
                    onChange={e => setForm({ ...form, restaurantName: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="input-group">
              <label className="input-label" style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                {(mode === 'staff' || mode === 'delivery') ? 'Username' : 'Email ID'}
              </label>
              <input
                className="input"
                type="text"
                required
                placeholder={
                  mode === 'staff' ? 'e.g. rahul_staff' :
                  mode === 'delivery' ? 'e.g. rahul_rider' :
                  'e.g. owner@restaurant.com'
                }
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  required
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
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
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
                marginTop: 8,
                height: 44,
                borderRadius: 12,
                background: mode === 'delivery' ? '#9D4EDD' : 'var(--brand)',
                color: mode === 'delivery' ? '#FFFFFF' : '#000000',
                fontWeight: 800,
                fontSize: 13.5,
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
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: mode === 'delivery' ? '#fff' : '#000', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                mode === 'signup' ? 'Create Account' : 'Sign In'
              )}
            </button>

            {/* Google Login for Owner */}
            {(mode === 'login' || mode === 'signup') && hasFirebaseConfig && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-full"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', height: 42, borderRadius: 12 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Google Sign-In</span>
                </button>
              </>
            )}

            {/* Bottom Actions Switchers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              
              {(mode === 'login' || mode === 'signup') && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, outline: 'none' }}
                  >
                    {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handlePortalSwitch('staff')}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4
                    }}
                  >
                    👤 Staff or Rider Login Portal &rarr;
                  </button>
                </>
              )}

              {(mode === 'staff' || mode === 'delivery') && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{
                    background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700, outline: 'none'
                  }}
                >
                  ← Back to Owner Sign In
                </button>
              )}

            </div>
          </form>
        </div>

        {/* Secure storage disclaimer */}
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,125,0,0.04)', border: '1px dashed var(--border-brand)', textAlign: 'center' }}>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            🔒 <strong style={{ color: 'var(--brand)' }}>Meenufy Security Guard</strong> — {hasFirebaseConfig ? 'Your account credentials and records are safely hosted via Google Firebase Cloud.' : 'Demo Mode: All accounts, menus, and orders are saved locally in your browser cache.'}
          </p>
        </div>

        {/* Tutorial / Demo Video Link */}
        <div style={{
          marginTop: 10,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(255,125,0,0.06)',
          border: '1px solid rgba(255,125,0,0.1)',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}>
          <span style={{ fontSize: 14 }}>📺</span>
          <a
            href="https://youtu.be/guUt96vqUcM?si=L3aLUBWrZ0yNpvMj"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
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

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          &copy; 2026 Meenufy. All rights reserved.
        </p>
      </div>
    </div>
  );
}
