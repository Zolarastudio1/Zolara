import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Mail, Phone, Trash, Pencil, Trash2 } from "lucide-react";
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
import PhoneInput from "@/lib/phoneInput";
import { AvatarUpload } from "@/components/AvatarUpload";
import { CollapsibleSearchBar } from "@/components/SearchBar";

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
  image: z.union([z.instanceof(File), z.null()]).optional(),
});

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState(clients);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [showServiceList, setShowServiceList] = useState(false);
  const [page, setPage] = useState(1); // current page
  const [pageSize, setPageSize] = useState(20); // items per page
  const [totalClients, setTotalClients] = useState(0);
  const totalPages = Math.ceil(totalClients / pageSize);

  const [formData, setFormData] = useState<any>({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    image: null, // NEW
  });

  useEffect(() => {
    fetchClients();
    fetchUserRole();
    fetchServices();
  }, []);

  /** Fetch Logged-in User Role */
  const fetchUserRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const metaDataRole = user.user_metadata.role;

      setUserRole(roleData?.role || metaDataRole);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to fetch user role");
    }
  };

  const fetchClients = async (pageNumber = page) => {
    try {
      setLoading(true);

      const from = (pageNumber - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact" }) // get total count for pagination
        .order("full_name")
        .range(from, to); // range for pagination

      if (error) throw error;

      setClients(data || []);
      setTotalClients(count || 0); // total clients in DB
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("category")
        .order("order", { ascending: true });
      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to fetch services");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterByDate = (startDate: string, endDate: string) => {
    const filtered = clients.filter((c) => {
      const clientDate = new Date(c.created_at);
      return (
        clientDate >= new Date(startDate) && clientDate <= new Date(endDate)
      );
    });
    setFilteredClients(filtered);
  };

  const handleMostActiveClient = () => {
    const sorted = [...clients].sort(
      (a, b) => (b.bookings?.length || 0) - (a.bookings?.length || 0)
    );
    setFilteredClients(sorted);
  };

  const handleServiceHistory = (serviceName: string) => {
    const filtered = clients.filter((c) =>
      c.bookings?.some((b) => b.service?.name === serviceName)
    );
    setFilteredClients(filtered);
    setSelectedService(serviceName);
    setShowServiceList(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      const validated = clientSchema.parse(formData);

      const clientData: any = {
        full_name: validated.full_name,
        phone: validated.phone,
        ...(validated.email && { email: validated.email }),
        ...(validated.address && { address: validated.address }),
        ...(validated.notes && { notes: validated.notes }),
      };

      // Handle image upload if exists
      if (validated.image) {
        setUploading(true);

        const fileExtension = validated.image.name.split(".").pop();
        const uniqueId = editingClientId || Date.now();
        const fileName = `client-${uniqueId}.${fileExtension}`;

        // Upload to Supabase Storage bucket "avatars"
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, validated.image, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError; // <- safe now

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        clientData.image = urlData.publicUrl;
        setUploading(false);
      }

      if (editingClientId) {
        // Update existing client
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClientId);

        if (error) throw error;
        toast.success("Client updated successfully");
      } else {
        // Insert new client
        const { error } = await supabase.from("clients").insert([clientData]);
        if (error) throw error;
        toast.success("Client added successfully");
      }

      // Reset form
      setDialogOpen(false);
      setEditingClientId(null);
      setFormData({
        full_name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
        image: null,
      });

      // Refresh client list
      fetchClients();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to save client");
      }
      setUploading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deleteClientId) return;

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", deleteClientId);

      if (error) throw error;

      toast.success("Client deleted successfully");
      fetchClients();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete client");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteClientId(null);
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
          <p className="text-muted-foreground">Manage your clients</p>
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
            <AvatarUpload
              image={formData.image}
              onChange={(file) => setFormData({ ...formData, image: file })}
            />

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
              <PhoneInput
                value={formData.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })}
              />
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
                {uploading
                  ? "Loading..."
                  : !editingClientId
                  ? "Add Client"
                  : "Update Client"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete client</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this client? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteClient}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex justify-end items-center mb-4 gap-2 flex-wrap">
        {/* Search Bar */}
        <CollapsibleSearchBar
          data={clients}
          placeholder="Search clients..."
          onSearchResults={(results) => setFilteredClients(results)}
        />

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => handleFilterByDate("2025-11-01", "2025-11-30")}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Filter by Date
          </button>

          <button
            onClick={handleMostActiveClient}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Most Active
          </button>

          {/* Service History Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowServiceList(!showServiceList)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              {selectedService || "Service History"}
            </button>

            {showServiceList && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-md z-50">
                {services.map((service) => (
                  <button
                    key={service}
                    onClick={() => handleServiceHistory(service)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm rounded-t-md last:rounded-b-md transition"
                  >
                    {service}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {/* Client Grid */}
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="hover:shadow-xl transition-all transform hover:scale-[1.02] rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white/70 to-white/40 dark:from-gray-900/60 dark:to-gray-800/40 backdrop-blur-xl"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {client.image ? (
                        <img
                          src={client.image}
                          alt={client.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                          {client.full_name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {client.full_name}
                    </CardTitle>
                  </div>

                  {client.specialization && (
                    <p className="text-sm text-gray-500 mt-1">
                      {client.specialization}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Phone */}
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 hover:underline transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>{client.phone}</span>
                </a>

                {/* Email */}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{client.email}</span>
                  </a>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl flex items-center gap-1"
                    onClick={() => {
                      setFormData({
                        full_name: client.full_name,
                        phone: client.phone,
                        email: client.email || "",
                        address: client.address || "",
                        notes: client.notes || "",
                        image: client.image || null,
                      });
                      setDialogOpen(true);
                      setEditingClientId(client.id);
                    }}
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </Button>
                  {userRole === "owner" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-red-500 border-red-300 flex items-center gap-1"
                      onClick={() => {
                        setDeleteClientId(client.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* No clients placeholder */}
          {clients.length === 0 && (
            <Card className="col-span-full border-gray-200 dark:border-gray-700 rounded-2xl shadow-md bg-gradient-to-b from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-900/60 backdrop-blur-md">
              <CardContent className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No clients yet. Add your first client!
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            disabled={page === 1}
            onClick={() => {
              fetchClients(page - 1);
              setPage(page - 1);
            }}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Prev
          </button>
          <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => {
              fetchClients(page + 1);
              setPage(page + 1);
            }}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Clients;
