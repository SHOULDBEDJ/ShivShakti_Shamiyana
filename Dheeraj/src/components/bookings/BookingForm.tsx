import { useState, useEffect, useRef } from "react";
import { api, API_BASE_URL } from "@/lib/api";
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
import { cn } from "@/lib/utils";


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

  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [lastBookingInfo, setLastBookingInfo] = useState<any>(null);


  const [categories, setCategories] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [functionTypes, setFunctionTypes] = useState<any[]>([]);

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);


  // Voice Notes
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const [isListening, setIsListening] = useState<string | null>(null);

  const listenSpeech = (field: 'customer_name' | 'place') => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'kn-IN'; // Default to Kannada for this app
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(field);
    recognition.onend = () => setIsListening(null);
    recognition.onerror = (event: any) => {
      setIsListening(null);
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        toast.error("Microphone permission denied. Please allow mic access in your browser.");
      } else if (event.error === 'no-speech') {
        toast.error("No speech detected. Please try again.");
      } else if (event.error === 'network') {
        toast.error("Network error. Speech recognition requires an internet connection.");
      } else {
        toast.error(`Speech error: ${event.error}. Please try again.`);
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setFormData(prev => ({ ...prev, [field]: transcript }));
    };

    try {
      recognition.start();
    } catch (e) {
      setIsListening(null);
    }
  };


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
      const [cats, items, types, profile, vends] = await Promise.all([
        api.getCategories(),
        api.getItems(),
        api.getFunctionTypes(),
        api.getBusinessProfile(),
        api.getVendors()
      ]);
      setCategories(cats || []);
      setInventoryItems(items || []);
      setFunctionTypes(types || []); 
      setBusinessProfile(profile || null);
      setVendors(vends || []);
    } catch (err) {
      console.error("Failed to fetch base data", err);
    }
  };


  const initNewBooking = async () => {
    const { booking_id } = await api.generateBookingID();
    
    // Check for local draft
    const saved = localStorage.getItem("booking_draft");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        // Only offer to resume if it's a new booking (no initialData)
        if (!initialData) {
          toast("You have an unsaved draft. Resume?", {
            action: {
              label: "Resume",
              onClick: () => {
                setFormData(draft.formData);
                setSelectedItems(draft.selectedItems);
                setAudioBlob(draft.audioBlob ? new Blob([draft.audioBlob], { type: 'audio/webm' }) : null);
                toast.success("Draft resumed");
              }
            },
            cancel: {
              label: "Discard",
              onClick: () => localStorage.removeItem("booking_draft")
            }
          });
        }
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    
    setFormData(prev => ({ ...prev, booking_id }));
  };

  useEffect(() => {
    if (formData.phone_number.length === 10 && !initialData) {
      handlePhoneSearch(formData.phone_number);
    }
  }, [formData.phone_number]);

  const handlePhoneSearch = async (phone: string) => {
    try {
      const results = await api.searchCustomers(phone);
      if (results && results.length > 0) {
        const customer = results[0];
        setFormData(prev => ({
          ...prev,
          customer_id: customer.customer_id,
          customer_name: customer.name,
          place: customer.place || prev.place,
        }));
        setLastBookingInfo(customer.last_booking);
        toast.success("Existing customer found!");
      } else {
        const { customer_id } = await api.generateCustomerID();
        setFormData(prev => ({
          ...prev,
          customer_id,
          customer_name: '',
          place: '',
        }));
        toast.info("New customer number detected");
      }
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (!initialData && (formData.customer_name || selectedItems.length > 0)) {
      const timeout = setTimeout(() => {
        localStorage.setItem("booking_draft", JSON.stringify({ formData, selectedItems }));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [formData, selectedItems, initialData]);


  const selectCustomer = async (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customer.customer_id,
      customer_name: customer.name,
      phone_number: customer.phone,
      place: customer.place || prev.place,
    }));
    setLastBookingInfo(customer.last_booking);
    setSearchFeedback("Customer selected, take new order");
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

  const updateItemVendor = (itemId: number, vendorId: number) => {
    setSelectedItems(selectedItems.map(s => 
      s.item_id === itemId ? { ...s, vendor_id: vendorId } : s
    ));
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
      localStorage.removeItem("booking_draft");
      toast.success(status === 'draft' ? "Saved as draft" : "Booking saved successfully");
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

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-lg font-bold">{t("phone")}</Label>
            <Input 
              type="number" 
              inputMode="numeric" 
              value={formData.phone_number} 
              onChange={e => setFormData({...formData, phone_number: e.target.value})} 
              className="text-xl h-12 font-bold"
              placeholder="9876543210"
            />
          </div>
          <div className="space-y-2 text-right">
             <div className="text-xs text-muted-foreground">{t("bookingId")}: <span className="font-mono text-primary font-bold">{formData.booking_id}</span></div>
             <div className="text-xs text-muted-foreground">{t("customer")} ID: <span className="font-mono text-primary font-bold">{formData.customer_id || t("new")}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t("customerName")}</Label>
            <div className="relative">
              <Input value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="pr-10" />
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className={cn("absolute right-0 top-0 h-full hover:bg-transparent", isListening === 'customer_name' && "text-destructive animate-pulse")}
                onClick={() => listenSpeech('customer_name')}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("place")}</Label>
            <div className="relative">
              <Input value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} className="pr-10" />
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className={cn("absolute right-0 top-0 h-full hover:bg-transparent", isListening === 'place' && "text-destructive animate-pulse")}
                onClick={() => listenSpeech('place')}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t("functionType")}</Label>
            <Select value={formData.function_type} onValueChange={(v) => setFormData({...formData, function_type: v})}>
              <SelectTrigger><SelectValue placeholder={t("all")} /></SelectTrigger>
              <SelectContent>
                {functionTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{formData.pricing_mode === 'delivery' ? t("deliveryDate") : t("takeawayDate")}</Label>
            <Input type="datetime-local" value={formData.delivery_takeaway_date} onChange={e => setFormData({...formData, delivery_takeaway_date: e.target.value})} />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label className="font-bold text-muted-foreground uppercase text-xs tracking-wider">{t("pricingMode")}</Label>
          <div className="flex gap-4">
            <Button variant={formData.pricing_mode === 'delivery' ? 'default' : 'outline'} onClick={() => setFormData({...formData, pricing_mode: 'delivery'})} className="flex-1">{t("delivery")}</Button>
            <Button variant={formData.pricing_mode === 'takeaway' ? 'default' : 'outline'} onClick={() => setFormData({...formData, pricing_mode: 'takeaway'})} className="flex-1">{t("takeaway")}</Button>
          </div>
          {formData.pricing_mode === 'delivery' && (
            <div className="mt-2 space-y-1 animate-in slide-in-from-top-1 duration-200">
              <Label>{t("deliveryCharge")} (₹)</Label>
              <Input type="number" inputMode="numeric" value={formData.delivery_charge || ""} onChange={e => setFormData({...formData, delivery_charge: Number(e.target.value)})} />
            </div>
          )}
        </div>
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
                          <div className="space-y-2 mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/20 animate-in fade-in zoom-in duration-300">
                            <div className="text-[10px] text-destructive flex items-center gap-1 font-bold uppercase">
                              <AlertCircle className="h-3 w-3" /> {t("noStock")} — {t("insufficientStock")}
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("borrowedFrom")}</Label>
                               <Select 
                                 value={selected?.vendor_id?.toString() || ""} 
                                 onValueChange={(v) => updateItemVendor(it.id, Number(v))}
                               >
                                 <SelectTrigger className="h-8 text-xs bg-card border-destructive/30">
                                   <SelectValue placeholder={t("selectVendor")} />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {vendors.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                                   {vendors.length === 0 && <div className="p-2 text-[10px] text-muted-foreground">Add borrowers in Inventory tab</div>}
                                 </SelectContent>
                               </Select>
                            </div>
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
                    <div className="space-y-2 mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/20 animate-in fade-in zoom-in duration-300">
                      <div className="text-[10px] text-destructive flex items-center gap-1 font-bold uppercase">
                        <AlertCircle className="h-3 w-3" /> {t("noStock")} — {t("insufficientStock")}
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("borrowedFrom")}</Label>
                         <Select 
                           value={selected?.vendor_id?.toString() || ""} 
                           onValueChange={(v) => updateItemVendor(it.id, Number(v))}
                         >
                           <SelectTrigger className="h-8 text-xs bg-card border-destructive/30">
                             <SelectValue placeholder={t("selectVendor")} />
                           </SelectTrigger>
                           <SelectContent>
                             {vendors.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                             {vendors.length === 0 && <div className="p-2 text-[10px] text-muted-foreground">Add borrowers in Inventory tab</div>}
                           </SelectContent>
                         </Select>
                      </div>
                    </div>
                  )}



                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedItems.some(it => {
        const inv = (inventoryItems || []).find(i => i.id === it.item_id);
        const avail = inv ? inv.available_quantity : 0;
        return (avail === null || it.quantity > avail);
      }) && (
        <div className="p-4 bg-destructive/5 border-2 border-destructive/20 rounded-xl">
          <div className="flex items-center gap-2 text-destructive font-bold uppercase text-xs tracking-wider">
            <AlertCircle className="h-4 w-4" /> {t("noStock")} — {t("insufficientStock")}
          </div>
        </div>
      )}



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
              {selectedItems.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{t("noItemsSelected")}</td></tr>}
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

        {formData.payment_method === 'upi' && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/10 animate-in fade-in duration-300">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl shadow-sm text-center space-y-2">
                <QRCodeSVG 
                  value={`upi://pay?pa=9113565802.wa.8p7@waaxis&pn=${encodeURIComponent(businessProfile?.upi_name || 'Business')}&am=${totalAmount}&cu=INR`} 
                  size={200} 
                />
                <div className="text-sm font-bold text-black mt-2">Scan to pay Total: {fmtINR(totalAmount)}</div>
                <div className="text-[10px] text-muted-foreground">UPI ID: 9113565802.wa.8p7@waaxis</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => saveBooking('draft')} disabled={loading} className="flex-1 h-12 font-bold border-primary text-primary hover:bg-primary/5">
            {t("saveAsDraft")}
          </Button>
          <Button onClick={() => saveBooking('confirmed')} disabled={loading} className="flex-[2] h-12 text-lg font-bold">
            {t("save")}
          </Button>
        </div>

      </div>
    </div>
  );
};
