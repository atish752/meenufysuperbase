import { useEffect, lazy, Suspense } from 'react';
import { StoreProvider, useStore } from './context/RealtimeStore';
import CustomerLayout from './views/customer/CustomerLayout';
import ToastContainer from './components/ToastContainer';
import SplashScreen from './components/SplashScreen';

// Lazy load the heavy admin-facing components to split code and speed up customer load times
const AdminLayout = lazy(() => import('./views/admin/AdminLayout'));
const OnboardingFlow = lazy(() => import('./views/admin/OnboardingFlow'));

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

  // Onboarding routing check:
  // - Show onboarding ONLY when admin is logged in for the FIRST TIME (new signup)
  // - If DB says completed -> skip (returning admin, any device)
  // - If DB record exists but hasCompletedOnboarding is false -> show (new account, not finished)
  // - If no DB record at all (null) -> skip (pre-existing account or login user, don't force onboarding)
  // - Never show onboarding for staff or superadmin
  const currentAccount = state.restaurantAccounts?.find(acc => acc.id === state.admin?.id);
  const dbHasCompleted = currentAccount ? currentAccount.hasCompletedOnboarding === true : null;

  const isOnboarding = 
    window.location.pathname === '/onboarding' || 
    viewParam === 'onboarding' || 
    (state.isAdminLoggedIn && 
     !state.admin?.isSuperAdmin && 
     !state.admin?.isStaff && 
     !state.admin?.isDeliveryBoy && 
     dbHasCompleted === false);  // only explicitly false = new signup that hasn't finished onboarding

  if (isOnboarding) {
    return (
      <Suspense fallback={<SplashScreen />}>
        <OnboardingFlow />
      </Suspense>
    );
  }

  // Route to customer view if URL param present or accessing /home
  const isHomePath = window.location.pathname === '/home';
  if (viewParam === 'customer' || isHomePath) {
    return <CustomerLayout tableId={tableParam || 'table-1'} />;
  }

  // Admin view
  return (
    <Suspense fallback={<SplashScreen />}>
      <AdminLayout />
    </Suspense>
  );
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
