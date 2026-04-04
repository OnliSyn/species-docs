---
name: onli-synth-scaffold
description: "Onli Synth React 프로젝트 초기화 및 디자인 시스템 구축. Vite + React 18 + TypeScript 프로젝트 설정, Tailwind CSS 디자인 토큰(#C5DE8A 그린, #2D2D2D CTA, Manrope 폰트, 20px 카드 radius), shadcn/ui 테마, 3-column 반응형 레이아웃 셸(사이드바 + 좌측 패널 + 메인 패널) 생성. 프로젝트 초기화, 스캐폴딩, 디자인 시스템 설정이 필요할 때 사용."
---

# Onli Synth Scaffold

Onli Synth 프로젝트의 초기 스캐폴딩과 디자인 시스템을 구축하는 스킬.

## 프로젝트 초기화

```bash
npm create vite@latest . -- --template react-ts
npm install
```

### 핵심 의존성

```bash
npm install tailwindcss @tailwindcss/vite
npm install zustand @tanstack/react-query
npm install recharts
npm install react-router-dom
npm install zod
npm install ai @ai-sdk/anthropic
```

shadcn/ui는 `npx shadcn@latest init`으로 설치한다. base color는 neutral, CSS variables 사용.

## 디자인 토큰

PRD Section 11의 토큰을 CSS 변수로 정의한다. `src/index.css`의 `:root`에 설정:

```css
:root {
  --color-bg-primary: #FFFFFF;
  --color-bg-card: #FAFAFA;
  --color-bg-sidebar: #F5F5F5;
  --color-cta-primary: #2D2D2D;
  --color-accent-green: #C5DE8A;
  --color-accent-amber: #FFCE73;
  --color-accent-red: #E74C3C;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-border: #E5E5E5;

  --radius-card: 20px;
  --radius-button: 12px;
  --radius-input: 10px;
  --padding-card: 24px;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.04);

  --font-family: 'Manrope', sans-serif;
}
```

Tailwind config에서 이 CSS 변수를 `theme.extend`에 매핑한다.

### 폰트 설정

Manrope를 Google Fonts에서 로드한다 (weights: 400, 500, 600, 700).

## 디렉토리 구조

```
src/
├── api/              # API 클라이언트 (marketsb.ts, species.ts, onli-cloud.ts)
├── components/       # 공유 UI 컴포넌트 (shadcn/ui 기반)
│   └── ui/           # shadcn/ui 컴포넌트
├── features/         # 기능별 모듈
│   ├── neich/        # Neich 탭 (USDC 펀딩)
│   ├── species/      # Species 탭 (자산 운용)
│   ├── chat/         # AI 채팅
│   ├── transactions/ # 트랜잭션 뷰
│   ├── assets/       # 자산 페이지
│   ├── assurance/    # 보증 대시보드
│   ├── analytics/    # 분석 대시보드
│   └── settings/     # 설정
├── hooks/            # 공유 TanStack Query 훅
├── stores/           # Zustand 스토어
├── types/            # 공유 TypeScript 타입
├── lib/              # 유틸리티 (amount.ts, format.ts, idempotency.ts)
└── layouts/          # 레이아웃 컴포넌트
```

## 레이아웃 셸

3-column 레이아웃: 사이드바(고정 240px) + 좌측 패널(380px) + 메인 패널(flex-1).

- 모바일에서 사이드바는 접힌다 (hamburger 메뉴)
- 좌측 패널과 메인 패널은 모바일에서 탭으로 전환
- 탑 헤더 바: frosted-glass backdrop blur, fixed position

## 라우팅

React Router v6+ 사용:

| Route | Page |
|-------|------|
| `/` | Home (Onli Synth dashboard) |
| `/assets` | Assets |
| `/transactions` | Transactions |
| `/assurance` | Assurance |
| `/contacts` | Contacts |
| `/analytics` | Analytics |
| `/settings` | Settings |

## 인증 컨텍스트

3중 인증 컨텍스트를 Zustand store로 관리:
- Platform auth (OAuth 2.0 JWT)
- Onli identity (Gene credential)
- Species marketplace (API key + HMAC)

Species 탭은 Platform auth + Onli identity가 모두 활성화되어야 접근 가능하다.
