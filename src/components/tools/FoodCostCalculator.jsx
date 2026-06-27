import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

function calculateIngredientCost(ing) {
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

export default function FoodCostCalculator() {
  const [mode, setMode] = useState('recipe');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [toast, setToast] = useState('');

  // Tab 1 state - defaults to zero/blank on load
  const [dishName, setDishName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState(30);
  const [portions, setPortions] = useState(1);
  const [restaurantName, setRestaurantName] = useState('');
  const [ingredients, setIngredients] = useState([
    { id: 1, name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
    { id: 2, name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
    { id: 3, name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
  ]);

  // Scenario state
  const [whatIfPriceSlider, setWhatIfPriceSlider] = useState('');
  const [whatIfCostSlider, setWhatIfCostSlider] = useState(0);

  // Tab 2 state
  const [period, setPeriod] = useState('Month');
  const [beginningInventory, setBeginningInventory] = useState('');
  const [purchases, setPurchases] = useState('');
  const [endingInventory, setEndingInventory] = useState('');
  const [totalFoodSales, setTotalFoodSales] = useState('');

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // Recipe calculation
  const recipeResults = useMemo(() => {
    const totalIngredientCost = ingredients.reduce((sum, ing) => {
      return sum + calculateIngredientCost(ing);
    }, 0) / (parseInt(portions, 10) || 1);

    const sPrice = parseFloat(sellingPrice) || 0;
    const actualFoodCostPercent = sPrice > 0 ? (totalIngredientCost / sPrice) * 100 : null;

    const recPrice = targetFoodCostPercent > 0 ? totalIngredientCost / (parseFloat(targetFoodCostPercent) / 100) : null;
    const grossProfit = sPrice > 0 ? sPrice - totalIngredientCost : null;

    return { totalIngredientCost, actualFoodCostPercent, recPrice, grossProfit };
  }, [ingredients, sellingPrice, targetFoodCostPercent, portions]);

  // Adjust sliders
  useEffect(() => {
    if (sellingPrice) {
      setWhatIfPriceSlider(sellingPrice);
    } else if (recipeResults.recPrice) {
      setWhatIfPriceSlider(Math.round(recipeResults.recPrice));
    }
  }, [sellingPrice, recipeResults.recPrice]);

  const scenarioResults = useMemo(() => {
    const newCostMultiplier = 1 + (whatIfCostSlider / 100);
    const adjustedCostPerPortion = recipeResults.totalIngredientCost * newCostMultiplier;

    const sliderPriceVal = parseFloat(whatIfPriceSlider) || 0;
    const scenarioFoodCostPercent = sliderPriceVal > 0 ? (adjustedCostPerPortion / sliderPriceVal) * 100 : null;
    const scenarioGrossProfit = sliderPriceVal > 0 ? sliderPriceVal - adjustedCostPerPortion : null;

    return { adjustedCostPerPortion, scenarioFoodCostPercent, scenarioGrossProfit };
  }, [recipeResults.totalIngredientCost, whatIfPriceSlider, whatIfCostSlider]);

  // Period overall calculations
  const overallResults = useMemo(() => {
    const beg = parseFloat(beginningInventory) || 0;
    const pur = parseFloat(purchases) || 0;
    const end = parseFloat(endingInventory) || 0;
    const sales = parseFloat(totalFoodSales) || 0;

    const cogs = beg + pur - end;
    const foodCostPercent = sales > 0 ? (cogs / sales) * 100 : null;
    const grossProfit = sales - cogs;

    return { cogs, foodCostPercent, grossProfit };
  }, [beginningInventory, purchases, endingInventory, totalFoodSales]);

  // Form helpers
  const addIngredientRow = () => {
    setIngredients([
      ...ingredients,
      { id: Date.now(), name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 }
    ]);
  };

  const removeIngredientRow = (id) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const updateIngredientRow = (id, key, val) => {
    setIngredients(ingredients.map(ing => {
      if (ing.id === id) {
        return { ...ing, [key]: val };
      }
      return ing;
    }));
  };

  const handleReset = () => {
    setDishName('');
    setSellingPrice('');
    setTargetFoodCostPercent(30);
    setPortions(1);
    setWhatIfCostSlider(0);
    setBeginningInventory('');
    setPurchases('');
    setEndingInventory('');
    setTotalFoodSales('');
    setIngredients([
      { id: 1, name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
      { id: 2, name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
      { id: 3, name: '', buyPrice: '', buyUnit: 'kg', qtyUsed: '', useUnit: 'g', wastagePercent: 0 },
    ]);
    triggerToast('↺ Reset completed');
  };

  const handleShare = () => {
    const stateToEncode = {
      mode, currency: currency.code, dishName, sellingPrice,
      targetFoodCostPercent, portions, ingredients, period,
      beginningInventory, purchases, endingInventory, totalFoodSales
    };
    const encoded = btoa(JSON.stringify(stateToEncode));
    const shareUrl = `${window.location.origin}/tools/food-cost-calculator?d=${encoded}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      triggerToast('🔗 Link copied!');
    });
  };

  const handleCopyText = () => {
    let text = `=== MEENUFY FOOD COST REPORT ===\n`;
    if (mode === 'recipe') {
      text += `Dish Name: ${dishName || 'Dish'}\n`;
      text += `Cost per Portion: ${currency.symbol}${recipeResults.totalIngredientCost.toFixed(2)}\n`;
      text += `Food Cost Percentage: ${recipeResults.actualFoodCostPercent ? recipeResults.actualFoodCostPercent.toFixed(1) + '%' : 'N/A'}\n`;
    } else {
      text += `Period: ${period}\n`;
      text += `Overall Food Cost Percentage: ${overallResults.foodCostPercent ? overallResults.foodCostPercent.toFixed(1) + '%' : 'N/A'}\n`;
    }
    navigator.clipboard.writeText(text).then(() => {
      triggerToast('📋 Results copied!');
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor('#F97316');
    doc.text('Food Cost Report', 20, 25);
    doc.setFontSize(12);
    doc.setTextColor('#111827');
    doc.text(`Restaurant: ${restaurantName || 'N/A'}`, 20, 40);

    if (mode === 'recipe') {
      doc.text(`Dish Name: ${dishName || 'Unspecified'}`, 20, 48);
      doc.text(`Portions: ${portions}`, 20, 64);
      doc.text(`Cost per Portion: ${currency.symbol}${recipeResults.totalIngredientCost.toFixed(2)}`, 20, 72);
      doc.text(`Actual Food Cost %: ${recipeResults.actualFoodCostPercent ? recipeResults.actualFoodCostPercent.toFixed(1) + '%' : 'N/A'}`, 20, 80);
      
      const body = ingredients.map(ing => [
        ing.name || 'Unnamed',
        `${ing.buyPrice || 0} / ${ing.buyUnit}`,
        `${ing.qtyUsed || 0} ${ing.useUnit}`,
        `${currency.symbol}${calculateIngredientCost(ing).toFixed(2)}`
      ]);

      doc.autoTable({
        startY: 92,
        head: [['Ingredient', 'Buy Price', 'Quantity Used', 'Cost']],
        body: body,
      });
    } else {
      doc.text(`Overall Food Cost - Period: ${period}`, 20, 48);
      doc.text(`COGS: ${currency.symbol}${overallResults.cogs.toFixed(2)}`, 20, 56);
      doc.text(`Food Cost %: ${overallResults.foodCostPercent ? overallResults.foodCostPercent.toFixed(1) + '%' : 'N/A'}`, 20, 64);
    }
    doc.save('meenufy-food-cost-report.pdf');
  };

  const costPct = mode === 'recipe' ? recipeResults.actualFoodCostPercent : overallResults.foodCostPercent;
  const benchmarkData = useMemo(() => {
    if (costPct === null || costPct === 0) return { label: 'Enter details to verify benchmark', color: 'text-gray-500', barBg: 'bg-gray-200' };
    if (costPct < 25) return { label: 'Excellent (<25%)', color: 'text-blue-600', barBg: 'bg-blue-600' };
    if (costPct <= 35) return { label: 'Healthy (25–35%)', color: 'text-green-600', barBg: 'bg-green-600' };
    if (costPct <= 40) return { label: 'Warning (35–40%)', color: 'text-yellow-600', barBg: 'bg-yellow-500' };
    return { label: 'Critical (40%+)', color: 'text-red-600', barBg: 'bg-red-600' };
  }, [costPct]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        <button onClick={() => setMode('recipe')} className={`pb-2 font-bold ${mode === 'recipe' ? 'border-b-2 border-brand text-brand' : 'text-gray-500'}`}>Recipe Costing</button>
        <button onClick={() => setMode('overall')} className={`pb-2 font-bold ${mode === 'overall' ? 'border-b-2 border-brand text-brand' : 'text-gray-500'}`}>Overall COGS</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">CURRENCY</label>
              <select value={currency.code} onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value))} className="w-full bg-white border border-gray-200 p-2 rounded-lg outline-none">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} - {c.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">RESTAURANT NAME</label>
              <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} className="w-full bg-white border border-gray-200 p-2 rounded-lg outline-none" />
            </div>
          </div>

          {mode === 'recipe' ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="Dish Name" className="border p-2 rounded-lg" />
                <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="Selling Price" className="border p-2 rounded-lg" />
                <input type="number" value={portions} onChange={(e) => setPortions(e.target.value)} placeholder="Portions" className="border p-2 rounded-lg" />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold">Ingredients</h3>
                  <button onClick={addIngredientRow} className="text-brand font-bold text-xs bg-brand-light px-3 py-1.5 rounded-lg border border-orange-200 hover:bg-orange-100 transition">+ Add Ingredient</button>
                </div>
                {ingredients.map(ing => (
                  <div key={ing.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 border-b pb-2">
                    <input type="text" value={ing.name} onChange={(e) => updateIngredientRow(ing.id, 'name', e.target.value)} placeholder="Name" className="border p-1.5 rounded col-span-2" />
                    <input type="number" value={ing.buyPrice} onChange={(e) => updateIngredientRow(ing.id, 'buyPrice', e.target.value)} placeholder="Price" className="border p-1.5 rounded" />
                    <select value={ing.buyUnit} onChange={(e) => updateIngredientRow(ing.id, 'buyUnit', e.target.value)} className="border p-1.5 rounded">
                      {Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" value={ing.qtyUsed} onChange={(e) => updateIngredientRow(ing.id, 'qtyUsed', e.target.value)} placeholder="Used" className="border p-1.5 rounded" />
                    <select value={ing.useUnit} onChange={(e) => updateIngredientRow(ing.id, 'useUnit', e.target.value)} className="border p-1.5 rounded">
                      {Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="number" value={beginningInventory} onChange={(e) => setBeginningInventory(e.target.value)} placeholder="Beginning Inventory" className="border p-2 rounded-lg" />
              <input type="number" value={purchases} onChange={(e) => setPurchases(e.target.value)} placeholder="Purchases" className="border p-2 rounded-lg" />
              <input type="number" value={endingInventory} onChange={(e) => setEndingInventory(e.target.value)} placeholder="Ending Inventory" className="border p-2 rounded-lg" />
              <input type="number" value={totalFoodSales} onChange={(e) => setTotalFoodSales(e.target.value)} placeholder="Total Food Sales" className="border p-2 rounded-lg" />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 text-white p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-gray-400">Results</h3>
            {mode === 'recipe' ? (
              <div className="space-y-2">
                <p>Cost/Portion: {currency.symbol}{recipeResults.totalIngredientCost.toFixed(2)}</p>
                <p>Actual Cost %: {recipeResults.actualFoodCostPercent ? recipeResults.actualFoodCostPercent.toFixed(1) + '%' : 'N/A'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p>COGS: {currency.symbol}{overallResults.cogs.toFixed(2)}</p>
                <p>Food Cost %: {overallResults.foodCostPercent ? overallResults.foodCostPercent.toFixed(1) + '%' : 'N/A'}</p>
              </div>
            )}
          </div>

          <div className="bg-white border p-6 rounded-2xl space-y-3">
            <button onClick={handleExportPDF} className="w-full bg-brand text-white font-bold p-2.5 rounded-xl">📄 Export PDF</button>
            <button onClick={handleCopyText} className="w-full bg-gray-50 border p-2.5 rounded-xl">📋 Copy Results</button>
            <button onClick={handleShare} className="w-full bg-gray-50 border p-2.5 rounded-xl">🔗 Share Link</button>
            <button onClick={handleReset} className="w-full bg-red-50 text-red-600 border p-2.5 rounded-xl">↺ Reset</button>
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow">{toast}</div>}
    </div>
  );
}
