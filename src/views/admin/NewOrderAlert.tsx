import { useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import type { Order } from '../../context/RealtimeStore';
import { Bell, ShoppingBag, X } from 'lucide-react';

export default function NewOrderAlert({ order }: { order: Order }) {
  const { dispatch } = useStore();

  useEffect(() => {
    // Auto dismiss after 8s
    const timer = setTimeout(() => dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' }), 8000);

    // Play notification sound (using Web Audio API)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {}

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 84, right: 16, left: 16,
      maxWidth: 360, marginLeft: 'auto',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--brand)',
      borderRadius: 16,
      padding: '16px',
      boxShadow: '0 8px 40px rgba(255,125,0,0.2)',
      zIndex: 'var(--z-toast)' as any,
      animation: 'slideInUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      display: 'flex',
      gap: 12,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'var(--brand-dim)', border: '1px solid var(--border-brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, animation: 'pulse-dot 1s infinite',
      }}>
        <Bell size={20} color="var(--brand)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          🔔 New Order — Table {order.tableNumber}!
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {order.customerName || 'Guest'} · {order.items.length} item(s) · <span style={{ color: 'var(--brand)', fontWeight: 600 }}>₹{order.totalAmount}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' })}
            style={{ fontSize: 11 }}
          >
            <ShoppingBag size={12} /> View Order
          </button>
        </div>
      </div>

      <button
        className="btn-ghost btn-icon"
        onClick={() => dispatch({ type: 'CLEAR_NEW_ORDER_ALERT' })}
        style={{ color: 'var(--text-muted)', padding: 4, alignSelf: 'flex-start', flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
