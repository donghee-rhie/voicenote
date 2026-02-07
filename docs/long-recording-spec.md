# 장시간 녹음 (120분) 지원 기술 검토

> 마지막 업데이트: 2025-03-10 (ElevenLabs 화자 분리 2시간 지원 확인)

## 1. 현재 상황

### 현재 제한
- 최대 녹음 시간: **10분 (600초)**
- 설정 가능 범위: 60초 ~ 600초

### 목표
- 최대 녹음 시간: **120분 (7,200초)**
- 안정적인 전사 및 정제 처리
- 화자 분리 지원 (ElevenLabs 사용 시)

---

## 2. API 스펙 분석

### 2.1 Groq Whisper API

| 항목 | 스펙 |
|------|------|
| **파일 크기 제한** | 100MB (유료) / 40MB (무료) |
| **시간 제한** | 명시적 제한 없음 (파일 크기 기반) |
| **지원 포맷** | flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm |
| **처리 속도** | 실시간 대비 299배 빠름 |
| **가격** | $0.111/시간 (최소 10초 과금) |

**참고**: [Groq Speech to Text Docs](https://console.groq.com/docs/speech-to-text), [Groq Rate Limits](https://console.groq.com/docs/rate-limits)

### 2.2 ElevenLabs Scribe API

| 항목 | 스펙 |
|------|------|
| **파일 크기 제한** | 3GB |
| **시간 제한** | 명시적 제한 없음 |
| **화자 분리 제한** | ✅ **2시간까지 지원** (2025년 3월 업데이트) |
| **최대 화자 수** | 32명 |
| **지원 언어** | 90개 이상 |
| **가격** | $0.22/시간 (Business tier) |

**참고**: [ElevenLabs Transcription Docs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text), [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [Changelog 2025-03-10](https://elevenlabs.io/docs/changelog/2025/3/10)

---

## 3. 60분 녹음 시 예상 파일 크기

### WebM (Opus 코덱) 기준

| 비트레이트 | 60분 파일 크기 |
|-----------|---------------|
| 32 kbps | ~14 MB |
| 64 kbps | ~29 MB |
| 128 kbps | ~58 MB |
| 256 kbps | ~115 MB |

### 분석
- **Groq (40MB 무료)**: 64kbps 이하에서만 안전
- **Groq (100MB 유료)**: 128kbps까지 안전
- **ElevenLabs (3GB)**: 모든 비트레이트에서 안전

---

## 4. 잠재적 리스크

### 4.1 파일 크기 초과 (Groq)

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| 파일 크기 > 100MB | 🔴 높음 | API 요청 거부 |

**영향**: 고품질 녹음 시 60분 파일이 100MB 초과 가능

### 4.2 화자 분리 (ElevenLabs) - ✅ 해결됨

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| ~~녹음 > 8분~~ | ~~🟡 중간~~ | ~~화자 분리 기능 비활성화~~ |

**업데이트 (2025-03)**: ElevenLabs가 화자 분리 시간 제한을 **8분 → 2시간**으로 확장하여 이 리스크는 해소됨

### 4.3 API 타임아웃

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| 처리 시간 초과 | 🟡 중간 | 대용량 파일 처리 중 연결 끊김 |

**영향**: 전사 실패, 재시도 필요

### 4.4 메모리 부족

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| 브라우저 메모리 한계 | 🟡 중간 | 대용량 Blob 처리 시 크래시 |

**영향**: 앱 강제 종료, 녹음 데이터 손실

### 4.5 네트워크 불안정

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| 업로드 중 연결 끊김 | 🟡 중간 | 대용량 파일 업로드 실패 |

**영향**: 전사 요청 실패

### 4.6 LLM 정제 컨텍스트 초과

| 리스크 | 심각도 | 설명 |
|--------|--------|------|
| 토큰 수 초과 | 🔴 높음 | 60분 = 약 15,000~30,000 단어 |

**영향**: 정제 실패 또는 부분 정제만 가능

---

## 5. 안정화 솔루션

### 5.1 청크 분할 처리 (Chunked Processing)

> ⚠️ **업데이트**: ElevenLabs가 2시간까지 화자 분리를 지원하므로, ElevenLabs 사용 시 오디오 청크 분할은 **불필요**합니다. Groq 사용 시에만 파일 크기 제한(100MB) 때문에 필요할 수 있습니다.

**개념**: 긴 오디오를 여러 청크로 분할하여 순차 처리 (Groq 전용)

```
60분 오디오 (Groq, 파일 > 100MB인 경우)
    ↓
[10분] [10분] [10분] [10분] [10분] [10분]
    ↓
각 청크 개별 전사
    ↓
결과 병합
```

**장점**:
- 파일 크기 제한 회피 (Groq 100MB)
- 부분 실패 시 해당 청크만 재시도

**구현 방안**:
```typescript
interface ChunkConfig {
  maxDuration: number;      // 청크당 최대 시간 (초)
  overlapDuration: number;  // 청크 간 오버랩 (초)
  maxFileSize: number;      // 청크당 최대 파일 크기 (MB)
}

const defaultConfig: ChunkConfig = {
  maxDuration: 600,      // 10분 (Groq 파일 크기 기준)
  overlapDuration: 5,    // 5초 오버랩
  maxFileSize: 35,       // 35MB (안전 마진)
};
```

### 5.2 적응형 비트레이트

**개념**: 녹음 시간에 따라 비트레이트 자동 조절

| 녹음 시간 | 비트레이트 | 예상 크기 |
|-----------|-----------|-----------|
| ~15분 | 128 kbps | ~14 MB |
| 15~30분 | 64 kbps | ~14 MB |
| 30~60분 | 48 kbps | ~21 MB |

### 5.3 스트리밍 저장

**개념**: 녹음 중 주기적으로 디스크에 저장

```
녹음 시작
    ↓
[매 30초마다 임시 파일 저장]
    ↓
녹음 종료
    ↓
청크 병합 또는 개별 처리
```

**장점**:
- 앱 크래시 시에도 데이터 보존
- 메모리 사용량 최소화

### 5.4 진행률 표시 및 예상 시간

```typescript
interface ProcessingProgress {
  stage: 'uploading' | 'transcribing' | 'refining';
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // 초
}
```

### 5.5 재시도 로직

```typescript
interface RetryConfig {
  maxRetries: number;           // 최대 재시도 횟수
  retryDelay: number;           // 재시도 간격 (ms)
  exponentialBackoff: boolean;  // 지수 백오프
}

const retryConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 2000,
  exponentialBackoff: true,
};
```

### 5.6 정제 분할 처리

**문제**: 60분 텍스트 = 약 15,000~30,000 단어 → LLM 컨텍스트 초과

**해결**:
```
전체 텍스트
    ↓
[2,000단어 청크] × N개
    ↓
각 청크 개별 정제
    ↓
결과 병합 + 전체 요약 생성
```

---

## 6. 권장 구현 로드맵

### Phase 1: 기본 확장 (빠른 구현)
- [ ] 최대 녹음 시간 60분으로 확장
- [ ] 녹음 비트레이트 최적화 (48~64kbps)
- [ ] 파일 크기 사전 검증
- [ ] 진행률 표시 개선

### Phase 2: 안정화 (권장)
- [ ] 청크 분할 전사 구현
- [ ] 스트리밍 저장 (30초 간격)
- [ ] 재시도 로직 추가
- [ ] 에러 복구 메커니즘

### Phase 3: 고급 기능
- [ ] 실시간 전사 (스트리밍 API)
- [ ] 백그라운드 처리 큐
- [ ] 오프라인 전사 지원 (로컬 Whisper)

---

## 7. 구현 예시 코드

### 7.1 청크 분할 함수

```typescript
async function splitAudioIntoChunks(
  audioBlob: Blob,
  maxChunkDuration: number = 480 // 8분
): Promise<Blob[]> {
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = audioBuffer.duration;
  const chunks: Blob[] = [];

  for (let start = 0; start < totalDuration; start += maxChunkDuration) {
    const end = Math.min(start + maxChunkDuration, totalDuration);
    const chunkBuffer = extractAudioSegment(audioBuffer, start, end);
    const chunkBlob = await encodeToWebM(chunkBuffer);
    chunks.push(chunkBlob);
  }

  return chunks;
}
```

### 7.2 병렬 전사 처리

```typescript
async function transcribeLongAudio(
  chunks: Blob[],
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  const results: ChunkResult[] = [];

  // 순차 처리 (API 레이트 리밋 고려)
  for (let i = 0; i < chunks.length; i++) {
    const result = await transcribeChunk(chunks[i], {
      ...options,
      chunkIndex: i,
      totalChunks: chunks.length,
    });
    results.push(result);

    // 진행률 업데이트
    onProgress?.({
      stage: 'transcribing',
      currentChunk: i + 1,
      totalChunks: chunks.length,
      percentComplete: ((i + 1) / chunks.length) * 100,
    });
  }

  // 결과 병합
  return mergeTranscriptionResults(results);
}
```

---

## 8. 결론 및 권장사항

### ElevenLabs 사용 시 (권장 - 간단한 구현)

ElevenLabs Scribe가 2시간까지 화자 분리를 지원하므로 구현이 단순화됨:

1. **녹음 시간 확장**: 120분까지 설정 가능하도록 변경
2. **단일 파일 전사**: 청크 분할 없이 전체 파일 한 번에 전사
3. **진행률 UI**: 장시간 처리 시 사용자 경험 개선
4. **LLM 정제 청크 분할**: 긴 텍스트만 청크로 분할하여 정제

### Groq 사용 시 (파일 크기 제한 주의)

1. **비트레이트 최적화**: 48kbps로 설정하여 파일 크기 최소화
2. **파일 크기 검증**: 100MB 초과 시 청크 분할 또는 경고
3. **청크 분할 처리**: 필요 시 10분 단위로 분할

### 공통 권장사항

1. **스트리밍 저장**: 앱 크래시 시 데이터 손실 방지
2. **재시도 로직**: 네트워크 오류 대응
3. **정제 분할 처리**: 긴 텍스트는 2,000단어 단위로 분할

### 장기적 고려사항
- 실시간 스트리밍 전사 API 도입 검토
- 로컬 Whisper 모델 통합 (오프라인 지원)
- 클라우드 스토리지 연동 (대용량 파일 관리)

---

## 참고 자료

- [Groq Speech to Text Documentation](https://console.groq.com/docs/speech-to-text)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [ElevenLabs Transcription Documentation](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert)
- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
