'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSince =
        (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return; // Only show again after 7 days
    }

    // Listen for Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show manual instructions after a delay
    if (ios) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(timer);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">E8</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Elev8 Comply</p>
              <p className="text-blue-100 text-xs">Install App</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-200 hover:text-white transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {isIOS ? (
            // iOS instructions
            <div>
              <p className="text-sm text-gray-700 mb-3 font-medium">
                Add to your Home Screen:
              </p>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span>
                    Tap the{' '}
                    <span className="font-medium">Share button</span>{' '}
                    <span className="inline-block">⬆️</span> in Safari
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>
                    Scroll down and tap{' '}
                    <span className="font-medium">&quot;Add to Home Screen&quot;</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span>
                    Tap <span className="font-medium">&quot;Add&quot;</span> to install
                  </span>
                </li>
              </ol>
              <button
                onClick={handleDismiss}
                className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Maybe later
              </button>
            </div>
          ) : (
            // Android install button
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Install Elev8 Comply on your device for faster access, offline
                viewing, and notifications.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-3 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
