# One Candle Deep (원 캔들 딥)

지뢰찾기 숫자 추리 + 채굴 로그라이트. 탑다운 2D 픽셀 인디 게임이에요.

> 숫자는 둘레 8칸의 지뢰와 보물을 함께 세요. 층마다 바뀌는 광맥 규칙으로 둘을 가려내 노다지 줄을 잇고, X를 그은 지뢰는 터뜨려 길을 열어요. 보름 동안 사흘마다 광산 값을 치르고, 도장 다섯 개를 받으면 광산이 내 것이 돼요.

A minesweeper mining roguelite where every number counts both mines and treasure. Read each floor's vein rule to tell them apart, chain finds into a Lode Streak, and blast the mines you're sure of. Fifteen days, a payment every third day, five stamps on the deed, and the mine is yours.

## 현재 상태

- **기획:** 2차 기획안 v2.1. 그 위에 재미 보고서로 고친 v2.2 시험 규칙(도장 다섯 번, 광맥 셋, 둘레 한꺼번에 열기, 오늘의 광산 등)을 프로토타입 기본으로 넣고 사람 플레이테스트를 앞두고 있어요. v2.1 규칙도 비교용으로 남아 있어요(`?preset=v21`)
- **단계:** 웹 프로토타입으로 규칙과 경제를 검증하는 중이에요(M0)
- **본 개발:** Godot 4로 만들어 스팀(PC)에 낼 계획이에요
- 1인 개발

## 빠르게 시작하기

Node.js 20 이상이 필요해요.

```bash
cd prototype
npm install
npm run dev        # http://localhost:5173
```

| 명령 (`prototype/` 안에서) | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 광맥 생성기, 규칙, 봇 테스트 |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run bot` | 봇 세 정책으로 경제 측정 보고서 |
| `npm run build` | `dist/index.html` 파일 하나로 빌드 |

## 문서

처음이라면 이 순서로 읽어요.

1. [docs/handoff.md](docs/handoff.md): 인수인계. 지금 상태, 스택, 작업 규칙, 다음 할 일
2. [docs/00_overview.md](docs/00_overview.md): 기획 요약
3. [docs/06_play_scenes.md](docs/06_play_scenes.md): 첫 판을 13개 장면으로 따라가요. 게임이 가장 빨리 그려지는 문서예요
4. [docs/01_system.md](docs/01_system.md): 규칙 전부
5. [docs/05_items_economy.md](docs/05_items_economy.md): 값, 시세, 납부액, 도구, 봇 측정

| 문서 | 내용 |
|---|---|
| [01_system.md](docs/01_system.md) | 코어 시스템 |
| [02_narrative.md](docs/02_narrative.md) | 세계관, 인물, 화면 문구 |
| [03_art_ui.md](docs/03_art_ui.md) | 화면, 연출 타이밍, 에셋 |
| [04_market_plan.md](docs/04_market_plan.md) | 시장, 일정, 범위, 리스크 |
| [05_items_economy.md](docs/05_items_economy.md) | 아이템과 경제 |
| [06_play_scenes.md](docs/06_play_scenes.md) | 플레이 장면으로 보는 게임 |
| [07_glossary.md](docs/07_glossary.md) | 용어집 |
| [08_feedback_status.md](docs/08_feedback_status.md) | 피드백 대응과 검수 처리 현황 |
| [09_prototype_guide.md](docs/09_prototype_guide.md) | 프로토타입 안내와 조작 |
| [decisions.md](docs/decisions.md) | 결정 기록. 문서끼리 다르면 이 기록이 우선해요 |
| [reviews/](docs/reviews) | 첫 플레이 혼란 감사, 재미 진단, 독립 검수 보고서 |
| [v1/](docs/v1) | 1차 기획안(참고용) |

기획서 본문에는 이전 가제 「초 한 자루」가 남아 있어요.

## 저장소 구조

```
docs/          기획서 원본(마크다운)
prototype/     웹 프로토타입(Vite + TypeScript)
CLAUDE.md      Claude Code 작업 안내
```

## 라이선스

라이선스를 정하지 않았어요. 모든 권리는 작성자에게 있어요.
