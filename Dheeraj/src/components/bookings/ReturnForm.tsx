import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check, X, Plus, Minus, ArrowLeft, AlertTriangle } from "lucide-react";
import { fmtINR } from "@/lib/format";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import { useI18n } from "@/context/I18nContext";

interface ReturnFormProps {
  booking: any;
  onClose: () => void;
  onComplete: () => void;
}

export const ReturnForm = ({ booking, onClose, onComplete }: ReturnFormProps) => {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>(
    Array.isArray(booking?.items) 
      ? booking.items.map((it: any) => ({
          ...it,
          return_status: 'pending', // 'returned' | 'missing'
          missing_quantity: 0
        }))
      : []
  );

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'' | 'cash' | 'upi'>('');
  const [loading, setLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  const categories = Array.from(new Set(items.map(it => it.category_name || 'Independent')));

  useEffect(() => {
    api.getBusinessProfile().then(p => setBusinessProfile(p)).catch(() => {});
  }, []);

  const setItemStatus = (itemId: string, status: 'returned' | 'missing' | 'partial') => {
    setItems(items.map(it => {
      if (it.item_id === itemId) {
        return { 
          ...it, 
          return_status: status,
          missing_quantity: status === 'missing' ? it.quantity : (status === 'returned' ? 0 : it.missing_quantity || 1)
        };
      }
      return it;
    }));
  };

  const updateMissingQty = (itemId: string, delta: number) => {
    setItems(items.map(it => {
      if (it.item_id === itemId) {
        const newQty = Math.max(0, Math.min(it.quantity, (it.missing_quantity || 0) + delta));
        return { ...it, missing_quantity: newQty };
      }
      return it;
    }));
  };

  const missingItemsTotal = items.reduce((sum, it) => {
    if (it.return_status === 'missing' || it.return_status === 'partial') {
      return sum + (it.missing_quantity || 0) * (it.unit_price || 0);
    }
    return sum;
  }, 0);

  const finalPayable = Math.max(0, (booking.pending_amount || 0) + missingItemsTotal - discountAmount);

  const handleCompleteReturn = async () => {
    // Validation
    const allDecided = items.every(it => it.return_status !== 'pending');
    if (!allDecided) return toast.error("Please mark all items as Present or Missing");
    if (paymentAmount > 0 && !paymentMethod) return toast.error("Payment method not selected. Please select Cash or UPI.");

    setLoading(true);
    try {
      await api.processReturn(booking.booking_id, {
        items: items.map(it => ({
          item_id: it.item_id,
          return_status: it.return_status,
          missing_quantity: it.missing_quantity
        })),
        payment_amount: paymentAmount,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        missing_total: missingItemsTotal,
        final_payable: finalPayable
      });
      toast.success("Return processed successfully");
      onComplete();
      onClose();
    } catch (err) {
      toast.error("Failed to process return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onClose}><ArrowLeft /></Button>
        <h2 className="text-2xl font-bold">{t("returned")}</h2>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><Label className="text-muted-foreground">{t("customerName")}</Label><div className="font-medium">{booking.customer_name}</div></div>
          <div><Label className="text-muted-foreground">{t("bookingId")}</Label><div className="font-mono text-primary font-medium">{booking.booking_id}</div></div>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map(catName => (
          <div key={catName} className="space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-2">
              {catName === 'Independent' ? t("independentItems") : catName}
            </h3>
            <div className="space-y-3">
              {items.filter(i => (i.category_name || 'Independent') === catName).map(it => (
                <div key={it.item_id} className="border rounded-lg p-4 bg-card space-y-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="font-bold text-lg">{it.item_name}</div>
                      <div className="text-xs text-muted-foreground">{t("qty")}: <span className="font-bold text-foreground">{it.quantity}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant={it.return_status === 'returned' ? 'default' : 'outline'}
                        size="sm"
                        className={it.return_status === 'returned' ? 'bg-success hover:bg-success/90 h-9' : 'h-9'}
                        onClick={() => setItemStatus(it.item_id, 'returned')}
                      >
                        <Check className="mr-2 h-4 w-4" /> {t("confirmed")}
                      </Button>
                      <Button 
                        variant={it.return_status === 'partial' ? 'default' : 'outline'}
                        size="sm"
                        className={it.return_status === 'partial' ? 'bg-amber-500 hover:bg-amber-600 text-white h-9' : 'h-9'}
                        onClick={() => setItemStatus(it.item_id, 'partial')}
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" /> {t("partial")}
                      </Button>
                      <Button 
                        variant={it.return_status === 'missing' ? 'destructive' : 'outline'}
                        size="sm"
                        className="h-9"
                        onClick={() => setItemStatus(it.item_id, 'missing')}
                      >
                        <X className="mr-2 h-4 w-4" /> {t("rejected")}
                      </Button>
                    </div>
                  </div>

                  {(it.return_status === 'missing' || it.return_status === 'partial') && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-muted/50 rounded-md border animate-in fade-in zoom-in duration-300">
                      <Label className="text-sm font-medium flex-1">
                        {it.return_status === 'missing' ? t("rejected") : t("partial")} {t("qty")}?
                        <div className="text-[10px] text-destructive mt-1 font-bold">
                          {t("loss")}: {fmtINR((it.missing_quantity || 0) * (it.unit_price || 0))}
                        </div>
                      </Label>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateMissingQty(it.item_id, -1)}><Minus className="h-4 w-4" /></Button>
                        <div className="w-12 text-center font-bold text-lg">{it.missing_quantity || 0}</div>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateMissingQty(it.item_id, 1)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t space-y-6">
        {missingItemsTotal > 0 && (
          <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="text-sm font-medium text-destructive">
              {t("borrow")} {t("qty")} {t("rejected")}! {t("loss")}: {fmtINR(missingItemsTotal)}
            </div>
          </div>
        )}

        <div className="bg-muted/30 p-6 rounded-xl border space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-bold text-lg flex items-center gap-2">
                {t("paymentSummary")}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>{t("bookingId")} {t("total")}</span><span className="font-mono">{fmtINR(booking.total_amount)}</span></div>
                <div className="flex justify-between text-success font-medium"><span>{t("advance")}</span><span className="font-mono">{fmtINR(booking.advance_amount)}</span></div>
                <div className="flex justify-between text-destructive font-medium border-b pb-2"><span>{t("due")}</span><span className="font-mono">{fmtINR(booking.pending_amount)}</span></div>
                <div className="flex justify-between text-destructive pt-2"><span>{t("loss")} ({t("rejected")})</span><span className="font-mono">+ {fmtINR(missingItemsTotal)}</span></div>
                <div className="flex justify-between text-success"><span>{t("discount")}</span><span className="font-mono">- {fmtINR(discountAmount)}</span></div>
                <div className="flex justify-between text-lg font-bold pt-4 border-t-2 border-primary/20">
                  <span>{t("pending_request")}</span>
                  <span className="text-primary font-mono">{fmtINR(finalPayable)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-8 pt-4 md:pt-0">
              <h4 className="font-bold text-lg">{t("paymentMethod")}</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("discount")}</Label>
                  <Input type="number" value={discountAmount || ""} onChange={e => setDiscountAmount(Number(e.target.value))} placeholder="₹ 0" />
                </div>
                <div className="space-y-2">
                  <Label>{t("today")} {t("income")}</Label>
                  <Input type="number" value={paymentAmount || ""} onChange={e => setPaymentAmount(Number(e.target.value))} placeholder={fmtINR(finalPayable)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant={paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('cash')} className="flex-1 h-11">{t("cash")}</Button>
                  <Button variant={paymentMethod === 'upi' ? 'default' : 'outline'} onClick={() => setPaymentMethod('upi')} className="flex-1 h-11">UPI</Button>
                </div>
              </div>
            </div>
          </div>
          {paymentMethod === 'upi' && paymentAmount > 0 && (
            <div className="p-4 border rounded-lg space-y-4 bg-background animate-in fade-in duration-300">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl shadow-sm text-center space-y-2">
                  <QRCodeSVG 
                    value={`upi://pay?pa=9113565802.wa.8p7@waaxis&pn=${encodeURIComponent(businessProfile?.upi_name || 'Business')}&am=${paymentAmount}&cu=INR`} 
                    size={150} 
                  />
                  <div className="text-sm font-bold text-black mt-2">Scan to pay {fmtINR(paymentAmount)}</div>
                  <div className="text-[10px] text-muted-foreground">UPI ID: 9113565802.wa.8p7@waaxis</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleCompleteReturn} disabled={loading} className="w-full h-12 text-lg font-bold">{t("save")}</Button>
      </div>
    </div>
  );
};
