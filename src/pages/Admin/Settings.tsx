import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BusinessInfoSection } from "@/components/settings/BusinessInfoSection";
import { OperatingHoursSection } from "@/components/settings/OperatingHoursSection";
import { DraggableListSection } from "@/components/settings/DraggableListSection";
import { PaymentMethodsSection } from "@/components/settings/PaymentMethodsSection";
import { PermissionLevelsSection } from "@/components/settings/PermissionLevelsSection";
import { DataManagementSection } from "@/components/settings/DataManagementSection";
import { BackupRestoreSection } from "@/components/settings/BackupRestoreSection";
import { Loader2 } from "lucide-react";
import { GallerySettingsSection } from "@/components/settings/GalllerySection";
import { ReviewsSettingsSection } from "@/components/settings/ReviewsManagement";

interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
}

interface Settings {
  id?: string;
  business_name: string;
  logo_url: string;
  open_time: string;
  close_time: string;
  currency: string;
  staff_roles: string[];
  service_categories: string[];
  use_24_hour_format: boolean;
  business_phone: string;
  business_email: string;
  business_address: string;
  payment_methods: PaymentMethod[];
  paystack_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// const defaultPaymentMethods: PaymentMethod[] = [
//   { id: "cash", name: "Cash", enabled: true },
//   { id: "momo", name: "Mobile Money (MoMo)", enabled: true },
//   { id: "card", name: "Card", enabled: true },
//   { id: "bank_transfer", name: "Bank Transfer", enabled: true },
// ];

const defaultSettings: Settings = {
  business_name: "",
  logo_url: "",
  open_time: "09:00",
  close_time: "17:00",
  currency: "GH₵",
  staff_roles: ["Hairdresser", "Barber", "Receptionist"],
  service_categories: ["Hair", "Nails", "Massage"],
  use_24_hour_format: false,
  business_phone: "",
  business_email: "",
  business_address: "",
  payment_methods: [],
  paystack_enabled: true,
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("settings")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          ...defaultSettings,
          ...data,
          payment_methods: data.payment_methods,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return settings.logo_url || null;

    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, logoFile, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Logo upload failed:", error);
      toast.error("Failed to upload logo");
      return settings.logo_url || null;
    }
  };

  const updateSettings = async () => {
    setSaving(true);
    try {
      const logoUrl = await uploadLogo();

      const settingsData = {
        business_name: settings.business_name,
        logo_url: logoUrl,
        open_time: settings.open_time,
        close_time: settings.close_time,
        currency: settings.currency,
        staff_roles: settings.staff_roles,
        service_categories: settings.service_categories,
        use_24_hour_format: settings.use_24_hour_format,
        business_phone: settings.business_phone,
        business_email: settings.business_email,
        business_address: settings.business_address,
        payment_methods: settings.payment_methods,
        paystack_enabled: settings.paystack_enabled, //@ts-ignore
        gallery_images: settings.gallery_images,
      };

      if (settings.id) {
        const { error } = await (supabase as any)
          .from("settings")
          .update(settingsData)
          .eq("id", settings.id);

        if (error) throw error;
        toast.success("Settings updated successfully!");
      } else {
        const { error } = await (supabase as any)
          .from("settings")
          .insert([settingsData]);
        if (error) throw error;
        toast.success("Settings saved successfully!");
      }

      setLogoFile(null);
      fetchSettings();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentMethodToggle = (id: string, enabled: boolean) => {
    setSettings({
      ...settings,
      payment_methods: settings.payment_methods.map((m) =>
        m.id === id ? { ...m, enabled } : m
      ),
    });
  };

  const handleRestore = (restoredSettings: any) => {
    setSettings({
      ...defaultSettings,
      ...restoredSettings,
      payment_methods: restoredSettings.payment_methods,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings</h1>
          <Button onClick={updateSettings} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>

        <BusinessInfoSection
          businessName={settings.business_name}
          logoUrl={settings.logo_url}
          logoFile={logoFile}
          phone={settings.business_phone}
          email={settings.business_email}
          address={settings.business_address}
          onBusinessNameChange={(v) =>
            setSettings({ ...settings, business_name: v })
          }
          onLogoUrlChange={(v) => setSettings({ ...settings, logo_url: v })}
          onLogoFileChange={setLogoFile}
          onPhoneChange={(v) => setSettings({ ...settings, business_phone: v })}
          onEmailChange={(v) => setSettings({ ...settings, business_email: v })}
          onAddressChange={(v) =>
            setSettings({ ...settings, business_address: v })
          }
        />

        <OperatingHoursSection
          openTime={settings.open_time}
          closeTime={settings.close_time}
          currency={settings.currency}
          use24HourFormat={settings.use_24_hour_format}
          onOpenTimeChange={(v) => setSettings({ ...settings, open_time: v })}
          onCloseTimeChange={(v) => setSettings({ ...settings, close_time: v })}
          onCurrencyChange={(v) => setSettings({ ...settings, currency: v })}
          onFormatChange={(v) =>
            setSettings({ ...settings, use_24_hour_format: v })
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DraggableListSection
            title="Staff Roles"
            items={settings.staff_roles}
            onItemsChange={(items) =>
              setSettings({ ...settings, staff_roles: items })
            }
            addButtonText="Add Role"
          />

          <DraggableListSection
            title="Service Categories"
            items={settings.service_categories}
            onItemsChange={(items) =>
              setSettings({ ...settings, service_categories: items })
            }
            addButtonText="Add Category"
          />
        </div>

        <PermissionLevelsSection />

        <PaymentMethodsSection
          paymentMethods={settings.payment_methods}
          paystackEnabled={settings.paystack_enabled}
          onPaymentMethodToggle={handlePaymentMethodToggle}
          onPaystackToggle={(v) =>
            setSettings({ ...settings, paystack_enabled: v })
          }
        />

        <DataManagementSection />
        <GallerySettingsSection //@ts-ignore
          settingsId={settings.id!} //@ts-ignore
          images={settings.gallery_images || []} //@ts-ignore
          onSaved={(imgs) => { //@ts-ignore
            setSettings({ ...settings, gallery_images: imgs });
            fetchSettings();
          }}
        />

        <ReviewsSettingsSection settingsId={settings.id} />
        <BackupRestoreSection settings={settings} onRestore={handleRestore} />
      </div>
    </div>
  );
}
