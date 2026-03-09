import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // In case you passed the user's email in the URL like:
  // /confirm-email?email=user@example.com
  const email = params.get("email");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-8 text-center space-y-6">
        
        <div className="flex justify-center">
          <MailCheck className="w-16 h-16 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold">Verify Your Email</h1>

        <p className="text-gray-600 text-sm leading-relaxed">
          We’ve sent a verification link to:
        </p>

        <p className="font-medium text-gray-800">
          {email || "your email address"}
        </p>

        <p className="text-gray-500 text-sm">
          Please check your inbox and click on the link to complete your
          registration. If you don’t see the email, check your Spam or Junk
          folder.
        </p>

        <div className="pt-4">
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => navigate("/")}
          >
            Back to Home
          </Button>
        </div>

      </div>
    </div>
  );
}
