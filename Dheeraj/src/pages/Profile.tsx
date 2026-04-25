import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { User, Camera } from "lucide-react";
import { toast } from "sonner";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const Profile = () => {
  const { t } = useI18n();
  const [id, setId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("business_profile" as any).select("*").maybeSingle();
    if (data) {
      setId((data as any).id);
      setBusinessName((data as any).business_name || "");
      setOwnerName((data as any).owner_name || "");
      setPhone((data as any).phone || "");
      setAddress((data as any).address || "");
      setPhotoUrl((data as any).photo_url || null);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    const payload = { business_name: businessName, owner_name: ownerName, phone, address, photo_url: photoUrl };
    const res = id
      ? await supabase.from("business_profile" as any).update(payload).eq("id", id)
      : await supabase.from("business_profile" as any).insert(payload).select().single();
    if (res.error) toast.error(res.error.message);
    else {
      toast.success(t("profileSaved"));
      // Refresh logo cache so sidebar/PDF pick up the new image immediately.
      const { refreshBusinessLogo } = await import("@/components/BusinessLogo");
      refreshBusinessLogo();
      load();
    }
    setBusy(false);
  };

  const onPhoto = async (file: File) => {
    if (!ACCEPT.includes(file.type)) return toast.error("Use JPG, PNG, or WebP");
    if (file.size > MAX_BYTES) return toast.error("Max size is 5MB");
    const ext = file.name.split(".").pop();
    const path = `owner-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });
    if (upErr) return toast.error(upErr.message);
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    toast.success(`${t("uploaded")} — ${t("confirm")}`);
  };

  return (
    <>
      <PageHeader title={t("profile")} subtitle={t("profileSubtitle")} />
      <Card className="p-6 max-w-2xl">
        <div className="flex items-start gap-6 mb-6 flex-col sm:flex-row">
          <div className="relative">
            <div className="h-28 w-28 rounded-full overflow-hidden bg-muted grid place-items-center border-2 border-border">
              {photoUrl ? <img src={photoUrl} alt="Owner" className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-muted-foreground" />}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md hover:bg-primary/90">
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = ""; }} />
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground mb-1">{t("uploadPhoto")}</div>
            {t("uploadPhotoHint")}
          </div>
        </div>

        <div className="space-y-4">
          <div><Label>{t("businessName")}</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="ShivaShakti Shamiyana" /></div>
          <div><Label>{t("ownerName")}</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
          <div><Label>{t("phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0000000000" /></div>
          <div><Label>{t("address")}</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} /></div>
          <Button onClick={save} disabled={busy} className="bg-primary hover:bg-primary/90">{busy ? t("saving") : t("save")}</Button>
        </div>
      </Card>
    </>
  );
};
export default Profile;
