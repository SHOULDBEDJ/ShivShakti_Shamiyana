import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link2, Copy, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { useI18n } from "@/context/I18nContext";

const OrderLink = () => {
  const { t } = useI18n();
  const [links, setLinks] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const data = await api.getOrderLinks();
    setLinks(data || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const data = await api.generateOrderLink();
      toast.success(t("uploaded"));
      load();
      const url = `${window.location.origin}/order/${data.token}`;
      navigator.clipboard.writeText(url);
      setCopied(data.token);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error(t("error_loading"));
    } finally {
      setBusy(false);
    }
  };

  const copy = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/order/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <PageHeader
        title={t("orderLink")}
        subtitle={t("orderLinkSubtitle")}
        actions={
          <Button onClick={create} disabled={busy} className="bg-primary hover:bg-primary/90 font-bold px-6">
            <Plus className="mr-2 h-4 w-4" /> {t("generateLink")}
          </Button>
        }
      />


      <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/20 grid place-items-center"><Link2 className="h-6 w-6 text-primary" /></div>
          <div>
            <div className="font-display text-xl font-bold">{t("status")}</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              1. {t("save")} <strong>{t("newBooking")}</strong>.<br />
              2. {t("confirm")} URL.<br />
              3. {t("customer")} {t("uploaded")}.<br />
              4. {t("pending_request")}.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">{t("all")}</h3>
        {links.length === 0 && <div className="text-center text-muted-foreground py-10 bg-muted/20 rounded-xl border border-dashed">{t("noRecordsFound")}</div>}
        {links.map((s) => {
          const url = `${window.location.origin}/order/${s.token}`;
          const isExpired = new Date() > new Date(s.expires_at) || s.status === 'expired';
          const isUsed = s.status === 'used';

          return (
            <div key={s.id} className={`flex items-center gap-3 border rounded-xl bg-card p-4 shadow-sm transition-all hover:shadow-md ${isExpired || isUsed ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-primary truncate bg-primary/5 p-2 rounded mb-2">{url}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{t("date")}: {fmtDate(s.created_at)}</span>
                  <span>•</span>
                  <span className={isExpired ? 'text-destructive font-bold' : isUsed ? 'text-success font-bold' : 'text-primary font-bold uppercase'}>
                    {isUsed ? t("used") : isExpired ? t("expired") : t("active")}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(s.token)} disabled={isExpired || isUsed}>
                  {copied === s.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline ml-2">{copied === s.token ? t("confirm") : t("copy")}</span>
                </Button>
                <a href={url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary">{t("view")}</Button>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default OrderLink;
