import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Gift, Calendar, Percent, DollarSign, TrendingUp, Copy, Check } from 'lucide-react';
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
import { promoCodes, PromotionalCode } from '../../lib/promoCodes';
import { supabase } from '../../integrations/supabase/client';

export const PromoCodesManagement: React.FC = () => {
  const [codes, setCodes] = useState<PromotionalCode[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<PromotionalCode | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: '',
    minimum_amount: '0',
    maximum_discount: '',
    usage_limit: '',
    per_client_limit: '1',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    applicable_services: [] as string[],
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [codesData, servicesData] = await Promise.all([
        promoCodes.getAllPromoCodes(),
        supabase.from('services').select('id, name').order('name')
      ]);
      
      setCodes(codesData);
      setServices(servicesData.data || []);
      
      // Load stats for each code
      const statsPromises = codesData.map(code => promoCodes.getPromoCodeStats(code.id));
      const statsResults = await Promise.all(statsPromises);
      
      const statsMap = {};
      codesData.forEach((code, index) => {
        statsMap[code.id] = statsResults[index];
      });
      setStats(statsMap);
      
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingCode(null);
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      minimum_amount: '0',
      maximum_discount: '',
      usage_limit: '',
      per_client_limit: '1',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      applicable_services: [],
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (code: PromotionalCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description || '',
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      minimum_amount: code.minimum_amount.toString(),
      maximum_discount: code.maximum_discount?.toString() || '',
      usage_limit: code.usage_limit?.toString() || '',
      per_client_limit: code.per_client_limit.toString(),
      valid_from: code.valid_from.split('T')[0],
      valid_until: code.valid_until ? code.valid_until.split('T')[0] : '',
      applicable_services: code.applicable_services || [],
      is_active: code.is_active
    });
    setIsDialogOpen(true);
  };

  const generateRandomCode = () => {
    const code = promoCodes.generateRandomCode(8);
    setFormData({...formData, code});
  };

  const handleSave = async () => {
    try {
      const codeData = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        minimum_amount: parseFloat(formData.minimum_amount),
        maximum_discount: formData.maximum_discount ? parseFloat(formData.maximum_discount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        per_client_limit: parseInt(formData.per_client_limit),
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        applicable_services: formData.applicable_services,
        is_active: formData.is_active,
        created_by: null // Will be set by the auth user
      };

      if (editingCode) {
        await promoCodes.updatePromoCode(editingCode.id, codeData);
        alert('Promo code updated successfully!');
      } else {
        await promoCodes.createPromoCode(codeData);
        alert('Promo code created successfully!');
      }

      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save promo code:', error);
      alert('Failed to save promo code. Please try again.');
    }
  };

  const handleDelete = async (codeId: string) => {
    if (!confirm('Are you sure you want to delete this promo code? This action cannot be undone.')) {
      return;
    }

    try {
      await promoCodes.deletePromoCode(codeId);
      alert('Promo code deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Failed to delete promo code:', error);
      alert('Failed to delete promo code. Please try again.');
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const getStatusColor = (code: PromotionalCode) => {
    if (!code.is_active) return 'red';
    
    const now = new Date();
    const validFrom = new Date(code.valid_from);
    const validUntil = code.valid_until ? new Date(code.valid_until) : null;
    
    if (now < validFrom) return 'yellow'; // Not yet active
    if (validUntil && now > validUntil) return 'red'; // Expired
    if (code.usage_limit && code.usage_count >= code.usage_limit) return 'red'; // Usage limit reached
    
    return 'green'; // Active
  };

  const getStatusText = (code: PromotionalCode) => {
    if (!code.is_active) return 'Inactive';
    
    const now = new Date();
    const validFrom = new Date(code.valid_from);
    const validUntil = code.valid_until ? new Date(code.valid_until) : null;
    
    if (now < validFrom) return 'Scheduled';
    if (validUntil && now > validUntil) return 'Expired';
    if (code.usage_limit && code.usage_count >= code.usage_limit) return 'Usage Limit Reached';
    
    return 'Active';
  };

  const formatDiscount = (code: PromotionalCode) => {
    if (code.discount_type === 'percentage') {
      return `${code.discount_value}% off`;
    } else {
      return `GHS ${code.discount_value} off`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-charcoal">Promotional Codes</h1>
        <Button onClick={openCreateDialog} className="bg-gold hover:bg-gold/90 text-charcoal">
          <Plus className="w-4 h-4 mr-2" />
          Create Promo Code
        </Button>
      </div>

      {/* Promo Codes List */}
      {isLoading ? (
        <div className="text-center py-8">Loading promo codes...</div>
      ) : (
        <div className="space-y-4">
          {codes.map((code) => {
            const statusColor = getStatusColor(code);
            const statusText = getStatusText(code);
            const codeStats = stats[code.id] || {};
            
            return (
              <Card key={code.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Code Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <code className="text-lg font-mono font-bold bg-gray-100 px-2 py-1 rounded">
                            {code.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(code.code)}
                            className="h-6 w-6 p-0"
                          >
                            {copiedCode === code.code ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        
                        <Badge className={`bg-${statusColor}-100 text-${statusColor}-700`}>
                          {statusText}
                        </Badge>
                        
                        <div className="flex items-center gap-1 text-gold font-semibold">
                          {code.discount_type === 'percentage' ? (
                            <Percent className="w-4 h-4" />
                          ) : (
                            <DollarSign className="w-4 h-4" />
                          )}
                          {formatDiscount(code)}
                        </div>
                      </div>

                      {code.description && (
                        <p className="text-muted-text">{code.description}</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="font-medium">Usage: </span>
                          <span>
                            {code.usage_count}
                            {code.usage_limit && ` / ${code.usage_limit}`}
                          </span>
                        </div>
                        
                        <div>
                          <span className="font-medium">Min Amount: </span>
                          <span>GHS {code.minimum_amount}</span>
                        </div>
                        
                        <div>
                          <span className="font-medium">Valid From: </span>
                          <span>{new Date(code.valid_from).toLocaleDateString()}</span>
                        </div>
                        
                        <div>
                          <span className="font-medium">Valid Until: </span>
                          <span>
                            {code.valid_until 
                              ? new Date(code.valid_until).toLocaleDateString()
                              : 'No expiry'
                            }
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      {codeStats.totalUsage > 0 && (
                        <div className="bg-warm-bg p-3 rounded-lg">
                          <h4 className="font-medium mb-2 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Performance
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-muted-text">Total Savings: </span>
                              <span className="font-semibold text-green-600">
                                GHS {codeStats.totalDiscountGiven || 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-text">Unique Clients: </span>
                              <span className="font-semibold">{codeStats.uniqueClients || 0}</span>
                            </div>
                            <div>
                              <span className="text-muted-text">Avg Discount: </span>
                              <span className="font-semibold">
                                GHS {codeStats.totalUsage ? 
                                  ((codeStats.totalDiscountGiven || 0) / codeStats.totalUsage).toFixed(2) : 
                                  '0.00'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {code.applicable_services.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Applicable Services: </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {code.applicable_services.map(serviceId => {
                              const service = services.find(s => s.id === serviceId);
                              return service ? (
                                <Badge key={serviceId} variant="outline" className="text-xs">
                                  {service.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 lg:w-32">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(code)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(code.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {codes.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-text">
            No promo codes found. Create your first promo code to start offering discounts.
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? 'Edit Promo Code' : 'Create New Promo Code'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Promo Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  placeholder="SAVE20"
                  maxLength={20}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomCode}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="e.g. 20% off all services for new clients"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discount_type">Discount Type *</Label>
                <Select 
                  value={formData.discount_type} 
                  onValueChange={(value) => setFormData({...formData, discount_type: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discount_value">
                  {formData.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount (GHS)'} *
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  max={formData.discount_type === 'percentage' ? '100' : undefined}
                  value={formData.discount_value}
                  onChange={(e) => setFormData({...formData, discount_value: e.target.value})}
                  placeholder={formData.discount_type === 'percentage' ? '20' : '50.00'}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minimum_amount">Minimum Order Amount (GHS)</Label>
                <Input
                  id="minimum_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimum_amount}
                  onChange={(e) => setFormData({...formData, minimum_amount: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              {formData.discount_type === 'percentage' && (
                <div>
                  <Label htmlFor="maximum_discount">Max Discount (GHS)</Label>
                  <Input
                    id="maximum_discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.maximum_discount}
                    onChange={(e) => setFormData({...formData, maximum_discount: e.target.value})}
                    placeholder="No limit"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="usage_limit">Total Usage Limit</Label>
                <Input
                  id="usage_limit"
                  type="number"
                  min="1"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({...formData, usage_limit: e.target.value})}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <Label htmlFor="per_client_limit">Uses Per Client</Label>
                <Input
                  id="per_client_limit"
                  type="number"
                  min="1"
                  value={formData.per_client_limit}
                  onChange={(e) => setFormData({...formData, per_client_limit: e.target.value})}
                  placeholder="1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valid_from">Valid From *</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="valid_until">Valid Until</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
                  min={formData.valid_from}
                />
              </div>
            </div>

            <div>
              <Label>Applicable Services (leave empty for all services)</Label>
              <div className="mt-2 max-h-32 overflow-y-auto border rounded-lg p-3 space-y-2">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.applicable_services.includes(service.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            applicable_services: [...formData.applicable_services, service.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            applicable_services: formData.applicable_services.filter(id => id !== service.id)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{service.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active">Active (available for use)</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.code.trim() || !formData.discount_value}
                className="flex-1 bg-gold hover:bg-gold/90 text-charcoal"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingCode ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      {codes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Promo Codes Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-charcoal">{codes.length}</div>
                <div className="text-sm text-muted-text">Total Codes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {codes.filter(code => getStatusText(code) === 'Active').length}
                </div>
                <div className="text-sm text-muted-text">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {codes.reduce((sum, code) => sum + code.usage_count, 0)}
                </div>
                <div className="text-sm text-muted-text">Total Uses</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gold">
                  GHS {Object.values(stats).reduce((sum: number, stat: any) => sum + (stat.totalDiscountGiven || 0), 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-text">Total Savings Given</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
