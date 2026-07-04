export function calculateProfitMargins(inputs) {
  const foodRev = parseFloat(inputs.foodRevenue) || 0;
  const bevRev = parseFloat(inputs.beverageRevenue) || 0;
  const otherRev = parseFloat(inputs.otherRevenue) || 0;
  const totalRevenue = foodRev + bevRev + otherRev;

  const cogs = parseFloat(inputs.cogs) || 0;
  const labor = parseFloat(inputs.labor) || 0;
  const rent = parseFloat(inputs.rent) || 0;
  const utilities = parseFloat(inputs.utilities) || 0;
  const marketing = parseFloat(inputs.marketing) || 0;
  const repairs = parseFloat(inputs.repairs) || 0;
  const licenses = parseFloat(inputs.licenses) || 0;
  const other = parseFloat(inputs.otherExpenses) || 0;

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

  // Period multiplier
  const period = inputs.period || 'monthly';
  const multiplier = period === 'daily' ? 365 : period === 'weekly' ? 52 : period === 'monthly' ? 12 : 1;
  const annualRevenue = totalRevenue * multiplier;
  const annualNetProfit = netProfit * multiplier;

  // What-if simulated calculations
  const whatIfRevenueVal = parseFloat(inputs.whatIfRevenue) || 0;
  const whatIfCogsVal = parseFloat(inputs.whatIfCogs) || 0;
  const whatIfLaborVal = parseFloat(inputs.whatIfLabor) || 0;
  const whatIfRentVal = parseFloat(inputs.whatIfRent) || 0;
  const whatIfDeliveryVal = parseFloat(inputs.whatIfDelivery) || 0;

  const wiRevenue = totalRevenue * (1 + whatIfRevenueVal / 100);
  const wiCogs = cogs * (1 - whatIfCogsVal / 100);
  const wiLabor = labor * (1 - whatIfLaborVal / 100);
  const wiRent = rent * (1 - whatIfRentVal / 100);
  
  const wiTotalRevenue = wiRevenue + whatIfDeliveryVal;
  const wiTotalExpenses = wiCogs + wiLabor + wiRent + utilities + marketing + repairs + licenses + other;
  const wiNetProfit = wiTotalRevenue - wiTotalExpenses;
  const wiNetMargin = wiTotalRevenue > 0 ? (wiNetProfit / wiTotalRevenue) * 100 : 0;
  const wiProfitDelta = wiNetProfit - netProfit;

  // Per-item percentages
  const cogsPct = totalRevenue > 0 ? (cogs / totalRevenue) * 100 : 0;
  const laborPct = totalRevenue > 0 ? (labor / totalRevenue) * 100 : 0;
  const rentPct = totalRevenue > 0 ? (rent / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalExpenses,
    grossProfit,
    netProfit,
    grossMargin,
    netMargin,
    primeCost,
    primeCostPct,
    ebitda,
    ebitdaMargin,
    breakEven,
    annualRevenue,
    annualNetProfit,
    multiplier,
    cogsPct,
    laborPct,
    rentPct,
    wiNetMargin,
    wiNetProfit,
    wiProfitDelta
  };
}
