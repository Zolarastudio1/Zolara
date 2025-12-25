import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Sparkles, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  Loader2,
  Check,
  Phone,
  Mail,
  User
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { z } from "zod";

const bookingSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  serviceId: z.string().min(1, "Please select a service"),
  preferredDate: z.string().min(1, "Please select a date"),
  preferredTime: z.string().min(1, "Please select a time"),
  notes: z.string().optional(),
});

const PublicBooking = () => {
  const { settings } = useSettings();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase.from("services").select("*").order("name")

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate form
      const validated = bookingSchema.parse({
        fullName,
        email,
        phone,
        serviceId,
        preferredDate,
        preferredTime,
        notes,
      });

      // Check if client exists
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("email", validated.email)
        .maybeSingle();

      let clientId = existingClient?.id;

      // Create client if doesn't exist
      if (!clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            full_name: validated.fullName,
            email: validated.email,
            phone: validated.phone,
          })
          .select("id")
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      } else {
        // Update existing client info
        await supabase
          .from("clients")
          .update({
            full_name: validated.fullName,
            phone: validated.phone,
          })
          .eq("id", clientId);
      }

      // Create booking request
      const { error: bookingError } = await supabase
        .from("booking_requests")
        .insert({
          client_id: clientId,
          service_id: validated.serviceId,
          appointment_date: validated.preferredDate,
          appointment_time: validated.preferredTime,
          notes: validated.notes || null,
          status: "pending",
        });

      if (bookingError) throw bookingError;

      setSubmitted(true);
      toast.success("Booking request submitted successfully!");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Error submitting booking:", error);
        toast.error(error.message || "Failed to submit booking request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedService = services.find((s) => s.id === serviceId);

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
        
        <Card className="w-full max-w-md relative z-10 bg-white/10 backdrop-blur-xl border-white/20 rounded-2xl text-center">
          <CardContent className="p-8 space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Booking Request Submitted!</h2>
            <p className="text-white/70">
              Thank you for your booking request. Our team will review it and contact you shortly to confirm your appointment.
            </p>
            <div className="flex flex-col gap-3 pt-4">
              <Link to="/">
                <Button className="w-full bg-champagne hover:bg-champagne-dark text-white">
                  Return to Home
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="w-full border-white/30 text-white hover:bg-white/10"
                onClick={() => {
                  setSubmitted(false);
                  setFullName("");
                  setEmail("");
                  setPhone("");
                  setServiceId("");
                  setPreferredDate("");
                  setPreferredTime("");
                  setNotes("");
                }}
              >
                Book Another Appointment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative py-20"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-champagne/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-champagne">
              <img 
                src={settings?.logo_url || "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg"} 
                alt="Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-bold text-white">
              {/* @ts-ignore */}
              {settings?.business_name || "Zolara Beauty Studio"}
            </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="text-white hover:text-champagne">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 pt-16 relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border-4 border-champagne mb-4 shadow-xl">
              <img 
                src={settings?.logo_url || "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg"} 
                alt="Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Book an Appointment</h1>
            <p className="text-champagne flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Where Beauty Meets Excellence
              <Sparkles className="w-5 h-5" />
            </p>
          </div>

          {/* Booking Form Card */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl text-white">Your Information</CardTitle>
              <CardDescription className="text-white/60">
                Fill in your details and preferred appointment time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-champagne" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="fullName" className="text-white/90 flex items-center gap-2">
                        <User className="w-4 h-4 text-champagne" />
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        required
                        className="mt-1 bg-white/10 border-white/30 text-white placeholder:text-white/50"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email" className="text-white/90 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-champagne" />
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                          className="mt-1 bg-white/10 border-white/30 text-white placeholder:text-white/50"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-white/90 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-champagne" />
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+233 XX XXX XXXX"
                          required
                          className="mt-1 bg-white/10 border-white/30 text-white placeholder:text-white/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Service Selection */}
                  <div>
                    <Label htmlFor="service" className="text-white/90 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-champagne" />
                      Select Service
                    </Label>
                    <Select value={serviceId} onValueChange={setServiceId}>
                      <SelectTrigger className="mt-1 bg-white/10 border-white/30 text-white">
                        <SelectValue placeholder="Choose a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            <span className="flex items-center justify-between w-full gap-4">
                              <span>{service.name}</span>
                              {/* <span className="text-muted-foreground">
                                GH₵ {service.price.toFixed(2)}
                              </span> */}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedService && (
                      <div className="mt-2 p-3 bg-champagne/10 rounded-lg border border-champagne/20">
                        <p className="text-white text-sm">
                          <span className="font-medium">{selectedService.name}</span>
                          {selectedService.description && (
                            <span className="text-white/70"> - {selectedService.description}</span>
                          )}
                        </p>
                        {/* <p className="text-champagne text-sm mt-1">
                          Duration: {selectedService.duration_minutes} mins • Price: GH₵ {selectedService.price.toFixed(2)}
                        </p> */}
                      </div>
                    )}
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date" className="text-white/90 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-champagne" />
                        Preferred Date
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        min={today}
                        required
                        className="mt-1 bg-white/10 border-white/30 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="time" className="text-white/90 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-champagne" />
                        Preferred Time
                      </Label>
                      <Input
                        id="time"
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        required
                        className="mt-1 bg-white/10 border-white/30 text-white"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="text-white/90">
                      Special Requests (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special requests or notes for your appointment..."
                      className="mt-1 bg-white/10 border-white/30 text-white placeholder:text-white/50 min-h-[100px]"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-champagne hover:bg-champagne-dark text-white font-semibold py-6 text-lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Request Appointment"
                    )}
                  </Button>

                  <p className="text-center text-white/50 text-sm">
                    Our team will contact you to confirm your appointment
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 text-center">
        <p className="text-white/50 text-sm">
          Powered by Zolara Management System
        </p>
        <Link to="/app/auth" className="text-champagne/70 hover:text-champagne text-sm transition-colors">
          Staff Login
        </Link>
      </div>
    </div>
  );
};

export default PublicBooking;
