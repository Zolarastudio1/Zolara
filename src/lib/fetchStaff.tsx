//   const fetchStats = async () => {
//     try {
//       const today = new Date();
//       const startOfToday = format(today, "yyyy-MM-dd");
//       const startOfThisWeek = format(startOfWeek(today), "yyyy-MM-dd");
//       const endOfThisWeek = format(endOfWeek(today), "yyyy-MM-dd");
//       const startOfThisMonth = format(startOfMonth(today), "yyyy-MM-dd");
//       const endOfThisMonth = format(endOfMonth(today), "yyyy-MM-dd");

//       // Today's bookings
//       const { data: todayBookings } = await supabase
//         .from("bookings")
//         .select("*", { count: "exact" })
//         .eq("appointment_date", startOfToday);

//       // Today's revenue
//       const { data: todayPayments } = await supabase
//         .from("payments")
//         .select("amount")
//         .gte("payment_date", startOfToday);

//       // Weekly revenue
//       const { data: weeklyPayments } = await supabase
//         .from("payments")
//         .select("amount")
//         .gte("payment_date", startOfThisWeek)
//         .lte("payment_date", endOfThisWeek);

//       // Monthly revenue
//       const { data: monthlyPayments } = await supabase
//         .from("payments")
//         .select("amount")
//         .gte("payment_date", startOfThisMonth)
//         .lte("payment_date", endOfThisMonth);

//       // Total clients
//       const { data: clients, count: clientCount } = await supabase
//         .from("clients")
//         .select("*", { count: "exact" });

//       // Active staff
//       const { data: staff, count: staffCount } = await supabase
//         .from("staff")
//         .select("*", { count: "exact" })
//         .eq("is_active", true);

//       // Top service
//       const { data: services } = await supabase
//         .from("bookings")
//         .select("service_id, services(name)")
//         .gte("appointment_date", startOfThisMonth)
//         .lte("appointment_date", endOfThisMonth);

//       const serviceCounts = services?.reduce((acc: any, booking: any) => {
//         const serviceName = booking.services?.name || "Unknown";
//         acc[serviceName] = (acc[serviceName] || 0) + 1;
//         return acc;
//       }, {});

//       const topService = serviceCounts 
//         ? Object.entries(serviceCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "N/A"
//         : "N/A";

//       setStats({
//         todayBookings: todayBookings?.length || 0,
//         todayRevenue: todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
//         weeklyRevenue: weeklyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
//         monthlyRevenue: monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
//         totalClients: clientCount || 0,
//         activeStaff: staffCount || 0,
//         topService
//       });
//     } catch (error) {
//       console.error("Error fetching stats:", error);
//     } finally {
//       setLoading(false);
//     }
//   };