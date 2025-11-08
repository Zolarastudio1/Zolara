import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { format } from "date-fns";

const ClientBookings = () => {
  const [services, setServices] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    service_id: "",
    preferred_date: "",
    preferred_time: "",
    notes: "",
  });

  // TODO: replace with the logged-in client's ID dynamically
  const clientId = "YOUR_LOGGED_IN_CLIENT_ID";

  useEffect(() => {
    fetchServices();
    fetchRequests();
  }, []);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) toast.error("Failed to load services");
    else setServices(data || []);
  };
const fetchRequests = async () => {
  const { data, error } = await supabase
    .from("booking_requests")
    .select("*, services(name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) toast.error("Failed to load booking requests");
  else setRequests(data as any[] || []);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.service_id || !formData.preferred_date || !formData.preferred_time) {
      return toast.error("Please fill all required fields");
    }

    const { error } = await supabase.from("booking_requests").insert([
      {
        client_id: clientId,
        service_id: formData.service_id,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
        notes: formData.notes,
      },
    ]);

    if (error) toast.error(error.message);
    else {
      toast.success("Booking request submitted!");
      setDialogOpen(false);
      setFormData({
        service_id: "",
        preferred_date: "",
        preferred_time: "",
        notes: "",
      });
      fetchRequests();
    }
  };

  const getStatusColor = (status: string) => {
    const map: any = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      declined: "bg-red-100 text-red-800",
      converted: "bg-blue-100 text-blue-800",
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Booking Requests</h1>
          <p className="text-muted-foreground">View and request salon bookings</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request a Booking</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Service</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(v) => setFormData({ ...formData, service_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.preferred_date}
                    onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.preferred_time}
                    onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="Special requests or details"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full">
                Submit Request
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Booking Requests */}
      <div className="grid gap-4">
        {requests.map((r) => (
          <Card key={r.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex justify-between items-start">
              <div>
                <CardTitle>{r.services?.name || "Service"}</CardTitle>
                {r.preferred_date && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(r.preferred_date), "MMM dd, yyyy")} at {r.preferred_time}
                  </p>
                )}
              </div>
              <Badge className={getStatusColor(r.status)}>{r.status}</Badge>
            </CardHeader>
            <CardContent>
              {r.notes && <p className="text-sm text-muted-foreground">Note: {r.notes}</p>}
              {r.admin_notes && (
                <p className="text-sm mt-2 text-blue-600">
                  Admin note: {r.admin_notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {requests.length === 0 && (
          <Card>
            <CardContent className="text-center py-10 text-muted-foreground">
              You haven’t made any booking requests yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClientBookings;
