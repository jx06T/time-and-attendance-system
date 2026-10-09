import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallContextValue {
  installed: boolean;
  showSuggestion: boolean;
  isIos: boolean;
  openInstall: () => Promise<void>;
  dismissSuggestion: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);
const dismissalKey = 'pwa-install-suggestion-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(dismissalKey) === 'true'; }
    catch { return false; }
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismissSuggestion = () => {
    setDismissed(true);
    try { window.localStorage.setItem(dismissalKey, 'true'); }
    catch { /* Storage may be unavailable in a private browser session. */ }
  };

  const openInstall = async () => {
    if (installed) return;
    if (!promptEvent) {
      setShowInstructions(true);
      return;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      dismissSuggestion();
    } catch {
      setShowInstructions(true);
    } finally {
      setPromptEvent(null);
    }
  };

  return (
    <PwaInstallContext.Provider value={{
      installed,
      showSuggestion: !installed && !dismissed && (!!promptEvent || isIos),
      isIos,
      openInstall,
      dismissSuggestion,
    }}>
      {children}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowInstructions(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            className="w-full max-w-sm rounded-xl border border-accent-li/40 bg-gray-900 p-6 text-neutral shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="install-title" className="mb-3 text-xl font-bold">安裝打卡系統</h2>
            {isIos ? (
              <p className="leading-7 text-gray-200">在瀏覽器中點選「分享」，再選「加入主畫面」，最後點選「加入」。若選單沒有此項，請改用 Safari 開啟本網站。</p>
            ) : (
              <p className="leading-7 text-gray-200">請開啟瀏覽器選單，選擇「安裝應用程式」或「新增至主畫面」。若目前在其他 App 的內建瀏覽器，請先改用一般瀏覽器開啟。</p>
            )}
            <button type="button" onClick={() => setShowInstructions(false)} className="mt-6 w-full rounded-lg bg-accent px-4 py-2 font-semibold hover:bg-accent/80">知道了</button>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error('usePwaInstall must be used within PwaInstallProvider');
  return context;
}
