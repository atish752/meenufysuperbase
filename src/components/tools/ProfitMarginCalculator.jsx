import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { calculateProfitMargins } from '../../lib/profitMarginUtils';

const CURRENCIES = [
  { symbol: '₹', code: 'INR', label: 'Indian Rupee' },
  { symbol: '$', code: 'USD', label: 'US Dollar' },
  { symbol: '€', code: 'EUR', label: 'Euro' },
  { symbol: '£', code: 'GBP', label: 'British Pound' },
  { symbol: 'د.إ', code: 'AED', label: 'UAE Dirham' },
  { symbol: 'CA$', code: 'CAD', label: 'Canadian Dollar' },
  { symbol: 'A$', code: 'AUD', label: 'Australian Dollar' },
  { symbol: 'S$', code: 'SGD', label: 'Singapore Dollar' }
];

const PRESETS = {
  fine_dining: {
    revenueFood: 85000,
    revenueBeverage: 30000,
    revenueOther: 5000,
    cogs: 34000,
    labor: 38000,
    rent: 12000,
    utilities: 4500,
    marketing: 3000,
    repairs: 2000,
    licenses: 1500,
    other: 2500,
    restaurantType: 'Fine Dining'
  },
  casual_dining: {
    revenueFood: 60000,
    revenueBeverage: 18000,
    revenueOther: 2000,
    cogs: 24000,
    labor: 25000,
    rent: 8000,
    utilities: 3000,
    marketing: 2000,
    repairs: 1500,
    licenses: 1000,
    other: 2000,
    restaurantType: 'Casual Dining'
  },
  fast_food: {
    revenueFood: 50000,
    revenueBeverage: 8000,
    revenueOther: 2000,
    cogs: 17000,
    labor: 16000,
    rent: 5000,
    utilities: 2500,
    marketing: 1500,
    repairs: 1000,
    licenses: 800,
    other: 1200,
    restaurantType: 'Fast Food/QSR'
  },
  cafe: {
    revenueFood: 22000,
    revenueBeverage: 12000,
    revenueOther: 1000,
    cogs: 9500,
    labor: 11000,
    rent: 3500,
    utilities: 1200,
    marketing: 800,
    repairs: 500,
    licenses: 400,
    other: 1100,
    restaurantType: 'Café'
  },
  food_truck: {
    revenueFood: 15000,
    revenueBeverage: 2500,
    revenueOther: 500,
    cogs: 5500,
    labor: 4500,
    rent: 0,
    utilities: 600,
    marketing: 500,
    repairs: 400,
    licenses: 300,
    other: 500,
    restaurantType: 'Food Truck'
  },
  cloud_kitchen: {
    revenueFood: 40000,
    revenueBeverage: 2000,
    revenueOther: 3000,
    cogs: 13500,
    labor: 10000,
    rent: 2500,
    utilities: 1800,
    marketing: 1500,
    repairs: 800,
    licenses: 500,
    other: 1500,
    restaurantType: 'Cloud Kitchen'
  }
};

const CONVERSION_RATES = {
  INR: 83.5,
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  AED: 3.67,
  CAD: 1.36,
  AUD: 1.50,
  SGD: 1.34
};

