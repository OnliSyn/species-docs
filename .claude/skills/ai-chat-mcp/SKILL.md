---
name: ai-chat-mcp
description: "Onli Synth 멀티모달 AI 채팅 — Vercel AI SDK(ai 패키지)의 useChat 훅 + streamText 서버 라우트로 구축. 텍스트 + 음성 입력(Web Speech API + SpeechSynthesis TTS), 듀얼 MCP 도구 표면(MarketSB + Species/Onli), maxSteps 기반 자동 도구 실행 루프, 확인 카드(금융/자산 변경 시 필수 승인), Ask/Trade/Learn 모드 탭. AI 채팅, useChat, streamText, 음성 입력, TTS, MCP 도구, 확인 카드, Vercel AI SDK 구현 시 반드시 사용."
---

# AI Chat — Vercel AI SDK + Multimodal

Onli Synth의 멀티모달(텍스트 + 음성) AI 채팅 인터페이스. Vercel AI SDK(`ai` 패키지)로 구축한다.

## 기술 스택

```bash
npm install ai @ai-sdk/anthropic zod
```

| 패키지 | 용도 |
|--------|------|
| `ai` | `useChat` 훅 (React), `streamText` (서버), 도구 정의 |
| `@ai-sdk/anthropic` | Claude provider (`createAnthropic`) |
| `zod` | 도구 파라미터 스키마 정의 |

모델: `claude-sonnet-4-6` (채팅 응답 속도 + 비용 균형). 복잡한 분석은 `claude-opus-4-6`으로 업그레이드 가능.

## 아키텍처

```
┌─ React Frontend ────────────────────────────────┐
│  useChat() ←→ /api/chat (POST)                  │
│  useSpeechToText() ──→ useChat.input             │
│  useTextToSpeech() ←── useChat.messages           │
│                                                   │
│  Confirmation Card UI ←── tool invocation results │
└───────────────────────────────────────────────────┘
         │
┌─ API Route (/api/chat) ──────────────────────────┐
│  streamText({                                     │
│    model: anthropic('claude-sonnet-4-6'),          │
│    tools: { ...marketsbTools, ...speciesTools },  │
│    maxSteps: 5,                                   │
│    system: systemPrompt(mode),                    │
│  })                                               │
└───────────────────────────────────────────────────┘
```

## 서버 라우트: `/api/chat`

```typescript
// src/app/api/chat/route.ts (또는 src/api/chat.ts for Express)
import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: Request) {
  const { messages, mode } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: getSystemPrompt(mode),  // Ask / Trade / Learn
    messages,
    tools: {
      // === READ TOOLS (자동 실행, 확인 불필요) ===
      get_virtual_account: tool({
        description: 'Fetch VA details + TigerBeetle balance',
        parameters: z.object({ va_id: z.string() }),
        execute: async ({ va_id }) => {
          const res = await fetch(`${MARKETSB_URL}/virtual-accounts/${va_id}`, { headers: authHeaders() });
          return res.json();
        },
      }),
      get_vault_balance: tool({
        description: 'Read Specie count in user Onli Vault',
        parameters: z.object({ user_id: z.string() }),
        execute: async ({ user_id }) => {
          const res = await fetch(`${ONLI_CLOUD_URL}/vaults/${user_id}/balance`, { headers: authHeaders() });
          return res.json();
        },
      }),
      // ... 나머지 read tools 동일 패턴

      // === WRITE TOOLS (execute 없음 → 프론트에서 확인 카드로 처리) ===
      submit_buy_order: tool({
        description: 'Buy Specie on the Species marketplace. Requires user confirmation.',
        parameters: z.object({
          quantity: z.number().int().positive(),
          payment_va_id: z.string(),
        }),
        // execute 없음 → Vercel AI SDK가 tool invocation만 반환
        // 프론트엔드에서 확인 카드를 렌더링하고 사용자 승인 후 별도 API 호출
      }),
      transfer_between_accounts: tool({
        description: 'Transfer USDC between VAs. Requires user confirmation.',
        parameters: z.object({
          source_va_id: z.string(),
          destination_va_id: z.string(),
          amount: z.string().describe('Amount in USDC base units (bigint string)'),
        }),
      }),
      // ... 나머지 write tools (execute 없음)
    },
    maxSteps: 5,  // read tool은 자동 루프, write tool은 확인 대기로 중단
  });

  return result.toDataStreamResponse();
}
```

