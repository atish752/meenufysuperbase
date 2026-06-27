/* ============================================================
   MEENUFY LANDING PAGE — App Logic
   Tool data, search/filter, mobile nav, interactions
   ============================================================ */

// =============================================
// TOOL DATA
// =============================================
const TOOLS = [

  // ---- Calculators ----
  {
    id: 'food-cost-calc',
    group: 'calculator',
    icon: '🍽️',
    iconBg: '#fff7ed',
    title: 'Food Cost Calculator',
    desc: 'Calculate food cost % and compare vs the healthy 28–35% benchmark.',
    badge: 'popular',
    tags: ['calculator', 'food cost', 'percentage'],
  },
  {
    id: 'profit-margin-calc',
    group: 'calculator',
    icon: '📊',
    iconBg: '#f0fdf4',
    title: 'Profit Margin Calculator',
    desc: 'Instantly find gross & net profit margin for your restaurant.',
    badge: 'popular',
    tags: ['calculator', 'profit', 'margin', 'revenue'],
  },
  {
    id: 'recipe-cost-calc',
    group: 'calculator',
    icon: '📋',
    iconBg: '#eff6ff',
    title: 'Recipe Cost Calculator',
    desc: 'Per-dish cost with ingredient inputs, unit conversions, and 18+ currencies.',
    badge: 'popular',
    tags: ['calculator', 'recipe', 'dish cost', 'menu'],
  },
  {
    id: 'menu-pricing-calc',
    group: 'calculator',
    icon: '💰',
    iconBg: '#fdf4ff',
    title: 'Menu Pricing Calculator',
    desc: 'Set the ideal selling price using the food cost % formula.',
    badge: null,
    tags: ['calculator', 'pricing', 'menu'],
  },
  {
    id: 'breakeven-calc',
    group: 'calculator',
    icon: '📈',
    iconBg: '#fff1f2',
    title: 'Break-Even Calculator',
    desc: 'Know exactly what revenue you need to cover all your costs.',
    badge: null,
    tags: ['calculator', 'break even', 'costs', 'revenue'],
  },
  {
    id: 'labor-cost-calc',
    group: 'calculator',
    icon: '👥',
    iconBg: '#f0fdfa',
    title: 'Labor Cost Calculator',
    desc: 'Staff costs as % of revenue with industry benchmark comparison.',
    badge: null,
    tags: ['calculator', 'labor', 'staff', 'wages'],
  },
  {
    id: 'revenue-calc',
    group: 'calculator',
    icon: '💵',
    iconBg: '#f7fee7',
    title: 'Restaurant Revenue Calculator',
    desc: 'Projected daily, monthly, and annual revenue by restaurant type.',
    badge: null,
    tags: ['calculator', 'revenue', 'sales', 'forecast'],
  },
  {
    id: 'startup-cost-calc',
    group: 'calculator',
    icon: '🏗️',
    iconBg: '#fffbeb',
    title: 'Startup Cost Calculator',
    desc: 'Full budget for QSR, café, fine dining & cloud kitchen concepts.',
    badge: null,
    tags: ['calculator', 'startup', 'opening cost', 'budget'],
  },

  // ---- QR Tools ----
  {
    id: 'qr-code-gen',
    group: 'qr',
    icon: '📱',
    iconBg: '#eff6ff',
    title: 'Free QR Code Generator',
    desc: 'Create restaurant-branded QR codes for any table. Free & instant.',
    badge: 'hot',
    tags: ['qr', 'code', 'generator', 'free', 'table'],
  },
  {
    id: 'table-qr-gen',
    group: 'qr',
    icon: '🪑',
    iconBg: '#f0f9ff',
    title: 'Table QR Code Generator',
    desc: 'Per-table QR codes with your restaurant logo and branding.',
    badge: 'popular',
    tags: ['qr', 'table', 'branded', 'qr code'],
  },
  {
    id: 'menu-qr-gen',
    group: 'qr',
    icon: '🍕',
    iconBg: '#fff7ed',
    title: 'Digital Menu QR Generator',
    desc: 'Convert your menu to a QR-accessible digital page. Scan & order.',
    badge: 'hot',
    tags: ['qr', 'digital menu', 'scan', 'order'],
  },
  {
    id: 'wifi-qr-gen',
    group: 'qr',
    icon: '📶',
    iconBg: '#f0fdf4',
    title: 'Restaurant WiFi QR Code',
    desc: 'Let guests connect to WiFi by scanning — no password typing needed.',
    badge: null,
    tags: ['qr', 'wifi', 'guest', 'connectivity'],
  },
  {
    id: 'review-qr-gen',
    group: 'qr',
    icon: '🌟',
    iconBg: '#fffbeb',
    title: 'Google Review QR Code',
    desc: 'Point happy customers directly to your Google Reviews page.',
    badge: 'new',
    tags: ['qr', 'google', 'reviews', 'rating'],
  },

  // ---- Growth & Profitability ----
  {
    id: 'table-turnover-calc',
    group: 'growth',
    icon: '⏱️',
    iconBg: '#f0fdf4',
    title: 'Table Turnover Calculator',
    desc: 'See how much revenue you lose per day from slow table turns.',
    badge: 'hot',
    tags: ['growth', 'table turnover', 'revenue', 'speed'],
  },
  {
    id: 'waiter-savings-calc',
    group: 'growth',
    icon: '🤖',
    iconBg: '#fff7ed',
    title: 'Waiter Cost Savings Calc',
    desc: 'Estimate monthly savings from automating manual order-taking.',
    badge: 'new',
    tags: ['growth', 'waiter', 'savings', 'automation', 'cost'],
  },
  {
    id: 'menu-engineering',
    group: 'growth',
    icon: '🎯',
    iconBg: '#fdf4ff',
    title: 'Menu Engineering Matrix',
    desc: 'Find Stars, Plowhorses, Puzzles & Dogs across your full menu.',
    badge: 'new',
    tags: ['growth', 'menu', 'engineering', 'profitable', 'analysis'],
  },
  {
    id: 'loyalty-roi-calc',
    group: 'growth',
    icon: '❤️',
    iconBg: '#fff1f2',
    title: 'Loyalty Program ROI Calc',
    desc: 'Project revenue uplift from launching a loyalty points program.',
    badge: null,
    tags: ['growth', 'loyalty', 'roi', 'repeat customers'],
  },
  {
    id: 'google-review-sim',
    group: 'growth',
    icon: '⭐',
    iconBg: '#fffbeb',
    title: 'Google Review Simulator',
    desc: 'Exactly how many 5-star reviews to reach your target rating.',
    badge: 'new',
    tags: ['growth', 'google', 'review', 'rating', 'stars'],
  },

  // ---- Staff Tools ----
  {
    id: 'tip-pooling-calc',
    group: 'staff',
    icon: '💡',
    iconBg: '#f0fdfa',
    title: 'Tip Pooling Calculator',
    desc: 'Split tips fairly between front-of-house and back-of-house staff.',
    badge: null,
    tags: ['staff', 'tips', 'pooling', 'distribution'],
  },
  {
    id: 'labor-schedule',
    group: 'staff',
    icon: '📅',
    iconBg: '#eff6ff',
    title: 'Staff Scheduling Tool',
    desc: 'Create weekly staff rosters and calculate total labor cost.',
    badge: 'soon',
    tags: ['staff', 'schedule', 'roster', 'planning'],
  },
  {
    id: 'shift-cost-calc',
    group: 'staff',
    icon: '🕐',
    iconBg: '#fdf4ff',
    title: 'Shift Cost Calculator',
    desc: 'Calculate the true cost of every shift including overtime.',
    badge: 'soon',
    tags: ['staff', 'shift', 'cost', 'overtime'],
  },

  // ---- Guides ----
  {
    id: 'guide-reduce-waiters',
    group: 'guide',
    icon: '📖',
    iconBg: '#fdf4ff',
    title: 'Reduce Waiter Dependency',
    desc: 'How to reduce waiter costs without sacrificing hospitality (2025 guide).',
    badge: null,
    tags: ['guide', 'waiter', 'staff', 'automation'],
  },
  {
    id: 'guide-table-turnover',
    group: 'guide',
    icon: '🚀',
    iconBg: '#f0fdf4',
    title: 'Increase Table Turnover',
    desc: 'Proven tactics to serve more covers without rushing customers.',
    badge: null,
    tags: ['guide', 'table turnover', 'service', 'revenue'],
  },
  {
    id: 'guide-qr-vs-paper',
    group: 'guide',
    icon: '📝',
    iconBg: '#eff6ff',
    title: 'QR Menu vs Paper Menu',
    desc: 'Complete comparison with real data for restaurant owners.',
    badge: null,
    tags: ['guide', 'qr menu', 'paper menu', 'comparison'],
  },
  {
    id: 'guide-loyalty-program',
    group: 'guide',
    icon: '🎁',
    iconBg: '#fff1f2',
    title: 'Restaurant Loyalty Setup',
    desc: 'Step-by-step guide to a loyalty program that actually retains customers.',
    badge: null,
    tags: ['guide', 'loyalty', 'program', 'repeat customers'],
  },
  {
    id: 'guide-google-reviews',
    group: 'guide',
    icon: '🌟',
    iconBg: '#fffbeb',
    title: 'Get 100+ Google Reviews',
    desc: 'QR redirect strategy to collect 5-star reviews on autopilot.',
    badge: null,
    tags: ['guide', 'google', 'reviews', 'rating'],
  },
  {
    id: 'guide-menu-pricing',
    group: 'guide',
    icon: '💡',
    iconBg: '#f7fee7',
    title: 'How to Price Your Menu',
    desc: 'Pricing strategy for maximum profit — formulas & benchmarks.',
    badge: null,
    tags: ['guide', 'pricing', 'menu', 'profit'],
  },
  {
    id: 'guide-analytics',
    group: 'guide',
    icon: '📉',
    iconBg: '#f0fdfa',
    title: 'Restaurant Analytics Guide',
    desc: 'Which KPIs to track, how to read them, and how to act on them.',
    badge: null,
    tags: ['guide', 'analytics', 'kpi', 'data'],
  },
  {
    id: 'guide-menu-engineering',
    group: 'guide',
    icon: '🍕',
    iconBg: '#fff7ed',
    title: 'Menu Engineering Guide',
    desc: 'Find and promote your most profitable dishes using real sales data.',
    badge: null,
    tags: ['guide', 'menu engineering', 'profit', 'dishes'],
  },
];

