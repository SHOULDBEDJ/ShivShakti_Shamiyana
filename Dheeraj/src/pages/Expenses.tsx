import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wallet, Calendar, Receipt } from "lucide-react";
import { fmtINR, fmtDate, monthStartISO, todayISO } from "@/lib/format";
import { toast } from "sonner";

import { useI18n } from "@/context/I18nContext";

const Expenses = () => {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data }, { data: tps }] = await Promise.all([
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("expense_types" as any).select("*").order("name"),
    ]);
    setList(data || []); setTypes(tps || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = list.filter((e) => {
    if (e.date < from || e.date > to) return false;
    if (category !== "all" && e.category !== category) return false;
    return true;
  });
  const monthlyTotal = list.filter((e) => e.date >= monthStartISO()).reduce((s, e) => s + Number(e.amount), 0);
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    load();
  };

  return (
    <>
      <PageHeader
        title={t("expenses")}
        subtitle={t("expensesSubtitle")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> {t("newExpense")}</Button></DialogTrigger>
            <ExpenseDialog types={types} onClose={() => { setOpen(false); load(); }} />
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label={t("filteredTotal")} value={fmtINR(filteredTotal)} icon={Receipt} tone="accent" hint={`${filtered.length} ${t("actions")}`} />
        <StatCard label={t("thisMonth")} value={fmtINR(monthlyTotal)} icon={Calendar} />
        <StatCard label={t("allTimeRecords")} value={list.length} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div><Label className="text-xs uppercase">{t("from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs uppercase">{t("to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs uppercase">{t("type")}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              {types.map((t: any) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-5 py-3">{t("date")}</th><th className="text-left px-5 py-3">{t("type")}</th><th className="text-left px-5 py-3">{t("notes")}</th><th className="text-left px-5 py-3">{t("method")}</th><th className="text-right px-5 py-3">{t("amount")}</th><th /></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-10">{t("noExpensesMatch")}</td></tr>}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="px-5 py-3">{fmtDate(e.date)}</td>
                <td className="px-5 py-3">{e.category || "—"}</td>
                <td className="px-5 py-3 text-muted-foreground">{e.description || "—"}</td>
                <td className="px-5 py-3">{e.payment_method}</td>
                <td className="px-5 py-3 text-right font-medium">{fmtINR(e.amount)}</td>
                <td className="px-3"><Button variant="ghost" size="sm" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const ExpenseDialog = ({ types, onClose }: any) => {
  const { t } = useI18n();
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("Cash");
  const save = async () => {
    if (!amount || amount <= 0) return toast.error("Amount required");
    if (!category) return toast.error("Select an expense type (add one in Settings → Expense Types)");
    const { error } = await supabase.from("expenses").insert({ date, amount, category, description, payment_method: method });
    if (error) toast.error(error.message); else { toast.success("Expense added"); onClose(); }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-2xl">{t("newExpense")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("date")} *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>{t("amount")} (₹) *</Label><Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        </div>
        <div>
          <Label>{t("type")} *</Label>
          {types.length === 0 ? (
            <div className="text-xs text-warning mt-1">{t("none")}</div>
          ) : (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <div><Label>{t("notes")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><Label>{t("method")}</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Bank Transfer">{t("bankTransfer")}</SelectItem>
              <SelectItem value="Card">{t("card")}</SelectItem>
              <SelectItem value="Other">{t("other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{t("cancel")}</Button><Button onClick={save} className="bg-primary hover:bg-primary/90">{t("save")}</Button></DialogFooter>
    </DialogContent>
  );
};

export default Expenses;
