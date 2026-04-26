import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ArrowRight, ShieldCheck, Plus, Minus, Search, ShoppingBag, ClipboardList, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { fmtINR } from "@/lib/format";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineStatus } from "@/components/OfflineStatus";
import { cn } from "@/lib/utils";

type Mode = "Takeaway" | "Delivery";

const PublicOrder = () => {
  const { t, lang, setLang } = useI18n();
  const { sessionId } = useParams(); 
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [functionTypes, setFunctionTypes] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>("Delivery");

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 16));
  const [functionType, setFunctionType] = useState("");

  // Flow State
  const [step, setStep] = useState<'welcome' | 'form' | 'otp' | 'success' | 'status'>('welcome');
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [tokenNumber, setTokenNumber] = useState("");
  const [orderStatus, setOrderStatus] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateAndLoad();
  }, [sessionId]);

  const validateAndLoad = async () => {
    try {
      const { valid } = await api.validateOrderLink(sessionId!);
      if (valid) {
        setIsValid(true);
        const [it, cat, ft] = await Promise.all([
          api.getItems(),
          api.getCategories(),
          api.getFunctionTypes()
        ]);
        setItems(it || []);
        setCategories(cat || []);
        setFunctionTypes(ft || []);
      } else {
        setIsValid(false);
      }
    } catch (err) {
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
       const res = await api.checkPublicOrderStatus(sessionId!);
       if (res.found) {
         setOrderStatus(res.booking);
         setStep('status');
       } else {
         toast.error("No active order found for this link yet.");
       }
    } catch (err) {
      toast.error("Error checking status");
    } finally {
      setLoading(false);
    }
  };

  const priceOf = (it: any) => {
    if (mode === "Delivery") return Number(it.delivery_price || it.unit_price || it.price || 0);
    return Number(it.takeaway_price || it.unit_price || it.price || 0);
  };

  const cartItems = useMemo(() =>
    Object.entries(cart).map(([id, q]) => {
      const it = items.find((x) => x.id.toString() === id.toString());
      return it ? {
        item_id: id, item_name: it.name, unit_price: priceOf(it), quantity: q,
        subtotal: priceOf(it) * q
      } : null;
    }).filter(Boolean) as any[],
    [cart, items, mode]
  );

  const total = cartItems.reduce((s, i) => s + i.subtotal, 0);

  const setQty = (id: string, q: number) => {
    const next = Math.max(0, q);
    setCart((c) => { 
      const nx = { ...c }; 
      if (next === 0) delete nx[id]; 
      else nx[id] = next; 
      return nx; 
    });
  };

  const handleSendRequest = () => {
    if (!name || !phone || !address || !functionType) return toast.error("Please fill all details");
    if (cartItems.length === 0) return toast.error("Please select at least one item");
    
    // Simulate OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    toast.success(`OTP for testing: ${code}`);
  };

  const verifyAndSubmit = async () => {
    if (otp !== generatedOtp) return toast.error("Invalid OTP");
    
    setLoading(true);
    try {
      const res = await api.submitPublicOrder(sessionId!, {
        customer_name: name,
        phone_number: phone,
        place: address,
        pricing_mode: mode.toLowerCase(),
        delivery_takeaway_date: deliveryDate,
        function_type: functionType,
        items: cartItems,
        total_amount: total
      });
      setTokenNumber(res.booking_id);
      setStep('success');
    } catch (err) {
      toast.error("Failed to submit request");
    } finally {
      setLoading(false);
    }
  };
  
  const toggleLang = () => setLang(lang === 'en' ? 'kn' : 'en');

  if (loading && step === 'welcome') return <div className="min-h-screen grid place-items-center">{t("loading")}...</div>;
  if (isValid === false) return <div className="min-h-screen grid place-items-center text-destructive font-bold">LINK EXPIRED OR INVALID</div>;

  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-500">
         <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold text-primary uppercase tracking-tight">Shiva Shakti</h1>
            <p className="text-muted-foreground">Premium Event Rentals</p>
         </div>
         <div className="grid w-full max-w-sm gap-4">
            <Button size="lg" className="h-20 text-lg font-bold gap-3" onClick={() => setStep('form')}>
               <ShoppingBag className="h-6 w-6" /> Place New Order
            </Button>
            <Button size="lg" variant="outline" className="h-20 text-lg font-bold gap-3" onClick={checkStatus}>
               <ClipboardList className="h-6 w-6" /> Check Order Status
            </Button>
         </div>
         <Button variant="ghost" onClick={toggleLang} className="text-muted-foreground">{lang === 'en' ? 'ಕನ್ನಡದಲ್ಲಿ ನೋಡಿ' : 'Switch to English'}</Button>
      </div>
    );
  }

  if (step === 'status') {
    const s = orderStatus?.order_status || 'pending';
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center space-y-6">
        <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl space-y-6 text-center">
           <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              {s === 'pending' && <Clock className="h-10 w-10 text-primary animate-pulse" />}
              {s === 'confirmed' && <CheckCircle className="h-10 w-10 text-success" />}
              {s === 'rejected' && <XCircle className="h-10 w-10 text-destructive" />}
           </div>
           <div className="space-y-1">
              <h2 className="text-2xl font-bold uppercase tracking-tight">Order {s}</h2>
              <p className="text-sm text-muted-foreground">Token: <span className="font-mono font-bold text-primary">{orderStatus?.booking_id}</span></p>
           </div>
           <div className="py-4 border-y space-y-2">
              <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Total Amount</span>
                 <span className="font-bold">{fmtINR(orderStatus?.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">Order Date</span>
                 <span>{new Date(orderStatus?.created_at).toLocaleDateString()}</span>
              </div>
           </div>
           <p className="text-xs text-muted-foreground italic">
              {s === 'pending' ? "Please wait for shop owner to confirm your order." : "Order has been processed."}
           </p>
           <Button variant="outline" className="w-full" onClick={() => setStep('welcome')}>Back Home</Button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6 text-center">
        <div className="max-w-md space-y-6 animate-in zoom-in duration-500">
          <div className="flex justify-center"><CheckCircle2 className="h-24 w-24 text-success" /></div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold uppercase">Request Sent!</h1>
            <p className="text-muted-foreground">Your order has been submitted for approval.</p>
          </div>
          <div className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/20 space-y-2">
             <div className="text-xs uppercase font-bold text-primary tracking-widest">Your Token Number</div>
             <div className="text-5xl font-black tracking-tighter text-primary">{tokenNumber}</div>
             <div className="text-[10px] text-muted-foreground pt-2">Keep this number to track your order.</div>
          </div>
          <Button onClick={() => setStep('welcome')} className="w-full h-12 font-bold uppercase tracking-wider">OK</Button>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center"><ShieldCheck className="h-16 w-16 text-primary" /></div>
          <h2 className="text-2xl font-bold uppercase tracking-tight">Verify Your Mobile</h2>
          <p className="text-sm text-muted-foreground">OTP sent to <strong>{phone}</strong></p>
        </div>
        <div className="space-y-4">
          <Input 
            placeholder="0000" 
            className="text-center text-4xl font-bold tracking-[1rem] h-20 bg-muted/30 border-2 focus:border-primary" 
            maxLength={4} 
            value={otp} 
            onChange={e => setOtp(e.target.value)} 
          />
          <Button onClick={verifyAndSubmit} className="w-full h-14 text-lg font-bold uppercase" disabled={loading}>
            {loading ? 'Verifying...' : 'Submit Request'}
          </Button>
          <Button variant="ghost" onClick={() => setStep('form')} className="w-full text-muted-foreground">Change Phone Number</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f6]">
      <header className="bg-[#4a3428] text-white p-10 text-center space-y-2 relative rounded-b-[2rem] shadow-xl">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleLang}
          className="absolute top-6 right-6 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-full px-4"
        >
          {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
        </Button>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Order Request</h1>
        <p className="opacity-70 text-sm font-medium tracking-wide">SHIVA SHAKTI SHAMIYANA</p>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-10 pb-32">
        {/* Step 1: Customer Info */}
        <section className="space-y-6 bg-white p-8 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">1</div>
            <h3 className="font-bold text-lg uppercase tracking-tight">Your Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="bg-muted/30 border-none h-12" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">WhatsApp Number</Label>
              <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit number" className="bg-muted/30 border-none h-12" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Delivery Address / Place</Label>
              <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" className="bg-muted/30 border-none min-h-[80px] resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Function Type</Label>
              <select 
                value={functionType} 
                onChange={e => setFunctionType(e.target.value)}
                className="w-full bg-muted/30 border-none h-12 rounded-md px-3 text-sm"
              >
                <option value="">Select Function Type</option>
                {functionTypes.map(ft => (
                  <option key={ft.id} value={ft.name}>{ft.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Step 2: Delivery Details */}
        <section className="space-y-6 bg-white p-8 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">2</div>
            <h3 className="font-bold text-lg uppercase tracking-tight">Service Mode</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
               <Label className="text-xs uppercase font-bold text-muted-foreground">Pricing Mode</Label>
               <div className="flex gap-4 p-1 bg-muted/30 rounded-xl">
                 <Button 
                   variant={mode === 'Delivery' ? 'default' : 'ghost'}
                   onClick={() => setMode('Delivery')}
                   className="flex-1 rounded-lg font-bold"
                 >Delivery</Button>
                 <Button 
                   variant={mode === 'Takeaway' ? 'default' : 'ghost'}
                   onClick={() => setMode('Takeaway')}
                   className="flex-1 rounded-lg font-bold"
                 >Takeaway</Button>
               </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Preferred Date & Time</Label>
              <Input type="datetime-local" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="bg-muted/30 border-none h-12" />
            </div>
          </div>
        </section>

        {/* Step 3: Item Selection (Side-by-side on desktop) */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b pb-4 mb-4">
            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">3</div>
            <h3 className="font-bold text-lg uppercase tracking-tight">Select Items</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
             {/* Category Column */}
             <div className="space-y-8">
                <h4 className="text-xs font-black uppercase text-primary tracking-widest mb-4">Categorized Items</h4>
                {categories.map(cat => {
                  const catItems = items.filter(it => it.category_id === cat.id);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat.id} className="space-y-3">
                      <h5 className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 px-2 py-1 inline-block rounded">{cat.name}</h5>
                      <div className="space-y-2">
                        {catItems.map(it => (
                          <ItemCard key={it.id} it={it} qty={cart[it.id] || 0} onSetQty={(q) => setQty(it.id.toString(), q)} price={priceOf(it)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
             </div>

             {/* Independent Column */}
             <div className="space-y-8">
                <h4 className="text-xs font-black uppercase text-primary tracking-widest mb-4">Independent Items</h4>
                <div className="space-y-2">
                   {items.filter(it => !it.category_id).map(it => (
                      <ItemCard key={it.id} it={it} qty={cart[it.id] || 0} onSetQty={(q) => setQty(it.id.toString(), q)} price={priceOf(it)} />
                   ))}
                   {items.filter(it => !it.category_id).length === 0 && <p className="text-xs text-muted-foreground">No independent items.</p>}
                </div>
             </div>
          </div>
        </section>
      </main>

      {/* Floating Bottom Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-6 shadow-2xl z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Estimate</div>
              <div className="text-2xl font-black text-primary">{fmtINR(total)}</div>
            </div>
            <Button onClick={handleSendRequest} size="lg" className="h-14 px-10 text-lg font-black uppercase tracking-wider gap-2">
              Send Request <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      <InstallPrompt />
      <OfflineStatus />
    </div>
  );
};

const ItemCard = ({ it, qty, onSetQty, price }: any) => (
  <div className="flex items-center justify-between p-4 bg-white border-2 rounded-2xl hover:border-primary/30 transition-all hover:shadow-md group">
    <div className="flex-1 min-w-0 pr-4">
      <div className="font-bold text-sm truncate uppercase tracking-tight">{it.name}</div>
      <div className="text-xs font-bold text-primary">{fmtINR(price)}</div>
    </div>
    <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl group-hover:bg-primary/5 transition-colors">
      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white hover:text-destructive" onClick={() => onSetQty(qty - 1)} disabled={qty <= 0}>
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className={cn("w-6 text-center font-black text-sm", qty > 0 ? "text-primary" : "text-muted-foreground")}>{qty}</span>
      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white hover:text-primary" onClick={() => onSetQty(qty + 1)}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);

export default PublicOrder;
