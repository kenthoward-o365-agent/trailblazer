import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, MessageSquare, Printer } from "lucide-react";
import DOMPurify from "dompurify";

interface CampaignPreviewProps {
  open: boolean;
  onClose: () => void;
  channel: string;
  subject: string;
  content: string;
}

export const CampaignPreview = ({ open, onClose, channel, subject, content }: CampaignPreviewProps) => {
  const isPrintDocument = channel === "registration_card" || channel === "confirmation_letter";
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel === "email" ? (
              <>
                <Mail className="h-5 w-5" />
                Email Preview
              </>
            ) : isPrintDocument ? (
              <>
                <Printer className="h-5 w-5" />
                {channel === "registration_card" ? "Registration Card Preview" : "Confirmation Letter Preview"}
              </>
            ) : (
              <>
                <MessageSquare className="h-5 w-5" />
                SMS Preview
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {channel === "email" || isPrintDocument ? (
          <div className="border rounded-lg">
            {channel === "email" && (
              <div className="bg-muted p-4 border-b">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Subject:</span>
                  <span>{subject || "(No subject)"}</span>
                </div>
              </div>
            )}
            {isPrintDocument && (
              <div className="bg-muted p-3 border-b text-xs text-muted-foreground">
                Print preview - template variables will be replaced with guest/reservation data
              </div>
            )}
            <div className="p-6 bg-white">
              {content ? (
                <div
                  className="prose prose-sm max-w-none text-black"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(content, {
                      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
                      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
                    }),
                  }}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No content yet
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-sm mx-auto">
            <div className="bg-muted rounded-2xl p-4">
              <div className="bg-primary text-primary-foreground rounded-xl p-3 max-w-[80%]">
                <p className="text-sm whitespace-pre-wrap">
                  {content || "No message content"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">
                SMS Preview
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};