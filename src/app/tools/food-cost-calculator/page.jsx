import FoodCostCalculator from '../../../components/tools/FoodCostCalculator';

export const metadata = {
  title: 'Free Food Cost Calculator for Restaurants | Meenufy',
  description: 'Calculate food cost percentage instantly. Free restaurant food cost calculator — per-dish ingredient breakdown, ideal selling price & profit margins. No signup.',
  alternates: {
    canonical: 'https://meenufy.com/tools/food-cost-calculator',
  },
};

export default function Page() {
  return (
    <div className="bg-white min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-display font-black text-gray-900 tracking-tight mb-4">
            Free Restaurant Food Cost Calculator
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Calculate food cost percentage, ideal selling price, and gross profit per dish — in seconds. Works in 30+ currencies.
          </p>
        </div>
        
        <FoodCostCalculator />
      </div>
    </div>
  );
}
