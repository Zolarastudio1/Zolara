import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden">
      {/* Subtle gradient circles */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-[hsl(var(--primary)/0.2)] rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-[hsl(var(--accent)/0.2)] rounded-full blur-3xl animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center backdrop-blur-xl bg-[hsl(var(--card)/0.1)] border border-[hsl(var(--border)/0.1)] rounded-3xl p-10 shadow-2xl max-w-md mx-auto"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-8 h-8 text-[hsl(var(--primary-foreground))]" />
          </div>
        </div>
        <h1 className="text-7xl font-extrabold bg-[linear-gradient(to_right,hsl(var(--primary)),hsl(var(--accent)))] bg-clip-text text-transparent mb-3">
          404
        </h1>
        <p className="text-lg text-[hsl(var(--secondary-foreground)/0.8)] mb-6">
          Oops! The page you’re looking for doesn’t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="border-[hsl(var(--border))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Go Back
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            Return Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
