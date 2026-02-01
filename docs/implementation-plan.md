# VoiceNote Electron 데스크톱 앱 변환 구현 계획

**작성일:** 2026년 1월 27일
**프로젝트:** VoiceNote Speech-to-Text 음성인식 Electron 데스크톱 앱
**목표:** Next.js 웹 앱을 오프라인 지원 데스크톱 앱으로 변환

---

## 1. 프로젝트 개요

### 1.1 현황 분석
VoiceNote는 한국어 음성인식 웹 애플리케이션으로, Next.js 14+, TypeScript, PostgreSQL을 기반으로 구축되어 있습니다. 주요 기능은 다음과 같습니다:
- 음성 녹음 및 STT 변환
- LLM 기반 텍스트 정제
- 세션 관리
- 사용자 설정 및 권한 관리
- Chrome 확장 프로그램

### 1.2 Electron 데스크톱 앱으로의 변환 배경
- **오프라인 지원**: 인터넷 연결 없이도 기본 기능 사용 가능
- **더 나은 성능**: 로컬 시스템 리소스 직접 접근
- **사용자 경험 개선**: 전역 단축키, 시스템 트레이 통합, 클립보드 자동 붙여넣기
- **배포 간소화**: 웹 서버 운영 비용 절감
- **시스템 통합**: 운영체제 네이티브 기능 활용

### 1.3 주요 변경 사항
| 항목 | 웹 앱 | Electron 앱 |
|------|------|-----------|
| 데이터베이스 | PostgreSQL | SQLite (better-sqlite3) |
| 인증 | NextAuth.js | 로컬 사용자 또는 제거 |
| 서버 | Next.js API Routes | Electron Main Process |
| 확장 프로그램 | Chrome Extension | 전역 단축키 + 시스템 API |
| 배포 | 웹 서버 | electron-builder (DMG/NSIS) |

---

## 2. 기술 스택

### 2.1 핵심 기술
- **Electron 30+** - 데스크톱 애플리케이션 프레임워크
- **React 18+** - UI 렌더링
- **TypeScript 5+** - 타입 안정성
- **Vite** - 빌드 도구 (번들링 속도 향상)
- **Tailwind CSS 3+** - 스타일링
- **shadcn/ui** - UI 컴포넌트 라이브러리

### 2.2 데이터 및 API
- **better-sqlite3** - SQLite 동기 드라이버
- **Prisma** - ORM (마이그레이션 및 타입 안정성)
- **OpenAI SDK** - Whisper STT API
- **ElevenLabs SDK** - 대체 STT API
- **OpenAI Chat Completions** - 텍스트 정제 및 분류

### 2.3 IPC 및 시스템 통합
- **electron-store** - 로컬 설정 저장소
- **node-global-shortcut** - 전역 단축키 등록
- **node-fetch 또는 axios** - HTTP 요청 (API 호출)
- **audio-processing-library** - 오디오 처리 (필요시 ffmpeg)

### 2.4 빌드 및 배포
- **electron-builder** - 패키징 및 설치 프로그램
- **electron-updater** - 자동 업데이트
- **release-it** - 릴리즈 자동화 (선택사항)

---

## 3. 프로젝트 구조

```
app_stt_electron/
├── docs/
│   ├── implementation-plan.md        # 이 파일
│   ├── ARCHITECTURE.md               # 상세 아키텍처 설명
│   ├── IPC-PROTOCOL.md              # IPC 프로토콜 정의
│   └── DATABASE-SCHEMA.md           # SQLite 스키마 정의
├── src/
│   ├── main/                        # Main Process
│   │   ├── index.ts                # Main 진입점
│   │   ├── preload.ts              # Preload 스크립트 (보안)
│   │   ├── app.ts                  # App 초기화
│   │   ├── window.ts               # 윈도우 관리
│   │   ├── ipc/                    # IPC 핸들러
│   │   │   ├── audio.ts            # 오디오 녹음
│   │   │   ├── transcription.ts    # STT API 호출
│   │   │   ├── refinement.ts       # LLM 텍스트 정제
│   │   │   ├── session.ts          # 세션 데이터 CRUD
│   │   │   ├── user.ts             # 사용자 관리
│   │   │   └── settings.ts         # 설정 관리
│   │   ├── services/               # 비즈니스 로직
│   │   │   ├── audio-recorder.ts   # 오디오 녹음 클래스
│   │   │   ├── transcription.ts    # STT 통합
│   │   │   ├── llm-refiner.ts      # LLM 정제 로직
│   │   │   ├── database.ts         # DB 초기화 및 관리
│   │   │   └── api-client.ts       # API 호출 클라이언트
│   │   ├── shortcuts.ts            # 전역 단축키 관리
│   │   ├── tray.ts                 # 시스템 트레이 관리
│   │   └── clipboard.ts            # 클립보드 자동 붙여넣기
│   │
│   ├── renderer/                   # Renderer Process (React)
│   │   ├── index.tsx               # React 진입점
│   │   ├── App.tsx                 # 루트 컴포넌트
│   │   ├── preload.d.ts            # IPC 타입 정의
│   │   ├── pages/                  # 페이지 컴포넌트
│   │   │   ├── Dashboard.tsx       # 대시보드
│   │   │   ├── Recording.tsx       # 녹음 페이지
│   │   │   ├── SessionList.tsx     # 세션 목록
│   │   │   ├── SessionDetail.tsx   # 세션 상세
│   │   │   ├── Settings.tsx        # 사용자 설정
│   │   │   ├── Admin.tsx           # 관리자 페이지
│   │   │   └── Login.tsx           # 로그인 페이지
│   │   ├── components/             # 공용 컴포넌트
│   │   │   ├── Sidebar.tsx         # 사이드바
│   │   │   ├── Header.tsx          # 헤더
│   │   │   ├── AudioPlayer.tsx     # 오디오 플레이어
│   │   │   ├── Timeline.tsx        # 타임라인 뷰
│   │   │   └── shared/             # shadcn/ui 래퍼
│   │   ├── hooks/                  # 커스텀 React Hook
│   │   │   ├── useIPC.ts           # IPC 통신 Hook
│   │   │   ├── useRecording.ts     # 녹음 상태 관리
│   │   │   ├── useSession.ts       # 세션 데이터 관리
│   │   │   └── useAuth.ts          # 인증 상태
│   │   ├── context/                # React Context
│   │   │   ├── AuthContext.tsx     # 인증 컨텍스트
│   │   │   ├── SessionContext.tsx  # 세션 컨텍스트
│   │   │   └── SettingsContext.tsx # 설정 컨텍스트
│   │   ├── utils/                  # 유틸리티 함수
│   │   │   ├── api.ts              # API 클라이언트
│   │   │   ├── format.ts           # 포맷팅 함수
│   │   │   └── validators.ts       # 유효성 검사
│   │   └── styles/                 # 전역 스타일
│   │       └── globals.css         # Tailwind 기본 스타일
│   │
│   ├── common/                     # 공용 코드
│   │   ├── types/                  # 공유 타입 정의
│   │   │   ├── index.ts            # 메인 타입
│   │   │   ├── session.ts          # 세션 타입
│   │   │   ├── user.ts             # 사용자 타입
│   │   │   └── ipc.ts              # IPC 채널 타입
│   │   ├── constants.ts            # 상수 정의
│   │   └── errors.ts               # 에러 클래스
│   │
│   └── database/                   # 데이터베이스
│       ├── schema.prisma           # Prisma 스키마
│       ├── migrations/             # 마이그레이션 파일
│       ├── seed.ts                 # 초기 데이터 입력
│       └── init.ts                 # DB 초기화 스크립트
│
├── public/                         # 정적 자산
│   ├── icons/                      # 앱 아이콘
│   ├── images/                     # 이미지
│   └── locales/                    # i18n 다국어 지원
│
├── electron-builder/               # 빌드 설정
│   ├── build.yml                   # electron-builder 설정
│   ├── notarize.js                 # macOS 공증 스크립트
│   └── dmg-background.png          # DMG 배경 이미지
│
├── tests/                          # 테스트
│   ├── unit/                       # 단위 테스트
│   ├── integration/                # 통합 테스트
│   └── e2e/                        # E2E 테스트
│
├── .env.example                    # 환경변수 예제
├── .github/                        # GitHub Actions
│   └── workflows/
│       ├── build.yml               # 빌드 워크플로우
│       └── release.yml             # 릴리즈 워크플로우
├── package.json                    # 의존성 및 스크립트
├── tsconfig.json                   # TypeScript 설정
├── vite.config.ts                  # Vite 설정
├── tailwind.config.js              # Tailwind CSS 설정
├── postcss.config.js               # PostCSS 설정
├── electron-builder.yml            # electron-builder 메인 설정
└── README.md                       # 프로젝트 설명
```

