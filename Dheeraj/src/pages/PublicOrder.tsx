import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tent, ShoppingCart, Plus, Minus, Trash2, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { fmtINR } from "@/lib/format";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";
import { supabase } from "@/integrations/supabase/client"; // Still need for inventory for now
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineStatus } from "@/components/OfflineStatus";

type Mode = "Takeaway" | "Delivery";

const PublicOrder = () => {
  const { t, lang, setLang } = useI18n();
  const { sessionId } = useParams(); // URL is /order/:sessionId
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>("Delivery");

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 16));

  // OTP Simulation
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateAndLoad();
  }, [sessionId]);

  const validateAndLoad = async () => {
    try {
      const { valid } = await api.validateOrderLink(sessionId!);
      if (valid) {
        setIsValid(true);
        // Load inventory from Supabase (shared resource)
        const [{ data: it }, { data: cat }] = await Promise.all([
          supabase.from("inventory_items").select("*").order("name"),
          supabase.from("categories").select("*").order("name"),
        ]);
        setItems(it || []);
        setCategories(cat || []);
      } else {
        setIsValid(false);
      }
    } catch (err) {
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  const priceOf = (it: any) => {
    if (mode === "Delivery") return Number(it.price_delivery || it.price || 0);
    return Number(it.price_takeaway || it.price || 0);
  };

  const cartItems = useMemo(() =>
    Object.entries(cart).map(([id, q]) => {
      const it = items.find((x) => x.id === id);
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
    if (!name || !phone || !address) return toast.error("Please fill all details");
    if (cartItems.length === 0) return toast.error("Please select at least one item");
    
    // Simulate OTP sending
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setStep('otp');
    toast.success(`Simulated OTP sent to ${phone}: ${code}`);
  };

  const verifyAndSubmit = async () => {
    if (otp !== generatedOtp) return toast.error("Invalid OTP. Try again.");
    
    setLoading(true);
    try {
      await api.submitPublicOrder(sessionId!, {
        customer_name: name,
        phone_number: phone,
        place: address,
        pricing_mode: mode.toLowerCase(),
        delivery_takeaway_date: deliveryDate,
        items: cartItems,
        total_amount: total
      });
      setStep('success');
    } catch (err) {
      toast.error("Failed to submit order request");
    } finally {
      setLoading(false);
    }
  };
  
  const toggleLang = () => setLang(lang === 'en' ? 'kn' : 'en');

  if (loading) return <div className="min-h-screen grid place-items-center">{t("loading")}...</div>;
  if (isValid === false) return <div className="min-h-screen grid place-items-center text-destructive font-bold">{t("noRecordsFound")}</div>;

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center"><CheckCircle2 className="h-20 w-20 text-success" /></div>
          <h1 className="text-3xl font-bold">{t("uploaded")}!</h1>
          <p className="text-muted-foreground">{t("confirm")}</p>
          <Button onClick={() => window.close()} className="w-full">{t("cancel")}</Button>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col justify-center max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center"><ShieldCheck className="h-12 w-12 text-primary" /></div>
          <h2 className="text-2xl font-bold">{t("confirm")}</h2>
          <p className="text-sm text-muted-foreground">{t("phone")}: <strong>{phone}</strong></p>
        </div>
        <div className="space-y-4">
          <Input 
            placeholder="Enter 4-digit OTP" 
            className="text-center text-2xl tracking-widest h-14" 
            maxLength={4} 
            value={otp} 
            onChange={e => setOtp(e.target.value)} 
          />
          <Button onClick={verifyAndSubmit} className="w-full h-12" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify & Send Request'}
          </Button>
          <Button variant="ghost" onClick={() => setStep('form')} className="w-full">Change Phone Number</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-8 text-center space-y-2 relative">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleLang}
          className="absolute top-4 right-4 bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
        </Button>
        <h1 className="text-3xl font-bold">{t("newBooking")}</h1>
        <p className="opacity-80">{t("profileSubtitle")}</p>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-8 pb-32">
        {/* Customer Details */}
        <section className="space-y-4 bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold border-b pb-2">1. {t("customerInfo")}</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("customerName")}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("name")} />
            </div>
            <div className="space-y-1">
              <Label>{t("phone")} (WhatsApp)</Label>
              <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("phone")} />
            </div>
            <div className="space-y-1">
              <Label>{t("address")} / {t("place")}</Label>
              <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder={t("place")} />
            </div>
          </div>
        </section>

        {/* Order Type */}
        <section className="space-y-4 bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold border-b pb-2">2. {t("pricingMode")}</h3>
          <div className="flex gap-4">
            <Button 
              variant={mode === 'Delivery' ? 'default' : 'outline'}
              onClick={() => setMode('Delivery')}
              className="flex-1"
            >{t("delivery")}</Button>
            <Button 
              variant={mode === 'Takeaway' ? 'default' : 'outline'}
              onClick={() => setMode('Takeaway')}
              className="flex-1"
            >{t("takeaway")}</Button>
          </div>
          <div className="space-y-1">
            <Label>{mode === 'Delivery' ? t("deliveryDate") : t("takeawayDate")}</Label>
            <Input type="datetime-local" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
        </section>

        {/* Items Selection */}
        <section className="space-y-4">
          <h3 className="font-bold border-b pb-2">3. {t("categoryItems")}</h3>
          <div className="space-y-4">
            {categories.map(cat => {
              const catItems = items.filter(it => it.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-2">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase">{cat.name}</h4>
                  <div className="grid gap-3">
                    {catItems.map(it => (
                      <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                        <div className="flex-1">
                          <div className="font-medium">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{fmtINR(priceOf(it))}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(it.id, (cart[it.id] || 0) - 1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-6 text-center font-bold">{cart[it.id] || 0}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(it.id, (cart[it.id] || 0) + 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Floating Bottom Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">{t("total")}</div>
              <div className="text-xl font-bold text-primary">{fmtINR(total)}</div>
            </div>
            <Button onClick={handleSendRequest} className="h-12 px-8 text-lg font-bold">
              {t("save")} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      <InstallPrompt />
      <OfflineStatus />
    </div>
  );
};

export default PublicOrder;
