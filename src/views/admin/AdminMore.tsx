import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/RealtimeStore';
import {
  Store, Phone, Mail, Clock, MapPin, Save, LogOut,
  MessageSquare, Smartphone, Send, Download, QrCode, ExternalLink,
  CreditCard,
} from 'lucide-react';

function getQRUrl(tableId: string, restaurantId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/?view=customer&table=${tableId}&restaurant=${restaurantId}`;
}

function parseCoordsFromGmaps(url: string): { lat: number; lng: number } | null {
  try {
    const matchAt = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (matchAt) {
      return { lat: parseFloat(matchAt[1]), lng: parseFloat(matchAt[2]) };
    }
    const matchQuery = url.match(/[?&](q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (matchQuery) {
      return { lat: parseFloat(matchQuery[2]), lng: parseFloat(matchQuery[3]) };
    }
  } catch {}
  return null;
}

export default function AdminMore() {
  const { state, dispatch, addToast } = useStore();
  const [restaurantForm, setRestaurantForm] = useState({ ...state.restaurant });
  const [feedbackText, setFeedbackText] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(() => {
    const targetSection = localStorage.getItem('meenufy_admin_more_section');
    if (targetSection) {
      localStorage.removeItem('meenufy_admin_more_section');
      return targetSection;
    }
    return 'outlet';
  });
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'free' | 'base' | 'standard' | 'advance' | null>(null);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [billingPeriodToggle, setBillingPeriodToggle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgradePrice, setUpgradePrice] = useState(0);
  const [upgradeCurrency, setUpgradeCurrency] = useState('₹');

  // Secure payment gateway checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'select' | 'paying' | 'success'>('select');
  const [checkoutMethod, setCheckoutMethod] = useState<'upi' | 'card'>('upi');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '' });

  const handleSelectPlan = (planName: 'free' | 'base' | 'standard' | 'advance', price: number, currency: string, billingPeriod: 'monthly' | 'yearly') => {
    if (planName === state.subscriptionPlan && billingPeriod === (state.billingPeriod || 'monthly')) {
      addToast('info', 'You are already on this plan and billing cycle.');
      return;
    }
    if (price === 0) {
      dispatch({
        type: 'UPDATE_SUBSCRIPTION_PLAN',
        payload: { planName, billingPeriod }
      });
      addToast('success', `Plan switched to ${planName.toUpperCase()} successfully!`);
      return;
    }
    setSelectedUpgradePlan(planName);
    setSelectedBillingPeriod(billingPeriod);
    setUpgradePrice(price);
    setUpgradeCurrency(currency);
    setCheckoutStep('select');
    setCheckoutProcessing(false);
    setShowCheckout(true);
  };

  const handleConfirmCheckoutPayment = async () => {
    setCheckoutProcessing(true);
    setCheckoutStep('paying');
    // Simulate secure bank/UPI gateway verification
    await new Promise(r => setTimeout(r, 1800));
    
    if (selectedUpgradePlan) {
      dispatch({
        type: 'UPDATE_SUBSCRIPTION_PLAN',
        payload: { planName: selectedUpgradePlan, billingPeriod: selectedBillingPeriod }
      });
      addToast('success', `Payment securely verified! Plan upgraded to ${selectedUpgradePlan.toUpperCase()} (${selectedBillingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}).`);
    }
    setCheckoutProcessing(false);
    setCheckoutStep('success');
  };

  // QR Code Manager States
  const [tableCount, setTableCount] = useState(state.restaurant.tableCount);
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Generate QR codes
  useEffect(() => {
    if (activeSection !== 'qr') return;
    import('qrcode').then(QRCode => {
      state.tables.forEach(table => {
        const canvas = qrRefs.current[table.id];
        if (canvas) {
          const url = getQRUrl(table.id, state.admin?.restaurantId || 'admin-1');
          QRCode.toCanvas(canvas, url, {
            width: 140,
            color: { dark: '#FFFFFF', light: '#0D0D0D' },
            errorCorrectionLevel: 'M',
          });
        }
      });
    });
  }, [activeSection, state.tables]);

  const handleSaveRestaurant = () => {
    dispatch({ type: 'UPDATE_RESTAURANT', payload: restaurantForm });
    addToast('success', 'Restaurant settings saved!');
  };

  const handleCaptureCurrentLocation = () => {
    if (!navigator.geolocation) {
      addToast('error', 'Geolocation is not supported by your browser.');
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRestaurantForm(prev => ({
          ...prev,
          latitude: parseFloat(position.coords.latitude.toFixed(6)),
          longitude: parseFloat(position.coords.longitude.toFixed(6)),
        }));
        addToast('success', '✨ Registered current location coordinates!');
        setCapturingLocation(false);
      },
      (error) => {
        console.error(error);
        addToast('error', 'Failed to retrieve location. Make sure GPS is enabled.');
        setCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) { addToast('error', 'Please write your feedback first.'); return; }
    dispatch({ type: 'SUBMIT_FEEDBACK', payload: feedbackText.trim() });
    addToast('success', 'Feedback sent to developer! Thank you 🙏');
    setFeedbackText('');
  };

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') addToast('success', 'Meenufy installed successfully!');
    } else {
      addToast('info', 'To install: In Chrome, tap the 3-dot menu → "Add to Home screen".');
    }
  };

  const handleGenerateTables = () => {
    const tables = Array.from({ length: tableCount }, (_, i) => ({
      id: `table-${i + 1}`,
      number: i + 1,
      label: `Table ${i + 1}`,
      capacity: i % 3 === 0 ? 6 : 4,
      isActive: true,
    }));
    dispatch({ type: 'SET_TABLES', payload: tables });
    dispatch({ type: 'UPDATE_RESTAURANT', payload: { tableCount } });
    addToast('success', `${tableCount} QR codes generated!`);
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT_ADMIN' });
    addToast('info', 'Logged out successfully.');
  };

  const sections = [
    { id: 'outlet', label: 'Outlet Settings', icon: Store },
    { id: 'qr', label: 'Manage QR & Tables', icon: QrCode },
    { id: 'subscription', label: 'Pricing & Subscription', icon: CreditCard },
    { id: 'pwa', label: 'Install App', icon: Smartphone },
    { id: 'feedback', label: 'Send Feedback', icon: MessageSquare },
  ];

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>More</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Settings, preferences & more</p>
      </div>

      {/* Profile Card */}
      <div className="card-brand" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--brand-dim)', border: '2px solid var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--brand)',
          flexShrink: 0,
        }}>
          {state.admin?.name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{state.admin?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{state.admin?.email}</div>
          <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 2 }}>
            {state.restaurant.name}
          </div>
        </div>
      </div>

      {/* Nav Buttons - Horizontal Grid for Easy Access */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 10,
        marginBottom: 20
      }}>
        {sections.map(section => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                gap: 8,
                background: isActive ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                border: isActive ? '2px solid var(--brand)' : '1px solid var(--border)',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'var(--transition)',
                color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                boxShadow: isActive ? 'var(--shadow-brand)' : 'none',
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Theme Selection Card */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{state.adminTheme === 'light' ? '☀️' : '🌙'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Interface Theme</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Switch between Light and Dark interface colors</div>
          </div>
        </div>
        <button
          onClick={() => {
            dispatch({ type: 'TOGGLE_ADMIN_THEME' });
            addToast('success', `Theme switched to ${state.adminTheme === 'light' ? 'Dark' : 'Light'}!`);
          }}
          className="btn btn-secondary btn-sm"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          {state.adminTheme === 'light' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
        </button>
      </div>

      {/* Outlet Settings */}
      {activeSection === 'outlet' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 16 }}>Outlet Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Restaurant Name</label>
              <div className="input-icon-wrap">
                <Store size={15} className="input-icon" />
                <input className="input" type="text" value={restaurantForm.name}
                  onChange={e => setRestaurantForm({ ...restaurantForm, name: e.target.value })} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Tagline</label>
              <input className="input" type="text" value={restaurantForm.tagline}
                onChange={e => setRestaurantForm({ ...restaurantForm, tagline: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">About / Description</label>
              <textarea className="input" rows={3} value={restaurantForm.description}
                onChange={e => setRestaurantForm({ ...restaurantForm, description: e.target.value })}
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Opens At</label>
                <div className="input-icon-wrap">
                  <Clock size={15} className="input-icon" />
                  <input className="input" type="time" value={restaurantForm.openTime}
                    onChange={e => setRestaurantForm({ ...restaurantForm, openTime: e.target.value })} />
                </div>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Closes At</label>
                <div className="input-icon-wrap">
                  <Clock size={15} className="input-icon" />
                  <input className="input" type="time" value={restaurantForm.closeTime}
                    onChange={e => setRestaurantForm({ ...restaurantForm, closeTime: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Phone Number</label>
              <div className="input-icon-wrap">
                <Phone size={15} className="input-icon" />
                <input className="input" type="tel" value={restaurantForm.phone}
                  onChange={e => setRestaurantForm({ ...restaurantForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <div className="input-icon-wrap">
                <Mail size={15} className="input-icon" />
                <input className="input" type="email" value={restaurantForm.email}
                  onChange={e => setRestaurantForm({ ...restaurantForm, email: e.target.value })} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Address</label>
              <div className="input-icon-wrap">
                <MapPin size={15} className="input-icon" />
                <input className="input" type="text" value={restaurantForm.address}
                  onChange={e => setRestaurantForm({ ...restaurantForm, address: e.target.value })} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 12 }}>Poster Display Settings</h4>
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Poster Image URL</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Paste image URL (e.g. from Unsplash)"
                  value={restaurantForm.posterImage || ''}
                  onChange={e => setRestaurantForm({ ...restaurantForm, posterImage: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Poster Aspect Ratio</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {[
                    { ratio: '1:1', w: 24, h: 24, label: 'Square (1:1)' },
                    { ratio: '3:4', w: 18, h: 24, label: 'Portrait (3:4)' },
                    { ratio: '9:16', w: 13, h: 24, label: 'Tall (9:16)' }
                  ].map(opt => {
                    const isSelected = (restaurantForm.posterRatio || '1:1') === opt.ratio;
                    return (
                      <button
                        key={opt.ratio}
                        type="button"
                        onClick={() => setRestaurantForm({ ...restaurantForm, posterRatio: opt.ratio as any })}
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                          border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.2s ease',
                          color: isSelected ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        <div style={{
                          width: opt.w,
                          height: opt.h,
                          border: `2px solid ${isSelected ? 'var(--brand)' : 'var(--text-muted)'}`,
                          background: isSelected ? 'rgba(255, 125, 0, 0.2)' : 'transparent',
                          borderRadius: '2px',
                          transition: 'all 0.2s ease'
                        }} />
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Location Ordering Settings */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>Live Location Order Enforcement</h4>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Restricts ordering to customers inside or near the restaurant.</p>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={restaurantForm.locationVerificationEnabled || false}
                    onChange={e => setRestaurantForm({ ...restaurantForm, locationVerificationEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 24,
                    background: restaurantForm.locationVerificationEnabled ? 'var(--brand)' : 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    transition: '0.2s',
                  }}>
                    <span style={{
                      position: 'absolute', left: 2, bottom: 1, width: 20, height: 20, borderRadius: '50%',
                      background: '#fff',
                      transform: restaurantForm.locationVerificationEnabled ? 'translateX(20px)' : 'translateX(0)',
                      transition: '0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }} />
                  </span>
                </label>
              </div>

              {restaurantForm.locationVerificationEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, animation: 'fadeIn 0.2s ease' }}>
                  <div className="input-group">
                    <label className="input-label">Google Maps Link</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="Paste share link (will auto-extract coordinates)"
                      value={restaurantForm.googleMapsUrl || ''}
                      onChange={e => {
                        const url = e.target.value;
                        const parsed = parseCoordsFromGmaps(url);
                        if (parsed) {
                          setRestaurantForm(prev => ({
                            ...prev,
                            googleMapsUrl: url,
                            latitude: parseFloat(parsed.lat.toFixed(6)),
                            longitude: parseFloat(parsed.lng.toFixed(6)),
                          }));
                          addToast('success', '✨ Coordinates auto-extracted!');
                        } else {
                          setRestaurantForm(prev => ({ ...prev, googleMapsUrl: url }));
                        }
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Latitude</label>
                      <input
                        className="input"
                        type="number"
                        step="any"
                        placeholder="e.g. 12.9348"
                        value={restaurantForm.latitude ?? ''}
                        onChange={e => setRestaurantForm({ ...restaurantForm, latitude: parseFloat(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Longitude</label>
                      <input
                        className="input"
                        type="number"
                        step="any"
                        placeholder="e.g. 77.6202"
                        value={restaurantForm.longitude ?? ''}
                        onChange={e => setRestaurantForm({ ...restaurantForm, longitude: parseFloat(e.target.value) || undefined })}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCaptureCurrentLocation}
                      disabled={capturingLocation}
                      style={{
                        padding: '10px 12px', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', height: 38, display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      {capturingLocation ? 'Capturing...' : 'Use My GPS'}
                    </button>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Allowed Perimeter Radius (meters)</label>
                    <input
                      className="input"
                      type="number"
                      min={10} max={1000}
                      placeholder="e.g. 50"
                      value={restaurantForm.verificationRadius ?? 50}
                      onChange={e => setRestaurantForm({ ...restaurantForm, verificationRadius: parseInt(e.target.value) || undefined })}
                    />
                  </div>
                </div>
              )}
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSaveRestaurant} style={{ marginTop: 12 }}>
              <Save size={15} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* QR Code Manager */}
      {activeSection === 'qr' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode size={18} color="var(--brand)" />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Manage QR &amp; Tables</h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Number of Tables</label>
              <input
                className="input"
                type="number"
                min={1} max={50}
                value={tableCount}
                onChange={e => setTableCount(parseInt(e.target.value) || 1)}
              />
            </div>
            <button className="btn btn-primary" onClick={handleGenerateTables} style={{ flexShrink: 0 }}>
              <QrCode size={15} /> Generate
            </button>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Scan or share these QR codes at each table. Customers scan to order.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 12,
            }}>
              {state.tables.map(table => (
                <div key={table.id} style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 12, padding: 12, textAlign: 'center',
                  border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <canvas ref={el => { qrRefs.current[table.id] = el; }} style={{ borderRadius: 8, maxWidth: '100%', height: 'auto' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{table.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Capacity: {table.capacity}</div>
                  {/* Table status toggle */}
                  <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                    <button
                      onClick={() => dispatch({ type: 'UPDATE_TABLE_STATUS', payload: { id: table.id, status: 'active' } })}
                      style={{
                        flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 0',
                        borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: (table.status ?? 'active') === 'active' ? '#22c55e' : 'var(--bg-primary)',
                        color: (table.status ?? 'active') === 'active' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >Active</button>
                    <button
                      onClick={() => dispatch({ type: 'UPDATE_TABLE_STATUS', payload: { id: table.id, status: 'maintenance' } })}
                      style={{
                        flex: 1, fontSize: 10, fontWeight: 700, padding: '4px 0',
                        borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: table.status === 'maintenance' ? '#eab308' : 'var(--bg-primary)',
                        color: table.status === 'maintenance' ? '#000' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                      }}
                    >Maint.</button>
                  </div>
                  <a
                    href={getQRUrl(table.id, state.admin?.restaurantId || 'admin-1')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '5px 10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <ExternalLink size={11} /> Preview
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subscription & Wallet */}
      {activeSection === 'subscription' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CreditCard size={18} color="var(--brand)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Pricing &amp; Subscription</h3>
          </div>
          {(() => {
            const planLimit = state.subscriptionPlan === 'free' ? 100 : state.subscriptionPlan === 'base' ? 1000 : state.subscriptionPlan === 'standard' ? 2000 : Infinity;
            const isUnlimited = planLimit === Infinity;
            const usage = state.ordersPlacedThisMonth || 0;
            const progress = isUnlimited ? 100 : Math.min(100, (usage / planLimit) * 100);
            const renewalFormatted = new Date(state.subscriptionRenewalDate || Date.now()).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            return (
              <div style={{
                background: 'linear-gradient(135deg, var(--brand) 0%, #e06000 100%)',
                borderRadius: 12,
                padding: '20px',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(255, 125, 0, 0.2)',
                marginBottom: 20,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  right: '-10px',
                  bottom: '-20px',
                  fontSize: '100px',
                  opacity: 0.1,
                  pointerEvents: 'none'
                }}>⭐️</div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ffffff', fontWeight: 700 }}>Current Active Plan</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4, fontFamily: 'var(--font-display)', textTransform: 'capitalize', color: '#ffffff' }}>
                  {state.subscriptionPlan} Plan
                </div>
                
                {/* Usage statistics */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, fontWeight: 700, color: '#ffffff' }}>
                    <span>Monthly Order Usage</span>
                    <span>{usage} / {isUnlimited ? 'Unlimited' : `${planLimit} orders`}</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 4, overflow: 'hidden' }}>
                     <div style={{ width: `${progress}%`, height: '100%', background: '#ffffff', borderRadius: 4, transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 12 }}>
                  <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                    Billing Country: <strong style={{ color: '#ffffff', fontWeight: 800 }}>{state.billingCountry === 'IN' ? 'India (INR)' : 'Global (USD)'}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                    Billing Cycle: <strong style={{ color: '#ffffff', fontWeight: 800 }}>{state.billingPeriod === 'yearly' ? 'Yearly (15% Off)' : 'Monthly'}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                    Renews: <strong style={{ color: '#ffffff', fontWeight: 800 }}>{renewalFormatted}</strong>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Upgrade Plan Section */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              Upgrade or Change Subscription
            </h4>

            {/* Monthly / Yearly Billing Toggle */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-elevated)',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginBottom: '16px',
              maxWidth: '280px'
            }}>
              <button
                type="button"
                onClick={() => setBillingPeriodToggle('monthly')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: billingPeriodToggle === 'monthly' ? 'var(--brand)' : 'transparent',
                  color: billingPeriodToggle === 'monthly' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriodToggle('yearly')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: billingPeriodToggle === 'yearly' ? 'var(--brand)' : 'transparent',
                  color: billingPeriodToggle === 'yearly' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Yearly <span style={{
                  fontSize: '9px',
                  background: billingPeriodToggle === 'yearly' ? 'rgba(255,255,255,0.2)' : 'rgba(255,125,0,0.15)',
                  color: billingPeriodToggle === 'yearly' ? '#ffffff' : 'var(--brand)',
                  padding: '1px 4px',
                  borderRadius: '4px'
                }}>Save 15%</span>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const isYearly = billingPeriodToggle === 'yearly';
                
                const plans = state.billingCountry === 'IN' ? [
                  { name: 'free', label: 'Free Trial', price: 0, currency: '₹', limit: 100, desc: 'For small cafes and testing' },
                  { name: 'base', label: 'Base Plan', price: isYearly ? 15290 : 1499, currency: '₹', limit: 1000, desc: 'For growing eateries' },
                  { name: 'standard', label: 'Standard Plan', price: isYearly ? 25490 : 2499, currency: '₹', limit: 2000, desc: 'For busy outlets' },
                  { name: 'advance', label: 'Advance Plan', price: isYearly ? 40790 : 3999, currency: '₹', limit: Infinity, desc: 'Unlimited scale & priority support' },
                ] : [
                  { name: 'free', label: 'Free Trial', price: 0, currency: '$', limit: 100, desc: 'For small cafes and testing' },
                  { name: 'base', label: 'Base Plan', price: isYearly ? 204 : 20, currency: '$', limit: 1000, desc: 'For growing eateries' },
                  { name: 'standard', label: 'Standard Plan', price: isYearly ? 357 : 35, currency: '$', limit: 2000, desc: 'For busy outlets' },
                  { name: 'advance', label: 'Advance Plan', price: isYearly ? 510 : 50, currency: '$', limit: Infinity, desc: 'Unlimited scale & priority support' },
                ];

                return plans.map(p => {
                  const isCurrent = state.subscriptionPlan === p.name && (p.name === 'free' || (state.billingPeriod || 'monthly') === billingPeriodToggle);
                  
                  return (
                    <div key={p.name} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-elevated)',
                      padding: '16px',
                      borderRadius: 12,
                      border: isCurrent ? '2px solid var(--brand)' : '1px solid var(--border)',
                      position: 'relative'
                    }}>
                      {isCurrent && (
                        <div style={{
                          position: 'absolute', top: -10, right: 12,
                          background: 'var(--brand)', color: '#fff', fontSize: 9,
                          fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                          textTransform: 'uppercase'
                        }}>
                          Current Plan
                        </div>
                      )}
                      
                      <div style={{ flex: 1, marginRight: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#ffffff', marginTop: 4 }}>
                          {p.desc}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 6 }}>
                          Order Limit: {p.limit === Infinity ? 'Unlimited orders/month' : `${p.limit} orders/month`}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                          {p.price === 0 ? 'Free' : `${p.currency}${p.price}`}
                          {p.price > 0 && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>/{isYearly ? 'yr' : 'mo'}</span>}
                        </div>
                        
                        {isYearly && p.price > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>
                            Billed annually
                          </div>
                        )}
                        
                        <button
                          disabled={isCurrent}
                          onClick={() => handleSelectPlan(p.name as any, p.price, p.currency, billingPeriodToggle)}
                          className={isCurrent ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                          style={{
                            padding: '6px 12px',
                            fontSize: 11,
                            borderRadius: 8,
                            cursor: isCurrent ? 'default' : 'pointer',
                            marginTop: 4
                          }}
                        >
                          {isCurrent ? 'Active' : 'Upgrade'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}



      {/* PWA Install */}
      {activeSection === 'pwa' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>Install Meenufy App</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.7 }}>
              Add Meenufy to your home screen for instant access,<br />
              offline support, and a native app experience.
            </p>
            <button className="btn btn-primary btn-lg" onClick={handleInstallPWA}>
              <Download size={18} /> Install App
            </button>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Or: Browser menu → "Add to Home Screen"
            </p>
          </div>
        </div>
      )}

      {/* Feedback */}
      {activeSection === 'feedback' && (
        <div className="card" style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 4 }}>Send Feedback</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Help us improve Meenufy. Your feedback is invaluable!</p>
          <textarea
            className="input"
            rows={4}
            placeholder="Share your experience, suggestions, or report a bug..."
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            style={{ resize: 'vertical', marginBottom: 12 }}
          />
          <button className="btn btn-primary btn-full" onClick={handleSendFeedback}>
            <Send size={15} /> Send Feedback
          </button>
        </div>
      )}

      {/* Logout */}
      <button
        className="btn btn-danger btn-full"
        onClick={handleLogout}
        style={{ fontSize: 14 }}
      >
        <LogOut size={16} /> Logout from Admin Panel
      </button>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Meenufy v1.0 · Built with ❤️ for restaurant owners worldwide<br />
        PWA · Works Offline · Real-time Sync
      </p>
      {/* Secure Payment Gateway Checkout Modal */}
      {showCheckout && (
        <div className="modal-backdrop" onClick={() => !checkoutProcessing && setShowCheckout(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                  Secure Payment Checkout
                </h3>
              </div>
              {!checkoutProcessing && (
                <button
                  onClick={() => setShowCheckout(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}
                >
                  ✕
                </button>
              )}
            </div>

            {checkoutStep === 'select' && (
              <div>
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                  marginBottom: 20
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Amount to Pay (Subscription)</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--brand)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
                    {upgradeCurrency}{upgradePrice}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Secured by Meenufy Pay</div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Select Payment Method</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  <button
                    onClick={() => setCheckoutMethod('upi')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: checkoutMethod === 'upi' ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                      border: checkoutMethod === 'upi' ? '2px solid var(--brand)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      📱 UPI Payment (GPay, PhonePe, Paytm)
                    </span>
                    {checkoutMethod === 'upi' && <span style={{ color: 'var(--brand)' }}>✓</span>}
                  </button>

                  <button
                    onClick={() => setCheckoutMethod('card')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: checkoutMethod === 'card' ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                      border: checkoutMethod === 'card' ? '2px solid var(--brand)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      💳 Credit / Debit Card
                    </span>
                    {checkoutMethod === 'card' && <span style={{ color: 'var(--brand)' }}>✓</span>}
                  </button>
                </div>

                <button
                  onClick={handleConfirmCheckoutPayment}
                  className="btn btn-primary btn-full"
                  style={{ height: 42, fontWeight: 700 }}
                >
                  Proceed to Pay {upgradeCurrency}{upgradePrice}
                </button>
              </div>
            )}

            {checkoutStep === 'paying' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {checkoutMethod === 'upi' ? (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Scan this secure QR code using GPay, PhonePe or any UPI app
                    </div>
                    {/* Mock QR code box */}
                    <div style={{
                      width: 160,
                      height: 160,
                      background: '#fff',
                      margin: '0 auto 16px',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '4px solid var(--brand)',
                      boxShadow: '0 0 20px rgba(255, 125, 0, 0.15)',
                      padding: 10
                    }}>
                      <div style={{
                        width: '100%', height: '100%',
                        backgroundImage: 'radial-gradient(#000 30%, transparent 30%), radial-gradient(#000 30%, transparent 30%)',
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 8px 8px',
                        opacity: 0.8
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
                      Secure Transaction ID: TXN-{Date.now().toString().slice(-6)}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 20 }}>
                    <div className="input-group">
                      <label className="input-label">Card Number</label>
                      <input className="input" type="text" placeholder="4111 2222 3333 4444" maxLength={19}
                        value={cardDetails.number} onChange={e => setCardDetails({ ...cardDetails, number: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">Expiry</label>
                        <input className="input" type="text" placeholder="MM/YY" maxLength={5}
                          value={cardDetails.expiry} onChange={e => setCardDetails({ ...cardDetails, expiry: e.target.value })} />
                      </div>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label className="input-label">CVV</label>
                        <input className="input" type="password" placeholder="***" maxLength={3}
                          value={cardDetails.cvv} onChange={e => setCardDetails({ ...cardDetails, cvv: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing Overlay/Indicator */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 10
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--brand)',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                    Verifying transaction with bank...
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Please do not close or refresh this page.
                  </div>
                </div>
              </div>
            )}

            {checkoutStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  margin: '0 auto 16px',
                  border: '2px solid #22c55e',
                  boxShadow: '0 0 15px rgba(34,197,94,0.2)'
                }}>
                  ✓
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Subscription Activated!
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                  Payment of {upgradeCurrency}{upgradePrice} verified successfully. Your plan has been upgraded to <strong style={{ textTransform: 'capitalize' }}>{selectedUpgradePlan}</strong>.
                </p>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="btn btn-primary btn-full"
                  style={{ height: 38 }}
                >
                  Go Back
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
