import { useEffect, useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import type { Order } from '../../context/RealtimeStore';
import { Bell, Check, Trash2, Volume2, VolumeX } from 'lucide-react';

export default function NewOrderAlert({ order }: { order: Order }) {
  const { state, dispatch, addToast } = useStore();
  const [muted, setMuted] = useState(false);

  // Play ringing sound periodically using Web Audio API
  useEffect(() => {
    if (muted) return;

    let audioInterval: any;

    const playRingtone = () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Play dual tone (swiggy/zomato style alert chime)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.type = 'triangle';
        osc2.type = 'sine';

        // Set frequencies for a pleasant but urgent chime chord
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc2.frequency.setValueAtTime(698.46, ctx.currentTime); // F5

        osc1.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
        osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.15); // C6

        osc1.frequency.setValueAtTime(587.33, ctx.currentTime + 0.3); // back to D5
        osc2.frequency.setValueAtTime(698.46, ctx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        
        osc1.stop(ctx.currentTime + 0.7);
        osc2.stop(ctx.currentTime + 0.7);
      } catch (e) {
        console.error('Audio ring error:', e);
      }
    };

    // Play immediately and repeat every 1.5 seconds
    playRingtone();
    audioInterval = setInterval(playRingtone, 1500);

    return () => clearInterval(audioInterval);
  }, [muted]);

  // Auto ignore/dismiss after 45s of no action
  useEffect(() => {
    const autoDismiss = setTimeout(() => {
      dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' });
      addToast('info', 'Order alert auto-ignored. Manage from Orders board.');
    }, 45000);

    return () => clearTimeout(autoDismiss);
  }, []);

  const markAlertDismissed = (orderId: string) => {
    try {
      const raw = localStorage.getItem('meenufy_dismissed_alert_orders');
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(orderId)) {
        list.push(orderId);
        localStorage.setItem('meenufy_dismissed_alert_orders', JSON.stringify(list.slice(-200)));
      }
    } catch {}
  };

  const handleAccept = () => {
    markAlertDismissed(order.id);
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: order.id, status: 'preparing' } });
    addToast('success', `Order accepted! Cooking started.`);
    dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' });
  };

  const handleReject = () => {
    const confirmReject = window.confirm("Are you sure you want to REJECT and CANCEL this order?");
    if (!confirmReject) return;
    markAlertDismissed(order.id);
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: order.id, status: 'cancelled' } });
    addToast('error', `Order cancelled/rejected.`);
    dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' });
  };

  const handleIgnore = () => {
    markAlertDismissed(order.id);
    dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' });
    addToast('info', 'Alert dismissed. Order can be managed on the board.');
  };

  const orderTypeLabels: Record<string, string> = {
    'in-dining': '🪑 In-Dining',
    'take-away': '🛍️ Take-Away',
    'delivery': '🏠 Home Delivery'
  };

  const orderTypeColors: Record<string, string> = {
    'in-dining': 'rgba(59,130,246,0.15)',
    'take-away': 'rgba(239,68,68,0.15)',
    'delivery': 'rgba(168,85,247,0.15)'
  };
  
  const orderTypeTextColor: Record<string, string> = {
    'in-dining': '#3B82F6',
    'take-away': '#EF4444',
    'delivery': '#C084FC'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
      padding: '16px'
    }}>
      <style>{`
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(255,125,0,0.7); transform: scale(1); }
          70% { box-shadow: 0 0 0 15px rgba(255,125,0,0); transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(255,125,0,0); transform: scale(1); }
        }
      `}</style>

      <div style={{
        background: '#111827',
        border: '2.5px solid var(--brand)',
        borderRadius: 24,
        padding: '24px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: '#E5E7EB',
        position: 'relative'
      }}>
        {/* Mute Button */}
        <button
          onClick={() => setMuted(!muted)}
          style={{
            position: 'absolute', top: 18, right: 18,
            background: 'rgba(255,255,255,0.06)', border: 'none',
            borderRadius: '50%', width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: muted ? '#EF4444' : '#E5E7EB', cursor: 'pointer',
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Ringing Header Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--brand)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            animation: 'ringPulse 1.5s infinite',
            color: '#FFFFFF'
          }}>
            <Bell size={28} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.05em', color: 'var(--brand)' }}>
            NEW ORDER RECEIVED
          </span>
        </div>

        {/* Order Details Panel */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {/* Customer & Type */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700 }}>CUSTOMER</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#F3F4F6' }}>
                {order.customerName || 'Guest'}
              </div>
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 900,
              background: orderTypeColors[order.orderType || 'in-dining'] || 'rgba(255,255,255,0.1)',
              color: orderTypeTextColor[order.orderType || 'in-dining'] || '#fff',
              border: `1px solid ${orderTypeTextColor[order.orderType || 'in-dining'] || '#fff'}`,
              padding: '4px 10px', borderRadius: 8,
            }}>
              {orderTypeLabels[order.orderType || 'in-dining'] || 'Order'} {order.tableNumber ? `#${order.tableNumber}` : ''}
            </span>
          </div>

          {/* Items List */}
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, marginBottom: 6 }}>ITEMS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
              {order.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#D1D5DB' }}>
                  <span>{item.name} <span style={{ color: '#9CA3AF' }}>x{item.qty}</span></span>
                  <span style={{ fontWeight: 600 }}>{state.restaurant.currency || '₹'}{item.price * item.qty}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total Price */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 4
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#F3F4F6' }}>TOTAL AMOUNT</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand)' }}>
              {state.restaurant.currency || '₹'}{order.totalAmount}
            </span>
          </div>
        </div>

        {/* Swiggy style Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={handleReject}
            style={{
              flex: 1, height: 48, borderRadius: 14,
              background: 'rgba(239,68,68,0.1)', border: '1.5px solid #EF4444',
              color: '#EF4444', fontWeight: 900, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={16} /> REJECT
          </button>
          
          <button
            onClick={handleIgnore}
            style={{
              padding: '0 14px', height: 48, borderRadius: 14,
              background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.15)',
              color: '#9CA3AF', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            IGNORE
          </button>

          <button
            onClick={handleAccept}
            style={{
              flex: 1.5, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: '#FFFFFF', fontWeight: 900, fontSize: 13, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
              transition: 'all 0.2s'
            }}
          >
            <Check size={18} /> ACCEPT
          </button>
        </div>
      </div>
    </div>
  );
}
