import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import { 
  Check, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Flame,
  Layout, 
  TrendingUp, 
  MessageSquare,
  FileText,
  Printer,
  Palette,
  Users,
  ChevronDown,
  ChevronUp,
  ChevronRight
} from 'lucide-react';

export interface OnboardingState {
  tableCount: number;
  biggestPainPoint: string;
  estimatedMonthlyLoss: number;
  currency: 'INR' | 'USD';
  restaurantName: string;
}

export default function OnboardingFlow() {
  const { state, dispatch, addToast } = useStore();
  const [screenIndex, setScreenIndex] = useState(0);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [detectingLocation, setDetectingLocation] = useState(true);

  // Onboarding Form States
  const [tableCount, setTableCount] = useState<number>(12);
  const [biggestPainPoint, setBiggestPainPoint] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [basePlanSelectedType, setBasePlanSelectedType] = useState<'dining_takeaway' | 'delivery_only' | 'both'>('both');
  const [serviceModeSelected, setServiceModeSelected] = useState<boolean>(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Local state object to capture user selections across screens (OnboardingState)
  const [onboardingData, setOnboardingData] = useState<OnboardingState>({
    tableCount: 12,
    biggestPainPoint: '',
    estimatedMonthlyLoss: 0,
    currency: 'USD',
    restaurantName: ''
  });

  // Keep onboardingData synced for reference/tracking
  useEffect(() => {
    setOnboardingData({
      tableCount,
      biggestPainPoint,
      estimatedMonthlyLoss: currency === 'INR' ? tableCount * 2500 : tableCount * 35,
      currency,
      restaurantName
    });
  }, [tableCount, biggestPainPoint, currency, restaurantName]);

  // Carousel Feature Screen 7 State
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Counter animation state for Screen 5
  const [animatedLoss, setAnimatedLoss] = useState(0);

  // Form completion state for Screen 11
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  // Geolocation & Currency Detection
  useEffect(() => {
    const detectLocale = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.country_code === 'IN' || data.country === 'India') {
            setCurrency('INR');
          } else {
            setCurrency('USD');
          }
          setDetectingLocation(false);
          return;
        }
      } catch (err) {
        console.warn('Geolocation API offline, falling back to timezone check', err);
      }

      // Timezone fallback (only executed if fetch fails)
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (
        tz === 'Asia/Kolkata' || 
        tz === 'Asia/Calcutta' ||
        tz.toLowerCase().includes('kolkata') ||
        tz.toLowerCase().includes('calcutta') ||
        tz.toLowerCase().includes('india') ||
        tz.toLowerCase().includes('delhi') ||
        tz.toLowerCase().includes('mumbai') ||
        tz.toLowerCase().includes('chennai')
      ) {
        setCurrency('INR');
      } else {
        const isIndianLocale = navigator.language === 'en-IN' || navigator.language === 'hi-IN';
        if (isIndianLocale) {
          setCurrency('INR');
        } else {
          setCurrency('USD');
        }
      }
      setDetectingLocation(false);
    };
    detectLocale();
  }, []);

  // Screen 5 value counter logic
  const targetLossValue = currency === 'INR' ? tableCount * 2500 : tableCount * 35;
  useEffect(() => {
    if (screenIndex === 4) {
      setAnimatedLoss(0);
      let start = 0;
      const duration = 1200; // ms
      const increment = targetLossValue / (duration / 16); // ~60fps
      const timer = setInterval(() => {
        start += increment;
        if (start >= targetLossValue) {
          setAnimatedLoss(targetLossValue);
          clearInterval(timer);
        } else {
          setAnimatedLoss(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [screenIndex, targetLossValue]);

  const handleNext = () => {
    if (screenIndex < 10) {
      setScreenIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (screenIndex > 0) {
      setScreenIndex(prev => prev - 1);
    }
  };

  const handleSelectTables = (count: number) => {
    setTableCount(count);
    // Auto advance to next screen
    setTimeout(() => {
      setScreenIndex(3);
    }, 300);
  };

  const handleSelectPainPoint = (pointKey: string) => {
    setBiggestPainPoint(pointKey);
    // Auto advance to next screen
    setTimeout(() => {
      setScreenIndex(4);
    }, 300);
  };

  const handleCompleteSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (restaurantName.trim().length < 2) {
      addToast('error', "Restaurant name must be at least 2 characters.");
      return;
    }

    setIsCompleting(true);
    // Trigger beautiful green checkmark animation
    setTimeout(() => {
      setShowCheckmark(true);
      setTimeout(() => {
        // Complete onboarding session state updates
        localStorage.setItem('meenufy_has_completed_onboarding', 'true');
        dispatch({
          type: 'COMPLETE_ONBOARDING',
          payload: {
            subscriptionPlan: (selectedPlan as any) || 'free',
            basePlanSelectedType: selectedPlan === 'base' && basePlanSelectedType !== 'both' ? (basePlanSelectedType as 'dining_takeaway' | 'delivery_only') : undefined
          }
        });
        console.log('Onboarding data recorded:', onboardingData);
        
        // Auto-login a default admin if not already logged in
        if (!state.isAdminLoggedIn) {
          const mockAdminUser = {
            id: 'admin-' + Date.now(),
            name: 'Restro Owner',
            email: `owner@${restaurantName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'rest'}.com`,
            restaurantId: 'rest-' + Date.now(),
            isLoggedIn: true,
            restaurantName: restaurantName.trim(),
            ownerPhone: '+91 99999 88888',
          };
          dispatch({ type: 'LOGIN_ADMIN', payload: mockAdminUser });
        }

        // Save restaurant name to database state
        dispatch({
          type: 'UPDATE_RESTAURANT',
          payload: {
            name: restaurantName.trim(),
            subscriptionPlan: (selectedPlan as any) || 'free',
            basePlanSelectedType: selectedPlan === 'base' && basePlanSelectedType !== 'both' ? (basePlanSelectedType as 'dining_takeaway' | 'delivery_only') : undefined,
            subscriptionRenewalDate: Date.now() + (selectedPlan === 'free' ? 21 : 30) * 24 * 60 * 60 * 1000,
            createdAt: Date.now()
          }
        });

        // Redirect to admin dashboard
        dispatch({ type: 'SET_ADMIN_TAB', payload: 'home' });
        window.history.pushState({}, '', '/admin');
        addToast('success', `🎉 Welcome to Meenufy, ${restaurantName.trim()}! Your dashboard is ready. 🚀`);
      }, 1500);
    }, 600);
  };

  const formatPrice = (val: number) => {
    return currency === 'INR' ? `₹${val.toLocaleString('en-IN')}` : `$${val}`;
  };

  // Screen 7 Carousel data
  const carouselItems = [
    {
      title: "AI Menu Extractor",
      desc: "Upload a PDF or photo of your menu. Our AI instantly parses sections, items, prices, and complex variants with 100% accuracy.",
      icon: FileText,
      color: "var(--brand)"
    },
    {
      title: "Live Interactive Floor Map",
      desc: "Color-coded tracking showing which tables are free, currently ordering, dining, or requesting bills in real-time.",
      icon: Layout,
      color: "#3b82f6"
    },
    {
      title: "Thermal KOT & Bill Printing",
      desc: "Zero driver hassle. Integrate seamlessly with your existing EPSON or standard thermal printer setups right through your PWA.",
      icon: Printer,
      color: "#10b981"
    },
    {
      title: "Custom Brand Theme Manager",
      desc: "Personalize the entire mobile client theme. Tweak brand highlights, text colors, and background designs to align with your venue.",
      icon: Palette,
      color: "#ec4899"
    },
    {
      title: "Smart Customer CRM",
      desc: "Track customers automatically by phone number. Keep logs of orders, preferences, lifetime spent, and tag VIP guests instantly.",
      icon: Users,
      color: "#f59e0b"
    },
    {
      title: "Automated Loyalty & Points",
      desc: "Turn diners into regulars. Reward points automatically on orders and set multiplier tiers to drive customer lifetime value.",
      icon: Sparkles,
      color: "#8b5cf6"
    },
    {
      title: "Live Customer Order Tracker",
      desc: "Provide customers peace of mind. A beautiful native PWA timeline showing exactly when their order is accepted, preparing, or ready.",
      icon: Clock,
      color: "#06b6d4"
    },
    {
      title: "Google Review Optimizer",
      desc: "Intercept unhappy guests internally before they leave a review, while routing 5-star guests directly to your public Google Maps profile.",
      icon: MessageSquare,
      color: "#10b981"
    }
  ];

  // Screen 9 FAQ data
  const faqItems = [
    {
      q: "I am not tech-savvy. Will this be hard to maintain?",
      a: "If you can use a smartphone, you can operate Meenufy. The dashboard is designed with a drag-and-drop Kanban view, and updating your menu takes under 5 minutes."
    },
    {
      q: "What happens if our internet connection drops out?",
      a: "Meenufy is built on a Progressive Web App (PWA) framework. It securely caches data locally offline and syncs back with the Firebase server the second connectivity resumes, ensuring zero lost orders."
    },
    {
      q: "Is hardware connection difficult?",
      a: "No complex setup needed. Thermal printers print directly from any web browser or device natively. There are no proprietary hardware locks."
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 0%, #1e1e1e 0%, #0a0a0a 100%)',
      color: 'var(--text-primary)',
      padding: '24px 16px',
      position: 'relative',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Grid Pattern */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(rgba(255,255,255,0.007) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.007) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 0.8,
        pointerEvents: 'none'
      }} />

      {/* Styled embedded animations */}
      <style>{`
        .onboarding-card {
          width: 100%;
          max-width: 480px;
          background: rgba(26, 26, 26, 0.65);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 32px 28px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          position: relative;
          z-index: 10;
          animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .anim-fade {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .progress-bar {
          display: flex;
          gap: 4px;
          margin-bottom: 24px;
        }
        .progress-step {
          height: 4px;
          flex: 1;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
          transition: background 0.3s ease;
        }
        .progress-step.active {
          background: var(--brand);
          box-shadow: 0 0 8px rgba(255, 125, 0, 0.5);
        }
        /* SVG scanner line */
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(110px); }
        }
        /* Floating ticket */
        @keyframes flyTicket {
          0% { transform: translate(-30px, 30px) scale(0.6); opacity: 0; }
          40% { transform: translate(10px, -10px) scale(1); opacity: 1; }
          80%, 100% { transform: translate(65px, -65px) scale(0.7); opacity: 0; }
        }
        /* Pulse border */
        .pulse-border {
          animation: pulseGlow 2s infinite;
        }
        @keyframes pulseGlow {
          0%, 100% { border-color: rgba(255, 125, 0, 0.3); box-shadow: 0 0 10px rgba(255,125,0,0.1); }
          50% { border-color: rgba(255, 125, 0, 0.7); box-shadow: 0 0 20px rgba(255,125,0,0.3); }
        }
      `}</style>

      {/* Screen container */}
      <div className="onboarding-card">
        {/* Navigation Top Header */}
        <div className="progress-bar">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className={`progress-step ${i <= screenIndex ? 'active' : ''}`} />
          ))}
        </div>

        {/* Back navigation button */}
        {screenIndex > 0 && screenIndex < 10 && (
          <button 
            onClick={handlePrev}
            style={{
              position: 'absolute',
              top: 28, right: 28,
              background: 'none', border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            ← Back
          </button>
        )}

        {/* ── SCREEN 1: THE CORE BENEFIT VISUAL (HOOK PHASE) ── */}
        {screenIndex === 0 && (
          <div className="anim-fade" style={{ textAlign: 'center' }}>
            {/* Visual Vector Animation Container */}
            <div style={{
              width: 150, height: 150,
              margin: '0 auto 28px',
              background: 'rgba(255, 125, 0, 0.05)',
              border: '2px dashed rgba(255, 125, 0, 0.3)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Animated SVG illustration */}
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Phone Frame */}
                <rect x="36" y="24" width="28" height="52" rx="4" fill="#1f1f1f" stroke="#FF7D00" strokeWidth="2"/>
                {/* Screen content */}
                <rect x="40" y="28" width="20" height="38" rx="1" fill="#0d0d0d"/>
                {/* QR Symbol */}
                <path d="M46 34h3v3h-3zm5 0h3v3h-3zm-5 5h3v3h-3zm5 5h3v3h-3zm5-5h3v3h-3z" fill="var(--text-secondary)" opacity="0.6"/>
                {/* Scanner bar */}
                <line x1="39" y1="36" x2="61" y2="36" stroke="#22c55e" strokeWidth="2" style={{ animation: 'scan 3s ease-in-out infinite' }}/>
                {/* Flying ticket */}
                <rect x="30" y="65" width="22" height="12" rx="2" fill="var(--brand)" style={{ animation: 'flyTicket 3s ease-in-out infinite', transformOrigin: 'center' }}/>
                {/* Kitchen Screen Frame */}
                <rect x="68" y="15" width="24" height="18" rx="2" fill="#1f1f1f" stroke="var(--text-muted)"/>
                <line x1="72" y1="21" x2="88" y2="21" stroke="#22c55e" strokeWidth="1.5"/>
                <line x1="72" y1="26" x2="84" y2="26" stroke="var(--text-muted)" strokeWidth="1.5"/>
              </svg>
            </div>

            <h1 style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
              Welcome to Meenufy
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 32 }}>
              The fastest, most reliable QR-code ordering architecture on the planet.
            </p>

            <button 
              className="btn btn-primary btn-lg btn-full"
              onClick={handleNext}
              style={{ padding: '14px 20px', fontSize: 15 }}
            >
              See How Much You Can Save <ArrowRight size={16} style={{ marginLeft: 6 }} />
            </button>
          </div>
        )}

        {/* ── SCREEN 2: THE PAIN REVEAL (HOOK PHASE) ── */}
        {screenIndex === 1 && (
          <div className="anim-fade">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'inline-flex', padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: 'var(--error)', marginBottom: 16 }}>
                <Flame size={24} />
              </div>
              <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1.4 }}>
                Traditional table service is leaking your profits.
              </h2>
            </div>

            {/* Industry stats grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.03)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 12, padding: 16, display: 'flex', gap: 14
              }}>
                <span style={{ fontSize: 20 }}>⏱️</span>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>50%+ of your waitstaff's shift</strong> is wasted running back-and-forth for bills and manual KOT updates.
                </p>
              </div>

              <div style={{
                background: 'rgba(239, 68, 68, 0.03)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: 12, padding: 16, display: 'flex', gap: 14
              }}>
                <span style={{ fontSize: 20 }}>💸</span>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Slow table turns cost restaurants up to <strong style={{ color: 'var(--text-primary)' }}>12% in missed peak-hour</strong> dining revenue.
                </p>
              </div>
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleNext}
              style={{ background: 'var(--brand)', height: 48 }}
            >
              Audit My Restaurant →
            </button>
          </div>
        )}

        {/* ── SCREEN 3: TABLE VALUE COMMITMENT (ASK PHASE) ── */}
        {screenIndex === 2 && (
          <div className="anim-fade">
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>
              How many active tables does your venue operate?
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {[
                { label: '1 - 5 Tables', val: 5 },
                { label: '6 - 15 Tables', val: 12 },
                { label: '16 - 30 Tables', val: 24 },
                { label: '31 - 50 Tables', val: 40 },
                { label: '50+ Tables', val: 60 }
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => handleSelectTables(item.val)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: tableCount === item.val ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    border: tableCount === item.val ? '2px solid var(--brand)' : '1px solid var(--border)',
                    borderRadius: 14,
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'var(--transition)'
                  }}
                >
                  <span>{item.label}</span>
                  <ChevronRight size={16} style={{ opacity: 0.6 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SCREEN 4: PAIN-POINT IDENTIFICATION (ASK PHASE) ── */}
        {screenIndex === 3 && (
          <div className="anim-fade">
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>
              What is your restaurant's single biggest operational headache?
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
              We will tailor your calculation stats based on your choice.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'staff', text: "Short-staffed / Escalating waiter labor expenses", icon: "👤" },
                { key: 'turnover', text: "Slow table turnovers during peak dining hours", icon: "⚡" },
                { key: 'errors', text: "Order errors between waiters & kitchen (KOT miscommunications)", icon: "🍳" },
                { key: 'checkout', text: "Losing customers to long checkout and payment delays", icon: "💳" }
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => handleSelectPainPoint(item.key)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: biggestPainPoint === item.key ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    border: biggestPainPoint === item.key ? '2px solid var(--brand)' : '1px solid var(--border)',
                    borderRadius: 14,
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    fontSize: 13,
                    lineHeight: 1.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'var(--transition)'
                  }}
                >
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontWeight: 600 }}>{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SCREEN 5: THE QUANTIFIED ROI REVEAL (DESIRE PHASE) ── */}
        {screenIndex === 4 && (
          <div className="anim-fade" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: 8, background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', color: 'var(--warning)', marginBottom: 16 }}>
              <TrendingUp size={24} />
            </div>

            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 12 }}>
              Estimated Monthly Profit Loss
            </h2>

            {/* Counting Up Value Display */}
            <div style={{
              fontSize: 48,
              fontWeight: 900,
              fontFamily: 'var(--font-display)',
              color: 'var(--brand)',
              textShadow: '0 0 15px rgba(255, 125, 0, 0.3)',
              marginBottom: 12
            }}>
              {formatPrice(animatedLoss)}
            </div>

            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, padding: '0 8px' }}>
              Your venue operates <strong style={{ color: '#fff' }}>{tableCount} tables</strong>. Based on average turnover rates, you are losing an estimated {formatPrice(targetLossValue)} every month to service friction.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 28, fontSize: 12, color: 'var(--text-secondary)' }}>
              "Meenufy is built to reclaim this loss instantly."
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleNext}
              style={{ height: 48 }}
            >
              Show Me the Solution ↓
            </button>
          </div>
        )}

        {/* ── SCREEN 6: THE 3-STEP SETUP MAGIC (DESIRE PHASE) ── */}
        {screenIndex === 5 && (
          <div className="anim-fade">
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>
              Reclaim Your Losses in 3 Steps
            </h2>

            {/* Checklist Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28, position: 'relative', paddingLeft: 12 }}>
              {/* Timeline Connector Line */}
              <div style={{
                position: 'absolute',
                top: 8, bottom: 8, left: 24,
                width: 2,
                background: 'linear-gradient(180deg, var(--brand) 0%, rgba(255,125,0,0.1) 100%)'
              }} />

              <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  boxShadow: '0 0 10px rgba(255,125,0,0.4)'
                }}>1</div>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Instant QR Code Generation</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Deploy customized ordering QR sheets directly to tables in under 30 seconds.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  boxShadow: '0 0 10px rgba(255,125,0,0.4)'
                }}>2</div>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>One-Click AI Menu Extractor</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Upload a raw menu PDF/image; our engine automatically builds the menu with variants.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  boxShadow: '0 0 10px rgba(255,125,0,0.4)'
                }}>3</div>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Real-Time Kanban Order Stream</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Drag-and-drop orders seamlessly from kitchen prep screens to servers instantly.
                  </p>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleNext}
              style={{ height: 48 }}
            >
              Explore System Features →
            </button>
          </div>
        )}

        {/* ── SCREEN 7: THE CORE SPECIFICATION CAROUSEL (DESIRE PHASE) ── */}
        {screenIndex === 6 && (
          <div className="anim-fade">
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 16 }}>
              Core Specifications
            </h2>

            {/* Swipeable Carousel Panel */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24,
              minHeight: 220,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              marginBottom: 16,
              position: 'relative'
            }}>
              {/* Carousel navigation arrow overlay */}
              <button 
                onClick={() => setCarouselIndex(prev => (prev === 0 ? carouselItems.length - 1 : prev - 1))}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 18, width: 32, height: 32
                }}
              >
                ‹
              </button>

              <button 
                onClick={() => setCarouselIndex(prev => (prev === carouselItems.length - 1 ? 0 : prev + 1))}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 18, width: 32, height: 32
                }}
              >
                ›
              </button>

              {(() => {
                const item = carouselItems[carouselIndex];
                const IconComponent = item.icon;
                return (
                  <div className="anim-fade" key={carouselIndex} style={{ padding: '0 20px' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifySelf: 'center',
                      justifyContent: 'center', color: item.color, marginBottom: 14
                    }}>
                      <IconComponent size={24} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {item.desc}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Pagination dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
              {carouselItems.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  style={{
                    width: i === carouselIndex ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === carouselIndex ? 'var(--brand)' : 'rgba(255, 255, 255, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                />
              ))}
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleNext}
              style={{ height: 48 }}
            >
              See Impact Metrics →
            </button>
          </div>
        )}

        {/* ── SCREEN 8: QUANTIFIABLE SOCIAL PROOF (DESIRE PHASE) ── */}
        {screenIndex === 7 && (
          <div className="anim-fade">
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
              Proven Outcomes
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
              Backed by performance metrics from restaurant operators.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {[
                { title: "50%+", sub: "Waitstaff Shift Time Reclaimed", icon: "🕒" },
                { title: "3x Faster", sub: "Average Table Turnaround Time", icon: "⚡" },
                { title: "0%", sub: "Missed Orders — Operations Sync", icon: "🍳" }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                  }}
                >
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)', marginBottom: 2 }}>{item.title}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleNext}
              style={{ height: 48 }}
            >
              Start Eliminating Friction →
            </button>
          </div>
        )}

        {/* ── SCREEN 9: FRICION-KILLING OBJECTION SMASHER (CLOSE PHASE) ── */}
        {screenIndex === 8 && (
          <div className="anim-fade">
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
              Got Questions?
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
              Addressing core concerns before setup.
            </p>

            {/* Accordion List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {faqItems.map((item, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      style={{
                        width: '100%',
                        padding: '16px 18px',
                        background: 'none', border: 'none',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{item.q}</span>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isOpen && (
                      <div style={{
                        padding: '0 18px 16px',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                        paddingTop: 12
                      }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              className="btn btn-primary btn-full"
              onClick={handleNext}
              style={{ height: 48 }}
            >
              View Subscription Options →
            </button>
          </div>
        )}

        {/* ── SCREEN 10: GEOLOCALIZED PRICING MATRIX (CLOSE PHASE) ── */}
        {screenIndex === 9 && (
          <div className="anim-fade" style={{ maxWidth: 460, justifySelf: 'center', width: '100%' }}>
            <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
              {!serviceModeSelected ? '⚡ How Will You Accept Orders?' : '🎯 Choose Your Plan'}
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 18 }}>
              {!serviceModeSelected
                ? 'Select your primary order-accepting mode. You can change this later.'
                : detectingLocation ? 'Determining your regional currency...' : `Prices localized to ${currency === 'INR' ? 'INR (₹)' : 'USD ($)'}`
              }
            </p>

            {/* STEP A: Service Mode Selection */}
            {!serviceModeSelected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {[
                  {
                    id: 'dining_takeaway' as const,
                    emoji: '🍽️',
                    title: 'In-Dining & Takeaway',
                    desc: 'QR scan menus, table orders, dine-in management & takeaway orders. No home delivery.',
                    badge: 'Most Common'
                  },
                  {
                    id: 'delivery_only' as const,
                    emoji: '🛵',
                    title: 'Home Delivery Only',
                    desc: 'Accept delivery orders online with GPS tracking, distance-based pricing & rider management.',
                    badge: ''
                  },
                  {
                    id: 'both' as const,
                    emoji: '🚀',
                    title: 'All of the Above',
                    desc: 'Full access — In-Dining, Takeaway, and Home Delivery all enabled. Best for growing restaurants.',
                    badge: 'Premium Only'
                  }
                ].map(opt => {
                  const isSelected = basePlanSelectedType === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setBasePlanSelectedType(opt.id)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        background: isSelected ? 'rgba(255,125,0,0.06)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
                        borderRadius: 14,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {opt.badge && (
                        <span style={{
                          position: 'absolute', top: -9, right: 12,
                          background: opt.id === 'both' ? 'var(--brand)' : 'rgba(255,125,0,0.15)',
                          color: opt.id === 'both' ? '#fff' : 'var(--brand)',
                          fontSize: 9, fontWeight: 800, padding: '2px 8px',
                          borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}>
                          {opt.badge}
                        </span>
                      )}
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: isSelected ? 'rgba(255,125,0,0.12)' : 'var(--bg-elevated)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, border: isSelected ? '1px solid rgba(255,125,0,0.3)' : '1px solid var(--border)',
                        transition: 'all 0.2s ease'
                      }}>
                        {opt.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? 'var(--brand)' : 'var(--text-primary)', marginBottom: 3 }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {opt.desc}
                        </div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        border: isSelected ? '5px solid var(--brand)' : '2px solid var(--border)',
                        background: isSelected ? 'var(--brand)' : 'transparent',
                        transition: 'all 0.2s ease'
                      }} />
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    // 'both' forces premium plan
                    if (basePlanSelectedType === 'both') {
                      setSelectedPlan('standard');
                    }
                    setServiceModeSelected(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    borderRadius: 12,
                    background: 'var(--brand)',
                    border: 'none',
                    color: '#000',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  Continue to Plan Selection →
                </button>
              </div>
            )}

            {/* STEP B: Plan Selection (after service mode chosen) */}
            {serviceModeSelected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>

                {/* Service mode summary chip */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(255,125,0,0.08)', border: '1px solid rgba(255,125,0,0.2)',
                  marginBottom: 4
                }}>
                  <span style={{ fontSize: 14 }}>
                    {basePlanSelectedType === 'dining_takeaway' ? '🍽️' : basePlanSelectedType === 'delivery_only' ? '🛵' : '🚀'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>
                    {basePlanSelectedType === 'dining_takeaway' ? 'In-Dining & Takeaway selected' : basePlanSelectedType === 'delivery_only' ? 'Home Delivery Only selected' : 'All Services selected'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServiceModeSelected(false)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Change
                  </button>
                </div>

                {[
                  {
                    id: 'base',
                    name: 'Basic Plan',
                    price: currency === 'INR' ? '₹2,500/mo' : '$30/mo',
                    renewal: currency === 'INR' ? '₹25,000/yr' : '$300/yr',
                    features: basePlanSelectedType === 'dining_takeaway'
                      ? ['✅ In-Dining & QR Menus', '✅ Takeaway Orders', '✅ Kitchen Display', '✅ Analytics', '❌ Home Delivery']
                      : basePlanSelectedType === 'delivery_only'
                      ? ['✅ Home Delivery Orders', '✅ GPS Tracking', '✅ Rider Management', '✅ Analytics', '❌ Dine-In / Takeaway']
                      : [],
                    recommended: basePlanSelectedType !== 'both',
                    hidden: basePlanSelectedType === 'both'
                  },
                  {
                    id: 'standard',
                    name: 'Advance Plan',
                    price: currency === 'INR' ? '₹4,000/mo' : '$50/mo',
                    renewal: currency === 'INR' ? '₹40,000/yr' : '$500/yr',
                    features: ['✅ In-Dining & QR Menus', '✅ Takeaway Orders', '✅ Home Delivery', '✅ GPS Rider Tracking', '✅ Advanced Analytics'],
                    recommended: basePlanSelectedType === 'both',
                    hidden: false,
                    popular: true
                  }
                ].filter(p => !p.hidden).map(plan => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlan(plan.id);
                        if (plan.id !== 'base' || basePlanSelectedType === 'both') {
                          handleNext();
                        } else {
                          handleNext();
                        }
                      }}
                      style={{
                        position: 'relative',
                        background: isSelected ? 'rgba(255,125,0,0.05)' : 'rgba(255,255,255,0.02)',
                        border: plan.recommended ? '2px solid var(--brand)' : '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 16,
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                    >
                      {plan.recommended && (
                        <span style={{
                          position: 'absolute', top: -9, right: 14,
                          background: 'var(--brand)', color: '#fff',
                          fontSize: 9, fontWeight: 800, padding: '2px 8px',
                          borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}>
                          {basePlanSelectedType === 'both' ? 'Required for All Services' : 'Recommended'}
                        </span>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{plan.name}</h4>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--brand)' }}>{plan.price}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>billed annually at {plan.renewal}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {plan.features.map((f, i) => (
                          <div key={i} style={{ fontSize: 11, color: f.startsWith('❌') ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{f}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Free trial option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlan('free');
                    handleNext();
                  }}
                  style={{
                    width: '100%',
                    background: 'none', border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 12, cursor: 'pointer',
                    textAlign: 'center', padding: '8px 0', textDecoration: 'underline',
                    marginTop: 8
                  }}
                >
                  Start 21-Day Free Trial (Try all features free for 21 days) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SCREEN 11: FINAL HAND-OFF & SETUP (CLOSE PHASE) ── */}
        {screenIndex === 10 && (
          <div className="anim-fade">
            {!isCompleting ? (
              <form onSubmit={handleCompleteSetup}>
                <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>
                  Create Your Store
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24 }}>
                  Enter your restaurant's name to compile your custom dashboard.
                </p>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Bella Italia Bistro"
                    value={restaurantName}
                    onChange={e => setRestaurantName(e.target.value)}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 12,
                      padding: '0 16px',
                      fontSize: 14,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ height: 48 }}
                >
                  Complete Setup & Launch Dashboard
                </button>
              </form>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200
              }}>
                {showCheckmark ? (
                  <div className="anim-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '3px solid var(--success)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--success)', marginBottom: 20,
                      boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
                      animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                      <Check size={36} />
                    </div>
                    <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Setup Complete!
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Launching your kitchen console...
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Premium spinner */}
                    <div style={{
                      width: 48, height: 48,
                      border: '3px solid rgba(255, 125, 0, 0.1)',
                      borderTop: '3px solid var(--brand)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: 20
                    }} />
                    <style>{`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}</style>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Creating configuration profiles...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
