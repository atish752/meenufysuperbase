/* ============================================================
   MEENUFY — RESTAURANT PROFIT MARGIN CALCULATOR
   Interactive logic, SVG charts, PDF export, presets, AI
   ============================================================ */

// Currency Data
const CURRENCIES = {
  INR: { symbol: '₹', code: 'INR', label: 'Indian Rupee' },
  USD: { symbol: '$', code: 'USD', label: 'US Dollar' },
  EUR: { symbol: '€', code: 'EUR', label: 'Euro' },
  GBP: { symbol: '£', code: 'GBP', label: 'British Pound' },
  AED: { symbol: 'د.إ', code: 'AED', label: 'UAE Dirham' },
  CAD: { symbol: 'CA$', code: 'CAD', label: 'Canadian Dollar' },
  AUD: { symbol: 'A$', code: 'AUD', label: 'Australian Dollar' },
  SGD: { symbol: 'S$', code: 'SGD', label: 'Singapore Dollar' }
};

let currentCurrency = CURRENCIES.INR;

// Presets Data (in USD base, scaled automatically by currency rate)
// Conversion rates relative to USD (approximate benchmarks)
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

let activePresetKey = null;

// Initial Calculation results state
let calculatedResults = {};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Check for shared URL parameters first
  decodeShareLink();
  
  // Default to Casual Dining values if inputs are completely empty
  if (!document.getElementById('foodRevInput').value) {
    applyPreset('casual_dining');
  } else {
    recalculate();
  }
});

// Update selected currency symbols on page
function updateCurrency() {
  const select = document.getElementById('currencySelect');
  const code = select.value;
  const currency = CURRENCIES[code] || CURRENCIES.INR;
  currentCurrency = currency;

  // Update symbols
  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = currency.symbol;
  });

  recalculate();
}

// Convert preset values based on currency rates
function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;
  
  activePresetKey = presetKey;
  
  const select = document.getElementById('currencySelect');
  const currencyCode = select.value;
  const rate = CONVERSION_RATES[currencyCode] || 1.0;

  // Set values
  document.getElementById('foodRevInput').value = Math.round(preset.revenueFood * rate);
  document.getElementById('bevRevInput').value = Math.round(preset.revenueBeverage * rate);
  document.getElementById('otherRevInput').value = Math.round(preset.revenueOther * rate);
  
  document.getElementById('cogsInput').value = Math.round(preset.cogs * rate);
  document.getElementById('laborInput').value = Math.round(preset.labor * rate);
  document.getElementById('rentInput').value = Math.round(preset.rent * rate);
  document.getElementById('utilsInput').value = Math.round(preset.utilities * rate);
  document.getElementById('mktgInput').value = Math.round(preset.marketing * rate);
  document.getElementById('repairsInput').value = Math.round(preset.repairs * rate);
  document.getElementById('licensesInput').value = Math.round(preset.licenses * rate);
  document.getElementById('otherExpInput').value = Math.round(preset.other * rate);

  // Set active class on preset button
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('border-brand', 'ring-2', 'ring-brand/20', 'bg-orange-50/10');
  });
  
  // Add highlight to selected preset button
  const presetButtons = document.querySelectorAll('.preset-btn');
  const presetKeys = Object.keys(PRESETS);
  const idx = presetKeys.indexOf(presetKey);
  if (idx !== -1 && presetButtons[idx]) {
    presetButtons[idx].classList.add('border-brand', 'ring-2', 'ring-brand/20', 'bg-orange-50/10');
  }

  recalculate();
}

// Collapsible helper
function toggleCollapsible(sectionId) {
  const el = document.getElementById(sectionId);
  const chevron = document.getElementById('whatIfChevron');
  if (el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    chevron.style.transform = 'rotate(180deg)';
  } else {
    el.classList.add('hidden');
    chevron.style.transform = 'rotate(0deg)';
  }
}

