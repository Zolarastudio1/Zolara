import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Scissors,
  Sparkles,
  Star,
  Clock,
  MapPin,
  Phone,
  Instagram,
  Facebook,
  Mail,
  ChevronRight,
  Heart,
  X,
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { SocialIcon } from "react-social-icons";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReviewsCardSection } from "@/components/ReviewsCardSection";

const LandingPage = () => {
  const { settings } = useSettings();
  const [testimonials, setTestimonials] = useState([]);

  const services = [
    {
      name: "Hair Styling",
      icon: Scissors,
      description: "Expert cuts, coloring & styling",
    },
    {
      name: "Nail Care",
      icon: Sparkles,
      description: "Manicures, pedicures & nail art",
    },
    {
      name: "Facial Treatments",
      icon: Heart,
      description: "Rejuvenating skin treatments",
    },
    { name: "Makeup", icon: Star, description: "Bridal & occasion makeup" },
  ];

  useEffect(() => {
    fetchTestimonials();
  });

  const fetchTestimonials = async () => {  //@ts-ignore
    const { data, error } = await supabase //@ts-ignore
      .from("reviews")
      .select("*")
      .eq("visible", true)

    console.log("Reviews", data);
    setTestimonials(data);

    if (error) {
      console.error("Failed to fetch reviews:", error);
      setTestimonials([]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-champagne/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-champagne">
              <img
                src={
                  settings?.logo_url ||
                  "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg"
                }
                alt="Zolara Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-bold text-white">
              {/* @ts-ignore */}
              {settings?.business_name || "Zolara Beauty Studio"}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#services"
              className="text-white/80 hover:text-champagne transition-colors"
            >
              Services
            </a>
            <a
              href="#gallery"
              className="text-white/80 hover:text-champagne transition-colors"
            >
              Gallery
            </a>
            <a
              href="#about"
              className="text-white/80 hover:text-champagne transition-colors"
            >
              About
            </a>
            <a
              href="#testimonials"
              className="text-white/80 hover:text-champagne transition-colors"
            >
              Reviews
            </a>
            <a
              href="#contact"
              className="text-white/80 hover:text-champagne transition-colors"
            >
              Contact
            </a>
          </div>
          <Link to="/book">
            <Button className="bg-champagne hover:bg-champagne-dark text-white">
              Book Now
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        className="min-h-screen flex items-center justify-center relative pt-20"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="mx-auto w-28 h-28 rounded-full overflow-hidden border-4 border-champagne mb-8 shadow-2xl">
            <img
              src={
                settings?.logo_url ||
                "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg"
              }
              alt="Zolara Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
            {/* @ts-ignore */}
            {settings?.business_name || "Zolara Beauty Studio"}
          </h1>
          <p className="text-xl md:text-2xl text-champagne italic mb-8 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6" />
            Where Beauty Meets Excellence
            <Sparkles className="w-6 h-6" />
          </p>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Experience premium beauty services in a luxurious setting. Our
            expert stylists are dedicated to bringing out your natural beauty.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/book">
              <Button
                size="lg"
                className="bg-champagne hover:bg-champagne-dark text-white text-lg px-8 py-6 shadow-xl"
              >
                Book an Appointment
                <ChevronRight className="ml-2" />
              </Button>
            </Link>
            <a href="#services">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-gray hover:bg-white/10 text-lg px-8 py-6"
              >
                View Services
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Our Services
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We offer a wide range of premium beauty services to help you look
              and feel your best.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card
                key={index}
                className="bg-card hover:shadow-xl transition-shadow border-champagne/20 group hover:border-champagne"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-champagne/10 rounded-full flex items-center justify-center group-hover:bg-champagne/20 transition-colors">
                    <service.icon className="w-8 h-8 text-champagne" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {service.name}
                  </h3>
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/book">
              <Button className="bg-champagne hover:bg-champagne-dark text-white">
                Book an Appointment
                <ChevronRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-6">
                About Us
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {/* @ts-ignore */}
                {settings?.business_name || "Zolara Beauty Studio"} is a premier
                beauty destination committed to providing exceptional services
                in a relaxing and luxurious environment.
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Our team of skilled professionals uses only the finest products
                and techniques to ensure you leave feeling refreshed,
                rejuvenated, and beautiful.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-champagne/10 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-champagne" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Open Hours</p>
                    <p className="text-sm text-muted-foreground">
                      {(settings as any).opening_time || "8:30 AM"} -{" "}
                      {(settings as any).closing_time || "20:30 PM"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-champagne/10 rounded-full flex items-center justify-center">
                    <Star className="w-5 h-5 text-champagne" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      5-Star Service
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Premium Quality
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Salon Interior"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-champagne text-white p-6 rounded-xl shadow-xl">
                <p className="text-3xl font-bold">10+</p>
                <p className="text-sm">Years Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Our Gallery</h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              Take a peek inside our beautiful salon and see our work.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* @ts-ignore */}
            {settings.gallery_images?.length > 0 &&
              // @ts-ignore
              settings.gallery_images.map((src, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-xl aspect-square"
                >
                  <img
                    src={src}
                    alt={`Gallery image ${index + 1}`}
                    loading="lazy"
                    onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-20 bg-black text-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">What Our Clients Say</h2>
              <p className="text-white/70 max-w-2xl mx-auto">
                Don't just take our word for it - hear from our satisfied
                clients.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <Card
                  key={index}
                  className="bg-white/5 border-white/10 backdrop-blur rounded-xl"
                >
                  <CardContent className="p-6 flex flex-col h-full">
                    {/* Stars */}
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.min(testimonial.rating ?? 0, 5)
                              ? "fill-champagne text-champagne"
                              : "text-white/20"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Review text */}
                    <p className="text-white/80 mb-6 italic leading-relaxed flex-1">
                      {testimonial.comment
                        ? `"${testimonial.comment}"`
                        : "No review comment provided."}
                    </p>

                    {/* Reviewer */}
                    <p className="font-semibold text-champagne">
                      {testimonial.name || "Anonymous"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
      <ReviewsCardSection />

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Visit Us
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We'd love to see you! Book an appointment or stop by our studio.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card border-champagne/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-champagne/10 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-champagne" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Location</h3>
                <p className="text-muted-foreground text-sm">
                  {/* @ts-ignore */}
                  {settings?.business_address || "Sakasaka, Opposite CalBank, Tamale"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-champagne/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-champagne/10 rounded-full flex items-center justify-center">
                  <Phone className="w-6 h-6 text-champagne" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Phone</h3>
                <p className="text-muted-foreground text-sm">
                  {/* @ts-ignore */}
                  {settings?.business_phone || "+233249978750"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-champagne/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-champagne/10 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-champagne" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Email</h3>
                <p className="text-muted-foreground text-sm">
                  {/* @ts-ignore */}
                  {settings?.business_email || "info@zolarasalon.com"}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="text-center mt-10">
            <Link to="/book">
              <Button
                size="lg"
                className="bg-champagne hover:bg-champagne-dark text-white text-lg px-8"
              >
                Book Your Appointment
                <ChevronRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-champagne">
                  <img
                    src={
                      settings?.logo_url ||
                      "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg"
                    }
                    alt="Zolara Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-lg font-bold">
                  {/* @ts-ignore */}
                  {settings?.business_name || "Zolara Beauty Studio Ltd"}
                </span>
              </div>
              <p className="text-white/60 text-sm">
                Where Beauty Meets Excellence
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-champagne">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <a
                    href="#services"
                    className="hover:text-champagne transition-colors"
                  >
                    Services
                  </a>
                </li>
                <li>
                  <a
                    href="#gallery"
                    className="hover:text-champagne transition-colors"
                  >
                    Gallery
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    className="hover:text-champagne transition-colors"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a
                    href="#testimonials"
                    className="hover:text-champagne transition-colors"
                  >
                    Reviews
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="hover:text-champagne transition-colors"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <Link
                    to="/book"
                    className="hover:text-champagne transition-colors"
                  >
                    Book Appointment
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-champagne">Hours</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  {(settings as any).open_time || "8:30 AM"} -{" "}
                  {(settings as any).close_time || "20:30 PM"}
                </li>
                {/* <li>Saturday: {(settings as any).open_time || "9:00 AM"} - {(settings as any).close_time || "6:00 PM"}</li>
                <li>Sunday: Closed</li> */}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-champagne">Follow Us</h4>
              <div className="flex gap-4">
                <SocialIcon url="https://x.com/zolarastudio?s=21" />
                <SocialIcon url="https://www.tiktok.com/@zolarastudio" />
                <SocialIcon url="https://www.threads.com/@zolarastudio" />
                <SocialIcon url="https://www.instagram.com/zolarastudio" />
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-sm">
              © {new Date().getFullYear()}{" "}
              {(settings as any)?.business_name || "Zolara Beauty Studio"}. All
              rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link
                to="/app/auth"
                className="text-champagne/80 hover:text-champagne text-sm transition-colors font-medium"
              >
                Staff Login
              </Link>
              <span className="text-white/30">|</span>
              <p className="text-white/50 text-sm">
                Powered by Zolara Management System
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
