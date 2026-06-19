import { useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
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
    switch (state.adminTab) {
      case 'home': return <AdminHome />;
      case 'menu': return <AdminMenu />;
      case 'customers': return <AdminCustomers />;
      case 'analysis': return <AdminAnalysis />;
      case 'more': return <AdminMore />;
      default: return <AdminHome />;
    }
  };

  return (
    <div className="app-layout" style={{ height: '100dvh' }}>
      {/* Desktop Sidebar */}
      <div className="desktop-only">
        <AdminSidebar />
      </div>

      {/* Page Content */}
      <div className="page-content" style={{ paddingBottom: 80 }}>
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
      {state.newOrderAlert && <NewOrderAlert order={state.newOrderAlert} />}
    </div>
  );
}

