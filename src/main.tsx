import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({ immediate: true })

// Capture PWA install prompt for custom install button
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  (window as any).__pwaInstallPrompt = deferredPrompt;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
