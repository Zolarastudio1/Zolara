# Zolara Design Tokens — Champagne Gold Palette

This file documents the core design tokens and how to use them in the codebase (Tailwind + CSS).

## Colors (hex)

- Obsidian: #2C2416 — dark backgrounds, primary text
- Alabaster: #FFF8F0 — light backgrounds
- Champagne (primary): #D4AF89 — primary brand color / buttons
- Gold Light: #E6D5AC — hover states, highlights
- Gold Dark: #B8956A — active / emphasis
- Rich Gold: #D4AF37 — CTA variants
- Bright Gold: #F4D03F — highlights
- Dark Goldenrod: #B8860B — pressed states
- Deep Navy: #1A1A2E — secondary backgrounds, contrast
- Coral Accent: #E94560 — attention-grabbing elements
- Background: #F8F9FA — page background
- Text Secondary: #64748B — subtle text / captions

## Status
- Success: #10B981
- Error: #EF4444
- Warning: #F59E0B
- Info: #3B82F6

## Background gradient
Use the `champagne-gradient` utility (Tailwind) or:
```
background: linear-gradient(135deg, #FFF8F0 0%, #F7E7CE 50%, #FFF8F0 100%);
```

## Typography
- Headings: Playfair Display (weights 400–800)
- Body: Inter (weights 300–700)

Suggested Tailwind usage:
- Headline: `font-display font-semibold tracking-wide` (use Playfair)
- Body: `font-sans text-base` (Inter)

## Glassmorphism helper
Use the `luxury-glass` utility class included in `src/index.css`:

```css
.luxury-glass {
  background: rgba(212, 175, 137, 0.15);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(212, 175, 137, 0.3);
}
```

## Shadows
- `.luxury-shadow` — primary luxury shadow preset
- `.stat-card-shadow` — subtle primary-tinted stat shadow

## Tailwind tokens available
Tailwind tokens were added to `tailwind.config.ts` under `extend.colors` and can be used like:

- `bg-champagne`, `text-obsidian`, `bg-alabaster`
- `text-text-secondary` (for caption text)
- `bg-rich-gold`, `bg-bright-gold`, `bg-deep-navy`, `bg-coral`
- Status utilities: `text-success`, `bg-warning`, etc.

## Examples
- Primary CTA button:
  - `bg-champagne hover:bg-gold-light text-white font-semibold rounded-lg px-4 py-2`

- Glass card:
  - `class="luxury-glass p-6 rounded-xl luxury-shadow"`

- Background section with gradient:
  - `class="bg-champagne-gradient py-12"

## Notes
- We keep CSS variables in `src/index.css` for dynamic theme toggling (dark mode). Tailwind tokens provide convenience classes for most UI elements. When you need runtime theme changes (e.g., dark mode toggles), prefer the CSS variables; for static utility usage, use the Tailwind color names.

