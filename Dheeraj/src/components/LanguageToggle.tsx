import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/context/I18nContext";

export const LanguageToggle = ({ variant = "ghost" }: { variant?: "ghost" | "outline" }) => {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => setLang(lang === "en" ? "kn" : "en")}
      className="gap-1.5"
      title={lang === "en" ? "Switch to Kannada" : "Switch to English"}
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium">{lang === "en" ? "EN" : "ಕನ್ನಡ"}</span>
    </Button>
  );
};
