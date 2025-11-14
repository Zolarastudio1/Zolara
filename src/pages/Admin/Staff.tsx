import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

const staffSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name too long"),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format"),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email too long")
    .optional()
    .or(z.literal("")),
  specialization: z.string().max(100, "Specialization too long").optional(),
});

const Staff = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    specialization: "",
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("full_name");

      console.log("Staff data", data);
      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const handleEditMember = (member) => {
    setEditingMemberId(member.id);
    setFormData({
      full_name: member.full_name,
      phone: member.phone,
      email: member.email || "",
      specialization: member.specialization || "",
      is_active: member.is_active,
    });
    setDialogOpen(true);
  };

  // Save update
  const handleUpdateMember = async () => {
    const { error } = await supabase
      .from("staff")
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email,
        specialization: formData.specialization,
        is_active: formData.is_active,
      })
      .eq("id", editingMemberId);

    if (error) {
      toast.error("Update failed.");
      return;
    }

    toast.success("Staff updated!");
    setDialogOpen(false);
    fetchStaff();
  };

  // Delete member
  const handleDeleteMember = async (id) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    const { error } = await supabase.from("staff").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete staff.");
      return;
    }

    toast.success("Staff deleted!");
    fetchStaff();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = staffSchema.parse(formData);

      const insertData = {
        full_name: validated.full_name,
        phone: validated.phone,
        ...(validated.email && { email: validated.email }),
        ...(validated.specialization && {
          specialization: validated.specialization,
        }),
      };

      const { error } = await supabase.from("staff").insert([insertData]);

      if (error) throw error;

      toast.success("Staff member added successfully");
      setDialogOpen(false);
      setFormData({ full_name: "", phone: "", email: "", specialization: "" });
      fetchStaff();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to add staff");
      }
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage your salon staff</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Jane Smith"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  type="tel"
                  placeholder="+233..."
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="staff@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Input
                  placeholder="Hair Stylist, Nail Technician, etc."
                  value={formData.specialization}
                  onChange={(e) =>
                    setFormData({ ...formData, specialization: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                Add Staff Member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <Card
            key={member.id}
            className="hover:shadow-xl transition-shadow rounded-2xl border border-gray-200"
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-semibold">
                  {member.full_name}
                </CardTitle>

                <Badge variant={member.is_active ? "default" : "secondary"}>
                  {member.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>

              {member.specialization && (
                <p className="text-sm text-gray-500 mt-1">
                  {member.specialization}
                </p>
              )}
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{member.phone}</span>
              </div>

              {member.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{member.email}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => handleEditMember(member)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-red-500 border-red-300"
                  onClick={() => handleDeleteMember(member.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {staff.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No staff members yet. Add your first staff member!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Staff;
