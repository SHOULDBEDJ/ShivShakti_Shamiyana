import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";

export const InstallPrompt = () => {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if already installed
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Hide if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 z-[100] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-card border-2 border-primary/20 shadow-2xl rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Download className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">Install App</div>
          <div className="text-xs text-muted-foreground line-clamp-1">Fast access from your home screen</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInstall} className="bg-primary hover:bg-primary/90 text-xs h-8 px-3">
            Install
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setIsVisible(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
