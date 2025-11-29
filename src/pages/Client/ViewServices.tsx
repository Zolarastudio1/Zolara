import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock, Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  category: z
    .string()
    .trim()
    .min(1, "Category is required")
    .max(50, "Category too long"),
  price: z
    .number()
    .positive("Price must be positive")
    .max(1000000, "Price too high"),
  duration_minutes: z
    .number()
    .int()
    .positive("Duration must be positive")
    .max(1440, "Duration cannot exceed 24 hours"),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .or(z.literal("")),
});

const ViewServices = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    duration_minutes: "",
    description: "",
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true) // only fetch active services
        .order("order", { ascending: true }) // order by the 'order' field
        // .order("name", { ascending: true }); // secondary ordering by name

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const groupedServices = services.reduce((acc: any, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">View Zolara services</p>
        </div>
      </div>

      {Object.entries(groupedServices).map(
        ([category, categoryServices]: [string, any]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-semibold">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryServices.map((service: any) => (
                <Card
                  key={service.id}
                  className="hover:shadow-lg transition-shadow rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <CardHeader className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold">
                        {service.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={service.is_active ? "default" : "secondary"}
                        >
                          {service.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      GH₵{service.price.toLocaleString()}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration_minutes} minutes</span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default ViewServices;
