// ============================================================
// MEENUFY REALTIME STORE
// Cross-tab state sync via BroadcastChannel + localStorage
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { 
  supabase as db, 
  supabase as auth, 
  hasSupabaseConfig as hasFirebaseConfig,
  dbGet,
  dbSet,
  dbUpdate,
  dbRemove,
  dbSubscribe,
  onAuthStateChanged,
  signOutUser
} from '../utils/supabase';

const DEFAULT_POPULAR_CUISINES: { name: string; query: string; image: string; zoom?: number; originalQuality?: boolean }[] = [];

export function detectBillingCountry(): 'IN' | 'global' {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (
      tz === 'Asia/Kolkata' || 
      tz === 'Asia/Calcutta' || 
      tz.toLowerCase().includes('kolkata') || 
      tz.toLowerCase().includes('calcutta') ||
      tz.toLowerCase().includes('india') ||
      tz.toLowerCase().includes('delhi') ||
      tz.toLowerCase().includes('mumbai') ||
      tz.toLowerCase().includes('chennai')
    ) {
      return 'IN';
    }
  } catch (e) {}
  
  try {
    if (new Date().getTimezoneOffset() === -330) {
      return 'IN';
    }
  } catch (e) {}

  return 'global';
}

// ─── Types ──────────────────────────────────────────────────
export type MenuCategory = {
  id: string;
  name: string;
  icon: string;
  restaurantId?: string;
  rank?: number;
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
  categories?: string[];
  image: string;
  isVeg: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
  tags: string[];
  variants?: MenuItemVariant[];
  nutrition?: NutritionInfo;
  rank?: number;
  addons?: string[];
  rating?: number;
  ratingsCount?: number;
};

export type OrderItem = {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  variant?: MenuItemVariant;
  addons?: {
    addonId: string;
    addonName: string;
    optionId: string;
    optionName: string;
    price: number;
  }[];
  restaurantId?: string;
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
  paymentConfirmedByAdmin?: boolean;
  ratings?: Record<string, number>;
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointsDiscountApplied?: number;
  couponDiscountApplied?: number;
  couponCodeApplied?: string;
  orderType?: 'in-dining' | 'take-away' | 'delivery';
  deliveryAddress?: string;
  upiTxnId?: string;
  deliveryBoyId?: string;
  deliveryStatus?: 'assigned' | 'started' | 'delivered';
  deliveryOtp?: string;
  deliveryBoyRating?: number;
  deliveryBoyReview?: string;
  foodRating?: number;
  foodReview?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryCharge?: number;
  isManualOrder?: boolean;
  deliveryDistance?: number;
  deliveryBoyEarnings?: number;
  isVipCustomer?: boolean;
  complaint?: {
    category: string;
    message: string;
    status: 'pending' | 'resolved';
    createdAt: number;
    replyText?: string;
    resolvedAt?: number;
  };
};

export type TableInfo = {
  id: string;
  number: number;
  label: string;
  capacity: number;
  isActive: boolean;
  status?: 'active' | 'maintenance' | 'reserved';
  reservationFrom?: number;        // Unix timestamp
  reservationTo?: number;          // Unix timestamp
  reservationGuestName?: string;
  reservationGuestPhone?: string;
  reservationGuestCount?: number;  // Number of people
};

export type RestaurantInfo = {
  id?: string;
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
  autoprintKotEnabled?: boolean;
  autoprintBillEnabled?: boolean;
  orderPopupEnabled?: boolean;
  daySpecificHours?: Record<string, { openTime: string; closeTime: string; closed?: boolean }>;
  taxPercentage?: number;
  ratingsCount?: number;
  promoText?: string;
  printWidth?: '58mm' | '80mm';
  printHeaderMessage?: string;
  printFooterMessage?: string;
  printShowDateTime?: boolean;
  printShowOrderNumber?: boolean;
  printMethod?: 'browser' | 'bluetooth';
  bluetoothPrinterName?: string;
  upiId?: string;
  fssai?: string;
  gst?: string;
  subscriptionPlan?: 'free' | 'base' | 'standard' | 'advance';
  ordersPlacedThisMonth?: number;
  subscriptionRenewalDate?: number;
  billingPeriod?: 'monthly' | 'yearly';
  allowNegativeOrders?: boolean;
  offersMarqueeEnabled?: boolean;
  overlayLogoOnMeals?: boolean;
  cuisines?: string;
  rating?: number;
  basePlanSelectedType?: 'dining_takeaway' | 'delivery_only';
  createdAt?: number;
  isManualClosed?: boolean;
  subscriptionId?: string | null;
  deliveryEnabled?: boolean;
  deliveryRadius?: number;
  indiningRadius?: number;
  takeawayRadius?: number;
  upiQrCode?: string;
  freeDeliveryDistance?: number;
  freeDeliveryMinAmount?: number;
  freeDeliveryCriteria?: 'either' | 'both';
  deliveryCharge?: number;
  freeDeliveryDistanceEnabled?: boolean;
  freeDeliveryMinAmountEnabled?: boolean;
  supportedOrderTypes?: Array<'in-dining' | 'home-delivery' | 'take-away'>;
  avgOrdersPerDay?: number;
};

export type Coupon = {
  id: string;
  code: string;
  type: 'flat' | 'percentage';
  value: number;
  minOrderAmount?: number;
  isOneTime?: boolean;
  isUniqueGift?: boolean;
  isActive: boolean;
  createdAt: number;
  usageCount?: number;
  usageLimit?: number;
  restaurantId?: string;
  appliesTo?: 'all' | string[];
  label?: string;
  showInDeals?: boolean;
};

export type AddonOption = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  linkedMealId?: string;
};

export type AddonConfig = {
  id: string;
  restaurantId: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: AddonOption[];
  targetMealIds?: string[];
  targetCategoryIds?: string[];
  activeDays?: string[];
};

export type SubscriptionCoupon = {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPlan?: 'free' | 'base' | 'standard' | 'advance';
  billingRegion?: 'all' | 'IN' | 'global';
  createdAt: number;
  isActive?: boolean;
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
  uniqueId?: string;
  password?: string;
  googleId?: string;
  savedAddresses?: SavedAddress[];
};

export type SavedAddress = {
  id: string;
  name: string;
  phone: string;
  fullAddress: string;
  mapLink?: string;
  lat?: number;
  lng?: number;
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
  subscriptionPlan?: 'free' | 'base' | 'standard' | 'advance';
  ordersPlacedThisMonth?: number;
  subscriptionRenewalDate?: number;
  billingCountry?: 'IN' | 'global';
  billingPeriod?: 'monthly' | 'yearly';
  basePlanSelectedType?: 'dining_takeaway' | 'delivery_only';
  hasCompletedOnboarding?: boolean;
  subscriptionId?: string | null;
  latitude?: number;
  longitude?: number;
  logo?: string;
  tagline?: string;
  address?: string;
  cuisines?: string;
  rating?: number;
  bannerImage?: string;
  posterImage?: string;
  ratingsCount?: number;
  promoText?: string;
  daySpecificHours?: Record<string, { openTime: string; closeTime: string; closed?: boolean }>;
  isListedOnHome?: boolean;
  deliveryEnabled?: boolean;
  deliveryRadius?: number;
  deliveryCharge?: number;
  freeDeliveryDistance?: number;
  freeDeliveryMinAmount?: number;
  freeDeliveryDistanceEnabled?: boolean;
  freeDeliveryMinAmountEnabled?: boolean;
  indiningRadius?: number;
  takeawayRadius?: number;
  verificationRadius?: number;
  upiId?: string;
  googleMapsUrl?: string;
  openTime?: string;
  closeTime?: string;
  isManualClosed?: boolean;
  mustLoginBeforeOrder?: boolean;
  locationVerificationEnabled?: boolean;
  overlayLogoOnMeals?: boolean;
  fssai?: string;
  gst?: string;
  tableCount?: number;
};

export type StaffMember = {
  id: string;
  username: string;
  name: string;
  password?: string;
  permissions: ('orders' | 'menu' | 'customers' | 'analysis' | 'outlet_setting' | 'qr_tables')[];
  restaurantId: string;
  createdAt: number;
};

export type DeliveryBoy = {
  id: string;
  name: string;
  username: string;
  password?: string;
  phone?: string;
  restaurantId: string;
  status: 'idle' | 'delivering';
  totalDeliveries: number;
  totalEarnings: number;
  assignedOrderId?: string | null;
  createdAt: number;
  latitude?: number;
  longitude?: number;
  payoutPerKm?: number;
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
  isCustomerTicket?: boolean;
};

export type OwnerFeedback = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ticketType?: 'feedback' | 'bug' | 'feature' | 'other';
  message: string;
  createdAt: number;
  replyText?: string;
  isCustomerTicket?: boolean;
};

export type WaiterRequest = {
  id: string;
  tableNumber: number;
  tableId: string;
  restaurantId?: string;
  createdAt: number;
  resolved: boolean;
  resolvedAt?: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  restaurantId: string;
  isLoggedIn: boolean;
  isSuperAdmin?: boolean;
  password?: string;
  isStaff?: boolean;
  isDeliveryBoy?: boolean;
  isFirebaseUser?: boolean;
  permissions?: ('orders' | 'menu' | 'customers' | 'analysis' | 'outlet_setting' | 'qr_tables')[];
  restaurantName?: string;
  ownerPhone?: string;
  existingAccount?: any;
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
  adminTab: 'home' | 'menu' | 'customers' | 'analysis' | 'more' | 'outlet';
  customerTab: 'home' | 'menu' | 'orders' | 'more';
  customerTableId: string | null;
  activeCustomerRestaurantId: string | null;
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
  // Coupons
  coupons: Coupon[];
  // Schedules
  schedules: MealSchedule[];
  // Waiter requests
  waiterRequests: WaiterRequest[];
  // Wallet
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  // Subscription
  subscriptionPlan: 'free' | 'base' | 'standard' | 'advance';
  ordersPlacedThisMonth: number;
  subscriptionRenewalDate: number;
  billingCountry: 'IN' | 'global';
  billingPeriod: 'monthly' | 'yearly';
  subscriptionId: string | null;
  // Restaurant Accounts (Super Admin)
  restaurantAccounts: RestaurantAccount[];
  subscriptionCoupons: SubscriptionCoupon[];
  // Gemini API Keys & Support / Feedback
  geminiApiKeys: string[];
  popularCuisines: { name: string; query: string; image: string; zoom?: number; originalQuality?: boolean }[];
  supportRequests: SupportRequest[];
  ownerFeedbacks: OwnerFeedback[];
  staffMembers: StaffMember[];
  deliveryBoys: DeliveryBoy[];
  addons: AddonConfig[];
  // UI
  toasts: Toast[];
  isLoading: boolean;
  newOrderAlert: Order | null;
  language: 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | string;
  adminTheme: 'dark' | 'light';
  customerTheme: 'dark' | 'light';
  customerMenuTheme: CustomerMenuTheme;
  deferredPrompt?: any;
  accountsFromDb: boolean;
  cuisinesFromDb: boolean;
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
  rating: 0,
  ratingsCount: 0,
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
  autoprintKotEnabled: false,
  autoprintBillEnabled: false,
  orderPopupEnabled: true,
  taxPercentage: 5,
  printWidth: '80mm',
  printHeaderMessage: 'Welcome to our restaurant!',
  printFooterMessage: 'Thank you for dining with us! Visit again.',
  printShowDateTime: true,
  printShowOrderNumber: true,
  printMethod: 'browser',
  bluetoothPrinterName: '',
  subscriptionPlan: 'free',
  ordersPlacedThisMonth: 0,
  subscriptionRenewalDate: 0,
  billingPeriod: 'monthly',
  allowNegativeOrders: false,
  overlayLogoOnMeals: false,
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
  let savedOverride: any = null;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('meenufy_saved_outlet_info') : null;
    if (raw) savedOverride = JSON.parse(raw);
  } catch {}

  // Primary Source of Truth: Find account from state.restaurantAccounts (realtime Firebase DB node)
  const account = state.restaurantAccounts?.find(acc => acc.id === restaurantId);
  const baseRest = (state.restaurant && state.restaurant.id === restaurantId) ? state.restaurant : DEFAULT_RESTAURANT;

  if (account || savedOverride) {
    const activeAcc: Partial<RestaurantAccount> = account || {};
    const effectiveName = savedOverride?.name || savedOverride?.restaurantName || activeAcc.restaurantName || baseRest.name || DEFAULT_RESTAURANT.name;
    const effectivePhone = savedOverride?.phone || savedOverride?.ownerPhone || activeAcc.ownerPhone || baseRest.phone || DEFAULT_RESTAURANT.phone;
    const effectiveEmail = savedOverride?.email || savedOverride?.ownerEmail || activeAcc.ownerEmail || baseRest.email || DEFAULT_RESTAURANT.email;
    const effectiveAddress = savedOverride?.address || activeAcc.address || baseRest.address || DEFAULT_RESTAURANT.address;
    const effectiveTagline = savedOverride?.tagline || activeAcc.tagline || baseRest.tagline || DEFAULT_RESTAURANT.tagline;
    const effectiveLogo = savedOverride?.logo || activeAcc.logo || baseRest.logo || DEFAULT_RESTAURANT.logo;
    const effectivePoster = savedOverride?.posterImage || activeAcc.posterImage || baseRest.posterImage || DEFAULT_RESTAURANT.posterImage;
    const effectiveBanner = savedOverride?.bannerImage || activeAcc.bannerImage || baseRest.bannerImage || DEFAULT_RESTAURANT.bannerImage;
    const effectiveOpenTime = savedOverride?.openTime || activeAcc.openTime || baseRest.openTime || '06:00';
    const effectiveCloseTime = savedOverride?.closeTime || activeAcc.closeTime || baseRest.closeTime || '00:00';

    return {
      ...baseRest,
      ...activeAcc,
      ...(savedOverride || {}),
      id: restaurantId,
      name: effectiveName,
      tagline: effectiveTagline,
      logo: effectiveLogo,
      bannerImage: effectiveBanner,
      posterImage: effectivePoster,
      address: effectiveAddress,
      phone: effectivePhone,
      email: effectiveEmail,
      openTime: effectiveOpenTime,
      closeTime: effectiveCloseTime,
      daySpecificHours: savedOverride?.daySpecificHours || activeAcc.daySpecificHours || baseRest.daySpecificHours || DEFAULT_RESTAURANT.daySpecificHours,
      rating: activeAcc.rating !== undefined ? activeAcc.rating : baseRest.rating,
      ratingsCount: activeAcc.ratingsCount !== undefined ? activeAcc.ratingsCount : baseRest.ratingsCount,
      promoText: activeAcc.promoText !== undefined ? activeAcc.promoText : baseRest.promoText,
      cuisines: savedOverride?.cuisines || activeAcc.cuisines || baseRest.cuisines || DEFAULT_RESTAURANT.cuisines,
      subscriptionPlan: activeAcc.subscriptionPlan || baseRest.subscriptionPlan || 'free',
      subscriptionRenewalDate: activeAcc.subscriptionRenewalDate || baseRest.subscriptionRenewalDate || 0,
      basePlanSelectedType: activeAcc.basePlanSelectedType || baseRest.basePlanSelectedType || 'dining_takeaway',
      createdAt: activeAcc.createdAt || baseRest.createdAt || Date.now(),
      isManualClosed: savedOverride?.isManualClosed !== undefined ? savedOverride.isManualClosed : ((activeAcc as any).isManualClosed !== undefined ? (activeAcc as any).isManualClosed : (baseRest.isManualClosed || false)),
      deliveryEnabled: savedOverride?.deliveryEnabled !== undefined ? savedOverride.deliveryEnabled : (activeAcc.deliveryEnabled !== undefined ? activeAcc.deliveryEnabled : baseRest.deliveryEnabled),
      deliveryRadius: savedOverride?.deliveryRadius !== undefined ? savedOverride.deliveryRadius : (activeAcc.deliveryRadius !== undefined ? activeAcc.deliveryRadius : baseRest.deliveryRadius),
      deliveryCharge: savedOverride?.deliveryCharge !== undefined ? savedOverride.deliveryCharge : (activeAcc.deliveryCharge !== undefined ? activeAcc.deliveryCharge : baseRest.deliveryCharge),
      freeDeliveryDistance: savedOverride?.freeDeliveryDistance !== undefined ? savedOverride.freeDeliveryDistance : (activeAcc.freeDeliveryDistance !== undefined ? activeAcc.freeDeliveryDistance : baseRest.freeDeliveryDistance),
      freeDeliveryMinAmount: savedOverride?.freeDeliveryMinAmount !== undefined ? savedOverride.freeDeliveryMinAmount : (activeAcc.freeDeliveryMinAmount !== undefined ? activeAcc.freeDeliveryMinAmount : baseRest.freeDeliveryMinAmount),
      freeDeliveryDistanceEnabled: savedOverride?.freeDeliveryDistanceEnabled !== undefined ? savedOverride.freeDeliveryDistanceEnabled : (activeAcc.freeDeliveryDistanceEnabled !== undefined ? activeAcc.freeDeliveryDistanceEnabled : baseRest.freeDeliveryDistanceEnabled),
      freeDeliveryMinAmountEnabled: savedOverride?.freeDeliveryMinAmountEnabled !== undefined ? savedOverride.freeDeliveryMinAmountEnabled : (activeAcc.freeDeliveryMinAmountEnabled !== undefined ? activeAcc.freeDeliveryMinAmountEnabled : baseRest.freeDeliveryMinAmountEnabled),
      latitude: savedOverride?.latitude !== undefined ? savedOverride.latitude : (activeAcc.latitude !== undefined ? activeAcc.latitude : baseRest.latitude),
      longitude: savedOverride?.longitude !== undefined ? savedOverride.longitude : (activeAcc.longitude !== undefined ? activeAcc.longitude : baseRest.longitude),
      upiId: savedOverride?.upiId || activeAcc.upiId || baseRest.upiId,
      googleMapsUrl: savedOverride?.googleMapsUrl || activeAcc.googleMapsUrl || baseRest.googleMapsUrl,
    };
  }

  if (state.restaurant && state.restaurant.id === restaurantId) {
    return state.restaurant;
  }

  // Fallback 2: Check MOCK_RESTAURANT_INFOS
  const mockInfo = MOCK_RESTAURANT_INFOS[restaurantId];
  if (mockInfo) return mockInfo;

  // Fallback 3: Check orders
  const matchedOrder = state.orders.find(o => o.restaurantId === restaurantId);
  if (matchedOrder && matchedOrder.restaurantName) {
    return {
      ...DEFAULT_RESTAURANT,
      name: matchedOrder.restaurantName,
      id: restaurantId,
      openTime: '00:00',
      closeTime: '23:59',
      isManualClosed: false,
    };
  }

  // Fallback 4: Completely open placeholder
  return {
    ...DEFAULT_RESTAURANT,
    id: restaurantId,
    openTime: '00:00',
    closeTime: '23:59',
    isManualClosed: false,
  };
}

