import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { fmtINR, fmtDate, todayISO, monthStartISO, statusTone } from "@/lib/format";
import {
  CalendarCheck2, Inbox, Wallet, TrendingUp, AlertTriangle, PackageX,
  IndianRupee, Activity, ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useI18n } from "@/context/I18nContext";

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
  const [cardDrill, setCardDrill] = useState<{ key: string; title: string; rows: any[] } | null>(null);
  const [dateDrill, setDateDrill] = useState<{ date: string; rows: any[] } | null>(null);

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  useEffect(() => {
    (async () => {
      try {
        const [b, ls, ex] = await Promise.all([
          api.getBookings(),
          api.getItems(),
          api.getExpenses(),
        ]);
        setBookings(b || []);
        setLowStock((ls || []).filter((i: any) => i.available_quantity <= 0));
        setExpenses(ex || []);
      } catch (err: any) {
        console.error(err);
      }
    })();
  }, []);

  const today = todayISO();
  const monthStart = monthStartISO();

  const stats = useMemo(() => {
    const bookingsToday = bookings.filter((b) => (b.delivery_takeaway_date || "").slice(0,10) === today);
    const incoming = bookings.filter((b) => b.order_status === "confirmed");
    const notReturned = bookings.filter((b) =>
      ["confirmed", "returned_partial"].includes(b.order_status)
    );
    const monthlyRevenueRows = bookings.filter((b) => (b.created_at || "") >= monthStart);
    const monthlyRevenue = monthlyRevenueRows.reduce((s, b) => s + Number(b.advance_amount || 0), 0);
    const monthlyExpenses = expenses.filter(e => (e.date || "") >= monthStart).reduce((s, e) => s + Number(e.amount || 0), 0);
    const todayExpenseRows = expenses.filter((e) => e.date === today);
    const todayExpenses = todayExpenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);
    
    // For today collection, we'd ideally need to fetch payments but for simple stats we use advance_amount if created today
    const todayCollection = bookings.filter(b => (b.created_at || "").slice(0,10) === today).reduce((s, b) => s + Number(b.advance_amount || 0), 0);

    return {
      bookingsToday, incoming, notReturned, monthlyRevenue, monthlyExpenses, todayExpenses, todayCollection,
      monthlyRevenueRows, todayExpenseRows,
    };
  }, [bookings, expenses, today, monthStart]);

  const calendar = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: string | null; rows: any[] }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ date: null, rows: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const rows = bookings.filter((b) => (b.delivery_takeaway_date || "").slice(0,10) === date);
      cells.push({ date, rows });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, rows: [] });
    const max = Math.max(1, ...cells.map((c) => c.rows.length));
    return { cells, max, label: cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  }, [cursor, bookings]);

  const openCard = (key: string) => {
    const map: Record<string, { title: string; rows: any[] }> = {
      bookingsToday: { title: t("bookingsToday"), rows: stats.bookingsToday },
      incoming: { title: t("incomingOrders"), rows: stats.incoming },
      notReturned: { title: t("notReturned"), rows: stats.notReturned },
      todayCollection: { title: t("todayCollection"), rows: [] },
      monthlyRevenue: { title: t("monthlyRevenue"), rows: stats.monthlyRevenueRows },
      profit: { title: t("profitOverview"), rows: [] },
    };
    if (map[key]) setCardDrill({ key, ...map[key] });
  };

  const isToday = (d: string) => d === today;

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
        <button className="text-left" onClick={() => openCard("todayCollection")}>
          <StatCard label={t("todayCollection")} value={fmtINR(stats.todayCollection)} icon={IndianRupee} tone="accent" />
        </button>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden mb-8">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-display text-lg min-w-[160px] text-center">{calendar.label}</div>
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
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-display text-xl">{t("recentBookings")}</h3>
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
                <th className="text-right px-5 py-3">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-10">{t("noBookingsYet")}</td></tr>
              )}
              {bookings.slice(0, 8).map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDrawerBooking(b)}>
                  <td className="px-5 py-3 font-mono text-xs">{b.booking_id}</td>
                  <td className="px-5 py-3"><div className="font-medium">{b.customer_name}</div><div className="text-xs text-muted-foreground">{b.phone_number}</div></td>
                  <td className="px-5 py-3">{fmtDate(b.delivery_takeaway_date)}</td>
                  <td className="px-5 py-3"><Badge variant="outline" className={statusTone[b.order_status] || ""}>{t(b.order_status) || b.order_status}</Badge></td>
                  <td className="px-5 py-3 text-right font-medium">{fmtINR(b.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BookingDetailDrawer open={!!drawerBooking} onOpenChange={(v) => !v && setDrawerBooking(null)} booking={drawerBooking} />

      <Sheet open={!!dateDrill} onOpenChange={(v) => !v && setDateDrill(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{dateDrill && fmtDate(dateDrill.date)}</SheetTitle>
          </SheetHeader>
          <div className="mt-5 space-y-2">
            {dateDrill?.rows.map((b) => (
              <button key={b.id} onClick={() => { setDrawerBooking(b); setDateDrill(null); }} className="w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex justify-between font-medium"><span>{b.customer_name}</span><span>{fmtINR(b.total_amount)}</span></div>
                <div className="text-xs text-muted-foreground">{b.booking_id} · {b.phone_number}</div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!cardDrill} onOpenChange={(v) => !v && setCardDrill(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display text-2xl">{cardDrill?.title}</SheetTitle></SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Overview Box */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t("totalRecords")}</div>
                <div className="text-2xl font-bold mt-1">{cardDrill?.rows.length}</div>
              </div>
              {cardDrill?.key === "monthlyRevenue" && (
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="text-[10px] uppercase tracking-wider text-success font-bold">{t("totalRevenue")}</div>
                  <div className="text-2xl font-bold mt-1 text-success">{fmtINR(stats.monthlyRevenue)}</div>
                </div>
              )}
              {cardDrill?.key === "todayCollection" && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="text-[10px] uppercase tracking-wider text-accent font-bold">{t("netToday")}</div>
                  <div className="text-2xl font-bold mt-1 text-accent">{fmtINR(stats.todayCollection - stats.todayExpenses)}</div>
                </div>
              )}
              {cardDrill?.key === "profit" && (
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="text-[10px] uppercase tracking-wider text-success font-bold">{t("netProfit")}</div>
                  <div className="text-2xl font-bold mt-1 text-success">{fmtINR(stats.monthlyRevenue - stats.monthlyExpenses)}</div>
                </div>
              )}
            </div>

            {/* Detailed Info Box for Profit/Loss */}
            {(cardDrill?.key === "profit" || cardDrill?.key === "todayCollection") && (
              <div className="p-5 rounded-2xl bg-card border shadow-sm space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-widest border-b pb-2">{t("breakdown")}</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("monthlyRevenue")}</span>
                    <span className="font-bold text-success">+{fmtINR(stats.monthlyRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("monthlyExpenses")}</span>
                    <span className="font-bold text-destructive">-{fmtINR(stats.monthlyExpenses)}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="font-bold">{t("estimatedProfit")}</span>
                    <span className={cn("text-lg font-black", stats.monthlyRevenue >= stats.monthlyExpenses ? "text-success" : "text-destructive")}>
                      {fmtINR(stats.monthlyRevenue - stats.monthlyExpenses)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground px-1">{t("transactions")}</h4>
              {cardDrill?.rows.map((b: any) => (
                <button key={b.id} onClick={() => { setDrawerBooking(b); setCardDrill(null); }} className="w-full text-left border rounded-xl p-4 hover:bg-muted/30 transition-all hover:shadow-md group">
                  <div className="flex justify-between font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                    <span>{b.customer_name}</span>
                    <span className="text-success">{fmtINR(b.total_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{b.booking_id} · {fmtDate(b.delivery_takeaway_date)}</span>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusTone[b.order_status])}>{t(b.order_status)}</Badge>
                  </div>
                </button>
              ))}
              {cardDrill?.key === "profit" && (
                <div className="text-center py-8 text-muted-foreground italic text-sm">
                  {t("profitDetailInstruction")}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </>
  );
};
export default Dashboard;
