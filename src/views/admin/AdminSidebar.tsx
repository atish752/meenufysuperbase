import { useStore } from '../../context/RealtimeStore';
import { ShoppingBag, UtensilsCrossed, Store, BarChart3, MoreHorizontal, Bell, ChevronRight } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Orders', icon: ShoppingBag },
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { key: 'outlet', label: 'Outlet Settings', icon: Store },
  { key: 'analysis', label: 'Analysis', icon: BarChart3 },
  { key: 'more', label: 'More', icon: MoreHorizontal },
] as const;

export default function AdminSidebar() {
  const { state, dispatch } = useStore();

  const adminRestaurantId = state.admin?.restaurantId || 'admin-1';
  const activeOrders = state.orders.filter(o => 
    ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status) && 
    (o.restaurantId === adminRestaurantId)
  );

  return (
    <div className="sidebar">
      {/* Brand */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
          }}>
            <img src={state.adminTheme === 'light' ? '/meenufy_logo_light.png' : '/meenufy_logo_dark.png'} alt="Meenufy Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--brand)' }}>
              Meenufy
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Admin Panel
            </div>
          </div>
        </div>

        {/* Restaurant name */}
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'var(--bg-glass-light)', borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 1 }}>Restaurant</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {state.restaurant.name}
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 4px 8px' }}>
          Navigation
        </div>
        {(() => {
          const isPermitted = (itemKey: string) => {
            if (!state.admin?.isStaff) return true;
            const perms = state.admin.permissions || [];
            if (itemKey === 'home') return perms.includes('orders') || perms.includes('qr_tables');
            if (itemKey === 'menu') return perms.includes('menu');
            if (itemKey === 'outlet') return perms.includes('outlet_setting');
            if (itemKey === 'analysis') return perms.includes('analysis');
            if (itemKey === 'more') return true;
            return false;
          };

          return NAV_ITEMS.map(item => {
            const allowed = isPermitted(item.key);
            const Icon = item.icon;
            const isActive = state.adminTab === item.key;
            return (
              <button
                key={item.key}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ADMIN_TAB', payload: item.key as any })}
                style={{
                  ...(!allowed ? {
                    background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid #3b82f6' : 'none',
                    color: '#60a5fa',
                    opacity: 0.85,
                  } : {})
                }}
              >
                <Icon size={18} style={!allowed ? { color: '#60a5fa' } : {}} />
                <span style={{ flex: 1, color: !allowed ? '#60a5fa' : 'inherit', fontWeight: !allowed ? 600 : 'inherit' }}>
                  {item.label} {!allowed && '🔒'}
                </span>
                {allowed && item.key === 'home' && activeOrders.length > 0 && (
                  <span style={{
                    background: 'var(--brand)', color: '#000',
                    borderRadius: 99, fontSize: 10, fontWeight: 700,
                    padding: '1px 7px', minWidth: 20, textAlign: 'center',
                  }}>
                    {activeOrders.length}
                  </span>
                )}
                {isActive && allowed && <ChevronRight size={14} />}
              </button>
            );
          });
        })()}
      </nav>

      {/* Live order badge */}
      {activeOrders.length > 0 && (
        <div style={{ padding: '12px' }}>
          <div style={{
            padding: '12px',
            background: 'rgba(255,125,0,0.08)',
            border: '1px solid var(--border-brand)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'var(--brand-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bell size={16} color="var(--brand)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>
                {activeOrders.length} Active Order{activeOrders.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Needs attention</div>
            </div>
            <div className="dot-live" />
          </div>
        </div>
      )}

      {/* Profile mini */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--brand-dim)', border: '1px solid var(--border-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'var(--brand)',
          }}>
            {state.admin?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state.admin?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state.admin?.email}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
