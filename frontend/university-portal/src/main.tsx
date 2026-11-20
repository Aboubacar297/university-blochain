import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-serif/600.css';
import './styles/tokens.css';
import './styles/app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { ConsentProvider } from './components/CookieConsent';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <ConsentProvider>
              <App />
            </ConsentProvider>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