// MAIN CALCULATOR LOGIC
function recalculate() {
  const foodRev = parseFloat(document.getElementById('foodRevInput').value) || 0;
  const bevRev = parseFloat(document.getElementById('bevRevInput').value) || 0;
  const otherRev = parseFloat(document.getElementById('otherRevInput').value) || 0;
  const totalRevenue = foodRev + bevRev + otherRev;

  const cogs = parseFloat(document.getElementById('cogsInput').value) || 0;
  const labor = parseFloat(document.getElementById('laborInput').value) || 0;
  const rent = parseFloat(document.getElementById('rentInput').value) || 0;
  const utilities = parseFloat(document.getElementById('utilsInput').value) || 0;
  const marketing = parseFloat(document.getElementById('mktgInput').value) || 0;
  const repairs = parseFloat(document.getElementById('repairsInput').value) || 0;
  const licenses = parseFloat(document.getElementById('licensesInput').value) || 0;
  const other = parseFloat(document.getElementById('otherExpInput').value) || 0;
  
  const totalExpenses = cogs + labor + rent + utilities + marketing + repairs + licenses + other;

  const grossProfit = totalRevenue - cogs;
  const netProfit = totalRevenue - totalExpenses;

  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const primeCost = cogs + labor;
  const primeCostPct = totalRevenue > 0 ? (primeCost / totalRevenue) * 100 : 0;

  const ebitda = netProfit; 
  const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;

  // Break-even
  const fixedCosts = rent + utilities + licenses + repairs;
  const variableCost = cogs + labor + marketing + other;
  const variableCostPct = totalRevenue > 0 ? (variableCost / totalRevenue) : 0;
  const contributionMarginRatio = 1 - variableCostPct;
  const breakEven = contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : 0;

  // Period multiplier for annualized metrics
  const period = document.getElementById('periodSelect').value;
  const multiplier = period === 'daily' ? 365 : period === 'weekly' ? 52 : period === 'monthly' ? 12 : 1;
  const annualRevenue = totalRevenue * multiplier;
  const annualNetProfit = netProfit * multiplier;

  // Save results globally
  calculatedResults = {
    totalRevenue, totalExpenses, grossProfit, netProfit, grossMargin, netMargin,
    primeCost, primeCostPct, ebitda, ebitdaMargin, breakEven,
    annualRevenue, annualNetProfit, multiplier,
    cogs, labor, rent, utilities, marketing, repairs, licenses, other
  };

  // Update percentages of revenue dynamically next to input fields
  updateInputPercentages(totalRevenue, cogs, labor, rent, utilities, marketing, repairs, licenses, other);

  // Update UI outputs
  const sym = currentCurrency.symbol;
  document.getElementById('lblTotalRevenue').textContent = formatCurrency(totalRevenue, sym);
  document.getElementById('lblTotalExpenses').textContent = formatCurrency(totalExpenses, sym);

  // 1. Gross Profit Margin Card
  document.getElementById('lblGrossMargin').textContent = grossMargin.toFixed(1) + '%';
  document.getElementById('lblGrossAmount').textContent = formatCurrency(grossProfit, sym);
  updateBadge('badgeGross', grossMargin, 60, 68, true);

  // 2. Net Profit Margin Card
  document.getElementById('lblNetMargin').textContent = netMargin.toFixed(1) + '%';
  document.getElementById('lblNetAmount').textContent = formatCurrency(netProfit, sym);
  document.getElementById('lblAnnualNetAmount').textContent = formatCurrency(annualNetProfit, sym);
  updateBadge('badgeNet', netMargin, 3, 9, true);

  // 3. Prime Cost Card
  document.getElementById('lblPrimeCostPct').textContent = primeCostPct.toFixed(1) + '%';
  document.getElementById('lblPrimeCostAmount').textContent = formatCurrency(primeCost, sym);
  updateBadge('badgePrime', primeCostPct, 60, 65, false);

  // 4. EBITDA Card
  document.getElementById('lblEbitdaAmount').textContent = formatCurrency(ebitda, sym);
  document.getElementById('lblEbitdaMargin').textContent = `(${ebitdaMargin.toFixed(1)}% margin)`;

  // 5. Break-Even Card
  document.getElementById('lblBreakEvenMonth').textContent = formatCurrency(breakEven, sym);
  document.getElementById('lblBreakEvenDay').textContent = formatCurrency(breakEven / 30, sym);

  // Update Net Margin Position Gauge and description text
  updateGauge(netMargin);

  // Render SVG charts
  renderDonutChart(cogs, labor, rent, utilities, marketing, repairs, licenses, other, netProfit, totalRevenue);
  renderWaterfallChart(totalRevenue, cogs, labor, rent, utilities, marketing, repairs, licenses, other, netProfit);

  // Calculate simulated what-if updates
  onWhatIfChange();
}

// Format currency values nicely
function formatCurrency(amount, sym) {
  if (amount === 0) return `${sym}0.00`;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update input percentage labels and apply red/yellow/green alerts
function updateInputPercentages(revenue, cogs, labor, rent, utilities, marketing, repairs, licenses, other) {
  const setPercentageText = (elementId, value) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (revenue === 0) {
      el.textContent = '0.0%';
      el.className = 'text-[10px] font-extrabold text-gray-400';
      return;
    }
    const pct = (value / revenue) * 100;
    el.textContent = pct.toFixed(1) + '%';

    // Color code guidelines
    let colorClass = 'text-emerald-500';
    if (elementId === 'pctCOGS') {
      if (pct > 38) colorClass = 'text-rose-500';
      else if (pct > 32) colorClass = 'text-amber-500';
    } else if (elementId === 'pctLabor') {
      if (pct > 36) colorClass = 'text-rose-500';
      else if (pct > 30) colorClass = 'text-amber-500';
    } else if (elementId === 'pctRent') {
      if (pct > 12) colorClass = 'text-rose-500';
      else if (pct > 8) colorClass = 'text-amber-500';
    } else {
      colorClass = 'text-gray-400'; // Default gray for smaller overheads
    }
    el.className = `text-[10px] font-extrabold ${colorClass}`;
  };

  setPercentageText('pctCOGS', cogs);
  setPercentageText('pctLabor', labor);
  setPercentageText('pctRent', rent);
  setPercentageText('pctUtils', utilities);
  setPercentageText('pctMktg', marketing);
  setPercentageText('pctRepairs', repairs);
  setPercentageText('pctLicenses', licenses);
  setPercentageText('pctOther', other);
}

