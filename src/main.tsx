import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register Service Worker with immediate activation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        // Force check for a new SW version immediately
        reg.update();

        // If a new SW is waiting, skip waiting so it activates immediately
        // without requiring the user to close all tabs
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New SW installed and old one active — force immediate activation
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        console.log('[SW] Registered. Scope:', reg.scope);
      },
      (err) => console.warn('[SW] Registration failed:', err)
    );

    // When the controlling SW changes, reload the page so fresh assets are loaded
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
