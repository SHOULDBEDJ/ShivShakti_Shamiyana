import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";

export const OfflineStatus = () => {
  const { t } = useI18n();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("You are back online!", {
        icon: <Wifi className="h-4 w-4 text-success" />
      });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("You are offline. Some features may not work.", {
        icon: <WifiOff className="h-4 w-4 text-destructive" />,
        duration: Infinity,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-destructive text-destructive-foreground py-1 text-center text-xs font-bold animate-in fade-in slide-in-from-top-full">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-3 w-3" />
        Offline Mode
      </div>
    </div>
  );
};
