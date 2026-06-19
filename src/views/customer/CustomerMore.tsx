import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { MapPin, Phone, Mail, Clock, Download, ExternalLink, Wifi, Gift, Crown } from 'lucide-react';

export default function CustomerMore() {
  const { state } = useStore();
  const { restaurant } = state;
  const [phoneInput, setPhoneInput] = useState('');
  const [savedPhone, setSavedPhone] = useState(() => localStorage.getItem('meenufy_customer_phone') || '');

  const customer = state.customers.find(c => c.phone === savedPhone.trim());
  const points = customer ? (customer.points || 0) : 0;
  const isVip = customer ? !!customer.isVip : false;
  const pointVal = points * (state.restaurant.pointValueInRupees || 1);

  const handleInstallPWA = () => {
    const msg = 'To install: In Chrome, tap the 3-dot menu → "Add to Home screen". Enjoy the native app experience!';
    alert(msg);
  };

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
        Info & More
      </h2>

      {/* Restaurant Card */}
      <div className="card-brand" style={{ marginBottom: 16, textAlign: 'center', padding: '24px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🍽️</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          {restaurant.name}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600, marginBottom: 8 }}>{restaurant.tagline}</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{restaurant.description}</p>
      </div>

      {/* Loyalty & Rewards Section */}
      {(state.restaurant.loyaltyEnabled || (savedPhone && isVip)) && (
        <div className="card" style={{ marginBottom: 16, border: isVip ? '1px solid #ffd700' : '1px solid var(--border)', boxShadow: isVip ? '0 0 12px rgba(255, 215, 0, 0.15)' : 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isVip ? '#ffd700' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gift size={16} color={isVip ? '#ffd700' : 'var(--brand)'} />
              Loyalty & Rewards
            </div>
            {isVip && (
              <span style={{
                background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                color: '#000000',
                padding: '2px 8px',
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)'
              }}>
                <Crown size={10} /> VIP MEMBER
              </span>
            )}
          </div>

          {savedPhone ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, marginBottom: 12, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Points Balance</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{points} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>pts</span></div>
                </div>
                {state.restaurant.loyaltyEnabled && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Redeemable Cash Value</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>₹{pointVal}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Linked Phone: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{savedPhone}</span>
                </div>
                <button 
                  onClick={() => {
                    localStorage.removeItem('meenufy_customer_phone');
                    setSavedPhone('');
                  }}
                  style={{ fontSize: 11, color: 'var(--error)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Unlink
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                Enter your phone number to check your loyalty points balance, reward details, and VIP status.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="tel" 
                  placeholder="Enter Phone Number" 
                  value={phoneInput} 
                  onChange={e => setPhoneInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text-primary)'
                  }}
                />
                <button 
                  onClick={() => {
                    const trimmed = phoneInput.trim();
                    if (trimmed) {
                      localStorage.setItem('meenufy_customer_phone', trimmed);
                      setSavedPhone(trimmed);
                    }
                  }}
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: 13, background: 'var(--brand)', color: '#000000', fontWeight: 700 }}
                >
                  Check
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact Info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📞 Contact & Location</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--bg-elevated)', textDecoration: 'none',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={15} color="var(--brand)" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phone</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{restaurant.phone}</div>
              </div>
              <ExternalLink size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
            </a>
          )}

          {restaurant.email && (
            <a href={`mailto:${restaurant.email}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--bg-elevated)', textDecoration: 'none',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={15} color="var(--brand)" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{restaurant.email}</div>
              </div>
            </a>
          )}

          {restaurant.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={15} color="var(--brand)" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Address</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>{restaurant.address}</div>
              </div>
            </div>
          )}

          {restaurant.openTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={15} color="var(--brand)" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Opening Hours</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{restaurant.openTime} – {restaurant.closeTime}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Install PWA */}
      <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 6 }}>Install this App</h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Add to your home screen for quick access<br />and a native app experience.
        </p>
        <button className="btn btn-secondary btn-full" onClick={handleInstallPWA}>
          <Download size={14} /> Add to Home Screen
        </button>
      </div>

      {/* Powered by */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 99,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        }}>
          <Wifi size={12} color="var(--brand)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            Powered by <span style={{ color: 'var(--brand)' }}>Meenufy</span> — Your restro's digital staff
          </span>
        </div>
      </div>
    </div>
  );
}
