import ProfitMarginCalculator from '../../../components/tools/ProfitMarginCalculator';

export const metadata = {
  title: 'Free Restaurant Profit Margin Calculator | Meenufy',
  description: 'Calculate restaurant profit margin instantly. Free tool — enter revenue, food cost, labor & expenses. Get gross profit, net margin & EBITDA analysis. No signup.',
  alternates: {
    canonical: 'https://meenufy.com/tools/restaurant-profit-margin-calculator',
  },
};

export default function Page() {
  return (
    <div className="bg-white min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-display font-black text-gray-900 tracking-tight mb-4">
            Free Restaurant Profit Margin Calculator
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Calculate your gross margin, net profit, prime costs, and break-even sales instantly. Get detailed, actionable advice from our AI chef.
          </p>
        </div>
        
        <ProfitMarginCalculator />
      </div>
    </div>
  );
}
