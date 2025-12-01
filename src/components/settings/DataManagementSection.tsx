import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

const exportOptions = [
  { id: "bookings", label: "All Bookings", table: "bookings" },
  { id: "attendance", label: "All Attendance", table: "attendance" },
  { id: "payments", label: "All Sales/Payments", table: "payments" },
  { id: "clients", label: "All Clients", table: "clients" },
  { id: "staff", label: "All Staff", table: "staff" },
];

export function DataManagementSection() {
  const exportToExcel = async (tableName: string, fileName: string) => {
    try {
      const { data, error } = await supabase.from(tableName as any).select("*");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info(`No data found in ${fileName}`);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, fileName);
      XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast.success(`${fileName} exported successfully!`);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(`Failed to export ${fileName}`);
    }
  };

  const exportAll = async () => {
    try {
      const workbook = XLSX.utils.book_new();

      for (const option of exportOptions) {
        const { data, error } = await supabase.from(option.table as any).select("*");
        if (!error && data && data.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, option.label);
        }
      }

      XLSX.writeFile(workbook, `salon_data_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("All data exported successfully!");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Data Management</h2>
          <p className="text-sm text-muted-foreground">
            Export your data to Excel for backup or analysis
          </p>
        </div>
        <Button onClick={exportAll} variant="default">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {exportOptions.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            className="justify-start"
            onClick={() => exportToExcel(option.table, option.label)}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {option.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
