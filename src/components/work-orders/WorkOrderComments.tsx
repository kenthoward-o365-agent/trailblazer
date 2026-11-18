import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  created_at: string;
  is_system: boolean;
  author_name?: string;
}

interface Props {
  workOrderId: string;
}

export const WorkOrderComments = ({ workOrderId }: Props) => {
  const { selectedProperty } = useProperty();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("work_order_comments")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load comments");
      return;
    }
    const rows = (data || []) as Comment[];
    const uids = [...new Set(rows.map((r) => r.user_id))];
    if (uids.length > 0) {
      const { data: profs } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", uids);
      const nameMap = new Map(
        (profs || []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`.trim() || "User"]),
      );
      setComments(rows.map((r) => ({ ...r, author_name: nameMap.get(r.user_id) || "User" })));
    } else {
      setComments(rows);
    }
  };

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUid(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const handlePost = async () => {
    if (!text.trim() || !selectedProperty?.id) return;
    setPosting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase.from("work_order_comments").insert({
        work_order_id: workOrderId,
        property_id: selectedProperty.id,
        user_id: uid,
        comment: text.trim(),
      });
      if (error) throw error;
      setText("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("work_order_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Activity</h3>
      <Card className="p-3 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment or progress update…"
          rows={2}
          maxLength={1000}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handlePost} disabled={posting || !text.trim()}>
            {posting ? "Posting…" : "Post"}
          </Button>
        </div>
      </Card>
      {comments.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No activity yet</Card>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <Card key={c.id} className={`p-3 ${c.is_system ? "bg-muted/40" : ""}`}>
              <div className="flex justify-between items-start gap-2 mb-1">
                <div className="text-xs">
                  <span className="font-semibold">{c.author_name || "User"}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                {c.user_id === currentUid && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">{c.comment}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
