import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

interface MonthDayPickerProps {
  value: string | null; // Format: "MM-DD" or null
  onChange: (value: string | null) => void;
  label?: string;
  className?: string;
}

export const MonthDayPicker = ({ value, onChange, label, className }: MonthDayPickerProps) => {
  const month = value?.split("-")[0] || "";
  const day = value?.split("-")[1] || "";

  const handleMonthChange = (newMonth: string) => {
    if (newMonth === "clear") {
      onChange(null);
      return;
    }
    if (day) {
      onChange(`${newMonth}-${day}`);
    } else {
      onChange(`${newMonth}-01`);
    }
  };

  const handleDayChange = (newDay: string) => {
    if (newDay === "clear") {
      onChange(null);
      return;
    }
    if (month) {
      onChange(`${month}-${newDay}`);
    } else {
      onChange(`01-${newDay}`);
    }
  };

  return (
    <div className={className}>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-2">
        <Select value={month} onValueChange={handleMonthChange}>
          <SelectTrigger className="h-9 w-[110px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clear" className="text-muted-foreground">Clear</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={day} onValueChange={handleDayChange}>
          <SelectTrigger className="h-9 w-[70px]">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clear" className="text-muted-foreground">Clear</SelectItem>
            {DAYS.map((d) => (
              <SelectItem key={d} value={d}>
                {parseInt(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

// Utility to format MM-DD to display string like "December 25"
export const formatMonthDay = (value: string | null): string => {
  if (!value) return "";
  const [month, day] = value.split("-");
  const monthName = MONTHS.find((m) => m.value === month)?.label || "";
  return `${monthName} ${parseInt(day)}`;
};
