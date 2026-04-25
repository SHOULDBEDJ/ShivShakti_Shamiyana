import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Phone, ClipboardList, History, Check, X, Minus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtINR } from "@/lib/format";

import { useI18n } from "@/context/I18nContext";

const Vendors = () => {
  const { t } = useI18n();
  const [vendors, setVendors] = useState<any[]>([]);
  const [openVendor, setOpenVendor] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const load = async () => {
    try {
      const data = await api.getVendors();
      const vendorList = Array.isArray(data) ? data : [];
      setVendors(vendorList);
      if (selectedVendor && Array.isArray(data)) {
          const updated = data.find((v: any) => v.id === selectedVendor.id);
          if (updated) setSelectedVendor(updated);
      }
    } catch (err) {
      toast.error("Failed to load vendors");
    }
  };

  useEffect(() => { load(); }, []);

  const removeVendor = async (vendor: any) => {
    const msg = vendor.pending_count > 0 
        ? `This vendor has ${vendor.pending_count} pending borrowed items. Delete anyway?`
        : `Delete ${vendor.name}? This cannot be undone.`;
        
    if (!confirm(msg)) return;
    try {
      await api.deleteVendor(vendor.id);
      toast.success("Vendor deleted");
      if (selectedVendor?.id === vendor.id) setSelectedVendor(null);
      load();
    } catch (err) {
      toast.error("Failed to delete vendor");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t("vendorManagement")} 
        subtitle={t("vendorSubtitle")}
        actions={
          <Button onClick={() => setOpenVendor(true)} className="bg-primary hover:bg-primary/90 font-bold">
            <Plus className="mr-2 h-4 w-4" /> {t("addVendor")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor List (Section 1) */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> {t("vendors")}
          </h2>
          
          <div className="space-y-3">
            {vendors.map(v => (
              <div 
                key={v.id} 
                onClick={() => setSelectedVendor(v)}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedVendor?.id === v.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg">{v.name}</div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <Phone className="h-3.5 w-3.5" /> {v.phone || t("noPhone")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditVendor(v); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); removeVendor(v); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {v.pending_count > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold uppercase">
                    <AlertCircle className="h-3 w-3" /> {v.pending_count} {t("pendingBorrowsCount")}
                  </div>
                )}
              </div>
            ))}
            {vendors.length === 0 && <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl">{t("noVendorsFound")}</div>}
          </div>
        </div>

        {/* Vendor Details & Borrows (Section 2 & 3) */}
        <div className="lg:col-span-2">
          {selectedVendor ? (
            <div className="bg-card rounded-2xl border shadow-elegant overflow-hidden h-full">
              <div className="p-6 border-b bg-muted/20">
                <h2 className="text-2xl font-bold">{selectedVendor.name}</h2>
                <p className="text-muted-foreground text-sm">{selectedVendor.notes || "No notes available for this vendor."}</p>
              </div>

              <Tabs defaultValue="borrows" className="w-full">
                <TabsList className="w-full rounded-none border-b bg-muted/10 h-12">
                  <TabsTrigger value="borrows" className="flex-1 rounded-none data-[state=active]:bg-background">{t("borrowedItems")}</TabsTrigger>
                  <TabsTrigger value="payments" className="flex-1 rounded-none data-[state=active]:bg-background">{t("paymentHistory")}</TabsTrigger>
                </TabsList>
                <TabsContent value="borrows" className="p-0 m-0">
                  <BorrowedItemsList vendorId={selectedVendor.id} onUpdate={load} />
                </TabsContent>
                <TabsContent value="payments" className="p-0 m-0">
                  <PaymentHistoryList vendorId={selectedVendor.id} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="h-full min-h-[400px] border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <div className="h-16 w-16 rounded-full bg-muted/20 grid place-items-center"><ClipboardList className="h-8 w-8" /></div>
              <p>Select a vendor to view borrowed items and payments</p>
            </div>
          )}
        </div>
      </div>

      <VendorForm 
        isOpen={openVendor || !!editVendor} 
        vendor={editVendor}
        onClose={() => { setOpenVendor(false); setEditVendor(null); load(); }} 
      />
    </div>
  );
};

const BorrowedItemsList = ({ vendorId, onUpdate }: { vendorId: number; onUpdate: () => void }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [updatingBorrow, setUpdatingBorrow] = useState<any>(null);

  const loadItems = async () => {
    try {
      const data = await api.getVendorBorrows(vendorId);
      setItems(data || []);
    } catch (err) {
      toast.error("Failed to load borrowed items");
    }
  };

  useEffect(() => { loadItems(); }, [vendorId]);

  return (
    <div className="divide-y">
      {(!items || items.length === 0) && <div className="p-10 text-center text-muted-foreground">{t("noBorrowedItems")}</div>}
      {Array.isArray(items) && items.map(item => (
        <div key={item.id} className="p-4 flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-1">
            <div className="font-bold text-lg">{item.item_name}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Qty: <span className="font-bold text-foreground">{item.borrowed_quantity}</span></span>
              <span>Returned: <span className="font-bold text-success">{item.return_quantity || 0}</span></span>
              <span>Booking ID: <span className="font-mono text-primary font-bold">{item.booking_id}</span></span>
              <span>Date: {fmtDate(item.borrowed_at_date)}</span>
            </div>
            <div className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mt-2 ${item.return_status === 'returned' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
              {item.return_status}
            </div>
          </div>
          <div className="flex items-center">
            {item.return_status !== 'returned' && (
              <Button onClick={() => setUpdatingBorrow(item)} size="sm" className="w-full md:w-auto">{t("updateReturn")}</Button>
            )}
          </div>
        </div>
      ))}
      {updatingBorrow && (
        <UpdateReturnModal 
          borrow={updatingBorrow} 
          onClose={() => { setUpdatingBorrow(null); loadItems(); onUpdate(); }} 
        />
      )}
    </div>
  );
};

const UpdateReturnModal = ({ borrow, onClose }: { borrow: any; onClose: () => void }) => {
  const { t } = useI18n();
  const [returnQty, setReturnQty] = useState(borrow.borrowed_quantity - (borrow.return_quantity || 0));
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (returnQty <= 0 && amountPaid === "") return toast.error("Enter return quantity or payment amount");
    setLoading(true);
    try {
      await api.updateVendorReturn(borrow.id, {
        return_quantity: returnQty,
        amount_paid: amountPaid === "" ? 0 : Number(amountPaid)
      });
      toast.success("Return record updated");
      onClose();
    } catch (err) {
      toast.error("Failed to update return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Return: {borrow.item_name}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label>Return Quantity</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setReturnQty(Math.max(0, returnQty - 1))}><Minus className="h-4 w-4" /></Button>
              <Input 
                type="number" 
                inputMode="numeric" 
                className="text-center text-lg font-bold" 
                value={returnQty || ""} 
                onChange={e => setReturnQty(Number(e.target.value))} 
                placeholder="Enter quantity"
              />
              <Button variant="outline" size="icon" onClick={() => setReturnQty(returnQty + 1)}><Plus className="h-4 w-4" /></Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Remaining to return: {borrow.borrowed_quantity - (borrow.return_quantity || 0)}</p>
          </div>

          <div className="space-y-1">
            <Label>Amount to Pay Vendor (₹)</Label>
            <Input 
                type="number" 
                inputMode="numeric" 
                value={amountPaid} 
                onChange={e => setAmountPaid(e.target.value)} 
                placeholder="Enter amount (nullable)" 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={save} disabled={loading} className="font-bold">{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PaymentHistoryList = ({ vendorId }: { vendorId: number }) => {
  const { t } = useI18n();
  const [payments, setPayments] = useState<any[]>([]);

  const loadPayments = async () => {
    try {
      const data = await api.getVendorPayments(vendorId);
      setPayments(data || []);
    } catch (err) {
      toast.error("Failed to load payment history");
    }
  };

  useEffect(() => { loadPayments(); }, [vendorId]);
  
  const paymentList = Array.isArray(payments) ? payments : [];
  const runningTotal = paymentList.reduce((acc, p) => acc + (p.amount_paid || 0), 0);

  return (
    <div className="space-y-0">
      <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
        <span className="text-xs font-bold uppercase text-muted-foreground">{t("lifetimePaid")}</span>
        <span className="text-xl font-bold text-success">{fmtINR(runningTotal)}</span>
      </div>
      <div className="divide-y overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/10 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">{t("date")}</th>
              <th className="text-left px-4 py-2">{t("categoryItem")}</th>
              <th className="text-center px-4 py-2">{t("qty")}</th>
              <th className="text-right px-4 py-2">{t("paid")}</th>
            </tr>
          </thead>
          <tbody>
            {paymentList.map((p, idx) => (
              <tr key={idx} className="hover:bg-muted/5">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                <td className="px-4 py-3 font-medium">{p.item_name}</td>
                <td className="px-4 py-3 text-center">{p.quantity_returned}</td>
                <td className="px-4 py-3 text-right font-bold text-success">{fmtINR(p.amount_paid)}</td>
              </tr>
            ))}
            {paymentList.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">No payment history found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VendorForm = ({ isOpen, vendor, onClose }: { isOpen: boolean; vendor: any; onClose: () => void }) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setPhone(vendor.phone || "");
      setNotes(vendor.notes || "");
    } else {
      setName(""); setPhone(""); setNotes("");
    }
  }, [vendor, isOpen]);

  const save = async () => {
    if (!name || !phone) return toast.error("Name and Phone are required");
    setLoading(true);
    try {
      if (vendor) {
        await api.updateVendor(vendor.id, { name, phone, notes });
        toast.success("Vendor updated");
      } else {
        await api.createVendor({ name, phone, notes });
        toast.success("Vendor added");
      }
      onClose();
    } catch (err) {
      toast.error("Failed to save vendor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{vendor ? t("editVendor") : t("addVendor")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1"><Label>Vendor Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John's Rentals" /></div>
          <div className="space-y-1"><Label>Phone Number *</Label><Input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9988776655" /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Specialized in chairs, tents, etc." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={save} disabled={loading} className="font-bold">{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Vendors;
