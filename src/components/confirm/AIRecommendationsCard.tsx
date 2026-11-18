import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface AIRecommendationsCardProps {
  recommendations: any;
}

export const AIRecommendationsCard = ({ recommendations }: AIRecommendationsCardProps) => {
  if (!recommendations) return null;

  return (
    <Card className="p-3 mb-3 bg-accent/5 border-accent">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">AI Recommendations</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {recommendations.recommended_sites && (
          <div>
            <h4 className="text-xs font-medium mb-1">Top Site Picks:</h4>
            <div className="space-y-1">
              {recommendations.recommended_sites.slice(0, 2).map((site: any, idx: number) => (
                <div key={idx} className="text-xs p-2 bg-background rounded">
                  <span className="font-medium">Site {site.site_number || `#${idx + 1}`}</span>
                  <span className="text-muted-foreground ml-1">- {site.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {recommendations.recommended_add_on && (
          <div>
            <h4 className="text-xs font-medium mb-1">Recommended Add-on:</h4>
            <div className="text-xs p-2 bg-background rounded">
              <span className="font-medium">{recommendations.recommended_add_on.name}</span>
              <span className="text-muted-foreground ml-1">- {recommendations.recommended_add_on.reason}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