// =============================================
// STATE
// =============================================
let activeFilter = 'all';
let searchQuery  = '';

// =============================================
// RENDER A SINGLE CARD
// =============================================
function renderCard(tool, delay = 0) {
  const badgeHtml = (() => {
    if (!tool.badge) return '';
    const map = {
      popular: ['badge-popular', '⚡ Popular'],
      hot:     ['badge-hot',     '🔥 Hot'],
      new:     ['badge-new',     '✨ New'],
      soon:    ['badge-soon',    'Coming Soon'],
    };
    const [cls, label] = map[tool.badge] || ['badge-soon', tool.badge];
    return `<span class="card-badge ${cls}">${label}</span>`;
  })();

  return `
    <div class="tool-card" data-id="${tool.id}" data-group="${tool.group}"
         style="animation-delay:${delay}ms"
         onclick="onToolClick('${tool.id}', event)">
      <div class="card-icon-wrap" style="background:${tool.iconBg}">${tool.icon}</div>
      <div class="card-title">${tool.title}</div>
      <div class="card-desc">${tool.desc}</div>
      ${badgeHtml}
    </div>`;
}

// =============================================
// FILL A GRID
// =============================================
function fillGrid(gridId, tools) {
  const el = document.getElementById(gridId);
  if (!el) return;
  el.innerHTML = tools.length
    ? tools.map((t, i) => renderCard(t, i * 25)).join('')
    : '';
}

