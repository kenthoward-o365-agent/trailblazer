# "By DockMaster" Endorsement Lockup

Add a small **By DockMaster** line (with the DockMaster flag mark from the uploaded logo) to the Trailblazer logo, delivered as **one combined image**, so Trailblazer stays dominant everywhere the brand appears.

## What changes

1. **Composite one logo image** (offline, deterministic — no AI text rendering, so the small type stays crisp):
   - Source: current `trailblazer-logo-main.png` (1536×1024, transparent).
   - Extract the navy/blue flag mark from the uploaded `logo-desktop.webp`.
   - Typeset "By DockMaster" in a small geometric sans in DockMaster navy, flag mark beside it.
   - Placement: tucked under the right portion of the "Trailblazer" wordmark (above the trail swoosh), roughly 10–12% of the wordmark height — clearly secondary.
   - Output: new transparent PNG at the same canvas size.

2. **Upload as a CDN asset** — `src/assets/trailblazer-logo-by-dockmaster.png.asset.json` (via `lovable-assets create`).

3. **Point `BrandLogo` at the new asset** — change the single import in `src/components/BrandLogo.tsx`. Because every surface uses `BrandLogo`, this one change updates:
   - Client app header (upper-left logo)
   - Internal/admin header
   - Login screen
   - OAuth consent / dashboard layouts

4. **Verify** in the browser: login screen (large size) and app header (small size) — confirm "By DockMaster" is legible but clearly subordinate at both scales; adjust size/placement if the small type vanishes at header scale.

## Technical details

- Composition done with PIL/ImageMagick in `/tmp` — crops the flag from the webp, renders text with a close-matching sans font, alpha-composites onto the Trailblazer artwork, trims/pads to keep the original 1536×1024 canvas so existing `h-*` sizing classes are unaffected.
- Only `BrandLogo.tsx` changes; no changes to headers, login page, or layout code.
- Original `trailblazer-logo-main` asset stays intact as a fallback.
