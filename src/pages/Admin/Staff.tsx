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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

// Schema for validation
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
  role: z.enum(["staff", "receptionist"]),
});

const Staff = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    specialization: "",
    role: "staff" as "staff" | "receptionist",
    is_active: true,
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
      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member: any) => {
    setEditingMemberId(member.id);
    setFormData({
      full_name: member.full_name,
      phone: member.phone,
      email: member.email || "",
      specialization: member.specialization || "",
      role: member.role || "staff",
      is_active: member.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleDeleteMember = async () => {
    if (!deleteStaffId) return;

    
    try {
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", deleteStaffId);

      if (error) throw error;

      toast.success("Staff deleted successfully");
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete staff");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteStaffId(null);
    }
  };
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    const validated = staffSchema.parse(formData);

    if (editingMemberId) {
      // UPDATE existing staff
      const { error } = await supabase
        .from("staff")
        .update({
          full_name: validated.full_name,
          phone: validated.phone,
          email: validated.email || null,
          specialization: validated.specialization || null,
          is_active: formData.is_active,
        })
        .eq("id", editingMemberId);

      if (error) throw error;

      toast.success("Staff updated!");
    } else {
      // CREATE staff via Supabase first
      const { data: newStaff, error } = await supabase
        .from("staff")
        .insert([
          {
            full_name: validated.full_name,
            phone: validated.phone,
            email: validated.email || null,
            specialization: validated.specialization || null,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success(
        `${validated.role === "receptionist" ? "Receptionist" : "Staff"} added successfully!`
      );

      // Call backend endpoint to send invite email
      if (validated.email) {
        try {
          const response = await fetch("http://localhost:5000/api/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: validated.email,
              full_name: validated.full_name,
              role: validated.role,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Failed to send invite email");
          }

          toast.success("Invite email sent successfully!");
        } catch (inviteError: any) {
          console.error("Invite email error:", inviteError);
          toast.error(inviteError.message || "Failed to send invite email");
        }
      }
    }

    setDialogOpen(false);
    setEditingMemberId(null);
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      specialization: "",
      role: "staff",
      is_active: true,
    });

    fetchStaff();
  } catch (error: any) {
    if (error instanceof z.ZodError) toast.error(error.errors[0].message);
    else toast.error(error.message || "Failed to save staff");
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
      {/* Header and Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage your salon staff</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {editingMemberId ? "Edit Staff" : "Add Staff / Receptionist"}
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMemberId ? "Edit Member" : "Add New Member"}
              </DialogTitle>
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

              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "staff" | "receptionist") =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">
                {editingMemberId ? "Update Member" : "Add Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete staff</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete this staff? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteMember}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff List */}
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
              {/* <p className="text-sm mt-1 font-medium">Role: {member.user_metadata.role}</p> */}
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
                  onClick={() => {
                    setDeleteStaffId(member.id);
                    setDeleteDialogOpen(true);
                  }}
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
                No staff members yet. Add your first staff or receptionist!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Staff;
