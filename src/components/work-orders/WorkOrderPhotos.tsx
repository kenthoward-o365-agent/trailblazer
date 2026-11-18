import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon } from "lucide-react";

interface Attachment {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  uploaded_by_user_id: string;
  signedUrl?: string;
}

interface Props {
  workOrderId: string;
  propertyId: string;
}

export const WorkOrderPhotos = ({ workOrderId, propertyId }: Props) => {
  const { selectedProperty } = useProperty();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("work_order_attachments")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load photos");
      return;
    }
    const rows = (data || []) as Attachment[];
    // sign urls
    const signed = await Promise.all(
      rows.map(async (a) => {
        const { data: s } = await supabase.storage
          .from("work-order-photos")
          .createSignedUrl(a.storage_path, 60 * 60);
        return { ...a, signedUrl: s?.signedUrl };
      }),
    );
    setAttachments(signed);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedProperty?.id) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10MB`);
          continue;
        }
        const ext = file.name.split(".").pop() || "bin";
        const path = `${propertyId}/${workOrderId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("work-order-photos")
          .upload(path, file, { cacheControl: "3600" });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("work_order_attachments").insert({
          work_order_id: workOrderId,
          property_id: propertyId,
          storage_path: path,
          caption: file.name,
          uploaded_by_user_id: uid,
        });
        if (dbErr) throw dbErr;
      }
      toast.success("Uploaded");
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (a: Attachment) => {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("work-order-photos").remove([a.storage_path]);
    const { error } = await supabase.from("work_order_attachments").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Photos</h3>
        <label>
          <Input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button size="sm" asChild disabled={uploading}>
            <span className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Uploading…" : "Add photos"}
            </span>
          </Button>
        </label>
      </div>
      {attachments.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8 opacity-50" />
          No photos yet
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map((a) => (
            <Card key={a.id} className="overflow-hidden group relative">
              {a.signedUrl ? (
                <a href={a.signedUrl} target="_blank" rel="noreferrer">
                  <img
                    src={a.signedUrl}
                    alt={a.caption || ""}
                    className="w-full aspect-square object-cover"
                  />
                </a>
              ) : (
                <div className="w-full aspect-square bg-muted animate-pulse" />
              )}
              <div className="p-2 text-xs truncate">{a.caption}</div>
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(a)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
