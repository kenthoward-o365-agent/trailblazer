import { useEditor, EditorContent, BubbleMenu, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Quote,
  Upload,
  Loader2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
  Trash2,
  CornerDownLeft,
  Minus,
  Code,
  Eye,
  Type,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";

// Custom FontSize extension
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

const FONT_SIZES = [
  { value: "12px", label: "12" },
  { value: "14px", label: "14" },
  { value: "16px", label: "16" },
  { value: "18px", label: "18" },
  { value: "20px", label: "20" },
  { value: "24px", label: "24" },
  { value: "28px", label: "28" },
  { value: "32px", label: "32" },
  { value: "36px", label: "36" },
  { value: "48px", label: "48" },
];

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  propertyId?: string;
}

// Custom Image extension with resizing support
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width') || element.style.width?.replace('px', ''),
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}px` };
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height') || element.style.height?.replace('px', ''),
        renderHTML: attributes => {
          if (!attributes.height) return {};
          return { height: attributes.height, style: `height: ${attributes.height}px` };
        },
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => {
          return { 'data-align': attributes.align };
        },
      },
    };
  },
});

export const RichTextEditor = ({ content, onChange, propertyId }: RichTextEditorProps) => {
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageSize, setImageSize] = useState(100);
  const [showHtml, setShowHtml] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return null;
    }

    setUploading(true);
    try {
      if (!propertyId) {
        toast.error("Select a property before uploading images");
        return null;
      }
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${propertyId}/emails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("campaign-images")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    const url = await uploadImage(file);
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
      toast.success("Image uploaded");
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      ResizableImage.configure({
        HTMLAttributes: {
          class: "rounded-lg transition-all cursor-pointer",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none",
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                handleImageUpload(file);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const setImageWidth = (width: number) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes('image', { width }).run();
  };

  const setImageAlign = (align: string) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes('image', { align }).run();
  };

  const deleteImage = () => {
    if (!editor) return;
    editor.chain().focus().deleteSelection().run();
  };

  if (!editor) {
    return null;
  }

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
    }
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
    }
  };

  return (
    <div 
      className={`border rounded-lg overflow-hidden transition-colors ${
        isDragOver ? "border-primary border-2 bg-primary/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Image Bubble Menu for resizing */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          shouldShow={({ editor, state }) => {
            return editor.isActive('image');
          }}
          className="bg-background border rounded-lg shadow-lg p-2 flex items-center gap-2"
        >
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageAlign('left')}
              title="Align left"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageAlign('center')}
              title="Align center"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageAlign('right')}
              title="Align right"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2 border-r pr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageWidth(200)}
              title="Small"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageWidth(400)}
              title="Medium"
            >
              <span className="text-xs font-medium">M</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImageWidth(600)}
              title="Large"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="sm" title="Custom size">
                <ImageIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" side="top">
              <div className="space-y-3">
                <p className="text-sm font-medium">Image Width</p>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[imageSize]}
                    onValueChange={(value) => setImageSize(value[0])}
                    onValueCommit={(value) => setImageWidth(value[0] * 6)}
                    min={10}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12">
                    {imageSize * 6}px
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setImageSize(33); setImageWidth(200); }}
                  >
                    200px
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setImageSize(67); setImageWidth(400); }}
                  >
                    400px
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setImageSize(100); setImageWidth(600); }}
                  >
                    600px
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={deleteImage}
            title="Delete image"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </BubbleMenu>
      )}

      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-muted" : ""}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-muted" : ""}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "bg-muted" : ""}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        
        <Select
          value={editor.getAttributes("textStyle").fontSize || ""}
          onValueChange={(value) => {
            if (value === "default") {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(value).run();
            }
          }}
        >
          <SelectTrigger className="w-[70px] h-8">
            <Type className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive("heading", { level: 1 }) ? "bg-muted" : ""}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive("heading", { level: 2 }) ? "bg-muted" : ""}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-muted" : ""}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-muted" : ""}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "bg-muted" : ""}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHardBreak().run()}
          title="Line Break (new line)"
        >
          <CornerDownLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line (divider)"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={editor.isActive("link") ? "bg-muted" : ""}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <p className="text-sm font-medium">Add Link</p>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addLink}>
                  Add Link
                </Button>
                {editor.isActive("link") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editor.chain().focus().unsetLink().run()}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <p className="text-sm font-medium">Add Image</p>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Upload from computer</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Choose File
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-popover px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Add from URL</p>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Button size="sm" onClick={addImage} className="w-full">
                  Add from URL
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHtml(!showHtml)}
            className={showHtml ? "bg-muted" : ""}
            title={showHtml ? "Switch to Visual Editor" : "View HTML Code"}
          >
            {showHtml ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo() || showHtml}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo() || showHtml}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showHtml ? (
        <textarea
          className="w-full min-h-[200px] p-4 font-mono text-sm bg-muted/50 focus:outline-none resize-y"
          value={content}
          onChange={(e) => {
            onChange(e.target.value);
            editor?.commands.setContent(e.target.value);
          }}
          placeholder="Enter HTML content..."
        />
      ) : (
        <div className="relative">
          <EditorContent editor={editor} />
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 pointer-events-none">
              <div className="bg-background border-2 border-dashed border-primary rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Drop image here</p>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror > * + * {
          margin-top: 0.75em;
        }
        .ProseMirror h1 {
          font-size: 2em;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: 600;
          line-height: 1.3;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror li {
          margin: 0.25em 0;
        }
        .ProseMirror li p {
          margin: 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--border));
          padding-left: 1em;
          margin-left: 0;
          margin-right: 0;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
        .ProseMirror p {
          margin: 0;
        }
        .ProseMirror strong {
          font-weight: 700;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
        .ProseMirror img[data-align="left"] {
          float: left;
          margin-right: 1rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror img[data-align="center"] {
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .ProseMirror img[data-align="right"] {
          float: right;
          margin-left: 1rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
};