export default function ProfitMarginCalculator() {
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantType, setRestaurantType] = useState('Casual Dining');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [period, setPeriod] = useState('monthly');
  const [activePreset, setActivePreset] = useState(null);

  // Revenue State
  const [foodRevenue, setFoodRevenue] = useState('');
  const [beverageRevenue, setBeverageRevenue] = useState('');
  const [otherRevenue, setOtherRevenue] = useState('');

  // Expense State
  const [cogs, setCogs] = useState('');
  const [labor, setLabor] = useState('');
  const [rent, setRent] = useState('');
  const [utilities, setUtilities] = useState('');
  const [marketing, setMarketing] = useState('');
  const [repairs, setRepairs] = useState('');
  const [licenses, setLicenses] = useState('');
  const [otherExpenses, setOtherExpenses] = useState('');

  // What-if sliders state
  const [whatIfRevenue, setWhatIfRevenue] = useState(0);
  const [whatIfCogs, setWhatIfCogs] = useState(0);
  const [whatIfLabor, setWhatIfLabor] = useState(0);
  const [whatIfRent, setWhatIfRent] = useState(0);
  const [whatIfDelivery, setWhatIfDelivery] = useState(0);

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  // Collapsible sections
  const [showWhatIf, setShowWhatIf] = useState(false);

  // Trigger calculations
  const res = useMemo(() => {
    return calculateProfitMargins({
      foodRevenue, beverageRevenue, otherRevenue,
      cogs, labor, rent, utilities, marketing, repairs, licenses, otherExpenses,
      period,
      whatIfRevenue, whatIfCogs, whatIfLabor, whatIfRent, whatIfDelivery
    });
  }, [
    foodRevenue, beverageRevenue, otherRevenue,
    cogs, labor, rent, utilities, marketing, repairs, licenses, otherExpenses,
    period,
    whatIfRevenue, whatIfCogs, whatIfLabor, whatIfRent, whatIfDelivery
  ]);

  // Decode URL state on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('d');
    if (!data) {
      return;
    }

    try {
      const parsed = JSON.parse(decodeURIComponent(atob(data)));
      if (Array.isArray(parsed) && parsed.length >= 13) {
        const code = parsed[0];
        const matchedCurr = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
        setCurrency(matchedCurr);
        setPeriod(parsed[1]);
        setFoodRevenue(parsed[2] === '0' ? '' : parsed[2]);
        setBeverageRevenue(parsed[3] === '0' ? '' : parsed[3]);
        setOtherRevenue(parsed[4] === '0' ? '' : parsed[4]);
        setCogs(parsed[5] === '0' ? '' : parsed[5]);
        setLabor(parsed[6] === '0' ? '' : parsed[6]);
        setRent(parsed[7] === '0' ? '' : parsed[7]);
        setUtilities(parsed[8] === '0' ? '' : parsed[8]);
        setMarketing(parsed[9] === '0' ? '' : parsed[9]);
        setRepairs(parsed[10] === '0' ? '' : parsed[10]);
        setLicenses(parsed[11] === '0' ? '' : parsed[11]);
        setOtherExpenses(parsed[12] === '0' ? '' : parsed[12]);
        if (parsed[13]) setRestaurantName(parsed[13]);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const applyPresetValues = (presetKey, currencyCode) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    setActivePreset(presetKey);
    setRestaurantType(preset.restaurantType);
    const rate = CONVERSION_RATES[currencyCode] || 1.0;

    setFoodRevenue(Math.round(preset.revenueFood * rate).toString());
    setBeverageRevenue(Math.round(preset.revenueBeverage * rate).toString());
    setOtherRevenue(Math.round(preset.revenueOther * rate).toString());
    setCogs(Math.round(preset.cogs * rate).toString());
    setLabor(Math.round(preset.labor * rate).toString());
    setRent(Math.round(preset.rent * rate).toString());
    setUtilities(Math.round(preset.utilities * rate).toString());
    setMarketing(Math.round(preset.marketing * rate).toString());
    setRepairs(Math.round(preset.repairs * rate).toString());
    setLicenses(Math.round(preset.licenses * rate).toString());
    setOtherExpenses(Math.round(preset.other * rate).toString());
  };

  const formatVal = (amount) => {
    return `${currency.symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPercentColor = (pct, type) => {
    if (res.totalRevenue === 0) return 'text-gray-400';
    if (type === 'cogs') {
      if (pct > 38) return 'text-rose-500';
      if (pct > 32) return 'text-amber-500';
      return 'text-emerald-500';
    }
    if (type === 'labor') {
      if (pct > 36) return 'text-rose-500';
      if (pct > 30) return 'text-amber-500';
      return 'text-emerald-500';
    }
    if (type === 'rent') {
      if (pct > 12) return 'text-rose-500';
      if (pct > 8) return 'text-amber-500';
      return 'text-emerald-500';
    }
    return 'text-gray-400';
  };

  // Badge styles
  const getBadgeNode = (val, lower, upper, higherIsBetter) => {
    if (res.totalRevenue === 0) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">No Data</span>;
    }
    let state = 'good';
    if (higherIsBetter) {
      if (val < lower) state = 'critical';
      else if (val < upper) state = 'warning';
    } else {
      if (val > upper) state = 'critical';
      else if (val > lower) state = 'warning';
    }

    if (state === 'good') return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-600">Healthy</span>;
    if (state === 'warning') return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-600">Borderline</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-600">Critical</span>;
  };

  // Net margin gauge position
  const gaugePercent = useMemo(() => {
    if (res.totalRevenue === 0) return 0;
    const val = ((res.netMargin + 5) / 25) * 100;
    return Math.max(0, Math.min(100, val));
  }, [res.netMargin, res.totalRevenue]);

  const getGaugeVerdict = () => {
    if (res.totalRevenue === 0) return { title: 'Enter numbers to view positioning', desc: 'Fill food sales, beverage sales, COGS, and labor cost to get a contextual diagnosis.' };
    const m = res.netMargin;
    if (m < 0) return { title: '🔴 Losing (Below 0%): Action Needed Immediately', desc: 'You are spending more than you earn. Review food waste, trim scheduling, and check recipe markups.' };
    if (m <= 3) return { title: '🟡 Marginal (0–3%): Extremely Thin', desc: 'Very narrow buffer. A single slow weekend can wipe out profits. Consider price increases.' };
    if (m <= 6) return { title: '🟢 Average (3–6%): Standard Industry Performers', desc: 'You are in line with average global restaurant margins. Focus on optimizing prime costs.' };
    if (m <= 9) return { title: '🟢 Good (6–9%): Above Average Operations', desc: 'You are running a tight ship. Menu engineering and automated self-ordering can push you into top tier.' };
    if (m <= 15) return { title: '✨ Excellent (9–15%): Top Industry Performer', desc: 'Highly profitable operation. You have real pricing power and optimized payroll.' };
    return { title: '🏆 World-Class (15%+): Exceptional Operations', desc: 'Outstanding operational margins! Maximize revenue efficiency. Excellent management.' };
  };

  const verdict = getGaugeVerdict();

  // Draw Donut slices
  const donutSlices = useMemo(() => {
    if (res.totalRevenue === 0) return [];
    const items = [
      { label: 'COGS', value: parseFloat(cogs) || 0, color: '#F87171' },
      { label: 'Labor', value: parseFloat(labor) || 0, color: '#60A5FA' },
      { label: 'Rent', value: parseFloat(rent) || 0, color: '#34D399' },
      { label: 'Utilities', value: parseFloat(utilities) || 0, color: '#FBBF24' },
      { label: 'Marketing', value: parseFloat(marketing) || 0, color: '#A78BFA' },
      { label: 'Other Overhead', value: (parseFloat(repairs) || 0) + (parseFloat(licenses) || 0) + (parseFloat(otherExpenses) || 0), color: '#9CA3AF' }
    ];
    if (res.netProfit > 0) {
      items.push({ label: 'Net Profit', value: res.netProfit, color: '#F97316' });
    }
    const filtered = items.filter(x => x.value > 0);
    const sum = filtered.reduce((a, b) => a + b.value, 0);
    
    let acc = 0;
    const rad = 70;
    const circ = 2 * Math.PI * rad;
    return filtered.map(item => {
      const pct = item.value / sum;
      const offset = circ - (pct * circ);
      const rotation = acc * 360;
      acc += pct;
      return { ...item, pct, offset, circ, rotation };
    });
  }, [cogs, labor, rent, utilities, marketing, repairs, licenses, otherExpenses, res.netProfit, res.totalRevenue]);

  // AI analysis fetch
  const runAiAnalysis = async () => {
    if (res.totalRevenue === 0) {
      alert('Please enter restaurant revenue details first!');
      return;
    }
    setAiLoading(true);
    setAiProgress(0);
    setAiAnalysis('');

    const interval = setInterval(() => {
      setAiProgress(prev => Math.min(95, prev + (95 - prev) * 0.15));
    }, 180);

    try {
      const payload = {
        revenue: res.totalRevenue,
        cogs: parseFloat(cogs) || 0,
        labor: parseFloat(labor) || 0,
        rent: parseFloat(rent) || 0,
        utilities: parseFloat(utilities) || 0,
        marketing: parseFloat(marketing) || 0,
        other: (parseFloat(repairs) || 0) + (parseFloat(licenses) || 0) + (parseFloat(otherExpenses) || 0),
        netMargin: res.netMargin.toFixed(1),
        grossMargin: res.grossMargin.toFixed(1),
        primeCost: res.primeCostPct.toFixed(1),
        ebitda: res.ebitdaMargin.toFixed(1),
        restaurantType,
        currency: currency.code,
        period
      };

      const response = await fetch('/api/profit-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      clearInterval(interval);
      setAiProgress(100);
      
      setTimeout(() => {
        setAiLoading(false);
        if (data.analysis) {
          setAiAnalysis(data.analysis);
        } else {
          alert('Failed to generate analysis: ' + (data.error || 'Unknown error'));
        }
      }, 400);
    } catch (e) {
      clearInterval(interval);
      setAiLoading(false);
      alert('Failed to connect to AI consultant.');
    }
  };

  // Actions
  const handleCopyResults = () => {
    if (res.totalRevenue === 0) return;
    const text = `Meenufy Restaurant Profit Margin Report
--------------------------------------
Restaurant: ${restaurantName || 'Unspecified'}
Time Period: ${period.toUpperCase()}
Currency: ${currency.code}

REVENUE SUMMARY:
- Total Revenue: ${formatVal(res.totalRevenue)}
- Total Operating Costs: ${formatVal(res.totalExpenses)}

PROFIT MARGINS:
- Gross Profit Margin: ${res.grossMargin.toFixed(1)}% (${formatVal(res.grossProfit)})
- Net Profit Margin: ${res.netMargin.toFixed(1)}% (${formatVal(res.netProfit)})
- Prime Cost: ${res.primeCostPct.toFixed(1)}% (${formatVal(res.primeCost)})
- EBITDA Margin: ${res.ebitdaMargin.toFixed(1)}% (${formatVal(res.ebitda)})
- Break-Even Sales: ${formatVal(res.breakEven)}/month

Optimise margins with QR self-ordering by Meenufy — meenufy.com
`;
    navigator.clipboard.writeText(text).then(() => alert('📋 Results copied!'));
  };

  const handleCopyExcel = () => {
    if (res.totalRevenue === 0) return;
    const rows = [
      ['Metric', 'Value', '% of Revenue'],
      ['Food Revenue', parseFloat(foodRevenue) || 0, ''],
      ['Beverage Revenue', parseFloat(beverageRevenue) || 0, ''],
      ['Other Revenue', parseFloat(otherRevenue) || 0, ''],
      ['Total revenue', res.totalRevenue, '100.0%'],
      ['COGS', parseFloat(cogs) || 0, `${res.cogsPct.toFixed(1)}%`],
      ['Labor', parseFloat(labor) || 0, `${res.laborPct.toFixed(1)}%`],
      ['Rent', parseFloat(rent) || 0, `${res.rentPct.toFixed(1)}%`],
      ['Utilities', parseFloat(utilities) || 0, `${((parseFloat(utilities) || 0)/res.totalRevenue*100).toFixed(1)}%`],
      ['Marketing', parseFloat(marketing) || 0, `${((parseFloat(marketing) || 0)/res.totalRevenue*100).toFixed(1)}%`],
      ['Repairs', parseFloat(repairs) || 0, `${((parseFloat(repairs) || 0)/res.totalRevenue*100).toFixed(1)}%`],
      ['Licenses', parseFloat(licenses) || 0, `${((parseFloat(licenses) || 0)/res.totalRevenue*100).toFixed(1)}%`],
      ['Other', parseFloat(otherExpenses) || 0, `${((parseFloat(otherExpenses) || 0)/res.totalRevenue*100).toFixed(1)}%`],
      ['Gross Profit', res.grossProfit, `${res.grossMargin.toFixed(1)}%`],
      ['Net Profit', res.netProfit, `${res.netMargin.toFixed(1)}%`],
      ['Prime Cost', res.primeCost, `${res.primeCostPct.toFixed(1)}%`],
      ['EBITDA', res.ebitda, `${res.ebitdaMargin.toFixed(1)}%`],
      ['Monthly Break-Even Point', res.breakEven, '']
    ];
    const content = rows.map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(content).then(() => alert('📊 Excel TSV copied!'));
  };

  const handleShare = () => {
    const payload = [
      currency.code,
      period,
      foodRevenue || '0', beverageRevenue || '0', otherRevenue || '0',
      cogs || '0', labor || '0', rent || '0', utilities || '0', marketing || '0', repairs || '0', licenses || '0', otherExpenses || '0',
      restaurantName
    ];
    const enc = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = `${window.location.origin}/tools/restaurant-profit-margin-calculator/?d=${enc}`;
    navigator.clipboard.writeText(url).then(() => alert('🔗 Share link copied!'));
  };

  const handleExportPDF = () => {
    if (res.totalRevenue === 0) return;
    const doc = new jsPDF();
    const pdfSym = currency.symbol === '₹' ? 'Rs. ' : (currency.symbol === 'د.إ' ? 'AED ' : currency.symbol);
    
    doc.setFontSize(22);
    doc.setTextColor('#F97316');
    doc.text('Profit Margin Report', 20, 25);

    doc.setFontSize(9);
    doc.setTextColor('#6B7280');
    doc.text(`Generated via Meenufy — meenufy.com`, 20, 32);

    doc.setFontSize(10);
    doc.setTextColor('#111827');
    doc.text(`Restaurant: ${restaurantName || 'My Restaurant'}`, 20, 44);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);

    const data = [
      ['Total Revenue', `${pdfSym}${res.totalRevenue.toLocaleString()}`, '100%'],
      ['COGS (Food Cost)', `${pdfSym}${res.cogsPct.toFixed(1)}%`, `${res.cogsPct.toFixed(1)}%`],
      ['Labor Cost', `${pdfSym}${res.laborPct.toFixed(1)}%`, `${res.laborPct.toFixed(1)}%`],
      ['Rent', `${pdfSym}${res.rentPct.toFixed(1)}%`, `${res.rentPct.toFixed(1)}%`],
      ['Net Profit', `${pdfSym}${res.netProfit.toLocaleString()}`, `${res.netMargin.toFixed(1)}%`]
    ];

    doc.autoTable({
      startY: 60,
      head: [['Metric', 'Amount', '% of Revenue']],
      body: data,
      theme: 'striped'
    });

    if (aiAnalysis) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('AI Consultant Diagnostics', 20, 25);
      doc.setFontSize(10);
      const split = doc.splitTextToSize(aiAnalysis, 170);
      doc.text(split, 20, 40);
    }

    doc.save('Restaurant_Profit_Margin_Report.pdf');
  };

  return (
    <div className="space-y-8">
      {/* Preset Row */}
      <div class="bg-white border border-orange-100 rounded-2xl p-6 shadow-sm bg-gradient-to-r from-orange-50/20 to-amber-50/20">
        <h3 class="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-4 text-center">
          Select a Restaurant Preset to Populate Demo Values
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Object.keys(PRESETS).map(key => (
            <button
              key={key}
              onClick={() => applyPresetValues(key, currency.code)}
              className={`px-4 py-3 rounded-xl border hover:border-brand hover:shadow transition text-left flex flex-col gap-1 ${
                activePreset === key ? 'border-brand ring-2 ring-brand/20 bg-orange-50/10' : 'border-gray-200 bg-white'
              }`}
            >
              <span class="text-lg">
                {key === 'fine_dining' && '🍽️'}
                {key === 'casual_dining' && '🍕'}
                {key === 'fast_food' && '🍔'}
                {key === 'cafe' && '☕'}
                {key === 'food_truck' && '🚚'}
                {key === 'cloud_kitchen' && '📦'}
              </span>
              <span class="text-xs font-bold text-gray-900 leading-tight">
                {PRESETS[key].restaurantType}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Inputs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Controls */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Currency</label>
              <select
                value={currency.code}
                onChange={e => {
                  const curr = CURRENCIES.find(c => c.code === e.target.value);
                  setCurrency(curr);
                  if (activePreset) applyPresetValues(activePreset, curr.code);
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Time Period</label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Restaurant Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                placeholder="e.g. Raj's Cafe"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Revenue card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">💰 Revenue Inputs</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Total Food Revenue</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={foodRevenue} onChange={e => setFoodRevenue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Total Beverage Revenue</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={beverageRevenue} onChange={e => setBeverageRevenue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Other Income</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={otherRevenue} onChange={e => setOtherRevenue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between font-extrabold text-sm text-gray-900">
                <span>TOTAL REVENUE:</span>
                <span className="text-brand">{formatVal(res.totalRevenue)}</span>
              </div>
            </div>

            {/* Expenses card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider pb-3 border-b border-gray-100">📦 Operating Expenses</h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-500">Food/COGS</label>
                      <span className={getPercentColor(res.cogsPct, 'cogs')}>{res.cogsPct.toFixed(1)}%</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={cogs} onChange={e => setCogs(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-500">Labor</label>
                      <span className={getPercentColor(res.laborPct, 'labor')}>{res.laborPct.toFixed(1)}%</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={labor} onChange={e => setLabor(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-500">Rent</label>
                      <span className={getPercentColor(res.rentPct, 'rent')}>{res.rentPct.toFixed(1)}%</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={rent} onChange={e => setRent(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Utilities</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={utilities} onChange={e => setUtilities(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Marketing</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={marketing} onChange={e => setMarketing(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Repairs</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={repairs} onChange={e => setRepairs(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Licenses</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={licenses} onChange={e => setLicenses(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Other Costs</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sm font-semibold text-gray-400">{currency.symbol}</span>
                      <input type="number" value={otherExpenses} onChange={e => setOtherExpenses(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none" />
                    </div>
                  </div>

                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between font-extrabold text-sm text-gray-900">
                <span>TOTAL COSTS:</span>
                <span className="text-brand">{formatVal(res.totalExpenses)}</span>
              </div>
            </div>

          </div>

          {/* AI Analysis Section */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">✨ AI Financial Diagnosis</h3>
            <p className="text-xs text-gray-500">Get a plain-English, actionable diagnosis of your margins.</p>
            <button onClick={runAiAnalysis} className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow">
              🤖 Analyse My Restaurant's Financials
            </button>
            {aiAnalysis && (
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {aiAnalysis}
              </div>
            )}
          </div>

          {/* SVG Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Donut */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col items-center">
              <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-4 w-full">🍰 Cost Breakdown</h4>
              <div className="w-full flex items-center justify-center py-2">
                <svg width="220" height="220" viewBox="0 0 220 220" className="transform -rotate-90">
                  {donutSlices.length === 0 ? (
                    <circle cx="110" cy="110" r="70" fill="transparent" stroke="#E5E7EB" strokeWidth="24" />
                  ) : (
                    donutSlices.map((slice, idx) => (
                      <circle
                        key={idx}
                        cx="110"
                        cy="110"
                        r="70"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="24"
                        strokeDasharray={`${slice.circ} ${slice.circ}`}
                        strokeDashoffset={slice.offset}
                        transform={`rotate(${slice.rotation} 110 110)`}
                      />
                    ))
                  )}
                  <g transform="rotate(90 110 110)">
                    <text x="110" y="108" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#6B7280" fontWeight="semibold">OPERATING</text>
                    <text x="110" y="122" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill="#111827" fontWeight="black">BREAKDOWN</text>
                  </g>
                </svg>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 w-full text-[10px] text-gray-500 font-semibold">
                {donutSlices.map((slice, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: slice.color }}></span>
                    <span>{slice.label} ({(slice.pct * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Waterfall */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center space-y-4">
              <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">📊 P&amp;L Waterfall</h4>
              {res.totalRevenue === 0 ? (
                <div className="text-center text-xs text-gray-400 font-semibold py-8">Enter revenue details to view waterfall</div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-extrabold text-gray-800">
                      <span>Gross Revenue</span>
                      <span>{formatVal(res.totalRevenue)} (100%)</span>
                    </div>
                    <div className="w-full h-4 bg-gray-800 rounded"></div>
                  </div>

                  {parseFloat(cogs) > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                        <span>COGS</span>
                        <span>{formatVal(parseFloat(cogs))} ({res.cogsPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100/50 rounded overflow-hidden">
                        <div className="h-full bg-rose-400 rounded" style={{ width: `${Math.max(2, res.cogsPct)}%` }}></div>
                      </div>
                    </div>
                  )}

                  {parseFloat(labor) > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                        <span>Labor</span>
                        <span>{formatVal(parseFloat(labor))} ({res.laborPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100/50 rounded overflow-hidden">
                        <div className="h-full bg-blue-400 rounded" style={{ width: `${Math.max(2, res.laborPct)}%` }}></div>
                      </div>
                    </div>
                  )}

                  {parseFloat(rent) > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                        <span>Rent</span>
                        <span>{formatVal(parseFloat(rent))} ({res.rentPct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100/50 rounded overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded" style={{ width: `${Math.max(2, res.rentPct)}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 pt-2 border-t border-gray-100 mt-2">
                    <div className="flex justify-between text-[11px] font-extrabold text-gray-900">
                      <span>Net Profit Margin</span>
                      <span className={res.netProfit >= 0 ? 'text-brand' : 'text-rose-500'}>{formatVal(res.netProfit)} ({res.netMargin.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full h-4 bg-gray-100 rounded overflow-hidden">
                      <div className={`h-full ${res.netProfit >= 0 ? 'bg-brand' : 'bg-rose-500'} rounded`} style={{ width: `${Math.max(0, Math.min(100, Math.abs(res.netMargin)))}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* What if Collapsible */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <button onClick={() => setShowWhatIf(!showWhatIf)} className="w-full flex justify-between items-center text-left">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">🔮 What-If Scenarios Modeling</h3>
              <span className="text-gray-400 transition-transform duration-200" style={{ transform: showWhatIf ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {showWhatIf && (
              <div className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700">What if I increase revenue by <span className="text-brand">+{whatIfRevenue}%</span>?</label>
                    <input type="range" min="0" max="50" value={whatIfRevenue} onChange={e => setWhatIfRevenue(parseInt(e.target.value))} className="w-full accent-brand bg-gray-100 h-1.5 rounded-lg appearance-none cursor-pointer mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700">What if I reduce food cost/COGS by <span className="text-brand">-{whatIfCogs}%</span>?</label>
                    <input type="range" min="0" max="20" value={whatIfCogs} onChange={e => setWhatIfCogs(parseInt(e.target.value))} className="w-full accent-brand bg-gray-100 h-1.5 rounded-lg appearance-none cursor-pointer mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700">What if I reduce labor cost by <span className="text-brand">-{whatIfLabor}%</span>?</label>
                    <input type="range" min="0" max="40" value={whatIfLabor} onChange={e => setWhatIfLabor(parseInt(e.target.value))} className="w-full accent-brand bg-gray-100 h-1.5 rounded-lg appearance-none cursor-pointer mt-1" />
                  </div>
                </div>

                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Simulated Net Profit Margin</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">Calculated using selected scenarios above</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-brand">{res.wiNetMargin.toFixed(1)}%</span>
                    <p className={`text-[10px] font-bold mt-0.5 ${res.wiProfitDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {res.wiProfitDelta >= 0 ? '+' : ''}{formatVal(res.wiProfitDelta)} profit/month
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Outcomes */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Live Calculations</h3>
            
            {/* Gross margin */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-500">Gross Profit Margin</h4>
                {getBadgeNode(res.grossMargin, 60, 68, true)}
              </div>
              <span className="text-2xl font-black text-gray-900">{res.grossMargin.toFixed(1)}%</span>
              <div className="text-[10px] text-gray-500 font-semibold">
                Gross Profit: <span className="text-gray-900 font-bold">{formatVal(res.grossProfit)}</span>
              </div>
            </div>

            {/* Net margin */}
            <div className="bg-brand-light border border-orange-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-orange-600">Net Profit Margin</h4>
                {getBadgeNode(res.netMargin, 3, 9, true)}
              </div>
              <span className="text-3xl font-black text-brand">{res.netMargin.toFixed(1)}%</span>
              <div className="text-[10px] text-gray-600 font-semibold">
                Net Profit: <span className="text-gray-950 font-bold">{formatVal(res.netProfit)}</span>
              </div>
            </div>

            {/* Prime Cost */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-500">Prime Cost</h4>
                {getBadgeNode(res.primeCostPct, 60, 65, false)}
              </div>
              <span className="text-2xl font-black text-gray-900">{res.primeCostPct.toFixed(1)}%</span>
              <div className="text-[10px] text-gray-500 font-semibold">
                Prime Cost: <span className="text-gray-900 font-bold">{formatVal(res.primeCost)}</span>
              </div>
            </div>

            {/* EBITDA */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-gray-500">EBITDA</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900">{formatVal(res.ebitda)}</span>
                <span className="text-xs text-gray-500 font-bold">({res.ebitdaMargin.toFixed(1)}% margin)</span>
              </div>
            </div>

            {/* Break-even */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
              <h4 class="text-xs font-bold text-gray-500">Break-Even Point</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900">{formatVal(res.breakEven)}</span>
                <span className="text-xs text-gray-500 font-bold">/ month</span>
              </div>
            </div>

          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExportPDF} className="py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition active:scale-95 shadow">📄 Export PDF</button>
            <button onClick={handleCopyResults} className="py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl transition active:scale-95 shadow-sm">📋 Copy Results</button>
            <button onClick={handleCopyExcel} className="py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl transition active:scale-95 shadow-sm">📊 Copy Excel</button>
            <button onClick={handleShare} className="py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl transition active:scale-95 shadow-sm">🔗 Share URL</button>
          </div>

          {/* Net Margin position gauge */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Your Net Margin Position</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Net Margin:</span>
                <span className="text-brand">{res.netMargin.toFixed(1)}%</span>
              </div>
              <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                <div className="absolute top-0 bottom-0 w-1 bg-brand shadow transition-all duration-500" style={{ left: `${gaugePercent}%` }}></div>
                <div class="absolute inset-y-0 left-0 w-[20%] bg-rose-500/10"></div>
                <div class="absolute inset-y-0 left-[20%] w-[10%] bg-amber-500/10"></div>
                <div class="absolute inset-y-0 left-[30%] w-[15%] bg-emerald-400/10"></div>
                <div class="absolute inset-y-0 left-[45%] w-[30%] bg-emerald-500/10"></div>
                <div class="absolute inset-y-0 left-[75%] w-[25%] bg-blue-500/15"></div>
              </div>
              <div className="flex justify-between text-[8px] text-gray-400 font-extrabold">
                <span>-5%</span>
                <span>0%</span>
                <span>3%</span>
                <span>6%</span>
                <span>9%</span>
                <span>15%</span>
                <span>20%+</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs space-y-1">
              <strong className="text-gray-900">{verdict.title}</strong>
              <p className="text-gray-500 text-[10px] leading-relaxed">{verdict.desc}</p>
            </div>
          </div>

        </div>

      </div>

      {/* AI Simmering Overlay */}
      {aiLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center font-sans text-white">
          <div className="text-center max-w-md w-[90%] mx-auto p-10 bg-gray-900 border border-orange-500/30 rounded-3xl shadow-2xl flex flex-col items-center gap-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div class="w-4 h-4 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div class="w-4 h-4 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">AI Financial Consultant is Analyzing...</h3>
            <p className="text-xs text-gray-400 leading-normal max-w-[280px]">
              Reviewing P&amp;L margins, estimating EBITDA and prime costs, and building actionable growth strategies.
            </p>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-gradient-to-r from-brand to-orange-400 rounded-full transition-all duration-300" style={{ width: `${aiProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
