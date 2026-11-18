import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Rocket,
  Calendar,
  Users,
  Calculator,
  DollarSign,
  Settings,
  Mail,
  FileText,
  Cog,
  ChevronDown,
  Search,
} from "lucide-react";
import { knowledgeBaseData, KnowledgeBaseCategory, KnowledgeBaseArticle } from "@/data/knowledgeBase";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Calendar,
  Users,
  Calculator,
  DollarSign,
  Settings,
  Mail,
  FileText,
  Cog,
};

interface KnowledgeBaseSidebarProps {
  selectedArticleId: string | null;
  onSelectArticle: (articleId: string, categoryId: string) => void;
  /** @deprecated retained for API compatibility; ignored (campground-only KB). */
  propertyType?: 'hotel' | 'campground';
}

export const KnowledgeBaseSidebar = ({
  selectedArticleId,
  onSelectArticle,
}: KnowledgeBaseSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(knowledgeBaseData.map(c => c.id))
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const filterArticles = (articles: KnowledgeBaseArticle[]) => {
    if (!searchQuery) return articles;
    const query = searchQuery.toLowerCase();
    return articles.filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.description.toLowerCase().includes(query) ||
      article.keywords.some(k => k.toLowerCase().includes(query))
    );
  };

  const filteredCategories = knowledgeBaseData.map(category => ({
    ...category,
    articles: filterArticles(category.articles),
  })).filter(category => category.articles.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredCategories.map((category) => {
            const Icon = iconMap[category.icon] || FileText;
            const isExpanded = expandedCategories.has(category.id);

            return (
              <Collapsible
                key={category.id}
                open={isExpanded}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between mb-1"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-4 space-y-1 mb-2">
                    {category.articles.map((article) => (
                      <Button
                        key={article.id}
                        variant={selectedArticleId === article.id ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => onSelectArticle(article.id, category.id)}
                      >
                        <span className="truncate">{article.title}</span>
                      </Button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
