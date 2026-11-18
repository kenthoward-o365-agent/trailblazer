import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Send, Mail, MessageSquare, Users, Eye, FileText, ClipboardSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CampaignSegmentFilter } from "@/components/crm/CampaignSegmentFilter";
import type { Json } from "@/integrations/supabase/types";
import { RichTextEditor } from "@/components/crm/RichTextEditor";
import { CampaignPreview } from "@/components/crm/CampaignPreview";

interface SegmentFilters {
  min_nights?: number;
  max_nights?: number;
  min_revenue?: number;
  max_revenue?: number;
  city?: string;
  state?: string;
  source_of_business_id?: string;
}

interface SourceOfBusiness {
  id: string;
  code: string;
  definition: string;
}

const CampaignEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [matchingGuestsCount, setMatchingGuestsCount] = useState(0);
  const [sources, setSources] = useState<SourceOfBusiness[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    content: "",
    channel: "email",
    trigger_type: "manual",
    trigger_days: 1,
    status: "draft",
  });

  const [segmentFilters, setSegmentFilters] = useState<SegmentFilters>({});

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (propertyId) {
      countMatchingGuests();
    }
  }, [segmentFilters, propertyId]);

  const loadData = async () => {
    try {
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .limit(1)
        .single();

      if (properties) {
        setPropertyId(properties.id);

        // Load sources of business
        const { data: sourcesData } = await supabase
          .from("source_of_business")
          .select("id, code, definition")
          .eq("property_id", properties.id);

        setSources(sourcesData || []);

        if (!isNew && id) {
          const { data: campaign, error } = await supabase
            .from("campaigns")
            .select("*")
            .eq("id", id)
            .single();

          if (error) throw error;

          if (campaign) {
            setFormData({
              name: campaign.name,
              subject: campaign.subject || "",
              content: campaign.content || "",
              channel: campaign.channel,
              trigger_type: campaign.trigger_type,
              trigger_days: campaign.trigger_days || 1,
              status: campaign.status,
            });
            setSegmentFilters((campaign.segment_filters as SegmentFilters) || {});
          }
        }
      }
    } catch (error) {
      console.error("Failed to load campaign:", error);
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  const countMatchingGuests = async () => {
    try {
      let query = supabase.from("guests").select("id", { count: "exact" });

      if (segmentFilters.city) {
        query = query.ilike("city", `%${segmentFilters.city}%`);
      }
      if (segmentFilters.state) {
        query = query.ilike("state", `%${segmentFilters.state}%`);
      }

      const { count } = await query;
      
      // Additional filtering would happen server-side for nights/revenue
      // This is a simplified count for UI feedback
      setMatchingGuestsCount(count || 0);
    } catch (error) {
      console.error("Failed to count guests:", error);
    }
  };

  const handleSave = async (newStatus?: string) => {
    if (!formData.name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    if (!propertyId) {
      toast.error("Property not found");
      return;
    }

    setSaving(true);
    try {
      const isPrintDocument = formData.channel === "registration_card" || formData.channel === "confirmation_letter";
      const campaignData = {
        property_id: propertyId,
        name: formData.name,
        subject: formData.channel === "email" ? formData.subject : null,
        content: formData.content,
        channel: formData.channel,
        trigger_type: isPrintDocument ? "manual" : formData.trigger_type,
        trigger_days: formData.trigger_type !== "manual" && !isPrintDocument ? formData.trigger_days : null,
        segment_filters: isPrintDocument ? {} as unknown as Json : segmentFilters as unknown as Json,
        status: newStatus || formData.status,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from("campaigns")
          .insert(campaignData)
          .select()
          .single();

        if (error) throw error;
        toast.success("Campaign created");
        navigate(`/crm/${data.id}`);
      } else {
        const { error } = await supabase
          .from("campaigns")
          .update(campaignData)
          .eq("id", id);

        if (error) throw error;
        setFormData(prev => ({ ...prev, status: newStatus || prev.status }));
        toast.success("Campaign saved");
      }
    } catch (error) {
      console.error("Failed to save campaign:", error);
      toast.error("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!formData.content.trim()) {
      toast.error("Please add content to your campaign");
      return;
    }

    setSending(true);
    try {
      // Save the campaign first
      await handleSave("sent");

      // Mock sending - in production this would call an edge function
      toast.success(`Campaign sent to ${matchingGuestsCount} guests (mocked)`);
      
      // Update sent count
      if (!isNew && id) {
        await supabase
          .from("campaigns")
          .update({ sent_count: matchingGuestsCount })
          .eq("id", id);
      }
    } catch (error) {
      console.error("Failed to send campaign:", error);
      toast.error("Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  const handleActivateAutomation = async () => {
    if (!formData.content.trim()) {
      toast.error("Please add content to your campaign");
      return;
    }

    await handleSave("active");
    toast.success("Automation activated");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/crm")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? (formData.channel === "registration_card" ? "Registration Card Template" : 
                          formData.channel === "confirmation_letter" ? "Confirmation Letter Template" : 
                          "New Campaign") : formData.name || "Edit Campaign"}
              </h1>
              <p className="text-muted-foreground">
                {formData.channel === "email" ? "Email campaign" : 
                 formData.channel === "sms" ? "SMS campaign" :
                 formData.channel === "registration_card" ? "Print document • Check-in" :
                 formData.channel === "confirmation_letter" ? "Print document • Booking confirmation" : "Campaign"} •{" "}
                {formData.trigger_type === "manual" ? "Manual" : 
                 formData.trigger_type === "pre_arrival" ? "Pre-Arrival" :
                 formData.trigger_type === "in_house" ? "In-Park" : "Post-Departure"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" onClick={() => handleSave()} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            {(formData.channel === "registration_card" || formData.channel === "confirmation_letter") ? (
              <Button 
                onClick={handleActivateAutomation} 
                disabled={saving || formData.status === "active"}
              >
                {formData.status === "active" ? "Active" : "Activate Template"}
              </Button>
            ) : formData.trigger_type === "manual" ? (
              <Button onClick={handleSendNow} disabled={sending || matchingGuestsCount === 0}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : `Send Now (${matchingGuestsCount})`}
              </Button>
            ) : (
              <Button 
                onClick={handleActivateAutomation} 
                disabled={saving || formData.status === "active"}
              >
                {formData.status === "active" ? "Active" : "Activate Automation"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <Tabs defaultValue="content">
                <TabsList className="mb-4">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Welcome Email, Departure Thank You"
                    />
                  </div>

                  {formData.channel === "email" && (
                    <div className="space-y-2">
                      <Label>Email Subject</Label>
                      <Input
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="e.g., Welcome to our campground!"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>
                      {formData.channel === "email" ? "Email Content" : 
                       formData.channel === "sms" ? "SMS Message" :
                       formData.channel === "registration_card" ? "Registration Card Content" :
                       "Confirmation Letter Content"}
                    </Label>
                    
                    {/* Template Variables Section */}
                    <div className="p-3 bg-muted rounded-lg text-sm space-y-3">
                      <p className="font-medium">Insert Variable (click to copy):</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Guest Profile</p>
                          <div className="flex flex-wrap gap-1">
                            {["first_name", "last_name", "email", "phone", "phone2", "address", "city", "state", "zipcode"].map((variable) => (
                              <Button
                                key={variable}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(`{{${variable}}}`);
                                  toast.success(`Copied {{${variable}}} to clipboard`);
                                }}
                              >
                                {variable.replace(/_/g, " ")}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Reservation</p>
                          <div className="flex flex-wrap gap-1">
                            {["confirmation_number", "check_in_date", "check_out_date", "nights", "site_number", "site_type", "rate_code", "total_price", "adults", "children", "special_requests"].map((variable) => (
                              <Button
                                key={variable}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(`{{${variable}}}`);
                                  toast.success(`Copied {{${variable}}} to clipboard`);
                                }}
                              >
                                {variable.replace(/_/g, " ")}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Property</p>
                          <div className="flex flex-wrap gap-1">
                            {["property_name", "property_address"].map((variable) => (
                              <Button
                                key={variable}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(`{{${variable}}}`);
                                  toast.success(`Copied {{${variable}}} to clipboard`);
                                }}
                              >
                                {variable.replace(/_/g, " ")}
                              </Button>
                            ))}
                          </div>
                        </div>
                        {(formData.channel === "registration_card" || formData.channel === "confirmation_letter") && (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Payment Card</p>
                              <div className="flex flex-wrap gap-1">
                                {["card_type", "card_last_four", "card_expiration"].map((variable) => (
                                  <Button
                                    key={variable}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`{{${variable}}}`);
                                      toast.success(`Copied {{${variable}}} to clipboard`);
                                    }}
                                  >
                                    {variable.replace(/_/g, " ")}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Document</p>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText("{{signature_line}}");
                                    toast.success("Copied {{signature_line}} to clipboard");
                                  }}
                                >
                                  signature line
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText("{{today_date}}");
                                    toast.success("Copied {{today_date}} to clipboard");
                                  }}
                                >
                                  today date
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {formData.channel === "email" || formData.channel === "registration_card" || formData.channel === "confirmation_letter" ? (
                      <RichTextEditor
                        content={formData.content}
                        onChange={(content) => setFormData({ ...formData, content })}
                        propertyId={propertyId ?? undefined}
                      />

                    ) : (
                      <Textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Enter your SMS message..."
                        rows={4}
                        maxLength={160}
                      />
                    )}
                    {formData.channel === "sms" && (
                      <p className="text-sm text-muted-foreground">
                        {formData.content.length}/160 characters
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select
                        value={formData.channel}
                        onValueChange={(value) => setFormData({ ...formData, channel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          </SelectItem>
                          <SelectItem value="sms">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              SMS
                            </div>
                          </SelectItem>
                          <SelectItem value="registration_card">
                            <div className="flex items-center gap-2">
                              <ClipboardSignature className="h-4 w-4" />
                              Registration Card
                            </div>
                          </SelectItem>
                          <SelectItem value="confirmation_letter">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Confirmation Letter
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Trigger Type</Label>
                      <Select
                        value={formData.trigger_type}
                        onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual Send</SelectItem>
                          <SelectItem value="pre_arrival">Pre-Arrival</SelectItem>
                          <SelectItem value="in_house">In-Park Guest</SelectItem>
                          <SelectItem value="post_departure">Post-Departure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.trigger_type !== "manual" && formData.trigger_type !== "in_house" && (
                    <div className="space-y-2">
                      <Label>
                        Days {formData.trigger_type === "pre_arrival" ? "before arrival" : "after departure"}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.trigger_days}
                        onChange={(e) => setFormData({ ...formData, trigger_days: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  )}

                  {formData.trigger_type === "in_house" && (
                    <p className="text-sm text-muted-foreground">
                      This campaign will be sent to guests who are currently checked in.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {formData.channel !== "registration_card" && formData.channel !== "confirmation_letter" ? (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Audience Segment</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Target specific guests based on their profile and stay history
                </p>

                <CampaignSegmentFilter
                  filters={segmentFilters}
                  onChange={setSegmentFilters}
                  sources={sources}
                />

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-semibold text-primary">{matchingGuestsCount}</span>{" "}
                    guests match this segment
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Document Template</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {formData.channel === "registration_card" 
                    ? "This template will be available to print during guest check-in. Include a signature line for guest acknowledgment."
                    : "This template will be available to print when confirming a reservation."}
                </p>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-2">Usage:</p>
                  <p className="text-muted-foreground">
                    {formData.channel === "registration_card"
                      ? "After completing check-in, staff will see a 'Print Registration Card' button."
                      : "On the booking confirmation page, staff will see a 'Print Confirmation' button."}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      <CampaignPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        channel={formData.channel}
        subject={formData.subject}
        content={formData.content}
      />
    </DashboardLayout>
  );
};

export default CampaignEditor;
