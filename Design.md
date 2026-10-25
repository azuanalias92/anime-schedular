---
name: Nintendo
colors:
  primary: '#DBFADB'
  secondary: '#f68d1f'
  success: '#4a7c58'
  warning: '#ecab37'
  info: '#206479'
  danger: '#e60012'
  background: '#7a8aba'
  canvas: '#9fbee7'
  bone: '#c0d5e6'
  surface: '#ffffff'
  card: '#ffffff'
  dark: '#21242e'
  deep: '#3d4f97'
  foreground: '#21242e'
  ink: '#21242e'
  body: '#21242e'
  charcoal: '#121833'
  mute: '#1a1b30'
  ash: '#1a1b30'
  stone: '#6575a0'
  on-primary: '#050505'
  on-secondary: '#21242e'
  on-background: '#21242e'
  on-surface: '#21242e'
  on-dark: '#fcfcfc'
  on-dark-mute: 'rgba(252, 252, 252, 0.72)'
  hero-warm: '#acace7'
  hero-glow: '#c0d5e6'
  hero-pink: '#a7282b'
  badge-success: '#4a7c58'
  badge-warning: '#ecab37'
  badge-info: '#206479'
  link: '#121833'
  ring-focus: 'rgba(61, 79, 151, 0.5)'
  hairline: '#dedede'
  divider: '#60619c'
colors-dark:
  primary: '#DBFADB'
  secondary: '#f68d1f'
  success: '#4a7c58'
  warning: '#ecab37'
  info: '#206479'
  danger: '#e60012'
  background: '#1a1a1a'
  canvas: '#2a2a2a'
  bone: '#333333'
  surface: '#222222'
  card: '#222222'
  dark: '#0a0a0a'
  deep: '#111111'
  foreground: '#e8e8e8'
  ink: '#e8e8e8'
  body: '#d0d0d0'
  charcoal: '#c0c0c0'
  mute: '#979797'
  ash: '#909090'
  stone: '#979797'
  on-primary: '#050505'
  on-secondary: '#0a0a0a'
  on-background: '#e8e8e8'
  on-surface: '#e8e8e8'
  on-dark: '#fcfcfc'
  on-dark-mute: 'rgba(252, 252, 252, 0.72)'
  hero-warm: '#acace7'
  hero-glow: '#c0d5e6'
  hero-pink: '#a7282b'
  badge-success: '#4a7c58'
  badge-warning: '#ecab37'
  badge-info: '#206479'
  link: '#8ba1d4'
  ring-focus: 'rgba(139, 161, 212, 0.5)'
  hairline: '#1e1e1e'
  divider: '#727272'
typography:
  display-xl:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '44px'
    fontWeight: 900
    lineHeight: 1
    letterSpacing: 'normal'
  display-lg:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '24px'
    fontWeight: 900
    lineHeight: 1
    letterSpacing: 'normal'
  hero-tagline:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '15px'
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 'normal'
  nav-link:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '0.5px'
  ui-label:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '11px'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '0.5px'
  link:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12px'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 'normal'
  body-md:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 'normal'
  button-md:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '11px'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '0.5px'
  caption:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '10px'
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 'normal'
  code-md:
    fontFamily: "'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 'normal'
spacing:
  xxs: '2px'
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '32px'
  xxxl: '40px'
  section: '48px'
  band: '80px'
rounded:
  none: '0'
  xs: '2px'
  sm: '4px'
  md: '6px'
  lg: '10px'
  full: '9999px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button-md}'
    rounded: '{rounded.sm}'
    padding: '12px 24px'
    height: '36px'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.on-secondary}'
    typography: '{typography.button-md}'
    rounded: '{rounded.sm}'
    padding: '12px 24px'
    height: '36px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.button-md}'
    rounded: '{rounded.sm}'
    padding: '12px 24px'
    height: '36px'
  text-input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.body}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
    height: '36px'
  select:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.body}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
    height: '36px'
  checkbox:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.xs}'
    padding: '0'
    height: '16px'
  radio:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    typography: '{typography.body-md}'
    rounded: '{rounded.full}'
    padding: '0'
    height: '16px'
  badge:
    backgroundColor: '{colors.badge-success}'
    textColor: '{colors.on-dark}'
    typography: '{typography.caption}'
    rounded: '{rounded.xs}'
    padding: '2px 6px'
    height: '18px'
  card:
    backgroundColor: '{colors.surface-card}'
    textColor: '{colors.body}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: '16px'
    height: 'auto'
  modal:
    backgroundColor: '{colors.surface-card}'
    textColor: '{colors.body}'
    typography: '{typography.body-md}'
    rounded: '{rounded.md}'
    padding: '24px'
    height: 'auto'
  tooltip:
    backgroundColor: '{colors.surface-dark}'
    textColor: '{colors.on-dark}'
    typography: '{typography.caption}'
    rounded: '{rounded.xs}'
    padding: '4px 8px'
    height: 'auto'
  alert-success:
    backgroundColor: '{colors.success}'
    textColor: '{colors.on-dark}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
    height: 'auto'
  alert-warning:
    backgroundColor: '{colors.warning}'
    textColor: '{colors.on-dark}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
    height: 'auto'
  alert-danger:
    backgroundColor: '{colors.danger}'
    textColor: '{colors.on-dark}'
    typography: '{typography.body-md}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
    height: 'auto'
  progress:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    typography: '{typography.caption}'
    rounded: '{rounded.full}'
    padding: '0'
    height: '8px'
  tab:
    backgroundColor: '{colors.surface-card}'
    textColor: '{colors.ink}'
    typography: '{typography.ui-label}'
    rounded: '{rounded.none}'
    padding: '8px 16px'
    height: '36px'
  nav-bar:
    backgroundColor: '{colors.background}'
    textColor: '{colors.ink}'
    typography: '{typography.nav-link}'
    rounded: '{rounded.none}'
    padding: '0'
    height: '48px'
