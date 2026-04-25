import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, IndianRupee, Calendar } from "lucide-react";
import { fmtINR, fmtDate, todayISO, monthStartISO } from "@/lib/format";
import { toast } from "sonner";

const INCOME_TYPES = ["Booking Advance", "Booking Balance", "Damage Charges", "Late Fee", "Other"];

const Income = () => {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [open, setOpen] = useState(false);

  const load = async () => {
    // Income = sum of payments across bookings, plus a virtual "manual" income table not implemented separately.
    // We model it from bookings.payments JSON for now; manual additions stored as expenses-like rows would need a new table.
    const { data } = await supabase.from("bookings").select("id,booking_id,customer_name,payments");
    const rows: any[] = [];
    (data || []).forEach((b: any) => {
      (b.payments || []).forEach((p: any, idx: number) => {
        rows.push({
          id: `${b.id}-${idx}`,
          date: (p.date || "").slice(0, 10),
          customer_name: b.customer_name,
          type: p.type || "Booking Payment",
          amount: Number(p.amount || 0),
          method: p.method || "Cash",
          notes: p.notes || `Booking ${b.booking_id}`,
        });
      });
    });
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    setList(rows);
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
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> {t("add")} {t("income")}</Button></DialogTrigger>
            <ManualIncomeDialog onClose={() => { setOpen(false); load(); }} />
          </Dialog>
        }
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
                <td className="px-5 py-3">{e.method}</td>
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

const ManualIncomeDialog = ({ onClose }: any) => {
  const { t } = useI18n();
  const [date, setDate] = useState(todayISO());
  const [customer, setCustomer] = useState("");
  const [type, setType] = useState(INCOME_TYPES[0]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!customer) return toast.error("Customer name required");
    if (amount <= 0) return toast.error("Amount required");
    setBusy(true);
    // Find or create a lightweight booking-like record? For simplicity, attach as a one-off booking with status "Returned"
    // Here we just record under an existing booking if customer matches; else create a minimal booking.
    const { data: existing } = await supabase.from("bookings").select("id, payments, total_paid, pricing, remaining_amount")
      .eq("customer_name", customer).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const newPayment = { amount, method, date: new Date(date).toISOString(), type, notes };

    if (existing) {
      const payments = [...((existing.payments as any[]) || []), newPayment];
      const total_paid = (Number(existing.total_paid) || 0) + amount;
      const total = Number((existing.pricing as any)?.totalAmount || 0);
      const remaining = Math.max(0, total - total_paid);
      await supabase.from("bookings").update({ payments, total_paid, remaining_amount: remaining, payment_status: total_paid >= total && total > 0 ? "Paid" : total_paid > 0 ? "Partial" : "Unpaid" }).eq("id", existing.id);
    } else {
      await supabase.from("bookings").insert({
        customer_name: customer, phone: "—", address: "—",
        start_date: date, end_date: date,
        items: [], pricing: { subtotal: amount, tax: 0, discount: 0, damageCharges: 0, lateFee: 0, totalAmount: amount },
        payments: [newPayment], total_paid: amount, remaining_amount: 0, payment_status: "Paid",
        status: "Returned", notes: `Manual income: ${notes}`,
      });
    }
    toast.success("Income recorded");
    setBusy(false);
    onClose();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-2xl">{t("add")} {t("income")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("customerName")} *</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          <div><Label>{t("date")} *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("type")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCOME_TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("total")} (₹) *</Label><Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        </div>
        <div>
          <Label>{t("paymentMethod")}</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Cash", "UPI", "Card", "Other"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>{t("note")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? t("saving") : t("save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
};
