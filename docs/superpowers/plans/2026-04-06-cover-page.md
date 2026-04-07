# Cover Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cover/splash page with a live p5.js generative sphere animation that fades into the existing dashboard on "Enter Beta" click.

**Architecture:** A `CoverPage` component renders a 3-layer composition (p5.js background, sidebar cards, center CTA) inside a full-screen container. `page.tsx` gates between cover and dashboard using React state + localStorage. GSAP handles the crossfade transition. p5.js runs in instance mode inside a `useEffect` and is destroyed after transition.

**Tech Stack:** p5.js (npm), GSAP (existing), React state + localStorage, Next.js Image

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/CoverPage.tsx` | Create | Cover page UI: 3-layer composition, p5.js sketch, enter button |
| `src/app/page.tsx` | Modify | Gate between CoverPage and Dashboard, handle transition |
| `src/app/layout.tsx` | Modify | Add weight 200 to Manrope font import |

Asset already in repo: `public/images/onlisyn-avatar.jpeg`

---

### Task 1: Install p5.js and Add Font Weight

**Files:**
- Modify: `package.json` (add p5 dependency)
- Modify: `src/app/layout.tsx:6` (add weight 200)

- [ ] **Step 1: Install p5.js**

Run:
```bash
npm install p5
npm install -D @types/p5
```

- [ ] **Step 2: Add font weight 200 to Manrope import**

In `src/app/layout.tsx`, change line 6 from:
```typescript
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
```
to:
```typescript
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['200', '400', '500', '600', '700'] });
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx
git commit -m "chore: add p5.js dependency and Manrope weight 200"
```

---

### Task 2: Create CoverPage Component

**Files:**
- Create: `src/components/CoverPage.tsx`

- [ ] **Step 1: Create CoverPage component**

Create `src/components/CoverPage.tsx` with the full 3-layer cover page:

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type p5Type from 'p5';

interface CoverPageProps {
  onEnter: () => void;
}

export function CoverPage({ onEnter }: CoverPageProps) {
  const sphereRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5Type | null>(null);

  useEffect(() => {
    if (!sphereRef.current) return;

    let instance: p5Type | null = null;

    import('p5').then((p5Module) => {
      const p5 = p5Module.default;
      const host = sphereRef.current;
      if (!host) return;

      instance = new p5((p: p5Type) => {
        let w: number, h: number;

        p.setup = () => {
          w = host.offsetWidth;
          h = host.offsetHeight;
          const canvas = p.createCanvas(w, h);
          canvas.parent(host);
          p.background(239, 239, 242);
        };

        p.draw = () => {
          p.background(239, 239, 242, 25);
          p.translate(w / 2, h / 2.2);
          p.noFill();
          p.stroke(0, 10);
          p.strokeWeight(1);

          const time = p.frameCount * 0.008;
          const numLines = 80;
          const numPoints = 200;
          const angleX = p.frameCount * 0.002;
          const angleY = p.frameCount * 0.005;
          const scale = Math.min(w, h) * 0.45;

          for (let i = 0; i < numLines; i++) {
            const linePhase = (i / numLines) * p.TWO_PI;
            p.beginShape();
            for (let j = 0; j <= numPoints; j++) {
              const pointPhase = j / numPoints;
              const yOrig = p.map(pointPhase, 0, 1, -scale, scale);
              const envelope = p.sin(pointPhase * p.PI);
              const wave1 = p.sin(time + linePhase) * 60;
              const wave2 = p.sin(pointPhase * 8 + time * 2) * 40;
              const centerComplexity = p.pow(p.cos(pointPhase * p.PI - p.HALF_PI), 2) * 100;
              const wave3 = p.cos(linePhase * 4 - time) * centerComplexity;
              const radius = envelope * (wave1 + wave2 + wave3 + 60);

              const x = radius * p.cos(linePhase);
              const y = yOrig;
              const z = radius * p.sin(linePhase);

              const x1 = x * p.cos(angleY) - z * p.sin(angleY);
              const z1 = x * p.sin(angleY) + z * p.cos(angleY);
              const y2 = y * p.cos(angleX) - z1 * p.sin(angleX);

              p.vertex(x1, y2);
            }
            p.endShape();
          }
        };

        p.windowResized = () => {
          w = host.offsetWidth;
          h = host.offsetHeight;
          p.resizeCanvas(w, h);
          p.background(239, 239, 242);
        };
      });

      p5Ref.current = instance;
    });

    return () => {
      instance?.remove();
      p5Ref.current = null;
    };
  }, []);

  const destroySketch = useCallback(() => {
    p5Ref.current?.remove();
    p5Ref.current = null;
  }, []);

  return (
    <div className="cover-page fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-outer)] p-3">
      <div className="relative w-full h-full bg-[#EFEFF2] border-4 border-white rounded-3xl shadow-[54px_84px_182px_rgba(209,209,209,0.1)] overflow-hidden">

        {/* Layer 0: p5.js sphere */}
        <div ref={sphereRef} className="absolute inset-0 z-0 [&_canvas]:block [&_canvas]:!w-full [&_canvas]:!h-full" />

        {/* Layer 1: Sidebar cards */}
        <div className="absolute top-0 right-0 w-[300px] h-full p-6 flex flex-col gap-3 overflow-y-auto z-[1]">
          {/* Welcome card */}
          <div className="bg-white border border-[#EBEBEB] rounded-[20px] px-5 py-7">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#858585] mb-3">Welcome</p>
            <p className="text-[20px] font-semibold leading-[1.4] text-[#999]">
              <span className="text-[#C5A636]">Onli Ai</span>{' '}
              <span className="text-[#0A0A0A]">is a tool</span>, for creating{' '}
              <span className="text-[#0A0A0A]">Asset Classes and Appliances</span> for the{' '}
              <span className="text-[#C5A636]">Actual Possession</span> economy
            </p>
          </div>

          {/* Modes card */}
          <div className="bg-white border border-[#EBEBEB] rounded-[20px] px-4 py-5">
            <p className="text-[15px] text-[#525252] mb-1">Modes</p>
            <p className="text-[11px] text-black mb-3">use different modes to change context</p>
            <div className="flex bg-[#EBEBEB] rounded-full p-1">
              <span className="flex-1 text-center py-2.5 text-[13px] font-medium text-[#858585] rounded-full">Learn</span>
              <span className="flex-1 text-center py-2.5 text-[13px] font-medium text-[#858585] rounded-full">Develop</span>
              <span className="flex-1 text-center py-2.5 text-[13px] font-bold text-[#0A0A0A] rounded-full bg-white border border-[#E0E0E0] shadow-[0_2px_3px_rgba(10,13,18,0.05)]">Trade</span>
            </div>
          </div>

          {/* Playground card */}
          <div className="bg-[#F5F5F5] rounded-[20px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[20px]">&#10024;</span>
              <span className="text-[13px] font-bold text-[#474747]">Playground Access</span>
            </div>
            <p className="text-[11px] text-[#525252] leading-relaxed">
              Welcome to the Onli Synth Playground, a live simulation of the Onli Ai and Marketplace
              infrastructure. While the Species pipeline and Oracle systems are active, please note
              that all assets and USDC transactions are strictly simulated and intended for development only.
              Use this sandbox to freely experiment with the UI and test network functionality in a safe,
              non-commercial environment.
            </p>
          </div>

          {/* Avatar card */}
          <div className="relative rounded-[20px] overflow-hidden h-[220px] bg-black">
            <Image
              src="/images/onlisyn-avatar.jpeg"
              alt="ONLISYN"
              fill
              className="object-cover object-top"
              sizes="300px"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1] bg-white text-[#0A0A0A] text-[13px] font-semibold px-5 py-2 rounded-full whitespace-nowrap">
              ONLISYN
            </div>
          </div>
        </div>

        {/* Layer 2: Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-20 gap-5 z-[2] pointer-events-none">
          <h1 className="text-[42px] font-[200] text-[#0A0A0A] tracking-[-0.02em] leading-[1.25] pointer-events-auto">
            Welcome to Specie
          </h1>
          <button
            onClick={() => {
              destroySketch();
              onEnter();
            }}
            className="flex items-center justify-between min-w-[220px] px-7 py-5 bg-[#333] rounded-2xl text-white text-[15px] font-semibold shadow-[inset_0_1px_0_rgba(72,61,61,0.26)] hover:bg-[#444] transition-colors pointer-events-auto cursor-pointer"
          >
            <span>Enter</span>
            <span className="text-[12px] font-bold bg-[#474747] px-3 py-0.5 rounded-lg">Beta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CoverPage.tsx
git commit -m "feat: add CoverPage component with p5.js generative sphere"
```