---

## 4. Phase 1: 프로젝트 초기 설정

### 4.1 목표
- Electron 프로젝트 기본 구조 생성
- React + TypeScript + Vite 통합
- Tailwind CSS 및 shadcn/ui 설정
- 개발 환경 구성

### 4.2 세부 작업

#### 4.2.1 프로젝트 초기화
**파일 생성:**
- `package.json` - 의존성 및 빌드 스크립트 정의
- `tsconfig.json` - TypeScript 컴파일러 옵션
- `.env.example` - 환경변수 템플릿

**주요 의존성:**
```json
{
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^25.0.0",
    "vite": "^5.0.0",
    "react": "^18.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.3.0"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "electron-store": "^8.5.0",
    "node-global-shortcut": "^1.0.0",
    "axios": "^1.6.0"
  }
}
```

**설정 파일:**
```typescript
// tsconfig.json - Main과 Renderer 별도 설정
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler"
  }
}
```

#### 4.2.2 Electron 메인 프로세스 기본 구조
**파일 생성:**
- `src/main/index.ts` - Main 프로세스 진입점
- `src/main/app.ts` - Electron App 초기화
- `src/main/window.ts` - BrowserWindow 관리
- `src/main/preload.ts` - Preload 스크립트 (IPC 보안)

**핵심 구현:**
```typescript
// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { createWindow } from './window';

app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

```typescript
// src/main/preload.ts (보안: contextIsolation=true)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcInvoke: (channel: string, ...args: any[]) =>
    ipcRenderer.invoke(channel, ...args),
  ipcOn: (channel: string, listener: any) =>
    ipcRenderer.on(channel, listener),
  ipcOff: (channel: string, listener: any) =>
    ipcRenderer.off(channel, listener)
});
```

#### 4.2.3 React + Vite 렌더러 설정
**파일 생성:**
- `src/renderer/index.tsx` - React 진입점
- `src/renderer/App.tsx` - 루트 컴포넌트
- `src/renderer/main.html` - HTML 템플릿
- `vite.config.ts` - Vite 설정

**구성:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  }
});
```

#### 4.2.4 Tailwind CSS 및 shadcn/ui 설정
**파일 생성:**
- `tailwind.config.js` - Tailwind 설정
- `postcss.config.js` - PostCSS 설정
- `src/renderer/styles/globals.css` - 글로벌 스타일
- `components.json` - shadcn/ui 설정

**작업:**
```bash
# shadcn/ui 초기화 및 기본 컴포넌트 설치
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input card
```

#### 4.2.5 빌드 및 개발 스크립트
**package.json에 추가:**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:main\" \"npm run dev:renderer\"",
    "dev:main": "tsc src/main --outDir dist/main --watch",
    "dev:renderer": "vite",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "tsc src/main --outDir dist/main",
    "build:renderer": "vite build",
    "electron": "electron dist/main/index.js",
    "start": "npm run build && npm run electron"
  }
}
```

### 4.3 완료 기준
- [ ] Electron 앱 실행 가능 (빈 창 표시)
- [ ] React 렌더링 확인 (개발 모드)
- [ ] TypeScript 컴파일 정상 작동
- [ ] Tailwind CSS 스타일 적용 확인
- [ ] 개발 환경 핫 리로드 작동

### 4.4 다음 단계
Phase 2로 진행하기 전에 기본 개발 환경이 완전히 작동하는지 확인합니다.

---

## 5. Phase 2: 데이터베이스 설계

### 5.1 목표
- PostgreSQL 스키마를 SQLite로 변환
- Prisma ORM 설정 및 마이그레이션
- 데이터베이스 초기화 및 테스트

### 5.2 데이터베이스 스키마

#### 5.2.1 User (사용자)
```sql
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  passwordHash TEXT,
  role TEXT NOT NULL DEFAULT 'USER', -- USER, ADMIN, SUPER_ADMIN
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, SUSPENDED
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastLoginAt DATETIME,
  language TEXT DEFAULT 'ko'
);
```

#### 5.2.2 Session (세션/기록)
```sql
CREATE TABLE "Session" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT,
  description TEXT,
  originalText TEXT,
  refinedText TEXT,
  summary TEXT,
  audioPath TEXT, -- 로컬 오디오 파일 경로
  duration INTEGER, -- 밀리초
  language TEXT DEFAULT 'ko-KR',
  provider TEXT, -- 'openai', 'elevenlabs'
  model TEXT, -- 'whisper-1' 등
  formatType TEXT DEFAULT 'DEFAULT', -- DEFAULT, FORMATTED, SCRIPT, AUTO
  status TEXT DEFAULT 'DRAFT', -- DRAFT, COMPLETED, ARCHIVED
  tags TEXT[], -- JSON 배열
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX idx_session_userId ON "Session"(userId);
CREATE INDEX idx_session_createdAt ON "Session"(createdAt);
```

#### 5.2.3 UserSettings (사용자 설정)
```sql
CREATE TABLE "UserSettings" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE,
  pasteFormat TEXT DEFAULT 'FORMATTED', -- ORIGINAL, FORMATTED, SUMMARY
  autoFormatDetection BOOLEAN DEFAULT true,
  listDetection BOOLEAN DEFAULT true,
  markdownOutput BOOLEAN DEFAULT false,
  speakerDiarization BOOLEAN DEFAULT false,
  viewMode TEXT DEFAULT 'timeline', -- timeline, list
  preferredSTTProvider TEXT DEFAULT 'openai', -- openai, elevenlabs
  preferredLanguage TEXT DEFAULT 'ko-KR',
  autoSaveInterval INTEGER DEFAULT 5000, -- ms
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
);
```

#### 5.2.4 ActivityLog (활동 로그)
```sql
CREATE TABLE "ActivityLog" (
  id TEXT PRIMARY KEY,
  userId TEXT,
  action TEXT NOT NULL, -- 'record_start', 'record_end', 'transcribe', 'refine' 등
  details TEXT, -- JSON 형식의 상세 정보
  ipAddress TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX idx_activityLog_userId ON "ActivityLog"(userId);
CREATE INDEX idx_activityLog_createdAt ON "ActivityLog"(createdAt);
```

#### 5.2.5 SystemSetting (시스템 설정)
```sql
CREATE TABLE "SystemSetting" (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  type TEXT, -- 'string', 'number', 'boolean', 'json'
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 Prisma 스키마 파일

**파일 생성:**
- `src/database/schema.prisma`
- `src/database/seed.ts`
- `.env.example` (DATABASE_URL 추가)

**구성:**
```prisma
// src/database/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native"]
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  passwordHash String?
  role      String   @default("USER") // USER, ADMIN, SUPER_ADMIN
  status    String   @default("PENDING") // PENDING, APPROVED, REJECTED, SUSPENDED

  sessions  Session[]
  settings  UserSettings?
  logs      ActivityLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lastLoginAt DateTime?
  language  String   @default("ko")
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  title       String?
  description String?
  originalText String?
  refinedText String?
  summary     String?
  audioPath   String?
  duration    Int? // 밀리초
  language    String   @default("ko-KR")
  provider    String? // 'openai', 'elevenlabs'
  model       String? // 'whisper-1'
  formatType  String   @default("DEFAULT")
  status      String   @default("DRAFT")
  tags        String? // JSON 문자열로 저장

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([createdAt])
}

model UserSettings {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  pasteFormat String   @default("FORMATTED")
  autoFormatDetection Boolean @default(true)
  listDetection Boolean @default(true)
  markdownOutput Boolean @default(false)
  speakerDiarization Boolean @default(false)
  viewMode    String   @default("timeline")
  preferredSTTProvider String @default("openai")
  preferredLanguage String @default("ko-KR")
  autoSaveInterval Int @default(5000)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  action    String
  details   String?  // JSON
  ipAddress String?

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}

model SystemSetting {
  id          String   @id @default(cuid())
  key         String   @unique
  value       String?
  description String?
  type        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.4 데이터베이스 초기화 서비스

**파일 생성:**
- `src/main/services/database.ts`

```typescript
// src/main/services/database.ts
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { app } from 'electron';

let prisma: PrismaClient | null = null;

export async function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'voicenote.db');
  process.env.DATABASE_URL = `file:${dbPath}`;

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });

  // 마이그레이션 실행
  await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);

  // 초기 사용자 생성 (존재하지 않을 경우)
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.create({
      data: {
        email: 'user@voicenote.local',
        name: 'Default User',
        role: 'USER',
        status: 'APPROVED',
      },
    });
  }

  return prisma;
}

