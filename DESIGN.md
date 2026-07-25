# Design Brief — Kiosk Ordering Redesign

## Direction

Bún Bò Huế 65 kiosk — immersive single-item carousel with dynamic background slideshow, frosted glass overlay, intelligent suggestion engine, and welcome idle screen. Premium food ordering experience on large touch displays (21–32 inch).

## Tone

Warm, focused, premium: full-screen background imagery with frosted glass card overlay, minimal UI chrome, red terracotta primary for active states and CTAs, smooth fade transitions between states.

## Differentiation

Full-screen slideshow background (nature imagery) with 35% dark overlay creates immersive, restaurant-quality experience. Single featured menu item (30% screen width) in frosted glass card (backdrop-blur-md, white-20% bg, white-30% border) sits left side. Auto-advancing carousel of 3 suggestions (add-ons + drinks) displays right. Idle welcome screen fades in after 30s inactivity. Horizontal swipe or arrow buttons advance through menu. All transitions use smooth crossfade (1000ms opacity).

## Color Palette

| Token | OKLCH | Role |
|---|---|---|
| primary | 0.5 0.22 27.33 | Red #DC2626 (action, active tabs, payment) |
| background | 0.97 0.015 75 | Warm cream (light theme fallback) |
| glass-bg-light | rgba(255,255,255,0.2) | Frosted glass background (light) |
| glass-bg-dark | rgba(0,0,0,0.3) | Frosted glass background (dark) |
| overlay-dark | rgba(0,0,0,0.35) | Slideshow overlay (darkens imagery) |

## Typography

- Display: Instrument Serif Italic — category names, welcome screen tagline
- Body: DM Sans — item names, prices, suggestion labels
- Scale: Item price `text-4xl font-bold text-primary`, Category `text-2xl font-semibold`, Label `text-sm uppercase`

## Elevation & Depth

Frosted glass card (`backdrop-blur-md bg-white/20 border-white/30 rounded-2xl`) creates layered depth over dark-overlay slideshow. Single shadow (`shadow-glass-subtle` 0 8px 32px rgba(0,0,0,0.1)) on glass card only. No additional shadows on components.

## Structural Zones

| Zone | Content | Background | Notes |
|---|---|---|---|
| Slideshow | Full-screen background images | Dark overlay 35% | Nature imagery, fade every 15s |
| Category Bar | Top 10% — icon/name/minPrice tabs | Frosted glass (`bg-white/20 backdrop-blur-md`) | Scroll horizontal, active tab red primary |
| Main Card | 30% width, left side — item image/+−buttons | Frosted glass overlay | Centered vertically, image prominent |
| Arrow Buttons | ← Main Card → | Semi-transparent | Navigate prev/next item |
| Suggestion Carousel | 70% width, right side — 5-6 items | Frosted glass (`bg-white/20`) | Horizontal scroll snap, auto-advance |
| Footer | Fixed 10% height — total + payment button | Frosted glass | Hidden when cart empty, red button |
| Idle Screen | Logo + "Chào mừng" + tap instructions | Default bg, no slideshow | Fades in after 30s, static |

## Spacing & Rhythm

Main card 30% screen width (65%-width on 65% available after 10% category bar), centered vertically. Suggestion carousel 70% width, scrollable horizontal. Arrow buttons positioned left/right of main card (16px offset). Footer fixed bottom 10%. 1.5rem gutters between sections. Idle screen centers all content vertically/horizontally with 2rem padding.

## Component Patterns

- **Frosted Glass Card**: `.glass` or `.glass-dark` — `backdrop-blur-md bg-white/20 border-white/30 rounded-2xl shadow-glass-subtle`
- **Category Tab**: Active state red primary (`bg-primary text-primary-foreground`), inactive muted
- **Carousel Item**: Image, name, price, `+ button` (red, prominent)
- **Main Item Card**: Large image (aspect-square), name (serif display), price (red, large), +/− buttons vertical right side
- **Payment Button**: Red primary, full-width footer, text-lg font-bold
- **Idle Screen**: Logo centered, serif display "Chào mừng đến Bún Bò Huế 65 — Chạm để bắt đầu", sans-serif subtitle, all text white on default bg

