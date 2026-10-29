# DESIGN.md — MediTriage AI

## Visual Theme & Atmosphere
Light, bright, calm, premium. Think "private clinic lobby", not "hospital software" and never dark.
Warm white canvas, a whisper of teal wash at the top of hero areas, crisp navy ink, generous space,
hairline borders, soft layered shadows. Trust-forward: clinical honesty over decoration.
Glass is a garnish for floating layers only. No neumorphism. No dark mode.

## Color (all colors exist as CSS variables in frontend/src/styles/tokens.css; NEVER write a hex in components)
- Canvas: --bg #FBFAF7 (keep). New --bg-tint #F1F9F9 (teal wash for hero/section starts).
- Surface: --surface #FFFFFF. New --surface-raised #FFFFFF with --shadow-md.
- Ink: --ink #12263A. Muted: --muted #5B6B7A (keep; Elder #273746).
- Primary: --primary #0E7C86, hover #0a626a, soft #E4F3F4 (keep; this is the logo's teal family — the logo is NOT changed).
- New --accent-warm #C9A24B: decorative hairlines and small premium accents ONLY, never text or status.
- Triage (always icon + label + color): emergency #C62828/#FFEBEE, urgent #D97706/#FEF3C7, routine #1F6FB2/#E0F2FE, self-care #2E7D5B/#E8F5E9 (keep).
- New --border-control #7C8B99 for inputs/checkboxes (>= 3:1 on surface). --line stays for decorative dividers.
- Glass (new): --glass-bg rgba(255,255,255,.78), --glass-border rgba(255,255,255,.9), --glass-hairline rgba(18,38,58,.08), --glass-blur 16px.
- Gradients (new): --grad-hero linear-gradient(180deg, var(--bg-tint), var(--bg)); --grad-cta linear-gradient(135deg, #0E7C86, #0a626a) defined in tokens.css only.
- Contrast: body text 4.5:1, large 3:1, control borders 3:1, Elder Mode 7:1. Run `npm run audit:contrast` after any token change.

## Typography
- UI: Plus Jakarta Sans (400/500/600/700/800). Devanagari: Noto Sans Devanagari. Loaded with next/font/google (fix the broken @import).
- Display (H1/H2 on landing, app home, dashboard titles): Space Grotesk 600/700.
- Scale (rem): 0.8125 / 0.9375 / 1 / 1.125 / 1.375 / 1.75 / 2.5 / clamp(2.6, 6.4vw, 4.6).
- Line-height 1.55 body, 1.15 display; Devanagari body 1.7. Marathi/Hindi strings run ~30–40% longer: never fixed-width labels.
- Elder Mode: 20px base, 56px targets, no hover-only affordances.

## Spacing, Shape, Elevation
- 4px grid. Section rhythm 80/48/24. Max content 1200 (marketing), 1280 (dashboards), 720 (forms/wizard).
- Radius: 8 controls-small, 14 cards/inputs, 20 large panels, full for pills.
- Elevation: --shadow-sm (hairline), --shadow (card), --shadow-lg (popover/drawer). Define missing `shadow-xs` and `shadow-popover` as aliases in tailwind.config.ts.

## Components (anatomy and states are mandatory: default, hover, focus-visible, active, disabled, loading, error)
- Buttons: primary (filled teal), secondary (white + --border-control), ghost, danger. Min 44px (56px Elder). Focus ring 2px --primary with 2px offset.
- Inputs: 48px, label above, helper below, error text with icon (never color only), required marked with text.
- Cards: white, 1px --line, --shadow, 14px radius. Header area optional with icon chip on --primary-soft.
- Triage banner: solid tinted surface (never glass), icon + label + action. Emergency always shows tel:112 and the nearest-help link.
- Tables: solid white, sticky header, row hover --bg-tint, 44px rows, keyboard navigable, mobile = stacked cards.
- Chat: glass shell, solid message area. See P9.
- Empty/Loading/Error: use shared EmptyState/SkeletonLoader/ErrorState, restyled once.

## Motion
Tokens: --ease-out cubic-bezier(.2,.8,.2,1); --dur-fast 150ms; --dur-base 220ms; --dur-slow 400ms.
Only the uses listed in the Motion table of the prompt pack. All motion off under prefers-reduced-motion and [data-elder="true"].

## Iconography & Imagery
lucide-react, 1.75 stroke, 20px default. No emoji as icons. Existing logo SVGs are untouched (logo.svg, logo-icon.svg, favicon.svg).
Imagery: hero.mp4 stays on landing; elsewhere use abstract teal-tint shapes, never stock patient photos.

## Accessibility acceptance
WCAG 2.2 AA, keyboard complete, skip link, one h1 per page, landmarks, aria-live for async/chat, reduced-motion and reduced-transparency honored, status never color alone, Devanagari renders without clipping.

## Anti-patterns
Dark backgrounds. Hex in components. Glass on forms/tables. Neumorphic controls. Layout shift on locale switch. Spinners where skeletons fit. Double sticky headers. Lorem ipsum. Hardcoded localhost URLs.