---

## Overview

Nintendo.com circa 2001 — a console hardware surface rendered as a web interface. This design system captures the tactile, industrial feel of early-2000s gaming hardware: cool metallic periwinkle chrome body panels, carbon-navy command surfaces, and rationed warm signal accents that command attention the way an LED on a console front panel tells you the machine is alive.

The palette reads like a GameCube that learned to browse the web. The background is not a sterile white canvas but a cool periwinkle grey-blue (`{colors.background}`), like the brushed-metal fascia of a console stacked in an entertainment center. Cards and content panels lift off this surface with beveled edges rather than soft shadows — light catching the raised rim of an injection-molded plastic plate. Typography runs tight and dense at 12px body copy, because in 2001 you fit more information on screen and your monitor was 800x600. This is not a design system that breathes; it's a design system that *functions* — every pixel earns its place like every transistor on a circuit board.

The emotional response should be one of **competent nostalgia**: this feels familiar to anyone who grew up navigating console menus, fan sites, and game strategy guides in the early 2000s. It's not nostalgic in a saccharine way — it's nostalgic in the way a startup chime or the feel of a controller's rubber thumbstick is nostalgic: tactile, immediate, earned.

---

## Colors

### Brand & Accent

The Nintendo theme operates on a **Scarce Signal Principle**: brand colors appear sparingly, like warning lights on a control panel. When they glow, you notice.

