// components/PhoneInput.tsx
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const countryCodes = ["+233"];

export default function PhoneInput({
  label = "Phone *",
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Extract current selected code
  // const selectedCode = countryCodes.find((c) => value.startsWith(c)) || "+233";
  const selectedCode = "+233";

  // Extract phone number without code
  const numberOnly = value.replace(selectedCode, "");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="flex gap-2">
        {/* Country Code Dropdown */}
        <select
          className="border rounded-md px-2 text-sm"
          value={selectedCode}
          onChange={(e) => onChange(e.target.value + numberOnly)}
        >
          {countryCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        {/* Phone Input */}
        <Input
          type="tel"
          placeholder="Phone number"
          value={numberOnly}
          onChange={(e) => onChange(selectedCode + e.target.value)}
          required
        />
      </div>
    </div>
  );
}
