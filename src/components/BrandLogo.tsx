import logoMain from "@/assets/trailblazer-logo-by-dockmaster.png.asset.json";
import logoApp from "@/assets/trailblazer-logo-by-dockmaster-app.png.asset.json";

export type BrandVariant = "auto" | "shield" | "wordmark" | "aspire" | "roommaster" | "trailblazer";

interface BrandLogoProps {
  variant?: BrandVariant;
  size?: "sm" | "md" | "lg" | "xl";
  /** @deprecated retained for legacy callers */
  showName?: boolean;
  className?: string;
  /** "app" = trimmed canvas with a larger By DockMaster endorsement (in-app headers) */
  artwork?: "full" | "app";
}

const sizeClasses = {
  sm: "h-16",
  md: "h-20",
  lg: "h-24",
  xl: "h-28",
};

export const BrandLogo = ({
  size = "lg",
  className = "",
  artwork = "full",
}: BrandLogoProps) => {
  const src = artwork === "app" ? logoApp.url : logoMain.url;
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={src}
        alt="Trailblazer"
        className={`${sizeClasses[size]} w-auto object-contain select-none drop-shadow-md`}
      />
    </div>
  );
};

export default BrandLogo;
