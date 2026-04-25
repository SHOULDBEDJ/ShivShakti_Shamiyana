import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Web Speech API has no official TS types; declare loosely.
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

type Props = {
  onTranscript: (text: string) => void;
  className?: string;
  /** Append (true) or replace (false) the existing text. Default: append. */
  append?: boolean;
};

/**
 * Microphone button that converts speech to text via Web Speech API.
 * Uses the active app language (Kannada → kn-IN, English → en-IN).
 * Shipped as a self-contained button you can drop next to any input.
 */
export const VoiceInput = ({ onTranscript, className, append = true }: Props) => {
  const { lang, t } = useI18n();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const start = () => {
    if (!supported) {
      toast.error(t("voiceUnsupported"));
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Recognition();
    r.lang = lang === "kn" ? "kn-IN" : "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;

    r.onstart = () => {
      setListening(true);
      toast.info(t("voiceListening"));
    };
    r.onerror = (e: any) => {
      setListening(false);
      if (e?.error !== "aborted") toast.error(`Voice: ${e?.error || "error"}`);
    };
    r.onend = () => setListening(false);
    r.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((res: any) => res[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) onTranscript(append ? ` ${text}` : text);
    };

    recognitionRef.current = r;
    try { r.start(); } catch { /* already started */ }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? t("voiceListening") : t("voiceTap")}
      aria-label={listening ? t("voiceListening") : t("voiceTap")}
      className={cn(
        "inline-flex items-center justify-center h-10 w-10 rounded-md border transition-colors flex-shrink-0",
        listening
          ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
          : "bg-background hover:bg-muted border-input text-foreground",
        !supported && "opacity-50",
        className
      )}
    >
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
};
