import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Settings {
  id?: string;
  business_name: string;
  logo_url: string;
  open_time: string;
  close_time: string;
  currency: string;
  staff_roles: string[];
  service_categories: string[];
  created_at?: string;
  updated_at?: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    business_name: "",
    logo_url: "",
    open_time: "09:00",
    close_time: "17:00",
    currency: "GH₵",
    staff_roles: ["Hairdresser", "Barber", "Receptionist"],
    service_categories: ["Hair", "Nails", "Massage"],
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error; // no row yet

      if (data) {
        setSettings(data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async () => {
    setLoading(true);
    try {
      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from("settings")
          .update({
            business_name: settings.business_name,
            logo_url: settings.logo_url,
            open_time: settings.open_time,
            close_time: settings.close_time,
            currency: settings.currency,
            staff_roles: settings.staff_roles,
            service_categories: settings.service_categories,
          })
          .eq("id", settings.id);

        if (error) throw error;
        toast.success("Settings updated successfully!");
      } else {
        // Insert new
        const { error } = await supabase.from("settings").insert([settings]);
        if (error) throw error;
        toast.success("Settings saved successfully!");
      }
      fetchSettings(); // refresh
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const addRole = () => {
    setSettings({
      ...settings,
      staff_roles: [...settings.staff_roles, ""],
    });
  };

  const addCategory = () => {
    setSettings({
      ...settings,
      service_categories: [...settings.service_categories, ""],
    });
  };

  const updateRole = (index: number, value: string) => {
    const roles = [...settings.staff_roles];
    roles[index] = value;
    setSettings({ ...settings, staff_roles: roles });
  };

  const updateCategory = (index: number, value: string) => {
    const categories = [...settings.service_categories];
    categories[index] = value;
    setSettings({ ...settings, service_categories: categories });
  };

  const removeRole = (index: number) => {
    const roles = [...settings.staff_roles];
    roles.splice(index, 1);
    setSettings({ ...settings, staff_roles: roles });
  };

  const removeCategory = (index: number) => {
    const categories = [...settings.service_categories];
    categories.splice(index, 1);
    setSettings({ ...settings, service_categories: categories });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="business_name">Business Name</Label>
            <Input
              id="business_name"
              value={settings.business_name}
              onChange={(e) =>
                setSettings({ ...settings, business_name: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              value={settings.logo_url}
              onChange={(e) =>
                setSettings({ ...settings, logo_url: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="open_time">Open Time</Label>
              <Input
                id="open_time"
                type="time"
                value={settings.open_time}
                onChange={(e) =>
                  setSettings({ ...settings, open_time: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="close_time">Close Time</Label>
              <Input
                id="close_time"
                type="time"
                value={settings.close_time}
                onChange={(e) =>
                  setSettings({ ...settings, close_time: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="currency">Default Currency</Label>
            <Input
              id="currency"
              value={settings.currency}
              onChange={(e) =>
                setSettings({ ...settings, currency: e.target.value })
              }
            />
          </div>

          <div>
            <Label>Staff Roles</Label>
            {settings.staff_roles.map((role, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={role}
                  onChange={(e) => updateRole(i, e.target.value)}
                />
                <Button
                  variant="destructive"
                  onClick={() => removeRole(i)}
                  size="sm"
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button onClick={addRole}>Add Role</Button>
          </div>

          <div>
            <Label>Service Categories</Label>
            {settings.service_categories.map((cat, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={cat}
                  onChange={(e) => updateCategory(i, e.target.value)}
                />
                <Button
                  variant="destructive"
                  onClick={() => removeCategory(i)}
                  size="sm"
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button onClick={addCategory}>Add Category</Button>
          </div>

          <Button onClick={updateSettings} disabled={loading}>
            Save Settings
          </Button>
        </Card>
      </div>
    </div>
  );
}
