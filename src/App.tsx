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

  // Explicitly check for admin routes (/admin, /superadmin, /onboarding, ?view=admin)
  const savedRole = typeof window !== 'undefined' ? localStorage.getItem('meenufy_auth_role') : null;
  const isAdminRoute =
    pathname === '/admin' ||
    pathname === '/admin/' ||
    pathname.startsWith('/admin/') ||
    pathname === '/superadmin' ||
    pathname === '/superadmin/' ||
    pathname.startsWith('/superadmin/') ||
    pathname === '/onboarding' ||
    pathname === '/onboarding/' ||
    viewParam === 'admin' ||
    viewParam === 'superadmin' ||
    viewParam === 'onboarding' ||
    (state.isAdminLoggedIn && savedRole === 'admin');

  if (isAdminRoute) {
    const adminEmail = state.admin?.email?.trim().toLowerCase();
    const currentAccount = state.restaurantAccounts?.find(
      acc => acc.id === state.admin?.id || acc.id === state.admin?.restaurantId || (adminEmail && acc.ownerEmail?.trim().toLowerCase() === adminEmail)
    );
    const dbHasCompleted = currentAccount ? currentAccount.hasCompletedOnboarding !== false : false;

    const isOnboarding =
      pathname === '/onboarding' ||
      pathname === '/onboarding/' ||
      viewParam === 'onboarding' ||
      (state.isAdminLoggedIn &&
       !state.admin?.isSuperAdmin &&
       !state.admin?.isStaff &&
       !state.admin?.isDeliveryBoy &&
       !dbHasCompleted);

    if (isOnboarding) {
      return (
        <Suspense fallback={<SplashScreen />}>
          <OnboardingFlow />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<SplashScreen />}>
        <AdminLayout />
      </Suspense>
    );
  }

  // All non-admin routes render customer layout
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
