import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Globe, Sparkles, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

type Proposed = { category: string; title: string; body: string; tags: string[] };

async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // Use a workerless approach for simplicity
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => it.str).join(" ") + "\n\n";
  }
  return out;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value || "";
}

export function KnowledgeImporter({
  propertyId,
  onImported,
}: {
  propertyId: string;
  onImported: () => void;
}) {
  const [tab, setTab] = useState("url");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState<Proposed[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const runImport = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setProposed([]);
    try {
      const { data, error } = await supabase.functions.invoke("messaging-kb-import", {
        body: { property_id: propertyId, ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const entries: Proposed[] = (data as any)?.entries || [];
      if (entries.length === 0) {
        toast.info("No knowledge extracted from that source.");
      } else {
        setProposed(entries);
        const initial: Record<number, boolean> = {};
        entries.forEach((_, i) => (initial[i] = true));
        setChecked(initial);
        toast.success(`Extracted ${entries.length} entries — review and save.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUrl = () => {
    if (!url.trim()) return toast.error("Enter a URL");
    runImport({ source: "url", url: url.trim() });
  };

  const handlePrompt = () => {
    if (!prompt.trim()) return toast.error("Describe what to generate");
    runImport({ source: "prompt", prompt: prompt.trim() });
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      let text = "";
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else if (name.endsWith(".docx")) {
        text = await extractDocxText(file);
      } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
        text = await file.text();
      } else {
        throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
      }
      if (!text.trim()) throw new Error("Could not extract any text from file.");
      await runImport({ source: "text", text, file_name: file.name });
    } catch (e: any) {
      toast.error(e.message || "File parse failed");
      setLoading(false);
    }
  };

  const saveSelected = async () => {
    const selected = proposed.filter((_, i) => checked[i]);
    if (selected.length === 0) return toast.error("Select at least one entry");
    const rows = selected.map((e) => ({
      property_id: propertyId,
      category: e.category,
      title: e.title,
      body: e.body,
      tags: e.tags,
      is_active: true,
    }));
    const { error } = await supabase.from("messaging_ai_knowledge").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Added ${rows.length} knowledge entries`);
    setProposed([]);
    setChecked({});
    onImported();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Import Knowledge
        </CardTitle>
        <CardDescription>
          Pull property info from your website, generate with AI, or upload PDF / DOCX / TXT. Extracted entries are reviewed before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="url"><Globe className="h-4 w-4 mr-1" /> Website</TabsTrigger>
            <TabsTrigger value="prompt"><Sparkles className="h-4 w-4 mr-1" /> AI Generate</TabsTrigger>
            <TabsTrigger value="file"><Upload className="h-4 w-4 mr-1" /> Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-2 mt-3">
            <Label>Website URL</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-campground.com/amenities"
                disabled={loading}
              />
              <Button onClick={handleUrl} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Scrapes the page with Firecrawl and extracts factual entries. Run it for each relevant page (amenities, policies, FAQ).
            </p>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-2 mt-3">
            <Label>What should the AI draft?</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Draft entries for pool rules, quiet hours, pet policy, WiFi, check-in/out, laundry room, dump station, campfire rules."
              className="min-h-[100px]"
              disabled={loading}
            />
            <Button onClick={handlePrompt} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</> : "Generate"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The AI drafts placeholders like <code>[add pool hours]</code> when specifics aren't known — edit them after saving.
            </p>
          </TabsContent>

          <TabsContent value="file" className="space-y-2 mt-3">
            <Label>Upload PDF, DOCX, TXT, or MD</Label>
            <Input
              type="file"
              accept=".pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={loading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              Files are parsed in your browser; only the extracted text is sent to the AI.
            </p>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Extracting…
              </div>
            )}
          </TabsContent>
        </Tabs>

        {proposed.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Proposed entries ({proposed.length})
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const all = Object.values(checked).every(Boolean);
                    const next: Record<number, boolean> = {};
                    proposed.forEach((_, i) => (next[i] = !all));
                    setChecked(next);
                  }}
                >
                  Toggle all
                </Button>
                <Button size="sm" onClick={saveSelected}>
                  Save selected
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {proposed.map((e, i) => (
                <div key={i} className="border rounded-lg p-3 flex gap-3">
                  <Checkbox
                    checked={!!checked[i]}
                    onCheckedChange={(v) => setChecked((c) => ({ ...c, [i]: !!v }))}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={e.title}
                        onChange={(ev) => {
                          const next = [...proposed];
                          next[i] = { ...next[i], title: ev.target.value };
                          setProposed(next);
                        }}
                        className="h-7 max-w-md font-medium"
                      />
                      <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                    </div>
                    <Textarea
                      value={e.body}
                      onChange={(ev) => {
                        const next = [...proposed];
                        next[i] = { ...next[i], body: ev.target.value };
                        setProposed(next);
                      }}
                      className="min-h-[70px] text-sm"
                    />
                    {e.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {e.tags.map((t) => (
                          <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
