import * as React from "react";
import { cn, toTitleCase } from "@/lib/utils";

type AutoCapMode = "title" | "upper" | "none";

interface AutoCapInputProps extends React.ComponentProps<"input"> {
  autoCapMode?: AutoCapMode;
}

const AutoCapInput = React.forwardRef<HTMLInputElement, AutoCapInputProps>(
  ({ className, type, autoCapMode = "title", onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (autoCapMode === "title") {
        e.target.value = toTitleCase(e.target.value);
      } else if (autoCapMode === "upper") {
        e.target.value = e.target.value.toUpperCase();
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
AutoCapInput.displayName = "AutoCapInput";

export { AutoCapInput };
