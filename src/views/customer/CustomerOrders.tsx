import { useState, useEffect } from 'react';
import { useStore, getActiveRestaurantInfo } from '../../context/RealtimeStore';
import type { Order, OrderStatus } from '../../context/RealtimeStore';
import { ShoppingBag, Clock, ChefHat, Utensils, Check, X, ChevronDown, ChevronUp, Calendar, Printer, Gift, ShieldCheck } from 'lucide-react';
import { printThermalReceipt } from '../../utils/printReceipt';
import { db } from '../../utils/firebase';
import { ref, get } from 'firebase/database';

type Props = { tableId: string };

const STATUS_STEPS: OrderStatus[] = ['pending', 'preparing', 'ready', 'bill_pay', 'served'];

const STATUS_INFO: Record<OrderStatus, { label: string; desc: string; icon: any; color: string }> = {
  pending: { label: 'New Order', desc: 'Your order has been placed', icon: ShoppingBag, color: '#f59e0b' },
  preparing: { label: 'Preparing', desc: 'Our chef is cooking your food', icon: ChefHat, color: '#8b5cf6' },
  ready: { label: 'Ready', desc: 'Delivered to your table!', icon: Utensils, color: '#22c55e' },
  bill_pay: { label: 'Bill & Pay', desc: 'Waiting for payment confirmation', icon: Clock, color: '#3b82f6' },
  served: { label: 'Served', desc: 'Completed! Enjoy your meal! 😋', icon: Check, color: '#10b981' },
  cancelled: { label: 'Cancelled', desc: 'Order was cancelled', icon: X, color: '#ef4444' },
};