## Motion

- **Slideshow**: Crossfade between images, 1000ms opacity transition, 15s interval, pause on idle screen
- **Carousel**: Horizontal scroll snap, smooth scroll-behavior: smooth
- **State transitions**: 500ms fade-in for category bar, main card, carousel on return from idle
- **Idle entry**: 30s delay, fade-out components (opacity 0 to 1 over 500ms)
- **Swipe**: ≥50px + velocity detects next/prev, wraps around menu items

## Constraints

- All glass effects use CSS variables for opacity (no hardcoded rgba)
- Slideshow images load from backend or fallback Unsplash random API
- Frosted glass always uses `backdrop-blur-md` (12px blur)
- No full-page gradients; overlay is fixed dark 35% opacity
- Carousel auto-scrolls via JavaScript, not CSS animation
- Idle screen has NO slideshow in background — static default bg
- Touch targets ≥48px height on all interactive elements (category tabs, +/− buttons, payment button)
- Dark mode supported throughout (glass-dark variant, adjusted overlay)

## Dynamic QR Payment (Feature Extension)

Extends existing tokens (no redesign) for the Tingee dynamic QR payment screen and VA config form. Adds `--success` / `--warning` semantic tokens (absent from base palette) for paid/expired status badges, plus `--qr-surface` for high-contrast QR scannability.

### Added Tokens

| Token | Light OKLCH | Dark OKLCH | Role |
|---|---|---|---|
| success | 0.6 0.18 145 | 0.7 0.16 145 | Paid status badge, success confirmation |
| warning | 0.78 0.16 75 | 0.82 0.14 75 | Pending status badge (amber) |
| qr-surface | 1 0 0 | 0.98 0 0 | Pure-white QR display card for scannability |

### Dynamic QR UI Zones

| Zone | Treatment | Notes |
|---|---|---|
| QR Display Card | `bg-card` with `.qr-surface` inner padding, `shadow-glass-subtle`, `rounded-2xl` | Large QR (~280px), pure-white inner surface for scan reliability |
| Status Badge | `.qr-status-badge` with `.is-pending`/`.is-paid`/`.is-expired` modifiers | Pill shape, tinted bg at 15% opacity, colored border at 40% |
| Status Dot | `.qr-status-dot` with `animate-status-pulse` on pending only | 1.6s ease-in-out pulse, stops on paid/expired |
| Amount Display | `font-display italic text-4xl text-primary` | Instrument Serif italic, red primary |
| Order Ref Code | `font-mono text-sm text-muted-foreground` | JetBrains Mono, muted |
| Cancel Button | `.qr-cancel-btn` (solid) or `.qr-cancel-btn.is-ghost` (post-cancel) | Destructive tone, full-width, brightness hover |
| VA Form Field | Standard form input in BusinessProfile Tingee section | Manual entry, save action, no redesign of existing form |

### Motion

- Status pulse: pending dot pulses 1.6s; stops on paid/expired
- State transitions: 0.3s smooth (cubic-bezier 0.4,0,0.2,1) on badge/button state changes
- QR swap on regenerate: fade via existing `.crossfade`

### Constraints

- QR surface MUST stay pure-white in light mode for VietQR scannability
- Status badges use tinted backgrounds (15% opacity), never solid fills
- Cancel button disabled state at 0.5 opacity while delete in flight
- VA form reuses existing BusinessProfile form patterns — no new layout
- All new tokens are additive; existing palette and zones untouched

## Signature Detail

Frosted glass aesthetic (backdrop-blur + semi-transparent white/black overlay) transforms flat kiosk interface into immersive, premium ordering experience. Full-screen nature slideshow background beneath card overlay creates visual depth and appetite appeal, while keeping main interaction (item card + suggestions) sharp and focused. Red primary #DC2626 anchors payment flow and active states, creating visual thread to existing Bún Bò Huế 65 brand. Welcome idle screen with centered logo and tagline provides graceful fallback when display is unattended.
