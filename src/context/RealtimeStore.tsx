// ============================================================
// MEENUFY REALTIME STORE
// Cross-tab state sync via BroadcastChannel + localStorage
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { db, hasFirebaseConfig } from '../utils/firebase';
import { 
  ref, 
  set, 
  update, 
  remove, 
  onValue 
} from 'firebase/database';

// ─── Types ──────────────────────────────────────────────────
export type MenuCategory = {
  id: string;
  name: string;
  icon: string;
  restaurantId?: string;
};

export type MenuItemVariant = {
  name: string;
  price: number;
};

export type NutritionInfo = {
  enabled: boolean;
  calories?: number;
  carbs?: number;
  sugar?: number;
  protein?: number;
  fats?: number;
  custom?: { label: string; value: number }[];
};

export type MealSchedule = {
  id: string;
  name: string;          // e.g. "Breakfast"
  fromTime: string;      // "08:00"
  toTime: string;        // "11:00"
  targets: { type: 'category' | 'item'; id: string }[];
};

export type MenuItem = {
  id: string;
  restaurantId?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isVeg: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  tags: string[];
  variants?: MenuItemVariant[];
  nutrition?: NutritionInfo;
};

export type OrderItem = {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  variant?: MenuItemVariant;
};

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'bill_pay' | 'served' | 'cancelled';

export type Order = {
  id: string;
  tableNumber: number;
  tableId: string;
  restaurantId?: string;
  restaurantName?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  specialNote: string;
  numberOfGuests?: number;
  createdAt: number;
  updatedAt: number;
  paymentMethod?: 'upi' | 'card' | 'cash';
  paymentStatus?: 'pending' | 'waiting_confirmation' | 'paid';
  ratings?: Record<string, number>;
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointsDiscountApplied?: number;
};

export type TableInfo = {
  id: string;
  number: number;
  label: string;
  capacity: number;
  isActive: boolean;
  status?: 'active' | 'maintenance'; // 'active' is default
};

export type RestaurantInfo = {
  name: string;
  tagline: string;
  description: string;
  logo: string;
  bannerImage: string;
  address: string;
  phone: string;
  email: string;
  openTime: string;
  closeTime: string;
  currency: string;
  tableCount: number;
  theme: 'dark';
  posterImage?: string;
  posterRatio?: '1:1' | '3:4' | '9:16';
  locationVerificationEnabled?: boolean;
  latitude?: number;
  longitude?: number;
  verificationRadius?: number;
  googleMapsUrl?: string;
  loyaltyEnabled?: boolean;
  pointsPer100Spent?: number;
  pointValueInRupees?: number;
  mustLoginBeforeOrder?: boolean;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  orderCount: number;
  totalSpent: number;
  lastVisit: number;
  firstVisit: number;
  isVip?: boolean;
  points?: number;
};

export type WalletTransaction = {
  id: string;
  amount: number;
  type: 'deduction' | 'topup';
  description: string;
  createdAt: number;
};

export type RestaurantAccount = {
  id: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  restaurantName: string;
  walletBalance: number;
  status: 'active' | 'blocked';
  createdAt: number;
  password?: string;
};

export type SupportRequest = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  message: string;
  attemptsCount: number;
  createdAt: number;
  status: 'pending' | 'resolved';
  replyText?: string;
};

export type OwnerFeedback = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  message: string;
  createdAt: number;
  replyText?: string;
};

export type WaiterRequest = {
  id: string;
  tableNumber: number;
  tableId: string;
  restaurantId?: string;
  createdAt: number;
  resolved: boolean;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  restaurantId: string;
  isLoggedIn: boolean;
  isSuperAdmin?: boolean;
  password?: string;
};

