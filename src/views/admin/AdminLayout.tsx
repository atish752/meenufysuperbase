import { useEffect, useRef, useState } from 'react';
import { useStore, isSubscriptionActive } from '../../context/RealtimeStore';
import type { OrderStatus } from '../../context/RealtimeStore';
import { hasFirebaseConfig } from '../../utils/firebase';
import { triggerNotification } from '../../utils/notifications';
import { printThermalReceipt } from '../../utils/printReceipt';
import AdminAuth from './AdminAuth';
import AdminHome from './AdminHome';
import AdminMenu from './AdminMenu';
import AdminAnalysis from './AdminAnalysis';
import AdminMore from './AdminMore';
import AdminSidebar from './AdminSidebar';
import AdminBottomNav from './AdminBottomNav';
import NewOrderAlert from './NewOrderAlert';
import SuperAdminDashboard from './SuperAdminDashboard';
import DeliveryDashboard from './DeliveryDashboard';
import AdminNotificationBell from '../../components/AdminNotificationBell';

export default function AdminLayout() {
  const { state, dispatch, addToast } = useStore();

  const [expiryWarning, setExpiryWarning] = useState<{
    show: boolean;
    title: string;
    message: string;
    actionLabel: string;
  } | null>(null);

  useEffect(() => {
    if (!state.isAdminLoggedIn || !state.restaurant || state.admin?.isDeliveryBoy || state.admin?.isSuperAdmin) return;

    const todayStr = new Date().toDateString();
    const lastPopupShownDate = localStorage.getItem('meenufy_last_expiry_popup_shown_date');
    if (lastPopupShownDate === todayStr) return;

    const subStatus = isSubscriptionActive(state.restaurant);
    const plan = state.restaurant.subscriptionPlan || 'free';

    if (!subStatus.active) {
      setExpiryWarning({
        show: true,
        title: "⚠️ Subscription Locked",
        message: "Your subscription has expired and customer ordering is locked. Please choose a plan and make a payment to restore ordering.",
        actionLabel: "Renew / Choose Plan"
      });
      localStorage.setItem('meenufy_last_expiry_popup_shown_date', todayStr);
      return;
    }

    if (plan === 'free' && subStatus.daysRemaining !== undefined && subStatus.daysRemaining <= 3) {
      setExpiryWarning({
        show: true,
        title: `⏳ Free Trial Ending: ${subStatus.daysRemaining} Day(s) Left`,
        message: `Your free trial carries every feature but will automatically expire in ${subStatus.daysRemaining} day(s). Choose a paid plan to keep ordering active!`,
        actionLabel: "View Paid Plans"
      });
      localStorage.setItem('meenufy_last_expiry_popup_shown_date', todayStr);
      return;
    }

    if (subStatus.isGracePeriod && subStatus.graceDaysRemaining !== undefined) {
      setExpiryWarning({
        show: true,
        title: `⚠️ Payment Grace Period: ${subStatus.graceDaysRemaining} Day(s) Left`,
        message: `Your plan has expired! You have ${subStatus.graceDaysRemaining} day(s) left to extend your payment. Pay now or customer ordering will be locked.`,
        actionLabel: "Pay & Extend"
      });
      localStorage.setItem('meenufy_last_expiry_popup_shown_date', todayStr);
      return;
    }

    if (plan !== 'free' && subStatus.daysRemaining !== undefined && subStatus.daysRemaining <= 3) {
      setExpiryWarning({
        show: true,
        title: `⏳ Subscription Expiring in ${subStatus.daysRemaining} Day(s)`,
        message: `Your paid plan will expire in ${subStatus.daysRemaining} day(s). Pay to extend your subscription and avoid entering the grace period.`,
        actionLabel: "Make Payment"
      });
      localStorage.setItem('meenufy_last_expiry_popup_shown_date', todayStr);
      return;
    }
  }, [state.isAdminLoggedIn, state.restaurant, state.admin]);

  // Notification watchers refs
  const prevOrdersRef = useRef<Record<string, { status: OrderStatus; paymentStatus: 'pending' | 'waiting_confirmation' | 'paid' }>>({});
  const prevWaiterRequestsRef = useRef<Record<string, boolean>>({});
  const isOrdersMount = useRef(true);
  const isWaiterMount = useRef(true);

  // Watch orders for notifications and autoprinting
  useEffect(() => {
    if (!state.isAdminLoggedIn || state.admin?.isSuperAdmin) return;
    if (state.admin?.isStaff && !state.admin.permissions?.includes('orders')) {
      return;
    }
    const adminId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
    const ownerIds = new Set([adminId, state.admin?.id, state.admin?.restaurantId].filter(Boolean));
    const myOrders = state.orders.filter(o => !o.restaurantId || ownerIds.has(o.restaurantId) || o.restaurantId === 'admin-1');

    let dismissedOrderIds: Set<string> = new Set();
    try {
      const raw = localStorage.getItem('meenufy_dismissed_alert_orders');
      if (raw) dismissedOrderIds = new Set(JSON.parse(raw));
    } catch {}

    if (isOrdersMount.current) {
      if (myOrders.length > 0) {
        const initialOrders: Record<string, any> = {};
        myOrders.forEach(o => {
          initialOrders[o.id] = { status: o.status, paymentStatus: o.paymentStatus || 'pending' };
        });
        prevOrdersRef.current = initialOrders;
        isOrdersMount.current = false;
      }
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

      if (!prev && !dismissedOrderIds.has(orderId)) {
        if (currentStatus === 'pending') {
          triggerNotification(
            `🛒 New Order Placed! (Table ${order.tableNumber})`,
            `${order.customerName || 'Guest'} ordered ${order.items.length} items (Total: ${state.restaurant.currency}${order.totalAmount})`
          );
          
          if (state.restaurant.orderPopupEnabled !== false) {
            dispatch({ type: 'SET_STATE', payload: { newOrderAlert: order } });
          }

          // Auto print KOT if enabled
          if (state.restaurant.autoprintKotEnabled) {
            printThermalReceipt(order, 'kot', state.restaurant).then(result => {
              if (result.error) {
                addToast('info', `🖨️ KOT: ${result.error}`);
              } else {
                addToast('success', `🖨️ KOT auto-printed for Table ${order.tableNumber}`);
              }
            }).catch(e => addToast('error', `Print error: ${e?.message || e}`));
          }
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

        // Auto print Bill if payment status transitions to 'paid'
        const justPaid = currentPayStatus === 'paid' && prev.paymentStatus !== 'paid';
        if (justPaid && state.restaurant.autoprintBillEnabled) {
          printThermalReceipt(order, 'bill', state.restaurant).then(result => {
            if (result.error) {
              addToast('info', `🖨️ Bill: ${result.error}`);
            } else {
              addToast('success', `🖨️ Bill auto-printed for Table ${order.tableNumber}`);
            }
          }).catch(e => addToast('error', `Print error: ${e?.message || e}`));
        }
      }
    });

    prevOrdersRef.current = currentOrders;
  }, [state.isAdminLoggedIn, state.orders, state.restaurant.currency, state.restaurant.autoprintKotEnabled, state.restaurant.autoprintBillEnabled, state.admin]);

  // Watch waiter requests for notifications
  useEffect(() => {
    if (!state.isAdminLoggedIn || state.admin?.isSuperAdmin) return;
    if (state.admin?.isStaff && !state.admin.permissions?.includes('qr_tables')) {
      return;
    }
    const adminId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
    const ownerIds = new Set([adminId, state.admin?.id, state.admin?.restaurantId].filter(Boolean));
    const myRequests = state.waiterRequests.filter(r => !r.restaurantId || ownerIds.has(r.restaurantId) || r.restaurantId === 'admin-1');

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
  }, [state.isAdminLoggedIn, state.waiterRequests, state.admin]);

  // ── Self-healing: remap orphaned items to the correct restaurantId ──────────
  // This runs once after login to ensure menu items and categories always match
  // the restaurantId used in QR codes (state.admin?.restaurantId).
  useEffect(() => {
    if (!state.isAdminLoggedIn || state.admin?.isSuperAdmin) return;

    const correctId = state.admin?.restaurantId;
    if (!correctId) return;

    // Find items/categories stored under a non-standard dynamic ID that belongs to this admin.
    const mockIds = new Set(['admin-1', 'admin-2', 'admin-3', 'admin-4']);
    const orphanIds = new Set<string>();

    state.menuItems.forEach(item => {
      const rid = item.restaurantId;
      if (rid && rid !== correctId && !mockIds.has(rid)) {
        orphanIds.add(rid);
      }
    });
    state.categories.forEach(cat => {
      const rid = cat.restaurantId;
      if (rid && rid !== correctId && !mockIds.has(rid)) {
        orphanIds.add(rid);
      }
    });

    orphanIds.forEach(fromId => {
      dispatch({ type: 'REMAP_ORPHAN_DATA', payload: { fromId, toId: correctId } });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isAdminLoggedIn, state.admin?.restaurantId]);

  if (!state.isAdminLoggedIn) {
    return <AdminAuth />;
  }

  if (state.admin?.isDeliveryBoy) {
    return <DeliveryDashboard />;
  }

  if (state.admin?.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  const renderTab = () => {
    const isStaff = !!state.admin?.isStaff;
    const perms = state.admin?.permissions || [];

    const isHomeAllowed = !isStaff || perms.includes('orders') || perms.includes('qr_tables');
    const isMenuAllowed = !isStaff || perms.includes('menu');
    const isOutletAllowed = !isStaff || perms.includes('outlet_setting');
    const isAnalysisAllowed = !isStaff || perms.includes('analysis');

    switch (state.adminTab) {
      case 'home': 
        return isHomeAllowed ? <AdminHome /> : <LockedScreen tabName="Orders Board & Table Map" />;
      case 'menu': 
        return isMenuAllowed ? <AdminMenu /> : <LockedScreen tabName="Menu Management" />;
      case 'outlet': 
        return isOutletAllowed ? <AdminMore forceSection="outlet" /> : <LockedScreen tabName="Outlet Settings" />;
      case 'analysis': 
        return isAnalysisAllowed ? <AdminAnalysis /> : <LockedScreen tabName="Sales Analysis" />;
      case 'more': 
        return <AdminMore />;
      default: 
        return <AdminHome />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {!hasFirebaseConfig && (
        <div style={{
          background: '#e11d48',
          color: '#fff',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 9999,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexShrink: 0
        }}>
          <span>⚠️ Firebase Offline: Local dev server was not restarted since creating the .env file. Please stop your dev server (Ctrl+C) and start it again with `npm run dev`.</span>
        </div>
      )}
      <div className="app-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* Desktop Sidebar */}
        <div className="desktop-only">
          <AdminSidebar />
        </div>

        {/* Page Content */}
        <div className="page-content" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="desktop-only" style={{ paddingBottom: 0 }}>
            {/* desktop doesn't need bottom padding */}
          </div>
          {renderTab()}
        </div>

        {/* Mobile Bottom Nav */}
        <div className="mobile-only">
          <AdminBottomNav />
        </div>

        {/* New Order Alert overlay */}
        {state.newOrderAlert && (!state.admin?.isStaff || state.admin.permissions?.includes('orders')) && <NewOrderAlert order={state.newOrderAlert} />}
      </div>

      {/* Global Admin Header Controls (Top Right) */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 16,
          zIndex: 9990,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10
        }}
      >
        {/* Global Notification Bell */}
        <AdminNotificationBell />

      </div>

      {expiryWarning && expiryWarning.show && (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 380, padding: 24, borderRadius: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{expiryWarning.title.split(' ')[0] || '⚠️'}</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>
              {expiryWarning.title}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              {expiryWarning.message}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  setExpiryWarning(null);
                  dispatch({ type: 'SET_ADMIN_TAB', payload: 'more' });
                }}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                  color: '#000',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255,125,0,0.2)'
                }}
              >
                {expiryWarning.actionLabel}
              </button>
              
              <button
                onClick={() => setExpiryWarning(null)}
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 18,
                  background: 'none',
                  color: 'var(--text-muted)',
                  border: 'none',
                  fontWeight: 500,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Remind Me Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LockedScreen({ tabName }: { tabName: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60dvh',
      textAlign: 'center',
      padding: '24px',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        width: 80, height: 80,
        borderRadius: '50%',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '2px solid #3b82f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        marginBottom: 20,
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)',
      }}>
        🔒
      </div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22,
        fontWeight: 900,
        color: '#60a5fa',
        marginBottom: 8,
        letterSpacing: '-0.02em',
        textTransform: 'uppercase'
      }}>
        Access Restricted
      </h2>
      <p style={{
        fontSize: 14,
        color: 'var(--text-muted)',
        maxWidth: 360,
        lineHeight: 1.6,
        margin: '0 0 24px 0'
      }}>
        You do not have permission to access the <strong>{tabName}</strong> tab. Please contact your restaurant owner or manager to request access.
      </p>
      <div style={{
        fontSize: 11,
        color: '#3b82f6',
        background: 'rgba(59, 130, 246, 0.06)',
        border: '1px dashed #3b82f6',
        padding: '8px 16px',
        borderRadius: 8,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        🛡️ Meenufy Security Guard
      </div>
    </div>
  );
}