export default function CustomerOrders({ tableId }: Props) {
  const { state, dispatch, addToast } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'loyalty'>('orders');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all' | string>('all');
  const [customDate, setCustomDate] = useState('');

  // Complaint states
  const [complaintOrder, setComplaintOrder] = useState<Order | null>(null);
  const [complaintCategory, setComplaintCategory] = useState('Food Quality');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Loyalty states
  const [loyaltyPoints, setLoyaltyPoints] = useState<any[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);

  const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
  const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
  const isLoggedIn = !!(savedGoogle || savedCustom);

  const myPhoneIdentifier = localStorage.getItem('meenufy_customer_phone') || localStorage.getItem('meenufy_customer_guest_id') || '';

  // Parallel fetch loyalty points across all restaurants when sub-tab switches to loyalty
  useEffect(() => {
    if (activeSubTab !== 'loyalty' || !myPhoneIdentifier) return;
    setLoadingLoyalty(true);

    const cleanPhone = myPhoneIdentifier.replace(/[^a-zA-Z0-9]/g, '');
    const promises = (state.restaurantAccounts || []).map(acc => {
      return get(ref(db!, `customers/${acc.id}/${cleanPhone}`))
        .then(snapshot => {
          const data = snapshot.val();
          if (data && (data.points > 0 || data.visitsCount > 0)) {
            return {
              restaurantId: acc.id,
              restaurantName: acc.restaurantName,
              logo: acc.logo,
              points: data.points || 0,
              visitsCount: data.visitsCount || 0,
              isVip: !!data.isVip
            };
          }
          return null;
        })
        .catch(() => null);
    });

    Promise.all(promises).then(results => {
      const active = results.filter(Boolean);
      setLoyaltyPoints(active);
      setLoadingLoyalty(false);
    });
  }, [activeSubTab, myPhoneIdentifier, state.restaurantAccounts]);

  if (!isLoggedIn) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        paddingTop: 100,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.3s ease'
      }}>
        <div style={{ 
          width: 80, 
          height: 80, 
          borderRadius: '50%', 
          background: 'var(--brand-dim)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: 24,
          border: '1px solid var(--brand)',
          boxShadow: '0 8px 24px rgba(255, 125, 0, 0.15)'
        }}>
          <span style={{ fontSize: 36 }}>🔐</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
          Authentication Required
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, lineHeight: 1.6, maxWidth: 300 }}>
          To view your order history and track live order status, please sign in or sign up from the 'More' tab.
        </p>
        <button
          className="btn btn-primary"
          style={{ 
            background: 'linear-gradient(135deg, var(--brand) 0%, #e06000 100%)', 
            color: '#000', 
            fontWeight: 700, 
            padding: '12px 32px', 
            borderRadius: 99,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(255, 125, 0, 0.3)'
          }}
          onClick={() => dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'more' })}
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  const myOrders = state.orders
    .filter(o => o.customerPhone === myPhoneIdentifier || o.tableId === tableId)
    .sort((a, b) => b.createdAt - a.createdAt);

  // Find all unique months in user's orders
  const uniqueMonths: string[] = [];
  myOrders.forEach(o => {
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!uniqueMonths.includes(key)) {
      uniqueMonths.push(key);
    }
  });

  const getMonthName = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const filteredOrders = myOrders.filter(order => {
    const orderDate = new Date(order.createdAt);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (timeFilter === 'today') {
      return orderDate >= startOfToday;
    }
    if (timeFilter === 'week') {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      return orderDate >= startOfWeek;
    }
    if (timeFilter === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return orderDate >= startOfMonth;
    }
    if (timeFilter === 'custom') {
      if (!customDate) return true;
      const selected = new Date(customDate);
      return (
        orderDate.getFullYear() === selected.getFullYear() &&
        orderDate.getMonth() === selected.getMonth() &&
        orderDate.getDate() === selected.getDate()
      );
    }
    if (timeFilter.includes('-')) {
      const [year, month] = timeFilter.split('-').map(Number);
      return orderDate.getFullYear() === year && (orderDate.getMonth() + 1) === month;
    }
    return true;
  });

  return (
    <div style={{ 
      padding: '20px', 
      animation: 'fadeIn 0.3s ease', 
      paddingBottom: 80,
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20
      }}>
        <button
          onClick={() => setActiveSubTab('orders')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
            background: activeSubTab === 'orders' ? 'var(--brand)' : 'transparent',
            color: activeSubTab === 'orders' ? '#000000' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Order History
        </button>
        <button
          onClick={() => setActiveSubTab('loyalty')}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
            background: activeSubTab === 'loyalty' ? 'var(--brand)' : 'transparent',
            color: activeSubTab === 'loyalty' ? '#000000' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Loyalty Points
        </button>
      </div>

      {activeSubTab === 'orders' ? (
        <>
          {/* Page Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: 0 }}>My Orders</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>{filteredOrders.length} order(s) shown</p>
            </div>
          </div>

          {/* Date & Period Filters */}
          <div style={{
            background: 'transparent',
            padding: '0 0 12px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderBottom: '1px solid var(--border)',
            minWidth: 0,
          }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, width: '100%', maxWidth: '100%', scrollbarWidth: 'none' }} className="hide-scrollbar">
              {[
                { key: 'all', label: 'All Orders' },
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'custom', label: 'Custom Date' }
              ].map(f => {
                const isSelected = timeFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => { setTimeFilter(f.key); }}
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 99,
                      background: isSelected ? 'var(--brand)' : 'var(--bg-elevated)',
                      color: isSelected ? '#000' : 'var(--text-primary)',
                      border: isSelected ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Month Selector & Custom Date Picker */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {uniqueMonths.length > 0 && (
                <select
                  value={timeFilter.includes('-') ? timeFilter : ''}
                  onChange={e => {
                    if (e.target.value) {
                      setTimeFilter(e.target.value);
                    } else {
                      setTimeFilter('all');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: 140
                  }}
                >
                  <option value="">Choose Past Month...</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
              )}

              {timeFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Calendar size={14} color="var(--brand)" />
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 10px',
                      fontSize: 12,
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Orders List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                No orders found for the selected period.
              </div>
            ) : (
              filteredOrders.map(order => (
                <OrderStatusCard key={order.id} order={order} onRaiseComplaint={setComplaintOrder} />
              ))
            )}
          </div>
        </>
      ) : (
        /* Loyalty Points Tab */
        <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: 0 }}>Loyalty Rewards</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>Points earned across all Meenufy restaurants</p>
          </div>

          {loadingLoyalty ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>🔄</div>
              <span>Fetching points balance...</span>
            </div>
          ) : loyaltyPoints.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: 'var(--bg-elevated)',
              borderRadius: 14,
              border: '1px dashed var(--border)',
              marginTop: 10
            }}>
              <Gift size={40} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>No Points Earned Yet</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Order from any of our locations and link your phone number `{myPhoneIdentifier}` to earn and redeem rewards points!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Total points summary card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(234, 88, 12, 0.03) 100%)',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Balance</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                    {loyaltyPoints.reduce((acc, p) => acc + p.points, 0)} <span style={{ fontSize: 12, fontWeight: 500 }}>pts</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 10 }}>
                  <ShieldCheck size={16} color="#10B981" />
                  <span style={{ fontSize: 11, fontWeight: 800 }}>Verified Customer</span>
                </div>
              </div>

              {/* Individual restaurant cards */}
              {loyaltyPoints.map(p => (
                <div key={p.restaurantId} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  gap: 12,
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {/* Restaurant Logo */}
                  <div style={{
                    width: 50,
                    height: 50,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--border-dim)',
                    border: '1px solid var(--border)',
                    flexShrink: 0
                  }}>
                    <img src={p.logo || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&auto=format&fit=crop&q=60'} alt={p.restaurantName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>

                  {/* Program Details */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{p.restaurantName}</h4>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.visitsCount} visit(s)</span>
                          {p.isVip && (
                            <span style={{ background: '#ffd700', color: '#000', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 4, transform: 'scale(0.95)' }}>VIP</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>
                          {p.points} <span style={{ fontSize: 10, fontWeight: 500 }}>pts</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Value: ₹{p.points}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {complaintOrder && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && setComplaintOrder(null)}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24, borderRadius: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              ⚠️ Raise a Complaint
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: 20 }}>
              Please select a category and provide detail. We will notify the restaurant immediately.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Complaint Category
                </label>
                <select
                  value={complaintCategory}
                  onChange={e => setComplaintCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                >
                  <option value="Food Quality">🍔 Food Quality</option>
                  <option value="Missing Items">📦 Missing Items</option>
                  <option value="Delivery Delay">🛵 Delivery Delay</option>
                  <option value="Packaging Issue">🛍️ Packaging Issue</option>
                  <option value="Wrong Item">❌ Wrong Item Received</option>
                  <option value="Other">❓ Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Detailed Description
                </label>
                <textarea
                  value={complaintMessage}
                  onChange={e => setComplaintMessage(e.target.value)}
                  placeholder="Describe your issue in detail here so the restaurant can investigate..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setComplaintOrder(null)}
                className="btn btn-secondary"
                style={{ flex: 1, height: 40, borderRadius: 20 }}
                disabled={submittingComplaint}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!complaintMessage.trim()) {
                    addToast('error', 'Please write a description.');
                    return;
                  }
                  setSubmittingComplaint(true);
                  try {
                    const { ref, update } = await import('firebase/database');
                    const rId = complaintOrder.restaurantId || 'admin-1';
                    
                    const complaintData = {
                      category: complaintCategory,
                      message: complaintMessage.trim(),
                      status: 'pending' as const,
                      createdAt: Date.now(),
                      replyText: ''
                    };

                    // Save complaint directly under the order object to ensure write permission succeeds
                    await update(ref(db!, `orders/${rId}/${complaintOrder.id}`), {
                      complaint: complaintData
                    });

                    addToast('success', '🎉 Complaint submitted to the restaurant!');
                    setComplaintOrder(null);
                    setComplaintMessage('');
                  } catch (err: any) {
                    console.error(err);
                    addToast('error', 'Failed to submit. Please try again.');
                  } finally {
                    setSubmittingComplaint(false);
                  }
                }}
                className="btn btn-primary"
                style={{ flex: 2, height: 40, borderRadius: 20 }}
                disabled={submittingComplaint}
              >
                {submittingComplaint ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderStatusCard({ order, onRaiseComplaint }: { order: Order; onRaiseComplaint: (order: Order) => void }) {
  const { state, dispatch, addToast } = useStore();
  const info = STATUS_INFO[order.status];
  const Icon = info.icon;
  const currentStepIdx = STATUS_STEPS.indexOf(order.status);
  const isActive = !['served', 'cancelled'].includes(order.status);
  const [expanded, setExpanded] = useState(isActive);

  return (
    <div className="card" style={{
      padding: 0, 
      overflow: 'hidden',
      borderColor: isActive ? info.color : undefined,
      borderWidth: isActive ? 1 : undefined,
      transition: 'all 0.2s ease',
    }}>
      <div
        style={{ 
          padding: '10px 14px', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10,
          background: isActive ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${info.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={info.color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              #{order.id.slice(-4).toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: info.color, fontWeight: 600, background: `${info.color}15`, padding: '1px 6px', borderRadius: 99 }}>
              {info.label}
            </span>
            {order.restaurantName && (
              <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700, background: 'var(--brand-dim)', padding: '1px 6px', borderRadius: 99 }}>
                🏢 {order.restaurantName}
              </span>
            )}
            {isActive && <div className="dot-live" style={{ width: 6, height: 6, background: info.color, animation: 'blink-yellow 1.5s infinite' }} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {' • '}
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'right', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>₹{order.totalAmount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{order.items.length} items</div>
          </div>
          <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {expanded && (
        <>
          {isActive && order.status !== 'cancelled' && (
            <div style={{ padding: '4px 14px 12px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {STATUS_STEPS.map((step, idx) => {
                  const stepInfo = STATUS_INFO[step];
                  const isCompleted = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: idx < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: isCompleted ? stepInfo.color : 'var(--bg-elevated)',
                        border: `1.5px solid ${isCompleted ? stepInfo.color : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.4s ease',
                        boxShadow: isCurrent ? `0 0 8px ${stepInfo.color}66` : 'none',
                      }}>
                        {isCompleted
                          ? <Check size={10} color="#fff" strokeWidth={3} />
                          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bg-elevated)' }} />
                        }
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div style={{
                          flex: 1, height: 1.5,
                          background: idx < currentStepIdx ? info.color : 'var(--border)',
                          transition: 'background 0.4s ease',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: info.color, fontWeight: 600 }}>
                {info.desc}
              </div>
            </div>
          )}

          <div style={{ padding: '8px 14px 10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
              {order.items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: 'var(--text-secondary)',
                }}>
                  <span style={{ fontWeight: 500 }}>{item.qty}× {item.name}{item.variant ? ` (${item.variant.name})` : ''}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{item.price * item.qty}</span>
                </div>
              ))}
              {order.specialNote && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px dashed var(--border)', paddingTop: 4 }}>
                  💬 {order.specialNote}
                </div>
              )}
            </div>
          </div>

          {order.orderType === 'delivery' && order.deliveryBoyId && (
            (() => {
              const assignedDboy = state.deliveryBoys?.find(b => b.id === order.deliveryBoyId);
              if (!assignedDboy) return null;
              return (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(255, 125, 0, 0.04)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>DELIVERY PARTNER</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      🚴 {assignedDboy.name}
                    </div>
                    {assignedDboy.phone && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                        📞 {assignedDboy.phone}
                      </div>
                    )}
                  </div>
                  {assignedDboy.phone && (
                    <a
                      href={`tel:${assignedDboy.phone}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                        color: '#000',
                        textDecoration: 'none',
                        boxShadow: '0 4px 10px rgba(255,125,0,0.3)',
                      }}
                    >
                      📞
                    </a>
                  )}
                </div>
              );
            })()
          )}

          {['served', 'bill_pay'].includes(order.status) && (
            <div style={{ padding: '0 14px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '6px 12px',
                  background: 'var(--brand-dim)',
                  border: '1px solid var(--brand)',
                  color: 'var(--brand)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const restaurant = getActiveRestaurantInfo(state, order.restaurantId || 'admin-1');
                  printThermalReceipt(order, 'bill', restaurant);
                }}
              >
                <Printer size={12} /> View/Download Bill
              </button>
            </div>
          )}

          {order.status === 'pending' && (
            <div style={{ padding: '0 14px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '6px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to cancel this order?')) {
                    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: order.id, status: 'cancelled' } });
                    addToast('success', 'Order cancelled successfully.');
                  }
                }}
              >
                <X size={12} /> Cancel Order
              </button>
            </div>
          )}
          {(() => {
            const isLess24Hours = (Date.now() - (order.createdAt || 0)) < 24 * 60 * 60 * 1000;
            if (!isLess24Hours) return null;
            return (
              <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                {order.complaint ? (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠️ Complaint Filed ({order.complaint.status === 'pending' ? 'Pending' : 'Resolved'})
                    </span>
                    {order.complaint.replyText && (
                      <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--brand)', fontSize: 11, color: 'var(--text-primary)', fontStyle: 'normal', width: '100%', boxSizing: 'border-box' }}>
                        <strong>Reply from Restaurant:</strong> "{order.complaint.replyText}"
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1.5px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--error)',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRaiseComplaint(order);
                    }}
                  >
                    ⚠️ Raise a Complaint
                  </button>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
