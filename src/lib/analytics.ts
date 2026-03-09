import { supabase } from '../integrations/supabase/client';

export interface BusinessMetric {
  id: string;
  date: string;
  metric_type: string;
  value: number;
  additional_data: any;
  created_at: string;
}

export interface ClientAnalytics {
  id: string;
  client_id: string;
  first_visit_date?: string;
  last_visit_date?: string;
  total_visits: number;
  total_spent: number;
  average_booking_value: number;
  favorite_service_id?: string;
  favorite_staff_id?: string;
  client_tier: 'new' | 'regular' | 'vip' | 'platinum';
  last_calculated: string;
}

export const analyticsService = {
  // BUSINESS METRICS
  async recordDailyMetrics() {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's revenue
    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('final_price')
      .eq('appointment_date', today)
      .eq('status', 'completed');

    const dailyRevenue = todayBookings?.reduce((sum, booking) => sum + booking.final_price, 0) || 0;

    // Get today's orders revenue
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .gte('created_at', today + 'T00:00:00Z')
      .lt('created_at', new Date(new Date(today).getTime() + 24*60*60*1000).toISOString())
      .eq('payment_status', 'paid');

    const ordersRevenue = todayOrders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

    // Get client counts
    const { data: newClients } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', today + 'T00:00:00Z')
      .lt('created_at', new Date(new Date(today).getTime() + 24*60*60*1000).toISOString());

    const { data: totalClients } = await supabase
      .from('profiles')
      .select('id');

    // Get booking counts
    const { data: totalBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('appointment_date', today);

    // Record metrics
    const metrics = [
      { metric_type: 'daily_revenue', value: dailyRevenue + ordersRevenue },
      { metric_type: 'service_revenue', value: dailyRevenue },
      { metric_type: 'product_revenue', value: ordersRevenue },
      { metric_type: 'new_clients', value: newClients?.length || 0 },
      { metric_type: 'total_clients', value: totalClients?.length || 0 },
      { metric_type: 'daily_bookings', value: totalBookings?.length || 0 }
    ];

    for (const metric of metrics) {
      await supabase
        .from('business_metrics')
        .upsert([{
          date: today,
          metric_type: metric.metric_type,
          value: metric.value,
          additional_data: {}
        }], {
          onConflict: 'date,metric_type'
        });
    }

    return metrics;
  },

  async getRevenueAnalytics(period: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get daily revenue metrics
    const { data: revenueData } = await supabase
      .from('business_metrics')
      .select('*')
      .eq('metric_type', 'daily_revenue')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Calculate totals
    const totalRevenue = revenueData?.reduce((sum, day) => sum + day.value, 0) || 0;
    const averageDaily = revenueData?.length ? totalRevenue / revenueData.length : 0;
    
    // Growth calculation
    const midPoint = Math.floor(revenueData?.length / 2);
    const firstHalf = revenueData?.slice(0, midPoint) || [];
    const secondHalf = revenueData?.slice(midPoint) || [];
    
    const firstHalfAvg = firstHalf.length ? firstHalf.reduce((sum, day) => sum + day.value, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length ? secondHalf.reduce((sum, day) => sum + day.value, 0) / secondHalf.length : 0;
    
    const growthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    return {
      totalRevenue,
      averageDaily,
      growthRate,
      dailyData: revenueData || [],
      period
    };
  },

  async getServiceAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get service popularity
    const { data: serviceData } = await supabase
      .from('bookings')
      .select(`
        service_id,
        final_price,
        services(name)
      `)
      .gte('appointment_date', thirtyDaysAgo.toISOString().split('T')[0])
      .eq('status', 'completed');

    const serviceStats = serviceData?.reduce((acc, booking) => {
      const serviceId = booking.service_id;
      if (!acc[serviceId]) {
        acc[serviceId] = {
          id: serviceId,
          name: booking.services?.name || 'Unknown Service',
          bookings: 0,
          revenue: 0
        };
      }
      acc[serviceId].bookings += 1;
      acc[serviceId].revenue += booking.final_price;
      return acc;
    }, {} as Record<string, any>);

    const topServices = Object.values(serviceStats || {})
      .sort((a: any, b: any) => b.bookings - a.bookings)
      .slice(0, 10);

    return topServices;
  },

  async getClientAnalytics(period: 'month' | 'quarter' | 'year' = 'month') {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get client tier distribution
    const { data: clientTiers } = await supabase
      .from('client_analytics')
      .select('client_tier');

    const tierDistribution = clientTiers?.reduce((acc, client) => {
      acc[client.client_tier] = (acc[client.client_tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get new vs returning clients
    const { data: newClients } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', startDate.toISOString());

    const { data: totalClients } = await supabase
      .from('profiles')
      .select('id');

    // Get client spending patterns
    const { data: spendingData } = await supabase
      .from('client_analytics')
      .select('total_spent, total_visits, client_tier')
      .order('total_spent', { ascending: false });

    const avgSpendingByTier = spendingData?.reduce((acc, client) => {
      if (!acc[client.client_tier]) {
        acc[client.client_tier] = { total: 0, count: 0 };
      }
      acc[client.client_tier].total += client.total_spent;
      acc[client.client_tier].count += 1;
      return acc;
    }, {} as Record<string, any>);

    Object.keys(avgSpendingByTier || {}).forEach(tier => {
      const data = avgSpendingByTier[tier];
      avgSpendingByTier[tier] = data.total / data.count;
    });

    return {
      tierDistribution: tierDistribution || {},
      newClients: newClients?.length || 0,
      totalClients: totalClients?.length || 0,
      averageSpendingByTier: avgSpendingByTier || {},
      topSpenders: spendingData?.slice(0, 10) || []
    };
  },

  async getStaffAnalytics(period: 'month' | 'quarter' = 'month') {
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    } else {
      startDate.setMonth(endDate.getMonth() - 3);
    }

    // Get staff performance
    const { data: staffData } = await supabase
      .from('bookings')
      .select(`
        staff_id,
        final_price,
        profiles(full_name)
      `)
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .eq('status', 'completed')
      .not('staff_id', 'is', null);

    const staffStats = staffData?.reduce((acc, booking) => {
      const staffId = booking.staff_id;
      if (!acc[staffId]) {
        acc[staffId] = {
          id: staffId,
          name: booking.profiles?.full_name || 'Unknown Staff',
          bookings: 0,
          revenue: 0
        };
      }
      acc[staffId].bookings += 1;
      acc[staffId].revenue += booking.final_price;
      return acc;
    }, {} as Record<string, any>);

    const topStaff = Object.values(staffStats || {})
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10);

    return topStaff;
  },

  async getBookingTrends(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get daily booking counts
    const { data: dailyBookings } = await supabase
      .from('bookings')
      .select('appointment_date, status')
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .lte('appointment_date', endDate.toISOString().split('T')[0]);

    // Group by date and status
    const trendData = dailyBookings?.reduce((acc, booking) => {
      const date = booking.appointment_date;
      if (!acc[date]) {
        acc[date] = { date, total: 0, completed: 0, cancelled: 0 };
      }
      acc[date].total += 1;
      if (booking.status === 'completed') {
        acc[date].completed += 1;
      } else if (booking.status === 'cancelled') {
        acc[date].cancelled += 1;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(trendData || {}).sort((a: any, b: any) => a.date.localeCompare(b.date));
  },

  async getProductAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get best selling products
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        product_name,
        quantity,
        total_price,
        orders!inner(created_at, payment_status)
      `)
      .gte('orders.created_at', thirtyDaysAgo.toISOString())
      .eq('orders.payment_status', 'paid');

    const productStats = orderItems?.reduce((acc, item) => {
      const productName = item.product_name;
      if (!acc[productName]) {
        acc[productName] = {
          name: productName,
          quantity: 0,
          revenue: 0
        };
      }
      acc[productName].quantity += item.quantity;
      acc[productName].revenue += item.total_price;
      return acc;
    }, {} as Record<string, any>);

    const topProducts = Object.values(productStats || {})
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10);

    // Get low stock products
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('name, stock_quantity, low_stock_threshold')
      .lte('stock_quantity', supabase.raw('low_stock_threshold'))
      .eq('is_active', true);

    return {
      topProducts,
      lowStockProducts: lowStockProducts || []
    };
  },

  async getFinancialSummary(period: 'month' | 'quarter' = 'month') {
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    } else {
      startDate.setMonth(endDate.getMonth() - 3);
    }

    // Service revenue
    const { data: serviceBookings } = await supabase
      .from('bookings')
      .select('final_price')
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .eq('status', 'completed');

    const serviceRevenue = serviceBookings?.reduce((sum, booking) => sum + booking.final_price, 0) || 0;

    // Product revenue
    const { data: productOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .gte('created_at', startDate.toISOString())
      .eq('payment_status', 'paid');

    const productRevenue = productOrders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

    // Subscription revenue
    const { data: subscriptionPayments } = await supabase
      .from('payment_transactions')
      .select('amount')
      .eq('transaction_type', 'subscription')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    const subscriptionRevenue = subscriptionPayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

    // Gift card sales
    const { data: giftCardSales } = await supabase
      .from('gift_card_purchases')
      .select('amount_paid')
      .gte('created_at', startDate.toISOString())
      .eq('payment_status', 'completed');

    const giftCardRevenue = giftCardSales?.reduce((sum, sale) => sum + sale.amount_paid, 0) || 0;

    const totalRevenue = serviceRevenue + productRevenue + subscriptionRevenue + giftCardRevenue;

    return {
      totalRevenue,
      serviceRevenue,
      productRevenue,
      subscriptionRevenue,
      giftCardRevenue,
      breakdown: {
        services: (serviceRevenue / totalRevenue) * 100,
        products: (productRevenue / totalRevenue) * 100,
        subscriptions: (subscriptionRevenue / totalRevenue) * 100,
        giftCards: (giftCardRevenue / totalRevenue) * 100
      }
    };
  },

  async getDashboardKPIs() {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // This month's metrics
    const thisMonth = await this.getFinancialSummary('month');
    
    // Active subscriptions
    const { data: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('id')
      .in('status', ['trial', 'active']);

    // Total clients
    const { data: totalClients } = await supabase
      .from('profiles')
      .select('id');

    // This month's new clients
    const { data: newClients } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', monthStart.toISOString());

    // Pending orders
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id')
      .in('status', ['pending', 'confirmed', 'processing']);

    // Today's bookings
    const { data: todaysBookings } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('appointment_date', today.toISOString().split('T')[0]);

    // Waitlist count
    const { data: waitlistCount } = await supabase
      .from('waitlist')
      .select('id')
      .eq('status', 'waiting');

    return {
      revenue: {
        current: thisMonth.totalRevenue,
        growth: 0 // Would need last month data for comparison
      },
      clients: {
        total: totalClients?.length || 0,
        new: newClients?.length || 0
      },
      subscriptions: {
        active: activeSubscriptions?.length || 0
      },
      orders: {
        pending: pendingOrders?.length || 0
      },
      bookings: {
        today: todaysBookings?.length || 0,
        completed: todaysBookings?.filter(b => b.status === 'completed').length || 0
      },
      waitlist: waitlistCount?.length || 0
    };
  },

  // CLIENT TIER CALCULATIONS
  async updateClientTiers() {
    const { data: clients } = await supabase
      .from('client_analytics')
      .select('*');

    if (!clients) return;

    for (const client of clients) {
      let newTier: 'new' | 'regular' | 'vip' | 'platinum' = 'new';

      if (client.total_visits >= 50 && client.total_spent >= 2000) {
        newTier = 'platinum';
      } else if (client.total_visits >= 20 && client.total_spent >= 1000) {
        newTier = 'vip';
      } else if (client.total_visits >= 5 && client.total_spent >= 300) {
        newTier = 'regular';
      }

      if (newTier !== client.client_tier) {
        await supabase
          .from('client_analytics')
          .update({ client_tier: newTier })
          .eq('id', client.id);
      }
    }
  },

  // REPORTING
  async generateBusinessReport(startDate: Date, endDate: Date) {
    const report = {
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      revenue: await this.getRevenueAnalytics('month'),
      services: await this.getServiceAnalytics(),
      clients: await this.getClientAnalytics('month'),
      staff: await this.getStaffAnalytics('month'),
      products: await this.getProductAnalytics(),
      generatedAt: new Date().toISOString()
    };

    return report;
  },

  async exportAnalyticsData(startDate: Date, endDate: Date, format: 'csv' | 'json' = 'json') {
    const report = await this.generateBusinessReport(startDate, endDate);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = this.convertToCSV(report);
      return csvData;
    }
    
    return JSON.stringify(report, null, 2);
  },

  convertToCSV(data: any): string {
    // Simple CSV conversion for key metrics
    const csvRows = [
      'Metric,Value',
      `Total Revenue,${data.revenue.totalRevenue}`,
      `Average Daily Revenue,${data.revenue.averageDaily}`,
      `Revenue Growth Rate,${data.revenue.growthRate}%`,
      `Top Service,${data.services[0]?.name || 'N/A'}`,
      `Top Service Bookings,${data.services[0]?.bookings || 0}`,
      `New Clients,${data.clients.newClients}`,
      `Total Clients,${data.clients.totalClients}`,
      `VIP Clients,${data.clients.tierDistribution?.vip || 0}`,
      `Platinum Clients,${data.clients.tierDistribution?.platinum || 0}`
    ];
    
    return csvRows.join('\n');
  }
};
