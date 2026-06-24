import { useStore } from '../../context/RealtimeStore';
import { ShoppingBag, UtensilsCrossed, Users, BarChart3, MoreHorizontal } from 'lucide-react';

const NAV = [
  { key: 'home', label: 'Orders', icon: ShoppingBag },
  { key: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'analysis', label: 'Analysis', icon: BarChart3 },
  { key: 'more', label: 'More', icon: MoreHorizontal },
] as const;

export default function AdminBottomNav() {
  const { state, dispatch } = useStore();
  const adminRestaurantId = state.admin?.restaurantId || 'admin-1';
  const activeOrders = state.orders.filter(o => 
    ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status) && 
    (o.restaurantId === adminRestaurantId)
  );

  return (
    <div className="bottom-nav">
      {(() => {
        const isPermitted = (itemKey: string) => {
          if (!state.admin?.isStaff) return true;
          const perms = state.admin.permissions || [];
          if (itemKey === 'home') return perms.includes('orders') || perms.includes('qr_tables');
          if (itemKey === 'menu') return perms.includes('menu');
          if (itemKey === 'customers') return perms.includes('customers');
          if (itemKey === 'analysis') return perms.includes('analysis');
          if (itemKey === 'more') return true;
          return false;
        };

        return NAV.map(item => {
          const allowed = isPermitted(item.key);
          const Icon = item.icon;
          const isActive = state.adminTab === item.key;
            return (
              <button
                key={item.key}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ADMIN_TAB', payload: item.key })}
                style={!allowed ? {
                  color: '#60a5fa',
                  opacity: 0.85
                } : {}}
              >
                <div style={{ position: 'relative' }}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} style={!allowed ? { color: '#60a5fa' } : {}} />
                  {!allowed && (
                    <span style={{
                      position: 'absolute', top: -4, right: -8,
                      fontSize: 10
                    }}>
                      🔒
                    </span>
                  )}
                  {allowed && item.key === 'home' && activeOrders.length > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -6,
                      background: 'var(--brand)', color: '#000',
                      borderRadius: 99, fontSize: 9, fontWeight: 700,
                      padding: '1px 5px', minWidth: 16,
                      lineHeight: '14px', textAlign: 'center',
                    }}>
                      {activeOrders.length}
                    </span>
                  )}
                </div>
                <span style={!allowed ? { color: '#60a5fa', fontWeight: 600 } : {}}>{item.label}</span>
              </button>
            );
        });
      })()}
    </div>
  );
}
