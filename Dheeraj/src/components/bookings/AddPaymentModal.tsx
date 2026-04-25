import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import { fmtINR } from "@/lib/format";

interface AddPaymentModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPaymentModal = ({ booking, isOpen, onClose, onSuccess }: AddPaymentModalProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'cash' | 'upi'>('cash');
  const [loading, setLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [upiType, setUpiType] = useState<'smart' | 'static'>('smart');

  useEffect(() => {
    if (isOpen) {
      api.getBusinessProfile().then(p => setBusinessProfile(p)).catch(() => {});
    }
  }, [isOpen]);

  const handleAddPayment = async () => {
    if (amount <= 0) return toast.error("Enter a valid amount");
    setLoading(true);
    try {
      await api.addPayment(booking.booking_id, { amount, method });
      toast.success("Payment recorded");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Failed to add payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment Installment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Booking ID</Label>
            <div className="font-mono text-sm">{booking?.booking_id}</div>
          </div>
          <div className="space-y-2">
            <Label>Pending Amount</Label>
            <div className="text-destructive font-bold">₹{booking?.pending_amount}</div>
          </div>
          <div className="space-y-2">
            <Label>Amount to Pay (₹)</Label>
            <Input 
              type="number" 
              inputMode="numeric" 
              value={amount || ""} 
              onChange={e => setAmount(Number(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="flex gap-4">
              <Button 
                variant={method === 'cash' ? 'default' : 'outline'} 
                onClick={() => setMethod('cash')} 
                className="flex-1"
              >Cash</Button>
              <Button 
                variant={method === 'upi' ? 'default' : 'outline'} 
                onClick={() => setMethod('upi')} 
                className="flex-1"
              >UPI</Button>
            </div>
          </div>
          {method === 'upi' && amount > 0 && (
            <div className="p-4 border rounded-lg space-y-4 bg-muted/10">
              <div className="flex gap-2">
                <Button size="sm" variant={upiType === 'smart' ? 'default' : 'outline'} onClick={() => setUpiType('smart')}>Smart QR</Button>
                <Button size="sm" variant={upiType === 'static' ? 'default' : 'outline'} onClick={() => setUpiType('static')}>Static QR</Button>
              </div>
              <div className="flex justify-center">
                {upiType === 'smart' ? (
                  businessProfile?.upi_id ? (
                    <div className="p-4 bg-white rounded-xl shadow-sm text-center space-y-2">
                      <QRCodeSVG 
                        value={`upi://pay?pa=${businessProfile.upi_id}&pn=${encodeURIComponent(businessProfile.upi_name || 'Business')}&am=${amount}&cu=INR`} 
                        size={150} 
                      />
                      <div className="text-sm font-bold text-black mt-2">Scan to pay {fmtINR(amount)}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4">UPI ID not configured in settings.</div>
                  )
                ) : (
                  businessProfile?.static_qr_path ? (
                    <div className="p-4 bg-white rounded-xl shadow-sm">
                      <img src={`http://localhost:5000/${businessProfile.static_qr_path}`} alt="Static QR" className="w-[150px] h-[150px] object-cover" />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4">Static QR not uploaded in settings.</div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAddPayment} disabled={loading}>Add Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
