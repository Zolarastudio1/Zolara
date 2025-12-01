import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCog, User } from "lucide-react";

const permissionLevels = [
  {
    role: "owner",
    label: "Admin / Owner",
    description: "Full access to all features, settings, and data management",
    icon: Shield,
    color: "bg-red-500/10 text-red-600 border-red-200",
  },
  {
    role: "receptionist",
    label: "Receptionist",
    description: "Can manage bookings, services, clients, attendance, view general dashboard",
    icon: UserCog,
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  {
    role: "staff",
    label: "Staff",
    description: "Can view assigned bookings and only check out own attendance",
    icon: User,
    color: "bg-green-500/10 text-green-600 border-green-200",
  },
];

export function PermissionLevelsSection() {
  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Staff Permission Levels</h2>
      <p className="text-sm text-muted-foreground">
        These are the system-defined permission levels for staff members.
      </p>

      <div className="space-y-3">
        {permissionLevels.map((level) => (
          <div
            key={level.role}
            className={`flex items-start gap-3 p-4 rounded-md border ${level.color}`}
          >
            <level.icon className="w-5 h-5 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{level.label}</span>
                <Badge variant="outline" className="text-xs">
                  {level.role}
                </Badge>
              </div>
              <p className="text-sm opacity-80 mt-1">{level.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
