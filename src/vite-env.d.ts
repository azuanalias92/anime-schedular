/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback?: (response: { credential: string }) => void;
    auto_select?: boolean;
    ux_mode?: 'popup' | 'redirect';
    login_uri?: string;
    nonce?: string;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: { type?: 'standard' | 'icon'; theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium' | 'small'; text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'; shape?: 'rectangular' | 'pill' | 'circle' | 'square' },
  ): void;
  cancel(): void;
}

interface Window {
  google?: { accounts: { id: GoogleIdentity } };
  __pwaInstallPrompt: BeforeInstallPromptEvent | null;
}
