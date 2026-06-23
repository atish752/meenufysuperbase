import { useState } from 'react';
import { useStore, getActiveRestaurantInfo } from '../../context/RealtimeStore';
import type { Order, OrderStatus } from '../../context/RealtimeStore';
import { ShoppingBag, Clock, ChefHat, Utensils, Check, X, Bell, ChevronDown, ChevronUp, Calendar, Printer } from 'lucide-react';
import { printThermalReceipt } from '../../utils/printReceipt';

import { playChime } from '../../utils/notifications';

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
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all' | string>('all');
  const [customDate, setCustomDate] = useState('');

  const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
  const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
  const isLoggedIn = !!(savedGoogle || savedCustom);

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

  const myPhoneIdentifier = localStorage.getItem('meenufy_customer_phone') || localStorage.getItem('meenufy_customer_guest_id') || '';
  const myOrders = state.orders
    .filter(o => o.customerPhone === myPhoneIdentifier || o.tableId === tableId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleCallWaiter = () => {
    const table = state.tables.find(t => t.id === tableId);
    dispatch({
      type: 'CALL_WAITER',
      payload: {
        id: `waiter-${Date.now()}`,
        tableNumber: table?.number || 0,
        tableId,
        createdAt: Date.now(),
        resolved: false,
      }
    });
    addToast('info', 'Waiter has been notified! 🔔');
    playChime();
  };

  // Find all unique months in user's orders
  const uniqueMonths: string[] = []; // format "YYYY-MM"
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
    // Check if it matches a specific YYYY-MM
    if (timeFilter.includes('-')) {
      const [year, month] = timeFilter.split('-').map(Number);
      return orderDate.getFullYear() === year && (orderDate.getMonth() + 1) === month;
    }
    return true; // 'all'
  });

  if (myOrders.length === 0) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        paddingTop: 60,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🍽️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>No Orders Yet</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          Go to the menu and add items to start your order!
        </p>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'menu' })}
        >
          Browse Menu
        </button>
      </div>
    );
  }

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
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>My Orders</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filteredOrders.length} order(s) shown</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleCallWaiter}
          style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Bell size={14} /> Call Waiter
        </button>
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
            <OrderStatusCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}

function OrderStatusCard({ order }: { order: Order }) {
  const { state, dispatch, addToast } = useStore();
  const info = STATUS_INFO[order.status];
  const Icon = info.icon;
  const currentStepIdx = STATUS_STEPS.indexOf(order.status);
  const isActive = !['served', 'cancelled'].includes(order.status);
  
  // Collapse historical orders by default to save height, keep active orders expanded
  const [expanded, setExpanded] = useState(isActive);

  return (
    <div className="card" style={{
      padding: 0, 
      overflow: 'hidden',
      borderColor: isActive ? info.color : undefined,
      borderWidth: isActive ? 1 : undefined,
      transition: 'all 0.2s ease',
    }}>
      {/* Order Header */}
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
          {/* Progress Steps (Only show for active tracking) */}
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

          {/* Items list */}
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

          {/* View/Download Bill Button */}
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

          {/* Cancel Order Button */}
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
        </>
      )}
    </div>
  );
}
