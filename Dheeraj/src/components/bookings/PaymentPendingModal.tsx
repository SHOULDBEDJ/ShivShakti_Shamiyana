import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PaymentPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingAmount: number;
  onConfirm: () => void;
}

export const PaymentPendingModal = ({ isOpen, onClose, pendingAmount, onConfirm }: PaymentPendingModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment Pending</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          There is a pending amount of ₹{pendingAmount}. What would you like to do?
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
