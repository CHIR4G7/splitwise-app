import { Check, Download, Share } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { isIOS, useInstallPrompt } from "@/lib/install";

/**
 * Install entry point. Chromium gets the one-tap prompt; Safari never fires
 * beforeinstallprompt, so iOS users get the actual Share-sheet steps instead of a button
 * that would do nothing.
 */
export function InstallCard() {
  const { canPrompt, installed, needsManualSteps, promptInstall } = useInstallPrompt();
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);

  if (installed) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
            <Check size={18} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">Installed</p>
            <p className="text-xs text-slate-500">You're running SplitIt from your home screen.</p>
          </div>
        </div>
      </Card>
    );
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === "dismissed") setDismissedNotice("No problem — you can install any time from here.");
    if (outcome === "unavailable") setDismissedNotice("Your browser didn't offer an install prompt.");
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
          <Download size={18} aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-medium text-slate-900">Add to home screen</h2>
          <p className="text-xs text-slate-500">
            Opens full screen without browser chrome, and loads instantly on a bad connection.
          </p>
        </div>
      </div>

      {dismissedNotice && <Alert tone="info">{dismissedNotice}</Alert>}

      {canPrompt && (
        <Button onClick={handleInstall}>
          <Download size={16} aria-hidden />
          Install SplitIt
        </Button>
      )}

      {needsManualSteps && (
        <ol className="flex flex-col gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className="text-slate-500">1.</span>
            Tap <Share size={15} aria-hidden className="inline text-brand-700" />
            <span className="font-medium">Share</span> in Safari's toolbar
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-500">2.</span>
            Choose <span className="font-medium">Add to Home Screen</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-500">3.</span>
            Tap <span className="font-medium">Add</span>
          </li>
        </ol>
      )}

      {!canPrompt && !needsManualSteps && (
        <p className="text-xs text-slate-500">
          {isIOS()
            ? "Open this page in Safari to add it to your home screen."
            : "Your browser will offer an install option here once it's ready — in Chrome you can also use the install icon in the address bar."}
        </p>
      )}
    </Card>
  );
}
