import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wallet, Calendar, Receipt, Pencil, Check, X } from "lucide-react";

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
    try {
      const [expenses, tps] = await Promise.all([
        api.getExpenses(),
        api.getExpenseTypes(),
      ]);
      setList(expenses || []); 
      setTypes(tps || []);
    } catch (err: any) {
      toast.error(err.message);
    }
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
    try {
      await api.deleteExpense(id);
      toast.success("Expense deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title={t("expenses")}
        subtitle={t("expensesSubtitle")}
        actions={
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">{t("type")}</Button></DialogTrigger>
              <ExpenseTypesDialog onClose={load} />
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> {t("newExpense")}</Button></DialogTrigger>
              <ExpenseDialog types={types} onClose={() => { setOpen(false); load(); }} />
            </Dialog>
          </div>
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
    try {
      await api.createExpense({ date, amount, category, description, payment_method: method });
      toast.success("Expense added"); 
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
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

const ExpenseTypesDialog = ({ onClose }: any) => {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = async () => {
    try {
      const data = await api.getExpenseTypes();
      setList(data || []);
    } catch (err) {
      toast.error("Failed to load types");
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return toast.error("Enter a name");
    try {
      await api.createExpenseType(newName.trim());
      setNewName("");
      load();
      onClose(); // Refresh parent
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editValue.trim()) return;
    try {
      await api.updateExpenseType(id, editValue.trim());
      setEditingId(null);
      load();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this expense type?")) return;
    try {
      await api.deleteExpenseType(id);
      load();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{t("functionTypes")}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="New Type Name" value={newName} onChange={e => setNewName(e.target.value)} />
          <Button onClick={handleAdd}>{t("save")}</Button>
        </div>
        <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
          {list.map(tp => (
            <div key={tp.id} className="p-2 flex items-center justify-between">
              {editingId === tp.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-8" />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-success" onClick={() => handleSaveEdit(tp.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <span className="text-sm">{tp.name}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(tp.id); setEditValue(tp.name); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(tp.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </DialogContent>
  );
};

export default Expenses;

