import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Plus, Minus, Gift, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Checkbox } from '../components/ui/checkbox';
import { addonsService } from '../lib/addons';
import { promoCodes } from '../lib/promoCodes';
import { waitlistService } from '../lib/waitlist';
import { paymentService } from '../lib/payments';
import { subscriptionService } from '../lib/subscriptions';
import { supabase } from '../integrations/supabase/client';

interface EnhancedBookingFormProps {
  selectedService: any;
  selectedDate: Date;
  selectedTime: string;
  selectedStaff?: any;
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
}

interface SelectedAddon {
  addon: any;
  quantity: number;
}

export const EnhancedBookingForm: React.FC<EnhancedBookingFormProps> = ({
  selectedService,
  selectedDate,
  selectedTime,
  selectedStaff,
  onSuccess,
  onCancel
}) => {
  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  
  // Add-ons state
  const [availableAddons, setAvailableAddons] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  
  // Payment state
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  
  // Subscription state
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [useSubscription, setUseSubscription] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [slotUnavailable, setSlotUnavailable] = useState(false);
  const [joinWaitlist, setJoinWaitlist] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  
  // Load initial data
  useEffect(() => {
    loadFormData();
  }, [selectedService]);

  const loadFormData = async () => {
    try {
      // Load compatible add-ons
      if (selectedService?.id) {
        const addons = await addonsService.getCompatibleAddons(selectedService.id);
        setAvailableAddons(addons);
      }

      // Load payment methods
      const methods = await paymentService.getActivePaymentMethods();
      setPaymentMethods(methods);
      if (methods.length > 0) {
        setSelectedPaymentMethod(methods[0].id);
      }

      // Check if user is logged in and has subscription
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscription = await subscriptionService.getActiveSubscription(user.id);
        setActiveSubscription(subscription);
      }

      // Check slot availability
      await checkSlotAvailability();

    } catch (error) {
      console.error('Failed to load form data:', error);
    }
  };

  const checkSlotAvailability = async () => {
    try {
      // Check if slot is still available
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('appointment_date', selectedDate.toISOString().split('T')[0])
        .eq('appointment_time', selectedTime)
        .eq('service_id', selectedService.id)
        .neq('status', 'cancelled');

      if (existingBookings && existingBookings.length > 0) {
        setSlotUnavailable(true);
      }
    } catch (error) {
      console.error('Failed to check slot availability:', error);
    }
  };

  // Add-on management
  const addAddon = (addon: any) => {
    setSelectedAddons(prev => {
      const existing = prev.find(item => item.addon.id === addon.id);
      if (existing) {
        return prev.map(item =>
          item.addon.id === addon.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { addon, quantity: 1 }];
      }
    });
  };

  const removeAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      return prev.reduce((acc, item) => {
        if (item.addon.id === addonId) {
          if (item.quantity > 1) {
            acc.push({ ...item, quantity: item.quantity - 1 });
          }
          // If quantity is 1, don't add to acc (removes it)
        } else {
          acc.push(item);
        }
        return acc;
      }, [] as SelectedAddon[]);
    });
  };

  // Promo code management
  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;

    setPromoError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const clientId = user?.id || 'guest';
      const serviceIds = [selectedService.id];
      const total = calculateSubtotal();

      const validation = await promoCodes.validatePromoCode(
        promoCode.trim(),
        clientId,
        serviceIds,
        total
      );

      if (validation.valid) {
        setAppliedPromo(validation);
        setPromoError('');
      } else {
        setPromoError(validation.error);
        setAppliedPromo(null);
      }
    } catch (error) {
      setPromoError('Failed to validate promo code');
      setAppliedPromo(null);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  // Price calculations
  const calculateSubtotal = () => {
    const servicePrice = selectedService?.price || 0;
    const addonsPrice = selectedAddons.reduce((total, item) => 
      total + (item.addon.price * item.quantity), 0
    );
    return servicePrice + addonsPrice;
  };

  const calculateDiscount = () => {
    if (!appliedPromo) return 0;
    return appliedPromo.discountAmount;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    
    // Apply subscription discount if using subscription
    if (useSubscription && activeSubscription) {
      const subscriptionDiscount = subscriptionService.calculateServiceDiscount(
        subtotal,
        activeSubscription.subscription_plans.discount_percentage
      );
      return Math.max(0, subtotal - discount - subscriptionDiscount);
    }
    
    return Math.max(0, subtotal - discount);
  };

  // Check subscription usage
  const checkSubscriptionUsage = async () => {
    if (!activeSubscription || !selectedService) return false;

    const canUse = await subscriptionService.canUseService(
      activeSubscription.id,
      selectedService.id
    );

    return canUse.canUse;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (slotUnavailable && !joinWaitlist) return;
    
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (joinWaitlist) {
        // Add to waitlist
        const waitlistEntry = await waitlistService.addToWaitlist({
          client_id: user?.id,
          service_id: selectedService.id,
          staff_id: selectedStaff?.id,
          preferred_date: selectedDate.toISOString().split('T')[0],
          preferred_time: selectedTime,
          client_phone: clientPhone,
          client_name: clientName,
          client_email: clientEmail,
          notes,
          priority: activeSubscription ? 2 : 1 // Higher priority for subscribers
        });

        onSuccess?.(waitlistEntry);
        return;
      }

      // Create booking
      const bookingData = {
        client_name: clientName,
        phone: clientPhone,
        email: clientEmail,
        service_id: selectedService.id,
        staff_id: selectedStaff?.id,
        appointment_date: selectedDate.toISOString().split('T')[0],
        appointment_time: selectedTime,
        notes,
        final_price: calculateTotal(),
        status: 'confirmed',
        client_id: user?.id
      };

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Add add-ons to booking
      if (selectedAddons.length > 0) {
        const addonData = selectedAddons.map(item => ({
          addon_id: item.addon.id,
          quantity: item.quantity,
          price_paid: item.addon.price
        }));
        
        await addonsService.addAddonsToBooking(booking.id, addonData);
      }

      // Apply promo code if used
      if (appliedPromo) {
        await promoCodes.applyPromoCode(
          appliedPromo.promoCode.id,
          booking.id,
          user?.id || 'guest',
          appliedPromo.discountAmount
        );
      }

      // Record subscription usage if applicable
      if (useSubscription && activeSubscription) {
        await subscriptionService.recordServiceUsage(
          activeSubscription.id,
          booking.id,
          selectedService.id
        );
      }

      // Process payment if required
      const total = calculateTotal();
      if (total > 0) {
        const paymentData = {
          amount: total,
          payment_method_id: selectedPaymentMethod,
          transaction_type: 'booking' as const,
          related_id: booking.id,
          client_id: user?.id,
          client_phone: clientPhone,
          client_email: clientEmail,
          description: `Booking payment for ${selectedService.name}`,
          metadata: {
            booking_id: booking.id,
            service_name: selectedService.name,
            appointment_date: selectedDate.toISOString().split('T')[0],
            appointment_time: selectedTime
          }
        };

        const paymentResult = await paymentService.initializePayment(paymentData);
        
        if (paymentResult.paymentUrl) {
          // Redirect to payment page
          window.location.href = paymentResult.paymentUrl;
          return;
        }
      }

      onSuccess?.(booking);

    } catch (error) {
      console.error('Booking failed:', error);
      alert('Booking failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            {slotUnavailable ? 'Join Waitlist' : 'Book Appointment'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Booking Summary */}
          <div className="bg-warm-bg p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">Appointment Details</h3>
            <div className="space-y-2 text-sm text-muted-text">
              <div className="flex justify-between">
                <span>Service:</span>
                <span>{selectedService?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{selectedDate.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{selectedTime}</span>
              </div>
              {selectedStaff && (
                <div className="flex justify-between">
                  <span>Staff:</span>
                  <span>{selectedStaff.full_name}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Base Price:</span>
                <span>GHS {selectedService?.price}</span>
              </div>
            </div>
          </div>

          {/* Slot Unavailable Alert */}
          {slotUnavailable && (
            <Alert className="mb-6 border-orange-200 bg-orange-50">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                This time slot is no longer available. You can join the waitlist to be notified if it opens up.
                <div className="mt-2">
                  <Checkbox
                    id="joinWaitlist"
                    checked={joinWaitlist}
                    onCheckedChange={setJoinWaitlist}
                  />
                  <Label htmlFor="joinWaitlist" className="ml-2">
                    Join waitlist for this time slot
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Client Information Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientName">Full Name *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label htmlFor="clientPhone">Phone Number *</Label>
                <Input
                  id="clientPhone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  required
                  placeholder="0XX XXX XXXX"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="clientEmail">Email Address</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="your@email.com (optional)"
              />
            </div>

            {/* Service Add-ons */}
            {!joinWaitlist && availableAddons.length > 0 && (
              <div className="space-y-4">
                <Label>Enhance Your Experience</Label>
                <div className="grid gap-3">
                  {availableAddons.map((addon) => {
                    const selected = selectedAddons.find(item => item.addon.id === addon.id);
                    const quantity = selected?.quantity || 0;
                    
                    return (
                      <div key={addon.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{addon.name}</h4>
                          {addon.description && (
                            <p className="text-sm text-muted-text">{addon.description}</p>
                          )}
                          <p className="text-sm font-semibold text-gold">+GHS {addon.price}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAddon(addon.id)}
                            disabled={quantity === 0}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center">{quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addAddon(addon)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subscription Option */}
            {!joinWaitlist && activeSubscription && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useSubscription"
                    checked={useSubscription}
                    onCheckedChange={setUseSubscription}
                  />
                  <Label htmlFor="useSubscription" className="flex items-center gap-2">
                    <Badge variant="secondary">Subscription</Badge>
                    Use my {activeSubscription.subscription_plans.name} plan
                    ({activeSubscription.subscription_plans.discount_percentage}% off)
                  </Label>
                </div>
                {useSubscription && (
                  <p className="text-sm text-muted-text ml-6">
                    Services used this cycle: {activeSubscription.services_used_this_cycle}
                    {activeSubscription.subscription_plans.max_services_per_cycle && 
                      ` / ${activeSubscription.subscription_plans.max_services_per_cycle}`
                    }
                  </p>
                )}
              </div>
            )}

            {/* Promo Code */}
            {!joinWaitlist && !useSubscription && (
              <div className="space-y-2">
                <Label>Promo Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    disabled={!!appliedPromo}
                  />
                  {appliedPromo ? (
                    <Button type="button" variant="outline" onClick={removePromoCode}>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={applyPromoCode}>
                      <Gift className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {promoError && (
                  <p className="text-sm text-red-600">{promoError}</p>
                )}
                {appliedPromo && (
                  <p className="text-sm text-green-600">
                    ✓ {appliedPromo.promoCode.description} - Save GHS {appliedPromo.discountAmount}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Special Requests or Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or important information..."
              />
            </div>

            {/* Price Breakdown */}
            {!joinWaitlist && (
              <div className="bg-warm-bg p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Price Breakdown</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{selectedService?.name}</span>
                    <span>GHS {selectedService?.price}</span>
                  </div>
                  {selectedAddons.map(item => (
                    <div key={item.addon.id} className="flex justify-between text-muted-text">
                      <span>{item.addon.name} × {item.quantity}</span>
                      <span>GHS {item.addon.price * item.quantity}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>GHS {calculateSubtotal()}</span>
                  </div>
                  {appliedPromo && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo Discount:</span>
                      <span>-GHS {calculateDiscount()}</span>
                    </div>
                  )}
                  {useSubscription && (
                    <div className="flex justify-between text-blue-600">
                      <span>Subscription Discount:</span>
                      <span>-GHS {subscriptionService.calculateServiceDiscount(
                        calculateSubtotal(),
                        activeSubscription?.subscription_plans?.discount_percentage || 0
                      )}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>GHS {calculateTotal()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            {!joinWaitlist && calculateTotal() > 0 && (
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPaymentMethod === method.id
                          ? 'border-gold bg-gold bg-opacity-10'
                          : 'border-border hover:border-gold'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={selectedPaymentMethod === method.id}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{paymentService.getPaymentTypeIcon(method.type)}</span>
                        <span className="text-sm font-medium">{method.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-gold hover:bg-gold/90 text-charcoal"
              >
                {isLoading ? (
                  'Processing...'
                ) : joinWaitlist ? (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Join Waitlist
                  </>
                ) : calculateTotal() === 0 ? (
                  'Confirm Booking'
                ) : (
                  `Pay GHS ${calculateTotal()}`
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
