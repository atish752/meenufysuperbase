// ============================================================
// MEENUFY FOOD COST CALCULATOR — Core App Controller
// ============================================================

const CURRENCIES = [
  { symbol: '₹', code: 'INR', label: 'Indian Rupee' },
  { symbol: '$', code: 'USD', label: 'US Dollar' },
  { symbol: '£', code: 'GBP', label: 'British Pound' },
  { symbol: '€', code: 'EUR', label: 'Euro' },
  { symbol: '₨', code: 'PKR', label: 'Pakistani Rupee' },
  { symbol: 'د.إ', code: 'AED', label: 'UAE Dirham' },
  { symbol: 'CA$', code: 'CAD', label: 'Canadian Dollar' },
  { symbol: 'A$', code: 'AUD', label: 'Australian Dollar' },
  { symbol: '¥', code: 'JPY', label: 'Japanese Yen' },
  { symbol: '¥', code: 'CNY', label: 'Chinese Yuan' },
  { symbol: 'R', code: 'ZAR', label: 'South African Rand' },
  { symbol: '৳', code: 'BDT', label: 'Bangladeshi Taka' },
  { symbol: 'RM', code: 'MYR', label: 'Malaysian Ringgit' },
  { symbol: '₦', code: 'NGN', label: 'Nigerian Naira' },
  { symbol: 'kr', code: 'SEK', label: 'Swedish Krona' },
  { symbol: 'CHF', code: 'CHF', label: 'Swiss Franc' },
  { symbol: 'S$', code: 'SGD', label: 'Singapore Dollar' },
  { symbol: '﷼', code: 'SAR', label: 'Saudi Riyal' },
  { symbol: 'KD', code: 'KWD', label: 'Kuwaiti Dinar' },
  { symbol: '฿', code: 'THB', label: 'Thai Baht' },
  { symbol: '₫', code: 'VND', label: 'Vietnamese Dong' },
  { symbol: '₱', code: 'PHP', label: 'Philippine Peso' },
  { symbol: 'Rp', code: 'IDR', label: 'Indonesian Rupiah' },
  { symbol: 'KSh', code: 'KES', label: 'Kenyan Shilling' },
  { symbol: 'GH₵', code: 'GHS', label: 'Ghanaian Cedi' },
  { symbol: 'R$', code: 'BRL', label: 'Brazilian Real' },
  { symbol: '$', code: 'MXN', label: 'Mexican Peso' },
  { symbol: 'NZ$', code: 'NZD', label: 'New Zealand Dollar' }
];

const UNIT_CONVERSIONS = {
  'kg': { 'g': 1000, 'kg': 1, 'lb': 2.20462, 'oz': 35.274 },
  'g': { 'g': 1, 'kg': 0.001, 'lb': 0.00220462, 'oz': 0.035274 },
  'lb': { 'lb': 1, 'oz': 16, 'kg': 0.453592, 'g': 453.592 },
  'oz': { 'oz': 1, 'lb': 0.0625, 'kg': 0.0283495, 'g': 28.3495 },
  
  'L': { 'L': 1, 'ml': 1000, 'cup': 4.22675, 'tbsp': 67.628, 'tsp': 202.884 },
  'ml': { 'ml': 1, 'L': 0.001, 'cup': 0.00422675, 'tbsp': 0.067628, 'tsp': 0.202884 },
  'cup': { 'cup': 1, 'ml': 236.588, 'L': 0.236588, 'tbsp': 16, 'tsp': 48 },
  'tbsp': { 'tbsp': 1, 'ml': 14.7868, 'L': 0.0147868, 'tsp': 3, 'cup': 0.0625 },
  'tsp': { 'tsp': 1, 'ml': 4.92892, 'L': 0.00492892, 'tbsp': 0.333333 },
  
  'piece': { 'piece': 1 },
  'dozen': { 'dozen': 1, 'piece': 12 },
  'slice': { 'slice': 1 },
  'bunch': { 'bunch': 1 },
  'head': { 'head': 1 },
  'clove': { 'clove': 1 },
  'loaf': { 'loaf': 1, 'slice': 20 },
};

// State
let currentMode = 'recipe';
let currentCurrency = CURRENCIES[0];
let currentPeriod = 'Week';
let cachedKeys = null;

const getNewId = () => Date.now() + Math.random().toString(36).substring(2, 7);

