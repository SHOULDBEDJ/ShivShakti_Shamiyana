import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, ChevronLeft } from "lucide-react";
import { fmtINR, fmtDate } from "@/lib/format";
import { useI18n } from "@/context/I18nContext";

const Invoice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [booking, setBooking] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [b, p] = await Promise.all([
          api.getBooking(id!),
          api.getBusinessProfile()
        ]);
        setBooking(b);
        setProfile(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!booking) return <div className="p-10 text-center text-destructive font-bold">Booking not found</div>;

  const items = booking.items || [];
  const total = booking.total_amount || 0;
  const paid = Number(booking.advance_amount || 0);
  const balance = Number(booking.pending_amount ?? (total - paid));

  return (
    <div className="min-h-screen bg-white md:bg-muted/30 p-0 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center no-print p-4 md:p-0">
          <Button variant="ghost" onClick={() => navigate(-1)}><ChevronLeft className="mr-2 h-4 w-4" /> {t("cancel")}</Button>
          <div className="flex gap-2">
             <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> {t("copy")}</Button>
          </div>
        </div>

        <div className="bg-card shadow-xl rounded-xl overflow-hidden border print:shadow-none print:border-none print:m-0">
          {/* Header */}
          <div className="bg-primary p-6 md:p-8 text-primary-foreground flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex gap-4 items-center">
              {profile?.photo_url && <img src={profile.photo_url} alt="Logo" className="h-16 w-16 rounded-lg bg-white p-1 object-contain" />}
              <div>
                <h1 className="text-xl md:text-2xl font-bold font-display uppercase tracking-tight">{profile?.business_name || "ShivaShakti Shamiyana"}</h1>
                <p className="text-xs md:text-sm opacity-90 whitespace-pre-line max-w-[280px]">{profile?.address}</p>
                {profile?.phone && <p className="text-xs md:text-sm opacity-90 font-bold mt-1">Phone: {profile.phone}</p>}
              </div>
            </div>
            <div className="text-right w-full md:w-auto">
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-1">INVOICE</h2>
              <p className="text-xs md:text-sm font-mono opacity-80">{booking.booking_id}</p>
              <p className="text-xs md:text-sm opacity-80">{fmtDate(new Date())}</p>
            </div>
          </div>

          <div className="p-4 md:p-8 space-y-6 md:space-y-8">
            {/* Bill To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 bg-muted/30 p-4 rounded-lg">
              <div>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">BILL TO</h3>
                <div className="font-bold text-base md:text-lg">{booking.customer_name}</div>
                <div className="text-sm text-muted-foreground">{booking.phone_number}</div>
                <div className="text-sm text-muted-foreground">{booking.place}</div>
              </div>
              <div className="md:text-right">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">EVENT DETAILS</h3>
                <div className="text-sm">{fmtDate(booking.delivery_takeaway_date || booking.booking_date)}</div>
                <div className="text-sm text-muted-foreground">{booking.function_type}</div>
                <div className="text-[10px] uppercase font-bold text-primary mt-1">{booking.pricing_mode}</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full border-collapse min-w-[300px]">
                <thead>
                  <tr className="border-b-2 border-primary/20 text-left bg-primary/5">
                    <th className="py-2 px-2 md:px-4 font-bold text-[9px] md:text-[10px] uppercase tracking-wider">Item</th>
                    <th className="py-2 px-2 md:px-4 font-bold text-[9px] md:text-[10px] uppercase tracking-wider text-center w-12">Qty</th>
                    <th className="py-2 px-2 md:px-4 font-bold text-[9px] md:text-[10px] uppercase tracking-wider text-right w-20">Price</th>
                    <th className="py-2 px-2 md:px-4 font-bold text-[9px] md:text-[10px] uppercase tracking-wider text-right w-20">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 md:py-3 px-2 md:px-4 text-[11px] md:text-sm font-medium leading-tight">{it.item_name}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-[11px] md:text-sm text-center">{it.quantity}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-[11px] md:text-sm text-right text-muted-foreground">{fmtINR(it.unit_price)}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-[11px] md:text-sm text-right font-bold">{fmtINR(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


            {/* Totals */}
            <div className="flex flex-col items-end gap-2 pt-4">
              <div className="flex justify-between w-full md:max-w-[240px] text-xs">
                <span>TOTAL AMOUNT</span>
                <span className="font-bold">{fmtINR(total)}</span>
              </div>
              <div className="flex justify-between w-full md:max-w-[240px] text-xs text-success font-medium">
                <span>ADVANCE PAID</span>
                <span>{fmtINR(paid)}</span>
              </div>
              <div className="flex justify-between w-full md:max-w-[240px] text-base md:text-xl font-black border-t-2 border-primary/20 pt-2 mt-2">
                <span className="text-primary">BALANCE DUE</span>
                <span className="text-primary">{fmtINR(balance)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest">
              <p>Thank you for choosing {profile?.business_name || "ShivaShakti Shamiyana"}.</p>
              <p className="mt-1 opacity-60 font-mono">ID: {booking.booking_id} • {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .max-w-3xl { max-width: 100% !important; margin: 0 !important; }
          .shadow-xl { box-shadow: none !important; }
          .rounded-xl { border-radius: 0 !important; }
          .border { border: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Invoice;
