/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }): void;
  prompt(callback: (notification: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
  cancel(): void;
}

interface Window {
  google?: { accounts: { id: GoogleIdentity } };
  __pwaInstallPrompt: BeforeInstallPromptEvent | null;
}
