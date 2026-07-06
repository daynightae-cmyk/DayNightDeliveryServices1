import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './lib/AppContext.tsx';
import { reportError } from './lib/monitoring';
import './index.css';
import "./styles/dn-premium-admin-corrections.css";
import './styles/dn-premium.css';
import './styles/dn-ui-fixes.css';
import './styles/dn-support-polish.css';
import './styles/dn-floating-final.css';
import './styles/dn-admin-final-polish.css';

const FALLBACK_LOGO = 'https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      if (!img.dataset.dnFallbackApplied) {
        img.dataset.dnFallbackApplied = '1';
        img.decoding = 'async';
        img.loading = img.loading || 'lazy';
        img.src = FALLBACK_LOGO;
        img.classList.add('dn-image-fallback-applied');
        return;
      }
    }
    reportError(event.error || event.message, 'window_error');
  }, true);

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