---

### Task 3: Wire Cover Page into page.tsx with GSAP Crossfade

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update page.tsx to gate between cover and dashboard**

Replace the contents of `src/app/page.tsx` with:

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { gsap } from '@/lib/gsap-config';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnliAiPanel } from '@/components/OnliAiPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { SimulationDisclaimer } from '@/components/SimulationDisclaimer';
import { MobileGate } from '@/components/MobileGate';
import { CoverPage } from '@/components/CoverPage';

function hasEnteredBefore(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('onli-entered') === 'true';
}

export default function HomePage() {
  const [showCover, setShowCover] = useState(() => !hasEnteredBefore());
  const coverRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    const cover = coverRef.current;
    const dash = dashRef.current;
    if (!cover || !dash) {
      localStorage.setItem('onli-entered', 'true');
      setShowCover(false);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        localStorage.setItem('onli-entered', 'true');
        setShowCover(false);
      },
    });

    tl.to(cover, { opacity: 0, duration: 0.4, ease: 'power2.out' });
    tl.fromTo(dash, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.in' }, '-=0.2');
  }, []);

  return (
    <MobileGate>
      <SimulationDisclaimer />

      {/* Dashboard — always rendered, hidden behind cover initially */}
      <div ref={dashRef} style={{ opacity: showCover ? 0 : 1 }}>
        <DashboardLayout
          leftPanel={<OnliAiPanel />}
          centerPanel={<ChatPanel />}
          rightPanel={<RightPanel />}
        />
      </div>

      {/* Cover page overlay */}
      {showCover && (
        <div ref={coverRef}>
          <CoverPage onEnter={handleEnter} />
        </div>
      )}
    </MobileGate>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire cover page with GSAP crossfade transition to dashboard"
```

---

### Task 4: Visual Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Start dev server and verify cover page**

Start the dev server and open the app. Verify:
1. Cover page appears with animated p5.js wireframe sphere
2. Sidebar cards render correctly (Welcome, Modes, Playground, Avatar image)
3. "Welcome to Specie" heading is ultra-light weight
4. "Enter Beta" button is centered below heading

- [ ] **Step 2: Verify transition**

Click "Enter Beta":
1. Cover fades out smoothly (~400ms)
2. Dashboard fades in underneath
3. No flash or layout jump
4. p5.js canvas is destroyed (check no ongoing CPU usage)

- [ ] **Step 3: Verify localStorage skip**

Reload the page. The dashboard should appear directly (cover page skipped). Open DevTools > Application > Local Storage and verify `onli-entered` is `"true"`.

Clear `onli-entered` from localStorage and reload — cover page should reappear.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: cover page visual polish"
```
