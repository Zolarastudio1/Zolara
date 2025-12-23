import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Mail,
  Phone,
  Trash,
  Pencil,
  Trash2,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
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

// Small stat tile used in profile dialog
const Stat = ({ label, value }: { label: string; value: () => string }) => {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value()}</p>
    </div>
  );
};

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
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
  const [activeFilter, setActiveFilter] = useState<
    "none" | "date" | "most_active" | "service_history" | "search"
  >("none");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [page, setPage] = useState(1); // current page
  const [pageSize, setPageSize] = useState(20); // items per page
  const [totalClients, setTotalClients] = useState(0);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
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

      // Fetch clients with their bookings (and nested service meta) so we can filter locally
      const { data, count, error } = await supabase
        .from("clients")
        .select(`*, bookings(*, services(*))`, { count: "exact" })
        .order("full_name")
        .range(from, to);

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

  const fetchClientActivity = async () => {
    const { data, error } = await supabase.from("bookings").select("client_id");

    if (error) {
      console.error("Activity fetch error:", error);
      return {};
    }

    const counts: Record<string, number> = {};

    data.forEach((b: any) => {
      counts[b.client_id] = (counts[b.client_id] || 0) + 1;
    });

    return counts;
  };

  const handleFilterByDate = () => {
    setActiveFilter("date");
  };

  const handleMostActiveClient = () => {
    setActiveFilter("most_active");
  };

  const handleServiceHistory = (serviceName: string) => {
    setSelectedService(serviceName);
    setActiveFilter("service_history");
    setShowServiceList(false);
  };

  const clearFilters = () => {
    setActiveFilter("none");
    setSelectedService("");
    setFilteredClients(clients);
  };

  // Helper: check if a booking date falls within start/end (full-day) bounds
  const bookingInRange = (rawDate: any, s: Date, e: Date) => {
    if (!rawDate) return false;
    const ad = new Date(rawDate);
    if (!isNaN(ad.getTime())) return ad >= s && ad <= e;
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (!isNaN(parsed.getTime())) return parsed >= s && parsed <= e;
    return false;
  };

  // Centralized filter application so filters compose
  const runFilters = () => {
    let data = [...clients];

    // --- Date Filter ---
    if (startDate || endDate) {
      data = data.filter((item) => {
        const created = new Date(item.created_at);
        if (startDate && created < new Date(startDate)) return false;
        if (endDate && created > new Date(endDate)) return false;
        return true;
      });
    }

    // --- Status Filter ---
    if (activeFilter && activeFilter !== "none") {
      // activeFilter is already typed, no need to filter by status here
    }

    // --- Service Filter ---
    if (selectedService && selectedService !== "all") {
      data = data.filter((item) => item.service === selectedService);
    }

    // --- Search Filter ---
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.full_name?.toLowerCase().includes(term) ||
          item.phone?.toLowerCase().includes(term) ||
          item.email?.toLowerCase().includes(term)
      );
    }

    setFilteredClients(data);
  };

  useEffect(() => {
    runFilters();
  }, [clients, startDate, endDate, activeFilter, selectedService, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      const validated = clientSchema.parse(formData);

      const clientData: any = {
        role: "client",
        full_name: validated.full_name,
        phone: validated.phone,
        email: validated.email,
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
        // Invoke the generic invite Edge Function
        const { data, error } = await supabase.functions.invoke("invite-user", {
          method: "POST",
          body: JSON.stringify(clientData),
        });

        if (error) {
          console.error("Edge function error:", error);
        } else {
          console.log("User created:", data);
          toast.success("Client added successfully");
        }
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
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        {/* Left: Search */}
        <div className="w-full sm:w-1/2">
          <CollapsibleSearchBar
            data={clients}
            placeholder="Search clients..."
            onSearchResults={(results) => {
              setFilteredClients(results);
              setActiveFilter("search");
            }}
          />
        </div>

        {/* Right: Filters */}
        <div className="w-full sm:w-auto flex items-center justify-end">
          {/* Mobile: toggleable filters panel */}
          <Button
            className="sm:hidden"
            variant={showFiltersMobile ? "default" : "outline"}
            onClick={() => setShowFiltersMobile((s) => !s)}
          >
            Filters
          </Button>

          {/* Desktop filters (hidden on small screens) */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 text-sm"
                aria-label="Start date"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 text-sm"
                aria-label="End date"
              />
              <Button
                onClick={handleFilterByDate}
                variant={activeFilter === "date" ? "default" : "outline"}
                className="whitespace-nowrap"
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button onClick={clearFilters} variant={"ghost"} className="ml-2">
                Clear
              </Button>
            </div>

            <Button
              onClick={handleMostActiveClient}
              variant={activeFilter === "most_active" ? "default" : "ghost"}
            >
              <TrendingUp className="w-4 h-4 mr-2" /> Most Active
            </Button>

            {/* Service History Dropdown (desktop) */}
            <div className="relative w-auto">
              <Button
                onClick={() => setShowServiceList(!showServiceList)}
                variant={
                  activeFilter === "service_history" ? "default" : "outline"
                }
                className="w-auto"
              >
                {selectedService || "Service History"}
              </Button>

              {showServiceList && (
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl z-50">
                  <div className="p-2 max-h-64 overflow-auto">
                    {services.map((service: any) => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceHistory(service.name)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm rounded-md transition"
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile filters panel (shown when toggled) */}
          {showFiltersMobile && (
            <div className="sm:hidden mt-3 w-full p-3 space-y-3 border rounded-lg bg-white/70 dark:bg-gray-900/60">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 text-sm"
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 text-sm"
                    aria-label="End date"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleFilterByDate}
                    variant={activeFilter === "date" ? "default" : "outline"}
                    className="flex-1"
                  >
                    <CalendarClock className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                  <Button
                    onClick={clearFilters}
                    variant={"ghost"}
                    className="flex-1"
                  >
                    Clear
                  </Button>
                </div>

                <Button
                  onClick={handleMostActiveClient}
                  variant={
                    activeFilter === "most_active" ? "default" : "outline"
                  }
                  className="w-full"
                >
                  <TrendingUp className="w-4 h-4 mr-2" /> Most Active
                </Button>

                <div>
                  <label className="block text-sm mb-1">Service History</label>
                  <div className="flex flex-col gap-2">
                    {services.map((service: any) => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceHistory(service.name)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm rounded-md transition"
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {/* Client Grid */}
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const s = new Date(`${startDate}T00:00:00`);
            const e = new Date(`${endDate}T23:59:59`);
            const bookingsInRange = (client.bookings || []).filter((b: any) => {
              return bookingInRange(b?.appointment_date, s, e);
            });
            const bookingsCount =
              bookingsInRange.length || (client.bookings || []).length;
            const lastBooking = (client.bookings || []).reduce(
              (latest: any, b: any) => {
                if (!b?.appointment_date) return latest;
                if (!latest) return b.appointment_date;
                return new Date(b.appointment_date) > new Date(latest)
                  ? b.appointment_date
                  : latest;
              },
              null as any
            );

            return (
              <Card
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setProfileOpen(true);
                }}
                className="cursor-pointer hover:shadow-2xl transition-all transform hover:-translate-y-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white/80 to-white/60 dark:from-gray-900/70 dark:to-gray-800/50 backdrop-blur-lg"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-100 dark:ring-gray-700 shadow">
                        {client.image ? (
                          <img
                            src={client.image}
                            alt={client.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-teal-500 text-white flex items-center justify-center font-semibold text-lg shadow-md">
                            {client.full_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                          </div>
                        )}
                      </div>

                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          {client.full_name}
                          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700">
                            {bookingsCount} visits
                          </span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {lastBooking
                            ? `Last: ${format(
                                new Date(lastBooking),
                                "MMM dd, yyyy"
                              )}`
                            : "No appointments yet"}
                        </p>
                      </div>
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
                      variant="ghost"
                      className="rounded-xl flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
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
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {userRole === "owner" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-xl flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteClientId(client.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Profile Dialog */}
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedClient ? selectedClient.full_name : "Client Profile"}
                </DialogTitle>
              </DialogHeader>

              {selectedClient && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-2xl font-semibold text-white bg-gradient-to-br from-green-500 to-teal-500">
                        {selectedClient.image ? (
                          <img
                            src={selectedClient.image}
                            alt={selectedClient.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (selectedClient.full_name || "")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                        )}
                      </div>

                      <div>
                        <h3 className="text-xl font-semibold">
                          {selectedClient.full_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedClient.phone}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-gray-600">
                        Notes
                      </h4>
                      <p className="mt-2 text-sm text-gray-800">
                        {selectedClient.notes || "No notes"}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-gray-600">
                        Contact & Address
                      </h4>
                      <p className="mt-1 text-sm">
                        {selectedClient.address || "No address"}
                      </p>
                    </div>
                  </div>

                  {/* Middle: service history */}
                  <div className="md:col-span-2">
                    <h4 className="text-lg font-semibold mb-3">
                      Service History
                    </h4>

                    <div className="space-y-3 max-h-72 overflow-auto">
                      {(selectedClient.bookings || [])
                        .slice()
                        .sort(
                          (a: any, b: any) =>
                            new Date(b.appointment_date).getTime() -
                            new Date(a.appointment_date).getTime()
                        )
                        .map((b: any) => (
                          <div
                            key={b.id}
                            className="flex justify-between items-center p-3 rounded-lg border bg-white/50 dark:bg-gray-900/40"
                          >
                            <div>
                              <div className="text-sm font-medium">
                                {b.services?.name || "Service"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {b.staff?.full_name ||
                                  b.staff?.name ||
                                  "Unassigned"}{" "}
                                •{" "}
                                {b.appointment_date
                                  ? format(new Date(b.appointment_date), "PPP")
                                  : "Date N/A"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">
                                GH₵{Number(b.services?.price || 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {b.status || "-"}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Summary stats */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <Stat
                        label="Total Spent"
                        value={() => {
                          const total = (selectedClient.bookings || []).reduce(
                            (sum: number, bk: any) => {
                              // count only completed bookings as spent
                              if (bk.status && bk.status !== "completed")
                                return sum;
                              return sum + Number(bk.services?.price || 0);
                            },
                            0
                          );
                          return `GH₵${total.toFixed(2)}`;
                        }}
                      />

                      <Stat
                        label="Preferred Staff"
                        value={() => {
                          const counts: Record<
                            string,
                            { name: string; count: number }
                          > = {};
                          (selectedClient.bookings || []).forEach((bk: any) => {
                            const name =
                              bk.staff?.full_name ||
                              bk.staff?.name ||
                              "Unassigned";
                            if (!name) return;
                            counts[name] = counts[name] || { name, count: 0 };
                            counts[name].count += 1;
                          });
                          const top = Object.values(counts).sort(
                            (a, b) => b.count - a.count
                          )[0];
                          return top ? `${top.name} (${top.count})` : "N/A";
                        }}
                      />

                      <Stat
                        label="Visits"
                        value={() =>
                          `${(selectedClient.bookings || []).length}`
                        }
                      />

                      <Stat
                        label="Avg Frequency"
                        value={() => {
                          const dates = (selectedClient.bookings || [])
                            .map((bk: any) => bk.appointment_date)
                            .filter(Boolean)
                            .map((d: string) => new Date(d))
                            .sort(
                              (a: Date, b: Date) => a.getTime() - b.getTime()
                            );
                          if (dates.length < 2) return "N/A";
                          const diffs: number[] = [];
                          for (let i = 1; i < dates.length; i++) {
                            const days =
                              (dates[i].getTime() - dates[i - 1].getTime()) /
                              (1000 * 60 * 60 * 24);
                            diffs.push(days);
                          }
                          const avg =
                            diffs.reduce((s, v) => s + v, 0) / diffs.length;
                          return `${Math.round(avg)} days`;
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* No-match placeholder when filters applied but nothing matches */}
          {filteredClients.length === 0 && clients.length > 0 && (
            <Card className="col-span-full border-gray-200 dark:border-gray-700 rounded-2xl shadow-md bg-gradient-to-b from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-900/60 backdrop-blur-md">
              <CardContent className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No clients match the current filters. Try clearing filters or
                  expanding the date range.
                </p>
              </CardContent>
            </Card>
          )}

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