export type Toast = {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

export type AppState = {
  // Auth
  admin: AdminUser | null;
  isAdminLoggedIn: boolean;
  // View
  currentView: 'admin' | 'customer';
  adminTab: 'home' | 'menu' | 'customers' | 'analysis' | 'more';
  customerTab: 'home' | 'menu' | 'orders' | 'more';
  customerTableId: string | null;
  // Restaurant
  restaurant: RestaurantInfo;
  // Menu
  categories: MenuCategory[];
  menuItems: MenuItem[];
  // Orders
  orders: Order[];
  // Cart (customer side)
  cart: OrderItem[];
  // Tables
  tables: TableInfo[];
  // Customers
  customers: CustomerRecord[];
  // Schedules
  schedules: MealSchedule[];
  // Waiter requests
  waiterRequests: WaiterRequest[];
  // Wallet
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  // Restaurant Accounts (Super Admin)
  restaurantAccounts: RestaurantAccount[];
  // Gemini API Keys & Support / Feedback
  geminiApiKeys: string[];
  supportRequests: SupportRequest[];
  ownerFeedbacks: OwnerFeedback[];
  // UI
  toasts: Toast[];
  isLoading: boolean;
  newOrderAlert: Order | null;
  language: 'en' | 'hi';
  adminTheme: 'dark' | 'light';
  customerTheme: 'dark' | 'light';
  customerMenuTheme: CustomerMenuTheme;
};

export type CustomerMenuTheme = {
  primaryBg?: string;
  itemName?: string;
  itemDesc?: string;
  addToCartBg?: string;
  addToCartText?: string;
  bestsellerBg?: string;
  bestsellerText?: string;
};

// ─── Default Data ────────────────────────────────────────────
const DEFAULT_RESTAURANT: RestaurantInfo = {
  name: 'The Grand Spice',
  tagline: 'Authentic flavors, modern experience',
  description: 'A premium dining destination serving the finest Indian, Continental and Asian cuisine. Every dish is crafted with love and the freshest ingredients.',
  logo: '',
  bannerImage: '',
  address: '42, MG Road, Koramangala, Bengaluru, Karnataka 560034',
  phone: '+91 98765 43210',
  email: 'hello@grandspice.in',
  openTime: '11:00',
  closeTime: '23:00',
  currency: '₹',
  tableCount: 8,
  theme: 'dark',
  posterImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
  posterRatio: '1:1',
  locationVerificationEnabled: false,
  latitude: 12.9348,
  longitude: 77.6202,
  verificationRadius: 50,
  googleMapsUrl: '',
  loyaltyEnabled: false,
  pointsPer100Spent: 1,
  pointValueInRupees: 1,
  mustLoginBeforeOrder: false,
};

export const MOCK_RESTAURANT_INFOS: Record<string, RestaurantInfo> = {
  'admin-1': {
    name: 'The Grand Spice',
    tagline: 'Authentic flavors, modern experience',
    description: 'A premium dining destination serving the finest Indian, Continental and Asian cuisine. Every dish is crafted with love and the freshest ingredients.',
    logo: '/meenufy_logo.jpg',
    bannerImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
    address: '42, MG Road, Koramangala, Bengaluru, Karnataka 560034',
    phone: '+91 98765 43210',
    email: 'hello@grandspice.in',
    openTime: '11:00',
    closeTime: '23:00',
    currency: '₹',
    tableCount: 8,
    theme: 'dark',
    posterImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
    posterRatio: '1:1',
    locationVerificationEnabled: false,
    latitude: 12.9348,
    longitude: 77.6202,
    verificationRadius: 50,
    googleMapsUrl: '',
    loyaltyEnabled: true,
    pointsPer100Spent: 1,
    pointValueInRupees: 1,
    mustLoginBeforeOrder: false,
  },
  'admin-2': {
    name: 'Cafe Delight',
    tagline: 'Freshly brewed happiness in a cup',
    description: 'Cozy neighborhood cafe serving artisan coffee, fresh pastries, and healthy sandwiches.',
    logo: '/meenufy_logo.jpg',
    bannerImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop',
    address: '10, 80 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 87654 32109',
    email: 'priya@cafedelight.com',
    openTime: '08:00',
    closeTime: '22:00',
    currency: '₹',
    tableCount: 6,
    theme: 'dark',
    loyaltyEnabled: false,
    mustLoginBeforeOrder: false,
  },
  'admin-3': {
    name: 'Biryani House',
    tagline: 'The ultimate destination for biryani lovers',
    description: 'Serving authentic dum biryanis and kebabs prepared with traditional recipes and spices.',
    logo: '/meenufy_logo.jpg',
    bannerImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop',
    address: '77, Outer Ring Road, Marathahalli, Bengaluru, Karnataka 560037',
    phone: '+91 76543 21098',
    email: 'amit@biryanihouse.com',
    openTime: '11:30',
    closeTime: '23:30',
    currency: '₹',
    tableCount: 10,
    theme: 'dark',
    loyaltyEnabled: true,
    pointsPer100Spent: 2,
    pointValueInRupees: 1,
    mustLoginBeforeOrder: true,
  },
  'admin-4': {
    name: 'Pizzeria Napoli',
    tagline: 'Real Neapolitan pizzas in town',
    description: 'Wood-fired sourdough pizzas with fresh toppings and homemade mozzarella cheese.',
    logo: '/meenufy_logo.jpg',
    bannerImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop',
    address: '15, Church Street, Ashok Nagar, Bengaluru, Karnataka 560001',
    phone: '+91 65432 10987',
    email: 'vikram@pizzerianapoli.in',
    openTime: '12:00',
    closeTime: '23:00',
    currency: '₹',
    tableCount: 8,
    theme: 'dark',
    loyaltyEnabled: false,
    mustLoginBeforeOrder: false,
  }
};

export function getActiveRestaurantInfo(state: AppState, restaurantId: string): RestaurantInfo {
  if (state.admin && state.admin.restaurantId === restaurantId) {
    return state.restaurant;
  }
  return MOCK_RESTAURANT_INFOS[restaurantId] || MOCK_RESTAURANT_INFOS['admin-1'];
}

const DEFAULT_CATEGORIES: MenuCategory[] = [
  // admin-1 (The Grand Spice)
  { id: 'cat-1', name: 'Starters', icon: '🔥', restaurantId: 'admin-1' },
  { id: 'cat-2', name: 'Main Course', icon: '🍛', restaurantId: 'admin-1' },
  { id: 'cat-3', name: 'Breads', icon: '🫓', restaurantId: 'admin-1' },
  { id: 'cat-4', name: 'Rice & Biryani', icon: '🍚', restaurantId: 'admin-1' },
  { id: 'cat-5', name: 'Desserts', icon: '🍮', restaurantId: 'admin-1' },
  { id: 'cat-6', name: 'Beverages', icon: '🧃', restaurantId: 'admin-1' },

  // admin-2 (Cafe Delight)
  { id: 'cat-cafe-1', name: 'Coffee', icon: '☕', restaurantId: 'admin-2' },
  { id: 'cat-cafe-2', name: 'Tea & Cold Drinks', icon: '🍹', restaurantId: 'admin-2' },
  { id: 'cat-cafe-3', name: 'Sandwiches', icon: '🥪', restaurantId: 'admin-2' },
  { id: 'cat-cafe-4', name: 'Pastries', icon: '🍰', restaurantId: 'admin-2' },

  // admin-3 (Biryani House)
  { id: 'cat-biryani-1', name: 'Biryani', icon: '🥘', restaurantId: 'admin-3' },
  { id: 'cat-biryani-2', name: 'Kebabs', icon: '🍢', restaurantId: 'admin-3' },
  { id: 'cat-biryani-3', name: 'Sides', icon: '🥗', restaurantId: 'admin-3' },

  // admin-4 (Pizzeria Napoli)
  { id: 'cat-pizza-1', name: 'Napoli Pizza', icon: '🍕', restaurantId: 'admin-4' },
  { id: 'cat-pizza-2', name: 'Pasta', icon: '🍝', restaurantId: 'admin-4' },
  { id: 'cat-pizza-3', name: 'Appetizers', icon: '🥖', restaurantId: 'admin-4' },
];

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // admin-1 (The Grand Spice)
  { id: 'item-1', restaurantId: 'admin-1', name: 'Paneer Tikka', description: 'Marinated cottage cheese grilled in tandoor with spiced yoghurt', price: 320, category: 'cat-1', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['popular', 'spicy'], variants: [{ name: 'Half portion', price: 180 }, { name: 'Full portion', price: 320 }] },
  { id: 'item-2', restaurantId: 'admin-1', name: 'Chicken Seekh Kebab', description: 'Minced chicken kebabs with aromatic herbs, served with mint chutney', price: 380, category: 'cat-1', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['popular'] },
  { id: 'item-3', restaurantId: 'admin-1', name: 'Veg Spring Roll', description: 'Crispy rolls filled with stir-fried vegetables and glass noodles', price: 220, category: 'cat-1', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-4', restaurantId: 'admin-1', name: 'Dal Makhani', description: 'Slow-cooked black lentils with butter and cream, a classic comfort dish', price: 260, category: 'cat-2', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['bestseller'] },
  { id: 'item-5', restaurantId: 'admin-1', name: 'Butter Chicken', description: 'Tender chicken in rich tomato-butter gravy with aromatic spices', price: 380, category: 'cat-2', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['bestseller', 'popular'], variants: [{ name: 'Half portion', price: 240 }, { name: 'Full portion', price: 380 }] },
  { id: 'item-6', restaurantId: 'admin-1', name: 'Palak Paneer', description: 'Fresh cottage cheese cubes in a creamy spinach gravy', price: 300, category: 'cat-2', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: ['healthy'] },
  { id: 'item-7', restaurantId: 'admin-1', name: 'Garlic Naan', description: 'Soft leavened bread with garlic and butter, baked in tandoor', price: 60, category: 'cat-3', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-8', restaurantId: 'admin-1', name: 'Laccha Paratha', description: 'Flaky layered whole-wheat bread, pan-roasted with butter', price: 55, category: 'cat-3', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-9', restaurantId: 'admin-1', name: 'Chicken Biryani', description: 'Fragrant basmati rice layered with spiced chicken, saffron and fried onions', price: 420, category: 'cat-4', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['bestseller', 'popular'], variants: [{ name: 'Single serve', price: 280 }, { name: 'Double / Full', price: 420 }] },
  { id: 'item-10', restaurantId: 'admin-1', name: 'Veg Biryani', description: 'Aromatic basmati rice with seasonal vegetables and whole spices', price: 320, category: 'cat-4', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-11', restaurantId: 'admin-1', name: 'Gulab Jamun', description: 'Soft milk-solid dumplings soaked in rose-cardamom sugar syrup', price: 150, category: 'cat-5', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-12', restaurantId: 'admin-1', name: 'Rasmalai', description: 'Delicate sponge cakes in chilled saffron milk with pistachios', price: 180, category: 'cat-5', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['recommended'] },
  { id: 'item-13', restaurantId: 'admin-1', name: 'Mango Lassi', description: 'Thick yoghurt blended with Alphonso mangoes and a hint of cardamom', price: 120, category: 'cat-6', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: ['seasonal'] },
  { id: 'item-14', restaurantId: 'admin-1', name: 'Fresh Lime Soda', description: 'Freshly squeezed lime with chilled soda, sweet or salted', price: 80, category: 'cat-6', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [], variants: [{ name: 'Sweet', price: 80 }, { name: 'Salted', price: 80 }, { name: 'Mixed', price: 85 }] },

  // admin-2 (Cafe Delight)
  { id: 'item-cafe-1', restaurantId: 'admin-2', name: 'Cappuccino', description: 'Espresso with steamed milk and thick foam', price: 180, category: 'cat-cafe-1', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['popular'] },
  { id: 'item-cafe-2', restaurantId: 'admin-2', name: 'Iced Latte', description: 'Chilled espresso poured over ice and milk', price: 190, category: 'cat-cafe-1', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-cafe-3', restaurantId: 'admin-2', name: 'Chocolate Croissant', description: 'Flaky buttery pastry filled with rich chocolate', price: 140, category: 'cat-cafe-4', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['bestseller'] },
  { id: 'item-cafe-4', restaurantId: 'admin-2', name: 'Club Sandwich', description: 'Toasted bread with grilled veggies, cheese and pesto', price: 240, category: 'cat-cafe-3', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['popular'] },
  { id: 'item-cafe-5', restaurantId: 'admin-2', name: 'Blueberry Muffin', description: 'Moist muffin bursting with fresh blueberries', price: 150, category: 'cat-cafe-4', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },

  // admin-3 (Biryani House)
  { id: 'item-biryani-1', restaurantId: 'admin-3', name: 'Hyderabadi Chicken Biryani', description: 'Fragrant basmati rice cooked with succulent chicken and spices', price: 320, category: 'cat-biryani-1', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['bestseller', 'popular'] },
  { id: 'item-biryani-2', restaurantId: 'admin-3', name: 'Special Mutton Biryani', description: 'Royal dum biryani layered with tender mutton chunks', price: 420, category: 'cat-biryani-1', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['recommended'] },
  { id: 'item-biryani-3', restaurantId: 'admin-3', name: 'Veg Dum Biryani', description: 'Assorted seasonal vegetables dum cooked with saffron rice', price: 260, category: 'cat-biryani-1', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-biryani-4', restaurantId: 'admin-3', name: 'Chicken Tandoori', description: 'Spiced chicken marinated in yogurt and charcoal grilled', price: 380, category: 'cat-biryani-2', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['popular'] },
  { id: 'item-biryani-5', restaurantId: 'admin-3', name: 'Garlic Raita', description: 'Yogurt side dish seasoned with toasted garlic and cumin', price: 60, category: 'cat-biryani-3', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },

  // admin-4 (Pizzeria Napoli)
  { id: 'item-pizza-1', restaurantId: 'admin-4', name: 'Margherita Pizza', description: 'San Marzano tomatoes, fresh mozzarella, basil and olive oil', price: 350, category: 'cat-pizza-1', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: ['popular'] },
  { id: 'item-pizza-2', restaurantId: 'admin-4', name: 'Pepperoni Pizza', description: 'Spiced pepperoni slices with mozzarella and hot honey drizzle', price: 450, category: 'cat-pizza-1', image: '', isVeg: false, isAvailable: true, isFeatured: true, tags: ['bestseller'] },
  { id: 'item-pizza-3', restaurantId: 'admin-4', name: 'Alfredo Pasta', description: 'Fettuccine pasta in rich creamy parmesan butter sauce', price: 320, category: 'cat-pizza-2', image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [] },
  { id: 'item-pizza-4', restaurantId: 'admin-4', name: 'Garlic Bread Sticks', description: 'Freshly baked bread sticks brushed with garlic butter and herbs', price: 180, category: 'cat-pizza-3', image: '', isVeg: true, isAvailable: true, isFeatured: true, tags: [] },
];

function generateTables(count: number): TableInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `table-${i + 1}`,
    number: i + 1,
    label: `Table ${i + 1}`,
    capacity: i % 3 === 0 ? 6 : 4,
    isActive: true,
  }));
}

