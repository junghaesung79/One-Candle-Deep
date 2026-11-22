# 작업용 스크립트 보관

기획 작업 중에 쓴 측정·점검 스크립트예요. 경로가 원래 작업 공간(/home/claude/...) 기준으로 적혀 있고, 옛 구조(require('./bot.js'), index.html 의 규칙 구간을 잘라 읽기)를 전제로 해요.
다시 쓰려면 `import { load, playRun } from '../../prototype/bot/bot.js'` 처럼 ES 모듈로 고치고, `npx tsx` 나 `node` 로 prototype/ 안에서 돌려요.

- proto/: 헤드리스 브라우저(Python Playwright) 화면 점검, 밸런스 조정 스크립트
- econ/: 경제 측정 스크립트(봇 정책별 통과율, 수입 곡선, 악용 점검 등)
