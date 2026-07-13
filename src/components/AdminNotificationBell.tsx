import { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/RealtimeStore';
import type { WaiterRequest } from '../context/RealtimeStore';

export default function AdminNotificationBell() {
  const { state, dispatch, addToast } = useStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const adminId = state.admin?.restaurantId || 'admin-1';
  const activeRequests = state.waiterRequests.filter(
    (r: WaiterRequest) => !r.resolved && (r.restaurantId || 'admin-1') === adminId
  );
  const resolvedRequests = state.waiterRequests.filter(
    (r: WaiterRequest) => r.resolved && (r.restaurantId || 'admin-1') === adminId
  ).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  const count = activeRequests.length;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleResolve = (id: string, tableNumber: number) => {
    dispatch({ type: 'RESOLVE_WAITER', payload: id });
    addToast('success', `Table ${tableNumber} marked as done.`);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <style>{`
        @keyframes bellShake {
          0%,100% { transform: rotate(0deg); }
          10% { transform: rotate(-12deg); }
          20% { transform: rotate(12deg); }
          30% { transform: rotate(-8deg); }
          40% { transform: rotate(8deg); }
          50% { transform: rotate(-4deg); }
          60% { transform: rotate(4deg); }
          70%,90% { transform: rotate(0deg); }
        }
        @keyframes bellBadgePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }
        @keyframes notifFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <button
        id="admin-notification-bell-btn"
        onClick={() => setOpen(o => !o)}
        title={count > 0 ? `${count} waiter request${count > 1 ? 's' : ''}` : 'No active waiter requests'}
        style={{
          position: 'relative',
          width: 38, height: 38,
          borderRadius: '50%',
          border: count > 0 ? '2px solid rgba(239,68,68,0.35)' : '1px solid var(--border)',
          background: count > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          animation: count > 0 ? 'bellShake 2.8s infinite ease-in-out' : 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#ffffff',
            borderRadius: 99, fontSize: 9, fontWeight: 800,
            padding: '1px 5px', minWidth: 16, lineHeight: '14px', textAlign: 'center',
            border: '1.5px solid var(--bg-primary)',
            animation: 'bellBadgePulse 2s infinite',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div
          id="admin-notification-panel"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 276,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            zIndex: 10000, overflow: 'hidden', animation: 'notifFadeIn 0.15s ease',
          }}
        >
          <div style={{
            padding: '11px 14px 9px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔔</span> Waiter Calls
              {count > 0 && (
                <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                  {count} active
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}>✕</button>
          </div>
          <div style={{ maxHeight: 270, overflowY: 'auto' }}>
            {activeRequests.length === 0 && resolvedRequests.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                All requests resolved
              </div>
            ) : (
              <>
                {/* Active Calls */}
                {activeRequests.map((req: WaiterRequest) => (
                  <div key={req.id} style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    background: 'rgba(239,68,68,0.03)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🪑 Table {req.tableNumber}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        Called at {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleResolve(req.id, req.tableNumber)}
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                    >Resolve ✓</button>
                  </div>
                ))}

                {/* Resolved Calls */}
                {resolvedRequests.length > 0 && (
                  <div>
                    <div style={{ padding: '6px 14px', background: 'var(--bg-secondary)', fontSize: 9.5, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                      RESOLVED / WAITER SENT
                    </div>
                    {resolvedRequests.map((req: WaiterRequest, idx: number) => (
                      <div key={req.id} style={{
                        padding: '10px 14px',
                        borderBottom: idx < resolvedRequests.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        opacity: 0.65,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'line-through' }}>🪑 Table {req.tableNumber}</div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1 }}>
                            Assisted ✓
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}>
                          Done ✓
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {count > 1 && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => {
                  activeRequests.forEach((r: WaiterRequest) => dispatch({ type: 'RESOLVE_WAITER', payload: r.id }));
                  addToast('success', `All ${count} waiter requests resolved.`);
                  setOpen(false);
                }}
                style={{ width: '100%', background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >✓ Resolve All ({count})</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
