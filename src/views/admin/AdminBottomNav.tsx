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
  const activeOrders = state.orders.filter(o => ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status));

  return (
    <div className="bottom-nav">
      {NAV.map(item => {
        const Icon = item.icon;
        const isActive = state.adminTab === item.key;
        return (
          <button
            key={item.key}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ADMIN_TAB', payload: item.key })}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              {item.key === 'home' && activeOrders.length > 0 && (
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
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
