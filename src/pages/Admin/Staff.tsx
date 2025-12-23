import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
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
import PhoneInput from "@/lib/phoneInput";
import { AvatarUpload } from "@/components/AvatarUpload";

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
  emergency_contact: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, "Invalid emergency contact format")
    .optional()
    .or(z.literal("")),
  role: z.enum(["staff", "receptionist"]),
  image: z.union([z.instanceof(File), z.null()]).optional(),
});

const Staff = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    specialization: "",
    role: "staff" as "staff" | "receptionist",
    is_active: true,
    image: null as File | string | null,
    emergency_contact: "",
  });
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [staffBookings, setStaffBookings] = useState<any[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [staffRatings, setStaffRatings] = useState<Record<string, number | null>>({});

  const SPECIALIZATIONS = [
    "Hair Stylist",
    "Nail Technician",
    "Therapist",
    "Barber",
    "Makeup Artist",
    "Receptionist",
    "Manager",
  ];

  useEffect(() => {
    fetchStaff();
    fetchUserRole();
  }, []);

  /** Fetch Logged-in User Role */
  const fetchUserRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const metaDataRole = user.user_metadata.role;

      setUserRole(roleData?.role || metaDataRole);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to fetch user role");
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("full_name");
      if (error) throw error;
      setStaff(data || []);
      // Staff ratings feature disabled - rating column doesn't exist on bookings table
      setStaffRatings({});
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
      image: member.image || null,
      emergency_contact: member.emergency_contact || "",
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

  // Fetch staff-related profile data (bookings and attendance)
  const fetchStaffProfile = async (staffId: string) => {
    setProfileLoading(true);
    try {
      const [bookingsRes, attendanceRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, clients(*), services(*)")
          .eq("staff_id", staffId)
          .order("appointment_date", { ascending: false }),
        supabase
          .from("attendance")
          .select("*")
          .eq("staff_id", staffId)
          .order("check_in", { ascending: false }),
      ]);

      if ((bookingsRes as any).error) throw (bookingsRes as any).error;
      if ((attendanceRes as any).error) throw (attendanceRes as any).error;

      setStaffBookings((bookingsRes as any).data || []);
      setStaffAttendance((attendanceRes as any).data || []);
    } catch (err: any) {
      console.error("Error fetching staff profile:", err);
      toast.error("Failed to load staff profile data");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = staffSchema.parse(formData);

      const staffData: any = {
        full_name: validated.full_name,
        phone: validated.phone,
        ...(validated.email && { email: validated.email }),
        ...(validated.specialization && {
          specialization: validated.specialization,
        }),
        ...(validated.emergency_contact && {
          emergency_contact: validated.emergency_contact,
        }),
        role: validated.role,
        is_active: formData.is_active,
      };

      // Upload image if selected
      if (validated.image) {
        setUploading(true);
        const fileExtension = validated.image.name.split(".").pop();
        const uniqueId = editingMemberId || Date.now();
        const fileName = `staff-${uniqueId}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, validated.image, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        staffData.image = urlData.publicUrl;
        setUploading(false);
      }

      if (editingMemberId) {
        const { error } = await supabase
          .from("staff")
          .update(staffData)
          .eq("id", editingMemberId);

        if (error) throw error;
        toast.success("Staff updated successfully");
      } else {
         // Invoke the generic invite Edge Function
        const { data, error } = await supabase.functions.invoke("invite-user", {
          method: "POST",
          body: JSON.stringify(staffData),
        });

        if (error) {
          console.error("Edge function error:", error);
        } else {
          console.log("User created:", data);
          toast.success("Staff added successfully");
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
        image: null,
        emergency_contact: "",
      });

      fetchStaff();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to save staff");
      }
      setUploading(false);
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
              Add Staff / Receptionist
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMemberId ? "Edit Member" : "Add New Member"}
              </DialogTitle>
            </DialogHeader>
            <AvatarUpload
              image={formData.image}
              onChange={(file) => setFormData({ ...formData, image: file })}
            />

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
                {selectedStaff && staffRatings[selectedStaff.id] !== undefined && (
                  <p className="text-sm mt-1">
                    Avg rating: {staffRatings[selectedStaff.id] !== null ? Number(staffRatings[selectedStaff.id]).toFixed(2) : "N/A"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <PhoneInput
                  value={formData.phone}
                  onChange={(v) => setFormData({ ...formData, phone: v })}
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
                <Select
                  value={formData.specialization}
                  onValueChange={(v) =>
                    setFormData({ ...formData, specialization: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Emergency Contact</Label>
                <Input
                  placeholder="+233XXXXXXXXX"
                  value={formData.emergency_contact}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergency_contact: e.target.value,
                    })
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
                {uploading
                  ? "Loading"
                  : !editingMemberId
                  ? "Add Member"
                  : "Update Member"}{" "}
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
              Are you sure you want to delete this staff? This action cannot be
              undone.
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
            onClick={() => {
              setSelectedStaff(member);
              setProfileOpen(true);
              fetchStaffProfile(member.id);
            }}
            className="cursor-pointer hover:shadow-xl transition-shadow rounded-2xl border border-gray-200"
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {/* Staff Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                        {member.full_name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </div>
                    )}
                  </div>

                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {member.full_name}
                    </CardTitle>
                    {member.specialization && (
                      <p className="text-sm text-gray-500 mt-1">
                        {member.specialization}
                      </p>
                    )}
                    {staffRatings[member.id] !== undefined && (
                      <p className="text-sm text-gray-500 mt-1">
                        Avg rating: {staffRatings[member.id] !== null ? Number(staffRatings[member.id]).toFixed(2) : "N/A"}
                      </p>
                    )}
                  </div>
                </div>

                <Badge variant={member.is_active ? "default" : "secondary"}>
                  {member.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditMember(member);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                {userRole === "owner" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-red-500 border-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteStaffId(member.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
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

      {/* Staff Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedStaff ? selectedStaff.full_name : "Staff Profile"}
            </DialogTitle>
          </DialogHeader>

          {profileLoading ? (
            <div className="p-6">Loading...</div>
          ) : selectedStaff ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-2">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-2xl font-semibold text-white bg-gradient-to-br from-green-500 to-teal-500">
                    {selectedStaff.image ? (
                      <img
                        src={selectedStaff.image}
                        alt={selectedStaff.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (selectedStaff.full_name || "")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold">
                      {selectedStaff.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedStaff.role}
                    </p>
                    <p className="text-sm">{selectedStaff.email}</p>
                    <p className="text-sm">{selectedStaff.phone}</p>
                    <p className="text-sm">
                      Emergency: {selectedStaff.emergency_contact || "N/A"}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-600">
                    Specialization
                  </h4>
                  <p className="mt-1 text-sm">
                    {selectedStaff.specialization || "N/A"}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-600">Notes</h4>
                  <p className="mt-1 text-sm">
                    {selectedStaff.notes || "No notes"}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2">
                <h4 className="text-lg font-semibold mb-3">Booking History</h4>
                <div className="space-y-3 max-h-56 overflow-auto">
                  {staffBookings.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No bookings
                    </div>
                  ) : (
                    staffBookings.map((b: any) => (
                      <div
                        key={b.id}
                        className="flex justify-between items-center p-3 rounded-lg border bg-white/50 dark:bg-gray-900/40"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {b.services?.name || "Service"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {b.clients?.full_name || "Client"} •{" "}
                            {b.appointment_date
                              ? format(new Date(b.appointment_date), "PPP")
                              : "Date N/A"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{b.status || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            GH₵{Number(b.services?.price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-500">Services Completed</p>
                    <p className="text-lg font-semibold mt-1">
                      {
                        staffBookings.filter(
                          (b: any) => b.status === "completed"
                        ).length
                      }
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-500">Total Earned</p>
                    <p className="text-lg font-semibold mt-1">
                      GH₵
                      {staffBookings
                        .filter((b: any) => b.status === "completed")
                        .reduce(
                          (s: number, b: any) =>
                            s + Number(b.services?.price || 0),
                          0
                        )
                        .toFixed(2)}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-500">
                      Monthly Hours (this month)
                    </p>
                    <p className="text-lg font-semibold mt-1">
                      {(() => {
                        const now = new Date();
                        const m = now.getMonth();
                        const y = now.getFullYear();
                        const hours = staffAttendance.reduce(
                          (sum: number, rec: any) => {
                            if (!rec.check_in || !rec.check_out) return sum;
                            const ci = new Date(rec.check_in);
                            const co = new Date(rec.check_out);
                            if (ci.getMonth() === m && ci.getFullYear() === y) {
                              return (
                                sum +
                                (co.getTime() - ci.getTime()) / (1000 * 60 * 60)
                              );
                            }
                            return sum;
                          },
                          0
                        );
                        return `${hours.toFixed(1)} h`;
                      })()}
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-500">Attendance Records</p>
                    <p className="text-lg font-semibold mt-1">
                      {staffAttendance.length}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-lg font-semibold mb-2">
                    Performance Summary
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Completed bookings:{" "}
                    {
                      staffBookings.filter((b: any) => b.status === "completed")
                        .length
                    }{" "}
                    • Avg revenue per completed: GH₵
                    {(
                      staffBookings
                        .filter((b: any) => b.status === "completed")
                        .reduce(
                          (s: number, b: any) =>
                            s + Number(b.services?.price || 0),
                          0
                        ) /
                      Math.max(
                        1,
                        staffBookings.filter(
                          (b: any) => b.status === "completed"
                        ).length
                      )
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Staff;
