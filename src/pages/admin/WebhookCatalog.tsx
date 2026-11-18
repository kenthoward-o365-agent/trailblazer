import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Endpoint = {
  id: string;
  event_key: string;
  display_name: string;
  description: string;
  category: string;
};

export default function WebhookCatalog() {
  const [items, setItems] = useState<Endpoint[]>([]);

  useEffect(() => {
    supabase.from("webhook_catalog_endpoints").select("id,event_key,display_name,description,category")
      .eq("is_active", true).order("category").then(({ data }) => setItems((data ?? []) as Endpoint[]));
  }, []);

  const grouped = items.reduce<Record<string, Endpoint[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e); return acc;
  }, {});

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Webhook Catalog</h1>
        <p className="text-muted-foreground">Enterprise integration events you can subscribe to.</p>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <Card key={cat}>
          <CardHeader><CardTitle className="capitalize">{cat}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {list.map(e => (
              <div key={e.id} className="rounded border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{e.event_key}</Badge>
                  <span className="font-medium">{e.display_name}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
