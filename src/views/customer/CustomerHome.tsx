import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Search, Star, Award, ArrowRight, X, AlertCircle } from 'lucide-react';
import { db } from '../../utils/firebase';
import { ref, get } from 'firebase/database';

// Haversine formula to calculate distance in km between two sets of coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const VegNonVegIndicator = ({ isVeg, size = 14 }: { isVeg: boolean; size?: number }) => (
  <div style={{
    width: size,
    height: size,
    border: `1.5px solid ${isVeg ? '#22c55e' : '#ef4444'}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    borderRadius: 2,
    flexShrink: 0,
    padding: 1,
  }} title={isVeg ? 'Veg' : 'Non-Veg'}>
    <div style={{
      width: Math.max(4, size - 8),
      height: Math.max(4, size - 8),
      borderRadius: '50%',
      background: isVeg ? '#22c55e' : '#ef4444',
    }} />
  </div>
);


const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=60';
const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&auto=format&fit=crop&q=60';

const CITIES = [
  { name: 'Patna', lat: 25.5941, lon: 85.1376 }
];

export default function CustomerHome() {
  const { state, dispatch, addToast } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  
  // Geolocation states - loaded from localStorage to persist state across view/menu toggles
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(() => {
    const saved = localStorage.getItem('meenufy_customer_coords');
    return saved ? JSON.parse(saved) : { latitude: 25.5941, longitude: 85.1376 };
  });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressName, setAddressName] = useState(() => {
    return localStorage.getItem('meenufy_customer_address_name') || 'City: Patna';
  });
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    return localStorage.getItem('meenufy_customer_selected_city') || 'Patna';
  });
  const [showSwitchRestModal, setShowSwitchRestModal] = useState(false);
  const [pendingRestId, setPendingRestId] = useState<string | null>(null);
  const [cartRestId, setCartRestId] = useState<string | null>(null);

  const [customerTheme, setCustomerTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('meenufy_customer_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (customerTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    localStorage.setItem('meenufy_customer_theme', customerTheme);
  }, [customerTheme]);

  // Filters
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'none'>('none');

  // Whether Firebase has sent real restaurant accounts (used to show skeleton vs empty)
  const accountsReady = state.accountsFromDb;

  const [showFirstTimeCityModal, setShowFirstTimeCityModal] = useState(() => {
    // Auto-dismiss if already have location data — no need to gate returning users
    if (localStorage.getItem('meenufy_first_time_city_selected')) return false;
    // Also auto-dismiss if coords already set (default Patna)
    const savedCoords = localStorage.getItem('meenufy_customer_coords');
    if (savedCoords) {
      localStorage.setItem('meenufy_first_time_city_selected', 'true');
      return false;
    }
    return false; // Only Patna available — always auto-select
  });
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  // Use global state coupons directly so they persist across navigation
  const allCoupons = state.coupons || [];

  // Cross-restaurant meals states
  const [nearbyMeals, setNearbyMeals] = useState<any[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  // Enforce GPS authorization on mount if not already loaded from cache
  useEffect(() => {
    const savedCoords = localStorage.getItem('meenufy_customer_coords');
    if (savedCoords) return;

    if (selectedCity === 'gps' && navigator.geolocation) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setCoords(newCoords);
          localStorage.setItem('meenufy_customer_coords', JSON.stringify(newCoords));
          setAddressName('Current GPS Location');
          localStorage.setItem('meenufy_customer_address_name', 'Current GPS Location');
          setGpsLoading(false);
        },
        () => {
          setGpsLoading(false);
          addToast('info', 'Please enable location services or choose a city to browse restaurants.');
        }
      );
    }
  }, []);

  const handleCityChange = (cityVal: string) => {
    setSelectedCity(cityVal);
    localStorage.setItem('meenufy_customer_selected_city', cityVal);
    if (cityVal === 'gps') {
      if (navigator.geolocation) {
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setCoords(newCoords);
            localStorage.setItem('meenufy_customer_coords', JSON.stringify(newCoords));
            setAddressName('Current GPS Location');
            localStorage.setItem('meenufy_customer_address_name', 'Current GPS Location');
            setGpsLoading(false);
          },
          () => {
            setGpsLoading(false);
            setCoords(null);
            localStorage.removeItem('meenufy_customer_coords');
            setAddressName('Location Disabled');
            localStorage.setItem('meenufy_customer_address_name', 'Location Disabled');
          }
        );
      }
    } else if (cityVal === 'all') {
      // Mock coordinates to central position, but distance checking is bypassed in filter
      const newCoords = { latitude: 12.9348, longitude: 77.6202 };
      setCoords(newCoords);
      localStorage.setItem('meenufy_customer_coords', JSON.stringify(newCoords));
      setAddressName('India Browsing');
      localStorage.setItem('meenufy_customer_address_name', 'India Browsing');
    } else {
      const cityObj = CITIES.find(c => c.name === cityVal);
      if (cityObj) {
        const newCoords = { latitude: cityObj.lat, longitude: cityObj.lon };
        setCoords(newCoords);
        localStorage.setItem('meenufy_customer_coords', JSON.stringify(newCoords));
        setAddressName(`City: ${cityObj.name}`);
        localStorage.setItem('meenufy_customer_address_name', `City: ${cityObj.name}`);
      }
    }
  };

  const handleRequestGps = () => {
    if (!navigator.geolocation) {
      addToast('error', 'Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoords(newCoords);
        localStorage.setItem('meenufy_customer_coords', JSON.stringify(newCoords));
        setAddressName('Current GPS Location');
        localStorage.setItem('meenufy_customer_address_name', 'Current GPS Location');
        addToast('success', '📍 Geolocation enabled successfully!');
        setGpsLoading(false);
      },
      (err) => {
        console.error(err);
        addToast('error', 'Location access denied. Please enable GPS.');
        setGpsLoading(false);
      }
    );
  };

  const openRestaurantDirectly = (restaurantId: string) => {
    dispatch({ type: 'SET_ACTIVE_CUSTOMER_RESTAURANT', payload: restaurantId });
    const newUrl = `${window.location.pathname}?restaurant=${restaurantId}`;
    window.history.pushState({}, '', newUrl);
    dispatch({ type: 'SET_CUSTOMER_TAB', payload: 'home' });

    // Pre-fetch menu items AND categories atomically in background
    const alreadyHasItems = state.menuItems.some(i => i && i.restaurantId === restaurantId);
    const alreadyHasCats = state.categories.some(c => c && c.restaurantId === restaurantId);

    if (!alreadyHasItems || !alreadyHasCats) {
      Promise.all([
        get(ref(db!, `menuItems/${restaurantId}`)),
        get(ref(db!, `categories/${restaurantId}`)),
      ]).then(([menuSnap, catSnap]) => {
        const menuData = menuSnap.val();
        const catData = catSnap.val();

        const items = menuData
          ? (Array.isArray(menuData) ? menuData.filter(Boolean) : Object.values(menuData)).filter(Boolean) as any[]
          : [];
        const cats = catData
          ? (Array.isArray(catData) ? catData.filter(Boolean) : Object.values(catData)).filter(Boolean) as any[]
          : [];

        dispatch({
          type: 'SYNC_MENU_DATA' as any,
          payload: {
            restaurantId,
            items: items.map((i: any) => ({ ...i, restaurantId: i.restaurantId || restaurantId })),
            categories: cats.map((c: any) => ({ ...c, restaurantId: c.restaurantId || restaurantId }))
          }
        });
      }).catch(() => {
        // Fallback: onValue listeners in RealtimeStore will populate data
      });
    }
  };

  const handleOpenRestaurant = (restaurantId: string) => {
    // Check if cart has items from a different restaurant
    if (state.cart && state.cart.length > 0) {
      const firstCartItem = state.cart[0];
      const activeCartId = firstCartItem.restaurantId || localStorage.getItem('meenufy_active_restaurant_id');
      if (activeCartId && activeCartId !== restaurantId) {
        setPendingRestId(restaurantId);
        setCartRestId(activeCartId);
        setShowSwitchRestModal(true);
        return;
      }
    }

    openRestaurantDirectly(restaurantId);
  };

  // Filter & calculate active restaurants nearby (within 15 km limit)
  // useMemo prevents expensive Haversine recalculation on every Firebase push (orders, pings, etc.)
  const allAccounts = state.restaurantAccounts || [];
  const activeRestaurants = useMemo(() => allAccounts.filter(acc => acc.status === 'active'), [allAccounts]);



  const processedRestaurants = useMemo(() => {
    const list = activeRestaurants
      .map(acc => {
        const rLat = acc.latitude || 12.9348;
        const rLon = acc.longitude || 77.6202;
        const uLat = coords?.latitude || 12.9348;
        const uLon = coords?.longitude || 77.6202;

        const distance = calculateDistance(uLat, uLon, rLat, rLon);
        return {
          ...acc,
          distance,
        };
      })
      .filter(acc => {
        // 1. If Global mode is selected, we bypass the 15km distance check!
        if (selectedCity === 'all') {
          const matchesSearch = searchQuery.trim() === '' || 
            acc.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (acc.cuisines && acc.cuisines.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchesSearch;
        }

        // 2. Haversine 15 Kilometer radius limit or city address fallback
        const isNearby = acc.distance <= 15;
        const isAddressMatch = selectedCity !== 'all' && selectedCity !== 'gps' && 
                               !!acc.address && acc.address.toLowerCase().includes(selectedCity.toLowerCase());
        if (!isNearby && !isAddressMatch && coords) return false;

        // 3. Search query filter
        const matchesSearch = searchQuery.trim() === '' || 
          acc.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (acc.cuisines && acc.cuisines.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesSearch;
      });

    // Fallback: If no nearby match found or GPS pending, show all active restaurants so list is never blank!
    if (list.length === 0 && activeRestaurants.length > 0) {
      return activeRestaurants.map(acc => {
        const rLat = acc.latitude || 12.9348;
        const rLon = acc.longitude || 77.6202;
        const uLat = coords?.latitude || 12.9348;
        const uLon = coords?.longitude || 77.6202;
        return {
          ...acc,
          distance: calculateDistance(uLat, uLon, rLat, rLon)
        };
      });
    }

    return list;
  }, [activeRestaurants, coords, selectedCity, searchQuery]);

  // Fetch meals from all nearby restaurants in parallel when coordinates are active
  useEffect(() => {
    const q = selectedCuisine || searchQuery.trim().toLowerCase();
    if (!q || !coords || processedRestaurants.length === 0) {
      setNearbyMeals([]);
      return;
    }

    setLoadingMeals(true);

    // Fetch meals from nearby restaurants for the cuisine/search filter section
    const mealPromises = processedRestaurants.map(rest => {
      return get(ref(db!, `menuItems/${rest.id}`))
        .then(snapshot => {
          const data = snapshot.val();
          if (data) {
            const mealsList = Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
            return mealsList.map((meal: any) => ({
              ...meal,
              restaurantId: rest.id,
              restaurantName: rest.restaurantName,
              restaurantLogo: rest.logo,
              restaurantRating: rest.rating,
              distance: rest.distance
            }));
          }
          return [];
        })
        .catch(() => []);
    });

    Promise.all(mealPromises).then(mealResults => {
      setNearbyMeals(mealResults.flat());
      setLoadingMeals(false);
    });
  }, [coords, processedRestaurants.map(r => r.id).join(',')]);

  // Filter meals matching the selected cuisine filter or search
  const filteredMeals = nearbyMeals.filter(meal => {
    const q = selectedCuisine || searchQuery.trim().toLowerCase();
    if (!q) return false;

    return (
      meal.name?.toLowerCase().includes(q) ||
      meal.category?.toLowerCase().includes(q) ||
      meal.description?.toLowerCase().includes(q)
    );
  });

  // Group matching meals by restaurant ID, returning list of restaurants with up to 2 matching meals each
  const groupedRestaurantMeals = (() => {
    const groups: Record<string, any[]> = {};
    filteredMeals.forEach(meal => {
      if (!groups[meal.restaurantId]) {
        groups[meal.restaurantId] = [];
      }
      groups[meal.restaurantId].push(meal);
    });

    return Object.entries(groups).map(([restaurantId, meals]) => {
      const restAccount = state.restaurantAccounts?.find(acc => acc.id === restaurantId);
      const distance = processedRestaurants.find(r => r.id === restaurantId)?.distance || 0;
      
      // Limit to 2 meals per restaurant
      const displayedMeals = meals.slice(0, 2);
      
      return {
        restaurantId,
        restaurantName: restAccount?.restaurantName || meals[0].restaurantName,
        logo: restAccount?.logo || meals[0].restaurantLogo,
        rating: restAccount?.rating ?? 0,
        tagline: restAccount?.tagline || 'Flavors you will love',
        cuisines: restAccount?.cuisines || 'Multi-Cuisine',
        distance,
        meals: displayedMeals,
        totalMatchingCount: meals.length
      };
    });
  })();

  // Apply sorting to restaurants list
  if (sortBy === 'distance') {
    processedRestaurants.sort((a, b) => a.distance - b.distance);
  } else if (sortBy === 'rating') {
    processedRestaurants.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  return (
    <div style={{
      background: 'var(--bg-primary)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      paddingBottom: 160,
      animation: 'fadeIn 0.2s ease-in-out'
    }}>
      {/* Location Header */}
      <div style={{
        padding: '8px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        gap: 6
      }}>
        {/* Left Side: Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} title={addressName}>
          <img 
            src={customerTheme === 'light' ? '/meenufy_logo_transparent.png' : '/meenufy_logo_white.png'} 
            alt="Meenufy Logo" 
            style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} 
          />
          <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px', display: 'inline-block' }}>Meenufy</span>
        </div>

        {/* Right Side Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
          {/* Restaurateur Dashboard Redirect Button */}
          <button
            onClick={() => {
              window.location.href = '/admin';
            }}
            style={{
              padding: '5px 8px',
              fontSize: '10px',
              fontWeight: 800,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              boxShadow: '0 2px 8px rgba(255, 125, 0, 0.2)',
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <span>👨‍🍳</span>
            <span>Restaurateur</span>
          </button>

          <select
            value={selectedCity}
            onChange={e => handleCityChange(e.target.value)}
            style={{
              padding: '5px 6px',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              outline: 'none',
              maxWidth: 75,
              textOverflow: 'ellipsis',
              flexShrink: 0
            }}
          >
            {CITIES.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setCustomerTheme(prev => prev === 'light' ? 'dark' : 'light')}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: 0,
              flexShrink: 0
            }}
            title="Toggle Light/Dark Theme"
          >
            {customerTheme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      {/* Geolocation Gate Card */}
      {!coords ? (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          marginTop: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 320,
          margin: '60px auto 0',
          background: 'var(--bg-elevated)',
          border: '1px dashed var(--border)',
          borderRadius: 16
        }}>
          <AlertCircle size={44} color="var(--brand)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Location Access Required
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            To view restaurants offering service within a 15 km radius, please enable your device location services.
          </p>
          <button
            onClick={handleRequestGps}
            disabled={gpsLoading}
            className="btn btn-primary"
            style={{ width: '100%', background: 'var(--brand)', color: '#000000', fontWeight: 800 }}
          >
            {gpsLoading ? 'Acquiring GPS...' : 'Enable Location Services'}
          </button>
        </div>
      ) : (
        /* Geolocation Allowed view */
        <>
          {/* Offers and Promo Banner Carousel */}
          <div style={{ padding: '16px 0 8px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 12, paddingLeft: 20, color: 'var(--text-secondary)' }}>
              DEALS FOR YOU 🎁
            </h3>
            {(() => {
              // Show deals from ALL active restaurants (not just nearby ones)
              const activeRestaurantIds = new Set(allAccounts.filter(a => a.status === 'active').map(r => r.id));
              const activeCouponsList = allCoupons.filter(c => c.isActive !== false && c.restaurantId && activeRestaurantIds.has(c.restaurantId));
              
              // Group by restaurantId and pick strictly 1 offer per restaurant (prefer showInDeals === true)
              const couponsByRest = new Map<string, typeof allCoupons[0]>();
              activeCouponsList.forEach(c => {
                const existing = couponsByRest.get(c.restaurantId!);
                if (!existing) {
                  couponsByRest.set(c.restaurantId!, c);
                } else if (c.showInDeals && !existing.showInDeals) {
                  couponsByRest.set(c.restaurantId!, c);
                }
              });
              const filteredCoupons = Array.from(couponsByRest.values());
              const row1Coupons = filteredCoupons.filter((_, idx) => idx % 2 === 0);
              const row2Coupons = filteredCoupons.filter((_, idx) => idx % 2 !== 0);

              const loopRow1 = [...row1Coupons, ...row1Coupons, ...row1Coupons];
              const loopRow2 = [...row2Coupons, ...row2Coupons, ...row2Coupons];

              if (filteredCoupons.length === 0) {
                return (
                  <div style={{
                    margin: '0 20px',
                    textAlign: 'center',
                    padding: '24px 20px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 16,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border)'
                  }}>
                    📢 No active restaurant offers in this city right now. Try switching to "India (All)"!
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', padding: '4px 0' }}>
                  <style>{`
                    @keyframes marquee-left {
                      0% { transform: translateX(0); }
                      100% { transform: translateX(-33.33%); }
                    }
                    @keyframes marquee-right {
                      0% { transform: translateX(-33.33%); }
                      100% { transform: translateX(0); }
                    }
                    .marquee-row {
                      display: flex;
                      white-space: nowrap;
                      width: max-content;
                    }
                    .marquee-row-1 {
                      animation: marquee-right 28s linear infinite;
                    }
                    .marquee-row-2 {
                      animation: marquee-left 22s linear infinite;
                    }
                    .marquee-item {
                      display: inline-flex;
                      align-items: center;
                      gap: 8px;
                      background: rgba(255, 125, 0, 0.08);
                      border: 1px solid rgba(255, 125, 0, 0.15);
                      border-radius: 99px;
                      padding: 6px 14px;
                      margin-right: 12px;
                      cursor: pointer;
                      font-size: 11px;
                      font-weight: 700;
                      color: var(--brand);
                      box-shadow: var(--shadow-sm);
                      transition: transform 0.15s ease;
                      user-select: none;
                    }
                    .marquee-item:hover {
                      transform: scale(1.03);
                      border-color: var(--brand);
                    }
                  `}</style>

                  {row1Coupons.length > 0 && (
                    <div style={{ overflow: 'hidden', width: '100%' }}>
                      <div className="marquee-row marquee-row-1">
                        {loopRow1.map((c, i) => {
                          const rest = allAccounts.find(r => r.id === c.restaurantId);
                          const restName = rest?.restaurantName || 'Restaurant';
                          const desc = c.type === 'percentage'
                            ? `Get ${c.value}% OFF on order above ₹${c.minOrderAmount || 0}`
                            : `Flat ₹${c.value} OFF on order above ₹${c.minOrderAmount || 0}`;
                          return (
                            <div
                              key={`row1-${c.id}-${i}`}
                              className="marquee-item"
                              onClick={() => setSelectedDeal({ coupon: c, restaurant: rest })}
                            >
                              <img
                                src={rest?.logo || DEFAULT_LOGO}
                                alt=""
                                style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '1px solid var(--border)' }}
                              />
                              <strong style={{ color: 'var(--text-primary)' }}>{restName}:</strong> {desc}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {row2Coupons.length > 0 && (
                    <div style={{ overflow: 'hidden', width: '100%' }}>
                      <div className="marquee-row marquee-row-2">
                        {loopRow2.map((c, i) => {
                          const rest = allAccounts.find(r => r.id === c.restaurantId);
                          const restName = rest?.restaurantName || 'Restaurant';
                          const desc = c.type === 'percentage'
                            ? `Get ${c.value}% OFF on order above ₹${c.minOrderAmount || 0}`
                            : `Flat ₹${c.value} OFF on order above ₹${c.minOrderAmount || 0}`;
                          return (
                            <div
                              key={`row2-${c.id}-${i}`}
                              className="marquee-item"
                              onClick={() => setSelectedDeal({ coupon: c, restaurant: rest })}
                            >
                              <img
                                src={rest?.logo || DEFAULT_LOGO}
                                alt=""
                                style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '1px solid var(--border)' }}
                              />
                              <strong style={{ color: 'var(--text-primary)' }}>{restName}:</strong> {desc}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Cuisines circular list */}
          <div style={{ padding: '16px 20px 8px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--text-secondary)' }}>
              WHAT'S ON YOUR MIND? 🍕
            </h3>
            <div style={{
              display: 'flex',
              gap: 16,
              overflowX: 'auto',
              paddingBottom: 6
            }} className="hide-scrollbar">
              {!state.cuisinesFromDb ? (
                /* Animated circular skeletons for cuisines during cold start */
                <>
                  <style>{`
                    @keyframes shimmer {
                      0% { background-position: -400px 0; }
                      100% { background-position: 400px 0; }
                    }
                    .skeleton-shine {
                      background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--border) 50%, var(--bg-elevated) 75%);
                      background-size: 800px 100%;
                      animation: shimmer 1.4s infinite linear;
                    }
                  `}</style>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={`skeleton-cuisine-${i}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0
                      }}
                    >
                      <div className="skeleton-shine" style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        border: '1px solid var(--border)'
                      }} />
                      <div className="skeleton-shine" style={{
                        width: 40,
                        height: 10,
                        borderRadius: 4
                      }} />
                    </div>
                  ))}
                </>
              ) : (state.popularCuisines || []).map((cuisine) => {
                const isSelected = selectedCuisine === cuisine.query;
                return (
                  <button
                    key={cuisine.name}
                    onClick={() => setSelectedCuisine(isSelected ? null : cuisine.query)}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: isSelected ? '3px solid var(--brand)' : '1px solid var(--border)',
                      boxShadow: isSelected ? 'var(--shadow-brand)' : 'none',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={cuisine.image}
                        alt={cuisine.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: `scale(${1 + (cuisine.zoom || 0) / 100})`,
                          transformOrigin: 'center'
                        }}
                      />
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? 'var(--brand)' : 'var(--text-secondary)'
                    }}>{cuisine.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input */}
          <div style={{ padding: '16px 20px 8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '10px 14px'
            }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                className="input"
                placeholder="Search meals, restaurants, or cuisines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  padding: 0
                }}
              />
              {(searchQuery || selectedCuisine) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCuisine(null);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Cross-restaurant Cuisine/Dishes results */}
          {(selectedCuisine || searchQuery.trim() !== '') ? (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0 }}>
                  MATCHING DISHES ({filteredMeals.length})
                </h3>
                <button
                  onClick={() => {
                    setSelectedCuisine(null);
                    setSearchQuery('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Clear filter
                </button>
              </div>

              {loadingMeals ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                  <span>Searching menus in range...</span>
                </div>
              ) : filteredMeals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No dishes match "{selectedCuisine || searchQuery}" nearby.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {groupedRestaurantMeals.map(group => (
                    <div
                      key={group.restaurantId}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 16,
                        padding: 14,
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Restaurant Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {/* Logo */}
                          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', overflow: 'hidden', background: '#ffffff', flexShrink: 0 }}>
                            <img src={group.logo || DEFAULT_LOGO} alt={group.restaurantName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
                              {group.restaurantName}
                            </h4>
                            <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                              {group.cuisines} · {group.distance.toFixed(1)} km away
                            </p>
                          </div>
                        </div>

                        {/* Rating */}
                        <div style={{
                          background: '#22c55e',
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: 900,
                          padding: '2px 6px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}>
                          <span>{(group.rating ?? 0).toFixed(1)}</span>
                          <Star size={9} fill="#ffffff" stroke="none" />
                        </div>
                      </div>

                      {/* Matching Meals list (Max 2) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {group.meals.map((meal: any) => (
                          <div
                            key={meal.id}
                            style={{
                              display: 'flex',
                              gap: 10,
                              padding: 8,
                              borderRadius: 10,
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-dim)'
                            }}
                          >
                            {/* Dish Photo */}
                            <div style={{
                              width: 50,
                              height: 50,
                              borderRadius: 8,
                              overflow: 'hidden',
                              background: 'var(--border-dim)',
                              flexShrink: 0,
                              position: 'relative'
                            }}>
                              <img src={meal.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=60'} alt={meal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', top: 2, left: 2 }}>
                                <VegNonVegIndicator isVeg={!!meal.isVeg} size={10} />
                              </div>
                            </div>

                            {/* Details */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{meal.name}</span>
                                <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--brand)' }}>₹{meal.price}</span>
                              </div>
                              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {meal.description || 'Tasty and fresh'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Button to View Full Menu */}
                      <button
                        onClick={() => handleOpenRestaurant(group.restaurantId)}
                        style={{
                          width: '100%',
                          marginTop: 12,
                          padding: '8px',
                          background: 'rgba(255, 125, 0, 0.08)',
                          border: '1px dashed var(--brand)',
                          borderRadius: 10,
                          color: 'var(--brand)',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        View Full Menu ({group.totalMatchingCount} items) <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Standard Restaurants browse listing */
            <>
              {/* Filters bar */}
              <div style={{
                padding: '8px 20px',
                display: 'flex',
                gap: 8,
                overflowX: 'auto'
              }} className="hide-scrollbar">
                <button
                  onClick={() => setSortBy(prev => prev === 'distance' ? 'none' : 'distance')}
                  style={{
                    background: sortBy === 'distance' ? 'var(--brand)' : 'var(--bg-elevated)',
                    color: sortBy === 'distance' ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Sort by Distance
                </button>

                <button
                  onClick={() => setSortBy(prev => prev === 'rating' ? 'none' : 'rating')}
                  style={{
                    background: sortBy === 'rating' ? 'var(--brand)' : 'var(--bg-elevated)',
                    color: sortBy === 'rating' ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Sort by Rating
                </button>
              </div>

              {/* Restaurants list */}
              <div style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--text-secondary)' }}>
                  ALL RESTAURANTS NEARBY ({processedRestaurants.length})
                </h3>

                {processedRestaurants.length === 0 ? (
                  accountsReady ? (
                    /* Real accounts loaded but no matches in this city */
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 12,
                      border: '1px dashed var(--border)'
                    }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                        No restaurants found within 15 km.
                      </p>
                    </div>
                  ) : (
                    /* Firebase loading — show animated skeleton cards */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <style>{`
                        @keyframes shimmer {
                          0% { background-position: -400px 0; }
                          100% { background-position: 400px 0; }
                        }
                        .skeleton-shine {
                          background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--border) 50%, var(--bg-elevated) 75%);
                          background-size: 800px 100%;
                          animation: shimmer 1.4s infinite linear;
                          border-radius: 8px;
                        }
                      `}</style>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: 16,
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                        }}>
                          <div style={{ display: 'flex', height: 125 }}>
                            <div className="skeleton-shine" style={{ width: 125, flexShrink: 0 }} />
                            <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div className="skeleton-shine" style={{ height: 20, width: '65%' }} />
                              <div className="skeleton-shine" style={{ height: 12, width: '45%' }} />
                              <div className="skeleton-shine" style={{ height: 12, width: '80%' }} />
                              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                                <div className="skeleton-shine" style={{ height: 20, width: 60 }} />
                                <div className="skeleton-shine" style={{ height: 20, width: 48 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', margin: 0, paddingBottom: 8 }}>
                        🔄 Loading nearby restaurants...
                      </p>
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {processedRestaurants.map(acc => (
                      <div
                        key={acc.id}
                        onClick={() => handleOpenRestaurant(acc.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          background: 'linear-gradient(135deg, #F97316 0%, #EA580C 80%, #C2410C 100%)',
                          border: 'none',
                          borderTopLeftRadius: 4,
                          borderBottomLeftRadius: 16,
                          borderTopRightRadius: 4,
                          borderBottomRightRadius: 4,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
                          transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(249,115,22,0.45)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(249,115,22,0.35)'; }}
                      >
                        {/* Orange Promotional Banner at the top of the card */}
                        {acc.promoText && (
                          <div style={{
                            background: 'rgba(0,0,0,0.25)',
                            color: '#ffffff',
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '4px 12px',
                            lineHeight: '1.3',
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            borderBottom: '1px solid rgba(255,255,255,0.15)',
                          }}>
                            📢 {acc.promoText.length > 50 ? acc.promoText.substring(0, 50) + '...' : acc.promoText}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'stretch' }}>
                          {/* Left Side: Restaurant Profile Image (Stretches to edges) */}
                          <div style={{
                            width: 100,
                            position: 'relative',
                            background: 'rgba(0,0,0,0.15)',
                            flexShrink: 0,
                            borderTopLeftRadius: 4,
                            borderBottomLeftRadius: 16,
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            overflow: 'hidden',
                            alignSelf: 'stretch'
                          }}>
                            <img
                              src={acc.posterImage || acc.bannerImage || DEFAULT_BANNER}
                              alt={acc.restaurantName}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </div>

                          {/* Right Side: Details */}
                          <div style={{
                            flex: 1,
                            padding: '8px 12px 8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: 85,
                            position: 'relative',
                            minWidth: 0
                          }}>
                            <div>
                              {/* Header with Logo on Top Right */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <h4 style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0, color: '#ffffff', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 3px rgba(0,0,0,0.3)', flex: 1 }}>
                                  {acc.restaurantName}
                                </h4>
                                
                                {/* Logo Image on Top Right */}
                                <div style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  border: '1px solid var(--border)',
                                  overflow: 'hidden',
                                  background: '#ffffff',
                                  flexShrink: 0
                                }}>
                                  <img
                                    src={acc.logo || DEFAULT_LOGO}
                                    alt={acc.restaurantName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              </div>

                              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', margin: 0, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {acc.cuisines || 'North Indian • Chinese • Fast Food'}
                              </p>
                            </div>

                            {/* Distance, Rating & Delivery */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: acc.distance <= 5 ? '#86efac' : '#fde047' }}>
                                  <span style={{ fontWeight: 800 }}>{acc.distance.toFixed(1)} km</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: '#86efac' }}>
                                  <Award size={10} color="#86efac" />
                                  <span style={{ fontWeight: 800 }}>Free</span>
                                </div>
                              </div>

                              {/* Rating Badge & Count */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <div style={{
                                  background: 'rgba(255,255,255,0.9)',
                                  color: '#16a34a',
                                  fontSize: 8,
                                  fontWeight: 900,
                                  padding: '1px 4px',
                                  borderRadius: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}>
                                  <span>{(acc.rating ?? 0).toFixed(1)}</span>
                                  <Star size={8} fill="#16a34a" stroke="none" />
                                </div>
                                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                                  ({acc.ratingsCount ?? 0})
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Meenufy Footer — extra scroll space + brand tagline */}
              <div style={{
                margin: '32px 20px 0',
                padding: '28px 20px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: 'var(--font-display)',
                  background: 'linear-gradient(90deg, #F97316, #EA580C)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: 8
                }}>Meenufy</div>
                <p style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: '0 0 6px',
                  lineHeight: 1.5
                }}>
                  "Your favourite restaurant, one tap away."
                </p>
                {/* Sub-section styled in the QR code box theme from the screenshot */}
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginTop: 16,
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 12px',
                    lineHeight: 1.6,
                    opacity: 0.95
                  }}>
                    Browse menus · Scan QR codes · Order at the table · Track in real-time
                  </p>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}>
                    {['🚀 Instant Menus', '💳 Easy Ordering', '🔔 Live Updates'].map(feat => (
                      <span key={feat} style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--brand)',
                        background: 'rgba(249,115,22,0.1)',
                        padding: '4px 10px',
                        borderRadius: 99,
                        border: '1px solid rgba(249,115,22,0.2)'
                      }}>{feat}</span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}


      {/* 1. First-Time City Selector Popup Modal */}
      {showFirstTimeCityModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200, background: 'rgba(10, 10, 10, 0.95)', backdropFilter: 'blur(16px)' }}>
          <div className="modal-content" style={{ maxWidth: 380, padding: 24, borderRadius: 18, border: '1px solid #e5e7eb', textAlign: 'center', background: '#ffffff', color: '#000000' }}>
            {/* 3D-shaded food items marquee scrolling from right to left */}
            <div style={{
              overflow: 'hidden',
              width: '100%',
              background: 'rgba(255, 125, 0, 0.05)',
              borderRadius: 14,
              padding: '12px 0',
              marginBottom: 16,
              border: '1px solid rgba(255, 125, 0, 0.15)',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                gap: '24px',
                width: 'max-content',
                animation: 'marqueeScroll 15s linear infinite'
              }}>
                <span className="floating-food-1" style={{ fontSize: 32, display: 'inline-block' }}>🍔</span>
                <span className="floating-food-2" style={{ fontSize: 32, display: 'inline-block' }}>🍕</span>
                <span className="floating-food-3" style={{ fontSize: 32, display: 'inline-block' }}>🌮</span>
                <span className="floating-food-4" style={{ fontSize: 32, display: 'inline-block' }}>🍣</span>
                <span className="floating-food-5" style={{ fontSize: 32, display: 'inline-block' }}>🍰</span>
                <span className="floating-food-6" style={{ fontSize: 32, display: 'inline-block' }}>🍩</span>
                <span className="floating-food-7" style={{ fontSize: 32, display: 'inline-block' }}>🍟</span>
                <span className="floating-food-8" style={{ fontSize: 32, display: 'inline-block' }}>🍜</span>
                
                {/* Duplicate set for seamless infinite loop */}
                <span className="floating-food-1" style={{ fontSize: 32, display: 'inline-block' }}>🍔</span>
                <span className="floating-food-2" style={{ fontSize: 32, display: 'inline-block' }}>🍕</span>
                <span className="floating-food-3" style={{ fontSize: 32, display: 'inline-block' }}>🌮</span>
                <span className="floating-food-4" style={{ fontSize: 32, display: 'inline-block' }}>🍣</span>
                <span className="floating-food-5" style={{ fontSize: 32, display: 'inline-block' }}>🍰</span>
                <span className="floating-food-6" style={{ fontSize: 32, display: 'inline-block' }}>🍩</span>
                <span className="floating-food-7" style={{ fontSize: 32, display: 'inline-block' }}>🍟</span>
                <span className="floating-food-8" style={{ fontSize: 32, display: 'inline-block' }}>🍜</span>
              </div>
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#000000', marginBottom: 6 }}>
              Welcome to Meenufy
            </h3>
            <p style={{ fontSize: 12, color: '#4b5563', lineHeight: '1.4', marginBottom: 20 }}>
              Choose a city to explore delicious cuisines, or enable GPS to find restaurants nearby.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* GPS Option */}
              <button
                onClick={() => {
                  handleCityChange('gps');
                  localStorage.setItem('meenufy_first_time_city_selected', 'true');
                  setShowFirstTimeCityModal(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255,125,0,0.2)'
                }}
              >
                📍 Use GPS Live Location
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                {CITIES.map(c => (
                  <button
                    key={c.name}
                    onClick={() => {
                      handleCityChange(c.name);
                      localStorage.setItem('meenufy_first_time_city_selected', 'true');
                      setShowFirstTimeCityModal(false);
                    }}
                    style={{
                      padding: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* India All Option */}
              <button
                onClick={() => {
                  handleCityChange('all');
                  localStorage.setItem('meenufy_first_time_city_selected', 'true');
                  setShowFirstTimeCityModal(false);
                }}
                style={{
                  padding: '10px',
                  background: 'var(--border)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: 6
                }}
              >
                🇮🇳 India (All)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Coupon Deal Details Popup Modal */}
      {selectedDeal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelectedDeal(null)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 360, padding: 24, position: 'relative', borderRadius: 16 }}>
            <button
              onClick={() => setSelectedDeal(null)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'var(--border)',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 10
              }}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              🎁 Exclusive Restaurant Offer
            </h3>

            {/* Clickable Restaurant Header Link */}
            <div
              onClick={() => {
                if (selectedDeal.restaurant) {
                  handleOpenRestaurant(selectedDeal.restaurant.id);
                  setSelectedDeal(null);
                }
              }}
              style={{
                background: 'rgba(255, 125, 0, 0.05)',
                border: '1px solid var(--brand)',
                borderRadius: 12,
                padding: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
                transition: 'all 0.2s'
              }}
              title="Click to visit restaurant profile menu"
            >
              {/* Logo */}
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#fff', border: '1px solid var(--border)', flexShrink: 0 }}>
                <img
                  src={selectedDeal.restaurant?.logo || DEFAULT_LOGO}
                  alt={selectedDeal.restaurant?.restaurantName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🏢 <span style={{ textDecoration: 'underline' }}>{selectedDeal.restaurant?.restaurantName}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedDeal.restaurant?.tagline || 'Tap to view full menu'}
                </div>
              </div>
            </div>

            {/* Offer details list */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: 250,
              overflowY: 'auto',
              paddingRight: 4,
              marginBottom: 16
            }} className="hide-scrollbar">
              {(() => {
                const restId = selectedDeal.restaurant?.id;
                const restaurantCoupons = allCoupons.filter(c => c.restaurantId === restId && c.isActive !== false);
                if (restaurantCoupons.length === 0) {
                  return (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                      No active coupons for this restaurant right now.
                    </div>
                  );
                }
                return restaurantCoupons.map(coupon => (
                  <div key={coupon.id} style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                        color: 'var(--brand)',
                        background: 'rgba(255, 125, 0, 0.1)',
                        border: '1.5px dashed var(--brand)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontFamily: 'monospace'
                      }}>
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code);
                          addToast('success', `📋 Copied code: ${coupon.code}`);
                        }}
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#fff',
                          background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700 }}>
                        {coupon.type === 'percentage'
                          ? `Get ${coupon.value}% OFF on order${coupon.minOrderAmount ? ` above ₹${coupon.minOrderAmount}` : ''}`
                          : `Flat ₹${coupon.value} OFF on order${coupon.minOrderAmount ? ` above ₹${coupon.minOrderAmount}` : ''}`
                        }
                      </div>
                      {coupon.label && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          ℹ️ {coupon.label}
                        </div>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <button
              onClick={() => {
                if (selectedDeal.restaurant) {
                  handleOpenRestaurant(selectedDeal.restaurant.id);
                  setSelectedDeal(null);
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, var(--brand), #ff7d00)',
                color: '#000',
                border: 'none',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                marginTop: 16,
                boxShadow: '0 4px 12px rgba(255,125,0,0.2)'
              }}
            >
              🟢 Open Restaurant & Order Now
            </button>
          </div>
        </div>
      )}

      {/* Switch Restaurant Confirmation Glassmorph Modal */}
      {showSwitchRestModal && (
        <div className="modal-backdrop" style={{ 
          zIndex: 1300, 
          background: 'rgba(10, 10, 10, 0.75)', 
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}>
          <div className="modal-content" style={{ 
            maxWidth: 360, 
            padding: 24, 
            borderRadius: 20, 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            background: 'rgba(20, 20, 20, 0.85)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
            color: '#fff',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🛒</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 10, fontFamily: 'var(--font-display)' }}>
              Switch Restaurant?
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: 24 }}>
              You have items from another restaurant in your cart. Switching will clear your current cart.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  dispatch({ type: 'CLEAR_CART' });
                  if (pendingRestId) openRestaurantDirectly(pendingRestId);
                  setShowSwitchRestModal(false);
                }}
                className="btn"
                style={{ 
                  background: 'var(--brand)', 
                  color: '#000', 
                  fontWeight: 800, 
                  height: 42, 
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Clear Cart & Browse
              </button>
              <button
                onClick={() => {
                  if (cartRestId) openRestaurantDirectly(cartRestId);
                  setShowSwitchRestModal(false);
                }}
                className="btn"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.08)', 
                  color: '#fff', 
                  fontWeight: 700, 
                  height: 42, 
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Go Back to Current Restro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
