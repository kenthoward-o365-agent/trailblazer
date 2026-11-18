import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KnowledgeBaseArticle as ArticleType, getCategoryById } from "@/data/knowledgeBase";

interface KnowledgeBaseArticleProps {
  article: ArticleType | null;
}

// Simple markdown-like renderer
const renderContent = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="mb-4 overflow-x-auto">
          <table className="w-full border-collapse border border-border text-sm">
            <thead>
              <tr className="bg-muted">
                {tableHeader.map((cell, i) => (
                  <th key={i} className="border border-border px-3 py-2 text-left font-semibold">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-muted/50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-border px-3 py-2 text-muted-foreground">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      tableHeader = [];
    }
    inTable = false;
  };

  const renderInline = (text: string): React.ReactNode => {
    // Handle bold
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-foreground font-semibold">{part}</strong>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for table
    if (line.startsWith('|')) {
      if (!inTable) {
        flushList();
        inTable = true;
        // First row is header
        tableHeader = line.split('|').filter(c => c.trim()).map(c => c.trim());
        // Skip separator row
        if (lines[i + 1]?.includes('---')) {
          i++;
        }
        continue;
      }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.length > 0) {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // H1
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={i} className="text-2xl font-bold mb-4 text-foreground">
          {line.slice(2)}
        </h1>
      );
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={i} className="text-xl font-semibold mt-6 mb-3 text-foreground">
          {line.slice(3)}
        </h2>
      );
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-foreground">
          {line.slice(4)}
        </h3>
      );
      continue;
    }

    // List item
    if (line.startsWith('- ')) {
      inList = true;
      listItems.push(line.slice(2));
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      flushList();
      const match = line.match(/^\d+\.\s(.*)/);
      if (match) {
        if (!inList) {
          inList = true;
        }
        listItems.push(match[1]);
      }
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={i} className="mb-3 text-muted-foreground leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  flushTable();

  return elements;
};

export const KnowledgeBaseArticle = ({ article }: KnowledgeBaseArticleProps) => {
  if (!article) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to the Knowledge Base</h2>
          <p>Select an article from the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  const category = getCategoryById(article.category);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <span>{category?.name || 'Articles'}</span>
          <span>/</span>
          <span className="text-foreground">{article.title}</span>
        </div>

        {/* Campground-only KB — no property type badge */}

        {/* Description */}
        <p className="text-lg text-muted-foreground mb-6">{article.description}</p>

        {/* Content */}
        <div className="prose prose-sm max-w-none">
          {renderContent(article.content)}
        </div>

        {/* Keywords */}
        <div className="mt-8 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            {article.keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