export function isSubscriptionActive(restaurant: RestaurantInfo | undefined): {
  active: boolean;
  reason?: string;
  daysRemaining?: number;
  graceDaysRemaining?: number;
  isGracePeriod?: boolean;
} {
  if (!restaurant) return { active: false, reason: 'Restaurant not found.' };

  const plan = restaurant.subscriptionPlan || 'free';
  const renewalDate = restaurant.subscriptionRenewalDate || 0;

  // 1. Free Trial Plan (30 days trial duration)
  if (plan === 'free') {
    const cAt = restaurant.createdAt || Date.now();
    const trialRenewalDate = cAt + 29 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now > trialRenewalDate) {
      return { active: false, reason: "The admin doesn't have any plan so you cant place an order." };
    }
    const remainingMs = trialRenewalDate - now;
    const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return { active: true, daysRemaining };
  }

  // 2. Paid Plans (base, standard, advanced, enterprise, etc.)
  const now = Date.now();
  const validRenewalDate = renewalDate > 0 ? renewalDate : (now + 365 * 24 * 60 * 60 * 1000);
  if (now <= validRenewalDate) {
    const remainingMs = validRenewalDate - now;
    const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return { active: true, daysRemaining };
  }

  // 3. Grace Period Check (7 days grace period to extend)
  const gracePeriod = 7 * 24 * 60 * 60 * 1000;
  const graceExpiry = renewalDate + gracePeriod;

  if (now > graceExpiry) {
    return { active: false, reason: "The admin doesn't have any plan so you cant place an order." };
  }

  const graceRemainingMs = graceExpiry - now;
  const graceDaysRemaining = Math.ceil(graceRemainingMs / (24 * 60 * 60 * 1000));
  return { active: true, isGracePeriod: true, graceDaysRemaining };
}

export function isOrderTypeAllowed(
  orderType: 'in-dining' | 'take-away' | 'delivery',
  restaurant: RestaurantInfo | undefined
): { allowed: boolean; reason?: string } {
  if (!restaurant) return { allowed: false, reason: 'Restaurant not found.' };

  const plan = restaurant.subscriptionPlan || 'free';
  
  if (plan === 'base') {
    const selectedType = restaurant.basePlanSelectedType || 'dining_takeaway';
    if (selectedType === 'delivery_only') {
      if (orderType !== 'delivery') {
        return { allowed: false, reason: 'This restaurant only accepts Home Delivery orders under its current subscription plan.' };
      }
    } else if (selectedType === 'dining_takeaway') {
      if (orderType === 'delivery') {
        return { allowed: false, reason: 'Home Delivery is disabled for this restaurant under its current subscription plan.' };
      }
    }
  }

  return { allowed: true };
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
  activeCustomerRestaurantId: null,
  restaurant: DEFAULT_RESTAURANT,
  categories: DEFAULT_CATEGORIES,
  menuItems: DEFAULT_MENU_ITEMS,
  orders: MOCK_ORDERS,
  cart: [],
  tables: generateTables(8),
  customers: MOCK_CUSTOMERS,
  coupons: [],
  subscriptionCoupons: [],
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
  subscriptionPlan: 'free',
  ordersPlacedThisMonth: 0,
  subscriptionRenewalDate: Date.now() + 29 * 24 * 60 * 60 * 1000,
  billingCountry: detectBillingCountry(),
  billingPeriod: 'monthly',
  subscriptionId: null,
  restaurantAccounts: [],
  geminiApiKeys: [
    'AIzaSyD_FakeGeminiKey_Alpha01',
    'AIzaSyE_FakeGeminiKey_Beta02',
    'AIzaSyF_FakeGeminiKey_Gamma03'
  ],
  popularCuisines: DEFAULT_POPULAR_CUISINES,
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
  staffMembers: [],
  deliveryBoys: [],
  addons: [],
  toasts: [],
  isLoading: false,
  newOrderAlert: null,
  language: 'en',
  adminTheme: 'dark',
  customerTheme: 'light',
  customerMenuTheme: {
    primaryBg: '',
    itemName: '',
    itemDesc: '',
    addToCartBg: '',
    addToCartText: '',
    bestsellerBg: '',
    bestsellerText: '',
  },
  deferredPrompt: null,
  accountsFromDb: false,
  cuisinesFromDb: true,
};

