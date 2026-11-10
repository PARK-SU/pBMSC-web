import { registerSW } from 'virtual:pwa-register';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface PwaState {
  supported: boolean;
  offlineReady: boolean;
  updateReady: boolean;
  online: boolean;
  installable: boolean;
  installed: boolean;
  error: string;
}
let state: Readonly<PwaState> = {
  supported: false,
  offlineReady: false,
  updateReady: false,
  online: true,
  installable: false,
  installed: false,
  error: '',
};
const listeners = new Set<() => void>();
let prompt: InstallPrompt | undefined;
let update: ((reloadPage?: boolean) => Promise<void>) | undefined;
const change = (next: Partial<PwaState>) => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};
export const pwaState = () => state;
export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function startPwa(): void {
  const supported = 'serviceWorker' in navigator && import.meta.env.PROD;
  change({
    supported,
    online: navigator.onLine,
    installed: matchMedia('(display-mode: standalone)').matches,
  });
  window.addEventListener('online', () => change({ online: true }));
  window.addEventListener('offline', () => change({ online: false }));
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    change({ installable: true });
  });
  window.addEventListener('appinstalled', () => {
    prompt = undefined;
    change({ installed: true, installable: false });
  });
  if (!supported) return;
  update = registerSW({
    immediate: true,
    onOfflineReady: () => change({ offlineReady: true, error: '' }),
    onNeedRefresh: () => change({ updateReady: true }),
    onNeedReload: () => {},
    onRegisterError: (error: unknown) => change({ error: String(error) }),
  });
  void navigator.serviceWorker.ready.then(() => change({ offlineReady: true }));
}
export async function installApp(): Promise<void> {
  if (!prompt) return;
  const event = prompt;
  prompt = undefined;
  change({ installable: false });
  await event.prompt();
  await event.userChoice;
}
export async function updateApp(): Promise<void> {
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
    once: true,
  });
  await update?.(true);
}
