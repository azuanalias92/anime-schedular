import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'

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
