import { useState } from 'react';
import { useStore } from '../../context/RealtimeStore';
import {
  TrendingUp, ShoppingBag, Users, DollarSign, HelpCircle,
  Award, Activity, BarChart3, UtensilsCrossed, Coins
} from 'lucide-react';

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
    </div>
  );
}

export default function AdminAnalysis() {
  const { state, dispatch, addToast } = useStore();
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'lifetime'>('lifetime');
  const [viewBestItems, setViewBestItems] = useState(true);
  const [showDeepMealAnalysis, setShowDeepMealAnalysis] = useState(false);

  const orders = state.orders;
  const servedOrders = orders.filter(o => o.status === 'served');
  const today = new Date();

  // Dynamic filter for served orders based on selected time frame
  const filteredServedOrders = servedOrders.filter(o => {
    const elapsedMs = Date.now() - o.createdAt;
    if (timeFilter === 'day') return elapsedMs <= 24 * 60 * 60 * 1000;
    if (timeFilter === 'week') return elapsedMs <= 7 * 24 * 60 * 60 * 1000;
    if (timeFilter === 'month') return elapsedMs <= 30 * 24 * 60 * 60 * 1000;
    return true; // lifetime
  });

  const totalFilteredServedSales = filteredServedOrders.reduce((s, o) => s + o.totalAmount, 0);

  // Advanced KPIs
  const aov = filteredServedOrders.length > 0 ? Math.round(totalFilteredServedSales / filteredServedOrders.length) : 0;

  // Order Cancellation Rate
  const totalPeriodOrders = orders.filter(o => {
    const elapsedMs = Date.now() - o.createdAt;
    if (timeFilter === 'day') return elapsedMs <= 24 * 60 * 60 * 1000;
    if (timeFilter === 'week') return elapsedMs <= 7 * 24 * 60 * 60 * 1000;
    if (timeFilter === 'month') return elapsedMs <= 30 * 24 * 60 * 60 * 1000;
    return true;
  });
  const cancelledOrders = totalPeriodOrders.filter(o => o.status === 'cancelled');
  const cancellationRate = totalPeriodOrders.length > 0
    ? ((cancelledOrders.length / totalPeriodOrders.length) * 100).toFixed(1)
    : '0.0';

  // Peak Hours Calculation
  const hourlyOrderCounts = Array(24).fill(0);
  filteredServedOrders.forEach(o => {
    const hr = new Date(o.createdAt).getHours();
    hourlyOrderCounts[hr]++;
  });
  const peakHour = hourlyOrderCounts.indexOf(Math.max(...hourlyOrderCounts));
  const peakHourStr = peakHour >= 0 && Math.max(...hourlyOrderCounts) > 0
    ? `${peakHour % 12 || 12}:00 ${peakHour >= 12 ? 'PM' : 'AM'}`
    : 'N/A';

  // Loyalty Program Impact
  const loyaltyRedeemedOrders = filteredServedOrders.filter(o => o.pointsRedeemed && o.pointsRedeemed > 0);
  const loyaltyImpactPct = filteredServedOrders.length > 0
    ? ((loyaltyRedeemedOrders.length / filteredServedOrders.length) * 100).toFixed(1)
    : '0.0';
  const totalPointsDiscounts = filteredServedOrders.reduce((s, o) => s + (o.pointsDiscountApplied || 0), 0);

  // Today's metrics calculations
  const todayOrders = orders.filter(o => {
    const d = new Date(o.createdAt);
    return d.toDateString() === today.toDateString();
  });
  const todayRevenue = todayOrders.filter(o => o.status === 'served').reduce((s, o) => s + o.totalAmount, 0);

  // Active orders count
  const activeOrders = orders.filter(o => ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status));

  // Health Score Calculations
  const avgRating = (() => {
    const ratedOrders = filteredServedOrders.filter(o => o.ratings && Object.keys(o.ratings).length > 0);
    if (ratedOrders.length === 0) return 4.5;
    let sum = 0, count = 0;
    ratedOrders.forEach(o => {
      Object.values(o.ratings!).forEach(r => { sum += r; count++; });
    });
    return count > 0 ? sum / count : 4.5;
  })();
  const satisfactionScore = (avgRating / 5) * 100;

  const repeatCustCount = state.customers.filter(c => c.orderCount > 1).length;
  const repeatRatePct = state.customers.length > 0 ? (repeatCustCount / state.customers.length) * 100 : 75;

  const volumeScore = Math.min(100, (filteredServedOrders.length * 15) || 70);

  const servedWithTime = filteredServedOrders.filter(o => o.updatedAt > o.createdAt);
  const avgPrepTimeMs = servedWithTime.length > 0
    ? servedWithTime.reduce((s, o) => s + (o.updatedAt - o.createdAt), 0) / servedWithTime.length
    : 18 * 60 * 1000;
  const avgPrepMins = avgPrepTimeMs / (1000 * 60);

  let speedScore = 100;
  if (avgPrepMins > 45) speedScore = 20;
  else if (avgPrepMins > 30) speedScore = 50;
  else if (avgPrepMins > 15) speedScore = 80;

  const healthScore = Math.round(
    (satisfactionScore * 0.4) +
    (volumeScore * 0.3) +
    (repeatRatePct * 0.2) +
    (speedScore * 0.1)
  );

  let healthColor = '#22c55e'; // green
  if (healthScore < 50) healthColor = '#ef4444'; // red
  else if (healthScore <= 70) healthColor = '#eab308'; // yellow

  // Table Statistics Calculations
  const tableStats: Record<string, { tableNumber: number; orderCount: number; revenue: number }> = {};
  state.tables.forEach(t => {
    tableStats[t.id] = { tableNumber: t.number, orderCount: 0, revenue: 0 };
  });
  filteredServedOrders.forEach(o => {
    if (!tableStats[o.tableId]) {
      tableStats[o.tableId] = { tableNumber: o.tableNumber, orderCount: 0, revenue: 0 };
    }
    tableStats[o.tableId].orderCount++;
    tableStats[o.tableId].revenue += o.totalAmount;
  });

  const tableList = Object.entries(tableStats).map(([id, stats]) => ({
    id,
    ...stats,
    avgBill: stats.orderCount > 0 ? Math.round(stats.revenue / stats.orderCount) : 0
  }));

  const slowerTables = [...tableList].sort((a, b) => a.orderCount - b.orderCount).slice(0, 3);
  const mostProfitableTable = [...tableList].sort((a, b) => b.revenue - a.revenue)[0];
  const revPerTable = state.tables.length > 0 ? Math.round(totalFilteredServedSales / state.tables.length) : 0;

  // Category breakdown
  const categoryRevenue: Record<string, { name: string; revenue: number; orders: number }> = {};
  filteredServedOrders.forEach(order => {
    order.items.forEach(item => {
      const menuItem = state.menuItems.find(m => m.id === item.menuItemId);
      const catId = menuItem?.category || 'unknown';
      const cat = state.categories.find(c => c.id === catId);
      if (!categoryRevenue[catId]) categoryRevenue[catId] = { name: cat ? `${cat.icon} ${cat.name}` : 'Other', revenue: 0, orders: 0 };
      categoryRevenue[catId].revenue += item.price * item.qty;
      categoryRevenue[catId].orders += item.qty;
    });
  });

  // Food Sales Metrics (Best Selling and Poorest Selling 5 Items) with comparative Week/Month counts
  const itemSalesExt: Record<string, { name: string; qty: number; revenue: number; isVeg: boolean; qtyWeek: number; qtyMonth: number }> = {};
  // Initialize all items
  state.menuItems.forEach(item => {
    itemSalesExt[item.id] = { name: item.name, qty: 0, revenue: 0, isVeg: item.isVeg, qtyWeek: 0, qtyMonth: 0 };
  });

  orders.forEach(order => {
    if (order.status !== 'served') return;
    const elapsedMs = Date.now() - order.createdAt;
    const isWeek = elapsedMs <= 7 * 24 * 60 * 60 * 1000;
    const isMonth = elapsedMs <= 30 * 24 * 60 * 60 * 1000;
    const isFiltered = (() => {
      if (timeFilter === 'day') return elapsedMs <= 24 * 60 * 60 * 1000;
      if (timeFilter === 'week') return isWeek;
      if (timeFilter === 'month') return isMonth;
      return true; // lifetime
    })();

    order.items.forEach(item => {
      if (!itemSalesExt[item.menuItemId]) {
        itemSalesExt[item.menuItemId] = { name: item.name, qty: 0, revenue: 0, isVeg: true, qtyWeek: 0, qtyMonth: 0 };
      }
      if (isFiltered) {
        itemSalesExt[item.menuItemId].qty += item.qty;
        itemSalesExt[item.menuItemId].revenue += item.price * item.qty;
      }
      if (isWeek) {
        itemSalesExt[item.menuItemId].qtyWeek += item.qty;
      }
      if (isMonth) {
        itemSalesExt[item.menuItemId].qtyMonth += item.qty;
      }
    });
  });

  const bestItems = Object.values(itemSalesExt).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const poorestItems = Object.values(itemSalesExt).sort((a, b) => a.qty - b.qty).slice(0, 5);

  const displayedFoodItems = viewBestItems ? bestItems : poorestItems;
  const foodMaxQty = displayedFoodItems[0]?.qty || 1;

  // BCG Matrix Classification
  const allItemsSalesList = Object.values(itemSalesExt);
  const totalQtysSold = allItemsSalesList.reduce((acc, x) => acc + x.qty, 0);
  const totalRevsMade = allItemsSalesList.reduce((acc, x) => acc + x.revenue, 0);
  const avgQtySold = allItemsSalesList.length > 0 ? totalQtysSold / allItemsSalesList.length : 1;
  const avgRevMade = allItemsSalesList.length > 0 ? totalRevsMade / allItemsSalesList.length : 1;

  const stars = allItemsSalesList.filter(x => x.qty >= avgQtySold && x.revenue >= avgRevMade).sort((a, b) => b.qty - a.qty).slice(0, 4);
  const plowhorses = allItemsSalesList.filter(x => x.qty >= avgQtySold && x.revenue < avgRevMade).sort((a, b) => b.qty - a.qty).slice(0, 4);
  const puzzles = allItemsSalesList.filter(x => x.qty < avgQtySold && x.revenue >= avgRevMade).sort((a, b) => b.qty - a.qty).slice(0, 4);
  const dogs = allItemsSalesList.filter(x => x.qty < avgQtySold && x.revenue < avgRevMade && x.qty > 0).sort((a, b) => a.qty - b.qty).slice(0, 4);

  // Deep Meal Analysis variables
  let vegQty = 0;
  let nonVegQty = 0;
  let vegRevenue = 0;
  let nonVegRevenue = 0;
  let totalOrdersWithVariants = 0;
  let totalVariantSales = 0;
  let featuredRevenue = 0;
  let regularRevenue = 0;

  const customItemCounts: Record<string, number> = {};
  const variantNameCounts: Record<string, number> = {};

  filteredServedOrders.forEach(order => {
    let hasVariant = false;
    order.items.forEach(item => {
      const menuItem = state.menuItems.find(m => m.id === item.menuItemId);
      if (menuItem) {
        if (menuItem.isVeg) {
          vegQty += item.qty;
          vegRevenue += item.price * item.qty;
        } else {
          nonVegQty += item.qty;
          nonVegRevenue += item.price * item.qty;
        }
        if (menuItem.isFeatured) {
          featuredRevenue += item.price * item.qty;
        } else {
          regularRevenue += item.price * item.qty;
        }
      }
      if (item.variant) {
        hasVariant = true;
        totalVariantSales += item.price * item.qty;
        customItemCounts[item.name] = (customItemCounts[item.name] || 0) + item.qty;
        const vName = item.variant.name;
        variantNameCounts[vName] = (variantNameCounts[vName] || 0) + item.qty;
      }
    });
    if (hasVariant) totalOrdersWithVariants++;
  });

  const totalItemsSold = vegQty + nonVegQty;
  const vegPct = totalItemsSold > 0 ? Math.round((vegQty / totalItemsSold) * 100) : 50;
  const nonVegPct = totalItemsSold > 0 ? Math.round((nonVegQty / totalItemsSold) * 100) : 50;

  const totalMealRev = vegRevenue + nonVegRevenue;
  const vegRevPct = totalMealRev > 0 ? Math.round((vegRevenue / totalMealRev) * 100) : 50;
  const nonVegRevPct = totalMealRev > 0 ? Math.round((nonVegRevenue / totalMealRev) * 100) : 50;

  const totalFeaturedReg = featuredRevenue + regularRevenue;
  const featuredPct = totalFeaturedReg > 0 ? Math.round((featuredRevenue / totalFeaturedReg) * 100) : 0;

  const variantUsageOrderPct = filteredServedOrders.length > 0
    ? Math.round((totalOrdersWithVariants / filteredServedOrders.length) * 100)
    : 0;

  const topCustomised = Object.entries(customItemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const topVariants = Object.entries(variantNameCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Category average ratings and prep times calculations
  const categoryDeepStats: Record<string, { icon: string; name: string; sumRating: number; countRating: number; sumTime: number; countTime: number }> = {};
  state.categories.forEach(c => {
    categoryDeepStats[c.id] = { icon: c.icon, name: c.name, sumRating: 0, countRating: 0, sumTime: 0, countTime: 0 };
  });

  filteredServedOrders.forEach(o => {
    const elapsedPrep = o.updatedAt > o.createdAt ? (o.updatedAt - o.createdAt) : 0;
    o.items.forEach(item => {
      const menuItem = state.menuItems.find(m => m.id === item.menuItemId);
      if (menuItem) {
        const catId = menuItem.category;
        if (categoryDeepStats[catId]) {
          if (elapsedPrep > 0) {
            categoryDeepStats[catId].sumTime += elapsedPrep * item.qty;
            categoryDeepStats[catId].countTime += item.qty;
          }
          if (o.ratings?.[menuItem.name]) {
            categoryDeepStats[catId].sumRating += o.ratings[menuItem.name];
            categoryDeepStats[catId].countRating++;
          }
        }
      }
    });
  });

  const categoryDeepList = Object.entries(categoryDeepStats).map(([id, stats]) => ({
    id,
    ...stats,
    avgRating: stats.countRating > 0 ? (stats.sumRating / stats.countRating).toFixed(1) : '4.5',
    avgTime: stats.countTime > 0 ? Math.round(stats.sumTime / (stats.countTime * 1000 * 60)) : 18
  }));

  // Wallet spending calculations
  const deductions = state.walletTransactions.filter(tx => tx.type === 'deduction');
  const nowMs = Date.now();
  
  const walletSpentToday = deductions
    .filter(tx => {
      const d = new Date(tx.createdAt);
      return d.toDateString() === today.toDateString();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const walletSpentThisWeek = deductions
    .filter(tx => (nowMs - tx.createdAt) <= 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const walletSpentThisMonth = deductions
    .filter(tx => (nowMs - tx.createdAt) <= 30 * 24 * 60 * 60 * 1000)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const walletSpentLifetime = deductions
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Chart Data Calculations (Dynamic Grouping based on Timeframe)
  const salesGrouped: Record<string, number> = {};
  
  if (timeFilter === 'day') {
    // 2-hour interval slots for the last 24 hours
    const slots = ['8-10 AM', '10-12 AM', '12-2 PM', '2-4 PM', '4-6 PM', '6-8 PM', '8-10 PM', '10-12 PM'];
    slots.forEach(s => { salesGrouped[s] = 0; });
    
    filteredServedOrders.forEach(o => {
      const hr = new Date(o.createdAt).getHours();
      let slot = '10-12 PM';
      if (hr >= 8 && hr < 10) slot = '8-10 AM';
      else if (hr >= 10 && hr < 12) slot = '10-12 AM';
      else if (hr >= 12 && hr < 14) slot = '12-2 PM';
      else if (hr >= 14 && hr < 16) slot = '2-4 PM';
      else if (hr >= 16 && hr < 18) slot = '4-6 PM';
      else if (hr >= 18 && hr < 20) slot = '6-8 PM';
      else if (hr >= 20 && hr < 22) slot = '8-10 PM';
      
      salesGrouped[slot] = (salesGrouped[slot] || 0) + o.totalAmount;
    });
  } else if (timeFilter === 'week') {
    // Days of the week
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      salesGrouped[days[d.getDay()]] = 0;
    }
    
    filteredServedOrders.forEach(o => {
      const d = new Date(o.createdAt);
      const dayName = days[d.getDay()];
      salesGrouped[dayName] = (salesGrouped[dayName] || 0) + o.totalAmount;
    });
  } else if (timeFilter === 'month') {
    // Weeks of the month
    salesGrouped['Wk 1'] = 0;
    salesGrouped['Wk 2'] = 0;
    salesGrouped['Wk 3'] = 0;
    salesGrouped['Wk 4'] = 0;
    
    filteredServedOrders.forEach(o => {
      const elapsedDays = (Date.now() - o.createdAt) / (24 * 60 * 60 * 1000);
      let slot = 'Wk 1';
      if (elapsedDays > 21) slot = 'Wk 1';
      else if (elapsedDays > 14) slot = 'Wk 2';
      else if (elapsedDays > 7) slot = 'Wk 3';
      else slot = 'Wk 4';
      
      salesGrouped[slot] = (salesGrouped[slot] || 0) + o.totalAmount;
    });
  } else {
    // Lifetime: Group by month
    filteredServedOrders.forEach(o => {
      const monthStr = new Date(o.createdAt).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      salesGrouped[monthStr] = (salesGrouped[monthStr] || 0) + o.totalAmount;
    });
    if (Object.keys(salesGrouped).length === 0) {
      const monthNames = ['Apr 26', 'May 26', 'Jun 26'];
      monthNames.forEach(m => { salesGrouped[m] = 0; });
    }
  }

  const chartPoints = Object.entries(salesGrouped).map(([date, amount]) => ({
    date,
    amount
  }));

  // SVG Chart path calculation
  const svgWidth = 500;
  const svgHeight = 150;
  const paddingX = 40;
  const paddingY = 20;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const maxAmount = Math.max(...chartPoints.map(p => p.amount)) || 1000;

  const points = chartPoints.map((p, index) => {
    const x = chartPoints.length > 1
      ? paddingX + (index / (chartPoints.length - 1)) * chartWidth
      : paddingX + chartWidth / 2;
    const y = svgHeight - paddingY - (p.amount / maxAmount) * chartHeight;
    return { x, y, date: p.date, amount: p.amount };
  });

  const linePath = points.length > 1
    ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : points.length === 1 ? `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}` : '';

  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : points.length === 1 ? `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y} L ${points[0].x + 20} ${svgHeight - paddingY} L ${points[0].x - 20} ${svgHeight - paddingY} Z` : '';

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header and Time Filters */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Analysis</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Performance overview & statistics</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Timeframe selector tabs */}
            <div style={{
              display: 'flex', background: 'var(--bg-elevated)', padding: 3, borderRadius: 10,
              border: '1px solid var(--border)', gap: 4
            }}>
              {(['day', 'week', 'month', 'lifetime'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  style={{
                    padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8,
                    textTransform: 'capitalize',
                    background: timeFilter === f ? 'var(--brand)' : 'transparent',
                    color: timeFilter === f ? '#000000' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                dispatch({ type: 'TOGGLE_ADMIN_THEME' });
                addToast('success', `Theme switched to ${state.adminTheme === 'light' ? 'Dark' : 'Light'}!`);
              }}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 16,
                boxShadow: 'var(--shadow-sm)',
              }}
              title="Toggle Light/Dark Theme"
            >
              {state.adminTheme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={18} /></div>
          <div className="stat-value">{state.restaurant.currency}{todayRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">Today's Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><ShoppingBag size={18} /></div>
          <div className="stat-value">{todayOrders.length}</div>
          <div className="stat-label">Today's Orders</div>
        </div>
        <div className="stat-card" style={{ borderColor: activeOrders.length > 0 ? 'var(--border-brand)' : undefined }}>
          <div className="stat-icon" style={{ background: activeOrders.length > 0 ? 'rgba(255,125,0,0.2)' : undefined }}>
            <TrendingUp size={18} />
          </div>
          <div className="stat-value" style={{ color: activeOrders.length > 0 ? 'var(--brand)' : undefined }}>
            {activeOrders.length}
          </div>
          <div className="stat-label">Active Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Users size={18} /></div>
          <div className="stat-value">{state.customers.length}</div>
          <div className="stat-label">Total Customers</div>
        </div>
      </div>

      {/* Advanced Business Metrics Grid */}
      <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average Order Value (AOV)</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
            {state.restaurant.currency}{aov.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>For filtered timeframe</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Order Cancellation Rate</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: Number(cancellationRate) > 5 ? 'var(--error)' : 'var(--text-primary)', marginTop: 4 }}>
            {cancellationRate}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{cancelledOrders.length} cancelled orders</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Peak Ordering Hours</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand)', marginTop: 4 }}>
            {peakHourStr}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Most active hour of day</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loyalty Redemptions</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)', marginTop: 4 }}>
            {loyaltyImpactPct}% <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>orders</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Total disc: {state.restaurant.currency}{totalPointsDiscounts}</div>
        </div>
      </div>

      {/* Dynamic Blink Style Injection */}
      {(() => {
        const MEAL_BLINK_STYLE_ID = 'meenufy-meal-analysis-blink-styles';
        if (typeof document !== 'undefined' && !document.getElementById(MEAL_BLINK_STYLE_ID)) {
          const style = document.createElement('style');
          style.id = MEAL_BLINK_STYLE_ID;
          style.textContent = `
            @keyframes pulse-orange-glow {
              0%, 100% {
                box-shadow: 0 0 6px rgba(255,125,0,0.35), 0 0 10px rgba(255,125,0,0.15);
                border: 1px solid rgba(255,125,0,0.4);
                background: linear-gradient(135deg, rgba(255,125,0,0.15) 0%, rgba(255,80,0,0.04) 100%);
              }
              50% {
                box-shadow: 0 0 20px rgba(255,125,0,0.85), 0 0 30px rgba(255,125,0,0.4);
                border: 1px solid var(--brand);
                background: linear-gradient(135deg, rgba(255,125,0,0.3) 0%, rgba(255,80,0,0.1) 100%);
              }
            }
          `;
          document.head.appendChild(style);
        }
        return null;
      })()}

      {/* Subscription Wallet Spending */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Coins size={18} color="var(--brand)" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
            Subscription Wallet Spending
          </h3>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12
        }}>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Spent Today</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              ₹{walletSpentToday}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{walletSpentToday} orders served</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Spent This Week</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              ₹{walletSpentThisWeek}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Last 7 days</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Spent This Month</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              ₹{walletSpentThisMonth}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Last 30 days</div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Spent Lifetime</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>
              ₹{walletSpentLifetime}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Total order fees</div>
          </div>
        </div>
      </div>

      {/* Large Prominent Meal Analysis CTA Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,125,0,0.12) 0%, rgba(255,80,0,0.03) 100%)',
        border: '1px solid rgba(255,125,0,0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: 'var(--shadow-md)',
        animation: showDeepMealAnalysis ? 'none' : 'pulse-orange-glow 2s infinite ease-in-out',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            🍕 Deep Meal Analysis & Menu Insights
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0, maxWidth: 520, lineHeight: '18px' }}>
            Check Veg vs Non-Veg metrics, custom variant add-ons rankings, star categories, preparation speeds, and the Menu BCG Matrix.
          </p>
        </div>
        <button
          onClick={() => setShowDeepMealAnalysis(!showDeepMealAnalysis)}
          className="btn"
          style={{
            background: 'var(--brand)',
            color: '#000000',
            fontWeight: 800,
            padding: '12px 24px',
            borderRadius: 10,
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(255,125,0,0.3)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {showDeepMealAnalysis ? 'Hide Meal Analysis' : 'Open Meal Analysis 📊'}
        </button>
      </div>

      {/* Restaurant Health Score & Sales Trend Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
        
        {/* Restaurant Health Score */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={18} color="var(--brand)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Restaurant Health Score</span>
              </div>
              <button 
                onClick={() => setShowHealthModal(true)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
              >
                <HelpCircle size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, margin: '20px 0' }}>
              <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="90" height="90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-elevated)" strokeWidth="8" />
                  <circle 
                    cx="50" cy="50" r="42" fill="none" stroke={healthColor} strokeWidth="8" 
                    strokeDasharray="264" 
                    strokeDashoffset={264 - (264 * healthScore) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', fontSize: 24, fontWeight: 900, color: healthColor }}>
                  {healthScore}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: healthColor }}>
                  {healthScore >= 70 ? 'Excellent Performance' : healthScore >= 50 ? 'Steady / Moderate' : 'Action Required'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: '16px' }}>
                  Determined dynamically by ratings, repeat rate, preparation efficiency and order volume.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Satisfaction</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{avgRating.toFixed(1)} / 5.0</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg Prep Time</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{Math.round(avgPrepMins)} mins</div>
            </div>
          </div>
        </div>

        {/* Visual Sales Trend */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <BarChart3 size={18} color="var(--brand)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Sales Trend ({timeFilter})</span>
          </div>

          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 8, display: 'flex', justifyContent: 'center' }}>
            <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                const y = paddingY + p * chartHeight;
                return (
                  <line 
                    key={idx} x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} 
                    stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" 
                  />
                );
              })}

              {areaPath && <path d={areaPath} fill="url(#chart-glow)" />}
              {linePath && <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />}

              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4" fill="var(--brand)" stroke="var(--bg-secondary)" strokeWidth="2" />
                  <text 
                    x={p.x} y={p.y - 8} textAnchor="middle" 
                    fill="var(--text-primary)" fontSize="9" fontWeight="700"
                  >
                    {state.restaurant.currency}{Math.round(p.amount)}
                  </text>
                  <text 
                    x={p.x} y={svgHeight - 4} textAnchor="middle" 
                    fill="var(--text-muted)" fontSize="9" fontWeight="600"
                  >
                    {p.date}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Food Sales Best/Poorest Analytics */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🍔</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Food Sales Analysis ({timeFilter})</span>
          </div>
          
          {/* Best vs Poorest Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setViewBestItems(true)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                background: viewBestItems ? 'var(--brand-dim)' : 'transparent',
                color: viewBestItems ? 'var(--brand)' : 'var(--text-secondary)'
              }}
            >
              Top 5 Best
            </button>
            <button
              onClick={() => setViewBestItems(false)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                background: !viewBestItems ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: !viewBestItems ? 'var(--error)' : 'var(--text-secondary)'
              }}
            >
              Poorest 5
            </button>
          </div>
        </div>

        {displayedFoodItems.length === 0 || (displayedFoodItems.length === 1 && displayedFoodItems[0].qty === 0) ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            No sales matching this timeframe. Try shifting the timeframe to lifetime.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayedFoodItems.map((item, i) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: viewBestItems 
                    ? (i === 0 ? 'rgba(255,215,0,0.2)' : 'var(--bg-elevated)')
                    : 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, 
                  color: viewBestItems 
                    ? (i === 0 ? '#FFD700' : 'var(--text-muted)')
                    : 'var(--error)',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 2,
                      border: `1px solid ${item.isVeg ? '#22c55e' : '#ef4444'}`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.isVeg ? '#22c55e' : '#ef4444' }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                      {item.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                      (Week: {item.qtyWeek} | Month: {item.qtyMonth})
                    </span>
                  </div>
                  <MiniBar value={item.qty} max={foodMaxQty} color={viewBestItems ? 'var(--brand)' : 'var(--error)'} />
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: viewBestItems ? 'var(--brand)' : 'var(--error)' }}>
                    {item.qty} sold
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {state.restaurant.currency}{item.revenue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Deep Meal Analysis Dashboard Pop-up Modal */}
      {showDeepMealAnalysis && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={() => setShowDeepMealAnalysis(false)}
        >
          {/* Modal Container */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  background: 'rgba(255, 125, 0, 0.15)',
                  color: 'var(--brand)',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <UtensilsCrossed size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
                    Deep Meals Insights &amp; Menu Analytics
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                    Comprehensive metrics &amp; menu engineering matrix ({timeFilter})
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowDeepMealAnalysis(false)}
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  fontSize: 14,
                  fontWeight: 'bold',
                  border: 'none',
                }}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Veg vs Non-Veg breakdown */}
                <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>Veg vs. Non-Veg Sales Share</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    <span style={{ color: 'var(--success)' }}>🟢 Veg ({vegPct}%)</span>
                    <span style={{ color: 'var(--error)' }}>🔴 Non-Veg ({nonVegPct}%)</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, display: 'flex', overflow: 'hidden', marginBottom: 14 }}>
                    <div style={{ width: `${vegPct}%`, background: 'var(--success)', height: '100%' }} />
                    <div style={{ width: `${nonVegPct}%`, background: 'var(--error)', height: '100%' }} />
                  </div>
                  
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Revenue Contribution Share</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                    <span style={{ color: 'var(--success)' }}>💸 Veg ({vegRevPct}%)</span>
                    <span style={{ color: 'var(--error)' }}>💸 Non-Veg ({nonVegRevPct}%)</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: `${vegRevPct}%`, background: 'var(--success)', height: '100%' }} />
                    <div style={{ width: `${nonVegRevPct}%`, background: 'var(--error)', height: '100%' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                    Based on {state.restaurant.currency}{totalMealRev.toLocaleString('en-IN')} food revenue.
                  </div>
                </div>

                {/* Variant / Add-on statistics */}
                <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Add-on / Variant Usage Metrics</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>Orders with customizations/add-ons:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{variantUsageOrderPct}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>Total customization revenue:</span>
                        <strong style={{ color: 'var(--brand)' }}>{state.restaurant.currency}{totalVariantSales.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Featured Items Performance</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>Revenue from Featured/Bestsellers:</span>
                        <strong style={{ color: 'var(--brand)' }}>{featuredPct}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>Featured Items Revenue amount:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{state.restaurant.currency}{featuredRevenue.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Top Customised Items */}
                <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>Top Customised Food Items</div>
                  {topCustomised.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No customised items ordered yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {topCustomised.map(([name, count], idx) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{idx + 1}. {name}</span>
                          <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{count} custom orders</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Popular Variants / Add-ons */}
                <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>Most Popular Custom Variants</div>
                  {topVariants.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No variant customizations ordered yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {topVariants.map(([name, count], idx) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{idx + 1}. {name}</span>
                          <span style={{ color: 'var(--success)', fontWeight: 700 }}>{count} selections</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* BCG Menu Engineering Matrix */}
              <div style={{
                background: 'var(--bg-elevated)',
                padding: 20,
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Menu Engineering Matrix (BCG Classification)</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Grades dishes based on sales volume (popularity) and total revenue (profitability) to guide menu optimization.
                </p>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}>
                  {/* Stars */}
                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#22c55e', display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                      <span>⭐ Stars</span>
                      <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.15)', padding: '1px 6px', borderRadius: 4 }}>High Vol, High Rev</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {stars.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None classified yet</span>
                      ) : stars.map(item => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.qty} sold</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Puzzles */}
                  <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                      <span>🧩 Puzzles</span>
                      <span style={{ fontSize: 9, background: 'rgba(59,130,246,0.15)', padding: '1px 6px', borderRadius: 4 }}>Low Vol, High Rev</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {puzzles.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None classified yet</span>
                      ) : puzzles.map(item => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.qty} sold</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Plowhorses */}
                  <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#eab308', display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                      <span>🐴 Plowhorses</span>
                      <span style={{ fontSize: 9, background: 'rgba(234,179,8,0.15)', padding: '1px 6px', borderRadius: 4 }}>High Vol, Low Rev</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {plowhorses.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None classified yet</span>
                      ) : plowhorses.map(item => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.qty} sold</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dogs */}
                  <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                      <span>🐕 Dogs</span>
                      <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 4 }}>Low Vol, Low Rev</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dogs.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None classified yet</span>
                      ) : dogs.map(item => (
                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.qty} sold</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Deep Category Metrics */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>Category Metrics Analysis</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Category</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Average Star Rating</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Average Preparation Delay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryDeepList.map(cat => (
                        <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{cat.icon} {cat.name}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--brand)', fontWeight: 800 }}>⭐ {cat.avgRating} / 5.0</td>
                          <td style={{ padding: '10px 12px' }}>⏱️ {cat.avgTime} minutes</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setShowDeepMealAnalysis(false)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Performance Analytics Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Award size={18} color="var(--brand)" />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Table Performance Analytics ({timeFilter})</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average Sales Per Table</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>
              {state.restaurant.currency}{revPerTable.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Most Profitable Table</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
              {mostProfitableTable && mostProfitableTable.revenue > 0 ? (
                <>Table {mostProfitableTable.tableNumber} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>({state.restaurant.currency}{mostProfitableTable.revenue})</span></>
              ) : 'No Data'}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Slower Tables (Least Orders)</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {slowerTables.length > 0 && slowerTables[0].orderCount === 0 ? (
                slowerTables.filter(t => t.orderCount === 0).map(t => (
                  <span key={t.id} style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: 6 }}>
                     Table {t.tableNumber}
                  </span>
                ))
              ) : slowerTables.length > 0 ? (
                slowerTables.slice(0, 3).map(t => (
                  <span key={t.id} style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: 6 }}>
                    Table {t.tableNumber} ({t.orderCount} ord)
                  </span>
                ))
              ) : (
                'No Data'
              )}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Table Name</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Orders Count</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Total Revenue</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Average Bill Size</th>
              </tr>
            </thead>
            <tbody>
              {tableList.sort((a, b) => b.revenue - a.revenue).map((table, idx) => (
                <tr key={table.id} style={{ borderBottom: idx < tableList.length - 1 ? '1px solid var(--border)' : 'none', color: 'var(--text-secondary)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>Table {table.tableNumber}</td>
                  <td style={{ padding: '10px 12px' }}>{table.orderCount} orders</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 700 }}>
                    {state.restaurant.currency}{table.revenue.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {state.restaurant.currency}{table.avgBill.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Modal for Restaurant Health Score */}
      {showHealthModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setShowHealthModal(false)}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 20,
            padding: '24px 20px', width: '90%', maxWidth: 420,
            border: '1px solid var(--border-elevated)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
              How is Health Score Calculated?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '18px', marginBottom: 16 }}>
              The Overall Restaurant Health Score is a unified KPI that grades your operational and financial health out of 100.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', width: 36, textAlign: 'right' }}>40%</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Customer Satisfaction</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average star ratings left by customers on completed orders.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', width: 36, textAlign: 'right' }}>30%</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Order Volume & Velocity</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total number of completed orders served to tables.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', width: 36, textAlign: 'right' }}>20%</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Customer Retention</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Percentage of repeat guests ordering at your outlet.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', width: 36, textAlign: 'right' }}>10%</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Preparation Speed</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average duration to cook and deliver orders to tables.</div>
                </div>
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={() => setShowHealthModal(false)}>
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
