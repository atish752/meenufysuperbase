import { useEffect, useState } from 'react';
import { useStore, isSubscriptionActive } from '../../context/RealtimeStore';
import type { Order, OrderStatus, Coupon, OrderItem, MenuItem, MenuItemVariant } from '../../context/RealtimeStore';
import { Clock, Check, ChefHat, Utensils, CreditCard, Coins, X, QrCode, Wrench, Printer, Calendar, Search, Edit2, Loader2 } from 'lucide-react';
import { triggerNotification } from '../../utils/notifications';
import { printThermalReceipt } from '../../utils/printReceipt';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { hasFirebaseConfig, db } from '../../utils/firebase';

const loadLeaflet = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      resolve((window as any).L);
    };
    script.onerror = (err) => {
      reject(err);
    };
    document.body.appendChild(script);
  });
};



const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'New Order', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)', icon: Clock },
  preparing: { label: 'Preparing', color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)', icon: ChefHat },
  ready: { label: 'Ready', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)', icon: Utensils },
  bill_pay: { label: 'Bill & Pay', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)', icon: CreditCard },
  served: { label: 'Served', color: '#10b981', bgColor: 'rgba(16,185,129,0.15)', icon: Check },
  cancelled: { label: 'Cancelled', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)', icon: X },
};

const STATUS_ORDER: OrderStatus[] = ['pending', 'preparing', 'ready', 'bill_pay', 'served'];

