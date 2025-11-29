import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock, Trash, Move } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { z } from "zod";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(50),
  price: z.number().positive().max(1000000),
  duration_minutes: z.number().int().positive().max(1440),
  description: z.string().max(500).optional().or(z.literal("")),
  order: z.number().int().optional(),
});

const Services = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    duration_minutes: "",
    description: "",
  });

  const [reorderServices, setReorderServices] = useState<any[]>([]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("category")
        .order("order", { ascending: true });
      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to fetch services");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = serviceSchema.parse({
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        duration_minutes: parseInt(formData.duration_minutes),
        description: formData.description,
      });

      if (editingServiceId) {
        const { error } = await supabase
          .from("services")
          .update(validated)
          .eq("id", editingServiceId);
        if (error) throw error;
        toast.success("Service updated successfully");
      } else {
        //@ts-ignore
        const { error } = await supabase.from("services").insert([validated]);
        if (error) throw error;
        toast.success("Service added successfully");
      }

      setDialogOpen(false);
      setEditingServiceId(null);
      setFormData({
        name: "",
        category: "",
        price: "",
        duration_minutes: "",
        description: "",
      });
      fetchServices();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to save service");
      }
    }
  };

  const handleDeleteService = async () => {
    if (!deleteServiceId) return;
    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", deleteServiceId);
      if (error) throw error;
      toast.success("Service deleted successfully");
      fetchServices();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete service");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteServiceId(null);
    }
  };

  const groupedServices = services.reduce((acc: any, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {});

  // ========================
  // REORDER FUNCTIONS
  // ========================
  const openReorder = () => {
    const ordered = [...services].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );
    setReorderServices(ordered);
    setReorderOpen(true);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(reorderServices);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setReorderServices(items);
  };

  const saveReorder = async () => {
    try {
      const updates = reorderServices.map((item, index) => ({
        id: item.id,
        order: index,
      }));
      for (const u of updates) {
        const { error } = await supabase
          .from("services")
          //@ts-ignore
          .update({ order: u.order })
          .eq("id", u.id);
        if (error) throw error;
      }
      toast.success("Services reordered successfully");
      setReorderOpen(false);
      fetchServices();
    } catch (error: any) {
      toast.error(error.message || "Failed to reorder");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage your salon services</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-end w-full mb-4">
          {/* Reorder Services Button */}
          <Button className="flex-1 sm:flex-none" onClick={openReorder}>
            <Move className="w-4 h-4 mr-2" />
            Reorder Services
          </Button>

          {/* Add Service Button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {!editingServiceId ? "Add New Service" : "Update Service"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input
                    placeholder="Haircut & Styling"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Input
                    placeholder="Hair, Nails, Spa, etc."
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (GH₵) *</Label>
                    <Input
                      type="number"
                      placeholder="5000"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min) *</Label>
                    <Input
                      type="number"
                      placeholder="60"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Service description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <Button type="submit" className="w-full">
                  {!editingServiceId ? "Add Service" : "Update Service"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Service</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete this service? This action cannot
                be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteService}>
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {Object.entries(groupedServices).map(
        ([category, categoryServices]: [string, any]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-semibold">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryServices.map((service: any) => (
                <Card
                  key={service.id}
                  className="hover:shadow-lg transition-shadow rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <CardHeader className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold">
                        {service.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {/* Active / Inactive Toggle */}
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={service.is_active}
                            onCheckedChange={async (checked) => {
                              try {
                                const { error } = await supabase
                                  .from("services")
                                  .update({ is_active: checked })
                                  .eq("id", service.id);

                                if (error) throw error;

                                // Update local state immediately
                                setServices((prev) =>
                                  prev.map((s) =>
                                    s.id === service.id
                                      ? { ...s, is_active: checked }
                                      : s
                                  )
                                );
                              } catch (err: any) {
                                console.error(err);
                                toast.error("Failed to update service status");
                              }
                            }}
                          />
                          <span className="text-sm">
                            {service.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {/* Edit Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFormData({
                              name: service.name,
                              category: service.category,
                              price: service.price.toString(),
                              duration_minutes:
                                service.duration_minutes.toString(),
                              description: service.description || "",
                            });
                            setEditingServiceId(service.id);
                            setDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>

                        {/* Delete Button */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDeleteServiceId(service.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-2xl font-bold text-primary">
                      GH₵{service.price.toLocaleString()}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration_minutes} minutes</span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      )}

      {services.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">
              No services yet. Add your first service!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Service Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete this service? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteService}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reorder Modal */}
      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder Services</DialogTitle>
          </DialogHeader>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="services">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2 max-h-96 overflow-y-auto"
                >
                  {reorderServices.map((service, index) => (
                    <Draggable
                      key={service.id}
                      draggableId={service.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="p-2 border rounded bg-white flex justify-between items-center"
                        >
                          <span>
                            {service.name} ({service.category})
                          </span>
                          <span className="text-sm text-muted-foreground">
                            GH₵{service.price.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setReorderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveReorder}>Save Order</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
