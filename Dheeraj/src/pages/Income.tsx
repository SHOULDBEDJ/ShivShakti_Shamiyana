import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, Calendar } from "lucide-react";
import { fmtINR, fmtDate, todayISO, monthStartISO } from "@/lib/format";
import { toast } from "sonner";

const Income = () => {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());

  const load = async () => {
    try {
      const data = await api.getPayments();
      const rows = (data || []).map((p: any) => ({
        id: p.id,
        date: (p.paid_at || "").slice(0, 10),
        customer_name: p.customer_name,
        type: p.method === 'upi' ? 'UPI Payment' : 'Cash Payment',
        amount: Number(p.amount || 0),
        method: p.method,
        notes: `Booking ${p.booking_id}`,
      }));
      setList(rows);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = list.filter((e) => e.date >= from && e.date <= to);
  const todayTotal = list.filter((e) => e.date === todayISO()).reduce((s, e) => s + e.amount, 0);
  const monthTotal = list.filter((e) => e.date >= monthStartISO()).reduce((s, e) => s + e.amount, 0);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader
        title={t("income")}
        subtitle={t("incomeSubtitle")}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label={t("today")} value={fmtINR(todayTotal)} icon={IndianRupee} tone="success" />
        <StatCard label={t("thisMonth")} value={fmtINR(monthTotal)} icon={Calendar} tone="accent" />
        <StatCard label={t("all")} value={fmtINR(filteredTotal)} icon={IndianRupee} hint={`${filtered.length} ${t("actions")}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 max-w-md">
        <div><Label className="text-xs uppercase">{t("from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs uppercase">{t("to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3">{t("date")}</th>
              <th className="text-left px-5 py-3">{t("customer")}</th>
              <th className="text-left px-5 py-3">{t("type")}</th>
              <th className="text-left px-5 py-3">{t("paymentMethod")}</th>
              <th className="text-right px-5 py-3">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-10">{t("noRecordsFound")}</td></tr>}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="px-5 py-3">{fmtDate(e.date)}</td>
                <td className="px-5 py-3">{e.customer_name}</td>
                <td className="px-5 py-3">{e.type}</td>
                <td className="px-5 py-3 text-uppercase">{e.method}</td>
                <td className="px-5 py-3 text-right font-medium text-success">{fmtINR(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
export default Income;
