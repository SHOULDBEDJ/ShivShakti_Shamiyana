import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["Delivery", "Installation", "Support", "Manager", "Helper"];

const Staff = () => {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    try {
      const data = await api.getWorkers();
      setList(data || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this staff member?")) return;
    try {
      await api.deleteWorker(id);
      toast.success("Staff deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title={t("staff")}
        subtitle={t("staffSubtitle")}
        actions={
          <Dialog open={open || !!edit} onOpenChange={(o) => { if (!o) { setOpen(false); setEdit(null); } }}>
            <DialogTrigger asChild><Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> {t("addStaff")}</Button></DialogTrigger>
            <StaffDialog staff={edit} onClose={() => { setOpen(false); setEdit(null); load(); }} />
          </Dialog>
        }
      />

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-5 py-3">{t("name")}</th><th className="text-left px-5 py-3">{t("role")}</th><th className="text-left px-5 py-3">{t("phone")}</th><th /></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-10">{t("noStaffYet")}</td></tr>}
            {list.map((w: any) => (
              <tr key={w.id} className="border-t hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{w.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{w.role || "—"}</td>
                <td className="px-5 py-3">{w.phone}</td>
                <td className="px-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEdit(w)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(w.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const StaffDialog = ({ staff, onClose }: any) => {
  const { t } = useI18n();
  const [name, setName] = useState(staff?.name || "");
  const [phone, setPhone] = useState(staff?.phone || "");
  const [role, setRole] = useState(staff?.role || ROLES[0]);
  const save = async () => {
    if (!name || !phone) return toast.error("Name and phone required");
    const payload = { name, phone, role };
    try {
      if (staff) {
        await api.updateWorker(staff.id, payload);
      } else {
        await api.createWorker(payload);
      }
      toast.success(staff ? "Updated" : "Added"); 
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-2xl">{staff ? t("editStaff") : t("addStaff")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{t("name")} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>{t("phone")} *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div>
          <Label>{t("role")}</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={save} className="bg-primary hover:bg-primary/90">{t("save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Staff;
