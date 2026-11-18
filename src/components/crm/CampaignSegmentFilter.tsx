import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface SegmentFilters {
  min_nights?: number;
  max_nights?: number;
  min_revenue?: number;
  max_revenue?: number;
  city?: string;
  state?: string;
  source_of_business_id?: string;
  birthday_month?: number;
  anniversary_month?: number;
}

interface SourceOfBusiness {
  id: string;
  code: string;
  definition: string;
}

interface CampaignSegmentFilterProps {
  filters: SegmentFilters;
  onChange: (filters: SegmentFilters) => void;
  sources: SourceOfBusiness[];
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export const CampaignSegmentFilter = ({ filters, onChange, sources }: CampaignSegmentFilterProps) => {
  const updateFilter = (key: keyof SegmentFilters, value: string | number | undefined) => {
    const newFilters = { ...filters };
    if (value === "" || value === undefined || value === "all") {
      delete newFilters[key];
    } else {
      (newFilters as Record<string, string | number>)[key] = value;
    }
    onChange(newFilters);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Total Nights Stayed</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.min_nights || ""}
            onChange={(e) => updateFilter("min_nights", e.target.value ? parseInt(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.max_nights || ""}
            onChange={(e) => updateFilter("max_nights", e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Lifetime Revenue ($)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.min_revenue || ""}
            onChange={(e) => updateFilter("min_revenue", e.target.value ? parseFloat(e.target.value) : undefined)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.max_revenue || ""}
            onChange={(e) => updateFilter("max_revenue", e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Location</Label>
        <div className="space-y-2">
          <Input
            placeholder="City"
            value={filters.city || ""}
            onChange={(e) => updateFilter("city", e.target.value)}
          />
          <Input
            placeholder="State"
            value={filters.state || ""}
            onChange={(e) => updateFilter("state", e.target.value)}
          />
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Source of Business</Label>
        <Select
          value={filters.source_of_business_id || "all"}
          onValueChange={(value) => updateFilter("source_of_business_id", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any source</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.code} - {source.definition}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Birthday Month</Label>
        <Select
          value={filters.birthday_month?.toString() || "all"}
          onValueChange={(value) => updateFilter("birthday_month", value === "all" ? undefined : parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any month</SelectItem>
            {MONTHS.map((month) => (
              <SelectItem key={month.value} value={month.value.toString()}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Anniversary Month</Label>
        <Select
          value={filters.anniversary_month?.toString() || "all"}
          onValueChange={(value) => updateFilter("anniversary_month", value === "all" ? undefined : parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any month</SelectItem>
            {MONTHS.map((month) => (
              <SelectItem key={month.value} value={month.value.toString()}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
