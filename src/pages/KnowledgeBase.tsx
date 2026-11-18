import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KnowledgeBaseSidebar } from "@/components/knowledge-base/KnowledgeBaseSidebar";
import { KnowledgeBaseArticle } from "@/components/knowledge-base/KnowledgeBaseArticle";
import { AskKbChat } from "@/components/knowledge-base/AskKbChat";
import { getArticleById } from "@/data/knowledgeBase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Menu, X, BookOpen, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const KnowledgeBase = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    searchParams.get("article")
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"articles" | "ask">(
    (searchParams.get("tab") as "articles" | "ask") ?? "articles"
  );

  const selectedArticle = selectedArticleId ? getArticleById(selectedArticleId) : null;

  useEffect(() => {
    const articleParam = searchParams.get("article");
    if (articleParam) {
      setSelectedArticleId(articleParam);
      setTab("articles");
    }
  }, [searchParams]);

  const handleSelectArticle = (articleId: string, categoryId: string) => {
    setSelectedArticleId(articleId);
    setSearchParams({ article: articleId, category: categoryId, tab: "articles" });
    setMobileSidebarOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] min-h-0 flex flex-col -m-6">
        <div className="px-4 md:px-6 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Knowledge Base</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="articles">Articles</TabsTrigger>
                <TabsTrigger value="ask">
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Ask the KB
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Link to="/onboarding-agent">
              <Button size="sm" variant="default">
                <Sparkles className="h-4 w-4 mr-1" /> Onboarding Agent
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {tab === "ask" ? (
          <div className="flex-1 min-h-0">
            <AskKbChat />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            <aside
              className={`
                ${mobileSidebarOpen ? "block" : "hidden"}
                md:block
                absolute md:relative
                inset-0 md:inset-auto top-14 md:top-auto
                z-20 md:z-auto
                w-full md:w-80
                bg-card
                border-r
              `}
            >
              <KnowledgeBaseSidebar
                selectedArticleId={selectedArticleId}
                onSelectArticle={handleSelectArticle}
              />
            </aside>
            <main className="flex-1 overflow-hidden">
              <KnowledgeBaseArticle article={selectedArticle} />
            </main>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default KnowledgeBase;