function generateMockOrders(): Order[] {
  const menu = DEFAULT_MENU_ITEMS;
  const orders: Order[] = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  const getRandomItem = () => {
    return menu[Math.floor(Math.random() * menu.length)];
  };
  
  const customerPool = [
    { name: 'Aarav Sharma', phone: '9876543210' },
    { name: 'Isha Patel', phone: '9876543211' },
    { name: 'Aditya Rao', phone: '9876543212' },
    { name: 'Riya Sen', phone: '9876543213' },
    { name: 'Kabir Singh', phone: '9876543214' },
    { name: 'Diya Mehta', phone: '9876543215' }
  ];

  // We generate around 35 orders spread across the last 30 days
  for (let i = 0; i < 35; i++) {
    const cust = customerPool[i % customerPool.length];
    const daysAgo = Math.floor(Math.random() * 30); // 0 to 29 days ago
    
    // peak hours: dinner peak (8 PM - 10 PM) or lunch peak (1 PM - 3 PM)
    const hour = Math.random() > 0.4 
      ? (Math.random() > 0.5 ? 20 : 21)
      : (Math.random() > 0.5 ? 13 : 14);
    const minute = Math.floor(Math.random() * 60);
    const date = new Date(now - daysAgo * oneDay);
    date.setHours(hour, minute, 0, 0);
    const createdAt = date.getTime();
    
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const items: OrderItem[] = [];
    let total = 0;
    
    for (let j = 0; j < itemCount; j++) {
      const menuItem = getRandomItem();
      if (items.some(it => it.menuItemId === menuItem.id)) continue;
      
      const qty = Math.floor(Math.random() * 2) + 1;
      let price = menuItem.price;
      let variant: MenuItemVariant | undefined;
      
      if (menuItem.variants && menuItem.variants.length > 0) {
        variant = menuItem.variants[Math.floor(Math.random() * menuItem.variants.length)];
        price = variant.price;
      }
      
      items.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price,
        qty,
        variant
      });
      total += price * qty;
    }
    
    const isCancelled = i === 12 || i === 27; // two cancelled orders for realistic cancellation rate
    const status = isCancelled ? 'cancelled' : 'served';
    const paymentStatus = isCancelled ? 'pending' : 'paid';
    const paymentMethod = isCancelled ? undefined : (i % 3 === 0 ? 'upi' : (i % 3 === 1 ? 'card' : 'cash'));
    
    const ratings: Record<string, number> = {};
    if (status === 'served') {
      items.forEach(it => {
        ratings[it.name] = Math.random() > 0.8 ? 3 : (Math.random() > 0.4 ? 4 : 5);
      });
    }

    const pointsEarned = Math.floor(total / 100);
    const pointsRedeemed = i % 8 === 0 ? 50 : 0;
    const pointsDiscountApplied = pointsRedeemed; // 1 point = 1 rupee
    
    orders.push({
      id: `ord-${1000 + i}`,
      tableNumber: (i % 8) + 1,
      tableId: `table-${(i % 8) + 1}`,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerEmail: `${cust.name.toLowerCase().replace(' ', '')}@gmail.com`,
      items,
      status,
      totalAmount: total - pointsDiscountApplied,
      specialNote: i % 10 === 0 ? 'Make it extra spicy' : '',
      numberOfGuests: Math.floor(Math.random() * 4) + 1,
      createdAt,
      updatedAt: createdAt + (12 + Math.floor(Math.random() * 15)) * 60 * 1000, // 12-27 mins prep time
      paymentMethod,
      paymentStatus,
      ratings,
      pointsEarned,
      pointsRedeemed,
      pointsDiscountApplied
    });
  }
  
  return orders.sort((a, b) => a.createdAt - b.createdAt);
}

function generateMockCustomers(mockOrders: Order[]): CustomerRecord[] {
  const customersMap: Record<string, CustomerRecord> = {};
  mockOrders.forEach(ord => {
    if (!ord.customerPhone) return;
    const phone = ord.customerPhone;
    if (customersMap[phone]) {
      customersMap[phone].orderCount++;
      customersMap[phone].totalSpent += ord.totalAmount;
      customersMap[phone].lastVisit = Math.max(customersMap[phone].lastVisit, ord.createdAt);
      customersMap[phone].firstVisit = Math.min(customersMap[phone].firstVisit, ord.createdAt);
      customersMap[phone].points = (customersMap[phone].points || 0) + (ord.pointsEarned || 0) - (ord.pointsRedeemed || 0);
    } else {
      customersMap[phone] = {
        id: `cust-${phone}`,
        name: ord.customerName,
        phone: ord.customerPhone,
        email: ord.customerEmail,
        orderCount: 1,
        totalSpent: ord.totalAmount,
        lastVisit: ord.createdAt,
        firstVisit: ord.createdAt,
        points: (ord.pointsEarned || 0) - (ord.pointsRedeemed || 0),
        isVip: phone === '9876543210' || phone === '9876543213'
      };
    }
  });
  return Object.values(customersMap);
}

const MOCK_ORDERS = generateMockOrders();
const MOCK_CUSTOMERS = generateMockCustomers(MOCK_ORDERS);

const DEFAULT_STATE: AppState = {
  admin: null,
  isAdminLoggedIn: false,
  currentView: 'admin',
  adminTab: 'home',
  customerTab: 'home',
  customerTableId: null,
  restaurant: DEFAULT_RESTAURANT,
  categories: DEFAULT_CATEGORIES,
  menuItems: DEFAULT_MENU_ITEMS,
  orders: MOCK_ORDERS,
  cart: [],
  tables: generateTables(8),
  customers: MOCK_CUSTOMERS,
  schedules: [],
  waiterRequests: [],
  walletBalance: 300,
  walletTransactions: [
    {
      id: 'tx-initial',
      amount: 300,
      type: 'topup',
      description: 'Monthly allowance top-up (June 2026)',
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000
    }
  ],
  restaurantAccounts: [
    {
      id: 'admin-1',
      ownerName: 'Atish',
      ownerEmail: 'atish3477',
      ownerPhone: '+91 98765 43210',
      restaurantName: 'The Grand Spice',
      walletBalance: 300,
      status: 'active' as const,
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      password: 'atish3477',
    },
    {
      id: 'admin-2',
      ownerName: 'Priya Patel',
      ownerEmail: 'priya@cafedelight.com',
      ownerPhone: '+91 87654 32109',
      restaurantName: 'Cafe Delight',
      walletBalance: 450,
      status: 'active' as const,
      createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
      password: 'priya@cafedelight.com',
    },
    {
      id: 'admin-3',
      ownerName: 'Amit Singh',
      ownerEmail: 'amit@biryanihouse.com',
      ownerPhone: '+91 76543 21098',
      restaurantName: 'Biryani House',
      walletBalance: 25,
      status: 'active' as const,
      createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
      password: 'amit@biryanihouse.com',
    },
    {
      id: 'admin-4',
      ownerName: 'Vikram Rao',
      ownerEmail: 'vikram@pizzerianapoli.in',
      ownerPhone: '+91 65432 10987',
      restaurantName: 'Pizzeria Napoli',
      walletBalance: 120,
      status: 'blocked' as const,
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      password: 'vikram@pizzerianapoli.in',
    }
  ],
  geminiApiKeys: [
    'AIzaSyD_FakeGeminiKey_Alpha01',
    'AIzaSyE_FakeGeminiKey_Beta02',
    'AIzaSyF_FakeGeminiKey_Gamma03'
  ],
  supportRequests: [],
  ownerFeedbacks: [
    {
      id: 'fb-1',
      restaurantId: 'admin-1',
      restaurantName: 'The Grand Spice',
      ownerName: 'Atish',
      ownerEmail: 'atish3477',
      message: 'Meenufy is saving us 2 hours a day on menu management! Suggest adding support for table reservations.',
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
    },
    {
      id: 'fb-2',
      restaurantId: 'admin-2',
      restaurantName: 'Cafe Delight',
      ownerName: 'Priya Patel',
      ownerEmail: 'priya@cafedelight.com',
      message: 'The new PWA notifications work amazingly well on my Android phone. Can you please add sound options?',
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000
    }
  ],
  toasts: [],
  isLoading: false,
  newOrderAlert: null,
  language: 'en',
  adminTheme: 'dark',
  customerTheme: 'dark',
  customerMenuTheme: {
    primaryBg: '',
    itemName: '',
    itemDesc: '',
    addToCartBg: '',
    addToCartText: '',
    bestsellerBg: '',
    bestsellerText: '',
  },
};