// Update color badges for gross profit, net margin, and prime costs
function updateBadge(badgeId, value, lowerLimit, upperLimit, higherIsBetter) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  
  if (calculatedResults.totalRevenue === 0) {
    el.textContent = 'No Data';
    el.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600';
    return;
  }

  let state = 'good'; // 'good', 'warning', 'critical'
  if (higherIsBetter) {
    if (value < lowerLimit) state = 'critical';
    else if (value < upperLimit) state = 'warning';
  } else {
    if (value > upperLimit) state = 'critical';
    else if (value > lowerLimit) state = 'warning';
  }

  if (state === 'good') {
    el.textContent = 'Healthy';
    el.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-600';
  } else if (state === 'warning') {
    el.textContent = 'Borderline';
    el.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-600';
  } else {
    el.textContent = 'Critical';
    el.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-600';
  }
}

// Update Net Margin Position Gauge
function updateGauge(margin) {
  const marker = document.getElementById('gaugeMarker');
  const verdict = document.getElementById('lblGaugeVerdict');
  const desc = document.getElementById('lblGaugeDesc');
  const marginLabel = document.getElementById('lblNetMarginPos');
  
  marginLabel.textContent = margin.toFixed(1) + '%';
  
  if (calculatedResults.totalRevenue === 0) {
    marker.style.left = '0%';
    verdict.textContent = 'Enter numbers to view positioning';
    desc.textContent = 'Fill food sales, beverage sales, COGS, and labor cost to get a contextual diagnosis of your operational performance.';
    return;
  }

  // Map margin range -5% to 20% to a 0% to 100% slider width
  let pct = ((margin + 5) / 25) * 100;
  pct = Math.max(0, Math.min(100, pct));
  marker.style.left = `${pct}%`;

  if (margin < 0) {
    verdict.textContent = '🔴 Losing (Below 0%): Action Needed Immediately';
    desc.textContent = 'You are spending more than you earn. Review food waste, trim scheduling down to match peak hours, and check recipe markups today.';
  } else if (margin <= 3) {
    verdict.textContent = '🟡 Marginal (0–3%): Extremely Thin';
    desc.textContent = 'Very narrow buffer. A single slow weekend or emergency equipment repair can wipe out your entire month\'s profits. Consider price increases.';
  } else if (margin <= 6) {
    verdict.textContent = '🟢 Average (3–6%): Standard Industry Performers';
    desc.textContent = 'You are in line with average global restaurant margins. Focus on optimizing prime costs (under 65%) to reach the next tier.';
  } else if (margin <= 9) {
    verdict.textContent = '🟢 Good (6–9%): Above Average Operations';
    desc.textContent = 'You are running a tight ship. Menu engineering and automated self-ordering can push you into the top-performer category.';
  } else if (margin <= 15) {
    verdict.textContent = '✨ Excellent (9–15%): Top Industry Performer';
    desc.textContent = 'Highly profitable operation. You have real pricing power and optimized payroll. Excellent management!';
  } else {
    verdict.textContent = '🏆 World-Class (15%+): Exceptional Operations';
    desc.textContent = 'Outstanding operational margins! You are maximizing revenue efficiency. Maintain these costing controls to build significant capital.';
  }
}

