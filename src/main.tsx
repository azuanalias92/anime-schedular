import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { applyTheme, messages, readLocale, readTheme } from './i18n'

// Apply saved preferences before the first render so the page doesn't flash.
applyTheme(readTheme())
document.documentElement.lang = messages[readLocale()].htmlLang

registerSW({ immediate: true })

// Capture PWA install prompt for custom install button
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  window.__pwaInstallPrompt = deferredPrompt;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics mode={import.meta.env.DEV ? 'development' : 'production'} />
  </StrictMode>,
)
