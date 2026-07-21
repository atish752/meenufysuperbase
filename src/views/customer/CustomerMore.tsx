import { useState, useEffect } from 'react';
import { useStore, getActiveRestaurantId, getActiveRestaurantInfo } from '../../context/RealtimeStore';
import { Wifi, LogIn, LogOut, User, Lock, Sparkles, MessageSquare, PhoneCall, Send, History } from 'lucide-react';
import { hasFirebaseConfig } from '../../utils/firebase';
import { dbGet, dbSet, dbUpdate, supabase as supabaseClient } from '../../utils/supabase';

export default function CustomerMore() {
  const { state, addToast } = useStore();
  const restaurantId = getActiveRestaurantId(state);
  const restaurant = getActiveRestaurantInfo(state, restaurantId);

  // Auth Modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [googleStep, setGoogleStep] = useState<'none' | 'details'>('none');

  // Registration Form state
  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUniqueId, setRegUniqueId] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Login Form state
  const [loginInput, setLoginInput] = useState(''); // phone, email, or uniqueId
  const [loginPassword, setLoginPassword] = useState('');

  // Google Temp form state
  const [googleUserTemp, setGoogleUserTemp] = useState<any>(null);

  // Profile edit states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUniqueId, setEditUniqueId] = useState('');

  // Saved Address States
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrFull, setAddrFull] = useState('');
  const [addrMapLink, setAddrMapLink] = useState('');
  const [addrLat, setAddrLat] = useState<number | undefined>(undefined);
  const [addrLng, setAddrLng] = useState<number | undefined>(undefined);
  const [fetchingAddrLocation, setFetchingAddrLocation] = useState(false);

  // Check if logged in
  const [loggedInUser, setLoggedInUser] = useState<any>(() => {
    try {
      const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
      if (savedGoogle) return JSON.parse(savedGoogle);
      const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
      if (savedCustom) return JSON.parse(savedCustom);
      return null;
    } catch {
      return null;
    }
  });

  const isLoggedIn = !!loggedInUser;
  const savedPhone = loggedInUser?.phone || '';
  const customer = state.customers.find(c => c.phone === savedPhone.trim());


  // Help & Support ticketing states
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([]);
  const [ticketMessageText, setTicketMessageText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'bug' | 'feature' | 'other'>('feedback');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Sync state back to local storage loggedInUser
  useEffect(() => {
    const checkUser = () => {
      const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
      const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
      const user = savedGoogle ? JSON.parse(savedGoogle) : (savedCustom ? JSON.parse(savedCustom) : null);
      setLoggedInUser(user);
    };
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  // Fetch support tickets and feedback for this user
  useEffect(() => {
    if (!isLoggedIn || !savedPhone) {
      setMyTickets([]);
      setMyFeedbacks([]);
      return;
    }

    const fetchTickets = async () => {
      try {
        const supportData = await dbGet('supportRequests');
        if (supportData) {
          const list = Object.values(supportData).filter((t: any) => t.ownerPhone === savedPhone);
          list.sort((a: any, b: any) => b.createdAt - a.createdAt);
          setMyTickets(list);
        }
      } catch (err) { console.error('Error reading support requests:', err); }

      try {
        const fbData = await dbGet('ownerFeedbacks');
        if (fbData) {
          const list = Object.values(fbData).filter((f: any) => f.ownerEmail === loggedInUser.email || f.ownerPhone === savedPhone || f.ownerName?.includes(loggedInUser.name));
          list.sort((a: any, b: any) => b.createdAt - a.createdAt);
          setMyFeedbacks(list);
        }
      } catch (err) { console.error('Error reading feedbacks:', err); }
    };

    fetchTickets();
    const interval = setInterval(fetchTickets, 25000);
    return () => clearInterval(interval);
  }, [isLoggedIn, savedPhone]);


  const handleGoogleSignIn = async () => {
    if (hasFirebaseConfig && supabaseClient) {
      try {
        localStorage.setItem('meenufy_auth_role', 'customer');
        const { error: oauthError } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname + window.location.search
          }
        });
        if (oauthError) throw oauthError;
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return;
        const matched = state.customers.find(c => c.email === user.email);

        if (matched) {
          const localUser = {
            name: matched.name,
            phone: matched.phone,
            email: matched.email || user.email || '',
            uniqueId: matched.uniqueId || '',
            googleId: user.id
          };
          localStorage.setItem('meenufy_customer_google_user', JSON.stringify(localUser));
          localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(localUser));
          localStorage.setItem('meenufy_customer_user_logged_in', 'true');
          setLoggedInUser(localUser);

          const cleanPhone = matched.phone.replace(/[^a-zA-Z0-9]/g, '');
          dbUpdate(`customers/${restaurantId}/${cleanPhone}`, { googleId: user.id })
            .catch((e: any) => console.error('Failed to link Google ID in DB:', e));

          setShowAuthModal(false);
          addToast('success', `Welcome back, ${matched.name}! Signed in via Google.`);
        } else {
          setGoogleUserTemp({
            name: user.user_metadata?.full_name || '',
            email: user.email || '',
            googleId: user.id
          });
          setGoogleStep('details');
        }
      } catch (err: any) {
        console.error(err);
        addToast('error', `Google Sign-In failed: ${err.message}`);
      }
    } else {
      setGoogleUserTemp({ name: 'Google Mock User', email: 'google.mock@gmail.com', googleId: 'mock-google-id' });
      setGoogleStep('details');
    }
  };

  const handleGoogleCompleteDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPhone.trim()) {
      addToast('error', 'Phone number is required.');
      return;
    }

    const cleanPhone = regPhone.replace(/[^a-zA-Z0-9]/g, '');
    const matchedPhone = state.customers.find(c => c.phone === regPhone.trim());
    if (matchedPhone && (matchedPhone.googleId || matchedPhone.password)) {
      addToast('error', 'An account with this phone number already exists.');
      return;
    }

    const newUser = {
      name: googleUserTemp.name,
      email: googleUserTemp.email,
      phone: regPhone.trim(),
      uniqueId: regUniqueId.trim() || matchedPhone?.uniqueId || `user_${cleanPhone}`,
      googleId: googleUserTemp.googleId
    };

    localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(newUser));
    localStorage.setItem('meenufy_customer_user_logged_in', 'true');
    setLoggedInUser(newUser);

    // Save/Sync customer to Supabase database
    if (hasFirebaseConfig) {
      if (matchedPhone) {
        const dbCustUpdates = {
          googleId: newUser.googleId,
          name: newUser.name,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          lastVisit: Date.now()
        };
        dbUpdate(`customers/${restaurantId}/${cleanPhone}`, dbCustUpdates)
          .catch((e: any) => console.error('Failed to update Google customer:', e));
      } else {
        const dbCust = {
          id: `cust-${Date.now()}`,
          name: newUser.name,
          phone: newUser.phone,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          googleId: newUser.googleId,
          orderCount: 0,
          totalSpent: 0,
          lastVisit: Date.now(),
          firstVisit: Date.now(),
          points: 0,
          isVip: false
        };
        dbSet(`customers/${restaurantId}/${cleanPhone}`, dbCust)
          .catch((e: any) => console.error('Failed to save Google customer:', e));
      }
    }

    setShowAuthModal(false);
    setGoogleStep('none');
    setGoogleUserTemp(null);
    setRegPhone('');
    setRegUniqueId('');
    addToast('success', 'Sign up complete! Welcome to our Loyalty Program!');
  };

  const handleCustomSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !regPhone.trim() || !regPassword.trim()) {
      addToast('error', 'Name, Phone, and Password are required.');
      return;
    }

    const cleanPhone = regPhone.replace(/[^a-zA-Z0-9]/g, '');
    const matchedPhone = state.customers.find(c => c.phone === regPhone.trim());
    if (matchedPhone && (matchedPhone.password || matchedPhone.googleId)) {
      addToast('error', 'An account with this phone number already exists.');
      return;
    }
    if (regUniqueId.trim()) {
      const matchedId = state.customers.find(c => c.uniqueId === regUniqueId.trim());
      if (matchedId && matchedId.phone !== regPhone.trim()) {
        addToast('error', 'This Unique ID is already taken.');
        return;
      }
    }

    const newUser = {
      name: fullName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim() || matchedPhone?.email || '',
      uniqueId: regUniqueId.trim() || matchedPhone?.uniqueId || `user_${cleanPhone}`
    };

    localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(newUser));
    localStorage.setItem('meenufy_customer_user_logged_in', 'true');
    setLoggedInUser(newUser);

    // Save/Sync to Supabase
    if (hasFirebaseConfig) {
      if (matchedPhone) {
        const dbCustUpdates = {
          name: newUser.name,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          password: regPassword.trim(),
          lastVisit: Date.now()
        };
        dbUpdate(`customers/${restaurantId}/${cleanPhone}`, dbCustUpdates)
          .catch((e: any) => console.error('Failed to update custom customer:', e));
      } else {
        const dbCust = {
          id: `cust-${Date.now()}`,
          name: newUser.name,
          phone: newUser.phone,
          email: newUser.email,
          uniqueId: newUser.uniqueId,
          password: regPassword.trim(),
          orderCount: 0,
          totalSpent: 0,
          lastVisit: Date.now(),
          firstVisit: Date.now(),
          points: 0,
          isVip: false
        };
        dbSet(`customers/${restaurantId}/${cleanPhone}`, dbCust)
          .catch((e: any) => console.error('Failed to save custom customer:', e));
      }
    }

    setShowAuthModal(false);
    setFullName('');
    setRegPhone('');
    setRegEmail('');
    setRegUniqueId('');
    setRegPassword('');
    addToast('success', 'Account created successfully! Welcome!');
  };

  const handleCustomSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !loginPassword.trim()) {
      addToast('error', 'Please enter your login details and password.');
      return;
    }

    const input = loginInput.trim();
    const pass = loginPassword.trim();

    // Look up customer account
    const matched = state.customers.find(c => 
      c.phone === input || 
      c.email === input || 
      c.uniqueId === input
    );

    if (matched) {
      if (!matched.password) {
        addToast('error', 'This account has not set a password yet. Please use the "Sign Up" tab to register.');
        return;
      }

      if (matched.password !== pass) {
        addToast('error', 'Incorrect password. Please try again.');
        return;
      }

      const localUser = {
        name: matched.name,
        phone: matched.phone,
        email: matched.email || '',
        uniqueId: matched.uniqueId || ''
      };

      localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify(localUser));
      localStorage.setItem('meenufy_customer_user_logged_in', 'true');
      setLoggedInUser(localUser);
      setShowAuthModal(false);
      setLoginInput('');
      setLoginPassword('');
      addToast('success', `Welcome back, ${matched.name}!`);
    } else {
      addToast('error', 'No registered profile found matching those details.');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('meenufy_customer_google_user');
    localStorage.removeItem('meenufy_customer_logged_in_user');
    localStorage.removeItem('meenufy_customer_user_logged_in');
    setLoggedInUser(null);
    addToast('success', 'Logged out successfully.');
  };

  const handleOpenProfile = () => {
    if (customer) {
      setEditName(customer.name || '');
      setEditPhone(customer.phone || '');
      setEditEmail(customer.email || '');
      setEditUniqueId(customer.uniqueId || '');
      setShowProfileModal(true);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const oldPhone = customer.phone.trim();
    const newPhone = editPhone.trim();
    const oldClean = oldPhone.replace(/[^a-zA-Z0-9]/g, '');
    const newClean = newPhone.replace(/[^a-zA-Z0-9]/g, '');

    if (!editName.trim() || !newPhone) {
      addToast('error', 'Name and Phone number are required.');
      return;
    }

    if (editUniqueId.trim() && editUniqueId.trim() !== customer.uniqueId) {
      const matchedId = state.customers.find(c => c.uniqueId === editUniqueId.trim());
      if (matchedId) {
        addToast('error', 'This Unique ID is already taken.');
        return;
      }
    }

    if (newPhone !== oldPhone) {
      const matchedPhone = state.customers.find(c => c.phone === newPhone);
      if (matchedPhone && (matchedPhone.password || matchedPhone.googleId)) {
        addToast('error', 'An account with this phone number already exists.');
        return;
      }
    }

    const updatedUser = {
      ...customer,
      name: editName.trim(),
      phone: newPhone,
      email: editEmail.trim(),
      uniqueId: editUniqueId.trim() || `user_${newClean}`
    };

    const savedGoogle = localStorage.getItem('meenufy_customer_google_user');
    const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
    if (savedGoogle) {
      localStorage.setItem('meenufy_customer_google_user', JSON.stringify({
        ...JSON.parse(savedGoogle),
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        uniqueId: updatedUser.uniqueId
      }));
    }
    if (savedCustom) {
      localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify({
        ...JSON.parse(savedCustom),
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        uniqueId: updatedUser.uniqueId
      }));
    }
    setLoggedInUser(updatedUser);

    if (hasFirebaseConfig) {
      try {
        if (newPhone !== oldPhone) {
          const migratedCustomer = {
            ...customer,
            name: updatedUser.name,
            phone: updatedUser.phone,
            email: updatedUser.email,
            uniqueId: updatedUser.uniqueId,
            lastVisit: Date.now()
          };
          await dbSet(`customers/${restaurantId}/${newClean}`, migratedCustomer);
          await dbSet(`customers/${restaurantId}/${oldClean}`, null);
        } else {
          const dbCustUpdates = {
            name: updatedUser.name,
            email: updatedUser.email,
            uniqueId: updatedUser.uniqueId,
            lastVisit: Date.now()
          };
          await dbUpdate(`customers/${restaurantId}/${oldClean}`, dbCustUpdates);
        }
        addToast('success', 'Profile updated successfully.');
        setShowProfileModal(false);
      } catch (err: any) {
        console.error('Failed to update profile:', err);
        addToast('error', `Failed to sync profile: ${err.message}`);
      }
    } else {
      addToast('success', 'Profile updated locally (Demo mode).');
      setShowProfileModal(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!customer) return;
    if (hasFirebaseConfig && supabaseClient) {
      try {
        localStorage.setItem('meenufy_auth_role', 'customer');
        const { error: oauthError } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname + window.location.search
          }
        });
        if (oauthError) throw oauthError;
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return;

        const matchedGoogle = state.customers.find(c => c.googleId === user.id && c.phone !== customer.phone);
        if (matchedGoogle) {
          addToast('error', 'This Google account is already linked to another profile.');
          return;
        }

        const cleanPhone = customer.phone.replace(/[^a-zA-Z0-9]/g, '');
        await dbUpdate(`customers/${restaurantId}/${cleanPhone}`, {
          googleId: user.id,
          email: user.email || customer.email || ''
        });

        const savedCustom = localStorage.getItem('meenufy_customer_logged_in_user');
        if (savedCustom) {
          const parsed = JSON.parse(savedCustom);
          localStorage.setItem('meenufy_customer_logged_in_user', JSON.stringify({
            ...parsed,
            googleId: user.id,
            email: user.email || parsed.email || ''
          }));
        }
        setLoggedInUser({
          ...loggedInUser,
          googleId: user.id,
          email: user.email || loggedInUser.email || ''
        });

        addToast('success', 'Google account linked successfully!');
      } catch (err: any) {
        console.error('Google link failed:', err);
        addToast('error', `Google linking failed: ${err.message}`);
      }
    } else {
      addToast('success', 'Google account linked (Demo mode).');
      setLoggedInUser({
        ...loggedInUser,
        googleId: 'mock-linked-google-id'
      });
    }
  };

  const handleRaiseTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketMessageText.trim()) {
      addToast('error', 'Please describe the issue you are facing.');
      return;
    }
    if (!isLoggedIn || !savedPhone) {
      addToast('error', 'Please sign in to raise a support ticket.');
      return;
    }

    setIsSubmittingSupport(true);
    const ticketId = `ticket-${Date.now()}`;
    const ticketData = {
      id: ticketId,
      restaurantId: restaurantId || 'customer',
      restaurantName: restaurant.name || 'Customer App User',
      ownerName: `Customer: ${loggedInUser.name}`,
      ownerEmail: loggedInUser.email || 'No Email',
      ownerPhone: savedPhone,
      message: ticketMessageText.trim(),
      status: 'pending',
      createdAt: Date.now(),
      isCustomerTicket: true
    };

    if (hasFirebaseConfig) {
      dbSet(`supportRequests/${ticketId}`, ticketData)
        .then(() => {
          addToast('success', 'Support ticket raised successfully! We will contact you soon.');
          setTicketMessageText('');
          setIsSubmittingSupport(false);
          setMyTickets(prev => [ticketData, ...prev]);
        })
        .catch(err => {
          console.error(err);
          addToast('error', 'Failed to raise support ticket.');
          setIsSubmittingSupport(false);
        });
    } else {
      setTimeout(() => {
        addToast('success', 'Support ticket raised successfully (Demo mode).');
        setTicketMessageText('');
        setIsSubmittingSupport(false);
        setMyTickets(prev => [ticketData, ...prev]);
      }, 1000);
    }
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      addToast('error', 'Please enter your feedback or suggestion.');
      return;
    }
    if (!isLoggedIn) {
      addToast('error', 'Please sign in to submit feedback.');
      return;
    }

    setIsSubmittingFeedback(true);
    const fbId = `fb-${Date.now()}`;
    const fbData = {
      id: fbId,
      restaurantId: restaurantId || 'customer',
      restaurantName: restaurant.name || 'Customer App User',
      ownerName: `Customer: ${loggedInUser.name}`,
      ownerEmail: loggedInUser.email || 'No Email',
      message: feedbackText.trim(),
      ticketType: feedbackType,
      createdAt: Date.now(),
      isCustomerTicket: true
    };

    if (hasFirebaseConfig) {
      dbSet(`ownerFeedbacks/${fbId}`, fbData)
        .then(() => {
          addToast('success', 'Feedback submitted successfully! Thank you!');
          setFeedbackText('');
          setIsSubmittingFeedback(false);
          setMyFeedbacks(prev => [fbData, ...prev]);
        })
        .catch(err => {
          console.error(err);
          addToast('error', 'Failed to submit feedback.');
          setIsSubmittingFeedback(false);
        });
    } else {
      setTimeout(() => {
        addToast('success', 'Feedback submitted successfully (Demo mode).');
        setFeedbackText('');
        setIsSubmittingFeedback(false);
        setMyFeedbacks(prev => [fbData, ...prev]);
      }, 1000);
    }
  };

  const handleOpenAddressModal = (addr?: any) => {
    if (addr) {
      setEditingAddressId(addr.id);
      setAddrName(addr.name || '');
      setAddrPhone(addr.phone || '');
      setAddrFull(addr.fullAddress || '');
      setAddrMapLink(addr.mapLink || '');
      setAddrLat(addr.lat);
      setAddrLng(addr.lng);
    } else {
      setEditingAddressId(null);
      setAddrName(loggedInUser?.name || '');
      setAddrPhone(loggedInUser?.phone || '');
      setAddrFull('');
      setAddrMapLink('');
      setAddrLat(undefined);
      setAddrLng(undefined);
    }
    setShowAddressModal(true);
  };

  const handleSaveAddress = () => {
    if (!addrName.trim()) { addToast('error', 'Name is required.'); return; }
    if (!addrPhone.trim()) { addToast('error', 'Phone number is required.'); return; }
    if (!addrFull.trim()) { addToast('error', 'Full address is required.'); return; }

    const addressId = editingAddressId || `addr-${Date.now()}`;
    const newAddress = {
      id: addressId,
      name: addrName.trim(),
      phone: addrPhone.trim(),
      fullAddress: addrFull.trim(),
      mapLink: addrMapLink.trim(),
      lat: addrLat,
      lng: addrLng
    };

    const currentAddresses = customer?.savedAddresses || [];
    let updatedAddresses = [];
    if (editingAddressId) {
      updatedAddresses = currentAddresses.map((a: any) => a.id === editingAddressId ? newAddress : a);
    } else {
      updatedAddresses = [...currentAddresses, newAddress];
    }

    if (hasFirebaseConfig && customer) {
      const cleanPhone = (customer.phone || '').replace(/[^a-zA-Z0-9]/g, '');
      dbUpdate(`customers/${restaurantId}/${cleanPhone}`, {
        savedAddresses: updatedAddresses
      }).then(() => {
        addToast('success', editingAddressId ? 'Address updated!' : 'Address saved!');
        setShowAddressModal(false);
      }).catch((err: any) => {
        console.error(err);
        addToast('error', 'Failed to save address.');
      });
    } else {
      addToast('success', 'Address saved locally.');
      setShowAddressModal(false);
    }
  };

  const handleDeleteAddress = (id: string) => {
    if (!customer) return;
    const currentAddresses = customer.savedAddresses || [];
    const updatedAddresses = currentAddresses.filter((a: any) => a.id !== id);

    if (hasFirebaseConfig) {
      const cleanPhone = (customer.phone || '').replace(/[^a-zA-Z0-9]/g, '');
      dbUpdate(`customers/${restaurantId}/${cleanPhone}`, {
        savedAddresses: updatedAddresses
      }).then(() => {
        addToast('success', 'Address deleted.');
      }).catch((err: any) => {
        console.error(err);
        addToast('error', 'Failed to delete address.');
      });
    }
  };

  const handleAddrLocateMe = () => {
    if (!navigator.geolocation) {
      addToast('error', 'Geolocation not supported by your browser.');
      return;
    }
    setFetchingAddrLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setAddrLat(lat);
        setAddrLng(lng);
        setAddrMapLink(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.display_name) {
              setAddrFull(data.display_name);
            }
          })
          .catch(err => {
            console.error('Reverse geocode error:', err);
          });

        addToast('success', 'GPS Location captured successfully!');
        setFetchingAddrLocation(false);
      },
      (err) => {
        console.error(err);
        addToast('error', 'Unable to fetch current location. Check browser permissions.');
        setFetchingAddrLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div style={{ padding: '20px', animation: 'fadeIn 0.3s ease', paddingBottom: 80 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
        Details &amp; Support
      </h2>

      {/* Account Login / Signout Card */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--brand-dim)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <User size={18} color="var(--brand)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isLoggedIn ? `Welcome, ${loggedInUser.name}` : 'Guest Profile'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {isLoggedIn ? (
                <span>
                  {loggedInUser.googleId || customer?.googleId ? 'Logged in with -Google' : 'Registered Member'} • {loggedInUser.phone}
                </span>
              ) : (
                'Sign in to access order history & loyalty points.'
              )}
            </div>
          </div>
        </div>

        {isLoggedIn ? (
          <button
            onClick={handleSignOut}
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--error)', borderColor: 'var(--error)', background: 'transparent', height: 32, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        ) : (
          <button
            onClick={() => {
              setAuthTab('signin');
              setShowAuthModal(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ background: 'var(--brand)', color: '#000', height: 32, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
          >
            <LogIn size={13} /> Sign In
          </button>
        )}
      </div>

      {/* Profile Details Block */}
      {isLoggedIn && customer && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
            👤 Profile Settings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Name</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Phone</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.phone}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Email</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.email || 'Not provided'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Username / Unique ID</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{customer.uniqueId || 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Google Link</span>
              <span style={{ color: customer.googleId ? 'var(--brand)' : 'var(--text-muted)', fontWeight: 600 }}>
                {customer.googleId ? '✅ Linked' : '❌ Not Linked'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleOpenProfile}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, fontSize: 11, fontWeight: 700 }}
              >
                Edit Profile details
              </button>
              {!customer.googleId && (
                <button
                  onClick={handleLinkGoogle}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, fontSize: 11, fontWeight: 800, background: 'var(--brand)', color: '#000' }}
                >
                  Link Google Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved Addresses Block */}
      {isLoggedIn && customer && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              🏠 Saved Addresses
            </h4>
            <button
              onClick={() => handleOpenAddressModal()}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', height: 26 }}
            >
              ➕ Add New
            </button>
          </div>

          {(!customer.savedAddresses || customer.savedAddresses.length === 0) ? (
            <div style={{ padding: '14px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No saved addresses. Add one to speed up delivery orders!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {customer.savedAddresses.map((addr: any) => (
                <div key={addr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {addr.name}
                      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>({addr.phone})</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {addr.fullAddress}
                    </div>
                    {addr.mapLink && (
                      <a
                        href={addr.mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--brand)', textDecoration: 'none', marginTop: 6, fontWeight: 600 }}
                      >
                        📍 View on Google Maps
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleOpenAddressModal(addr)}
                      style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 4 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 4 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help & Support Card */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={16} color="var(--brand)" />
          Help &amp; Support
        </h4>

        {/* Contact Hotline Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <a
            href="tel:+919798482404"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--brand)',
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            <PhoneCall size={14} /> Call Support: +91 9798482404
          </a>
          <a
            href="mailto:meenufy@gmail.com"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--brand)',
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            ✉️ Email Support: meenufy@gmail.com
          </a>
        </div>

        {isLoggedIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Raise support request ticket */}
            <form onSubmit={handleRaiseTicket} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Raise a Support Ticket</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Describe any issue you are facing (payment, orders, app bugs)..."
                value={ticketMessageText}
                onChange={e => setTicketMessageText(e.target.value)}
                style={{ resize: 'none', fontSize: 12 }}
              />
              <button
                type="submit"
                disabled={isSubmittingSupport}
                className="btn btn-primary btn-sm"
                style={{ background: 'var(--brand)', color: '#000', fontWeight: 800, alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Send size={12} /> {isSubmittingSupport ? 'Raising...' : 'Raise Ticket'}
              </button>
            </form>

            {/* Give feedback / suggestions */}
            <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Send Feedback / Suggestions</label>
              <select
                className="input"
                value={feedbackType}
                onChange={e => setFeedbackType(e.target.value as any)}
                style={{ fontSize: 12 }}
              >
                <option value="feedback">General Feedback</option>
                <option value="feature">Feature Suggestion</option>
                <option value="bug">Report an Issue</option>
                <option value="other">Other</option>
              </select>
              <textarea
                className="input"
                rows={3}
                placeholder="Share your thoughts or ideas to improve Meenufy..."
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                style={{ resize: 'none', fontSize: 12 }}
              />
              <button
                type="submit"
                disabled={isSubmittingFeedback}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 800, alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Send size={12} /> {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            Sign in to submit support tickets, report bugs, or share feature requests.
          </div>
        )}
      </div>

      {/* Ticket History Section */}
      {isLoggedIn && (myTickets.length > 0 || myFeedbacks.length > 0) && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={16} color="var(--brand)" />
            Your Ticket &amp; Feedback History
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
            {myTickets.map(t => (
              <div key={t.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)' }}>Support Ticket</span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: t.status === 'resolved' ? '#22c55e20' : '#f59e0b20',
                    color: t.status === 'resolved' ? '#22c55e' : '#f59e0b'
                  }}>{t.status === 'resolved' ? 'RESOLVED' : 'PENDING'}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{t.message}</p>
                {t.replyText && (
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--border-dim)', borderRadius: 8, borderLeft: '3px solid var(--brand)' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 2 }}>Admin Reply:</div>
                    <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{t.replyText}</p>
                  </div>
                )}
              </div>
            ))}

            {myFeedbacks.map(f => (
              <div key={f.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)' }}>
                    {f.ticketType === 'bug' ? '🐛 Bug Report' : f.ticketType === 'feature' ? '💡 Suggestion' : '💬 Feedback'}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{f.message}</p>
                {f.replyText && (
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--border-dim)', borderRadius: 8, borderLeft: '3px solid var(--brand)' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 2 }}>Admin Reply:</div>
                    <p style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{f.replyText}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Powered by */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 99,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        }}>
          <Wifi size={12} color="var(--brand)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
            Powered by <span style={{ color: 'var(--brand)' }}>Meenufy</span> — A hassle-free way
          </span>
        </div>
      </div>

      {/* CUSTOM AUTH MODAL */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="var(--brand)" />
                <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Customer Authentication</h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowAuthModal(false); setGoogleStep('none'); }} style={{ padding: 4 }}>
                &times;
              </button>
            </div>

            {googleStep === 'details' ? (
              <form onSubmit={handleGoogleCompleteDetailsSubmit}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Google Authentication Success!</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Logged in as: {googleUserTemp.name} ({googleUserTemp.email})</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Please link a phone number and optionally choose a Unique ID (username) to unlock rewards.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div className="input-group">
                    <label className="input-label">Phone Number (Required)</label>
                    <input className="input" type="tel" required placeholder="+91 98765 43210" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Unique ID / Username (Optional)</label>
                    <input className="input" type="text" placeholder="e.g. ananya_99" value={regUniqueId} onChange={e => setRegUniqueId(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38 }}>
                  Complete Profile &amp; Register
                </button>
              </form>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 4, marginBottom: 20 }}>
                  <button
                    onClick={() => setAuthTab('signin')}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: authTab === 'signin' ? 'var(--brand)' : 'transparent',
                      color: authTab === 'signin' ? '#000000' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >Sign In</button>
                  <button
                    onClick={() => setAuthTab('signup')}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: authTab === 'signup' ? 'var(--brand)' : 'transparent',
                      color: authTab === 'signup' ? '#000000' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >Sign Up</button>
                </div>

                {authTab === 'signin' ? (
                  <form onSubmit={handleCustomSignIn}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                      <div className="input-group">
                        <label className="input-label">Phone, Email or Unique ID</label>
                        <div style={{ position: 'relative' }}>
                          <User size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
                          <input className="input" style={{ paddingLeft: 32 }} type="text" required placeholder="Phone, email, or unique ID" value={loginInput} onChange={e => setLoginInput(e.target.value)} />
                        </div>
                      </div>
                      <div className="input-group">
                        <label className="input-label">Password</label>
                        <div style={{ position: 'relative' }}>
                          <Lock size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
                          <input className="input" style={{ paddingLeft: 32 }} type="password" required placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38, marginBottom: 16 }}>
                      Sign In
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleCustomSignUp}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                      <div className="input-group">
                        <label className="input-label">Full Name *</label>
                        <input className="input" type="text" required placeholder="Ananya Patel" value={fullName} onChange={e => setFullName(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Phone Number *</label>
                        <input className="input" type="tel" required placeholder="+91 98765 43210" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Email (Optional)</label>
                        <input className="input" type="email" placeholder="ananya@gmail.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Unique ID / Username (Optional)</label>
                        <input className="input" type="text" placeholder="ananya_99" value={regUniqueId} onChange={e => setRegUniqueId(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Password *</label>
                        <input className="input" type="password" required placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38, marginBottom: 16 }}>
                      Sign Up &amp; Register
                    </button>
                  </form>
                )}

                {/* Google SSO divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--text-muted)', fontSize: 11 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  className="btn btn-secondary btn-full"
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 12, fontWeight: 700, padding: '9px 0', borderRadius: 99,
                    cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border)'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* PROFILE EDIT MODAL */}
      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800 }}>Edit Profile details</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowProfileModal(false)} style={{ padding: 4 }}>
                &times;
              </button>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div className="input-group">
                  <label className="input-label">Full Name *</label>
                  <input className="input" type="text" required value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Phone Number *</label>
                  <input className="input" type="tel" required value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unique ID / Username</label>
                  <input className="input" type="text" value={editUniqueId} onChange={e => setEditUniqueId(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ background: 'var(--brand)', color: '#000000', fontWeight: 800, height: 38 }}>
                Save Profile changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Address Edit/Add Modal */}
      {showAddressModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 20, border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
            <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 16 }}>
              {editingAddressId ? '📝 Edit Address' : '🏠 Add Saved Address'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Recipient Name</label>
                <input
                  className="input"
                  type="text"
                  value={addrName}
                  onChange={e => setAddrName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Recipient Phone (Mandatory)</label>
                <input
                  className="input"
                  type="tel"
                  value={addrPhone}
                  onChange={e => setAddrPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Full Delivery Address</label>
                <textarea
                  className="input"
                  rows={3}
                  value={addrFull}
                  onChange={e => setAddrFull(e.target.value)}
                  placeholder="Street, Building, Flat No., City, Landmark"
                />
              </div>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="input-label" style={{ margin: 0 }}>Google Maps Link / GPS Coordinates</label>
                  <button
                    type="button"
                    onClick={handleAddrLocateMe}
                    disabled={fetchingAddrLocation}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10, height: 24, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                  >
                    📍 {fetchingAddrLocation ? 'Locating...' : 'Locate Me (GPS)'}
                  </button>
                </div>
                <input
                  className="input"
                  type="text"
                  value={addrMapLink}
                  onChange={e => setAddrMapLink(e.target.value)}
                  placeholder="Optional Google Maps URL"
                />
                {addrLat && addrLng && (
                  <div style={{ fontSize: 9, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                    Coordinates Captured: {addrLat.toFixed(5)}, {addrLng.toFixed(5)}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="btn btn-secondary btn-full"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  className="btn btn-primary btn-full"
                  style={{ background: 'var(--brand)', color: '#000', fontWeight: 800 }}
                >
                  Save Address
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
