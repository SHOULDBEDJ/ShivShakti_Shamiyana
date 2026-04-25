import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

const fmtINR = (n: number) =>
  "Rs. " + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Convert remote image URL → base64 data URL so jsPDF can embed it.
const toDataUrl = async (url: string): Promise<{ data: string; format: "PNG" | "JPEG" } | null> => {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const format: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data, format };
  } catch {
    return null;
  }
};

export async function generateInvoicePDF(booking: any) {
  const { data: profile } = await supabase.from("business_profile").select("*").maybeSingle();
  const biz: any = profile || {};

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(180, 60, 40);
  doc.rect(0, 0, pageW, 90, "F");

  // Logo (top-left, inside header band)
  let textLeft = 40;
  if (biz.photo_url) {
    const img = await toDataUrl(biz.photo_url);
    if (img) {
      try {
        doc.addImage(img.data, img.format, 30, 18, 54, 54, undefined, "FAST");
        textLeft = 100;
      } catch {
        /* invalid image — fall back to text-only header */
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(biz.business_name || "ShivaShakti Shamiyana", textLeft, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(biz.address || "Karnataka, India", textLeft, 58);
  if (biz.phone) doc.text("Phone: " + biz.phone, textLeft, 72);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageW - 40, 42, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Date: " + fmtDate(new Date()), pageW - 40, 60, { align: "right" });

  doc.setTextColor(20, 20, 20);
  let y = 120;

  // Booking meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Booking ID:", 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.booking_id || "—", 120, y);

  doc.setFont("helvetica", "bold");
  doc.text("Status:", pageW - 200, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.status || "—", pageW - 150, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.text("Mode:", 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(booking.delivery_mode || "Delivery", 120, y);
  y += 24;

  // Customer block
  doc.setDrawColor(220);
  doc.setFillColor(248, 244, 235);
  doc.rect(40, y, pageW - 80, 70, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO", 50, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(booking.customer_name || "—", 50, y + 34);
  doc.text("Phone: " + (booking.phone || "—"), 50, y + 50);
  doc.text("Address: " + ((booking.address || "—") as string).slice(0, 80), 50, y + 64);

  doc.setFont("helvetica", "bold");
  doc.text("Event Dates", pageW - 220, y + 16);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(booking.start_date) + "  to  " + fmtDate(booking.end_date), pageW - 220, y + 34);
  if (booking.event_time) doc.text("Time: " + booking.event_time, pageW - 220, y + 50);
  y += 90;

  // Items table
  const items = (booking.items || []) as any[];
  autoTable(doc, {
    startY: y,
    head: [["#", "Item", "Qty", "Unit price", "Amount"]],
    body: items.map((it, i) => [
      String(i + 1),
      it.name || "—",
      String(it.quantity || 0),
      fmtINR(Number(it.price || 0)),
      fmtINR(Number(it.price || 0) * Number(it.quantity || 0)),
    ]),
    headStyles: { fillColor: [180, 60, 40], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      2: { halign: "center", cellWidth: 50 },
      3: { halign: "right", cellWidth: 90 },
      4: { halign: "right", cellWidth: 90 },
    },
    margin: { left: 40, right: 40 },
  });

  // @ts-ignore lastAutoTable provided by autotable
  y = (doc as any).lastAutoTable.finalY + 12;

  // Totals
  const pricing = booking.pricing || {};
  const subtotal = Number(pricing.subtotal || 0);
  const tax = Number(pricing.tax || 0);
  const discount = Number(pricing.discount || 0);
  const deliveryCharge = Number(pricing.deliveryCharge || 0);
  const total = Number(pricing.totalAmount || 0);
  const paid = Number(booking.total_paid || 0);
  const dueAmt = Number(booking.remaining_amount || 0);

  const labelX = pageW - 220;
  const valueX = pageW - 50;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { align: "right" });
    y += 16;
  };

  doc.setFontSize(10);
  row("Subtotal", fmtINR(subtotal));
  if (discount > 0) row("Discount", "- " + fmtINR(discount));
  if (tax > 0) row("Tax", fmtINR(tax));
  if ((booking.delivery_mode || "Delivery") === "Delivery" && deliveryCharge > 0)
    row("Delivery charge", fmtINR(deliveryCharge));
  doc.setDrawColor(180, 60, 40);
  doc.line(labelX, y - 6, valueX, y - 6);
  doc.setFontSize(12);
  row("TOTAL", fmtINR(total), true);
  doc.setFontSize(10);
  row("Paid", fmtINR(paid));
  row("Balance Due", fmtINR(dueAmt), true);

  // Footer
  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(220);
  doc.line(40, y, pageW - 40, y);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Thank you for choosing " + (biz.business_name || "ShivaShakti Shamiyana") + ".", 40, y + 18);
  doc.text("Generated on " + new Date().toLocaleString("en-IN"), 40, y + 32);

  doc.save(`Invoice-${booking.booking_id || "booking"}.pdf`);
}