### Write Tool의 확인 흐름

Vercel AI SDK에서 `execute` 함수가 없는 tool은 `tool-invocation` 결과만 반환하고 실행되지 않는다. 이를 활용한 확인 패턴:

1. Claude가 write tool을 호출 → `toolInvocation` 이 프론트엔드에 도달
2. 프론트엔드가 확인 카드를 렌더링
3. 사용자가 Confirm → 프론트엔드가 `addToolResult()`로 실행 결과를 전달
4. 사용자가 Cancel → 프론트엔드가 `addToolResult()`로 취소 결과를 전달

## 프론트엔드: useChat 통합

```typescript
// src/features/chat/hooks/useOnliChat.ts
import { useChat } from 'ai/react';

export function useOnliChat(mode: 'ask' | 'trade' | 'learn') {
  const chat = useChat({
    api: '/api/chat',
    body: { mode },
    maxSteps: 5,  // 클라이언트 측 maxSteps도 설정하여 자동 도구 루프 허용
  });

  return {
    ...chat,
    // 확인 카드용 헬퍼
    confirmToolCall: (toolCallId: string, result: unknown) => {
      chat.addToolResult({ toolCallId, result });
    },
    cancelToolCall: (toolCallId: string) => {
      chat.addToolResult({
        toolCallId,
        result: { cancelled: true, reason: 'User cancelled' },
      });
    },
  };
}
```

### 메시지 렌더링에서 도구 호출 처리

```tsx
// src/features/chat/components/ChatMessage.tsx
import type { Message } from 'ai';

function ChatMessage({ message }: { message: Message }) {
  return (
    <div>
      {/* 텍스트 파트 */}
      {message.parts?.filter(p => p.type === 'text').map((p, i) => (
        <MarkdownRenderer key={i} content={p.text} />
      ))}

      {/* 도구 호출 파트 — write tools만 확인 카드로 표시 */}
      {message.parts?.filter(p => p.type === 'tool-invocation').map((p, i) => {
        if (isWriteTool(p.toolName)) {
          return (
            <ConfirmationCard
              key={i}
              toolName={p.toolName}
              args={p.args}
              state={p.state}         // 'call' | 'result'
              onConfirm={() => confirmToolCall(p.toolCallId, executeTool(p))}
              onCancel={() => cancelToolCall(p.toolCallId)}
            />
          );
        }
        // read tool 결과는 시스템 표시기로 간략히 표시
        return <ToolResultBadge key={i} toolName={p.toolName} system={getToolSystem(p.toolName)} />;
      })}
    </div>
  );
}
```

## 멀티모달: 음성 입력 + TTS 출력

### 음성 입력 (Speech-to-Text)

Web Speech API (`SpeechRecognition`)를 사용한다. 브라우저 네이티브이므로 추가 패키지 불필요.

```typescript
// src/features/chat/hooks/useSpeechToText.ts
export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;  // 미지원 브라우저

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const current = event.results[event.results.length - 1];
      setTranscript(current[0].transcript);
      if (current.isFinal) {
        setIsListening(false);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening };
}
```

### TTS 출력 (Text-to-Speech)

`SpeechSynthesis` API로 어시스턴트 응답을 음성으로 출력한다:

```typescript
// src/features/chat/hooks/useTextToSpeech.ts
export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();  // 이전 발화 중단

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
}
```

### 음성/텍스트 통합 흐름

```
사용자가 🎤 탭 → useSpeechToText.startListening()
  → 음성 인식 → transcript을 useChat.input에 설정
  → 자동 또는 수동 전송 (Enter 또는 음성 종료 시 자동)
  → Claude 응답 수신
  → useTextToSpeech.speak(응답 텍스트)  [선택: 음성 모드일 때만]
```

## Chat UI 구조

### 레이아웃

