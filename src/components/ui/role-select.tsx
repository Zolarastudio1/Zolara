import { useState } from "react";
import { ChevronDown } from "lucide-react";

const RoleSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const roles = ["client", "staff", "receptionist"];

  return (
    <div className="relative w-full">
      <button
        type="button"
        className="w-full border rounded px-3 py-2 bg-white flex justify-between items-center hover:bg-[#fdfcfb] focus:bg-[#fdfcfb]"
        onClick={() => setOpen(!open)}
      >
        {value.charAt(0).toUpperCase() + value.slice(1)}
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute mt-1 w-full border rounded bg-white shadow-lg z-10">
          {roles.map((role) => (
            <div
              key={role}
              className="px-3 py-2 hover:bg-[#fdfcfb] cursor-pointer"
              onClick={() => {
                onChange(role);
                setOpen(false);
              }}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleSelect;
