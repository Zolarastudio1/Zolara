import React, { useState, useEffect } from 'react';
import { Clock, Phone, Mail, CheckCircle, X, AlertCircle, Calendar, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { waitlistService, WaitlistEntry } from '../../lib/waitlist';
import { smsService } from '../../lib/smsService';

export const WaitlistManagement: React.FC = () => {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    date: '',
    service_id: ''
  });

  useEffect(() => {
    loadWaitlistEntries();
  }, [filters]);

  const loadWaitlistEntries = async () => {
    setIsLoading(true);
    try {
      const entries = await waitlistService.getWaitlistEntries(filters);
      setWaitlistEntries(entries);
    } catch (error) {
      console.error('Failed to load waitlist entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotifyClient = async (entry: WaitlistEntry) => {
    try {
      if (!entry.client_phone) {
        alert('No phone number available for this client');
        return;
      }

      const message = `Hi ${entry.client_name || 'Valued Client'}! Great news - a slot just opened up at Zolara Beauty Studio on ${entry.preferred_date} at ${entry.preferred_time}. You have 2 hours to confirm. Call 0594 365 314 now!`;
      
      await smsService.sendImmediateSMS(entry.client_phone, message);
      
      // Update waitlist status
      await waitlistService.updateWaitlistStatus(entry.id, 'notified', new Date().toISOString());
      
      // Set expiry (2 hours from now)
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 2);
      
      await waitlistService.updateWaitlistStatus(entry.id, 'notified');
      
      alert('Client notified successfully!');
      loadWaitlistEntries();
    } catch (error) {
      console.error('Failed to notify client:', error);
      alert('Failed to notify client. Please try again.');
    }
  };

  const handleMarkAsBooked = async (entryId: string) => {
    try {
      await waitlistService.updateWaitlistStatus(entryId, 'booked');
      alert('Entry marked as booked!');
      loadWaitlistEntries();
    } catch (error) {
      console.error('Failed to update waitlist entry:', error);
      alert('Failed to update entry. Please try again.');
    }
  };

  const handleCancelEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to cancel this waitlist entry?')) return;
    
    try {
      await waitlistService.cancelWaitlistEntry(entryId);
      alert('Waitlist entry cancelled!');
      loadWaitlistEntries();
    } catch (error) {
      console.error('Failed to cancel waitlist entry:', error);
      alert('Failed to cancel entry. Please try again.');
    }
  };

  const cleanupExpiredEntries = async () => {
    try {
      await waitlistService.cleanupExpiredEntries();
      alert('Expired entries cleaned up!');
      loadWaitlistEntries();
    } catch (error) {
      console.error('Failed to cleanup expired entries:', error);
      alert('Failed to cleanup entries. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      waiting: 'blue',
      notified: 'orange',
      booked: 'green',
      expired: 'red',
      cancelled: 'gray'
    };
    return colors[status] || 'gray';
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 3) return { text: 'VIP', color: 'purple' };
    if (priority === 2) return { text: 'High', color: 'orange' };
    return { text: 'Normal', color: 'blue' };
  };

  const formatTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-charcoal">Waitlist Management</h1>
        <Button onClick={cleanupExpiredEntries} variant="outline">
          <AlertCircle className="w-4 h-4 mr-2" />
          Cleanup Expired
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="notified">Notified</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({...filters, date: e.target.value})}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => setFilters({status: '', date: '', service_id: ''})}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Entries */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">Loading waitlist entries...</div>
        ) : waitlistEntries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-text">
              No waitlist entries found matching your filters.
            </CardContent>
          </Card>
        ) : (
          waitlistEntries.map((entry) => {
            const priority = getPriorityBadge(entry.priority);
            const timeRemaining = formatTimeRemaining(entry.expires_at);
            
            return (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Client Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{entry.client_name || 'Unknown Client'}</h3>
                        <Badge variant="secondary" className={`bg-${getStatusColor(entry.status)}-100 text-${getStatusColor(entry.status)}-700`}>
                          {entry.status}
                        </Badge>
                        <Badge variant="outline" className={`bg-${priority.color}-100 text-${priority.color}-700`}>
                          {priority.text}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-text">
                        {entry.services?.name && (
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {entry.services.name}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {entry.preferred_date} at {entry.preferred_time}
                        </div>
                        {entry.client_phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {entry.client_phone}
                          </div>
                        )}
                        {entry.client_email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {entry.client_email}
                          </div>
                        )}
                      </div>

                      {entry.alternative_dates && entry.alternative_dates.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Alternative dates: </span>
                          <span className="text-muted-text">{entry.alternative_dates.join(', ')}</span>
                        </div>
                      )}

                      {entry.notes && (
                        <div className="text-sm">
                          <span className="font-medium">Notes: </span>
                          <span className="text-muted-text">{entry.notes}</span>
                        </div>
                      )}

                      {timeRemaining && entry.status === 'notified' && (
                        <Alert className="border-orange-200 bg-orange-50">
                          <Clock className="w-4 h-4" />
                          <AlertDescription>
                            {timeRemaining}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 lg:w-48">
                      {entry.status === 'waiting' && (
                        <Button 
                          onClick={() => handleNotifyClient(entry)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Notify Client
                        </Button>
                      )}
                      
                      {entry.status === 'notified' && (
                        <Button 
                          onClick={() => handleMarkAsBooked(entry.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Booked
                        </Button>
                      )}
                      
                      {['waiting', 'notified'].includes(entry.status) && (
                        <Button 
                          onClick={() => handleCancelEntry(entry.id)}
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      )}
                      
                      <div className="text-xs text-muted-text">
                        Added: {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {!isLoading && waitlistEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waitlist Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              {['waiting', 'notified', 'booked', 'expired', 'cancelled'].map((status) => {
                const count = waitlistEntries.filter(entry => entry.status === status).length;
                return (
                  <div key={status}>
                    <div className="text-2xl font-bold text-charcoal">{count}</div>
                    <div className="text-sm text-muted-text capitalize">{status}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