```
┌─ Welcome State / Conversation View ─────────────────┐
│  [Transaction Protected 배지]                         │
│  "Welcome, {display_name}!"                           │
│  [Quick Action 1] [Quick Action 2]                    │
│  [Quick Action 3] [Quick Action 4]                    │
│  [대화 메시지들 + 확인 카드들...]                       │
├─ Input Bar ──────────────────────────────────────────┤
│  ✨ | "Ask AI to analyze your funding..."  | 🎤 | ➤  │
│      [음성 활성 시: 파형 애니메이션 + 🔴 중지 버튼]     │
├─ Mode Tabs ──────────────────────────────────────────┤
│  [ Ask ]  [ Trade ]  [ Learn ]                        │
└───────────────────────────────────────────────────────┘
```

### 메시지 스타일

- 사용자 텍스트: 어두운 배경, 우측 정렬
- 사용자 음성: 어두운 배경 + 🎤 아이콘, 우측 정렬
- 어시스턴트: 밝은 배경, 좌측 정렬
- 시스템 표시기: 메시지에 어떤 시스템을 쿼리했는지 (funding 아이콘 / asset 아이콘)
- Markdown 렌더링: 볼드, 리스트, 테이블, 코드 블록

## 듀얼 MCP 도구 표면

### Read Tools (자동 실행, maxSteps 루프 내 — 확인 불필요)

**MarketSB MCP:**
| Tool | 용도 |
|------|------|
| `get_virtual_account` | VA 상세 + TigerBeetle 잔액 |
| `list_virtual_accounts` | 사용자의 모든 VA 목록 |
| `get_deposit_status` | 입금 라이프사이클 상태 |
| `get_withdrawal_status` | 출금 라이프사이클 상태 |
| `query_oracle_ledger` | VA 감사 이력 |
| `get_wallet_balance` | 시스템 지갑 잔액 (운영자 전용) |
| `get_reconciliation_status` | 조정 상태 (운영자 전용) |

**Species/Onli MCP:**
| Tool | 용도 |
|------|------|
| `get_vault_balance` | Onli Vault Specie 수량 |
| `get_order_status` | Species 주문 라이프사이클 |
| `get_event_receipt` | 완료된 주문 영수증 |
| `get_marketplace_stats` | 마켓플레이스 집계 통계 |

### Write Tools (execute 없음 → 확인 카드 필수)

| Tool | 확인 카드 |
|------|----------|
| `transfer_between_accounts` | "Transfer $X USDC from {source} to {dest}? [Confirm / Cancel]" |
| `request_withdrawal` | "Withdraw $X USDC to {address}? [Confirm / Cancel]" |
| `submit_buy_order` | "Buy {N} SPECIES for ${cost} (fees: ${fees})? [Confirm / Cancel]" |
| `submit_sell_order` | "Sell {N} SPECIES for ${proceeds}? [Confirm / Cancel]" |
| `submit_transfer_order` | "Transfer {N} SPECIES to {recipient}? [Confirm / Cancel]" |

## Mode Tabs

| 모드 | 시스템 프롬프트 bias | 동작 |
|------|---------------------|------|
| **Ask** | Read 작업 우선 | 양쪽 시스템에서 정보 조회, 잔액 확인, 분석 |
| **Trade** | Write 도구 강조 | 주문 제출 인텐트 미리 로드, 수수료 미리보기 |
| **Learn** | 도구 사용 최소화 | Onli 개념 설명, Species 플로우 안내 |

## Quick Action Buttons

| 버튼 | Chat Seed (useChat.append 사용) |
|------|--------------------------------|
| Approve USDC deposit | "Show me pending deposits awaiting approval" |
| Check assurance gap | "What is my current assurance coverage gap?" |
| View wallet history | "Show my recent transaction history" |
| Escalate risk alert | "Flag the current coverage shortfall for review" |

## 확인 카드 컴포넌트

```tsx
interface ConfirmationCardProps {
  toolName: string;
  args: Record<string, unknown>;
  state: 'call' | 'partial-call' | 'result';
  onConfirm: () => void;
  onCancel: () => void;
}
```

상태 전이: `call` (대기 중) → 사용자가 Confirm → `addToolResult()` → `result` (실행됨)
