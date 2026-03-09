import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  full_name: string;
  // role may be stored separately in user_roles; keep optional
  role?: string | null;
  specialization?: string | null;
}

interface CatalogContextType {
  categories: string[];
  staff: StaffMember[];
  loading: boolean;
  refreshCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType>({
  categories: [],
  staff: [],
  loading: false,
  refreshCatalog: async () => {},
});

export const useCatalog = () => useContext(CatalogContext);

interface Props {
  children: ReactNode;
}

export const CatalogProvider = ({ children }: Props) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCatalog = async () => {
    setLoading(true);
    try {
      const { data: services, error: svcErr } = await supabase
        .from("services")
        .select("category");
      if (svcErr) throw svcErr;

      const cats = Array.from(
        new Set((services || []).map((s: any) => s?.category).filter(Boolean))
      );

      const { data: staffData, error: staffErr } = await supabase
        .from("staff")
        // select only commonly-available columns to avoid typed client/schema mismatches
        .select("id, full_name, specialization")
        .order("full_name");
      if (staffErr) throw staffErr;

      setCategories(cats);
      setStaff(staffData || []);
    } catch (err: any) {
      console.error("Failed to refresh catalog:", err);
      toast.error("Failed to refresh catalog data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCatalog();

    const handler = () => refreshCatalog();
    window.addEventListener("catalog:refresh", handler as EventListener);
    return () => window.removeEventListener("catalog:refresh", handler as EventListener);
  }, []);

  return (
    <CatalogContext.Provider value={{ categories, staff, loading, refreshCatalog }}>
      {children}
    </CatalogContext.Provider>
  );
};

export default CatalogContext;
