import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelsTab } from "@/components/channel-manager/ChannelsTab";
import { MappingsTab } from "@/components/channel-manager/MappingsTab";
import { HoldbacksTab } from "@/components/channel-manager/HoldbacksTab";
import { ContentTab } from "@/components/channel-manager/ContentTab";
import { ActivityLogTab } from "@/components/channel-manager/ActivityLogTab";
import { useChannelManager } from "@/hooks/useChannelManager";
import { useProperty } from "@/contexts/PropertyContext";

export default function ChannelManager() {
  const [tab, setTab] = useState("channels");
  const cm = useChannelManager();
  const { selectedProperty } = useProperty();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold">Channel Manager</h1>
          <p className="text-muted-foreground">
            Sync inventory, rates, reservations and content with Expedia and Booking.com
            {selectedProperty ? ` for ${selectedProperty.name}` : ""}.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="mappings">Mappings</TabsTrigger>
            <TabsTrigger value="holdbacks">Hold-Backs</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-6"><ChannelsTab cm={cm} /></TabsContent>
          <TabsContent value="mappings" className="mt-6"><MappingsTab channels={cm.channels} /></TabsContent>
          <TabsContent value="holdbacks" className="mt-6"><HoldbacksTab channels={cm.channels} /></TabsContent>
          <TabsContent value="content" className="mt-6"><ContentTab channels={cm.channels} /></TabsContent>
          <TabsContent value="activity" className="mt-6"><ActivityLogTab channels={cm.channels} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