// Inject blink keyframes once
const BLINK_STYLE_ID = 'meenufy-order-blink-styles';
if (typeof document !== 'undefined' && !document.getElementById(BLINK_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = BLINK_STYLE_ID;
  style.textContent = `
    @keyframes blink-yellow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    @keyframes blink-red {
      0%, 49% { opacity: 1; background-color: #ef4444; }
      50%, 100% { opacity: 0.15; background-color: #ef4444; }
    }
    @keyframes deliveryBadgePulse {
      0%, 100% { box-shadow: 0 0 6px rgba(157,78,221,0.3); }
      50% { box-shadow: 0 0 16px rgba(157,78,221,0.7); }
    }
  `;
  document.head.appendChild(style);
}


export default function AdminHome() {
  const { state, dispatch, addToast } = useStore();
  const [time, setTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const hasOrdersPermission = !state.admin?.isStaff || state.admin.permissions?.includes('orders');
  const hasQrTablesPermission = !state.admin?.isStaff || state.admin.permissions?.includes('qr_tables');
  const hasOutletSettingPermission = !state.admin?.isStaff || state.admin.permissions?.includes('outlet_setting');

  // Manual Order Placement States
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);
  const [manualOrderName, setManualOrderName] = useState('');
  const [manualOrderPhone, setManualOrderPhone] = useState('');
  const [manualOrderType, setManualOrderType] = useState<'in-dining' | 'take-away' | 'delivery'>('in-dining');
  const [manualOrderTableId, setManualOrderTableId] = useState('n/a');
  const [manualOrderTableNumber, setManualOrderTableNumber] = useState(0);
  const [manualOrderNote, setManualOrderNote] = useState('');
  const [manualOrderPaymentMethod, setManualOrderPaymentMethod] = useState<'upi' | 'card' | 'cash'>('cash');
  const [manualOrderPaymentStatus, setManualOrderPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [manualOrderItems, setManualOrderItems] = useState<OrderItem[]>([]);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSelectedCategory, setManualSelectedCategory] = useState('all');

  // Manual Delivery details
  const [manualOrderDeliveryAddress, setManualOrderDeliveryAddress] = useState('');
  const [manualOrderDeliveryLat, setManualOrderDeliveryLat] = useState<number | undefined>(undefined);
  const [manualOrderDeliveryLng, setManualOrderDeliveryLng] = useState<number | undefined>(undefined);

  // Map variables
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapLat, setMapLat] = useState(25.5941);
  const [mapLng, setMapLng] = useState(85.1376);

  // Set default coordinates to restaurant's position if available
  useEffect(() => {
    if (state.restaurant?.latitude && state.restaurant?.longitude) {
      setMapLat(state.restaurant.latitude);
      setMapLng(state.restaurant.longitude);
    }
  }, [state.restaurant]);

  // Leaflet map initializer for manual delivery order pinning
  useEffect(() => {
    if (!showMapModal) return;

    let activeMap: any = null;
    let marker: any = null;

    loadLeaflet()
      .then((L) => {
        const mapContainer = document.getElementById('manual-delivery-pin-map');
        if (!mapContainer) return;

        // Initialize Map
        activeMap = L.map('manual-delivery-pin-map', {
          zoomControl: true,
          scrollWheelZoom: true
        }).setView([mapLat, mapLng], 15);

        // Add Tile Layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(activeMap);

        // Add Draggable Marker
        marker = L.marker([mapLat, mapLng], {
          draggable: true
        }).addTo(activeMap);

        // Marker dragend listener
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setMapLat(pos.lat);
          setMapLng(pos.lng);
        });

        // Click on map to place marker
        activeMap.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          setMapLat(e.latlng.lat);
          setMapLng(e.latlng.lng);
        });

        // Fix Leaflet sizing bug (requires invalidating size after render)
        setTimeout(() => {
          if (activeMap) activeMap.invalidateSize();
        }, 300);
      })
      .catch((err) => {
        console.error('Leaflet loading failed:', err);
        addToast('error', 'Failed to load interactive map. Please input address/link manually.');
      });

    return () => {
      if (activeMap) {
        activeMap.off();
        activeMap.remove();
      }
    };
  }, [showMapModal]);

  const handleConfirmMapLocation = () => {
    setMapLoading(true);
    setManualOrderDeliveryLat(mapLat);
    setManualOrderDeliveryLng(mapLng);

    // Call reverse geocoder
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${mapLat}&lon=${mapLng}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.display_name) {
          setManualOrderDeliveryAddress(`${data.display_name} (Map URL: https://maps.google.com/?q=${mapLat},${mapLng})`);
          addToast('success', 'Location pinned and address updated! 📍');
        } else {
          setManualOrderDeliveryAddress(`https://maps.google.com/?q=${mapLat},${mapLng}`);
          addToast('success', 'GPS coordinates pinned! 📍');
        }
        setShowMapModal(false);
      })
      .catch(err => {
        console.error('Reverse geocode error:', err);
        setManualOrderDeliveryAddress(`https://maps.google.com/?q=${mapLat},${mapLng}`);
        addToast('success', 'GPS coordinates pinned! 📍');
        setShowMapModal(false);
      })
      .finally(() => {
        setMapLoading(false);
      });
  };

  const handleAddManualItem = (item: MenuItem, variant?: MenuItemVariant) => {
    setManualOrderItems(prev => {
      const matchIndex = prev.findIndex(x => 
        x.menuItemId === item.id && 
        (!variant ? !x.variant : x.variant?.name === variant.name)
      );
      
      if (matchIndex >= 0) {
        const next = [...prev];
        next[matchIndex] = {
          ...next[matchIndex],
          qty: next[matchIndex].qty + 1
        };
        return next;
      } else {
        const newOrderItem: OrderItem = {
          menuItemId: item.id,
          name: item.name,
          price: variant ? variant.price : item.price,
          qty: 1,
          variant: variant
        };
        return [...prev, newOrderItem];
      }
    });
  };

  const handleRemoveManualItem = (item: MenuItem, variant?: MenuItemVariant) => {
    setManualOrderItems(prev => {
      const matchIndex = prev.findIndex(x => 
        x.menuItemId === item.id && 
        (!variant ? !x.variant : x.variant?.name === variant.name)
      );
      
      if (matchIndex >= 0) {
        const next = [...prev];
        const newQty = next[matchIndex].qty - 1;
        if (newQty <= 0) {
          return next.filter((_, idx) => idx !== matchIndex);
        } else {
          next[matchIndex] = {
            ...next[matchIndex],
            qty: newQty
          };
          return next;
        }
      }
      return prev;
    });
  };

  const resetManualOrderForm = () => {
    setManualOrderName('');
    setManualOrderPhone('');
    setManualOrderType('in-dining');
    setManualOrderTableId('n/a');
    setManualOrderTableNumber(0);
    setManualOrderNote('');
    setManualOrderPaymentMethod('cash');
    setManualOrderPaymentStatus('pending');
    setManualOrderItems([]);
    setManualSearchQuery('');
    setManualSelectedCategory('all');
    setManualOrderDeliveryAddress('');
    setManualOrderDeliveryLat(undefined);
    setManualOrderDeliveryLng(undefined);
  };

  const handlePlaceManualOrder = () => {
    const subStatus = isSubscriptionActive(state.restaurant);
    if (!subStatus.active) {
      addToast('error', `❌ Cannot place order: ${subStatus.reason || "The admin doesn't have any plan so you cant place an order."}`);
      return;
    }

    if (manualOrderItems.length === 0) {
      addToast('error', '❌ Please select at least one dish for the order.');
      return;
    }
    
    if (manualOrderType === 'in-dining' && (!manualOrderTableId || manualOrderTableId === 'n/a')) {
      // Allow passing 'n/a' as default without erroring, but if they explicitly need a table, we can just allow 'n/a' as a valid choice (meaning no table).
      // So no validation error is needed for table selection anymore since "N/A" is the default and valid!
    }

    if (manualOrderType === 'delivery' && !manualOrderDeliveryAddress.trim()) {
      addToast('error', '❌ Please enter a delivery location link or choose it on the map.');
      return;
    }

    const totalAmount = manualOrderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const orderId = `order-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const cleanPhone = manualOrderPhone.trim().replace(/[^a-zA-Z0-9]/g, '');
    const matchedCust = state.customers?.find(
      c => c.phone?.replace(/[^a-zA-Z0-9]/g, '') === cleanPhone
    );
    const isVipCustomer = matchedCust ? !!matchedCust.isVip : false;

    const newOrder: Order = {
      id: orderId,
      tableNumber: manualOrderType === 'in-dining' && manualOrderTableId !== 'n/a' ? manualOrderTableNumber : 0,
      tableId: manualOrderType === 'in-dining' && manualOrderTableId !== 'n/a' ? manualOrderTableId : '',
      restaurantId: state.admin?.restaurantId || 'admin-1',
      restaurantName: state.restaurant.name,
      customerName: manualOrderName.trim() || 'Guest (Manual)',
      customerPhone: manualOrderPhone.trim() || '9999999999',
      items: manualOrderItems,
      status: 'pending',
      totalAmount,
      specialNote: manualOrderNote.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      paymentMethod: manualOrderPaymentStatus === 'paid' ? manualOrderPaymentMethod : undefined,
      paymentStatus: manualOrderPaymentStatus,
      pointsEarned: Math.floor(totalAmount * (state.restaurant.pointsPer100Spent || 0) / 100),
      pointsRedeemed: 0,
      isManualOrder: true,
      isVipCustomer: isVipCustomer,
      orderType: manualOrderType,
      deliveryAddress: manualOrderType === 'delivery' ? manualOrderDeliveryAddress.trim() : undefined,
      deliveryLat: manualOrderType === 'delivery' ? manualOrderDeliveryLat : undefined,
      deliveryLng: manualOrderType === 'delivery' ? manualOrderDeliveryLng : undefined,
    };

    dispatch({ type: 'PLACE_ORDER', payload: newOrder });
    addToast('success', `🎉 Manual Order #${orderId.slice(-4).toUpperCase()} placed successfully!`);
    setShowManualOrderModal(false);
    resetManualOrderForm();
  };

  const [isTabularView, setIsTabularView] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('meenufy_admin_orders_tabular_view');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default: Tabular view on mobile (width < 768), Kanban on desktop
    return window.innerWidth < 768;
  });

  const [showHistory, setShowHistory] = useState(false);
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'today' | 'week' | 'month' | 'choose' | 'lifetime'>('today');
  const [historySelectedMonth, setHistorySelectedMonth] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Coupon & Offer Management States
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'flat' as 'flat' | 'percentage',
    value: '',
    minOrderAmount: '',
    isOneTime: false,
    isActive: true,
    appliesToType: 'all' as 'all' | 'categories',
    selectedCategories: [] as string[],
    label: ''
  });

  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      addToast('error', 'Coupon code is required.');
      return;
    }
    const val = parseFloat(couponForm.value);
    if (isNaN(val) || val <= 0) {
      addToast('error', 'Please enter a valid coupon discount value.');
      return;
    }
    const minOrder = parseFloat(couponForm.minOrderAmount);

    const targetRestaurantId = state.admin?.restaurantId || 'admin-1';

    const couponData: Coupon = {
      id: editingCouponId || `coup-${Date.now()}`,
      code: couponForm.code.trim().toUpperCase(),
      type: couponForm.type,
      value: val,
      minOrderAmount: isNaN(minOrder) ? undefined : minOrder,
      isOneTime: couponForm.isOneTime,
      isActive: couponForm.isActive,
      createdAt: Date.now(),
      restaurantId: targetRestaurantId,
      appliesTo: couponForm.appliesToType === 'all' ? 'all' : couponForm.selectedCategories,
      label: couponForm.label.trim() || undefined
    };

    if (editingCouponId) {
      dispatch({ type: 'UPDATE_COUPON', payload: couponData });
      addToast('success', `Coupon ${couponData.code} updated successfully! 🏷️`);
    } else {
      // Check if code already exists
      const exists = state.coupons?.some(c => c.code.toUpperCase() === couponData.code && c.restaurantId === targetRestaurantId);
      if (exists) {
        addToast('error', `A coupon with code ${couponData.code} already exists.`);
        return;
      }
      dispatch({ type: 'ADD_COUPON', payload: couponData });
      addToast('success', `Coupon ${couponData.code} created successfully! 🏷️`);
    }

    // Reset Form
    setCouponForm({
      code: '',
      type: 'flat',
      value: '',
      minOrderAmount: '',
      isOneTime: false,
      isActive: true,
      appliesToType: 'all',
      selectedCategories: [],
      label: ''
    });
    setEditingCouponId(null);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : '',
      isOneTime: !!coupon.isOneTime,
      isActive: !!coupon.isActive,
      appliesToType: Array.isArray(coupon.appliesTo) ? 'categories' : 'all',
      selectedCategories: Array.isArray(coupon.appliesTo) ? coupon.appliesTo : [],
      label: coupon.label || ''
    });
  };

  const handleDeleteCoupon = (couponId: string) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      dispatch({ type: 'DELETE_COUPON', payload: couponId });
      addToast('success', 'Coupon deleted.');
      if (editingCouponId === couponId) {
        setEditingCouponId(null);
        setCouponForm({
          code: '',
          type: 'flat',
          value: '',
          minOrderAmount: '',
          isOneTime: false,
          isActive: true,
          appliesToType: 'all',
          selectedCategories: [],
          label: ''
        });
      }
    }
  };

  const handleToggleCouponActive = (coupon: any) => {
    const updated = { ...coupon, isActive: !coupon.isActive };
    dispatch({ type: 'UPDATE_COUPON', payload: updated });
    addToast('success', `Coupon ${coupon.code} is now ${updated.isActive ? 'Active' : 'Inactive'}.`);
  };

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleRequestPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          addToast('success', 'Notifications enabled successfully! 🎉');
          triggerNotification('Notifications Enabled!', 'You will now receive real-time notifications for orders and waiter requests.');
        }
      });
    }
  };



  const adminId = state.admin?.restaurantId || 'admin-1';
  const activeWaiterRequests = state.waiterRequests.filter(r => !r.resolved && (r.restaurantId || 'admin-1') === adminId);
  const resolvedWaiterRequests = state.waiterRequests.filter(r => r.resolved && (r.restaurantId || 'admin-1') === adminId && (time - (r.resolvedAt || r.createdAt || 0) < 5000));
  const activeOrders = state.orders.filter(o => {
    const isActive = ['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status);
    const isUnder180Min = Date.now() - o.createdAt < 180 * 60 * 1000;
    return isActive && isUnder180Min && (o.restaurantId || 'admin-1') === adminId;
  });

  // Unique months in orders for filter dropdown
  const uniqueMonths: string[] = []; // format "YYYY-MM"
  state.orders
    .filter(o => (o.restaurantId || 'admin-1') === adminId)
    .forEach(o => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!uniqueMonths.includes(key)) {
        uniqueMonths.push(key);
      }
    });
  uniqueMonths.sort((a, b) => b.localeCompare(a));

  // Filter history orders
  const filteredHistoryOrders = [...state.orders]
    .filter(order => {
      // 1. Restaurant ownership match
      if ((order.restaurantId || 'admin-1') !== adminId) return false;

      // 2. Time Filter Match
      const orderDate = new Date(order.createdAt);
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      if (historyTimeFilter === 'today') {
        if (orderDate < startOfToday) return false;
      } else if (historyTimeFilter === 'week') {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        if (orderDate < startOfWeek) return false;
      } else if (historyTimeFilter === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (orderDate < startOfMonth) return false;
      } else if (historyTimeFilter === 'choose') {
        if (!historySelectedMonth) return true; // Show all if no month selected yet
        const [year, month] = historySelectedMonth.split('-').map(Number);
        if (orderDate.getFullYear() !== year || (orderDate.getMonth() + 1) !== month) return false;
      }

      // 3. Custom Date Range Match
      if (historyStartDate) {
        const start = new Date(historyStartDate);
        if (orderDate < start) return false;
      }
      if (historyEndDate) {
        const end = new Date(historyEndDate + 'T23:59:59');
        if (orderDate > end) return false;
      }

      // 4. Search Query Match
      if (historySearchQuery.trim()) {
        const query = historySearchQuery.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesName = (order.customerName || '').toLowerCase().includes(query);
        const matchesPhone = (order.customerPhone || '').toLowerCase().includes(query);
        const matchesTable = `table ${order.tableNumber}`.toLowerCase().includes(query) || String(order.tableNumber) === query;
        const matchesStatus = order.status.toLowerCase().includes(query) || (order.paymentStatus || '').toLowerCase().includes(query);
        const matchesItems = order.items.some(item => item.name.toLowerCase().includes(query));

        if (!matchesId && !matchesName && !matchesPhone && !matchesTable && !matchesStatus && !matchesItems) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt); // Newest first

  const handleExportHistoryExcel = () => {
    if (filteredHistoryOrders.length === 0) {
      addToast('info', 'No orders in the filtered history to export.');
      return;
    }

    const headers = [
      'Order ID',
      'Date & Time',
      'Customer Name',
      'Phone',
      'Type',
      'Table No',
      'Items Ordered',
      'Total Amount (INR)',
      'Status',
      'Payment Status'
    ];

    const rows = filteredHistoryOrders.map(o => {
      const itemsList = o.items.map(i => `${i.name}${i.variant ? ' (' + i.variant.name + ')' : ''} x${i.qty}`).join('; ');
      const dateStr = new Date(o.createdAt).toLocaleString();
      return [
        o.id,
        `"${dateStr}"`,
        `"${o.customerName || 'Guest'}"`,
        `"${o.customerPhone || 'N/A'}"`,
        o.orderType,
        o.tableNumber || 'N/A',
        `"${itemsList}"`,
        o.totalAmount,
        o.status,
        o.paymentStatus || 'pending'
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `meenufy-order-history-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Order history exported as Excel/CSV! 📊');
  };

  const handleExportHistoryPDF = () => {
    if (filteredHistoryOrders.length === 0) {
      addToast('info', 'No orders in the filtered history to export.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor('#FF7D00');
    doc.text('Meenufy Order History Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor('#6B7280');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 27);
    doc.text(`Restaurant: ${state.restaurant.name || 'My Outlet'}`, 14, 33);
    doc.text(`Filter Applied: ${historyTimeFilter.toUpperCase()} (${filteredHistoryOrders.length} orders)`, 14, 39);

    const tableHeaders = [['Order ID', 'Date & Time', 'Customer', 'Type', 'Amount', 'Status']];
    const tableBody = filteredHistoryOrders.map(o => [
      o.id,
      new Date(o.createdAt).toLocaleString(),
      `${o.customerName || 'Guest'}\n(${o.customerPhone || 'N/A'})`,
      (o.orderType || 'in-dining').toUpperCase(),
      `${state.restaurant.currency || '₹'} ${o.totalAmount}`,
      `${o.status.toUpperCase()} (${(o.paymentStatus || 'pending').toUpperCase()})`
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: '#FF7D00', textColor: '#000000', fontStyle: 'bold' },
      styles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 40 }
      }
    });

    doc.save(`meenufy-order-history-${Date.now()}.pdf`);
    addToast('success', 'Order history exported as PDF! 📄');
  };

  const handleUpdateStatus = (orderId: string, status: OrderStatus) => {
    if (status === 'cancelled') {
      const confirmCancel = window.confirm("Are you sure you want to cancel this order? This action cannot be undone.");
      if (!confirmCancel) return;
    }
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status } });
    if (status === 'served') {
      dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
      
      const order = state.orders.find(ord => ord.id === orderId);
      if (order && order.orderType === 'delivery' && order.deliveryBoyId) {
        const riderProfile = state.deliveryBoys.find(b => b.id === order.deliveryBoyId);
        if (riderProfile) {
          const payoutRate = riderProfile.payoutPerKm || 12;
          const distance = order.deliveryDistance || 2.5;
          const commission = Math.round(distance * payoutRate);
          const nextDeliveries = (riderProfile.totalDeliveries || 0) + 1;
          const nextEarnings = (riderProfile.totalEarnings || 0) + commission;

          if (hasFirebaseConfig && db) {
            import('firebase/database').then(({ ref, update }) => {
              update(ref(db!, `orders/${order.restaurantId}/${order.id}`), {
                deliveryStatus: 'delivered',
                deliveryDistance: distance,
                deliveryBoyEarnings: commission,
                updatedAt: Date.now()
              });
              update(ref(db!, `deliveryBoys/${riderProfile.id}`), {
                status: 'idle',
                totalDeliveries: nextDeliveries,
                totalEarnings: nextEarnings,
                assignedOrderId: null
              });
            }).catch(console.error);
          } else {
            dispatch({
              type: 'SET_STATE',
              payload: {
                orders: state.orders.map(o =>
                  o.id === order.id
                    ? { ...o, deliveryStatus: 'delivered', deliveryDistance: distance, deliveryBoyEarnings: commission }
                    : o
                ),
                deliveryBoys: state.deliveryBoys.map(b =>
                  b.id === riderProfile.id
                    ? { ...b, status: 'idle', totalDeliveries: nextDeliveries, totalEarnings: nextEarnings, assignedOrderId: null }
                    : b
                )
              }
            });
          }
          addToast('success', `Rider ${riderProfile.name} earned ₹${commission} for this delivery.`);
        }
      }

      addToast('success', `Payment confirmed! Order marked as Served/Completed.`);
    } else {
      addToast('success', `Order status updated to ${STATUS_CONFIG[status].label}`);
    }
  };

  const handleConfirmUpiPayment = (orderId: string) => {
    const o = state.orders.find(ord => ord.id === orderId);
    if (o && o.orderType === 'delivery') {
      dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
      dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'preparing' } });
      addToast('success', 'UPI Payment Confirmed! Order moved to Preparing.');
    } else {
      dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'served' } });
      dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
      addToast('success', 'UPI Payment Confirmed! Order marked as completed.');
    }
  };

  const handleConfirmCashPayment = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'served' } });
    dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
    addToast('success', 'Cash Payment Confirmed! Order marked as completed.');
  };

  const handleConfirmCardPayment = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { id: orderId, status: 'served' } });
    dispatch({ type: 'UPDATE_ORDER_PAYMENT', payload: { id: orderId, status: 'paid' } });
    addToast('success', 'Card Payment Confirmed! Order marked as completed.');
  };

  return (
    <div style={{ padding: '20px 20px 20px', animation: 'fadeIn 0.3s ease' }}>
      {/* Notification Consent Banner */}
      {notificationPermission === 'default' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 100%)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📣</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Enable Live Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Get real-time browser alerts when a customer places an order or calls the waiter.</div>
            </div>
          </div>
          <button
            onClick={handleRequestPermission}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(59,130,246,0.3)',
            }}
          >
            Enable Alerts
          </button>
        </div>
      )}

      {/* Waiter Requests Section */}
      {(activeWaiterRequests.length > 0 || resolvedWaiterRequests.length > 0) && (
        <div style={{
          background: activeWaiterRequests.length > 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.03) 100%)'
            : 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.02) 100%)',
          border: activeWaiterRequests.length > 0
            ? '1px solid rgba(239,68,68,0.25)'
            : '1px solid rgba(34,197,94,0.2)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: activeWaiterRequests.length > 0 ? 'blink-yellow 3s infinite' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: activeWaiterRequests.length > 0 ? 'var(--error)' : 'var(--success)' }}>
              Waiter Requests ({activeWaiterRequests.length} active, {resolvedWaiterRequests.length} resolved)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {/* Active Requests */}
            {activeWaiterRequests.map(req => (
              <div key={req.id} style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Table {req.tableNumber}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => {
                    dispatch({ type: 'RESOLVE_WAITER', payload: req.id });
                    addToast('success', `Assistance for Table ${req.tableNumber} marked done.`);
                  }}
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Resolve
                </button>
              </div>
            ))}

            {/* Resolved Requests */}
            {resolvedWaiterRequests.map(req => (
              <div key={req.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 8,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                opacity: 0.85
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'line-through' }}>Table {req.tableNumber}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{
                  background: 'rgba(34,197,94,0.12)',
                  color: '#22c55e',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 800,
                }}>
                  Waiter Sent ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1 
            onClick={() => setShowHistory(false)}
            style={{ 
              fontSize: 24, 
              fontFamily: 'var(--font-display)', 
              fontWeight: 900, 
              color: !showHistory ? 'var(--brand)' : 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '-0.02em',
              margin: 0,
              cursor: 'pointer'
            }}
          >
            Orders Board
          </h1>

          <button
            onClick={() => setShowHistory(prev => !prev)}
            style={{
              height: 32,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: showHistory ? 'var(--brand)' : 'var(--bg-elevated)',
              border: showHistory ? '1.5px solid var(--brand)' : '1px solid var(--border)',
              color: showHistory ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0 12px',
              transition: 'all 0.2s'
            }}
          >
            📜 History
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
          {/* Open / Close Restaurant Toggle */}
          <button
            onClick={() => {
              if (!hasOutletSettingPermission) {
                addToast('error', '🔒 Access Restricted: Only the restaurant owner or staff with Outlet Settings permission can open/close the restaurant.');
                return;
              }
              const newClosed = !state.restaurant.isManualClosed;
              dispatch({ type: 'SET_MANUAL_CLOSED', payload: newClosed });
              addToast(newClosed ? 'warning' : 'success', newClosed ? '🔴 Restaurant marked CLOSED — customers can no longer place orders.' : '🟢 Restaurant is now OPEN — customers can place orders!');
            }}
            style={{
              height: 32,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: state.restaurant.isManualClosed ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: state.restaurant.isManualClosed ? '1.5px solid #ef4444' : '1.5px solid #22c55e',
              color: state.restaurant.isManualClosed ? '#ef4444' : '#22c55e',
              cursor: 'pointer',
              padding: '0 8px',
              transition: 'all 0.2s ease',
            }}
            title={state.restaurant.isManualClosed ? 'Click to Open Restaurant' : 'Click to Close Restaurant'}
          >
            <span style={{ fontSize: 8, width: 6, height: 6, borderRadius: '50%', background: state.restaurant.isManualClosed ? '#ef4444' : '#22c55e', display: 'inline-block', flexShrink: 0 }} />
            {state.restaurant.isManualClosed ? 'CLOSED' : 'OPEN'}
          </button>

          {/* Tabular vs Kanban Switcher Segmented Control */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 2,
            gap: 2,
            alignItems: 'center',
            height: 32,
            flexShrink: 0
          }}>
            <button
              onClick={() => {
                setIsTabularView(true);
                localStorage.setItem('meenufy_admin_orders_tabular_view', 'true');
              }}
              style={{
                height: '100%',
                padding: '0 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: isTabularView ? 'var(--brand)' : 'transparent',
                color: isTabularView ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              📋 Tabular
            </button>
            <button
              onClick={() => {
                setIsTabularView(false);
                localStorage.setItem('meenufy_admin_orders_tabular_view', 'false');
              }}
              style={{
                height: '100%',
                padding: '0 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: !isTabularView ? 'var(--brand)' : 'transparent',
                color: !isTabularView ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              📊 Kanban
            </button>
          </div>

          {/* Subscription Plan Display - Clickable */}
          {!state.admin?.isStaff && (
            <button
              onClick={() => {
                localStorage.setItem('meenufy_admin_more_section', 'subscription');
                dispatch({ type: 'SET_ADMIN_TAB', payload: 'more' });
              }}
              style={{
                background: 'var(--brand)',
                border: 'none',
                borderRadius: 8,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 700,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 32,
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
              title="Go to Subscription & Pricing settings"
            >
              <span>⭐️</span>
              <span style={{ textTransform: 'capitalize', color: '#ffffff' }}>{state.subscriptionPlan} Plan</span>
            </button>
          )}



          {/* Coupons & Offers Button */}
          <button
            onClick={() => {
              if (!hasOutletSettingPermission) {
                addToast('error', '🔒 Access Restricted: Only the restaurant owner or staff with Outlet Settings permission can manage coupons.');
                return;
              }
              setShowCouponsModal(true);
            }}
            className="btn btn-secondary"
            style={{
              height: 32,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            🏷️ Coupons
          </button>
        </div>
      </div>

      {/* Horizontal Line Below Buttons */}
      <hr style={{ border: 'none', height: '2.5px', backgroundColor: '#000000', margin: '20px 0' }} />

      {/* Active Orders Section */}
      {hasOrdersPermission ? (
        <div style={{ marginBottom: 24 }}>
          {showHistory ? (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Filters card */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Search size={18} color="var(--brand)" />
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>Filter Order History</h3>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleExportHistoryPDF}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', height: 28, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    📄 Export PDF
                  </button>
                  <button
                    onClick={handleExportHistoryExcel}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', height: 28, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    📊 Export Excel
                  </button>
                </div>
              </div>
              
              {/* Search input */}
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Search Orders</label>
                <div className="input-icon-wrap">
                  <Search size={15} className="input-icon" />
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Search by ID, customer name, phone, table number, item name..." 
                    value={historySearchQuery}
                    onChange={e => setHistorySearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Time filters buttons */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }} className="hide-scrollbar">
                {[
                  { key: 'today', label: "Today's Orders" },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'choose', label: 'Choose Month' },
                  { key: 'lifetime', label: 'Lifetime' }
                ].map(f => {
                  const isSelected = historyTimeFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => {
                        setHistoryTimeFilter(f.key as any);
                        if (f.key !== 'choose') setHistorySelectedMonth('');
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 99,
                        background: isSelected ? 'var(--brand)' : 'var(--bg-elevated)',
                        color: isSelected ? '#000' : 'var(--text-primary)',
                        border: isSelected ? 'none' : '1px solid var(--border)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Dropdowns / Date picker inputs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {historyTimeFilter === 'choose' && uniqueMonths.length > 0 && (
                  <div className="input-group" style={{ flex: 1, minWidth: 140 }}>
                    <label className="input-label">Select Month</label>
                    <select
                      className="input"
                      value={historySelectedMonth}
                      onChange={e => setHistorySelectedMonth(e.target.value)}
                    >
                      <option value="">Choose Month...</option>
                      {uniqueMonths.map(m => {
                        const [year, month] = m.split('-');
                        const date = new Date(Number(year), Number(month) - 1, 1);
                        const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        return <option key={m} value={m}>{label}</option>;
                      })}
                    </select>
                  </div>
                )}

                <div className="input-group" style={{ flex: 1, minWidth: 120 }}>
                  <label className="input-label">From Date</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} className="input-icon" />
                    <input 
                      type="date" 
                      className="input" 
                      value={historyStartDate}
                      onChange={e => setHistoryStartDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group" style={{ flex: 1, minWidth: 120 }}>
                  <label className="input-label">To Date</label>
                  <div className="input-icon-wrap">
                    <Calendar size={15} className="input-icon" />
                    <input 
                      type="date" 
                      className="input" 
                      value={historyEndDate}
                      onChange={e => setHistoryEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Orders list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredHistoryOrders.length === 0 ? (
                <div style={{
                  padding: 40,
                  textAlign: 'center',
                  background: 'var(--bg-elevated)',
                  border: '1px dashed var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-muted)'
                }}>
                  No historical orders found matching filters.
                </div>
              ) : (
                filteredHistoryOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="card" 
                    style={{ 
                      padding: 14, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 10,
                      borderColor: order.status === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' : undefined 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800 }}>#{order.id.slice(-4).toUpperCase()}</span>
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 700, 
                            padding: '1px 6px', 
                            borderRadius: 99,
                            background: order.status === 'served' ? 'rgba(34,197,94,0.15)' : order.status === 'cancelled' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: order.status === 'served' ? '#22c55e' : order.status === 'cancelled' ? '#ef4444' : '#f59e0b'
                          }}>
                            {order.status.toUpperCase()}
                          </span>
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 700, 
                            padding: '1px 6px', 
                            borderRadius: 99,
                            background: order.paymentStatus === 'paid' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: order.paymentStatus === 'paid' ? '#22c55e' : '#ef4444'
                          }}>
                            {order.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(order.createdAt).toLocaleString()} | Table {order.tableNumber} | Cust: {order.customerName || 'Guest'} ({order.customerPhone || 'N/A'})
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--brand)' }}>
                          {state.restaurant.currency}{order.totalAmount}
                        </span>
                      </div>
                    </div>

                    {/* Items summary */}
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {order.items.map(item => `${item.qty}x ${item.name}${item.variant ? ` (${item.variant.name})` : ''}${item.addons && item.addons.length > 0 ? ` [${item.addons.map(a => a.optionName).join(', ')}]` : ''}`).join(', ')}
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                      <button 
                        onClick={() => printThermalReceipt(order, 'kot', state.restaurant)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Printer size={12} /> Print KOT
                      </button>
                      <button 
                        onClick={() => printThermalReceipt(order, 'bill', state.restaurant)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Printer size={12} /> Print Bill
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : isTabularView ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn 0.3s ease' }}>
            {activeOrders.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                background: 'var(--bg-elevated)',
                border: '1px dashed var(--border)',
                borderRadius: 12,
                color: 'var(--text-muted)'
              }}>
                No active orders at the moment.
              </div>
            ) : (
              [...activeOrders]
                .sort((a, b) => a.createdAt - b.createdAt)
                .map(order => (
                  <TabularOrderRow
                    key={order.id}
                    order={order}
                    onStatusChange={handleUpdateStatus}
                    onConfirmUpi={handleConfirmUpiPayment}
                    onConfirmCash={handleConfirmCashPayment}
                    onConfirmCard={handleConfirmCardPayment}
                    currency={state.restaurant.currency}
                  />
                ))
            )}
          </div>
        ) : (
          /* Kanban Board of Active Orders */
          <div style={{
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            paddingBottom: 12,
            minHeight: 520,
            alignItems: 'flex-start',
          }}>
            {[
              { status: 'pending', label: 'New Order', color: '#f59e0b', list: activeOrders.filter(o => o.status === 'pending') },
              { status: 'preparing', label: 'Preparing', color: '#a855f7', list: activeOrders.filter(o => o.status === 'preparing') },
              { status: 'ready', label: 'Ready', color: '#22c55e', list: activeOrders.filter(o => o.status === 'ready') },
              { status: 'bill_pay', label: 'Bill & Pay', color: '#3b82f6', list: activeOrders.filter(o => o.status === 'bill_pay') },
            ].map(col => (
              <div
                key={col.status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const orderId = e.dataTransfer.getData('text/plain');
                  if (orderId) {
                    handleUpdateStatus(orderId, col.status as OrderStatus);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 280,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  alignSelf: 'stretch',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{col.label}</span>
                  </div>
                  <span style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
                    {col.list.length}
                  </span>
                </div>

                {/* Card List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', maxHeight: '650px', minHeight: 420 }}>
                  {col.list.length === 0 ? (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      padding: 24,
                      textAlign: 'center',
                    }}>
                      Drag orders here
                    </div>
                  ) : (
                    col.list.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleUpdateStatus}
                        onConfirmUpi={handleConfirmUpiPayment}
                        onConfirmCash={handleConfirmCashPayment}
                        onConfirmCard={handleConfirmCardPayment}
                        currency={state.restaurant.currency}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      ) : (
        <div style={{
          padding: '40px 24px',
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          border: '1px dashed var(--border)',
          marginBottom: 24,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13
        }}>
          🍳 Orders Board access is restricted.
        </div>
      )}

      {/* Horizontal Line where active orders end and Table map starts */}
      <hr style={{ border: 'none', height: '2.5px', backgroundColor: '#000000', margin: '24px 0 20px' }} />

      {/* Live Table Map */}
      {hasQrTablesPermission ? (
        <TableMap />
      ) : (
        <div style={{
          padding: '40px 24px',
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          border: '1px dashed var(--border)',
          marginBottom: 32,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13
        }}>
          🪑 Table Map access is restricted.
        </div>
      )}

      {/* Coupons & Offers Manager Modal */}
      {showCouponsModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCouponsModal(false)}>
          <div className="modal-content" style={{ maxWidth: 500, padding: 24, position: 'relative' }}>
            <button
              onClick={() => setShowCouponsModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand)', marginBottom: 16 }}>
              🏷️ Coupon & Offers Manager
            </h3>

            {/* Live Scrolling Offer Marquee Toggle */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 125, 0, 0.08) 0%, rgba(255, 125, 0, 0.02) 100%)',
              border: '1px solid rgba(255, 125, 0, 0.2)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', marginRight: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>✨ Scrolling Offer Marquee Banner</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Show a live scrolling banner of active offers on customer home page</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={!!state.restaurant.offersMarqueeEnabled}
                  onChange={e => dispatch({
                    type: 'UPDATE_RESTAURANT',
                    payload: { offersMarqueeEnabled: e.target.checked }
                  })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 24,
                  background: state.restaurant.offersMarqueeEnabled ? 'var(--brand)' : 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  transition: '0.2s',
                }}>
                  <span style={{
                    position: 'absolute', left: 2, bottom: 1, width: 20, height: 20, borderRadius: '50%',
                    background: state.restaurant.offersMarqueeEnabled ? '#000' : '#fff',
                    transform: state.restaurant.offersMarqueeEnabled ? 'translateX(20px)' : 'translateX(0)',
                    transition: '0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }} />
                </span>
              </label>
            </div>

            {/* Create/Edit Coupon Form */}
            <form onSubmit={handleSaveCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 4 }}>
                {editingCouponId ? '✏️ Edit Promo Coupon' : '➕ Create Promo Coupon'}
              </h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="input-group" style={{ flex: 1, minWidth: 120 }}>
                  <label className="input-label" style={{ fontSize: 10 }}>Promo Code (alphanumeric)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. FLAT100"
                    value={couponForm.code}
                    onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    style={{ textTransform: 'uppercase', height: 34, fontSize: 12 }}
                  />
                </div>
                
                <div className="input-group" style={{ width: 120 }}>
                  <label className="input-label" style={{ fontSize: 10 }}>Discount Type</label>
                  <select
                    className="input"
                    value={couponForm.type}
                    onChange={e => setCouponForm({ ...couponForm, type: e.target.value as 'flat' | 'percentage' })}
                    style={{ height: 34, fontSize: 12, padding: '0 8px' }}
                  >
                    <option value="flat">Flat (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="input-group" style={{ flex: 1, minWidth: 100 }}>
                  <label className="input-label" style={{ fontSize: 10 }}>
                    Discount Value {couponForm.type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    className="input"
                    placeholder={couponForm.type === 'percentage' ? 'e.g. 10' : 'e.g. 100'}
                    value={couponForm.value}
                    onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                    style={{ height: 34, fontSize: 12 }}
                  />
                </div>

                <div className="input-group" style={{ flex: 1, minWidth: 100 }}>
                  <label className="input-label" style={{ fontSize: 10 }}>Min. Order Amount (₹, optional)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 300"
                    value={couponForm.minOrderAmount}
                    onChange={e => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })}
                    style={{ height: 34, fontSize: 12 }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ width: '100%' }}>
                <label className="input-label" style={{ fontSize: 10 }}>Coupon Label / Description (optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Valid on Drinks & Desserts"
                  value={couponForm.label}
                  onChange={e => setCouponForm({ ...couponForm, label: e.target.value })}
                  style={{ height: 34, fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <label className="input-label" style={{ fontSize: 10 }}>Applies To</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="radio"
                      name="appliesToType"
                      checked={couponForm.appliesToType === 'all'}
                      onChange={() => setCouponForm({ ...couponForm, appliesToType: 'all' })}
                    />
                    <span>All Items</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="radio"
                      name="appliesToType"
                      checked={couponForm.appliesToType === 'categories'}
                      onChange={() => setCouponForm({ ...couponForm, appliesToType: 'categories' })}
                    />
                    <span>Specific Categories</span>
                  </label>
                </div>
              </div>

              {couponForm.appliesToType === 'categories' && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 120,
                  overflowY: 'auto'
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>Select Categories:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {state.categories.map(cat => {
                      const isChecked = couponForm.selectedCategories.includes(cat.id);
                      return (
                        <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const updated = e.target.checked
                                ? [...couponForm.selectedCategories, cat.id]
                                : couponForm.selectedCategories.filter(id => id !== cat.id);
                              setCouponForm({ ...couponForm, selectedCategories: updated });
                            }}
                          />
                          <span>{cat.icon} {cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {state.categories.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No categories found</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={couponForm.isOneTime}
                    onChange={e => setCouponForm({ ...couponForm, isOneTime: e.target.checked })}
                  />
                  <span>One-time use per customer</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={couponForm.isActive}
                    onChange={e => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                  />
                  <span>Active (Instantly available)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, height: 34, fontSize: 12, color: '#000', fontWeight: 700 }}
                >
                  {editingCouponId ? 'Update Coupon' : 'Create Coupon'}
                </button>
                {editingCouponId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingCouponId(null);
                      setCouponForm({
                        code: '',
                        type: 'flat',
                        value: '',
                        minOrderAmount: '',
                        isOneTime: false,
                        isActive: true,
                        appliesToType: 'all',
                        selectedCategories: [],
                        label: ''
                      });
                    }}
                    style={{ height: 34, fontSize: 12 }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Current Coupons List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                📋 Current Coupons
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                {(state.coupons || []).filter(c => (c.restaurantId || 'admin-1') === (state.admin?.restaurantId || 'admin-1')).map(coupon => (
                  <div
                    key={coupon.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>{coupon.code}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: coupon.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: coupon.isActive ? 'var(--success)' : 'var(--error)' }}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {coupon.type === 'percentage' ? `${coupon.value}% Off` : `₹${coupon.value} Off`}
                        {coupon.minOrderAmount ? ` • Min. order ₹${coupon.minOrderAmount}` : ''}
                        {coupon.isOneTime ? ` • One-time` : ''}
                      </div>
                      {coupon.label && (
                        <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 2, fontStyle: 'italic' }}>
                          ℹ️ {coupon.label}
                        </div>
                      )}
                      {Array.isArray(coupon.appliesTo) && coupon.appliesTo.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          <span>Applies to:</span>
                          {coupon.appliesTo.map(catId => {
                            const cat = state.categories.find(c => c.id === catId);
                            return (
                              <span key={catId} style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 4, fontSize: 9 }}>
                                {cat ? `${cat.icon} ${cat.name}` : catId}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleToggleCouponActive(coupon)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px', height: 26 }}
                      >
                        {coupon.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEditCoupon(coupon)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px', height: 26 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 10, padding: '2px 8px', height: 26, color: 'var(--error)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {(!state.coupons || state.coupons.filter(c => (c.restaurantId || 'admin-1') === (state.admin?.restaurantId || 'admin-1')).length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 12 }}>
                    No coupons created yet. Use form above to add one.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating Manual Order Button (+ Order) */}
      {!showHistory && (
        <button
          onClick={() => setShowManualOrderModal(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            right: 20,
            zIndex: 99,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(255, 125, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#ffffff',
            border: '1.5px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            transition: 'all 0.2s',
          }}
          title="Place Manual Order"
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 125, 0, 1)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 125, 0, 0.85)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ➕
        </button>
      )}

      {/* Manual Order Placement Modal */}
      {showManualOrderModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowManualOrderModal(false); resetManualOrderForm(); } }} style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: 850, width: '95%', padding: 24, position: 'relative', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              onClick={() => {
                setShowManualOrderModal(false);
                resetManualOrderForm();
              }}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
            >
              <X size={16} />
            </button>

            <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>➕</span> Place Manual Order
            </h3>

            {/* Split layout: left form & selection, right order summary */}
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 768 ? '1.2fr 0.8fr' : '1fr', gap: 20, paddingBottom: 10 }}>
              
              {/* Left Side: Order Settings & Menu Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Section 1: Customer & Dining Details */}
                <div className="card" style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>👤</span> 1. Customer & Dining Details
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Customer Name</label>
                      <input
                        type="text"
                        placeholder="e.g. John Doe (Optional)"
                        value={manualOrderName}
                        onChange={e => setManualOrderName(e.target.value)}
                        className="input"
                        style={{ height: 36, padding: '0 10px', fontSize: 12, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Customer Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210 (Optional)"
                        value={manualOrderPhone}
                        onChange={e => setManualOrderPhone(e.target.value)}
                        className="input"
                        style={{ height: 36, padding: '0 10px', fontSize: 12, width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Order Type</label>
                        <select
                          value={manualOrderType}
                          onChange={e => {
                            const val = e.target.value as any;
                            setManualOrderType(val);
                            if (val !== 'in-dining') {
                              setManualOrderTableId('n/a');
                              setManualOrderTableNumber(0);
                            }
                          }}
                          className="input"
                          style={{ height: 36, padding: '0 10px', fontSize: 12, width: '100%', background: 'var(--bg-primary)' }}
                        >
                          <option value="in-dining">🪑 In-Dining</option>
                          <option value="take-away">🛍️ Take-Away</option>
                          <option value="delivery">🛵 Home Delivery</option>
                        </select>
                      </div>

                      {manualOrderType === 'in-dining' && (
                        <div>
                          <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Select Table</label>
                          <select
                            value={manualOrderTableId}
                            onChange={e => {
                              const tblId = e.target.value;
                              setManualOrderTableId(tblId);
                              const tbl = state.tables.find(t => t.id === tblId);
                              setManualOrderTableNumber(tbl ? tbl.number : 0);
                            }}
                            className="input"
                            style={{ height: 36, padding: '0 10px', fontSize: 12, width: '100%', background: 'var(--bg-primary)' }}
                          >
                            <option value="n/a">N/A</option>
                            {state.tables.map(t => (
                              <option key={t.id} value={t.id}>
                                Table {t.number} ({t.label})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {manualOrderType === 'delivery' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="input-label" style={{ fontSize: 11, margin: 0 }}>Delivery Address & Location Link *</label>
                          <button
                            type="button"
                            onClick={() => setShowMapModal(true)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, height: 'auto' }}
                          >
                            📍 Pin on Map
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Enter location URL (e.g. Google Maps) or address details..."
                          value={manualOrderDeliveryAddress}
                          onChange={e => setManualOrderDeliveryAddress(e.target.value)}
                          className="input"
                          style={{ height: 36, padding: '0 10px', fontSize: 11.5, width: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Dish Selector */}
                <div className="card" style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 280 }}>
                  <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📖</span> 2. Select Dishes
                  </h4>
                  
                  {/* Search and Category Filters */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="Search dish name..."
                      value={manualSearchQuery}
                      onChange={e => setManualSearchQuery(e.target.value)}
                      className="input"
                      style={{ height: 36, padding: '0 10px', fontSize: 12, flex: 1 }}
                    />
                    <select
                      value={manualSelectedCategory}
                      onChange={e => setManualSelectedCategory(e.target.value)}
                      className="input"
                      style={{ height: 36, padding: '0 10px', fontSize: 12, width: 140, background: 'var(--bg-primary)' }}
                    >
                      <option value="all">All Categories</option>
                      {state.categories.filter(c => (c.restaurantId || 'admin-1') === (state.admin?.restaurantId || 'admin-1')).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dishes Scrollable List */}
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg-primary)' }}>
                    {(() => {
                      const filteredDishes = state.menuItems.filter(item => {
                        const matchesRest = (item.restaurantId || 'admin-1') === (state.admin?.restaurantId || 'admin-1');
                        const matchesCat = manualSelectedCategory === 'all' || item.category === manualSelectedCategory || (item.categories && item.categories.includes(manualSelectedCategory));
                        const matchesSearch = item.name.toLowerCase().includes(manualSearchQuery.toLowerCase());
                        return matchesRest && matchesCat && matchesSearch;
                      });

                      if (filteredDishes.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 12 }}>
                            No dishes found matching filters.
                          </div>
                        );
                      }

                      return filteredDishes.map(item => {
                        const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
                        
                        return (
                          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)', padding: '8px 4px', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12 }}>{item.isVeg ? '🟢' : '🔴'}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                              </div>
                              {!hasVariants && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    {state.restaurant.currency || '₹'}{item.price}
                                  </span>
                                  
                                  {/* Plus/Minus Counters */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveManualItem(item)}
                                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 800, padding: '0 4px', color: 'var(--brand)' }}
                                    >
                                      -
                                    </button>
                                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 14, textAlign: 'center', color: 'var(--text-primary)' }}>
                                      {manualOrderItems.find(x => x.menuItemId === item.id && !x.variant)?.qty || 0}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddManualItem(item)}
                                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '0 4px', color: 'var(--brand)' }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Render Variants if present */}
                            {hasVariants && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
                                {item.variants!.map(v => (
                                  <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>• {v.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {state.restaurant.currency || '₹'}{v.price}
                                      </span>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 4px' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveManualItem(item, v)}
                                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '0 4px', color: 'var(--brand)' }}
                                        >
                                          -
                                        </button>
                                        <span style={{ fontSize: 10, fontWeight: 700, minWidth: 12, textAlign: 'center', color: 'var(--text-primary)' }}>
                                          {manualOrderItems.find(x => x.menuItemId === item.id && x.variant?.name === v.name)?.qty || 0}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleAddManualItem(item, v)}
                                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10, fontWeight: 800, padding: '0 4px', color: 'var(--brand)' }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Side: Order Summary & Placement Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Summary Box */}
                <div className="card" style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🛒</span> 3. Order Summary
                    </h4>

                    <div style={{ overflowY: 'auto', maxHeight: 180, border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 12, background: 'var(--bg-primary)' }}>
                      {manualOrderItems.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span>🛍️ Empty Cart</span>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>Add dishes from the left selection</span>
                        </div>
                      ) : (
                        manualOrderItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderBottom: '1px dashed var(--border)', padding: '6px 2px' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {item.name} {item.variant ? `(${item.variant.name})` : ''}
                              </div>
                              <div style={{ color: 'var(--text-muted)' }}>
                                {item.qty} x {state.restaurant.currency || '₹'}{item.price}
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {state.restaurant.currency || '₹'}{item.qty * item.price}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Total Amount</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>
                        {state.restaurant.currency || '₹'}{manualOrderItems.reduce((sum, item) => sum + (item.price * item.qty), 0)}
                      </span>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Special Instructions</label>
                      <textarea
                        placeholder="e.g. Less spicy, Extra sauce..."
                        rows={2}
                        value={manualOrderNote}
                        onChange={e => setManualOrderNote(e.target.value)}
                        className="input"
                        style={{ padding: '8px 10px', fontSize: 12, resize: 'none', width: '100%', height: 48 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div>
                        <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Payment Status</label>
                        <select
                          value={manualOrderPaymentStatus}
                          onChange={e => setManualOrderPaymentStatus(e.target.value as any)}
                          className="input"
                          style={{ height: 34, padding: '0 8px', fontSize: 11.5, background: 'var(--bg-primary)' }}
                        >
                          <option value="pending">⏳ Pending (Unpaid)</option>
                          <option value="paid">✅ Paid (Completed)</option>
                        </select>
                      </div>

                      {manualOrderPaymentStatus === 'paid' && (
                        <div>
                          <label className="input-label" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Payment Method</label>
                          <select
                            value={manualOrderPaymentMethod}
                            onChange={e => setManualOrderPaymentMethod(e.target.value as any)}
                            className="input"
                            style={{ height: 34, padding: '0 8px', fontSize: 11.5, background: 'var(--bg-primary)' }}
                          >
                            <option value="cash">💵 Cash</option>
                            <option value="upi">📱 UPI</option>
                            <option value="card">💳 Card</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handlePlaceManualOrder}
                    disabled={manualOrderItems.length === 0}
                    className="btn btn-primary"
                    style={{ height: 40, fontSize: 13, fontWeight: 800, width: '100%', borderRadius: 10, cursor: manualOrderItems.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    🚀 Place Manual Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMapModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1300,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 24,
            padding: '24px', width: '100%', maxWidth: 440,
            border: '1px solid var(--border-elevated)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>📍</span>
                <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Pin Delivery Location</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 2 }}>
              Drag the marker or click on the map to pin the exact delivery location.
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <div 
                id="manual-delivery-pin-map" 
                style={{ 
                  width: '100%', 
                  height: 320, 
                  borderRadius: 14, 
                  border: '1px solid var(--border)', 
                  overflow: 'hidden',
                  background: 'var(--bg-elevated)'
                }} 
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-full" 
                onClick={() => setShowMapModal(false)}
                style={{ height: 42, fontSize: 13, fontWeight: 700 }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary btn-full"
                onClick={handleConfirmMapLocation}
                disabled={mapLoading}
                style={{ height: 42, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {mapLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Pin Location</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableMap() {
  const { state, dispatch, addToast } = useStore();
  const { tables, orders } = state;
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Reservation form state
  const [showReserveForm, setShowReserveForm] = useState(false);
  const [resDate, setResDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [resStartTime, setResStartTime] = useState(() => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });
  const [resEndTime, setResEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });
  const [resGuestName, setResGuestName] = useState('');
  const [resGuestPhone, setResGuestPhone] = useState('');
  const [resGuestCount, setResGuestCount] = useState<number>(2);

  // Reset form when selected table changes
  useEffect(() => {
    if (selectedTable) {
      const tbl = tables.find(t => t.id === selectedTable);
      if (tbl && tbl.status === 'reserved') {
        setShowReserveForm(false);
      } else {
        setShowReserveForm(false);
      }
      
      const d = new Date();
      setResDate(d.toISOString().split('T')[0]);
      
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      setResStartTime(`${h}:${m}`);
      
      const dEnd = new Date();
      dEnd.setHours(dEnd.getHours() + 2);
      const hEnd = String(dEnd.getHours()).padStart(2, '0');
      const mEnd = String(dEnd.getMinutes()).padStart(2, '0');
      setResEndTime(`${hEnd}:${mEnd}`);
      
      setResGuestName('');
      setResGuestPhone('');
      setResGuestCount(tbl?.capacity || 2);
    }
  }, [selectedTable, tables]);

  const handleEditExistingReservation = (tbl: any) => {
    if (tbl.reservationFrom) {
      const fromDate = new Date(tbl.reservationFrom);
      setResDate(fromDate.toISOString().split('T')[0]);
      const h = String(fromDate.getHours()).padStart(2, '0');
      const m = String(fromDate.getMinutes()).padStart(2, '0');
      setResStartTime(`${h}:${m}`);
    }
    if (tbl.reservationTo) {
      const toDate = new Date(tbl.reservationTo);
      const h = String(toDate.getHours()).padStart(2, '0');
      const m = String(toDate.getMinutes()).padStart(2, '0');
      setResEndTime(`${h}:${m}`);
    }
    setResGuestName(tbl.reservationGuestName || '');
    setResGuestPhone(tbl.reservationGuestPhone || '');
    setResGuestCount(tbl.reservationGuestCount || tbl.capacity || 2);
    setShowReserveForm(true);
  };

  const adminRestaurantId = state.admin?.restaurantId || 'admin-1';
  const myOrders = orders.filter(o => (o.restaurantId || 'admin-1') === adminRestaurantId);
  const occupiedMap: Record<string, { customerName: string; orderCount: number }> = {};
  myOrders.forEach(o => {
    if (['pending', 'preparing', 'ready', 'bill_pay'].includes(o.status) && (Date.now() - o.createdAt < 180 * 60 * 1000)) {
      if (!occupiedMap[o.tableId]) {
        occupiedMap[o.tableId] = { customerName: o.customerName || 'Guest', orderCount: 1 };
      } else {
        occupiedMap[o.tableId].orderCount += 1;
      }
    }
  });

  const selectedTableData = tables.find(t => t.id === selectedTable);

  if (tables.length === 0) {
    return (
      <div style={{
        padding: '20px 24px',
        background: 'var(--bg-elevated)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        marginBottom: 24,
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🪑</div>
        <div>No tables configured yet.</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Go to <strong>More → Manage QR &amp; Tables</strong> to set up your tables.</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>🪑 Table Map</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tap a table to change its status</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#22c55e', display: 'inline-block' }} /> Free
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} /> Occupied
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#eab308', display: 'inline-block' }} /> Maintenance
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#8b5cf6', display: 'inline-block' }} /> Reserved
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 12,
      }}>
        {tables.map(table => {
          const isMaintenance = table.status === 'maintenance';
          const isReserved = table.status === 'reserved';
          const occupied = occupiedMap[table.id];
          const isOccupied = !!occupied && !isMaintenance && !isReserved;

          let bg = '#22c55e';
          let textColor = '#fff';
          let borderColor = '#16a34a';
          let statusLabel = 'Free';

          if (isMaintenance) {
            bg = '#eab308'; textColor = '#000'; borderColor = '#ca8a04'; statusLabel = 'Maintenance';
          } else if (isReserved) {
            bg = '#8b5cf6'; textColor = '#fff'; borderColor = '#7c3aed';
            statusLabel = table.reservationGuestName ? `Res: ${table.reservationGuestName}` : 'Reserved';
          } else if (isOccupied) {
            bg = '#ef4444'; textColor = '#fff'; borderColor = '#dc2626'; statusLabel = occupied.customerName;
          }

          return (
            <div
              key={table.id}
              onClick={() => setSelectedTable(table.id)}
              style={{
                background: bg,
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                padding: '12px 8px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                minHeight: 100,
                justifyContent: 'center',
                boxShadow: isOccupied ? '0 4px 16px rgba(239,68,68,0.35)' : isMaintenance ? '0 4px 16px rgba(234,179,8,0.3)' : isReserved ? '0 4px 16px rgba(139,92,246,0.3)' : '0 4px 16px rgba(34,197,94,0.2)',
                transition: 'all 0.2s ease',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              <div style={{ position: 'absolute', top: 6, right: 6, opacity: 0.75 }}>
                <Edit2 size={10} color={textColor} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: textColor, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                {table.number}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: textColor, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {statusLabel}
              </div>
              {isOccupied && occupied.orderCount > 1 && (
                <div style={{ fontSize: 9, fontWeight: 800, background: 'rgba(0,0,0,0.25)', color: '#fff', borderRadius: 99, padding: '1px 6px' }}>
                  {occupied.orderCount} orders
                </div>
              )}
              {isMaintenance && <Wrench size={13} color={textColor} style={{ opacity: 0.8 }} />}
              {isReserved && <Calendar size={13} color={textColor} style={{ opacity: 0.8 }} />}
            </div>
          );
        })}
      </div>

      {/* Table Status Edit Modal */}
      {selectedTable && selectedTableData && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setSelectedTable(null)}
          style={{ zIndex: 200 }}
        >
          <div
            className="modal-content"
            style={{ maxWidth: 340, padding: 24, position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTable(null)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}
            >
              ×
            </button>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Table {selectedTableData.number}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Current status: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{selectedTableData.status === 'maintenance' ? 'Maintenance' : selectedTableData.status === 'reserved' ? 'Reserved' : occupiedMap[selectedTable] ? 'Occupied' : 'Free'}</strong>
            </p>

            {/* Modal Body options */}
            {selectedTableData.status === 'reserved' && !showReserveForm ? (
              <div>
                <div style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1.5px solid #8b5cf6',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#c084fc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> Reserved Details
                  </div>
                  
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Date: </span>
                      <strong>{selectedTableData.reservationFrom ? new Date(selectedTableData.reservationFrom).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '-'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Time: </span>
                      <strong>
                        {selectedTableData.reservationFrom ? new Date(selectedTableData.reservationFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        {' - '}
                        {selectedTableData.reservationTo ? new Date(selectedTableData.reservationTo).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Guest Name: </span>
                      <strong>{selectedTableData.reservationGuestName || 'Guest'}</strong>
                    </div>
                    {selectedTableData.reservationGuestPhone && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Phone: </span>
                        <strong>{selectedTableData.reservationGuestPhone}</strong>
                      </div>
                    )}
                    {selectedTableData.reservationGuestCount && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Guests: </span>
                        <strong>{selectedTableData.reservationGuestCount} people</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => handleEditExistingReservation(selectedTableData)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    ✏️ Edit Reservation
                  </button>

                  <button
                    onClick={() => {
                      dispatch({ type: 'UPDATE_TABLE_STATUS', payload: { id: selectedTable, status: 'active' } });
                      addToast('success', `Reservation for Table ${selectedTableData.number} released!`);
                      setSelectedTable(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1.5px solid var(--error)',
                      color: 'var(--error)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    🗑️ Release / Cancel Reservation
                  </button>
                </div>
              </div>
            ) : showReserveForm ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                let fromDate = new Date(`${resDate}T${resStartTime}`);
                let toDate = new Date(`${resDate}T${resEndTime}`);
                if (toDate.getTime() < fromDate.getTime()) {
                  toDate.setDate(toDate.getDate() + 1);
                }
                
                dispatch({
                  type: 'SET_TABLE_RESERVATION',
                  payload: {
                    id: selectedTable,
                    reservationFrom: fromDate.getTime(),
                    reservationTo: toDate.getTime(),
                    reservationGuestName: resGuestName.trim() || 'Guest',
                    reservationGuestPhone: resGuestPhone.trim() || undefined,
                    reservationGuestCount: Number(resGuestCount) || 2
                  }
                });
                
                addToast('success', `Table ${selectedTableData.number} successfully reserved!`);
                setSelectedTable(null);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <h4 style={{ margin: '0 0 4px 0', fontSize: 13, color: '#c084fc' }}>Enter Reservation details:</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Date</label>
                  <input
                    type="date"
                    required
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>From Time</label>
                    <input
                      type="time"
                      required
                      value={resStartTime}
                      onChange={(e) => setResStartTime(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: 12
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>To Time</label>
                    <input
                      type="time"
                      required
                      value={resEndTime}
                      onChange={(e) => setResEndTime(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: 12
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Guest Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. John Doe"
                    value={resGuestName}
                    onChange={(e) => setResGuestName(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    placeholder="E.g. 9876543210"
                    value={resGuestPhone}
                    onChange={(e) => setResGuestPhone(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>Number of People</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={resGuestCount}
                    onChange={(e) => setResGuestCount(Number(e.target.value))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTableData.status === 'reserved') {
                        setShowReserveForm(false);
                      } else {
                        setSelectedTable(null);
                      }
                    }}
                    style={{
                      padding: '10px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '10px',
                      borderRadius: 6,
                      background: '#8b5cf6',
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'active', label: '🟢 Mark as Free', desc: 'Table is available for new guests', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                  { key: 'maintenance', label: '🔧 Mark as Maintenance', desc: 'Table is under maintenance / unavailable', color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      dispatch({ type: 'UPDATE_TABLE_STATUS', payload: { id: selectedTable, status: opt.key as 'active' | 'maintenance' } });
                      addToast('success', `Table ${selectedTableData.number} marked as ${opt.key === 'active' ? 'Free' : 'Maintenance'}!`);
                      setSelectedTable(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: opt.bg,
                      border: `1.5px solid ${opt.color}`,
                      color: opt.color,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)' }}>{opt.desc}</span>
                  </button>
                ))}

                <button
                  onClick={() => setShowReserveForm(true)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(139,92,246,0.1)',
                    border: '1.5px solid #8b5cf6',
                    color: '#c084fc',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>📅 Reserve Table</span>
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)' }}>Reserve table for a customer time slot</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
  onConfirmUpi,
  onConfirmCash,
  onConfirmCard,
  currency
}: {
  order: Order;
  onStatusChange: (id: string, s: OrderStatus) => void;
  onConfirmUpi: (id: string) => void;
  onConfirmCash: (id: string) => void;
  onConfirmCard: (id: string) => void;
  currency: string;
}) {
  const { state, dispatch } = useStore();
  const customer = state.customers.find(c => c.phone === order.customerPhone);
  const isVip = order.isVipCustomer || (customer ? !!customer.isVip : false);
  const [showDetails, setShowDetails] = useState(false);

  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const nextStatus = currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;

  // Update every second for accurate 1-second red blink
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = now - order.createdAt;
  const elapsedMins = elapsedMs / (1000 * 60);
  
  let timeBg = '#22c55e'; // green
  let timeColor = '#ffffff';
  if (elapsedMins > 30) {
    timeBg = '#ef4444'; // red
    timeColor = '#ffffff';
  } else if (elapsedMins > 15) {
    timeBg = '#eab308'; // yellow
    timeColor = '#000000';
  }

  const minVal = Math.floor(elapsedMins);
  const timeTextStr = `${minVal} min`;

  // Blink animation: yellow = subtle 3s pulse, red = hard 1s flash
  let timeBlink: string | undefined;
  if (elapsedMins > 30) {
    timeBlink = 'blink-red 1s step-end infinite';
  } else if (elapsedMins > 15) {
    timeBlink = 'blink-yellow 3s ease-in-out infinite';
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', order.id);
      }}
      className="card"
      style={{
        borderLeft: `4px solid ${cfg.color}`,
        borderTop: order.orderType === 'delivery' ? '2.5px solid #9D4EDD' : order.orderType === 'take-away' ? '2.5px solid #ef4444' : undefined,
        borderRight: order.orderType === 'delivery' ? '1px solid rgba(157, 78, 221, 0.25)' : order.orderType === 'take-away' ? '1px solid rgba(239, 68, 68, 0.25)' : undefined,
        borderBottom: order.orderType === 'delivery' ? '1px solid rgba(157, 78, 221, 0.25)' : order.orderType === 'take-away' ? '1px solid rgba(239, 68, 68, 0.25)' : undefined,
        padding: '12px 14px',
        animation: 'fadeIn 0.3s ease',
        cursor: 'grab',
        background: order.orderType === 'delivery' ? 'rgba(157, 78, 221, 0.04)' : order.orderType === 'take-away' ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-primary)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Table & Id */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {order.orderType === 'delivery' ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 900,
                background: 'linear-gradient(135deg, rgba(157,78,221,0.2), rgba(157,78,221,0.1))',
                color: '#C084FC',
                border: '1px solid rgba(157,78,221,0.4)',
                padding: '3px 10px', borderRadius: 20,
                boxShadow: '0 0 10px rgba(157,78,221,0.2)',
                animation: 'deliveryBadgePulse 2s ease infinite'
              }}>
                <span style={{ fontSize: 9 }}>●</span> 🏠 HOME DELIVERY
              </span>
            ) : order.orderType === 'take-away' ? '🛍️ Take-Away Order' : `Table ${order.tableNumber}`}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              #{order.id.slice(-4).toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>{order.customerName || 'Guest'}</span>
              {isVip && (
                <span style={{ color: '#ffd700', fontWeight: 800, fontSize: 11, textShadow: '0 0 6px rgba(255, 215, 0, 0.4)' }}>
                  [👑 VIP]
                </span>
              )}
            </span>
            {order.numberOfGuests && (
              <span style={{
                fontSize: 9.5, fontWeight: 700,
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                padding: '2px 6px', borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                👥 {order.numberOfGuests}
              </span>
            )}
            {order.orderType === 'delivery' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {order.deliveryBoyId && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 900, padding: '2.5px 6px', borderRadius: 4,
                    background: 'rgba(34,197,94,0.15)', color: '#4ADE80',
                    border: '1.5px solid rgba(34,197,94,0.3)',
                    display: 'inline-flex', alignItems: 'center', gap: 3
                  }}>
                    🛵 {(state.deliveryBoys || []).find(b => b.id === order.deliveryBoyId)?.name || 'Rider'}
                  </span>
                )}
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={order.deliveryBoyId || ''}
                    onChange={(e) => {
                      const boyId = e.target.value;
                      if (!boyId) return;

                      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
                      const targetRestId = order.restaurantId || state.admin?.restaurantId || 'admin-1';
                      dispatch({
                        type: 'ASSIGN_DELIVERY_BOY',
                        payload: {
                          orderId: order.id,
                          restaurantId: targetRestId,
                          deliveryBoyId: boyId,
                          deliveryOtp: otpCode
                        }
                      });
                    }}
                    style={{
                      background: 'rgba(157, 78, 221, 0.15)',
                      color: '#C084FC',
                      border: '1.5px solid rgba(157, 78, 221, 0.4)',
                      padding: '2.5px 18px 2.5px 6px',
                      borderRadius: 4,
                      fontSize: 9.5,
                      fontWeight: 800,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      letterSpacing: '0.02em',
                      boxShadow: '0 0 8px rgba(157, 78, 221, 0.2)'
                    }}
                  >
                    <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {order.deliveryBoyId ? 'Reassign' : '🚴 Select Rider'}
                    </option>
                    {(state.deliveryBoys || []).filter(b => b.restaurantId === (order.restaurantId || state.admin?.restaurantId || 'admin-1')).map(boy => (
                      <option key={boy.id} value={boy.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {boy.name} ({boy.status || 'idle'})
                      </option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 7, color: '#C084FC' }}>▼</span>
                </div>
              </div>
            ) : (
              order.orderType && (
                <span style={order.orderType === 'take-away' ? {
                  fontSize: 9.5, fontWeight: 800,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1.5px solid #ef4444',
                  padding: '2px 6px', borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.2)'
                } : {
                  fontSize: 9.5, fontWeight: 700,
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  padding: '2px 6px', borderRadius: 4,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  {order.orderType === 'in-dining' ? '🪑 In-Dining' : '🛍️ Take-Away'}
                </span>
              )
            )}
            <span style={{ 
              fontSize: 9.5, 
              fontWeight: 800, 
              background: timeBg, 
              color: timeColor, 
              padding: '2px 6px', 
              borderRadius: 4,
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1,
              animation: timeBlink,
            }}>
              {timeTextStr}
            </span>
          </div>

          {order.orderType === 'delivery' && (
            !showDetails ? (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 140 }}>
                  📍 {order.deliveryAddress || 'No address provided'}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowDetails(true); }}
                  style={{ fontSize: 9.5, fontWeight: 800, color: '#C084FC', background: 'rgba(157,78,221,0.1)', border: '1px solid rgba(157,78,221,0.2)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                >
                  Manage ▾
                </button>
              </div>
            ) : (
              <div style={{ animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {/* Expand Toggle Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, borderBottom: '1px dashed var(--border)', paddingBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#C084FC', letterSpacing: '0.04em' }}>DELIVERY DETAILS</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDetails(false); }}
                    style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Collapse ▴
                  </button>
                </div>

                {/* Full Address Block */}
                {order.deliveryAddress && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', width: '100%', background: 'rgba(157,78,221,0.08)', border: '1px solid rgba(157,78,221,0.3)', padding: '8px 10px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>{order.deliveryAddress}</span>
                    {order.customerPhone && (
                      <a href={`tel:${order.customerPhone}`} style={{ fontSize: 10.5, color: '#22C55E', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        📞 {order.customerPhone}
                      </a>
                    )}
                  </div>
                )}

                {/* Assign Rider Select Dropdown */}
                {order.status !== 'served' && order.status !== 'cancelled' && (
                  <div style={{ marginTop: 2, position: 'relative', width: '100%' }}>
                    <label style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
                      🚴 Assign Rider:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={order.deliveryBoyId || ''}
                        onChange={(e) => {
                          const boyId = e.target.value;
                          if (!boyId) return;

                          const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
                          const targetRestId = order.restaurantId || state.admin?.restaurantId || 'admin-1';
                          dispatch({
                            type: 'ASSIGN_DELIVERY_BOY',
                            payload: {
                              orderId: order.id,
                              restaurantId: targetRestId,
                              deliveryBoyId: boyId,
                              deliveryOtp: otpCode
                            }
                          });
                        }}
                        style={{
                          width: '100%',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          outline: 'none',
                          cursor: 'pointer',
                          appearance: 'none',
                          WebkitAppearance: 'none'
                        }}
                      >
                        <option value="">-- Select Rider --</option>
                        {(state.deliveryBoys || []).filter(b => b.restaurantId === (order.restaurantId || state.admin?.restaurantId || 'admin-1')).map(boy => (
                          <option key={boy.id} value={boy.id}>
                            {boy.name} ({boy.status || 'idle'})
                          </option>
                        ))}
                      </select>
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 9, color: 'var(--text-secondary)' }}>▼</span>
                    </div>
                    {order.deliveryBoyId && (
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10,
                          background: 'rgba(157,78,221,0.15)', color: '#C084FC',
                          border: '1px solid rgba(157,78,221,0.2)'
                        }}>
                          🛵 {(state.deliveryBoys || []).find(b => b.id === order.deliveryBoyId)?.name || 'Rider'}
                        </span>
                        {order.deliveryOtp && (
                          <span style={{
                            fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 10,
                            background: 'rgba(34,197,94,0.15)', color: '#4ADE80',
                            border: '1px solid rgba(34,197,94,0.2)'
                          }}>
                            🔑 OTP: {order.deliveryOtp}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 99,
          background: cfg.bgColor, color: cfg.color,
          fontSize: 10, fontWeight: 700,
          flexShrink: 0,
        }}>
          <Icon size={10} />
          {cfg.label}
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 8, borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
        {order.items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: 'var(--text-secondary)', padding: '1px 0',
          }}>
            <span>{item.qty}x {item.name}{item.variant ? ` (${item.variant.name})` : ''}</span>
            {item.addons && item.addons.length > 0 && (
              <div style={{ paddingLeft: 12, fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                {item.addons.map((a, ai) => <span key={ai} style={{ marginRight: 6 }}>+ {a.optionName}{a.price > 0 ? ` (₹${a.price})` : ''}</span>)}
              </div>
            )}
            <span>{currency}{item.price * item.qty}</span>
          </div>
        ))}
        {order.specialNote && (
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            💬 {order.specialNote}
          </div>
        )}
      </div>

      {/* Payment details or live action requests */}
      {(order.status === 'bill_pay' || order.paymentStatus === 'waiting_confirmation') && (
        <div style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {order.paymentStatus === 'waiting_confirmation' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'var(--brand)', marginBottom: 6 }}>
                {order.paymentMethod === 'upi' ? <QrCode size={13} /> : order.paymentMethod === 'cash' ? <Coins size={13} /> : <CreditCard size={13} />}
                {order.paymentMethod === 'upi' ? 'UPI Payment Received' : order.paymentMethod === 'cash' ? 'Requested Cash Bill' : 'Requested Card Bill'}
              </div>
              {order.upiTxnId && (
                <div style={{ fontSize: 10, fontFamily: 'monospace', background: 'var(--bg-primary)', padding: '4px 6px', borderRadius: 4, marginBottom: 6, border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  UTR Ref: {order.upiTxnId}
                </div>
              )}
              {order.paymentMethod === 'upi' && (
                <button
                  className="btn btn-full"
                  style={{
                    background: 'var(--success)',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(34,197,94,0.3)'
                  }}
                  onClick={() => onConfirmUpi(order.id)}
                >
                  Confirm {currency}{order.totalAmount} received from UPI
                </button>
              )}
              {order.paymentMethod === 'cash' && (
                <button
                  className="btn btn-full"
                  style={{
                    background: 'var(--brand)',
                    color: '#000',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => onConfirmCash(order.id)}
                >
                  Confirm Cash {currency}{order.totalAmount} collected
                </button>
              )}
              {order.paymentMethod === 'card' && (
                <button
                  className="btn btn-full"
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => onConfirmCard(order.id)}
                >
                  Confirm Card {currency}{order.totalAmount} paid
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Collect Payment:</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  onClick={() => onConfirmCash(order.id)} 
                  style={{ flex: 1, padding: '4px 6px', fontSize: 10, background: 'var(--border)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                >
                  Cash
                </button>
                <button 
                  onClick={() => onConfirmCard(order.id)} 
                  style={{ flex: 1, padding: '4px 6px', fontSize: 10, background: 'var(--border)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                >
                  Card
                </button>
                <button 
                  onClick={() => onConfirmUpi(order.id)} 
                  style={{ flex: 1, padding: '4px 6px', fontSize: 10, background: 'var(--border)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                >
                  UPI
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer / Standard Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
          {currency}{order.totalAmount}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {nextStatus && order.status !== 'bill_pay' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStatusChange(order.id, nextStatus)}
              style={{ fontSize: 10, padding: '4px 8px' }}
            >
              Next
            </button>
          )}
          {order.orderType === 'delivery' && order.status === 'bill_pay' && (
            <button
              className="btn btn-sm"
              onClick={() => onStatusChange(order.id, 'served')}
              style={{ fontSize: 10, padding: '4px 8px', background: '#22C55E', color: '#fff', border: '1px solid #16A34A', fontWeight: 800 }}
            >
              Mark Delivered
            </button>
          )}
          {order.status !== 'cancelled' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onStatusChange(order.id, 'cancelled')}
              style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Manual print buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={(e) => { e.stopPropagation(); printThermalReceipt(order, 'kot', state.restaurant); }}
          className="btn btn-secondary btn-sm"
          style={{ flex: 1, fontSize: 9.5, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 26 }}
        >
          <Printer size={11} /> Print KOT
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); printThermalReceipt(order, 'bill', state.restaurant); }}
          className="btn btn-secondary btn-sm"
          style={{ flex: 1, fontSize: 9.5, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 26 }}
        >
          <Printer size={11} /> Print Bill
        </button>
      </div>
    </div>
  );
}

function TabularOrderRow({
  order,
  onStatusChange,
  onConfirmUpi,
  onConfirmCash,
  onConfirmCard,
  currency
}: {
  order: Order;
  onStatusChange: (id: string, s: OrderStatus) => void;
  onConfirmUpi: (id: string) => void;
  onConfirmCash: (id: string) => void;
  onConfirmCard: (id: string) => void;
  currency: string;
}) {
  const { state, dispatch } = useStore();
  const customer = state.customers.find(c => c.phone === order.customerPhone);
  const isVip = order.isVipCustomer || (customer ? !!customer.isVip : false);

  const cfg = STATUS_CONFIG[order.status];
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const nextStatus = currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = now - order.createdAt;
  const elapsedMins = elapsedMs / (1000 * 60);

  let timeBg = '#22c55e'; // green
  let timeColor = '#ffffff';
  if (elapsedMins > 30) {
    timeBg = '#ef4444'; // red
    timeColor = '#ffffff';
  } else if (elapsedMins > 15) {
    timeBg = '#eab308'; // yellow
    timeColor = '#000000';
  }

  const minVal = Math.floor(elapsedMins);
  const timeTextStr = `${minVal}m`;

  let timeBlink: string | undefined;
  if (elapsedMins > 30) {
    timeBlink = 'blink-red 1s step-end infinite';
  } else if (elapsedMins > 15) {
    timeBlink = 'blink-yellow 3s ease-in-out infinite';
  }

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: `2.5px solid ${cfg.color}`,
      borderRadius: 10,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontSize: 12,
      animation: 'fadeIn 0.25s ease'
    }}>
      {/* Top row: Table, Timing, Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '2px 8px',
            borderRadius: 6,
            color: 'var(--text-primary)'
          }}>
            T{order.tableNumber}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            #{order.id.slice(-4).toUpperCase()}
          </span>
          <span style={{
            fontSize: 9.5,
            fontWeight: 800,
            background: timeBg,
            color: timeColor,
            padding: '2px 6px',
            borderRadius: 4,
            animation: timeBlink
          }}>
            ⏱️ {timeTextStr}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 99,
            background: cfg.bgColor,
            color: cfg.color,
            fontSize: 9.5,
            fontWeight: 700
          }}>
            <cfg.icon size={9} />
            {cfg.label}
          </div>

          {/* Cancel Button */}
          {order.status !== 'served' && order.status !== 'cancelled' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to cancel this order?')) {
                  onStatusChange(order.id, 'cancelled');
                }
              }}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: 9,
                padding: '2px 8px',
                height: 20,
                borderRadius: 4,
                color: 'var(--error)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.05)',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Middle row: Customer Info & Meals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {order.customerName || 'Guest'}
          </span>
          {isVip && (
            <span style={{ color: '#ffd700', fontWeight: 800, fontSize: 10, background: 'rgba(255,215,0,0.1)', padding: '1px 4px', borderRadius: 3 }}>
              👑 VIP
            </span>
          )}
          {order.numberOfGuests && (
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              ({order.numberOfGuests} guests)
            </span>
          )}
        </div>
        
        {/* Items Summary */}
        <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, lineHeight: 1.4 }}>
          {order.items.map(item => `${item.qty}x ${item.name}${item.variant ? ` (${item.variant.name})` : ''}${item.addons && item.addons.length > 0 ? ` [${item.addons.map(a => a.optionName).join(', ')}]` : ''}`).join(', ')}
        </div>

        {order.specialNote && (
          <div style={{ color: 'var(--error)', fontSize: 10.5, fontStyle: 'italic', marginTop: 2 }}>
            💬 Note: "{order.specialNote}"
          </div>
        )}
      </div>

      {/* Status Dropdown — replaces horizontal touch-bar to avoid accidental scroll triggers */}
      {(() => {
        const STATUS_OPTIONS = [
          { key: 'pending',   label: '🟡 New',         color: STATUS_CONFIG.pending.color, textColor: '#000000' },
          { key: 'preparing', label: '🟠 Preparing',   color: STATUS_CONFIG.preparing.color, textColor: '#ffffff' },
          { key: 'ready',     label: '🔥 Ready',       color: STATUS_CONFIG.ready.color, textColor: '#ffffff' },
          { key: 'bill_pay',  label: '💳 Bill & Pay',  color: STATUS_CONFIG.bill_pay.color, textColor: '#ffffff' },
        ] as const;
        const current = STATUS_OPTIONS.find(s => s.key === order.status) || STATUS_OPTIONS[0];
        return (
          <div style={{ position: 'relative', marginTop: 6, marginBottom: 4 }}>
            <select
              value={order.status}
              onChange={(e) => {
                e.stopPropagation();
                const next = e.target.value as OrderStatus;
                if (next !== order.status) onStatusChange(order.id, next);
              }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                appearance: 'none',
                WebkitAppearance: 'none',
                background: current.color,
                color: current.textColor,
                border: 'none',
                borderRadius: 8,
                padding: '7px 32px 7px 12px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                letterSpacing: '0.02em',
              }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            {/* Custom chevron arrow */}
            <span style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', fontSize: 11, color: current.textColor, opacity: 0.85,
            }}>▼</span>
          </div>
        );
      })()}

      {order.orderType === 'delivery' && order.status !== 'served' && order.status !== 'cancelled' && (
        <div style={{ marginTop: 8, position: 'relative', width: '100%' }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            🚴 Assign Delivery Rider:
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={order.deliveryBoyId || ''}
              onChange={(e) => {
                const boyId = e.target.value;
                if (!boyId) return;

                // Generate a random 4-digit OTP for the customer to confirm
                const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
                
                dispatch({
                  type: 'ASSIGN_DELIVERY_BOY',
                  payload: {
                    orderId: order.id,
                    restaurantId: order.restaurantId || '',
                    deliveryBoyId: boyId,
                    deliveryOtp: otpCode
                  }
                });
              }}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
            >
              <option value="">-- Select Rider --</option>
              {(state.deliveryBoys || []).filter(b => b.restaurantId === order.restaurantId).map(boy => (
                <option key={boy.id} value={boy.id}>
                  {boy.name} ({boy.status || 'idle'})
                </option>
              ))}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: 'var(--text-secondary)' }}>▼</span>
          </div>
          {order.deliveryBoyId && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                background: 'rgba(157,78,221,0.15)', color: '#C084FC',
                border: '1px solid rgba(157,78,221,0.3)',
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}>
                🛵 {(state.deliveryBoys || []).find(b => b.id === order.deliveryBoyId)?.name || 'Rider'}
                {' · '}{(state.deliveryBoys || []).find(b => b.id === order.deliveryBoyId)?.status || 'idle'}
              </span>
              {order.deliveryOtp && (
                <span style={{
                  fontSize: 10, fontWeight: 900, padding: '3px 9px', borderRadius: 20,
                  background: 'rgba(34,197,94,0.1)', color: '#22C55E',
                  border: '1px solid rgba(34,197,94,0.25)',
                  letterSpacing: '0.12em'
                }}>
                  OTP: {order.deliveryOtp}
                </span>
              )}
            </div>
          )}
        </div>
      )}


      {/* Bottom row: Total Amount & Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px dashed var(--border)',
        paddingTop: 8,
        marginTop: 2,
        gap: 12
      }}>
        {/* Total Price */}
        <div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total:</span>{' '}
          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--brand)' }}>
            {currency}{order.totalAmount}
          </span>
        </div>

        {/* Actions Section */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(order.status === 'bill_pay' || order.paymentStatus === 'waiting_confirmation') ? (
            order.paymentStatus === 'waiting_confirmation' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                {order.paymentMethod === 'upi' && (
                  <button
                    onClick={() => onConfirmUpi(order.id)}
                    className="btn btn-sm"
                    style={{ background: 'var(--success)', color: '#fff', fontSize: 11, padding: '4px 10px', height: 28, borderRadius: 6 }}
                  >
                    Confirm UPI
                  </button>
                )}
                {order.paymentMethod === 'cash' && (
                  <button
                    onClick={() => onConfirmCash(order.id)}
                    className="btn btn-sm"
                    style={{ background: 'var(--success)', color: '#fff', fontSize: 11, padding: '4px 10px', height: 28, borderRadius: 6 }}
                  >
                    Confirm Cash
                  </button>
                )}
                {order.paymentMethod === 'card' && (
                  <button
                    onClick={() => onConfirmCard(order.id)}
                    className="btn btn-sm"
                    style={{ background: 'var(--success)', color: '#fff', fontSize: 11, padding: '4px 10px', height: 28, borderRadius: 6 }}
                  >
                    Confirm Card
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => onConfirmCash(order.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 10, padding: '2px 8px', height: 26, borderRadius: 6 }}
                >
                  💵 Cash Paid
                </button>
                <button
                  onClick={() => onConfirmCard(order.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 10, padding: '2px 8px', height: 26, borderRadius: 6 }}
                >
                  💳 Card Paid
                </button>
              </div>
            )
          ) : (
            nextStatus && (
              <button
                onClick={() => onStatusChange(order.id, nextStatus)}
                className="btn btn-primary btn-sm"
                style={{
                  fontSize: 11,
                  padding: '4px 12px',
                  height: 28,
                  borderRadius: 6,
                  color: '#000',
                  fontWeight: 700
                }}
              >
                {order.status === 'pending' ? '🍳 Accept Order' : order.status === 'preparing' ? '🛵 Mark Ready' : 'Served'}
              </button>
            )
          )}
          

          {/* Print Buttons */}
          <button
            onClick={() => printThermalReceipt(order, 'kot', state.restaurant)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, padding: '4px 8px', height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Printer size={12} /> KOT
          </button>
          <button
            onClick={() => printThermalReceipt(order, 'bill', state.restaurant)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, padding: '4px 8px', height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Printer size={12} /> Bill
          </button>
        </div>
      </div>
    </div>
  );
}
