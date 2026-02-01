# VoiceNote Electron - Gap Analysis & Implementation Plan

## Original App (Next.js) vs Electron App 비교 분석

### CRITICAL - 앱 작동 불가

| # | 항목 | 상태 | 설명 |
|---|------|------|------|
| C1 | 오디오 녹음 | ❌ 미구현 | renderer에 MediaRecorder/getUserMedia 없음. UI만 존재 |
| C2 | API 키 관리 | ❌ 미구현 | electron-store 미사용, 키 입력 UI 없음, 환경변수만 의존 |

### HIGH - 핵심 기능 누락

| # | 항목 | 원본 앱 | Electron 앱 | 상태 |
|---|------|---------|------------|------|
| H1 | STT Provider 다중 지원 | ElevenLabs + Groq | OpenAI whisper-1만 하드코딩 | ❌ |
| H2 | ElevenLabs STT | scribe_v1, scribe_v2 지원 | "not supported" 에러 반환 | ❌ |
| H3 | Groq Whisper STT | whisper-large-v3, v3-turbo | 미구현 | ❌ |
| H4 | STT 모델 선택 | 관리자가 provider/model 선택 가능 | 선택 불가 | ❌ |
| H5 | Refine 모델 선택 | Groq LLM 다중 모델 선택 가능 | gpt-4o-mini 하드코딩 | ❌ |
| H6 | 항목화(Formal) 기능 | 정제 후 항목화 텍스트 별도 생성 | 미구현 | ❌ |
| H7 | 분류기(Classifier) | 항목화 필요 여부 판단 모델 | 미구현 | ❌ |
| H8 | 설정 → 워크플로우 연동 | 설정값이 API 호출에 반영 | useWorkflow에서 하드코딩 | ❌ |
| H9 | 관리자 시스템 설정 | STT/Refine/Classifier 모델 선택 UI | 미구현 | ❌ |

### MEDIUM - 부가 기능 누락

| # | 항목 | 상태 |
|---|------|------|
| M1 | 화자분리 (Speaker Diarization) | UI 토글만 있고 미구현 |
| M2 | 단축키 불일치 | 설정 화면 Cmd+Shift+R ≠ 실제 Cmd+Alt+R |
| M3 | 오디오 재생 | audioPath 저장하지만 재생 UI 없음 |

---

## 구현 계획

### Phase 1: Audio Recording (C1)
- renderer에 MediaRecorder + getUserMedia 구현
- useRecording 훅에서 실제 오디오 캡처
- audio blob을 main process로 전송 → temp 파일 저장
- audioPath를 workflow에 반환

### Phase 2: API Key Management (C2)
- electron-store로 API 키 암호화 저장
- IPC 핸들러: api-key:set, api-key:get, api-key:validate
- 설정 페이지에 API 키 입력 섹션 추가
- stt-service, refinement-service에서 electron-store 키 우선 사용

### Phase 3: Multi-Provider STT (H1-H4)
- ElevenLabs STT 서비스 구현 (elevenlabs-stt-service.ts)
- Groq Whisper STT 서비스 구현 (groq-stt-service.ts)
- STT Provider/Model 라우팅 로직
- SystemSettings에서 provider/model 읽기

### Phase 4: LLM Refinement Upgrade (H5-H7)
- Groq SDK 기반 refinement 서비스 (원본 앱 방식)
- 항목화(Formal) 텍스트 생성 추가
- Classifier 모델 (현재 원본에서도 비활성)
- Refine/Classifier 모델 선택 지원

### Phase 5: Settings Integration (H8-H9)
- useWorkflow에서 UserSettings/SystemSettings 읽어서 사용
- 관리자 시스템 설정 페이지 (STT/Refine 모델 선택 UI)
- 설정값 → 서비스 호출 파라미터 연동

### Phase 6: Minor Fixes (M1-M3)
- 화자분리: ElevenLabs scribe_v2 diarize 옵션 연동
- 단축키 통일 (Cmd+Shift+R)
- 세션 상세에서 오디오 재생 UI

---

Generated: 2026-01-27
