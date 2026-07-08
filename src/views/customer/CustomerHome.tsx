import { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { Search, MapPin, Star, Clock, Award, ArrowRight, X } from 'lucide-react';

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

// Popular cuisines quick filters (circular category icons)
const POPULAR_CUISINES = [
  { name: 'Biryani', query: 'biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=150&auto=format&fit=crop&q=60' },
  { name: 'Pizza', query: 'pizza', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=60' },
  { name: 'Burgers', query: 'burger', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&auto=format&fit=crop&q=60' },
  { name: 'Chinese', query: 'chinese', image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=150&auto=format&fit=crop&q=60' },
  { name: 'Desserts', query: 'sweet', image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=150&auto=format&fit=crop&q=60' },
  { name: 'South Indian', query: 'dosa', image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=150&auto=format&fit=crop&q=60' },
];

export default function CustomerHome() {
  const { state, dispatch, addToast } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  
  // Geolocation states
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressName, setAddressName] = useState('Koramangala, Bengaluru');

  // Filters
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'none'>('none');

  // Initialize coordinates (default to Bengaluru if geolocation is off or loading)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setAddressName('Current GPS Location');
        },
        () => {
          setCoords({ latitude: 12.9348, longitude: 77.6202 });
        }
      );
    } else {
      setCoords({ latitude: 12.9348, longitude: 77.6202 });
    }
  }, []);

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
        addToast('error', 'Failed to acquire location. Using default.');
        setGpsLoading(false);
      }
    );
  };

  const handleOpenRestaurant = (restaurantId: string) => {
    dispatch({ type: 'SET_ACTIVE_CUSTOMER_RESTAURANT', payload: restaurantId });
    // Update the URL query params without reloading
    const newUrl = `${window.location.pathname}?view=customer&restaurant=${restaurantId}`;
    window.history.pushState({}, '', newUrl);
  };

  // Filter & calculate active restaurants nearby (within 10 km limit)
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
      // 1. Haversine 10 Kilometer radius limit
      if (acc.distance > 10) return false;

      // 2. Search query filter (matches restaurant name or cuisines)
      const matchesSearch = searchQuery.trim() === '' || 
        acc.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (acc.cuisines && acc.cuisines.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (acc.tagline && acc.tagline.toLowerCase().includes(searchQuery.toLowerCase()));

      // 3. Quick Cuisine category filter
      const matchesCuisine = !selectedCuisine || 
        (acc.cuisines && acc.cuisines.toLowerCase().includes(selectedCuisine.toLowerCase()));

      return matchesSearch && matchesCuisine;
    });

  // Apply sorting
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
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Radius: Within 10 km</div>
          </div>
        </div>

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
          {gpsLoading ? 'Locating...' : 'Use GPS'}
        </button>
      </div>

      {/* Offers and Promo Banner Carousel */}
      <div style={{ padding: '16px 20px 8px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 12 }}>
          DEALS FOR YOU 🎁
        </h3>
        <div style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
          scrollSnapType: 'x mandatory'
        }}>
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
        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 12 }}>
          WHAT'S ON YOUR MIND? 🍕
        </h3>
        <div style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          paddingBottom: 6
        }}>
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
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div style={{
        padding: '8px 20px',
        display: 'flex',
        gap: 8,
        overflowX: 'auto'
      }}>
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

      {/* Restaurants List */}
      <div style={{ padding: '16px 20px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--font-display)', marginBottom: 16 }}>
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
              No restaurants found within 10 km. Try clearing filters or using GPS location!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {processedRestaurants.map(acc => (
              <div
                key={acc.id}
                onClick={() => handleOpenRestaurant(acc.id)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  boxShadow: 'var(--shadow)'
                }}
              >
                {/* Logo / Image */}
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--border-dim)',
                  flexShrink: 0,
                  border: '1px solid var(--border)'
                }}>
                  <img
                    src={acc.logo || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&auto=format&fit=crop&q=60'}
                    alt={acc.restaurantName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
                        {acc.restaurantName}
                      </h4>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        background: '#22c55e',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 6
                      }}>
                        <span>{acc.rating || 4.2}</span>
                        <Star size={10} fill="#ffffff" stroke="none" />
                      </div>
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {acc.tagline || 'Flavors you will love'}
                    </p>

                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>
                      {acc.cuisines || 'North Indian • Fast Food'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <Clock size={12} color="var(--brand)" />
                      <span>{acc.distance.toFixed(1)} km away</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <Award size={12} color="#10B981" />
                      <span style={{ color: '#10B981', fontWeight: 700 }}>Free Delivery</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
