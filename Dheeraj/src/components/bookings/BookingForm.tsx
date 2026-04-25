import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Mic, Square, Trash2, X, Plus, Minus, Search, AlertCircle } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { useI18n } from "@/context/I18nContext";

interface BookingFormProps {
  initialData?: any;
  onClose: () => void;
  onSave: () => void;
}

export const BookingForm = ({ initialData, onClose, onSave }: BookingFormProps) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    booking_id: '',
    customer_id: '',
    customer_name: '',
    phone_number: '',
    place: '',
    function_type: '',
    booking_date: new Date().toISOString().slice(0, 16),
    delivery_takeaway_date: new Date().toISOString().slice(0, 16),
    pricing_mode: 'delivery' as 'delivery' | 'takeaway',
    delivery_charge: 0,
    advance_amount: 0,
    discount_amount: 0,
    payment_method: '' as 'cash' | 'upi' | '',
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lastBookingInfo, setLastBookingInfo] = useState<any>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [functionTypes, setFunctionTypes] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [upiType, setUpiType] = useState<'smart' | 'static'>('smart');

  // Voice Notes
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    fetchBaseData();
    if (initialData) {
      setFormData({
        ...formData,
        ...initialData,
        delivery_takeaway_date: initialData.delivery_takeaway_date ? new Date(initialData.delivery_takeaway_date).toISOString().slice(0, 16) : formData.delivery_takeaway_date,
      });
      setSelectedItems(initialData.items || []);
    } else {
      initNewBooking();
    }
  }, [initialData]);

  const fetchBaseData = async () => {
    try {
      const [cats, items, vends, types, profile] = await Promise.all([
        api.getCategories(),
        api.getItems(),
        api.getVendors(),
        api.getFunctionTypes(),
        api.getBusinessProfile()
      ]);
      setCategories(cats || []);
      setInventoryItems(items || []);
      setVendors(vends || []);
      setFunctionTypes(types || []); 
      setBusinessProfile(profile || null);
    } catch (err) {
      console.error("Failed to fetch base data", err);
    }
  };

  const initNewBooking = async () => {
    const { booking_id } = await api.generateBookingID();
    setFormData(prev => ({ ...prev, booking_id }));
  };

  const handleCustomerSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length > 2) {
      const results = await api.searchCustomers(val);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const selectCustomer = async (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customer.customer_id,
      customer_name: customer.name,
      phone_number: customer.phone,
      place: customer.place || prev.place,
    }));
    setLastBookingInfo(customer.last_booking);
    setSearchResults([]);
    setSearchQuery("");
  };

  const generateNewCustomer = async () => {
    const { customer_id } = await api.generateCustomerID();
    setFormData(prev => ({ ...prev, customer_id }));
  };

  // Voice Recording Logic
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      setAudioBlob(blob);
    };
    mediaRecorder.current.start();
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 300) { // 5 minutes
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  // Item Logic
  const updateItemQty = (item: any, delta: number) => {
    const existing = selectedItems.find(i => i.item_id === item.id);
    const rawPrice = formData.pricing_mode === 'takeaway' ? item.takeaway_price : item.delivery_price;
    const price = rawPrice !== null ? Number(rawPrice) : 0;
    
    if (existing) {
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        setSelectedItems(selectedItems.filter(i => i.item_id !== item.id));
      } else {
        setSelectedItems(selectedItems.map(i => i.item_id === item.id ? { ...i, quantity: newQty, subtotal: newQty * i.unit_price } : i));
      }
    } else if (delta > 0) {
      setSelectedItems([...selectedItems, {
        item_id: item.id,
        item_name: item.name,
        quantity: delta,
        unit_price: price,
        subtotal: delta * price,
        manualPrice: rawPrice === null,
        vendor_id: null
      }]);
    }
  };

  const handleManualPriceChange = (itemId: any, price: number) => {
    setSelectedItems(selectedItems.map(i => i.item_id === itemId ? { ...i, unit_price: price, subtotal: i.quantity * price } : i));
  };

  const handleVendorSelect = (itemId: any, vendorId: string) => {
    setSelectedItems(selectedItems.map(i => i.item_id === itemId ? { ...i, vendor_id: Number(vendorId) } : i));
  };

  const itemsSubtotal = selectedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  const deliveryCharge = formData.pricing_mode === 'delivery' ? Number(formData.delivery_charge) : 0;
  const totalAmount = itemsSubtotal + deliveryCharge;
  const pendingAmount = totalAmount - Number(formData.advance_amount) - Number(formData.discount_amount);

  const saveBooking = async (status: string = 'confirmed') => {
    if (!formData.customer_name || !formData.phone_number) return toast.error("Customer name and phone are required");
    if (!formData.customer_id) {
        const { customer_id } = await api.generateCustomerID();
        formData.customer_id = customer_id;
    }
    
    // Check if borrowed items have vendors selected
    for (const item of selectedItems) {
        const inv = inventoryItems.find(i => i.id === item.item_id);
        const avail = inv ? inv.available_quantity : 0;
        if ((avail === null || item.quantity > avail) && !item.vendor_id) {
            return toast.error(`Please select a vendor for ${item.item_name} (Insufficient stock)`);
        }
    }

    if (!formData.payment_method && formData.advance_amount > 0) return toast.error("Payment method not selected. Please select Cash or UPI.");

    setLoading(true);
    const data = new FormData();
    Object.entries(formData).forEach(([key, val]) => data.append(key, val as any));
    data.set('order_status', status);
    data.set('total_amount', totalAmount.toString());
    data.set('items', JSON.stringify(selectedItems));
    if (audioBlob) data.append('voice_note', audioBlob, 'voice.webm');

    try {
      await api.createBooking(data);
      toast.success("Booking saved successfully");
      onSave();
      onClose();
    } catch (err) {
      toast.error("Failed to save booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{initialData ? t("editBooking") : t("newBooking")}</h2>
        <Button variant="ghost" onClick={onClose}><X /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("bookingDate")}</Label>
          <Input type="datetime-local" value={formData.booking_date} onChange={e => setFormData({...formData, booking_date: e.target.value})} />
        </div>
        <div className="space-y-2 text-right">
           <div className="text-xs text-muted-foreground">{t("bookingId")}: <span className="font-mono text-primary font-bold">{formData.booking_id}</span></div>
           <div className="text-xs text-muted-foreground">{t("customer")} ID: <span className="font-mono text-primary font-bold">{formData.customer_id || t("new")}</span></div>
        </div>
      </div>

      <div className="relative space-y-2">
        <Label>{t("customerSearch")}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={searchQuery} onChange={e => handleCustomerSearch(e.target.value)} className="pl-9" />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map(c => (
              <div key={c.customer_id} className="p-3 hover:bg-muted cursor-pointer flex justify-between" onClick={() => selectCustomer(c)}>
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone} | {c.place}</div>
                </div>
                <div className="text-xs font-mono">{c.customer_id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("pricingMode")}</Label>
        <div className="flex gap-4">
          <Button variant={formData.pricing_mode === 'delivery' ? 'default' : 'outline'} onClick={() => setFormData({...formData, pricing_mode: 'delivery'})} className="flex-1">{t("delivery")}</Button>
          <Button variant={formData.pricing_mode === 'takeaway' ? 'default' : 'outline'} onClick={() => setFormData({...formData, pricing_mode: 'takeaway'})} className="flex-1">{t("takeaway")}</Button>
        </div>
        {formData.pricing_mode === 'delivery' && (
          <div className="mt-2 space-y-1">
            <Label>{t("deliveryCharge")} (₹)</Label>
            <Input type="number" inputMode="numeric" value={formData.delivery_charge || ""} onChange={e => setFormData({...formData, delivery_charge: Number(e.target.value)})} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1 md:col-span-1"><Label>{t("customerName")}</Label><Input value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-1"><Label>{t("phone")}</Label><Input type="number" inputMode="numeric" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-1"><Label>{t("place")}</Label><Input value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-1">
          <Label>{t("functionType")}</Label>
          <Select value={formData.function_type} onValueChange={(v) => setFormData({...formData, function_type: v})}>
            <SelectTrigger><SelectValue placeholder={t("all")} /></SelectTrigger>
            <SelectContent>
              {functionTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{formData.pricing_mode === 'delivery' ? t("deliveryDate") : t("takeawayDate")}</Label>
        <Input type="datetime-local" value={formData.delivery_takeaway_date} onChange={e => setFormData({...formData, delivery_takeaway_date: e.target.value})} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
        <div className="space-y-4">
          <h3 className="font-bold">{t("categoryItems")}</h3>
          <Accordion type="multiple" className="w-full">
            {categories.map(cat => (
              <AccordionItem key={cat.id} value={cat.id.toString()}>
                <AccordionTrigger>{cat.name}</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {inventoryItems.filter(it => it.category_id === cat.id).map(it => {
                    const price = formData.pricing_mode === 'takeaway' ? it.takeaway_price : it.delivery_price;
                    const selected = selectedItems.find(s => s.item_id === it.id);
                    const qty = selected?.quantity || 0;
                    const avail = it.available_quantity;
                    const isShort = avail === null || qty > avail;

                    return (
                      <div key={it.id} className="p-3 border rounded-lg space-y-2 bg-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{it.name}</div>
                            <div className="text-xs text-muted-foreground">{price !== null ? fmtINR(price) : "—"} | {t("available")}: {avail !== null ? avail : '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(it, -1)}><Minus className="h-3 w-3" /></Button>
                            <span className="w-8 text-center font-bold">{qty}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(it, 1)}><Plus className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        {qty > 0 && isShort && (
                          <div className="space-y-2 pt-2 border-t border-dashed">
                            <div className="text-[10px] text-destructive flex items-center gap-1 font-bold uppercase"><AlertCircle className="h-3 w-3" /> {t("noStock")} {t("borrow")}?</div>
                            <Select value={selected?.vendor_id?.toString() || ""} onValueChange={(v) => handleVendorSelect(it.id, v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("all")} /></SelectTrigger>
                              <SelectContent>
                                {vendors.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div className="space-y-4">
          <h3 className="font-bold">{t("other")}</h3>
          <div className="space-y-3">
            {inventoryItems.filter(it => it.category_id === null).map(it => {
              const price = formData.pricing_mode === 'takeaway' ? it.takeaway_price : it.delivery_price;
              const selected = selectedItems.find(s => s.item_id === it.id);
              const qty = selected?.quantity || 0;
              const avail = it.available_quantity;
              const isShort = avail === null || qty > avail;

              return (
                <div key={it.id} className="p-3 border rounded-lg space-y-2 bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{price !== null ? fmtINR(price) : "—"} | {t("available")}: {avail !== null ? avail : '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(it, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center font-bold">{qty}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(it, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {qty > 0 && isShort && (
                    <div className="space-y-2 pt-2 border-t border-dashed">
                      <div className="text-[10px] text-destructive flex items-center gap-1 font-bold uppercase"><AlertCircle className="h-3 w-3" /> {t("noStock")} {t("borrow")}?</div>
                      <Select value={selected?.vendor_id?.toString() || ""} onValueChange={(v) => handleVendorSelect(it.id, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("all")} /></SelectTrigger>
                        <SelectContent>
                          {vendors.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("selectedItems")}</Label>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">{t("categoryItem")}</th>
                <th className="text-center p-2">{t("qty")}</th>
                <th className="text-right p-2">{t("unitPrice")}</th>
                <th className="text-right p-2">{t("total")}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map(it => (
                <tr key={it.item_id} className="border-t">
                  <td className="p-2">
                    {it.item_name}
                    {it.vendor_id && <div className="text-[10px] text-destructive font-bold uppercase">{t("borrowedFrom")}: {vendors.find(v => v.id === it.vendor_id)?.name}</div>}
                  </td>
                  <td className="p-2 text-center">{it.quantity}</td>
                  <td className="p-2 text-right">
                    {it.manualPrice ? (
                      <Input 
                        type="number" 
                        className="h-8 w-24 ml-auto text-right" 
                        value={it.unit_price || ""} 
                        onChange={e => handleManualPriceChange(it.item_id, Number(e.target.value))} 
                        placeholder="Enter Price"
                      />
                    ) : fmtINR(it.unit_price)}
                  </td>
                  <td className="p-2 text-right">{fmtINR(it.subtotal)}</td>
                  <td className="p-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedItems(selectedItems.filter(s => s.item_id !== it.item_id))}><X className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-6 border-t space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-lg">
          <div><Label className="text-xs">{t("total")}</Label><div className="text-lg font-bold">{fmtINR(totalAmount)}</div></div>
          <div><Label className="text-xs">{t("advance")} (₹)</Label><Input type="number" inputMode="numeric" value={formData.advance_amount || ""} onChange={e => setFormData({...formData, advance_amount: Number(e.target.value)})} /></div>
          <div><Label className="text-xs">{t("discount")} (₹)</Label><Input type="number" inputMode="numeric" value={formData.discount_amount || ""} onChange={e => setFormData({...formData, discount_amount: Number(e.target.value)})} /></div>
          <div><Label className="text-xs">{t("due")}</Label><div className="text-lg font-bold text-destructive">{fmtINR(pendingAmount)}</div></div>
        </div>

        <div className="space-y-2">
          <Label>{t("paymentMethod")} *</Label>
          <div className="flex gap-4">
            <Button variant={formData.payment_method === 'cash' ? 'default' : 'outline'} onClick={() => setFormData({...formData, payment_method: 'cash'})} className="flex-1">{t("cash")}</Button>
            <Button variant={formData.payment_method === 'upi' ? 'default' : 'outline'} onClick={() => setFormData({...formData, payment_method: 'upi'})} className="flex-1">UPI</Button>
          </div>
        </div>

        {formData.payment_method === 'upi' && formData.advance_amount > 0 && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/10">
            <div className="flex gap-2">
              <Button size="sm" variant={upiType === 'smart' ? 'default' : 'outline'} onClick={() => setUpiType('smart')}>Smart QR</Button>
              <Button size="sm" variant={upiType === 'static' ? 'default' : 'outline'} onClick={() => setUpiType('static')}>Static QR</Button>
            </div>
            <div className="flex justify-center">
              {upiType === 'smart' ? (
                businessProfile?.upi_id ? (
                  <div className="p-4 bg-white rounded-xl shadow-sm text-center space-y-2">
                    <QRCodeSVG 
                      value={`upi://pay?pa=${businessProfile.upi_id}&pn=${encodeURIComponent(businessProfile.upi_name || 'Business')}&am=${formData.advance_amount}&cu=INR`} 
                      size={200} 
                    />
                    <div className="text-sm font-bold text-black mt-2">Scan to pay {fmtINR(formData.advance_amount)}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4">UPI ID not configured in settings.</div>
                )
              ) : (
                businessProfile?.static_qr_path ? (
                  <div className="p-4 bg-white rounded-xl shadow-sm">
                    <img src={`http://localhost:5000/${businessProfile.static_qr_path}`} alt="Static QR" className="w-[200px] h-[200px] object-cover" />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4">Static QR not uploaded in settings.</div>
                )
              )}
            </div>
          </div>
        )}

        <Button onClick={() => saveBooking('confirmed')} disabled={loading} className="w-full h-12 text-lg font-bold">{t("save")}</Button>
      </div>
    </div>
  );
};
