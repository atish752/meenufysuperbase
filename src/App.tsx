import { useEffect } from 'react';
import { StoreProvider, useStore } from './context/RealtimeStore';
import AdminLayout from './views/admin/AdminLayout';
import CustomerLayout from './views/customer/CustomerLayout';
import ToastContainer from './components/ToastContainer';
import SplashScreen from './components/SplashScreen';

function AppInner() {
  const { state } = useStore();

  // Check URL params to determine view
  useEffect(() => {
    // Customer view is accessed via /?view=customer&table=TABLE_ID
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  const tableParam = urlParams.get('table');

  if (state.isLoading) return <SplashScreen />;

  // Route to customer view if URL param present
  if (viewParam === 'customer' && tableParam) {
    return <CustomerLayout tableId={tableParam} />;
  }

  // Admin view
  return <AdminLayout />;
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
      <ToastRenderer />
    </StoreProvider>
  );
}

function ToastRenderer() {
  const { state, dispatch } = useStore();
  return <ToastContainer toasts={state.toasts} onRemove={(id) => dispatch({ type: 'REMOVE_TOAST', payload: id })} />;
}
