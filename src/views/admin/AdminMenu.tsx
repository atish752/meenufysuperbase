import { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import type { MenuItem, MealSchedule, NutritionInfo } from '../../context/RealtimeStore';
import { Plus, Pencil, Trash2, Search, Tag, X, Sparkles, Camera, UploadCloud, Loader2, Check, CalendarClock, FlaskConical, Palette } from 'lucide-react';
import { hasFirebaseConfig, storage } from '../../utils/firebase';

function CategoryRow({ cat, onUpdate, onDelete, isDeleting }: { 
  cat: any; 
  onUpdate: (cat: any) => void; 
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [icon, setIcon] = useState(cat.icon);
  const [name, setName] = useState(cat.name);

  useEffect(() => {
    setIcon(cat.icon);
    setName(cat.name);
  }, [cat.icon, cat.name]);

  const hasChanges = icon !== cat.icon || name !== cat.name;

  const handleSave = () => {
    if (!name.trim()) return;
    onUpdate({ ...cat, icon, name });
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        className="input"
        type="text"
        value={icon}
        onChange={e => setIcon(e.target.value)}
        style={{ width: 44, textAlign: 'center', fontSize: 16, padding: '6px 0' }}
        placeholder="🍽️"
      />
      <input
        className="input"
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ flex: 1, padding: '6px 12px' }}
        placeholder="Category name"
      />
      {hasChanges && (
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleSave}
          style={{ color: 'var(--brand)', padding: 6, flexShrink: 0 }}
          title="Save changes"
        >
          <Check size={16} />
        </button>
      )}
      <button
        className={`btn ${isDeleting ? 'btn-danger' : 'btn-ghost'} btn-icon`}
        onClick={() => onDelete(cat.id)}
        style={{ color: isDeleting ? '#fff' : 'var(--error)', padding: 6, flexShrink: 0, fontSize: isDeleting ? 10 : 14, minWidth: isDeleting ? 70 : 'auto' }}
        title={isDeleting ? "Click again to confirm" : "Delete"}
      >
        {isDeleting ? 'Confirm?' : <Trash2 size={15} />}
      </button>
    </div>
  );
}

const EMPTY_ITEM: Omit<MenuItem, 'id'> = {
  name: '', description: '', price: 0, category: '',
  image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [],
};