// =============================================
// RENDER BASED ON CURRENT FILTER + SEARCH
// =============================================
function render() {
  const q = searchQuery.trim().toLowerCase();

  const groups = ['calculator', 'qr', 'growth', 'staff', 'guide'];

  let totalVisible = 0;

  groups.forEach(group => {
    const groupEl  = document.getElementById(groupMap[group]);
    const filtered = TOOLS.filter(t => {
      const inGroup  = activeFilter === 'all' || activeFilter === group;
      const inSearch = !q || t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q));
      return t.group === group && inGroup && inSearch;
    });

    fillGrid(`grid-${group}`, filtered);
    totalVisible += filtered.length;

    if (groupEl) {
      groupEl.style.display = filtered.length > 0 ? 'block' : 'none';
    }
  });

  const noResults = document.getElementById('noResults');
  if (noResults) noResults.style.display = totalVisible === 0 ? 'block' : 'none';
}

const groupMap = {
  calculator: 'calculators',
  qr:         'qr-tools',
  growth:     'growth-tools',
  staff:      'staff-tools',
  guide:      'guides',
};

// =============================================
// TOOL CLICK → TOAST
// =============================================
function onToolClick(id, e) {
  e.preventDefault();
  if (id === 'food-cost-calc') {
    window.location.href = '/tools/food-cost-calculator/';
    return;
  }
  const tool = TOOLS.find(t => t.id === id);
  if (!tool) return;

  const isSoon = tool.badge === 'soon';
  showToast(
    isSoon
      ? `🚧 <b>${tool.title}</b> is coming soon! Meanwhile, <a href="/" style="color:var(--brand);font-weight:700">try Meenufy free</a>.`
      : `🚧 <b>${tool.title}</b> is being built! <a href="/" style="color:var(--brand);font-weight:700">Try Meenufy</a> — the full platform.`
  );
}

// =============================================
// TOAST
// =============================================
function showToast(msg) {
  let wrap = document.getElementById('toastContainer');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastContainer';
    document.body.appendChild(wrap);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = msg;
  wrap.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

// =============================================
// SEARCH
// =============================================
let searchTimer;

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  searchQuery = '';
  render();
}

// =============================================
// NAVBAR SCROLL
// =============================================
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 10 ? '0 2px 12px rgba(0,0,0,0.07)' : 'none';
  }, { passive: true });
}

// =============================================
// MOBILE NAV
// =============================================
function initMobileNav() {
  const btn  = document.getElementById('hamburger');
  const menu = document.getElementById('mobileNav');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  });

  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // Initial render
  render();

  // Navbar
  initNavbarScroll();
  initMobileNav();

  // Search
  const inp = document.getElementById('searchInput');
  const clr = document.getElementById('searchClear');

  inp.addEventListener('input', () => {
    searchQuery = inp.value;
    clr.style.display = searchQuery ? 'flex' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 180);
  });

  clr.addEventListener('click', clearSearch);

  // Filter tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeFilter = tab.dataset.filter;
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      render();
    });
  });
});
