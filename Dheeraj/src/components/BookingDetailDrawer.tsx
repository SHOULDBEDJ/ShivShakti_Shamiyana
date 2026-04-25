import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, FileText, ChevronDown } from "lucide-react";
import { fmtINR, fmtDate, statusTone } from "@/lib/format";
import { useI18n } from "@/context/I18nContext";
import { generateInvoicePDF } from "@/lib/invoice";
import {
  sendWhatsappConfirmation, sendWhatsappBalance, sendWhatsappStatus,
} from "@/lib/whatsapp";
import { PaymentRatingBadge } from "@/components/PaymentRatingBadge";

export const BookingDetailDrawer = ({
  open, onOpenChange, booking,
}: { open: boolean; onOpenChange: (v: boolean) => void; booking: any | null }) => {
  const { t } = useI18n();
  if (!booking) return null;
  const items: any[] = booking.items || [];
  const payments: any[] = booking.payments || [];
  const total = booking.pricing?.totalAmount || 0;
  const paid = Number(booking.total_paid || 0);
  const balance = Number(booking.remaining_amount ?? Math.max(0, total - paid));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl flex items-center gap-3 flex-wrap">
            {booking.booking_id}
            <Badge variant="outline" className={statusTone[booking.status] || ""}>{booking.status}</Badge>
            {booking.payment_rating && <PaymentRatingBadge rating={booking.payment_rating} reason={booking.rating_reason} size="md" />}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => generateInvoicePDF(booking)}>
            <FileText className="h-4 w-4 mr-1.5" /> {t("invoicePdf")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
                <MessageCircle className="h-4 w-4 mr-1.5" /> {t("sendWhatsApp")}
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => sendWhatsappConfirmation(booking)}>
                {t("whatsappConfirmation")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => sendWhatsappBalance(booking)}>
                {t("whatsappBalance")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => sendWhatsappStatus(booking)}>
                {t("whatsappStatus")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-5 space-y-5 text-sm">
          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("customer")}</div>
            <div className="font-medium">{booking.customer_name}</div>
            <div className="text-muted-foreground">{booking.phone}</div>
            <div className="text-muted-foreground mt-1 whitespace-pre-line">{booking.address}</div>
          </section>

          <Separator />

          <section className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("eventDates")}</div>
              <div>{fmtDate(booking.start_date)} → {fmtDate(booking.end_date)}</div>
              {booking.event_time && <div className="text-muted-foreground">{booking.event_time}</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("pricingMode")}</div>
              <div>{booking.delivery_mode === "Takeaway" ? t("takeaway") : t("delivery")}</div>
            </div>
          </section>

          <Separator />

          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Items ({items.length})
            </div>
            <div className="space-y-1">
              {items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between border-b py-1">
                  <span>{it.name} × {it.quantity}</span>
                  <span className="font-medium">{fmtINR((it.price || 0) * (it.quantity || 0))}</span>
                </div>
              ))}
              {items.length === 0 && <div className="text-muted-foreground">—</div>}
            </div>
          </section>

          <Separator />

          <section className="space-y-1">
            <div className="flex justify-between"><span>{t("total")}</span><span className="font-medium">{fmtINR(total)}</span></div>
            <div className="flex justify-between"><span>{t("paid")}</span><span className="text-success">{fmtINR(paid)}</span></div>
            <div className="flex justify-between"><span>{t("balance")}</span><span className="text-destructive">{fmtINR(balance)}</span></div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs uppercase text-muted-foreground">{t("payment")}</span>
              <Badge variant="outline" className={statusTone[booking.payment_status] || ""}>{booking.payment_status}</Badge>
            </div>
            {booking.payment_rating && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs uppercase text-muted-foreground">{t("paymentRating")}</span>
                <PaymentRatingBadge rating={booking.payment_rating} reason={booking.rating_reason} />
              </div>
            )}
            {booking.rating_reason && (
              <div className="text-xs text-muted-foreground italic">{t("ratingReason")}: {booking.rating_reason}</div>
            )}
          </section>

          {payments.length > 0 && (
            <>
              <Separator />
              <section>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("payments")}</div>
                {payments.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between border-b py-1">
                    <span>{fmtDate(p.date)} · {p.method || "—"}</span>
                    <span className="font-medium">{fmtINR(p.amount)}</span>
                  </div>
                ))}
              </section>
            </>
          )}

          {booking.notes && (
            <>
              <Separator />
              <section>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("notes")}</div>
                <div className="whitespace-pre-line text-muted-foreground">{booking.notes}</div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