// ─── Actions ─────────────────────────────────────────────────
type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'SET_ADMIN_TAB'; payload: AppState['adminTab'] }
  | { type: 'SET_CUSTOMER_TAB'; payload: AppState['customerTab'] }
  | { type: 'SET_VIEW'; payload: AppState['currentView'] }
  | { type: 'LOGIN_ADMIN'; payload: AdminUser }
  | { type: 'LOGOUT_ADMIN' }
  | { type: 'UPDATE_RESTAURANT'; payload: Partial<RestaurantInfo> }
  | { type: 'ADD_MENU_ITEM'; payload: MenuItem }
  | { type: 'UPDATE_MENU_ITEM'; payload: MenuItem }
  | { type: 'DELETE_MENU_ITEM'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: MenuCategory }
  | { type: 'UPDATE_CATEGORY'; payload: MenuCategory }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'PLACE_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER_STATUS'; payload: { id: string; status: OrderStatus } }
  | { type: 'UPDATE_ORDER_PAYMENT'; payload: { id: string; method?: 'upi' | 'card' | 'cash'; status?: 'pending' | 'waiting_confirmation' | 'paid' } }
  | { type: 'RATE_ORDER'; payload: { id: string; ratings: Record<string, number> } }
  | { type: 'ADD_TO_CART'; payload: OrderItem }
  | { type: 'REMOVE_FROM_CART'; payload: string | { menuItemId: string; variantName?: string } }
  | { type: 'UPDATE_CART_QTY'; payload: { menuItemId: string; qty: number; variantName?: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CUSTOMER_TABLE'; payload: string }
  | { type: 'SET_TABLES'; payload: TableInfo[] }
  | { type: 'UPDATE_TABLE_STATUS'; payload: { id: string; status: 'active' | 'maintenance' } }
  | { type: 'ADD_SCHEDULE'; payload: MealSchedule }
  | { type: 'UPDATE_SCHEDULE'; payload: MealSchedule }
  | { type: 'DELETE_SCHEDULE'; payload: string }
  | { type: 'CALL_WAITER'; payload: WaiterRequest }
  | { type: 'RESOLVE_WAITER'; payload: string }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'CLEAR_NEW_ORDER_ALERT' }
  | { type: 'TOGGLE_ADMIN_THEME' }
  | { type: 'TOGGLE_CUSTOMER_THEME' }
  | { type: 'TOGGLE_CUSTOMER_VIP'; payload: string }
  | { type: 'ADJUST_CUSTOMER_POINTS'; payload: { id: string; points: number } }
  | { type: 'TOP_UP_WALLET'; payload: number }
  | { type: 'ADD_MONTHLY_TOPUP'; payload: string }
  | { type: 'SUPER_ADMIN_TOP_UP'; payload: { email: string; amount: number } }
  | { type: 'SUPER_ADMIN_DEDUCT'; payload: { email: string; amount: number } }
  | { type: 'SUPER_ADMIN_TOGGLE_BLOCK'; payload: { email: string } }
  | { type: 'ADD_GEMINI_KEY'; payload: string }
  | { type: 'REMOVE_GEMINI_KEY'; payload: string }
  | { type: 'SUBMIT_SUPPORT_REQUEST'; payload: { message: string; attemptsCount: number } }
  | { type: 'REPLY_SUPPORT_REQUEST'; payload: { id: string; replyText: string } }
  | { type: 'SUBMIT_FEEDBACK'; payload: string }
  | { type: 'DELETE_FEEDBACK'; payload: string }
  | { type: 'REPLY_FEEDBACK'; payload: { id: string; replyText: string } }
  | { type: 'UPDATE_CUSTOMER_THEME_COLORS'; payload: Partial<CustomerMenuTheme> }
  | { type: 'REMAP_ORPHAN_DATA'; payload: { fromId: string; toId: string } }
  | { type: 'UNFEATURED_ALL_ITEMS' }
  | { type: 'DELETE_ALL_MENU_ITEMS' }
  | { type: 'SET_LOADING'; payload: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE': return { ...state, ...action.payload };
    case 'SET_ADMIN_TAB': return { ...state, adminTab: action.payload };
    case 'SET_CUSTOMER_TAB': return { ...state, customerTab: action.payload };
    case 'SET_VIEW': return { ...state, currentView: action.payload };
    case 'LOGIN_ADMIN': {
      const email = action.payload.email;
      const name = action.payload.name;
      const isSuper = action.payload.isSuperAdmin;
      
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.ownerEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
          if (!acc.password && action.payload.password) {
            return { ...acc, password: action.payload.password };
          }
        }
        return acc;
      });
      
      let existingAccount = newAccounts.find(
        acc => acc.ownerEmail.trim().toLowerCase() === email.trim().toLowerCase()
      );
      
      if (!isSuper && !existingAccount) {
        existingAccount = {
          id: action.payload.id,
          ownerName: name,
          ownerEmail: email,
          ownerPhone: state.restaurant.phone || '+91 99999 88888',
          restaurantName: state.restaurant.name,
          walletBalance: 300,
          status: 'active',
          createdAt: Date.now(),
          password: action.payload.password
        };
        newAccounts.push(existingAccount);
      }
      
      const activeBalance = existingAccount ? existingAccount.walletBalance : state.walletBalance;
      
      return { 
        ...state, 
        admin: action.payload, 
        isAdminLoggedIn: true,
        restaurantAccounts: newAccounts,
        walletBalance: isSuper ? state.walletBalance : activeBalance
      };
    }
    case 'LOGOUT_ADMIN': return { ...state, admin: null, isAdminLoggedIn: false };
    case 'UPDATE_RESTAURANT': return { ...state, restaurant: { ...state.restaurant, ...action.payload } };
    case 'ADD_MENU_ITEM': {
      const restId = state.admin?.id || 'admin-1';
      const newItem = { ...action.payload, restaurantId: action.payload.restaurantId || restId };
      return { ...state, menuItems: [...state.menuItems, newItem] };
    }
    case 'UPDATE_MENU_ITEM': return { ...state, menuItems: state.menuItems.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'DELETE_MENU_ITEM': return { ...state, menuItems: state.menuItems.filter(i => i.id !== action.payload) };
    case 'ADD_CATEGORY': {
      const restId = state.admin?.id || 'admin-1';
      const newCat = { ...action.payload, restaurantId: action.payload.restaurantId || restId };
      return { ...state, categories: [...state.categories, newCat] };
    }
    case 'UPDATE_CATEGORY': return { ...state, categories: state.categories.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    case 'DELETE_CATEGORY': return { ...state, categories: state.categories.filter(c => c.id !== action.payload) };
    case 'REMAP_ORPHAN_DATA': {
      const { fromId, toId } = action.payload;
      if (!fromId || fromId === toId) return state;
      return {
        ...state,
        menuItems: state.menuItems.map(item =>
          item.restaurantId === fromId ? { ...item, restaurantId: toId } : item
        ),
        categories: state.categories.map(cat =>
          cat.restaurantId === fromId ? { ...cat, restaurantId: toId } : cat
        ),
        orders: state.orders.map(order =>
          order.restaurantId === fromId ? { ...order, restaurantId: toId } : order
        ),
      };
    }
    case 'UNFEATURED_ALL_ITEMS': {
      const restId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
      return {
        ...state,
        menuItems: state.menuItems.map(item =>
          item.restaurantId === restId ? { ...item, isFeatured: false } : item
        )
      };
    }
    case 'DELETE_ALL_MENU_ITEMS': {
      const restId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
      return {
        ...state,
        menuItems: state.menuItems.filter(item => item.restaurantId !== restId),
        categories: state.categories.filter(cat => cat.restaurantId !== restId)
      };
    }
    case 'PLACE_ORDER': {
      const newOrders = [...state.orders, action.payload];
      // Update customer records
      const customers = [...state.customers];
      const existingCustomerIdx = customers.findIndex(c => c.phone === action.payload.customerPhone);
      const pointsEarned = action.payload.pointsEarned || 0;
      const pointsRedeemed = action.payload.pointsRedeemed || 0;
      
      if (existingCustomerIdx >= 0) {
        customers[existingCustomerIdx] = {
          ...customers[existingCustomerIdx],
          orderCount: customers[existingCustomerIdx].orderCount + 1,
          totalSpent: customers[existingCustomerIdx].totalSpent + action.payload.totalAmount,
          lastVisit: Date.now(),
          points: (customers[existingCustomerIdx].points || 0) + pointsEarned - pointsRedeemed,
          email: action.payload.customerEmail || customers[existingCustomerIdx].email,
        };
      } else if (action.payload.customerPhone) {
        customers.push({
          id: `cust-${Date.now()}`,
          name: action.payload.customerName || 'Guest',
          phone: action.payload.customerPhone,
          email: action.payload.customerEmail,
          orderCount: 1,
          totalSpent: action.payload.totalAmount,
          lastVisit: Date.now(),
          firstVisit: Date.now(),
          points: pointsEarned - pointsRedeemed,
          isVip: false,
        });
      }
      return { ...state, orders: newOrders, customers, newOrderAlert: action.payload };
    }
    case 'UPDATE_ORDER_STATUS': {
      const orderId = action.payload.id;
      const targetStatus = action.payload.status;
      const targetOrder = state.orders.find(o => o.id === orderId);
      
      let newBalance = state.walletBalance;
      let newTransactions = state.walletTransactions;
      let newAccounts = state.restaurantAccounts;
      
      if (targetStatus === 'served' && targetOrder && targetOrder.status !== 'served') {
        newBalance -= 1;
        newTransactions = [
          {
            id: `tx-deduct-${Date.now()}`,
            amount: 1,
            type: 'deduction',
            description: `Order #${orderId.slice(-4).toUpperCase()} marked as served/delivered`,
            createdAt: Date.now()
          },
          ...state.walletTransactions
        ];
        
        if (state.admin && state.admin.email) {
          newAccounts = state.restaurantAccounts.map(acc => {
            if (acc.ownerEmail === state.admin!.email) {
              return {
                ...acc,
                walletBalance: Math.max(0, acc.walletBalance - 1)
              };
            }
            return acc;
          });
        }
      }
      
      return {
        ...state,
        orders: state.orders.map(o => o.id === orderId ? { ...o, status: targetStatus, updatedAt: Date.now() } : o),
        walletBalance: newBalance,
        walletTransactions: newTransactions,
        restaurantAccounts: newAccounts
      };
    }
    case 'UPDATE_ORDER_PAYMENT': return {
      ...state,
      orders: state.orders.map(o => o.id === action.payload.id ? {
        ...o,
        ...(action.payload.method ? { paymentMethod: action.payload.method } : {}),
        ...(action.payload.status ? { paymentStatus: action.payload.status } : {}),
        updatedAt: Date.now()
      } : o)
    };
    case 'RATE_ORDER': return {
      ...state,
      orders: state.orders.map(o => o.id === action.payload.id ? {
        ...o,
        ratings: action.payload.ratings,
        updatedAt: Date.now()
      } : o)
    };
    case 'ADD_TO_CART': {
      const existing = state.cart.findIndex(i => 
        i.menuItemId === action.payload.menuItemId && 
        i.variant?.name === action.payload.variant?.name
      );
      if (existing >= 0) {
        const cart = [...state.cart];
        cart[existing] = { ...cart[existing], qty: cart[existing].qty + action.payload.qty };
        return { ...state, cart };
      }
      return { ...state, cart: [...state.cart, action.payload] };
    }
    case 'REMOVE_FROM_CART': {
      const targetId = typeof action.payload === 'string' ? action.payload : action.payload.menuItemId;
      const targetVariantName = typeof action.payload === 'string' ? undefined : action.payload.variantName;
      return { 
        ...state, 
        cart: state.cart.filter(i => !(i.menuItemId === targetId && i.variant?.name === targetVariantName)) 
      };
    }
    case 'UPDATE_CART_QTY': {
      const { menuItemId, qty, variantName } = action.payload;
      return {
        ...state,
        cart: state.cart.map(i => 
          (i.menuItemId === menuItemId && i.variant?.name === variantName) 
            ? { ...i, qty } 
            : i
        ).filter(i => i.qty > 0)
      };
    }
    case 'CLEAR_CART': return { ...state, cart: [] };
    case 'SET_CUSTOMER_TABLE': return { ...state, customerTableId: action.payload };
    case 'SET_TABLES': return { ...state, tables: action.payload };
    case 'UPDATE_TABLE_STATUS': return {
      ...state,
      tables: state.tables.map(t =>
        t.id === action.payload.id ? { ...t, status: action.payload.status } : t
      ),
    };
    case 'ADD_SCHEDULE': return { ...state, schedules: [...state.schedules, action.payload] };
    case 'UPDATE_SCHEDULE': return { ...state, schedules: state.schedules.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SCHEDULE': return { ...state, schedules: state.schedules.filter(s => s.id !== action.payload) };
    case 'CALL_WAITER': {
      const restId = action.payload.restaurantId || 'admin-1';
      const newReq = { ...action.payload, restaurantId: restId };
      return { ...state, waiterRequests: [...state.waiterRequests, newReq] };
    }
    case 'RESOLVE_WAITER': return {
      ...state,
      waiterRequests: state.waiterRequests.map(r => r.id === action.payload ? { ...r, resolved: true } : r)
    };
    case 'ADD_TOAST': return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case 'CLEAR_NEW_ORDER_ALERT': return { ...state, newOrderAlert: null };
    case 'TOGGLE_ADMIN_THEME': return { ...state, adminTheme: state.adminTheme === 'light' ? 'dark' : 'light' };
    case 'TOGGLE_CUSTOMER_THEME': return { ...state, customerTheme: state.customerTheme === 'light' ? 'dark' : 'light' };
    case 'TOGGLE_CUSTOMER_VIP': return {
      ...state,
      customers: state.customers.map(c => c.id === action.payload ? { ...c, isVip: !c.isVip } : c)
    };
    case 'ADJUST_CUSTOMER_POINTS': return {
      ...state,
      customers: state.customers.map(c => c.id === action.payload.id ? { ...c, points: action.payload.points } : c)
    };
    case 'TOP_UP_WALLET': {
      const topUpAmt = action.payload;
      let newAccounts = state.restaurantAccounts;
      if (state.admin && state.admin.email) {
        newAccounts = state.restaurantAccounts.map(acc => {
          if (acc.ownerEmail === state.admin!.email) {
            return {
              ...acc,
              walletBalance: acc.walletBalance + topUpAmt
            };
          }
          return acc;
        });
      }
      return {
        ...state,
        walletBalance: state.walletBalance + topUpAmt,
        restaurantAccounts: newAccounts,
        walletTransactions: [
          {
            id: `tx-topup-${Date.now()}`,
            amount: topUpAmt,
            type: 'topup',
            description: `Topped up wallet balance`,
            createdAt: Date.now()
          },
          ...state.walletTransactions
        ]
      };
    }
    case 'ADD_MONTHLY_TOPUP': {
      localStorage.setItem('meenufy_last_wallet_reset_month', action.payload);
      let newAccounts = state.restaurantAccounts;
      if (state.admin && state.admin.email) {
        newAccounts = state.restaurantAccounts.map(acc => {
          if (acc.ownerEmail === state.admin!.email) {
            return {
              ...acc,
              walletBalance: acc.walletBalance + 300
            };
          }
          return acc;
        });
      }
      return {
        ...state,
        walletBalance: state.walletBalance + 300,
        restaurantAccounts: newAccounts,
        walletTransactions: [
          {
            id: `tx-monthly-${Date.now()}`,
            amount: 300,
            type: 'topup',
            description: `Monthly allowance top-up for ${action.payload}`,
            createdAt: Date.now()
          },
          ...state.walletTransactions
        ]
      };
    }
    case 'SUPER_ADMIN_TOP_UP': {
      const { email, amount } = action.payload;
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.ownerEmail === email) {
          return {
            ...acc,
            walletBalance: acc.walletBalance + amount
          };
        }
        return acc;
      });
      const isCurrent = state.admin && state.admin.email === email;
      const newTx = isCurrent ? [
        {
          id: `tx-super-topup-${Date.now()}`,
          amount,
          type: 'topup' as const,
          description: `Wallet topped up by Super Admin`,
          createdAt: Date.now()
        },
        ...state.walletTransactions
      ] : state.walletTransactions;
      
      return {
        ...state,
        restaurantAccounts: newAccounts,
        walletBalance: isCurrent ? state.walletBalance + amount : state.walletBalance,
        walletTransactions: newTx
      };
    }
    case 'SUPER_ADMIN_DEDUCT': {
      const { email, amount } = action.payload;
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.ownerEmail === email) {
          return {
            ...acc,
            walletBalance: Math.max(0, acc.walletBalance - amount)
          };
        }
        return acc;
      });
      const isCurrent = state.admin && state.admin.email === email;
      const newTx = isCurrent ? [
        {
          id: `tx-super-deduct-${Date.now()}`,
          amount,
          type: 'deduction' as const,
          description: `Wallet amount deducted by Super Admin`,
          createdAt: Date.now()
        },
        ...state.walletTransactions
      ] : state.walletTransactions;

      return {
        ...state,
        restaurantAccounts: newAccounts,
        walletBalance: isCurrent ? Math.max(0, state.walletBalance - amount) : state.walletBalance,
        walletTransactions: newTx
      };
    }
    case 'SUPER_ADMIN_TOGGLE_BLOCK': {
      const { email } = action.payload;
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.ownerEmail === email) {
          return {
            ...acc,
            status: (acc.status === 'active' ? 'blocked' : 'active') as 'active' | 'blocked'
          };
        }
        return acc;
      });
      
      const isCurrent = state.admin && state.admin.email === email;
      const shouldLogout = isCurrent && newAccounts.find(acc => acc.ownerEmail === email)?.status === 'blocked';
      
      return {
        ...state,
        restaurantAccounts: newAccounts,
        ...(shouldLogout ? { admin: null, isAdminLoggedIn: false } : {})
      };
    }
    case 'ADD_GEMINI_KEY':
      return {
        ...state,
        geminiApiKeys: [...state.geminiApiKeys, action.payload]
      };
    case 'REMOVE_GEMINI_KEY':
      return {
        ...state,
        geminiApiKeys: state.geminiApiKeys.filter(key => key !== action.payload)
      };
    case 'SUBMIT_SUPPORT_REQUEST': {
      const { message, attemptsCount } = action.payload;
      const newRequest: SupportRequest = {
        id: `req-${Date.now()}`,
        restaurantId: state.admin?.restaurantId || 'unknown',
        restaurantName: state.restaurant.name || 'My Restaurant',
        ownerName: state.admin?.name || 'Owner',
        ownerEmail: state.admin?.email || 'owner@restaurant.com',
        message,
        attemptsCount,
        createdAt: Date.now(),
        status: 'pending'
      };
      return {
        ...state,
        supportRequests: [newRequest, ...state.supportRequests]
      };
    }
    case 'REPLY_SUPPORT_REQUEST': {
      const { id, replyText } = action.payload;
      return {
        ...state,
        supportRequests: state.supportRequests.map(req =>
          req.id === id ? { ...req, replyText, status: 'resolved' as const } : req
        )
      };
    }
    case 'SUBMIT_FEEDBACK': {
      const newFeedback: OwnerFeedback = {
        id: `fb-${Date.now()}`,
        restaurantId: state.admin?.restaurantId || 'unknown',
        restaurantName: state.restaurant.name || 'My Restaurant',
        ownerName: state.admin?.name || 'Owner',
        ownerEmail: state.admin?.email || 'owner@restaurant.com',
        message: action.payload,
        createdAt: Date.now()
      };
      return {
        ...state,
        ownerFeedbacks: [newFeedback, ...state.ownerFeedbacks]
      };
    }
    case 'DELETE_FEEDBACK':
      return {
        ...state,
        ownerFeedbacks: state.ownerFeedbacks.filter(fb => fb.id !== action.payload)
      };
    case 'REPLY_FEEDBACK': {
      const { id, replyText } = action.payload;
      return {
        ...state,
        ownerFeedbacks: state.ownerFeedbacks.map(fb =>
          fb.id === id ? { ...fb, replyText } : fb
        )
      };
    }
    case 'UPDATE_CUSTOMER_THEME_COLORS':
      return {
        ...state,
        customerMenuTheme: {
          ...state.customerMenuTheme,
          ...action.payload
        }
      };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    default: return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
