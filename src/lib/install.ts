import { useCallback, useEffect, useState } from "react";

/** Not in lib.dom — Chromium-only, and still behind a proposal. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

// The event fires once, early — often before React has mounted the screen holding the button.
// Capture it at module load so the prompt isn't lost.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("installpromptchange"));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event("installpromptchange"));
  });
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag, which predates display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch points are what give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallState = {
  /** Chromium fired beforeinstallprompt, so a one-tap install is available. */
  canPrompt: boolean;
  /** Already running from the home screen. */
  installed: boolean;
  /** Safari never fires the event, so these users need the manual Share-sheet steps. */
  needsManualSteps: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

export function useInstallPrompt(): InstallState {
  const [canPrompt, setCanPrompt] = useState(() => deferredPrompt !== null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const sync = () => {
      setCanPrompt(deferredPrompt !== null);
      setInstalled(isStandalone());
    };
    window.addEventListener("installpromptchange", sync);

    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", sync);

    sync();
    return () => {
      window.removeEventListener("installpromptchange", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // A prompt can only be shown once; Chromium re-fires the event if the user declines.
    deferredPrompt = null;
    window.dispatchEvent(new Event("installpromptchange"));
    return outcome;
  }, []);

  return {
    canPrompt,
    installed,
    needsManualSteps: !canPrompt && !installed && isIOS(),
    promptInstall
  };
}
