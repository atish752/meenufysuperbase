import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import {
  Coins, LogOut, Mail, Phone, Store, Calendar,
  Check, ShieldAlert, Plus, Minus, Trash2, Send, Key
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { state, dispatch, addToast } = useStore();
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('100');
  const [adjustType, setAdjustType] = useState<'topup' | 'deduct'>('topup');
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Tabs and replies
  const [activeTab, setActiveTab] = useState<'accounts' | 'api_keys' | 'support' | 'feedback'>('accounts');
  const [newApiKey, setNewApiKey] = useState('');
  const [supportReplies, setSupportReplies] = useState<Record<string, string>>({});
  const [feedbackReplies, setFeedbackReplies] = useState<Record<string, string>>({});

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT_ADMIN' });
    addToast('info', 'Super Admin logged out.');
  };

  const handleOpenAdjustModal = (email: string, type: 'topup' | 'deduct') => {
    setSelectedAccountEmail(email);
    setAdjustType(type);
    setAdjustAmount(type === 'topup' ? '500' : '100');
    setShowAdjustModal(true);
  };

  const handleApplyAdjustment = () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast('error', 'Please enter a valid amount.');
      return;
    }

    if (adjustType === 'topup') {
      dispatch({
        type: 'SUPER_ADMIN_TOP_UP',
        payload: { email: selectedAccountEmail!, amount: amt }
      });
      addToast('success', `Added ₹${amt} to ${selectedAccountEmail}'s wallet!`);
    } else {
      dispatch({
        type: 'SUPER_ADMIN_DEDUCT',
        payload: { email: selectedAccountEmail!, amount: amt }
      });
      addToast('success', `Deducted ₹${amt} from ${selectedAccountEmail}'s wallet!`);
    }
    setShowAdjustModal(false);
  };

  const handleQuickTopUp = (email: string, amt: number) => {
    dispatch({
      type: 'SUPER_ADMIN_TOP_UP',
      payload: { email, amount: amt }
    });
    addToast('success', `Quick Top Up of ₹${amt} applied to ${email}!`);
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

  // Stats calculations
  const accounts = state.restaurantAccounts || [];
  const totalLiability = accounts.reduce((sum, a) => sum + a.walletBalance, 0);
  const activeCount = accounts.filter(a => a.status === 'active').length;
  const blockedCount = accounts.filter(a => a.status === 'blocked').length;

  const targetAccount = accounts.find(a => a.ownerEmail === selectedAccountEmail);

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
            boxShadow: 'var(--shadow-brand)'
          }}>
            <img src="/meenufy_logo.jpg" alt="Meenufy Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            <Coins size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total System Liability</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 2, color: 'var(--success)' }}>
              ₹{totalLiability.toLocaleString('en-IN')}
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
          { id: 'feedback', label: 'Owner Feedbacks', count: state.ownerFeedbacks?.length || 0 }
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
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Wallet Balance</th>
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
                        <span style={{
                          fontWeight: 800,
                          fontSize: 16,
                          fontFamily: 'var(--font-display)',
                          color: acc.walletBalance <= 30 ? 'var(--error)' : 'var(--success)'
                        }}>
                          ₹{acc.walletBalance}
                        </span>
                        {acc.walletBalance <= 30 && (
                          <span style={{
                            display: 'block', fontSize: 10, color: 'var(--error)', fontWeight: 600, marginTop: 2
                          }}>Low balance</span>
                        )}
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
                            onClick={() => handleQuickTopUp(acc.ownerEmail, 300)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 11, fontWeight: 700, borderColor: 'var(--border)', color: 'var(--success)', padding: '4px 8px'
                            }}
                            title="Quick add ₹300 allowance"
                          >
                            +₹300
                          </button>

                          <button
                            onClick={() => handleQuickTopUp(acc.ownerEmail, 1000)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 11, fontWeight: 700, borderColor: 'var(--border)', color: 'var(--success)', padding: '4px 8px'
                            }}
                            title="Quick add ₹1000"
                          >
                            +₹1000
                          </button>

                          <button
                            onClick={() => handleOpenAdjustModal(acc.ownerEmail, 'topup')}
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontSize: 11, border: 'none', padding: '4px 8px', fontWeight: 600
                            }}
                          >
                            <Plus size={12} style={{ marginRight: 2 }} /> Topup
                          </button>

                          <button
                            onClick={() => handleOpenAdjustModal(acc.ownerEmail, 'deduct')}
                            className="btn btn-sm"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', fontSize: 11, border: 'none', padding: '4px 8px', fontWeight: 600
                            }}
                          >
                            <Minus size={12} style={{ marginRight: 2 }} /> Deduct
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
                Submitted by restaurant owners when self-healing API key rotation failed completely.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(!state.supportRequests || state.supportRequests.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  No support tickets filed yet. All AI operations are running smoothly! 🎉
                </div>
              ) : (
                state.supportRequests.map(req => (
                  <div
                    key={req.id}
                    className="card"
                    style={{
                      padding: 18,
                      background: 'var(--bg-elevated)',
                      border: req.status === 'pending' ? '1px solid var(--error-dim)' : '1px solid var(--border)',
                      boxShadow: req.status === 'pending' ? '0 2px 10px rgba(239, 68, 68, 0.05)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                            {req.restaurantName}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: req.status === 'pending' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: req.status === 'pending' ? 'var(--error)' : 'var(--success)'
                          }}>
                            {req.status === 'pending' ? 'Pending' : 'Resolved'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Owner: {req.ownerName} ({req.ownerEmail}) · Filed: {new Date(req.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <a
                          href={`mailto:${req.ownerEmail}?subject=Meenufy AI Support Ticket Inquiry`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                          <Mail size={12} style={{ marginRight: 4 }} /> Contact Owner
                        </a>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6, fontSize: 13, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                        AI Failure Attempts Count: <span style={{ color: 'var(--error)' }}>{req.attemptsCount} times</span>
                      </div>
                      <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        "{req.message}"
                      </div>
                    </div>

                    {req.replyText && (
                      <div style={{ background: 'rgba(255, 125, 0, 0.05)', borderLeft: '3px solid var(--brand)', padding: 10, borderRadius: '0 6px 6px 0', fontSize: 12 }}>
                        <strong>Your Reply:</strong><br />
                        <span style={{ color: 'var(--text-secondary)' }}>"{req.replyText}"</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input
                        className="input"
                        style={{ padding: '6px 12px', fontSize: 12, flex: 1 }}
                        placeholder={req.replyText ? "Update your reply..." : "Type reply to owner..."}
                        value={supportReplies[req.id] || ''}
                        onChange={e => setSupportReplies(prev => ({ ...prev, [req.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '6px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleReplySupport(req.id)}
                      >
                        <Send size={12} /> Send Reply
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                Owner Feedbacks
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                General reviews and feedback submitted by restaurant owner admins.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(!state.ownerFeedbacks || state.ownerFeedbacks.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  No feedback received yet.
                </div>
              ) : (
                state.ownerFeedbacks.map(fb => (
                  <div
                    key={fb.id}
                    className="card"
                    style={{
                      padding: 18,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                          {fb.restaurantName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Owner: {fb.ownerName} ({fb.ownerEmail}) · Received: {new Date(fb.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <a
                          href={`mailto:${fb.ownerEmail}?subject=Meenufy Feedback Reply`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                          <Mail size={12} style={{ marginRight: 4 }} /> Contact Owner
                        </a>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '4px 8px', borderColor: 'var(--border)', color: 'var(--error)' }}
                          onClick={() => handleDeleteFeedback(fb.id)}
                        >
                          <Trash2 size={12} style={{ marginRight: 4 }} /> Delete
                        </button>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6, fontSize: 13, border: '1px solid var(--border)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      "{fb.message}"
                    </div>

                    {fb.replyText && (
                      <div style={{ background: 'rgba(255, 125, 0, 0.05)', borderLeft: '3px solid var(--brand)', padding: 10, borderRadius: '0 6px 6px 0', fontSize: 12 }}>
                        <strong>Your Reply:</strong><br />
                        <span style={{ color: 'var(--text-secondary)' }}>"{fb.replyText}"</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input
                        className="input"
                        style={{ padding: '6px 12px', fontSize: 12, flex: 1 }}
                        placeholder={fb.replyText ? "Update your reply..." : "Type reply to owner..."}
                        value={feedbackReplies[fb.id] || ''}
                        onChange={e => setFeedbackReplies(prev => ({ ...prev, [fb.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '6px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleReplyFeedback(fb.id)}
                      >
                        <Send size={12} /> Send Reply
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Adjust Wallet Balance Modal */}
      {showAdjustModal && targetAccount && (
        <div className="modal-backdrop" onClick={() => setShowAdjustModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                {adjustType === 'topup' ? 'Add Funds to Wallet' : 'Deduct Funds from Wallet'}
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target Restaurant</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {targetAccount.restaurantName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {targetAccount.ownerEmail} · Current: <strong>₹{targetAccount.walletBalance}</strong>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">Adjustment Amount (₹)</label>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="Enter amount in ₹"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                style={{ fontSize: 16, fontWeight: 600 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1, height: 38 }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAdjustment}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  height: 38,
                  background: adjustType === 'topup' ? '#22c55e' : 'var(--error)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: 'none'
                }}
              >
                {adjustType === 'topup' ? 'Add Funds' : 'Deduct Funds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
