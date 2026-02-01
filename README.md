# VoiceNote

> 음성을 텍스트로, 생각을 기록으로

VoiceNote는 음성을 실시간으로 텍스트로 변환하고 AI가 자동으로 정제해주는 macOS 데스크톱 앱입니다.

![Version](https://img.shields.io/badge/version-1.1.8-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## 주요 기능

### 음성 인식 (STT)
- **Groq Whisper** - 빠르고 정확한 다국어 음성 인식
- **ElevenLabs Scribe** - 화자 분리 지원

### AI 텍스트 정제
- 자동 오타 수정 및 필러 제거
- 문장 구조 정리 및 요약 생성
- 다양한 LLM 모델 지원

### 편리한 워크플로우
- **글로벌 단축키** - 어디서든 `Cmd+Shift+R`로 녹음 시작
- **즉시 붙여넣기** - 전사 완료 즉시 커서 위치에 자동 붙여넣기
- **백그라운드 정제** - 정제 작업은 백그라운드에서 진행

### 테마 커스터마이징
6가지 세련된 테마 지원:
- **다크**: Zinc Dark, Ocean Blue, Purple Night
- **라이트**: Snow White, Rose Petal, Mint Fresh

## 스크린샷

| 대시보드 | 설정 |
|---------|------|
| 녹음 및 전사 현황 | 테마 및 API 설정 |

## 설치

### 요구사항
- macOS 10.12 이상 (Apple Silicon / Intel)
- Groq API 키 또는 ElevenLabs API 키

### 다운로드
[Releases](https://github.com/donghee-rhie/voicenote/releases)에서 최신 DMG 파일을 다운로드하세요.

### 빌드하기
```bash
# 저장소 클론
git clone https://github.com/donghee-rhie/voicenote.git
cd voicenote

# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드
npm run dist
```

## 사용 방법

### 1. API 키 설정
설정 → API 키 관리에서 Groq 또는 ElevenLabs API 키를 입력하세요.

### 2. 녹음 시작
- 앱 내 녹음 버튼 클릭
- 또는 글로벌 단축키 `Cmd+Shift+R` 사용

### 3. 자동 처리
1. 녹음 종료 시 자동 전사
2. 원문 즉시 붙여넣기
3. 백그라운드에서 AI 정제
4. 완료 알림

## 단축키

| 단축키 | 기능 |
|--------|------|
| `Cmd+Shift+R` | 녹음 토글 |
| `Cmd+Shift+C` | 텍스트 복사 |
| `Esc` | 취소 |
| `?` | 도움말 |

## 기술 스택

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Electron, Node.js
- **Database**: SQLite (Prisma ORM)
- **AI/ML**: Groq Whisper, ElevenLabs Scribe, GPT-OSS

## 프로젝트 구조

```
src/
├── common/          # 공통 타입 및 상수
├── main/            # Electron 메인 프로세스
│   ├── database/    # Prisma 데이터베이스 서비스
│   ├── ipc/         # IPC 핸들러
│   └── services/    # STT, 정제 서비스
└── renderer/        # React 렌더러
    ├── components/  # UI 컴포넌트
    ├── hooks/       # 커스텀 훅
    ├── pages/       # 페이지 컴포넌트
    └── lib/         # 유틸리티
```

## 라이선스

MIT License

## 기여

이슈와 PR을 환영합니다!

---

Made with Claude Code
