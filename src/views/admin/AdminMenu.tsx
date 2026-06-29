import { useState, useEffect } from 'react';
import { useStore } from '../../context/RealtimeStore';
import type { MenuItem, MealSchedule, NutritionInfo, MenuCategory } from '../../context/RealtimeStore';
import { Plus, Pencil, Trash2, Search, Tag, X, Sparkles, Camera, UploadCloud, Loader2, Check, CalendarClock, FlaskConical } from 'lucide-react';
import { hasFirebaseConfig, db } from '../../utils/firebase';
import { ref, update } from 'firebase/database';

function CategoryRow({ cat, onUpdate, onDelete, isDeleting, onManageMeals }: { 
  cat: any; 
  onUpdate: (cat: any) => void; 
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onManageMeals: () => void;
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
        className="btn btn-ghost btn-icon"
        onClick={onManageMeals}
        style={{ color: 'var(--brand)', padding: 6, flexShrink: 0 }}
        title="Manage meals in this category"
      >
        <Plus size={16} />
      </button>
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

const generateNutritionForMeal = (name: string): Omit<NutritionInfo, 'enabled'> => {
  const lowercase = name.toLowerCase();
  
  // Default values
  let calories = 250;
  let carbs = 30;
  let sugar = 5;
  let protein = 8;
  let fats = 10;

  if (lowercase.includes('pizza')) {
    calories = 290;
    carbs = 33;
    sugar = 4;
    protein = 12;
    fats = 12;
  } else if (lowercase.includes('burger')) {
    calories = 450;
    carbs = 40;
    sugar = 6;
    protein = 22;
    fats = 20;
  } else if (lowercase.includes('salad')) {
    calories = 120;
    carbs = 10;
    sugar = 3;
    protein = 4;
    fats = 7;
  } else if (lowercase.includes('chicken') || lowercase.includes('non-veg') || lowercase.includes('meat') || lowercase.includes('mutton') || lowercase.includes('fish')) {
    calories = 320;
    carbs = 15;
    sugar = 2;
    protein = 28;
    fats = 16;
  } else if (lowercase.includes('paneer') || lowercase.includes('veg cheese') || lowercase.includes('tofu')) {
    calories = 280;
    carbs = 12;
    sugar = 2;
    protein = 14;
    fats = 20;
  } else if (lowercase.includes('cake') || lowercase.includes('dessert') || lowercase.includes('sweet') || lowercase.includes('shake') || lowercase.includes('ice cream') || lowercase.includes('pudding') || lowercase.includes('waffle')) {
    calories = 380;
    carbs = 50;
    sugar = 35;
    protein = 5;
    fats = 15;
  } else if (lowercase.includes('coke') || lowercase.includes('soda') || lowercase.includes('mojito') || lowercase.includes('drink') || lowercase.includes('beverage') || lowercase.includes('juice') || lowercase.includes('pepsi') || lowercase.includes('fanta')) {
    calories = 140;
    carbs = 35;
    sugar = 33;
    protein = 0;
    fats = 0;
  } else if (lowercase.includes('soup')) {
    calories = 90;
    carbs = 12;
    sugar = 3;
    protein = 3;
    fats = 3;
  } else if (lowercase.includes('roll') || lowercase.includes('wrap') || lowercase.includes('sandwich') || lowercase.includes('panini')) {
    calories = 310;
    carbs = 38;
    sugar = 4;
    protein = 10;
    fats = 12;
  } else if (lowercase.includes('pasta') || lowercase.includes('noodle') || lowercase.includes('spaghetti') || lowercase.includes('macaroni')) {
    calories = 340;
    carbs = 52;
    sugar = 3;
    protein = 11;
    fats = 9;
  } else if (lowercase.includes('rice') || lowercase.includes('biryani') || lowercase.includes('pulav') || lowercase.includes('fried rice')) {
    calories = 360;
    carbs = 60;
    sugar = 1;
    protein = 8;
    fats = 10;
  } else if (lowercase.includes('fries') || lowercase.includes('potato') || lowercase.includes('fry') || lowercase.includes('nugget') || lowercase.includes('snack')) {
    calories = 270;
    carbs = 35;
    sugar = 1;
    protein = 3;
    fats = 14;
  }

  // Add slight random variation (+/- 10%) so it looks dynamically generated
  const variance = (val: number) => {
    if (val === 0) return 0;
    const factor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
    return Math.round(val * factor);
  };

  return {
    calories: variance(calories),
    carbs: variance(carbs),
    sugar: variance(sugar),
    protein: variance(protein),
    fats: variance(fats),
    custom: []
  };
};

const autoDetermineVegNonVeg = (name: string): boolean => {
  if (!name) return true;
  const clean = name.toLowerCase();
  const strongNonVeg = ['chicken', 'egg', 'fish', 'pork', 'beef', 'mutton', 'lamb', 'prawn', 'shrimp', 'crab', 'lobster', 'meat', 'bacon', 'pepperoni', 'ham', 'sausage', 'salami', 'turkey', 'duck', 'non-veg', 'nonveg', 'salmon', 'tuna', 'cod', 'squid', 'anchovy', 'steak', 'meatball', 'gelatin', 'lard'];
  
  for (const kw of strongNonVeg) {
    if (clean.includes(kw)) {
      if (kw === 'egg' && (clean.includes('eggless') || clean.includes('egg-less') || clean.includes('egg free') || clean.includes('egg-free') || clean.includes('egg substitute'))) {
        continue;
      }
      return false; // non-veg
    }
  }
  return true; // veg
};

const EMPTY_ITEM: Omit<MenuItem, 'id'> = {
  name: '', description: '', price: 0, category: '', categories: [],
  image: '', isVeg: true, isAvailable: true, isFeatured: false, tags: [],
};

export default function AdminMenu() {
  const { state, dispatch, addToast } = useStore();
  const adminId = state.admin?.restaurantId || 'admin-1';
  const adminMenuItems = state.menuItems.filter(item => (item.restaurantId || 'admin-1') === adminId);
  const adminCategories = state.categories.filter(c => (c.restaurantId || 'admin-1') === adminId);
  const uncategorizedItems = adminMenuItems.filter(item => 
    !item.category || !adminCategories.some(c => c.id === item.category)
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState<Omit<MenuItem, 'id'>>(EMPTY_ITEM);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showOthersMenu, setShowOthersMenu] = useState(false);
  const [bulkAiLoading, setBulkAiLoading] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState({ current: 0, total: 0 });
  const [newCat, setNewCat] = useState({ name: '', icon: '🍽️' });
  const [managingCatMeals, setManagingCatMeals] = useState<MenuCategory | null>(null);
  const [catMealsSearch, setCatMealsSearch] = useState('');

  // Meals Rank States
  const [showRankModal, setShowRankModal] = useState(false);
  const [rankTab, setRankTab] = useState<'categories' | 'meals'>('categories');
  const [rankCategoryId, setRankCategoryId] = useState<string>('');
  const [orderedCategories, setOrderedCategories] = useState<MenuCategory[]>([]);
  const [orderedMeals, setOrderedMeals] = useState<MenuItem[]>([]);

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

  const handleOpenRankModal = () => {
    const cats = [...adminCategories].sort((a, b) => (a.rank || 0) - (b.rank || 0));
    setOrderedCategories(cats);

    const defaultCatId = cats[0]?.id || '';
    setRankCategoryId(defaultCatId);

    if (defaultCatId) {
      const meals = [...adminMenuItems]
        .filter(item => item.category === defaultCatId || (item.categories && item.categories.includes(defaultCatId)))
        .sort((a, b) => (a.rank || 0) - (b.rank || 0));
      setOrderedMeals(meals);
    } else {
      setOrderedMeals([]);
    }

    setRankTab('categories');
    setShowRankModal(true);
  };

  const handleRankCategoryChange = (catId: string) => {
    setRankCategoryId(catId);
    const meals = [...adminMenuItems]
      .filter(item => item.category === catId || (item.categories && item.categories.includes(catId)))
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));
    setOrderedMeals(meals);
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedCategories.length) return;

    const list = [...orderedCategories];
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    setOrderedCategories(list);
  };

  const moveMeal = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedMeals.length) return;

    const list = [...orderedMeals];
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;
    setOrderedMeals(list);
  };

  const handleSaveRanks = () => {
    if (hasFirebaseConfig && db) {
      if (rankTab === 'categories') {
        orderedCategories.forEach((cat, idx) => {
          update(ref(db!, `categories/${adminId}/${cat.id}`), { rank: idx })
            .catch(e => console.error("Failed to update category rank:", e));
        });
        addToast('success', 'Category rankings saved successfully!');
      } else {
        orderedMeals.forEach((meal, idx) => {
          update(ref(db!, `menuItems/${adminId}/${meal.id}`), { rank: idx })
            .catch(e => console.error("Failed to update meal rank:", e));
        });
        addToast('success', 'Meal rankings saved successfully!');
      }
    } else {
      if (rankTab === 'categories') {
        orderedCategories.forEach((cat, idx) => {
          dispatch({ type: 'UPDATE_CATEGORY', payload: { ...cat, rank: idx } });
        });
        addToast('success', 'Category rankings saved (Demo mode)!');
      } else {
        orderedMeals.forEach((meal, idx) => {
          dispatch({ type: 'UPDATE_MENU_ITEM', payload: { ...meal, rank: idx } });
        });
        addToast('success', 'Meal rankings saved (Demo mode)!');
      }
    }
    setShowRankModal(false);
  };
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
        const match = adminCategories.find(
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
            icon: randomEmoji,
            restaurantId: adminId
          }
        });
        
        createdCatIds[extCat] = newCatId;
        finalMapping[extCat] = newCatId;
      }
    });

    extractedItems.forEach((item, index) => {
      const catId = finalMapping[item.category] || createdCatIds[item.category] || adminCategories[0]?.id || 'cat-1';
      
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
          variants: item.variants || [],
          restaurantId: adminId
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
    let matchCat = false;
    if (selectedCategory === 'all') {
      matchCat = true;
    } else if (selectedCategory === 'uncategorized') {
      matchCat = !item.category || !adminCategories.some(c => c.id === item.category);
    } else {
      matchCat = item.category === selectedCategory || !!(item.categories && item.categories.includes(selectedCategory));
    }
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

  const compressImage = (file: File, maxDim = 500, targetKb = 100): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Center-crop to a perfect square
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;

          // Target dimension (at most maxDim)
          const targetSize = Math.min(size, maxDim);
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          // Crop and draw
          ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);

          let quality = 0.85;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Base64 size is roughly 1.34 times binary size. 100KB binary is ~137,000 chars.
          const maxBase64Length = Math.round(targetKb * 1024 * 1.34);

          // Iteratively decrease quality if image size exceeds our target limit
          while (dataUrl.length > maxBase64Length && quality > 0.3) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
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
      // Compress the image to a square and convert to Base64 data URL directly (~100kb target size)
      const compressedDataUrl = await compressImage(file, 500, 100);
      setNewItem(prev => ({ ...prev, image: compressedDataUrl }));
      addToast('success', 'Image auto-cropped to square, compressed to ~100kb, and saved! 📸');
    } catch (err: any) {
      console.error(err);
      addToast('error', `❌ Image processing failed: ${err.message || err}`);
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

  const handleBulkAiDescriptions = async () => {
    let itemsToProcess = adminMenuItems.filter(item => !item.description || !item.description.trim());
    let overwriteAll = false;
    
    if (itemsToProcess.length === 0) {
      if (adminMenuItems.length === 0) {
        addToast('error', 'No menu items found to generate descriptions for.');
        return;
      }
      if (window.confirm('All menu items already have descriptions. Would you like to RE-GENERATE descriptions for all items?')) {
        itemsToProcess = [...adminMenuItems];
        overwriteAll = true;
      } else {
        return;
      }
    }

    const validUserKeys = state.geminiApiKeys && state.geminiApiKeys.length > 0
      ? state.geminiApiKeys.filter(k => !k.includes('FakeGeminiKey'))
      : [];
    if (validUserKeys.length === 0) {
      addToast('error', '❌ AI features require a valid Gemini API Key. Super Admin must configure a key first.');
      return;
    }

    if (!window.confirm(`Generate AI descriptions for ${itemsToProcess.length} items? This will take a moment.`)) {
      return;
    }

    setBulkAiLoading(true);
    setBulkAiProgress({ current: 0, total: itemsToProcess.length });

    let successCount = 0;
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      setBulkAiProgress({ current: i + 1, total: itemsToProcess.length });
      
      try {
        const prompt = `Write a short, enticing 1-2 sentence menu description for a dish called "${item.name}". Be concise, mouth-watering and factual. No quotes, no labels, just the description text.`;
        
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
        }, `AI generation failed for ${item.name}`);

        dispatch({
          type: 'UPDATE_MENU_ITEM',
          payload: { ...item, description: text }
        });
        successCount++;
        await new Promise(r => setTimeout(r, 600));
      } catch (e: any) {
        console.error(`AI description failed for ${item.name}:`, e);
      }
    }

    setBulkAiLoading(false);
    addToast('success', `✨ Finished! Generated descriptions for ${successCount} of ${itemsToProcess.length} items.`);
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



          {/* Schedule Menu Button */}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn btn-secondary"
            style={{ height: 32, display: 'flex', alignItems: 'center', gap: 5, borderRadius: 10, fontSize: 11, padding: '0 10px' }}
          >
            <CalendarClock size={13} /> Schedule Menu
          </button>

          {/* AI Menu Extractor Button */}
          <button
            onClick={openExtractor}
            className="btn btn-secondary"
            style={{ height: 32, display: 'flex', alignItems: 'center', gap: 5, borderRadius: 10, fontSize: 11, padding: '0 10px' }}
          >
            <Sparkles size={13} /> AI Menu Extractor
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={() => setShowCatModal(true)}
            className="btn btn-secondary"
            style={{ height: 32, display: 'flex', alignItems: 'center', gap: 5, borderRadius: 10, fontSize: 11, padding: '0 10px' }}
          >
            <Tag size={13} /> Manage Categories
          </button>

          {/* Others Button with Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowOthersMenu(v => !v)}
              className="btn btn-secondary"
              style={{ height: 32, display: 'flex', alignItems: 'center', gap: 5, borderRadius: 10, fontSize: 11, padding: '0 10px' }}
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
                  top: 38,
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
                  {/* Bulk AI Descriptions */}
                  <button
                    onClick={() => {
                      setShowOthersMenu(false);
                      handleBulkAiDescriptions();
                    }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '9px 14px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      color: 'var(--brand)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    ✨ Add AI Descriptions
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
          <button
            className={`btn btn-sm ${selectedCategory === 'uncategorized' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory('uncategorized')}
            style={{ flexShrink: 0 }}
          >
            📂 Uncategorized ({uncategorizedItems.length})
          </button>
          {adminCategories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {cat.icon} {cat.name} ({adminMenuItems.filter(i => i.category === cat.id || (i.categories && i.categories.includes(cat.id))).length})
              </button>
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
        <button
          className="btn btn-secondary"
          onClick={handleOpenRankModal}
          style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '0 16px', color: 'var(--brand)', borderColor: 'var(--brand)' }}
        >
          ↕️ Meals Rank
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
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Veg/Non-veg indicator */}
                <div style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 3,
                  border: `2px solid ${item.isVeg ? 'var(--success)' : '#ef4444'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: item.isVeg ? 'var(--success)' : '#ef4444',
                  }} />
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                    {item.isFeatured && <span className="badge badge-brand" style={{ fontSize: 8, padding: '1px 4px' }}>Featured</span>}
                    {!item.isAvailable && <span className="badge badge-muted" style={{ fontSize: 8, padding: '1px 4px' }}>Unavailable</span>}
                    {cat && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{cat.icon} {cat.name}</span>}
                  </div>
                  {item.description && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, margin: '2px 0' }} className="truncate">
                      {item.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>
                      {item.variants && item.variants.length > 0 ? `From ₹${item.price}` : `₹${item.price}`}
                    </span>
                    {item.variants && item.variants.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        ({item.variants.length} options)
                      </span>
                    )}
                  </div>
                  {item.variants && item.variants.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {item.variants.map((v, i) => (
                        <span key={i} style={{ fontSize: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          {v.name}: ₹{v.price}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Actions (Top) & Image (Bottom) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, flexShrink: 0 }}>
                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {/* Toggle availability */}
                    <div
                      className={`toggle ${item.isAvailable ? 'on' : ''}`}
                      onClick={() => handleToggleAvailable(item)}
                      title={item.isAvailable ? 'Click to mark unavailable' : 'Click to mark available'}
                      style={{ transform: 'scale(0.8)', margin: 0 }}
                    >
                      <div className="toggle-thumb" />
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleEditItem(item)} title="Edit" style={{ padding: 4 }}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteItem(item.id)}
                      style={{ color: 'var(--error)', padding: 4 }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Meal Photo (Right Bottom) */}
                  <div style={{
                    width: 60, height: 60, borderRadius: 6,
                    border: '1px solid var(--border)',
                    overflow: 'hidden', background: 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '🍽️'
                    )}
                  </div>
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
                <input 
                  className="input" 
                  type="text" 
                  placeholder="e.g. Butter Chicken"
                  value={newItem.name} 
                  onChange={e => {
                    const name = e.target.value;
                    const isVeg = autoDetermineVegNonVeg(name);
                    setNewItem({ ...newItem, name, isVeg });
                  }} 
                />
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
                        ? 'Stored in database (Base64)'
                        : 'Supports JPG, PNG, WebP (Auto-compressed)'}
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
                  <label className="input-label">Categories (Select one or more)</label>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 120,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)'
                  }}>
                    {adminCategories.map(c => {
                      const selectedList = newItem.categories || (newItem.category ? [newItem.category] : []);
                      const isChecked = selectedList.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newList = [...selectedList];
                              if (e.target.checked) {
                                if (!newList.includes(c.id)) newList.push(c.id);
                              } else {
                                newList = newList.filter(id => id !== c.id);
                              }
                              setNewItem({
                                ...newItem,
                                category: newList[0] || '',
                                categories: newList
                              });
                            }}
                          />
                          <span>{c.icon} {c.name}</span>
                        </label>
                      );
                    })}
                  </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>
                    <div className={`toggle ${hasNutrition ? 'on' : ''}`} onClick={() => setHasNutrition(v => !v)}>
                      <div className="toggle-thumb" />
                    </div>
                    <FlaskConical size={14} color={hasNutrition ? 'var(--brand)' : 'var(--text-muted)'} />
                    Add Nutritional Info (optional)
                  </label>
                  {hasNutrition && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!newItem.name.trim()) {
                          addToast('error', 'Please enter the item name first so AI can analyze it.');
                          return;
                        }
                        const generated = generateNutritionForMeal(newItem.name);
                        setNutrition(generated);
                        addToast('success', `✨ AI generated nutritional info for "${newItem.name}" per serving!`);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        border: '1px solid var(--border-brand)',
                        background: 'var(--brand-dim)',
                        color: 'var(--brand)'
                      }}
                    >
                      ✨ AI Generate
                    </button>
                  )}
                </div>
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
          <div className="modal-content" style={{ maxWidth: 460, minHeight: 400, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                {managingCatMeals ? 'Manage Category Meals' : 'Manage Categories'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCatModal(false)}><X size={18} /></button>
            </div>

            {managingCatMeals ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => {
                      setManagingCatMeals(null);
                      setCatMealsSearch('');
                    }}
                    style={{ padding: '4px 10px', fontSize: 11 }}
                  >
                    ← Back to Categories
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Category: {managingCatMeals.icon} {managingCatMeals.name}
                  </span>
                </div>

                <div className="search-box" style={{ marginBottom: 12, position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Search meals..."
                    value={catMealsSearch}
                    onChange={e => setCatMealsSearch(e.target.value)}
                    style={{ paddingLeft: 34, height: 36, fontSize: 12, width: '100%' }}
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                  {adminMenuItems
                    .filter(item => !catMealsSearch || item.name.toLowerCase().includes(catMealsSearch.toLowerCase()))
                    .map(item => {
                      const isChecked = item.category === managingCatMeals.id || 
                        (item.categories && item.categories.includes(managingCatMeals.id));

                      return (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            let newCategories = item.categories || [];
                            let newCategory = item.category;

                            if (isChecked) {
                              newCategories = newCategories.filter(id => id !== managingCatMeals.id);
                              if (item.category === managingCatMeals.id) {
                                newCategory = newCategories[0] || '';
                              }
                            } else {
                              if (!newCategories.includes(managingCatMeals.id)) {
                                newCategories = [...newCategories, managingCatMeals.id];
                              }
                              if (!newCategory) {
                                newCategory = managingCatMeals.id;
                              }
                            }

                            dispatch({
                              type: 'UPDATE_MENU_ITEM',
                              payload: {
                                ...item,
                                category: newCategory,
                                categories: newCategories
                              }
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            background: isChecked ? 'rgba(249, 115, 22, 0.05)' : 'var(--bg-elevated)',
                            border: isChecked ? '1px solid rgba(249, 115, 22, 0.25)' : '1px solid var(--border)',
                            borderRadius: 10,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={!!isChecked} 
                            readOnly 
                            style={{ accentColor: 'var(--brand)', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            {item.image ? (
                              <img src={item.image} alt={item.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🍽️</div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>₹{item.price}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <>
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
                          onManageMeals={() => setManagingCatMeals(cat)}
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
              </>
            )}
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
                  {adminCategories.map(cat => {
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
                  {adminMenuItems.map(item => {
                    const sel = scheduleForm.targets.some(t => t.type === 'item' && t.id === item.id);
                    return (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 8px', borderRadius: 6, background: sel ? 'rgba(255,125,0,0.08)' : 'transparent' }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleScheduleTarget('item', item.id)} style={{ accentColor: 'var(--brand)' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: sel ? 700 : 400 }}>{item.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{adminCategories.find(c => c.id === item.category)?.name}</span>
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
                            {adminCategories.map(c => (
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
      {/* MEALS RANK MODAL */}
      {showRankModal && (
        <div className="modal-backdrop" onClick={() => setShowRankModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 450, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>↕️ Meals &amp; Categories Ranking</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRankModal(false)} style={{ padding: 4 }}>
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 4, marginBottom: 16 }}>
              <button
                onClick={() => setRankTab('categories')}
                style={{
                  flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: rankTab === 'categories' ? 'var(--brand)' : 'transparent',
                  color: rankTab === 'categories' ? '#000000' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >Categories Rank</button>
              <button
                onClick={() => setRankTab('meals')}
                style={{
                  flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: rankTab === 'meals' ? 'var(--brand)' : 'transparent',
                  color: rankTab === 'meals' ? '#000000' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >Meals Rank</button>
            </div>

            {rankTab === 'meals' && (
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Select Category to Rank Meals</label>
                <select 
                  className="input" 
                  value={rankCategoryId} 
                  onChange={e => handleRankCategoryChange(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  {orderedCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* List */}
            <div style={{
              maxHeight: 250,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 0',
              background: 'var(--bg-elevated)',
              marginBottom: 20
            }}>
              {rankTab === 'categories' ? (
                orderedCategories.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No categories found</div>
                ) : (
                  orderedCategories.map((cat, idx) => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: idx < orderedCategories.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{cat.icon} {cat.name}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={idx === 0} onClick={() => moveCategory(idx, 'up')} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}>▲</button>
                        <button disabled={idx === orderedCategories.length - 1} onClick={() => moveCategory(idx, 'down')} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}>▼</button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                orderedMeals.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No meals in this category</div>
                ) : (
                  orderedMeals.map((meal, idx) => (
                    <div key={meal.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: idx < orderedMeals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, display: 'inline-block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {meal.name}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button disabled={idx === 0} onClick={() => moveMeal(idx, 'up')} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}>▲</button>
                        <button disabled={idx === orderedMeals.length - 1} onClick={() => moveMeal(idx, 'down')} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}>▼</button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            <button onClick={handleSaveRanks} className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000', fontWeight: 800, height: 38 }}>
              Save Sequence Rankings
            </button>
          </div>
        </div>
      )}

      {bulkAiLoading && (
        <div className="modal-backdrop" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24, textAlign: 'center', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', borderRadius: 16 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Generating AI Descriptions</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Please keep this page open. Generating menu descriptions using Gemini AI...
            </p>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', marginBottom: 8 }}>
              {bulkAiProgress.current} of {bulkAiProgress.total} items
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{
                height: '100%',
                background: 'var(--brand)',
                width: `${(bulkAiProgress.current / bulkAiProgress.total) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>
              Self-healing key rotation active. Respecting API rate limits...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

