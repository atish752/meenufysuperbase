import { useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { hasFirebaseConfig } from '../../utils/firebase';
import AdminAuth from './AdminAuth';
import AdminHome from './AdminHome';
import AdminMenu from './AdminMenu';
import AdminCustomers from './AdminCustomers';
import AdminAnalysis from './AdminAnalysis';
import AdminMore from './AdminMore';
import AdminSidebar from './AdminSidebar';
import AdminBottomNav from './AdminBottomNav';
import NewOrderAlert from './NewOrderAlert';
import SuperAdminDashboard from './SuperAdminDashboard';

export default function AdminLayout() {
  const { state, dispatch } = useStore();

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

  if (state.admin?.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  const renderTab = () => {
    const isStaff = !!state.admin?.isStaff;
    const perms = state.admin?.permissions || [];

    const isHomeAllowed = !isStaff || perms.includes('orders') || perms.includes('qr_tables');
    const isMenuAllowed = !isStaff || perms.includes('menu');
    const isCustomersAllowed = !isStaff || perms.includes('customers');
    const isAnalysisAllowed = !isStaff || perms.includes('analysis');

    switch (state.adminTab) {
      case 'home': 
        return isHomeAllowed ? <AdminHome /> : <LockedScreen tabName="Orders Board & Table Map" />;
      case 'menu': 
        return isMenuAllowed ? <AdminMenu /> : <LockedScreen tabName="Menu Management" />;
      case 'customers': 
        return isCustomersAllowed ? <AdminCustomers /> : <LockedScreen tabName="Customer Database" />;
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