**Primary — Foam Mint (`{colors.primary}`)**: A pale, glowing mint (#DBFADB) — the same value as `--color-primary` in `src/index.css`. This is the single interactive accent — reserved for primary action buttons, key highlights, and the few moments the interface needs to say "push here." It never paints large surfaces; it marks targets.

**Secondary — Signal Orange (`{colors.secondary}`)**: A warm, amber-orange (#f68d1f) used for forward-progression actions: "next step," "continue," "launch." Think of it as the orange "Start" button on a console — it means go. The secondary never competes with primary mint for hierarchy; it operates one level below in the attention stack.

**Hero Accents** — Three atmospheric colors that form the hero gradient palette: `{colors.hero-warm}` (periwinkle lavender), `{colors.hero-glow}` (ice blue), and `{colors.hero-pink}` (deep crimson). These are reserved for full-bleed hero sections, mastheads, and brand-showcase moments where the interface needs to feel alive like a console home screen. They are decorative, not interactive.

### Surface

The surface system models layered plastic plates — each with a distinct tone and edge treatment.

| Token | Light | Role |
|-------|-------|------|
| `{colors.background}` | #7a8aba | Page-level canvas — cool periwinkle chrome, the console fascia |
| `{colors.canvas}` | #9fbee7 | Secondary canvas — lighter periwinkle, like an inner panel |
| `{colors.bone}` | #c0d5e6 | Inset canvas — pale blue-grey for nested surfaces |
| `{colors.surface}` | #ffffff | Default card/surface — the white label plate |
| `{colors.card}` | #ffffff | Card surfaces — content containers |
| `{colors.dark}` | #21242e | Dark command surface — carbon-navy, like a console's control strip |
| `{colors.deep}` | #3d4f97 | Deepest accent surface — saturated navy, used sparingly |

In dark mode, the entire chassis inverts: the periwinkle chrome becomes a near-black gunmetal (#1a1a1a), the carbon-navy becomes pure void (#0a0a0a), and card surfaces settle into warm dark greys (#222222). The hardware metaphor flips from "console in a well-lit room" to "console in a dark game den with only the power LED glowing."

| Token | Light | Dark |
|-------|-------|------|
| `{colors.background}` | #7a8aba | #1a1a1a |
| `{colors.canvas}` | #9fbee7 | #2a2a2a |
| `{colors.bone}` | #c0d5e6 | #333333 |
| `{colors.card}` | #ffffff | #222222 |
| `{colors.dark}` | #21242e | #0a0a0a |
| `{colors.deep}` | #3d4f97 | #111111 |

### Text

The text hierarchy is anchored by deep navy-charcoal rather than pure black — `{colors.ink}` and `{colors.body}` both resolve to #21242e, a near-black with blue undertone that echoes the periwinkle chassis. This creates a unified color temperature: text never feels like a separate layer, it reads as printed on the surface itself.

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `{colors.ink}` | #21242e | #e8e8e8 | Primary headings, nav items |
| `{colors.body}` | #21242e | #d0d0d0 | Body copy, long-form content |
| `{colors.charcoal}` | #121833 | #c0c0c0 | Secondary text, metadata |
| `{colors.mute}` | #1a1b30 | #979797 | Supporting/tertiary text |
| `{colors.ash}` | #1a1b30 | #909090 | Disabled text, placeholders |
| `{colors.stone}` | #6575a0 | #979797 | Subtle hints, micro labels |

The `{colors.on-dark}` (#fcfcfc) and `{colors.on-dark-mute}` (rgba(252,252,252,0.72)) tokens provide text contrast when content sits atop dark or deep surfaces — the console's info display overlaying a dark bezel.

### Semantic

- **Success** (`{colors.success}`): #4a7c58 — muted sage green, like a save-slot indicator. Confirmation without celebration.
- **Warning** (`{colors.warning}`): #ecab37 — amber utility energy. Not alarmist, but watchful.
- **Info** (`{colors.info}`): #206479 — systems teal. Data-level informational cues, not interactive.
- **Danger** (`{colors.danger}`): #e60012 — a dedicated signal red, kept separate from the mint primary so destructive actions are never confused with the main call to action.
- **Link** (`{colors.link}`): #121833 in light, #8ba1d4 in dark — deep navy links in light mode that sit within the text hierarchy rather than floating above it with an unrelated blue.

---

## Typography

### Font Family

The type is built on a single typeface: **Orbitron**, a geometric, squared display face with a sci-fi console character. It is self-hosted as a variable font (weights 400–900) from `/fonts/orbitron-latin-variable.woff2` and exposed through Tailwind's `--font-sans` token.

**Sans stack**: `'Orbitron', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — used for everything from display headlines to captions. Orbitron's wide, angular letterforms read like labels on hardware.

**One face everywhere**: the base layer applies `font-sans` to every element, pseudo-element and native control (including `::file-selector-button`), so code, inputs and buttons all render in Orbitron too. There is no separate mono stack.

### Hierarchy

The scale is intentionally compact — 10px to 44px — reflecting the information density of early-2000s interface design. Body copy runs at 12px because that was the readable standard on CRT monitors, and the system honors that constraint.

| Token | Font | Size | Weight | Line Ht | Letter Sp | Use |
|-------|------|------|--------|---------|-----------|-----|
| `{typography.display-xl}` | Orbitron | 44px | 900 | 1 | normal | Hero headlines, page titles — maximum impact, black weight |
| `{typography.display-lg}` | Orbitron | 24px | 900 | 1 | normal | Section headings — black weight for strong hierarchy |
| `{typography.hero-tagline}` | Orbitron | 15px | 700 | 1.3 | normal | Hero subtitles, taglines — bold but compact |
| `{typography.nav-link}` | Orbitron | 13px | 700 | 1 | 0.5px | Navigation items — bold, tight, tracked out slightly |
| `{typography.ui-label}` | Orbitron | 11px | 700 | 1.1 | 0.5px | Field labels, legend text — all-caps compatible, bold |
| `{typography.link}` | Orbitron | 12px | 700 | 1.4 | normal | Inline links — same size as body, distinguished by weight |
| `{typography.body-md}` | Orbitron | 12px | 400 | 1.4 | normal | Long-form body, descriptions — the reading size |
| `{typography.button-md}` | Orbitron | 11px | 700 | 1.1 | 0.5px | All buttons — dense, bold, tracked like a controller label |
| `{typography.caption}` | Orbitron | 10px | 400 | 1.3 | normal | Microcopy, timestamps, badges — smallest readable size |
| `{typography.code-md}` | Orbitron | 12px | 400 | 1.4 | normal | Inline code, system output — same face as the rest of the UI |

### Principles

**The Compact Information Density Principle**: At 12px body copy with 1.4 line height, a paragraph fits 40-50% more words per viewport than modern design systems. This is intentional — the interface prioritizes scanability and information access over generous whitespace. Console menus don't have margins; they have functions.

**The Self-Hosted Font Principle**: Orbitron is loaded offline through a single `@font-face` declaration with `font-display: swap`, so there is no third-party font request. Text renders immediately in the system fallback and swaps to Orbitron once the variable WOFF2 loads; `font-synthesis: none` prevents faux bold or italics.

**The Tracking-on-Navigation Principle**: Nav links and UI labels use `0.5px` letter-spacing to distinguish themselves from body content. This subtle tracking signals "this is an interface element, not prose" — like the engraved labels beneath buttons on a console shell.

### Note on Font Substitutes

If Orbitron fails to load, the stack falls back to the platform UI font (`ui-sans-serif`, `system-ui`, San Francisco, Segoe UI). Orbitron is noticeably wider than these fallbacks, so layouts must tolerate text getting narrower or wider without breaking. No functionality depends on Orbitron's exact glyph shapes.

Only the Latin subset is bundled. Non-Latin characters (e.g. Japanese anime titles) fall through to the system font.

---

## Layout & Spacing

### Semantic Spacing Scale

The spacing system follows a non-linear scale optimized for the dense, packed layout of a console interface. Every value exists on a 2px base, stepped at irregular intervals where the scale needs visual distinction.

| Token | Value | Use |
|-------|-------|-----|
| `{spacing.xxs}` | 2px | Hairline gutters, icon-text gaps, border inset |
| `{spacing.xs}` | 4px | Tight element spacing, radio/checkbox to label gap |
| `{spacing.sm}` | 8px | Adjacent element margin, button icon spacing |
| `{spacing.md}` | 12px | Default padding, field-to-label offset |
| `{spacing.lg}` | 16px | Card inner padding, section content inset |
| `{spacing.xl}` | 24px | Panel padding, modal inner margin |
| `{spacing.xxl}` | 32px | Component group separation |
| `{spacing.xxxl}` | 40px | Major section spacing within a page |
| `{spacing.section}` | 48px | Between distinct page sections |
| `{spacing.band}` | 80px | Maximum separation — hero-to-content, full-width bands |

### Grid

The layout uses a **fixed 12-column grid** with a maximum content width of 1200px (aligned to the 1024x768 target era). Columns gutter at `{spacing.lg}` (16px). The grid is deliberately narrow by modern standards — it matches the informational capacity of a console dashboard or a 2001-era portal page. Full-bleed hero sections and band elements may extend beyond the grid edge, but content panels snap to the column framework.

### Whitespace Philosophy

**The Packed Canvas Principle**: Whitespace is not a luxury here; it's a structural tool. Interior padding within cards uses `{spacing.lg}` (16px), not 24px or 32px. Between sections, `{spacing.section}` (48px) provides breathing room, but adjacent elements within a section live at `{spacing.md}` to `{spacing.lg}`. The layout feels dense but not cramped — think console settings screen, not magazine spread.

**The Fixed-Canvas Density Rule**: The layout does not reflow generously on larger screens. Instead, the grid centers within the viewport, and additional width translates to content area expansion for data-dense views (tables, grids, leaderboards). On smaller screens, the grid collapses but spacing values remain constant — no breakpoint-based spacing multiplication.

---

## Elevation & Depth

### Level Table

The Nintendo system rejects soft shadows in favor of **bevel-based depth** — an approach that mimics the physical edges of injection-molded plastic plates and inset console panels. Depth comes from edge highlights, not from diffuse blur.

| Level | Treatment | Use Case |
|-------|-----------|----------|
| `{elevation.level0}` | None | Page canvas, flat surfaces, backgrounds — no separation needed |
| `{elevation.level1}` | `inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(61,79,151,0.3)` | Card surfaces, buttons — subtle beveled edge with colored shadow matching the periwinkle chassis |
| `{elevation.level2}` | `inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(61,79,151,0.4)` | Elevated cards, dropdown panels — stronger bevel, deeper colored shadow |
| `{elevation.level3}` | `0 2px 8px rgba(33,36,46,0.5)` | Modals, popovers — shadow only, bevel removed, transitional layer |
| `{elevation.level4}` | `0 4px 16px rgba(33,36,46,0.5)` | Tooltips, floating action elements |
| `{elevation.level5}` | `0 8px 32px rgba(33,36,46,0.4)` | Highest layer — full-screen overlays, loading curtains |

Levels 1-2 use the **Bevel Highlight Pattern**: an `inset` white highlight on the top edge simulates light hitting the raised rim of a plastic plate. The shadow beneath uses a periwinkle tint (#3d4f97) rather than neutral black, because the chassis color bleeds into the depth separators — like a colored reflection on a glossy surface.

Levels 3-5 abandon the bevel and shift to pure dark shadows. This creates a clear visual break: elements that sit *on* the surface (beveled) vs. elements that float *above* the surface (shadowed). The dark mode variants increase shadow opacity to compensate for the darker surroundings (level 1 shadow goes to rgba(0,0,0,0.5) in dark mode).

### Decorative Depth

Beyond the elevation system, the interface uses two additional depth techniques:

**The Inner Panel Groove**: Surfaces like `{colors.bone}` and `{colors.canvas}` sit visually behind the card layer without using shadows. They simulate the recessed panel of a console tray — slightly lower perceived z-position than the card, achieved through color temperature alone.

**The Hero Band Halo**: Full-width hero sections sometimes incorporate a subtle glow at the bottom edge using `{colors.hero-glow}` as a feathered gradient transition. This creates an atmospheric soft-landing between the brand showcase area and the content below, without introducing a hard shadow line.

---

## Shapes

### Border Radius Scale

The system defaults to **sharp, chamfered corners** — squares with minimal or no rounding. This is a deliberate departure from the contemporary trend of generous pill-shaped radii. Console hardware from 2001 had crisp edges.

| Token | Value | Use |
|-------|-------|-----|
| `{rounded.none}` | 0 | Page sections, nav bars, tab bars, full-bleed containers — the default for structural elements |
| `{rounded.xs}` | 2px | Badges, tooltips, micro-labels — barely-there rounding, like a chamfered edge |
| `{rounded.sm}` | 4px | Buttons, inputs, cards — the workhorse radius, enough to soften without pill-shaping |
| `{rounded.md}` | 6px | Modals, panels — slightly more generous for floating containers |
| `{rounded.lg}` | 10px | Hero section callouts, featured cards — deliberate rounding for emphasis |
| `{rounded.full}` | 9999px | Checkbox indicators only — the sole use of complete roundness in the system |

**The Chamfer-First Principle**: When in doubt, use `{rounded.none}` or `{rounded.xs}`. Corners on structural elements (nav bars, tabs, sidebars, tables) remain square. Rounding is applied only to interactive and container elements to distinguish them from the structural chassis. A button gets `{rounded.sm}` (4px) not because we can't make it round, but because a square button with a 4px corner reads as a physical object mounted on the surface, not a soft blob.

### Photography Geometry

Images in this system follow **console-output aspect ratios**:

| Context | Aspect Ratio | Crop Behavior |
|---------|-------------|---------------|
| Hero banners | 16:9 or 21:9 | Full-bleed, center-cropped to maintain focal point |
| Game/thumbnail cards | 4:3 | Letterboxed within card — the classic CRT ratio |
| Avatar/user icons | 1:1 | Square with `{rounded.full}` (circle crop) |
| Gallery/list images | 16:9 | Full-width within container, top-cropped |
| Screenshot gallery | 4:3 (native) | Contained, no crop — respecting original console output |

Images never use rounded corners by default — they sit inside containers whose border radius is `{rounded.none}` or `{rounded.sm}`. The photography itself is rectangular and sharp-edged, like a screenshot beveled into a magazine layout.

---

## Components

### Buttons & Interaction

**Primary Button** (`{component.button-primary}`)
- Background: `{colors.primary}`, text: `{colors.on-primary}`
- Type: `{typography.button-md}` — 11px bold, 0.5px tracking
- Rounded: `{rounded.sm}` (4px), padding: 12px 24px, height: 36px
- Hover: `{colors.primary}` → #7AE582 (sky mint). Active/pressed: #4D9452 (ice green)
- Focus ring: `{colors.ring-focus}` (2px offset). Disabled: opacity 0.5, no hover
- The button's surface uses `{elevation.level1}` bevel (inset highlight + colored shadow) to read as a physical keycap

**Secondary Button** (`{component.button-secondary}`)
- Background: `{colors.secondary}`, text: `{colors.on-secondary}`
- Type: `{typography.button-md}`, rounded: `{rounded.sm}`
- Padding: 12px 24px, height: 36px
- Hover: #e07d0e, Active: #c96e00
- The orange signal sits one step below mint in visual hierarchy — use for "next" or "continue" actions

**Ghost Button** (`{component.button-ghost}`)
- Background: transparent, text: `{colors.ink}`
- Type: `{typography.button-md}`, rounded: `{rounded.sm}`
- Padding: 12px 24px, height: 36px
- Borders: 1px `{colors.hairline}` on hover. No border at rest
- Active: subtle background tint using `{colors.primary}` at 6% opacity

### Inputs & Selection

**Text Input** (`{component.text-input}`)
- Background: `{colors.surface}`, text: `{colors.body}`
- Type: `{typography.body-md}` — 12px regular, the standard reading size
- Rounded: `{rounded.sm}` (4px), padding: 8px 12px, height: 36px
- Border: 1px `{colors.hairline}`. Focus: 1px `{colors.deep}` + `{colors.ring-focus}` ring
- Placeholder: `{colors.stone}` (#6575a0). Disabled: background `{colors.bone}`, text at 40% opacity

**Select Dropdown** (`{component.select}`)
- Same dimensions as text input (36px height, `{rounded.sm}`, 8px 12px padding)
- Custom chevron arrow in `{colors.stone}`. Same focus/disabled behavior as inputs
- The select mimics a console game's option selector — compact, rectangular, utilitarian

**Checkbox** (`{component.checkbox}`)
- 16px × 16px surface in `{colors.surface}` with `{rounded.xs}` (2px) corners — a tiny chamfered plate
- Border: 1px `{colors.hairline}`. Checked: `{colors.primary}` fill with `{colors.on-primary}` checkmark
- Focus: `{colors.ring-focus}`. Disabled: `{colors.bone}` background

**Radio** (`{component.radio}`)
- 16px × 16px circle (1:1, `{rounded.full}`) in `{colors.surface}`
- Border: 1px `{colors.hairline}`. Checked: `{colors.primary}` outer ring with `{colors.on-primary}` dot
- Keep radio buttons scarce — the system prefers checkboxes for binary choices

### Chips & Controls

**Badge** (`{component.badge}`)
- Background: `{colors.badge-success}`, text: `{colors.on-dark}`
- Type: `{typography.caption}` — 10px regular, the smallest legible size
- Rounded: `{rounded.xs}` (2px), padding: 2px 6px, height: 18px
- Variants: `{colors.badge-warning}` (amber), `{colors.badge-info}` (teal)
- Badges are status indicators, not interactive elements. No hover, no focus

**Tab** (`{component.tab}`)
- Background: `{colors.surface-card}`, text: `{colors.ink}`
- Type: `{typography.ui-label}` — 11px bold, 0.5px tracking
- Rounded: `{rounded.none}` (0), padding: 8px 16px, height: 36px
- Active tab: bottom border 2px `{colors.primary}`. Hover: background shift to `{colors.bone}`
- Tabs have zero corner radius because they're structural dividers — they mount flush to the content panel below

### Data & Containers

**Card** (`{component.card}`)
- Background: `{colors.surface-card}`, text: `{colors.body}`
- Type: `{typography.body-md}`, rounded: `{rounded.sm}` (4px)
- Padding: 16px (inner), height: auto (content-driven)
- Elevation: `{elevation.level1}` — the beveled card sits on the canvas with a 1px inset highlight and colored shadow
- Cards never overlap. They sit in a grid with `{spacing.md}` (12px) gutters, each card its own raised plate

**Modal** (`{component.modal}`)
- Background: `{colors.surface-card}`, text: `{colors.body}`
- Type: `{typography.body-md}`, rounded: `{rounded.md}` (6px)
- Padding: 24px, height: auto
- Elevation: `{elevation.level3}` — modals float above the page with a dark shadow and no bevel
- Overlay backdrop: `{colors.overlay}` (rgba(33,36,46,0.6))

**Progress Bar** (`{component.progress}`)
- Track background: `{colors.surface}` (with `{colors.hairline}` border), fill: `{colors.primary}`
- Type: `{typography.caption}`, rounded: `{rounded.full}` (pill track)
- Height: 8px, no padding
- The progress bar is a groove in the surface with a mint fill — like a loading meter on a console boot screen

### Feedback Components

**Success Alert** (`{component.alert-success}`)
- Background: `{colors.success}`, text: `{colors.on-dark}`
- Type: `{typography.body-md}`, rounded: `{rounded.sm}` (4px)
- Padding: 12px 16px, height: auto
- Left icon: checkmark in `{colors.on-dark}`. No dismiss button by default

**Warning Alert** (`{component.alert-warning}`)
- Background: `{colors.warning}`, text: `{colors.on-dark}` (note: on-warning uses #21242e for contrast)
- Same padding and radius as success alert. Amber signals watchfulness

**Danger Alert** (`{component.alert-danger}`)
- Background: `{colors.danger}`, text: `{colors.on-dark}`
- Same dimensions. Uses `{colors.danger}` red rather than the mint primary — destructive feedback stays visually distinct from the main action

**Tooltip** (`{component.tooltip}`)
- Background: `{colors.surface-dark}`, text: `{colors.on-dark}`
- Type: `{typography.caption}`, rounded: `{rounded.xs}` (2px)
- Padding: 4px 8px, height: auto
- Elevation: `{elevation.level4}`. Arrow pointing down/up in `{colors.surface-dark}`
- Appears on hover after 300ms delay, disappears on hover out at 100ms

### Navigation

**Nav Bar** (`{component.nav-bar}`)
- Background: `{colors.background}`, text: `{colors.ink}`
- Type: `{typography.nav-link}` — 13px bold, 0.5px tracking
- Rounded: `{rounded.none}` (full-width structural bar), padding: 0, height: 48px
- Items are spaced at `{spacing.lg}` (16px) with `{spacing.md}` (12px) inner padding per link
- Active item: bottom border 2px `{colors.primary}`. Hover: background shift to `{colors.bone}`
- The nav bar is the console's front-panel button strip — fixed, always visible, every label legible

---

## Do's and Don'ts

### Do

- **Do use `{colors.primary}` (Foam Mint) exclusively for primary CTAs and key highlights.** It's the strongest signal in the system — ration it like a console's power LED.
- **Do use the bevel-based elevation (`{elevation.level1}` and `{elevation.level2}`) for all card and button surfaces.** The inset highlight creates the physical-plate feel that defines this system.
- **Do keep body copy at `{typography.body-md}` (12px, 1.4 line height).** The compact density is intentional — this is a data-rich interface, not an editorial layout.
- **Do use `{rounded.none}` or `{rounded.xs}` for structural elements (nav bars, tabs, table headers).** Sharp corners signal "this is the chassis, not a floating element."
- **Do apply the 0.5px tracking on nav links and UI labels.** It distinguishes interface labels from prose content.
- **Do reference every token value using `{token.path}` syntax** so the system remains machine-parseable and traceable to source.
- **Do use dark mode for optional user preference only** — the light mode (periwinkle chrome) is the default and the identity.

### Don't

- **Don't apply soft/neumorphic shadows (large blur, neutral black).** Use bevel-based depth with colored shadows matching the `{colors.background}` chassis tone.
- **Don't use pill-shaped corners (`{rounded.full}`) on buttons, inputs, or cards.** The system's identity is chamfered and rectilinear — pill shapes belong only to radio buttons and progress bars.
- **Don't introduce a second typeface.** Orbitron is the only font; load it from the self-hosted file, never from a third-party CDN.
- **Don't inflate spacing.** The scale maxes out at `{spacing.band}` (80px). Avoid adding 120px or 160px margins — this is not a minimalist editorial layout.
- **Don't use pure black (#000000) for text.** Always use `{colors.ink}` or `{colors.body}` (navy-tinted near-black) to maintain color temperature alignment with the periwinkle chassis.
- **Don't add a third brand accent beyond mint and orange.** The two-signal system (mint for act, orange for continue) is the entire interactive vocabulary — more colors dilute the meaning.
- **Don't round photography or image containers.** Let screenshots and graphics remain rectangular — they're content, not decorative elements.
- **Don't use `{colors.primary}` for hover states on non-primary elements.** The mint must stay scarce to preserve its attention-weight.

---

## Responsive Behavior

### Breakpoints

The system targets a minimum viewport of 800px (SVGA era) and scales down to mobile with a single breakpoint transition.

| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop (default) | ≥768px | 12-column grid, full nav bar, standard spacing, cards in multi-column grids |
| Mobile | <768px | 4-column grid, hamburger nav collapse, single-column card layout, reduced section spacing to `{spacing.xxl}` (32px) |
| Small Mobile | <400px | 2-column grid, stacked nav, touch-optimized 44px tap targets, reduced inner card padding to `{spacing.md}` (12px) |

The 768px breakpoint is narrow by modern standards because the original design target was 800×600 — the system was compact by nature and doesn't need dramatic reflow at wider viewports.

### Touch Targets

Minimum interactive target size is **36px × 36px** (the height of default buttons and inputs). This is tighter than the standard 44px recommendation because the system assumes a mix of pointer (mouse, stylus) and touch input — console controllers use a pointer cursor, not fingers.

On screens below 480px width, interactive targets expand to **44px minimum** to accommodate finger tapping. Button padding increases proportionally (from 12px 24px to 16px 28px) while maintaining the same typography and border radius.

### Collapsing Strategy

- **Nav Bar**: On mobile (<768px), the horizontal link strip collapses into a hamburger menu. The bar height remains 48px. The hamburger icon sits flush-right with `{spacing.lg}` inset.
- **Card Grids**: Multi-column card layouts collapse to single column below 768px. Card padding reduces from `{spacing.lg}` (16px) to `{spacing.md}` (12px).
- **Hero Sections**: Hero content stacks vertically (text above image) below 768px. The hero gradient band maintains its full width but reduces height by 40%.
- **Tables**: Data tables below 768px become horizontally scrollable within their container rather than reflowing. Column headers remain fixed on first column if needed.
- **Button Groups**: Button clusters (primary + secondary) stack vertically below 480px, with full-width buttons.

### Image Behavior

- **Hero images**: Full-bleed, 16:9 to 21:9 aspect ratio, center-cropped. On mobile, crop anchor shifts to center-top to keep faces/subjects visible.
- **Card thumbnails**: 4:3 aspect ratio, contained within card boundaries. On mobile, thumbnails reduce proportionally with card width.
- **Screenshots**: Native 4:3 console output, displayed at 1x (no DPR upscaling). The system does not assume retina assets — pixel art and retro screenshots look best at native resolution.
- **DPR handling**: Icons and logos use SVG where possible. Raster game screenshots are displayed at their native resolution and never upscaled beyond 2x. The interface respects the source resolution of vintage gaming assets.

---

## Iteration Guide

1. **Add or modify one component at a time.** Each component change should be traceable to a specific token update in `design-token.json`. Batch changes introduce cascading style conflicts that are hard to isolate.

2. **Always reference the canonical token path** in code and documentation. Use `{colors.primary}` not `#DBFADB`, `{typography.body-md}` not `12px`. This keeps the system machine-parseable and makes global changes a single token edit away.

3. **When introducing a new color variant, check if an existing semantic token covers the use case first.** Do you need a new badge color, or does `{colors.badge-info}` already serve the purpose? The palette is intentionally constrained — every addition increases cognitive load.

4. **Test the bevel depth in both light and dark modes.** The `{elevation.level1}` and `{elevation.level2}` inset highlights behave differently on white vs. dark surfaces. Verify that the 1px white highlight doesn't disappear on light backgrounds against bright content.

5. **Validate spacing changes against the console grid.** If you increase `{spacing.lg}` from 16px to 20px, does the 12-column grid still divide evenly? Spacing values should be compatible with the baseline grid alignment.

6. **Run validation after every edit.** Execute the theme-validation skill to check file counts, version conformance (v2.4.0), and Style Dictionary schema compliance. A token with a missing `type` field will break the entire pipeline.

7. **Document the why.** When adding a new component variant, write the rationale in the Components section of this document. Explaining the design decision prevents future contributors from reverting it based on personal preference.

8. **Preserve the scarce signal discipline.** Every time you add a new use of `{colors.primary}`, ask: "Does this element need to be the single most attention-grabbing thing on screen?" If not, use `{colors.secondary}` or a surface-level treatment instead.

9. **Keep photography rectangular.** Resist the urge to round image corners or add shadow to screenshots. The chamfered aesthetic of the interface is structural, not applied — let images remain sharp-edged windows into game content.

10. **Sync DesignSystem.md with token changes.** After any update to `design-token.json`, regenerate this document. The YAML front matter is the single source of truth — prose explanations must match.

---

## Known Gaps

- **Pressed/active component variants**: The component YAML front matter defines primary, secondary, and ghost button states, but pressed states are described only in prose. Dedicated `button-primary-pressed` and `button-secondary-pressed` tokens (with distinct `backgroundColor` and `elevation` values) should be formalized.
- **`{spacing.xxxl}` (40px) and `{spacing.band}` (80px)**: These are inferred from the geometric progression of the existing spacing scale. They have no explicit tokens in `design-token.json` — formalize them as official tokens if they see regular use.
- **Form error states**: Input error styling (red border, error message placement) is described for individual inputs but not standardized as a composable pattern with dedicated tokens.
- **Loading/skeleton states**: The system has no skeleton loading pattern. Components fall back to native browser loading behavior. A shimmer-skeleton token set and component spec should be added.
- **Focus-visible vs. focus behavior**: Focus ring usage is described generally but not broken into `:focus-visible` (keyboard) vs. `:focus` (mouse+keyboard) behavior. The ring-focus token should be paired with a `ring-focus-visible` variant for keyboard-only outlines.
- **Dropdown and select menus**: The select component is defined but the dropdown menu pattern (positioning, max-height, scrolling, item hover states) is not documented beyond basic select behavior.
- **Icon system**: No icon set is defined. The system currently relies on inline SVGs or unicode characters for checkmarks, chevrons, and hamburger icons. A standardized icon component with sizing tokens is needed.
- **Table component**: Data tables are referenced in responsive behavior but have no formal component definition (header style, row stripe, sort indicator, pagination).
- **Dark mode hero gradient**: The hero-warm/glow/pink colors remain identical in dark mode. This works visually, but a formal dark-mode hero variant should be evaluated for deeper atmospheric contrast.
