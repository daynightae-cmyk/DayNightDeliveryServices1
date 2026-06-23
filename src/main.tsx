import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './lib/AppContext.tsx';
import { reportError } from './lib/monitoring';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, 'window_error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'unhandled_rejection');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        reportError(error, 'service_worker_register');
      });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

