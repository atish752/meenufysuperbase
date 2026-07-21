// Compatibility adapter forwarding to Supabase backend
import {
  supabase,
  hasSupabaseConfig,
  dbGet,
  dbSet,
  dbUpdate,
  dbRemove,
  dbSubscribe,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged
} from './supabase';

export {
  supabase as db,
  supabase as auth,
  hasSupabaseConfig as hasFirebaseConfig,
  hasSupabaseConfig,
  supabase,
  dbGet,
  dbSet,
  dbUpdate,
  dbRemove,
  dbSubscribe,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged
};

export const googleProvider = {};