// Render dynamic Donut SVG Chart
function renderDonutChart(cogs, labor, rent, utilities, marketing, repairs, licenses, other, profit, revenue) {
  const svg = document.getElementById('donutSvg');
  const legend = document.getElementById('donutLegend');
  if (!svg || !legend) return;

  svg.innerHTML = '';
  legend.innerHTML = '';

  if (revenue === 0) {
    svg.innerHTML = `<circle cx="110" cy="110" r="70" fill="transparent" stroke="#E5E7EB" stroke-width="28" />
                     <text x="110" y="115" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#9CA3AF" font-weight="bold" transform="rotate(90 110 110)">No Data</text>`;
    return;
  }

  const items = [
    { label: 'COGS', value: cogs, color: '#F87171' },
    { label: 'Labor', value: labor, color: '#60A5FA' },
    { label: 'Rent', value: rent, color: '#34D399' },
    { label: 'Utilities', value: utilities, color: '#FBBF24' },
    { label: 'Marketing', value: marketing, color: '#A78BFA' },
    { label: 'Other Overhead', value: repairs + licenses + other, color: '#9CA3AF' }
  ];

  if (profit > 0) {
    items.push({ label: 'Net Profit', value: profit, color: '#F97316' });
  }

  const filteredItems = items.filter(x => x.value > 0);
  const total = filteredItems.reduce((sum, item) => sum + item.value, 0);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  filteredItems.forEach(item => {
    const pct = item.value / total;
    const offset = circumference - (pct * circumference);
    
    // Draw slice circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '110');
    circle.setAttribute('cy', '110');
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('fill', 'transparent');
    circle.setAttribute('stroke', item.color);
    circle.setAttribute('stroke-width', '24');
    circle.setAttribute('stroke-dasharray', `${circumference} ${circumference}`);
    circle.setAttribute('stroke-dashoffset', offset.toString());
    circle.setAttribute('transform', `rotate(${accumulatedPercent * 360} 110 110)`);
    
    // Smooth transitions
    circle.style.transition = 'stroke-dashoffset 0.5s ease-in-out';
    svg.appendChild(circle);

    // Add legend item
    const pctStr = (pct * 100).toFixed(1) + '%';
    legend.innerHTML += `<div class="flex items-center gap-1.5">
                           <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${item.color}"></span>
                           <span>${item.label} (${pctStr})</span>
                         </div>`;

    accumulatedPercent += pct;
  });

  // Inner cutout text
  const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  textGroup.setAttribute('transform', 'rotate(90 110 110)');
  
  const textTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textTitle.setAttribute('x', '110');
  textTitle.setAttribute('y', '108');
  textTitle.setAttribute('text-anchor', 'middle');
  textTitle.setAttribute('font-family', 'sans-serif');
  textTitle.setAttribute('font-size', '10');
  textTitle.setAttribute('fill', '#6B7280');
  textTitle.setAttribute('font-weight', 'semibold');
  textTitle.textContent = 'OPERATING';

  const textVal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textVal.setAttribute('x', '110');
  textVal.setAttribute('y', '122');
  textVal.setAttribute('text-anchor', 'middle');
  textVal.setAttribute('font-family', 'sans-serif');
  textVal.setAttribute('font-size', '13');
  textVal.setAttribute('fill', '#111827');
  textVal.setAttribute('font-weight', 'black');
  textVal.textContent = 'BREAKDOWN';

  textGroup.appendChild(textTitle);
  textGroup.appendChild(textVal);
  svg.appendChild(textGroup);
}

