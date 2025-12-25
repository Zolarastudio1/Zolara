import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Loader2, 
  Calendar, 
  Clock, 
  User, 
  Sparkles,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  CheckCircle2,
  ArrowLeft,
  Receipt,
  UserCheck
} from "lucide-react";
import { format } from "date-fns";

type PaymentMethod = "cash" | "momo" | "card" | "bank_transfer";

interface BookingData {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string | null;
  clients: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string;
  };
  services: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
    category: string;
  };
  staff: {
    id: string;
    full_name: string;
    specialization: string | null;
  } | null;
}

interface StaffMember {
  id: string;
  full_name: string;
  specialization: string | null;
}

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
      fetchStaff();
    } else {
      setLoading(false);
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          clients(*),
          services(*),
          staff(*)
        `)
        .eq("id", bookingId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setBooking(data as BookingData);
        if (data.staff?.id) {
          setSelectedStaff(data.staff.id);
        }
      }
    } catch (error) {
      console.error("Error fetching booking:", error);
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, specialization")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const handleCheckout = async () => {
    if (!booking) return;

    if (!selectedStaff) {
      toast.error("Please assign a staff member to this service");
      return;
    }

    setProcessing(true);

    try {
      // 1. Update booking status to completed and assign staff
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "completed",
          staff_id: selectedStaff,
          notes: notes || booking.notes,
        })
        .eq("id", booking.id);

      if (bookingError) throw bookingError;

      // 2. Record the payment
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          booking_id: booking.id,
          amount: booking.services.price,
          payment_method: paymentMethod,
          payment_status: "completed",
          notes: `Checkout completed for ${booking.services.name}`,
        });

      if (paymentError) throw paymentError;

      setCompleted(true);
      toast.success("Checkout completed successfully!");
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Failed to complete checkout");
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return <Banknote className="w-5 h-5" />;
      case "card":
        return <CreditCard className="w-5 h-5" />;
      case "momo":
        return <Smartphone className="w-5 h-5" />;
      case "bank_transfer":
        return <Building className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!bookingId || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Receipt className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">No Booking Selected</h2>
            <p className="text-muted-foreground">
              Please select a booking from the bookings page to proceed with checkout.
            </p>
            <Button onClick={() => navigate(-1)} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="max-w-lg w-full overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white">
            <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold">Checkout Complete!</h2>
            <p className="text-white/80 mt-2">Service has been marked as completed</p>
          </div>
          
          <CardContent className="p-6 space-y-6">
            {/* Receipt Summary */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{booking.services.name}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{booking.clients.full_name}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Staff</span>
                <span className="font-medium">
                  {staff.find(s => s.id === selectedStaff)?.full_name || "Assigned"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="font-medium capitalize flex items-center gap-2">
                  {getPaymentIcon(paymentMethod)}
                  {paymentMethod === "momo" ? "Mobile Money" : 
                   paymentMethod === "bank_transfer" ? "Bank Transfer" : 
                   paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
                </span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold">Total Paid</span>
                <span className="font-bold text-primary">
                  GH₵ {booking.services.price.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Bookings
              </Button>
              <Button 
                className="flex-1 bg-primary"
                onClick={() => {
                  setCompleted(false);
                  navigate("/app/admin/bookings");
                }}
              >
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Checkout</h1>
            <p className="text-muted-foreground">Complete the service and record payment</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Booking Details Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Booking Details
              </CardTitle>
            </div>
            <CardContent className="p-6 space-y-6">
              {/* Service */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Service</Label>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-semibold text-lg">{booking.services.name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{booking.services.category}</Badge>
                    <span>{booking.services.duration_minutes} mins</span>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client</Label>
                <div className="p-4 bg-muted/50 rounded-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{booking.clients.full_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.clients.phone}</p>
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
                  <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {format(new Date(booking.appointment_date), "PPP")}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time</Label>
                  <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{booking.appointment_time}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
                <Badge 
                  variant="outline" 
                  className={`
                    ${booking.status === "scheduled" && "border-blue-500 text-blue-600 bg-blue-50"}
                    ${booking.status === "confirmed" && "border-green-500 text-green-600 bg-green-50"}
                    ${booking.status === "completed" && "border-gray-500 text-gray-600 bg-gray-50"}
                  `}
                >
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Checkout Form Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                Complete Checkout
              </CardTitle>
              <CardDescription className="mt-1">
                Confirm payment and mark service as completed
              </CardDescription>
            </div>
            <CardContent className="p-6 space-y-6">
              {/* Assign Staff */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  Assign Staff Member *
                </Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex flex-col">
                          <span>{member.full_name}</span>
                          {member.specialization && (
                            <span className="text-xs text-muted-foreground">
                              {member.specialization}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "cash", label: "Cash", icon: Banknote },
                    { value: "card", label: "Card", icon: CreditCard },
                    { value: "momo", label: "Mobile Money", icon: Smartphone },
                    { value: "bank_transfer", label: "Bank Transfer", icon: Building },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                      className={`
                        p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2
                        ${paymentMethod === method.value 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-muted hover:border-muted-foreground/50"
                        }
                      `}
                    >
                      <method.icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this checkout..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Price Summary */}
              <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Price</span>
                  <span>GH₵ {booking.services.price.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg">
                  <span className="font-semibold">Total Amount</span>
                  <span className="font-bold text-primary">
                    GH₵ {booking.services.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={handleCheckout}
                disabled={processing || !selectedStaff}
                className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Complete Checkout - GH₵ {booking.services.price.toFixed(2)}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
