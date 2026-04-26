import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "@/lib/api";

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
  let biz: any = {};
  try {
    biz = await api.getProfile();
  } catch (err) {
    console.error("Failed to load business profile", err);
  }

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

  // Map field names from Turso schema
  const bookingId = booking.booking_id;
  const status = booking.order_status || booking.status;
  const startDate = booking.delivery_takeaway_date || booking.start_date;
  const endDate = booking.return_date || booking.end_date;
  const total = booking.total_amount || booking.pricing?.totalAmount || 0;
  const paid = Number(booking.advance_amount || booking.total_paid || 0);
  const balanceDue = Number(booking.pending_amount ?? booking.remaining_amount ?? Math.max(0, total - paid));

  // Booking meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Booking ID:", 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(bookingId || "—", 120, y);

  doc.setFont("helvetica", "bold");
  doc.text("Status:", pageW - 200, y);
  doc.setFont("helvetica", "normal");
  doc.text(status || "—", pageW - 150, y);
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
  doc.text("Phone: " + (booking.phone_number || booking.phone || "—"), 50, y + 50);
  doc.text("Address: " + ((booking.customer_address || booking.address || "—") as string).slice(0, 80), 50, y + 64);

  doc.setFont("helvetica", "bold");
  doc.text("Event Dates", pageW - 220, y + 16);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(startDate) + "  to  " + fmtDate(endDate), pageW - 220, y + 34);
  if (booking.event_time) doc.text("Time: " + booking.event_time, pageW - 220, y + 50);
  y += 90;

  // Items table
  const items = (booking.items || []) as any[];
  autoTable(doc, {
    startY: y,
    head: [["#", "Item", "Qty", "Unit price", "Amount"]],
    body: items.map((it, i) => [
      String(i + 1),
      it.item_name || it.name || "—",
      String(it.quantity || 0),
      fmtINR(Number(it.unit_price || it.price || 0)),
      fmtINR(Number(it.subtotal || (Number(it.unit_price || it.price || 0) * Number(it.quantity || 0)))),
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
  const labelX = pageW - 220;
  const valueX = pageW - 50;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { align: "right" });
    y += 16;
  };

  doc.setFontSize(10);
  row("TOTAL", fmtINR(total), true);
  row("Paid", fmtINR(paid));
  row("Balance Due", fmtINR(balanceDue), true);

  // Footer
  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(220);
  doc.line(40, y, pageW - 40, y);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Thank you for choosing " + (biz.business_name || "ShivaShakti Shamiyana") + ".", 40, y + 18);
  doc.text("Generated on " + new Date().toLocaleString("en-IN"), 40, y + 32);

  doc.save(`Invoice-${bookingId || "booking"}.pdf`);
}
