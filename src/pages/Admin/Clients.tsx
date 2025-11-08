import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Mail, Phone } from "lucide-react";
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
import { toast } from "sonner";
import { z } from "zod";

const clientSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name too long"),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email too long")
    .optional()
    .or(z.literal("")),
  address: z.string().max(500, "Address too long").optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      const validated = clientSchema.parse(formData);

      const clientData = {
        full_name: validated.full_name,
        phone: validated.phone,
        ...(validated.email && { email: validated.email }),
        ...(validated.address && { address: validated.address }),
        ...(validated.notes && { notes: validated.notes }),
      };

      if (editingClientId) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClientId);

        if (error) throw error;
      } else {
        // Insert new client
        const { error } = await supabase.from("clients").insert([clientData]);
        if (error) throw error;
      }

      toast.success(
        editingClientId
          ? "Client updated successfully"
          : "Client added successfully"
      );

      // Reset form and dialog
      setDialogOpen(false);
      setEditingClientId(null);
      setFormData({
        full_name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });

      // Refresh client list
      fetchClients();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to save client");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your salon clients</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {!editingClientId ? "Add New Client" : "Update Client Details"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  type="tel"
                  placeholder="+233..."
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  placeholder="Client address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes about client"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                {!editingClientId ? "Add Client" : "Update Client"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card
            key={client.id}
            className="relative overflow-hidden border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-b from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-900/60 backdrop-blur-md"
          >
            <CardHeader className="flex flex-row justify-between items-center">
              <div className="flex items-center gap-4">
                {/* Avatar with initials */}
                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                  {client.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {client.full_name}
                </CardTitle>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900 hover:text-green-600 dark:hover:text-green-400"
                onClick={() => {
                  setFormData({
                    full_name: client.full_name,
                    phone: client.phone,
                    email: client.email || "",
                    address: client.address || "",
                    notes: client.notes || "",
                  });
                  setDialogOpen(true);
                  setEditingClientId(client.id);
                }}
              >
                Edit
              </Button>
            </CardHeader>

            <CardContent className="space-y-3 mt-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Phone className="w-4 h-4 text-green-500" />
                <span>{client.phone}</span>
              </div>

              {client.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Mail className="w-4 h-4 text-green-500" />
                  <span>{client.email}</span>
                </div>
              )}

              {client.notes && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-3">
                  {client.notes}
                </p>
              )}

              {client.address && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                  {client.address}
                </p>
              )}
            </CardContent>

            {/* Optional: role badge */}
            {client.role && (
              <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                {client.role}
              </span>
            )}
          </Card>
        ))}

        {clients.length === 0 && (
          <Card className="col-span-full border-gray-200 dark:border-gray-700 rounded-2xl shadow-md bg-gradient-to-b from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-900/60 backdrop-blur-md">
            <CardContent className="text-center py-16">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No clients yet. Add your first client!
              </p>
              <Plus className="mx-auto mt-4 w-8 h-8 text-green-500 animate-bounce" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Clients;
