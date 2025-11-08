import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { z } from "zod";

const bookingSchema = z.object({
  client_id: z.string().uuid("Invalid client selection"),
  service_id: z.string().uuid("Invalid service selection"),
  staff_id: z.string().uuid("Invalid staff selection").optional().or(z.literal("")),
  appointment_date: z.string().min(1, "Date is required"),
  appointment_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

const Bookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<{
    client_id: string;
    staff_id: string;
    service_id: string;
    appointment_date: string;
    appointment_time: string;
    status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
    notes: string;
  }>({
    client_id: "",
    staff_id: "",
    service_id: "",
    appointment_date: "",
    appointment_time: "",
    status: "scheduled",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, clientsRes, staffRes, servicesRes] = await Promise.all([
        supabase.from("bookings").select("*, clients(*), staff(*), services(*)").order("appointment_date", { ascending: false }),
        supabase.from("clients").select("*").order("full_name"),
        supabase.from("staff").select("*").eq("is_active", true).order("full_name"),
        supabase.from("services").select("*").eq("is_active", true).order("name")
      ]);

      if (bookingsRes.data) setBookings(bookingsRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (staffRes.data) setStaff(staffRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = bookingSchema.parse(formData);
      
      const insertData = {
        client_id: validated.client_id,
        service_id: validated.service_id,
        ...(validated.staff_id && { staff_id: validated.staff_id }),
        appointment_date: validated.appointment_date,
        appointment_time: validated.appointment_time,
        status: validated.status || "scheduled",
        ...(validated.notes && { notes: validated.notes }),
      };
      
      const { error } = await supabase.from("bookings").insert([insertData]);
      
      if (error) throw error;
      
      toast.success("Booking created successfully");
      setDialogOpen(false);
      setFormData({
        client_id: "",
        staff_id: "",
        service_id: "",
        appointment_date: "",
        appointment_time: "",
        status: "scheduled",
        notes: ""
      });
      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to create booking");
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      scheduled: "bg-info/10 text-info",
      confirmed: "bg-primary/10 text-primary",
      completed: "bg-success/10 text-success",
      cancelled: "bg-destructive/10 text-destructive",
      no_show: "bg-warning/10 text-warning"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage salon appointments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={formData.client_id} onValueChange={(value) => setFormData({...formData, client_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={formData.service_id} onValueChange={(value) => setFormData({...formData, service_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Staff</Label>
                <Select value={formData.staff_id} onValueChange={(value) => setFormData({...formData, staff_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.appointment_date} onChange={(e) => setFormData({...formData, appointment_date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={formData.appointment_time} onChange={(e) => setFormData({...formData, appointment_time: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Additional notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full">Create Booking</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{booking.clients?.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{booking.services?.name}</p>
                </div>
                <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Staff</p>
                  <p className="font-medium">{booking.staff?.full_name || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {format(new Date(booking.appointment_date), "MMM dd, yyyy")} at {booking.appointment_time}
                  </p>
                </div>
              </div>
              {booking.notes && (
                <p className="text-sm text-muted-foreground mt-2">Note: {booking.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {bookings.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No bookings yet. Create your first booking!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Bookings;