type StoreContextType = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addToast: (type: Toast['type'], message: string) => void;
};

const StoreContext = createContext<StoreContextType | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────
const STORAGE_KEY = 'meenufy_state_v1';
const CHANNEL_NAME = 'meenufy_realtime';

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AppState>;

    // ── Step 1: Detect the admin's old dynamic ID (if any) ───────────────────────
    // If the saved admin is 'atish3477' but has a non-admin-1 ID, that's the old dynamic ID
    let oldDynamicId: string | null = null;
    if (
      parsed.admin &&
      parsed.admin.email?.trim().toLowerCase() === 'atish3477' &&
      parsed.admin.id !== 'admin-1'
    ) {
      oldDynamicId = parsed.admin.id;
    }

    // ── Step 2: Remap restaurant accounts ────────────────────────────────────────
    if (parsed.restaurantAccounts) {
      // Find dynamic account for 'atish3477' via email (alternative detection)
      const dynamicAccount = parsed.restaurantAccounts.find(
        acc => acc.id !== 'admin-1' && acc.ownerEmail?.trim().toLowerCase() === 'atish3477'
      );
      if (dynamicAccount && !oldDynamicId) {
        oldDynamicId = dynamicAccount.id;
      }

      // Update admin-1 to have owner email 'atish3477'
      parsed.restaurantAccounts = parsed.restaurantAccounts.map(acc => {
        if (acc.id === 'admin-1') {
          return { ...acc, ownerEmail: 'atish3477', ownerName: 'Atish' };
        }
        return acc;
      });

      // Remove duplicate dynamic account
      parsed.restaurantAccounts = parsed.restaurantAccounts.filter(
        acc => !(acc.id !== 'admin-1' && acc.ownerEmail?.trim().toLowerCase() === 'atish3477')
      );
    }

    // ── Step 3: Remap all data using the old dynamic ID ──────────────────────────
    if (oldDynamicId) {
      if (parsed.menuItems) {
        parsed.menuItems = parsed.menuItems.map(item =>
          item.restaurantId === oldDynamicId ? { ...item, restaurantId: 'admin-1' } : item
        );
      }
      if (parsed.categories) {
        parsed.categories = parsed.categories.map(cat =>
          cat.restaurantId === oldDynamicId ? { ...cat, restaurantId: 'admin-1' } : cat
        );
      }
      if (parsed.orders) {
        parsed.orders = parsed.orders.map(order =>
          order.restaurantId === oldDynamicId ? { ...order, restaurantId: 'admin-1' } : order
        );
      }
    }

    // ── Step 4: Fix the active admin session ─────────────────────────────────────
    if (parsed.admin && parsed.admin.email?.trim().toLowerCase() === 'atish3477') {
      parsed.admin = { ...parsed.admin, id: 'admin-1', restaurantId: 'admin-1' };
    }

    return parsed;
  } catch {
    return {};
  }
}


