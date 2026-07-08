import { useStore } from '../../context/RealtimeStore';
import { Home, ClipboardList, MoreHorizontal } from 'lucide-react';

const NAV = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'orders', label: 'My Orders', icon: ClipboardList },
  { key: 'more', label: 'More', icon: MoreHorizontal },
] as const;

export default function CustomerBottomNav() {
  const { state, dispatch } = useStore();

  return (
    <div className="bottom-nav">
      {NAV.map(item => {
        const Icon = item.icon;
        const isActive = state.customerTab === item.key;
        return (
          <button
            key={item.key}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_CUSTOMER_TAB', payload: item.key })}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