export function getDatabase(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized');
  }
  return prisma;
}

export async function closeDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}
```

### 5.5 마이그레이션 설정

**작업:**
```bash
# Prisma 초기 마이그레이션 생성
npx prisma migrate dev --name init

# Prisma 클라이언트 생성
npx prisma generate
```

### 5.6 완료 기준
- [ ] SQLite 데이터베이스 파일 생성됨
- [ ] Prisma 스키마 정의 완료
- [ ] 마이그레이션 성공적으로 실행됨
- [ ] 초기 사용자 데이터 생성됨
- [ ] 데이터베이스 쿼리 테스트 완료

---

## 6. Phase 3: 메인 프로세스 개발

### 6.1 목표
- IPC 채널 정의 및 핸들러 구현
- 오디오 녹음 기능 구현
- STT API 통합 (OpenAI Whisper, ElevenLabs)
- LLM 텍스트 정제 기능
- 데이터베이스 CRUD 작업

### 6.2 IPC 채널 정의

**파일 생성:**
- `src/common/types/ipc.ts` - IPC 채널 타입

```typescript
// src/common/types/ipc.ts
export const IPC_CHANNELS = {
  // 오디오
  AUDIO_START_RECORDING: 'audio:start-recording',
  AUDIO_STOP_RECORDING: 'audio:stop-recording',
  AUDIO_PAUSE_RECORDING: 'audio:pause-recording',
  AUDIO_RESUME_RECORDING: 'audio:resume-recording',
  AUDIO_RECORDING_STATE: 'audio:recording-state',

  // STT 변환
  TRANSCRIPTION_START: 'transcription:start',
  TRANSCRIPTION_PROGRESS: 'transcription:progress',
  TRANSCRIPTION_COMPLETE: 'transcription:complete',
  TRANSCRIPTION_ERROR: 'transcription:error',

  // 텍스트 정제
  REFINEMENT_START: 'refinement:start',
  REFINEMENT_COMPLETE: 'refinement:complete',
  REFINEMENT_ERROR: 'refinement:error',

  // 세션 관리
  SESSION_CREATE: 'session:create',
  SESSION_UPDATE: 'session:update',
  SESSION_DELETE: 'session:delete',
  SESSION_GET: 'session:get',
  SESSION_LIST: 'session:list',
  SESSION_SEARCH: 'session:search',

  // 사용자 설정
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // 시스템
  SYSTEM_GET_APP_VERSION: 'system:get-app-version',
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',
  SYSTEM_GET_LOGS: 'system:get-logs',
};

export interface RecordingState {
  isRecording: boolean;
  duration: number; // ms
  level: number; // 0-100 음량
}

export interface TranscriptionRequest {
  audioPath: string;
  language?: string;
  provider?: 'openai' | 'elevenlabs';
}

export interface RefinementRequest {
  text: string;
  formatType: 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO';
}
```

### 6.3 오디오 녹음 서비스

**파일 생성:**
- `src/main/services/audio-recorder.ts`

```typescript
// src/main/services/audio-recorder.ts
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface AudioRecorderOptions {
  sampleRate?: number;
  channelCount?: number;
  bitsPerSample?: number;
}

export class AudioRecorder extends EventEmitter {
  private isRecording = false;
  private chunks: Buffer[] = [];
  private sampleRate: number;
  private channelCount: number;

  constructor(options: AudioRecorderOptions = {}) {
    super();
    this.sampleRate = options.sampleRate || 16000;
    this.channelCount = options.channelCount || 1;
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }
    this.isRecording = true;
    this.chunks = [];
    this.emit('started');
  }

  async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }
    this.isRecording = false;

    const audioDir = path.join(app.getPath('userData'), 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filename = `recording-${Date.now()}.wav`;
    const filepath = path.join(audioDir, filename);

    // WAV 파일 저장 (실제 구현은 더 복잡함)
    // wavencoder 라이브러리 사용 권장
    fs.writeFileSync(filepath, Buffer.concat(this.chunks));

    this.emit('stopped', filepath);
    return filepath;
  }

  addAudioData(data: Buffer): void {
    if (this.isRecording) {
      this.chunks.push(data);
    }
  }

  isRecordingNow(): boolean {
    return this.isRecording;
  }
}
```

### 6.4 STT 서비스

**파일 생성:**
- `src/main/services/transcription.ts`

```typescript
// src/main/services/transcription.ts
import OpenAI from 'openai';
import * as fs from 'fs';

export interface TranscriptionOptions {
  provider: 'openai' | 'elevenlabs';
  language?: string;
}

export class TranscriptionService {
  private openaiClient: OpenAI;
  private openaiApiKey: string;
  private elevenlabsApiKey: string;

  constructor(openaiApiKey: string, elevenlabsApiKey?: string) {
    this.openaiApiKey = openaiApiKey;
    this.elevenlabsApiKey = elevenlabsApiKey || '';
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
  }

  async transcribe(audioPath: string, options: TranscriptionOptions = { provider: 'openai' }): Promise<string> {
    if (options.provider === 'openai') {
      return this.transcribeWithOpenAI(audioPath, options.language);
    } else if (options.provider === 'elevenlabs') {
      return this.transcribeWithElevenLabs(audioPath, options.language);
    }
    throw new Error(`Unknown provider: ${options.provider}`);
  }

  private async transcribeWithOpenAI(audioPath: string, language?: string): Promise<string> {
    const audioFile = fs.createReadStream(audioPath);
    const transcript = await this.openaiClient.audio.transcriptions.create({
      file: audioFile as any,
      model: 'whisper-1',
      language: language?.split('-')[0], // 'ko-KR' -> 'ko'
    });
    return transcript.text;
  }

  private async transcribeWithElevenLabs(audioPath: string, language?: string): Promise<string> {
    // ElevenLabs API 호출
    // 상세 구현은 ElevenLabs 문서 참고
    throw new Error('ElevenLabs transcription not yet implemented');
  }
}
```

### 6.5 LLM 정제 서비스

**파일 생성:**
- `src/main/services/llm-refiner.ts`

```typescript
// src/main/services/llm-refiner.ts
import OpenAI from 'openai';

export type FormatType = 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO';

export class LLMRefiner {
  private openaiClient: OpenAI;

  constructor(apiKey: string) {
    this.openaiClient = new OpenAI({ apiKey });
  }

  async refineText(text: string, formatType: FormatType): Promise<string> {
    const prompt = this.buildPrompt(text, formatType);

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '당신은 음성인식 텍스트 정제 전문가입니다. 문장 부호, 형식, 문체를 개선합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || text;
  }

  async summarizeText(text: string): Promise<string> {
    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '다음 텍스트의 간결한 요약을 한국어로 작성하세요.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
  }

  private buildPrompt(text: string, formatType: FormatType): string {
    const basePrompt = `다음 음성인식 텍스트를 정제하세요:\n\n${text}`;

    switch (formatType) {
      case 'FORMATTED':
        return `${basePrompt}\n\n요구사항:\n- 문장 부호 추가\n- 단락 나누기\n- 띄어쓰기 수정`;
      case 'SCRIPT':
        return `${basePrompt}\n\n스크립트 형식으로 정제하세요:\n- 등장인물 표기\n- 대사 형식\n- 시간표 추가`;
      case 'AUTO':
        return `${basePrompt}\n\n텍스트 성격을 파악하여 최적의 형식으로 정제하세요.`;
      case 'DEFAULT':
      default:
        return `${basePrompt}\n\n최소한의 문장 부호만 추가하세요.`;
    }
  }
}
```

### 6.6 IPC 핸들러 구현

**파일 생성:**
- `src/main/ipc/audio.ts`
- `src/main/ipc/transcription.ts`
- `src/main/ipc/session.ts`

```typescript
// src/main/ipc/audio.ts
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../common/types/ipc';
import { AudioRecorder } from '../services/audio-recorder';

let audioRecorder: AudioRecorder | null = null;

