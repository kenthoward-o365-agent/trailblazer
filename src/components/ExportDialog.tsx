import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { ExportColumn, ExportFilter, exportToCSV, exportToExcel, exportToPDF, generateFilename } from "@/lib/exportUtils";
import { toast } from "sonner";
import { MfaGuard } from "@/components/security/MfaGuard";

export type ExportFormat = 'csv' | 'excel' | 'pdf';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  filenameBase: string;
  data: Record<string, any>[];
  columns: ExportColumn[];
  filters?: ExportFilter[];
  onApplyFilters?: (filters: Record<string, string>) => Record<string, any>[];
}

export const ExportDialog = ({
  open,
  onOpenChange,
  title,
  description,
  filenameBase,
  data,
  columns,
  filters = [],
  onApplyFilters,
}: ExportDialogProps) => {
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.map(c => c.key)
  );
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Get filtered data based on current filter values
  const filteredData = useMemo(() => {
    if (onApplyFilters) {
      return onApplyFilters(filterValues);
    }
    return data;
  }, [data, filterValues, onApplyFilters]);

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(k => k !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const handleSelectAllColumns = () => {
    if (selectedColumns.length === columns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columns.map(c => c.key));
    }
  };

  const handleExport = async () => {
    const exportColumns = columns.filter(c => selectedColumns.includes(c.key));
    
    if (exportColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    const filename = generateFilename(filenameBase);

    try {
      switch (format) {
        case 'csv':
          exportToCSV(filteredData, exportColumns, filename);
          break;
        case 'excel':
          await exportToExcel(filteredData, exportColumns, filename);
          break;
        case 'pdf':
          exportToPDF(filteredData, exportColumns, filename, title);
          break;
      }
      
      toast.success(`Exported ${filteredData.length} records to ${format.toUpperCase()}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export data");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <MfaGuard resourceLabel="data exports">
        <div className="space-y-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-1.5 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  CSV
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-1.5 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-1.5 cursor-pointer">
                  <FileType className="h-4 w-4" />
                  PDF
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Filters */}
          {filters.length > 0 && (
            <div className="space-y-2">
              <Label>Filters</Label>
              <div className="grid grid-cols-2 gap-2">
                {filters.map(filter => (
                  <div key={filter.key}>
                    <Label className="text-xs text-muted-foreground">{filter.label}</Label>
                    {filter.type === 'select' && filter.options && (
                      <Select
                        value={filterValues[filter.key] || 'all'}
                        onValueChange={(value) => 
                          setFilterValues(prev => ({ ...prev, [filter.key]: value }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filter.options.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Columns ({selectedColumns.length} of {columns.length})</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={handleSelectAllColumns}
              >
                {selectedColumns.length === columns.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-2 border rounded-md">
              {columns.map(column => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.key}
                    checked={selectedColumns.includes(column.key)}
                    onCheckedChange={() => handleColumnToggle(column.key)}
                  />
                  <Label 
                    htmlFor={column.key} 
                    className="text-xs cursor-pointer"
                  >
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Count */}
          <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md text-center">
            {filteredData.length} records will be exported
          </div>
        </div>
        </MfaGuard>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