// Default to blank/zero values on startup as requested
let ingredients = [
  { id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
  { id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
  { id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 }
];

// Toast notification helper
function showToast(msg) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

// Convert units correctly (resolved factor division bug)
function getIngredientCost(ing) {
  const buyPrice = parseFloat(ing.buyPrice) || 0;
  const qtyUsed = parseFloat(ing.qtyUsed) || 0;
  const buyUnit = ing.buyUnit;
  const useUnit = ing.useUnit;
  const wastagePercent = parseFloat(ing.wastagePercent) || 0;

  let factor = 1;
  if (UNIT_CONVERSIONS[useUnit] && UNIT_CONVERSIONS[useUnit][buyUnit] !== undefined) {
    factor = UNIT_CONVERSIONS[useUnit][buyUnit];
  } else if (UNIT_CONVERSIONS[buyUnit] && UNIT_CONVERSIONS[buyUnit][useUnit] !== undefined) {
    factor = 1 / UNIT_CONVERSIONS[buyUnit][useUnit];
  }

  const qtyInBuy = qtyUsed * factor;
  const rawCost = buyPrice * qtyInBuy;
  const wastageMultiplier = wastagePercent > 0 ? (1 / (1 - (wastagePercent / 100))) : 1;

  return rawCost * wastageMultiplier;
}

// Render dynamic rows
function renderIngredientRows() {
  const tbody = document.getElementById('ingredientsBody');
  tbody.innerHTML = '';

  ingredients.forEach(ing => {
    const tr = document.createElement('tr');
    tr.dataset.id = ing.id;
    
    const buyUnitOptions = Object.keys(UNIT_CONVERSIONS).map(u => 
      `<option value="${u}" ${ing.buyUnit === u ? 'selected' : ''}>${u}</option>`
    ).join('');

    const useUnitOptions = Object.keys(UNIT_CONVERSIONS).map(u => 
      `<option value="${u}" ${ing.useUnit === u ? 'selected' : ''}>${u}</option>`
    ).join('');

    tr.innerHTML = `
      <td class="py-2 pr-4">
        <input type="text" class="ing-name w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-sm outline-none focus:border-brand" placeholder="e.g. Flour" value="${ing.name || ''}" />
      </td>
      <td class="py-2 px-2">
        <input type="number" class="ing-buyPrice w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-brand" placeholder="0" value="${ing.buyPrice !== undefined ? ing.buyPrice : ''}" />
      </td>
      <td class="py-2 px-2">
        <select class="ing-buyUnit w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-brand">${buyUnitOptions}</select>
      </td>
      <td class="py-2 px-2">
        <input type="number" class="ing-qtyUsed w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-brand" placeholder="0" value="${ing.qtyUsed !== undefined ? ing.qtyUsed : ''}" />
      </td>
      <td class="py-2 px-2">
        <select class="ing-useUnit w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-brand">${useUnitOptions}</select>
      </td>
      <td class="py-2 px-2">
        <input type="number" class="ing-wastage w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-brand" placeholder="0" value="${ing.wastagePercent !== undefined ? ing.wastagePercent : 0}" />
      </td>
      <td class="py-2 pl-4 text-right">
        <button class="delete-row-btn text-red-500 hover:text-red-700 text-lg font-bold p-1">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind Listeners
  tbody.querySelectorAll('tr').forEach(tr => {
    const id = tr.dataset.id;
    
    tr.querySelector('.ing-name').addEventListener('input', (e) => {
      updateIngField(id, 'name', e.target.value);
    });
    tr.querySelector('.ing-buyPrice').addEventListener('input', (e) => {
      updateIngField(id, 'buyPrice', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0));
    });
    tr.querySelector('.ing-qtyUsed').addEventListener('input', (e) => {
      updateIngField(id, 'qtyUsed', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0));
    });
    tr.querySelector('.ing-wastage').addEventListener('input', (e) => {
      updateIngField(id, 'wastagePercent', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0));
    });
    tr.querySelector('.ing-buyUnit').addEventListener('change', (e) => {
      updateIngField(id, 'buyUnit', e.target.value);
    });
    tr.querySelector('.ing-useUnit').addEventListener('change', (e) => {
      updateIngField(id, 'useUnit', e.target.value);
    });
    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
      deleteIngredientRow(id);
    });
  });
}

function updateIngField(id, key, val) {
  const ing = ingredients.find(i => i.id === id);
  if (ing) {
    ing[key] = val;
    calculateAndRender();
  }
}

function deleteIngredientRow(id) {
  if (ingredients.length === 1) {
    showToast('⚠️ Minimum 1 ingredient required!');
    return;
  }
  ingredients = ingredients.filter(i => i.id !== id);
  renderIngredientRows();
  calculateAndRender();
}

function addIngredientRow() {
  ingredients.push({ id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 });
  renderIngredientRows();
  calculateAndRender();
}

// Perform calculations and update DOM elements
function calculateAndRender() {
  const sym = currentCurrency.symbol;

  if (currentMode === 'recipe') {
    const portions = parseFloat(document.getElementById('portionsInput').value) || 1;
    const targetPct = parseFloat(document.getElementById('targetCostInput').value) || 30;
    const sellPrice = parseFloat(document.getElementById('sellingPriceInput').value) || 0;

    let totalIngredientCost = 0;
    ingredients.forEach(ing => {
      totalIngredientCost += getIngredientCost(ing);
    });

    const costPerPortion = totalIngredientCost / portions;
    const actualCostPct = sellPrice > 0 ? (costPerPortion / sellPrice) * 100 : null;
    const recPrice = targetPct > 0 ? costPerPortion / (targetPct / 100) : null;
    const grossProfit = sellPrice > 0 ? sellPrice - costPerPortion : null;

    // Render results
    document.getElementById('costPerPortionVal').innerText = `${sym}${costPerPortion.toFixed(2)}`;
    document.getElementById('actualCostPctVal').innerText = actualCostPct !== null ? `${actualCostPct.toFixed(1)}%` : 'N/A';
    document.getElementById('recommendedPriceVal').innerText = recPrice !== null ? `${sym}${recPrice.toFixed(2)}` : 'N/A';
    document.getElementById('grossProfitVal').innerText = grossProfit !== null ? `${sym}${grossProfit.toFixed(2)}` : 'N/A';

    updateBenchmarkGauge(actualCostPct);
    updateWhatIfSliders(costPerPortion, sellPrice, targetPct);

  } else {
    const beg = parseFloat(document.getElementById('begInventoryInput').value) || 0;
    const pur = parseFloat(document.getElementById('purchasesInput').value) || 0;
    const end = parseFloat(document.getElementById('endingInventoryInput').value) || 0;
    const sales = parseFloat(document.getElementById('totalSalesInput').value) || 0;

    const cogs = beg + pur - end;
    const foodCostPercent = sales > 0 ? (cogs / sales) * 100 : null;
    const grossProfit = sales - cogs;

    document.getElementById('cogsVal').innerText = `${sym}${cogs.toFixed(2)}`;
    document.getElementById('overallCostPctVal').innerText = foodCostPercent !== null ? `${foodCostPercent.toFixed(1)}%` : 'N/A';
    document.getElementById('overallGrossProfitVal').innerText = `${sym}${grossProfit.toFixed(2)}`;

    updateBenchmarkGauge(foodCostPercent);
  }
}

// Update the speedometer gauge
function updateBenchmarkGauge(pct) {
  const bar = document.getElementById('benchmarkBar');
  const label = document.getElementById('benchmarkCostPct');
  const status = document.getElementById('benchmarkStatusLabel');

  if (pct === null || pct === undefined || isNaN(pct) || pct === 0) {
    bar.style.width = '0%';
    bar.className = 'h-full bg-gray-200';
    label.innerText = 'N/A';
    label.className = 'text-gray-500';
    status.innerText = 'Enter details to verify benchmark';
    return;
  }

  label.innerText = `${pct.toFixed(1)}%`;
  const cappedPct = Math.min(100, Math.max(0, pct));
  bar.style.width = `${cappedPct}%`;

  if (pct < 25) {
    bar.className = 'h-full bg-blue-600';
    label.className = 'text-blue-600 font-bold';
    status.innerText = 'Excellent (Below 25%): Premium pricing power';
  } else if (pct <= 35) {
    bar.className = 'h-full bg-green-600';
    label.className = 'text-green-600 font-bold';
    status.innerText = 'Healthy (25–35%): Industry standard';
  } else if (pct <= 40) {
    bar.className = 'h-full bg-yellow-500';
    label.className = 'text-yellow-600 font-bold';
    status.innerText = 'Warning (35–40%): Review ingredient costs';
  } else {
    bar.className = 'h-full bg-red-600';
    label.className = 'text-red-600 font-bold';
    status.innerText = 'Critical (40%+): Losing money per dish';
  }
}

// Update what-if sliders
function updateWhatIfSliders(costPerPortion, currentPrice, targetPct) {
  const priceSlider = document.getElementById('priceSlider');
  const costSlider = document.getElementById('costSlider');
  const priceLabel = document.getElementById('whatIfPriceLabel');
  const costLabel = document.getElementById('whatIfCostLabel');

  const sym = currentCurrency.symbol;

  const minVal = Math.round(costPerPortion);
  const maxVal = Math.round(costPerPortion * 5) || 500;
  
  priceSlider.min = minVal;
  priceSlider.max = maxVal;

  const sliderPrice = parseFloat(priceSlider.value) || Math.round(currentPrice || costPerPortion / (targetPct / 100));
  if (!priceSlider.value) {
    priceSlider.value = sliderPrice;
  }

  const inflationPct = parseFloat(costSlider.value) || 0;

  priceLabel.innerText = `${sym}${priceSlider.value}`;
  costLabel.innerText = `+${inflationPct}%`;

  const adjustedCost = costPerPortion * (1 + (inflationPct / 100));
  const newPrice = parseFloat(priceSlider.value) || 0;
  const newFoodCostPct = newPrice > 0 ? (adjustedCost / newPrice) * 100 : 0;
  const newGrossProfit = newPrice > 0 ? newPrice - adjustedCost : 0;

  document.getElementById('whatIfPriceOutput').innerHTML = 
    `Result: Food cost % drops to <strong>${newFoodCostPct.toFixed(1)}%</strong> (giving <strong>${sym}${newGrossProfit.toFixed(2)}</strong> gross profit per portion).`;

  const newRecPrice = adjustedCost / (targetPct / 100);
  document.getElementById('whatIfCostOutput').innerHTML = 
    `Result: Food cost % rises to <strong>${((adjustedCost / (newPrice || 1)) * 100).toFixed(1)}%</strong>. To maintain your ${targetPct}% target, selling price should be <strong>${sym}${newRecPrice.toFixed(2)}</strong>.`;
}

// Fetch super admin Gemini keys
async function getGeminiApiKeys() {
  if (cachedKeys && cachedKeys.length > 0) return cachedKeys;
  try {
    const res = await fetch('https://meenufy-default-rtdb.firebaseio.com/geminiApiKeys.json');
    if (!res.ok) throw new Error('Failed to load keys');
    const data = await res.json();
    if (Array.isArray(data)) {
      cachedKeys = data;
      return cachedKeys;
    }
  } catch (e) {
    console.error('Failed to get Gemini keys', e);
  }
  return [];
}

// Call AI generation
async function callGeminiAI(promptText) {
  const keys = await getGeminiApiKeys();
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  
  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ]
  };

  const finalKeys = keys.length > 0 ? keys : ['DEMO_KEY_PLACEHOLDER'];
  const shuffledKeys = [...finalKeys].sort(() => Math.random() - 0.5);

  for (const key of shuffledKeys) {
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );
        if (response.ok) {
          const resJson = await response.json();
          const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }
      } catch (e) {
        console.warn(`Gemini call failed with key suffix ...${key.slice(-6)} on model ${model}:`, e);
      }
    }
  }
  throw new Error('AI extraction failed. Please configure active API keys in Super Admin.');
}

// AI Autofill recipe ingredients
async function handleAIAutofill() {
  const dishName = document.getElementById('dishNameInput').value.trim();
  if (!dishName) {
    showToast('⚠️ Please enter a dish name first to use AI auto-fill!');
    return;
  }

  const btn = document.getElementById('aiAutofillBtn');
  btn.disabled = true;

  // Show overlay
  const overlay = document.getElementById('aiLoadingOverlay');
  const progressBar = document.getElementById('aiLoaderProgress');
  if (overlay) {
    overlay.classList.remove('hidden');
  }
  if (progressBar) {
    progressBar.style.width = '0%';
    // Animate progress to 90%
    setTimeout(() => {
      progressBar.style.width = '90%';
      progressBar.style.transition = 'width 10s cubic-bezier(0.1, 0.8, 0.25, 1)';
    }, 50);
  }

  const promptText = `Extract or estimate the standard recipe ingredients used to make a portion of the dish: "${dishName}".
The target pricing currency is ${currentCurrency.code}.
Return ONLY a valid JSON array of objects, with NO markdown backticks, NO markdown block, and NO other explanation text.
The JSON array should contain exactly these fields:
[
  {
    "name": "Ingredient Name",
    "buyPrice": number, // estimated purchase price in local market in ${currentCurrency.code}
    "buyUnit": "kg or L or piece or dozen",
    "qtyUsed": number, // portion size quantity
    "useUnit": "g or ml or piece"
  }
]
Estimate reasonable quantities and average local market prices.`;

  try {
    const rawText = await callGeminiAI(promptText);
    
    // Clean markdown wrap if any
    let cleanJsonStr = rawText.trim();
    if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(cleanJsonStr);
    if (Array.isArray(data) && data.length > 0) {
      // Replace ingredients state
      ingredients = data.map(item => ({
        id: getNewId(),
        name: item.name || 'Ingredient',
        buyPrice: parseFloat(item.buyPrice) || 0,
        buyUnit: item.buyUnit || 'kg',
        qtyUsed: parseFloat(item.qtyUsed) || 0,
        useUnit: item.useUnit || 'g',
        wastagePercent: 0
      }));

      renderIngredientRows();
      calculateAndRender();
      
      if (progressBar) {
        progressBar.style.transition = 'width 0.2s ease-out';
        progressBar.style.width = '100%';
      }
      setTimeout(() => {
        showToast(`✨ Recipe ingredients for "${dishName}" generated successfully using AI!`);
      }, 300);
    } else {
      throw new Error('Invalid JSON format from AI response');
    }
  } catch (e) {
    console.error(e);
    showToast('❌ AI Autofill failed. Please try again or type the details manually.');
  } finally {
    setTimeout(() => {
      if (overlay) {
        overlay.classList.add('hidden');
      }
      btn.disabled = false;
    }, 500);
  }
}

function getSafePdfCurrencySymbol(symbol) {
  if (symbol === '₹') return 'Rs.';
  const asciiPattern = /^[\x00-\x7F]*$/;
  if (!asciiPattern.test(symbol)) {
    if (symbol === '₦') return 'NGN ';
    if (symbol === '฿') return 'THB ';
    if (symbol === 'KD') return 'KWD ';
    if (symbol === 'GH₵') return 'GHS ';
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

// PDF generation using jsPDF
async function handlePDFExport() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const restName = document.getElementById('restaurantNameInput').value || 'My Restaurant';
    const sym = currentCurrency.symbol;
    const pdfSym = getSafePdfCurrencySymbol(sym);

    // Load logo
    const logoImg = await loadLogoImage();
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 152, 13, 12, 12);
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor('#111827');
      doc.text('Meenufy', 167, 21);
      doc.setFont('Helvetica', 'normal');
    }

    doc.setFontSize(22);
    doc.setTextColor('#F97316');
    doc.text('Food Cost Calculator Report', 20, 25);

    doc.setFontSize(10);
    doc.setTextColor('#6B7280');
    doc.text(`Generated by Meenufy — meenufy.com/tools/food-cost-calculator`, 20, 32);

    doc.setDrawColor('#E5E7EB');
    doc.line(20, 36, 190, 36);

    doc.setFontSize(12);
    doc.setTextColor('#111827');
    doc.text(`Restaurant: ${restName}`, 20, 46);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 52);

    if (currentMode === 'recipe') {
      const dish = document.getElementById('dishNameInput').value || 'Unspecified Menu Item';
      const portions = parseFloat(document.getElementById('portionsInput').value) || 1;
      const targetPct = parseFloat(document.getElementById('targetCostInput').value) || 30;
      const sellPrice = parseFloat(document.getElementById('sellingPriceInput').value) || 0;

      let totalCost = 0;
      ingredients.forEach(ing => {
        totalCost += getIngredientCost(ing);
      });
      const costPerPortion = totalCost / portions;
      const actualCostPct = sellPrice > 0 ? (costPerPortion / sellPrice) * 100 : null;
      const recPrice = targetPct > 0 ? costPerPortion / (targetPct / 100) : null;
      const grossProfit = sellPrice > 0 ? sellPrice - costPerPortion : null;

      doc.text(`Dish Name: ${dish}`, 20, 58);
      doc.text(`Portions: ${portions}`, 20, 64);

      doc.setFillColor('#FFF7ED');
      doc.rect(20, 72, 170, 32, 'F');

      doc.text(`Cost per Portion: ${pdfSym}${costPerPortion.toFixed(2)}`, 25, 80);
      doc.text(`Actual Food Cost %: ${actualCostPct ? actualCostPct.toFixed(1) + '%' : 'N/A'}`, 115, 80);
      doc.text(`Recommended Price: ${pdfSym}${recPrice ? recPrice.toFixed(2) : 'N/A'}`, 25, 92);
      doc.text(`Gross Profit: ${pdfSym}${grossProfit ? grossProfit.toFixed(2) : 'N/A'}`, 115, 92);

      const tableData = ingredients.map(ing => {
        if (!ing.name) return null;
        const cost = getIngredientCost(ing);
        const total = costPerPortion * portions;
        const pct = total > 0 ? (cost / total) * 100 : 0;
        return [
          ing.name || 'Unnamed',
          `${pdfSym}${ing.buyPrice} / ${ing.buyUnit}`,
          `${ing.qtyUsed} ${ing.useUnit}`,
          `${ing.wastagePercent}%`,
          `${pdfSym}${cost.toFixed(2)}`,
          `${pct.toFixed(1)}%`
        ];
      }).filter(Boolean);

      doc.autoTable({
        startY: 112,
        head: [['Ingredient', 'Buy Price', 'Quantity', 'Wastage', 'Total Cost', '% of Total']],
        body: tableData,
        headStyles: { fillColor: '#F97316' },
      });

    } else {
      const beg = parseFloat(document.getElementById('begInventoryInput').value) || 0;
      const pur = parseFloat(document.getElementById('purchasesInput').value) || 0;
      const end = parseFloat(document.getElementById('endingInventoryInput').value) || 0;
      const sales = parseFloat(document.getElementById('totalSalesInput').value) || 0;

      const cogs = beg + pur - end;
      const foodCostPct = sales > 0 ? (cogs / sales) * 100 : null;
      const grossProfit = sales - cogs;

      doc.text(`Period Overall Report: ${currentPeriod}`, 20, 58);

      doc.setFillColor('#FFF7ED');
      doc.rect(20, 66, 170, 26, 'F');

      doc.text(`COGS: ${pdfSym}${cogs.toFixed(2)}`, 25, 74);
      doc.text(`Overall Food Cost %: ${foodCostPct ? foodCostPct.toFixed(1) + '%' : 'N/A'}`, 115, 74);
      doc.text(`Total Gross Profit: ${pdfSym}${grossProfit.toFixed(2)}`, 25, 84);

      const tableData = [
        ['Beginning Inventory Value', `${pdfSym}${beg.toFixed(2)}`],
        ['(+) Purchases', `${pdfSym}${pur.toFixed(2)}`],
        ['(−) Ending Inventory Value', `${pdfSym}${end.toFixed(2)}`],
        ['Total Cost of Goods Sold (COGS)', `${pdfSym}${cogs.toFixed(2)}`],
        ['Total Food Sales', `${pdfSym}${sales.toFixed(2)}`]
      ];

      doc.autoTable({
        startY: 100,
        head: [['Metric', 'Value']],
        body: tableData,
        headStyles: { fillColor: '#F97316' },
      });
    }

    // Highlighted Tagline Footer at the bottom
    doc.setDrawColor('#F97316');
    doc.line(20, 276, 190, 276);

    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor('#F97316');
    doc.text('Meenufy', 20, 284);

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor('#374151');
    doc.text('— A hassle-free way to run your restaurant.', 38, 284);

    doc.setFontSize(8);
    doc.setTextColor('#9CA3AF');
    doc.text('meenufy.com/tools/food-cost-calculator', 132, 284);

    doc.save('meenufy-food-cost-report.pdf');
    showToast('📄 PDF report generated and downloaded!');
  } catch (e) {
    console.error(e);
    showToast('❌ Failed to download PDF report.');
  }
}

// Copy results as Excel sheet (TSV)
function handleCopyExcel() {
  const sym = currentCurrency.symbol;
  let text = "";

  if (currentMode === 'recipe') {
    const dish = document.getElementById('dishNameInput').value || 'Dish';
    const portions = parseFloat(document.getElementById('portionsInput').value) || 1;
    const targetPct = parseFloat(document.getElementById('targetCostInput').value) || 30;
    const sellPrice = parseFloat(document.getElementById('sellingPriceInput').value) || 0;
    
    let totalCost = 0;
    ingredients.forEach(ing => { totalCost += getIngredientCost(ing); });
    const costPerPortion = totalCost / portions;
    const actualCostPct = sellPrice > 0 ? (costPerPortion / sellPrice) * 100 : null;
    const recommendedPrice = targetPct > 0 ? (costPerPortion / (targetPct / 100)) : 0;
    const grossProfit = sellPrice - costPerPortion;

    text += `Recipe Food Cost Report\n`;
    text += `Dish Name:\t${dish}\n`;
    text += `Portions:\t${portions}\n`;
    text += `Target Food Cost %:\t${targetPct}%\n`;
    text += `Cost per Portion:\t${sym}${costPerPortion.toFixed(2)}\n`;
    text += `Actual Food Cost %:\t${actualCostPct ? actualCostPct.toFixed(1) + '%' : 'N/A'}\n`;
    text += `Selling Price:\t${sym}${sellPrice.toFixed(2)}\n`;
    text += `Recommended Selling Price:\t${sym}${recommendedPrice.toFixed(2)}\n`;
    text += `Gross Profit per Portion:\t${sym}${grossProfit.toFixed(2)}\n\n`;

    text += `Ingredient\tQuantity Used\tUnit Used\tBuy Price (${sym})\tBuy Unit\tWastage (%)\tTotal Cost (${sym})\t% of Total\n`;
    
    ingredients.forEach(ing => {
      if (!ing.name) return;
      const cost = getIngredientCost(ing);
      const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
      text += `${ing.name}\t${ing.qtyUsed}\t${ing.useUnit}\t${ing.buyPrice}\t${ing.buyUnit}\t${ing.wastagePercent}%\t${cost.toFixed(2)}\t${pct.toFixed(1)}%\n`;
    });
  } else {
    const beg = parseFloat(document.getElementById('begInventoryInput').value) || 0;
    const pur = parseFloat(document.getElementById('purchasesInput').value) || 0;
    const end = parseFloat(document.getElementById('endingInventoryInput').value) || 0;
    const sales = parseFloat(document.getElementById('totalSalesInput').value) || 0;
    const cogs = beg + pur - end;
    const foodCostPct = sales > 0 ? (cogs / sales) * 100 : null;

    text += `Inventory Overall Cost Report\n`;
    text += `Period:\t${currentPeriod}\n`;
    text += `Beginning Inventory:\t${sym}${beg.toFixed(2)}\n`;
    text += `Purchases:\t${sym}${pur.toFixed(2)}\n`;
    text += `Ending Inventory:\t${sym}${end.toFixed(2)}\n`;
    text += `Total Sales:\t${sym}${sales.toFixed(2)}\n`;
    text += `COGS (Cost of Goods Sold):\t${sym}${cogs.toFixed(2)}\n`;
    text += `Overall Food Cost %:\t${foodCostPct ? foodCostPct.toFixed(1) + '%' : 'N/A'}\n`;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast('📊 Excel-compatible table copied to clipboard! You can now paste it directly into Excel or Google Sheets.');
  });
}

// Copy results to clipboard
function handleCopyResults() {
  const sym = currentCurrency.symbol;
  let text = `=== MEENUFY FOOD COST REPORT ===\nDate: ${new Date().toLocaleDateString()}\n`;
  if (currentMode === 'recipe') {
    const dish = document.getElementById('dishNameInput').value || 'Dish';
    const portions = parseFloat(document.getElementById('portionsInput').value) || 1;
    let totalCost = 0;
    ingredients.forEach(ing => { totalCost += getIngredientCost(ing); });
    const costPerPortion = totalCost / portions;
    const sellPrice = parseFloat(document.getElementById('sellingPriceInput').value) || 0;
    const actualCostPct = sellPrice > 0 ? (costPerPortion / sellPrice) * 100 : null;

    text += `Dish Name: ${dish}\n`;
    text += `Cost per Portion: ${sym}${costPerPortion.toFixed(2)}\n`;
    text += `Food Cost Percentage: ${actualCostPct ? actualCostPct.toFixed(1) + '%' : 'N/A'}\n`;
  } else {
    const beg = parseFloat(document.getElementById('begInventoryInput').value) || 0;
    const pur = parseFloat(document.getElementById('purchasesInput').value) || 0;
    const end = parseFloat(document.getElementById('endingInventoryInput').value) || 0;
    const sales = parseFloat(document.getElementById('totalSalesInput').value) || 0;
    const cogs = beg + pur - end;
    const foodCostPct = sales > 0 ? (cogs / sales) * 100 : null;

    text += `Period: ${currentPeriod}\n`;
    text += `COGS: ${sym}${cogs.toFixed(2)}\n`;
    text += `Overall Food Cost Percentage: ${foodCostPct ? foodCostPct.toFixed(1) + '%' : 'N/A'}\n`;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Results copied to clipboard!');
  });
}

// Share calculations via URL parameters
function handleShareCalculations() {
  const portions = parseFloat(document.getElementById('portionsInput').value) || 1;
  const targetPct = parseFloat(document.getElementById('targetCostInput').value) || 30;
  const sellPrice = parseFloat(document.getElementById('sellingPriceInput').value) || 0;

  const beg = parseFloat(document.getElementById('begInventoryInput').value) || 0;
  const pur = parseFloat(document.getElementById('purchasesInput').value) || 0;
  const end = parseFloat(document.getElementById('endingInventoryInput').value) || 0;
  const sales = parseFloat(document.getElementById('totalSalesInput').value) || 0;

  const state = {
    mode: currentMode,
    currency: currentCurrency.code,
    dishName: document.getElementById('dishNameInput').value,
    sellingPrice: sellPrice,
    targetFoodCostPercent: targetPct,
    portions: portions,
    ingredients: ingredients.filter(i => i.name),
    period: currentPeriod,
    beginningInventory: beg,
    purchases: pur,
    endingInventory: end,
    totalFoodSales: sales
  };

  const encoded = btoa(JSON.stringify(state));
  const shareUrl = `${window.location.origin}/tools/food-cost-calculator?d=${encoded}`;
  
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('🔗 Shareable calculation link copied to clipboard!');
  });
}

// Reset calculator inputs
function handleResetCalculator() {
  if (confirm('Are you sure you want to reset all fields?')) {
    document.getElementById('restaurantNameInput').value = '';
    document.getElementById('dishNameInput').value = '';
    document.getElementById('sellingPriceInput').value = '';
    document.getElementById('targetCostInput').value = '30';
    document.getElementById('portionsInput').value = '1';

    document.getElementById('begInventoryInput').value = '';
    document.getElementById('purchasesInput').value = '';
    document.getElementById('endingInventoryInput').value = '';
    document.getElementById('totalSalesInput').value = '';

    document.getElementById('priceSlider').value = '';
    document.getElementById('costSlider').value = '0';

    ingredients = [
      { id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
      { id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
      { id: getNewId(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 }
    ];

    renderIngredientRows();
    calculateAndRender();
    showToast('↺ Calculator reset successfully.');
  }
}

// Page Load Initializer
document.addEventListener('DOMContentLoaded', () => {
  const currencySelect = document.getElementById('currencySelect');
  currencySelect.innerHTML = CURRENCIES.map(c => 
    `<option value="${c.code}">${c.symbol} — ${c.code} (${c.label})</option>`
  ).join('');

  currencySelect.addEventListener('change', (e) => {
    const matched = CURRENCIES.find(c => c.code === e.target.value);
    if (matched) {
      currentCurrency = matched;
      document.querySelectorAll('.currency-symbol-label').forEach(el => {
        el.innerText = matched.symbol;
      });
      calculateAndRender();
    }
  });

  // Tab switcher listeners
  const tabRecipe = document.getElementById('tabRecipe');
  const tabOverall = document.getElementById('tabOverall');
  const recipePanel = document.getElementById('recipePanel');
  const overallPanel = document.getElementById('overallPanel');
  const recipeResultsBox = document.getElementById('recipeResultsBox');
  const overallResultsBox = document.getElementById('overallResultsBox');
  const whatIfSection = document.getElementById('whatIfSection');

  tabRecipe.addEventListener('click', () => {
    currentMode = 'recipe';
    tabRecipe.className = 'flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition bg-white text-brand shadow-sm';
    tabOverall.className = 'flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition text-gray-600 hover:text-gray-900';
    recipePanel.classList.remove('hidden');
    overallPanel.classList.add('hidden');
    recipeResultsBox.classList.remove('hidden');
    overallResultsBox.classList.add('hidden');
    whatIfSection.classList.remove('hidden');
    calculateAndRender();
  });

  tabOverall.addEventListener('click', () => {
    currentMode = 'overall';
    tabOverall.className = 'flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition bg-white text-brand shadow-sm';
    tabRecipe.className = 'flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition text-gray-600 hover:text-gray-900';
    recipePanel.classList.add('hidden');
    overallPanel.classList.remove('hidden');
    recipeResultsBox.classList.add('hidden');
    overallResultsBox.classList.remove('hidden');
    whatIfSection.classList.add('hidden');
    calculateAndRender();
  });

  // Period buttons listeners
  const periodBtns = document.querySelectorAll('.period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => {
        b.className = 'period-btn px-4 py-1.5 rounded-lg text-xs font-bold transition border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100';
      });
      btn.className = 'period-btn px-4 py-1.5 rounded-lg text-xs font-bold transition border bg-brand text-white border-brand';
      currentPeriod = btn.innerText;
      document.getElementById('purchasesLabel').innerText = `(+) Purchases made this ${currentPeriod.toLowerCase()}`;
      calculateAndRender();
    });
  });

  // What-if slider listeners
  const priceSlider = document.getElementById('priceSlider');
  const costSlider = document.getElementById('costSlider');

  priceSlider.addEventListener('input', () => {
    calculateAndRender();
  });
  costSlider.addEventListener('input', () => {
    calculateAndRender();
  });

  // Input elements event binding
  const liveInputs = [
    'portionsInput', 'targetCostInput', 'sellingPriceInput',
    'begInventoryInput', 'purchasesInput', 'endingInventoryInput', 'totalSalesInput'
  ];
  liveInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', calculateAndRender);
  });

  // Dynamic row adding (fixed: now renders to DOM)
  document.getElementById('addIngredientBtn').addEventListener('click', () => {
    addIngredientRow();
  });

  // Quick-Add Common Ingredient Chips
  document.querySelectorAll('.quick-add-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price) || 0;
      const bunit = btn.dataset.bunit;
      const qty = parseFloat(btn.dataset.qty) || 0;
      const uunit = btn.dataset.uunit;

      // Replace first blank row if available, otherwise append
      let blankRowIndex = ingredients.findIndex(i => !i.name && !i.buyPrice && !i.qtyUsed);
      if (blankRowIndex !== -1) {
        ingredients[blankRowIndex] = {
          id: ingredients[blankRowIndex].id,
          name: name,
          buyPrice: price,
          buyUnit: bunit,
          qtyUsed: qty,
          useUnit: uunit,
          wastagePercent: 0
        };
      } else {
        ingredients.push({
          id: getNewId(),
          name: name,
          buyPrice: price,
          buyUnit: bunit,
          qtyUsed: qty,
          useUnit: uunit,
          wastagePercent: 0
        });
      }

      renderIngredientRows();
      calculateAndRender();
      showToast(`🧂 Added "${name}" to ingredients list!`);
    });
  });

  // AI Autofill Button
  document.getElementById('aiAutofillBtn').addEventListener('click', handleAIAutofill);

  // What-if Collapsible Toggle
  const whatIfHeader = document.getElementById('whatIfHeader');
  const whatIfBody = document.getElementById('whatIfBody');
  whatIfHeader.addEventListener('click', () => {
    whatIfBody.classList.toggle('hidden');
  });

  document.getElementById('pdfExportBtn').addEventListener('click', handlePDFExport);
  document.getElementById('copyResultsBtn').addEventListener('click', handleCopyResults);
  document.getElementById('copyExcelBtn').addEventListener('click', handleCopyExcel);
  document.getElementById('shareBtn').addEventListener('click', handleShareCalculations);
  document.getElementById('resetBtn').addEventListener('click', handleResetCalculator);

  // Initial load state checks
  const params = new URLSearchParams(window.location.search);
  const queryData = params.get('d');
  if (queryData) {
    try {
      const state = JSON.parse(atob(queryData));
      if (state.mode) {
        currentMode = state.mode;
        if (currentMode === 'overall') tabOverall.click();
      }
      if (state.currency) {
        const matched = CURRENCIES.find(c => c.code === state.currency);
        if (matched) {
          currentCurrency = matched;
          currencySelect.value = matched.code;
          document.querySelectorAll('.currency-symbol-label').forEach(el => el.innerText = matched.symbol);
        }
      }
      if (state.dishName) document.getElementById('dishNameInput').value = state.dishName;
      if (state.sellingPrice) document.getElementById('sellingPriceInput').value = state.sellingPrice;
      if (state.targetFoodCostPercent) document.getElementById('targetCostInput').value = state.targetFoodCostPercent;
      if (state.portions) document.getElementById('portionsInput').value = state.portions;
      if (state.ingredients) ingredients = state.ingredients;
      
      if (state.period) {
        currentPeriod = state.period;
        periodBtns.forEach(b => {
          if (b.innerText === currentPeriod) b.click();
        });
      }
      if (state.beginningInventory) document.getElementById('begInventoryInput').value = state.beginningInventory;
      if (state.purchases) document.getElementById('purchasesInput').value = state.purchases;
      if (state.endingInventory) document.getElementById('endingInventoryInput').value = state.endingInventory;
      if (state.totalFoodSales) document.getElementById('totalSalesInput').value = state.totalFoodSales;

      showToast('📊 Restored calculations from shareable link!');
    } catch (e) {
      console.error(e);
    }
  }

  // Pre-load keys list
  getGeminiApiKeys();

  // First render
  renderIngredientRows();
  calculateAndRender();
});
