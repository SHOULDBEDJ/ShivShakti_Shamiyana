import { useEffect, useRef, useState } from "react";
import { api, API_BASE_URL } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { User, Camera, Upload } from "lucide-react";
import { toast } from "sonner";


const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const Profile = () => {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>({
    business_name: "", name_kn: "", owner_name: "", blessing_kn: "",
    phone1: "", phone2: "", phone3: "",
    address1_kn: "", upi_id: "", upi_name: "", photo_url: ""
  });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await api.getBusinessProfile();
      if (data) {
        setProfile(data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };
  useEffect(() => { load(); }, []);


  const save = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      Object.keys(profile).forEach(key => {
        if (profile[key] !== null && profile[key] !== undefined) {
          formData.append(key, profile[key]);
        }
      });
      
      await api.updateBusinessProfile(formData);
      toast.success(t("profileSaved"));
      
      // Refresh logo cache
      const { refreshBusinessLogo } = await import("@/components/BusinessLogo");
      refreshBusinessLogo();
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const onPhoto = async (file: File) => {
    if (!ACCEPT.includes(file.type)) return toast.error("Use JPG, PNG, or WebP");
    if (file.size > MAX_BYTES) return toast.error("Max size is 5MB");
    
    try {
      const res = await api.uploadFile(file);
      if (res.url) {
        setProfile({ ...profile, photo_url: res.url });
        toast.success(`${t("uploaded")} — ${t("confirm")}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader title={t("profile")} subtitle={t("profileSubtitle")} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
        
        {/* Left Column: Logos & QR */}
        <Card className="p-6 space-y-8 flex flex-col items-center shadow-elegant border-none bg-card/50 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Business Logo</Label>
            <div className="relative group">
              <div className="h-32 w-32 rounded-full overflow-hidden bg-muted grid place-items-center border-4 border-background shadow-xl">
                {profile.photo_url ? <img src={profile.photo_url} alt="Logo" className="h-full w-full object-cover" /> : <User className="h-12 w-12 text-muted-foreground" />}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg hover:scale-110 transition-transform">
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = ""; }} />
            </div>
          </div>

        </Card>

        {/* Right Column: Details */}
        <Card className="lg:col-span-2 p-6 shadow-elegant border-none bg-card/50 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Business Name (English)</Label>
                <Input value={profile.business_name || ""} onChange={(e) => setProfile({...profile, business_name: e.target.value})} placeholder="Shiva Shakti Shamiyana" />
              </div>
              <div className="space-y-1">
                <Label>Business Name (Kannada) *</Label>
                <Input value={profile.name_kn || ""} onChange={(e) => setProfile({...profile, name_kn: e.target.value})} placeholder="ಶಿವಶಕ್ತಿ ಶಾಮಿಯಾನ" />
              </div>
              <div className="space-y-1">
                <Label>Blessing Text (Kannada)</Label>
                <Input value={profile.blessing_kn || ""} onChange={(e) => setProfile({...profile, blessing_kn: e.target.value})} placeholder="|| ಶ್ರೀ ಜಗದಂಬಾ ಪ್ರಸನ್ನ ||" />
              </div>
              <div className="space-y-1">
                <Label>Owner Name</Label>
                <Input value={profile.owner_name || ""} onChange={(e) => setProfile({...profile, owner_name: e.target.value})} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3"><Label>Phone Numbers</Label></div>
                <Input value={profile.phone1 || ""} onChange={(e) => setProfile({...profile, phone1: e.target.value})} placeholder="Phone 1" />
                <Input value={profile.phone2 || ""} onChange={(e) => setProfile({...profile, phone2: e.target.value})} placeholder="Phone 2" />
                <Input value={profile.phone3 || ""} onChange={(e) => setProfile({...profile, phone3: e.target.value})} placeholder="Phone 3" />
              </div>
              
              <div className="space-y-1">
                <Label>Address (Kannada) *</Label>
                <Textarea value={profile.address1_kn || ""} onChange={(e) => setProfile({...profile, address1_kn: e.target.value})} rows={3} placeholder="Enter full address here..." />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <Label>UPI ID</Label>
                  <Input value={profile.upi_id || ""} onChange={(e) => setProfile({...profile, upi_id: e.target.value})} placeholder="name@upi" />
                </div>
                <div className="space-y-1">
                  <Label>UPI Name</Label>
                  <Input value={profile.upi_name || ""} onChange={(e) => setProfile({...profile, upi_name: e.target.value})} placeholder="Business Name" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <Button onClick={save} disabled={busy} className="w-full md:w-auto px-12 font-bold bg-primary hover:bg-primary/90 h-12">
              {busy ? t("saving") : t("save")}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Profile;