function saveState(state: AppState) {
  try {
    // Don't persist transient UI state
    const { toasts, isLoading, newOrderAlert, cart, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {}
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const savedState = loadState();
  const [state, dispatch] = useReducer(reducer, {
    ...DEFAULT_STATE,
    ...savedState,
    // Always reset transient state
    toasts: [],
    isLoading: false,
    newOrderAlert: null,
    cart: [],
    currentView: 'admin', // always start admin
    adminTab: 'home',
  });

  const channelRef = useRef<BroadcastChannel | null>(null);
  const isBroadcasting = useRef(false);

  // Save to localStorage on state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Apply body theme class separately for customer and admin tabs
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isCustomerTab = urlParams.get('view') === 'customer';
    const activeTheme = isCustomerTab ? (state.customerTheme || 'dark') : (state.adminTheme || 'dark');
    
    if (activeTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [state.adminTheme, state.customerTheme]);

  // Apply custom website theme colors to CSS variables dynamically
  useEffect(() => {
    const theme = state.customerMenuTheme || {};
    
    if (theme.primaryBg) {
      document.documentElement.style.setProperty('--customer-bg-override', theme.primaryBg);
    } else {
      document.documentElement.style.removeProperty('--customer-bg-override');
    }
    
    if (theme.itemName) {
      document.documentElement.style.setProperty('--customer-item-name-color', theme.itemName);
    } else {
      document.documentElement.style.removeProperty('--customer-item-name-color');
    }
    
    if (theme.itemDesc) {
      document.documentElement.style.setProperty('--customer-item-desc-color', theme.itemDesc);
    } else {
      document.documentElement.style.removeProperty('--customer-item-desc-color');
    }
    
    if (theme.addToCartBg) {
      document.documentElement.style.setProperty('--customer-add-to-cart-bg', theme.addToCartBg);
    } else {
      document.documentElement.style.removeProperty('--customer-add-to-cart-bg');
    }

    if (theme.addToCartText) {
      document.documentElement.style.setProperty('--customer-add-to-cart-text', theme.addToCartText);
    } else {
      document.documentElement.style.removeProperty('--customer-add-to-cart-text');
    }
    
    if (theme.bestsellerBg) {
      document.documentElement.style.setProperty('--customer-bestseller-bg', theme.bestsellerBg);
    } else {
      document.documentElement.style.removeProperty('--customer-bestseller-bg');
    }

    if (theme.bestsellerText) {
      document.documentElement.style.setProperty('--customer-bestseller-text', theme.bestsellerText);
    } else {
      document.documentElement.style.removeProperty('--customer-bestseller-text');
    }
  }, [state.customerMenuTheme]);

  // Setup BroadcastChannel for cross-tab realtime sync
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data?.type === 'STATE_SYNC') {
        isBroadcasting.current = true;
        dispatch({ type: 'SET_STATE', payload: event.data.payload });
        isBroadcasting.current = false;
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // Check monthly top-up allowance
  useEffect(() => {
    const currentMonthKey = new Date().toLocaleDateString(undefined, { month: '2-digit', year: 'numeric' });
    const lastResetMonth = localStorage.getItem('meenufy_last_wallet_reset_month');
    
    if (lastResetMonth !== currentMonthKey) {
      wrappedDispatch({ type: 'ADD_MONTHLY_TOPUP', payload: currentMonthKey });
    }
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Real-time Firebase Realtime Database sync listeners
  useEffect(() => {
    if (!hasFirebaseConfig || !db) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isCustomer = urlParams.get('view') === 'customer';
    const targetRestaurantId = isCustomer 
      ? (urlParams.get('restaurant') || 'admin-1')
      : (state.admin?.restaurantId || 'admin-1');

    if (!targetRestaurantId) return;

    // 1. Sync restaurant profile details
    const unsubscribeRestaurant = onValue(ref(db, `restaurants/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        dispatch({
          type: 'SET_STATE',
          payload: { restaurant: { ...state.restaurant, ...data } }
        });
      }
    });

    // 2. Sync restaurant accounts
    const unsubscribeAccounts = onValue(ref(db, 'restaurantAccounts'), (snapshot) => {
      const data = snapshot.val();
      const accounts: RestaurantAccount[] = data ? Object.values(data) as RestaurantAccount[] : [];
      if (accounts.length > 0) {
        const currentAdmin = stateRef.current.admin;
        let activeBalance = stateRef.current.walletBalance;
        if (currentAdmin && !currentAdmin.isSuperAdmin) {
          const matched = accounts.find(acc => acc.id === currentAdmin.id);
          if (matched) {
            activeBalance = matched.walletBalance;
          }
        }
        dispatch({
          type: 'SET_STATE',
          payload: { 
            restaurantAccounts: accounts,
            walletBalance: activeBalance
          }
        });
      }
    });

    // 3. Listen to menuItems
    const unsubscribeMenu = onValue(ref(db, `menuItems/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      const items: MenuItem[] = data ? Object.values(data) as MenuItem[] : [];
      dispatch({ 
        type: 'SET_STATE', 
        payload: { 
          menuItems: [
            ...stateRef.current.menuItems.filter(item => item.restaurantId !== targetRestaurantId),
            ...items
          ] 
        } 
      });
    });

    // 4. Listen to categories
    const unsubscribeCat = onValue(ref(db, `categories/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      const cats: MenuCategory[] = data ? Object.values(data) as MenuCategory[] : [];
      dispatch({ 
        type: 'SET_STATE', 
        payload: { 
          categories: [
            ...stateRef.current.categories.filter(c => c.restaurantId !== targetRestaurantId),
            ...cats
          ] 
        } 
      });
    });

    // 5. Listen to orders
    const unsubscribeOrder = onValue(ref(db, `orders/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      const ords: Order[] = data ? Object.values(data) as Order[] : [];
      dispatch({ 
        type: 'SET_STATE', 
        payload: { 
          orders: [
            ...stateRef.current.orders.filter(o => o.restaurantId !== targetRestaurantId),
            ...ords
          ] 
        } 
      });
    });

    // 6. Listen to waiterRequests
    const unsubscribeWaiter = onValue(ref(db, `waiterRequests/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      const reqs: WaiterRequest[] = data ? Object.values(data) as WaiterRequest[] : [];
      dispatch({ 
        type: 'SET_STATE', 
        payload: { 
          waiterRequests: [
            ...stateRef.current.waiterRequests.filter(r => r.restaurantId !== targetRestaurantId),
            ...reqs
          ] 
        } 
      });
    });

    // 7. Listen to tables
    const unsubscribeTables = onValue(ref(db, `tables/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tbls = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) as TableInfo[];
        dispatch({
          type: 'SET_STATE',
          payload: { tables: tbls }
        });
      }
    });

    // 8. Listen to schedules
    const unsubscribeSchedules = onValue(ref(db, `schedules/${targetRestaurantId}`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const schs = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) as MealSchedule[];
        dispatch({
          type: 'SET_STATE',
          payload: { schedules: schs }
        });
      }
    });

    // 9. Listen to Gemini API keys
    const unsubscribeGeminiKeys = onValue(ref(db, 'geminiApiKeys'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keys = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) as string[];
        dispatch({
          type: 'SET_STATE',
          payload: { geminiApiKeys: keys }
        });
      }
    });

    return () => {
      unsubscribeRestaurant();
      unsubscribeAccounts();
      unsubscribeMenu();
      unsubscribeCat();
      unsubscribeOrder();
      unsubscribeWaiter();
      unsubscribeTables();
      unsubscribeSchedules();
      unsubscribeGeminiKeys();
    };
  }, [state.admin?.restaurantId, state.currentView]);

  // Broadcast state changes to other tabs
  const wrappedDispatch = useCallback((action: Action) => {
    dispatch(action);

    // Mirror changes to Realtime Database if active
    if (hasFirebaseConfig && db) {
      try {
        const currentState = stateRef.current;
        const restId = currentState.admin?.restaurantId || 'admin-1';
        
        switch (action.type) {
          case 'ADD_MENU_ITEM':
          case 'UPDATE_MENU_ITEM': {
            const itemRestId = action.payload.restaurantId || restId;
            set(ref(db, `menuItems/${itemRestId}/${action.payload.id}`), {
              ...action.payload,
              restaurantId: itemRestId
            });
            break;
          }
          case 'DELETE_MENU_ITEM': {
            const itemRestId = currentState.menuItems.find(i => i.id === action.payload)?.restaurantId || restId;
            remove(ref(db, `menuItems/${itemRestId}/${action.payload}`));
            break;
          }
          case 'ADD_CATEGORY':
          case 'UPDATE_CATEGORY': {
            const catRestId = action.payload.restaurantId || restId;
            set(ref(db, `categories/${catRestId}/${action.payload.id}`), {
              ...action.payload,
              restaurantId: catRestId
            });
            break;
          }
          case 'DELETE_CATEGORY': {
            const catRestId = currentState.categories.find(c => c.id === action.payload)?.restaurantId || restId;
            remove(ref(db, `categories/${catRestId}/${action.payload}`));
            break;
          }
          case 'PLACE_ORDER': {
            const orderRestId = action.payload.restaurantId || restId;
            set(ref(db, `orders/${orderRestId}/${action.payload.id}`), {
              ...action.payload,
              restaurantId: orderRestId
            });
            break;
          }
          case 'UPDATE_ORDER_STATUS': {
            const orderRestId = currentState.orders.find(o => o.id === action.payload.id)?.restaurantId || restId;
            update(ref(db, `orders/${orderRestId}/${action.payload.id}`), { status: action.payload.status });
            break;
          }
          case 'UPDATE_ORDER_PAYMENT': {
            const orderRestId = currentState.orders.find(o => o.id === action.payload.id)?.restaurantId || restId;
            update(ref(db, `orders/${orderRestId}/${action.payload.id}`), {
              ...(action.payload.method ? { paymentMethod: action.payload.method } : {}),
              ...(action.payload.status ? { paymentStatus: action.payload.status } : {}),
            });
            break;
          }
          case 'RATE_ORDER': {
            const orderRestId = currentState.orders.find(o => o.id === action.payload.id)?.restaurantId || restId;
            update(ref(db, `orders/${orderRestId}/${action.payload.id}`), {
              ratings: action.payload.ratings,
              updatedAt: Date.now()
            });
            break;
          }
          case 'CALL_WAITER': {
            const waiterRestId = action.payload.restaurantId || restId;
            set(ref(db, `waiterRequests/${waiterRestId}/${action.payload.id}`), {
              ...action.payload,
              restaurantId: waiterRestId
            });
            break;
          }
          case 'RESOLVE_WAITER': {
            const waiterRestId = currentState.waiterRequests.find(r => r.id === action.payload)?.restaurantId || restId;
            update(ref(db, `waiterRequests/${waiterRestId}/${action.payload}`), { resolved: true });
            break;
          }
          case 'SET_TABLES': {
            set(ref(db, `tables/${restId}`), action.payload);
            break;
          }
          case 'UPDATE_TABLE_STATUS': {
            const updatedTables = currentState.tables.map(t =>
              t.id === action.payload.id ? { ...t, status: action.payload.status } : t
            );
            set(ref(db, `tables/${restId}`), updatedTables);
            break;
          }
          case 'ADD_SCHEDULE':
          case 'UPDATE_SCHEDULE': {
            set(ref(db, `schedules/${restId}/${action.payload.id}`), action.payload);
            break;
          }
          case 'DELETE_SCHEDULE': {
            remove(ref(db, `schedules/${restId}/${action.payload}`));
            break;
          }
          case 'ADD_GEMINI_KEY': {
            set(ref(db, 'geminiApiKeys'), [...currentState.geminiApiKeys, action.payload]);
            break;
          }
          case 'REMOVE_GEMINI_KEY': {
            set(ref(db, 'geminiApiKeys'), currentState.geminiApiKeys.filter(key => key !== action.payload));
            break;
          }
          case 'UNFEATURED_ALL_ITEMS': {
            const targetItems = currentState.menuItems.filter(item => item.restaurantId === restId);
            targetItems.forEach(item => {
              update(ref(db!, `menuItems/${restId}/${item.id}`), { isFeatured: false });
            });
            break;
          }
          case 'DELETE_ALL_MENU_ITEMS': {
            remove(ref(db, `menuItems/${restId}`));
            break;
          }
          case 'UPDATE_RESTAURANT':
            update(ref(db, `restaurants/${restId}`), action.payload);
            break;
          case 'LOGIN_ADMIN': {
            if (!action.payload.isSuperAdmin) {
              const accountData = {
                id: action.payload.id,
                ownerName: action.payload.name,
                ownerEmail: action.payload.email,
                ownerPhone: currentState.restaurant.phone || '+91 99999 88888',
                restaurantName: currentState.restaurant.name,
                walletBalance: 300,
                status: 'active',
                createdAt: Date.now(),
                ...(action.payload.password ? { password: action.payload.password } : {})
              };
              update(ref(db, `restaurantAccounts/${action.payload.id}`), accountData);
            }
            break;
          }
          case 'SUPER_ADMIN_TOP_UP':
          case 'SUPER_ADMIN_DEDUCT':
          case 'SUPER_ADMIN_TOGGLE_BLOCK': {
            const targetEmail = action.payload.email;
            const matchedAcc = currentState.restaurantAccounts.find(acc => acc.ownerEmail === targetEmail);
            if (matchedAcc) {
              let nextStatus = matchedAcc.status;
              let nextBalance = matchedAcc.walletBalance;
              if (action.type === 'SUPER_ADMIN_TOP_UP') nextBalance += action.payload.amount;
              if (action.type === 'SUPER_ADMIN_DEDUCT') nextBalance = Math.max(0, nextBalance - action.payload.amount);
              if (action.type === 'SUPER_ADMIN_TOGGLE_BLOCK') nextStatus = matchedAcc.status === 'active' ? 'blocked' : 'active';
              
              update(ref(db, `restaurantAccounts/${matchedAcc.id}`), {
                walletBalance: nextBalance,
                status: nextStatus
              });
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error('RTDB sync error:', err);
      }
    }

    // Broadcast to other tabs after state change
    setTimeout(() => {
      if (channelRef.current && !isBroadcasting.current) {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          channelRef.current.postMessage({
            type: 'STATE_SYNC',
            payload: JSON.parse(savedRaw),
          });
        }
      }
    }, 50);
  }, []);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `toast-${Date.now()}`;
    dispatch({ type: 'ADD_TOAST', payload: { id, type, message } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch: wrappedDispatch, addToast }}>
      {children}
    </StoreContext.Provider>
  );
}

