import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { LogOut, MapPin, Phone, DollarSign, ShoppingBag, CheckCircle, Navigation, Check } from 'lucide-react';
import { hasFirebaseConfig, db } from '../../utils/firebase';

export default function DeliveryDashboard() {
  const { state, dispatch, addToast } = useStore();
  const rider = state.admin;

  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!rider) return null;

  // Find active assigned order
  const activeOrder = state.orders?.find(
    o => o.deliveryBoyId === rider.id && o.status !== 'served' && o.status !== 'cancelled'
  );

  // History of completed deliveries
  const deliveryHistory = state.orders?.filter(
    o => o.deliveryBoyId === rider.id && o.status === 'served'
  ) || [];

  // Find rider's detail from global state list to keep stats up-to-date in real-time
  const riderDetail = state.deliveryBoys?.find(b => b.id === rider.id) || {
    name: rider.name,
    username: rider.email,
    status: 'idle',
    totalDeliveries: 0,
    totalEarnings: 0
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT_ADMIN' });
    addToast('success', 'Logged out successfully.');
  };

  const handleStartDelivery = async () => {
    if (!activeOrder) return;
    setUpdatingStatus(true);
    try {
      if (hasFirebaseConfig && db) {
        const { ref, update } = await import('firebase/database');
        await update(ref(db, `orders/${activeOrder.restaurantId}/${activeOrder.id}`), {
          deliveryStatus: 'started'
        });
      } else {
        dispatch({
          type: 'SET_STATE',
          payload: {
            orders: state.orders.map(o => o.id === activeOrder.id ? { ...o, deliveryStatus: 'started' } : o)
          }
        });
      }
      addToast('success', 'Delivery started! Drive safely. 🛵');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to start delivery.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!activeOrder) return;
    if (otpInput.trim() !== activeOrder.deliveryOtp) {
      addToast('error', '❌ Invalid OTP. Please request the correct 4-digit code from the customer.');
      return;
    }

    setVerifying(true);
    try {
      const incentive = 50; // flat ₹50 commission
      const nextDeliveries = (riderDetail.totalDeliveries || 0) + 1;
      const nextEarnings = (riderDetail.totalEarnings || 0) + incentive;

      if (hasFirebaseConfig && db) {
        const { ref, update } = await import('firebase/database');
        
        // 1. Update order status to served & paid
        await update(ref(db, `orders/${activeOrder.restaurantId}/${activeOrder.id}`), {
          status: 'served',
          paymentStatus: 'paid',
          deliveryStatus: 'delivered',
          updatedAt: Date.now()
        });

        // 2. Update delivery boy stats and status
        await update(ref(db, `deliveryBoys/${rider.id}`), {
          status: 'idle',
          totalDeliveries: nextDeliveries,
          totalEarnings: nextEarnings,
          assignedOrderId: null
        });
      } else {
        // Local state dispatch fallback
        dispatch({
          type: 'SET_STATE',
          payload: {
            orders: state.orders.map(o => o.id === activeOrder.id ? { ...o, status: 'served', paymentStatus: 'paid', deliveryStatus: 'delivered' } : o),
            deliveryBoys: state.deliveryBoys.map(b => b.id === rider.id ? { ...b, status: 'idle', totalDeliveries: nextDeliveries, totalEarnings: nextEarnings, assignedOrderId: null } : b)
          }
        });
      }

      addToast('success', `🎉 Order delivered successfully! You earned ₹${incentive}.`);
      setOtpInput('');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to complete delivery.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0D0D',
      color: '#F5F5F5',
      padding: '24px 16px',
      fontFamily: 'var(--font-sans)',
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: '14px 16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(157, 78, 221, 0.15)', border: '1px solid #9D4EDD',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 900, color: '#9D4EDD'
          }}>
            {riderDetail.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{riderDetail.name}</div>
            <div style={{ fontSize: 10.5, color: '#A3A3A3', marginTop: 2 }}>
              🛵 Rider Account · <span style={{ color: riderDetail.status === 'delivering' ? '#A855F7' : '#22C55E', fontWeight: 700, textTransform: 'uppercase' }}>{riderDetail.status}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 6 }}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: 10, borderRadius: 12 }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#A3A3A3', fontWeight: 600 }}>TOTAL EARNINGS</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e', marginTop: 2 }}>₹{riderDetail.totalEarnings || 0}</div>
          </div>
        </div>
        <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(157, 78, 221, 0.1)', color: '#9D4EDD', padding: 10, borderRadius: 12 }}>
            <ShoppingBag size={20} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#A3A3A3', fontWeight: 600 }}>DELIVERIES</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#9D4EDD', marginTop: 2 }}>{riderDetail.totalDeliveries || 0}</div>
          </div>
        </div>
      </div>

      {/* Active Assigned Delivery */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Active Delivery</h3>
        {activeOrder ? (
          <div style={{
            background: '#111111',
            border: '2px solid #9D4EDD',
            boxShadow: '0 0 16px rgba(157,78,221,0.12)',
            borderRadius: 20,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(157,78,221,0.15)', color: '#9D4EDD', border: '1px solid rgba(157,78,221,0.3)', padding: '2px 8px', borderRadius: 6 }}>
                  #{activeOrder.id.slice(-4).toUpperCase()}
                </span>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>{state.restaurant?.name || 'Restaurant Outlet'}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e' }}>₹{activeOrder.totalAmount}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} color="#9D4EDD" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <strong style={{ color: '#A3A3A3', display: 'block', fontSize: 10, marginBottom: 2 }}>DELIVERY ADDRESS:</strong>
                  {activeOrder.deliveryAddress}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 12 }}>
                  <strong style={{ color: '#A3A3A3', display: 'block', fontSize: 10, marginBottom: 2 }}>CUSTOMER DETAILS:</strong>
                  {activeOrder.customerName || 'Guest'} · <a href={`tel:${activeOrder.customerPhone}`} style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 700 }}>{activeOrder.customerPhone}</a>
                </div>
              </div>
            </div>

            {/* Actions */}
            {activeOrder.deliveryStatus !== 'started' ? (
              <button
                onClick={handleStartDelivery}
                disabled={updatingStatus}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  background: '#9D4EDD',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                <CheckCircle size={16} />
                {updatingStatus ? 'Starting...' : 'START DELIVERY'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Google Maps Nav */}
                <button
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrder.deliveryAddress || '')}`, '_blank')}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 12,
                    background: '#1F2937',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <Navigation size={16} color="#3B82F6" />
                  MAP DIRECTIONS
                </button>

                {/* OTP Gate */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#A3A3A3' }}>ENTER 4-DIGIT CUSTOMER OTP</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      type="text"
                      maxLength={4}
                      placeholder="e.g. 1234"
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                      style={{ flex: 1, textAlign: 'center', letterSpacing: '0.15em', fontWeight: 800 }}
                    />
                    <button
                      onClick={handleCompleteDelivery}
                      disabled={verifying || otpInput.length < 4}
                      style={{
                        padding: '0 20px',
                        background: '#22C55E',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {verifying ? 'Verifying...' : <Check size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#111111',
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '30px 16px',
            textAlign: 'center',
            color: '#A3A3A3',
            fontSize: 12.5
          }}>
            🛋️ No active delivery assigned at the moment.
          </div>
        )}
      </div>

      {/* History of Completed Deliveries */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Completed Deliveries ({deliveryHistory.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {deliveryHistory.map(ord => (
            <div key={ord.id} style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#A3A3A3' }}>Order #{ord.id.slice(-4).toUpperCase()}</span>
                <div style={{ fontSize: 11.5, color: '#F5F5F5', marginTop: 4 }}>{ord.deliveryAddress?.slice(0, 36)}...</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#22c55e' }}>+₹50</span>
                <div style={{ fontSize: 10, color: '#A3A3A3', marginTop: 2 }}>Delivered</div>
              </div>
            </div>
          ))}
          {deliveryHistory.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#666666', fontSize: 11.5 }}>
              No completed deliveries found in your history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
