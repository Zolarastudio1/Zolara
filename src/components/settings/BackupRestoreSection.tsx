import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle } from "lucide-react";

interface BackupRestoreProps {
  settings: any;
  onRestore: (settings: any) => void;
}

export function BackupRestoreSection({
  settings,
  onRestore,
}: BackupRestoreProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportSettings = () => {
    try {
      const backup = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        settings: settings,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settings_backup_${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Settings backup downloaded!");
    } catch (error) {
      console.error("Backup error:", error);
      toast.error("Failed to create backup");
    }
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);

        if (!backup.settings || !backup.version) {
          throw new Error("Invalid backup file format");
        }

        onRestore(backup.settings);
        toast.success("Settings restored! Click 'Save Settings' to apply.");
      } catch (error) {
        console.error("Restore error:", error);
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Backup & Restore</h2>
      <p className="text-sm text-muted-foreground">
        Save your settings configuration to a JSON file or restore from a
        previous backup.
      </p>

      <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-200 text-amber-700">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">
          Restoring settings will overwrite your current configuration. Make
          sure to save a backup first.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={exportSettings} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download Backup
        </Button>

        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Restore from Backup
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={importSettings}
          className="hidden"
        />
      </div>
    </Card>
  );
}
