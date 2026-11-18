import { useEffect } from "react";

interface Props {
  settings?: {
    primary_color?: string | null;
    accent_color?: string | null;
    background_color?: string | null;
    text_color?: string | null;
    heading_font?: string | null;
    body_font?: string | null;
    button_radius?: string | null;
    custom_css?: string | null;
  } | null;
}

const GOOGLE_FONT_ID = "booking-brand-font";
const STYLE_ID = "booking-brand-vars";

function toFontUrl(fonts: string[]): string | null {
  const uniq = Array.from(new Set(fonts.filter(Boolean)));
  if (!uniq.length) return null;
  const families = uniq
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * Injects the customer's brand tokens (colors + fonts) so the public
 * booking pages feel like an extension of their own website.
 */
export default function PublicBrandStyle({ settings }: Props) {
  useEffect(() => {
    if (!settings) return;
    const {
      primary_color,
      accent_color,
      background_color,
      text_color,
      heading_font,
      body_font,
      button_radius,
      custom_css,
    } = settings;

    // Sanitize any user-authored CSS so it can't escape scope or run JS.
    const sanitized = (custom_css ?? "")
      .replace(/<\/?\s*(script|style|iframe)[^>]*>/gi, "")
      .replace(/expression\s*\(/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/@import[^;]*;/gi, "")
      .slice(0, 20000);

    // Fonts
    const fontUrl = toFontUrl([heading_font ?? "", body_font ?? ""]);
    let link = document.getElementById(GOOGLE_FONT_ID) as HTMLLinkElement | null;
    if (fontUrl) {
      if (!link) {
        link = document.createElement("link");
        link.id = GOOGLE_FONT_ID;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = fontUrl;
    } else if (link) {
      link.remove();
    }

    // CSS variables + typography overrides scoped to public booking pages
    const rules: string[] = [];
    if (background_color) rules.push(`background-color: ${background_color};`);
    if (text_color) rules.push(`color: ${text_color};`);
    if (body_font) rules.push(`font-family: "${body_font}", ui-sans-serif, system-ui, sans-serif;`);
    if (button_radius) rules.push(`--booking-radius: ${button_radius};`);

    const headingRule = heading_font
      ? `.booking-brand h1, .booking-brand h2, .booking-brand h3, .booking-brand h4 { font-family: "${heading_font}", ui-sans-serif, system-ui, sans-serif; }`
      : "";
    const radiusRule = button_radius
      ? `.booking-brand .btn, .booking-brand button, .booking-brand [data-slot="button"] { border-radius: ${button_radius}; }`
      : "";

    const css = `
      .booking-brand { ${rules.join(" ")} }
      ${headingRule}
      ${radiusRule}
      ${sanitized}
    `;

    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;

    return () => {
      // Leave fonts/vars in place while navigating between booking pages.
    };
  }, [settings]);

  return null;
}
