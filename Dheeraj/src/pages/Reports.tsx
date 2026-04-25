import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Image as ImageIcon, Calendar as CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { fmtINR, fmtDate } from "@/lib/format";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useI18n } from "@/context/I18nContext";

const TABS = [
  "monthlyIncome",
  "dailyBookings",
  "pendingPayments",
  "bookingStatus",
  "vendorBorrows"
];

const Reports = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);
  const [profile, setProfile] = useState<any>({});
  
  // Filters
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("all");
  const [vendorId, setVendorId] = useState("all");
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProfile();
    loadVendors();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, month, year, date, fromDate, toDate, status, vendorId]);

  const loadProfile = async () => {
    try {
      const p = await api.getBusinessProfile();
      setProfile(p || {});
    } catch (err) {}
  };

  const loadVendors = async () => {
    try {
      const v = await api.getVendors();
      setVendors(v || []);
    } catch (err) {}
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === "monthlyIncome") {
        res = await api.getMonthlyReport(month, year);
      } else if (activeTab === "dailyBookings") {
        res = await api.getDailyReport(date);
      } else if (activeTab === "pendingPayments") {
        res = await api.getPendingPaymentsReport();
      } else if (activeTab === "bookingStatus") {
        res = await api.getBookingStatusReport(fromDate, toDate, status);
      } else if (activeTab === "vendorBorrows") {
        res = await api.getVendorBorrowsReport(vendorId, fromDate, toDate);
      }
      setData(res || []);
    } catch (err) {
      toast.error("Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    const tId = toast.loading("Generating image...");
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imgData;
      a.download = `${activeTab.replace(/\s+/g, '_').toLowerCase()}_report.png`;
      a.click();
      toast.success("Report downloaded as image.", { id: tId });
    } catch (err) {
      toast.error("Download failed.", { id: tId });
    }
  };

  const handleDownloadPDF = () => {
    if (!data || data.length === 0) return toast.error("No data to export");
    const doc = new jsPDF("l", "pt", "a4");
    
    // Header
    doc.setFontSize(16);
    doc.text(profile.name_kn || profile.name_en || "Shiva Shakti Shamiyana", 40, 40);
    doc.setFontSize(12);
    doc.text(`${t(activeTab)} ${t("reports")}`, 40, 60);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 80);

    let head: string[][] = [];
    let body: any[][] = [];

    if (activeTab === "monthlyIncome" || activeTab === "dailyBookings") {
      head = [[t("bookingId"), t("customer"), t("date"), t("total"), t("advance"), t("discount"), t("pending"), t("status")]];
      body = data.map(r => [r.booking_id, r.customer_name, fmtDate(r.booking_date), r.total_amount, r.advance_amount, r.discount_amount, r.pending_amount, r.payment_status]);
    } else if (activeTab === "pendingPayments") {
      head = [[t("bookingId"), t("customer"), t("phone"), t("date"), t("total"), t("paid"), t("pending")]];
      body = data.map(r => [r.booking_id, r.customer_name, r.phone_number, fmtDate(r.booking_date), r.total_amount, (r.advance_amount || 0), r.pending_amount]);
    } else if (activeTab === "bookingStatus") {
      head = [[t("bookingId"), t("customer"), t("date"), t("place"), t("functionType"), t("orderStatus"), t("paymentStatus"), t("total")]];
      body = data.map(r => [r.booking_id, r.customer_name, fmtDate(r.booking_date), r.place, r.function_type, r.order_status, r.payment_status, r.total_amount]);
    } else if (activeTab === "vendorBorrows") {
      head = [[t("vendorName"), t("categoryItem"), t("qty"), t("bookingId"), t("date"), t("status"), t("paid")]];
      body = data.map(r => [r.vendor_name, r.item_name, r.borrowed_quantity, r.booking_id, fmtDate(r.borrowed_at), r.return_status, r.amount_paid]);
    }

    autoTable(doc, {
      startY: 100,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`${activeTab.replace(/\s+/g, '_').toLowerCase()}_report.pdf`);
    toast.success("Report PDF downloaded.");
  };

  const renderFilters = () => {
    switch (activeTab) {
      case "monthlyIncome":
        return (
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label>{t("month")}</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}).map((_, i) => (
                    <SelectItem key={i} value={(i+1).toString().padStart(2, '0')}>{(i+1).toString().padStart(2, '0')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("year")}</Label>
              <Input value={year} onChange={e => setYear(e.target.value)} className="w-32" />
            </div>
          </div>
        );
      case "dailyBookings":
        return (
          <div className="space-y-1">
            <Label>{t("date")}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-48" />
          </div>
        );
      case "bookingStatus":
        return (
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1"><Label>{t("from")}</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label>{t("to")}</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" /></div>
            <div className="space-y-1">
              <Label>{t("status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                  <SelectItem value="delivered">{t("delivered")}</SelectItem>
                  <SelectItem value="returned">{t("returned")}</SelectItem>
                  <SelectItem value="complete_returned">{t("complete_returned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case "vendorBorrows":
        return (
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1"><Label>{t("from")}</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label>{t("to")}</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" /></div>
            <div className="space-y-1">
              <Label>{t("vendors")}</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      default:
        return <div className="text-sm text-muted-foreground pt-2">No filters needed for this report.</div>;
    }
  };

  const renderTable = () => {
    if (loading) return <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>;
    if (data.length === 0) return <div className="py-12 text-center text-muted-foreground">{t("noBookingsMatch")}</div>;

    if (activeTab === "monthlyIncome" || activeTab === "dailyBookings") {
      const gross = data.reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const collected = data.reduce((sum, r) => sum + (r.advance_amount || 0), 0);
      const pending = data.reduce((sum, r) => sum + (r.pending_amount || 0), 0);
      
      return (
        <div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("bookingId")}</th>
                  <th className="px-4 py-3">{t("customer")}</th>
                  <th className="px-4 py-3">{t("date")}</th>
                  <th className="px-4 py-3 text-right">{t("total")}</th>
                  <th className="px-4 py-3 text-right">{t("advance")}</th>
                  <th className="px-4 py-3 text-right">{t("due")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{r.booking_id}</td>
                    <td className="px-4 py-2 font-medium">{r.customer_name}</td>
                    <td className="px-4 py-2">{fmtDate(r.booking_date)}</td>
                    <td className="px-4 py-2 text-right">{fmtINR(r.total_amount)}</td>
                    <td className="px-4 py-2 text-right text-success">{fmtINR(r.advance_amount)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{fmtINR(r.pending_amount)}</td>
                    <td className="px-4 py-2">{r.payment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-muted/20 border rounded-lg flex flex-wrap gap-6 text-sm font-bold">
            <div>{t("bookings")}: {data.length}</div>
            <div>{t("grossRevenue")}: {fmtINR(gross)}</div>
            <div className="text-success">{t("totalCollected")}: {fmtINR(collected)}</div>
            <div className="text-destructive">{t("totalPending")}: {fmtINR(pending)}</div>
          </div>
        </div>
      );
    } else if (activeTab === "pendingPayments") {
      const pending = data.reduce((sum, r) => sum + (r.pending_amount || 0), 0);
      return (
        <div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("bookingId")}</th>
                  <th className="px-4 py-3">{t("customer")}</th>
                  <th className="px-4 py-3">{t("phone")}</th>
                  <th className="px-4 py-3">{t("date")}</th>
                  <th className="px-4 py-3 text-right">{t("total")}</th>
                  <th className="px-4 py-3 text-right">{t("due")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{r.booking_id}</td>
                    <td className="px-4 py-2 font-medium">{r.customer_name}</td>
                    <td className="px-4 py-2">{r.phone_number}</td>
                    <td className="px-4 py-2">{fmtDate(r.booking_date)}</td>
                    <td className="px-4 py-2 text-right">{fmtINR(r.total_amount)}</td>
                    <td className="px-4 py-2 text-right text-destructive font-bold">{fmtINR(r.pending_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex flex-wrap gap-6 text-sm font-bold">
            <div>{t("pending")} {t("bookings")}: {data.length}</div>
            <div className="text-destructive">{t("totalPending")}: {fmtINR(pending)}</div>
          </div>
        </div>
      );
    } else if (activeTab === "bookingStatus") {
      return (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("bookingId")}</th>
                <th className="px-4 py-3">{t("customer")}</th>
                <th className="px-4 py-3">{t("date")}</th>
                <th className="px-4 py-3">{t("functionType")}</th>
                <th className="px-4 py-3">{t("status")}</th>
                <th className="px-4 py-3 text-right">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono">{r.booking_id}</td>
                  <td className="px-4 py-2 font-medium">{r.customer_name}</td>
                  <td className="px-4 py-2">{fmtDate(r.booking_date)}</td>
                  <td className="px-4 py-2">{r.function_type || '—'}</td>
                  <td className="px-4 py-2 uppercase text-xs font-bold">{r.order_status}</td>
                  <td className="px-4 py-2 text-right">{fmtINR(r.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (activeTab === "vendorBorrows") {
      const paid = data.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
      return (
        <div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("vendors")}</th>
                  <th className="px-4 py-3">{t("categoryItem")}</th>
                  <th className="px-4 py-3 text-center">{t("qty")}</th>
                  <th className="px-4 py-3">{t("bookingId")}</th>
                  <th className="px-4 py-3">{t("date")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3 text-right">{t("paid")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{r.vendor_name}</td>
                    <td className="px-4 py-2">{r.item_name}</td>
                    <td className="px-4 py-2 text-center">{r.borrowed_quantity}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.booking_id}</td>
                    <td className="px-4 py-2 text-xs">{fmtDate(r.borrowed_at)}</td>
                    <td className="px-4 py-2 uppercase text-[10px] font-bold">{r.return_status}</td>
                    <td className="px-4 py-2 text-right text-success">{fmtINR(r.amount_paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-muted/20 border rounded-lg flex flex-wrap gap-6 text-sm font-bold">
            <div>Total Borrows: {data.length}</div>
            <div className="text-success">Total Amount Paid: {fmtINR(paid)}</div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("reportsTitle")} subtitle={t("reportsSubtitle")} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Tabs */}
        <div className="w-full lg:w-64 space-y-1 shrink-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${
                activeTab === tab 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "hover:bg-muted"
              }`}
            >
              <FileText className="h-4 w-4" />
              {t(tab)}
            </button>
          ))}
        </div>

        {/* Report Content */}
        <div className="flex-1 space-y-4">
          <Card className="shadow-elegant border-none bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
              <div>
                <CardTitle>{t(activeTab)}</CardTitle>
                <div className="mt-4">
                  {renderFilters()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadImage} disabled={data.length === 0}>
                  <ImageIcon className="mr-2 h-4 w-4" /> {t("exportImage")}
                </Button>
                <Button size="sm" onClick={handleDownloadPDF} disabled={data.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> {t("exportPdf")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div ref={reportRef} className="bg-white text-black p-4 md:p-6 rounded-md min-h-[400px]">
                {/* Print Header inside the capture area */}
                <div className="mb-6 border-b pb-4">
                  <div className="text-2xl font-bold font-sans">{profile.name_kn || profile.name_en || "Business Name"}</div>
                  <div className="text-sm font-semibold mt-1">{t(activeTab)} {t("reports")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t("dateTime")}: {new Date().toLocaleString()}</div>
                </div>
                {renderTable()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reports;
