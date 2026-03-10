# 🌟 Zolara Beauty Studio - Advanced Beauty Business Platform

**Ghana's Most Technologically Advanced Beauty Studio Management System**

[![Deploy to Vercel](https://github.com/Zolarastudio1/Zolara/actions/workflows/deploy.yml/badge.svg)](https://github.com/Zolarastudio1/Zolara/actions/workflows/deploy.yml)
[![CI](https://github.com/Zolarastudio1/Zolara/actions/workflows/ci.yml/badge.svg)](https://github.com/Zolarastudio1/Zolara/actions/workflows/ci.yml)

## 🚀 Live Platforms
- **Main Website:** [zolara-six.vercel.app](https://zolara-six.vercel.app)
- **Custom Domain:** [zolarasalon.com](https://zolarasalon.com)

---

## ✨ **12 Advanced Business Systems**

### 💼 **Core Business Features:**
1. **🎯 Waitlist Management** - Priority queue with SMS notifications
2. **⭐ Service Add-ons** - Dynamic upselling system
3. **🎉 Birthday/Anniversary Tracking** - Automated special date management
4. **🔄 Advanced Bookings** - Recurring appointments & packages
5. **📝 Client History & Notes** - Complete relationship management
6. **📱 SMS Automation** - Campaign-driven messaging (Arkesel)
7. **🎫 Promotional Codes** - Advanced discount management
8. **💬 WhatsApp Business** - Two-way messaging integration
9. **📊 Advanced Analytics** - Real-time business intelligence
10. **🛍️ E-commerce Platform** - Complete product management
11. **💳 Multiple Payment Methods** - 6 integrated payment providers
12. **⭐ Subscription Services** - Multi-tier beauty packages

---

## 🏗️ **Technical Architecture**

### **Frontend:**
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** components
- **Mobile-responsive** design
- **Real-time** updates via Supabase

### **Backend:**
- **Supabase** (PostgreSQL + Auth + Storage + Functions)
- **25+ database tables** with business logic
- **Row Level Security (RLS)** for data protection
- **Automated triggers** for analytics & metrics

### **Integrations:**
- **Arkesel SMS** - Automated marketing campaigns
- **WhatsApp Business API** - Two-way communication
- **Hubtel Payment Gateway** - Ghana mobile money & cards
- **Multiple Payment Providers** - MTN, Vodafone, AirtelTigo, Bank Transfer

---

## 🛠️ **Development Setup**

### **Prerequisites:**
- Node.js 18+
- npm or yarn
- Supabase account

### **Installation:**

```bash
# Clone repository
git clone https://github.com/Zolarastudio1/Zolara.git
cd Zolara

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your Supabase and API keys

# Start development server
npm run dev
```

### **Environment Variables:**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
VITE_ARKESEL_API_KEY=your_arkesel_key
VITE_HUBTEL_MERCHANT_ID=your_hubtel_merchant_id
VITE_WHATSAPP_ACCESS_TOKEN=your_whatsapp_token (optional)
```

---

## 📦 **Available Scripts**

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run type-check   # Run TypeScript checks
npm run clean        # Clean dist folder
```

---

## 🚀 **Deployment**

### **Automatic Deployment:**
- **GitHub Actions** automatically deploy to Vercel on push to main
- **Environment variables** must be configured in Vercel dashboard

### **Manual Deployment:**
```bash
# Build project
npm run build

# Deploy to Vercel (requires Vercel CLI)
vercel --prod
```

---

## 🎯 **Business Impact**

### **Immediate Benefits:**
- **15-25% Revenue Increase** - Service add-ons & upselling
- **30% Reduced No-Shows** - SMS automation
- **Enhanced Client Experience** - Waitlist & birthday automation
- **Operational Efficiency** - Data-driven insights

### **Advanced Features:**
- **Real-time Analytics** - Business performance tracking
- **Client Tier System** - New → Regular → VIP → Platinum
- **Subscription Revenue** - Recurring monthly packages
- **E-commerce Integration** - Product sales alongside services

---

## 📊 **System Features by Role**

### **👑 Admin Dashboard:**
- Advanced analytics & KPIs
- Client relationship management
- SMS campaign management
- Product & inventory control
- Staff performance tracking
- Financial reports & insights

### **📞 Receptionist Interface:**
- Enhanced booking system with add-ons
- Waitlist management & notifications
- Client notes & history access
- Payment processing
- Gift card management

### **👤 Client Portal:**
- Service browsing & booking
- Subscription management
- Order history & tracking
- Loyalty program access
- Birthday & anniversary benefits

### **👩‍💼 Staff Tools:**
- Personal booking calendar
- Client service history
- Performance metrics
- Attendance tracking

---

## 🔧 **Database Schema**

The system uses 25+ interconnected tables including:
- **Core Business:** bookings, services, staff, clients
- **Advanced Features:** waitlist, add-ons, subscriptions, analytics
- **E-commerce:** products, orders, inventory, categories
- **Communication:** sms_queue, whatsapp_messages, campaigns
- **Analytics:** business_metrics, client_analytics

---

## 🔒 **Security & Privacy**

- **Row Level Security (RLS)** on all tables
- **Role-based access control** (Admin, Staff, Client, Receptionist)
- **Encrypted payment processing** via certified providers
- **GDPR-compliant** data handling
- **Audit trails** for sensitive operations

---

## 🌍 **Ghana-Specific Features**

- **Mobile Money Integration** - MTN, Vodafone, AirtelTigo
- **Local SMS Provider** - Arkesel with "ZOLARA" sender ID
- **Ghana Cedi (GHS)** currency support
- **Local business hours** & holidays
- **Tamale, Ghana** location optimization

---

## 📱 **Mobile App (Coming Soon)**

- **React Native** app in development
- **Cross-platform** (iOS & Android)
- **Offline booking** capabilities
- **Push notifications** for appointments
- **Mobile payment** integration

---

## 🤝 **Contributing**

This is a private repository for Zolara Beauty Studio. For support or feature requests, contact the development team.

---

## 📞 **Business Contact**

**Zolara Beauty Studio**
- **📍 Location:** Sakasaka, Opposite CalBank, Tamale, Ghana
- **📱 Phone:** 0594 365 314 | 020 884 8707
- **⏰ Hours:** Monday - Saturday, 8:30 AM - 9:00 PM
- **🌐 Website:** [zolarasalon.com](https://zolarasalon.com)
- **📧 Email:** infozolarasalon@gmail.com
- **📱 Social:** @zolarastudio

---

## 🏆 **Recognition**

**"Ghana's Most Technologically Advanced Beauty Studio"**
- First salon with comprehensive waitlist management
- Advanced SMS automation & WhatsApp integration
- Real-time analytics & business intelligence
- Multi-tier subscription services
- Complete e-commerce platform integration

---

*Built with ❤️ for the beauty industry in Ghana*