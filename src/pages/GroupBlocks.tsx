import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { ExportColumn, ExportFilter } from "@/lib/exportUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";

interface GroupBlock {
  id: string;
  code: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  has_master_account: boolean;
  created_at: string;
}

type SortOption = 'code' | 'description' | 'start_date';

const GroupBlocks = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const propertyId = selectedProperty?.id;

  const { data: groupBlocks = [], isLoading: loading } = useQuery({
    queryKey: ["group_blocks", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_blocks")
        .select("*")
        .eq("property_id", propertyId!)
        .order("start_date", { ascending: false });
      if (error) {
        toast.error("Failed to load group blocks");
        throw error;
      }
      return (data ?? []) as GroupBlock[];
    },
  });

  const refreshGroupBlocks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["group_blocks", propertyId] });
  }, [queryClient, propertyId]);

  // Export configuration
  const exportColumns: ExportColumn[] = [
    { key: 'code', label: 'Code' },
    { key: 'description', label: 'Description', format: (v) => v || '' },
    { key: 'contact_name', label: 'Contact', format: (_, row) => `${row.contact_first_name || ''} ${row.contact_last_name || ''}`.trim() },
    { key: 'start_date', label: 'Start Date', format: (v) => v ? format(new Date(v), 'MM/dd/yyyy') : '' },
    { key: 'end_date', label: 'End Date', format: (v) => v ? format(new Date(v), 'MM/dd/yyyy') : '' },
    { key: 'status', label: 'Status' },
    { key: 'has_master_account', label: 'Master Account', format: (v) => v ? 'Yes' : 'No' },
  ];

  const exportFilters: ExportFilter[] = [
    { 
      key: 'status', 
      label: 'Status', 
      type: 'select', 
      options: [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'completed', label: 'Completed' },
      ]
    },
  ];

  const handleApplyExportFilters = (filters: Record<string, string>) => {
    let result = groupBlocks;
    if (filters.status && filters.status !== 'all') {
      result = result.filter(b => b.status === filters.status);
    }
    return result;
  };

  const handleOpenBlock = useCallback((id: string) => {
    navigate(`/group-blocks/${id}`);
  }, [navigate]);



  const handleDuplicate = async (block: GroupBlock) => {
    // Navigate to new form with duplicate data in state
    navigate("/group-blocks/new", { state: { duplicateFrom: block } });
  };

  const handleCancel = async (blockId: string) => {
    const { error } = await supabase
      .from("group_blocks")
      .update({ status: "cancelled" })
      .eq("id", blockId);

    if (error) {
      toast.error("Failed to cancel group block");
    } else {
      toast.success("Group block cancelled");
      refreshGroupBlocks();
    }
  };

  const filteredBlocks = useMemo(() => {
    let result = groupBlocks.filter((block) => {
      const query = searchQuery.toLowerCase();
      return (
        block.code.toLowerCase().includes(query) ||
        block.description?.toLowerCase().includes(query) ||
        `${block.contact_first_name} ${block.contact_last_name}`.toLowerCase().includes(query)
      );
    });

    // Apply sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'description':
          const descA = (a.description || '').toLowerCase();
          const descB = (b.description || '').toLowerCase();
          comparison = descA.localeCompare(descB);
          break;
        case 'start_date':
          const dateA = new Date(a.start_date).getTime();
          const dateB = new Date(b.start_date).getTime();
          comparison = dateA - dateB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [groupBlocks, searchQuery, sortBy, sortOrder]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Group Blocks</h1>
            <p className="text-muted-foreground">
              Manage group reservations and room blocks
            </p>
          </div>
          <Button onClick={() => navigate("/group-blocks/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Group Block
          </Button>
        </div>

        {/* Search and Sort */}
        <Card className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Code, description, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Sort By</Label>
              <div className="flex items-center gap-1">
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="flex-1 h-9">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="start_date">Arrival Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={refreshGroupBlocks} variant="outline" size="sm" className="h-9">
                Refresh
              </Button>
              <Button 
                onClick={() => setExportDialogOpen(true)} 
                variant="outline" 
                size="sm"
                className="h-9"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="p-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Master Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredBlocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No group blocks match your search" : "No group blocks yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBlocks.map((block) => (
                  <GroupBlockRow
                    key={block.id}
                    block={block}
                    isMobile={isMobile}
                    onOpen={handleOpenBlock}
                    onDuplicate={handleDuplicate}
                    onCancel={handleCancel}
                    getStatusBadge={getStatusBadge}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        title="Export Group Blocks"
        filenameBase="group-blocks"
        data={groupBlocks}
        columns={exportColumns}
        filters={exportFilters}
        onApplyFilters={handleApplyExportFilters}
      />
    </DashboardLayout>
  );
};

// Separate component to use hooks per row for long press
interface GroupBlockRowProps {
  block: GroupBlock;
  isMobile: boolean;
  onOpen: (id: string) => void;
  onDuplicate: (block: GroupBlock) => void;
  onCancel: (id: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

const GroupBlockRow = ({ block, isMobile, onOpen, onDuplicate, onCancel, getStatusBadge }: GroupBlockRowProps) => {
  const navigate = useNavigate();
  const longPressHandlers = useLongPress(() => onOpen(block.id), 500);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onDoubleClick={() => !isMobile && onOpen(block.id)}
      {...(isMobile ? longPressHandlers : {})}
    >
      <TableCell className="font-mono font-medium">{block.code}</TableCell>
      <TableCell>{block.description || "-"}</TableCell>
      <TableCell>
        {block.contact_first_name || block.contact_last_name
          ? `${block.contact_first_name || ""} ${block.contact_last_name || ""}`.trim()
          : "-"}
      </TableCell>
      <TableCell>
        {format(new Date(block.start_date), "MMM d")} -{" "}
        {format(new Date(block.end_date), "MMM d, yyyy")}
      </TableCell>
      <TableCell>
        {block.has_master_account ? (
          <Badge variant="outline">Yes</Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        )}
      </TableCell>
      <TableCell>{getStatusBadge(block.status)}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => { e.stopPropagation(); navigate(`/group-blocks/${block.id}`); }}
        >
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default GroupBlocks;
