import { supabase } from "@/integrations/supabase/client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
}

interface Settings {
  logo_url: string;
  paystack_enabled: boolean;
  payment_methods: PaymentMethod[];
  business_name: string;
  open_time: string;
  close_time: string;
  currency: string;
  staff_roles: string[];
  service_categories: string[];
  use_24_hour_format: boolean;
  business_phone: string
  business_email: string;
  business_address: string;
}

const defaultSettings: Settings = {
  logo_url: "",
  paystack_enabled: true,
  payment_methods: [
    { id: "cash", name: "Cash", enabled: true },
    { id: "momo", name: "Mobile Money (MoMo)", enabled: true },
    { id: "card", name: "Card", enabled: true },
    { id: "bank_transfer", name: "Bank Transfer", enabled: true },
  ],
  business_name: "",
  open_time: "08:30",
  close_time: "21:00",
  currency: "GH₵",
  staff_roles: ["Hairdresser", "Barber", "Receptionist"],
  service_categories: ["Hair", "Nails", "Massage"],
  use_24_hour_format: true,
  business_phone: "",
  business_email: "",
  business_address: "",
};

interface SettingsContextType {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setSettings: () => {},
  loading: false,
});

export const useSettings = () => useContext(SettingsContext);

interface Props {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: Props) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase  //@ts-ignore
        .from("settings")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          ...defaultSettings,
          ...data,
          payment_methods:  //@ts-ignore
            data.payment_methods ?? defaultSettings.payment_methods,
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};
