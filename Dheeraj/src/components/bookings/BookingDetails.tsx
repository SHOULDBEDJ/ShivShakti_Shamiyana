import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Pencil, Plus, Printer, Download, Image as ImageIcon, MapPin, Phone, User, MessageSquare } from "lucide-react";
import { fmtINR, fmtDate, statusTone } from "@/lib/format";
import { useRef, useState, useEffect } from "react";
import { InvoicePreview } from "./InvoicePreview";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";

interface BookingDetailsProps {
  booking: any;
  onClose: () => void;
  onEdit: () => void;
  onAddPayment: () => void;
  onPrint: () => void;
}

export const BookingDetails = ({ booking, onClose, onEdit, onAddPayment, onPrint }: BookingDetailsProps) => {
  const { t } = useI18n();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  useEffect(() => {
    api.getBusinessProfile().then(p => setBusinessProfile(p)).catch(() => {});
  }, []);

  const handleDownloadImage = async () => {
    if (!invoiceRef.current) return;
    const tId = toast.loading("Generating image...");
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imgData;
      a.download = `invoice_${booking.booking_id}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success("Invoice image downloaded.", { id: tId });
    } catch (err) {
      toast.error("Download failed. Please try again.", { id: tId });
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    const tId = toast.loading("Generating PDF...");
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`invoice_${booking.booking_id}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Invoice PDF downloaded.", { id: tId });
    } catch (err) {
      toast.error("Download failed. Please try again.", { id: tId });
    }
  };

  const handleSendReminder = () => {
    const amount = booking.pending_amount;
    const upiLink = businessProfile?.upi_id 
      ? `upi://pay?pa=${businessProfile.upi_id}&pn=${encodeURIComponent(businessProfile.upi_name || 'Business')}&am=${amount}&cu=INR`
      : 'UPI ID not configured.';
      
    const msg = `Hello ${booking.customer_name},\nYour remaining balance is ₹${amount}.\nPlease complete payment:\n${upiLink}`;
    
    let phone = booking.phone_number;
    if (phone.length === 10) phone = `91${phone}`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-0 bg-background min-h-[90vh] flex flex-col md:flex-row relative">
      <Button variant="ghost" className="absolute top-4 right-4 z-50 rounded-full h-8 w-8 p-0 bg-background/50 hover:bg-background shadow-sm" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>

      {/* LEFT PANEL - BOOKING DETAILS */}
      <div className="w-full md:w-[35%] border-r overflow-y-auto p-6 space-y-6 bg-card pb-24">
        
        {/* BOOKING REFERENCE */}
        <div className="p-4 rounded-xl border bg-muted/20">
          <div className="text-2xl font-bold font-mono tracking-tight">{booking.booking_id}</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">{t("customer")} ID: {booking.customer_id}</div>
          <div className="flex gap-2 mt-3">
            <Badge variant="outline" className={statusTone[booking.order_status]}>{t(booking.order_status.toLowerCase().replace(/\s+/g, '_'))}</Badge>
            <Badge variant="outline" className={booking.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}>
              {t(booking.payment_status)}
            </Badge>
          </div>
        </div>

        {/* CUSTOMER INFORMATION */}
        <Section title={t("customerInfo")}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full"><User className="h-4 w-4 text-primary" /></div>
              <div className="font-medium">{booking.customer_name}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full"><Phone className="h-4 w-4 text-primary" /></div>
              <div>{booking.phone_number}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full"><MapPin className="h-4 w-4 text-primary" /></div>
              <div>{booking.place || '—'}</div>
            </div>
          </div>
        </Section>

        {/* EVENT DETAILS */}
        <Section title={t("eventDetails")}>
          <Info label={t("bookingDate")} value={fmtDate(booking.booking_date)} />
          <Info label={t("deliveryDate")} value={fmtDate(booking.delivery_takeaway_date)} />
          <Info label={t("functionType")} value={booking.function_type || '—'} />
          <Info label={t("pricingMode")} value={t(booking.pricing_mode || 'delivery')} />
        </Section>

        {/* PAYMENT SUMMARY */}
        <Section title={t("paymentSummary")}>
          <div className="bg-muted/20 p-4 rounded-lg space-y-2 text-sm border">
            <div className="flex justify-between"><span>{t("total")}:</span><span className="font-bold">{fmtINR(booking.total_amount)}</span></div>
            <div className="flex justify-between text-success"><span>{t("advance")}:</span><span>{fmtINR(booking.advance_amount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("discount")}:</span><span>{fmtINR(booking.discount_amount)}</span></div>
            <div className={`flex justify-between border-t pt-2 text-base font-bold ${booking.pending_amount > 0 ? 'text-destructive' : 'text-success'}`}>
              <span>{t("due")}:</span>
              <span>{fmtINR(booking.pending_amount)}</span>
            </div>
          </div>
        </Section>

        {/* ACTIONS */}
        <div className="space-y-2 pt-4">
          <Button className="w-full bg-primary font-bold" onClick={handleDownloadPDF}><Download className="mr-2 h-4 w-4" /> {t("exportPdf")}</Button>
          <Button variant="outline" className="w-full" onClick={handleDownloadImage}><ImageIcon className="mr-2 h-4 w-4" /> {t("exportImage")}</Button>
          {booking.pending_amount > 0 && (
            <Button variant="outline" className="w-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border-[#25D366]/50 font-bold" onClick={handleSendReminder}>
              <MessageSquare className="mr-2 h-4 w-4" /> {t("reminder")}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onEdit} disabled={booking.order_status === 'complete' || booking.order_status === 'complete_returned'}><Pencil className="mr-2 h-4 w-4" /> {t("edit")}</Button>
            <Button variant="outline" className="flex-1" onClick={onAddPayment}><Plus className="mr-2 h-4 w-4" /> {t("advance")}</Button>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL - INVOICE PREVIEW */}
      <div className="w-full md:w-[65%] bg-zinc-100 p-8 overflow-y-auto flex items-start justify-center">
        <div className="shadow-2xl bg-white">
          <InvoicePreview booking={booking} ref={invoiceRef} />
        </div>
      </div>
      
    </div>
  );
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">{title}</h3>
    {children}
  </div>
);

const Info = ({ label, value }: { label: string, value: any }) => (
  <div className="flex justify-between items-center text-sm py-1 border-b border-muted/30">
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-medium text-right max-w-[60%]">{value || '—'}</span>
  </div>
);
