# Cover Page with Transition to Dashboard

## Purpose
A cover/splash page that greets users before entering the Onli Synth dashboard. Features a live generative wireframe sphere animation, sidebar info cards, and a fade crossfade transition into the main 3-panel dashboard.

## Layout — 3-Layer Composition

The cover page uses the same outer container as the dashboard (`#EFEFF2` background, white border, 24px border-radius) but with layered content:

### Layer 0: p5.js Generative Sphere (Background)
- Full-bleed canvas covering the entire cover area
- p5.js instance mode sketch drawing a 3D wireframe sphere made of longitudinal 2D wave slices rotated around the Y-axis
- Background: `#EFEFF2` with trailing effect (`alpha: 25`) for motion blur
- Strokes: very fine, highly transparent black (`stroke(0, 10)`, `strokeWeight(1)`)
- 80 longitudinal lines, 200 points each
- Continuous rotation on X (`0.002 rad/frame`) and Y (`0.005 rad/frame`) axes
- Radius modulated by overlapping sine/cosine waves + envelope function
- Sphere centered horizontally, positioned slightly above vertical center (`h / 2.2`)
- Scales responsively: `Math.min(w, h) * 0.45`

### Layer 1: Sidebar Cards (Right Side)
Positioned absolute, `right: 0`, `width: 300px`, `z-index: 1`. Four cards stacked vertically with 12px gap:

1. **Welcome Card** — white bg, `WELCOME` label, styled text: "_Onli Ai_ **is a tool**, for creating **Asset Classes and Appliances** for the _Actual Possession_ economy". Accent color: `#C5A636`
2. **Modes Card** — title "Modes", subtitle "use different modes to change context", pill switch with Learn / Develop / Trade (Trade active)
3. **Playground Access Card** — `#F5F5F5` bg, sparkle icon + "Playground Access" title, description text about the simulation sandbox
4. **Avatar Card** — fixed 220px height, `onlisyn-avatar.jpeg` image with `object-fit: cover; object-position: center top`, white "ONLISYN" pill button overlaid at bottom center

### Layer 2: Center Content (Foreground)
Positioned absolute, centered horizontally, anchored to bottom (`padding-bottom: 80px`), `z-index: 2`:

- **Heading**: "Welcome to Specie" — `font-weight: 200` (ultra-light), `font-size: 42px`, `letter-spacing: -0.02em`, color `#0A0A0A`
- **Enter Button**: centered below heading, `min-width: 220px`, dark bg (`#333`), `border-radius: 16px`, `padding: 20px 28px`. "Enter" text left-justified, "Beta" badge right-justified (`justify-content: space-between`). Badge: `#474747` bg, `border-radius: 8px`, `font-weight: 700`, `font-size: 12px`

## Transition: Cover → Dashboard

**Type**: Fade crossfade
**Trigger**: Click "Enter Beta" button
**Behavior**:
1. Cover page fades out (`opacity: 1 → 0`, ~400ms, ease-out)
2. Dashboard fades in underneath (`opacity: 0 → 1`, ~400ms, ease-in)
3. p5.js sketch is destroyed (`.remove()`) after fade completes to free resources
4. Use GSAP timeline for coordinated animation (already configured in project)

**State**: Store `hasEntered` in localStorage so returning users skip directly to dashboard. First visit always shows cover.

## Typography
- Font: Manrope (already configured in the project)
- Heading weight: 200 (ultra-light) — requires adding weight `200` to the Manrope import in `layout.tsx`
- Card text weights: 400, 500, 600, 700 (already available)

## Assets
- `public/images/onlisyn-avatar.jpeg` — avatar image for the bottom sidebar card (already copied to repo)
- p5.js — loaded via CDN (`https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.min.js`) or installed as dependency

## Files to Create/Modify
1. `src/components/CoverPage.tsx` — new component with all 3 layers + p5.js sketch
2. `src/app/page.tsx` — wrap existing dashboard with cover page gate (show cover or dashboard based on `hasEntered` state)
3. `src/app/layout.tsx` — add weight `200` to Manrope font import

## p5.js Integration
- Use p5 instance mode (not global) to avoid conflicts with React
- Create sketch in a `useEffect`, attach to a ref'd container div
- Clean up with `p5Instance.remove()` on unmount and after transition
- Consider `react-p5` wrapper or raw p5 — raw p5 in useEffect is simpler and avoids extra dependencies

## Mockup Reference
Final approved mockup: `.superpowers/brainstorm/12256-1775534124/content/cover-mockup-v6.html`
