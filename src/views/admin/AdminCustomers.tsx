import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Search, User, Phone, ShoppingBag, TrendingUp, Calendar, Gift, Crown, Mail, Star, Clock, X } from 'lucide-react';

export default function AdminCustomers() {
  const { state, dispatch, addToast } = useStore();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'totalSpent' | 'orderCount' | 'lastVisit'>('totalSpent');
  
  // Modals state
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Loyalty settings form state
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(state.restaurant.loyaltyEnabled || false);
  const [pointsPer100Spent, setPointsPer100Spent] = useState(state.restaurant.pointsPer100Spent || 1);
  const [pointValueInRupees, setPointValueInRupees] = useState(state.restaurant.pointValueInRupees || 1);

  // Manual points input state
  const [manualPoints, setManualPoints] = useState<string>('');

  // Derive customers scoped to this admin's restaurant.
  // state.customers is replaced wholesale by SYNC_CUSTOMERS on Firebase sync,
  // but before Firebase responds, the initial mock data (restaurantId: admin-1) may show.
  // We filter out mock-restaurant customers for non-admin-1 accounts.
  const adminId = state.admin?.restaurantId || 'admin-1';
  const adminOrders = state.orders.filter(o => (o.restaurantId || 'admin-1') === adminId);
  const adminCustomerPhones = new Set(adminOrders.map(o => o.customerPhone).filter(Boolean));
  // If the admin is admin-1 OR if Firebase hasn't synced yet (no orders from any restaurant),
  // show state.customers as-is. Otherwise only show customers whose phone appears in our orders.
  const adminCustomers = adminId === 'admin-1'
    ? state.customers
    : state.customers.filter(c => adminCustomerPhones.has(c.phone));

  const filtered = adminCustomers
    .filter(c => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const totalRevenue = adminCustomers.reduce((s, c) => s + c.totalSpent, 0);

  // Get selected customer detail
  const currentCust = selectedCustomerId
    ? adminCustomers.find(c => c.id === selectedCustomerId)
    : null;

  // Calculate sentiment and details for current customer
  const customerOrders = currentCust ? state.orders.filter(o => o.customerPhone === currentCust.phone) : [];
  let totalRating = 0;
  let ratingCount = 0;
  customerOrders.forEach(o => {
    if (o.ratings) {
      Object.values(o.ratings).forEach(r => {
        totalRating += r;
        ratingCount += 1;
      });
    }
  });
  const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;

  // Find last order
  const sortedOrders = [...customerOrders].sort((a, b) => b.createdAt - a.createdAt);
  const lastOrder = sortedOrders[0];

  const handleOpenLoyaltyModal = () => {
    setLoyaltyEnabled(state.restaurant.loyaltyEnabled || false);
    setPointsPer100Spent(state.restaurant.pointsPer100Spent || 1);
    setPointValueInRupees(state.restaurant.pointValueInRupees || 1);
    setShowLoyaltyModal(true);
  };

  const handleSaveLoyaltySettings = () => {
    dispatch({
      type: 'UPDATE_RESTAURANT',
      payload: {
        loyaltyEnabled,
        pointsPer100Spent: Number(pointsPer100Spent),
        pointValueInRupees: Number(pointValueInRupees),
      }
    });
    addToast('success', 'Loyalty program settings updated successfully!');
    setShowLoyaltyModal(false);
  };

  const handleToggleVip = (custId: string) => {
    dispatch({ type: 'TOGGLE_CUSTOMER_VIP', payload: custId });
    addToast('success', 'Customer VIP status updated!');
  };

  const handleAdjustPoints = (custId: string) => {
    const pts = parseInt(manualPoints, 10);
    if (isNaN(pts)) {
      addToast('error', 'Please enter a valid number of points.');
      return;
    }
    dispatch({
      type: 'ADJUST_CUSTOMER_POINTS',
      payload: { id: custId, points: pts }
    });
    addToast('success', `Customer loyalty balance adjusted to ${pts} points.`);
  };

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Customers CRM</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {adminCustomers.length} unique customers · {state.restaurant.currency}{totalRevenue.toLocaleString('en-IN')} LTV
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenLoyaltyModal}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              fontSize: 13,
              borderColor: state.restaurant.loyaltyEnabled ? 'var(--border-brand)' : undefined,
              color: state.restaurant.loyaltyEnabled ? 'var(--brand)' : 'var(--text-secondary)'
            }}
          >
            <Gift size={16} />
            Loyalty Settings
          </button>

          {/* Clear All Customers Button */}
          <button
            onClick={() => {
              if (window.confirm(
                `⚠️ Are you sure you want to clear ALL ${adminCustomers.length} customer records?\n\nThis will permanently delete all customer data from the database and cannot be undone.`
              )) {
                dispatch({ type: 'CLEAR_ALL_CUSTOMERS' });
                addToast('success', '🗑️ All customer records cleared successfully.');
              }
            }}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              fontSize: 13,
              color: 'var(--error)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}
            title="Clear all customer records from database"
          >
            <X size={16} />
            Clear All
          </button>

          <button
            onClick={() => {
              dispatch({ type: 'TOGGLE_ADMIN_THEME' });
              addToast('success', `Theme switched to ${state.adminTheme === 'light' ? 'Dark' : 'Light'}!`);
            }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
              boxShadow: 'var(--shadow-sm)',
              transition: 'var(--transition)',
            }}
            title="Toggle Theme"
          >
            {state.adminTheme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon"><User size={18} /></div>
          <div className="stat-value">{adminCustomers.length}</div>
          <div className="stat-label">Total CRM Records</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Crown size={18} color="#ffd700" /></div>
          <div className="stat-value">{adminCustomers.filter(c => c.isVip).length}</div>
          <div className="stat-label">VIP Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TrendingUp size={18} /></div>
          <div className="stat-value">
            {state.restaurant.currency}{adminCustomers.length > 0 ? Math.round(totalRevenue / adminCustomers.length) : 0}
          </div>
          <div className="stat-label">Avg. Spend / LTV</div>
        </div>
      </div>

      {/* Search & Sort */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="input-icon-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} className="input-icon" />
          <input className="input" type="text" placeholder="Search by name, phone or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 'auto', cursor: 'pointer' }}
          value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
          <option value="totalSpent">Sort: Lifetime Spend</option>
          <option value="orderCount">Sort: Order Count</option>
          <option value="lastVisit">Sort: Last Visit</option>
        </select>
      </div>

      {/* Customer List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {state.customers.length === 0
              ? 'No customers yet. Orders placed via QR code will show here.'
              : 'No customers match your search.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((customer, idx) => {
            const isVip = !!customer.isVip;
            return (
              <div
                key={customer.id}
                className="card"
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setManualPoints((customer.points || 0).toString());
                }}
                style={{
                  padding: '14px 16px',
                  animation: 'fadeIn 0.3s ease',
                  animationDelay: `${idx * 0.04}s`,
                  cursor: 'pointer',
                  border: isVip ? '1px solid #ffd700' : '1px solid var(--border)',
                  boxShadow: isVip ? '0 0 12px rgba(255, 215, 0, 0.15)' : 'var(--shadow-sm)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: isVip ? 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(184,134,11,0.2) 100%)' : 'var(--brand-dim)',
                    border: isVip ? '1px solid #ffd700' : '1px solid var(--border-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: isVip ? '#ffd700' : 'var(--brand)',
                  }}>
                    {customer.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {customer.name}
                      </span>
                      {isVip && (
                        <span style={{
                          background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                          color: '#000000',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 900,
                        }}>
                          👑 VIP
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Phone size={11} />
                        {customer.phone || 'No phone'}
                      </div>
                      {customer.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                          <Mail size={10} />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isVip ? '#ffd700' : 'var(--brand)', marginBottom: 2 }}>
                      {state.restaurant.currency}{customer.totalSpent.toLocaleString('en-IN')}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {state.restaurant.loyaltyEnabled && (
                        <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 10, padding: '1px 6px', borderRadius: 4, color: 'var(--brand)', fontWeight: 700 }}>
                          🏆 {customer.points || 0} pts
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                        <ShoppingBag size={10} /> {customer.orderCount} orders
                      </div>
                    </div>
                  </div>
                </div>

                {/* Last visit */}
                <div style={{
                  marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 6
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    <Calendar size={11} />
                    Last visit: {new Date(customer.lastVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    Since: {new Date(customer.firstVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOYALTY SETTINGS MODAL */}
      {showLoyaltyModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowLoyaltyModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gift size={20} color="var(--brand)" />
                <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Loyalty Settings</h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowLoyaltyModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Enable Loyalty Program</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Allow customers to earn &amp; redeem points</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                  <input type="checkbox" checked={loyaltyEnabled} onChange={e => setLoyaltyEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: loyaltyEnabled ? 'var(--brand)' : '#888888',
                    borderRadius: 24, transition: '0.3s',
                  }}>
                    <span style={{
                      position: 'absolute', height: 16, width: 16, left: loyaltyEnabled ? 24 : 4, bottom: 4,
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.3s'
                    }} />
                  </span>
                </label>
              </div>

              {loyaltyEnabled && (
                <>
                  <div className="input-group">
                    <label className="input-label">Points earned per ₹100 spent</label>
                    <input className="input" type="number" min="0" value={pointsPer100Spent}
                      onChange={e => setPointsPer100Spent(Number(e.target.value))} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>e.g. 1 point per ₹100 spent</span>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Point Cash Value (₹ per point)</label>
                    <input className="input" type="number" min="0" step="0.1" value={pointValueInRupees}
                      onChange={e => setPointValueInRupees(Number(e.target.value))} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>e.g. 1 point = ₹1 discount value</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setShowLoyaltyModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-full" onClick={handleSaveLoyaltySettings} style={{ background: 'var(--brand)', color: '#000000', fontWeight: 700 }}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAILS CRM MODAL */}
      {selectedCustomerId && currentCust && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelectedCustomerId(null)}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: '50%',
                  background: currentCust.isVip ? 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(184,134,11,0.2) 100%)' : 'var(--brand-dim)',
                  border: currentCust.isVip ? '2px solid #ffd700' : '1px solid var(--border-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: currentCust.isVip ? '#ffd700' : 'var(--brand)',
                }}>
                  {currentCust.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>{currentCust.name}</h2>
                    {currentCust.isVip && (
                      <span style={{
                        background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                        color: '#000000',
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 9,
                        fontWeight: 900,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2
                      }}>
                        👑 VIP
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Customer Profile Details</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedCustomerId(null)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Profile Info Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={14} color="var(--brand)" />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Phone: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentCust.phone || 'N/A'}</span>
                </div>
              </div>
              {currentCust.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={14} color="var(--brand)" />
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Email: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentCust.email}</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={14} color="var(--brand)" />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  First Visited: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(currentCust.firstVisit).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {/* LTV */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 14px', borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Lifetime Spend (LTV)</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand)', marginTop: 4 }}>
                  {state.restaurant.currency}{currentCust.totalSpent.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Across {currentCust.orderCount} total orders</div>
              </div>

              {/* Sentiment / Ratings */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '12px 14px', borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer Sentiment</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: avgRating ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {avgRating ? (
                    <>
                      {avgRating} <Star size={18} fill="#ffd700" color="#ffd700" style={{ display: 'inline' }} />
                    </>
                  ) : (
                    'No Reviews'
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  {ratingCount > 0 ? `Based on ${ratingCount} item ratings` : 'Has not submitted reviews'}
                </div>
              </div>
            </div>

            {/* Last Order Detail Card */}
            {lastOrder && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> Last Order Activity
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Order #{lastOrder.id.slice(-4).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>
                    {state.restaurant.currency}{lastOrder.totalAmount}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>{new Date(lastOrder.createdAt).toLocaleDateString('en-IN')} at {new Date(lastOrder.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--brand)' }}>{lastOrder.status}</span>
                </div>
              </div>
            )}

            {/* Loyalty points adjustment */}
            {state.restaurant.loyaltyEnabled && (
              <div style={{ border: '1px solid var(--border)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🏆 Loyalty Program Balance</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
                    {currentCust.points || 0} pts (≈ {state.restaurant.currency}{(currentCust.points || 0) * (state.restaurant.pointValueInRupees || 1)})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    className="input"
                    placeholder="New Points balance"
                    value={manualPoints}
                    onChange={e => setManualPoints(e.target.value)}
                    style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 13 }}
                  />
                  <button
                    onClick={() => handleAdjustPoints(currentCust.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0 14px', fontSize: 12, height: 36 }}
                  >
                    Adjust Points
                  </button>
                </div>
              </div>
            )}

            {/* Actions: VIP Toggle */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => handleToggleVip(currentCust.id)}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderColor: currentCust.isVip ? 'var(--error)' : '#ffd700',
                  color: currentCust.isVip ? 'var(--error)' : '#ffd700',
                  background: 'transparent',
                }}
              >
                <Crown size={15} />
                {currentCust.isVip ? 'Revoke VIP Status' : 'Mark as VIP Customer'}
              </button>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--brand)', color: '#000000', fontWeight: 700 }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
