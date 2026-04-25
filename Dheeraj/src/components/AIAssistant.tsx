// Floating AI voice assistant — Kannada speech-in, Kannada text-out + Hindi TTS.
// Talks to the `voice-assistant` edge function which uses Lovable AI (Gemini)
// to classify intent into:
//   - booking_draft → dispatches `ai:open-booking` event with prefilled fields
//   - query        → DB-grounded answer (income/expenses/stock/etc.)
//   - chat         → free reply
//
// Designed elder-friendly: huge mic, single tap, big bubble, voice replies.

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Bot, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

type Msg = { role: "user" | "assistant"; text: string };

// Pick the best installed voice for spoken replies.
// Preference: Hindi male → any Hindi → Kannada → en-IN → first available.
const pickVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const hiMale = voices.find(
    (v) => v.lang?.startsWith("hi") && /male|पुरुष/i.test(v.name),
  );
  if (hiMale) return hiMale;
  const hi = voices.find((v) => v.lang?.startsWith("hi"));
  if (hi) return hi;
  const kn = voices.find((v) => v.lang?.startsWith("kn"));
  if (kn) return kn;
  const enIn = voices.find((v) => v.lang === "en-IN");
  if (enIn) return enIn;
  return voices[0];
};

const speak = (text: string) => {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice();
    // Hindi voice reading Kannada text won't be perfect, but it's the requested
    // robotic Hindi-male output. Slow it slightly for clarity.
    u.lang = u.voice?.lang || "hi-IN";
    u.rate = 0.95;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
};

export const AIAssistant = () => {
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const recognitionRef = useRef<any>(null);
  const supported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Prime voices list (some browsers load them async).
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => { /* triggers re-pick */ };
    }
    return () => { try { recognitionRef.current?.stop(); } catch { /* */ } };
  }, []);

  const handleResult = async (transcript: string) => {
    if (!transcript) return;
    setMessages((m) => [...m, { role: "user", text: transcript }]);
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("voice-assistant", {
        body: { transcript },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply: string = data.reply || "ಸರಿ.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      speak(reply);

      if (data.intent === "booking_draft" && data.booking) {
        // Hand the draft to the Bookings page (navigate first if needed).
        const dispatch = () => {
          window.dispatchEvent(
            new CustomEvent("ai:open-booking", { detail: data.booking }),
          );
        };
        if (window.location.pathname !== "/bookings") {
          navigate("/bookings");
          setTimeout(dispatch, 300);
        } else {
          dispatch();
        }
        setOpen(false);
      }
    } catch (e: any) {
      console.error("voice-assistant invoke error", e);
      const msg = e?.message || "ದೋಷ";
      setMessages((m) => [...m, { role: "assistant", text: msg }]);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

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

    r.onstart = () => setListening(true);
    r.onerror = (e: any) => {
      setListening(false);
      if (e?.error !== "aborted" && e?.error !== "no-speech") {
        toast.error(`Voice: ${e?.error || "error"}`);
      }
    };
    r.onend = () => setListening(false);
    r.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((res: any) => res[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) handleResult(text);
    };

    recognitionRef.current = r;
    try { r.start(); } catch { /* already running */ }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setListening(false);
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("aiAssistant")}
          className="fixed bottom-5 right-5 z-40 h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform grid place-items-center"
        >
          <Bot className="h-7 w-7" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 md:inset-x-auto md:right-5 md:bottom-5 md:w-96 z-40 rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2 font-display">
              <Bot className="h-5 w-5" /> {t("aiAssistant")}
            </div>
            <button
              type="button"
              onClick={() => { stop(); setOpen(false); }}
              aria-label={t("close")}
              className="h-8 w-8 grid place-items-center rounded hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 max-h-[50vh] overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center py-6 px-2">
                {t("aiHint")}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-line",
                  m.role === "user"
                    ? "ml-auto bg-primary/10 text-foreground"
                    : "mr-auto bg-muted text-foreground",
                )}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="mr-auto flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("aiThinking")}
              </div>
            )}
          </div>

          <div className="p-3 border-t flex flex-col items-center gap-2">
            <Button
              type="button"
              onClick={listening ? stop : start}
              disabled={busy}
              className={cn(
                "h-16 w-16 rounded-full p-0",
                listening
                  ? "bg-destructive hover:bg-destructive/90 animate-pulse"
                  : "bg-primary hover:bg-primary/90",
              )}
              aria-label={listening ? t("voiceListening") : t("voiceTap")}
            >
              {listening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              {listening ? t("voiceListening") : t("voiceTap")}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
