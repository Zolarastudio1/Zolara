import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, Calendar, Star, ShoppingBag, CreditCard, Gift, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { analyticsService } from '../../lib/analytics';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative';
  icon: any;
  color: string;
}

export const AnalyticsDashboard: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardKPIs, setDashboardKPIs] = useState<any>({});
  const [revenueAnalytics, setRevenueAnalytics] = useState<any>({});
  const [serviceAnalytics, setServiceAnalytics] = useState<any[]>([]);
  const [clientAnalytics, setClientAnalytics] = useState<any>({});
  const [staffAnalytics, setStaffAnalytics] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>({});
  const [bookingTrends, setBookingTrends] = useState<any[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<any>({});

  useEffect(() => {
    loadAnalyticsData();
  }, [period]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const [
        kpis,
        revenue,
        services,
        clients,
        staff,
        financial,
        bookings,
        products
      ] = await Promise.all([
        analyticsService.getDashboardKPIs(),
        analyticsService.getRevenueAnalytics(period),
        analyticsService.getServiceAnalytics(),
        analyticsService.getClientAnalytics(period),
        analyticsService.getStaffAnalytics(period),
        analyticsService.getFinancialSummary(period),
        analyticsService.getBookingTrends(30),
        analyticsService.getProductAnalytics()
      ]);

      setDashboardKPIs(kpis);
      setRevenueAnalytics(revenue);
      setServiceAnalytics(services);
      setClientAnalytics(clients);
      setStaffAnalytics(staff);
      setFinancialSummary(financial);
      setBookingTrends(bookings);
      setProductAnalytics(products);

    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const reportData = await analyticsService.exportAnalyticsData(startDate, endDate, 'json');
      
      // Create download link
      const blob = new Blob([reportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zolara-analytics-${period}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getChangeIcon = (changeType: 'positive' | 'negative') => {
    return changeType === 'positive' ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const mainMetrics: MetricCard[] = [
    {
      title: 'Total Revenue',
      value: formatCurrency(revenueAnalytics.totalRevenue || 0),
      change: revenueAnalytics.growthRate,
      changeType: (revenueAnalytics.growthRate || 0) >= 0 ? 'positive' : 'negative',
      icon: DollarSign,
      color: 'gold'
    },
    {
      title: 'Total Clients',
      value: dashboardKPIs.clients?.total || 0,
      change: clientAnalytics.newClients ? 
        (clientAnalytics.newClients / (clientAnalytics.totalClients - clientAnalytics.newClients)) * 100 : 0,
      changeType: 'positive',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Today\'s Bookings',
      value: `${dashboardKPIs.bookings?.completed || 0}/${dashboardKPIs.bookings?.today || 0}`,
      icon: Calendar,
      color: 'green'
    },
    {
      title: 'Active Subscriptions',
      value: dashboardKPIs.subscriptions?.active || 0,
      icon: Star,
      color: 'purple'
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-charcoal">Analytics Dashboard</h1>
          <div className="animate-pulse h-10 w-32 bg-gray-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-charcoal">Analytics Dashboard</h1>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportData} variant="outline">
            Export Data
          </Button>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainMetrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-text">{metric.title}</p>
                    <p className="text-2xl font-bold text-charcoal">{metric.value}</p>
                    {metric.change !== undefined && (
                      <div className="flex items-center gap-1 mt-1">
                        {getChangeIcon(metric.changeType!)}
                        <span className={`text-sm font-medium ${
                          metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(metric.change)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-full bg-${metric.color} bg-opacity-10`}>
                    <IconComponent className={`w-6 h-6 text-${metric.color === 'gold' ? 'yellow-600' : metric.color + '-600'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Services</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500"
                      style={{ width: `${financialSummary.breakdown?.services || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(financialSummary.serviceRevenue || 0)}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Products</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ width: `${financialSummary.breakdown?.products || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(financialSummary.productRevenue || 0)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Subscriptions</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500"
                      style={{ width: `${financialSummary.breakdown?.subscriptions || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(financialSummary.subscriptionRevenue || 0)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Gift Cards</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-pink-500"
                      style={{ width: `${financialSummary.breakdown?.giftCards || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(financialSummary.giftCardRevenue || 0)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(clientAnalytics.tierDistribution || {}).map(([tier, count]: [string, any]) => (
                <div key={tier} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`
                      ${tier === 'platinum' ? 'bg-purple-100 text-purple-700' : ''}
                      ${tier === 'vip' ? 'bg-gold bg-opacity-10 text-yellow-700' : ''}
                      ${tier === 'regular' ? 'bg-blue-100 text-blue-700' : ''}
                      ${tier === 'new' ? 'bg-green-100 text-green-700' : ''}
                    `}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{count} clients</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {serviceAnalytics.slice(0, 8).map((service, index) => (
              <div key={service.id} className="flex items-center justify-between p-3 bg-warm-bg rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gold bg-opacity-20 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{service.name}</h4>
                    <p className="text-sm text-muted-text">{service.bookings} bookings</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gold">{formatCurrency(service.revenue)}</p>
                  <p className="text-sm text-muted-text">
                    {formatCurrency(service.revenue / service.bookings)} avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Performance */}
      {staffAnalytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staffAnalytics.slice(0, 6).map((staff, index) => (
                <div key={staff.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{staff.name}</h4>
                    <p className="text-sm text-muted-text">{staff.bookings} bookings</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gold">{formatCurrency(staff.revenue)}</p>
                    <p className="text-sm text-muted-text">
                      {formatCurrency(staff.revenue / staff.bookings)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Analytics */}
      {productAnalytics.topProducts?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Best Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productAnalytics.topProducts.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{product.name}</h4>
                      <p className="text-sm text-muted-text">{product.quantity} sold</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gold">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productAnalytics.lowStockProducts?.length > 0 ? (
                <div className="space-y-3">
                  {productAnalytics.lowStockProducts.slice(0, 5).map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                      <div>
                        <h4 className="font-medium text-orange-800">{product.name}</h4>
                        <p className="text-sm text-orange-600">
                          {product.stock_quantity} remaining (threshold: {product.low_stock_threshold})
                        </p>
                      </div>
                      <Badge variant="destructive">Low Stock</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-text">All products are well stocked</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-warm-bg transition-colors">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-medium text-sm">Waitlist</h3>
            <p className="text-lg font-bold text-blue-600">{dashboardKPIs.waitlist || 0}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-warm-bg transition-colors">
          <CardContent className="p-4 text-center">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <h3 className="font-medium text-sm">Pending Orders</h3>
            <p className="text-lg font-bold text-green-600">{dashboardKPIs.orders?.pending || 0}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-warm-bg transition-colors">
          <CardContent className="p-4 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-pink-600" />
            <h3 className="font-medium text-sm">Gift Cards</h3>
            <p className="text-lg font-bold text-pink-600">Active</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-warm-bg transition-colors">
          <CardContent className="p-4 text-center">
            <Smartphone className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <h3 className="font-medium text-sm">SMS Queue</h3>
            <p className="text-lg font-bold text-purple-600">Monitor</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Fix the missing import
const AlertTriangle = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
    />
  </svg>
);