export function setupAudioIPC() {
  ipcMain.handle(IPC_CHANNELS.AUDIO_START_RECORDING, async () => {
    audioRecorder = new AudioRecorder();
    await audioRecorder.startRecording();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_STOP_RECORDING, async () => {
    if (!audioRecorder) {
      throw new Error('No active recording');
    }
    const audioPath = await audioRecorder.stopRecording();
    return { success: true, audioPath };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIO_RECORDING_STATE, () => {
    return {
      isRecording: audioRecorder?.isRecordingNow() || false,
      duration: 0, // 실제 구현에서는 경과 시간 반환
    };
  });
}
```

```typescript
// src/main/ipc/transcription.ts
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../common/types/ipc';
import { TranscriptionService } from '../services/transcription';

const transcriptionService = new TranscriptionService(
  process.env.OPENAI_API_KEY || ''
);

export function setupTranscriptionIPC() {
  ipcMain.handle(
    IPC_CHANNELS.TRANSCRIPTION_START,
    async (event, request: any) => {
      try {
        const text = await transcriptionService.transcribe(request.audioPath, {
          provider: request.provider || 'openai',
          language: request.language || 'ko-KR',
        });
        return { success: true, text };
      } catch (error) {
        throw new Error(`Transcription failed: ${error}`);
      }
    }
  );
}
```

```typescript
// src/main/ipc/session.ts
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../common/types/ipc';
import { getDatabase } from '../services/database';
import { ActivityLogger } from '../services/activity-logger';

const logger = new ActivityLogger();

export function setupSessionIPC() {
  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (event, sessionData: any) => {
    const db = getDatabase();
    const session = await db.session.create({
      data: {
        userId: sessionData.userId,
        title: sessionData.title,
        originalText: sessionData.originalText,
        refinedText: sessionData.refinedText,
        audioPath: sessionData.audioPath,
        duration: sessionData.duration,
        provider: sessionData.provider,
        model: sessionData.model,
      },
    });

    await logger.log(sessionData.userId, 'session_create', {
      sessionId: session.id,
    });

    return session;
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async (event, filter: any) => {
    const db = getDatabase();
    const sessions = await db.session.findMany({
      where: {
        userId: filter.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filter.limit || 20,
      skip: filter.offset || 0,
    });
    return sessions;
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, async (event, sessionId: string) => {
    const db = getDatabase();
    return db.session.findUnique({
      where: { id: sessionId },
    });
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE, async (event, sessionData: any) => {
    const db = getDatabase();
    return db.session.update({
      where: { id: sessionData.id },
      data: sessionData,
    });
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (event, sessionId: string) => {
    const db = getDatabase();
    return db.session.delete({
      where: { id: sessionId },
    });
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_SEARCH, async (event, query: string) => {
    const db = getDatabase();
    return db.session.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { originalText: { contains: query } },
          { refinedText: { contains: query } },
        ],
      },
      take: 50,
    });
  });
}
```

### 6.7 메인 프로세스 초기화

**파일 수정:**
- `src/main/index.ts` - 모든 IPC 핸들러 등록

```typescript
// src/main/index.ts
import { app } from 'electron';
import { createWindow } from './window';
import { initializeDatabase, closeDatabase } from './services/database';
import { setupAudioIPC } from './ipc/audio';
import { setupTranscriptionIPC } from './ipc/transcription';
import { setupSessionIPC } from './ipc/session';
import { setupSettingsIPC } from './ipc/settings';

app.on('ready', async () => {
  await initializeDatabase();

  setupAudioIPC();
  setupTranscriptionIPC();
  setupSessionIPC();
  setupSettingsIPC();

  createWindow();
});

app.on('quit', async () => {
  await closeDatabase();
});
```

### 6.8 완료 기준
- [ ] 모든 IPC 채널 정의됨
- [ ] 오디오 녹음 기능 구현 및 테스트 완료
- [ ] STT API 통합 완료 (OpenAI Whisper)
- [ ] LLM 정제 기능 구현 완료
- [ ] 데이터베이스 CRUD 작업 완료
- [ ] 활동 로그 기능 구현

---

## 7. Phase 4: 렌더러 프로세스 (UI) 개발

### 7.1 목표
- React 컴포넌트 구조 설계
- 페이지 라우팅 구현
- shadcn/ui 컴포넌트 활용
- 상태 관리 (Context API 또는 Zustand)
- IPC 통신 Hook 구현

### 7.2 라우팅 구조

**구현 방식:** React Router v6 (또는 TanStack Router)

```typescript
// src/renderer/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import RecordingPage from './pages/Recording';
import SessionListPage from './pages/SessionList';
import SessionDetailPage from './pages/SessionDetail';
import SettingsPage from './pages/Settings';
import AdminPage from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/recording"
            element={
              <PrivateRoute>
                <RecordingPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/sessions"
            element={
              <PrivateRoute>
                <SessionListPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/sessions/:sessionId"
            element={
              <PrivateRoute>
                <SessionDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <SettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

### 7.3 IPC 통신 Hook

**파일 생성:**
- `src/renderer/hooks/useIPC.ts`
- `src/renderer/hooks/useRecording.ts`
- `src/renderer/hooks/useSession.ts`

```typescript
// src/renderer/hooks/useIPC.ts
import { useCallback } from 'react';

declare global {
  interface Window {
    electron: {
      ipcInvoke: (channel: string, ...args: any[]) => Promise<any>;
      ipcOn: (channel: string, listener: any) => void;
      ipcOff: (channel: string, listener: any) => void;
    };
  }
}

export function useIPC() {
  const invoke = useCallback((channel: string, ...args: any[]) => {
    if (!window.electron) {
      throw new Error('IPC not available');
    }
    return window.electron.ipcInvoke(channel, ...args);
  }, []);

  const on = useCallback((channel: string, listener: any) => {
    window.electron?.ipcOn(channel, listener);
  }, []);

  const off = useCallback((channel: string, listener: any) => {
    window.electron?.ipcOff(channel, listener);
  }, []);

  return { invoke, on, off };
}
```

```typescript
// src/renderer/hooks/useRecording.ts
import { useState, useCallback, useEffect } from 'react';
import { useIPC } from './useIPC';
import { IPC_CHANNELS } from '../../common/types/ipc';

export function useRecording() {
  const { invoke, on, off } = useIPC();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const startRecording = useCallback(async () => {
    try {
      await invoke(IPC_CHANNELS.AUDIO_START_RECORDING);
      setIsRecording(true);
      setDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [invoke]);

  const stopRecording = useCallback(async () => {
    try {
      const result = await invoke(IPC_CHANNELS.AUDIO_STOP_RECORDING);
      setIsRecording(false);
      return result.audioPath;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      throw error;
    }
  }, [invoke]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setDuration((d) => d + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording]);

  return { isRecording, duration, startRecording, stopRecording };
}
```

```typescript
// src/renderer/hooks/useSession.ts
import { useState, useCallback, useEffect } from 'react';
import { useIPC } from './useIPC';
import { IPC_CHANNELS } from '../../common/types/ipc';

export interface Session {
  id: string;
  title?: string;
  originalText?: string;
  refinedText?: string;
  duration?: number;
  createdAt: string;
  status: string;
}

export function useSession() {
  const { invoke } = useIPC();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async (userId: string, limit = 20, offset = 0) => {
    setLoading(true);
    try {
      const result = await invoke(IPC_CHANNELS.SESSION_LIST, {
        userId,
        limit,
        offset,
      });
      setSessions(result);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  const createSession = useCallback(
    async (sessionData: any) => {
      try {
        const result = await invoke(IPC_CHANNELS.SESSION_CREATE, sessionData);
        setSessions((prev) => [result, ...prev]);
        return result;
      } catch (error) {
        console.error('Failed to create session:', error);
        throw error;
      }
    },
    [invoke]
  );

  const updateSession = useCallback(
    async (sessionId: string, updates: any) => {
      try {
        const result = await invoke(IPC_CHANNELS.SESSION_UPDATE, {
          id: sessionId,
          ...updates,
        });
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? result : s))
        );
        return result;
      } catch (error) {
        console.error('Failed to update session:', error);
        throw error;
      }
    },
    [invoke]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await invoke(IPC_CHANNELS.SESSION_DELETE, sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } catch (error) {
        console.error('Failed to delete session:', error);
        throw error;
      }
    },
    [invoke]
  );

  return {
    sessions,
    loading,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
  };
}
```

### 7.4 주요 페이지 컴포넌트

**파일 생성:**
- `src/renderer/pages/Dashboard.tsx`
- `src/renderer/pages/Recording.tsx`
- `src/renderer/pages/SessionList.tsx`
- `src/renderer/pages/SessionDetail.tsx`
- `src/renderer/pages/Settings.tsx`

```typescript
// src/renderer/pages/Recording.tsx
import { useState, useEffect } from 'react';
import { useRecording } from '../hooks/useRecording';
import { useIPC } from '../hooks/useIPC';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { IPC_CHANNELS } from '../../common/types/ipc';

export default function RecordingPage() {
  const { isRecording, duration, startRecording, stopRecording } = useRecording();
  const { invoke } = useIPC();
  const [transcribedText, setTranscribedText] = useState('');
  const [refinedText, setRefinedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleStopAndTranscribe = async () => {
    try {
      const audioPath = await stopRecording();
      setIsTranscribing(true);

      // STT 변환
      const transcription = await invoke(IPC_CHANNELS.TRANSCRIPTION_START, {
        audioPath,
        provider: 'openai',
        language: 'ko-KR',
      });

      setTranscribedText(transcription.text);

      // 텍스트 정제
      const refinement = await invoke(IPC_CHANNELS.REFINEMENT_START, {
        text: transcription.text,
        formatType: 'FORMATTED',
      });

      setRefinedText(refinement.text);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">음성 녹음</h1>

        {/* 녹음 시간 표시 */}
        <div className="text-6xl font-mono text-center mb-8">
          {formatDuration(duration)}
        </div>

        {/* 녹음 버튼 */}
        <div className="flex gap-4 justify-center mb-8">
          {!isRecording ? (
            <Button onClick={startRecording} size="lg" className="bg-red-600 hover:bg-red-700">
              녹음 시작
            </Button>
          ) : (
            <Button
              onClick={handleStopAndTranscribe}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
              disabled={isTranscribing}
            >
              {isTranscribing ? '변환 중...' : '녹음 중지'}
            </Button>
          )}
        </div>

        {/* 변환된 텍스트 */}
        {transcribedText && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">원본 텍스트</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              {transcribedText}
            </div>
          </div>
        )}

        {/* 정제된 텍스트 */}
        {refinedText && (
          <div>
            <h2 className="text-lg font-semibold mb-2">정제된 텍스트</h2>
            <div className="bg-blue-50 p-4 rounded-lg">
              {refinedText}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
```

### 7.5 레이아웃 컴포넌트

**파일 생성:**
- `src/renderer/components/Layout.tsx`
- `src/renderer/components/Sidebar.tsx`
- `src/renderer/components/Header.tsx`

```typescript
// src/renderer/components/Layout.tsx
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 7.6 완료 기준
- [ ] 라우팅 구조 완성
- [ ] 모든 페이지 컴포넌트 구현 완료
- [ ] IPC 통신 Hook 구현 완료
- [ ] UI 레이아웃 완성
- [ ] 상태 관리 시스템 작동 확인

---

## 8. Phase 5: 핵심 기능 구현

### 8.1 목표
- 통합 녹음-변환-정제 워크플로우 완성
- 세션 관리 기능 완성
- 검색 및 필터링 기능
- 내보내기 기능 (텍스트, PDF, 오디오)
- 타임라인 뷰 구현

### 8.2 녹음-변환-정제 워크플로우

**파일 생성:**
- `src/renderer/pages/Recording.tsx` (확장)
- `src/main/services/workflow.ts`

```typescript
// src/main/services/workflow.ts
import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { AudioRecorder } from './audio-recorder';
import { TranscriptionService } from './transcription';
import { LLMRefiner } from './llm-refiner';
import { getDatabase } from './database';

export interface WorkflowOptions {
  title?: string;
  description?: string;
  formatType: 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO';
  provider: 'openai' | 'elevenlabs';
  language: string;
  userId: string;
}

export class RecordingWorkflow extends EventEmitter {
  private audioRecorder: AudioRecorder;
  private transcriptionService: TranscriptionService;
  private llmRefiner: LLMRefiner;
  private window: BrowserWindow;

  constructor(
    window: BrowserWindow,
    openaiApiKey: string,
    elevenlabsApiKey?: string
  ) {
    super();
    this.window = window;
    this.audioRecorder = new AudioRecorder();
    this.transcriptionService = new TranscriptionService(openaiApiKey, elevenlabsApiKey);
    this.llmRefiner = new LLMRefiner(openaiApiKey);
  }

  async execute(options: WorkflowOptions): Promise<string> {
    try {
      // 1단계: 녹음
      this.emit('step', { stage: 'recording', status: 'started' });
      await this.audioRecorder.startRecording();

      this.window.webContents.send('workflow:status', {
        stage: 'recording',
        message: '녹음 중...',
      });

      // 사용자가 녹음 중지할 때까지 대기
      const audioPath = await new Promise<string>((resolve) => {
        this.once('recording:stop', (path) => resolve(path));
      });

      this.emit('step', { stage: 'recording', status: 'completed', audioPath });

      // 2단계: STT 변환
      this.emit('step', { stage: 'transcription', status: 'started' });
      this.window.webContents.send('workflow:status', {
        stage: 'transcription',
        message: 'STT 변환 중...',
      });

      const transcribedText = await this.transcriptionService.transcribe(
        audioPath,
        {
          provider: options.provider,
          language: options.language,
        }
      );

      this.emit('step', {
        stage: 'transcription',
        status: 'completed',
        text: transcribedText,
      });

      // 3단계: 텍스트 정제
      this.emit('step', { stage: 'refinement', status: 'started' });
      this.window.webContents.send('workflow:status', {
        stage: 'refinement',
        message: '텍스트 정제 중...',
      });

      const refinedText = await this.llmRefiner.refineText(
        transcribedText,
        options.formatType
      );

      this.emit('step', {
        stage: 'refinement',
        status: 'completed',
        text: refinedText,
      });

      // 4단계: 요약 생성 (선택사항)
      const summary = await this.llmRefiner.summarizeText(refinedText);

      // 5단계: 데이터베이스에 저장
      this.emit('step', { stage: 'saving', status: 'started' });
      const db = getDatabase();
      const session = await db.session.create({
        data: {
          userId: options.userId,
          title: options.title,
          description: options.description,
          audioPath,
          originalText: transcribedText,
          refinedText,
          summary,
          duration: 0, // 실제 녹음 시간으로 채우기
          language: options.language,
          provider: options.provider,
          model: 'whisper-1',
          formatType: options.formatType,
          status: 'COMPLETED',
        },
      });

      this.emit('step', {
        stage: 'saving',
        status: 'completed',
        sessionId: session.id,
      });

      this.window.webContents.send('workflow:complete', {
        sessionId: session.id,
        message: '녹음 변환이 완료되었습니다.',
      });

      return session.id;
    } catch (error) {
      this.emit('error', error);
      this.window.webContents.send('workflow:error', {
        message: `오류 발생: ${error}`,
      });
      throw error;
    }
  }

  stopRecording(audioPath: string) {
    this.emit('recording:stop', audioPath);
  }
}
```

### 8.3 세션 상세 페이지

**파일 생성:**
- `src/renderer/pages/SessionDetail.tsx`
- `src/renderer/components/AudioPlayer.tsx`
- `src/renderer/components/Timeline.tsx`

```typescript
// src/renderer/pages/SessionDetail.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useIPC } from '../hooks/useIPC';
import { IPC_CHANNELS } from '../../common/types/ipc';
import AudioPlayer from '../components/AudioPlayer';
import Timeline from '../components/Timeline';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { invoke } = useIPC();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await invoke(IPC_CHANNELS.SESSION_GET, sessionId);
        setSession(data);
      } catch (error) {
        console.error('Failed to fetch session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, invoke]);

  if (loading) return <div>로딩 중...</div>;
  if (!session) return <div>세션을 찾을 수 없습니다.</div>;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">{session.title}</h1>

        {/* 오디오 플레이어 */}
        {session.audioPath && (
          <AudioPlayer audioPath={session.audioPath} />
        )}

        {/* 타임라인 */}
        <Timeline text={session.refinedText} />

        {/* 원본 텍스트 */}
        <Card className="p-4 mt-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">원본 텍스트</h2>
          <div className="whitespace-pre-wrap">{session.originalText}</div>
        </Card>

        {/* 정제된 텍스트 */}
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">정제된 텍스트</h2>
          <div className="whitespace-pre-wrap">{session.refinedText}</div>
        </Card>

        {/* 요약 */}
        {session.summary && (
          <Card className="p-4 mb-6">
            <h2 className="text-lg font-semibold mb-2">요약</h2>
            <div>{session.summary}</div>
          </Card>
        )}

        {/* 작업 버튼 */}
        <div className="flex gap-4">
          <Button>텍스트 복사</Button>
          <Button variant="outline">PDF 내보내기</Button>
          <Button variant="outline">마크다운 내보내기</Button>
          <Button variant="destructive">삭제</Button>
        </div>
      </div>
    </div>
  );
}
```

### 8.4 내보내기 기능

**파일 생성:**
- `src/main/services/exporter.ts`
- `src/main/ipc/export.ts`

```typescript
// src/main/services/exporter.ts
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class SessionExporter {
  async exportAsText(sessionData: any, outputPath: string): Promise<void> {
    const content = `제목: ${sessionData.title}
작성일: ${new Date(sessionData.createdAt).toLocaleString('ko-KR')}
지속시간: ${this.formatDuration(sessionData.duration)}

${sessionData.refinedText}
`;
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  async exportAsMarkdown(sessionData: any, outputPath: string): Promise<void> {
    const content = `# ${sessionData.title}

**작성일:** ${new Date(sessionData.createdAt).toLocaleString('ko-KR')}
**지속시간:** ${this.formatDuration(sessionData.duration)}

## 요약
${sessionData.summary || '(요약 없음)'}

## 전문
${sessionData.refinedText}
`;
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  async exportAsPDF(sessionData: any, outputPath: string): Promise<void> {
    // PDFKit 또는 other 라이브러리 사용
    // 상세 구현은 선택한 라이브러리에 따라 다름
    throw new Error('PDF export not yet implemented');
  }

  private formatDuration(ms: number | undefined): string {
    if (!ms) return '0:00:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
```

### 8.5 검색 및 필터링

**파일 생성:**
- `src/renderer/pages/SessionList.tsx` (확장)

```typescript
// src/renderer/pages/SessionList.tsx
import { useState, useEffect } from 'react';
import { useSession } from '../hooks/useSession';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export default function SessionListPage() {
  const { user } = useAuth();
  const { sessions, fetchSessions } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'DRAFT' | 'COMPLETED' | 'ARCHIVED'>('ALL');

  useEffect(() => {
    if (user) {
      fetchSessions(user.id);
    }
  }, [user, fetchSessions]);

  const filteredSessions = sessions
    .filter((s) => filterStatus === 'ALL' || s.status === filterStatus)
    .filter((s) =>
      !searchQuery ||
      s.title?.includes(searchQuery) ||
      s.originalText?.includes(searchQuery) ||
      s.refinedText?.includes(searchQuery)
    );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">녹음 세션</h1>

      {/* 검색 바 */}
      <div className="mb-6 flex gap-4">
        <Input
          placeholder="제목이나 텍스트로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button>검색</Button>
      </div>

      {/* 필터 */}
      <div className="mb-6 flex gap-2">
        {(['ALL', 'DRAFT', 'COMPLETED', 'ARCHIVED'] as const).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            onClick={() => setFilterStatus(status)}
          >
            {status === 'ALL' ? '전체' : status === 'DRAFT' ? '임시저장' : status === 'COMPLETED' ? '완료' : '보관'}
          </Button>
        ))}
      </div>

      {/* 세션 목록 */}
      <div className="grid gap-4">
        {filteredSessions.map((session) => (
          <Card key={session.id} className="p-4 cursor-pointer hover:shadow-lg transition">
            <h3 className="text-lg font-semibold">{session.title || '제목 없음'}</h3>
            <p className="text-gray-600 text-sm mt-1">
              {new Date(session.createdAt).toLocaleString('ko-KR')}
            </p>
            <p className="text-gray-500 text-sm mt-2 line-clamp-2">
              {session.refinedText || session.originalText || '변환된 텍스트 없음'}
            </p>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                {session.status}
              </span>
              <span className="text-xs text-gray-500">
                {session.duration ? `${Math.round(session.duration / 1000)}초` : '-'}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {filteredSessions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          세션이 없습니다.
        </div>
      )}
    </div>
  );
}
```

### 8.6 완료 기준
- [ ] 녹음-변환-정제 워크플로우 완성
- [ ] 세션 상세 페이지 기능 완성
- [ ] 검색 및 필터링 기능 작동
- [ ] 내보내기 기능 (텍스트, 마크다운) 완성
- [ ] 타임라인 뷰 구현 완료

---

## 9. Phase 6: 관리자 기능

### 9.1 목표
- 관리자 패널 구현
- 사용자 관리 기능
- 시스템 설정 관리
- 활동 로그 조회
- 통계 및 분석

### 9.2 관리자 페이지 구조

**파일 생성:**
- `src/renderer/pages/Admin.tsx`
- `src/renderer/pages/admin/UserManagement.tsx`
- `src/renderer/pages/admin/SystemSettings.tsx`
- `src/renderer/pages/admin/ActivityLogs.tsx`
- `src/renderer/pages/admin/Statistics.tsx`

```typescript
// src/renderer/pages/Admin.tsx
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import UserManagement from './admin/UserManagement';
import SystemSettings from './admin/SystemSettings';
import ActivityLogs from './admin/ActivityLogs';
import Statistics from './admin/Statistics';

export default function AdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">관리자 패널</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">사용자 관리</TabsTrigger>
          <TabsTrigger value="settings">시스템 설정</TabsTrigger>
          <TabsTrigger value="logs">활동 로그</TabsTrigger>
          <TabsTrigger value="stats">통계</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="settings">
          <SystemSettings />
        </TabsContent>

        <TabsContent value="logs">
          <ActivityLogs />
        </TabsContent>

        <TabsContent value="stats">
          <Statistics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

```typescript
// src/renderer/pages/admin/UserManagement.tsx
import { useState, useEffect } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '../../../common/types/ipc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export default function UserManagement() {
  const { invoke } = useIPC();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // IPC 채널 필요: USER_LIST
        const result = await invoke('user:list');
        setUsers(result);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [invoke]);

  const handleApproveUser = async (userId: string) => {
    try {
      await invoke('user:update', {
        userId,
        status: 'APPROVED',
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'APPROVED' } : u))
      );
    } catch (error) {
      console.error('Failed to approve user:', error);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      await invoke('user:update', {
        userId,
        status: 'REJECTED',
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'REJECTED' } : u))
      );
    } catch (error) {
      console.error('Failed to reject user:', error);
    }
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="mt-6">
      <h2 className="text-2xl font-semibold mb-4">사용자 관리</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이메일</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>권한</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>가입일</TableHead>
            <TableHead>작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                <Badge>{user.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    user.status === 'APPROVED'
                      ? 'default'
                      : user.status === 'PENDING'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</TableCell>
              <TableCell className="flex gap-2">
                {user.status === 'PENDING' && (
                  <>
                    <Button size="sm" onClick={() => handleApproveUser(user.id)}>
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectUser(user.id)}
                    >
                      거부
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 9.3 IPC 핸들러 추가

**파일 생성:**
- `src/main/ipc/user.ts`
- `src/main/ipc/settings.ts`

```typescript
// src/main/ipc/user.ts
import { ipcMain } from 'electron';
import { getDatabase } from '../services/database';

export function setupUserIPC() {
  ipcMain.handle('user:list', async () => {
    const db = getDatabase();
    return db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  });

  ipcMain.handle('user:update', async (event, userData: any) => {
    const db = getDatabase();
    return db.user.update({
      where: { id: userData.userId },
      data: userData,
    });
  });

  ipcMain.handle('user:delete', async (event, userId: string) => {
    const db = getDatabase();
    return db.user.delete({
      where: { id: userId },
    });
  });
}
```

### 9.4 완료 기준
- [ ] 관리자 페이지 레이아웃 완성
- [ ] 사용자 관리 기능 구현 완료
- [ ] 시스템 설정 관리 기능 완성
- [ ] 활동 로그 조회 기능 완성
- [ ] 통계 및 분석 기능 구현 완료

---

## 10. Phase 7: 시스템 통합 기능

### 10.1 목표
- 전역 단축키 등록
- 시스템 트레이 통합
- 클립보드 자동 붙여넣기
- 오토 스타트 설정
- 파일 경로 드래그 앤 드롭

### 10.2 전역 단축키 구현

**파일 생성:**
- `src/main/shortcuts.ts`

```typescript
// src/main/shortcuts.ts
import { app, globalShortcut, BrowserWindow } from 'electron';

export function registerGlobalShortcuts(mainWindow: BrowserWindow) {
  // Ctrl+Alt+R: 녹음 시작/중지
  globalShortcut.register('Control+Alt+R', () => {
    mainWindow.webContents.send('shortcut:recording-toggle');
  });

  // Ctrl+Alt+Q: 전체 창 토글
  globalShortcut.register('Control+Alt+Q', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ctrl+Alt+V: 클립보드에서 가져오기
  globalShortcut.register('Control+Alt+V', () => {
    mainWindow.webContents.send('shortcut:paste-from-clipboard');
  });

  console.log('Global shortcuts registered');
}

export function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll();
}
```

### 10.3 시스템 트레이 통합

**파일 생성:**
- `src/main/tray.ts`

```typescript
// src/main/tray.ts
import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import * as path from 'path';

export function createTray(mainWindow: BrowserWindow): Tray {
  // 트레이 아이콘 (public/icons에서 로드)
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../../public/icons/tray-icon.png')
  );
  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '창 보이기',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '녹음 시작',
      accelerator: 'CmdOrCtrl+Alt+R',
      click: () => {
        mainWindow.webContents.send('shortcut:recording-toggle');
      },
    },
    { type: 'separator' },
    {
      label: '설정',
      click: () => {
        mainWindow.webContents.send('nav:settings');
      },
    },
    {
      label: '종료',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 트레이 아이콘 클릭 시 창 토글
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}
```

### 10.4 클립보드 자동 붙여넣기

**파일 생성:**
- `src/main/services/clipboard.ts`

```typescript
// src/main/services/clipboard.ts
import { clipboard } from 'electron';
import { UserSettings } from '@prisma/client';

export class ClipboardManager {
  async copyToClipboard(text: string): Promise<void> {
    clipboard.writeText(text);
  }

  async pasteRefinedText(
    refinedText: string,
    userSettings: UserSettings
  ): Promise<void> {
    // pasteFormat 설정에 따라 다른 포맷으로 붙여넣기
    let content = refinedText;

    if (userSettings.pasteFormat === 'MARKDOWN' && userSettings.markdownOutput) {
      content = this.formatAsMarkdown(refinedText);
    } else if (userSettings.pasteFormat === 'SUMMARY') {
      // 요약본 사용 (summary 필드에서 가져오기)
      // content = summary;
    }

    clipboard.writeText(content);
  }

  private formatAsMarkdown(text: string): string {
    // 기본 마크다운 포맷팅
    return text
      .split('\n')
      .map((line) => {
        if (line.match(/^[\d.]+\s/)) {
          return `- ${line.replace(/^[\d.]+\s/, '')}`;
        }
        return line;
      })
      .join('\n');
  }
}
```

### 10.5 오토 스타트 설정

**파일 생성:**
- `src/main/services/auto-start.ts`

```typescript
// src/main/services/auto-start.ts
import { app } from 'electron';

export class AutoStartManager {
  static enableAutoStart(): void {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }

  static disableAutoStart(): void {
    app.setLoginItemSettings({
      openAtLogin: false,
    });
  }

  static isAutoStartEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin;
  }
}
```

### 10.6 파일 드래그 앤 드롭

**파일 생성:**
- `src/renderer/components/AudioDropZone.tsx`

```typescript
// src/renderer/components/AudioDropZone.tsx
import { useCallback, useState } from 'react';
import { useIPC } from '../hooks/useIPC';

interface AudioDropZoneProps {
  onFileDrop: (filePath: string) => void;
}

export default function AudioDropZone({ onFileDrop }: AudioDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // 파일 타입 검증 (오디오 파일만 허용)
      if (file.type.startsWith('audio/')) {
        onFileDrop(file.path);
      } else {
        alert('오디오 파일만 업로드 가능합니다.');
      }
    }
  }, [onFileDrop]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50'
      }`}
    >
      <p className="text-gray-600">
        오디오 파일을 여기로 드래그하세요
      </p>
      <p className="text-sm text-gray-500 mt-2">
        지원 형식: MP3, WAV, M4A, OGG
      </p>
    </div>
  );
}
```

### 10.7 완료 기준
- [ ] 전역 단축키 등록 완료
- [ ] 시스템 트레이 통합 완료
- [ ] 클립보드 자동 붙여넣기 기능 작동
- [ ] 오토 스타트 설정 기능 완성
- [ ] 드래그 앤 드롭 기능 구현 완료

---

## 11. Phase 8: 빌드 및 배포

### 11.1 목표
- electron-builder 설정
- macOS DMG, Windows NSIS 인스톨러 생성
- 자동 업데이트 설정
- GitHub Actions CI/CD 구성

### 11.2 electron-builder 설정

**파일 생성:**
- `electron-builder.yml`

```yaml
appId: com.voicenote.app
productName: VoiceNote

directories:
  buildResources: public/icons
  output: dist/packages

files:
  - dist/main/**
  - dist/renderer/**
  - package.json
  - node_modules/**

mac:
  target:
    - dmg
    - zip
  icon: public/icons/app.icns
  notarize:
    teamId: ${APPLE_TEAM_ID}
    appleId: ${APPLE_ID}
    appleIdPassword: ${APPLE_ID_PASSWORD}

dmg:
  background: electron-builder/dmg-background.png
  icon: public/icons/app.icns
  iconSize: 80
  contents:
    - x: 130
      y: 220
      type: file
    - x: 410
      y: 220
      type: link
      path: /Applications

win:
  target:
    - nsis
    - portable
  icon: public/icons/app.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

publish:
  provider: github
  owner: dongheelee
  repo: app_stt_electron
```

### 11.3 자동 업데이트 설정

**파일 생성:**
- `src/main/update.ts`

```typescript
// src/main/update.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

export function setupAutoUpdate(mainWindow: BrowserWindow) {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update:available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
  });
}

export function quitAndInstall() {
  autoUpdater.quitAndInstall();
}
```

### 11.4 GitHub Actions CI/CD

**파일 생성:**
- `.github/workflows/build.yml`
- `.github/workflows/release.yml`

```yaml
# .github/workflows/build.yml
name: Build

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run electron-builder -- --publish never
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run electron-builder
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

### 11.5 빌드 스크립트 업데이트

**package.json 수정:**
```json
{
  "scripts": {
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "tsc src/main --outDir dist/main",
    "build:renderer": "vite build",
    "electron-builder": "electron-builder",
    "pack": "npm run build && npm run electron-builder -- --dir",
    "dist": "npm run build && npm run electron-builder"
  }
}
```

### 11.6 완료 기준
- [ ] electron-builder 설정 완료
- [ ] macOS DMG 생성 성공
- [ ] Windows NSIS 인스톨러 생성 성공
- [ ] 자동 업데이트 기능 테스트 완료
- [ ] GitHub Actions 워크플로우 정상 작동

---

## 12. Phase 9: 테스트 및 최적화

### 12.1 목표
- 단위 테스트 작성
- 통합 테스트 구성
- E2E 테스트 설정
- 성능 프로파일링 및 최적화
- 보안 취약점 검토

### 12.2 테스트 프레임워크 설정

**의존성 추가:**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "react-testing-library": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "playwright": "^1.40.0",
    "msw": "^2.0.0"
  }
}
```

**파일 생성:**
- `vitest.config.ts`
- `tests/setup.ts`

### 12.3 단위 테스트

**파일 생성:**
- `tests/unit/services/audio-recorder.test.ts`
- `tests/unit/services/transcription.test.ts`
- `tests/unit/services/llm-refiner.test.ts`

```typescript
// tests/unit/services/audio-recorder.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioRecorder } from '../../../src/main/services/audio-recorder';

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;

  beforeEach(() => {
    recorder = new AudioRecorder();
  });

  it('should start recording', async () => {
    await recorder.startRecording();
    expect(recorder.isRecordingNow()).toBe(true);
  });

  it('should stop recording and return audio path', async () => {
    await recorder.startRecording();
    const audioPath = await recorder.stopRecording();
    expect(audioPath).toBeDefined();
    expect(audioPath).toMatch(/\.wav$/);
  });

  it('should throw error when starting recording twice', async () => {
    await recorder.startRecording();
    await expect(recorder.startRecording()).rejects.toThrow('Already recording');
  });
});
```

### 12.4 통합 테스트

**파일 생성:**
- `tests/integration/workflow.test.ts`

```typescript
// tests/integration/workflow.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { RecordingWorkflow } from '../../../src/main/services/workflow';
import { initializeDatabase, closeDatabase } from '../../../src/main/services/database';

describe('RecordingWorkflow Integration', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should complete full workflow', async () => {
    // Mock BrowserWindow
    const mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };

    const workflow = new RecordingWorkflow(
      mockWindow as any,
      process.env.OPENAI_API_KEY || ''
    );

    // 실제 구현에서는 더 자세한 테스트 필요
    expect(workflow).toBeDefined();
  });
});
```

### 12.5 E2E 테스트

**파일 생성:**
- `tests/e2e/recording.spec.ts`

```typescript
// tests/e2e/recording.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Recording Feature', () => {
  let app: any;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['dist/main/index.js'] });
  });

  test('should record and transcribe audio', async () => {
    const mainWindow = await app.firstWindow();

    // 녹음 시작 버튼 클릭
    await mainWindow.click('button:has-text("녹음 시작")');

    // 2초 대기
    await mainWindow.waitForTimeout(2000);

    // 녹음 중지 버튼 클릭
    await mainWindow.click('button:has-text("녹음 중지")');

    // 변환 완료 대기
    await mainWindow.waitForTimeout(3000);

    // 결과 확인
    const refinedText = await mainWindow.textContent('.refined-text');
    expect(refinedText).toBeTruthy();
  });
});
```

### 12.6 성능 최적화

**최적화 항목:**
1. **번들 최적화**
   - Code splitting (Vite 설정)
   - Tree shaking
   - Lazy loading for pages

2. **메모리 최적화**
   - 큰 오디오 파일 스트리밍 처리
   - 데이터베이스 쿼리 페이지네이션
   - 불필요한 Re-render 방지

3. **렌더링 최적화**
   ```typescript
   // React.memo 사용
   export default React.memo(SessionCard);

   // useMemo, useCallback 활용
   const filteredSessions = useMemo(() => {
     return sessions.filter(s => s.title.includes(searchQuery));
   }, [sessions, searchQuery]);
   ```

4. **데이터베이스 최적화**
   - 인덱스 확인
   - 쿼리 최적화
   - Connection pooling

### 12.7 보안 검토

**체크리스트:**
- [ ] IPC 보안 (contextIsolation=true, preload 스크립트)
- [ ] 사용자 입력 검증
- [ ] SQL Injection 방지 (Prisma ORM 사용)
- [ ] XSS 방지 (React JSX 자동 이스케이프)
- [ ] CSRF 토큰 (API 호출 시)
- [ ] 환경변수 관리 (.env 파일)
- [ ] API 키 보안
- [ ] 로컬 데이터베이스 암호화 (선택사항)

```typescript
// IPC 보안 설정
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    enableRemoteModule: false,
    preload: path.join(__dirname, 'preload.js'),
    sandbox: true,
  },
});
```

### 12.8 완료 기준
- [ ] 단위 테스트 작성 완료 (70% 이상 커버리지)
- [ ] 통합 테스트 작성 완료
- [ ] E2E 테스트 작성 완료
- [ ] 성능 프로파일링 완료
- [ ] 보안 검토 완료
- [ ] 성능 최적화 완료

---

## 13. 의존성 및 라이브러리 참고

### 13.1 필수 라이브러리
```json
{
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^25.0.0",
    "electron-updater": "^6.0.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "@prisma/client": "^5.7.0",
    "prisma": "^5.7.0",
    "openai": "^4.24.0",
    "electron-store": "^8.5.0",
    "node-global-shortcut": "^1.0.0",
    "axios": "^1.6.0",
    "shadcn-ui": "^0.8.0",
    "clsx": "^2.0.0",
    "class-variance-authority": "^0.7.0"
  }
}
```

### 13.2 선택적 라이브러리
```json
{
  "dependencies": {
    "zustand": "^4.4.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "pdfkit": "^0.13.0",
    "sharp": "^0.33.0",
    "electron-log": "^5.0.0",
    "dotenv": "^16.3.0"
  }
}
```

---

## 14. 프로젝트 일정 및 마일스톤

### 14.1 추정 일정 (개발팀 1-2명 기준)

| Phase | 작업 | 예상 기간 | 시작일 | 완료일 |
|-------|------|---------|--------|--------|
| 1 | 프로젝트 초기 설정 | 2-3일 | - | - |
| 2 | 데이터베이스 설계 | 2-3일 | - | - |
| 3 | 메인 프로세스 개발 | 5-7일 | - | - |
| 4 | 렌더러 프로세스 개발 | 5-7일 | - | - |
| 5 | 핵심 기능 구현 | 5-7일 | - | - |
| 6 | 관리자 기능 | 3-5일 | - | - |
| 7 | 시스템 통합 | 3-4일 | - | - |
| 8 | 빌드 및 배포 | 3-4일 | - | - |
| 9 | 테스트 및 최적화 | 5-7일 | - | - |
| **전체** | | **42-57일** | | |

### 14.2 마일스톤
- **M1 (1주):** Phase 1-2 완료, 기본 환경 설정 완료
- **M2 (2주):** Phase 3-4 완료, 기본 UI와 IPC 통신 작동
- **M3 (3주):** Phase 5 완료, 핵심 기능 (녹음-변환-정제) 작동
- **M4 (4주):** Phase 6-7 완료, 관리자 기능 및 시스템 통합 완료
- **M5 (5주):** Phase 8-9 완료, 빌드 및 배포 준비 완료
- **Release:** 베타 테스트 및 최종 릴리즈

---

## 15. 위험 요소 및 대응 방안

### 15.1 주요 위험 요소

| 위험 요소 | 영향 | 가능성 | 대응 방안 |
|---------|------|--------|---------|
| SQLite 성능 이슈 | 높음 | 중간 | 초기부터 성능 테스트, 필요시 PostgreSQL 유지 고려 |
| OpenAI API 비용 증가 | 중간 | 높음 | 사용량 모니터링, 일일 한도 설정, 캐싱 구현 |
| 오디오 인코딩 호환성 | 중간 | 중간 | ffmpeg 라이브러리 통합, 다양한 형식 테스트 |
| macOS 공증 실패 | 중간 | 낮음 | Apple 개발자 계정 사전 준비, 테스트 |
| 크로스 플랫폼 이슈 | 중간 | 높음 | 조기에 macOS, Windows, Linux 테스트 |
| 보안 취약점 | 높음 | 낮음 | 정기 보안 검토, 의존성 업데이트 |

### 15.2 리스크 완화 전략
- 초기 프로토타입 빌드로 기술 검증
- 정기 성능 테스트 및 프로파일링
- 문서화를 통한 지식 공유
- 단계별 검수 및 피드백 수집

---

## 16. 추가 고려 사항

### 16.1 다국어 지원 (i18n)
```typescript
// src/renderer/hooks/useTranslation.ts
import i18next from 'i18next';
import ko from '../locales/ko.json';

i18next.init({
  lng: 'ko',
  resources: { ko: { translation: ko } },
});

export const useTranslation = () => i18next.t;
```

### 16.2 설정 마이그레이션
PostgreSQL에서 SQLite로 기존 데이터 마이그레이션 스크립트 필요:
```typescript
// scripts/migrate-from-postgres.ts
// Prisma 마이그레이션 도구 활용
```

### 16.3 오프라인 모드
인터넷 없을 시에도 기본 기능 제공:
- 로컬 오디오 파일 인식
- 필수 기능만 활성화
- 온라인 복귀 시 동기화

### 16.4 백업 및 복구
```typescript
// src/main/services/backup.ts
export class BackupManager {
  async createBackup(): Promise<string> {
    // 데이터베이스 및 설정 백업
  }

  async restoreBackup(backupPath: string): Promise<void> {
    // 백업에서 복구
  }
}
```

---

## 17. 결론 및 다음 단계

### 17.1 구현 체크리스트
이 구현 계획을 따라 다음 순서대로 진행하세요:

1. **Phase 1 시작:** Electron + React 기본 설정
2. **점진적 구현:** 각 Phase는 이전 Phase에 의존
3. **정기적 검수:** 주 1회 마일스톤 체크
4. **테스트 우선:** Phase 3부터 함께 테스트 작성
5. **문서 유지:** 진행 상황에 따라 설계 문서 업데이트

### 17.2 성공 기준
- 모든 9개 Phase 완료
- 지정된 기능 모두 작동
- 테스트 커버리지 70% 이상
- macOS/Windows 모두에서 빌드 성공
- 자동 업데이트 기능 작동

### 17.3 추가 리소스
- **Electron 공식 문서:** https://www.electronjs.org/docs
- **Prisma 가이드:** https://www.prisma.io/docs/
- **shadcn/ui 컴포넌트:** https://ui.shadcn.com/
- **TypeScript 핸드북:** https://www.typescriptlang.org/docs/

---

**문서 버전:** 1.0
**최종 수정:** 2026년 1월 27일
**담당자:** Development Team
