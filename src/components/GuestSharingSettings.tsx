import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, Users, Building2 } from "lucide-react";
import { useProperty } from "@/contexts/PropertyContext";

interface SharingGroup {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
  members: SharingGroupMember[];
}

interface SharingGroupMember {
  id: string;
  property_id: string;
  property_name?: string;
}

interface Property {
  id: string;
  name: string;
}

export const GuestSharingSettings = () => {
  const { organization } = useProperty();
  const [groups, setGroups] = useState<SharingGroup[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SharingGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    if (!organization?.id) return;
    setLoading(true);

    // Load sharing groups with members
    const { data: groupsData, error: groupsError } = await supabase
      .from("guest_sharing_groups")
      .select(`
        *,
        members:guest_sharing_group_members(
          id,
          property_id
        )
      `)
      .eq("organization_id", organization.id)
      .order("name");

    if (groupsError) {
      console.error("Error loading sharing groups:", groupsError);
    }

    // Load properties for this organization
    const { data: propertiesData, error: propertiesError } = await supabase
      .from("properties")
      .select("id, name")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("name");

    if (propertiesError) {
      console.error("Error loading properties:", propertiesError);
    }

    // Enrich group members with property names
    const enrichedGroups = (groupsData || []).map(group => ({
      ...group,
      members: (group.members || []).map((member: SharingGroupMember) => ({
        ...member,
        property_name: (propertiesData || []).find(p => p.id === member.property_id)?.name || "Unknown"
      }))
    }));

    setGroups(enrichedGroups);
    setProperties(propertiesData || []);
    setLoading(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedPropertyIds.length < 2) {
      toast.error("Please select at least 2 properties to share guests");
      return;
    }

    if (!organization?.id) {
      toast.error("No organization found");
      return;
    }

    try {
      // Create the sharing group
      const { data: group, error: groupError } = await supabase
        .from("guest_sharing_groups")
        .insert({
          organization_id: organization.id,
          name: newGroupName.trim(),
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add members
      const memberInserts = selectedPropertyIds.map(propertyId => ({
        group_id: group.id,
        property_id: propertyId,
      }));

      const { error: membersError } = await supabase
        .from("guest_sharing_group_members")
        .insert(memberInserts);

      if (membersError) throw membersError;

      toast.success("Guest sharing group created");
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error creating sharing group:", error);
      toast.error("Failed to create sharing group");
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;

    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedPropertyIds.length < 2) {
      toast.error("Please select at least 2 properties to share guests");
      return;
    }

    try {
      // Update group name
      const { error: groupError } = await supabase
        .from("guest_sharing_groups")
        .update({ name: newGroupName.trim() })
        .eq("id", editingGroup.id);

      if (groupError) throw groupError;

      // Delete existing members and re-add
      await supabase
        .from("guest_sharing_group_members")
        .delete()
        .eq("group_id", editingGroup.id);

      const memberInserts = selectedPropertyIds.map(propertyId => ({
        group_id: editingGroup.id,
        property_id: propertyId,
      }));

      const { error: membersError } = await supabase
        .from("guest_sharing_group_members")
        .insert(memberInserts);

      if (membersError) throw membersError;

      toast.success("Guest sharing group updated");
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating sharing group:", error);
      toast.error("Failed to update sharing group");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this sharing group?")) return;

    try {
      const { error } = await supabase
        .from("guest_sharing_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;

      toast.success("Sharing group deleted");
      loadData();
    } catch (error) {
      console.error("Error deleting sharing group:", error);
      toast.error("Failed to delete sharing group");
    }
  };

  const openEditDialog = (group: SharingGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setSelectedPropertyIds(group.members.map(m => m.property_id));
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setNewGroupName("");
    setSelectedPropertyIds([]);
    setEditingGroup(null);
  };

  const togglePropertySelection = (propertyId: string) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  if (!organization) return null;

  // Only show if organization has multiple properties
  if (properties.length < 2 && !loading) {
    return null;
  }

  return (
    <Card className="p-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-semibold">Guest Profile Sharing</span>
            <Badge variant="secondary">{groups.length}</Badge>
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Create sharing groups to allow guest profiles to be visible across multiple properties.
            Properties in the same sharing group can access each other's guest profiles.
          </p>

          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No sharing groups configured</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <div className="font-medium">{group.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.members.map(m => m.property_name).join(", ")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(group)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button onClick={openCreateDialog} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Create Sharing Group
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Edit Sharing Group" : "Create Sharing Group"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Group Name</Label>
              <Input
                placeholder="e.g., Downtown Hotels"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>

            <div>
              <Label>Select Properties to Share Guests</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select at least 2 properties. Guest profiles created at any of these properties
                will be visible to staff at all other selected properties.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                {properties.map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => togglePropertySelection(property.id)}
                  >
                    <Checkbox
                      checked={selectedPropertyIds.includes(property.id)}
                      onCheckedChange={() => togglePropertySelection(property.id)}
                    />
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{property.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedPropertyIds.length} properties selected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}>
              {editingGroup ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
