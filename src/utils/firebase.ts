import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCRilyFMSDmCkISroL4b7ACsOgAzjYxaWU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "meenufy.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://meenufy-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "meenufy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "meenufy.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "964717977668",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:964717977668:web:9377507a2a76865dc71c11",
};

// Check if we have the minimum required config variables to enable Firebase
const hasFirebaseConfig = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId
);

export const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;
export const db = app ? getDatabase(app, firebaseConfig.databaseURL) : null;
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider options if needed
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { hasFirebaseConfig };