// Render dynamic Waterfall Chart
function renderWaterfallChart(revenue, cogs, labor, rent, utilities, marketing, repairs, licenses, other, profit) {
  const wrapper = document.getElementById('waterfallWrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '';

  if (revenue === 0) {
    wrapper.innerHTML = `<div class="text-center text-xs text-gray-400 font-semibold py-8">Enter revenue details to view waterfall model</div>`;
    return;
  }

  const items = [
    { label: 'COGS', value: cogs, pct: (cogs / revenue) * 100, color: 'bg-rose-400' },
    { label: 'Labor', value: labor, pct: (labor / revenue) * 100, color: 'bg-blue-400' },
    { label: 'Rent', value: rent, pct: (rent / revenue) * 100, color: 'bg-emerald-400' },
    { label: 'Utilities', value: utilities, pct: (utilities / revenue) * 100, color: 'bg-amber-400' },
    { label: 'Marketing', value: marketing, pct: (marketing / revenue) * 100, color: 'bg-purple-400' },
    { label: 'Overhead', value: repairs + licenses + other, pct: ((repairs + licenses + other) / revenue) * 100, color: 'bg-gray-400' }
  ];

  const sym = currentCurrency.symbol;

  // Render Revenue Base
  wrapper.innerHTML += `
    <div class="space-y-1">
      <div class="flex items-center justify-between text-[11px] font-extrabold text-gray-800">
        <span>Gross Revenue</span>
        <span>${formatCurrency(revenue, sym)} (100%)</span>
      </div>
      <div class="w-full h-4 bg-gray-100 rounded overflow-hidden">
        <div class="h-full bg-gray-800 rounded w-full"></div>
      </div>
    </div>
  `;

  // Render cost segments
  items.forEach(item => {
    if (item.value === 0) return;
    const widthPct = Math.max(2, item.pct); // Avoid invisible bars
    wrapper.innerHTML += `
      <div class="space-y-1">
        <div class="flex items-center justify-between text-[10px] text-gray-500 font-semibold">
          <span>${item.label}</span>
          <span>${formatCurrency(item.value, sym)} (${item.pct.toFixed(1)}%)</span>
        </div>
        <div class="w-full h-3 bg-gray-100/50 rounded overflow-hidden">
          <div class="h-full ${item.color} rounded" style="width: ${widthPct}%"></div>
        </div>
      </div>
    `;
  });

  // Render Net Margin segment
  const netPct = (profit / revenue) * 100;
  const profitColor = profit >= 0 ? 'bg-brand' : 'bg-rose-500';
  wrapper.innerHTML += `
    <div class="space-y-1 pt-2 border-t border-gray-100 mt-2">
      <div class="flex items-center justify-between text-[11px] font-extrabold text-gray-900">
        <span>Net Profit Margin</span>
        <span class="${profit >= 0 ? 'text-brand' : 'text-rose-500'}">${formatCurrency(profit, sym)} (${netPct.toFixed(1)}%)</span>
      </div>
      <div class="w-full h-4 bg-gray-100 rounded overflow-hidden">
        <div class="h-full ${profitColor} rounded" style="width: ${Math.max(0, Math.min(100, Math.abs(netPct)))}%"></div>
      </div>
    </div>
  `;
}

// Handle what-if scenario sliders change
function onWhatIfChange() {
  const revPct = parseFloat(document.getElementById('whatIfRevenue').value) || 0;
  const cogsPct = parseFloat(document.getElementById('whatIfCogs').value) || 0;
  const laborPct = parseFloat(document.getElementById('whatIfLabor').value) || 0;
  const rentPct = parseFloat(document.getElementById('whatIfRent').value) || 0;
  const deliveryAmt = parseFloat(document.getElementById('whatIfDelivery').value) || 0;

  // Update slider label texts
  document.getElementById('lblWhatIfRevenueVal').textContent = `+${revPct}%`;
  document.getElementById('lblWhatIfCogsVal').textContent = `-${cogsPct}%`;
  document.getElementById('lblWhatIfLaborVal').textContent = `-${laborPct}%`;
  document.getElementById('lblWhatIfRentVal').textContent = `-${rentPct}%`;
  
  const sym = currentCurrency.symbol;
  document.getElementById('lblWhatIfDeliveryVal').textContent = `${sym}${deliveryAmt.toLocaleString()}`;

  // Check if base calculations exist
  if (!calculatedResults.totalRevenue) return;

  const res = calculatedResults;
  
  const wiRevenue = res.totalRevenue * (1 + revPct / 100);
  const wiCogs = res.cogs * (1 - cogsPct / 100);
  const wiLabor = res.labor * (1 - laborPct / 100);
  const wiRent = res.rent * (1 - rentPct / 100);
  
  const wiTotalRevenue = wiRevenue + deliveryAmt;
  const wiTotalExpenses = wiCogs + wiLabor + wiRent + res.utilities + res.marketing + res.repairs + res.licenses + res.other;
  const wiNetProfit = wiTotalRevenue - wiTotalExpenses;
  const wiNetMargin = wiTotalRevenue > 0 ? (wiNetProfit / wiTotalRevenue) * 100 : 0;
  const wiProfitDelta = wiNetProfit - res.netProfit;

  // Render values
  document.getElementById('lblSimulatedMargin').textContent = wiNetMargin.toFixed(1) + '%';
  
  const deltaLabel = document.getElementById('lblSimulatedDelta');
  if (wiProfitDelta >= 0) {
    deltaLabel.textContent = `+${formatCurrency(wiProfitDelta, sym)} more profit/month`;
    deltaLabel.className = 'text-[10px] font-bold text-emerald-600 mt-0.5';
  } else {
    deltaLabel.textContent = `${formatCurrency(wiProfitDelta, sym)} less profit/month`;
    deltaLabel.className = 'text-[10px] font-bold text-rose-500 mt-0.5';
  }
}

// TRIGGER AI ANALYSIS CALL
async function triggerAiAnalysis() {
  const foodRev = parseFloat(document.getElementById('foodRevInput').value) || 0;
  const bevRev = parseFloat(document.getElementById('bevRevInput').value) || 0;
  const otherRev = parseFloat(document.getElementById('otherRevInput').value) || 0;
  const totalRevenue = foodRev + bevRev + otherRev;

  if (totalRevenue === 0) {
    alert('Please enter restaurant revenue details first!');
    return;
  }

  // Show Loading modal popup
  const loader = document.getElementById('aiLoadingOverlay');
  const bar = document.getElementById('aiLoaderProgress');
  const box = document.getElementById('aiAnalysisBox');
  
  loader.classList.remove('hidden');
  bar.style.width = '0%';
  box.classList.add('hidden');

  // Trigger loading progression animation
  let prog = 0;
  const timer = setInterval(() => {
    prog = Math.min(95, prog + (95 - prog) * 0.15);
    bar.style.width = `${prog}%`;
  }, 180);

  try {
    const payload = {
      revenue: calculatedResults.totalRevenue,
      cogs: calculatedResults.cogs,
      labor: calculatedResults.labor,
      rent: calculatedResults.rent,
      utilities: calculatedResults.utilities,
      marketing: calculatedResults.marketing,
      other: calculatedResults.repairs + calculatedResults.licenses + calculatedResults.other,
      netMargin: calculatedResults.netMargin.toFixed(1),
      grossMargin: calculatedResults.grossMargin.toFixed(1),
      primeCost: calculatedResults.primeCostPct.toFixed(1),
      ebitda: calculatedResults.ebitdaMargin.toFixed(1),
      restaurantType: activePresetKey ? PRESETS[activePresetKey].restaurantType : 'Independent',
      currency: currentCurrency.code,
      period: document.getElementById('periodSelect').value
    };

    const response = await fetch('/api/profit-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    clearInterval(timer);
    bar.style.width = '100%';
    
    setTimeout(() => {
      loader.classList.add('hidden');
      if (data.analysis) {
        box.innerHTML = `<strong>🤖 AI Consultant Verdict:</strong>\n\n${data.analysis}`;
        box.classList.remove('hidden');
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        alert('Could not generate AI analysis: ' + (data.error || 'Unknown error'));
      }
    }, 400);

  } catch (err) {
    clearInterval(timer);
    loader.classList.add('hidden');
    console.error(err);
    alert('Failed to connect to AI consultant. Please check your network and try again.');
  }
}

// 📄 EXPORT jsPDF REPORT
function getSafePdfCurrencySymbol(symbol) {
  const asciiPattern = /^[\x00-\x7F]*$/;
  if (!asciiPattern.test(symbol)) {
    if (symbol === '₹') return 'Rs. ';
    if (symbol === 'د.إ') return 'AED ';
    if (symbol === '€') return 'EUR ';
    if (symbol === '£') return 'GBP ';
    return symbol;
  }
  return symbol;
}

function loadLogoImage() {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = '/meenufy_logo_erased.png';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

async function exportReportPDF() {
  if (!calculatedResults.totalRevenue) {
    alert('Please enter calculator numbers first!');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const restName = document.getElementById('restNameInput').value || 'My Restaurant';
    const sym = currentCurrency.symbol;
    const pdfSym = getSafePdfCurrencySymbol(sym);
    const dateStr = new Date().toLocaleDateString();

    // 1. Draw header and branding
    const logoImg = await loadLogoImage();
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 152, 13, 12, 12);
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor('#111827');
      doc.text('Meenufy', 167, 21);
    }

    doc.setFontSize(22);
    doc.setTextColor('#F97316');
    doc.text('Profit Margin Report', 20, 25);

    doc.setFontSize(9);
    doc.setTextColor('#6B7280');
    doc.text(`Generated via Meenufy — meenufy.com/tools/restaurant-profit-margin-calculator`, 20, 32);

    doc.setDrawColor('#E5E7EB');
    doc.line(20, 36, 190, 36);

    // 2. Info Cards Block
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor('#1F2937');
    doc.text(`Restaurant: ${restName}`, 20, 46);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Date: ${dateStr}`, 20, 52);
    doc.text(`Period: ${document.getElementById('periodSelect').value.toUpperCase()}`, 20, 58);

    doc.setFillColor('#FFF7ED');
    doc.rect(20, 66, 170, 34, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor('#EA580C');
    doc.text('KEY OUTCOMES SUMMARY:', 26, 73);

    doc.setFontSize(10);
    doc.setTextColor('#111827');
    doc.text(`Total Revenue: ${pdfSym}${calculatedResults.totalRevenue.toLocaleString()}`, 26, 81);
    doc.text(`Total Costs:   ${pdfSym}${calculatedResults.totalExpenses.toLocaleString()}`, 26, 87);
    doc.text(`Prime Cost %:  ${calculatedResults.primeCostPct.toFixed(1)}%`, 26, 93);
    
    doc.text(`Gross Margin:  ${calculatedResults.grossMargin.toFixed(1)}%`, 110, 81);
    doc.text(`Net Margin:    ${calculatedResults.netMargin.toFixed(1)}%`, 110, 87);
    doc.text(`EBITDA Margin: ${calculatedResults.ebitdaMargin.toFixed(1)}%`, 110, 93);

    // 3. P&L breakdown table
    const tableData = [
      ['Gross Food Sales', `${pdfSym}${(parseFloat(document.getElementById('foodRevInput').value) || 0).toLocaleString()}`, '100%'],
      ['Gross Beverage Sales', `${pdfSym}${(parseFloat(document.getElementById('bevRevInput').value) || 0).toLocaleString()}`, '—'],
      ['Other Income', `${pdfSym}${(parseFloat(document.getElementById('otherRevInput').value) || 0).toLocaleString()}`, '—'],
      ['Total Operating Revenue', `${pdfSym}${calculatedResults.totalRevenue.toLocaleString()}`, '100.0%'],
      ['Food & Beverage Cost (COGS)', `${pdfSym}${calculatedResults.cogs.toLocaleString()}`, `${calculatedResults.cogsPct.toFixed(1)}%`],
      ['Labor Cost (Payroll & staff)', `${pdfSym}${calculatedResults.labor.toLocaleString()}`, `${calculatedResults.laborPct.toFixed(1)}%`],
      ['Rent & Lease', `${pdfSym}${calculatedResults.rent.toLocaleString()}`, `${calculatedResults.rentPct.toFixed(1)}%`],
      ['Utilities', `${pdfSym}${calculatedResults.utilities.toLocaleString()}`, `${(calculatedResults.utilities / calculatedResults.totalRevenue * 100).toFixed(1)}%`],
      ['Marketing', `${pdfSym}${calculatedResults.marketing.toLocaleString()}`, `${(calculatedResults.marketing / calculatedResults.totalRevenue * 100).toFixed(1)}%`],
      ['Repairs, Licenses & Admin', `${pdfSym}${(calculatedResults.repairs + calculatedResults.licenses).toLocaleString()}`, `${((calculatedResults.repairs + calculatedResults.licenses) / calculatedResults.totalRevenue * 100).toFixed(1)}%`],
      ['Other Expenses', `${pdfSym}${calculatedResults.other.toLocaleString()}`, `${(calculatedResults.other / calculatedResults.totalRevenue * 100).toFixed(1)}%`],
      ['Net Profit', `${pdfSym}${calculatedResults.netProfit.toLocaleString()}`, `${calculatedResults.netMargin.toFixed(1)}%`]
    ];

    doc.autoTable({
      startY: 110,
      head: [['Expense Item / Revenue', 'Amount', '% of Revenue']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 }
    });

    // 4. AI analysis insertion (if any)
    const box = document.getElementById('aiAnalysisBox');
    if (box && !box.classList.contains('hidden')) {
      const text = box.innerText.replace('🤖 AI Consultant Verdict:', '').trim();
      doc.addPage();
      
      // Page 2 header
      if (logoImg) {
        doc.addImage(logoImg, 'PNG', 152, 13, 12, 12);
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor('#111827');
        doc.text('Meenufy', 167, 21);
      }
      doc.setFontSize(16);
      doc.setTextColor('#F97316');
      doc.text('AI Consultant Financial Analysis', 20, 25);
      doc.setDrawColor('#E5E7EB');
      doc.line(20, 32, 190, 32);

      doc.setFontSize(10);
      doc.setTextColor('#374151');
      doc.setFont('Helvetica', 'normal');
      
      const splitText = doc.splitTextToSize(text, 170);
      doc.text(splitText, 20, 44);
    }

    doc.save(`${restName.replace(/\s+/g, '_')}_Profit_Margin_Report.pdf`);
  } catch (err) {
    console.error(err);
    alert('Failed to export PDF. Please verify your inputs and try again.');
  }
}

// 📋 COPY RESULTS TO CLIPBOARD
function copyToClipboardText() {
  if (!calculatedResults.totalRevenue) return;
  const res = calculatedResults;
  const sym = currentCurrency.symbol;
  
  const text = `Meenufy Restaurant Profit Margin Report
--------------------------------------
Restaurant: ${document.getElementById('restNameInput').value || 'Unspecified'}
Time Period: ${document.getElementById('periodSelect').value.toUpperCase()}
Currency: ${currentCurrency.code}

REVENUE SUMMARY:
- Total Revenue: ${formatCurrency(res.totalRevenue, sym)}
- Total Operating Costs: ${formatCurrency(res.totalExpenses, sym)}

PROFIT MARGINS:
- Gross Profit Margin: ${res.grossMargin.toFixed(1)}% (${formatCurrency(res.grossProfit, sym)})
- Net Profit Margin: ${res.netMargin.toFixed(1)}% (${formatCurrency(res.netProfit, sym)})
- Prime Cost: ${res.primeCostPct.toFixed(1)}% (${formatCurrency(res.primeCost, sym)})
- EBITDA Margin: ${res.ebitdaMargin.toFixed(1)}% (${formatCurrency(res.ebitda, sym)})
- Break-Even Sales: ${formatCurrency(res.breakEven, sym)}/month

Optimise margins with QR self-ordering by Meenufy — meenufy.com
`;

  navigator.clipboard.writeText(text).then(() => {
    alert('📋 Results copied to clipboard successfully!');
  }).catch(() => {
    alert('Failed to copy to clipboard.');
  });
}

// 📊 COPY EXCEL (TSV)
function copyToExcelTsv() {
  if (!calculatedResults.totalRevenue) return;
  const res = calculatedResults;
  const sym = currentCurrency.symbol;

  const rows = [
    ['Metric / Input', 'Value', '% of Revenue'],
    ['Total Food Revenue', (parseFloat(document.getElementById('foodRevInput').value) || 0), '—'],
    ['Total Beverage Revenue', (parseFloat(document.getElementById('bevRevInput').value) || 0), '—'],
    ['Other Income', (parseFloat(document.getElementById('otherRevInput').value) || 0), '—'],
    ['Total Operating Revenue', res.totalRevenue, '100%'],
    ['Food Cost (COGS)', res.cogs, `${res.cogsPct.toFixed(1)}%`],
    ['Labor Cost', res.labor, `${res.laborPct.toFixed(1)}%`],
    ['Rent & Lease', res.rent, `${res.rentPct.toFixed(1)}%`],
    ['Utilities', res.utilities, `${(res.utilities / res.totalRevenue * 100).toFixed(1)}%`],
    ['Marketing', res.marketing, `${(res.marketing / res.totalRevenue * 100).toFixed(1)}%`],
    ['Repairs & Maintenance', res.repairs, `${(res.repairs / res.totalRevenue * 100).toFixed(1)}%`],
    ['Licenses & Insurance', res.licenses, `${(res.licenses / res.totalRevenue * 100).toFixed(1)}%`],
    ['Other Expenses', res.other, `${(res.other / res.totalRevenue * 100).toFixed(1)}%`],
    ['Gross profit', res.grossProfit, `${res.grossMargin.toFixed(1)}%`],
    ['Net Profit', res.netProfit, `${res.netMargin.toFixed(1)}%`],
    ['Prime Cost', res.primeCost, `${res.primeCostPct.toFixed(1)}%`],
    ['EBITDA', res.ebitda, `${res.ebitdaMargin.toFixed(1)}%`],
    ['Monthly Break-Even Point', res.breakEven, '—']
  ];

  const tsvContent = rows.map(r => r.join('\t')).join('\n');
  navigator.clipboard.writeText(tsvContent).then(() => {
    alert('📊 Data formatted as Excel TSV and copied successfully! Paste directly in Excel or Sheets.');
  }).catch(() => {
    alert('Failed to copy Excel data.');
  });
}

// 🔗 SHARE URL WITH STATE
function shareLink() {
  const foodRev = document.getElementById('foodRevInput').value || '0';
  const bevRev = document.getElementById('bevRevInput').value || '0';
  const otherRev = document.getElementById('otherRevInput').value || '0';
  const cogs = document.getElementById('cogsInput').value || '0';
  const labor = document.getElementById('laborInput').value || '0';
  const rent = document.getElementById('rentInput').value || '0';
  const utils = document.getElementById('utilsInput').value || '0';
  const mktg = document.getElementById('mktgInput').value || '0';
  const repairs = document.getElementById('repairsInput').value || '0';
  const licenses = document.getElementById('licensesInput').value || '0';
  const other = document.getElementById('otherExpInput').value || '0';
  
  const payload = [
    currentCurrency.code,
    document.getElementById('periodSelect').value,
    foodRev, bevRev, otherRev,
    cogs, labor, rent, utils, mktg, repairs, licenses, other,
    document.getElementById('restNameInput').value || ''
  ];

  const serialized = btoa(encodeURIComponent(JSON.stringify(payload)));
  const shareUrl = `${window.location.origin}/tools/restaurant-profit-margin-calculator/?d=${serialized}`;

  navigator.clipboard.writeText(shareUrl).then(() => {
    alert('🔗 Shareable URL copied to clipboard! Anyone with this link can view these numbers.');
  }).catch(() => {
    alert('Failed to copy share link.');
  });
}

function decodeShareLink() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('d');
  if (!data) return;

  try {
    const parsed = JSON.parse(decodeURIComponent(atob(data)));
    if (Array.isArray(parsed) && parsed.length >= 13) {
      const code = parsed[0];
      const select = document.getElementById('currencySelect');
      select.value = code;
      currentCurrency = CURRENCIES[code] || CURRENCIES.INR;

      document.getElementById('periodSelect').value = parsed[1];
      document.getElementById('foodRevInput').value = parsed[2] === '0' ? '' : parsed[2];
      document.getElementById('bevRevInput').value = parsed[3] === '0' ? '' : parsed[3];
      document.getElementById('otherRevInput').value = parsed[4] === '0' ? '' : parsed[4];
      document.getElementById('cogsInput').value = parsed[5] === '0' ? '' : parsed[5];
      document.getElementById('laborInput').value = parsed[6] === '0' ? '' : parsed[6];
      document.getElementById('rentInput').value = parsed[7] === '0' ? '' : parsed[7];
      document.getElementById('utilsInput').value = parsed[8] === '0' ? '' : parsed[8];
      document.getElementById('mktgInput').value = parsed[9] === '0' ? '' : parsed[9];
      document.getElementById('repairsInput').value = parsed[10] === '0' ? '' : parsed[10];
      document.getElementById('licensesInput').value = parsed[11] === '0' ? '' : parsed[11];
      document.getElementById('otherExpInput').value = parsed[12] === '0' ? '' : parsed[12];
      
      if (parsed[13]) {
        document.getElementById('restNameInput').value = parsed[13];
      }
    }
  } catch (err) {
    console.error('Failed to parse decoded URL state:', err);
  }
}
