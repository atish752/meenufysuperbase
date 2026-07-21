import { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import {
  LogOut, MapPin, Phone, Package, CheckCircle, Navigation,
  Check, Star, TrendingUp, Bike, User, Home, History, Zap, Sun, Moon
} from 'lucide-react';
import { hasFirebaseConfig } from '../../utils/firebase';
import { dbUpdate, signOutUser } from '../../utils/supabase';

type Tab = 'home' | 'history' | 'profile';

export default function DeliveryDashboard() {
  const { state, dispatch, addToast } = useStore();
  const rider = state.admin;
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [newOrderPing, setNewOrderPing] = useState(false);

  // Advanced history filtering states
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'custom_month' | 'date_range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  if (!rider) return null;

  // Find rider detail from global state
  const riderDetail = state.deliveryBoys?.find(b => b.id === rider.id) || {
    id: rider.id,
    name: rider.name,
    username: rider.email,
    status: 'idle' as const,
    totalDeliveries: 0,
    totalEarnings: 0,
    restaurantId: rider.restaurantId,
    createdAt: Date.now()
  };

  // Active assigned order
  const activeOrder = state.orders?.find(
    o => o.deliveryBoyId === rider.id && o.status !== 'served' && o.status !== 'cancelled'
  );

  // History of completed deliveries
  const deliveryHistory = (state.orders?.filter(
    o => o.deliveryBoyId === rider.id && o.status === 'served'
  ) || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const filteredHistory = deliveryHistory.filter(ord => {
    const ts = ord.createdAt || 0;
    const date = new Date(ts);
    
    if (filterType === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return ts >= today.getTime();
    }
    
    if (filterType === 'week') {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return ts >= monday.getTime();
    }
    
    if (filterType === 'month') {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      return ts >= firstDay.getTime();
    }
    
    if (filterType === 'custom_month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      return date.getFullYear() === year && (date.getMonth() + 1) === month;
    }
    
    if (filterType === 'date_range') {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return ts >= start.getTime() && ts <= end.getTime();
    }
    
    return true;
  });

  const getPastMonths = () => {
    const list = [];
    const date = new Date();
    for (let i = 0; i < 12; i++) {
      const yr = date.getFullYear();
      const mIdx = date.getMonth();
      const monthLabel = date.toLocaleString('default', { month: 'long' });
      const value = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
      list.push({ label: `${monthLabel} ${yr}`, value });
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  };

  const totalDistance = filteredHistory.reduce((sum, o) => sum + (o.deliveryDistance || 2.5), 0);
  const totalPayout = filteredHistory.reduce((sum, o) => sum + (o.deliveryBoyEarnings || Math.round((o.deliveryDistance || 2.5) * (riderDetail.payoutPerKm || 12))), 0);
  const avgPayout = filteredHistory.length ? Math.round(totalPayout / filteredHistory.length) : 0;

  // Today's deliveries
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayDeliveries = deliveryHistory.filter(
    o => (o.createdAt || 0) >= todayStart.getTime()
  );

  // Avg rating from rated orders
  const ratedOrders = deliveryHistory.filter(o => o.deliveryBoyRating && o.deliveryBoyRating > 0);
  const avgRating = ratedOrders.length
    ? (ratedOrders.reduce((sum, o) => sum + (o.deliveryBoyRating || 0), 0) / ratedOrders.length).toFixed(1)
    : '—';

  // Ping animation when new order assigned
  useEffect(() => {
    if (activeOrder && activeOrder.deliveryStatus === 'assigned') {
      setNewOrderPing(true);
      const t = setTimeout(() => setNewOrderPing(false), 6000);
      return () => clearTimeout(t);
    }
  }, [activeOrder?.id]);

  // Watch rider location if delivering
  useEffect(() => {
    if (!activeOrder || activeOrder.deliveryStatus !== 'started') return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (hasFirebaseConfig) {
          await dbUpdate(`deliveryBoys/${rider.id}`, {
            latitude: lat,
            longitude: lng
          });
        } else {
          dispatch({
            type: 'SET_STATE',
            payload: {
              deliveryBoys: state.deliveryBoys.map(b =>
                b.id === rider.id ? { ...b, latitude: lat, longitude: lng } : b
              )
            }
          });
        }
      },
      (err) => console.error('Error watching rider location:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder?.id, activeOrder?.deliveryStatus]);

  const handleLogout = () => {
    // Delivery boys don't use Firebase Auth — just clear app state
    signOutUser().catch(() => {});
    dispatch({ type: 'LOGOUT_ADMIN' });
    addToast('success', 'Logged out successfully.');
  };

  const handleStartDelivery = async () => {
    if (!activeOrder) return;
    setUpdatingStatus(true);
    try {
      if (hasFirebaseConfig) {
        await dbUpdate(`orders/${activeOrder.restaurantId}/${activeOrder.id}`, {
          deliveryStatus: 'started'
        });
        await dbUpdate(`deliveryBoys/${rider.id}`, { status: 'delivering' });
      } else {
        dispatch({
          type: 'SET_STATE',
          payload: {
            orders: state.orders.map(o =>
              o.id === activeOrder.id ? { ...o, deliveryStatus: 'started' } : o
            ),
            deliveryBoys: state.deliveryBoys.map(b =>
              b.id === rider.id ? { ...b, status: 'delivering' } : b
            )
          }
        });
      }
      addToast('success', 'Delivery started! Drive safely. 🛵');

      const dest = activeOrder.deliveryLat && activeOrder.deliveryLng 
        ? `${activeOrder.deliveryLat},${activeOrder.deliveryLng}`
        : (activeOrder.deliveryAddress || '');
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`,
        '_blank'
      );
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to start delivery.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleNavigate = () => {
    const dest = activeOrder?.deliveryLat && activeOrder?.deliveryLng 
      ? `${activeOrder.deliveryLat},${activeOrder.deliveryLng}`
      : (activeOrder?.deliveryAddress || '');
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`,
      '_blank'
    );
  };

  const handleCompleteDelivery = async () => {
    if (!activeOrder) return;
    if (otpInput.trim() !== activeOrder.deliveryOtp) {
      addToast('error', '❌ Invalid OTP. Ask the customer for the 4-digit code shown in their order status.');
      return;
    }
    setVerifying(true);
    try {
      const payoutRate = riderDetail.payoutPerKm || 12;
      const distance = activeOrder.deliveryDistance || 2.5;
      const commission = Math.round(distance * payoutRate);

      const nextDeliveries = (riderDetail.totalDeliveries || 0) + 1;
      const nextEarnings = (riderDetail.totalEarnings || 0) + commission;

      if (hasFirebaseConfig) {
        await dbUpdate(`orders/${activeOrder.restaurantId}/${activeOrder.id}`, {
          status: 'served',
          paymentStatus: 'paid',
          deliveryStatus: 'delivered',
          deliveryDistance: distance,
          deliveryBoyEarnings: commission,
          updatedAt: Date.now()
        });
        await dbUpdate(`deliveryBoys/${rider.id}`, {
          status: 'idle',
          totalDeliveries: nextDeliveries,
          totalEarnings: nextEarnings,
          assignedOrderId: null
        });
      } else {
        dispatch({
          type: 'SET_STATE',
          payload: {
            orders: state.orders.map(o =>
              o.id === activeOrder.id
                ? { ...o, status: 'served', paymentStatus: 'paid', deliveryStatus: 'delivered', deliveryDistance: distance, deliveryBoyEarnings: commission }
                : o
            ),
            deliveryBoys: state.deliveryBoys.map(b =>
              b.id === rider.id
                ? { ...b, status: 'idle', totalDeliveries: nextDeliveries, totalEarnings: nextEarnings, assignedOrderId: null }
                : b
            )
          }
        });
      }
      addToast('success', `🎉 Delivered! You earned ₹${commission} for ${distance} KM (${state.restaurant.currency || '₹'}${payoutRate}/KM). Great job!`);
      setOtpInput('');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to complete delivery.');
    } finally {
      setVerifying(false);
    }
  };

  // ─────────────────────────────────────────────
  // SHARED STYLES
  // ─────────────────────────────────────────────
  const card = {
    background: state.adminTheme === 'light' ? '#FFFFFF' : '#161616',
    border: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 16,
    boxShadow: state.adminTheme === 'light' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
    color: state.adminTheme === 'light' ? '#1F2937' : '#F5F5F5',
  } as React.CSSProperties;

  const labelStyle = {
    fontSize: 9.5,
    fontWeight: 800,
    color: state.adminTheme === 'light' ? '#4B5563' : '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  };

  // ─────────────────────────────────────────────
  // HOME TAB
  // ─────────────────────────────────────────────
  const HomeTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Today Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: "Today's Runs", value: todayDeliveries.length, color: '#A855F7', icon: <Bike size={14} /> },
          { label: "Today's Pay", value: `₹${todayDeliveries.length * 50}`, color: '#22C55E', icon: <TrendingUp size={14} /> },
          { label: 'Avg Rating', value: avgRating, color: '#FBBF24', icon: <Star size={14} /> },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ color: s.color, background: `${s.color}18`, padding: '6px', borderRadius: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ ...labelStyle, fontSize: 8.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active Delivery */}
      <div>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Active Delivery</div>
        {activeOrder ? (
          <div style={{
            ...card,
            border: `2px solid ${newOrderPing ? '#A855F7' : 'rgba(168,85,247,0.4)'}`,
            boxShadow: newOrderPing ? '0 0 24px rgba(168,85,247,0.25)' : '0 0 12px rgba(168,85,247,0.1)',
            animation: newOrderPing ? 'deliveryPing 1s ease infinite alternate' : 'none',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* NEW badge */}
            {newOrderPing && (
              <div style={{
                position: 'absolute', top: 0, right: 0,
                background: '#A855F7', color: '#fff',
                fontSize: 9, fontWeight: 900, padding: '3px 10px',
                borderBottomLeftRadius: 10,
                letterSpacing: '0.06em'
              }}>
                NEW ORDER ✦
              </div>
            )}

            {/* Order header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <span style={{
                  fontSize: 10, fontWeight: 800, background: 'rgba(168,85,247,0.15)',
                  color: '#A855F7', border: '1px solid rgba(168,85,247,0.3)',
                  padding: '3px 8px', borderRadius: 6
                }}>
                  #{activeOrder.id.slice(-4).toUpperCase()}
                </span>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 7, color: state.adminTheme === 'light' ? '#1F2937' : '#F5F5F5' }}>
                  {state.restaurant?.name || 'Restaurant Outlet'}
                </div>
                <div style={{ fontSize: 10.5, color: state.adminTheme === 'light' ? '#4B5563' : '#9CA3AF', marginTop: 2 }}>
                  {activeOrder.items?.length || 0} item{(activeOrder.items?.length || 0) !== 1 ? 's' : ''} •{' '}
                  {activeOrder.items?.map(i => i.name).slice(0, 2).join(', ')}
                  {(activeOrder.items?.length || 0) > 2 ? ` +${(activeOrder.items?.length || 0) - 2} more` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#22C55E' }}>₹{activeOrder.totalAmount}</div>
                <div style={{ fontSize: 9.5, color: state.adminTheme === 'light' ? '#4B5563' : '#6B7280', marginTop: 2, fontWeight: 700 }}>
                  {activeOrder.paymentMethod === 'cash' ? '💵 CASH' : '📱 UPI PAID'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: state.adminTheme === 'light' ? '1px dashed rgba(0,0,0,0.12)' : '1px dashed rgba(255,255,255,0.07)', paddingTop: 12 }}>
              {/* Address */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7', padding: 7, borderRadius: 8, flexShrink: 0 }}>
                  <MapPin size={14} />
                </div>
                <div>
                  <div style={labelStyle}>Delivery Address</div>
                  <div style={{ fontSize: 12.5, color: state.adminTheme === 'light' ? '#1F2937' : '#E5E7EB', marginTop: 3, lineHeight: 1.5 }}>
                    {activeOrder.deliveryAddress}
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', padding: 7, borderRadius: 8, flexShrink: 0 }}>
                  <Phone size={14} />
                </div>
                <div>
                  <div style={labelStyle}>Customer</div>
                  <div style={{ fontSize: 12.5, color: state.adminTheme === 'light' ? '#1F2937' : '#E5E7EB', marginTop: 3 }}>
                    {activeOrder.customerName || 'Guest'}
                  </div>
                  <a
                    href={`tel:${activeOrder.customerPhone}`}
                    style={{ fontSize: 13, color: '#22C55E', fontWeight: 800, textDecoration: 'none', display: 'inline-block', marginTop: 2 }}
                  >
                    📞 {activeOrder.customerPhone || 'No phone'}
                  </a>
                </div>
              </div>

              {/* Delivery Status Pill */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  padding: '3px 10px', borderRadius: 20,
                  background: activeOrder.deliveryStatus === 'started'
                    ? 'rgba(251,191,36,0.15)' : 'rgba(168,85,247,0.15)',
                  color: activeOrder.deliveryStatus === 'started' ? '#FBBF24' : '#A855F7',
                  border: `1px solid ${activeOrder.deliveryStatus === 'started' ? 'rgba(251,191,36,0.3)' : 'rgba(168,85,247,0.3)'}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {activeOrder.deliveryStatus === 'started' ? '🛵 On The Way' : '⏳ Assigned — Awaiting Pickup'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeOrder.deliveryStatus !== 'started' ? (
                // START DELIVERY
                <button
                  onClick={handleStartDelivery}
                  disabled={updatingStatus}
                  style={{
                    width: '100%', height: 48, borderRadius: 14,
                    background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                    color: '#FFFFFF', fontWeight: 900, fontSize: 14,
                    border: 'none', cursor: updatingStatus ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 4px 20px rgba(168,85,247,0.35)',
                    transition: 'all 0.2s',
                    opacity: updatingStatus ? 0.7 : 1
                  }}
                >
                  <Zap size={16} />
                  {updatingStatus ? 'Starting...' : 'START DELIVERY & NAVIGATE'}
                </button>
              ) : (
                <>
                  {/* Re-Navigate */}
                  <button
                    onClick={handleNavigate}
                    style={{
                      width: '100%', height: 42, borderRadius: 12,
                      background: '#1E293B', border: '1px solid rgba(59,130,246,0.3)',
                      color: '#93C5FD', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all 0.2s'
                    }}
                  >
                    <Navigation size={15} color="#3B82F6" />
                    OPEN GOOGLE MAPS NAVIGATION
                  </button>

                  {/* OTP Gate */}
                  <div style={{
                    background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)',
                    borderRadius: 12, padding: '12px 14px'
                  }}>
                    <div style={{ ...labelStyle, color: '#22C55E', marginBottom: 8 }}>
                      🔑 Enter Customer OTP to Complete Delivery
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        type="number"
                        maxLength={4}
                        placeholder="_ _ _ _"
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                        style={{
                          flex: 1, textAlign: 'center', letterSpacing: '0.25em',
                          fontWeight: 900, fontSize: 20, background: '#0D0D0D',
                          border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E',
                          borderRadius: 10, height: 48,
                        }}
                      />
                      <button
                        onClick={handleCompleteDelivery}
                        disabled={verifying || otpInput.length < 4}
                        style={{
                          padding: '0 20px', height: 48,
                          background: otpInput.length >= 4 ? 'linear-gradient(135deg, #22C55E, #16A34A)' : '#1F2937',
                          color: '#FFFFFF', border: 'none', borderRadius: 10,
                          fontWeight: 900, cursor: otpInput.length >= 4 ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          transition: 'all 0.2s',
                          boxShadow: otpInput.length >= 4 ? '0 4px 12px rgba(34,197,94,0.3)' : 'none'
                        }}
                      >
                        {verifying ? (
                          <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        ) : (
                          <><Check size={16} /> DELIVERED</>
                        )}
                      </button>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 8, lineHeight: 1.4 }}>
                      The customer sees this OTP in their live order status. Ask them to read it out.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            ...card,
            border: '1px dashed rgba(255,255,255,0.07)',
            padding: '32px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛋️</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', marginBottom: 6 }}>
              {isOnline ? 'Waiting for next order...' : 'You are offline'}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {isOnline
                ? 'The restaurant will assign your next delivery here.'
                : 'Go online to start receiving deliveries.'}
            </div>
          </div>
        )}
      </div>

      {/* All-Time Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', padding: 10, borderRadius: 12 }}>
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={labelStyle}>Total Earned</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#22C55E', marginTop: 3 }}>
              ₹{riderDetail.totalEarnings || 0}
            </div>
          </div>
        </div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7', padding: 10, borderRadius: 12 }}>
            <Package size={18} />
          </div>
          <div>
            <div style={labelStyle}>Total Deliveries</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#A855F7', marginTop: 3 }}>
              {riderDetail.totalDeliveries || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // HISTORY TAB
  // ─────────────────────────────────────────────
  const HistoryTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tab Filter buttons */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'custom_month', label: 'By Month' },
          { id: 'date_range', label: 'Date Range' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id as any)}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: filterType === f.id ? 'var(--brand)' : 'rgba(255,255,255,0.06)',
              color: filterType === f.id ? '#fff' : '#9CA3AF',
              border: filterType === f.id ? '1px solid var(--brand)' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conditional selectors */}
      {filterType === 'custom_month' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: state.adminTheme === 'light' ? '#FFFFFF' : '#161616', padding: 12, borderRadius: 12, border: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)', boxShadow: state.adminTheme === 'light' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none' }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: state.adminTheme === 'light' ? '#6B7280' : '#9CA3AF', letterSpacing: '0.03em' }}>SELECT MONTH</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              background: state.adminTheme === 'light' ? '#F3F4F6' : '#0D0D0D', border: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
              color: state.adminTheme === 'light' ? '#1F2937' : '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12,
              fontWeight: 700, outline: 'none', width: '100%'
            }}
          >
            {getPastMonths().map(m => (
              <option key={m.value} value={m.value} style={{ background: state.adminTheme === 'light' ? '#FFF' : '#0D0D0D', color: state.adminTheme === 'light' ? '#1F2937' : '#FFF' }}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {filterType === 'date_range' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: state.adminTheme === 'light' ? '#FFFFFF' : '#161616', padding: 12, borderRadius: 12, border: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)', boxShadow: state.adminTheme === 'light' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9.5, fontWeight: 800, color: state.adminTheme === 'light' ? '#6B7280' : '#9CA3AF', letterSpacing: '0.03em' }}>FROM DATE</label>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              style={{
                background: state.adminTheme === 'light' ? '#F3F4F6' : '#0D0D0D', border: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                color: state.adminTheme === 'light' ? '#1F2937' : '#fff', padding: '8px 10px', borderRadius: 8, fontSize: 11.5,
                fontWeight: 700, outline: 'none', width: '100%'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9.5, fontWeight: 800, color: state.adminTheme === 'light' ? '#6B7280' : '#9CA3AF', letterSpacing: '0.03em' }}>TO DATE</label>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              style={{
                background: state.adminTheme === 'light' ? '#F3F4F6' : '#0D0D0D', border: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                color: state.adminTheme === 'light' ? '#1F2937' : '#fff', padding: '8px 10px', borderRadius: 8, fontSize: 11.5,
                fontWeight: 700, outline: 'none', width: '100%'
              }}
            />
          </div>
        </div>
      )}

      {/* Analytics Summary Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...card, padding: 12, background: state.adminTheme === 'light' ? 'rgba(168,85,247,0.06)' : 'rgba(168,85,247,0.04)', border: state.adminTheme === 'light' ? '1px solid rgba(168,85,247,0.2)' : '1px solid rgba(168,85,247,0.1)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#A855F7', letterSpacing: '0.03em' }}>DELIVERIES</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: state.adminTheme === 'light' ? '#A855F7' : '#fff', marginTop: 2 }}>{filteredHistory.length} orders</div>
          <div style={{ fontSize: 10, color: state.adminTheme === 'light' ? '#6B7280' : '#8B949E', marginTop: 2 }}>Dist: <strong style={{ color: state.adminTheme === 'light' ? '#1F2937' : '#E5E7EB' }}>{totalDistance.toFixed(1)} KM</strong></div>
        </div>
        <div style={{ ...card, padding: 12, background: state.adminTheme === 'light' ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)', border: state.adminTheme === 'light' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(34,197,94,0.1)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#22C55E', letterSpacing: '0.03em' }}>TOTAL PAYOUT</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#22C55E', marginTop: 2 }}>₹{totalPayout}</div>
          <div style={{ fontSize: 10, color: state.adminTheme === 'light' ? '#6B7280' : '#8B949E', marginTop: 2 }}>Avg payout: <strong style={{ color: state.adminTheme === 'light' ? '#1F2937' : '#E5E7EB' }}>₹{avgPayout}</strong></div>
        </div>
      </div>

      <div style={{ borderBottom: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />

      <div style={{ ...labelStyle, fontSize: 11 }}>Delivery Logs ({filteredHistory.length})</div>

      {filteredHistory.length === 0 ? (
        <div style={{
          ...card, border: state.adminTheme === 'light' ? '1px dashed rgba(0,0,0,0.15)' : '1px dashed rgba(255,255,255,0.07)',
          padding: '32px 16px', textAlign: 'center'
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>No completed deliveries in selected range.</div>
        </div>
      ) : (
        filteredHistory.map((ord) => {
          const date = ord.createdAt
            ? new Date(ord.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : '—';
          const time = ord.createdAt
            ? new Date(ord.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : '';
          
          const payoutRate = riderDetail.payoutPerKm || 12;
          const distance = ord.deliveryDistance || 2.5;
          const commission = ord.deliveryBoyEarnings || Math.round(distance * payoutRate);

          return (
            <div key={ord.id} style={{
              ...card,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              animation: 'fadeIn 0.2s ease', padding: 12
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(34,197,94,0.1)', color: '#22C55E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <CheckCircle size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#A855F7' }}>
                    #{ord.id.slice(-4).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11.5, color: state.adminTheme === 'light' ? '#374151' : '#E5E7EB', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {ord.deliveryAddress || 'Address details not stored'}
                  </div>
                  <div style={{ fontSize: 10, color: state.adminTheme === 'light' ? '#6B7280' : '#8B949E', marginTop: 2 }}>
                    {date} • {time}
                    {ord.deliveryBoyRating ? (
                      <span style={{ marginLeft: 6, color: '#FBBF24' }}>
                        ★ {ord.deliveryBoyRating}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#22C55E' }}>+₹{commission}</div>
                <div style={{ fontSize: 9.5, color: state.adminTheme === 'light' ? '#6B7280' : '#8B949E', marginTop: 2 }}>{distance} KM (@₹{payoutRate})</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // PROFILE TAB
  // ─────────────────────────────────────────────
  const ProfileTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Avatar & Name */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: 12, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, fontWeight: 900, color: '#fff',
          boxShadow: '0 0 24px rgba(168,85,247,0.4)'
        }}>
          {riderDetail.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: state.adminTheme === 'light' ? '#1F2937' : '#F5F5F5' }}>{riderDetail.name}</div>
          <div style={{ fontSize: 12, color: state.adminTheme === 'light' ? '#4B5563' : '#9CA3AF', marginTop: 2 }}>
            🛵 Delivery Rider • @{riderDetail.username}
          </div>
        </div>
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsOnline(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
              background: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
              border: `1px solid ${isOnline ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
              color: isOnline ? '#22C55E' : '#6B7280',
              fontWeight: 800, fontSize: 12,
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? '#22C55E' : '#6B7280',
              boxShadow: isOnline ? '0 0 6px #22C55E' : 'none'
            }} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Deliveries', value: riderDetail.totalDeliveries || 0, color: '#A855F7' },
          { label: 'Earnings', value: `₹${riderDetail.totalEarnings || 0}`, color: '#22C55E' },
          { label: 'Avg Rating', value: avgRating, color: '#FBBF24' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ ...labelStyle, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info rows */}
      <div style={card}>
        {[
          { label: 'Username / Login ID', value: riderDetail.username },
          { label: 'Restaurant', value: state.restaurant?.name || '—' },
          {
            label: 'Member Since',
            value: riderDetail.createdAt
              ? new Date(riderDetail.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
              : '—'
          },
          {
            label: 'Account Status',
            value: riderDetail.status === 'delivering' ? '🟡 On Delivery' : '🟢 Idle'
          },
        ].map((row, rowIdx, arr) => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: rowIdx > 0 ? 12 : 0,
            paddingBottom: rowIdx < arr.length - 1 ? 12 : 0,
            borderBottom: rowIdx < arr.length - 1 ? (state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)') : 'none'
          }}>
            <div style={{ fontSize: 11.5, color: state.adminTheme === 'light' ? '#6B7280' : '#8B949E', fontWeight: 600 }}>{row.label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: state.adminTheme === 'light' ? '#1F2937' : '#E5E7EB', textAlign: 'right', maxWidth: '55%' }}>{row.value}</div>
          </div>
        ))}
      </div>

      {/* Rating breakdown */}
      {ratedOrders.length > 0 && (
        <div style={card}>
          <div style={{ ...labelStyle, marginBottom: 12 }}>Rating Breakdown ({ratedOrders.length} ratings)</div>
          {[5, 4, 3, 2, 1].map(star => {
            const count = ratedOrders.filter(o => o.deliveryBoyRating === star).length;
            const pct = ratedOrders.length > 0 ? (count / ratedOrders.length) * 100 : 0;
            return (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 24, fontSize: 11, fontWeight: 700, color: state.adminTheme === 'light' ? '#4B5563' : '#9CA3AF', textAlign: 'right' }}>{star}★</div>
                <div style={{ flex: 1, height: 6, background: state.adminTheme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#FBBF24', borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ width: 22, fontSize: 10.5, color: state.adminTheme === 'light' ? '#4B5563' : '#6B7280', fontWeight: 700 }}>{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          width: '100%', height: 44, borderRadius: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#EF4444', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s'
        }}
      >
        <LogOut size={15} /> Sign Out
      </button>
    </div>
  );

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: state.adminTheme === 'light' ? '#F3F4F6' : '#0D0D0D',
      color: state.adminTheme === 'light' ? '#1F2937' : '#F5F5F5',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 480,
      margin: '0 auto',
      position: 'relative'
    }}>
      <style>{`
        @keyframes deliveryPing {
          from { box-shadow: 0 0 10px rgba(168,85,247,0.2); }
          to   { box-shadow: 0 0 30px rgba(168,85,247,0.5); }
        }
      `}</style>

      {/* Top Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 16px 0',
        position: 'sticky', top: 0, zIndex: 10,
        background: state.adminTheme === 'light' ? '#F3F4F6' : '#0D0D0D'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#fff',
          }}>
            {riderDetail.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: state.adminTheme === 'light' ? '#1F2937' : '#F5F5F5' }}>{riderDetail.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isOnline ? '#22C55E' : '#6B7280',
                boxShadow: isOnline ? '0 0 5px #22C55E' : 'none'
              }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: isOnline ? '#22C55E' : '#6B7280' }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <span style={{ fontSize: 10, color: state.adminTheme === 'light' ? '#6B7280' : '#4B5563' }}>• Rider Account</span>
            </div>
          </div>
        </div>
        
        {/* Toggle Theme & Active status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_ADMIN_THEME' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: state.adminTheme === 'light' ? '#7C3AED' : '#FBBF24',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 8, borderRadius: '50%',
              backgroundColor: state.adminTheme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
              transition: 'all 0.2s'
            }}
            title={state.adminTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {state.adminTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          
          {activeOrder && (
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#A855F7',
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
              padding: '4px 10px', borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 5
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A855F7', animation: 'deliveryPing 1s ease infinite alternate' }} />
              ACTIVE
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, padding: '16px 16px 90px', overflowY: 'auto' }}>
        {activeTab === 'home' && HomeTab()}
        {activeTab === 'history' && HistoryTab()}
        {activeTab === 'profile' && ProfileTab()}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: state.adminTheme === 'light' ? '#FFFFFF' : '#111111',
        borderTop: state.adminTheme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        zIndex: 20,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}>
        {([
          { id: 'home', label: 'Home', icon: <Home size={20} /> },
          { id: 'history', label: 'History', icon: <History size={20} /> },
          { id: 'profile', label: 'Profile', icon: <User size={20} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '12px 4px 10px',
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: activeTab === tab.id ? '#A855F7' : (state.adminTheme === 'light' ? '#9CA3AF' : '#4B5563'),
              transition: 'color 0.2s',
              position: 'relative'
            }}
          >
            {tab.id === 'home' && activeOrder && (
              <div style={{
                position: 'absolute', top: 8, right: 'calc(50% - 20px)',
                width: 8, height: 8, borderRadius: '50%', background: '#A855F7',
                boxShadow: '0 0 6px rgba(168,85,247,0.6)'
              }} />
            )}
            {tab.icon}
            <span style={{ fontSize: 10, fontWeight: 700 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
