import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dict, tr, Lang } from "@/lib/i18n-dict";

type I18nCtx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("ssLang") as Lang) || "en"
  );
  useEffect(() => {
    localStorage.setItem("ssLang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <Ctx.Provider value={{ lang, setLang: setLangState, t: (k) => tr(k, lang) }}>
      {children}
    </Ctx.Provider>
  );
};

export const useI18n = () => useContext(Ctx);

// Re-export so any old `import { t } from "@/context/I18nContext"` keeps working.
export { dict };
export const t = tr;