export default function AdminMenu() {
  const { state, dispatch, addToast } = useStore();
  const adminId = state.admin?.id || 'admin-1';
  const adminMenuItems = state.menuItems.filter(item => (item.restaurantId || 'admin-1') === adminId);
  const adminCategories = state.categories.filter(c => (c.restaurantId || 'admin-1') === adminId);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState<Omit<MenuItem, 'id'>>(EMPTY_ITEM);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showOthersMenu, setShowOthersMenu] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '🍽️' });

  // AI Meals Extractor States
  const [showExtractorModal, setShowExtractorModal] = useState(false);
  const [extractorStep, setExtractorStep] = useState<'upload' | 'processing' | 'confirm'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [extractedItems, setExtractedItems] = useState<Array<{
    name: string;
    category: string;
    price: number;
    description: string;
    isVeg: boolean;
    tags: string[];
    variants?: Array<{ name: string; price: number }>;
  }>>([]);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<Array<{ name: string; price: number }>>([]);

  // Schedule Meals States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<Omit<MealSchedule, 'id'>>({ name: '', fromTime: '08:00', toTime: '11:00', targets: [] });
  const [editingSchedule, setEditingSchedule] = useState<MealSchedule | null>(null);

  // Nutrition States (per-item edit)
  const [hasNutrition, setHasNutrition] = useState(false);
  const [nutrition, setNutrition] = useState<Omit<NutritionInfo, 'enabled'>>({ calories: undefined, carbs: undefined, sugar: undefined, protein: undefined, fats: undefined, custom: [] });

  // AI Description state
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Support request states
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportAttemptsCount, setSupportAttemptsCount] = useState(0);

  const handleSubmitSupport = () => {
    if (!supportMessage.trim()) { addToast('error', 'Please describe the problem.'); return; }
    dispatch({
      type: 'SUBMIT_SUPPORT_REQUEST',
      payload: {
        message: supportMessage.trim(),
        attemptsCount: supportAttemptsCount || 5
      }
    });
    addToast('success', 'Support request sent to developer! 🚀');
    setSupportMessage('');
    setShowSupportModal(false);
  };

  // Customer Menu Theme States
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themeForm, setThemeForm] = useState({
    primaryBg: '',
    itemName: '',
    itemDesc: '',
    addToCartBg: '',
    addToCartText: '',
    bestsellerBg: '',
    bestsellerText: '',
  });

  const openThemeModal = () => {
    setThemeForm({
      primaryBg: state.customerMenuTheme?.primaryBg || '',
      itemName: state.customerMenuTheme?.itemName || '',
      itemDesc: state.customerMenuTheme?.itemDesc || '',
      addToCartBg: state.customerMenuTheme?.addToCartBg || '',
      addToCartText: state.customerMenuTheme?.addToCartText || '',
      bestsellerBg: state.customerMenuTheme?.bestsellerBg || '',
      bestsellerText: state.customerMenuTheme?.bestsellerText || '',
    });
    setShowThemeModal(true);
  };

  const handleSaveThemeColors = () => {
    dispatch({
      type: 'UPDATE_CUSTOMER_THEME_COLORS',
      payload: themeForm
    });
    addToast('success', 'Customer menu theme colors updated! 🎨');
    setShowThemeModal(false);
  };

  const handleResetThemeColors = () => {
    if (window.confirm('Reset all custom colors to system defaults?')) {
      const cleared = {
        primaryBg: '',
        itemName: '',
        itemDesc: '',
        addToCartBg: '',
        addToCartText: '',
        bestsellerBg: '',
        bestsellerText: '',
      };
      setThemeForm(cleared);
      dispatch({
        type: 'UPDATE_CUSTOMER_THEME_COLORS',
        payload: cleared
      });
      addToast('info', 'Customer menu theme reset to system defaults.');
      setShowThemeModal(false);
    }
  };

  const executeGeminiCall = async <T,>(
    apiCallFn: (key: string, model: string) => Promise<T>,
    onErrorText: string
  ): Promise<T> => {
    // Prioritize valid user keys by filtering out placeholder/fake keys if valid keys are present
    const validUserKeys = state.geminiApiKeys && state.geminiApiKeys.length > 0
      ? state.geminiApiKeys.filter(k => !k.includes('FakeGeminiKey'))
      : [];

    const finalKeys = validUserKeys.length > 0 
      ? validUserKeys 
      : (state.geminiApiKeys && state.geminiApiKeys.length > 0 ? state.geminiApiKeys : ['DEMO_KEY_PLACEHOLDER']);

    // Try models in order: newest → stable fallback
    const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let attempts = 0;
    const maxRetriesPerKey = 2;
    const shuffledKeys = [...finalKeys].sort(() => Math.random() - 0.5);

    for (const currentKey of shuffledKeys) {
      for (const modelName of modelsToTry) {
        for (let retry = 0; retry < maxRetriesPerKey; retry++) {
          attempts++;
          try {
            const result = await apiCallFn(currentKey, modelName);
            return result;
          } catch (err: any) {
            console.warn(`Attempt ${attempts} [key:...${currentKey.slice(-6)}, model:${modelName}, retry:${retry}]: ${err.message}`);
            
            const errMsg = err.message || '';
            // Permanent errors mean this key/model combo is dead — skip immediately
            const isPermanentError = 
              errMsg.includes('404') ||
              errMsg.includes('403') ||
              errMsg.toLowerCase().includes('not valid') ||
              errMsg.toLowerCase().includes('invalid') ||
              errMsg.toLowerCase().includes('key not') ||
              errMsg.toLowerCase().includes('disabled') ||
              errMsg.toLowerCase().includes('not found');

            if (isPermanentError) break; // try next model
            if (retry < maxRetriesPerKey - 1) {
              await new Promise(r => setTimeout(r, 400));
            }
          }
        }
      }
    }
    setSupportAttemptsCount(attempts);
    throw new Error(`${onErrorText}. Attempted ${attempts} times across ${shuffledKeys.length} API key(s) and ${modelsToTry.length} model(s). Please check your API keys in Super Admin.`);
  };

  const openExtractor = () => {
    const validUserKeys = state.geminiApiKeys && state.geminiApiKeys.length > 0
      ? state.geminiApiKeys.filter(k => !k.includes('FakeGeminiKey'))
      : [];
    if (validUserKeys.length === 0) {
      addToast('warning', '⚠️ Demo mode: No real Gemini API Key configured in Super Admin. Please add a valid key first.');
    }
    setExtractorStep('upload');
    setShowExtractorModal(true);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.substring(result.indexOf(',') + 1);
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processMenuFile(files[0]);
    }
  };

  const processMenuFile = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (!isImage && !isPdf) {
      addToast('error', 'Please upload a PDF or an Image file.');
      return;
    }

    setExtractorStep('processing');
    setProcessingMessage('Reading file content...');

    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

      setProcessingMessage('Analyzing menu with Gemini AI (Self-healing Rotation)...');

      const promptText = `Analyze this restaurant menu and extract all food and beverage items (meals) with high accuracy.
CRITICAL: Do NOT repeat the same meal with different variations as separate root items (e.g., do not extract "Small Pizza", "Medium Pizza", "Large Pizza" as separate items). Instead, group them into a single meal item with a "variants" array.

For each item, extract:
- name (string, name of the dish, e.g. "Margarita Pizza")
- price (number, numeric value of the price. If the item has variants, set this to the lowest variant price. Clean all currency symbols like ₹, $, etc.)
- description (string, ingredients or description of the dish, leave empty if none)
- category (string, the section of the menu e.g. Starters, Main Course, Breads, Desserts, Beverages)
- isVeg (boolean, true if vegetarian, false if non-vegetarian/contains meat/fish/egg)
- tags (array of strings, e.g. "popular", "spicy", "chef's special", "sweet")
- variants (array of objects, each containing:
  - name (string, e.g. "Small", "Medium", "Large", "Half", "Full", "4 Pieces", "8 Pieces")
  - price (number, numeric price value)
  If the item does not have variants in the menu, set "variants" to an empty array or omit it.)

Format the response as a JSON object with a single key "meals" containing the array of these items.
Ensure the response contains ONLY the raw JSON object, without any markdown formatting backticks (like \`\`\`json).`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
        // Note: responseMimeType removed — not supported on all model versions
        // JSON is enforced via the prompt instructions instead
      };

      // Execute with key + model rotation (v1beta is the correct endpoint for all current models)
      const data = await executeGeminiCall(async (key, model) => {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errObj = await response.json().catch(() => ({}));
          throw new Error(errObj?.error?.message || `HTTP error! Status: ${response.status}`);
        }

        return response.json();
      }, 'Menu extraction failed');

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        throw new Error('Gemini API returned an empty response. Make sure the menu image/PDF contains readable text.');
      }

      let cleanJson = responseText.trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
      if (!parsed.meals || !Array.isArray(parsed.meals)) {
        throw new Error('Could not parse menu structure. Please try again with a clearer photo.');
      }

      setExtractedItems(parsed.meals);

      const uniqueCats: string[] = Array.from(
        new Set(parsed.meals.map((item: any) => item.category || 'Other'))
      );

      const mapping: Record<string, string> = {};
      uniqueCats.forEach(cat => {
        const match = state.categories.find(
          c => c.name.toLowerCase() === cat.toLowerCase()
        );
        if (match) {
          mapping[cat] = match.id;
        } else {
          mapping[cat] = 'create';
        }
      });

      setCategoryMapping(mapping);
      setExtractorStep('confirm');
      addToast('success', `Extracted ${parsed.meals.length} items successfully!`);
    } catch (err: any) {
      console.error(err);
      addToast('error', err.message || 'Error occurred while extracting meals.');
      setShowSupportModal(true);
      setExtractorStep('upload');
    }
  };

  const handleConfirmExtraction = () => {
    if (extractedItems.length === 0) {
      addToast('warning', 'No items to add.');
      return;
    }

    const finalMapping = { ...categoryMapping };
    const createdCatIds: Record<string, string> = {};

    Object.keys(categoryMapping).forEach((extCat, index) => {
      if (categoryMapping[extCat] === 'create') {
        const newCatId = `cat-${Date.now()}-${index}`;
        const emojis = ['🥗', '🍲', '🍹', '🍕', '🍰', '🍣', '🍔', '🍛', '🔥', '🍽️'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        dispatch({
          type: 'ADD_CATEGORY',
          payload: {
            id: newCatId,
            name: extCat,
            icon: randomEmoji
          }
        });
        
        createdCatIds[extCat] = newCatId;
        finalMapping[extCat] = newCatId;
      }
    });

    extractedItems.forEach((item, index) => {
      const catId = finalMapping[item.category] || createdCatIds[item.category] || state.categories[0]?.id || 'cat-1';
      
      dispatch({
        type: 'ADD_MENU_ITEM',
        payload: {
          id: `item-${Date.now()}-${index}`,
          name: item.name,
          description: item.description || '',
          price: item.price || 0,
          category: catId,
          image: '',
          isVeg: item.isVeg,
          isAvailable: true,
          isFeatured: false,
          tags: item.tags || [],
          variants: item.variants || []
        }
      });
    });

    addToast('success', `Added ${extractedItems.length} items to your menu!`);
    setShowExtractorModal(false);
  };

  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const handleDeleteCategoryClick = (catId: string) => {
    if (deletingCatId === catId) {
      dispatch({ type: 'DELETE_CATEGORY', payload: catId });
      addToast('success', 'Category deleted successfully!');
      if (selectedCategory === catId) {
        setSelectedCategory('all');
      }
      setDeletingCatId(null);
    } else {
      setDeletingCatId(catId);
      setTimeout(() => {
        setDeletingCatId(prev => prev === catId ? null : prev);
      }, 3000);
    }
  };

  const filteredItems = adminMenuItems.filter(item => {
    const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSaveItem = () => {
    if (!newItem.name) {
      addToast('error', 'Please fill name.');
      return;
    }

    let finalItemPayload: any;

    if (hasVariants) {
      if (variants.length === 0) {
        addToast('error', 'Please add at least one variant.');
        return;
      }
      if (variants.some(v => !v.name.trim())) {
        addToast('error', 'Variant names cannot be empty.');
        return;
      }
      const basePrice = Math.min(...variants.map(v => v.price));
      finalItemPayload = {
        ...newItem,
        price: basePrice,
        variants: variants.map(v => ({ name: v.name.trim(), price: v.price }))
      };
    } else {
      if (!newItem.price) {
        addToast('error', 'Please enter a price.');
        return;
      }
      finalItemPayload = {
        ...newItem,
        variants: undefined
      };
    }

    if (editingItem) {
      dispatch({ type: 'UPDATE_MENU_ITEM', payload: { ...finalItemPayload, id: editingItem.id, nutrition: hasNutrition ? { ...nutrition, enabled: true } : undefined } });
      addToast('success', 'Item updated!');
    } else {
      dispatch({ type: 'ADD_MENU_ITEM', payload: { ...finalItemPayload, id: `item-${Date.now()}`, nutrition: hasNutrition ? { ...nutrition, enabled: true } : undefined } });
      addToast('success', 'Item added!');
    }
    setShowItemModal(false);
    setEditingItem(null);
    setNewItem(EMPTY_ITEM);
    setVariants([]);
    setHasVariants(false);
    setHasNutrition(false);
    setNutrition({ calories: undefined, carbs: undefined, sugar: undefined, protein: undefined, fats: undefined, custom: [] });
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setNewItem({ ...item });
    setHasVariants(!!(item.variants && item.variants.length > 0));
    setVariants(item.variants || []);
    setHasNutrition(!!(item.nutrition?.enabled));
    setNutrition(item.nutrition ? { ...item.nutrition } : { calories: undefined, carbs: undefined, sugar: undefined, protein: undefined, fats: undefined, custom: [] });
    setShowItemModal(true);
  };

  const handleDeleteItem = (id: string) => {
    dispatch({ type: 'DELETE_MENU_ITEM', payload: id });
    addToast('info', 'Item removed from menu.');
  };

  const handleToggleAvailable = (item: MenuItem) => {
    dispatch({ type: 'UPDATE_MENU_ITEM', payload: { ...item, isAvailable: !item.isAvailable } });
  };

  const handleAddCategory = () => {
    if (!newCat.name) { addToast('error', 'Enter a category name.'); return; }
    dispatch({ type: 'ADD_CATEGORY', payload: { id: `cat-${Date.now()}`, name: newCat.name, icon: newCat.icon } });
    addToast('success', 'Category added!');
    setShowCatModal(false);
    setNewCat({ name: '', icon: '🍽️' });
  };

  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please upload an image file.');
      return;
    }

    setUploadingImage(true);
    try {
      if (hasFirebaseConfig && storage) {
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const storageRef = ref(storage, `menu_photos/${adminId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        setNewItem(prev => ({ ...prev, image: downloadUrl }));
        addToast('success', 'Image uploaded to cloud storage successfully! 📸');
      } else {
        const base64 = await fileToBase64(file);
        setNewItem(prev => ({ ...prev, image: base64 }));
        addToast('success', 'Image processed successfully (Local Dev)! 📸');
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', `❌ Image upload failed: ${err.message || err}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // ── AI Description Generator ──────────────────────────────────────────────
  const handleAiDesc = async () => {
    if (!newItem.name.trim()) { addToast('error', 'Enter a meal name first.'); return; }
    
    const validUserKeys = state.geminiApiKeys && state.geminiApiKeys.length > 0
      ? state.geminiApiKeys.filter(k => !k.includes('FakeGeminiKey'))
      : [];
    if (validUserKeys.length === 0) {
      addToast('error', '❌ AI features require a valid Gemini API Key. Super Admin must configure a key first.');
      return;
    }

    setAiDescLoading(true);
    try {
      const prompt = `Write a short, enticing 1-2 sentence menu description for a dish called "${newItem.name}". Be concise, mouth-watering and factual. No quotes, no labels, just the description text.`;
      
      const text = await executeGeminiCall(async (key, model) => {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!res.ok) {
          const errObj = await res.json().catch(() => ({}));
          throw new Error(errObj?.error?.message || `HTTP error! Status: ${res.status}`);
        }
        const data = await res.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!responseText) throw new Error('Empty response from model');
        return responseText;
      }, 'AI description failed');

      setNewItem(prev => ({ ...prev, description: text }));
      addToast('success', '✨ Description generated!');
    } catch (e: any) {
      addToast('error', `AI description failed: ${e.message}`);
      setShowSupportModal(true);
    } finally {
      setAiDescLoading(false);
    }
  };

  // ── Schedule Helpers ──────────────────────────────────────────────────────
  const handleSaveSchedule = () => {
    if (!scheduleForm.name.trim()) { addToast('error', 'Enter a schedule name.'); return; }
    if (!scheduleForm.fromTime || !scheduleForm.toTime) { addToast('error', 'Set the time range.'); return; }
    if (editingSchedule) {
      dispatch({ type: 'UPDATE_SCHEDULE', payload: { ...scheduleForm, id: editingSchedule.id } });
      addToast('success', 'Schedule updated!');
    } else {
      dispatch({ type: 'ADD_SCHEDULE', payload: { ...scheduleForm, id: `sch-${Date.now()}` } });
      addToast('success', 'Schedule created!');
    }
    setEditingSchedule(null);
    setScheduleForm({ name: '', fromTime: '08:00', toTime: '11:00', targets: [] });
  };

  const toggleScheduleTarget = (type: 'category' | 'item', id: string) => {
    setScheduleForm(prev => {
      const exists = prev.targets.some(t => t.type === type && t.id === id);
      return {
        ...prev,
        targets: exists
          ? prev.targets.filter(t => !(t.type === type && t.id === id))
          : [...prev.targets, { type, id }],
      };
    });
  };

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Menu Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{adminMenuItems.length} items across {adminCategories.length} categories</p>
        </div>
      </div>

      {/* Row of Settings Buttons & Categories wrapped between two horizontal lines */}
      <div style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 14,
        paddingBottom: 14,
        marginBottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Settings Buttons Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}>
          {/* Must login before Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '6px 12px',
            fontSize: 12,
            height: 38,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Customer must login</span>
            <div 
              className={`toggle ${state.restaurant.mustLoginBeforeOrder ? 'on' : ''}`} 
              onClick={() => dispatch({
                type: 'UPDATE_RESTAURANT',
                payload: { mustLoginBeforeOrder: !state.restaurant.mustLoginBeforeOrder }
              })}
              style={{ cursor: 'pointer' }}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          {/* Wallet Balance Display - Clickable */}
          <button
            onClick={() => {
              localStorage.setItem('meenufy_admin_more_section', 'subscription');
              dispatch({ type: 'SET_ADMIN_TAB', payload: 'more' });
            }}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              height: 38,
              color: 'var(--brand)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            💳 Wallet: ₹{state.walletBalance}
          </button>

          {/* Menu Theme Color Button */}
          <button
            onClick={openThemeModal}
            className="btn btn-secondary"
            style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, fontSize: 12 }}
          >
            <Palette size={14} /> Menu Theme
          </button>

          {/* Schedule Menu Button */}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn btn-secondary"
            style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, fontSize: 12 }}
          >
            <CalendarClock size={14} /> Schedule Menu
          </button>

          {/* AI Menu Extractor Button */}
          <button
            onClick={openExtractor}
            className="btn btn-secondary"
            style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, fontSize: 12 }}
          >
            <Sparkles size={14} /> AI Menu Extractor
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={() => setShowCatModal(true)}
            className="btn btn-secondary"
            style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, fontSize: 12 }}
          >
            <Tag size={14} /> Manage Categories
          </button>

          {/* Others Button with Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowOthersMenu(v => !v)}
              className="btn btn-secondary"
              style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, fontSize: 12 }}
            >
              ⚙️ Others
            </button>
            {showOthersMenu && (
              <>
                {/* Backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setShowOthersMenu(false)}
                />
                {/* Dropdown Panel */}
                <div style={{
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  zIndex: 100,
                  background: 'var(--bg-glass)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow-xl)',
                  minWidth: 230,
                  overflow: 'hidden',
                  padding: '6px 0'
                }}>
                  <div style={{ padding: '8px 14px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Bulk Actions
                  </div>
                  {/* Unfeatured All */}
                  <button
                    onClick={() => {
                      if (window.confirm('Remove ALL meals from featured/bestseller? This cannot be undone.')) {
                        dispatch({ type: 'UNFEATURED_ALL_ITEMS' });
                        addToast('success', '✅ All meals removed from featured.');
                        setShowOthersMenu(false);
                      }
                    }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '9px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    ⭐ Remove All from Featured
                  </button>
                  {/* Mark All Available */}
                  <button
                    onClick={() => {
                      const restId = state.admin?.restaurantId || 'admin-1';
                      adminMenuItems.forEach(item => {
                        if (!item.isAvailable) dispatch({ type: 'UPDATE_MENU_ITEM', payload: { ...item, isAvailable: true } });
                      });
                      if (!restId) return;
                      addToast('success', '✅ All meals marked as available.');
                      setShowOthersMenu(false);
                    }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '9px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    ✅ Mark All as Available
                  </button>
                  {/* Mark All Unavailable */}
                  <button
                    onClick={() => {
                      adminMenuItems.forEach(item => {
                        if (item.isAvailable) dispatch({ type: 'UPDATE_MENU_ITEM', payload: { ...item, isAvailable: false } });
                      });
                      addToast('info', 'All meals marked as unavailable.');
                      setShowOthersMenu(false);
                    }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '9px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    🚫 Mark All as Unavailable
                  </button>
                  {/* Divider */}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 14px' }} />
                  {/* Delete All */}
                  <button
                    onClick={() => {
                      if (window.confirm('⚠️ PERMANENTLY delete ALL menu items and ALL categories? This CANNOT be undone!')) {
                        if (window.confirm('Are you absolutely sure? All menu data will be lost!')) {
                          dispatch({ type: 'DELETE_ALL_MENU_ITEMS' });
                          addToast('info', 'All menu items and categories deleted.');
                          setShowOthersMenu(false);
                        }
                      }
                    }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '9px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700,
                      color: 'var(--error)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    🗑️ Delete All Menu Items
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Categories Row */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory('all')}
            style={{ flexShrink: 0 }}
          >
            All ({adminMenuItems.length})
          </button>
          {adminCategories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            const isDeleting = deletingCatId === cat.id;
            return (
              <div key={cat.id} style={{ display: 'flex', gap: 0, flexShrink: 0, alignItems: 'center' }}>
                <button
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    paddingRight: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {cat.icon} {cat.name} ({adminMenuItems.filter(i => i.category === cat.id).length})
                </button>
                <button
                  className={`btn btn-sm ${isDeleting ? 'btn-danger' : isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleDeleteCategoryClick(cat.id)}
                  style={{
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderLeft: isSelected ? '1px solid rgba(0,0,0,0.15)' : 'none',
                    paddingLeft: 8,
                    paddingRight: 8,
                    color: isDeleting ? '#fff' : isSelected ? '#000' : 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'stretch',
                  }}
                  title={isDeleting ? "Click again to delete" : "Delete category"}
                >
                  {isDeleting ? 'Confirm?' : <X size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Add Item Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search meals by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingItem(null);
            setNewItem(EMPTY_ITEM);
            setVariants([]);
            setHasVariants(false);
            setHasNutrition(false);
            setNutrition({ calories: undefined, carbs: undefined, sugar: undefined, protein: undefined, fats: undefined, custom: [] });
            setShowItemModal(true);
          }}
          style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '0 16px' }}
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Items Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <p style={{ color: 'var(--text-muted)' }}>No items found. Add your first menu item!</p>
          </div>
        )}
        {filteredItems.map(item => {
          const cat = state.categories.find(c => c.id === item.category);
          return (
            <div key={item.id} className="card" style={{
              padding: '14px 16px',
              opacity: item.isAvailable ? 1 : 0.6,
              transition: 'var(--transition)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Veg/Non-veg indicator */}
                <div style={{
                  width: 18, height: 18, borderRadius: 3, flexShrink: 0, marginTop: 2,
                  border: `2px solid ${item.isVeg ? 'var(--success)' : '#ef4444'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: item.isVeg ? 'var(--success)' : '#ef4444',
                  }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                    {item.isFeatured && <span className="badge badge-brand" style={{ fontSize: 9 }}>Featured</span>}
                    {!item.isAvailable && <span className="badge badge-muted" style={{ fontSize: 9 }}>Unavailable</span>}
                    {cat && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.icon} {cat.name}</span>}
                  </div>
                  {item.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }} className="truncate">
                      {item.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand)' }}>
                      {item.variants && item.variants.length > 0 ? `From ₹${item.price}` : `₹${item.price}`}
                    </span>
                    {item.variants && item.variants.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        ({item.variants.length} options)
                      </span>
                    )}
                  </div>
                  {item.variants && item.variants.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {item.variants.map((v, i) => (
                        <span key={i} style={{ fontSize: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          {v.name}: ₹{v.price}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {/* Toggle availability */}
                  <div
                    className={`toggle ${item.isAvailable ? 'on' : ''}`}
                    onClick={() => handleToggleAvailable(item)}
                    title={item.isAvailable ? 'Click to mark unavailable' : 'Click to mark available'}
                  >
                    <div className="toggle-thumb" />
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleEditItem(item)} title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteItem(item.id)}
                    style={{ color: 'var(--error)' }} title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Item Modal */}
      {showItemModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowItemModal(false)}>
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>
                {editingItem ? 'Edit Item' : 'Add Menu Item'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowItemModal(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Item Name *</label>
                <input className="input" type="text" placeholder="e.g. Butter Chicken"
                  value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>Description</label>
                  <button
                    type="button"
                    onClick={handleAiDesc}
                    disabled={aiDescLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 700, color: 'var(--brand)',
                      background: 'rgba(255,125,0,0.1)', border: '1px solid rgba(255,125,0,0.3)',
                      borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    }}
                  >
                    {aiDescLoading ? <Loader2 size={10} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Sparkles size={10} />}
                    AI Generate
                  </button>
                </div>
                <textarea className="input" rows={2} placeholder="Brief description of the dish..."
                  value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                  style={{ resize: 'vertical' }} />
              </div>

              <div className="input-group">
                <label className="input-label">Item Photo</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {newItem.image ? (
                    <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={newItem.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setNewItem(prev => ({ ...prev, image: '' }))}
                        style={{
                          position: 'absolute', top: 2, right: 2,
                          background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                          width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', cursor: 'pointer', fontSize: 10
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => document.getElementById('item-image-input')?.click()}
                      style={{
                        width: 64, height: 64, borderRadius: 10,
                        border: '1.5px dashed var(--border)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-muted)'
                      }}
                    >
                      {uploadingImage ? (
                        <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <>
                          <Camera size={18} />
                          <span style={{ fontSize: 9, marginTop: 4 }}>Upload</span>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    id="item-image-input"
                    accept="image/*"
                    onChange={handleItemImageUpload}
                    style={{ display: 'none' }}
                    disabled={uploadingImage}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {newItem.image ? 'Photo Uploaded' : 'Select Dish Image'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {newItem.image 
                        ? (newItem.image.startsWith('data:') ? 'Stored locally (Base64)' : 'Hosted on Firebase Cloud')
                        : 'Supports JPG, PNG, WebP (Max 5MB)'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Price (₹) *</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={hasVariants ? (Math.min(...variants.map(v => v.price)) || 0) : newItem.price}
                    onChange={e => setNewItem({ ...newItem, price: parseInt(e.target.value) || 0 })}
                    disabled={hasVariants}
                    style={{ opacity: hasVariants ? 0.6 : 1 }}
                  />
                  {hasVariants && <span style={{ fontSize: 9, color: 'var(--brand)', marginTop: 2 }}>Computed from lowest variant</span>}
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Category</label>
                  <select className="input" value={newItem.category}
                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                    style={{ cursor: 'pointer' }}>
                    <option value="">Select...</option>
                    {state.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Veg / Non-Veg Picker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, isVeg: true })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: newItem.isVeg ? '2px solid #22c55e' : '1.5px solid var(--border)',
                        background: newItem.isVeg ? 'rgba(34,197,94,0.1)' : 'var(--bg-elevated)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                        color: newItem.isVeg ? '#22c55e' : 'var(--text-secondary)',
                        transition: 'all 0.18s'
                      }}
                    >
                      <div style={{
                        width: 11, height: 11, borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: newItem.isVeg ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
                        transition: 'box-shadow 0.18s'
                      }} />
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, isVeg: false })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: !newItem.isVeg ? '2px solid #ef4444' : '1.5px solid var(--border)',
                        background: !newItem.isVeg ? 'rgba(239,68,68,0.1)' : 'var(--bg-elevated)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                        color: !newItem.isVeg ? '#ef4444' : 'var(--text-secondary)',
                        transition: 'all 0.18s'
                      }}
                    >
                      <div style={{
                        width: 11, height: 11, borderRadius: '50%',
                        background: '#ef4444',
                        boxShadow: !newItem.isVeg ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none',
                        transition: 'box-shadow 0.18s'
                      }} />
                      Non-Veg
                    </button>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div className={`toggle ${newItem.isFeatured ? 'on' : ''}`} onClick={() => setNewItem({ ...newItem, isFeatured: !newItem.isFeatured })}>
                    <div className="toggle-thumb" />
                  </div>
                  Featured
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <div className={`toggle ${newItem.isAvailable ? 'on' : ''}`} onClick={() => setNewItem({ ...newItem, isAvailable: !newItem.isAvailable })}>
                    <div className="toggle-thumb" />
                  </div>
                  Available
                </label>
              </div>

              {/* Variants Toggle */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>
                  <div className={`toggle ${hasVariants ? 'on' : ''}`} onClick={() => {
                    setHasVariants(!hasVariants);
                    if (!hasVariants && variants.length === 0) {
                      setVariants([{ name: '', price: 0 }]);
                    }
                  }}>
                    <div className="toggle-thumb" />
                  </div>
                  Has Variants (Sizes, Portions, etc.)
                </label>
              </div>

              {/* Variants Section */}
              {hasVariants && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Choose Preset</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
                        onClick={() => setVariants([
                          { name: 'Small', price: 0 },
                          { name: 'Medium', price: 0 },
                          { name: 'Large', price: 0 }
                        ])}
                      >
                        Size
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
                        onClick={() => setVariants([
                          { name: 'Half', price: 0 },
                          { name: 'Full', price: 0 }
                        ])}
                      >
                        Portion
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: 10, height: 22 }}
                        onClick={() => setVariants([
                          { name: '4 Pieces', price: 0 },
                          { name: '8 Pieces', price: 0 }
                        ])}
                      >
                        Pieces
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto', paddingRight: 4 }}>
                    {variants.map((v, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className="input"
                          type="text"
                          placeholder="Variant e.g. Medium"
                          value={v.name}
                          onChange={e => {
                            const updated = [...variants];
                            updated[idx].name = e.target.value;
                            setVariants(updated);
                          }}
                          style={{ flex: 2, padding: '6px 10px', fontSize: 12 }}
                        />
                        <input
                          className="input"
                          type="number"
                          placeholder="Price"
                          value={v.price || ''}
                          onChange={e => {
                            const updated = [...variants];
                            updated[idx].price = parseInt(e.target.value) || 0;
                            setVariants(updated);
                          }}
                          style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{ color: 'var(--error)', padding: 4 }}
                          onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                          disabled={variants.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setVariants([...variants, { name: '', price: 0 }])}
                  >
                    <Plus size={11} /> Add Option
                  </button>
                </div>
              )}

              {/* Nutritional Values Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>
                  <div className={`toggle ${hasNutrition ? 'on' : ''}`} onClick={() => setHasNutrition(v => !v)}>
                    <div className="toggle-thumb" />
                  </div>
                  <FlaskConical size={14} color={hasNutrition ? 'var(--brand)' : 'var(--text-muted)'} />
                  Add Nutritional Info (optional)
                </label>
              </div>

              {hasNutrition && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Per Serving — fill only what you know</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([['calories', '🔥 Calories (kcal)'], ['carbs', '🍞 Carbs (g)'], ['sugar', '🍬 Sugar (g)'], ['protein', '💪 Protein (g)'], ['fats', '🧈 Fats (g)']] as [keyof Omit<NutritionInfo,'enabled'|'custom'>, string][]).map(([key, label]) => (
                      <div key={key} className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: 10 }}>{label}</label>
                        <input
                          className="input"
                          type="number" min={0} placeholder="—"
                          value={nutrition[key] ?? ''}
                          onChange={e => setNutrition(prev => ({ ...prev, [key]: parseFloat(e.target.value) || undefined }))}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        />
                      </div>
                    ))}
                  </div>
                  {(nutrition.custom || []).map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input className="input" type="text" placeholder="e.g. Fiber" value={c.label}
                        onChange={e => { const arr = [...(nutrition.custom||[])]; arr[idx] = { ...arr[idx], label: e.target.value }; setNutrition(p => ({ ...p, custom: arr })); }}
                        style={{ flex: 2, padding: '6px 10px', fontSize: 12 }} />
                      <input className="input" type="number" placeholder="g" value={c.value || ''}
                        onChange={e => { const arr = [...(nutrition.custom||[])]; arr[idx] = { ...arr[idx], value: parseFloat(e.target.value) || 0 }; setNutrition(p => ({ ...p, custom: arr })); }}
                        style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
                      <button type="button" className="btn btn-ghost btn-icon" style={{ color: 'var(--error)', padding: 4 }}
                        onClick={() => setNutrition(p => ({ ...p, custom: (p.custom||[]).filter((_,i) => i !== idx) }))}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setNutrition(p => ({ ...p, custom: [...(p.custom||[]), { label: '', value: 0 }] }))}>
                    <Plus size={11} /> Add Custom Metric
                  </button>
                </div>
              )}

            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setShowItemModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={handleSaveItem}>
                {editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {showCatModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal-content" style={{ maxWidth: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Manage Categories</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCatModal(false)}><X size={18} /></button>
            </div>

            {/* List of current categories */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, paddingRight: 4 }}>
              <label className="input-label" style={{ marginBottom: 4 }}>Existing Categories ({adminCategories.length})</label>
              {adminCategories.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No categories created yet.</p>
              ) : (
                adminCategories.map(cat => {
                  const isDeleting = deletingCatId === cat.id;
                  return (
                    <CategoryRow 
                      key={cat.id} 
                      cat={cat} 
                      onUpdate={(updatedCat) => {
                        dispatch({ type: 'UPDATE_CATEGORY', payload: updatedCat });
                        addToast('success', 'Category updated successfully! 📝');
                      }} 
                      onDelete={handleDeleteCategoryClick}
                      isDeleting={isDeleting}
                    />
                  );
                })
              )}
            </div>

            {/* Add New Category form */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 'auto' }}>
              <label className="input-label" style={{ fontWeight: 700, marginBottom: 12 }}>➕ Create New Category</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  className="input" 
                  type="text" 
                  placeholder="🍕"
                  value={newCat.icon} 
                  onChange={e => setNewCat({ ...newCat, icon: e.target.value })} 
                  style={{ width: 44, textAlign: 'center', fontSize: 16, padding: '6px 0' }} 
                />
                <input 
                  className="input" 
                  type="text" 
                  placeholder="e.g. Starters"
                  value={newCat.name} 
                  onChange={e => setNewCat({ ...newCat, name: e.target.value })} 
                  style={{ flex: 1, padding: '6px 12px' }} 
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleAddCategory}
                  style={{ padding: '0 16px', height: 38 }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meals Modal */}
      {showScheduleModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowScheduleModal(false)}>
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarClock size={20} color="var(--brand)" />
                <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>Schedule Meals</h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowScheduleModal(false)}><X size={18} /></button>
            </div>

            {/* Saved schedules list */}
            {state.schedules.length > 0 && (
              <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Active Schedules</div>
                {state.schedules.map(sch => (
                  <div key={sch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{sch.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sch.fromTime} – {sch.toTime} · {sch.targets.length} target(s)</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: 10 }}
                        onClick={() => { setEditingSchedule(sch); setScheduleForm({ name: sch.name, fromTime: sch.fromTime, toTime: sch.toTime, targets: [...sch.targets] }); }}>
                        <Pencil size={11} />
                      </button>
                      <button className="btn btn-sm" style={{ padding: '4px 8px', fontSize: 10, background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}
                        onClick={() => { dispatch({ type: 'DELETE_SCHEDULE', payload: sch.id }); addToast('info', 'Schedule deleted.'); }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Schedule form */}
            <div style={{ borderTop: state.schedules.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: state.schedules.length > 0 ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {editingSchedule ? `Editing: ${editingSchedule.name}` : 'Create New Schedule'}
              </div>

              <div className="input-group">
                <label className="input-label">Schedule Name</label>
                <input className="input" type="text" placeholder="e.g. Breakfast, Lunch, Happy Hour"
                  value={scheduleForm.name} onChange={e => setScheduleForm(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">From Time</label>
                  <input className="input" type="time" value={scheduleForm.fromTime}
                    onChange={e => setScheduleForm(p => ({ ...p, fromTime: e.target.value }))} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">To Time</label>
                  <input className="input" type="time" value={scheduleForm.toTime}
                    onChange={e => setScheduleForm(p => ({ ...p, toTime: e.target.value }))} />
                </div>
              </div>

              {/* Category targets */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Apply to Categories <span style={{ fontWeight: 400, fontSize: 10 }}>(items outside these times will be hidden)</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {state.categories.map(cat => {
                    const sel = scheduleForm.targets.some(t => t.type === 'category' && t.id === cat.id);
                    return (
                      <button key={cat.id} type="button"
                        onClick={() => toggleScheduleTarget('category', cat.id)}
                        style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${sel ? 'var(--brand)' : 'var(--border)'}`, background: sel ? 'rgba(255,125,0,0.12)' : 'var(--bg-elevated)', color: sel ? 'var(--brand)' : 'var(--text-secondary)' }}>
                        {cat.icon} {cat.name} {sel && <Check size={10} style={{ display: 'inline' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Individual item targets */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Apply to Specific Items <span style={{ fontWeight: 400, fontSize: 10 }}>(optional — overrides category rules)</span></div>
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {state.menuItems.map(item => {
                    const sel = scheduleForm.targets.some(t => t.type === 'item' && t.id === item.id);
                    return (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 8px', borderRadius: 6, background: sel ? 'rgba(255,125,0,0.08)' : 'transparent' }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleScheduleTarget('item', item.id)} style={{ accentColor: 'var(--brand)' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: sel ? 700 : 400 }}>{item.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{state.categories.find(c => c.id === item.category)?.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {editingSchedule && (
                  <button className="btn btn-secondary btn-full" onClick={() => { setEditingSchedule(null); setScheduleForm({ name: '', fromTime: '08:00', toTime: '11:00', targets: [] }); }}>
                    Cancel Edit
                  </button>
                )}
                <button className="btn btn-primary btn-full" onClick={handleSaveSchedule}>
                  <CalendarClock size={14} /> {editingSchedule ? 'Update Schedule' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Meals Extractor Modal */}
      {showExtractorModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && extractorStep !== 'processing' && setShowExtractorModal(false)}>
          <div className="modal-content" style={{ maxWidth: extractorStep === 'confirm' ? '640px' : '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="var(--brand)" />
                <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>AI Meals Extractor</h2>
              </div>
              {extractorStep !== 'processing' && (
                <button className="btn btn-ghost btn-icon" onClick={() => setShowExtractorModal(false)}>
                  <X size={18} />
                </button>
              )}
            </div>

            {/* STEP 2: File Upload / Camera Option */}
            {extractorStep === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={async e => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      await processMenuFile(files[0]);
                    }
                  }}
                  style={{
                    border: `2px dashed ${isDragging ? 'var(--brand)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: isDragging ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    transition: 'var(--transition)',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('menu-file-input')?.click()}
                >
                  <input
                    type="file"
                    id="menu-file-input"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <UploadCloud size={36} color={isDragging ? 'var(--brand)' : 'var(--text-muted)'} style={{ marginBottom: 12, transition: 'var(--transition)' }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Drag & Drop Menu Here</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Supports JPG, PNG, WebP images, or PDF menus
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* Capture photo native selector */}
                <div>
                  <input
                    type="file"
                    id="menu-camera-input"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn btn-secondary btn-full"
                    onClick={() => document.getElementById('menu-camera-input')?.click()}
                    style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Camera size={16} /> Capture Live Menu Photo
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Processing */}
            {extractorStep === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 16 }}>
                <div style={{ position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={44} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} />
                  <Sparkles size={16} color="var(--brand)" style={{ position: 'absolute' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', marginBottom: 6, color: 'var(--text-primary)' }}>Processing Menu...</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{processingMessage}</p>
                </div>
              </div>
            )}

            {/* STEP 4: Review & Confirmation */}
            {extractorStep === 'confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  We found <strong>{extractedItems.length} meals</strong> in the menu. Please review category mappings and item details before adding.
                </p>

                {/* Category mapping box */}
                <div style={{ background: 'rgba(255,125,0,0.05)', border: '1px solid var(--border-brand)', borderRadius: 'var(--radius-lg)', padding: 14 }}>
                  <h4 style={{ fontSize: 13, fontFamily: 'var(--font-display)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand)' }}>
                    <Tag size={13} color="var(--brand)" /> Category Mapping
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.keys(categoryMapping).map(extCat => (
                      <div key={extCat} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }} className="truncate">
                          "{extCat}"
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>map to</span>
                          <select
                            className="input"
                            style={{ width: 180, padding: '4px 8px', fontSize: 11, background: 'var(--bg-elevated)' }}
                            value={categoryMapping[extCat]}
                            onChange={e => setCategoryMapping({ ...categoryMapping, [extCat]: e.target.value })}
                          >
                            <option value="create">➕ Create "{extCat}"</option>
                            {state.categories.map(c => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Meals list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h4 style={{ fontSize: 13, fontFamily: 'var(--font-display)', marginBottom: 2, color: 'var(--text-primary)' }}>Meals List</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                    {extractedItems.map((item, idx) => (
                      <div key={idx} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-elevated)', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Veg toggle */}
                          <button
                            style={{
                              width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                              border: `2px solid ${item.isVeg ? 'var(--success)' : '#ef4444'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'transparent', cursor: 'pointer'
                            }}
                            title={item.isVeg ? 'Vegetarian (click to toggle)' : 'Non-Vegetarian (click to toggle)'}
                            onClick={() => {
                              const updated = [...extractedItems];
                              updated[idx].isVeg = !updated[idx].isVeg;
                              setExtractedItems(updated);
                            }}
                          >
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: item.isVeg ? 'var(--success)' : '#ef4444',
                            }} />
                          </button>

                          {/* Item Name */}
                          <input
                            className="input"
                            style={{ padding: '4px 8px', fontSize: 12, flex: 1, minWidth: 0 }}
                            value={item.name}
                            onChange={e => {
                              const updated = [...extractedItems];
                              updated[idx].name = e.target.value;
                              setExtractedItems(updated);
                            }}
                            placeholder="Item Name"
                          />

                          {/* Category select inside list */}
                          <select
                            className="input"
                            style={{ width: 110, padding: '4px 8px', fontSize: 11, background: 'var(--bg-surface)' }}
                            value={item.category}
                            onChange={e => {
                              const updated = [...extractedItems];
                              updated[idx].category = e.target.value;
                              setExtractedItems(updated);
                            }}
                          >
                            {Object.keys(categoryMapping).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>

                          {/* Price */}
                          <input
                            className="input"
                            type="number"
                            style={{ padding: '4px 8px', fontSize: 12, width: 64 }}
                            value={item.price || ''}
                            onChange={e => {
                              const updated = [...extractedItems];
                              updated[idx].price = parseInt(e.target.value) || 0;
                              setExtractedItems(updated);
                            }}
                            placeholder="Price"
                          />

                          {/* Delete from extracted list */}
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ color: 'var(--error)', padding: 4 }}
                            onClick={() => {
                              setExtractedItems(extractedItems.filter((_, i) => i !== idx));
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Description */}
                        <input
                          className="input"
                          style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-secondary)' }}
                          value={item.description || ''}
                          onChange={e => {
                            const updated = [...extractedItems];
                            updated[idx].description = e.target.value;
                            setExtractedItems(updated);
                          }}
                          placeholder="Description (optional)"
                        />

                        {/* Variants Preview */}
                        {item.variants && item.variants.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 8px 4px', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700 }}>✨ Variants:</span>
                            {item.variants.map((v, vIdx) => (
                              <span key={vIdx} style={{ fontSize: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                                {v.name}: ₹{v.price}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn btn-secondary btn-full" onClick={() => setExtractorStep('upload')}>
                    Back
                  </button>
                  <button
                    className="btn btn-primary btn-full"
                    onClick={handleConfirmExtraction}
                    disabled={extractedItems.length === 0}
                    style={{ opacity: extractedItems.length === 0 ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Check size={16} /> Add {extractedItems.length} Meals
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Contact Developer / Support Modal */}
      {showSupportModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowSupportModal(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlaskConical size={20} color="var(--brand)" />
                <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Contact Developer</h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowSupportModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              The AI service encountered errors multiple times. Please contact the developer to report this issue. The system will automatically include your restaurant owner information and failure counts.
            </div>

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Message / Details</label>
              <textarea
                className="input"
                style={{ height: 100, resize: 'vertical', padding: '10px 12px' }}
                placeholder="Describe what you were doing when it failed..."
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
              />
            </div>

            <div style={{ fontSize: 11, background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', lineHeight: 1.5, marginBottom: 20 }}>
              <strong>Attached Info:</strong><br />
              • Owner: {state.admin?.name || 'Unknown'}<br />
              • Restaurant: {state.restaurant.name}<br />
              • AI Failure Attempts: {supportAttemptsCount || 5}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setShowSupportModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={handleSubmitSupport}>Send Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Theme Customization Modal */}
      {showThemeModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowThemeModal(false)}>
          <div className="modal-content" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Palette size={20} color="var(--brand)" />
                <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Customer Menu Theme</h2>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowThemeModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              Customize the colors of the digital menu displayed to your customers when they scan the QR code. Leave blank to use system defaults.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {/* 1. Website Background Color */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Website Background Color</span>
                  {themeForm.primaryBg && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, primaryBg: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.primaryBg || '#0d0d0d'}
                    onChange={e => setThemeForm({ ...themeForm, primaryBg: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (#0d0d0d)"
                    value={themeForm.primaryBg}
                    onChange={e => setThemeForm({ ...themeForm, primaryBg: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* 2. Item Name Color */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Item Name Color</span>
                  {themeForm.itemName && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, itemName: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.itemName || '#FF7D00'}
                    onChange={e => setThemeForm({ ...themeForm, itemName: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (#FF7D00)"
                    value={themeForm.itemName}
                    onChange={e => setThemeForm({ ...themeForm, itemName: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* 3. Item Description Color */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Item Description Color</span>
                  {themeForm.itemDesc && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, itemDesc: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.itemDesc || '#A3A3A3'}
                    onChange={e => setThemeForm({ ...themeForm, itemDesc: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (#A3A3A3)"
                    value={themeForm.itemDesc}
                    onChange={e => setThemeForm({ ...themeForm, itemDesc: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* 4. Add to Cart Button Background */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Add to Cart Button Background</span>
                  {themeForm.addToCartBg && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, addToCartBg: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.addToCartBg || '#ffffff'}
                    onChange={e => setThemeForm({ ...themeForm, addToCartBg: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (#ffffff)"
                    value={themeForm.addToCartBg}
                    onChange={e => setThemeForm({ ...themeForm, addToCartBg: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* 5. Add to Cart Button Text */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Add to Cart Button Text</span>
                  {themeForm.addToCartText && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, addToCartText: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.addToCartText || '#000000'}
                    onChange={e => setThemeForm({ ...themeForm, addToCartText: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (#000000)"
                    value={themeForm.addToCartText}
                    onChange={e => setThemeForm({ ...themeForm, addToCartText: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* 6. Bestseller Badge Background */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bestseller Badge Background</span>
                  {themeForm.bestsellerBg && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, bestsellerBg: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.bestsellerBg || '#FF7D00'}
                    onChange={e => setThemeForm({ ...themeForm, bestsellerBg: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (Orange Alpha)"
                    value={themeForm.bestsellerBg}
                    onChange={e => setThemeForm({ ...themeForm, bestsellerBg: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* 7. Bestseller Badge Text */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bestseller Badge Text</span>
                  {themeForm.bestsellerText && <span style={{ fontSize: 10, color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setThemeForm(p => ({...p, bestsellerText: ''}))}>Reset</span>}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="color"
                    value={themeForm.bestsellerText || '#FF7D00'}
                    onChange={e => setThemeForm({ ...themeForm, bestsellerText: e.target.value })}
                    style={{ width: 44, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', cursor: 'pointer' }}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Default (#FF7D00)"
                    value={themeForm.bestsellerText}
                    onChange={e => setThemeForm({ ...themeForm, bestsellerText: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-full" onClick={handleResetThemeColors}>Reset to Defaults</button>
              <button className="btn btn-primary btn-full" onClick={handleSaveThemeColors}>Save Theme</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