// ─── Translations ────────────────────────────────────────────
export const TRANSLATIONS = {
  en: {
    view_full_menu: 'View Full Menu',
    featured: 'Featured',
    see_all: 'See All',
    contact: 'Contact',
    search_placeholder: 'Search...',
    all: 'All',
    veg: 'Veg',
    non_veg: 'Non-Veg',
    popular: 'Popular',
    low_high: '₹ Low-High',
    high_low: '₹ High-Low',
    add: 'Add',
    add_on: 'ADD ON',
    view_cart: 'View Cart',
    your_cart: 'Your Cart',
    total: 'Total',
    place_order: 'Place Order',
    special_instructions: 'Special Instructions (optional)',
    your_name: 'Your Name (optional)',
    phone: 'Phone (optional)',
    my_orders: 'My Orders',
    call_waiter: 'Call Waiter',
    no_orders_yet: 'No Orders Yet',
    browse_menu: 'Browse Menu',
    order_placed: 'Order is placed!',
    order_preparing: 'Cooking in the kitchen!',
    order_ready: 'Delivered to your table!',
    order_bill_pay: 'Waiting for payment...',
    live_order_status: 'Live Order Status',
    bill_review: 'Bill & Review',
    pay_with_upi: 'Pay with UPI',
    cash_pay: 'Bring Bill / Cash Pay',
    card_pay: 'Bring Bill / Card Pay',
    feedback: 'Review & Feedback',
    submit_feedback: 'Submit Feedback',
    waiting_confirmation: 'Waiting for Confirmation',
    bestseller: 'BESTSELLER',
    select_option: 'Select Option',
    review_meals: 'Review Meals',
    back: 'Back to options',
    scan_to_pay: 'Scan with GPay, PhonePe, Paytm',
    paid_done: 'I Have Paid / Mark as Done',
    google_review: 'Review us on Google Maps',
    success_done: 'Successfully Done!',
    payment_confirmed: 'Payment confirmed. Thank you for choosing us!',
    feedback_intro: 'Please rate the dishes served to your table today.',
    google_review_prompt: 'We are glad you loved the food! Could you support us with a Google Maps review?',
    active_request_details: 'Active Request Details',
    amount_due: 'Amount Due',
    method: 'Method',
    live_tracking: 'Live Tracking',
    more: 'More',
    settings: 'Settings, preferences & more',
    language: 'Language / भाषा'
  },
  hi: {
    view_full_menu: 'पूरा मेनू देखें',
    featured: 'विशेष व्यंजन',
    see_all: 'सभी देखें',
    contact: 'संपर्क',
    search_placeholder: 'खोजें...',
    all: 'सभी',
    veg: 'शाकाहारी',
    non_veg: 'मांसाहारी',
    popular: 'लोकप्रिय',
    low_high: '₹ कम से अधिक',
    high_low: '₹ अधिक से कम',
    add: 'जोड़ें',
    add_on: 'एड-ऑन',
    view_cart: 'कार्ट देखें',
    your_cart: 'आपका कार्ट',
    total: 'कुल',
    place_order: 'ऑर्डर दें',
    special_instructions: 'विशेष निर्देश (वैकल्पिक)',
    your_name: 'आपका नाम (वैकल्पिक)',
    phone: 'फ़ोन नंबर (वैकल्पिक)',
    my_orders: 'मेरे ऑर्डर्स',
    call_waiter: 'वेटर बुलाएं',
    no_orders_yet: 'कोई ऑर्डर नहीं',
    browse_menu: 'मेनू देखें',
    order_placed: 'ऑर्डर दे दिया गया है!',
    order_preparing: 'रसोई में पक रहा है!',
    order_ready: 'आपकी टेबल पर पहुँच गया!',
    order_bill_pay: 'भुगतान की प्रतीक्षा...',
    live_order_status: 'लाइव ऑर्डर स्थिति',
    bill_review: 'बिल और समीक्षा',
    pay_with_upi: 'UPI से भुगतान करें',
    cash_pay: 'नकद भुगतान',
    card_pay: 'कार्ड भुगतान',
    feedback: 'प्रतिक्रिया और समीक्षा',
    submit_feedback: 'प्रतिक्रिया भेजें',
    waiting_confirmation: 'पुष्टि की प्रतीक्षा है',
    bestseller: 'बेस्टसेलर',
    select_option: 'विकल्प चुनें',
    review_meals: 'व्यंजनों की समीक्षा करें',
    back: 'विकल्पों पर वापस जाएं',
    scan_to_pay: 'GPay, PhonePe, Paytm से स्कैन करें',
    paid_done: 'मैंने भुगतान कर दिया है',
    google_review: 'Google Maps पर समीक्षा करें',
    success_done: 'सफलतापूर्वक संपन्न!',
    payment_confirmed: 'भुगतान की पुष्टि हो गई। हमारे साथ जुड़ने के लिए धन्यवाद!',
    feedback_intro: 'कृपया आज परोसे गए व्यंजनों को रेटिंग दें।',
    google_review_prompt: 'हमें खुशी है कि आपको खाना पसंद आया! क्या आप Google Maps पर हमारा समर्थन कर सकते हैं?',
    active_request_details: 'सक्रिय अनुरोध विवरण',
    amount_due: 'देय राशि',
    method: 'तरीका',
    live_tracking: 'लाइव ट्रैकिंग',
    more: 'अधिक',
    settings: 'सेटिंग्स और अन्य विकल्प',
    language: 'भाषा / Language'
  }
};

export function useTranslation() {
  const { state } = useStore();
  const lang = state.language || 'en';
  return (key: keyof typeof TRANSLATIONS['en']) => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;
  };
}
