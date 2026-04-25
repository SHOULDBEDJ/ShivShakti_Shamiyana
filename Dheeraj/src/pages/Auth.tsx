import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tent } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_LOGIN_ID, ADMIN_EMAIL } from "@/lib/permissions";

const Auth = () => {
  const { user, signIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const id = loginId.trim();
    // Map the secret User ID → real auth email. Anything containing "@" is treated as email directly.
    const email = id.includes("@") ? id : id.toUpperCase() === ADMIN_LOGIN_ID ? ADMIN_EMAIL : id;
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(t("authWelcome"));
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-gradient-marigold grid place-items-center">
              <Tent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-display text-2xl">Shamiyana</div>
              <div className="text-xs uppercase tracking-[0.2em] opacity-70">Studio</div>
            </div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-5xl leading-[1.05]">{t("all")} {t("inventory")} {t("management")}</h2>
          <p className="mt-6 text-primary-foreground/80 text-lg">
            {t("profileSubtitle")}
          </p>
        </div>
        <div className="relative text-xs uppercase tracking-[0.2em] text-primary-foreground/60">
          v1 · IST · ₹ INR
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl">{t("signIn")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("authSubtitle")}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loginId" className="text-base">{t("userId")}</Label>
              <Input
                id="loginId"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="admin123"
                required
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-base">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 text-base"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12 text-base bg-primary hover:bg-primary/90">
              {busy ? t("pleaseWait") : t("signIn")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Auth;
