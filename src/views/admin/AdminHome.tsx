import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../context/RealtimeStore';
import type { Order, OrderStatus } from '../../context/RealtimeStore';
import { Clock, Check, ChefHat, Utensils, CreditCard, Coins, X, QrCode, Wrench } from 'lucide-react';
import { triggerNotification } from '../../utils/notifications';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'New Order', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)', icon: Clock },
  preparing: { label: 'Preparing', color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)', icon: ChefHat },
  ready: { label: 'Ready', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)', icon: Utensils },
  bill_pay: { label: 'Bill & Pay', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)', icon: CreditCard },
  served: { label: 'Served', color: '#10b981', bgColor: 'rgba(16,185,129,0.15)', icon: Check },
  cancelled: { label: 'Cancelled', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', icon: X },
};

const STATUS_ORDER: OrderStatus[] = ['pending', 'preparing', 'ready', 'bill_pay', 'served'];

// Inject blink keyframes once
const BLINK_STYLE_ID = 'meenufy-order-blink-styles';
if (typeof document !== 'undefined' && !document.getElementById(BLINK_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = BLINK_STYLE_ID;
  style.textContent = `
    @keyframes blink-yellow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    @keyframes blink-red {
      0%, 49% { opacity: 1; background-color: #ef4444; }
      50%, 100% { opacity: 0.15; background-color: #ef4444; }
    }
  `;
  document.head.appendChild(style);
}

export default function AdminHome() {
  const { state, dispatch, addToast } = useStore();

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleRequestPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          addToast('success', 'Notifications enabled successfully! 🎉');
          triggerNotification('Notifications Enabled!', 'You will now receive real-time notifications for orders and waiter requests.');
        }
      });
    }
  };

  // Notification watchers refs
  const prevOrdersRef = useRef<Record<string, { status: OrderStatus; paymentStatus: 'pending' | 'waiting_confirmation' | 'paid' }>>({});
  const prevWaiterRequestsRef = useRef<Record<string, boolean>>({});
  const isOrdersMount = useRef(true);
  const isWaiterMount = useRef(true);

  // Watch orders for notifications
  useEffect(() => {
    const adminId = state.admin?.id || 'admin-1';
    const myOrders = state.orders.filter(o => (o.restaurantId || 'admin-1') === adminId);

    if (isOrdersMount.current) {
      const initialOrders: Record<string, any> = {};
      myOrders.forEach(o => {
        initialOrders[o.id] = { status: o.status, paymentStatus: o.paymentStatus || 'pending' };
      });
      prevOrdersRef.current = initialOrders;
      isOrdersMount.current = false;
      return;
    }

    const prevOrders = prevOrdersRef.current;
    const currentOrders: Record<string, any> = {};

    myOrders.forEach(order => {
      const orderId = order.id;
      const currentStatus = order.status;
      const currentPayStatus = order.paymentStatus || 'pending';
      const prev = prevOrders[orderId];

      currentOrders[orderId] = { status: currentStatus, paymentStatus: currentPayStatus };

      if (!prev) {
        if (currentStatus === 'pending') {
          triggerNotification(
            `🛒 New Order Placed! (Table ${order.tableNumber})`,
            `${order.customerName || 'Guest'} ordered ${order.items.length} items (Total: ${state.restaurant.currency}${order.totalAmount})`
          );
        }
      } else {
        const justRequestedPayment = 
          currentStatus === 'bill_pay' &&
          currentPayStatus === 'waiting_confirmation' &&
          prev.paymentStatus !== 'waiting_confirmation';

        if (justRequestedPayment) {
          const methodLabel = order.paymentMethod === 'upi' ? 'UPI' : order.paymentMethod === 'cash' ? 'Cash' : 'Card';
          const symbol = order.paymentMethod === 'upi' ? '📱' : order.paymentMethod === 'cash' ? '💵' : '💳';
          triggerNotification(
            `${symbol} ${methodLabel} Payment Confirmation Required (Table ${order.tableNumber})`,
            `${order.customerName || 'Guest'} is waiting for payment confirmation of ${state.restaurant.currency}${order.totalAmount}`
          );
        }
      }
    });

    prevOrdersRef.current = currentOrders;
  }, [state.orders, state.restaurant.currency]);

  // Watch waiter requests for notifications
  useEffect(() => {
    const adminId = state.admin?.id || 'admin-1';
    const myRequests = state.waiterRequests.filter(r => (r.restaurantId || 'admin-1') === adminId);

    if (isWaiterMount.current) {
      const initialRequests: Record<string, boolean> = {};
      myRequests.forEach(r => {
        initialRequests[r.id] = r.resolved;
      });
      prevWaiterRequestsRef.current = initialRequests;
      isWaiterMount.current = false;
      return;
    }

    const prevRequests = prevWaiterRequestsRef.current;
    const currentRequests: Record<string, boolean> = {};

    myRequests.forEach(req => {
      const reqId = req.id;
      const isResolved = req.resolved;
      const prevResolved = prevRequests[reqId];

      currentRequests[reqId] = isResolved;

      if (prevResolved === undefined && !isResolved) {
        triggerNotification(
          `🔔 Table ${req.tableNumber} is calling!`,
          `A customer at Table ${req.tableNumber} has called for waiter assistance.`
        );
      }
    });

    prevWaiterRequestsRef.current = currentRequests;
  }, [state.waiterRequests]);

  const adminId = state.admin?.id || 'admin-1';
  const activeWaiterRequests = state.waiterRequests.filter(r => !r.resolved && (r.restaurantId || 'admin-1') === adminId);
  const activeOrders = state.orders.filter(o => ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status) && (o.restaurantId || 'admin-1') === adminId);

  const handleUpdateStatus = (orderId: string, status: OrderStatus) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status } });
    if (status === 'served') {
      dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
      addToast('success', `Payment confirmed! Order marked as Served/Completed.`);
    } else {
      addToast('success', `Order status updated to ${STATUS_CONFIG[status].label}`);
    }
  };

  const handleConfirmUpiPayment = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'served' } });
    dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
    addToast('success', 'UPI Payment Confirmed! Order marked as completed.');
  };

  const handleConfirmCashPayment = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'served' } });
    dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
    addToast('success', 'Cash Payment Confirmed! Order marked as completed.');
  };

  const handleConfirmCardPayment = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'served' } });
    dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
    addToast('success', 'Card Payment Confirmed! Order marked as completed.');
  };

  return (
    <div style={{ padding: '20px 20px 20px', animation: 'fadeIn 0.3s ease' }}>
      {/* Notification Consent Banner */}
      {notificationPermission === 'default' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 100%)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📣</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Enable Live Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Get real-time browser alerts when a customer places an order or calls the waiter.</div>
            </div>
          </div>
          <button
            onClick={handleRequestPermission}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(59,130,246,0.3)',
            }}
          >
            Enable Alerts
          </button>
        </div>
      )}

      {/* Waiter Requests Section */}
      {activeWaiterRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.03) 100%)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'blink-yellow 3s infinite',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--error)' }}>
              Active Waiter Requests ({activeWaiterRequests.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {activeWaiterRequests.map(req => (
              <div key={req.id} style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Table {req.tableNumber}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => {
                    dispatch({ type: 'RESOLVE_WAITER', payload: req.id });
                    addToast('success', `Assistance for Table ${req.tableNumber} resolved.`);
                  }}
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Orders Board
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Manage your daily restaurant flow
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Wallet Balance Display - Clickable */}
          <button
            onClick={() => {
              localStorage.setItem('meenufy_admin_more_section', 'subscription');
              dispatch({ type: 'SET_ADMIN_TAB', payload: 'more' });
            }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
            title="Go to Wallet & Pricing settings"
          >
            <span>👛</span>
            <span>₹{state.walletBalance}</span>
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

      {/* Kanban Board of Active Orders */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          paddingBottom: 12,
          minHeight: 520,
          alignItems: 'flex-start',
        }}>
          {[
            { status: 'pending', label: 'New Order', color: '#f59e0b', list: activeOrders.filter(o => o.status === 'pending') },
            { status: 'preparing', label: 'Preparing', color: '#a855f7', list: activeOrders.filter(o => o.status === 'preparing') },
            { status: 'ready', label: 'Ready', color: '#22c55e', list: activeOrders.filter(o => o.status === 'ready') },
            { status: 'bill_pay', label: 'Bill & Pay', color: '#3b82f6', list: activeOrders.filter(o => o.status === 'bill_pay') },
          ].map(col => (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const orderId = e.dataTransfer.getData('text/plain');
                if (orderId) {
                  handleUpdateStatus(orderId, col.status as OrderStatus);
                }
              }}
              style={{
                flex: 1,
                minWidth: 280,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignSelf: 'stretch',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{col.label}</span>
                </div>
                <span style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
                  {col.list.length}
                </span>
              </div>

              {/* Card List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', maxHeight: '650px', minHeight: 420 }}>
                {col.list.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    padding: 24,
                    textAlign: 'center',
                  }}>
                    Drag orders here
                  </div>
                ) : (
                  col.list.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleUpdateStatus}
                      onConfirmUpi={handleConfirmUpiPayment}
                      onConfirmCash={handleConfirmCashPayment}
                      onConfirmCard={handleConfirmCardPayment}
                      currency={state.restaurant.currency}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Table Map */}
      <TableMap />
    </div>
  );
}

function TableMap() {
  const { state } = useStore();
  const { tables, orders } = state;

  const occupiedMap: Record<string, { customerName: string; orderCount: number }> = {};
  orders.forEach(o => {
    if (['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status)) {
      if (!occupiedMap[o.tableId]) {
        occupiedMap[o.tableId] = { customerName: o.customerName || 'Guest', orderCount: 1 };
      } else {
        occupiedMap[o.tableId].orderCount += 1;
      }
    }
  });

  if (tables.length === 0) {
    return (
      <div style={{
        padding: '20px 24px',
        background: 'var(--bg-elevated)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        marginBottom: 24,
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🪑</div>
        <div>No tables configured yet.</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Go to <strong>More → Manage QR &amp; Tables</strong> to set up your tables.</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>🪑 Table Map</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Live floor status</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#22c55e', display: 'inline-block' }} /> Free
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} /> Occupied
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#eab308', display: 'inline-block' }} /> Maintenance
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 12,
      }}>
        {tables.map(table => {
          const isMaintenance = table.status === 'maintenance';
          const occupied = occupiedMap[table.id];
          const isOccupied = !!occupied && !isMaintenance;

          let bg = '#22c55e';
          let textColor = '#fff';
          let borderColor = '#16a34a';
          let statusLabel = 'Free';

          if (isMaintenance) {
            bg = '#eab308'; textColor = '#000'; borderColor = '#ca8a04'; statusLabel = 'Maintenance';
          } else if (isOccupied) {
            bg = '#ef4444'; textColor = '#fff'; borderColor = '#dc2626'; statusLabel = occupied.customerName;
          }

          return (
            <div key={table.id} style={{
              background: bg,
              border: `2px solid ${borderColor}`,
              borderRadius: 12,
              padding: '12px 8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              minHeight: 100,
              justifyContent: 'center',
              boxShadow: isOccupied ? '0 4px 16px rgba(239,68,68,0.35)' : isMaintenance ? '0 4px 16px rgba(234,179,8,0.3)' : '0 4px 16px rgba(34,197,94,0.2)',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: textColor, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                {table.number}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: textColor, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {statusLabel}
              </div>
              {isOccupied && occupied.orderCount > 1 && (
                <div style={{ fontSize: 9, fontWeight: 800, background: 'rgba(0,0,0,0.25)', color: '#fff', borderRadius: 99, padding: '1px 6px' }}>
                  {occupied.orderCount} orders
                </div>
              )}
              {isMaintenance && <Wrench size={13} color={textColor} style={{ opacity: 0.8 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
  onConfirmUpi,
  onConfirmCash,
  onConfirmCard,
  currency
}: {
  order: Order;
  onStatusChange: (id: string, s: OrderStatus) => void;
  onConfirmUpi: (id: string) => void;
  onConfirmCash: (id: string) => void;
  onConfirmCard: (id: string) => void;
  currency: string;
}) {
  // Look up customer VIP status
  const { state } = useStore();
  const customer = state.customers.find(c => c.phone === order.customerPhone);
  const isVip = customer ? !!customer.isVip : false;

  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const nextStatus = currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;

  // Update every second for accurate 1-second red blink
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = now - order.createdAt;
  const elapsedMins = elapsedMs / (1000 * 60);
  
  let timeBg = '#22c55e'; // green
  let timeColor = '#ffffff';
  if (elapsedMins > 30) {
    timeBg = '#ef4444'; // red
    timeColor = '#ffffff';
  } else if (elapsedMins > 15) {
    timeBg = '#eab308'; // yellow
    timeColor = '#000000';
  }

  const minVal = Math.floor(elapsedMins);
  const timeTextStr = `${minVal} min`;

  // Blink animation: yellow = subtle 3s pulse, red = hard 1s flash
  let timeBlink: string | undefined;
  if (elapsedMins > 30) {
    timeBlink = 'blink-red 1s step-end infinite';
  } else if (elapsedMins > 15) {
    timeBlink = 'blink-yellow 3s ease-in-out infinite';
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', order.id);
      }}
      className="card"
      style={{
        borderLeft: `3px solid ${cfg.color}`,
        padding: '12px 14px',
        animation: 'fadeIn 0.3s ease',
        cursor: 'grab',
        background: 'var(--bg-primary)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Table & Id */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Table {order.tableNumber}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              #{order.id.slice(-4).toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>{order.customerName || 'Guest'}</span>
              {isVip && (
                <span style={{ color: '#ffd700', fontWeight: 800, fontSize: 11, textShadow: '0 0 6px rgba(255, 215, 0, 0.4)' }}>
                  [👑 VIP]
                </span>
              )}
            </span>
            {order.numberOfGuests && (
              <span style={{
                fontSize: 9.5, fontWeight: 700,
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                padding: '2px 6px', borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                👥 {order.numberOfGuests}
              </span>
            )}
            <span style={{ 
              fontSize: 9.5, 
              fontWeight: 800, 
              background: timeBg, 
              color: timeColor, 
              padding: '2px 6px', 
              borderRadius: 4,
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1,
              animation: timeBlink,
            }}>
              {timeTextStr}
            </span>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 99,
          background: cfg.bgColor, color: cfg.color,
          fontSize: 10, fontWeight: 700,
          flexShrink: 0,
        }}>
          <Icon size={10} />
          {cfg.label}
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 8, borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
        {order.items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: 'var(--text-secondary)', padding: '1px 0',
          }}>
            <span>{item.qty}x {item.name}{item.variant ? ` (${item.variant.name})` : ''}</span>
            <span>{currency}{item.price * item.qty}</span>
          </div>
        ))}
        {order.specialNote && (
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            💬 {order.specialNote}
          </div>
        )}
      </div>

      {/* Payment details or live action requests */}
      {order.status === 'bill_pay' && (
        <div style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {order.paymentStatus === 'waiting_confirmation' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'var(--brand)', marginBottom: 6 }}>
                {order.paymentMethod === 'upi' ? <QrCode size={13} /> : order.paymentMethod === 'cash' ? <Coins size={13} /> : <CreditCard size={13} />}
                {order.paymentMethod === 'upi' ? 'UPI Payment Received' : order.paymentMethod === 'cash' ? 'Requested Cash Bill' : 'Requested Card Bill'}
              </div>
              {order.paymentMethod === 'upi' && (
                <button
                  className="btn btn-full"
                  style={{
                    background: 'var(--success)',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(34,197,94,0.3)'
                  }}
                  onClick={() => onConfirmUpi(order.id)}
                >
                  Confirm {currency}{order.totalAmount} received from UPI
                </button>
              )}
              {order.paymentMethod === 'cash' && (
                <button
                  className="btn btn-full"
                  style={{
                    background: 'var(--brand)',
                    color: '#000',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => onConfirmCash(order.id)}
                >
                  Confirm Cash {currency}{order.totalAmount} collected
                </button>
              )}
              {order.paymentMethod === 'card' && (
                <button
                  className="btn btn-full"
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => onConfirmCard(order.id)}
                >
                  Confirm Card {currency}{order.totalAmount} paid
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Collect Payment:</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  onClick={() => onConfirmCash(order.id)} 
                  style={{ flex: 1, padding: '4px 6px', fontSize: 10, background: 'var(--border)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                >
                  Cash
                </button>
                <button 
                  onClick={() => onConfirmCard(order.id)} 
                  style={{ flex: 1, padding: '4px 6px', fontSize: 10, background: 'var(--border)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                >
                  Card
                </button>
                <button 
                  onClick={() => onConfirmUpi(order.id)} 
                  style={{ flex: 1, padding: '4px 6px', fontSize: 10, background: 'var(--border)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                >
                  UPI
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer / Standard Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
          {currency}{order.totalAmount}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {nextStatus && order.status !== 'bill_pay' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStatusChange(order.id, nextStatus)}
              style={{ fontSize: 10, padding: '4px 8px' }}
            >
              Next
            </button>
          )}
          {order.status !== 'cancelled' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onStatusChange(order.id, 'cancelled')}
              style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
