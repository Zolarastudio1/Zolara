import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Send, MessageSquare, Clock, Users, AlertCircle, Play, Pause, BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { smsService, SMSCampaign, SMSQueueItem } from '../../lib/smsService';

export const SMSCampaignsManagement: React.FC = () => {
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [queueItems, setQueueItems] = useState<SMSQueueItem[]>([]);
  const [queueStats, setQueueStats] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<SMSCampaign | null>(null);
  const [activeTab, setActiveTab] = useState('campaigns');

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    message_template: '',
    trigger_type: 'promotional' as any,
    send_hours_before: '',
    is_active: true
  });

  const [promoForm, setPromoForm] = useState({
    message: '',
    target_criteria: {
      client_tier: [] as string[],
      last_visit_days: '',
      specific_clients: [] as string[]
    },
    schedule_type: 'immediate',
    scheduled_date: '',
    scheduled_time: ''
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadQueueData, 30000); // Refresh queue every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadCampaigns(),
        loadQueueData(),
        loadQueueStats()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await smsService.getAllCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const loadQueueData = async () => {
    try {
      // Get recent queue items (last 100)
      const { data, error } = await supabase
        .from('sms_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setQueueItems(data);
      }
    } catch (error) {
      console.error('Failed to load queue data:', error);
    }
  };

  const loadQueueStats = async () => {
    try {
      const stats = await smsService.getSMSQueueStatus();
      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const openCampaignDialog = (campaign?: SMSCampaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setCampaignForm({
        name: campaign.name,
        message_template: campaign.message_template,
        trigger_type: campaign.trigger_type,
        send_hours_before: campaign.send_hours_before?.toString() || '',
        is_active: campaign.is_active
      });
    } else {
      setEditingCampaign(null);
      setCampaignForm({
        name: '',
        message_template: '',
        trigger_type: 'promotional',
        send_hours_before: '',
        is_active: true
      });
    }
    setIsCampaignDialogOpen(true);
  };

  const handleSaveCampaign = async () => {
    try {
      const campaignData = {
        name: campaignForm.name.trim(),
        message_template: campaignForm.message_template.trim(),
        trigger_type: campaignForm.trigger_type,
        send_hours_before: campaignForm.send_hours_before ? parseInt(campaignForm.send_hours_before) : null,
        is_active: campaignForm.is_active
      };

      if (editingCampaign) {
        await smsService.updateCampaign(editingCampaign.id, campaignData);
        alert('Campaign updated successfully!');
      } else {
        await smsService.createCampaign(campaignData);
        alert('Campaign created successfully!');
      }

      setIsCampaignDialogOpen(false);
      loadCampaigns();
    } catch (error) {
      console.error('Failed to save campaign:', error);
      alert('Failed to save campaign. Please try again.');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    try {
      await smsService.deleteCampaign(campaignId);
      alert('Campaign deleted successfully!');
      loadCampaigns();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      alert('Failed to delete campaign. Please try again.');
    }
  };

  const handleSendPromoSMS = async () => {
    try {
      const targets = {
        client_tier: promoForm.target_criteria.client_tier,
        last_visit_days: promoForm.target_criteria.last_visit_days ? 
          parseInt(promoForm.target_criteria.last_visit_days) : undefined,
        client_ids: promoForm.target_criteria.specific_clients
      };

      let scheduledFor = undefined;
      if (promoForm.schedule_type === 'scheduled') {
        scheduledFor = new Date(`${promoForm.scheduled_date}T${promoForm.scheduled_time}`);
      }

      const queuedCount = await smsService.sendPromotionalSMS(
        targets, 
        promoForm.message,
        scheduledFor
      );

      alert(`Successfully queued ${queuedCount} promotional SMS messages!`);
      setIsSendDialogOpen(false);
      setPromoForm({
        message: '',
        target_criteria: {
          client_tier: [],
          last_visit_days: '',
          specific_clients: []
        },
        schedule_type: 'immediate',
        scheduled_date: '',
        scheduled_time: ''
      });
      loadQueueData();
    } catch (error) {
      console.error('Failed to send promotional SMS:', error);
      alert('Failed to send promotional SMS. Please try again.');
    }
  };

  const processQueue = async () => {
    try {
      const processed = await smsService.processSMSQueue();
      alert(`Processed ${processed} SMS messages from queue!`);
      loadQueueData();
      loadQueueStats();
    } catch (error) {
      console.error('Failed to process queue:', error);
      alert('Failed to process SMS queue. Please try again.');
    }
  };

  const cancelSMS = async (queueItemId: string) => {
    if (!confirm('Are you sure you want to cancel this SMS?')) return;

    try {
      await smsService.cancelSMS(queueItemId);
      alert('SMS cancelled successfully!');
      loadQueueData();
    } catch (error) {
      console.error('Failed to cancel SMS:', error);
      alert('Failed to cancel SMS. Please try again.');
    }
  };

  const getTriggerTypeColor = (type: string) => {
    const colors = {
      booking_reminder: 'blue',
      birthday: 'pink',
      anniversary: 'purple',
      follow_up: 'green',
      promotional: 'orange',
      waitlist: 'yellow'
    };
    return colors[type] || 'gray';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'yellow',
      sent: 'green',
      failed: 'red',
      cancelled: 'gray'
    };
    return colors[status] || 'gray';
  };

  const placeholderHelp = {
    client_name: "Client's full name",
    service: "Service name from booking",
    date: "Appointment date",
    time: "Appointment time",
    staff: "Staff member name"
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-charcoal">SMS Campaigns</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsSendDialogOpen(true)} 
            variant="outline"
            className="border-orange-200 text-orange-600 hover:bg-orange-50"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Promotional SMS
          </Button>
          <Button onClick={() => openCampaignDialog()} className="bg-gold hover:bg-gold/90 text-charcoal">
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* SMS Queue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-charcoal">{queueStats.total || 0}</div>
            <div className="text-sm text-muted-text">Total (24h)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{queueStats.pending || 0}</div>
            <div className="text-sm text-muted-text">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{queueStats.sent || 0}</div>
            <div className="text-sm text-muted-text">Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{queueStats.failed || 0}</div>
            <div className="text-sm text-muted-text">Failed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Button onClick={processQueue} className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Process Queue
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="queue">SMS Queue ({queueItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-text">
                No SMS campaigns found. Create your first campaign to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className={!campaign.is_active ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`bg-${getTriggerTypeColor(campaign.trigger_type)}-100 text-${getTriggerTypeColor(campaign.trigger_type)}-700`}>
                            {campaign.trigger_type.replace('_', ' ')}
                          </Badge>
                          {!campaign.is_active && (
                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                              Inactive
                            </Badge>
                          )}
                          {campaign.trigger_type === 'booking_reminder' && campaign.send_hours_before && (
                            <Badge variant="outline">
                              {campaign.send_hours_before}h before
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCampaignDialog(campaign)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Message Template:</h4>
                        <p className="text-sm text-muted-text bg-warm-bg p-2 rounded whitespace-pre-wrap">
                          {campaign.message_template}
                        </p>
                      </div>
                      <div className="text-xs text-muted-text">
                        Created: {new Date(campaign.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading SMS queue...</div>
          ) : queueItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-text">
                No SMS messages in queue.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {queueItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`bg-${getStatusColor(item.status)}-100 text-${getStatusColor(item.status)}-700`}>
                            {item.status}
                          </Badge>
                          <span className="text-sm font-medium">{item.phone_number}</span>
                          {item.campaign_id && (
                            <Badge variant="outline" className="text-xs">
                              Campaign
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-text bg-warm-bg p-2 rounded">
                          {item.message}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-text">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Scheduled: {new Date(item.scheduled_for).toLocaleString()}
                          </div>
                          {item.sent_at && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Sent: {new Date(item.sent_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        
                        {item.error_message && (
                          <Alert className="border-red-200 bg-red-50">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                              {item.error_message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      {item.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelSMS(item.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Campaign Dialog */}
      <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Edit SMS Campaign' : 'Create New SMS Campaign'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
                placeholder="e.g. Birthday Wishes"
                required
              />
            </div>

            <div>
              <Label htmlFor="trigger_type">Trigger Type *</Label>
              <Select 
                value={campaignForm.trigger_type} 
                onValueChange={(value) => setCampaignForm({...campaignForm, trigger_type: value as any})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="booking_reminder">Booking Reminder</SelectItem>
                  <SelectItem value="birthday">Birthday Message</SelectItem>
                  <SelectItem value="anniversary">Anniversary Message</SelectItem>
                  <SelectItem value="follow_up">Follow-up Message</SelectItem>
                  <SelectItem value="promotional">Promotional Message</SelectItem>
                  <SelectItem value="waitlist">Waitlist Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {campaignForm.trigger_type === 'booking_reminder' && (
              <div>
                <Label htmlFor="send_hours_before">Send Hours Before Appointment</Label>
                <Input
                  id="send_hours_before"
                  type="number"
                  min="1"
                  max="168"
                  value={campaignForm.send_hours_before}
                  onChange={(e) => setCampaignForm({...campaignForm, send_hours_before: e.target.value})}
                  placeholder="24"
                />
                <p className="text-sm text-muted-text mt-1">
                  How many hours before the appointment should this message be sent?
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="message_template">Message Template *</Label>
              <Textarea
                id="message_template"
                value={campaignForm.message_template}
                onChange={(e) => setCampaignForm({...campaignForm, message_template: e.target.value})}
                placeholder="Hi {{client_name}}, this is a reminder..."
                rows={4}
                required
              />
              <div className="mt-2 text-sm text-muted-text">
                <p className="font-medium mb-1">Available placeholders:</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(placeholderHelp).map(([key, desc]) => (
                    <div key={key} className="text-xs">
                      <code className="bg-gray-100 px-1 rounded">{`{{${key}}}`}</code> - {desc}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={campaignForm.is_active}
                onCheckedChange={(checked) => setCampaignForm({...campaignForm, is_active: checked})}
              />
              <Label htmlFor="is_active">Active (campaign will be triggered automatically)</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCampaignDialogOpen(false)}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveCampaign}
                disabled={!campaignForm.name.trim() || !campaignForm.message_template.trim()}
                className="flex-1 bg-gold hover:bg-gold/90 text-charcoal"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Promotional SMS Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Promotional SMS</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="promo_message">Message *</Label>
              <Textarea
                id="promo_message"
                value={promoForm.message}
                onChange={(e) => setPromoForm({...promoForm, message: e.target.value})}
                placeholder="Your promotional message here..."
                rows={4}
                required
              />
              <p className="text-sm text-muted-text mt-1">
                {promoForm.message.length}/160 characters (SMS length)
              </p>
            </div>

            <div>
              <Label>Target Clients</Label>
              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-sm">Client Tier</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['new', 'regular', 'vip', 'platinum'].map((tier) => (
                      <label key={tier} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={promoForm.target_criteria.client_tier.includes(tier)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPromoForm({
                                ...promoForm,
                                target_criteria: {
                                  ...promoForm.target_criteria,
                                  client_tier: [...promoForm.target_criteria.client_tier, tier]
                                }
                              });
                            } else {
                              setPromoForm({
                                ...promoForm,
                                target_criteria: {
                                  ...promoForm.target_criteria,
                                  client_tier: promoForm.target_criteria.client_tier.filter(t => t !== tier)
                                }
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{tier}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="last_visit_days" className="text-sm">
                    Clients who haven't visited in X days
                  </Label>
                  <Input
                    id="last_visit_days"
                    type="number"
                    min="1"
                    value={promoForm.target_criteria.last_visit_days}
                    onChange={(e) => setPromoForm({
                      ...promoForm,
                      target_criteria: {
                        ...promoForm.target_criteria,
                        last_visit_days: e.target.value
                      }
                    })}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Schedule</Label>
              <div className="space-y-3 mt-2">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="schedule_type"
                      value="immediate"
                      checked={promoForm.schedule_type === 'immediate'}
                      onChange={(e) => setPromoForm({...promoForm, schedule_type: e.target.value})}
                    />
                    <span className="text-sm">Send immediately</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="schedule_type"
                      value="scheduled"
                      checked={promoForm.schedule_type === 'scheduled'}
                      onChange={(e) => setPromoForm({...promoForm, schedule_type: e.target.value})}
                    />
                    <span className="text-sm">Schedule for later</span>
                  </label>
                </div>

                {promoForm.schedule_type === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="scheduled_date">Date</Label>
                      <Input
                        id="scheduled_date"
                        type="date"
                        value={promoForm.scheduled_date}
                        onChange={(e) => setPromoForm({...promoForm, scheduled_date: e.target.value})}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="scheduled_time">Time</Label>
                      <Input
                        id="scheduled_time"
                        type="time"
                        value={promoForm.scheduled_time}
                        onChange={(e) => setPromoForm({...promoForm, scheduled_time: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsSendDialogOpen(false)}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSendPromoSMS}
                disabled={!promoForm.message.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                {promoForm.schedule_type === 'immediate' ? 'Send Now' : 'Schedule SMS'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
