import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusTone, fmtINR, fmtDate } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/context/I18nContext";

interface BookingListProps {
  bookings: any[];
  onView: (booking: any) => void;
  onEdit: (booking: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onPaymentClick: (booking: any) => void;
}

export const BookingList = ({ bookings = [], onView, onEdit, onDelete, onStatusChange, onPaymentClick }: BookingListProps) => {
  const { t } = useI18n();
  if (!Array.isArray(bookings)) return <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>;
  
  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">{t("customer")} ID</th>
              <th className="text-left px-4 py-3">{t("bookingId")}</th>
              <th className="text-left px-4 py-3">{t("name")}</th>
              <th className="text-left px-4 py-3">{t("phone")}</th>
              <th className="text-left px-4 py-3">{t("date")}</th>
              <th className="text-left px-4 py-3">{t("place")}</th>
              <th className="text-left px-4 py-3">{t("status")}</th>
              <th className="text-left px-4 py-3">{t("paymentStatus")}</th>
              <th className="text-right px-4 py-3">{t("total")}</th>
              <th className="text-right px-4 py-3">{t("advance")}</th>
              <th className="text-right px-4 py-3">{t("discount")}</th>
              <th className="text-right px-4 py-3">{t("due")}</th>
              <th className="text-center px-4 py-3">{t("actions")}</th>
              <th className="text-left px-4 py-3">{t("updateStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.booking_id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{b.customer_id}</td>
                <td className="px-4 py-3 font-mono text-xs">{b.booking_id}</td>
                <td className="px-4 py-3 font-medium">{b.customer_name}</td>
                <td className="px-4 py-3">{b.phone_number}</td>
                <td className="px-4 py-3">{fmtDate(b.delivery_takeaway_date || b.created_at)}</td>
                <td className="px-4 py-3">{b.place}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={statusTone[b.order_status] || ""}>
                    {t(b.order_status.toLowerCase().replace(/\s+/g, '_'))}
                  </Badge>
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={() => onPaymentClick(b)}>
                  <Badge variant="outline" className={b.payment_status === 'paid' ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30'}>
                    {t(b.payment_status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">{fmtINR(b.total_amount)}</td>
                <td className="px-4 py-3 text-right">{fmtINR(b.advance_amount)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{fmtINR(b.discount_amount)}</td>
                <td className="px-4 py-3 text-right text-destructive font-medium">{fmtINR(b.pending_amount)}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => onView(b)}><Eye className="h-4 w-4" /></Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onEdit(b)} 
                    disabled={b.order_status === 'complete' || b.order_status === 'complete_returned'}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(b.booking_id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </td>
                <td className="px-4 py-3">
                  <Select 
                    value={b.order_status} 
                    onValueChange={(v) => onStatusChange(b.booking_id, v)}
                    disabled={b.order_status === 'complete' || b.order_status === 'complete_returned'}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending_request">{t("pending_request")}</SelectItem>
                      <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                      <SelectItem value="delivered">{t("delivered")}</SelectItem>
                      <SelectItem value="returned">{t("returned")}</SelectItem>
                      <SelectItem value="rejected">{t("rejected")}</SelectItem>
                      <SelectItem value="complete" disabled>{t("complete")}</SelectItem>
                      <SelectItem value="complete_returned" disabled>{t("complete_returned")}</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3 p-3">
        {bookings.map((b) => (
          <div key={b.booking_id} className="border rounded-lg p-4 bg-card space-y-2 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-base">{b.customer_name}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(b.delivery_takeaway_date || b.created_at)}</div>
              </div>
              <Badge variant="outline" className={statusTone[b.order_status]}>
                {t(b.order_status.toLowerCase().replace(/\s+/g, '_'))}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="text-muted-foreground">{t("due")}: <span className="text-destructive font-bold">{fmtINR(b.pending_amount)}</span></div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onView(b)}><Eye className="h-4 w-4" /></Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => onEdit(b)}
                  disabled={b.order_status === 'complete' || b.order_status === 'complete_returned'}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(b.booking_id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
