import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, DollarSign, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { addonsService, ServiceAddon } from '../../lib/addons';
import { supabase } from '../../integrations/supabase/client';

interface AddonsManagementProps {}

export const AddonsManagement: React.FC<AddonsManagementProps> = () => {
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAddon, setEditingAddon] = useState<ServiceAddon | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '15',
    category: 'general' as 'nails' | 'hair' | 'beauty' | 'general',
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [addonsData, servicesData] = await Promise.all([
        addonsService.getAllAddons(),
        supabase.from('services').select('id, name').order('name')
      ]);
      
      setAddons(addonsData);
      setServices(servicesData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingAddon(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      duration_minutes: '15',
      category: 'general',
      is_active: true,
      display_order: 0
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (addon: ServiceAddon) => {
    setEditingAddon(addon);
    setFormData({
      name: addon.name,
      description: addon.description || '',
      price: addon.price.toString(),
      duration_minutes: addon.duration_minutes.toString(),
      category: addon.category,
      is_active: addon.is_active,
      display_order: addon.display_order
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const addonData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        duration_minutes: parseInt(formData.duration_minutes),
        category: formData.category,
        is_active: formData.is_active,
        display_order: formData.display_order
      };

      if (editingAddon) {
        await addonsService.updateAddon(editingAddon.id, addonData);
        alert('Add-on updated successfully!');
      } else {
        await addonsService.createAddon(addonData);
        alert('Add-on created successfully!');
      }

      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save add-on:', error);
      alert('Failed to save add-on. Please try again.');
    }
  };

  const handleDelete = async (addonId: string) => {
    if (!confirm('Are you sure you want to delete this add-on? This action cannot be undone.')) {
      return;
    }

    try {
      await addonsService.deleteAddon(addonId);
      alert('Add-on deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Failed to delete add-on:', error);
      alert('Failed to delete add-on. Please try again.');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      hair: 'blue',
      nails: 'pink',
      beauty: 'purple',
      general: 'gray'
    };
    return colors[category] || 'gray';
  };

  const getCategoryEmoji = (category: string) => {
    const emojis = {
      hair: '💇‍♀️',
      nails: '💅',
      beauty: '✨',
      general: '🔧'
    };
    return emojis[category] || '🔧';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-charcoal">Service Add-ons Management</h1>
        <Button onClick={openCreateDialog} className="bg-gold hover:bg-gold/90 text-charcoal">
          <Plus className="w-4 h-4 mr-2" />
          Add New Add-on
        </Button>
      </div>

      {/* Add-ons Grid */}
      {isLoading ? (
        <div className="text-center py-8">Loading add-ons...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addons.map((addon) => (
            <Card key={addon.id} className={`${!addon.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryEmoji(addon.category)}</span>
                    <div>
                      <CardTitle className="text-lg">{addon.name}</CardTitle>
                      <Badge 
                        variant="secondary" 
                        className={`bg-${getCategoryColor(addon.category)}-100 text-${getCategoryColor(addon.category)}-700`}
                      >
                        {addon.category}
                      </Badge>
                    </div>
                  </div>
                  {!addon.is_active && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      Inactive
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {addon.description && (
                  <p className="text-sm text-muted-text">{addon.description}</p>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gold">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-semibold">GHS {addon.price}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-text">
                    <Clock className="w-4 h-4" />
                    <span>{addon.duration_minutes} min</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(addon)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(addon.id)}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {addons.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-text">
            No add-ons found. Create your first add-on to get started.
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAddon ? 'Edit Add-on' : 'Create New Add-on'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Hair Wash & Condition"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of the add-on service..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price (GHS) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({...formData, duration_minutes: e.target.value})}
                  placeholder="15"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value as any})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">💎 General</SelectItem>
                  <SelectItem value="hair">💇‍♀️ Hair Care</SelectItem>
                  <SelectItem value="nails">💅 Nail Care</SelectItem>
                  <SelectItem value="beauty">✨ Beauty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 0})}
                placeholder="0"
              />
              <p className="text-sm text-muted-text mt-1">
                Lower numbers appear first. Use 0 for default ordering.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active">Active (available for booking)</Label>
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
                disabled={!formData.name.trim() || !formData.price}
                className="flex-1 bg-gold hover:bg-gold/90 text-charcoal"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingAddon ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      {addons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add-ons Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-charcoal">{addons.length}</div>
                <div className="text-sm text-muted-text">Total Add-ons</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {addons.filter(addon => addon.is_active).length}
                </div>
                <div className="text-sm text-muted-text">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gold">
                  GHS {addons.reduce((sum, addon) => sum + addon.price, 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-text">Total Value</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(addons.reduce((sum, addon) => sum + addon.duration_minutes, 0) / addons.length) || 0}
                </div>
                <div className="text-sm text-muted-text">Avg Duration (min)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
