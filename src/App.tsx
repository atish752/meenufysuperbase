import { useEffect, lazy, Suspense, useState } from 'react';
import { StoreProvider, useStore } from './context/RealtimeStore';
import CustomerLayout from './views/customer/CustomerLayout';
import ToastContainer from './components/ToastContainer';
import SplashScreen from './components/SplashScreen';

// Lazy load the heavy admin-facing components to split code and speed up customer load times
const AdminLayout = lazy(() => import('./views/admin/AdminLayout'));
const OnboardingFlow = lazy(() => import('./views/admin/OnboardingFlow'));

function getPathname() {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

function getSearch() {
  return typeof window !== 'undefined' ? window.location.search : '';
}

function AppInner() {
  const { state } = useStore();

  // Reactive URL tracking — re-renders when path or search changes
  const [pathname, setPathname] = useState(getPathname);
  const [search, setSearch] = useState(getSearch);

  useEffect(() => {
    const onNav = () => {
      setPathname(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onNav);
    // Also handle pushState / replaceState by patching them
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => { origPush(...args); onNav(); };
    history.replaceState = (...args) => { origReplace(...args); onNav(); };
    return () => {
      window.removeEventListener('popstate', onNav);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  const urlParams = new URLSearchParams(search);
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
    pathname === '/onboarding' ||
    pathname === '/onboarding/' ||
    viewParam === 'onboarding' ||
    (state.isAdminLoggedIn &&
     !state.admin?.isSuperAdmin &&
     !state.admin?.isStaff &&
     !state.admin?.isDeliveryBoy &&
     dbHasCompleted === false);

  if (isOnboarding) {
    return (
      <Suspense fallback={<SplashScreen />}>
        <OnboardingFlow />
      </Suspense>
    );
  }

  // Explicitly check for admin route:
  // /admin or /admin/ or ?view=admin -> ALWAYS show admin panel
  const isAdminRoute =
    pathname === '/admin' ||
    pathname === '/admin/' ||
    pathname.startsWith('/admin/') ||
    viewParam === 'admin';

  if (isAdminRoute) {
    return (
      <Suspense fallback={<SplashScreen />}>
        <AdminLayout />
      </Suspense>
    );
  }

  // Customer route: '/' or '/home' or viewParam=customer
  const isCustomerRoute =
    pathname === '/' ||
    pathname === '/home' ||
    pathname === '/home/' ||
    viewParam === 'customer';

  if (isCustomerRoute) {
    return <CustomerLayout tableId={tableParam || 'table-1'} />;
  }

  // Fallback: restaurant QR code scans or unknown paths -> customer view
  return <CustomerLayout tableId={tableParam || 'table-1'} />;
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
