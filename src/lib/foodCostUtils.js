export const UNIT_CONVERSIONS = {
  // Weight
  'kg': { 'g': 1000, 'kg': 1, 'lb': 2.20462, 'oz': 35.274 },
  'g': { 'g': 1, 'kg': 0.001, 'lb': 0.00220462, 'oz': 0.035274 },
  'lb': { 'lb': 1, 'oz': 16, 'kg': 0.453592, 'g': 453.592 },
  'oz': { 'oz': 1, 'lb': 0.0625, 'kg': 0.0283495, 'g': 28.3495 },
  
  // Volume
  'L': { 'L': 1, 'ml': 1000, 'cup': 4.22675, 'tbsp': 67.628, 'tsp': 202.884 },
  'ml': { 'ml': 1, 'L': 0.001, 'cup': 0.00422675, 'tbsp': 0.067628, 'tsp': 0.202884 },
  'cup': { 'cup': 1, 'ml': 236.588, 'L': 0.236588, 'tbsp': 16, 'tsp': 48 },
  'tbsp': { 'tbsp': 1, 'ml': 14.7868, 'L': 0.0147868, 'tsp': 3, 'cup': 0.0625 },
  'tsp': { 'tsp': 1, 'ml': 4.92892, 'L': 0.00492892, 'tbsp': 0.333333 },
  
  // Count
  'piece': { 'piece': 1 },
  'dozen': { 'dozen': 1, 'piece': 12 },
  'slice': { 'slice': 1 },
  'bunch': { 'bunch': 1 },
  'head': { 'head': 1 },
  'clove': { 'clove': 1 },
  'loaf': { 'loaf': 1, 'slice': 20 },
};

export function calculateIngredientCost(ingredient) {
  const buyPrice = parseFloat(ingredient.buyPrice) || 0;
  const qtyUsed = parseFloat(ingredient.qtyUsed) || 0;
  const buyUnit = ingredient.buyUnit || 'kg';
  const useUnit = ingredient.useUnit || 'g';
  const wastagePercent = parseFloat(ingredient.wastagePercent) || 0;
  
  // Convert qtyUsed (in useUnit) to buyUnit
  let conversionFactor = 1;
  if (UNIT_CONVERSIONS[useUnit] && UNIT_CONVERSIONS[useUnit][buyUnit] !== undefined) {
    conversionFactor = 1 / UNIT_CONVERSIONS[useUnit][buyUnit];
  } else if (UNIT_CONVERSIONS[buyUnit] && UNIT_CONVERSIONS[buyUnit][useUnit] !== undefined) {
    conversionFactor = UNIT_CONVERSIONS[buyUnit][useUnit];
  }
  
  const qtyInBuyUnit = qtyUsed * conversionFactor;
  const rawCost = buyPrice * qtyInBuyUnit;
  
  // Apply wastage factor
  const wastageMultiplier = wastagePercent > 0 ? (1 / (1 - (wastagePercent / 100))) : 1;
  
  return rawCost * wastageMultiplier;
}
