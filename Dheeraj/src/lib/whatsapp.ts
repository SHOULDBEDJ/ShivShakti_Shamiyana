import { fmtINR, fmtDate } from "@/lib/format";

const cleanPhone = (raw?: string) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // Default to India country code if a 10-digit number is entered.
  if (digits.length === 10) return "91" + digits;
  return digits;
};

const open = (phone: string, text: string) => {
  const url = `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

export const sendWhatsappConfirmation = (b: any, businessName?: string) => {
  const lines = [
    `Hello ${b.customer_name || "Customer"},`,
    "",
    `Your booking is *CONFIRMED* with ${businessName || "ShivaShakti Shamiyana"}.`,
    "",
    `📋 Booking ID: ${b.booking_id}`,
    `📅 Event: ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`,
    `🚚 Mode: ${b.delivery_mode || "Delivery"}`,
    `💰 Total: ${fmtINR(b.pricing?.totalAmount || 0)}`,
    `✅ Paid: ${fmtINR(b.total_paid || 0)}`,
    `🧾 Balance: ${fmtINR(b.remaining_amount || 0)}`,
    "",
    "Thank you for choosing us!",
  ];
  open(b.phone, lines.join("\n"));
};

export const sendWhatsappBalance = (b: any, businessName?: string) => {
  const lines = [
    `Hello ${b.customer_name || "Customer"},`,
    "",
    `This is a friendly reminder for your booking *${b.booking_id}* with ${businessName || "ShivaShakti Shamiyana"}.`,
    "",
    `💰 Total Amount: ${fmtINR(b.pricing?.totalAmount || 0)}`,
    `✅ Paid: ${fmtINR(b.total_paid || 0)}`,
    `🧾 *Balance Due: ${fmtINR(b.remaining_amount || 0)}*`,
    "",
    "Kindly clear the pending balance at your earliest convenience.",
    "Thank you!",
  ];
  open(b.phone, lines.join("\n"));
};

export const sendWhatsappStatus = (b: any, businessName?: string) => {
  const lines = [
    `Hello ${b.customer_name || "Customer"},`,
    "",
    `Update for your booking *${b.booking_id}* with ${businessName || "ShivaShakti Shamiyana"}:`,
    "",
    `📦 Current Status: *${b.status}*`,
    `📅 Event: ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`,
    "",
    "Please reach out if you have any questions.",
  ];
  open(b.phone, lines.join("\n"));
};
