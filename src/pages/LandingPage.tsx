import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/SettingsContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Menu, X, Gift, MapPin, Phone, Clock } from "lucide-react";
import { SocialIcon } from "react-social-icons";
import AmandaWidget from "@/components/AmandaWidget";

interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  visible: boolean;
}

const LandingPage = () => {
  const { settings } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data, error } = await (supabase as any)
      .from("reviews")
      .select("*")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) return;
    setReviews(data ?? []);
  };

  const navLinks = [
    { href: "#experience", label: "Experience" },
    { href: "#services", label: "Services" },
    { href: "#gift-cards", label: "Gift Cards" },
    { href: "#reviews", label: "Reviews" },
    { href: "#visit", label: "Visit Us" },
  ];

  const services = [
    { name: "Hair & Braiding", description: "Cornrows, box braids, weaves, treatments & styling" },
    { name: "Nail Care", description: "Manicures, pedicures, acrylics & nail art" },
    { name: "Lashes & Brows", description: "Lash extensions, lifts, brow shaping & tinting" },
    { name: "Makeup", description: "Bridal, occasion & everyday glam" },
    { name: "Facials", description: "Rejuvenating skin treatments & facials" },
    { name: "Wigs & Extensions", description: "Custom wig fitting, installation & styling" },
  ];

  const perks = ["Free WiFi", "Free Water", "Loyalty Rewards", "Expert Stylists"];

  const businessName = settings?.business_name || "Zolara Beauty Studio";
  const logoUrl =
    settings?.logo_url ||
    "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg";
  const openTime = settings?.open_time || "8:30 AM";
  const closeTime = settings?.close_time || "9:00 PM";
  const phone = settings?.business_phone || "0594 365 314";
  const address = settings?.business_address || "Sakasaka, Tamale";

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#F5EFE6", color: "#1C1008", fontFamily: "Inter, sans-serif" }}
    >
      {/* ── NAVBAR ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{ backgroundColor: "#F5EFE6", borderColor: "#D4B896" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Zolara Logo"
              className="w-10 h-10 rounded-full object-cover border"
              style={{ borderColor: "#C9A87C" }}
            />
            <div className="hidden sm:block">
              <p
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: "#C9A87C" }}
              >
                Zolara
              </p>
              <p
                className="text-[10px] tracking-widest uppercase"
                style={{ color: "#8B7355" }}
              >
                Beauty Studio
              </p>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-xs font-semibold tracking-widest uppercase transition-opacity hover:opacity-60"
                style={{ color: "#1C1008" }}
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/book">
              <Button
                className="text-xs font-bold tracking-widest uppercase px-6 py-2 rounded-none"
                style={{ backgroundColor: "#1C1008", color: "#F5EFE6" }}
              >
                Book Now
              </Button>
            </Link>
            <button
              className="md:hidden p-1"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div
            className="md:hidden border-t px-6 py-5 flex flex-col gap-5"
            style={{ backgroundColor: "#F5EFE6", borderColor: "#D4B896" }}
          >
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold tracking-widest uppercase"
                style={{ color: "#1C1008" }}
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section id="experience" className="min-h-screen flex items-center pt-20">
        <div className="max-w-7xl mx-auto px-6 w-full grid md:grid-cols-2 gap-12 items-center py-20">
          {/* Left */}
          <div>
            <h1
              className="mb-4 leading-tight"
              style={{
                fontFamily: "Playfair Display, serif",
                fontSize: "clamp(3rem, 7vw, 5.5rem)",
                fontWeight: 400,
                color: "#1C1008",
              }}
            >
              Where Luxury
              <br />
              <span className="italic" style={{ color: "#C9A87C" }}>
                Meets Beauty
              </span>
              <span style={{ color: "#1C1008" }}>.</span>
            </h1>

            <p
              className="text-base leading-relaxed mb-10 max-w-md"
              style={{ color: "#6B5744" }}
            >
              A sanctuary of beauty, comfort, and professional excellence. Every
              detail of your experience at Zolara is crafted to make you feel
              extraordinary.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col gap-3 max-w-xs">
              <div className="flex gap-3">
                <Link to="/book" className="flex-1">
                  <Button
                    className="w-full text-xs font-bold tracking-widest uppercase px-4 py-3 rounded-none"
                    style={{ backgroundColor: "#1C1008", color: "#F5EFE6" }}
                  >
                    Book Your Appointment →
                  </Button>
                </Link>
                <Link to="/buy-gift-card">
                  <Button
                    variant="outline"
                    className="text-xs font-bold tracking-widest uppercase px-4 py-3 rounded-none whitespace-nowrap"
                    style={{
                      borderColor: "#1C1008",
                      color: "#1C1008",
                      backgroundColor: "transparent",
                    }}
                  >
                    🎁 Gift Cards
                  </Button>
                </Link>
              </div>
              <a href="#services" className="block">
                <Button
                  variant="outline"
                  className="w-full text-xs font-bold tracking-widest uppercase px-4 py-3 rounded-none"
                  style={{
                    borderColor: "#1C1008",
                    color: "#1C1008",
                    backgroundColor: "transparent",
                  }}
                >
                  View Services
                </Button>
              </a>
            </div>

            {/* Perks strip */}
            <div className="flex flex-wrap gap-4 mt-10">
              {perks.map((perk) => (
                <span
                  key={perk}
                  className="text-[11px] font-semibold tracking-wider"
                  style={{ color: "#8B7355" }}
                >
                  + {perk.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          {/* Right — info card */}
          <div className="flex justify-center md:justify-end">
            <div
              className="rounded-2xl p-8 shadow-xl max-w-sm w-full"
              style={{ backgroundColor: "#EDE3D5", border: "1px solid #D4B896" }}
            >
              <img
                src={logoUrl}
                alt="Zolara"
                className="w-14 h-14 rounded-full object-cover mx-auto mb-5 border-2"
                style={{ borderColor: "#C9A87C" }}
              />
              <p
                className="text-center italic text-lg mb-6 leading-snug"
                style={{ fontFamily: "Playfair Display, serif", color: "#4A3728" }}
              >
                "Not just a salon: a complete luxury experience."
              </p>
              <div
                className="border-t pt-5 space-y-3"
                style={{ borderColor: "#D4B896" }}
              >
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest uppercase mb-0.5"
                    style={{ color: "#C9A87C" }}
                  >
                    Open Daily
                  </p>
                  <p className="text-sm font-medium" style={{ color: "#1C1008" }}>
                    {openTime} – {closeTime}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest uppercase mb-0.5"
                    style={{ color: "#C9A87C" }}
                  >
                    Location
                  </p>
                  <p className="text-sm font-medium" style={{ color: "#1C1008" }}>
                    {address}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold tracking-widest uppercase mb-0.5"
                    style={{ color: "#C9A87C" }}
                  >
                    Call Us
                  </p>
                  <p className="text-sm font-medium" style={{ color: "#1C1008" }}>
                    0594 365 314 / 020 884 8707
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-24" style={{ backgroundColor: "#EDE3D5" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p
              className="text-[11px] font-bold tracking-widest uppercase mb-3"
              style={{ color: "#C9A87C" }}
            >
              What We Offer
            </p>
            <h2
              className="text-4xl"
              style={{ fontFamily: "Playfair Display, serif", color: "#1C1008" }}
            >
              Our Services
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service.name}
                className="p-7 rounded-xl transition-shadow hover:shadow-md"
                style={{ backgroundColor: "#F5EFE6", border: "1px solid #D4B896" }}
              >
                <h3
                  className="text-base font-semibold mb-2"
                  style={{ fontFamily: "Playfair Display, serif", color: "#1C1008" }}
                >
                  {service.name}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B5744" }}>
                  {service.description}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/book">
              <Button
                className="text-xs font-bold tracking-widest uppercase px-8 py-3 rounded-none"
                style={{ backgroundColor: "#1C1008", color: "#F5EFE6" }}
              >
                Book an Appointment →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── GIFT CARDS ── */}
      <section
        id="gift-cards"
        className="py-24"
        style={{ backgroundColor: "#F5EFE6" }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Gift className="w-10 h-10 mx-auto mb-4" style={{ color: "#C9A87C" }} />
          <h2
            className="text-4xl mb-4"
            style={{ fontFamily: "Playfair Display, serif", color: "#1C1008" }}
          >
            Gift the Luxury
          </h2>
          <p
            className="text-base leading-relaxed mb-8 max-w-xl mx-auto"
            style={{ color: "#6B5744" }}
          >
            Give someone special the gift of a premium beauty experience. Zolara
            gift cards are available for any amount and can be used on any service.
          </p>
          <Link to="/buy-gift-card">
            <Button
              className="text-xs font-bold tracking-widest uppercase px-8 py-3 rounded-none"
              style={{ backgroundColor: "#C9A87C", color: "#1C1008" }}
            >
              🎁 Purchase a Gift Card
            </Button>
          </Link>
        </div>
      </section>

      {/* ── GALLERY (only shown when images exist) ── */}
      {settings?.gallery_images && settings.gallery_images.length > 0 && (
        <section className="py-24" style={{ backgroundColor: "#EDE3D5" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-14">
              <p
                className="text-[11px] font-bold tracking-widest uppercase mb-3"
                style={{ color: "#C9A87C" }}
              >
                Inside Zolara
              </p>
              <h2
                className="text-4xl"
                style={{ fontFamily: "Playfair Display, serif", color: "#1C1008" }}
              >
                Our Studio
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {settings.gallery_images.map((src, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-xl group"
                >
                  <img
                    src={src}
                    alt={`Gallery ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── REVIEWS ── */}
      <section
        id="reviews"
        className="py-24"
        style={{ backgroundColor: "#1C1008" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p
              className="text-[11px] font-bold tracking-widest uppercase mb-3"
              style={{ color: "#C9A87C" }}
            >
              Client Stories
            </p>
            <h2
              className="text-4xl"
              style={{ fontFamily: "Playfair Display, serif", color: "#F5EFE6" }}
            >
              What Our Clients Say
            </h2>
          </div>

          {reviews.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-7 rounded-xl"
                  style={{
                    backgroundColor: "#2C1F14",
                    border: "1px solid #3D2E20",
                  }}
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < (review.rating ?? 0) ? "fill-current" : "opacity-20"
                        }`}
                        style={{ color: "#C9A87C" }}
                      />
                    ))}
                  </div>
                  <p
                    className="text-sm leading-relaxed mb-5 italic"
                    style={{ color: "#D4C4B0" }}
                  >
                    "{review.comment}"
                  </p>
                  <p
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{ color: "#C9A87C" }}
                  >
                    {review.name}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p
              className="text-center text-sm"
              style={{ color: "#6B5744" }}
            >
              Be the first to share your experience.
            </p>
          )}

          <div className="text-center mt-12">
            <a
              href="https://www.google.com/maps/search/?api=1&query=Zolara+Beauty+Studio+Tamale"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="text-xs font-bold tracking-widest uppercase px-8 py-3 rounded-none"
                style={{
                  borderColor: "#C9A87C",
                  color: "#C9A87C",
                  backgroundColor: "transparent",
                }}
              >
                Leave Us a Review ↗
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── VISIT US ── */}
      <section
        id="visit"
        className="py-24"
        style={{ backgroundColor: "#EDE3D5" }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p
            className="text-[11px] font-bold tracking-widest uppercase mb-3"
            style={{ color: "#C9A87C" }}
          >
            Find Us
          </p>
          <h2
            className="text-4xl mb-10"
            style={{ fontFamily: "Playfair Display, serif", color: "#1C1008" }}
          >
            Visit the Studio
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div>
              <MapPin
                className="w-6 h-6 mx-auto mb-3"
                style={{ color: "#C9A87C" }}
              />
              <p
                className="text-xs font-bold tracking-widest uppercase mb-1"
                style={{ color: "#8B7355" }}
              >
                Location
              </p>
              <p className="text-sm font-medium" style={{ color: "#1C1008" }}>
                {address}
              </p>
              <p className="text-xs mt-1" style={{ color: "#6B5744" }}>
                Opposite CalBank, Sakasaka
              </p>
            </div>
            <div>
              <Clock
                className="w-6 h-6 mx-auto mb-3"
                style={{ color: "#C9A87C" }}
              />
              <p
                className="text-xs font-bold tracking-widest uppercase mb-1"
                style={{ color: "#8B7355" }}
              >
                Open Daily
              </p>
              <p className="text-sm font-medium" style={{ color: "#1C1008" }}>
                {openTime} – {closeTime}
              </p>
              <p className="text-xs mt-1" style={{ color: "#6B5744" }}>
                Closed Sundays
              </p>
            </div>
            <div>
              <Phone
                className="w-6 h-6 mx-auto mb-3"
                style={{ color: "#C9A87C" }}
              />
              <p
                className="text-xs font-bold tracking-widest uppercase mb-1"
                style={{ color: "#8B7355" }}
              >
                Call Us
              </p>
              <p className="text-sm font-medium" style={{ color: "#1C1008" }}>
                0594 365 314
              </p>
              <p className="text-xs mt-1" style={{ color: "#6B5744" }}>
                020 884 8707
              </p>
            </div>
          </div>
          <Link to="/book">
            <Button
              className="text-xs font-bold tracking-widest uppercase px-10 py-3 rounded-none"
              style={{ backgroundColor: "#1C1008", color: "#F5EFE6" }}
            >
              Book Your Appointment →
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-12 border-t"
        style={{ backgroundColor: "#1C1008", borderColor: "#3D2E20" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
            <div className="flex items-center gap-4">
              <img
                src={logoUrl}
                alt="Zolara"
                className="w-10 h-10 rounded-full object-cover border"
                style={{ borderColor: "#C9A87C" }}
              />
              <div>
                <p className="text-sm font-bold" style={{ color: "#F5EFE6" }}>
                  {businessName}
                </p>
                <p className="text-xs" style={{ color: "#C9A87C" }}>
                  Where Luxury Meets Beauty
                </p>
              </div>
            </div>

            <div className="flex gap-6 flex-wrap justify-center">
              {navLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="text-[11px] tracking-widest uppercase transition-opacity hover:opacity-60"
                  style={{ color: "#8B7355" }}
                >
                  {label}
                </a>
              ))}
            </div>

            <div className="flex gap-3">
              <SocialIcon
                url="https://www.instagram.com/zolarastudio"
                style={{ width: 32, height: 32 }}
              />
              <SocialIcon
                url="https://www.tiktok.com/@zolarastudio"
                style={{ width: 32, height: 32 }}
              />
              <SocialIcon
                url="https://x.com/zolarastudio"
                style={{ width: 32, height: 32 }}
              />
              <SocialIcon
                url="https://www.threads.com/@zolarastudio"
                style={{ width: 32, height: 32 }}
              />
            </div>
          </div>

          <div
            className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-3"
            style={{ borderColor: "#3D2E20" }}
          >
            <p className="text-xs" style={{ color: "#4A3728" }}>
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </p>
            <Link
              to="/app/auth"
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: "#C9A87C" }}
            >
              Staff Login
            </Link>
          </div>
        </div>
      </footer>

      {/* ── AMANDA CHAT WIDGET ── */}
      <AmandaWidget />
    </div>
  );
};

export default LandingPage;
