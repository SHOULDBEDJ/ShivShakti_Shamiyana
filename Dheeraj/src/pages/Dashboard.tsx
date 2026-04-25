import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { fmtINR, fmtDate, todayISO, monthStartISO, statusTone } from "@/lib/format";
import {
  CalendarCheck2, Inbox, Wallet, TrendingUp, AlertTriangle, PackageX,
  IndianRupee, Activity, ChevronLeft, ChevronRight, Plus, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useI18n } from "@/context/I18nContext";

type CardKey = "bookingsToday" | "incoming" | "notReturned" | "todayCollection" | "monthlyRevenue" | "monthlyExpenses" | "profit" | "todayCollectionAlt";

const dotForStatus: Record<string, string> = {
  Incoming: "bg-info",
  Confirmed: "bg-accent",
  Ready: "bg-warning",
  "Out for Delivery": "bg-info",
  Delivered: "bg-success",
  Returned: "bg-muted-foreground",
  "Late Return": "bg-destructive",
  "Partially Returned": "bg-warning",
};

const Dashboard = () => {
  const { t } = useI18n();
  const nav = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  const [drawerBooking, setDrawerBooking] = useState<any | null>(null);
  const [cardDrill, setCardDrill] = useState<{ key: CardKey; title: string; rows: any[] } | null>(null);
  const [dateDrill, setDateDrill] = useState<{ date: string; rows: any[] } | null>(null);

  // Calendar month cursor
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  useEffect(() => {
    (async () => {
      const monthStart = monthStartISO();
      const [b, ls, ex] = await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("inventory_items").select("id,name,available_quantity,low_stock_threshold").lte("available_quantity", 0),
        supabase.from("expenses").select("date,amount,category,description").gte("date", monthStart),
      ]);
      setBookings(b.data || []);
      setLowStock(ls.data || []);
      setExpenses(ex.data || []);
    })();
  }, []);

  const today = todayISO();
  const monthStart = monthStartISO();

  const stats = useMemo(() => {
    const bookingsToday = bookings.filter((b) => b.start_date === today);
    const incoming = bookings.filter((b) => b.status === "Incoming");
    const notReturned = bookings.filter((b) =>
      ["Delivered", "Out for Delivery", "Late Return", "Partially Returned"].includes(b.status)
    );
    const monthlyRevenueRows = bookings.filter((b) => (b.created_at || "") >= monthStart);
    const monthlyRevenue = monthlyRevenueRows.reduce((s, b) => s + Number(b.total_paid || 0), 0);
    const monthlyExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const todayExpenseRows = expenses.filter((e) => e.date === today);
    const todayExpenses = todayExpenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);
    const todayPayments: { booking: any; amount: number }[] = [];
    bookings.forEach((b) => {
      (b.payments || []).forEach((p: any) => {
        if ((p.date || "").slice(0, 10) === today) todayPayments.push({ booking: b, amount: Number(p.amount || 0) });
      });
    });
    const todayCollection = todayPayments.reduce((s, p) => s + p.amount, 0);
    return {
      bookingsToday, incoming, notReturned, monthlyRevenue, monthlyExpenses, todayExpenses, todayCollection,
      monthlyRevenueRows, todayExpenseRows, todayPayments,
    };
  }, [bookings, expenses, today, monthStart]);

  // Calendar grid for current cursor month
  const calendar = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: string | null; rows: any[] }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ date: null, rows: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const rows = bookings.filter((b) => b.start_date === date);
      cells.push({ date, rows });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, rows: [] });
    const max = Math.max(1, ...cells.map((c) => c.rows.length));
    return { cells, max, label: cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  }, [cursor, bookings]);

  const openCard = (key: CardKey) => {
    const map: Record<CardKey, { title: string; rows: any[] }> = {
      bookingsToday: { title: t("bookingsToday"), rows: stats.bookingsToday },
      incoming: { title: t("incomingOrders"), rows: stats.incoming },
      notReturned: { title: t("notReturned"), rows: stats.notReturned },
      todayCollection: { title: `${t("todayCollection")} (${fmtINR(stats.todayCollection)})`, rows: stats.todayPayments.map((p) => p.booking) },
      monthlyRevenue: { title: t("monthlyRevenue"), rows: stats.monthlyRevenueRows },
      monthlyExpenses: { title: t("monthlyExpenses"), rows: [] },
      profit: { title: t("profitOverview"), rows: [] },
      todayCollectionAlt: { title: t("todayCollection"), rows: stats.todayPayments.map((p) => p.booking) },
    };
    setCardDrill({ key, ...map[key] });
  };

  const isToday = (d: string) => d === today;
  const monthName = calendar.label;

  return (
    <>
      <PageHeader
        title={t("dashboard")}
        subtitle={t("liveSnapshot")}
        actions={<Link to="/bookings"><Button className="bg-primary hover:bg-primary/90">{t("newBooking")}</Button></Link>}
      />

      {lowStock.length > 0 && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-destructive">{lowStock.length} {t("itemsOutOfStock")}</div>
            <div className="text-sm text-muted-foreground mt-1">{lowStock.slice(0, 6).map((i) => i.name).join(", ")}</div>
          </div>
          <Link to="/inventory" className="text-sm text-destructive font-medium hover:underline">{t("manage")} →</Link>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-8">
        <button className="text-left" onClick={() => openCard("bookingsToday")}>
          <StatCard label={t("bookingsToday")} value={stats.bookingsToday.length} icon={CalendarCheck2} tone="accent" />
        </button>
        <button className="text-left" onClick={() => openCard("incoming")}>
          <StatCard label={t("incomingOrders")} value={stats.incoming.length} icon={Inbox} tone="warning" />
        </button>
        <button className="text-left" onClick={() => openCard("notReturned")}>
          <StatCard label={t("notReturned")} value={stats.notReturned.length} icon={PackageX} tone="destructive" />
        </button>
        <button className="text-left" onClick={() => openCard("todayCollection")}>
          <StatCard label={t("netToday")} value={fmtINR(stats.todayCollection - stats.todayExpenses)} icon={Activity}
            hint={`${fmtINR(stats.todayCollection)} in · ${fmtINR(stats.todayExpenses)} out`} />
        </button>
        <button className="text-left" onClick={() => openCard("monthlyRevenue")}>
          <StatCard label={t("monthlyRevenue")} value={fmtINR(stats.monthlyRevenue)} icon={IndianRupee} tone="success" />
        </button>
        <button className="text-left" onClick={() => nav("/expenses")}>
          <StatCard label={t("monthlyExpenses")} value={fmtINR(stats.monthlyExpenses)} icon={Wallet} />
        </button>
        <button className="text-left" onClick={() => openCard("profit")}>
          <StatCard label={t("profitMonth")} value={fmtINR(stats.monthlyRevenue - stats.monthlyExpenses)} icon={TrendingUp} tone="success" />
        </button>
        <button className="text-left" onClick={() => openCard("todayCollectionAlt")}>
          <StatCard label={t("todayCollection")} value={fmtINR(stats.todayCollection)} icon={IndianRupee} tone="accent" />
        </button>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden mb-8">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">{t("bookingsCalendar")}</h3>
            <p className="text-xs text-muted-foreground">{t("bookingsCalendarHint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-display text-lg min-w-[160px] text-center">{monthName}</div>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {calendar.cells.map((c, i) => {
            if (!c.date) return <div key={i} className="aspect-square border-r border-b bg-muted/10" />;
            const count = c.rows.length;
            const intensity = count === 0 ? 0 : Math.min(1, 0.15 + (count / calendar.max) * 0.55);
            const dots = c.rows.slice(0, 4);
            return (
              <button
                key={i}
                onClick={() => setDateDrill({ date: c.date!, rows: c.rows })}
                className={cn(
                  "aspect-square border-r border-b p-1.5 sm:p-2 text-left flex flex-col gap-1 hover:bg-accent/10 transition-colors relative",
                  isToday(c.date) && "ring-2 ring-accent ring-inset"
                )}
                style={{ backgroundColor: count > 0 ? `hsl(var(--accent) / ${intensity})` : undefined }}
              >
                <div className="flex items-start justify-between">
                  <span className={cn("text-xs font-medium", isToday(c.date) && "text-accent-foreground")}>
                    {Number(c.date.slice(8, 10))}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold bg-foreground/90 text-background rounded-full px-1.5 min-w-[18px] text-center">
                      {count}
                    </span>
                  )}
                </div>
                {count > 0 && (
                  <div className="mt-auto flex gap-0.5 flex-wrap">
                    {dots.map((b, j) => (
                      <span key={j} className={cn("h-1.5 w-1.5 rounded-full", dotForStatus[b.status] || "bg-muted-foreground")} />
                    ))}
                    {count > 4 && <span className="text-[9px] text-muted-foreground">+{count - 4}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">{t("recentBookings")}</h3>
            <p className="text-xs text-muted-foreground">{t("recentBookingsHint")}</p>
          </div>
          <Link to="/bookings" className="text-sm text-accent hover:underline">{t("viewAll")} →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">{t("bookings")}</th>
                <th className="text-left px-5 py-3">{t("customer")}</th>
                <th className="text-left px-5 py-3">{t("date")}</th>
                <th className="text-left px-5 py-3">{t("status")}</th>
                <th className="text-left px-5 py-3">{t("payment")}</th>
                <th className="text-right px-5 py-3">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">{t("noBookingsYet")}</td></tr>
              )}
              {bookings.slice(0, 8).map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDrawerBooking(b)}>
                  <td className="px-5 py-3 font-mono text-xs">{b.booking_id}</td>
                  <td className="px-5 py-3"><div className="font-medium">{b.customer_name}</div><div className="text-xs text-muted-foreground">{b.phone}</div></td>
                  <td className="px-5 py-3">{fmtDate(b.start_date)}</td>
                  <td className="px-5 py-3"><Badge variant="outline" className={statusTone[b.status] || ""}>{t(b.status?.toLowerCase()?.replace(/\s+/g, '_')) || b.status}</Badge></td>
                  <td className="px-5 py-3"><Badge variant="outline" className={statusTone[b.payment_status] || ""}>{t(b.payment_status?.toLowerCase()) || b.payment_status}</Badge></td>
                  <td className="px-5 py-3 text-right font-medium">{fmtINR(b.pricing?.totalAmount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking detail drawer */}
      <BookingDetailDrawer open={!!drawerBooking} onOpenChange={(v) => !v && setDrawerBooking(null)} booking={drawerBooking} />

      {/* Date drill drawer */}
      <Sheet open={!!dateDrill} onOpenChange={(v) => !v && setDateDrill(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{dateDrill && fmtDate(dateDrill.date)}</SheetTitle>
          </SheetHeader>
          <div className="mt-5">
            {dateDrill && dateDrill.rows.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground mb-4">{t("noBookingsOnDate")}</p>
                <p className="text-sm mb-6">{t("takeBookingPrompt")}</p>
                <Button className="bg-primary hover:bg-primary/90" onClick={() => { setDateDrill(null); nav("/bookings"); }}>
                  <Plus className="mr-2 h-4 w-4" /> {t("newBooking")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {dateDrill?.rows.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setDrawerBooking(b); setDateDrill(null); }}
                    className="w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{b.booking_id} · {b.phone}</div>
                      </div>
                      <Badge variant="outline" className={statusTone[b.status] || ""}>{t(b.status?.toLowerCase()?.replace(/\s+/g, '_')) || b.status}</Badge>
                    </div>
                    <div className="text-sm mt-2 flex justify-between">
                      <span className="text-muted-foreground">{b.event_time || "—"}</span>
                      <span className="font-medium">{fmtINR(b.pricing?.totalAmount || 0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Card drill drawer */}
      <Sheet open={!!cardDrill} onOpenChange={(v) => !v && setCardDrill(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{cardDrill?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-5">
            {cardDrill?.key === "profit" ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2"><span>{t("revenueThisMonth")}</span><span className="text-success font-medium">{fmtINR(stats.monthlyRevenue)}</span></div>
                <div className="flex justify-between border-b pb-2"><span>{t("expensesThisMonth")}</span><span className="text-destructive font-medium">{fmtINR(stats.monthlyExpenses)}</span></div>
                <div className="flex justify-between font-display text-lg pt-2"><span>{t("profit")}</span><span>{fmtINR(stats.monthlyRevenue - stats.monthlyExpenses)}</span></div>
              </div>
            ) : cardDrill?.rows.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">{t("none")}</div>
            ) : (
              <div className="space-y-2">
                {cardDrill?.rows.map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => { setDrawerBooking(b); setCardDrill(null); }}
                    className="w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{b.booking_id} · {fmtDate(b.start_date)}</div>
                      </div>
                      <Badge variant="outline" className={statusTone[b.status] || ""}>{t(b.status?.toLowerCase()?.replace(/\s+/g, '_')) || b.status}</Badge>
                    </div>
                    <div className="text-sm mt-2 flex justify-between">
                      <span className="text-muted-foreground">{b.phone}</span>
                      <span className="font-medium">{fmtINR(b.pricing?.totalAmount || 0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
export default Dashboard;