// ─── Actions ─────────────────────────────────────────────────
type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'SET_ADMIN_TAB'; payload: AppState['adminTab'] }
  | { type: 'SET_CUSTOMER_TAB'; payload: AppState['customerTab'] }
  | { type: 'SET_ACTIVE_CUSTOMER_RESTAURANT'; payload: string | null }
  | { type: 'SET_VIEW'; payload: AppState['currentView'] }
  | { type: 'LOGIN_ADMIN'; payload: AdminUser }
  | { type: 'LOGOUT_ADMIN' }
  | { type: 'UPDATE_RESTAURANT'; payload: Partial<RestaurantInfo> }
  | { type: 'TOGGLE_RESTAURANT_LISTING'; payload: { id: string; isListedOnHome: boolean } }
  | { type: 'CONFIRM_ORDER_PAYMENT'; payload: { orderId: string; restaurantId?: string } }
  | { type: 'SYNC_SINGLE_ORDER_REALTIME'; payload: Order }
  | { type: 'ADD_MENU_ITEM'; payload: MenuItem }
  | { type: 'UPDATE_MENU_ITEM'; payload: MenuItem }
  | { type: 'DELETE_MENU_ITEM'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: MenuCategory }
  | { type: 'UPDATE_CATEGORY'; payload: MenuCategory }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'PLACE_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER_STATUS'; payload: { id: string; status: OrderStatus } }
  | { type: 'UPDATE_ORDER_PAYMENT'; payload: { id: string; method?: 'upi' | 'card' | 'cash'; status?: 'pending' | 'waiting_confirmation' | 'paid' } }
  | { type: 'RATE_ORDER'; payload: { id: string; ratings: Record<string, number>; deliveryBoyRating?: number; deliveryBoyReview?: string; foodRating?: number; foodReview?: string; } }
  | { type: 'ADD_TO_CART'; payload: OrderItem }
  | { type: 'REMOVE_FROM_CART'; payload: string | { menuItemId: string; variantName?: string; addonKey?: string } }
  | { type: 'UPDATE_CART_QTY'; payload: { menuItemId: string; qty: number; variantName?: string; addonKey?: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CUSTOMER_TABLE'; payload: string }
  | { type: 'SET_TABLES'; payload: TableInfo[] }
  | { type: 'UPDATE_TABLE_STATUS'; payload: { id: string; status: 'active' | 'maintenance' | 'reserved' } }
  | { type: 'SET_TABLE_RESERVATION'; payload: { id: string; reservationFrom: number; reservationTo: number; reservationGuestName?: string; reservationGuestPhone?: string; reservationGuestCount?: number } }
  | { type: 'ADD_SCHEDULE'; payload: MealSchedule }
  | { type: 'UPDATE_SCHEDULE'; payload: MealSchedule }
  | { type: 'DELETE_SCHEDULE'; payload: string }
  | { type: 'CALL_WAITER'; payload: WaiterRequest }
  | { type: 'RESOLVE_WAITER'; payload: string }
  | { type: 'LINK_GOOGLE_ACCOUNT'; payload: { uid: string; name: string; email: string } }
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
  | { type: 'SUPER_ADMIN_DELETE_ACCOUNT'; payload: string }
  | { type: 'SYNC_SUBSCRIPTION_COUPONS'; payload: SubscriptionCoupon[] }
  | { type: 'ADD_SUBSCRIPTION_COUPON'; payload: SubscriptionCoupon }
  | { type: 'DELETE_SUBSCRIPTION_COUPON'; payload: string }
  | { type: 'UPDATE_SUBSCRIPTION_PLAN'; payload: { planName: 'free' | 'base' | 'standard' | 'advance'; billingPeriod: 'monthly' | 'yearly'; subscriptionId?: string | null } }
  | { type: 'SUPER_ADMIN_UPDATE_SUBSCRIPTION'; payload: { id: string; subscriptionPlan: 'free' | 'base' | 'standard' | 'advance'; ordersPlacedThisMonth: number; subscriptionRenewalDate: number; billingCountry: 'IN' | 'global'; billingPeriod: 'monthly' | 'yearly' } }
  | { type: 'ADD_GEMINI_KEY'; payload: string }
  | { type: 'REMOVE_GEMINI_KEY'; payload: string }
  | { type: 'SYNC_POPULAR_CUISINES'; payload: { name: string; query: string; image: string; zoom?: number; originalQuality?: boolean }[] }
  | { type: 'SYNC_ALL_COUPONS'; payload: Coupon[] }
  | { type: 'SET_POPULAR_CUISINES'; payload: { name: string; query: string; image: string; zoom?: number; originalQuality?: boolean }[] }
  | { type: 'ADD_POPULAR_CUISINE'; payload: { name: string; query: string; image: string; zoom?: number; originalQuality?: boolean } }
  | { type: 'REMOVE_POPULAR_CUISINE'; payload: string }
  | { type: 'SUBMIT_SUPPORT_REQUEST'; payload: { message: string; attemptsCount: number } }
  | { type: 'REPLY_SUPPORT_REQUEST'; payload: { id: string; replyText: string } }
  | { type: 'SYNC_SUPPORT_REQUESTS'; payload: SupportRequest[] }
  | { type: 'SUBMIT_FEEDBACK'; payload: { message: string; ticketType?: 'feedback' | 'bug' | 'feature' | 'other' } }
  | { type: 'DELETE_FEEDBACK'; payload: string }
  | { type: 'REPLY_FEEDBACK'; payload: { id: string; replyText: string } }
  | { type: 'SYNC_OWNER_FEEDBACKS'; payload: OwnerFeedback[] }
  | { type: 'UPDATE_CUSTOMER_THEME_COLORS'; payload: Partial<CustomerMenuTheme> }
  | { type: 'REMAP_ORPHAN_DATA'; payload: { fromId: string; toId: string } }
  | { type: 'UNFEATURED_ALL_ITEMS' }
  | { type: 'DELETE_ALL_MENU_ITEMS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SYNC_MENU_ITEMS'; payload: { restaurantId: string; items: MenuItem[] } }
  | { type: 'SYNC_CATEGORIES'; payload: { restaurantId: string; categories: MenuCategory[] } }
  | { type: 'SYNC_MENU_DATA'; payload: { restaurantId: string; items: MenuItem[]; categories: MenuCategory[] } }
  | { type: 'SYNC_ORDERS'; payload: { restaurantId: string; orders: Order[] } }
  | { type: 'SYNC_WAITER_REQUESTS'; payload: { restaurantId: string; requests: WaiterRequest[] } }
  | { type: 'SYNC_RESTAURANT_ACCOUNTS'; payload: RestaurantAccount[] }
  | { type: 'SYNC_CUSTOMERS'; payload: { restaurantId: string; customers: CustomerRecord[] } }
  | { type: 'SYNC_COUPONS'; payload: Coupon[] }
  | { type: 'ADD_COUPON'; payload: Coupon }
  | { type: 'DELETE_COUPON'; payload: string }
  | { type: 'UPDATE_COUPON'; payload: Coupon }
  | { type: 'SET_MANUAL_CLOSED'; payload: boolean }
  | { type: 'SET_TABLE_STATUS'; payload: Partial<TableInfo> & { id: string } }
  | { type: 'CLEAR_ALL_CUSTOMERS' }
  | { type: 'COMPLETE_ONBOARDING'; payload?: { subscriptionPlan: 'free' | 'base' | 'standard'; basePlanSelectedType?: 'dining_takeaway' | 'delivery_only' } }
  | { type: 'MARK_ONBOARDING_PENDING' }
  | { type: 'SYNC_STAFF_MEMBERS'; payload: StaffMember[] }
  | { type: 'ADD_STAFF_MEMBER'; payload: StaffMember }
  | { type: 'UPDATE_STAFF_MEMBER'; payload: StaffMember }
  | { type: 'DELETE_STAFF_MEMBER'; payload: string }
  | { type: 'SYNC_DELIVERY_BOYS'; payload: DeliveryBoy[] }
  | { type: 'ADD_DELIVERY_BOY'; payload: DeliveryBoy }
  | { type: 'UPDATE_DELIVERY_BOY'; payload: DeliveryBoy }
  | { type: 'DELETE_DELIVERY_BOY'; payload: string }
  | { type: 'ASSIGN_DELIVERY_BOY'; payload: { orderId: string; restaurantId: string; deliveryBoyId: string; deliveryOtp: string } }
  | { type: 'SYNC_ADDONS'; payload: { restaurantId: string; addons: AddonConfig[] } }
  | { type: 'ADD_ADDON'; payload: AddonConfig }
  | { type: 'UPDATE_ADDON'; payload: AddonConfig }
  | { type: 'DELETE_ADDON'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE': return { ...state, ...action.payload };
    case 'SYNC_MENU_ITEMS': {
      const { restaurantId, items } = action.payload;
      return {
        ...state,
        menuItems: [
          ...state.menuItems.filter(item => item.restaurantId !== restaurantId),
          ...items
        ]
      };
    }
    case 'SYNC_CATEGORIES': {
      const { restaurantId, categories } = action.payload;
      return {
        ...state,
        categories: [
          ...state.categories.filter(c => c.restaurantId !== restaurantId),
          ...categories
        ]
      };
    }
    case 'SYNC_MENU_DATA': {
      // Atomic update of both menuItems and categories in ONE state transition
      // This prevents the race condition where only 'All' shows while waiting for the second dataset
      const { restaurantId, items, categories } = action.payload;
      return {
        ...state,
        menuItems: [
          ...state.menuItems.filter(item => item.restaurantId !== restaurantId),
          ...items
        ],
        categories: [
          ...state.categories.filter(c => c.restaurantId !== restaurantId),
          ...categories
        ]
      };
    }
    case 'SYNC_ORDERS': {
      const { restaurantId, orders } = action.payload;
      const otherOrders = restaurantId ? state.orders.filter(o => o.restaurantId && o.restaurantId !== restaurantId) : state.orders;
      
      const newOrdersMap = new Map<string, Order>();
      otherOrders.forEach(o => newOrdersMap.set(o.id, o));
      (orders || []).forEach(o => newOrdersMap.set(o.id, o));

      return {
        ...state,
        orders: Array.from(newOrdersMap.values())
      };
    }
    case 'SYNC_CUSTOMERS': {
      const { customers } = action.payload;
      return {
        ...state,
        customers
      };
    }
    case 'SYNC_COUPONS': {
      return {
        ...state,
        coupons: action.payload
      };
    }
    case 'SYNC_ALL_COUPONS': return { ...state, coupons: action.payload };
    case 'ADD_COUPON': {
      return {
        ...state,
        coupons: [...state.coupons.filter(c => c.id !== action.payload.id), action.payload]
      };
    }
    case 'DELETE_COUPON': {
      return {
        ...state,
        coupons: state.coupons.filter(c => c.id !== action.payload)
      };
    }
    case 'SYNC_SUBSCRIPTION_COUPONS': {
      return {
        ...state,
        subscriptionCoupons: action.payload
      };
    }
    case 'ADD_SUBSCRIPTION_COUPON': {
      const list = state.subscriptionCoupons || [];
      return {
        ...state,
        subscriptionCoupons: [...list.filter(c => c.id !== action.payload.id), action.payload]
      };
    }
    case 'DELETE_SUBSCRIPTION_COUPON': {
      const list = state.subscriptionCoupons || [];
      return {
        ...state,
        subscriptionCoupons: list.filter(c => c.id !== action.payload)
      };
    }
    case 'UPDATE_COUPON': {
      return {
        ...state,
        coupons: state.coupons.map(c => c.id === action.payload.id ? action.payload : c)
      };
    }
    case 'CLEAR_ALL_CUSTOMERS': {
      return {
        ...state,
        customers: []
      };
    }
    case 'SYNC_WAITER_REQUESTS': {
      const { restaurantId, requests } = action.payload;
      return {
        ...state,
        waiterRequests: [
          ...state.waiterRequests.filter(r => r.restaurantId !== restaurantId),
          ...requests
        ]
      };
    }
    case 'SYNC_RESTAURANT_ACCOUNTS': {
      const accounts = action.payload;
      const currentAdmin = state.admin;
      let activeBalance = state.walletBalance;
      let subscriptionPlan = state.subscriptionPlan;
      let ordersPlacedThisMonth = state.ordersPlacedThisMonth;
      let subscriptionRenewalDate = state.subscriptionRenewalDate;
      let billingCountry = state.billingCountry;
      let billingPeriod = state.billingPeriod;
      let subscriptionId = state.subscriptionId;
      
      let updatedRestaurant = state.restaurant;
      if (currentAdmin && !currentAdmin.isSuperAdmin) {
        const cEmail = currentAdmin.email?.trim().toLowerCase();
        const matched = accounts.find(acc => 
          acc.id === currentAdmin.id || 
          (currentAdmin.restaurantId && acc.id === currentAdmin.restaurantId) || 
          (cEmail && acc.ownerEmail?.trim().toLowerCase() === cEmail) ||
          (currentAdmin.id === 'admin-1' && acc.id === 'admin-1')
        );
        if (matched) {
          activeBalance = matched.walletBalance;
          subscriptionPlan = matched.subscriptionPlan || 'free';
          ordersPlacedThisMonth = matched.ordersPlacedThisMonth || 0;
          // For free plan: fallback to 13 days from createdAt so trial ends on day 14 (inclusive)
          const fallbackDays = (matched.subscriptionPlan || 'free') === 'free' ? 13 : 30;
          subscriptionRenewalDate = matched.subscriptionRenewalDate || (matched.createdAt + fallbackDays * 24 * 60 * 60 * 1000);
          billingCountry = matched.billingCountry || detectBillingCountry();
          billingPeriod = matched.billingPeriod || 'monthly';
          subscriptionId = matched.subscriptionId || null;

          updatedRestaurant = {
            ...state.restaurant,
            name: matched.restaurantName !== undefined ? matched.restaurantName : state.restaurant.name,
            phone: matched.ownerPhone !== undefined ? matched.ownerPhone : state.restaurant.phone,
            email: matched.ownerEmail !== undefined ? matched.ownerEmail : state.restaurant.email,
            address: matched.address !== undefined ? matched.address : state.restaurant.address,
            tagline: matched.tagline !== undefined ? matched.tagline : state.restaurant.tagline,
            logo: matched.logo !== undefined ? matched.logo : state.restaurant.logo,
            posterImage: matched.posterImage !== undefined ? matched.posterImage : state.restaurant.posterImage,
            bannerImage: matched.bannerImage !== undefined ? matched.bannerImage : state.restaurant.bannerImage,
            cuisines: matched.cuisines !== undefined ? matched.cuisines : state.restaurant.cuisines,
            rating: matched.rating !== undefined ? matched.rating : state.restaurant.rating,
            ratingsCount: matched.ratingsCount !== undefined ? matched.ratingsCount : state.restaurant.ratingsCount,
            latitude: matched.latitude !== undefined ? matched.latitude : state.restaurant.latitude,
            longitude: matched.longitude !== undefined ? matched.longitude : state.restaurant.longitude,
            deliveryEnabled: matched.deliveryEnabled !== undefined ? matched.deliveryEnabled : state.restaurant.deliveryEnabled,
            deliveryRadius: matched.deliveryRadius !== undefined ? matched.deliveryRadius : state.restaurant.deliveryRadius,
            deliveryCharge: matched.deliveryCharge !== undefined ? matched.deliveryCharge : state.restaurant.deliveryCharge,
            freeDeliveryDistance: matched.freeDeliveryDistance !== undefined ? matched.freeDeliveryDistance : state.restaurant.freeDeliveryDistance,
            freeDeliveryMinAmount: matched.freeDeliveryMinAmount !== undefined ? matched.freeDeliveryMinAmount : state.restaurant.freeDeliveryMinAmount,
            freeDeliveryDistanceEnabled: matched.freeDeliveryDistanceEnabled !== undefined ? matched.freeDeliveryDistanceEnabled : state.restaurant.freeDeliveryDistanceEnabled,
            freeDeliveryMinAmountEnabled: matched.freeDeliveryMinAmountEnabled !== undefined ? matched.freeDeliveryMinAmountEnabled : state.restaurant.freeDeliveryMinAmountEnabled,
            indiningRadius: matched.indiningRadius !== undefined ? matched.indiningRadius : state.restaurant.indiningRadius,
            takeawayRadius: matched.takeawayRadius !== undefined ? matched.takeawayRadius : state.restaurant.takeawayRadius,
            verificationRadius: matched.verificationRadius !== undefined ? matched.verificationRadius : state.restaurant.verificationRadius,
            upiId: matched.upiId !== undefined ? matched.upiId : state.restaurant.upiId,
            googleMapsUrl: matched.googleMapsUrl !== undefined ? matched.googleMapsUrl : state.restaurant.googleMapsUrl,
            openTime: matched.openTime !== undefined ? matched.openTime : state.restaurant.openTime,
            closeTime: matched.closeTime !== undefined ? matched.closeTime : state.restaurant.closeTime,
            daySpecificHours: matched.daySpecificHours !== undefined ? matched.daySpecificHours : state.restaurant.daySpecificHours,
            isManualClosed: matched.isManualClosed !== undefined ? matched.isManualClosed : state.restaurant.isManualClosed,
          };
        }
      }

      // ── Fast cache: persist real accounts separately so next page load is instant ──
      try {
        localStorage.setItem('meenufy_accounts_cache', JSON.stringify(accounts));
      } catch {}

      return {
        ...state,
        restaurantAccounts: accounts,
        restaurant: updatedRestaurant,
        walletBalance: activeBalance,
        subscriptionPlan,
        ordersPlacedThisMonth,
        subscriptionRenewalDate,
        billingCountry,
        billingPeriod,
        subscriptionId,
        accountsFromDb: true
      };
    }
    case 'SET_ADMIN_TAB': return { ...state, adminTab: action.payload };
    case 'SET_CUSTOMER_TAB': return { ...state, customerTab: action.payload };
    case 'SET_ACTIVE_CUSTOMER_RESTAURANT': return { ...state, activeCustomerRestaurantId: action.payload };
    case 'SET_VIEW': return { ...state, currentView: action.payload };
    case 'LOGIN_ADMIN': {
      const email = action.payload.email;
      const name = action.payload.name;
      const isSuper = action.payload.isSuperAdmin;
      
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.ownerEmail?.trim().toLowerCase() === email?.trim().toLowerCase()) {
          const updated = { ...acc };
          if (!acc.password && action.payload.password) {
            updated.password = action.payload.password;
          }
          if (action.payload.restaurantName) {
            updated.restaurantName = action.payload.restaurantName;
          }
          if (action.payload.ownerPhone) {
            updated.ownerPhone = action.payload.ownerPhone;
          }
          return updated;
        }
        return acc;
      });
      
      let existingAccount = action.payload.existingAccount || newAccounts.find(
        acc => acc.ownerEmail?.trim().toLowerCase() === email?.trim().toLowerCase()
      );

      if (action.payload.existingAccount && !newAccounts.some(acc => acc.id === action.payload.existingAccount.id)) {
        newAccounts.push({
          ...action.payload.existingAccount,
          id: action.payload.existingAccount.id || action.payload.id
        });
      }
      
      // Determine default country based on timezone
      const detectedCountry = detectBillingCountry();
      
      if (!isSuper && !existingAccount) {
        existingAccount = {
          id: action.payload.id,
          ownerName: name,
          ownerEmail: email,
          ownerPhone: action.payload.ownerPhone || state.restaurant.phone || '+91 99999 88888',
          restaurantName: action.payload.restaurantName || state.restaurant.name,
          walletBalance: 300,
          status: 'active',
          createdAt: Date.now(),
          password: action.payload.password,
          subscriptionPlan: 'free',
          ordersPlacedThisMonth: 0,
          subscriptionRenewalDate: Date.now() + 29 * 24 * 60 * 60 * 1000, // 29 days = trial expires on day 30
          billingCountry: detectedCountry,
          billingPeriod: 'monthly',
          rating: 0,
          ratingsCount: 0
        };
        newAccounts.push(existingAccount);
      }
      
      const activeBalance = existingAccount ? existingAccount.walletBalance : state.walletBalance;
      const subscriptionPlan = existingAccount ? (existingAccount.subscriptionPlan || 'free') : state.subscriptionPlan;
      const ordersPlacedThisMonth = existingAccount ? (existingAccount.ordersPlacedThisMonth || 0) : state.ordersPlacedThisMonth;
      const _accPlan = existingAccount ? (existingAccount.subscriptionPlan || 'free') : 'free';
      const _fallbackDays = _accPlan === 'free' ? 13 : 30;
      const subscriptionRenewalDate = existingAccount ? (existingAccount.subscriptionRenewalDate || (Date.now() + _fallbackDays * 24 * 60 * 60 * 1000)) : state.subscriptionRenewalDate;
      const billingCountry = existingAccount ? (existingAccount.billingCountry || detectedCountry) : state.billingCountry;
      const billingPeriod = existingAccount ? (existingAccount.billingPeriod || 'monthly') : state.billingPeriod;
      const subscriptionId = existingAccount ? (existingAccount.subscriptionId || null) : state.subscriptionId;
      
      let defaultTab: 'home' | 'menu' | 'customers' | 'analysis' | 'more' = 'home';
      if (action.payload.isStaff && action.payload.permissions) {
        const perms = action.payload.permissions;
        if (perms.includes('orders') || perms.includes('qr_tables')) defaultTab = 'home';
        else if (perms.includes('menu')) defaultTab = 'menu';
        else if (perms.includes('customers')) defaultTab = 'customers';
        else if (perms.includes('analysis')) defaultTab = 'analysis';
        else defaultTab = 'more';
      }
      
      const isDemoAdmin = action.payload.id === 'admin-1';
      
      const loginRestId = action.payload.id;

      // Preserve data that already belongs to this restaurant (from localStorage or prior Firebase sync).
      // Firebase listeners will overwrite with authoritative DB data momentarily.
      // Only wipe data that belongs to a DIFFERENT (previous) session's restaurant.
      const existingOrders     = state.orders.filter(o => o.restaurantId === loginRestId);
      const existingCategories = state.categories.filter(c => c.restaurantId === loginRestId);
      const existingMenuItems  = state.menuItems.filter(m => m.restaurantId === loginRestId);
      const existingCustomers  = state.customers;
      const existingTables     = state.tables;

      return { 
        ...state, 
        admin: {
          ...action.payload,
          restaurantId: action.payload.restaurantId || action.payload.id
        }, 
        isAdminLoggedIn: true,
        restaurantAccounts: newAccounts,
        walletBalance: isSuper ? state.walletBalance : activeBalance,
        subscriptionPlan,
        ordersPlacedThisMonth,
        subscriptionRenewalDate,
        billingCountry,
        billingPeriod,
        subscriptionId,
        adminTab: defaultTab,
        // Preserve existing data for this restaurant — Firebase listeners will refresh it.
        // For super admin, keep all state as-is.
        orders: isSuper ? state.orders : (isDemoAdmin ? MOCK_ORDERS : existingOrders),
        categories: isSuper ? state.categories : (isDemoAdmin ? DEFAULT_CATEGORIES : (existingCategories.length > 0 ? existingCategories : [])),
        menuItems: isSuper ? state.menuItems : (isDemoAdmin ? DEFAULT_MENU_ITEMS : (existingMenuItems.length > 0 ? existingMenuItems : [])),
        customers: isSuper ? state.customers : (isDemoAdmin ? MOCK_CUSTOMERS : existingCustomers),
        tables: isSuper ? state.tables : (existingTables.length > 0 ? existingTables : generateTables(8)),
        waiterRequests: isSuper ? state.waiterRequests : [],
        coupons: isSuper ? state.coupons : [],
        schedules: isSuper ? state.schedules : [],
        restaurant: {
          ...DEFAULT_RESTAURANT,
          ...state.restaurant,
          ...(existingAccount ? {
            id: existingAccount.id,
            name: existingAccount.restaurantName || state.restaurant.name,
            phone: existingAccount.ownerPhone || state.restaurant.phone,
            email: existingAccount.ownerEmail || state.restaurant.email,
            address: existingAccount.address !== undefined ? existingAccount.address : state.restaurant.address,
            tagline: existingAccount.tagline !== undefined ? existingAccount.tagline : state.restaurant.tagline,
            logo: existingAccount.logo !== undefined ? existingAccount.logo : state.restaurant.logo,
            posterImage: existingAccount.posterImage !== undefined ? existingAccount.posterImage : state.restaurant.posterImage,
            bannerImage: existingAccount.bannerImage !== undefined ? existingAccount.bannerImage : state.restaurant.bannerImage,
            cuisines: existingAccount.cuisines !== undefined ? existingAccount.cuisines : state.restaurant.cuisines,
            openTime: existingAccount.openTime !== undefined ? existingAccount.openTime : state.restaurant.openTime,
            closeTime: existingAccount.closeTime !== undefined ? existingAccount.closeTime : state.restaurant.closeTime,
            daySpecificHours: existingAccount.daySpecificHours !== undefined ? existingAccount.daySpecificHours : state.restaurant.daySpecificHours,
            deliveryEnabled: existingAccount.deliveryEnabled !== undefined ? existingAccount.deliveryEnabled : state.restaurant.deliveryEnabled,
            deliveryRadius: existingAccount.deliveryRadius !== undefined ? existingAccount.deliveryRadius : state.restaurant.deliveryRadius,
            deliveryCharge: existingAccount.deliveryCharge !== undefined ? existingAccount.deliveryCharge : state.restaurant.deliveryCharge,
            freeDeliveryDistance: existingAccount.freeDeliveryDistance !== undefined ? existingAccount.freeDeliveryDistance : state.restaurant.freeDeliveryDistance,
            freeDeliveryMinAmount: existingAccount.freeDeliveryMinAmount !== undefined ? existingAccount.freeDeliveryMinAmount : state.restaurant.freeDeliveryMinAmount,
            freeDeliveryDistanceEnabled: existingAccount.freeDeliveryDistanceEnabled !== undefined ? existingAccount.freeDeliveryDistanceEnabled : state.restaurant.freeDeliveryDistanceEnabled,
            freeDeliveryMinAmountEnabled: existingAccount.freeDeliveryMinAmountEnabled !== undefined ? existingAccount.freeDeliveryMinAmountEnabled : state.restaurant.freeDeliveryMinAmountEnabled,
            indiningRadius: existingAccount.indiningRadius !== undefined ? existingAccount.indiningRadius : state.restaurant.indiningRadius,
            takeawayRadius: existingAccount.takeawayRadius !== undefined ? existingAccount.takeawayRadius : state.restaurant.takeawayRadius,
            verificationRadius: existingAccount.verificationRadius !== undefined ? existingAccount.verificationRadius : state.restaurant.verificationRadius,
            upiId: existingAccount.upiId !== undefined ? existingAccount.upiId : state.restaurant.upiId,
            googleMapsUrl: existingAccount.googleMapsUrl !== undefined ? existingAccount.googleMapsUrl : state.restaurant.googleMapsUrl,
            latitude: existingAccount.latitude !== undefined ? existingAccount.latitude : state.restaurant.latitude,
            longitude: existingAccount.longitude !== undefined ? existingAccount.longitude : state.restaurant.longitude,
          } : {})
        },
        walletTransactions: isSuper ? state.walletTransactions : (isDemoAdmin ? state.walletTransactions : (state.walletTransactions.length > 0 ? state.walletTransactions : [
          {
            id: 'tx-initial',
            amount: 300,
            type: 'topup',
            description: 'Monthly allowance top-up (June 2026)',
            createdAt: Date.now()
          }
        ]))
      };
    }
    case 'COMPLETE_ONBOARDING': {
      if (!state.admin) return state;
      const payload = action.payload || { subscriptionPlan: 'free' };
      const plan = payload.subscriptionPlan;
      const renewalDays = plan === 'free' ? 13 : 30;
      const renewalDate = plan === 'free' ? Date.now() + renewalDays * 24 * 60 * 60 * 1000 : 0;

      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.id === state.admin?.id) {
          return {
            ...acc,
            hasCompletedOnboarding: true,
            subscriptionPlan: plan,
            subscriptionRenewalDate: renewalDate,
            createdAt: Date.now(),
            basePlanSelectedType: payload.basePlanSelectedType || 'dining_takeaway'
          };
        }
        return acc;
      });

      return {
        ...state,
        restaurantAccounts: newAccounts,
        restaurant: state.restaurant ? {
          ...state.restaurant,
          subscriptionPlan: plan,
          subscriptionRenewalDate: renewalDate,
          createdAt: Date.now(),
          basePlanSelectedType: payload.basePlanSelectedType || 'dining_takeaway'
        } : state.restaurant
      };
    }
    case 'MARK_ONBOARDING_PENDING': {
      if (!state.admin) return state;
      const existing = state.restaurantAccounts.find(acc => acc.id === state.admin?.id);
      if (existing) {
        // Already has an account, just mark as pending
        const newAccounts = state.restaurantAccounts.map(acc =>
          acc.id === state.admin?.id ? { ...acc, hasCompletedOnboarding: false } : acc
        );
        return { ...state, restaurantAccounts: newAccounts };
      }
      return state;
    }
    case 'SYNC_STAFF_MEMBERS': {
      let updatedAdmin = state.admin;
      let shouldLogout = false;
      if (state.admin && state.admin.isStaff) {
        const currentStaff = action.payload.find(s => s.id === state.admin?.id);
        if (!currentStaff) {
          updatedAdmin = null;
          shouldLogout = true;
        } else {
          updatedAdmin = {
            ...state.admin,
            name: currentStaff.name,
            email: currentStaff.username,
            permissions: currentStaff.permissions || []
          };
        }
      }
      return {
        ...state,
        staffMembers: action.payload,
        admin: updatedAdmin,
        isAdminLoggedIn: shouldLogout ? false : state.isAdminLoggedIn
      };
    }
    case 'ADD_STAFF_MEMBER': {
      return {
        ...state,
        staffMembers: [...state.staffMembers.filter(s => s.id !== action.payload.id), action.payload]
      };
    }
    case 'UPDATE_STAFF_MEMBER': {
      return {
        ...state,
        staffMembers: state.staffMembers.map(s => s.id === action.payload.id ? action.payload : s)
      };
    }
    case 'DELETE_STAFF_MEMBER': {
      return {
        ...state,
        staffMembers: state.staffMembers.filter(s => s.id !== action.payload)
      };
    }
    case 'SYNC_DELIVERY_BOYS': {
      return {
        ...state,
        deliveryBoys: action.payload
      };
    }
    case 'ADD_DELIVERY_BOY': {
      return {
        ...state,
        deliveryBoys: [...state.deliveryBoys.filter(d => d.id !== action.payload.id), action.payload]
      };
    }
    case 'UPDATE_DELIVERY_BOY': {
      return {
        ...state,
        deliveryBoys: state.deliveryBoys.map(d => d.id === action.payload.id ? action.payload : d)
      };
    }
    case 'DELETE_DELIVERY_BOY': {
      return {
        ...state,
        deliveryBoys: state.deliveryBoys.filter(d => d.id !== action.payload)
      };
    }
    case 'ASSIGN_DELIVERY_BOY': {
      const { orderId, deliveryBoyId, deliveryOtp } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o => o.id === orderId ? { ...o, deliveryBoyId, deliveryStatus: 'assigned', deliveryOtp } : o),
        deliveryBoys: state.deliveryBoys.map(b => b.id === deliveryBoyId ? { ...b, status: 'delivering', assignedOrderId: orderId } : b)
      };
    }
    case 'LOGOUT_ADMIN': return { 
      ...state, 
      admin: null, 
      isAdminLoggedIn: false,
      orders: [],
      tables: generateTables(8),
      categories: [],
      menuItems: [],
      customers: [],
      waiterRequests: [],
      coupons: [],
      schedules: [],
      walletBalance: 300,
      subscriptionPlan: 'free',
      restaurant: DEFAULT_RESTAURANT,
      walletTransactions: [
        {
          id: 'tx-initial',
          amount: 300,
          type: 'topup',
          description: 'Monthly allowance top-up (June 2026)',
          createdAt: Date.now()
        }
      ]
    };
    case 'UPDATE_RESTAURANT': {
      const p = action.payload as any;
      const restName = p.name || p.restaurantName;
      const targetRestId = p.id || state.admin?.restaurantId || state.admin?.id || state.restaurant.id || 'admin-1';

      const adminEmail = state.admin?.email?.trim().toLowerCase();
      const updatedAccounts = state.restaurantAccounts.map(acc => {
        const accEmail = acc.ownerEmail?.trim().toLowerCase();
        if (acc.id === targetRestId || (adminEmail && accEmail === adminEmail && targetRestId !== 'admin-1')) {
          // Explicitly map ALL restaurant field names to account field names
          const merged: RestaurantAccount = {
            ...acc,
            // Name
            restaurantName: restName || acc.restaurantName,
            // Contact
            ownerPhone: p.phone || p.ownerPhone || acc.ownerPhone,
            ownerEmail: p.email || p.ownerEmail || acc.ownerEmail,
            // Details
            address: p.address ?? acc.address,
            tagline: p.tagline ?? acc.tagline,
            promoText: p.promoText ?? acc.promoText,
            cuisines: p.cuisines ?? acc.cuisines,
            googleMapsUrl: p.googleMapsUrl ?? acc.googleMapsUrl,
            // Images
            logo: p.logo ?? acc.logo,
            posterImage: p.posterImage ?? acc.posterImage,
            bannerImage: p.bannerImage ?? acc.bannerImage,
            // Hours
            openTime: p.openTime ?? acc.openTime,
            closeTime: p.closeTime ?? acc.closeTime,
            daySpecificHours: p.daySpecificHours ?? acc.daySpecificHours,
            // Delivery
            deliveryEnabled: p.deliveryEnabled !== undefined ? p.deliveryEnabled : acc.deliveryEnabled,
            deliveryRadius: p.deliveryRadius !== undefined ? p.deliveryRadius : acc.deliveryRadius,
            deliveryCharge: p.deliveryCharge !== undefined ? p.deliveryCharge : acc.deliveryCharge,
            freeDeliveryDistance: p.freeDeliveryDistance !== undefined ? p.freeDeliveryDistance : acc.freeDeliveryDistance,
            freeDeliveryMinAmount: p.freeDeliveryMinAmount !== undefined ? p.freeDeliveryMinAmount : acc.freeDeliveryMinAmount,
            freeDeliveryDistanceEnabled: p.freeDeliveryDistanceEnabled !== undefined ? p.freeDeliveryDistanceEnabled : acc.freeDeliveryDistanceEnabled,
            freeDeliveryMinAmountEnabled: p.freeDeliveryMinAmountEnabled !== undefined ? p.freeDeliveryMinAmountEnabled : acc.freeDeliveryMinAmountEnabled,
            indiningRadius: p.indiningRadius !== undefined ? p.indiningRadius : acc.indiningRadius,
            takeawayRadius: p.takeawayRadius !== undefined ? p.takeawayRadius : acc.takeawayRadius,
            verificationRadius: p.verificationRadius !== undefined ? p.verificationRadius : acc.verificationRadius,
            // UPI
            upiId: p.upiId ?? acc.upiId,
            // Location
            latitude: p.latitude !== undefined ? p.latitude : acc.latitude,
            longitude: p.longitude !== undefined ? p.longitude : acc.longitude,
            // Customization Toggles
            mustLoginBeforeOrder: p.mustLoginBeforeOrder !== undefined ? p.mustLoginBeforeOrder : acc.mustLoginBeforeOrder,
            locationVerificationEnabled: p.locationVerificationEnabled !== undefined ? p.locationVerificationEnabled : acc.locationVerificationEnabled,
            overlayLogoOnMeals: p.overlayLogoOnMeals !== undefined ? p.overlayLogoOnMeals : acc.overlayLogoOnMeals,
            fssai: p.fssai ?? acc.fssai,
            gst: p.gst ?? acc.gst,
            tableCount: p.tableCount !== undefined ? p.tableCount : acc.tableCount,
          };
          return merged;
        }
        return acc;
      });

      // Immediately persist to localStorage so page refresh gets fresh data
      try {
        localStorage.setItem('meenufy_accounts_cache', JSON.stringify(updatedAccounts));
      } catch {}

      const updatedRestaurant: typeof state.restaurant = {
        ...state.restaurant,
        id: targetRestId,
        name: restName || state.restaurant.name,
        phone: p.phone || p.ownerPhone || state.restaurant.phone,
        email: p.email || p.ownerEmail || state.restaurant.email,
        address: p.address !== undefined ? p.address : state.restaurant.address,
        tagline: p.tagline !== undefined ? p.tagline : state.restaurant.tagline,
        cuisines: p.cuisines !== undefined ? p.cuisines : state.restaurant.cuisines,
        googleMapsUrl: p.googleMapsUrl !== undefined ? p.googleMapsUrl : state.restaurant.googleMapsUrl,
        logo: p.logo !== undefined ? p.logo : state.restaurant.logo,
        posterImage: p.posterImage !== undefined ? p.posterImage : state.restaurant.posterImage,
        bannerImage: p.bannerImage !== undefined ? p.bannerImage : state.restaurant.bannerImage,
        openTime: p.openTime !== undefined ? p.openTime : state.restaurant.openTime,
        closeTime: p.closeTime !== undefined ? p.closeTime : state.restaurant.closeTime,
        daySpecificHours: p.daySpecificHours !== undefined ? p.daySpecificHours : state.restaurant.daySpecificHours,
        deliveryEnabled: p.deliveryEnabled !== undefined ? p.deliveryEnabled : state.restaurant.deliveryEnabled,
        deliveryRadius: p.deliveryRadius !== undefined ? p.deliveryRadius : state.restaurant.deliveryRadius,
        deliveryCharge: p.deliveryCharge !== undefined ? p.deliveryCharge : state.restaurant.deliveryCharge,
        freeDeliveryDistance: p.freeDeliveryDistance !== undefined ? p.freeDeliveryDistance : state.restaurant.freeDeliveryDistance,
        freeDeliveryMinAmount: p.freeDeliveryMinAmount !== undefined ? p.freeDeliveryMinAmount : state.restaurant.freeDeliveryMinAmount,
        freeDeliveryDistanceEnabled: p.freeDeliveryDistanceEnabled !== undefined ? p.freeDeliveryDistanceEnabled : state.restaurant.freeDeliveryDistanceEnabled,
        freeDeliveryMinAmountEnabled: p.freeDeliveryMinAmountEnabled !== undefined ? p.freeDeliveryMinAmountEnabled : state.restaurant.freeDeliveryMinAmountEnabled,
        indiningRadius: p.indiningRadius !== undefined ? p.indiningRadius : state.restaurant.indiningRadius,
        takeawayRadius: p.takeawayRadius !== undefined ? p.takeawayRadius : state.restaurant.takeawayRadius,
        verificationRadius: p.verificationRadius !== undefined ? p.verificationRadius : state.restaurant.verificationRadius,
        upiId: p.upiId !== undefined ? p.upiId : state.restaurant.upiId,
        latitude: p.latitude !== undefined ? p.latitude : state.restaurant.latitude,
        longitude: p.longitude !== undefined ? p.longitude : state.restaurant.longitude,
      };

      return {
        ...state,
        restaurantAccounts: updatedAccounts,
        restaurant: updatedRestaurant,
      };
    }
    case 'TOGGLE_RESTAURANT_LISTING': {
      const { id, isListedOnHome } = action.payload;
      return {
        ...state,
        restaurantAccounts: state.restaurantAccounts.map(acc =>
          acc.id === id ? { ...acc, isListedOnHome } : acc
        )
      };
    }
    case 'CONFIRM_ORDER_PAYMENT': {
      const { orderId } = action.payload;
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === orderId
            ? { ...o, paymentStatus: 'paid', paymentConfirmedByAdmin: true, status: o.status === 'pending' ? 'preparing' : o.status, updatedAt: Date.now() }
            : o
        )
      };
    }
    case 'SYNC_SINGLE_ORDER_REALTIME': {
      const newOrder = action.payload;
      const exists = state.orders.some(o => o.id === newOrder.id);
      const updatedOrders = exists
        ? state.orders.map(o => o.id === newOrder.id ? { ...o, ...newOrder } : o)
        : [newOrder, ...state.orders];
      
      let dismissedSet = new Set<string>();
      try {
        const raw = localStorage.getItem('meenufy_dismissed_alert_orders');
        if (raw) dismissedSet = new Set(JSON.parse(raw));
      } catch {}

      const isTargetAdmin = state.admin && !newOrder.isManualOrder && newOrder.restaurantId === (state.admin.restaurantId || state.admin.id);
      const isFreshPendingOrder = newOrder.status === 'pending' && (Date.now() - (newOrder.createdAt || 0)) < 30000 && !dismissedSet.has(newOrder.id);

      return {
        ...state,
        orders: updatedOrders,
        ...(isTargetAdmin && !exists && isFreshPendingOrder ? { newOrderAlert: newOrder } : {})
      };
    }
    case 'SET_MANUAL_CLOSED': return { ...state, restaurant: { ...state.restaurant, isManualClosed: action.payload } };
    case 'ADD_MENU_ITEM': {
      const restId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
      const newItem = { ...action.payload, restaurantId: action.payload.restaurantId || restId };
      return { ...state, menuItems: [...state.menuItems, newItem] };
    }
    case 'UPDATE_MENU_ITEM': return { ...state, menuItems: state.menuItems.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'DELETE_MENU_ITEM': return { ...state, menuItems: state.menuItems.filter(i => i.id !== action.payload) };
    case 'ADD_CATEGORY': {
      const restId = state.admin?.restaurantId || state.admin?.id || 'admin-1';
      const newCat = { ...action.payload, restaurantId: action.payload.restaurantId || restId };
      return { ...state, categories: [...state.categories, newCat] };
    }
    case 'UPDATE_CATEGORY': return { ...state, categories: state.categories.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    case 'DELETE_CATEGORY': return { ...state, categories: state.categories.filter(c => c.id !== action.payload) };
    case 'SYNC_ADDONS': {
      const { restaurantId, addons } = action.payload;
      return {
        ...state,
        addons: [
          ...state.addons.filter(a => a && a.restaurantId !== restaurantId),
          ...addons
        ]
      };
    }
    case 'ADD_ADDON':
      return { ...state, addons: [...state.addons, action.payload] };
    case 'UPDATE_ADDON':
      return { ...state, addons: state.addons.map(a => a.id === action.payload.id ? action.payload : a) };
    case 'DELETE_ADDON':
      return { ...state, addons: state.addons.filter(a => a.id !== action.payload) };
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
      // Hard subscription guard — reject order if subscription is inactive
      const orderRestId = action.payload.restaurantId || state.admin?.id || 'admin-1';
      const _orderRestaurant = getActiveRestaurantInfo(state, orderRestId);
      const _subCheck = isSubscriptionActive(_orderRestaurant);
      if (!_subCheck.active) {
        console.warn('[PLACE_ORDER] Blocked: subscription inactive.', _subCheck.reason);
        return state; // drop the order silently (UI should have already blocked it)
      }
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
      
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.id === orderRestId) {
          return {
            ...acc,
            ordersPlacedThisMonth: (acc.ordersPlacedThisMonth || 0) + 1
          };
        }
        return acc;
      });
      const isCurrent = state.admin && state.admin.id === orderRestId;
      
      return { 
        ...state, 
        orders: newOrders, 
        customers, 
        newOrderAlert: action.payload,
        restaurantAccounts: newAccounts,
        ordersPlacedThisMonth: isCurrent ? state.ordersPlacedThisMonth + 1 : state.ordersPlacedThisMonth
      };
    }
    case 'UPDATE_ORDER_STATUS': {
      const orderId = action.payload.id;
      const targetStatus = action.payload.status;
      return {
        ...state,
        orders: state.orders.map(o => o.id === orderId ? { ...o, status: targetStatus, updatedAt: Date.now() } : o)
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
    case 'RATE_ORDER': {
      const order = state.orders.find(o => o.id === action.payload.id);
      const orderRestId = order?.restaurantId || state.admin?.restaurantId || '';
      
      const nextAccounts = state.restaurantAccounts.map(acc => {
        if (acc.id === orderRestId && action.payload.foodRating !== undefined && action.payload.foodRating > 0) {
          const currentRating = acc.rating || 0;
          const currentCount = acc.ratingsCount || 0;
          const newCount = currentCount + 1;
          const newRating = Math.round((((currentRating * currentCount) + action.payload.foodRating) / newCount) * 10) / 10;
          return { ...acc, rating: newRating, ratingsCount: newCount };
        }
        return acc;
      });

      const nextMenuItems = state.menuItems.map(item => {
        const itemRatingVal = action.payload.ratings?.[item.id];
        if (itemRatingVal && Number(itemRatingVal) > 0) {
          const currentRating = item.rating || 0;
          const currentCount = item.ratingsCount || 0;
          const newCount = currentCount + 1;
          const newRating = Math.round((((currentRating * currentCount) + Number(itemRatingVal)) / newCount) * 10) / 10;
          return { ...item, rating: newRating, ratingsCount: newCount };
        }
        return item;
      });

      return {
        ...state,
        restaurantAccounts: nextAccounts,
        menuItems: nextMenuItems,
        orders: state.orders.map(o => o.id === action.payload.id ? {
          ...o,
          ratings: action.payload.ratings,
          deliveryBoyRating: action.payload.deliveryBoyRating,
          deliveryBoyReview: action.payload.deliveryBoyReview,
          foodRating: action.payload.foodRating,
          foodReview: action.payload.foodReview,
          updatedAt: Date.now()
        } : o)
      };
    }
    case 'ADD_TO_CART': {
      const itemRestaurantId = action.payload.restaurantId || getActiveRestaurantId(state);
      const payloadKey = (action.payload.addons || []).map(a => a.optionId).sort().join(',');
      const existing = state.cart.findIndex(i => 
        i.menuItemId === action.payload.menuItemId && 
        i.variant?.name === action.payload.variant?.name &&
        ((i.addons || []).map(a => a.optionId).sort().join(',')) === payloadKey
      );
      if (existing >= 0) {
        const cart = [...state.cart];
        cart[existing] = { ...cart[existing], qty: cart[existing].qty + action.payload.qty, restaurantId: itemRestaurantId };
        return { ...state, cart };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, restaurantId: itemRestaurantId }] };
    }
    case 'REMOVE_FROM_CART': {
      const targetId = typeof action.payload === 'string' ? action.payload : action.payload.menuItemId;
      const targetVariantName = typeof action.payload === 'string' ? undefined : action.payload.variantName;
      const targetAddonKey = typeof action.payload === 'string' ? undefined : action.payload.addonKey;
      return { 
        ...state, 
        cart: state.cart.filter(i => {
          const itemAddonKey = (i.addons || []).map(a => a.optionId).sort().join(',');
          const idMatch = i.menuItemId === targetId;
          const variantMatch = i.variant?.name === targetVariantName;
          const addonsMatch = targetAddonKey === undefined || itemAddonKey === targetAddonKey;
          return !(idMatch && variantMatch && addonsMatch);
        })
      };
    }
    case 'UPDATE_CART_QTY': {
      const { menuItemId, qty, variantName, addonKey } = action.payload;
      return {
        ...state,
        cart: state.cart.map(i => {
          const itemAddonKey = (i.addons || []).map(a => a.optionId).sort().join(',');
          const idMatch = i.menuItemId === menuItemId;
          const variantMatch = i.variant?.name === variantName;
          const addonsMatch = addonKey === undefined || itemAddonKey === addonKey;
          if (idMatch && variantMatch && addonsMatch) {
            return { ...i, qty };
          }
          return i;
        }).filter(i => i.qty > 0)
      };
    }
    case 'CLEAR_CART': return { ...state, cart: [] };
    case 'SET_CUSTOMER_TABLE': return { ...state, customerTableId: action.payload };
    case 'SET_TABLES': return { ...state, tables: action.payload };
    case 'UPDATE_TABLE_STATUS': return {
      ...state,
      tables: state.tables.map(t =>
        t.id === action.payload.id
          ? {
              ...t,
              status: action.payload.status,
              // Clear reservation fields when setting to active/maintenance
              ...(action.payload.status !== 'reserved' ? {
                reservationFrom: undefined,
                reservationTo: undefined,
                reservationGuestName: undefined,
                reservationGuestPhone: undefined,
                reservationGuestCount: undefined,
              } : {})
            }
          : t
      ),
    };
    case 'SET_TABLE_STATUS': return {
      ...state,
      tables: state.tables.map(t =>
        t.id === action.payload.id ? { ...t, ...action.payload } : t
      )
    };
    case 'SET_TABLE_RESERVATION': return {
      ...state,
      tables: state.tables.map(t =>
        t.id === action.payload.id
          ? {
              ...t,
              status: 'reserved' as const,
              reservationFrom: action.payload.reservationFrom,
              reservationTo: action.payload.reservationTo,
              reservationGuestName: action.payload.reservationGuestName,
              reservationGuestPhone: action.payload.reservationGuestPhone,
              reservationGuestCount: action.payload.reservationGuestCount,
            }
          : t
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
      waiterRequests: state.waiterRequests.map(r => r.id === action.payload ? { ...r, resolved: true, resolvedAt: Date.now() } : r)
    };
    case 'LINK_GOOGLE_ACCOUNT': {
      if (!state.admin) return state;
      // Remap all data from old local ID to new Firebase UID
      const oldId = state.admin.restaurantId;
      const newId = action.payload.uid;
      return {
        ...state,
        admin: {
          ...state.admin,
          id: newId,
          restaurantId: newId,
          name: action.payload.name || state.admin.name,
          email: action.payload.email || state.admin.email,
          isFirebaseUser: true,
        },
        menuItems: state.menuItems.map(i => i.restaurantId === oldId ? { ...i, restaurantId: newId } : i),
        categories: state.categories.map(c => c.restaurantId === oldId ? { ...c, restaurantId: newId } : c),
        orders: state.orders.map(o => o.restaurantId === oldId ? { ...o, restaurantId: newId } : o),
      };
    }
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
    case 'SUPER_ADMIN_DELETE_ACCOUNT':
      return {
        ...state,
        restaurantAccounts: state.restaurantAccounts.filter(acc => acc.id !== action.payload)
      };
    case 'UPDATE_SUBSCRIPTION_PLAN': {
      const { planName, billingPeriod, subscriptionId } = action.payload;
      const targetId = state.admin?.id || 'admin-1';
      const days = planName === 'free' ? 13 : billingPeriod === 'yearly' ? 365 : 30;
      const newRenewalDate = Date.now() + days * 24 * 60 * 60 * 1000;
      
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.id === targetId) {
          return {
            ...acc,
            subscriptionPlan: planName,
            subscriptionRenewalDate: newRenewalDate,
            billingPeriod,
            subscriptionId: subscriptionId || null
          };
        }
        return acc;
      });
      
      return {
        ...state,
        subscriptionPlan: planName,
        subscriptionRenewalDate: newRenewalDate,
        billingPeriod,
        subscriptionId: subscriptionId || null,
        restaurantAccounts: newAccounts
      };
    }
    case 'SUPER_ADMIN_UPDATE_SUBSCRIPTION': {
      const { id, subscriptionPlan, ordersPlacedThisMonth, subscriptionRenewalDate, billingCountry, billingPeriod } = action.payload;
      const newAccounts = state.restaurantAccounts.map(acc => {
        if (acc.id === id) {
          return {
            ...acc,
            subscriptionPlan,
            ordersPlacedThisMonth,
            subscriptionRenewalDate,
            billingCountry,
            billingPeriod
          };
        }
        return acc;
      });
      const isCurrent = state.admin && state.admin.id === id;
      return {
        ...state,
        restaurantAccounts: newAccounts,
        ...(isCurrent ? {
          subscriptionPlan,
          ordersPlacedThisMonth,
          subscriptionRenewalDate,
          billingCountry,
          billingPeriod
        } : {})
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
    case 'SYNC_POPULAR_CUISINES':
    case 'SET_POPULAR_CUISINES': {
      const cuisines = action.payload || [];
      try {
        localStorage.setItem('meenufy_cuisines_cache', JSON.stringify(cuisines));
      } catch {}
      return {
        ...state,
        popularCuisines: cuisines,
        cuisinesFromDb: true
      };
    }
    case 'ADD_POPULAR_CUISINE':
      return {
        ...state,
        popularCuisines: [...state.popularCuisines, action.payload]
      };
    case 'REMOVE_POPULAR_CUISINE':
      return {
        ...state,
        popularCuisines: state.popularCuisines.filter(c => c.query !== action.payload)
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
    case 'SYNC_SUPPORT_REQUESTS':
      return {
        ...state,
        supportRequests: action.payload
      };
    case 'SUBMIT_FEEDBACK': {
      const newFeedback: OwnerFeedback = {
        id: `fb-${Date.now()}`,
        restaurantId: state.admin?.restaurantId || 'unknown',
        restaurantName: state.restaurant.name || 'My Restaurant',
        ownerName: state.admin?.name || 'Owner',
        ownerEmail: state.admin?.email || 'owner@restaurant.com',
        ownerPhone: state.restaurant.phone || '',
        ticketType: action.payload.ticketType || 'feedback',
        message: action.payload.message,
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
    case 'SYNC_OWNER_FEEDBACKS':
      return {
        ...state,
        ownerFeedbacks: action.payload
      };
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

export function getActiveRestaurantId(state: AppState): string {
  if (typeof window === 'undefined') return 'admin-1';
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  
  const isAdminView = viewParam === 'admin' || viewParam === 'onboarding' || 
                      (state.isAdminLoggedIn && viewParam !== 'customer' && window.location.pathname !== '/' && window.location.pathname !== '/home' && window.location.pathname !== '/onboarding');
  if (isAdminView && (state.admin?.restaurantId || state.admin?.id)) {
    return state.admin.restaurantId || state.admin.id;
  }
  
  return urlParams.get('restaurant') || 
         state.activeCustomerRestaurantId ||
         localStorage.getItem('meenufy_active_restaurant_id') || 
         state.admin?.restaurantId || 
         state.admin?.id ||
         'admin-1';
}

// ─── Provider ────────────────────────────────────────────────
const STORAGE_KEY = 'meenufy_state_v1';
const CHANNEL_NAME = 'meenufy_realtime';

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let fastAccounts: RestaurantAccount[] | null = null;
    let fastCuisines: any[] | null = null;
    try {
      const fastRaw = localStorage.getItem('meenufy_accounts_cache');
      if (fastRaw) fastAccounts = JSON.parse(fastRaw);
    } catch {}
    try {
      const cuisinesRaw = localStorage.getItem('meenufy_cuisines_cache');
      if (cuisinesRaw) fastCuisines = JSON.parse(cuisinesRaw);
    } catch {}

    if (!raw) {
      const initialPartial: Partial<AppState> = {};
      if (fastAccounts && fastAccounts.length > 0) {
        initialPartial.restaurantAccounts = fastAccounts;
        initialPartial.accountsFromDb = true;
      }
      if (fastCuisines && fastCuisines.length > 0) {
        initialPartial.popularCuisines = fastCuisines;
        initialPartial.cuisinesFromDb = true;
      }
      return initialPartial;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;

    // No dynamic session remapping or overrides for owner email atish3477

    // NOTE: Session restoration from Firebase Auth is handled by onAuthStateChanged
    // listener in StoreProvider. We do NOT restore from sessionStorage here to avoid
    // stale-session issues across different browser tabs.

    // Decouple transient and tab-specific UI states
    delete parsed.currentView;
    delete parsed.adminTab;
    delete parsed.customerTab;
    delete parsed.cart;
    delete parsed.toasts;
    delete parsed.isLoading;
    delete parsed.newOrderAlert;

    // If the user is opening the root path ("/") or "/home", always reset any
    // persisted restaurant selection so they land on the customer home browse
    // screen, not a cached restaurant menu from a previous session.
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const isRootOrHome = p === '/' || p === '/home' || p === '/home/';
      const hasRestaurantParam = window.location.search.includes('restaurant=');
      if (isRootOrHome && !hasRestaurantParam) {
        delete parsed.activeCustomerRestaurantId;
      }
    }

    // Merge fast accounts cache — gives priority to dedicated cache over
    // potentially stale full-state accounts, ensuring real restaurants load fast
    if (fastAccounts && fastAccounts.length > 0) {
      parsed.restaurantAccounts = fastAccounts;
      parsed.accountsFromDb = true;

      const targetId = parsed.admin?.restaurantId || parsed.admin?.id || 'admin-1';
      const matched = fastAccounts.find(acc => acc.id === targetId || (parsed.admin?.email && acc.ownerEmail?.trim().toLowerCase() === parsed.admin.email.trim().toLowerCase()));
      if (matched) {
        parsed.restaurant = {
          ...DEFAULT_RESTAURANT,
          ...parsed.restaurant,
          id: matched.id,
          name: matched.restaurantName || parsed.restaurant?.name || DEFAULT_RESTAURANT.name,
          phone: matched.ownerPhone || parsed.restaurant?.phone || DEFAULT_RESTAURANT.phone,
          email: matched.ownerEmail || parsed.restaurant?.email || DEFAULT_RESTAURANT.email,
          address: matched.address || parsed.restaurant?.address || DEFAULT_RESTAURANT.address,
          tagline: matched.tagline || parsed.restaurant?.tagline || DEFAULT_RESTAURANT.tagline,
          logo: matched.logo || parsed.restaurant?.logo || DEFAULT_RESTAURANT.logo,
          posterImage: matched.posterImage || parsed.restaurant?.posterImage || DEFAULT_RESTAURANT.posterImage,
          bannerImage: matched.bannerImage || parsed.restaurant?.bannerImage || DEFAULT_RESTAURANT.bannerImage,
          cuisines: matched.cuisines || parsed.restaurant?.cuisines || DEFAULT_RESTAURANT.cuisines,
          openTime: matched.openTime || parsed.restaurant?.openTime || '06:00',
          closeTime: matched.closeTime || parsed.restaurant?.closeTime || '00:00',
          daySpecificHours: matched.daySpecificHours || parsed.restaurant?.daySpecificHours || undefined,
          deliveryEnabled: matched.deliveryEnabled !== undefined ? matched.deliveryEnabled : (parsed.restaurant?.deliveryEnabled ?? true),
          deliveryRadius: matched.deliveryRadius !== undefined ? matched.deliveryRadius : (parsed.restaurant?.deliveryRadius ?? 10),
          deliveryCharge: matched.deliveryCharge !== undefined ? matched.deliveryCharge : (parsed.restaurant?.deliveryCharge ?? 40),
          freeDeliveryDistance: matched.freeDeliveryDistance !== undefined ? matched.freeDeliveryDistance : (parsed.restaurant?.freeDeliveryDistance ?? 2),
          freeDeliveryMinAmount: matched.freeDeliveryMinAmount !== undefined ? matched.freeDeliveryMinAmount : (parsed.restaurant?.freeDeliveryMinAmount ?? 150),
          freeDeliveryDistanceEnabled: matched.freeDeliveryDistanceEnabled !== undefined ? matched.freeDeliveryDistanceEnabled : (parsed.restaurant?.freeDeliveryDistanceEnabled ?? true),
          freeDeliveryMinAmountEnabled: matched.freeDeliveryMinAmountEnabled !== undefined ? matched.freeDeliveryMinAmountEnabled : (parsed.restaurant?.freeDeliveryMinAmountEnabled ?? true),
          indiningRadius: matched.indiningRadius !== undefined ? matched.indiningRadius : (parsed.restaurant?.indiningRadius ?? 5),
          takeawayRadius: matched.takeawayRadius !== undefined ? matched.takeawayRadius : (parsed.restaurant?.takeawayRadius ?? 10),
          verificationRadius: matched.verificationRadius !== undefined ? matched.verificationRadius : (parsed.restaurant?.verificationRadius ?? 50),
          upiId: matched.upiId || parsed.restaurant?.upiId || '',
          googleMapsUrl: matched.googleMapsUrl || parsed.restaurant?.googleMapsUrl || '',
          latitude: matched.latitude !== undefined ? matched.latitude : parsed.restaurant?.latitude,
          longitude: matched.longitude !== undefined ? matched.longitude : parsed.restaurant?.longitude,
        };
      }
    }
    if (fastCuisines && fastCuisines.length > 0) {
      parsed.popularCuisines = fastCuisines;
      parsed.cuisinesFromDb = true;
    }

    return parsed;
  } catch {
    return {};
  }
}


function saveState(state: AppState) {
  try {
    // Don't persist transient UI state or tab-local states
    const { toasts, isLoading, newOrderAlert, cart, currentView, adminTab, customerTab, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    
    if (state.admin?.restaurantId) {
      localStorage.setItem('meenufy_active_restaurant_id', state.admin.restaurantId);
    }
  } catch {}
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const savedState = loadState();
  const [urlSearch, setUrlSearch] = useState(typeof window !== 'undefined' ? window.location.search : '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUrlChange = () => {
      if (window.location.search !== urlSearch) {
        setUrlSearch(window.location.search);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    // Removed: setInterval polling every 500ms was causing 2 unnecessary re-renders/second
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [urlSearch]);

  let initialAdminTab: 'home' | 'menu' | 'customers' | 'analysis' | 'more' = 'home';
  if (savedState && savedState.admin?.isStaff && savedState.admin.permissions) {
    const perms = savedState.admin.permissions;
    if (perms.includes('orders') || perms.includes('qr_tables')) initialAdminTab = 'home';
    else if (perms.includes('menu')) initialAdminTab = 'menu';
    else if (perms.includes('customers')) initialAdminTab = 'customers';
    else if (perms.includes('analysis')) initialAdminTab = 'analysis';
    else initialAdminTab = 'more';
  }
  const [state, dispatch] = useReducer(reducer, {
    ...DEFAULT_STATE,
    ...savedState,
    // Always reset transient state
    toasts: [],
    isLoading: false,
    newOrderAlert: null,
    cart: [],
    currentView: 'admin', // always start admin
    adminTab: initialAdminTab,
  });

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `toast-${Date.now()}`;
    dispatch({ type: 'ADD_TOAST', payload: { id, type, message } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
  }, []);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const isBroadcasting = useRef(false);

  // Debounced save to localStorage — prevents blocking main thread on every dispatch
  // (e.g. every Firebase realtime update, order sync, waiter ping)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState(state);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // ── Firebase Auth State Listener ──────────────────────────────────────────────
  // This is the KEY to multi-device login. Firebase Auth persists the login session
  // in IndexedDB (not localStorage), so it works across devices, incognito, etc.
  // onAuthStateChanged fires immediately on app load when Firebase has a valid session.
  useEffect(() => {
    if (!hasFirebaseConfig || !auth || !db) return;
    const unsubscribeAuth = onAuthStateChanged(async (fbUser) => {
      // If Firebase has a logged-in user but our app state doesn't yet know about them,
      // restore the session by fetching data from Firebase DB.
      const currentAdmin = stateRef.current?.admin;
      const isAlreadyLoggedIn = currentAdmin && currentAdmin.isLoggedIn && !currentAdmin.isStaff && !currentAdmin.isDeliveryBoy;

      if (fbUser) {
        const authRole = localStorage.getItem('meenufy_auth_role');
        
        // If logged in as customer (explicitly set or customer page)
        if (authRole === 'customer') {
          try {
            const custData = await dbGet(`customers/${fbUser.id}`);
            const localUser = {
              name: fbUser.user_metadata?.full_name || fbUser.email?.split('@')[0] || 'Customer',
              phone: custData?.phone || fbUser.phone || '',
              email: fbUser.email || '',
              uniqueId: custData?.uniqueId || '',
              googleId: fbUser.id
            };
            localStorage.setItem('meenufy_customer_google_user', JSON.stringify(localUser));
            localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(localUser));
            localStorage.setItem('meenufy_customer_user_logged_in', 'true');
          } catch (err) {
            console.error('Failed to restore customer session:', err);
          }
          return; // Strictly DO NOT log into admin!
        }

        // If logged in as admin
        if (!isAlreadyLoggedIn) {
          try {
            const fbEmail = fbUser.email?.trim().toLowerCase() || '';

            let resolvedAdminId = fbUser.id;
            let dbMatchedAccount: any = null;

            const allAccountsObj = await dbGet('restaurantAccounts');
            if (allAccountsObj) {
              if (allAccountsObj[fbUser.id]) {
                resolvedAdminId = fbUser.id;
                dbMatchedAccount = { ...allAccountsObj[fbUser.id], id: fbUser.id };
              } else {
                const matchedEntry = Object.entries(allAccountsObj).find(
                  ([_, acc]: [string, any]) => acc.ownerEmail?.trim().toLowerCase() === fbEmail
                );
                if (matchedEntry) {
                  resolvedAdminId = matchedEntry[0];
                  dbMatchedAccount = { ...(matchedEntry[1] as any), id: matchedEntry[0] };
                }
              }
            }

            const isTargetingAdminRoute = typeof window !== 'undefined' && 
              (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/onboarding') || window.location.search.includes('view=admin'));

            const isDbAdmin = !!dbMatchedAccount || isTargetingAdminRoute || authRole === 'admin';

            if (isDbAdmin) {
              // This is an Admin account! ONLY log into admin if user is on an admin route/view or authRole is admin.
              // NEVER auto-convert an Admin account into a signed-in customer session on customer pages!
              if (isTargetingAdminRoute || authRole === 'admin') {
                if (dbMatchedAccount && dbMatchedAccount.status === 'blocked') {
                  await signOutUser();
                  return;
                }
                const adminUser = {
                  id: resolvedAdminId,
                  name: dbMatchedAccount?.ownerName || fbUser.user_metadata?.full_name || fbUser.email?.split('@')[0] || 'Owner',
                  email: fbUser.email || '',
                  restaurantId: resolvedAdminId,
                  isLoggedIn: true,
                  isFirebaseUser: true,
                  restaurantName: dbMatchedAccount?.restaurantName || 'My Restaurant',
                  ownerPhone: dbMatchedAccount?.ownerPhone || fbUser.phone || '+91 99999 88888',
                  existingAccount: dbMatchedAccount || undefined
                };
                dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });
                localStorage.setItem('meenufy_auth_role', 'admin');
              }
              return;
            }

            // Only for explicit customer auth sessions (authRole === 'customer')
            if (authRole === 'customer') {
              const localUser = {
                name: fbUser.user_metadata?.full_name || fbUser.email?.split('@')[0] || 'Customer',
                phone: fbUser.phone || '',
                email: fbUser.email || '',
                googleId: fbUser.id
              };
              localStorage.setItem('meenufy_customer_google_user', JSON.stringify(localUser));
              localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(localUser));
              localStorage.setItem('meenufy_customer_user_logged_in', 'true');
              return;
            }

            if (dbMatchedAccount && dbMatchedAccount.status === 'blocked') {
              await signOutUser();
              return;
            }

            const adminUser = {
              id: resolvedAdminId,
              name: fbUser.user_metadata?.full_name || fbUser.email?.split('@')[0] || 'Owner',
              email: fbUser.email || '',
              restaurantId: resolvedAdminId,
              isLoggedIn: true,
              isFirebaseUser: true,
              restaurantName: dbMatchedAccount?.restaurantName || 'My Restaurant',
              ownerPhone: dbMatchedAccount?.ownerPhone || fbUser.phone || '+91 99999 88888',
              existingAccount: dbMatchedAccount || undefined
            };

            dispatch({ type: 'LOGIN_ADMIN', payload: adminUser });
          } catch (err) {
            console.error('Failed to restore session from Firebase Auth:', err);
          }
        }
      }
    });
    return () => unsubscribeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // Apply body theme class separately for customer and admin tabs
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isCustomerTab = urlParams.get('view') === 'customer' || state.currentView === 'customer';
    const activeTheme = isCustomerTab ? (state.customerTheme || 'light') : (state.adminTheme || 'dark');
    
    if (activeTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [state.adminTheme, state.customerTheme, state.currentView]);

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
      document.documentElement.style.setProperty('--customer-bestseller-border', theme.bestsellerBg);
    } else {
      document.documentElement.style.removeProperty('--customer-bestseller-bg');
      document.documentElement.style.removeProperty('--customer-bestseller-border');
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

  // Listen to PWA install prompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      dispatch({ type: 'SET_STATE', payload: { deferredPrompt: e } });
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  // CRITICAL: useMemo so targetRestaurantId only changes when the ACTUAL restaurant changes.
  // Previously this was computed inline, causing it to recompute on every state update
  // (e.g. every orders sync, waiterRequest, etc.), which tore down and rebuilt ALL Firebase
  // listeners on every dispatch — causing menu items to briefly clear and the customer menu
  // to flash/vanish repeatedly especially for large menus like Hideout Cafe (150+ items).
  const targetRestaurantId = useMemo(() => {
    const urlParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('restaurant') : null;
    let rId = urlParam || state.activeCustomerRestaurantId || state.admin?.restaurantId || state.admin?.id;
    if (!rId || rId === 'admin-1' || rId === 'super-admin' || rId === 'super-admin-atish') {
      rId = 'b92eabc0-d08a-40ac-bd1a-e2ff086f9a84';
    }
    return rId;
  }, [state.activeCustomerRestaurantId, state.admin?.restaurantId, state.admin?.id]);

  // 1. Global Supabase sync listeners (Subscribed once on app load)
  useEffect(() => {
    if (!hasFirebaseConfig) return;

    // Sync restaurant accounts (all active outlets)
    const unsubscribeAccounts = dbSubscribe('restaurantAccounts', (data) => {
      let accounts: RestaurantAccount[] = data ? Object.entries(data).map(([key, val]: [string, any]) => ({
        ...val,
        id: key
      })) : [];

      // Protect user's local saved outlet info from being overwritten by stale cloud snapshots
      try {
        const savedRaw = localStorage.getItem('meenufy_saved_outlet_info');
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          if (saved && (saved.name || saved.restaurantName)) {
            const sName = saved.name || saved.restaurantName;
            const curEmail = stateRef.current.admin?.email?.trim().toLowerCase();
            accounts = accounts.map(acc => {
              if (acc.id === 'admin-1' || acc.id === stateRef.current.admin?.id || (curEmail && acc.ownerEmail?.trim().toLowerCase() === curEmail)) {
                return {
                  ...acc,
                  restaurantName: sName,
                  ...(saved.phone ? { ownerPhone: saved.phone } : {}),
                  ...(saved.email ? { ownerEmail: saved.email } : {}),
                  ...(saved.address ? { address: saved.address } : {}),
                  ...(saved.tagline ? { tagline: saved.tagline } : {}),
                  ...(saved.logo ? { logo: saved.logo } : {}),
                  ...(saved.posterImage ? { posterImage: saved.posterImage } : {}),
                  ...(saved.bannerImage ? { bannerImage: saved.bannerImage } : {}),
                  ...(saved.openTime ? { openTime: saved.openTime } : {}),
                  ...(saved.closeTime ? { closeTime: saved.closeTime } : {}),
                };
              }
              return acc;
            });
          }
        }
      } catch {}

      if (accounts.length > 0) {
        dispatch({
          type: 'SYNC_RESTAURANT_ACCOUNTS',
          payload: accounts
        });

        const curAdmin = stateRef.current.admin;
        if (curAdmin && !curAdmin.isSuperAdmin) {
          const dbAcc = accounts.find(a => a.id === curAdmin.id);
          if (dbAcc && !dbAcc.billingCountry) {
            const detected = detectBillingCountry();
            dbUpdate(`restaurantAccounts/${curAdmin.id}`, {
              billingCountry: detected
            }).catch((e: any) => console.error("Failed to sync billingCountry back to DB:", e));
          }
        }
      }
    });

    const isUrlAdmin = typeof window !== 'undefined' && window.location.search.includes('view=admin');
    const isLocalAdmin = (() => { try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return !!s.isAdminLoggedIn; } catch { return false; } })();
    const isAdminMode = isUrlAdmin || isLocalAdmin;

    // Listen to Gemini API keys — always load, needed by all restaurant owners for AI features
    const unsubscribeGeminiKeys = dbSubscribe('geminiApiKeys', (data) => {
      if (data) {
        const keys = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as string[];
        dispatch({
          type: 'SET_STATE',
          payload: { geminiApiKeys: keys }
        });
      }
    });

    // Listen to popular cuisines
    const unsubscribePopularCuisines = dbSubscribe('meenufy_config/popularCuisines', (data) => {
      const items = data
        ? ((Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as { name: string; query: string; image: string }[])
        : DEFAULT_POPULAR_CUISINES;
      
      dispatch({
        type: 'SYNC_POPULAR_CUISINES',
        payload: items
      });

      if (!data) {
        dbSet('meenufy_config/popularCuisines', DEFAULT_POPULAR_CUISINES);
      }
    });

    // Listen to ALL restaurant coupons globally for Customer Home Deals section
    const unsubscribeAllCoupons = dbSubscribe('coupons', (data) => {
      if (data && typeof data === 'object') {
        const allList: Coupon[] = [];
        Object.entries(data).forEach(([rId, restCoupons]: [string, any]) => {
          if (restCoupons && typeof restCoupons === 'object') {
            const cList = Array.isArray(restCoupons) ? restCoupons.filter(Boolean) : Object.values(restCoupons);
            cList.forEach((c: any) => {
              if (c && typeof c === 'object') {
                allList.push({ ...c, restaurantId: c.restaurantId || rId });
              }
            });
          }
        });
        dispatch({ type: 'SYNC_ALL_COUPONS', payload: allList });
      }
    });

    // Listen to subscription coupons (global)
    let unsubscribeSubscriptionCoupons = () => {};
    if (isAdminMode) {
      unsubscribeSubscriptionCoupons = dbSubscribe('subscriptionCoupons', (data) => {
        const items: SubscriptionCoupon[] = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as SubscriptionCoupon[] : [];
        dispatch({ type: 'SYNC_SUBSCRIPTION_COUPONS', payload: items });
      });
    }

    // Listen to ownerFeedbacks (global — for super admin to receive all feedback)
    let unsubscribeFeedbacks = () => {};
    if (isAdminMode) {
      unsubscribeFeedbacks = dbSubscribe('ownerFeedbacks', (data) => {
        const feedbacks: OwnerFeedback[] = data ? Object.values(data) as OwnerFeedback[] : [];
        feedbacks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        dispatch({ type: 'SYNC_OWNER_FEEDBACKS', payload: feedbacks });
      });
    }

    // Listen to supportRequests (global — for super admin to receive all support tickets)
    let unsubscribeSupport = () => {};
    if (isAdminMode) {
      unsubscribeSupport = dbSubscribe('supportRequests', (data) => {
        const requests: SupportRequest[] = data ? Object.values(data) as SupportRequest[] : [];
        requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        dispatch({ type: 'SYNC_SUPPORT_REQUESTS', payload: requests });
      });
    }

    // Listen to staffMembers (for login authentication and permissions)
    let unsubscribeStaff = () => {};
    if (isAdminMode) {
      unsubscribeStaff = dbSubscribe('staffMembers', (data) => {
        const staff: StaffMember[] = data ? Object.values(data) as StaffMember[] : [];
        dispatch({ type: 'SYNC_STAFF_MEMBERS', payload: staff });
      });
    }

    // Listen to delivery riders
    let unsubscribeDeliveryBoys = () => {};
    if (isAdminMode) {
      unsubscribeDeliveryBoys = dbSubscribe('deliveryBoys', (data) => {
        const boys: DeliveryBoy[] = data ? Object.values(data) as DeliveryBoy[] : [];
        dispatch({ type: 'SYNC_DELIVERY_BOYS', payload: boys });
      });
    }

    return () => {
      unsubscribeAccounts();
      unsubscribeGeminiKeys();
      unsubscribePopularCuisines();
      unsubscribeAllCoupons();
      unsubscribeSubscriptionCoupons();
      unsubscribeFeedbacks();
      unsubscribeSupport();
      unsubscribeStaff();
      unsubscribeDeliveryBoys();
    };
  }, []);


  // 2. Restaurant-specific Supabase sync listeners (Subscribed and refreshed when targetRestaurantId changes)
  useEffect(() => {
    if (!hasFirebaseConfig || !targetRestaurantId) return;

    const isCustomer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'customer';

    // Sync restaurant profile details
    const unsubscribeRestaurant = dbSubscribe(`restaurants/${targetRestaurantId}`, (data) => {
      if (data) {
        dispatch({
          type: 'SET_STATE',
          payload: { restaurant: { ...stateRef.current.restaurant, ...data, id: targetRestaurantId } }
        });
      }
    });

    const unsubscribeMenu = dbSubscribe(`menuItems/${targetRestaurantId}`, (data) => {
      const items: MenuItem[] = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as MenuItem[] : [];
      const itemsWithId = items.map(item => ({ ...item, restaurantId: item.restaurantId || targetRestaurantId }));
      dispatch({ type: 'SYNC_MENU_ITEMS', payload: { restaurantId: targetRestaurantId, items: itemsWithId } });
    });

    const unsubscribeCat = dbSubscribe(`categories/${targetRestaurantId}`, (data) => {
      if (data) {
        const cats: MenuCategory[] = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as MenuCategory[];
        const catsWithId = cats.map(c => ({ ...c, restaurantId: c.restaurantId || targetRestaurantId }));
        dispatch({ type: 'SYNC_CATEGORIES', payload: { restaurantId: targetRestaurantId, categories: catsWithId } });
      }
    });

    // Listen to orders
    const unsubscribeOrder = dbSubscribe(`orders/${targetRestaurantId}`, (data) => {
      const ords: Order[] = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as Order[] : [];
      const ordsWithId = ords.map(o => ({
        ...o,
        restaurantId: o.restaurantId || targetRestaurantId
      }));

      // Check for fresh incoming pending orders to trigger the fullscreen alert popup
      const currentAdmin = stateRef.current.admin;
      const currentOrders = stateRef.current.orders;
      
      if (currentAdmin && (currentAdmin.restaurantId === targetRestaurantId || currentAdmin.id === targetRestaurantId)) {
        let dismissedSet = new Set<string>();
        try {
          const raw = localStorage.getItem('meenufy_dismissed_alert_orders');
          if (raw) dismissedSet = new Set(JSON.parse(raw));
        } catch {}

        const freshPending = ordsWithId.find(o => {
          const alreadyExists = currentOrders.some(existing => existing.id === o.id);
          const isFresh = o.status === 'pending' && (Date.now() - (o.createdAt || 0)) < 15 * 60 * 1000;
          return !alreadyExists && isFresh && !dismissedSet.has(o.id) && !o.isManualOrder;
        });

        if (freshPending) {
          dispatch({ type: 'SET_STATE', payload: { newOrderAlert: freshPending } });
        }
      }

      dispatch({ 
        type: 'SYNC_ORDERS', 
        payload: { restaurantId: targetRestaurantId, orders: ordsWithId } 
      });
    });

    // Fast 2-second polling fallback to ensure instant order sync under all network conditions
    const fastPollOrdersTimer = setInterval(() => {
      if (!targetRestaurantId) return;
      dbGet(`orders/${targetRestaurantId}`).then(data => {
        if (!data) return;
        const ords: Order[] = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as Order[];
        const ordsWithId = ords.map(o => ({
          ...o,
          restaurantId: o.restaurantId || targetRestaurantId
        }));
        
        const currentAdmin = stateRef.current.admin;
        const currentOrders = stateRef.current.orders;
        
        if (currentAdmin && (currentAdmin.restaurantId === targetRestaurantId || currentAdmin.id === targetRestaurantId)) {
          let dismissedSet = new Set<string>();
          try {
            const raw = localStorage.getItem('meenufy_dismissed_alert_orders');
            if (raw) dismissedSet = new Set(JSON.parse(raw));
          } catch {}

          const freshPending = ordsWithId.find(o => {
            const alreadyExists = currentOrders.some(existing => existing.id === o.id);
            const isFresh = o.status === 'pending' && (Date.now() - (o.createdAt || 0)) < 15 * 60 * 1000;
            return !alreadyExists && isFresh && !dismissedSet.has(o.id) && !o.isManualOrder;
          });

          if (freshPending) {
            dispatch({ type: 'SET_STATE', payload: { newOrderAlert: freshPending } });
          }
        }

        dispatch({ 
          type: 'SYNC_ORDERS', 
          payload: { restaurantId: targetRestaurantId, orders: ordsWithId } 
        });
      }).catch(() => {});
    }, 2000);

    // Listen to waiterRequests
    const unsubscribeWaiter = dbSubscribe(`waiterRequests/${targetRestaurantId}`, (data) => {
      const reqs: WaiterRequest[] = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as WaiterRequest[] : [];
      const reqsWithId = reqs.map(r => ({
        ...r,
        restaurantId: r.restaurantId || targetRestaurantId
      }));
      dispatch({ 
        type: 'SYNC_WAITER_REQUESTS', 
        payload: { restaurantId: targetRestaurantId, requests: reqsWithId } 
      });
    });

    // Listen to tables
    const unsubscribeTables = dbSubscribe(`tables/${targetRestaurantId}`, (data) => {
      if (data) {
        const tbls = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as TableInfo[];
        dispatch({
          type: 'SET_STATE',
          payload: { tables: tbls }
        });
      } else if (!isCustomer && stateRef.current.tables.length > 0) {
        dbSet(`tables/${targetRestaurantId}`, stateRef.current.tables);
      }
    });

    // Listen to schedules
    const unsubscribeSchedules = dbSubscribe(`schedules/${targetRestaurantId}`, (data) => {
      if (data) {
        const schsRaw = (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean);
        const schs = schsRaw.map((s: any) => ({
          ...s,
          targets: s.targets || []
        })) as MealSchedule[];
        dispatch({
          type: 'SET_STATE',
          payload: { schedules: schs }
        });
      }
    });

    // Listen to customers
    const unsubscribeCustomers = dbSubscribe(`customers/${targetRestaurantId}`, (data) => {
      const custs: CustomerRecord[] = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as CustomerRecord[] : [];
      dispatch({
        type: 'SYNC_CUSTOMERS',
        payload: { restaurantId: targetRestaurantId, customers: custs }
      });
    });

    // Listen to coupons
    const unsubscribeCoupons = dbSubscribe(`coupons/${targetRestaurantId}`, (data) => {
      const items: Coupon[] = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) as Coupon[] : [];
      dispatch({ type: 'SYNC_COUPONS', payload: items });
    });

    // Listen to addons
    const unsubscribeAddons = dbSubscribe(`addons/${targetRestaurantId}`, (data) => {
      const rawItems = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) : [];
      const items: AddonConfig[] = rawItems.map((addon: any) => ({
        ...addon,
        options: addon.options || [],
        targetCategoryIds: addon.targetCategoryIds || [],
        targetMealIds: addon.targetMealIds || []
      })) as AddonConfig[];
      dispatch({ type: 'SYNC_ADDONS', payload: { restaurantId: targetRestaurantId, addons: items } });
    });

    return () => {
      unsubscribeRestaurant();
      unsubscribeMenu();
      unsubscribeCat();
      unsubscribeOrder();
      unsubscribeWaiter();
      unsubscribeTables();
      clearInterval(fastPollOrdersTimer);
      unsubscribeSchedules();
      unsubscribeCustomers();
      unsubscribeCoupons();
      unsubscribeAddons();
    };
  }, [targetRestaurantId]);


  // 3. Delivery Boy direct assigned order listener for instant updates
  useEffect(() => {
    if (!hasFirebaseConfig || !state.admin?.isDeliveryBoy) return;

    const riderId = state.admin.id;
    const rId = state.admin.restaurantId || 'admin-1';
    
    let unsubscribeOrder: (() => void) | null = null;

    const unsubscribeRider = dbSubscribe(`deliveryBoys/${riderId}`, (riderData) => {
      if (unsubscribeOrder) {
        unsubscribeOrder();
        unsubscribeOrder = null;
      }
      
      if (riderData && riderData.assignedOrderId) {
        const orderId = riderData.assignedOrderId;
        unsubscribeOrder = dbSubscribe(`orders/${rId}/${orderId}`, (orderVal) => {
          if (orderVal) {
            dispatch({
              type: 'SYNC_ORDERS',
              payload: {
                restaurantId: rId,
                orders: [ { ...orderVal, id: orderId, restaurantId: rId } ]
              }
            });
          }
        });
      }
    });

    return () => {
      unsubscribeRider();
      if (unsubscribeOrder) unsubscribeOrder();
    };
  }, [state.admin?.id, state.admin?.isDeliveryBoy]);


  // Broadcast state changes to other tabs
  const wrappedDispatch = useCallback((action: Action) => {
    dispatch(action);

    // Mirror changes to Realtime Database if active
    if (hasFirebaseConfig && db) {
      try {
        const currentState = stateRef.current;
        const restId = getActiveRestaurantId(currentState);

        const handleDbPromise = (promise: Promise<any>, errorMsg: string) => {
          promise.catch((err: any) => {
            console.error(`${errorMsg}:`, err);
            addToast('error', `${errorMsg}: ${err.message || err}`);
          });
        };

        // Keys that must never be written to Firebase for security reasons
        const SENSITIVE_KEYS = new Set(['password']);

        const sanitizeDbData = (obj: any, keysToStrip: Set<string> = SENSITIVE_KEYS): any => {
          if (obj === null || obj === undefined) return null;
          if (Array.isArray(obj)) {
            return obj.map(item => sanitizeDbData(item, keysToStrip));
          }
          if (typeof obj === 'object') {
            const cleaned: any = {};
            for (const key of Object.keys(obj)) {
              // Strip sensitive fields and undefined values
              if (obj[key] !== undefined && !keysToStrip.has(key)) {
                cleaned[key] = sanitizeDbData(obj[key], keysToStrip);
              }
            }
            return cleaned;
          }
          return obj;
        };
        
        switch (action.type) {
          case 'ADD_MENU_ITEM':
          case 'UPDATE_MENU_ITEM': {
            const itemRestId = action.payload.restaurantId || restId;
            handleDbPromise(
              dbSet(`menuItems/${itemRestId}/${action.payload.id}`, sanitizeDbData({
                ...action.payload,
                restaurantId: itemRestId
              })),
              'Failed to sync menu item to database'
            );
            break;
          }
          case 'DELETE_MENU_ITEM': {
            const itemRestId = currentState.menuItems.find(i => i.id === action.payload)?.restaurantId || restId;
            handleDbPromise(
              dbRemove(`menuItems/${itemRestId}/${action.payload}`),
              'Failed to delete menu item from database'
            );
            break;
          }
          case 'ADD_CATEGORY':
          case 'UPDATE_CATEGORY': {
            const catRestId = action.payload.restaurantId || restId;
            handleDbPromise(
              dbSet(`categories/${catRestId}/${action.payload.id}`, sanitizeDbData({
                ...action.payload,
                restaurantId: catRestId
              })),
              'Failed to sync category to database'
            );
            break;
          }
          case 'DELETE_CATEGORY': {
            const catRestId = currentState.categories.find(c => c.id === action.payload)?.restaurantId || restId;
            handleDbPromise(
              dbRemove(`categories/${catRestId}/${action.payload}`),
              'Failed to delete category from database'
            );
            break;
          }
          case 'PLACE_ORDER': {
            const orderRestId = action.payload.restaurantId || restId;
            const _orderRestaurant = getActiveRestaurantInfo(currentState, orderRestId);
            const _subCheck = isSubscriptionActive(_orderRestaurant);
            if (!_subCheck.active) {
              console.warn('[Supabase PLACE_ORDER] Blocked writing to DB: subscription inactive.', _subCheck.reason);
              break;
            }
            handleDbPromise(
              dbSet(`orders/${orderRestId}/${action.payload.id}`, sanitizeDbData({
                ...action.payload,
                restaurantId: orderRestId
              })),
              'Failed to place order in database'
            );
            
            // Sync customer details
            const phone = action.payload.customerPhone;
            if (phone) {
              const cleanPhone = phone.replace(/[^a-zA-Z0-9]/g, '');
              const matchedCust = currentState.customers.find(c => c.phone === phone);
              const pointsEarned = action.payload.pointsEarned || 0;
              const pointsRedeemed = action.payload.pointsRedeemed || 0;
              
              const updatedCust = matchedCust ? {
                ...matchedCust,
                name: action.payload.customerName || matchedCust.name,
                email: action.payload.customerEmail || matchedCust.email,
                orderCount: (matchedCust.orderCount || 0) + 1,
                totalSpent: (matchedCust.totalSpent || 0) + action.payload.totalAmount,
                lastVisit: Date.now(),
                points: (matchedCust.points || 0) + pointsEarned - pointsRedeemed,
              } : {
                id: `cust-${Date.now()}`,
                name: action.payload.customerName || 'Guest',
                phone: phone,
                email: action.payload.customerEmail || '',
                orderCount: 1,
                totalSpent: action.payload.totalAmount,
                lastVisit: Date.now(),
                firstVisit: Date.now(),
                points: pointsEarned - pointsRedeemed,
                isVip: false,
              };

              dbSet(`customers/${orderRestId}/${cleanPhone}`, sanitizeDbData(updatedCust))
                .catch((e: any) => console.error('Failed to sync customer profile:', e));
            }

            // Increment ordersPlacedThisMonth (read-modify-write)
            const matchedAcc = currentState.restaurantAccounts.find(acc => acc.id === orderRestId);
            const currentOrders = matchedAcc?.ordersPlacedThisMonth || 0;
            dbUpdate(`restaurantAccounts/${orderRestId}`, { ordersPlacedThisMonth: currentOrders + 1 }).catch(() => {});
            dbUpdate(`restaurants/${orderRestId}`, { ordersPlacedThisMonth: currentOrders + 1 }).catch(() => {});
            
            break;
          }
          case 'UPDATE_ORDER_STATUS': {
            const orderRestId = currentState.orders.find(o => o.id === action.payload.id)?.restaurantId || restId;
            handleDbPromise(
              dbUpdate(`orders/${orderRestId}/${action.payload.id}`, sanitizeDbData({ status: action.payload.status })),
              'Failed to update order status'
            );
            break;
          }
          case 'UPDATE_ORDER_PAYMENT': {
            const orderRestId = currentState.orders.find(o => o.id === action.payload.id)?.restaurantId || restId;
            handleDbPromise(
              dbUpdate(`orders/${orderRestId}/${action.payload.id}`, sanitizeDbData({
                ...(action.payload.method ? { paymentMethod: action.payload.method } : {}),
                ...(action.payload.status ? { paymentStatus: action.payload.status } : {}),
              })),
              'Failed to update order payment status'
            );
            break;
          }
          case 'RATE_ORDER': {
            const orderRestId = currentState.orders.find(o => o.id === action.payload.id)?.restaurantId || restId;
            const updatePayload: any = {
              ratings: action.payload.ratings || {},
              updatedAt: Date.now()
            };
            if (action.payload.deliveryBoyRating !== undefined) {
              updatePayload.deliveryBoyRating = action.payload.deliveryBoyRating;
            }
            if (action.payload.deliveryBoyReview !== undefined) {
              updatePayload.deliveryBoyReview = action.payload.deliveryBoyReview;
            }
            if (action.payload.foodRating !== undefined) {
              updatePayload.foodRating = action.payload.foodRating;
            }
            if (action.payload.foodReview !== undefined) {
              updatePayload.foodReview = action.payload.foodReview;
            }
            handleDbPromise(
              dbUpdate(`orders/${orderRestId}/${action.payload.id}`, sanitizeDbData(updatePayload)),
              'Failed to submit ratings'
            );

            // Compute and update restaurant rating + ratingsCount in database
            if (action.payload.foodRating !== undefined && action.payload.foodRating > 0) {
              const matchedAcc = currentState.restaurantAccounts.find(acc => acc.id === orderRestId);
              const currentRating = matchedAcc?.rating || 0;
              const currentCount = matchedAcc?.ratingsCount || 0;
              const newCount = currentCount + 1;
              const newRating = Math.round((((currentRating * currentCount) + action.payload.foodRating) / newCount) * 10) / 10;
              
              dbUpdate(`restaurantAccounts/${orderRestId}`, {
                rating: newRating,
                ratingsCount: newCount
              }).catch((err: any) => console.error('Failed to update restaurantAccount rating:', err));

              dbUpdate(`restaurants/${orderRestId}`, {
                rating: newRating,
                ratingsCount: newCount
              }).catch((err: any) => console.error('Failed to update restaurant rating:', err));
            }

            // Compute and update individual menu items ratings in database
            if (action.payload.ratings) {
              Object.entries(action.payload.ratings).forEach(([itemId, itemRatingVal]) => {
                const item = currentState.menuItems.find(i => i.id === itemId);
                const ratingVal = Number(itemRatingVal);
                if (item && ratingVal > 0) {
                  const currentRating = item.rating || 0;
                  const currentCount = item.ratingsCount || 0;
                  const newCount = currentCount + 1;
                  const newRating = Math.round((((currentRating * currentCount) + ratingVal) / newCount) * 10) / 10;
                  
                  dbUpdate(`menuItems/${orderRestId}/${itemId}`, {
                    rating: newRating,
                    ratingsCount: newCount
                  }).catch((err: any) => console.error(`Failed to update item ${itemId} rating:`, err));
                }
              });
            }
            break;
          }
          case 'CALL_WAITER': {
            const waiterRestId = action.payload.restaurantId || restId;
            handleDbPromise(
              dbSet(`waiterRequests/${waiterRestId}/${action.payload.id}`, sanitizeDbData({
                ...action.payload,
                restaurantId: waiterRestId
              })),
              'Failed to request waiter'
            );
            break;
          }
          case 'RESOLVE_WAITER': {
            const waiterRestId = currentState.waiterRequests.find(r => r.id === action.payload)?.restaurantId || restId;
            handleDbPromise(
              dbUpdate(`waiterRequests/${waiterRestId}/${action.payload}`, { resolved: true, resolvedAt: Date.now() }),
              'Failed to resolve waiter request'
            );
            setTimeout(() => {
              dbRemove(`waiterRequests/${waiterRestId}/${action.payload}`).catch((e: any) => console.error("Failed to auto-delete resolved waiter request:", e));
            }, 5000);
            break;
          }
          case 'SET_TABLES': {
            handleDbPromise(
              dbSet(`tables/${restId}`, sanitizeDbData(action.payload)),
              'Failed to update tables'
            );
            break;
          }
          case 'UPDATE_TABLE_STATUS': {
            const updatedTables = currentState.tables.map(t =>
              t.id === action.payload.id
                ? {
                    ...t,
                    status: action.payload.status,
                    ...(action.payload.status !== 'reserved' ? {
                      reservationFrom: null,
                      reservationTo: null,
                      reservationGuestName: null,
                      reservationGuestPhone: null,
                      reservationGuestCount: null,
                    } : {})
                  }
                : t
            );
            handleDbPromise(
              dbSet(`tables/${restId}`, sanitizeDbData(updatedTables)),
              'Failed to update table status'
            );
            break;
          }
          case 'SET_TABLE_STATUS': {
            const updatedTables = currentState.tables.map(t =>
              t.id === action.payload.id ? { ...t, ...action.payload } : t
            );
            handleDbPromise(
              dbSet(`tables/${restId}`, sanitizeDbData(updatedTables)),
              'Failed to update table status'
            );
            break;
          }
          case 'SET_TABLE_RESERVATION': {
            const updatedTables = currentState.tables.map(t =>
              t.id === action.payload.id
                ? {
                    ...t,
                    status: 'reserved',
                    reservationFrom: action.payload.reservationFrom,
                    reservationTo: action.payload.reservationTo,
                    reservationGuestName: action.payload.reservationGuestName || null,
                    reservationGuestPhone: action.payload.reservationGuestPhone || null,
                    reservationGuestCount: action.payload.reservationGuestCount || null,
                  }
                : t
            );
            handleDbPromise(
              dbSet(`tables/${restId}`, sanitizeDbData(updatedTables)),
              'Failed to save reservation'
            );
            break;
          }
          case 'ADD_SCHEDULE':
          case 'UPDATE_SCHEDULE': {
            handleDbPromise(
              dbSet(`schedules/${restId}/${action.payload.id}`, sanitizeDbData(action.payload)),
              'Failed to save schedule'
            );
            break;
          }
          case 'DELETE_SCHEDULE': {
            handleDbPromise(
              dbRemove(`schedules/${restId}/${action.payload}`),
              'Failed to delete schedule'
            );
            break;
          }
          case 'ADD_GEMINI_KEY': {
            handleDbPromise(
              dbSet('geminiApiKeys', sanitizeDbData([...currentState.geminiApiKeys, action.payload])),
              'Failed to add Gemini API key'
            );
            break;
          }
          case 'REMOVE_GEMINI_KEY': {
            handleDbPromise(
              dbSet('geminiApiKeys', sanitizeDbData(currentState.geminiApiKeys.filter(key => key !== action.payload))),
              'Failed to remove Gemini API key'
            );
            break;
          }
          case 'SET_POPULAR_CUISINES': {
            handleDbPromise(
              dbSet('meenufy_config/popularCuisines', sanitizeDbData(action.payload)),
              'Failed to update popular cuisines list'
            );
            break;
          }
          case 'ADD_POPULAR_CUISINE': {
            handleDbPromise(
              dbSet('meenufy_config/popularCuisines', sanitizeDbData([...currentState.popularCuisines, action.payload])),
              'Failed to add popular cuisine'
            );
            break;
          }
          case 'REMOVE_POPULAR_CUISINE': {
            handleDbPromise(
              dbSet('meenufy_config/popularCuisines', sanitizeDbData(currentState.popularCuisines.filter(c => c.query !== action.payload))),
              'Failed to remove popular cuisine'
            );
            break;
          }
          case 'TOGGLE_CUSTOMER_VIP': {
            const cust = currentState.customers.find(c => c.id === action.payload);
            if (cust && cust.phone) {
              const cleanPhone = cust.phone.replace(/[^a-zA-Z0-9]/g, '');
              dbUpdate(`customers/${restId}/${cleanPhone}`, {
                isVip: !cust.isVip
              }).catch((e: any) => console.error('Failed to update VIP status:', e));
            }
            break;
          }
          case 'ADJUST_CUSTOMER_POINTS': {
            const { id, points } = action.payload;
            const cust = currentState.customers.find(c => c.id === id);
            if (cust && cust.phone) {
              const cleanPhone = cust.phone.replace(/[^a-zA-Z0-9]/g, '');
              dbUpdate(`customers/${restId}/${cleanPhone}`, {
                points: points
              }).catch((e: any) => console.error('Failed to adjust customer points:', e));
            }
            break;
          }
          case 'UNFEATURED_ALL_ITEMS': {
            const targetItems = currentState.menuItems.filter(item => item.restaurantId === restId);
            targetItems.forEach(item => {
              handleDbPromise(
                dbUpdate(`menuItems/${restId}/${item.id}`, { isFeatured: false }),
                'Failed to unfeature items'
              );
            });
            break;
          }
          case 'DELETE_ALL_MENU_ITEMS': {
            handleDbPromise(
              dbRemove(`menuItems/${restId}`),
              'Failed to delete all menu items'
            );
            break;
          }
          case 'ADD_COUPON': {
            handleDbPromise(
              dbSet(`coupons/${restId}/${action.payload.id}`, sanitizeDbData(action.payload)),
              'Failed to add coupon'
            );
            break;
          }
          case 'UPDATE_COUPON': {
            handleDbPromise(
              dbUpdate(`coupons/${restId}/${action.payload.id}`, sanitizeDbData(action.payload)),
              'Failed to update coupon'
            );
            break;
          }
          case 'DELETE_COUPON': {
            handleDbPromise(
              dbRemove(`coupons/${restId}/${action.payload}`),
              'Failed to delete coupon'
            );
            break;
          }
          case 'ADD_ADDON': {
            handleDbPromise(
              dbSet(`addons/${restId}/${action.payload.id}`, sanitizeDbData(action.payload)),
              'Failed to add addon'
            );
            break;
          }
          case 'UPDATE_ADDON': {
            handleDbPromise(
              dbUpdate(`addons/${restId}/${action.payload.id}`, sanitizeDbData(action.payload)),
              'Failed to update addon'
            );
            break;
          }
          case 'DELETE_ADDON': {
            handleDbPromise(
              dbRemove(`addons/${restId}/${action.payload}`),
              'Failed to delete addon'
            );
            break;
          }
          case 'COMPLETE_ONBOARDING': {
            if (currentState.admin) {
              const payload = action.payload || { subscriptionPlan: 'free' };
              const plan = payload.subscriptionPlan;
              const renewalDays = plan === 'free' ? 13 : 30;
              const renewalDate = plan === 'free' ? (Date.now() + renewalDays * 24 * 60 * 60 * 1000) : 0;

              const updates: any = {
                id: currentState.admin.id,
                restaurantName: currentState.admin.restaurantName || currentState.restaurant?.name || 'My Restaurant',
                ownerName: currentState.admin.name || 'Owner',
                ownerEmail: currentState.admin.email || '',
                ownerPhone: currentState.admin.ownerPhone || currentState.restaurant?.phone || '+91 99999 88888',
                address: currentState.restaurant?.address || 'India',
                hasCompletedOnboarding: true,
                subscriptionPlan: plan,
                subscriptionRenewalDate: renewalDate,
                createdAt: Date.now(),
                status: 'active',
                isListedOnHome: true,
                rating: 4.5,
                ratingsCount: 1,
                supportedOrderTypes: currentState.restaurant?.supportedOrderTypes || ['dining', 'takeaway', 'delivery'],
                tableCount: 8
              };

              if (payload.basePlanSelectedType) {
                updates.basePlanSelectedType = payload.basePlanSelectedType;
              }

              dbUpdate(`restaurantAccounts/${currentState.admin.id}`, updates).catch(() => {});
              
              const restId = currentState.admin.restaurantId;
              if (restId) {
                dbUpdate(`restaurants/${restId}`, updates).catch(() => {});
              }
            }
            break;
          }
          case 'MARK_ONBOARDING_PENDING': {
            if (currentState.admin) {
              dbUpdate(`restaurantAccounts/${currentState.admin.id}`, {
                hasCompletedOnboarding: false
              }).catch(() => {});
            }
            break;
          }
          case 'ADD_STAFF_MEMBER': {
            handleDbPromise(
              dbSet(`staffMembers/${action.payload.id}`, sanitizeDbData(action.payload, new Set())),
              'Failed to add staff member'
            );
            break;
          }
          case 'UPDATE_STAFF_MEMBER': {
            handleDbPromise(
              dbUpdate(`staffMembers/${action.payload.id}`, sanitizeDbData(action.payload, new Set())),
              'Failed to update staff member'
            );
            break;
          }
          case 'DELETE_STAFF_MEMBER': {
            handleDbPromise(
              dbRemove(`staffMembers/${action.payload}`),
              'Failed to delete staff member'
            );
            break;
          }
          case 'ADD_DELIVERY_BOY': {
            handleDbPromise(
              dbSet(`deliveryBoys/${action.payload.id}`, sanitizeDbData(action.payload, new Set())),
              'Failed to add delivery boy'
            );
            break;
          }
          case 'UPDATE_DELIVERY_BOY': {
            handleDbPromise(
              dbUpdate(`deliveryBoys/${action.payload.id}`, sanitizeDbData(action.payload, new Set())),
              'Failed to update delivery boy'
            );
            break;
          }
          case 'DELETE_DELIVERY_BOY': {
            handleDbPromise(
              dbRemove(`deliveryBoys/${action.payload}`),
              'Failed to delete delivery boy'
            );
            break;
          }
          case 'ASSIGN_DELIVERY_BOY': {
            const { orderId, restaurantId, deliveryBoyId, deliveryOtp } = action.payload;
            handleDbPromise(
              dbUpdate(`orders/${restaurantId}/${orderId}`, {
                deliveryBoyId,
                deliveryStatus: 'assigned',
                deliveryOtp
              }),
              'Failed to assign rider to order'
            );
            handleDbPromise(
              dbUpdate(`deliveryBoys/${deliveryBoyId}`, {
                status: 'delivering',
                assignedOrderId: orderId
              }),
              'Failed to update rider status'
            );
            break;
          }
          case 'CLEAR_ALL_CUSTOMERS': {
            handleDbPromise(
              dbRemove(`customers/${restId}`),
              'Failed to clear all customers'
            );
            break;
          }
          case 'SUBMIT_SUPPORT_REQUEST': {
            const reqId = `req-${Date.now()}`;
            const reqData = {
              id: reqId,
              restaurantId: currentState.admin?.restaurantId || 'unknown',
              restaurantName: currentState.restaurant.name || 'My Restaurant',
              ownerName: currentState.admin?.name || 'Owner',
              ownerEmail: currentState.admin?.email || 'owner@restaurant.com',
              message: action.payload.message,
              attemptsCount: action.payload.attemptsCount,
              createdAt: Date.now(),
              status: 'pending'
            };
            handleDbPromise(
              dbSet(`supportRequests/${reqId}`, sanitizeDbData(reqData)),
              'Failed to submit support request'
            );
            break;
          }
          case 'REPLY_SUPPORT_REQUEST': {
            const { id: reqReplyId, replyText: reqReplyText } = action.payload;
            handleDbPromise(
              dbUpdate(`supportRequests/${reqReplyId}`, { 
                replyText: reqReplyText, 
                status: 'resolved' 
              }),
              'Failed to update support request reply'
            );
            break;
          }
          case 'SUBMIT_FEEDBACK': {
            // Compute newFeedback same as reducer (we need the id to write to DB)
            const fbId = `fb-${Date.now()}`;
            const fbData = {
              id: fbId,
              restaurantId: currentState.admin?.restaurantId || 'unknown',
              restaurantName: currentState.restaurant.name || 'My Restaurant',
              ownerName: currentState.admin?.name || 'Owner',
              ownerEmail: currentState.admin?.email || 'owner@restaurant.com',
              ownerPhone: currentState.restaurant.phone || '',
              ticketType: action.payload.ticketType || 'feedback',
              message: action.payload.message,
              createdAt: Date.now()
            };
            handleDbPromise(
              dbSet(`ownerFeedbacks/${fbId}`, sanitizeDbData(fbData)),
              'Failed to submit feedback'
            );
            break;
          }
          case 'REPLY_FEEDBACK': {
            const { id: fbReplyId, replyText: fbReplyText } = action.payload;
            handleDbPromise(
              dbUpdate(`ownerFeedbacks/${fbReplyId}`, { replyText: fbReplyText }),
              'Failed to update feedback reply'
            );
            break;
          }
          case 'DELETE_FEEDBACK': {
            handleDbPromise(
              dbRemove(`ownerFeedbacks/${action.payload}`),
              'Failed to delete feedback'
            );
            break;
          }
          case 'UPDATE_RESTAURANT': {
            // NOTE: handleSaveRestaurant in AdminMore.tsx writes directly to Firebase before dispatching.
            // To avoid a race condition (middleware write racing with the direct write and potentially
            // overwriting with stale/partial data), we skip the middleware DB write here.
            // The direct write in handleSaveRestaurant is the single source of truth for outlet settings.
            break;
          }
          case 'TOGGLE_RESTAURANT_LISTING': {
            const { id, isListedOnHome } = action.payload;
            handleDbPromise(
              dbUpdate(`restaurantAccounts/${id}`, { isListedOnHome }),
              'Failed to update restaurant home listing status'
            );
            break;
          }
          case 'CONFIRM_ORDER_PAYMENT': {
            const { orderId, restaurantId } = action.payload;
            const targetId = restaurantId || restId;
            handleDbPromise(
              dbUpdate(`orders/${targetId}/${orderId}`, {
                paymentStatus: 'paid',
                paymentConfirmedByAdmin: true,
                status: 'preparing',
                updatedAt: Date.now()
              }),
              'Failed to confirm order payment'
            );
            break;
          }
          case 'SET_MANUAL_CLOSED':
            handleDbPromise(
              dbUpdate(`restaurants/${restId}`, { isManualClosed: action.payload }),
              'Failed to update manual closed status'
            );
            break;
          case 'LOGIN_ADMIN': {
            if (!action.payload.isSuperAdmin && !action.payload.isStaff) {
              const detectedCountry = detectBillingCountry();
              const matchedAcc = currentState.restaurantAccounts.find(acc => acc.id === action.payload.id);

              // Self-heal account data using Supabase
              (async () => {
                try {
                  const existingDbAcc = await dbGet(`restaurantAccounts/${action.payload.id}`);
                  const restData = await dbGet(`restaurants/${action.payload.id}`);
                  const realRestName = restData?.name || action.payload.restaurantName || existingDbAcc?.restaurantName || 'My Restaurant';
                  const realRestPhone = restData?.phone || action.payload.ownerPhone || existingDbAcc?.ownerPhone || '+91 99999 88888';

                  const accountData = {
                    id: action.payload.id,
                    ownerName: action.payload.name,
                    ownerEmail: action.payload.email,
                    ownerPhone: realRestPhone,
                    restaurantName: realRestName,
                    walletBalance: existingDbAcc ? (existingDbAcc.walletBalance ?? 300) : 300,
                    status: existingDbAcc ? (existingDbAcc.status ?? 'active') : 'active',
                    createdAt: existingDbAcc ? (existingDbAcc.createdAt ?? Date.now()) : Date.now(),
                    subscriptionPlan: existingDbAcc ? (existingDbAcc.subscriptionPlan ?? 'free') : 'free',
                    ordersPlacedThisMonth: existingDbAcc ? (existingDbAcc.ordersPlacedThisMonth ?? 0) : 0,
                    subscriptionRenewalDate: (() => {
                      const plan = existingDbAcc ? (existingDbAcc.subscriptionPlan ?? 'free') : 'free';
                      const days = plan === 'free' ? 13 : 30;
                      return existingDbAcc ? (existingDbAcc.subscriptionRenewalDate ?? (Date.now() + days * 24 * 60 * 60 * 1000)) : (Date.now() + days * 24 * 60 * 60 * 1000);
                    })(),
                    billingCountry: existingDbAcc ? (existingDbAcc.billingCountry ?? detectedCountry) : detectedCountry,
                    billingPeriod: existingDbAcc ? (existingDbAcc.billingPeriod ?? 'monthly') : 'monthly',
                    hasCompletedOnboarding: existingDbAcc ? (existingDbAcc.hasCompletedOnboarding ?? false) : false,
                    rating: existingDbAcc ? (existingDbAcc.rating ?? 0) : 0,
                    ratingsCount: existingDbAcc ? (existingDbAcc.ratingsCount ?? 0) : 0,
                    ...(existingDbAcc ? {
                      address: existingDbAcc.address,
                      tagline: existingDbAcc.tagline,
                      promoText: existingDbAcc.promoText,
                      cuisines: existingDbAcc.cuisines,
                      logo: existingDbAcc.logo,
                      posterImage: existingDbAcc.posterImage,
                      bannerImage: existingDbAcc.bannerImage,
                      latitude: existingDbAcc.latitude,
                      longitude: existingDbAcc.longitude,
                      openTime: existingDbAcc.openTime,
                      closeTime: existingDbAcc.closeTime,
                      deliveryEnabled: existingDbAcc.deliveryEnabled,
                      deliveryRadius: existingDbAcc.deliveryRadius,
                      deliveryCharge: existingDbAcc.deliveryCharge,
                      freeDeliveryDistance: existingDbAcc.freeDeliveryDistance,
                      freeDeliveryMinAmount: existingDbAcc.freeDeliveryMinAmount,
                      freeDeliveryDistanceEnabled: existingDbAcc.freeDeliveryDistanceEnabled,
                      freeDeliveryMinAmountEnabled: existingDbAcc.freeDeliveryMinAmountEnabled,
                      indiningRadius: existingDbAcc.indiningRadius,
                      takeawayRadius: existingDbAcc.takeawayRadius,
                      verificationRadius: existingDbAcc.verificationRadius,
                      upiId: existingDbAcc.upiId,
                      googleMapsUrl: existingDbAcc.googleMapsUrl,
                      mustLoginBeforeOrder: existingDbAcc.mustLoginBeforeOrder,
                      locationVerificationEnabled: existingDbAcc.locationVerificationEnabled,
                      overlayLogoOnMeals: existingDbAcc.overlayLogoOnMeals,
                      fssai: existingDbAcc.fssai,
                      gst: existingDbAcc.gst,
                    } : {})
                  };

                  await dbUpdate(`restaurantAccounts/${action.payload.id}`, sanitizeDbData(accountData));
                } catch (err) {
                  console.error('Failed to self-heal restaurant account:', err);
                }
              })();
              
              // Re-evaluate geolocation dynamically on every login/signin
              fetch('https://ipapi.co/json/')
                .then(res => res.json())
                .then(data => {
                  if (data && data.country_code) {
                    const finalCountry = data.country_code === 'IN' ? 'IN' : 'global';
                    // Update in database if it differs or wasn't set yet
                    if (!matchedAcc || matchedAcc.billingCountry !== finalCountry) {
                      dbUpdate(`restaurantAccounts/${action.payload.id}`, {
                        billingCountry: finalCountry
                      });
                    }
                  }
                })
                .catch(() => {});
            }
            break;
          }
          case 'UPDATE_SUBSCRIPTION_PLAN': {
            const targetId = currentState.admin?.id || 'admin-1';
            const { planName, billingPeriod, subscriptionId } = action.payload;
            const days = planName === 'free' ? 13 : billingPeriod === 'yearly' ? 365 : 30;
            const renewal = Date.now() + days * 24 * 60 * 60 * 1000;
            handleDbPromise(
              dbUpdate(`restaurantAccounts/${targetId}`, {
                subscriptionPlan: planName,
                subscriptionRenewalDate: renewal,
                billingPeriod,
                subscriptionId: subscriptionId || null
              }),
              'Failed to update subscription plan in database'
            );
            handleDbPromise(
              dbUpdate(`restaurants/${targetId}`, {
                subscriptionPlan: planName,
                subscriptionRenewalDate: renewal,
                billingPeriod,
                subscriptionId: subscriptionId || null
              }),
              'Failed to update subscription plan in restaurant'
            );
            break;
          }
          case 'SUPER_ADMIN_UPDATE_SUBSCRIPTION': {
            const { id, subscriptionPlan, ordersPlacedThisMonth, subscriptionRenewalDate, billingCountry, billingPeriod } = action.payload;
            handleDbPromise(
              dbUpdate(`restaurantAccounts/${id}`, {
                subscriptionPlan,
                ordersPlacedThisMonth,
                subscriptionRenewalDate,
                billingCountry,
                billingPeriod
              }),
              'Failed to update subscription in database (Super Admin)'
            );
            handleDbPromise(
              dbUpdate(`restaurants/${id}`, {
                subscriptionPlan,
                ordersPlacedThisMonth,
                subscriptionRenewalDate,
                billingCountry,
                billingPeriod
              }),
              'Failed to update subscription in restaurant (Super Admin)'
            );
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
              
              handleDbPromise(
                dbUpdate(`restaurantAccounts/${matchedAcc.id}`, sanitizeDbData({
                  walletBalance: nextBalance,
                  status: nextStatus
                })),
                'Failed to update account (Super Admin action)'
              );
            }
            break;
          }
          case 'SUPER_ADMIN_DELETE_ACCOUNT': {
            const accountId = action.payload;
            handleDbPromise(
              dbRemove(`restaurantAccounts/${accountId}`),
              'Failed to delete restaurant account'
            );
            dbRemove(`restaurants/${accountId}`).catch(() => {});
            dbRemove(`menuItems/${accountId}`).catch(() => {});
            dbRemove(`categories/${accountId}`).catch(() => {});
            dbRemove(`orders/${accountId}`).catch(() => {});
            dbRemove(`customers/${accountId}`).catch(() => {});
            dbRemove(`coupons/${accountId}`).catch(() => {});
            dbRemove(`waiterRequests/${accountId}`).catch(() => {});
            dbRemove(`schedules/${accountId}`).catch(() => {});
            dbRemove(`tables/${accountId}`).catch(() => {});
            break;
          }
          case 'ADD_SUBSCRIPTION_COUPON': {
            const coupon = action.payload;
            handleDbPromise(
              dbSet(`subscriptionCoupons/${coupon.id}`, sanitizeDbData(coupon)),
              'Failed to create subscription coupon'
            );
            break;
          }
          case 'DELETE_SUBSCRIPTION_COUPON': {
            const couponId = action.payload;
            handleDbPromise(
              dbRemove(`subscriptionCoupons/${couponId}`),
              'Failed to delete subscription coupon'
            );
            break;
          }
          default:
            break;
        }
      } catch (err: any) {
        console.error('RTDB sync error:', err);
        addToast('error', `Database sync error: ${err.message || err}`);
      }
    }

    // Broadcast to other tabs after state change
    // Skip broadcasting Supabase sync actions — both tabs have their own Supabase listeners
    const SUPABASE_SYNC_ACTIONS = new Set([
      'SYNC_MENU_ITEMS', 'SYNC_CATEGORIES', 'SYNC_ORDERS', 'SYNC_WAITER_REQUESTS',
      'SYNC_RESTAURANT_ACCOUNTS', 'SYNC_SUBSCRIPTION_COUPONS', 'SYNC_ADDONS', 'SET_STATE'
    ]);
    setTimeout(() => {
      if (channelRef.current && !isBroadcasting.current && !SUPABASE_SYNC_ACTIONS.has(action.type)) {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          // Exclude admin session from tab sync broadcasts to prevent profile overrides
          delete parsed.admin;
          delete parsed.isAdminLoggedIn;
          channelRef.current.postMessage({
            type: 'STATE_SYNC',
            payload: parsed,
          });
        }
      }
    }, 50);
  }, []);

  // Auto-cancel active orders older than 180 minutes
  useEffect(() => {
    const activeOrders = state.orders.filter(o => 
      ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status)
    );
    activeOrders.forEach(o => {
      const elapsedMs = Date.now() - o.createdAt;
      if (elapsedMs >= 180 * 60 * 1000) {
        wrappedDispatch({
          type: 'UPDATE_ORDER_STATUS',
          payload: { id: o.id, status: 'cancelled' }
        });
      }
    });
  }, [state.orders, wrappedDispatch]);

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
    language: 'Language / भाषा',
    contact_and_location: 'Contact & Location',
    business_hours: 'Business Hours',
    active_offers: 'Active Offers & Coupons'
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
  },
  bn: {
    view_full_menu: 'সম্পূর্ণ মেনু দেখুন',
    featured: 'বিশেষ খাবার',
    see_all: 'সব দেখুন',
    contact: 'যোগাযোগ',
    search_placeholder: 'অনুসন্ধান...',
    all: 'সব',
    veg: 'নিরামিষ',
    non_veg: 'আমিষ',
    popular: 'জনপ্রিয়',
    low_high: '₹ কম-বেশি',
    high_low: '₹ বেশি-কম',
    add: 'যোগ করুন',
    add_on: 'এড-অন',
    view_cart: 'কার্ট দেখুন',
    your_cart: 'আপনার কার্ট',
    total: 'মোট',
    place_order: 'অর্ডার করুন',
    special_instructions: 'বিশেষ নির্দেশাবলী',
    your_name: 'আপনার নাম',
    phone: 'ফোন নম্বর',
    my_orders: 'আমার অর্ডার',
    call_waiter: 'ওয়েটার ডাকুন',
    no_orders_yet: 'কোন অর্ডার নেই',
    browse_menu: 'মেনু দেখুন',
    order_placed: 'অর্ডার করা হয়েছে!',
    order_preparing: 'রান্না হচ্ছে!',
    order_ready: 'টেবিলে পরিবেশন করা হয়েছে!',
    order_bill_pay: 'পেমেন্টের অপেক্ষা...',
    live_order_status: 'অর্ডারের বর্তমান অবস্থা',
    bill_review: 'বিল ও মতামত',
    pay_with_upi: 'UPI দিয়ে পেমেন্ট',
    cash_pay: 'ক্যাশ পেমেন্ট',
    card_pay: 'কার্ড পেমেন্ট',
    feedback: 'মতামত দিন',
    submit_feedback: 'মতামত পাঠান',
    waiting_confirmation: 'নিশ্চিতকরণের অপেক্ষা',
    bestseller: 'বেস্টসেলার',
    select_option: 'বিকল্প বাছুন',
    review_meals: 'খাবারের মতামত',
    back: 'পেছনে যান',
    scan_to_pay: 'GPay, PhonePe, Paytm দিয়ে স্ক্যান করুন',
    paid_done: 'আমি পেমেন্ট করেছি',
    google_review: 'Google Maps এ মতামত দিন',
    success_done: 'সফলভাবে সম্পন্ন!',
    payment_confirmed: 'পেমেন্ট নিশ্চিত হয়েছে। ধন্যবাদ!',
    feedback_intro: 'আজকের খাবারের রেটিং দিন।',
    google_review_prompt: 'খাবার ভালো লেগে থাকলে আমাদের Google Maps এ রিভিউ দিতে পারেন।',
    active_request_details: 'সক্রিয় অনুরোধ',
    amount_due: 'বাকি টাকা',
    method: 'পদ্ধতি',
    live_tracking: 'লাইভ ট্র্যাকিং',
    more: 'আরো',
    settings: 'সেটিংস ও অন্যান্য',
    language: 'ভাষা / Language'
  },
  te: {
    view_full_menu: 'పూర్తి మెనూ చూడండి',
    featured: 'ప్రత్యేక వంటకాలు',
    see_all: 'అన్నీ చూడండి',
    contact: 'సంప్రదించండి',
    search_placeholder: 'వెతకండి...',
    all: 'అన్నీ',
    veg: 'శాకాహారం',
    non_veg: 'మాంసాహారం',
    popular: 'ప్రసిద్ధ',
    low_high: '₹ తక్కువ-ఎక్కువ',
    high_low: '₹ ఎక్కువ-తక్కువ',
    add: 'జతచేయి',
    add_on: 'యాడ్-ఆన్',
    view_cart: 'కార్ట్ చూడండి',
    your_cart: 'మీ కార్ట్',
    total: 'మొత్తం',
    place_order: 'ఆర్డర్ చేయండి',
    special_instructions: 'ప్రత్యేక సూచనలు',
    your_name: 'మీ పేరు',
    phone: 'ఫోన్ నంబర్',
    my_orders: 'నా ఆర్డర్లు',
    call_waiter: 'వేటర్‌ని పిలవండి',
    no_orders_yet: 'ఇంకా ఆర్డర్లు లేవు',
    browse_menu: 'మెనూ చూడండి',
    order_placed: 'ఆర్డర్ చేయబడింది!',
    order_preparing: 'వంటశాలలో తయారవుతోంది!',
    order_ready: 'టేబుల్ వద్దకు చేరింది!',
    order_bill_pay: 'చెల్లింపు కొరకు వేచి ఉంది...',
    live_order_status: 'లైవ్ ఆర్డర్ స్థితి',
    bill_review: 'బిల్లు & సమీక్ష',
    pay_with_upi: 'UPI ద్వారా చెల్లించండి',
    cash_pay: 'నగదు చెల్లింపు',
    card_pay: 'కార్డు చెల్లింపు',
    feedback: 'సమీక్ష & అభిప్రాయం',
    submit_feedback: 'అభిప్రాయాన్ని పంపండి',
    waiting_confirmation: 'ధృవీకరణ కొరకు నిరీక్షణ',
    bestseller: 'బెస్ట్ సెల్లర్',
    select_option: 'ఎంపికను ఎంచుకోండి',
    review_meals: 'వంటకాల సమీక్ష',
    back: 'వెనక్కి వెళ్ళండి',
    scan_to_pay: 'GPay, PhonePe, Paytm తో స్కాన్ చేయండి',
    paid_done: 'నేను చెల్లించాను',
    google_review: 'మమ్మల్ని Google Maps లో రివ్యూ చేయండి',
    success_done: 'విజయవంతంగా పూర్తయింది!',
    payment_confirmed: 'చెల్లింపు పూర్తయింది. ధన్యవాదాలు!',
    feedback_intro: 'ఈరోజు వడ్డించిన వంటకాలకు రేటింగ్ ఇవ్వండి.',
    google_review_prompt: 'మీకు ఆహారం నచ్చినందుకు సంతోషం! Google Maps లో రివ్యూ ఇవ్వగలరు.',
    active_request_details: 'యాక్టివ్ ఆర్డర్ వివరాలు',
    amount_due: 'చెల్లించాల్సిన మొత్తం',
    method: 'పద్ధతి',
    live_tracking: 'లైవ్ ట్రాకింగ్',
    more: 'మరింత',
    settings: 'సెట్టింగులు & మరికొన్ని',
    language: 'భాష / Language'
  },
  mr: {
    view_full_menu: 'पूर्ण मेनू पहा',
    featured: 'विशेष पदार्थ',
    see_all: 'सर्व पहा',
    contact: 'संपर्क',
    search_placeholder: 'शोधा...',
    all: 'सर्व',
    veg: 'शाकाहारी',
    non_veg: 'मांसाहारी',
    popular: 'लोकप्रिय',
    low_high: '₹ कमी ते जास्त',
    high_low: '₹ जास्त ते कमी',
    add: 'डिश जोडा',
    add_on: 'अॅड-ऑन',
    view_cart: 'कार्ट पहा',
    your_cart: 'तुमचे कार्ट',
    total: 'एकूण',
    place_order: 'ऑर्डर द्या',
    special_instructions: 'विशेष सूचना',
    your_name: 'तुमचे नाव',
    phone: 'फोन नंबर',
    my_orders: 'माझ्या ऑर्डर्स',
    call_waiter: 'वेटरला बोलवा',
    no_orders_yet: 'अजून एकही ऑर्डर नाही',
    browse_menu: 'मेनू पहा',
    order_placed: 'ऑर्डर दिली आहे!',
    order_preparing: 'स्वयंपाकघरात तयार होत आहे!',
    order_ready: 'टेबलवर पोहचली आहे!',
    order_bill_pay: 'पेमेंटची प्रतीक्षा...',
    live_order_status: 'लाइव्ह ऑर्डर स्टेटस',
    bill_review: 'बिल आणि अभिप्राय',
    pay_with_upi: 'UPI द्वारे पेमेंट',
    cash_pay: 'रोख पेमेंट',
    card_pay: 'कार्ड पेमेंट',
    feedback: 'अभिप्राय आणि पुनरावलोकन',
    submit_feedback: 'अभिप्राय पाठवा',
    waiting_confirmation: 'खात्रीची प्रतीक्षा आहे',
    bestseller: 'बेस्टसेलर',
    select_option: 'पर्याय निवडा',
    review_meals: 'पदार्थांचे पुनरावलोकन',
    back: 'मागे जा',
    scan_to_pay: 'GPay, PhonePe, Paytm ने स्कॅन करा',
    paid_done: 'मी पेमेंट केले आहे',
    google_review: 'Google Maps वर आम्हाला रेटिंग द्या',
    success_done: 'यशस्वीरित्या पूर्ण झाले!',
    payment_confirmed: 'पेमेंट यशस्वी! आमच्यासोबत जोडल्याबद्दल धन्यवाद!',
    feedback_intro: 'कृपया आज टेबलवर आणलेल्या पदार्थांना रेटिंग द्या.',
    google_review_prompt: 'तुम्हाला जेवण आवडले याबद्दल आनंद आहे! आम्हाला Google Maps वर पाठिंबा देऊ शकता का?',
    active_request_details: 'सक्रिय विनंती',
    amount_due: 'देय रक्कम',
    method: 'पद्धत',
    live_tracking: 'लाइव्ह ट्रॅकिंग',
    more: 'अधिक',
    settings: 'सेटिंग्ज आणि इतर',
    language: 'भाषा / Language'
  },
  ta: {
    view_full_menu: 'முழு மெனுவை பார்க்க',
    featured: 'சிறப்பு உணவுகள்',
    see_all: 'அனைத்தும் பார்க்க',
    contact: 'தொடர்பு கொள்ள',
    search_placeholder: 'தேடுக...',
    all: 'அனைத்தும்',
    veg: 'சைவம்',
    non_veg: 'அசைவம்',
    popular: 'பிரபலமான',
    low_high: '₹ குறைந்தது முதல் கூடுதல்',
    high_low: '₹ கூடுதல் முதல் குறைந்தது',
    add: 'சேர்',
    add_on: 'கூடுதல் உணவு',
    view_cart: 'வண்டியைப் பார்',
    your_cart: 'உங்கள் கூடை',
    total: 'மொத்தம்',
    place_order: 'ஆர்டர் செய்',
    special_instructions: 'சிறப்பு அறிவுறுத்தல்கள்',
    your_name: 'உங்கள் பெயர்',
    phone: 'தொலைபேசி எண்',
    my_orders: 'எனது ஆர்டர்கள்',
    call_waiter: 'வழங்குநரை அழைக்க',
    no_orders_yet: 'இன்னும் ஆர்டர்கள் இல்லை',
    browse_menu: 'மெனுவை பார்க்க',
    order_placed: 'ஆர்டர் செய்யப்பட்டுள்ளது!',
    order_preparing: 'தயாராகி கொண்டு இருக்கிறது!',
    order_ready: 'உணவு மேஜைக்கு வந்துவிட்டது!',
    order_bill_pay: 'பணம் செலுத்த காத்திருக்கிறது...',
    live_order_status: 'லைவ் ஆர்டர் நிலை',
    bill_review: 'பில் & கருத்து',
    pay_with_upi: 'UPI மூலம் பணம் செலுத்துக',
    cash_pay: 'ரொக்கப் பணம் செலுத்துதல்',
    card_pay: 'அட்டை மூலம் செலுத்துதல்',
    feedback: 'மதிப்புரை & கருத்து',
    submit_feedback: 'கருத்து சமர்ப்பிக்க',
    waiting_confirmation: 'உறுதிப்படுத்த காத்திருக்கிறது',
    bestseller: 'பிரபலமானது',
    select_option: 'விருப்பத்தை தேர்வு செய்க',
    review_meals: 'உணவுகளை மதிப்பிடுக',
    back: 'பின்னால் செல்க',
    scan_to_pay: 'GPay, PhonePe, Paytm மூலம் ஸ்கேன் செய்க',
    paid_done: 'நான் செலுத்திவிட்டேன்',
    google_review: 'கூகுள் மேப்பில் மதிப்பிடுக',
    success_done: 'வெற்றிகரமாக முடிந்தது!',
    payment_confirmed: 'கட்டணம் பெறப்பட்டது. நன்றி!',
    feedback_intro: 'இன்று பரிமாறப்பட்ட உணவுகளை மதிப்பிடுங்கள்.',
    google_review_prompt: 'உணவு உங்களுக்கு பிடித்ததில் மகிழ்ச்சி! எங்களை கூகுள் மேப்பில் ஆதரிக்கிறீர்களா?',
    active_request_details: 'செயலில் உள்ள வேண்டுகோள்',
    amount_due: 'செலுத்த வேண்டிய தொகை',
    method: 'முறை',
    live_tracking: 'நேரடி கண்காணிப்பு',
    more: 'மேலும்',
    settings: 'அமைப்புகள் & பிற',
    language: 'மொழி / Language'
  }
};

export function useTranslation() {
  const { state } = useStore();
  const lang = state.language || 'en';
  return (key: keyof typeof TRANSLATIONS['en']) => {
    return (TRANSLATIONS as any)[lang]?.[key] || TRANSLATIONS['en'][key] || key;
  };
}
