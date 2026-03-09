import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Save, X, User, Calendar, Star, Heart, AlertTriangle, Lock, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { supabase } from '../../integrations/supabase/client';

interface ClientNote {
  id: string;
  client_id: string;
  staff_id?: string;
  booking_id?: string;
  note_type: 'general' | 'medical' | 'preference' | 'behavior' | 'allergy';
  content: string;
  is_private: boolean;
  is_important: boolean;
  created_at: string;
  updated_at: string;
  profiles?: any;
}

interface ClientHistory {
  id: string;
  client_id: string;
  service_id: string;
  last_visit_date?: string;
  total_visits: number;
  total_spent: number;
  preferred_staff_id?: string;
  average_rating?: number;
  last_rating?: number;
  updated_at: string;
  services?: any;
  preferred_staff?: any;
}

export const ClientNotesAndHistory: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientHistory, setClientHistory] = useState<ClientHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);
  const [activeTab, setActiveTab] = useState('notes');

  const [noteFormData, setNoteFormData] = useState({
    note_type: 'general' as any,
    content: '',
    is_private: false,
    is_important: false,
    booking_id: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadClientData();
    }
  }, [selectedClient]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadClientData = async () => {
    if (!selectedClient) return;

    setIsLoading(true);
    try {
      // Load client notes
      const { data: notesData, error: notesError } = await supabase
        .from('client_notes')
        .select(`
          *,
          profiles!client_notes_staff_id_fkey(full_name)
        `)
        .eq('client_id', selectedClient.id)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;
      setClientNotes(notesData || []);

      // Load client service history
      const { data: historyData, error: historyError } = await supabase
        .from('client_service_history')
        .select(`
          *,
          services(name),
          preferred_staff:profiles!client_service_history_preferred_staff_id_fkey(full_name)
        `)
        .eq('client_id', selectedClient.id)
        .order('last_visit_date', { ascending: false });

      if (historyError) throw historyError;
      setClientHistory(historyData || []);

    } catch (error) {
      console.error('Failed to load client data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openNoteDialog = (note?: ClientNote) => {
    if (note) {
      setEditingNote(note);
      setNoteFormData({
        note_type: note.note_type,
        content: note.content,
        is_private: note.is_private,
        is_important: note.is_important,
        booking_id: note.booking_id || ''
      });
    } else {
      setEditingNote(null);
      setNoteFormData({
        note_type: 'general',
        content: '',
        is_private: false,
        is_important: false,
        booking_id: ''
      });
    }
    setIsNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!selectedClient || !noteFormData.content.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const noteData = {
        client_id: selectedClient.id,
        staff_id: user?.id,
        booking_id: noteFormData.booking_id || null,
        note_type: noteFormData.note_type,
        content: noteFormData.content.trim(),
        is_private: noteFormData.is_private,
        is_important: noteFormData.is_important
      };

      if (editingNote) {
        const { error } = await supabase
          .from('client_notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;
        alert('Note updated successfully!');
      } else {
        const { error } = await supabase
          .from('client_notes')
          .insert([noteData]);

        if (error) throw error;
        alert('Note added successfully!');
      }

      setIsNoteDialogOpen(false);
      loadClientData();
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      
      alert('Note deleted successfully!');
      loadClientData();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  const getNoteTypeIcon = (type: string) => {
    const icons = {
      general: FileText,
      medical: Heart,
      preference: Star,
      behavior: User,
      allergy: AlertTriangle
    };
    const IconComponent = icons[type] || FileText;
    return <IconComponent className="w-4 h-4" />;
  };

  const getNoteTypeColor = (type: string) => {
    const colors = {
      general: 'blue',
      medical: 'red',
      preference: 'purple',
      behavior: 'green',
      allergy: 'orange'
    };
    return colors[type] || 'blue';
  };

  const filteredClients = clients.filter(client => 
    client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm)
  );

  const calculateClientLTV = (history: ClientHistory[]) => {
    return history.reduce((sum, service) => sum + service.total_spent, 0);
  };

  const getLastVisit = (history: ClientHistory[]) => {
    const lastVisit = history.reduce((latest, service) => {
      if (!latest || !service.last_visit_date) return latest;
      if (!latest.last_visit_date) return service;
      return new Date(service.last_visit_date) > new Date(latest.last_visit_date) ? service : latest;
    }, null as ClientHistory | null);
    
    return lastVisit?.last_visit_date ? new Date(lastVisit.last_visit_date) : null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen max-h-screen">
      {/* Clients List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Card className="h-[calc(100vh-8rem)] overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Clients ({filteredClients.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-y-auto h-full">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`p-4 border-b cursor-pointer hover:bg-warm-bg transition-colors ${
                    selectedClient?.id === client.id ? 'bg-gold bg-opacity-10 border-gold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={client.avatar_url} />
                      <AvatarFallback>
                        {client.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {client.full_name || 'Unknown Client'}
                      </h3>
                      <p className="text-xs text-muted-text truncate">
                        {client.email || client.phone || 'No contact info'}
                      </p>
                      {client.birthday && (
                        <p className="text-xs text-muted-text">
                          🎂 {new Date(client.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Details */}
      <div className="lg:col-span-2">
        {selectedClient ? (
          <Card className="h-[calc(100vh-2rem)] flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedClient.avatar_url} />
                    <AvatarFallback className="text-xl">
                      {selectedClient.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{selectedClient.full_name || 'Unknown Client'}</h2>
                    <div className="space-y-1 text-sm text-muted-text">
                      {selectedClient.email && <div>📧 {selectedClient.email}</div>}
                      {selectedClient.phone && <div>📞 {selectedClient.phone}</div>}
                      {selectedClient.birthday && (
                        <div>🎂 {new Date(selectedClient.birthday).toLocaleDateString()}</div>
                      )}
                      {selectedClient.anniversary && (
                        <div>💕 {new Date(selectedClient.anniversary).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => openNoteDialog()}
                  className="bg-gold hover:bg-gold/90 text-charcoal"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="notes">Notes ({clientNotes.length})</TabsTrigger>
                  <TabsTrigger value="history">Service History ({clientHistory.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className="flex-1 overflow-hidden mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div>Loading notes...</div>
                    </div>
                  ) : clientNotes.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-text">
                      No notes found for this client.
                    </div>
                  ) : (
                    <div className="space-y-3 overflow-y-auto h-full pr-2">
                      {clientNotes.map((note) => (
                        <Card key={note.id} className={note.is_important ? 'border-orange-200 bg-orange-50' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getNoteTypeIcon(note.note_type)}
                                <Badge className={`bg-${getNoteTypeColor(note.note_type)}-100 text-${getNoteTypeColor(note.note_type)}-700`}>
                                  {note.note_type}
                                </Badge>
                                {note.is_private && (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Private
                                  </Badge>
                                )}
                                {note.is_important && (
                                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                    Important
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openNoteDialog(note)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <p className="text-sm mb-3 whitespace-pre-wrap">{note.content}</p>
                            
                            <div className="text-xs text-muted-text flex items-center justify-between">
                              <span>
                                By {note.profiles?.full_name || 'Unknown Staff'}
                              </span>
                              <span>
                                {new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="flex-1 overflow-hidden mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div>Loading service history...</div>
                    </div>
                  ) : clientHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-text">
                      No service history found for this client.
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-y-auto h-full pr-2">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <Card>
                          <CardContent className="p-3 text-center">
                            <div className="text-lg font-bold text-charcoal">
                              {clientHistory.reduce((sum, service) => sum + service.total_visits, 0)}
                            </div>
                            <div className="text-xs text-muted-text">Total Visits</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 text-center">
                            <div className="text-lg font-bold text-gold">
                              GHS {calculateClientLTV(clientHistory).toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-text">Total Spent</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3 text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {getLastVisit(clientHistory)?.toLocaleDateString() || 'Never'}
                            </div>
                            <div className="text-xs text-muted-text">Last Visit</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Service Details */}
                      {clientHistory.map((service) => (
                        <Card key={service.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-medium">{service.services?.name || 'Unknown Service'}</h3>
                              {service.average_rating && (
                                <div className="flex items-center gap-1 text-yellow-500">
                                  <Star className="w-4 h-4 fill-current" />
                                  <span className="text-sm font-medium">{service.average_rating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-text">
                              <div>
                                <span className="font-medium">Total Visits:</span> {service.total_visits}
                              </div>
                              <div>
                                <span className="font-medium">Total Spent:</span> GHS {service.total_spent.toFixed(2)}
                              </div>
                              {service.last_visit_date && (
                                <div>
                                  <span className="font-medium">Last Visit:</span> {new Date(service.last_visit_date).toLocaleDateString()}
                                </div>
                              )}
                              {service.preferred_staff && (
                                <div>
                                  <span className="font-medium">Preferred Staff:</span> {service.preferred_staff.full_name}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-[calc(100vh-2rem)] flex items-center justify-center">
            <CardContent className="text-center text-muted-text">
              <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-medium mb-2">Select a Client</h2>
              <p>Choose a client from the list to view their notes and service history.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Note' : 'Add New Note'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="note_type">Note Type</Label>
              <Select 
                value={noteFormData.note_type} 
                onValueChange={(value) => setNoteFormData({...noteFormData, note_type: value as any})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">📝 General</SelectItem>
                  <SelectItem value="medical">❤️ Medical</SelectItem>
                  <SelectItem value="preference">⭐ Preference</SelectItem>
                  <SelectItem value="behavior">👤 Behavior</SelectItem>
                  <SelectItem value="allergy">⚠️ Allergy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="content">Note Content</Label>
              <Textarea
                id="content"
                value={noteFormData.content}
                onChange={(e) => setNoteFormData({...noteFormData, content: e.target.value})}
                placeholder="Enter your note here..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_important"
                  checked={noteFormData.is_important}
                  onCheckedChange={(checked) => setNoteFormData({...noteFormData, is_important: checked})}
                />
                <Label htmlFor="is_important">Mark as important</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_private"
                  checked={noteFormData.is_private}
                  onCheckedChange={(checked) => setNoteFormData({...noteFormData, is_private: checked})}
                />
                <Label htmlFor="is_private">Private note (only visible to you)</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsNoteDialogOpen(false)}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveNote}
                disabled={!noteFormData.content.trim()}
                className="flex-1 bg-gold hover:bg-gold/90 text-charcoal"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingNote ? 'Update' : 'Add Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
