import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Mail, MessageSquare, Send, Edit, Trash2, Users, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  channel: string;
  status: string;
  trigger_type: string;
  trigger_days: number | null;
  segment_filters: Record<string, any>;
  sent_count: number;
  created_at: string;
  updated_at: string;
}

const CRM = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadCampaigns();
    }
  }, [selectedProperty?.id]);

  const loadCampaigns = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    try {
      const { data: campaignData, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns((campaignData || []) as Campaign[]);
    } catch (error) {
      console.error("Failed to load campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      
      setCampaigns(campaigns.filter(c => c.id !== deleteId));
      toast.success("Campaign deleted");
      loadCampaigns();
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      toast.error("Failed to delete campaign");
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      active: "default",
      sent: "default",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getTriggerLabel = (trigger_type: string, trigger_days: number | null) => {
    if (trigger_type === "manual") return "Manual";
    if (trigger_type === "pre_arrival") return `${trigger_days} days before arrival`;
    if (trigger_type === "in_house") return terminology.isHotel ? "In-House Guests" : "In-Park Guests";
    if (trigger_type === "post_departure") return `${trigger_days} days after departure`;
    // Legacy support
    if (trigger_type === "before_arrival") return `${trigger_days} days before arrival`;
    if (trigger_type === "after_departure") return `${trigger_days} days after departure`;
    return trigger_type;
  };

  const getSegmentSummary = (filters: Record<string, any>) => {
    const parts: string[] = [];
    if (filters.min_nights) parts.push(`≥${filters.min_nights} nights`);
    if (filters.min_revenue) parts.push(`≥$${filters.min_revenue} revenue`);
    if (filters.city) parts.push(filters.city);
    if (filters.state) parts.push(filters.state);
    if (filters.source_of_business_id) parts.push("Source filter");
    return parts.length > 0 ? parts.join(", ") : "All guests";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CRM Campaigns</h1>
            <p className="text-muted-foreground">
              Create and manage email and SMS marketing campaigns
            </p>
          </div>
          <Button onClick={() => navigate("/crm/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {campaigns.filter(c => c.status === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">Active Automations</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Sends</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first campaign to start engaging with guests
              </p>
              <Button onClick={() => navigate("/crm/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        {campaign.subject && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {campaign.subject}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {campaign.channel === "email" ? (
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="capitalize">{campaign.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {campaign.trigger_type === "manual" ? (
                          <Send className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">
                          {getTriggerLabel(campaign.trigger_type, campaign.trigger_days)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getSegmentSummary(campaign.segment_filters || {})}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-center">{campaign.sent_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => { e.stopPropagation(); navigate(`/crm/${campaign.id}`); }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default CRM;
