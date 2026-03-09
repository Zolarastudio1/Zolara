import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/AvatarUpload";

interface BusinessInfoProps {
  businessName: string;
  logoUrl: string;
  logoFile: File | null;
  phone: string;
  email: string;
  address: string;
  onBusinessNameChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onLogoFileChange: (file: File) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

export function BusinessInfoSection({
  businessName,
  logoUrl,
  logoFile,
  phone,
  email,
  address,
  onBusinessNameChange,
  onLogoUrlChange,
  onLogoFileChange,
  onPhoneChange,
  onEmailChange,
  onAddressChange,
}: BusinessInfoProps) {
  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Business Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="business_name">Business Name</Label>
            <Input
              id="business_name"
              value={businessName}
              onChange={(e) => onBusinessNameChange(e.target.value)}
              placeholder="Enter business name"
            />
          </div>

          <div>
            <Label>Logo</Label>
            <div className="flex items-center justify-center gap-4 mt-2">
              <AvatarUpload
                image={logoFile || logoUrl || null}
                onChange={onLogoFileChange}
              />
              {/* <div className="flex-1">
                <Label htmlFor="logo_url" className="text-xs text-muted-foreground">Or enter URL</Label>
                <Input
                  id="logo_url"
                  value={logoUrl}
                  onChange={(e) => onLogoUrlChange(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div> */}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="business_phone">Business Phone</Label>
            <Input
              id="business_phone"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+233 XX XXX XXXX"
            />
          </div>

          <div>
            <Label htmlFor="business_email">Business Email</Label>
            <Input
              id="business_email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="contact@business.com"
            />
          </div>

          <div>
            <Label htmlFor="business_address">Business Address</Label>
            <Input
              id="business_address"
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="123 Main Street, City"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
