import { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Search, MapPin, Star, Clock, Award, ArrowRight, X, AlertCircle } from 'lucide-react';

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

// Popular cuisines quick filters (circular category icons)
const POPULAR_CUISINES = [
  { name: 'Biryani', query: 'biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=150&auto=format&fit=crop&q=60' },
  { name: 'Pizza', query: 'pizza', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=60' },
  { name: 'Burgers', query: 'burger', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=60' },
  { name: 'Chinese', query: 'chinese', image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=150&auto=format&fit=crop&q=60' },
  { name: 'Desserts', query: 'sweet', image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=150&auto=format&fit=crop&q=60' },
  { name: 'South Indian', query: 'dosa', image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=150&auto=format&fit=crop&q=60' },
];

const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=60';
const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&auto=format&fit=crop&q=60';

const CITIES = [
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
  { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
  { name: 'Siwan', lat: 26.2196, lon: 84.3567 },
];

export default function CustomerHome() {
  const { state, dispatch, addToast } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  
  // Geolocation states - starts as null to enforce location requirement
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressName, setAddressName] = useState('Location Disabled');
  const [selectedCity, setSelectedCity] = useState<string>('gps');

  const [customerTheme, setCustomerTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('meenufy_customer_theme') as 'light' | 'dark') || 'dark';
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

  // Cross-restaurant meals states
  const [nearbyMeals, setNearbyMeals] = useState<any[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  // Enforce GPS authorization on mount
  useEffect(() => {
    if (selectedCity === 'gps' && navigator.geolocation) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setAddressName('Current GPS Location');
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
    if (cityVal === 'gps') {
      if (navigator.geolocation) {
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCoords({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setAddressName('Current GPS Location');
            setGpsLoading(false);
          },
          () => {
            setGpsLoading(false);
            setCoords(null);
            setAddressName('Location Disabled');
          }
        );
      }
    } else if (cityVal === 'all') {
      // Mock coordinates to central position, but distance checking is bypassed in filter
      setCoords({ latitude: 12.9348, longitude: 77.6202 });
      setAddressName('Global Browsing');
    } else {
      const cityObj = CITIES.find(c => c.name === cityVal);
      if (cityObj) {
        setCoords({ latitude: cityObj.lat, longitude: cityObj.lon });
        setAddressName(`City: ${cityObj.name}`);
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
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setAddressName('Current GPS Location');
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

  const handleOpenRestaurant = (restaurantId: string) => {
    dispatch({ type: 'SET_ACTIVE_CUSTOMER_RESTAURANT', payload: restaurantId });
    const newUrl = `${window.location.pathname}?view=customer&restaurant=${restaurantId}`;
    window.history.pushState({}, '', newUrl);
  };

  // Filter & calculate active restaurants nearby (within 15 km limit)
  const allAccounts = state.restaurantAccounts || [];
  const activeRestaurants = allAccounts.filter(acc => acc.status === 'active');

  const processedRestaurants = activeRestaurants
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

      // 2. Haversine 15 Kilometer radius limit (if coords allowed/active)
      if (!coords) return false;
      if (acc.distance > 15) return false;

      // 2. Search query filter
      const matchesSearch = searchQuery.trim() === '' || 
        acc.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (acc.cuisines && acc.cuisines.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (acc.tagline && acc.tagline.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });

  // Fetch meals from all nearby restaurants in parallel when coordinates are active
  useEffect(() => {
    if (!coords || processedRestaurants.length === 0) {
      setNearbyMeals([]);
      return;
    }

    setLoadingMeals(true);
    const promises = processedRestaurants.map(rest => {
      return fetch(`https://meenufy-default-rtdb.firebaseio.com/menuItems/${rest.id}.json`)
        .then(res => res.json())
        .then(data => {
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

    Promise.all(promises).then(results => {
      setNearbyMeals(results.flat());
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
        rating: restAccount?.rating || meals[0].restaurantRating,
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
    processedRestaurants.sort((a, b) => (b.rating || 4.2) - (a.rating || 4.2));
  }

  return (
    <div style={{
      background: 'var(--bg-primary)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      paddingBottom: 80,
      animation: 'fadeIn 0.2s ease-in-out'
    }}>
      {/* Location Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="var(--brand)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {addressName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {selectedCity === 'all'
                ? 'Radius limit: Worldwide'
                : selectedCity === 'gps'
                ? 'Radius limit: Within 15 km'
                : `Radius limit: 15 km from ${selectedCity}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedCity}
            onChange={e => handleCityChange(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              outline: 'none',
              maxWidth: 130
            }}
          >
            <option value="gps">📍 GPS Location</option>
            <option value="all">🌍 Global (All)</option>
            {CITIES.map(c => (
              <option key={c.name} value={c.name}>🌆 {c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setCustomerTheme(prev => prev === 'light' ? 'dark' : 'light')}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 29
            }}
            title="Toggle Light/Dark Theme"
          >
            {customerTheme === 'light' ? '🌙' : '☀️'}
          </button>

          {selectedCity === 'gps' && (
            <button
              onClick={handleRequestGps}
              disabled={gpsLoading}
              style={{
                background: 'rgba(249, 115, 22, 0.1)',
                color: 'var(--brand)',
                fontSize: 11,
                fontWeight: 800,
                border: '1px solid var(--brand)',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {gpsLoading ? 'Locating...' : 'Refresh'}
            </button>
          )}
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
          <div style={{ padding: '16px 20px 8px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--text-secondary)' }}>
              DEALS FOR YOU 🎁
            </h3>
            <div style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 8,
              scrollSnapType: 'x mandatory'
            }} className="hide-scrollbar">
              {[
                { id: 1, title: '50% OFF UP TO ₹100', subtitle: 'On your first delivery order', bg: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', code: 'MEENUFY50' },
                { id: 2, title: 'FREE DELIVERY', subtitle: 'On orders above ₹199', bg: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', code: 'FREECOOK' },
                { id: 3, title: 'FLAT ₹75 CASHBACK', subtitle: 'Using UPI payment options', bg: 'linear-gradient(135deg, #10B981 0%, #047857 100%)', code: 'UPISAVE' }
              ].map(promo => (
                <div
                  key={promo.id}
                  style={{
                    flex: '0 0 280px',
                    height: 120,
                    background: promo.bg,
                    borderRadius: 14,
                    padding: '16px',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    scrollSnapAlign: 'start',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{promo.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>{promo.subtitle}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      CODE: {promo.code}
                    </span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              ))}
            </div>
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
              {POPULAR_CUISINES.map((cuisine) => {
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
                      transition: 'all 0.2s'
                    }}>
                      <img src={cuisine.image} alt={cuisine.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                          <span>{group.rating || 4.2}</span>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {processedRestaurants.map(acc => (
                      <div
                        key={acc.id}
                        onClick={() => handleOpenRestaurant(acc.id)}
                        style={{
                          display: 'flex',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 16,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow)',
                          minHeight: 125,
                          transition: 'transform 0.2s'
                        }}
                      >
                        {/* Left Side: Banner Photo (40% width) */}
                        <div style={{ width: '40%', position: 'relative', background: 'var(--border-dim)' }}>
                          <img
                            src={acc.bannerImage || DEFAULT_BANNER}
                            alt={acc.restaurantName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        {/* Right Side: Details (60% width) */}
                        <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                          <div>
                            {/* Header with Logo */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <h4 style={{ fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {acc.restaurantName}
                              </h4>
                              
                              {/* Logo Image */}
                              <div style={{
                                width: 28,
                                height: 28,
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

                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {acc.tagline || 'Flavors you will love'}
                            </p>

                            <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {acc.cuisines || 'North Indian • Chinese • Fast Food'}
                            </p>
                          </div>

                          {/* Distance, Rating & Delivery */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 8, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)' }}>
                                <Clock size={11} color="var(--brand)" />
                                <span style={{ fontWeight: 700 }}>{acc.distance.toFixed(1)} km</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#10B981' }}>
                                <Award size={11} color="#10B981" />
                                <span style={{ fontWeight: 800 }}>Free</span>
                              </div>
                            </div>

                            {/* Rating Badge */}
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
                              <span>{acc.rating || 4.2}</span>
                              <Star size={9} fill="#ffffff" stroke="none" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
