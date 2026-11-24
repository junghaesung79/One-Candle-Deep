// 순수 로직. DOM을 쓰지 않는다. 화면(ui.js), 봇(bot/), 테스트(tests/)가 같은 모듈을 import 한다.
// 규칙 기준: 00d_round2_decisions.md(R1~R23), 11_fun_redesign.md 3장. 문구: 02_narrative.md 2차본 6~7장.
// 경제 수치(납부액, 보물 값, 도구 가격, 주문 보상)는 전부 임시값이다. 경제 담당이 CONFIG만 바꾸면 되게 모았다.
var CONFIG = {
  W: 15, H: 11,
  START: { x: 7, y: 5 },
  days: 15,
  payments: [
    { day: 3, name: '계약금', amount: 300 },     // 05 v0.3 3장. 등급 1. 등급 배수는 CONFIG.gradeMul
    { day: 8, name: '중도금', amount: 2400 },     // 덤·선물 반영 뒤 재측정(05 3.2)
    { day: 15, name: '잔금', amount: 11000 }      // 덤·선물 반영 뒤 재측정(05 3.2)
  ],
  // 촛불(R2)
  candleMax: 80, hitCost: 1, awakeHitCost: 2, travelBase: 2, probeCost: 2, probesPerDay: 2, igniteCost: 4,   // R27 점화 촛불 4
  lowLight: 15, lowLightRadius: 2.5,         // R19: 촛불 15 이하만 반경 2.5, 이미 본 숫자는 흐리게
  embers: 5,                                 // R4 불씨 다섯 번
  hpMax: 3, mineDmg: 1, collapseLoss: 0.5,   // R5 쓰러지면 주머니 절반
  // 콤보(R8)
  streakLadder: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6], streakCapIdx: 4, streakCapIdxLastCard: 8, streakCapIdxDeadCrown: 10,   // 막장 왕관: 체력 1이면 ×6
  // 판
  numberCap: 5, startChainMin: 12, genRetries: 60,
  density: [ // 깊이 1~9: 지뢰 m, 보물 t, 보물 등급 가중치(금 알갱이/청록 보석/유물), 자갈 출현율 res, 자갈 값 rv
    { m: 13, t: 8,  tiers: [90, 10, 0],  res: 0.25, rv: 1 },
    { m: 14, t: 8,  tiers: [80, 20, 0],  res: 0.25, rv: 1 },
    { m: 15, t: 9,  tiers: [70, 28, 2],  res: 0.25, rv: 1 },
    { m: 16, t: 9,  tiers: [55, 38, 7],  res: 0.25, rv: 1 },
    { m: 17, t: 10, tiers: [45, 43, 12], res: 0.25, rv: 1 },
    { m: 18, t: 10, tiers: [35, 47, 18], res: 0.25, rv: 1 },
    { m: 19, t: 11, tiers: [28, 50, 22], res: 0.25, rv: 1 },
    { m: 20, t: 11, tiers: [22, 50, 28], res: 0.25, rv: 1 },
    { m: 21, t: 12, tiers: [18, 50, 32], res: 0.25, rv: 1 }
  ],
  treasureNearMine: 0.5,
  treasureValue: { 1: 20, 2: 50, 3: 120 },    // 금 알갱이 / 청록 보석 / 유물(시세 ×1 기준). 05 2.2
  scorchMul: 0.5,
  // 납부일 큰 덩이(R7). depth = 묻히는 층
  chunks: { 3: { depth: 3, w: 2, h: 2, value: 60 }, 8: { depth: 5, w: 2, h: 2, value: 160 }, 15: { depth: 5, w: 3, h: 2, value: 260 } },   // R31 Day 15 덩이 지하 5층   // 값에 시세가 붙는다(실제 60 / 240 / 780)
  mutationCount: { 8: 1, 15: 2 },
  roomsPerDay: { one: 0.5 },                 // 하루 1번(50%) 또는 2번(50%)
  shop: { tools: 3, cons: 2, reroll: 20, sellBack: 0.5, passiveSlots: 5, consSlots: 3, stack: 3,   // 값은 판 내내 고정(시세가 붙지 않는다)
          merchantDiscount: 0, merchantService: { price: 50, candle: 10 },
          rarityWeight: { '일반': 50, '고급': 35, '희귀': 15 } },
  spring: { hp: 1, candle: 15 },
  // 도장 수(0·1·2)에 따라 바뀌는 것. startDepth: 하루를 시작하는 층(통행 촛불 없음), rowShift: 층 표를 몇 층 깊게 쓰는가, valueMul: 보물 값 배수
  stages: [{ startDepth: 1, rowShift: 0, valueMul: 1 }, { startDepth: 1, rowShift: 0, valueMul: 1.5 }, { startDepth: 1, rowShift: 0, valueMul: 3 }],   // 시세(05 2.3)
  rulePool: ['plain', 'border', 'pair', 'lonely'],   // 갈림길에 나오는 광맥. 등급 1 = 01 14.2의 4종. null이면 프로토타입 기본(지하 2층까지 5종, 3층부터 7종)
  gradeMul: [1, 1.2, 1.9, 2, 2.2, 2.4, 2.6],  // 광산 등급 1~7 납부액 배수(05 3.3). 프로토타입은 등급 1만 쓴다
  twinBoth: false,                           // 쌍둥이 지뢰 변덕 날 보물도 둘씩 붙는다(05 확인 필요)
  fizzle: 'melt',                            // 불발한 칸이 보물일 때: keep 그대로 남음 / scorch 그을림(반값, 콤보 안 오름) / melt 녹아서 없어짐
  usefulMin: 2, usefulTries: 25,
  usefulRules: ['pair', 'tally', 'minepair'],   // R35: 광맥 규칙으로 보물로 확정되는 칸 usefulMin개 이상
  usefulMineRules: ['lonely', 'rows', 'border'], usefulMineMin: 3,   // R35: 이 셋은 지뢰로 확정되는 칸 3개 이상             // R30 쓸모 검사: 규칙으로 보물로 확정되는 칸 하한, 이 횟수 안에 못 맞추면 생략
  sheetCap: 6,                               // 현장 검수표: 층마다 받는 촛불 상한
  matchCandle: 10,
  refinerMin: 3,                             // 설익이 정제기: 불 한 번에 이만큼 터져야 금 알갱이
  // ---- 2차 검수 뒤 새 장치(R42, R43, R50, 02 6.2). 수치는 경제 담당이 이어서 잰다 ----
  forkBonus: { pool: ['value', 'candle', 'streak', 'more'], valueMul: 1.2, candle: 4, streak: 1, moreMines: 3, moreTreasures: 2 },   // 05 4.9: 값 ×1.3→1.2, 촛불 +6→+4   // 갈림길 덤(R42). 샘·상인 방도 덤으로 붙는다
  gift: { n: 3, rarity: '일반', tutorial: ['betchalk', 'ledger', 'fuse'] },   // 판 시작 중개소 선물(R43): 일반 도구 셋 중 하나 무료
  tutorialShopDay1: ['gloves', 'sheet', 'moonsieve', 'powder', 'match'],        // R50 첫 판 Day 1 상점(05 5.1 확정): 선물 3종과 겹치지 않는 콤보·분필·와르르 1종씩, 180 이하
  voidCompare: { 1: 1000, 2: 4500, 3: 15600 },  // 계약 해지 화면 비교 한 줄: 그 납부를 낸 판의 그 구간 수입 평균(05 3.4, 세 정책 600판에서 낸 판만)
  firstFloorRule: true,                      // 01 8.2: Day 2부터 지하 1층 광맥도 뽑아 게시판에 알림(false면 지하 1층은 늘 맨땅. 05 측정 당시 조건)
  // ---- 재미 보고서 1주차(결정 기록 62~65번) ----
  stairShown: true,                          // 계단을 처음부터 보여 줘요. 밑줄, 빛 번짐, 잠든 계단 변덕을 쓰지 않아요(false면 v2.1 방식)
  countsShown: true,                         // 층에 남은 보물·지뢰 수를 화면에 정확히 보여 줘요
  // 재미 보고서 2~4주차: 시스템 스위치. 여기 적힌 값은 v2.1이고, 파일 끝의 v22 프리셋이 덮어써요(applyPreset)
  features: { gang: true, orders: true, mutations: true, awake: true, forkBonus: true, rooms: true, embers: true, lowLight: true,
              sellBack: true, probeBase: true, gravel: 'cell', startGift: true, stampReward: false, chord: false, chunkShown: false, perfect: false,
              relicBox: false, toolSell: false, fusion: false, loan: false, fadedChalk: false, keepsake: false },
  // 도구 경험(reviews/14 15장): 판 위 옛 연장함, 팔기, 합친 도구, 심 씨 돈 외상. v22 프리셋에서 켜요
  relic: { chance: 0.25, fuseNight: 'stamp', fuseFrom: 'box', fuseMax: 0, bigStreak: true, minDepth: 2, minDay: 2, pityDay: 7, n: 2, rarity: { '일반': 30, '고급': 45, '희귀': 25 }, junk: 40,
           sellSite: 0.25, sellShop: 0.5, sellBonus: 0.25, beltSlots: 2, loanMul: 1.5 },
  chainGravel: { min: 8, per: 1 },
  fadedChalk: { o: [0, 0, 1], x: [0, 1, 2] },
  keepsake: { share: 0.25 },                  // 옛 연장함 가운데 이만큼은 도구 둘 대신 유품 하나   // 바랜 분필 자국: 층마다 제비에서 하나씩 뽑아요(O는 0·0·1, X는 0·1·2). 늘 맞아요
  ruleTune: {},
  firstRunDiscount: 1,                       // 첫 판(안내 판) 납부액 배수. 1이면 할인 없음. 의뢰인 결정 대기(처음 하는 사람 보정)                              // 광맥별 보물·지뢰 수 더하기 { pair: { t: -2, m: 0 } }. 광맥끼리 수입을 맞추는 손잡이(v22)           // gravel 'chain': 층 도착 때가 아닌 와르르로 min칸 이상 열리면 칸마다 per(시세 붙음)
  stampReward: { n: 3, cash: [60, 150, 300, 500], rarity: [[60, 35, 5], [45, 40, 15], [30, 45, 25], [20, 45, 35]] },   // 도장 선물: 도장 k개째 [일반, 고급, 희귀] 가중치, 대신 받는 금고 돈
  toolSet: '21',                             // 상점·선물에 나오는 도구 묶음('21' 12종 / '22' 12종)
  gradeRules: { 2: ['tally'], 3: ['tally', 'minepair'] },   // 등급별로 더 나오는 광맥(v22)
  gradeNames: ['달못 1호 갱', '달못 4호 갱', '달못 9호 갱'],
  lensMinMult: 1.5,                          // 감정 렌즈가 켜지는 콤보 배율                           // 성냥 묶음: 불씨일 때 켜면 촛불 +10
  fx: { breakStop: 60, treasureStop: 110, boxStop: 120, mineStop: 140, ringMs: 35, ringMinMs: 12, chainMaxMs: 600, openAnimMs: 120, startChainMs: 600 }
};

// 캐릭터(시험). 스킬 설명은 화면 문구라 해요체예요
var CHARACTERS = [
  { id: 'miner', name: '광부', line: '곡괭이 하나로 버텨 온 사람이에요', color: '#c4432b',
    x: { name: '발파', desc: 'X 칸을 누르면 터뜨려요. 촛불 4. 지뢰면 주변이 열리고, 보물이면 녹아요' },
    o: { name: '캐기', desc: 'O는 메모예요. 누르면 그냥 캐요' },
    weak: '' },
  { id: 'defuser', name: '해체공', line: '곽 씨 밑에서 설익이 다루는 법을 배웠어요', color: '#4f8a4a', innate: ['tongs'], igniteDelta: 1, candleDelta: -5,
    x: { name: '해체', desc: 'X 칸을 누르면 촛불 5. 지뢰면 터뜨리고, 지뢰가 아니면 녹이지 않고 꺼내며 촛불을 1만 남기고 돌려받아요. 보물은 그을린 채(반값) 나와요' },
    o: { name: '캐기', desc: 'O는 메모예요. 누르면 그냥 캐요' },
    weak: '촛불 75로 시작하고, 해체는 촛불 5예요' },
  { id: 'gambler', name: '노름꾼', line: '숫자를 믿으면 크게 거는 사람이에요', color: '#8e4fa8', innate: ['betchalk'], capPlus: 1,
    x: { name: '발파', desc: 'X 칸을 누르면 터뜨려요. 촛불 4' },
    o: { name: '걸기', desc: 'O 칸이 보물이면 콤보가 두 단계 올라요. 지뢰면 피해가 1 더 커요' },
    weak: '', perk: '콤보가 ×3.5까지 올라요' },
  { id: 'surveyor', name: '측량사', line: '중개소에서 갱 도면을 그리던 사람이에요', color: '#3e8a8a', surveyPerDay: 2, valueMul: 0.85,
    x: { name: '발파', desc: 'X 칸을 누르면 터뜨려요. 촛불 4' },
    o: { name: '청진', desc: 'O 칸을 누르면 먼저 두드려 봐요(촛불 2). 지뢰면 터지지 않고 X로 바뀌고, 아니면 이어서 캐요. 하루 2번' },
    weak: '보물 값이 15% 낮아요' },
  { id: 'blaster', name: '폭파공', line: '화약 냄새가 몸에 밴 사람이에요', color: '#e0782b', innate: ['fuse'], digMineExtra: 1,
    x: { name: '큰 발파', desc: 'X 칸을 누르면 두 걸음 안의 X 칸까지 한꺼번에 터뜨려요. 촛불 4' },
    o: { name: '캐기', desc: 'O는 메모예요. 누르면 그냥 캐요' },
    weak: '곡괭이로 지뢰를 치면 피해가 1 더 커요' }
];

// 광맥 규칙(R9, 02 6.5 표지판 문구 그대로, R21 가로줄 광맥)
var RULES = {   // 02 6.5(해요체)
  plain:    { name: '맨땅', sign: '규칙이 없어요. 숫자만 보면 돼요', help: '보물과 지뢰가 아무 데나 묻혀 있어요', icon: 'rPlain' },
  pair:     { name: '짝 광맥', sign: '보물 바로 옆에 보물이 하나 더 있어요', help: '위·아래·왼쪽·오른쪽 중 한 칸이에요. 대각선은 아니에요', icon: 'rPair' },
  lonely:   { name: '외톨이 광맥', sign: '보물 주변 8칸에는 다른 보물이 없어요', help: '보물을 캤다면 그 주변에 묻힌 것은 전부 지뢰예요', icon: 'rLonely' },
  rows:     { name: '가로줄 광맥', sign: '보물은 가로 세 줄에만 있어요', help: '세 줄은 서로 붙어 있지 않아요. 그 밖의 줄에 묻힌 것은 전부 지뢰예요', icon: 'rRows' },
  tally:    { name: '눈금 광맥', sign: '왼쪽 벽 눈금이 그 줄에 남은 보물 수예요', help: '눈금이 0인 줄에 묻힌 것은 전부 지뢰예요', icon: 'rTally' },
  minepair: { name: '지뢰 짝 광맥', sign: '지뢰가 둘씩 붙어 있어요. 보물 값은 한 등급 높아요', help: '위·아래·왼쪽·오른쪽으로 붙어요. 대각선은 아니에요. 혼자 떨어져 묻힌 것은 보물이에요', icon: 'rMinePair' },
  border:   { name: '테두리 광맥', sign: '보물은 바깥 두 줄에만 있어요', help: '안쪽에 묻힌 것은 전부 지뢰예요', icon: 'rBorder' }
};
var RULE_IDS = ['plain', 'pair', 'lonely', 'rows', 'tally', 'minepair', 'border'];
var CHUNK_RULES = ['plain', 'lonely', 'border'];   // 덩이 층은 덩이와 헷갈리지 않는 규칙만

// 갱 상태 13종(01 11.2, 02 6.3 게시판 문구). 1~12번 평소, 13번 쌍둥이 지뢰는 한 판 한 번 오는 '좋은 날'(납부일 제외)
var GANG = [   // 02 6.3(R59 "~ 날" 이름)
  { id: 'smell', name: '냄새가 진한 날', desc: '모든 층에 지뢰가 2개, 보물이 2개 더 묻혀 있어요' },
  { id: 'quiet', name: '조용한 날', desc: '모든 층에 지뢰가 2개, 보물이 1개 덜 묻혀 있어요' },
  { id: 'shallow', name: '숨이 고른 날', desc: '촛불 90으로 시작해요(평소 80)' },
  { id: 'rough', name: '숨이 거친 날', desc: '촛불 70으로 시작해요. 대신 보물 값이 20% 올라요(자갈과 큰 덩이는 빼고요)' },
  { id: 'deep', name: '깊이 잠든 날', desc: '계단 촛불이 1 + 도착 층이에요(평소 2 + 도착 층)' },
  { id: 'dry', name: '마른 갱', desc: '발파에 촛불이 3만 들어요(평소 4)' },
  { id: 'moon', name: '달빛이 고인 날', desc: '콤보가 ×1.5에서 시작해요. 끊기면 ×1로 가요' },
  { id: 'ember', name: '불씨가 오래가는 날', desc: '촛불이 꺼진 뒤 불씨가 일곱 번이에요(평소 다섯 번)' },
  { id: 'gravel', name: '자갈이 굵은 날', desc: '자갈 값이 두 배예요' },
  { id: 'thin', name: '벽이 얇은 날', desc: '두드려 보기를 4번 쓸 수 있어요(평소 2번). 촛불은 그대로 2씩 들어요' },
  { id: 'idle', name: '곽 씨가 한가한 날', desc: '쓰러져도 주머니의 4분의 1만 잃어요' },
  { id: 'toss', name: '밤새 뒤척인 날', desc: '지하 2층에서 시작해요. 내려가는 촛불은 안 들어요' },
  { id: 'twin', name: '쌍둥이 지뢰', desc: '모든 층에서 지뢰가 위아래나 옆으로 둘씩 붙어 있어요. 하나를 찾으면 짝이 바로 옆이에요', good: true }
];

// 주문 16종(01 11.3 조건, 02 6.4 문구). 보상 수치는 시세 ×1 기준(05 8.9). 하루 두 장은 서로 다른 묶음(group)에서 뽑는다
var ORDERS = [
  { id: 'blast4',   group: '발파', text: '발파로 지뢰 4개를 터뜨려 주세요', goal: 4, reward: { cons: 'powder', n: 2 } },
  { id: 'chain3',   group: '발파', text: '발파 한 번에 지뢰 3개 이상을 터뜨려 주세요(처음 것도 세요)', goal: 1, reward: { pocket: 60 } },
  { id: 'clean3',   group: '발파', text: '보물을 그을리지 않고 발파를 3번 해 주세요(불발은 안 세요)', goal: 3, reward: { cons: 'powder', n: 2 } },
  { id: 'streak3',  group: '콤보',   text: '콤보 ×3을 한 번 찍어 주세요', goal: 1, reward: { candle: 8 } },
  { id: 'deepStreak', group: '콤보', text: '콤보 ×2 이상인 채로 지하 4층에 도착해 주세요', goal: 1, reward: { pocket: 80 } },
  { id: 'noMine',   group: '콤보',   text: '지뢰를 한 번도 터뜨리지 않고 보물 4개 이상을 캐서 하루를 마쳐 주세요', goal: 1, reward: { pocket: 100 }, atEnd: true },
  { id: 'xRight',   group: '분필', text: '직접 그은 X 6칸을 맞혀 주세요. 틀린 X가 나오면 실패예요', goal: 6, reward: { candle: 6 } },
  { id: 'chalkO',   group: '분필', text: 'O를 그은 칸에서 보물 5개를 캐 주세요. O 칸에서 지뢰가 나오면 실패예요', goal: 5, reward: { pocket: 50 } },
  { id: 'bigNum',   group: '분필', text: '4 이상인 숫자와 닿은 칸에서 보물 3개를 캐 주세요', goal: 3, reward: { pocket: 80 } },
  { id: 'chain20',  group: '깊이', text: '한 번에 21칸 이상을 열어 주세요(층에 도착할 때 열리는 것은 안 세요)', goal: 1, reward: { candle: 5 } },
  { id: 'floor5',   group: '깊이', text: '한 층에서 보물 5개를 캐 주세요', goal: 5, reward: { candle: 6 } },
  { id: 'reach5',   group: '깊이', text: '지하 5층에 도착해 주세요', goal: 1, reward: { pocket: 60 } },
  { id: 'noProbe',  group: '분필', text: '두드려 보기를 한 번도 쓰지 않고 보물 8개를 캐 주세요', goal: 8, reward: { pocket: 60 } },
  { id: 'emberT',   group: '분필', text: '불씨로 보물 2개를 캐 주세요', goal: 2, reward: { pocket: 80 } },
  { id: 'keep20',   group: '깊이', text: '지하 4층 이하에서 촛불 21 이상을 남기고 올라가 주세요', goal: 1, reward: { pocket: 50 }, atEnd: true },
  { id: 'gems2',    group: '콤보',   text: '청록 보석 2개를 캐 주세요', goal: 2, reward: { pocket: 80 } }
];

// 광산 변덕(02 6.6 예고·당일 문구). 등급 1 풀은 넷, 여진은 등급 4부터
var MUTATIONS = {   // 02 6.6: 예고는 구 실장 대사, 당일은 해요체
  blur:    { name: '뭉개진 숫자', warn: '그날은 큰 숫자가 뭉개집니다. 4와 5가 똑같이 "4+"로 보입니다.', today: '4와 5가 모두 4+로 보여요' },
  sleepy:  { name: '잠든 계단', warn: '그날은 계단이 빛을 내지 않습니다. 0 옆에 혼자 남은 바위를 찾으세요.', today: '밑줄도 새는 빛도 없어요. 계단은 0 옆에 남은 바위 밑에 있어요' },
  noprobe: { name: '마른 손', warn: '그날은 벽을 두드려도 소리가 안 납니다. 두드려 보기는 못 쓰십니다.', today: '두드려 보기를 쓸 수 없어요' },
  nap:     { name: '선잠', warn: '그날은 광산이 덩이 근처에서 이미 깨어 있습니다. 촛불을 넉넉히 남겨 가세요.', today: '큰 덩이 층에 도착하면 바로 한 번 캘 때 촛불이 2 들어요' },
  twin:    { name: '쌍둥이 지뢰', warn: '그날은 지뢰가 둘씩 붙어 있습니다.', today: '모든 층에서 지뢰가 둘씩 붙어 있어요' },   // 측정용(봇 opts.mutations). 지금은 갱 상태
  quake:   { name: '여진', warn: '그날은 지뢰 하나가 터지면 닿아 있는 지뢰도 터집니다. 다치는 건 한 번입니다.', today: '지뢰를 터뜨리면 주변 8칸으로 닿은 지뢰도 터져요. 체력은 1만 줄어요' }
};
var MUTATION_IDS = ['blur', 'sleepy', 'noprobe', 'nap'];   // R29 등급 1 변덕 풀. 쌍둥이 지뢰는 갱 상태로, 여진은 등급 4 이상. 계단이 보이면(stairShown) 잠든 계단은 뺀다
var TUTORIAL_MUT8 = 'blur';                                // R29 첫 판 Day 8 고정

// 도구: 데이터 + 이벤트 훅. 05 문서 v0.3 4장 32종 가운데 프로토타입에 넣은 12종 + 소모품 2종(효과·가격은 05 4장과 같다)
// 훅 이름: on_day_start, on_floor_enter, on_floor_leave, on_treasure(ev.base/ev.bonus 수정), on_streak_break(ev.to),
//          on_mine(ev.damage), on_blast(ev: mines, scorch), on_blast_mine(ev.n: 이번 점화에서 터진 지뢰 수), on_chain_open(ev.count), on_break, on_mark_hit
// ctx.proc(라벨)은 계산 연출에 아이콘을 띄운다. 값 변화는 ctx.gain / ctx.addCandle / ctx.streakUp으로만.
// sets: 이 도구가 나오는 묶음('21' v2.1 12종, '22' 재미 보고서 12종). CONFIG.toolSet이 고른다
var TOOLS = [
  // 콤보 축
  { id: 'gloves', axis: '콤보', rarity: '일반', name: '배짱 장갑', short: '장갑', price: 120, kind: 'passive', icon: 'gloves', sets: ['21', '22'],
    desc: '하루 한 번, 콤보가 끊길 때 ×1로 떨어지지 않고 한 단계만 내려가요',
    hooks: {
      on_day_start: function (ctx) { ctx.state.ready = true; },
      on_streak_break: function (ctx, ev) { if (ctx.state.ready !== false && ev.from > 0) { ev.to = ev.from - 1; ctx.state.ready = false; ctx.proc('콤보 한 단계만'); } }
    } },
  { id: 'lens', axis: '콤보', rarity: '고급', name: '감정 렌즈', short: '렌즈', price: 180, kind: 'passive', icon: 'lens', sets: ['21', '22'],
    desc: '콤보가 ×1.5 이상일 때 직접 깬 칸의 숫자 옆에, 주변에 보물이 섞여 있으면 보석 점이 찍혀요',
    hooks: {
      on_break: function (ctx, ev) {
        if (!ev.direct || ctx.mult() < CONFIG.lensMinMult) return;
        var c = ctx.cell(ev.x, ev.y);
        if (c && ctx.treasureNear(c)) { c.lens = true; ctx.proc('보석 점'); }
      }
    } },
  { id: 'lastcard', axis: '콤보', rarity: '희귀', name: '마지막 패', short: '패', price: 250, kind: 'passive', icon: 'card', sets: ['21', '22'],
    desc: '체력이 1이면 콤보가 ×5까지 올라요' },
  { id: 'crown', axis: '콤보', rarity: '고급', name: '늙은 광부 모자', short: '모자', price: 240, kind: 'passive', icon: 'crown', sets: ['22'],
    desc: '콤보 상한이 ×3에서 ×4로 올라요' },
  { id: 'amulet', axis: '콤보', rarity: '고급', name: '곽 씨 부적', short: '부적', price: 200, kind: 'passive', icon: 'amulet', sets: ['22'],
    desc: '하루 한 번, 콤보가 ×2 이상일 때 지뢰를 쳐도 체력이 줄지 않아요. 콤보는 끊겨요',
    hooks: {
      on_day_start: function (ctx) { ctx.state.ready = true; },
      on_mine: function (ctx, ev) { if (ctx.state.ready !== false && ctx.mult() >= 2 && ev.damage > 0) { ev.damage = 0; ctx.state.ready = false; ctx.proc('체력 지킴'); } }
    } },
  { id: 'betchalk', axis: '콤보', rarity: '일반', name: '내기 분필', short: '내기 분필', price: 110, kind: 'passive', icon: 'betchalk', sets: ['21', '22'],
    desc: 'O를 그은 칸이 보물이면 콤보가 두 단계 올라요. 지뢰면 피해가 1 더 커요',
    hooks: {
      on_mark_hit: function (ctx, ev) {
        if (ev.mark !== 2) return;
        if (ev.content === 'treasure') { ev.streakStep += 1; ctx.proc('O 적중 콤보 +2'); }
        else if (ev.content === 'mine') { ev.extraDamage += 1; ctx.proc('O 빗나감 피해 +1'); }
      }
    } },
  // 발파 축
  { id: 'fuse', axis: '발파', rarity: '일반', name: '긴 도화선', short: '도화선', price: 130, kind: 'passive', icon: 'fuse', sets: ['21', '22'],
    desc: 'X 칸에 불을 붙이면 두 걸음 안에 있는 다른 X 칸에도 한꺼번에 붙어요. 촛불은 한 번만 들어요' },
  { id: 'refiner', axis: '발파', rarity: '희귀', name: '설익이 정제기', short: '정제기', price: 360, kind: 'passive', icon: 'refiner', sets: ['21', '22'],
    desc: '불 한 번에 지뢰가 3개 이상 터지면 터진 자리마다 금 알갱이가 남아요. 콤보 배율은 받지만 콤보는 오르지 않아요',
    hooks: { on_blast_mine: function (ctx, ev) { var big = ctx.owns('bigblast'); if (ev.n >= (big ? 1 : CONFIG.refinerMin)) ctx.treasure(ev.x, ev.y, CONFIG.treasureValue[1], big ? '큰 발파' : '정제기', { noStreak: !(big && CONFIG.relic.bigStreak) }); } } },   // R33. 큰 발파는 한 개부터, 콤보도 올라요
  { id: 'sieve', axis: '발파', rarity: '고급', name: '그을음 체', short: '그을음 체', price: 240, kind: 'passive', icon: 'sieve', sets: ['21', '22'],
    desc: '불 한 번에 지뢰가 2개 이상 터지면 범위 안 보물이 그을리지 않아요. 제값을 받고 콤보도 올라요',
    hooks: { on_blast: function (ctx, ev) { if (ev.mines >= 2 && ev.scorch) { ev.scorch = false; ctx.proc('그을음 없음'); } } } },
  { id: 'tongs', axis: '발파', rarity: '희귀', name: '해체 집게', short: '집게', price: 310, kind: 'passive', icon: 'tongs', sets: ['21', '22'],
    desc: '불을 붙인 X 칸이 지뢰가 아니면 녹이지 않고 집게로 꺼내요. 촛불은 1만 들고, 보물은 그을린 채(반값) 나와요' },
  { id: 'wedge', axis: '발파', rarity: '고급', name: '울림 쐐기', short: '쐐기', price: 220, kind: 'passive', icon: 'wedge', sets: ['21', '22'],
    desc: '보물이나 지뢰를 없애 숫자가 0이 되면, 그 칸 주변 두 칸까지 안전한 칸이 열려요' },
  { id: 'tapper', axis: '발파', rarity: '일반', name: '청진 망치', short: '망치', price: 120, kind: 'passive', icon: 'tapper', sets: ['22'],
    desc: '하루 두 번 두드려 보기를 쓸 수 있어요(한 번에 촛불 2). 고른 칸이 지뢰인지 아닌지 알려 줘요' },
  // 두루 쓰는 도구(도구 경험 정리, v22)
  { id: 'belt', axis: '', rarity: '희귀', name: '넓은 연장 띠', short: '연장 띠', price: 260, kind: 'passive', icon: 'belt', sets: ['22'],
    desc: '도구 칸이 두 칸 늘어요' },
  { id: 'regular', axis: '', rarity: '일반', name: '심 씨 단골 장부', short: '단골 장부', price: 110, kind: 'passive', icon: 'regular', sets: ['22'],
    desc: '도구를 팔 때 값의 25%를 더 받아요' },
  // 합친 도구: 재료 둘을 가진 밤에 곽 씨가 합쳐 줘요. 상점·선물·연장함에는 나오지 않아요. 재료의 효과를 다 가지고 하나가 더 세져요
  { id: 'bigblast', axis: '발파', rarity: '합침', name: '곽 씨의 큰 발파', short: '큰 발파', price: 490, kind: 'passive', icon: 'bigblast', sets: ['22'], fusion: ['fuse', 'refiner'],
    desc: 'X 칸에 불을 붙이면 두 걸음 안의 X 칸이 모두 함께 터지고, 터진 지뢰 자리마다 금 알갱이가 남아요. 이 금 알갱이는 콤보도 올려요' },
  { id: 'moontongs', axis: '발파', rarity: '합침', name: '달빛 집게', short: '달빛 집게', price: 550, kind: 'passive', icon: 'moontongs', sets: ['22'], fusion: ['tongs', 'sieve'],
    desc: '불을 붙인 X 칸이 지뢰가 아니면 제값으로 꺼내요. X 칸이 모두 지뢰가 아니면 촛불도 들지 않아요. 불 한 번에 지뢰가 2개 이상 터지면 범위 안 보물이 그을리지 않아요' },
  { id: 'deadcrown', axis: '콤보', rarity: '합침', name: '막장 왕관', short: '막장 왕관', price: 490, kind: 'passive', icon: 'deadcrown', sets: ['22'], fusion: ['lastcard', 'crown'],
    desc: '콤보 상한이 ×4예요. 체력이 1이면 ×6까지 오르고, 보물을 캘 때마다 촛불 +1',
    hooks: { on_treasure: function (ctx, ev) { if (ctx.run.d && ctx.run.d.hp === 1 && !ev.scorch) ctx.addCandle(1, '막장 왕관'); } } },
  // v2.1에만 있는 도구(수치만 올리는 도구라 재미 보고서에서 뺐어요)
  { id: 'ledger', axis: '와르르', rarity: '고급', name: '연쇄 장부', short: '장부', price: 230, kind: 'passive', icon: 'ledger', sets: ['21'],
    desc: '층에 도착할 때를 빼고, 한 번에 15칸 이상 열리면 촛불 +3',
    hooks: { on_chain_open: function (ctx, ev) { if (!ev.floorStart && ev.count >= 15) ctx.addCandle(3, '와르르 ' + ev.count + '칸'); } } },
  { id: 'moonsieve', axis: '와르르', rarity: '고급', name: '달빛 체', short: '달빛 체', price: 180, kind: 'passive', icon: 'moonsieve', sets: ['21'],
    desc: '층에 도착할 때를 빼고, 열린 칸 10개마다 다음 보물 값 +10%(최대 +100%). 보물을 캐면 비워져요',
    hooks: {
      on_day_start: function (ctx) { ctx.state.charge = 0; ctx.state.acc = 0; },
      on_chain_open: function (ctx, ev) {
        if (ev.floorStart) return;
        var before = Math.floor((ctx.state.acc || 0) / 10);
        ctx.state.acc = (ctx.state.acc || 0) + ev.count;
        var add = Math.floor(ctx.state.acc / 10) - before;
        if (add > 0) { ctx.state.charge = Math.min(10, (ctx.state.charge || 0) + add); ctx.proc('다음 보물 +' + ctx.state.charge * 10 + '%'); }
      },
      on_treasure: function (ctx, ev) { if (ctx.state.charge > 0) { ev.bonus += ctx.state.charge * 0.1; ctx.state.charge = 0; ctx.proc('보물 값 +' + Math.round(ev.bonus * 100) + '%'); } }
    } },
  { id: 'sheet', axis: '분필', rarity: '일반', name: '현장 검수표', short: '검수표', price: 140, kind: 'passive', icon: 'sheet', sets: ['21'],
    desc: '계단으로 층을 떠날 때, 이 층에서 그은 X가 하나도 틀리지 않았으면 맞은 X 하나에 촛불 +1(층마다 6까지)',
    hooks: {
      on_floor_leave: function (ctx, ev) {
        if (ev.reason !== 'descend') return;
        var f = ctx.floor(), ok = f.xOk || 0, bad = f.xBad || 0;
        f.cells.forEach(function (c) { if (c.cover !== 'open' && c.mark === 1) { if (c.haz === 'mine') ok++; else bad++; } });
        if (ok && !bad) ctx.addCandle(Math.min(CONFIG.sheetCap, ok), 'X ' + ok + '개 전부 맞음');
        else if (bad) ctx.proc('틀린 X ' + bad + '개');
      }
    } },
  // 소모품
  { id: 'powder', rarity: '소모품', name: '화약', short: '화약', price: 40, kind: 'consumable', icon: 'powder', sets: ['21', '22'],
    desc: '고른 X 칸에 촛불 없이 불을 붙여요' },
  { id: 'match', rarity: '소모품', name: '성냥 묶음', short: '성냥', price: 50, kind: 'consumable', icon: 'match', sets: ['21'],
    desc: '촛불이 꺼진 뒤에만 켤 수 있어요. 촛불 +10으로 다시 불이 붙어요' }
];

// 유품: 옛 연장함에서 가끔 나오는 사람 물건. 도구 칸을 쓰지 않고, 팔 수 없고, 그 판 끝까지 남아요(01 15.9)
var KEEPSAKES = [
  { id: 'thickcandle', name: '굵은 초', icon: 'kCandle', desc: '하루 촛불이 10 늘어요', candle: 10 },
  { id: 'ironhelm', name: '무쇠 투구', icon: 'kHelm', desc: '체력이 1 늘어요', hp: 1 },
  { id: 'shortwick', name: '짧은 심지', icon: 'kWick', desc: '하루 촛불이 15 줄어요. 대신 보물 값이 25% 올라요(큰 덩이는 빼고요)', candle: -15, treasureBonus: 0.25 },
  { id: 'crackedhelm', name: '금 간 투구', icon: 'kCrack', desc: '체력이 1 줄어요. 대신 콤보가 한 단계 더 올라가요', hp: -1, capPlus: 1 },
  { id: 'boots', name: '가벼운 장화', icon: 'kBoots', desc: '계단을 오갈 때 촛불이 1 덜 들어요', travel: -1 },
  { id: 'notebook', name: '옛 광부 수첩', icon: 'kBook', desc: '층마다 바랜 X가 하나 더 있고, 바랜 O가 자주 보여요', faded: { o: [0, 1, 1], x: [1, 2, 3] } },
  { id: 'lamp', name: '큰 등잔', icon: 'kLamp', desc: '층에 도착할 때 둘레가 더 넓게 열려요', lamp: 2 },
  { id: 'gravelnet', name: '자갈 거름망', icon: 'kNet', desc: '와르르로 5칸만 열려도 자갈이 나와요', gravelMin: 5 },
  { id: 'pursestring', name: '질긴 주머니 끈', icon: 'kPurse', desc: '쓰러져도 오늘 주머니를 3분의 1만 잃어요', collapseLoss: 1 / 3 },
  { id: 'koocard', name: '구 실장 명함', icon: 'kCard', desc: '도장 선물을 넷 중에서 골라요', giftPlus: 1 },
  { id: 'rustykey', name: '녹슨 열쇠', icon: 'kKey', desc: '옛 연장함에서 도구를 셋 중에서 골라요', boxPlus: 1 },
  { id: 'prayer', name: '아침 기도문', icon: 'kPrayer', desc: '하루를 콤보 ×1.5에서 시작해요', streakStart: 1 }
];

var TEXT = {   // 화면 문구: 02 최신본(R55 해요체, R51 '도장' 표기). 인물 대사(구 실장·곽 씨·심 씨)만 인물 말투
  deedTitle: '광산 계약서',
  stampName: ['첫 도장', '두 번째 도장', '마지막 도장'],
  stampName5: ['첫 도장', '두 번째 도장', '세 번째 도장', '네 번째 도장', '마지막 도장'],
  collapse: ['또 자네군. 주머니는 반만 받겠네.', '숨은 쉬네. 그럼 됐어.', '끌어낸 값으로 {n} 받았네. 나머지는 금고에 넣어 뒀어.', '내일 보세. 도장 찍는 날이 내일은 아니겠지.'],
  collapseEmber: '불 꺼지고 왜 더 쳤나. 대답은 됐네.',
  dayEnd: { normal: '오늘 {n} 넣으셨습니다. 다음 도장까지 {short} 남았습니다.', over: '금고가 도장 값을 넘었습니다. 남는 돈은 손님 겁니다.',
            eve: '내일이 도장 찍는 날입니다. {short} 모자랍니다.', chunkLeft: '덩이는 그대로 두셨군요. 광산은 좋아할 겁니다.', emberT: '꺼진 뒤에도 {n}개 더 캐셨네요. 분필 값은 하셨습니다.' },
  // 02 6.1 도장 찍는 날 밤(구 실장 대사). {mul}은 내일부터의 시세
  pay: {
    1: { ok: ['계약금 {amt} 받았습니다. 첫 도장 찍습니다.', '오늘부터 이 갱은 손님 앞으로 잡아 둡니다. 내일부터 캐시는 건 시세 ×{mul}로 받습니다.', '금고에 {left} 남았습니다. 두 번째 도장 날 조건은 아래에 적어 뒀습니다.'],
         fail: ['{short} 모자랍니다. 계약은 여기까지입니다.', '사흘은 짧습니다. 다들 그렇게 말씀하십니다.', '도장은 다음에 찍겠습니다. 이 갱은 다음 보름에 다시 나옵니다.'] },
    2: { ok: ['두 번째 돈, 중도금 {amt} 받았습니다. 도장 둘입니다.', '여기까지 오는 분이 절반입니다. 내일부터 시세는 ×{mul}입니다.', '금고가 가벼워지셨겠습니다. {left} 남았습니다.'],
         fail: ['{short} 모자랍니다. 특약 5번에 따라 계약을 해지합니다.', '먼저 내신 계약금은 돌려드리지 않습니다. 계약서 첫 장에 있습니다.', '시세 ×3은 도장 둘부터입니다. 하나로는 안 됩니다.'] },
    3: { ok: ['마지막 돈, 잔금 {amt} 받았습니다. 도장 셋입니다. 이제 손님 광산입니다.', '권리증 드립니다. 뒷면은 천천히 읽으세요.', '{left} 남기셨네요. 장부에 적어 두겠습니다.'],
         fail: ['{short} 모자랍니다. 도장 둘에서 해지하는 건 저도 아깝습니다.', '그믐입니다. 광산이 닫히면 저도 못 엽니다.', '낸 돈은 돌려드리지 않습니다. 같은 갱이 다음 보름에 같은 값으로 나옵니다.'] }
  },
  pay5: {   // 도장 다섯 번(v22). 구 실장 대사
    1: { ok: ['계약금 {amt} 받았습니다. 첫 도장 찍습니다.', '오늘부터 이 갱은 손님 앞으로 잡아 둡니다.', '금고에 {left} 남았습니다. 다음 도장도 사흘 뒤입니다.'],
         fail: ['{short} 모자랍니다. 계약은 여기까지입니다.', '사흘은 짧습니다. 다들 그렇게 말씀하십니다.', '도장은 다음에 찍겠습니다. 이 갱은 다음 보름에 다시 나옵니다.'] },
    2: { ok: ['1차 중도금 {amt} 받았습니다. 도장 둘입니다.', '손이 빨라지셨습니다. 사흘 뒤에 또 뵙겠습니다.', '금고에 {left} 남았습니다.'],
         fail: ['{short} 모자랍니다. 도장 하나에서 멈추시는군요.', '먼저 내신 계약금은 돌려드리지 않습니다. 계약서 첫 장에 있습니다.', '이 갱은 다음 보름에 다시 나옵니다.'] },
    3: { ok: ['2차 중도금 {amt} 받았습니다. 도장 셋, 절반을 넘으셨습니다.', '여기서부터 값이 무거워집니다.', '{left} 남았습니다.'],
         fail: ['{short} 모자랍니다. 특약 5번에 따라 계약을 해지합니다.', '여기까지 오는 분이 절반입니다.', '낸 돈은 돌려드리지 않습니다.'] },
    4: { ok: ['3차 중도금 {amt} 받았습니다. 도장 넷입니다.', '그믐까지 사흘입니다. 마지막이 제일 비쌉니다.', '{left} 남았습니다.'],
         fail: ['{short} 모자랍니다. 도장 셋에서 해지하는 건 저도 아깝습니다.', '마지막 고개가 늘 높습니다.', '같은 갱이 다음 보름에 같은 값으로 나옵니다.'] },
    5: { ok: ['잔금 {amt} 받았습니다. 도장 다섯입니다. 이제 손님 광산입니다.', '권리증 드립니다. 뒷면은 천천히 읽으세요.', '{left} 남기셨네요. 장부에 적어 두겠습니다.'],
         fail: ['{short} 모자랍니다. 도장 넷에서 해지하는 건 저도 아깝습니다.', '그믐입니다. 광산이 닫히면 저도 못 엽니다.', '낸 돈은 돌려드리지 않습니다. 같은 갱이 다음 보름에 같은 값으로 나옵니다.'] }
  },
  payFixed: { stamp: '도장 {n}개: 내일부터 캔 값 ×{mul}', stamp2: '도장 {n}개: {change}', next0: '다음은 {name} {amt} · {day}일째', next1: '다음은 {name} {amt} · {day}일째. 그날 변덕은 아래에 있어요', next2: '다음은 {name} {amt} · {day}일째. 그날 변덕 둘은 아래에 있어요' },
  // 02 6.1 게시판 시세 표기
  rate: { 0: '도장 0개: 캔 값 ×{mul} · 금 알갱이 {g} · 청록 보석 {b} · 유물 {r}. 도장 1개면 ×{next}예요',
          1: '도장 1개: 캔 값 ×{mul} · 금 알갱이 {g} · 청록 보석 {b} · 유물 {r}. 도장 2개면 ×{next}예요',
          2: '도장 2개: 캔 값 ×{mul} · 금 알갱이 {g} · 청록 보석 {b} · 유물 {r}. 그믐까지 이 값이에요' },
  // 02 6.2
  voidBody: ['{day}일째 밤, {short} 모자랐어요. 갱구는 잠겼고 다음 보름에 다시 열려요', '권리증에 도장 {n}개를 찍었어요. {total}개를 다 찍어야 광산이 넘어와요', '도구는 갱 안에 두고 나왔어요. 다음 판은 1일째, 첫 도장부터예요'],
  deedBack: '본 매물은 전체 중 왼쪽 새끼발가락에 해당함.',   // 권리증 뒷면 작은 글씨(문서 속 글, 02 5.3)
  deedNext: '다음 매물은 복사뼈입니다. 훨씬 큽니다.',
  // 02 6.7
  chunk: { morning4: '오늘 지하 {n}층에 큰 덩이가 묻혀 있어요. 네 칸이 네모로 붙어 있어요', morning6: '오늘 지하 {n}층에 큰 덩이가 묻혀 있어요. 오늘 덩이는 여섯 칸이에요. 가로 셋, 세로 둘이에요',
           where: '이 층 어딘가에 큰 덩이가 있어요',
           floor: '큰 덩이 층 · 숫자는 덩이를 칸마다 따로 세요', awake: '벽이 울려요. 광산이 깼어요', awakeBar: '광산 깨어남 · 이 층에서는 한 번 캘 때 촛불이 2 들어요',
           napArrive: '벽이 이미 울리고 있어요. 광산은 깨어 있어요',
           last: '한 칸 남았어요. 벽이 따뜻해요', done: '덩이가 빠졌어요. 광산의 숨은 아직 거칠어요', leave: '큰 덩이가 {n}칸 남았어요. 다 캐지 못하면 값을 못 받아요. 그래도 갈까요?',
           fizzle: '불발 · 큰 덩이는 발파로 안 열려요' },
  fizzle: { empty: '불발 · 촛불 -{n}', melt: '불발 · 보물이 녹아 없어졌어요', meltName: '불이 닿은 {name}이(가) 녹아 버렸어요', meltFirst: '굳은 달빛은 불에 녹아요. X는 지뢰가 확실할 때만 그어요' },
  // 02 6.8 불씨와 올라가기
  ember: { start: '촛불이 꺼졌어요. 불씨가 {n} 번 남았어요', bar: '숫자는 안 보여요. 분필 표시는 보여요', last: '마지막 불씨예요', mine: '어둠 속에서 지뢰가 터졌어요. 쓰러졌어요', out: '불씨가 다했어요. 뒤에서 미는 힘이 느껴져요',
           relit: '불이 다시 붙었어요. 남은 불씨 {n}개는 그대로예요', noFire: '불씨로는 발파를 할 수 없어요' },
  lowLight: '촛불이 15 남았어요. 멀리 있는 숫자는 흐리게 보여요',   // 01 4.3
  // 02 6.10 일반 벽 낙서(둘째 판부터, 곽 씨의 존댓말 메모)
  graffiti: ['3이 제일 고약해요. 5는 포기라도 되지요.', '분필은 아끼지 마세요. 내일이면 다 지워져요.', '구 실장 말은 반만 믿으세요. 저도 그 말 듣고 계약했어요.', '저는 도장을 둘까지 찍어 봤어요. 셋째가 제일 비싸요.',
             '콤보 ×3에서 한 칸 더 팠어요. 파지 말 걸 그랬어요.', '벽이 따뜻해요. 저는 생각 안 하기로 했어요.', '여기는 치지 마세요. (그 아래 작은 글씨) 제가 쳤어요. 미안해요.', '큰 덩이를 캘 때 벽이 움찔해요. 아픈 걸까요.'],
  shopTalk: ['계약금 모으는 중이면 구경만 해. 나도 그 맘 알아.', '이 분필은 맞히면 크게 벌고 틀리면 더 아파. 사기 전에 말해 두는 거야.', '진열은 그대로 둘게. 산 자리는 비워 두고.'],
  boardTalk: '주문서 두 장 붙여 놨어. 한 장만 떼 가.',
  // 02 6.9 강조 말풍선 7개(키 이름 없음)
  bubbles: {
    number: '숫자는 주변 8칸의 지뢰와 보물을 합친 수예요',
    gravel: '부서진 바위에서 자갈이 나와요. 조금이지만 쌓여요',
    mine: '지뢰를 터뜨리면 체력이 1 줄어요. 콤보는 ×1로 돌아가요',
    streak: '지뢰 없이 보물을 연달아 캐면 값이 올라요',
    sign: '이 층의 보물은 표지판에 적힌 대로 묻혀 있어요',
    xmark: 'X 칸을 누르면 터뜨려요(촛불 4). 지뢰면 길이 열리고, 보물이면 녹아 없어져요',
    ember: '불씨일 때 지뢰를 터뜨리면 체력이 남아 있어도 쓰러져요',
    gold: '금빛 점이 찍힌 숫자는 큰 덩이에 닿아 있어요'
  },
  // 02 6.9 조작 안내(마우스 동작으로만)
  ops: { chalk: '오른쪽 클릭으로 분필을 그어요. X, O, 지움 순서예요',
         probe: '알아볼 칸을 클릭하세요. 촛불이 2 들어요. 그만두려면 오른쪽 클릭이에요',
         powder: '화약으로 터뜨릴 X 칸을 클릭하세요. 그만두려면 오른쪽 클릭이나 버튼을 다시 누르세요',
         needX: 'X를 그은 칸에만 쓸 수 있어요', noX: '먼저 오른쪽 클릭으로 X를 그어요', xCell: 'X 칸이에요. 캐려면 오른쪽 클릭으로 X를 지우고, 터뜨리려면 발파를 쓰세요',
         aimed: '한 번 더 누르면 캐요 · 촛불 −{n}', stair: '계단을 한 번 더 클릭하면 내려가요',
         noPath: '가는 길이 없어요', returnAsk: '버리는 촛불 {c} · 금고로 가는 주머니 {p}' },
  stairShown: '계단 자리는 처음부터 보여요. 가는 길을 숫자로 찾아요',
  candleOut: '촛불이 다 탔어요. 오늘은 여기까지예요',
  perfect: '완벽한 층이에요. 보물을 다 캐고 지뢰를 한 번도 안 밟았어요',
  chord: { need: '주변에 그은 X·O 수가 숫자와 같을 때 한꺼번에 열 수 있어요', none: '주변에 열 칸이 없어요', hint: '한 번 더 누르면 주변 칸을 한꺼번에 열어요 · 촛불 −{n}' },
  reward: { title: '도장 선물', enter: '도장 기념입니다. 셋 중 하나 가져가세요.', cashEnter: '도구가 싫으시면 금고에 {cash} 넣어 드리겠습니다.', button: '이걸로 받기', cash: '금고에 {cash} 받기', full: '도구 칸이 가득이라 금고로 받아요' },
  // 판 위 옛 연장함(곽 씨 대사는 하게체)
  box: { arrive: '촛불이 크게 흔들려요. 이 층 어딘가에 옛 연장함이 묻혀 있어요', dug: '옛 연장함을 캤어요. 안에 든 도구 하나를 골라요', scorched: '그을린 연장함이에요. 쓸 만한 건 하나뿐이에요',
         melt: '불이 닿은 옛 연장함이 녹아 버렸어요', title: '옛 연장함', kwak: ['내 형님들 시절 물건이로군. 하나 골라 가게.', '녹은 털어 냈네. 쓸 만한 걸로 골라.', '이런 게 아직 묻혀 있었구먼.'],
         kwakScorch: '그을려서 하나밖에 못 건졌네.', full: '도구 칸이 가득이에요. 내려놓을 도구를 고르면 곽 씨가 값의 4분의 1에 받아 가요', pass: '곽 씨에게 넘기기 +{n}', passEmpty: '곽 씨에게 넘기기 +{n} (고물값)',
         passed: '곽 씨가 연장함을 받아 갔어요. 주머니 +{n}', dropped: '{name} 곽 씨에게 넘겼어요. 주머니 +{n}', took: '{name} 챙겼어요' },
  // 도장 날 금고가 모자랄 때(구 실장은 합니다체, 심 씨는 반말)
  short: { quote: '{short} 모자랍니다. 오늘 밤 안에 채우시면 도장 찍습니다.', sell: '도구를 팔아 채우기', loanAsk: '모자란 {short}, 내가 빌려줄게. 다음 도장 날 {repay} 같이 갚아.', loan: '심 씨에게 빌리기: {short} 받고 다음 도장에 {repay}',
           loanUsed: '심 씨 외상은 한 판에 한 번이에요', lastNo: '마지막 도장은 빌릴 수 없어요', giveUp: '계약 해지', payNow: '도장 찍기', loanLine: '심 씨 빚 {n}이(가) 다음 도장에 붙었어요' },
  keep: { dug: '옛 연장함을 캤어요. 안에 유품이 하나 들어 있어요', title: '옛 연장함 · 유품', kwak: '이건 연장이 아니라 사람 물건이로군. 챙기든 두고 가든 자네 뜻이네.', take: '챙기기', leave: '두고 가기',
          took: '{name} 챙겼어요. 이 판 끝까지 남아요', left: '유품을 두고 왔어요', note: '유품은 도구 칸을 쓰지 않고, 팔 수 없고, 이 판 끝까지 남아요', row: '유품' },
  faded: { first: '벽에 바랜 분필 자국이 남아 있어요. 앞서 다녀간 광부가 그은 거라 늘 맞아요', locked: '오래된 자국이라 지워지지 않아요' },
  unknownTool: '이름 모를 연장', unknownKeep: '이름 모를 유품', revealed: '이름이 열렸어요',
  fuse: { talk: '옛 연장이 섞였으니 이 둘은 합칠 수 있겠네. 공짜로 해 주지.', hint: '곽 씨: "이건 옛 연장과 만나면 무언가와 합쳐질 것 같네."', boxHint: '곽 씨: "옛 연장이군. 무언가와 합쳐질 것 같네."', recipe: '합치기: {mate} 합치면 {name} · 둘 중 하나는 연장함에서 나온 것', old: '연장함에서 나온 옛 연장', button: '합치기', done: '곽 씨가 {a} {b} 합쳐 {name} 만들었어요' },
  chunkShownFloor: '큰 덩이 층 · 금빛 테두리가 덩이 자리예요. 숫자는 덩이를 칸마다 따로 세요',
  stageChange: { mul: '내일부터 캔 값 ×{mul}', deep: '내일부터 갱이 한 층 깊어져요(지뢰와 보물이 늘어요)', same: '캔 값은 그대로예요' },
  daily: '오늘의 광산',
  deeper: '깊을수록 보물이 많고 비싼 보물이 잘 나와요. 지뢰도 늘고, 내려가는 촛불도 늘어요',
  // 용어 설명(화면에서 마우스를 올리면 떠요). 07 용어집과 같은 뜻, 해요체 한두 줄
  terms: {
    '콤보': '지뢰를 치지 않고 보물을 연달아 캐면 보물 값의 배수가 올라요(×1 → ×1.5 → ×2 … ×3). 지뢰를 치면 ×1로 돌아가요',
    '오늘 주머니': '오늘 캔 돈이에요. 올라가면 금고로 옮겨요. 쓰러지면 절반을 잃어요',
    '금고': '모아 둔 돈이에요. 도장 값을 내고 도구를 사요. 쓰러져도 줄지 않아요',
    '도장': '광산 값을 나눠 낼 때마다 권리증에 도장을 찍어요. 도장 찍는 날 밤에 금고가 모자라면 계약이 끝나요',
    '촛불': '하루에 쓸 수 있는 힘이에요. 캐기 1, 발파 4, 계단은 2 + 내려갈 층. 다 타면 그날은 끝나요',
    '체력': '지뢰를 치면 1 줄어요. 0이 되면 쓰러져서 오늘 주머니의 절반을 잃어요. 다음 날 다시 차요',
    '광맥': '그 층에 보물이 묻힌 규칙이에요. 규칙을 알면 숫자만으로는 모르는 칸이 보물인지 지뢰인지 가릴 수 있어요',
    '발파': 'X를 그은 칸에 불을 붙여요(촛불 4). 지뢰면 다치지 않고 터져서 주변이 열려요. 보물이면 녹아 없어져요',
    '두드려 보기': '고른 칸 하나가 지뢰인지 아닌지 알려 줘요. 촛불이 2 들어요',
    '가진 도구': '갖고만 있어도 효과가 나는 도구예요. 칸이 가득이면 팔거나 바꿔서 자리를 만들어요',
    '옛 연장함': '지하 2층부터 가끔 보물 자리에 묻혀 있어요. 숫자에는 보물로 세요. 캐면 도구 하나를 고르거나 유품을 챙기고, 불에 닿으면 녹아요',
    '버튼으로 쓰는 것': '버튼을 누르고 판에서 칸을 골라 써요. 화약 같은 물건은 한 번 쓰면 없어져요',
    '남은 보물·지뢰': '이 층에 아직 묻혀 있는 보물과 지뢰의 수예요. 다 세면 마지막 칸도 알 수 있어요',
    '큰 덩이': '도장 찍는 날 묻히는 큰 보물이에요. 금빛 테두리 안 칸을 다 캐야 값을 받아요',
    '지하 층': '깊을수록 보물이 많고 비싼 보물이 잘 나와요. 지뢰도 늘고, 내려가는 촛불도 늘어요',
    '시세': '도장을 찍으면 다음 날부터 캔 값이 오르거나 갱이 깊어져요'
  },
  // 지뢰를 밟았을 때 알 수 있던 칸이었는지 한 줄(재미 보고서 1주차)
  mineJudge: { known: '알 수 있던 칸이에요. 숫자와 표지판으로 지뢰가 확실했어요', bet: '보물 아니면 지뢰인 칸이었어요. 이번에는 지뢰였어요', unknown: '숫자만으로는 가리기 어려운 칸이었어요' },
  // R56 계단 빛 번짐(02 6.9 기록 창)
  light: { first: '저쪽 바닥에 빛이 번져 있어요. 계단이 가까이 있어요', none: '오늘은 어디에도 빛이 안 새요',
           graffiti: '빛이 새는 쪽에 계단이 있어요.', rock: '빛이 새는 바위 밑이 계단이에요.' },
  // 02 6.11 중개소 선물
  gift: { title: '중개소 선물', enter: '계약 기념입니다. 셋 중 하나 가져가세요.', enter2: '고르신 건 그믐까지 손님 겁니다. 그 뒤엔 갱에 두고 나오셔야 합니다.', button: '이걸로 받기', after: '나머지 둘은 심 씨 가게에 나올 수도 있습니다. 그땐 제값입니다.' },
  // 02 6.12 오프닝 3컷
  opening: [
    { cap: '마법 광산을 판대요. 값은 헐값이고, 보름달에만 열린대요.' },
    { who: '구 실장', cap: '15일 안에 세 번 나눠 내세요. 낼 때마다 도장을 찍어 드려요. 도장 세 개면 광산은 당신 거예요.' },
    { cap: '가진 건 촛불 하나와 곡괭이 한 자루예요.' }],
  axisName: { '콤보': '콤보 도구', '발파': '발파 도구', '와르르': '와르르 도구', '분필': '분필 도구', '': '두루 쓰는 도구' }
};


// 첫 판 고정 층(01 16.2). 기호: . 빈칸  m 지뢰  g 금 알갱이  G 청록 보석  s 계단  X 분필 X가 그어진 지뢰  O 분필 O가 그어진 금 알갱이
// 자갈은 고정 시드로 뿌린다. 낙서 문구와 번호는 02 6.9, 놓는 자리와 보이는 조건은 01 16.3.
// Day 2·3의 정해진 층은 고정 시드에서 '가르칠 요소'가 확실히 나오는 첫 배치를 찾아 쓴다(k = 미리 찾아 둔 시드 번호. 맞지 않으면 다시 찾는다)
var TUTORIAL = {
  seed: 20261120,
  // R45: Day 1 지하 1~3층은 손으로 배치한 데이터(06 장면 2~6). 지하 2층은 고른 광맥마다 한 장, 계단 자리는 같다
  floors: {
    1: { rule: 'plain', start: [7, 5], map: [
      '..............m',
      'g..m..g..m..G..',
      '...............',
      '.m...g.......g.',
      '...............',
      '.......@...m.s.',
      '.g.............',
      '.............m.',
      '...............',
      'm..g..m..g..m..',
      '..m....m...m..m'],
      graffiti: [
        { x: 3, y: 6, w: 4, text: '숫자는 주변 8칸에 묻힌 것의 개수예요. 지뢰와 보물을 합쳐서 세요.' },
        { x: 7, y: 3, w: 3, text: '1 옆에 바위가 하나만 남았으면 거기에 뭔가 있어요.', target: [5, 3] },
        { x: 7, y: 4, w: 3, text: '저도 여기서 한 번 데었어요. 곡괭이 불꽃도 같이 꺼졌어요.', after: 'mine', mine: [11, 5] },   // 06 장면 4: 지뢰가 터진 뒤에만
        { x: 9, y: 7, w: 3, text: '밑줄 그어진 숫자 옆에 계단이 있어요.', stairHint: true },   // 계단이 보이면(stairShown) 빼요
        { x: 9, y: 0, w: 5, text: '빛이 새는 쪽에 계단이 있어요.', stairHint: true }],
      glow: [[5, 3]] },
    2: { rule: 'pair', options: ['plain', 'pair'], bonus: { plain: 'candle', pair: 'streak' }, start: [13, 5],
         maps: {
           pair: ['...............', '...............', 'm..m..m........', '...........g...', '......m...mg...', 'g......m..m..@.',
                  'gm..m.....m....', '..m.........g..', '.........mg.g..', '....s.....G....', '......m......m.'],
           plain: ['...............', '...............', '.......mm......', '..m.m....g..mm.', '...gm..........', '....g....g...@.',
                   '..m............', '.m...gm.m.gm...', '.m.......G..G..', '....s..........', '......m........'] },
         glow: { plain: [[12, 8]] },
         graffitiRule: { pair: '표지판부터 읽고 파세요. 보물이 하나 나오면 바로 옆에 하나 더 있어요.' },
         graffiti2: '지뢰를 안 터뜨리고 계속 캐면 값이 올라요. 세 개째부터 두 배예요.' },
    3: { rule: 'border', options: ['border', 'lonely'], bonus: { border: 'value', lonely: 'candle' }, start: [4, 9],
         map: ['mG..m....g.....', '......g..m.g...', '.....m.......G.', '...............', '.....m.........', '...............',
               '.m....X.m....m.', '.m.....X...m...', '.O..........m..', '....@......gs.m', '..g.....gm.....'] }
  },
  // Day 2 지하 1층(테두리), Day 2 지하 2층(짝 / 외톨이), Day 3 지하 3층(테두리 / 외톨이, 큰 덩이)
  later: {
    '2-1': { rule: 'border', k: 1, text: '쓰러지면 제가 주머니 절반을 받아 가요. 금고는 안 건드려요. (옆 갱 곽)' },
    '2-2': { options: ['pair', 'lonely'], k: { pair: 0, lonely: 0 }, text: '모르겠으면 두드려 보세요. 아껴도 남는 게 없어요.' },
    '3-3': { options: ['border', 'lonely'], text: '큰 덩이는 네모로 묻혀 있어요. 건드리면 촛불이 두 배로 타니 콤보를 살려서 오세요.' }
  },
  gang: { 2: 'thin', 3: 'moon' },          // 01 11.2 첫 판 고정 갱 상태
  firstRule: { 2: 'border' },             // 01 16.2 Day 2 게시판 "오늘 첫 층: 테두리 광맥"
  b3Graffiti: { x: 'X 칸은 누르면 터져요. 보물이면 녹으니 지뢰가 확실할 때만 그으세요.', o: '불이 꺼져도 O는 보여요. 미리 그어 두세요.', stair: '이 밑은 내일 가세요.' }
};

var TREASURE_NAMES = { 1: '금 알갱이', 2: '청록 보석', 3: '유물' };

// ---------- 프리셋: v21(2차 기획 v2.1 그대로) / v22(재미 보고서 2~4주차, 기본) ----------
// 봇이 두 방식을 같은 씨앗으로 비교할 수 있게 v2.1 값을 그대로 남겨 둬요. applyPreset('v21')이면 v2.1과 같은 판이 나와요
var PRESET_KEYS = ['ruleTune', 'payments', 'stages', 'chunks', 'rulePool', 'stairShown', 'countsShown', 'features', 'toolSet', 'voidCompare', 'gift', 'tutorialShopDay1', 'gradeMul', 'shop'];
function cloneJ(o) { return JSON.parse(JSON.stringify(o)); }
var PRESETS = { v21: { config: {}, text: { opening1: TEXT.opening[1].cap, later22: TUTORIAL.later['2-2'].text, later33: TUTORIAL.later['3-3'].text, gravel: TEXT.bubbles.gravel } } };
PRESET_KEYS.forEach(function (k) { PRESETS.v21.config[k] = cloneJ(CONFIG[k]); });
PRESETS.v21.config.stairShown = false; PRESETS.v21.config.countsShown = false;   // v2.1은 계단을 숨겨요(1주차 이전)
PRESETS.v22 = {
  config: {
    // 봇 측정으로 맞춘 금액. 도구 경험(칸 8, 연장함) 뒤 다시 올림: 마지막 도장 보통 76%, 신중 31%, 욕심 65%(05 8.15)
    payments: [{ day: 3, name: '계약금', amount: 300 }, { day: 6, name: '1차 중도금', amount: 900 }, { day: 9, name: '2차 중도금', amount: 1900 },
               { day: 12, name: '3차 중도금', amount: 3400 }, { day: 15, name: '잔금', amount: 5500 }],
    // 도장 수(0~5)에 따른 시세와 깊어짐: 값은 ×1.5에서 멈추고, 도장을 찍을수록 층 표를 한 칸씩 깊게 써요
    stages: [{ startDepth: 1, rowShift: 0, valueMul: 1 }, { startDepth: 1, rowShift: 0, valueMul: 1.5 }, { startDepth: 1, rowShift: 1, valueMul: 1.5 },
             { startDepth: 1, rowShift: 2, valueMul: 1.5 }, { startDepth: 1, rowShift: 3, valueMul: 1.5 }, { startDepth: 1, rowShift: 3, valueMul: 1.5 }],
    chunks: { 3: { depth: 3, w: 2, h: 2, value: 60 }, 6: { depth: 4, w: 2, h: 2, value: 100 }, 9: { depth: 5, w: 2, h: 2, value: 160 },
              12: { depth: 5, w: 3, h: 2, value: 220 }, 15: { depth: 5, w: 3, h: 2, value: 260 } },
    rulePool: ['pair', 'border', 'lonely'],   // 맨땅은 첫날 첫 층만
    ruleTune: { pair: { t: -2 }, border: { t: 2 }, lonely: { t: 4 } },   // 광맥별 Day 9~14 수입을 평균 ±10% 안으로(봇 60판씩)
    stairShown: true, countsShown: true,
    features: { gang: false, orders: false, mutations: false, awake: false, forkBonus: false, rooms: false, embers: false, lowLight: false,
                sellBack: false, probeBase: false, gravel: 'chain', startGift: false, stampReward: true, chord: true, chunkShown: true, perfect: true,
                relicBox: true, toolSell: true, fusion: true, loan: true, fadedChalk: true, keepsake: true },
    shop: { tools: 3, cons: 2, reroll: 20, sellBack: 0.5, passiveSlots: 8, consSlots: 3, stack: 3, merchantDiscount: 0, merchantService: { price: 50, candle: 10 },
            rarityWeight: { '일반': 50, '고급': 35, '희귀': 15 } },   // 도구 칸 8(도구 경험 정리)
    toolSet: '22',
    voidCompare: { 1: 1110, 2: 2420, 3: 3130, 4: 4350, 5: 5250 },   // 그 도장을 찍은 판의 그 구간 수입 평균(세 정책 400판, 05 8.12)
    gift: { n: 3, rarity: '일반', tutorial: ['betchalk', 'gloves', 'fuse'] },
    tutorialShopDay1: ['tapper', 'lens', 'amulet', 'powder'],
    gradeMul: [1, 1.3, 1.8, 2, 2.2, 2.4, 2.6]   // 등급 2·3 배수(v22 봇 측정, 05 8.12)
  },
  text: { opening1: '15일 안에 다섯 번 나눠 내세요. 사흘마다 도장을 찍어 드려요. 도장 다섯 개면 광산은 당신 거예요.',
          later22: '숫자로 못 가르는 두 칸이에요. 걸어 보든지, 다른 쪽부터 풀든지 골라요.',
          later33: '큰 덩이는 금빛 테두리 안에 있어요. 주변 숫자부터 풀고, 콤보를 살려서 오세요.',   // v22에는 광산 깨어남이 없어요
          gravel: '한 번에 많이 열리면 자갈이 나와요. 조금이지만 쌓여요' }
};
function applyPreset(name) {
  var P = PRESETS[name]; if (!P) return false;
  Object.keys(P.config).forEach(function (k) { CONFIG[k] = cloneJ(P.config[k]); });
  TEXT.opening[1].cap = P.text.opening1; TUTORIAL.later['2-2'].text = P.text.later22; TUTORIAL.later['3-3'].text = P.text.later33; TEXT.bubbles.gravel = P.text.gravel;
  CONFIG.preset = name;
  return true;
}
applyPreset('v22');

var Core = (function () {
  var W = CONFIG.W, H = CONFIG.H, N = W * H;
  var DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  var ORTH = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  var TOOL_BY_ID = {}; TOOLS.forEach(function (t) { TOOL_BY_ID[t.id] = t; });
  var KEEP_BY_ID = {}; KEEPSAKES.forEach(function (k) { KEEP_BY_ID[k.id] = k; });
  function keepSum(run, key) { return (run.keeps || []).reduce(function (a, id) { return a + (KEEP_BY_ID[id][key] || 0); }, 0); }
  function keepWith(run, key) { var id = (run.keeps || []).filter(function (k) { return KEEP_BY_ID[k][key] != null; })[0]; return id ? KEEP_BY_ID[id] : null; }
  // ---------- 캐릭터와 스킬 ----------
  // 캐릭터는 '숫자로 확정할 수 없는 칸을 다루는 방식'이 서로 달라요. 스킬은 X 칸·O 칸을 누를 때만 움직여요(새 버튼 없음).
  // innate: 몸에 지닌 도구(칸을 차지하지 않고, 상점·선물에 나오지 않아요). 나머지는 수치 손잡이예요.
  var CHAR_BY_ID = {}; CHARACTERS.forEach(function (c) { CHAR_BY_ID[c.id] = c; });
  function CHAR_IDS_OK(id) { return id && CHAR_BY_ID[id] ? id : null; }
  function charOf(run) { return CHAR_BY_ID[(run && run.char) || 'miner'] || CHAR_BY_ID.miner; }
  function innate(run) { return charOf(run).innate || []; }
  var ORDER_BY_ID = {}; ORDERS.forEach(function (o) { ORDER_BY_ID[o.id] = o; });
  var GANG_BY_ID = {}; GANG.forEach(function (g) { GANG_BY_ID[g.id] = g; });

  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed() {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < arguments.length; i++) { h ^= (arguments[i] | 0); h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; }
    return h >>> 0;
  }
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }
  function weightedIdx(rng, arr) { var tot = 0, i; for (i = 0; i < arr.length; i++) tot += arr[i]; var r = rng() * tot; for (i = 0; i < arr.length; i++) { r -= arr[i]; if (r < 0) return i; } return 0; }
  function inB(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function cellAt(f, x, y) { return inB(x, y) ? f.cells[y * W + x] : null; }
  function idx(c) { return c.y * W + c.x; }
  function neighbors(f, x, y) { var out = []; for (var i = 0; i < 8; i++) { var c = cellAt(f, x + DIRS[i][0], y + DIRS[i][1]); if (c) out.push(c); } return out; }
  function orthN(f, x, y) { var out = []; for (var i = 0; i < 4; i++) { var c = cellAt(f, x + ORTH[i][0], y + ORTH[i][1]); if (c) out.push(c); } return out; }
  function liveHaz(c) { return !!c.haz && !c.removed; }
  function numAt(f, c) { var n = 0, nb = neighbors(f, c.x, c.y); for (var i = 0; i < nb.length; i++) if (liveHaz(nb[i])) n++; return n; }
  function covered(c) { return c.cover !== 'open'; }
  function treasureNear(f, c) { return neighbors(f, c.x, c.y).some(function (n) { return liveHaz(n) && n.haz === 'treasure'; }); }
  function josa(w, withB, noB) { var c = String(w).charCodeAt(String(w).length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? withB : noB); }   // 받침에 맞는 조사(을/를, 과/와)
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function isBorder(x, y) { return x < 2 || y < 2 || x >= W - 2 || y >= H - 2; }
  function gang(run, id) { return run.gang && run.gang.id === id; }
  function mut(run, id) { return run.d && run.d.mutations && run.d.mutations.indexOf(id) >= 0; }
  function twinDay(run) { return mut(run, 'twin') || gang(run, 'twin'); }
  function owns(run, id) {   // 캐릭터가 몸에 지닌 도구, 합친 도구의 재료도 가진 것으로 쳐요
    if (run.owned.indexOf(id) >= 0 || innate(run).indexOf(id) >= 0) return true;
    for (var i = 0; i < run.owned.length; i++) { var t = TOOL_BY_ID[run.owned[i]]; if (t && t.fusion && t.fusion.indexOf(id) >= 0) return true; }
    return false;
  }
  function slotsOf(run) { return CONFIG.shop.passiveSlots + (owns(run, 'belt') ? CONFIG.relic.beltSlots : 0); }   // 넓은 연장 띠: +2칸
  function stage(run) { var S = CONFIG.stages; return S[Math.min(run.stamps || 0, S.length - 1)]; }
  function feat(k) { return CONFIG.features[k]; }
  function pays(run) { return (run && run.payments) || CONFIG.payments; }
  function stampNames(run) { return pays(run).length === 5 ? TEXT.stampName5 : TEXT.stampName; }
  function cellRes(c) { return feat('gravel') === 'cell' ? c.res : 0; }   // 자갈: 'cell' 칸마다 / 'chain' 큰 와르르만(endAct)
  var V21_ORDER = ['gloves', 'lens', 'lastcard', 'fuse', 'refiner', 'sieve', 'ledger', 'moonsieve', 'wedge', 'betchalk', 'sheet', 'tongs', 'powder', 'match'];   // v2.1 목록 순서(상점 뽑기가 v2.1과 같게)
  function toolPool() {
    if (CONFIG.toolSet === '21') return V21_ORDER.map(function (id) { return TOOL_BY_ID[id]; });
    return TOOLS.filter(function (t) { return (!t.sets || t.sets.indexOf(CONFIG.toolSet) >= 0) && !t.fusion; });   // 합친 도구는 진열·선물·연장함에 안 나와요
  }
  function gradeMulOf(run) { return CONFIG.gradeMul[Math.max(0, (run.grade || 1) - 1)] || 1; }
  function poolList(run) {   // 이 판에 나오는 광맥(등급별로 늘어요)
    if (!CONFIG.rulePool) return null;
    var extra = (CONFIG.preset === 'v22' && CONFIG.gradeRules[run.grade || 1]) || [];
    return CONFIG.rulePool.concat(extra.filter(function (r) { return CONFIG.rulePool.indexOf(r) < 0; }));
  }

  // ---------- 이벤트 / 도구 ----------
  function log(run, text, kind) { run.log.push({ text: text, id: ++run.logSeq, kind: kind || '' }); if (run.log.length > 60) run.log.shift(); }
  function fx(run, e) { run.fx.push(e); if (run.fx.length > 400) run.fx.shift(); }
  function toolCtx(run, tool) {
    if (!run.toolState[tool.id]) run.toolState[tool.id] = {};
    return {
      run: run, state: run.toolState[tool.id], tool: tool,
      proc: function (label) { fx(run, { t: 'proc', id: tool.id, icon: tool.icon, label: label }); },
      addCandle: function (n, label) { if (!run.d) return 0; var g = addCandle(run, n); fx(run, { t: 'proc', id: tool.id, icon: tool.icon, label: (label ? label + ' · ' : '') + '촛불 +' + g }); return g; },
      treasure: function (x, y, base, label, opt) { gainTreasure(run, x, y, base, Object.assign({ label: label, tool: tool }, opt || {})); },
      mult: function () { return streakMult(run); },
      cell: function (x, y) { return cellAt(run.d.floor, x, y); },
      floor: function () { return run.d.floor; },
      treasureNear: function (c) { return treasureNear(run.d.floor, c); },
      owns: function (id) { return owns(run, id); }
    };
  }
  function emit(run, name, ev) {
    run.eventCounts[name] = (run.eventCounts[name] || 0) + 1;
    var ids = [];   // 합친 도구는 재료의 효과도 함께 내요
    var add = function (id) { if (ids.indexOf(id) < 0) ids.push(id); };
    run.owned.forEach(function (id) { var t = TOOL_BY_ID[id]; if (t && t.fusion) t.fusion.forEach(add); add(id); });
    innate(run).forEach(add);
    for (var i = 0; i < ids.length; i++) {
      var t = TOOL_BY_ID[ids[i]];
      if (t.hooks && t.hooks[name]) t.hooks[name].call(t, toolCtx(run, t), ev);
    }
    return ev;
  }
  function addCandle(run, n) {
    var d = run.d; if (!d || n <= 0) return 0;
    d.candle += n;
    if (d.embersOn) { d.embersOn = false; log(run, TEXT.ember.relit.replace('{n}', d.embers)); fx(run, { t: 'relit' }); }   // 01 4.4: 남은 불씨는 그대로 보관
    fx(run, { t: 'candle', delta: n });
    return n;
  }
  function emberTotal(run) { return CONFIG.embers + (gang(run, 'ember') ? 2 : 0); }
  function spendCandle(run, n) { var d = run.d; var s = Math.min(d.candle, n); d.candle -= s; if (s) fx(run, { t: 'candle', delta: -s }); return s; }

  // ---------- 콤보 ----------
  function streakCapIdx(run) { if (run.d && run.d.hp === 1 && owns(run, 'deadcrown')) return CONFIG.streakCapIdxDeadCrown; return (owns(run, 'lastcard') && run.d && run.d.hp === 1) ? CONFIG.streakCapIdxLastCard : CONFIG.streakCapIdx + (owns(run, 'crown') ? 2 : 0) + (charOf(run).capPlus || 0) + keepSum(run, 'capPlus'); }   // 늙은 광부 모자: ×3 → ×4
  function streakMult(run) { var d = run.d; if (!d) return 1; return CONFIG.streakLadder[Math.min(d.streak, streakCapIdx(run))]; }
  function streakUp(run, steps) {
    var d = run.d, cap = streakCapIdx(run), before = d.streak;
    d.streak = Math.min(cap, d.streak + steps);
    if (d.streak > d.stats.maxStreak) d.stats.maxStreak = d.streak;
    if (d.streak !== before) fx(run, { t: 'streak', from: before, to: d.streak });
    orderEvent(run, 'streak');
  }
  function streakBreak(run, x, y) {
    var d = run.d; if (d.streak <= 0) return;
    var ev = emit(run, 'on_streak_break', { from: d.streak, to: 0 });
    var from = d.streak; d.streak = Math.max(0, ev.to);
    fx(run, { t: 'streakBreak', from: from, to: d.streak, x: x, y: y });
    log(run, d.streak > 0 ? '콤보가 한 단계만 내려갔어요 (×' + CONFIG.streakLadder[from] + ' → ×' + streakMult(run) + ')' : '콤보가 끊겼어요 (×' + CONFIG.streakLadder[from] + ' → ×1)', 'bad');
  }

  // ---------- 판 생성 ----------
  function densityRow(depth, shift) { var T = CONFIG.density; return Object.assign({}, T[Math.min(depth + (shift || 0), T.length) - 1]); }
  function blankFloor(depth, rule, sx, sy) {
    var cells = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++)
      cells.push({ x: x, y: y, haz: null, removed: false, tier: 0, stair: false, res: 0, cover: 'rock', mark: 0, probe: null, scorch: false, lens: false, seen: false, fizzle: false, chunk: false });
    return { cells: cells, depth: depth, rule: rule, sx: sx, sy: sy, stair: null, chunk: null, awake: false, graffiti: [],
             forkOptions: null, ok: false, solvable: false, attempts: 0, treasuresDug: 0, tutorial: false };
  }
  // spec: { depth, rule, sx, sy, seed, chunk, twin, gangId, tierUp }
  function genFloor(spec) {
    var rng = rngFrom(spec.seed), best = null, bestSolv = null;
    var mineRule = CONFIG.usefulMineRules.indexOf(spec.rule) >= 0;
    var needUse = (CONFIG.usefulRules.indexOf(spec.rule) >= 0 || mineRule) && CONFIG.usefulMin > 0;
    var useMin = mineRule ? CONFIG.usefulMineMin : CONFIG.usefulMin;
    for (var a = 0; a < CONFIG.genRetries; a++) {
      var f = tryGen(rng, spec, a);
      f.attempts = a + 1;
      if (!f.ok) continue;
      f.solvable = isSolvable(f);
      if (f.solvable) {
        // R30 쓸모 검사: 광맥 규칙으로 보물로 확정되는 칸이 2개 이상(맨땅 제외). 정해진 횟수 안에 안 되면 생략(01 10.4)
        if (!needUse) return f;
        f.usefulT = usefulCount(f);
        f.useful = f.usefulT >= useMin;
        if (f.useful) return f;
        if (!bestSolv || f.usefulT > bestSolv.usefulT) bestSolv = f;
        if (a + 1 >= CONFIG.usefulTries) return bestSolv;
        continue;
      }
      if (!best) best = f;
    }
    if (bestSolv) return bestSolv;
    if (best) return best;
    // 제약을 못 맞추면 지뢰를 줄여 반드시 끝나게 한다
    for (var k = 1; k < 40; k++) {
      var s2 = Object.assign({}, spec, { mineCut: k });
      var f2 = tryGen(rng, s2, 99);
      if (f2.ok) { f2.solvable = isSolvable(f2); f2.attempts = CONFIG.genRetries + k; f2.relaxed = true; return f2; }
    }
    f2.relaxed = true; return f2;
  }
  function tryGen(rng, spec, attempt) {
    var depth = spec.depth, rule = spec.rule, sx = spec.sx, sy = spec.sy;
    var f = blankFloor(depth, rule, sx, sy), cells = f.cells, i;
    var row = densityRow(depth, spec.rowShift);
    var m = row.m, t = row.t;
    if (spec.gangId === 'smell') { m += 2; t += 2; }
    if (spec.gangId === 'quiet') { m -= 2; t -= 1; }
    m += spec.extraM || 0; t += spec.extraT || 0;   // 갈림길 덤 '더 묻힌 층'
    var tune = CONFIG.ruleTune && CONFIG.ruleTune[rule]; if (tune) { t += tune.t || 0; m += tune.m || 0; }
    if (spec.mineCut) m = Math.max(2, m - spec.mineCut);
    var pairT = rule === 'pair' || (spec.twin && CONFIG.twinBoth), pairM = rule === 'minepair' || spec.twin;
    if (pairT && t % 2) t++;
    if (pairM && m % 2) m++;
    var reserved = {};
    for (var y = sy - 1; y <= sy + 1; y++) for (var x = sx - 1; x <= sx + 1; x++) if (inB(x, y)) reserved[y * W + x] = 1;
    // 계단 1개
    var dists = [5, 4, 3];
    for (var k = 0; k < dists.length && !f.stair; k++) {
      var cand = cells.filter(function (c) { return !reserved[idx(c)] && cheb(c.x, c.y, sx, sy) >= dists[k]; });
      if (cand.length) { var sc = pick(cand, rng); sc.stair = true; f.stair = { x: sc.x, y: sc.y, found: false }; }
    }
    var stairC = cellAt(f, f.stair.x, f.stair.y);
    function free(c) { return !reserved[idx(c)] && !c.stair && !c.haz; }
    // 큰 덩이
    if (spec.chunk) {
      var cw = spec.chunk.w, ch = spec.chunk.h, opts = [];
      for (var cy = 0; cy + ch <= H; cy++) for (var cx = 0; cx + cw <= W; cx++) {
        var okc = true;
        for (var yy = cy; yy < cy + ch && okc; yy++) for (var xx = cx; xx < cx + cw; xx++) {
          var cc = cellAt(f, xx, yy);
          if (!free(cc) || cheb(xx, yy, sx, sy) < 3 || cheb(xx, yy, stairC.x, stairC.y) < 2) { okc = false; break; }
        }
        if (okc) opts.push([cx, cy]);
      }
      if (!opts.length) return f;
      var p = pick(opts, rng);
      f.chunk = { x: p[0], y: p[1], w: cw, h: ch, value: spec.chunk.value, total: cw * ch, dug: 0, done: false };
      for (yy = p[1]; yy < p[1] + ch; yy++) for (xx = p[0]; xx < p[0] + cw; xx++) { var kc = cellAt(f, xx, yy); kc.haz = 'chunk'; kc.chunk = true; }
    }
    function nearChunk(c) { if (!f.chunk) return false; var C = f.chunk; return c.x >= C.x - 1 && c.x <= C.x + C.w && c.y >= C.y - 1 && c.y <= C.y + C.h; }
    // 지뢰
    if (pairM) {
      var placed = 0, guard = 0;
      while (placed < m && guard++ < 400) {
        var a = pick(cells, rng), dir = pick(ORTH, rng), b = cellAt(f, a.x + dir[0], a.y + dir[1]);
        if (!b || !free(a) || !free(b)) continue;
        // 둘 다 다른 지뢰와 상하좌우로 닿지 않아야 정확히 '둘씩'
        var touch = orthN(f, a.x, a.y).concat(orthN(f, b.x, b.y)).some(function (n) { return n.haz === 'mine'; });
        if (touch) continue;
        a.haz = 'mine'; b.haz = 'mine'; placed += 2;
      }
      if (placed < m) return f;
    } else {
      var fr = shuffle(cells.filter(free), rng);
      for (i = 0; i < m && i < fr.length; i++) fr[i].haz = 'mine';
    }
    // 보물
    var rowsSel = null;
    if (rule === 'rows') {   // 01 9.2: 세 줄은 위아래로 이웃하지 않는다
      var order = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rng); rowsSel = [];
      order.forEach(function (r) { if (rowsSel.length < 3 && rowsSel.every(function (q) { return Math.abs(q - r) > 1; })) rowsSel.push(r); }); f.treasureRows = rowsSel.slice().sort(function (p, q) { return p - q; }); }
    function allowT(c) {
      if (!free(c) || nearChunk(c)) return false;
      if (rule === 'border' && !isBorder(c.x, c.y)) return false;
      if (rule === 'rows' && rowsSel.indexOf(c.y) < 0) return false;
      if (rule === 'lonely' && neighbors(f, c.x, c.y).some(function (n) { return n.haz === 'treasure'; })) return false;
      if (pairT && orthN(f, c.x, c.y).some(function (n) { return n.haz === 'treasure'; })) return false;
      return true;
    }
    function nearMine(c) { return neighbors(f, c.x, c.y).some(function (n) { return n.haz === 'mine'; }); }
    var tPlaced = 0;
    for (i = 0; tPlaced < t && i < 400; i++) {
      var pool = cells.filter(allowT);
      if (!pool.length) break;
      if (rng() < CONFIG.treasureNearMine) { var near = pool.filter(nearMine); if (near.length) pool = near; }
      var tc = pick(pool, rng);
      if (pairT) {
        var mates = orthN(f, tc.x, tc.y).filter(function (n) {
          if (!allowT(n)) return false;
          // 짝 칸이 tc 말고 다른 보물과 상하좌우로 닿으면 안 됨 (tc는 아직 빈칸이라 allowT가 통과)
          return true;
        });
        if (!mates.length) continue;
        var mt = pick(mates, rng);
        tc.haz = 'treasure'; mt.haz = 'treasure'; tPlaced += 2;
      } else { tc.haz = 'treasure'; tPlaced++; }
    }
    if (tPlaced < t) return f;
    f.twin = !!spec.twin;
    var tierUp = (rule === 'minepair' ? 1 : 0);
    var tiers = row.tiers.slice();
    cells.forEach(function (c) { if (c.haz === 'treasure') c.tier = Math.min(3, 1 + weightedIdx(rng, tiers) + tierUp); });
    cells.forEach(function (c) { if (!c.haz && !c.stair && rng() < row.res) c.res = row.rv; });
    f.ok = checkFloor(f);
    return f;
  }
  function checkFloor(f) {
    var i, c;
    var cap = CONFIG.numberCap + (f.chunk ? 1 : 0);
    for (i = 0; i < N; i++) { c = f.cells[i]; if (!c.haz && numAt(f, c) > cap) return false; }
    var s = cellAt(f, f.stair.x, f.stair.y);
    if (neighbors(f, s.x, s.y).filter(function (n) { return !n.haz; }).length < 3) return false;
    if (startChainSize(f) < CONFIG.startChainMin) return false;
    if (!safePath(f, f.sx, f.sy, s.x, s.y)) return false;
    if (!checkRule(f)) return false;
    return true;
  }
  // 광맥 규칙 준수 검사(큰 덩이 칸은 규칙에서 뺀다). 쌍둥이 지뢰 변덕(f.twin)도 함께 본다
  function checkRule(f, ruleOverride) {
    var rule = ruleOverride || f.rule, i, c;
    var T = f.cells.filter(function (c) { return c.haz === 'treasure'; });
    var M = f.cells.filter(function (c) { return c.haz === 'mine'; });
    if (rule === 'pair' || (f.twin && CONFIG.twinBoth)) for (i = 0; i < T.length; i++) { if (orthN(f, T[i].x, T[i].y).filter(function (n) { return n.haz === 'treasure'; }).length !== 1) return false; }
    if (rule === 'lonely') for (i = 0; i < T.length; i++) { if (neighbors(f, T[i].x, T[i].y).some(function (n) { return n.haz === 'treasure'; })) return false; }
    if (rule === 'border') for (i = 0; i < T.length; i++) { if (!isBorder(T[i].x, T[i].y)) return false; }
    if (rule === 'rows') { var rs = {}; T.forEach(function (c) { rs[c.y] = 1; }); var ks = Object.keys(rs).map(Number); if (ks.length > 3) return false; if (ks.some(function (a) { return rs[a + 1]; })) return false; }
    if (rule === 'minepair' || f.twin) for (i = 0; i < M.length; i++) { if (orthN(f, M[i].x, M[i].y).filter(function (n) { return n.haz === 'mine'; }).length !== 1) return false; }
    if (f.chunk) {   // 덩이 둘레에는 보통 보물이 없다
      for (i = 0; i < T.length; i++) { c = T[i]; var C = f.chunk; if (c.x >= C.x - 1 && c.x <= C.x + C.w && c.y >= C.y - 1 && c.y <= C.y + C.h) return false; }
    }
    return true;
  }
  function startChainSize(f) {
    var start = cellAt(f, f.sx, f.sy), seen = {}, q = [start], n = 0;
    seen[idx(start)] = 1;
    while (q.length) {
      var c = q.shift(); n++;
      if (numAt(f, c) !== 0) continue;
      neighbors(f, c.x, c.y).forEach(function (nb) { if (!seen[idx(nb)] && !nb.haz && !nb.stair) { seen[idx(nb)] = 1; q.push(nb); } });
    }
    return n;
  }
  function safePath(f, ax, ay, bx, by) {
    var seen = {}, q = [cellAt(f, ax, ay)]; seen[idx(q[0])] = 1;
    while (q.length) {
      var c = q.shift(); if (c.x === bx && c.y === by) return true;
      neighbors(f, c.x, c.y).forEach(function (nb) { if (!seen[idx(nb)] && !nb.haz) { seen[idx(nb)] = 1; q.push(nb); } });
    }
    return false;
  }
  // 층에 남은 보물·지뢰 수(countsShown일 때 화면에 보이는 값). 큰 덩이는 따로 세요
  function remaining(f) { var t = 0, m = 0; f.cells.forEach(function (c) { if (c.removed) return; if (c.haz === 'treasure') t++; else if (c.haz === 'mine') m++; }); return { t: t, m: m }; }
  // 남은 보물 수(눈금 광맥 표시용, 화면에 보이는 값)
  function tallyRow(f, y) { var n = 0; for (var x = 0; x < W; x++) { var c = f.cells[y * W + x]; if (c.haz === 'treasure' && !c.removed) n++; } return n; }

  // ---------- 추리(플레이어가 볼 수 있는 정보만 쓴다) ----------
  // 반환: st[i] 0 모름 / 1 안전(위험 없음) / 2 위험(지뢰·보물·덩이), canT/canM: 보물·지뢰일 수 있는가
  // tre = 위험이면서 지뢰일 수 없음(보물. 덩이 층에서는 '보물 또는 덩이'), mine = 위험이면서 보물일 수 없음(덩이 층에서는 '지뢰 또는 덩이')
  function deduce(f, opt) {
    opt = opt || {};
    var st = new Int8Array(N), canT = new Int8Array(N), canM = new Int8Array(N), i, c;
    var chunkShown = !!f.chunk && !f.chunk.done && feat('chunkShown');   // 덩이 자리가 보이면 덩이 칸은 '덩이'로 알고, 나머지는 보통 층처럼 푼다
    var chunkFloor = !!f.chunk && !f.chunk.done && !chunkShown;
    var isC = new Int8Array(N);
    var twin = f.rule === 'minepair' || f.twin;
    var cons = [];
    for (i = 0; i < N; i++) {
      c = f.cells[i];
      if (c.cover === 'open') continue;
      canT[i] = 1; canM[i] = 1;
      if (c.probe === 'mine' || c.faded === 1) { st[i] = 2; canT[i] = 0; }
      else if (c.faded === 2) { st[i] = 2; canM[i] = 0; }
      else if (c.probe === 'safe') canM[i] = 0;
      if (c.fizzle) canM[i] = 0;
    }
    var si = shownStair(f);   // 보이는 계단 칸은 빈 칸이에요(지뢰도 보물도 아님)
    if (si >= 0) { canT[si] = 0; canM[si] = 0; st[si] = 1; }
    if (chunkShown) for (i = 0; i < N; i++) { c = f.cells[i]; if (c.chunk && c.cover !== 'open') { isC[i] = 1; st[i] = 2; canT[i] = 0; canM[i] = 0; } }
    for (i = 0; i < N; i++) {
      c = f.cells[i];
      if (c.cover !== 'open') continue;
      var U = [], nb = neighbors(f, c.x, c.y);
      for (var k = 0; k < nb.length; k++) if (nb[k].cover !== 'open') U.push(idx(nb[k]));
      var nn = numAt(f, c);
      if (U.length && !(opt.blur && nn >= 4)) cons.push({ n: nn, U: U });   // 뭉개진 숫자: 4 이상은 정확한 값을 모른다(봇용 어림)
    }
    function isDugT(c) { return c.cover === 'open' && c.removed && c.haz === 'treasure'; }
    function isDugM(c) { return c.cover === 'open' && c.removed && c.haz === 'mine'; }
    function defT(i) { return st[i] === 2 && !canM[i] && !isC[i]; }
    function defM(i) { return st[i] === 2 && !canT[i] && !isC[i]; }
    var changed = true, guard = 0;
    function setSt(i, v) { if (st[i] !== v) { if (st[i] === 0) { st[i] = v; changed = true; } } }
    function noT(i) { if (canT[i]) { canT[i] = 0; changed = true; } }
    function noM(i) { if (canM[i]) { canM[i] = 0; changed = true; } }
    while (changed && guard++ < 60) {
      changed = false;
      // 숫자 기본 + 포함 관계
      var red = [];
      for (i = 0; i < cons.length; i++) {
        var K = cons[i], u = [], h = 0;
        for (var j = 0; j < K.U.length; j++) { var q = K.U[j]; if (st[q] === 2) h++; else if (st[q] === 0) u.push(q); }
        if (!u.length) continue;
        var r = K.n - h;
        if (r === u.length) u.forEach(function (x) { setSt(x, 2); });
        else if (r === 0) u.forEach(function (x) { setSt(x, 1); });
        else red.push({ r: r, u: u });
      }
      if (!changed) {
        for (i = 0; i < red.length && !changed; i++) for (j = 0; j < red.length; j++) {
          if (i === j) continue;
          var A = red[i], B = red[j];
          if (A.u.length >= B.u.length) continue;
          var sub = true; for (k = 0; k < A.u.length; k++) if (B.u.indexOf(A.u[k]) < 0) { sub = false; break; }
          if (!sub) continue;
          var diff = B.u.filter(function (x) { return A.u.indexOf(x) < 0; }), dr = B.r - A.r;
          if (dr === diff.length) diff.forEach(function (x) { setSt(x, 2); });
          else if (dr === 0) diff.forEach(function (x) { setSt(x, 1); });
        }
      }
      // 광맥 규칙
      var rule = f.rule;
      var TP = [];   // 보물로 확인된 자리(캔 것 + 확정)
      for (i = 0; i < N; i++) { c = f.cells[i]; if (isDugT(c) || (c.cover !== 'open' && defT(i) && !chunkFloor)) TP.push(c); }
      if (rule === 'border') for (i = 0; i < N; i++) { c = f.cells[i]; if (c.cover !== 'open' && !isBorder(c.x, c.y)) noT(i); }
      if (rule === 'lonely') TP.forEach(function (p) { neighbors(f, p.x, p.y).forEach(function (n) { if (n.cover !== 'open') noT(idx(n)); }); });
      if (rule === 'rows') {
        var rs = {}; TP.forEach(function (p) { rs[p.y] = 1; });
        // 01 9.3 가로줄 (1): 보물이 나온 줄의 바로 위·아래 줄에는 보물이 없다(세 줄은 서로 붙지 않는다)
        for (i = 0; i < N; i++) { c = f.cells[i]; if (c.cover !== 'open' && !rs[c.y] && (rs[c.y - 1] || rs[c.y + 1])) noT(i); }
        if (Object.keys(rs).length >= 3) for (i = 0; i < N; i++) { c = f.cells[i]; if (c.cover !== 'open' && !rs[c.y]) noT(i); }
      }
      if (rule === 'tally') {
        for (var y = 0; y < H; y++) {
          var kk = tallyRow(f, y), posT = [], defTn = 0;
          for (var x = 0; x < W; x++) { var ii = y * W + x; if (f.cells[ii].cover === 'open') continue; if (canT[ii] && st[ii] !== 1) posT.push(ii); if (defT(ii)) defTn++; }
          if (kk === 0) posT.forEach(noT);
          else if (posT.length === kk) posT.forEach(function (q) { setSt(q, 2); noM(q); });
          else if (defTn === kk) posT.forEach(function (q) { if (!defT(q)) noT(q); });
        }
      }
      if (rule === 'pair' || (f.twin && CONFIG.twinBoth)) {
        TP.forEach(function (p) {
          var on = orthN(f, p.x, p.y);
          var known = on.filter(function (n) { return isDugT(n) || (n.cover !== 'open' && defT(idx(n))); });
          if (known.length) on.forEach(function (n) { if (n.cover !== 'open' && known.indexOf(n) < 0) noT(idx(n)); });
          else {
            var cand = on.filter(function (n) { return n.cover !== 'open' && canT[idx(n)] && st[idx(n)] !== 1; });
            if (cand.length === 1) { setSt(idx(cand[0]), 2); noM(idx(cand[0])); }
          }
        });
        for (i = 0; i < N; i++) {
          c = f.cells[i]; if (c.cover === 'open' || !canT[i]) continue;
          var any = orthN(f, c.x, c.y).some(function (n) {
            if (isDugT(n)) return !orthN(f, n.x, n.y).some(function (z) { return z !== c && (isDugT(z) || (z.cover !== 'open' && defT(idx(z)))); });
            return n.cover !== 'open' && canT[idx(n)] && st[idx(n)] !== 1;
          });
          if (!any) noT(i);
        }
      }
      if (twin) {
        var MP = [];
        for (i = 0; i < N; i++) { c = f.cells[i]; if (isDugM(c) || (c.cover !== 'open' && defM(i) && !chunkFloor)) MP.push(c); }
        MP.forEach(function (p) {
          var on = orthN(f, p.x, p.y);
          var known = on.filter(function (n) { return isDugM(n) || (n.cover !== 'open' && defM(idx(n)) && !chunkFloor); });
          if (known.length) on.forEach(function (n) { if (n.cover !== 'open' && known.indexOf(n) < 0) noM(idx(n)); });
          else {
            var cand = on.filter(function (n) { return n.cover !== 'open' && canM[idx(n)] && st[idx(n)] !== 1; });
            if (cand.length === 1) { setSt(idx(cand[0]), 2); noT(idx(cand[0])); }
          }
        });
        for (i = 0; i < N; i++) {
          c = f.cells[i]; if (c.cover === 'open' || !canM[i]) continue;
          var anyM = orthN(f, c.x, c.y).some(function (n) {
            if (isDugM(n)) return !orthN(f, n.x, n.y).some(function (z) { return z !== c && (isDugM(z) || (z.cover !== 'open' && defM(idx(z)))); });
            return n.cover !== 'open' && canM[idx(n)] && st[idx(n)] !== 1;
          });
          if (!anyM) noM(i);
        }
      }
      // 보물도 지뢰도 될 수 없으면 빈 칸(덩이 층은 덩이일 수 있어 쓰지 않는다)
      if (!chunkFloor) for (i = 0; i < N; i++) if (f.cells[i].cover !== 'open' && st[i] === 0 && !canT[i] && !canM[i]) setSt(i, 1);
      for (i = 0; i < N; i++) if (st[i] === 1) { canT[i] = 0; canM[i] = 0; }
    }
    var out = { st: st, canT: canT, canM: canM, safe: [], haz: [], tre: [], mine: [], stairCand: [], chunk: [], isC: isC };
    for (i = 0; i < N; i++) {
      c = f.cells[i]; if (c.cover === 'open') continue;
      if (isC[i]) { out.chunk.push(i); continue; }
      if (st[i] === 1) { if (i !== si || stairReach(f)) out.safe.push(i); }
      else if (st[i] === 2) { out.haz.push(i); if (!canM[i]) out.tre.push(i); else if (!canT[i]) out.mine.push(i); }
    }
    out.stairCand = stairCandidates(f, st, opt.sleepy);
    return out;
  }
  // 처음부터 보이는 계단(stairShown): 아직 안 연 계단 칸 번호, 없으면 -1. 첫 판 지하 3층의 막힌 계단은 보이지 않아요
  function shownStair(f) {
    if (!CONFIG.stairShown || !f.stair || f.stair.blocked) return -1;
    var c = cellAt(f, f.stair.x, f.stair.y);
    return c && c.cover !== 'open' ? idx(c) : -1;
  }
  function stairReach(f) { return neighbors(f, f.stair.x, f.stair.y).some(function (n) { return n.cover === 'open'; }); }
  // 밑줄 숫자로 계단 후보 좁히기(잠든 계단이면 밑줄이 없다)
  function stairCandidates(f, st, sleepy) {
    if (!f.stair || f.stair.found) return [];
    if (CONFIG.stairShown) { var si = shownStair(f); return si >= 0 && stairReach(f) ? [si] : []; }
    var s = f.stair, hinted = [];
    if (!sleepy) for (var i = 0; i < N; i++) { var c = f.cells[i]; if (c.cover === 'open' && cheb(c.x, c.y, s.x, s.y) === 1) hinted.push(c); }
    if (!hinted.length) return [];
    var cands = [];
    neighbors(f, hinted[0].x, hinted[0].y).forEach(function (q) {
      if (q.cover === 'open' || (st && st[idx(q)] === 2)) return;
      if (!hinted.every(function (h) { return cheb(h.x, h.y, q.x, q.y) === 1; })) return;
      if (neighbors(f, q.x, q.y).some(function (n) { return n.cover === 'open' && cheb(n.x, n.y, s.x, s.y) !== 1; })) return;
      cands.push(idx(q));
    });
    return cands;
  }
  // 생성 직후 검사: 숫자·규칙·밑줄만으로(찍기, 발파, 두드려 보기 없이) 계단까지 갈 수 있는가
  function isSolvable(f0) {
    var f = cloneFloor(f0);
    simOpen(f, cellAt(f, f.sx, f.sy));
    for (var it = 0; it < 200; it++) {
      if (cellAt(f, f.stair.x, f.stair.y).cover === 'open') return true;
      var D = deduce(f), prog = false;
      D.safe.forEach(function (i) { if (f.cells[i].cover !== 'open') { simOpen(f, f.cells[i]); prog = true; } });
      if (!prog) D.tre.forEach(function (i) { var c = f.cells[i]; if (c.cover !== 'open') { c.cover = 'open'; c.removed = true; simChainAround(f, c); prog = true; } });
      if (!prog && D.stairCand.length === 1) { simOpen(f, f.cells[D.stairCand[0]]); prog = true; }
      if (!prog) return false;
    }
    return false;
  }
  // 쓸모 검사용: 안전한 칸을 다 열고, 규칙으로 정체가 밝혀진 칸을 캐거나 없애기를 되풀이했을 때 '보물로 확정'된 칸 수.
  // 규칙이 첫 보물을 캐야 열리는 층(짝·외톨이·가로줄)은 경계의 보물 하나를 먼저 캔 것으로 친다(그 칸은 세지 않는다)
  function usefulCount(f0) {
    var g = cloneFloor(f0), n = 0, nm = 0, openers = 0, maxOpen = g.rule === 'pair' ? 3 : g.rule === 'lonely' ? 2 : 1;
    simOpen(g, cellAt(g, g.sx, g.sy));
    for (var it = 0; it < 200; it++) {
      var D = deduce(g), prog = false;
      D.safe.forEach(function (i) { var c = g.cells[i]; if (c.cover !== 'open') { simOpen(g, c); prog = true; } });
      if (prog) continue;
      D.tre.forEach(function (i) { var c = g.cells[i]; if (c.cover !== 'open' && c.haz === 'treasure') { n++; c.cover = 'open'; c.removed = true; simChainAround(g, c); prog = true; } });
      D.mine.forEach(function (i) { var c = g.cells[i]; if (c.cover !== 'open' && c.haz === 'mine') { nm++; c.cover = 'open'; c.removed = true; simChainAround(g, c); prog = true; } });
      if (prog) continue;
      if (openers < maxOpen && ['pair', 'lonely', 'rows'].indexOf(g.rule) >= 0) {
        var t = g.cells.filter(function (c) { return c.cover !== 'open' && c.haz === 'treasure' && neighbors(g, c.x, c.y).some(function (z) { return z.cover === 'open'; }); })[0];
        if (t) { openers++; t.cover = 'open'; t.removed = true; simChainAround(g, t); continue; }
      }
      break;
    }
    return CONFIG.usefulMineRules.indexOf(g.rule) >= 0 ? nm : n;   // R35: 외톨이·가로줄·테두리는 지뢰로 확정되는 칸 수
  }
  function cloneFloor(f) {
    var g = Object.assign({}, f);
    g.cells = f.cells.map(function (c) { return Object.assign({}, c); });
    g.stair = f.stair ? Object.assign({}, f.stair) : null;
    g.chunk = f.chunk ? Object.assign({}, f.chunk) : null;
    return g;
  }
  function simOpen(f, c) {
    c.cover = 'open';
    if (c.haz) { c.removed = true; simChainAround(f, c); return; }
    if (numAt(f, c) === 0) simChain(f, c);
  }
  function simChainAround(f, c) { neighbors(f, c.x, c.y).forEach(function (n) { if (n.cover === 'open' && numAt(f, n) === 0) simChain(f, n); }); }
  function simChain(f, src) {
    var q = [src];
    while (q.length) {
      var c = q.shift(); if (numAt(f, c) !== 0) continue;
      neighbors(f, c.x, c.y).forEach(function (n) { if (n.cover !== 'open' && !liveHaz(n) && !n.stair) { n.cover = 'open'; q.push(n); } });
    }
  }

  // ---------- 판 / 하루 ----------
  function newRun(seed, opts) {
    opts = opts || {};
    seed = (seed == null ? (Date.now() & 0x7fffffff) : seed) >>> 0;
    var run = {
      seed: seed, day: 1, cash: 0, paid: 0, stamps: 0, tutorial: !!opts.tutorial, record: !!opts.record, char: opts.tutorial ? 'miner' : (CHAR_IDS_OK(opts.char) || 'miner'),
      grade: Math.max(1, Math.min(3, opts.grade || 1)), daily: opts.daily || null, preset: CONFIG.preset,
      owned: [], paidFor: {}, cons: [], toolState: {}, phase: opts.tutorial ? 'deed' : 'deed', d: null, room: null,
      shop: null, settle: null, payment: null, final: null, gang: null, orders: [], order: null,
      log: [], logSeq: 0, fx: [], history: [], eventCounts: {},
      stats: { deepest: 0, treasures: 0, collapses: 0, mines: 0, chainMax: 0, earned: 0, blasts: 0, perfect: 0, chords: 0, boxes: 0, sold: 0, fused: 0 },
      boxOffer: null, boxed: {}, keeps: [], loanUsed: false, loan: null,
      metaRng: rngFrom(hashSeed(seed, 777)),
      mutationPlan: {}
    };
    // 등급이 오르면 납부액에 배수(01 14.2). 판마다 납부 표를 따로 들고 있어요
    var gm = gradeMulOf(run) * (run.tutorial ? CONFIG.firstRunDiscount || 1 : 1);
    run.payments = CONFIG.payments.map(function (p) { return { day: p.day, name: p.name, amount: gm === 1 ? p.amount : Math.round(p.amount * gm / 10) * 10 }; });
    // 변덕은 판 시작에 정하고 앞 납부 때 알린다
    var pool = shuffle(MUTATION_IDS.filter(function (m) { return !(CONFIG.stairShown && m === 'sleepy'); }), run.metaRng);
    if (run.tutorial) pool = [TUTORIAL_MUT8].concat(pool.filter(function (m) { return m !== TUTORIAL_MUT8; }));
    if (feat('mutations')) { run.mutationPlan[8] = [pool[0]]; run.mutationPlan[15] = [pool[1], pool[2]]; }
    planRun(run);
    // 중개소 선물(R43): 일반 도구 셋. 첫 판은 고정
    var kit = rngFrom(hashSeed(seed, 0x4b4954));
    run.giftOpts = !feat('startGift') ? [] : run.tutorial ? CONFIG.gift.tutorial.slice() : shuffle(toolPool().filter(function (t) { return t.kind === 'passive' && t.rarity === CONFIG.gift.rarity; }).map(function (t) { return t.id; }), kit).slice(0, CONFIG.gift.n);
    run.giftDone = false; run.taught = {};
    prepareDay(run);
    return run;
  }
  function paymentFor(day, run) { var P = pays(run); for (var i = 0; i < P.length; i++) if (P[i].day === day) return P[i]; return null; }
  function nextPayment(run) { var P = pays(run); for (var i = 0; i < P.length; i++) if (P[i].day >= run.day && i >= run.stamps) return P[i]; return null; }
  function paymentIndex(p, run) { return pays(run).indexOf(p) + 1; }
  // 게시판 시세 한 줄(02 6.1). 도장마다 값이 오르거나 층이 깊어져요
  function rateText(run) {
    var S = CONFIG.stages, st = Math.min(run.stamps, S.length - 1), cur = S[st], last = st >= pays(run).length - 1, nx = !last && st + 1 < S.length ? S[st + 1] : null, vm = cur.valueMul;
    var base = '도장 ' + st + '개: 캔 값 ×' + vm + ' · 금 알갱이 ' + Math.floor(CONFIG.treasureValue[1] * vm) + ' · 청록 보석 ' + Math.floor(CONFIG.treasureValue[2] * vm) + ' · 유물 ' + Math.floor(CONFIG.treasureValue[3] * vm);
    if (!nx) return base + '. 그믐까지 이 값이에요';
    if (nx.valueMul !== vm) return base + '. 도장 ' + (st + 1) + '개면 ×' + nx.valueMul + '예요';
    if (nx.rowShift > cur.rowShift) return base + '. 도장 ' + (st + 1) + '개면 갱이 한 층 깊어져요';
    return base;
  }
  function stageChangeText(run) {   // 도장이 막 찍힌 뒤 무엇이 바뀌는지
    var S = CONFIG.stages, a = S[Math.min(run.stamps - 1, S.length - 1)], b = S[Math.min(run.stamps, S.length - 1)], out = [];
    if (b.valueMul !== a.valueMul) out.push(TEXT.stageChange.mul.replace('{mul}', b.valueMul));
    if (b.rowShift > a.rowShift) out.push(TEXT.stageChange.deep);
    return out.length ? out.join(' · ') : TEXT.stageChange.same;
  }
  // 목표 표시(R16): "계약금 600까지 120 남음 · Day 3"
  function goalInfo(run) {
    var p = nextPayment(run); if (!p) return null;
    var have = run.cash + (run.d && (run.phase === 'mine' || run.phase === 'room') ? run.d.pocket : 0);
    return { name: p.name, amount: p.amount, day: p.day, left: Math.max(0, p.amount - have), have: have, daysLeft: p.day - run.day };
  }

  // 광맥 하나 뽑기: 맨땅은 다른 규칙의 절반 확률(01 8.2)
  function drawRules(pool, rng, n) {
    var left = pool.slice(), out = [];
    while (out.length < n && left.length) {
      var k = weightedIdx(rng, left.map(function (r) { return r === 'plain' ? 0.5 : 1; }));
      out.push(left[k]); left.splice(k, 1);
    }
    return out;
  }
  function rulePoolFor(run, depth, twin) {
    var pool = depth <= 2 ? ['plain', 'pair', 'lonely', 'border', 'tally'] : RULE_IDS.slice();
    var PL = poolList(run);
    if (PL) {   // 등급별 광맥 풀(01 14.2). 얕은 층에 나올 광맥이 풀에 없으면 깊이 제한 없이 풀 그대로
      var inPool = pool.filter(function (r) { return PL.indexOf(r) >= 0; });
      pool = inPool.length ? inPool : PL.slice();
    }
    if (twin) {   // 쌍둥이 지뢰 날
      var nt = pool.filter(function (r) { return r !== 'minepair' && !(CONFIG.twinBoth && r === 'lonely'); });
      pool = nt.length ? nt : ['plain'];
    }
    return pool;
  }
  // 판 계획(01 10.6 PLAN, 11.2·11.3): 15일 치 갱 상태, 주문 두 장, 첫 층 광맥을 판을 시작할 때 정한다
  function planRun(run) {
    var rng = rngFrom(hashSeed(run.seed, 0x504c414e)), days = CONFIG.days, day;
    var normal = GANG.filter(function (g) { return !g.good; }), gangs = [], count = {};
    for (day = 1; day <= days; day++) {
      var gid = null;
      if (!feat('gang')) gid = null;                                               // v22: 갱 상태 없음
      else if (run.tutorial && day === 1) gid = null;                              // 첫 판 Day 1은 게시판이 없다
      else if (run.tutorial && TUTORIAL.gang[day]) gid = TUTORIAL.gang[day];        // 첫 판 Day 2 벽이 얇음, Day 3 달빛이 고임
      else {
        var prev = gangs[gangs.length - 1];
        var pool = normal.filter(function (g) { return g.id !== prev && (count[g.id] || 0) < 2 && !(run.tutorial && day <= 3 && g.id === 'toss'); });   // 이틀 연속 없음, 한 판 두 번까지
        gid = pick(pool, rng).id;
      }
      if (gid) count[gid] = (count[gid] || 0) + 1;
      gangs.push(gid);
    }
    // 쌍둥이 지뢰: 한 판에 한 번, 납부일이 아닌 날(첫 판은 Day 4 이후)
    var cand = []; for (day = 1; day <= days; day++) if (feat('gang') && !paymentFor(day, run) && !(run.tutorial && day < 4) && gangs[day - 1]) cand.push(day);
    if (cand.length) gangs[pick(cand, rng) - 1] = 'twin';
    var orders = [], first = [];
    for (day = 1; day <= days; day++) {
      if (run.tutorial && day === 1) { orders.push([]); first.push('plain'); continue; }
      var a = pick(ORDERS, rng), b = pick(ORDERS.filter(function (o) { return o.group !== a.group; }), rng);   // 서로 다른 묶음
      orders.push(feat('orders') ? [a.id, b.id] : []);
      var twinD = gangs[day - 1] === 'twin';
      var fr = (run.tutorial && TUTORIAL.firstRule[day]) || drawRules(rulePoolFor(run, gangs[day - 1] === 'toss' ? 2 : 1, twinD), rng, 1)[0];
      first.push((day === 1 && !run.tutorial) || (!CONFIG.firstFloorRule && !(run.tutorial && TUTORIAL.firstRule[day])) ? 'plain' : fr);   // Day 1의 지하 1층은 맨땅(01 8.2)
    }
    run.plan = { gang: gangs, orders: orders, firstRule: first };
  }
  // 아침 게시판 준비(첫 판 Day 1은 권리증만)
  function prepareDay(run) {
    if (!run.plan) planRun(run);
    var P = run.plan, i = run.day - 1;
    run.gang = P.gang[i] ? GANG_BY_ID[P.gang[i]] : null;
    run.orders = (P.orders[i] || []).map(function (id) { return ORDER_BY_ID[id]; });
    run.firstRule = P.firstRule[i] || 'plain';
    run.order = null;
    run.phase = (run.day === 1) ? 'deed' : 'board';
  }
  function toGift(run) { if (run.phase === 'deed' && !run.giftDone && run.giftOpts && run.giftOpts.length) { run.phase = 'gift'; return true; } return false; }
  // 선물 고르기: 판 시작 중개소 선물(v2.1) 또는 도장 선물(v22, i = -1이면 도구 대신 금고 돈)
  function chooseGift(run, i) {
    if ((run.phase !== 'gift' && run.phase !== 'deed') || run.giftDone) return { ok: false };
    var cashTaken = 0, id = null;
    if (i === -1 && run.giftCash) { cashTaken = run.giftCash; run.cash += cashTaken; }
    else {
      id = run.giftOpts[i]; if (!id) return { ok: false };
      if (run.owned.length >= slotsOf(run)) return { ok: false, full: true };
      addTool(run, id, 0);
    }
    run.giftDone = true;
    if (run.giftNext === 'shop') { run.giftNext = null; run.giftCash = 0; openShop(run); }
    else run.phase = run.orders.length ? 'board' : 'ready';
    return { ok: true, id: id, cash: cashTaken };
  }
  // 도장 선물 후보 셋: 도장 수가 늘수록 고급·희귀가 잘 나와요. 첫 판 첫 도장은 고정
  function rewardOpts(run) {
    var R = CONFIG.stampReward, k = Math.max(0, Math.min(R.rarity.length - 1, run.stamps - 1)), rng = rngFrom(hashSeed(run.seed, run.day, 0x5245));
    if (run.tutorial && run.stamps === 1) return CONFIG.gift.tutorial.filter(function (id) { return !owns(run, id); });
    var avail = toolPool().filter(function (t) { return t.kind === 'passive' && !owns(run, t.id); }), out = [], W = { '일반': R.rarity[k][0], '고급': R.rarity[k][1], '희귀': R.rarity[k][2] };
    while (out.length < R.n + keepSum(run, 'giftPlus') && avail.length) { var j = weightedIdx(rng, avail.map(function (t) { return W[t.rarity] || 1; })); out.push(avail[j].id); avail.splice(j, 1); }
    return out;
  }
  function chooseOrder(run, i) {
    if (run.phase !== 'board' && run.phase !== 'deed' && run.phase !== 'ready') return { ok: false };
    var o = run.orders[i];
    run.order = o ? { id: o.id, prog: 0, done: false, failed: false } : null;
    return { ok: true };
  }
  function startDay(run) {
    if (run.phase !== 'board' && run.phase !== 'deed' && run.phase !== 'ready' && run.phase !== 'gift') return { ok: false };
    if (run.orders.length && !run.order) chooseOrder(run, 0);
    var cm = CONFIG.candleMax + (gang(run, 'shallow') ? 10 : 0) - (gang(run, 'rough') ? 10 : 0) + (charOf(run).candleDelta || 0) + keepSum(run, 'candle');
    var hm = Math.max(1, CONFIG.hpMax + keepSum(run, 'hp'));
    var pay = paymentFor(run.day, run);
    var chunkSpec = pay && CONFIG.chunks[run.day] ? Object.assign({}, CONFIG.chunks[run.day]) : null;
    if (chunkSpec) chunkSpec.value = Math.round(chunkSpec.value * gradeMulOf(run));   // 등급 배수는 큰 덩이 값에도(01 14.2)
    run.d = {
      candle: cm, candleMax: cm, hp: hm, hpMax: hm,
      probes: gang(run, 'thin') ? 4 : CONFIG.probesPerDay, probesMax: 0,
      floor: null, floorIdx: 0, px: CONFIG.START.x, py: CONFIG.START.y, face: { dx: 0, dy: 1 },
      pocket: 0, pocketLines: { treasure: 0, treasureN: 0, gravel: 0, chunk: 0, order: 0, refine: 0, sold: 0 },
      streak: (gang(run, 'moon') ? 1 : 0) + keepSum(run, 'streakStart'), embersOn: false, embers: 0, endReason: null, lowWarned: false,
      forkCount: 0, roomForks: {}, mutations: (run.mutationPlan[run.day] || []).slice(),
      chunkSpec: chunkSpec, chunkDone: false, chunkSeen: false,
      embersGiven: false, xOk: 0, xBad: 0,
      stats: { dugT: 0, breaks: 0, hazDigs: 0, safeDigs: 0, treasures: 0, mines: 0, firstTreasureHit: 0, hits: 0, blasts: 0, probes: 0,
               maxStreak: 0, blastMines: 0, chainMax: 0, depth: 0, emberT: 0, oT: 0, gems: 0, bigNumT: 0, floorT: 0, noProbeT: 0 },
      floorsVisited: [], lastLeftChunk: false,
      // 기록 장치(run.record일 때만 센다): 치기·발파 직전 칸을 화면에 보이는 정보로 가른 결과
      rec: { safe: 0, knownT: 0, knownM: 0, bet: 0, unknown: 0, blastSure: 0, blastBet: 0, marks: 0, probes: 0, chords: 0 }
    };
    if (!feat('probeBase')) run.d.probes = 0;   // v22: 두드려 보기는 청진 망치를 가졌을 때만
    if (owns(run, 'tapper')) run.d.probes += 2;
    if (mut(run, 'noprobe')) run.d.probes = 0;   // 마른 손
    run.d.probesMax = run.d.probes;
    run.d.survey = run.d.surveyMax = charOf(run).surveyPerDay || 0;   // 측량사: O 칸 청진 횟수
    // 갈림길 방: 하루 1~2번
    var rng = rngFrom(hashSeed(run.seed, run.day, 77));
    if (!(run.tutorial && run.day === 1) && feat('rooms')) {
      var nRooms = rng() < CONFIG.roomsPerDay.one ? 1 : 2;
      var slots = shuffle(run.tutorial && run.day <= 3 ? [3, 4] : [1, 2, 3, 4], rng).slice(0, nRooms);   // 첫 판 Day 2·3의 정해진 층 갈림길에는 방을 붙이지 않는다
      var kinds = shuffle(['spring', 'merchant'], rng);
      slots.forEach(function (s, k) { run.d.roomForks[s] = kinds[k % 2]; });
    }
    run.toolState = {};
    emit(run, 'on_day_start', { day: run.day });
    run.phase = 'mine';
    var startDepth = stage(run).startDepth + (gang(run, 'toss') ? 1 : 0);
    enterFloor(run, startDepth, run.firstRule || 'plain', CONFIG.START.x, CONFIG.START.y);   // 오늘 첫 층 광맥(게시판에 알림)
    return { ok: true };
  }

  function floorSpec(run, depth, rule, sx, sy) {
    var d = run.d;
    var chunk = (d.chunkSpec && d.chunkSpec.depth === depth && !d.chunkDone) ? d.chunkSpec : null;
    return { depth: depth, rule: rule, sx: sx, sy: sy, seed: hashSeed(run.seed, run.day, d.floorIdx + 1, RULE_IDS.indexOf(rule) + 1),
             chunk: chunk, twin: twinDay(run), gangId: run.gang && run.gang.id, rowShift: stage(run).rowShift,
             extraM: d.pendingBonus === 'more' ? CONFIG.forkBonus.moreMines : 0, extraT: d.pendingBonus === 'more' ? CONFIG.forkBonus.moreTreasures : 0 };
  }
  // 갈림길 카드의 "보물 n개쯤 · 지뢰 n개쯤"(층 생성 값)
  function floorEstimate(run, depth, rule, bonus) {
    var row = densityRow(depth, stage(run).rowShift), m = row.m, t = row.t;
    if (gang(run, 'smell')) { m += 2; t += 2; }
    if (gang(run, 'quiet')) { m -= 2; t -= 1; }
    if (bonus === 'more') { m += CONFIG.forkBonus.moreMines; t += CONFIG.forkBonus.moreTreasures; }
    var tune = CONFIG.ruleTune && CONFIG.ruleTune[rule]; if (tune) { t += tune.t || 0; m += tune.m || 0; }
    if (rule === 'pair' && t % 2) t++;
    if ((rule === 'minepair' || twinDay(run)) && m % 2) m++;
    if (rule === 'rows') t = Math.max(6, t);
    var tw = row.tiers.slice(), tot = tw.reduce(function (a, b) { return a + b; }, 0) || 1;
    return { t: t, m: m, tiers: tw.map(function (x) { return Math.round(100 * x / tot); }), tierUp: rule === 'minepair' };   // 보물 등급 확률(금 알갱이, 청록 보석, 유물)
  }
  function enterFloor(run, depth, rule, sx, sy, bonus) {
    var d = run.d, f;
    d.pendingBonus = bonus || null;
    var later = run.tutorial ? TUTORIAL.later[run.day + '-' + depth] : null;
    if (run.tutorial && run.day === 1 && depth <= 3) f = tutorialFloor(run, depth, rule, sx, sy);
    else if (later) f = tutorialLaterFloor(run, depth, rule, sx, sy, later);
    else f = genFloor(floorSpec(run, depth, rule, sx, sy));
    d.pendingBonus = null;
    f.bonus = bonus || null;
    if (bonus === 'value') f.valueMul = CONFIG.forkBonus.valueMul;
    if (twinDay(run)) f.twin = true;
    if (f.chunk && mut(run, 'nap')) { f.awake = true; log(run, TEXT.chunk.napArrive, 'bad'); }   // 선잠: 덩이 층은 도착하자마자 깨어 있다
    d.floorIdx++;
    d.floor = f; d.px = sx; d.py = sy;
    d.floorsVisited.push({ depth: depth, rule: rule, value: 0 });
    d.stats.floorT = 0;
    placeBox(run, f, depth);
    placeFaded(run, f);
    if (depth > run.stats.deepest) run.stats.deepest = depth;
    if (depth > d.stats.depth) d.stats.depth = depth;
    emit(run, 'on_floor_enter', { depth: depth, rule: rule });
    orderEvent(run, 'depth', { depth: depth });
    if (!f.graffiti.length && !f.tutorial && !run.tutorial && run.metaRng() < 0.35) placeGraffiti(f, pick(TEXT.graffiti, run.metaRng));   // 일반 낙서는 둘째 판부터
    // 시작 칸은 열린 채 시작하고 와르르(R17)
    beginAct(run, sx, sy);
    var c = cellAt(f, sx, sy);
    openRaw(run, c, 0);
    run.act.gravel += cellRes(c);
    if (numAt(f, c) === 0) chainFrom(run, c);
    var lampR = keepSum(run, 'lamp');   // 큰 등잔: 도착 자리 둘레 안전한 칸까지 열려요
    if (lampR) for (var ly = sy - lampR; ly <= sy + lampR; ly++) for (var lx = sx - lampR; lx <= sx + lampR; lx++) {
      var lc = cellAt(f, lx, ly); if (!lc || !covered(lc) || liveHaz(lc) || lc.stair) continue;
      openRaw(run, lc, cheb(lx, ly, sx, sy)); run.act.chainCount++; run.act.gravel += cellRes(lc);
      if (numAt(f, lc) === 0) chainFrom(run, lc);
    }
    endAct(run, { floorStart: true });
    // 튜토리얼 X/O 표시는 열린 뒤에도 유지
    if (f.chunk) log(run, feat('chunkShown') ? TEXT.chunkShownFloor : TEXT.chunk.floor);
    // 갈림길 덤(R42)
    if (bonus === 'candle') { addCandle(run, CONFIG.forkBonus.candle); log(run, '덤: 촛불 +' + CONFIG.forkBonus.candle + '.', 'good'); }
    if (bonus === 'streak') { streakUp(run, CONFIG.forkBonus.streak); log(run, '덤: 콤보가 한 단계 올라 ×' + streakMult(run) + '에서 시작해요.', 'good'); }
    if (bonus === 'value') log(run, '덤: 이 층 보물 값 ×' + CONFIG.forkBonus.valueMul + '.', 'good');
    // 계단 바람(R39): 첫 판 지하 1층 도착 때 한 번 알린다
    // R56·R60 계단 빛 번짐: 중심은 계단에서 가로·세로 0~1칸 어긋난 칸(층 시드로 고정). 반경 2칸 안에 계단이 늘 들어온다
    if (f.stair && !f.stair.blocked && !CONFIG.stairShown) {
      var lr = rngFrom(hashSeed(run.seed, run.day, d.floorIdx, 0x4c4954));
      f.light = { x: Math.max(0, Math.min(W - 1, f.stair.x + Math.floor(lr() * 3) - 1)), y: Math.max(0, Math.min(H - 1, f.stair.y + Math.floor(lr() * 3) - 1)) };
    }
    if (CONFIG.stairShown) { if (f.stair && !f.stair.blocked && run.taught && !run.taught.stairShown) { run.taught.stairShown = true; log(run, TEXT.stairShown); } }   // 한 판에 한 번
    else if (run.tutorial && depth === 1 && run.day === 1) log(run, TEXT.light.first);
    if (!CONFIG.stairShown && mut(run, 'sleepy') && depth === (gang(run, 'toss') ? 2 : 1)) log(run, TEXT.light.none);
  }
  // 벽 낙서 자리: 시작 와르르로 열리는 0칸이 가로로 3칸 이상 이어진 곳 중 시작에 가까운 곳(이미 쓴 줄은 피함)
  function graffitiSpot(f, near, minW, g) {
    if (!g) { g = cloneFloor(f); simOpen(g, cellAt(g, f.sx, f.sy)); }
    var best = null, bd = 1e9;
    for (var y = 0; y < H; y++) {
      if (f.graffiti.some(function (q) { return Math.abs(q.y - y) <= 1; })) continue;
      var x = 0;
      while (x < W) {
        var run0 = x;
        while (x < W) { var c = cellAt(g, x, y); if (c.cover === 'open' && !c.haz && !c.stair && numAt(g, c) === 0 && !(x === f.sx && y === f.sy)) x++; else break; }
        var w = x - run0;
        if (w >= (minW || 4)) { var dd = cheb(run0 + 1, y, near.x, near.y) - Math.min(w, 7) * 0.5; if (dd < bd) { bd = dd; best = { x: run0, y: y, w: Math.min(w, 7) }; } }
        x++;
      }
    }
    return best;
  }
  function placeGraffiti(f, text, near, extra, g) {
    var sp = graffitiSpot(f, near || { x: f.sx, y: f.sy }, 3, g);
    if (sp) f.graffiti.push(Object.assign({ x: sp.x, y: sp.y, w: sp.w, text: text }, extra || {}));
  }
  function tutorialFloor(run, depth, rule, sx, sy) {
    var T = TUTORIAL.floors[depth], map = T.maps ? (T.maps[rule] || T.maps[T.rule]) : T.map, f;
    if (map && (!T.start || (T.start[0] === sx && T.start[1] === sy))) f = floorFromMap(map, depth, rule, sx, sy, hashSeed(TUTORIAL.seed, depth));
    else f = genFloor({ depth: depth, rule: rule, sx: sx, sy: sy, seed: hashSeed(TUTORIAL.seed, depth, 5) });   // 정해진 자리에서 시작하지 않았을 때만
    f.rule = rule;
    f.tutorial = true;
    if (T.graffiti) f.graffiti = T.graffiti.filter(function (g) { return !(g.stairHint && CONFIG.stairShown); }).map(function (g) { return Object.assign({}, g); });
    if (T.glow) f.glow = (T.glow.slice ? T.glow : (T.glow[rule] || [])).slice();
    if (depth === 2) {   // 낙서 5(짝 광맥 판, 입구), 6(두 판 모두, 계단 가는 길, 첫 보물을 캐면 보인다)
      if (T.graffitiRule[rule]) placeGraffiti(f, T.graffitiRule[rule]);
      placeGraffiti(f, T.graffiti2, { x: f.stair.x, y: f.stair.y }, { after: 'treasure' }, propagated(f));
    }
    if (depth === 3) tutorialB3Setup(run, f);
    return f;
  }
  // 숫자·규칙 풀이로 갈 수 있는 데까지 연 상태(발파·찍기 없이). 첫 판 층 고르기와 낙서 자리 찾기에 쓴다
  function propagated(f0, opt) {
    var g = cloneFloor(f0); simOpen(g, cellAt(g, g.sx, g.sy));
    for (var it = 0; it < 200; it++) {
      var D = deduce(g), prog = false;
      D.safe.forEach(function (i) { var c = g.cells[i]; if (c.cover !== 'open') { simOpen(g, c); prog = true; } });
      if (!prog && !(opt && opt.noDig)) D.tre.forEach(function (i) { var c = g.cells[i]; if (c.cover !== 'open' && c.haz === 'treasure') { c.cover = 'open'; c.removed = true; simChainAround(g, c); prog = true; } });
      if (!prog && D.stairCand.length === 1) { simOpen(g, g.cells[D.stairCand[0]]); prog = true; }
      if (!prog) break;
    }
    return g;
  }
  // 첫 판 Day 2·3의 정해진 층(01 16.2). 고정 시드를 차례로 훑어 가르칠 요소가 나오는 첫 배치를 쓴다
  var TUT_TEST = {
    // Day 2 지하 1층(테두리): 숫자로 확실해지는 안쪽 위험 칸 셋 이상(전부 지뢰), 그중 둘 이상이 붙어 있어 X를 긋고 터뜨릴 자리
    '2-1': function (f) {
      // 안쪽의 확실한 지뢰 하나에 지뢰 둘을 덧붙여 '지뢰가 몰린 구역'을 만든다(테두리 규칙은 보물만 묶으므로 그대로 성립)
      var g0 = propagated(f), D0 = deduce(g0);
      var seeds = D0.mine.map(function (i) { return f.cells[i]; }).filter(function (c) { return !isBorder(c.x, c.y) && cheb(c.x, c.y, f.sx, f.sy) >= 3 && cheb(c.x, c.y, f.sx, f.sy) <= 5; });
      for (var a = 0; a < seeds.length; a++) {
        var m = seeds[a];
        var add = orthN(f, m.x, m.y).filter(function (n) { return !n.haz && !n.stair && !isBorder(n.x, n.y) && cheb(n.x, n.y, f.sx, f.sy) >= 2; });
        if (add.length < 2) continue;
        var h = cloneFloor(f); add.slice(0, 2).forEach(function (n) { var hc = cellAt(h, n.x, n.y); hc.haz = 'mine'; hc.res = 0; });
        if (!checkFloor(h) || !isSolvable(h)) continue;
        var g = propagated(h), D = deduce(g);
        var cl = [m].concat(add.slice(0, 2)).map(function (c) { return cellAt(g, c.x, c.y); });
        if (!cl.every(function (c) { return D.mine.indexOf(idx(c)) >= 0; })) continue;
        var blastOpens = {}; cl.forEach(function (c) { neighbors(g, c.x, c.y).forEach(function (n) { if (n.cover !== 'open' && !n.haz) blastOpens[idx(n)] = 1; }); });
        if (Object.keys(blastOpens).length < 2) continue;
        h.ok = true; h.solvable = true; h.cluster = cl.map(function (c) { return [c.x, c.y]; });
        return { floor: h, near: m, g: propagated(h) };
      }
      return null;
    },
    // Day 2 지하 2층(짝 / 외톨이): 숫자와 표지판으로는 못 가르는 위험 칸 둘이 붙어 있는 자리가 계단 가는 길에
    '2-2': function (f) {
      var g = propagated(f), D = deduce(g), s = f.stair;
      var unk = D.haz.filter(function (i) { return D.tre.indexOf(i) < 0 && D.mine.indexOf(i) < 0; }).map(function (i) { return g.cells[i]; })
        .filter(function (c) { return neighbors(g, c.x, c.y).some(function (n) { return n.cover === 'open'; }); });
      var pair = null;
      unk.forEach(function (a) { unk.forEach(function (b) { if (!pair && a !== b && cheb(a.x, a.y, b.x, b.y) === 1 && Math.max(cheb(a.x, a.y, s.x, s.y), cheb(b.x, b.y, s.x, s.y)) <= 5) pair = [a, b]; }); });
      if (!pair) return null;
      return { near: pair[0], g: g, watch: pair.map(function (c) { return [c.x, c.y]; }) };
    },
    // Day 3 지하 3층(큰 덩이): 시작 와르르 가장자리에서 두 칸 안, 덩이를 둘러싼 칸에 지뢰 1개
    '3-3': function (f) {
      if (!f.chunk || !f.solvable) return null;
      var g = cloneFloor(f); simOpen(g, cellAt(g, g.sx, g.sy));
      var C = f.chunk, near = 9, ring = 0;
      for (var y = C.y - 1; y <= C.y + C.h; y++) for (var x = C.x - 1; x <= C.x + C.w; x++) {
        var c = cellAt(g, x, y); if (!c) continue;
        var inC = x >= C.x && x < C.x + C.w && y >= C.y && y < C.y + C.h;
        if (!inC && c.haz === 'mine') ring++;
      }
      g.cells.forEach(function (c) { if (c.cover === 'open') for (var yy = C.y; yy < C.y + C.h; yy++) for (var xx = C.x; xx < C.x + C.w; xx++) near = Math.min(near, cheb(c.x, c.y, xx, yy)); });
      if (near > 2 || ring !== 1) return null;
      return { near: { x: f.sx, y: f.sy } };
    }
  };
  function tutorialLaterFloor(run, depth, rule, sx, sy, L) {
    var key = run.day + '-' + depth, test = TUT_TEST[key], spec = floorSpec(run, depth, rule, sx, sy), f = null, info = null;
    var k0 = L.k != null && typeof L.k === 'object' ? L.k[rule] : L.k, order = [];
    if (k0 != null) order.push(k0);
    for (var k = 0; k < 160; k++) if (k !== k0) order.push(k);
    for (var j = 0; j < order.length && !info; j++) {
      spec.seed = hashSeed(TUTORIAL.seed, run.day, depth, RULE_IDS.indexOf(rule) + 1, sx * 16 + sy, order[j]);
      f = genFloor(spec);
      info = test ? test(f) : {};
      if (info && info.floor) f = info.floor;
      if (info) f.tutorialK = order[j];
    }
    f.tutorial = true;
    if (info) placeGraffiti(f, L.text, info.near, info.watch ? { watch: info.watch } : null, info.g);
    if (!f.graffiti.length) placeGraffiti(f, L.text);
    return f;
  }
  function floorFromMap(map, depth, rule, sx, sy, seed) {
    var f = blankFloor(depth, rule, sx, sy), rng = rngFrom(seed);
    var row = densityRow(depth);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var ch = map[y][x], c = cellAt(f, x, y);
      if (ch === 'm' || ch === 'X') { c.haz = 'mine'; if (ch === 'X') c.mark = 1; }
      else if (ch === 'g' || ch === 'O') { c.haz = 'treasure'; c.tier = 1; if (ch === 'O') c.mark = 2; }
      else if (ch === 'G') { c.haz = 'treasure'; c.tier = 2; }
      else if (ch === 's') { c.stair = true; f.stair = { x: x, y: y, found: false }; }
    }
    f.cells.forEach(function (c) { if (!c.haz && !c.stair && rng() < row.res) c.res = row.rv; });
    f.ok = true; f.solvable = isSolvable(f);
    return f;
  }
  // 지하 3층(첫 판): 미리 그어 둔 X 둘(지뢰)과 O 하나(금 알갱이). 낙서 7·8은 그 상황을 아직 못 겪었을 때만(R38). 계단 자리는 막힌 벽
  function tutorialB3Setup(run, f) {
    var xs = f.cells.filter(function (c) { return c.mark === 1; }), o = f.cells.filter(function (c) { return c.mark === 2; })[0];
    xs.forEach(function (c) { c.givenX = true; });
    if (xs.length && !(run.taught && run.taught.x)) placeGraffiti(f, TUTORIAL.b3Graffiti.x, xs[0], { icon: 'ignite', taught: 'x' });
    if (o && feat('embers') && !(run.taught && run.taught.ember)) placeGraffiti(f, TUTORIAL.b3Graffiti.o, o, { taught: 'ember' });
    f.stair.blocked = true;   // 01 16.2: Day 1은 지하 3층이 끝. 계단 자리에는 막힌 벽과 낙서 9
    f.graffiti.push({ x: f.stair.x, y: f.stair.y, w: 1, text: TUTORIAL.b3Graffiti.stair, stairWall: true });
  }
  function beginAct(run, x, y) { run.act = { ox: x, oy: y, opened: [], chainCount: 0, gravel: 0, stop: 0, chainEvents: [] }; }
  function openRaw(run, c, ring) {
    var was = c.cover;
    if (was !== 'open' && c.mark === 1) judgeX(run, c);
    c.cover = 'open'; if (!c.chunk) c.mark = 0;
    run.act.opened.push({ x: c.x, y: c.y, ring: ring, was: was });
    if (c.stair && run.d.floor.stair && !run.d.floor.stair.found) foundStair(run, c);
  }
  function foundStair(run, c) {
    var f = run.d.floor; f.stair.found = true;
    if (f.stair.blocked) { log(run, '계단 자리가 막혀 있어요. 벽에 "' + TUTORIAL.b3Graffiti.stair + '"'); fx(run, { t: 'stair', x: c.x, y: c.y }); return; }
    f.forkOptions = forkOptions(run, f.depth + 1);
    log(run, '계단을 찾았어요. 계단에 올라서서 한 번 더 클릭하면 내려가요.', 'good');
    fx(run, { t: 'stair', x: c.x, y: c.y });
  }
  function chainFrom(run, src, radius2) {
    var f = run.d.floor, act = run.act, q = [src], seen = {};
    seen[idx(src)] = 1;
    while (q.length) {
      var c = q.shift();
      if (numAt(f, c) !== 0) continue;
      var nb = neighbors(f, c.x, c.y);
      for (var i = 0; i < nb.length; i++) {
        var n = nb[i];
        if (!covered(n) || liveHaz(n) || n.stair) continue;   // 와르르는 계단 칸을 열지 않는다
        openRaw(run, n, cheb(n.x, n.y, act.ox, act.oy));
        act.chainCount++;
        act.gravel += cellRes(n);
        if (!seen[idx(n)]) { seen[idx(n)] = 1; q.push(n); }
      }
    }
    if (radius2) {   // 울림 쐐기: 둘레 2칸 안전 칸
      for (var y = src.y - 2; y <= src.y + 2; y++) for (var x = src.x - 2; x <= src.x + 2; x++) {
        var w = cellAt(f, x, y); if (!w || !covered(w) || liveHaz(w) || w.stair) continue;
        openRaw(run, w, cheb(w.x, w.y, act.ox, act.oy)); act.chainCount++; act.gravel += cellRes(w);
        if (numAt(f, w) === 0) chainFrom(run, w);
      }
    }
  }
  function hazardRemoved(run, c) {
    var f = run.d.floor, wedge = owns(run, 'wedge'), any = false;
    neighbors(f, c.x, c.y).forEach(function (n) {
      if (covered(n)) return;
      fx(run, { t: 'numChange', x: n.x, y: n.y });
      if (numAt(f, n) === 0) { var before = run.act.chainCount; chainFrom(run, n, wedge); if (wedge && run.act.chainCount > before) any = true; }
    });
    if (any) fx(run, { t: 'proc', id: 'wedge', icon: 'wedge', label: '주변 2칸' });
  }

  // 보물 획득(값 = 기본 × 콤보 배율 × (1 + 보너스)). 콤보는 캔 뒤에 오른다
  function gainTreasure(run, x, y, base, o) {
    o = o || {};
    var d = run.d;
    var ev = emit(run, 'on_treasure', { x: x, y: y, base: base, bonus: (gang(run, 'rough') && !o.chunk ? 0.2 : 0) + (!o.chunk && !o.tool ? keepSum(run, 'treasureBonus') : 0), scorch: !!o.scorch, tier: o.tier || 1 });   // 숨이 거침: 큰 덩이는 빼고
    var mult = streakMult(run);
    var fv = (!o.chunk && run.d.floor && run.d.floor.valueMul) || 1;   // 갈림길 덤 '이 층 보물 값 ×1.3'(큰 덩이는 빼고)
    var full = ev.base * stage(run).valueMul * fv * (o.chunk ? 1 : (charOf(run).valueMul || 1));   // 측량사는 보물 값 ×0.9(큰 덩이는 빼고)                       // 시세(도장 수)는 주머니에 들어가는 값 전부에 붙는다
    var b = full * (o.scorch ? CONFIG.scorchMul : 1);
    var total = Math.floor(b * (1 + ev.bonus) * mult + 1e-6);         // 01 5.3: 기본값 → 시세 → 더하기 → 그을림 → 콤보 → 소수점 버림
    d.pocket += total;
    if (o.chunk) d.pocketLines.chunk += total; else if (o.tool) d.pocketLines.refine += total; else { d.pocketLines.treasure += total; d.pocketLines.treasureN++; }
    curFloorRec(run).value += total;
    fx(run, { t: 'gain', x: x, y: y, base: Math.round(b), full: Math.round(full), mult: mult, bonus: ev.bonus, total: total, tier: o.tier || 1, scorch: !!o.scorch, chunk: !!o.chunk, w: o.w, h: o.h, label: o.label || '' });
    d.stats.treasures++; run.stats.treasures++;
    if (!d.stats.firstTreasureHit) d.stats.firstTreasureHit = d.stats.hits || 1;
    if (!o.scorch && !o.noStreak) streakUp(run, 1 + (o.extraStep || 0));   // 그을린 보물은 콤보를 올리지 않는다(01 6장)
    return total;
  }
  function curFloorRec(run) { return run.d.floorsVisited[run.d.floorsVisited.length - 1]; }

  function resolveBreak(run, c, how) {
    // how: { direct, mark, ember }
    var d = run.d, f = d.floor;
    var content = c.haz || (c.stair ? 'stair' : 'empty');
    var mev = emit(run, 'on_mark_hit', { mark: how.mark, content: content, streakStep: 0, extraDamage: 0 });
    if (how.direct && content === 'mine') mev.extraDamage += charOf(run).digMineExtra || 0;   // 폭파공: 곡괭이로 지뢰를 치면 피해 +1
    openRaw(run, c, 0);
    if (c.haz) {
      c.removed = true;
      if (c.haz === 'mine') {
        c.scorch = true;
        if (how.mark === 2) orderFail(run, 'chalkO');   // O 칸에서 지뢰가 나오면 실패
        explodeMine(run, c, mev.extraDamage, how.ember, how.judge);
      } else if (c.haz === 'treasure') {
        var bigN = neighbors(f, c.x, c.y).some(function (n) { return n.cover === 'open' && !n.removed && !n.haz && (numAt(f, n) + 1) >= 4; });
        if (bigN) { d.stats.bigNumT++; orderEvent(run, 'bigNum'); }
        if (how.mark === 2) { d.stats.oT++; orderEvent(run, 'chalkO'); }
        if (how.ember) { d.stats.emberT++; orderEvent(run, 'emberT'); }
        if (c.tier === 2 && !c.box) { d.stats.gems++; orderEvent(run, 'gem'); }
        d.stats.floorT++; d.stats.dugT++; orderEvent(run, 'floorT');
        if (!d.stats.probes) { d.stats.noProbeT++; orderEvent(run, 'noProbeT'); }
        f.treasuresDug++;
        var m0 = streakMult(run);
        var fz = c.fizzle && CONFIG.fizzle !== 'keep';
        if (c.box) { gainBox(run, c, { extraStep: mev.streakStep, scorch: fz }); hazardRemoved(run, c); if (numAt(f, c) === 0) chainFrom(run, c); emit(run, 'on_break', { x: c.x, y: c.y, content: content, direct: !!how.direct }); return; }
        var got = gainTreasure(run, c.x, c.y, CONFIG.treasureValue[c.tier], { tier: c.tier, extraStep: mev.streakStep, scorch: fz });
        var tb = Math.round(CONFIG.treasureValue[c.tier] * stage(run).valueMul * (fz ? CONFIG.scorchMul : 1));
        var plain0 = Math.round(tb * m0);
        log(run, TREASURE_NAMES[c.tier] + ' ' + fmt(tb) + (fz ? '(그을림)' : '') + (m0 > 1 ? ' ×' + m0 : '') + (got !== plain0 ? ' +' + Math.round((got / plain0 - 1) * 100) + '%' : '') + (got !== tb ? ' = ' + fmt(got) : '') + '. 다음 보물 ×' + streakMult(run) + '.', 'good');
        run.act.stop = Math.max(run.act.stop, CONFIG.fx.treasureStop);
      } else if (c.haz === 'chunk') {
        digChunk(run, c);
      }
      hazardRemoved(run, c);
    } else {
      run.act.gravel += cellRes(c);
    }
    if (numAt(f, c) === 0) chainFrom(run, c);
    emit(run, 'on_break', { x: c.x, y: c.y, content: content, direct: !!how.direct });
  }
  function explodeMine(run, c, extraDamage, ember, judge) {
    var d = run.d, f = d.floor;
    var ev = emit(run, 'on_mine', { x: c.x, y: c.y, damage: CONFIG.mineDmg + (extraDamage || 0) });
    d.stats.mines++; run.stats.mines++; f.mineHits = (f.mineHits || 0) + 1;
    if (run.order && run.order.id === 'noMine') run.order.failed = true;
    fx(run, { t: 'mine', x: c.x, y: c.y, dmg: ev.damage });
    // 숫자 강조: 이 지뢰를 세던 숫자들
    fx(run, { t: 'blame', cells: neighbors(f, c.x, c.y).filter(function (n) { return n.cover === 'open'; }).map(function (n) { return { x: n.x, y: n.y }; }) });
    if (ember) { d.hp = 0; log(run, TEXT.ember.mine, 'bad'); }
    else {
      d.hp = Math.max(0, d.hp - ev.damage);
      // 지뢰 판정 한 줄: 덩이 층은 '지뢰 또는 덩이'라 가르지 않아요
      var jk = judge && !(f.chunk && !f.chunk.done && !feat('chunkShown')) ? (judge === 'knownM' ? 'known' : judge === 'bet' ? 'bet' : 'unknown') : null;
      log(run, '펑. 체력 -' + ev.damage + '. ' + (jk ? TEXT.mineJudge[jk] + '.' : '주변 숫자가 이 지뢰를 세고 있었어요.'), 'bad');
      if (jk) fx(run, { t: 'judge', x: c.x, y: c.y, kind: jk, text: TEXT.mineJudge[jk] });
    }
    streakBreak(run, c.x, c.y);
    run.act.stop = Math.max(run.act.stop, CONFIG.fx.mineStop);
    if (mut(run, 'quake')) {   // 여진: 붙어 있는 지뢰도 터진다. 피해는 한 번
      var q = [c], seen = {}; seen[idx(c)] = 1; var extra = [];
      while (q.length) {
        var m = q.shift();
        neighbors(f, m.x, m.y).forEach(function (n) { if (!seen[idx(n)] && n.haz === 'mine' && !n.removed) { seen[idx(n)] = 1; extra.push(n); q.push(n); } });
      }
      extra.forEach(function (n, k) { openRaw(run, n, k + 1); n.removed = true; n.scorch = true; fx(run, { t: 'boom', x: n.x, y: n.y, delay: 120 * (k + 1) }); });
      extra.forEach(function (n) { hazardRemoved(run, n); });
      if (extra.length) log(run, '여진. 붙어 있던 지뢰 ' + extra.length + '개도 터졌어요.', 'bad');
    }
  }
  function digChunk(run, c) {
    var d = run.d, f = d.floor, C = f.chunk;
    C.dug++;
    if (!f.awake && feat('awake')) { f.awake = true; log(run, TEXT.chunk.awake, 'bad'); fx(run, { t: 'awake' }); }
    fx(run, { t: 'chunkPiece', x: c.x, y: c.y, dug: C.dug, total: C.total });
    if (C.dug === C.total - 1) log(run, TEXT.chunk.last);
    if (C.dug >= C.total) {
      C.done = true; d.chunkDone = true; run.stats.chunks = (run.stats.chunks || 0) + 1;
      gainTreasure(run, C.x + (C.w - 1) / 2, C.y + (C.h - 1) / 2, C.value, { chunk: true, tier: 3, w: C.w, h: C.h, label: '큰 덩이' });
      log(run, TEXT.chunk.done, 'good');
    }
  }

  function endAct(run, opt) {
    opt = opt || {};
    var act = run.act, d = run.d, gvLog = 0;
    if (act.chainCount > 0) {
      var ev = emit(run, 'on_chain_open', { count: act.chainCount, floorStart: !!opt.floorStart });
      if (act.chainCount > run.stats.chainMax) run.stats.chainMax = act.chainCount;
      if (act.chainCount > d.stats.chainMax) d.stats.chainMax = act.chainCount;
      if (act.chainCount > 20 && !opt.floorStart) orderEvent(run, 'chain20');
      if (!opt.floorStart && act.chainCount >= 6) log(run, '와르르. ' + act.chainCount + '칸이 열렸어요.');
    }
    if (feat('gravel') === 'chain' && !opt.floorStart && act.chainCount >= Math.min(CONFIG.chainGravel.min, keepWith(run, 'gravelMin') ? keepWith(run, 'gravelMin').gravelMin : 99)) act.gravel += act.chainCount * CONFIG.chainGravel.per;   // 큰 와르르만 자갈
    if (act.gravel > 0) {
      var gv = Math.round(act.gravel * (gang(run, 'gravel') ? 2 : 1) * stage(run).valueMul);
      d.pocket += gv; d.pocketLines.gravel += gv; curFloorRec(run).value += gv; curFloorRec(run).gravel = (curFloorRec(run).gravel || 0) + gv; gvLog = gv;
      fx(run, { t: 'gravel', x: act.ox, y: act.oy, total: gv, floorStart: !!opt.floorStart });
    }
    if (act.opened.length) fx(run, { t: 'open', ox: act.ox, oy: act.oy, cells: act.opened, stop: act.stop, floorStart: !!opt.floorStart, count: act.chainCount });
    if (opt.floorStart && act.opened.length) log(run, '입구 주변이 무너져 ' + act.opened.length + '칸이 열렸어요.' + (gvLog ? ' 자갈 +' + gvLog : ''));
    run.act = null;
    if (feat('lowLight') && !d.lowWarned && d.candle <= CONFIG.lowLight && d.candle > 0) { d.lowWarned = true; log(run, TEXT.lowLight); }
    checkPerfect(run);
    if (d.hp <= 0) return endDay(run, 'collapse');
    if (!feat('embers') && d.candle <= 0 && run.phase === 'mine') {   // v22: 촛불이 다 타면 그 자리에서 하루 끝(불씨 없음)
      var co0 = emit(run, 'on_candle_out', { relight: 0 });
      if (co0.relight > 0) { d.candle = co0.relight; return; }
      log(run, TEXT.candleOut, 'bad'); return endDay(run, 'candle');
    }
    if (d.embersOn && d.embers <= 0) { log(run, TEXT.ember.out); return endDay(run, 'candle'); }
    if (d.candle <= 0 && !d.embersOn && run.phase === 'mine') {
      var co = emit(run, 'on_candle_out', { relight: 0 });
      if (co.relight > 0) { d.candle = co.relight; return; }
      // 불씨는 하루에 다섯 개가 전부다. 불이 다시 붙었다가 또 꺼지면 남은 불씨를 이어 쓰고, 없으면 그 자리에서 하루가 끝난다(01 4.4)
      if (!d.embersGiven) { d.embersGiven = true; d.embers = emberTotal(run); }
      else if (d.embers <= 0) { log(run, TEXT.ember.out); return endDay(run, 'candle'); }
      d.embersOn = true;
      log(run, TEXT.ember.start.replace('{n}', d.embers === 5 ? '다섯' : d.embers === 7 ? '일곱' : d.embers), 'bad');
      fx(run, { t: 'embers', resume: d.embers < emberTotal(run) });
    }
  }

  // 완벽한 층(재미 보고서 5.1): 이 층 보물을 녹이지 않고 다 캐고, 치기로 지뢰를 한 번도 안 터뜨린 층. 이룬 순간 한 번 알린다
  function checkPerfect(run) {
    var d = run.d, f = d && d.floor; if (!feat('perfect') || !f || f.perfect || f.mineHits) return;
    var T = f.cells.filter(function (c) { return c.haz === 'treasure'; });
    if (!T.length || !T.every(function (c) { return c.removed && !c.melted; })) return;
    f.perfect = true; run.stats.perfect++; d.stats.perfect = (d.stats.perfect || 0) + 1; curFloorRec(run).perfect = true;
    log(run, TEXT.perfect, 'good'); fx(run, { t: 'perfect' });
  }

  // ---------- 행동 ----------
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function canAct(run) { var d = run.d; return run.phase === 'mine' && !run.boxOffer && d.hp > 0 && (d.candle > 0 || (d.embersOn && d.embers > 0)); }
  function move(run, dx, dy) {
    if (!canAct(run)) return { ok: false };
    var d = run.d; d.face = { dx: dx, dy: dy };
    var c = cellAt(d.floor, d.px + dx, d.py + dy);
    if (c && walkable(d.floor, c)) { d.px += dx; d.py += dy; return { ok: true, moved: true }; }
    return { ok: true, moved: false };
  }
  function walkable(f, c) { return c.cover === 'open' && !(c.stair && f.stair && f.stair.blocked); }   // 첫날 지하 3층의 막힌 계단 자리는 벽
  // 칸 하나를 화면에 보이는 정보(숫자, 표지판, 분필 아닌 확인 표시)로 가르기: safe 안전 / knownT 보물 확실 / knownM 지뢰 확실 / bet 보물 아니면 지뢰 / unknown 모름
  function classify(run, c) {
    var D = deduce(run.d.floor, { blur: mut(run, 'blur') }), i = idx(c);
    if (D.st[i] === 1) return 'safe';
    if (D.st[i] === 2) return !D.canM[i] ? 'knownT' : !D.canT[i] ? 'knownM' : 'bet';
    return 'unknown';
  }
  function hitCost(run) { return run.d.floor.awake ? CONFIG.awakeHitCost : CONFIG.hitCost; }
  function hit(run, x, y) {
    if (!canAct(run)) return { ok: false };
    var d = run.d, f = d.floor, c = cellAt(f, x, y);
    if (!c || cheb(d.px, d.py, x, y) !== 1 || !covered(c)) return { ok: false };
    d.face = { dx: sgn(x - d.px), dy: sgn(y - d.py) };
    // R57: X를 그은 칸은 캐지지 않는다. X 칸을 누르면 화면이 발파(ignite)를 불러요(R92)
    if (c.mark === 1) { log(run, TEXT.ops.xCell); fx(run, { t: 'locked', x: x, y: y, text: TEXT.ops.xCell }); return { ok: false, locked: true, xcell: true }; }
    var ember = d.embersOn;
    if (c.mark === 2 && !c.faded && d.survey > 0 && !ember && d.candle >= CONFIG.probeCost + hitCost(run)) {   // 측량사 청진
      d.survey--; d.stats.probes++;
      spendCandle(run, CONFIG.probeCost);
      fx(run, { t: 'proc', id: 'survey', icon: 'tapper', label: '청진' });
      if (c.haz === 'mine') {
        beginAct(run, x, y);
        c.probe = 'mine'; c.mark = 1; c.givenX = true;
        fx(run, { t: 'probe', x: x, y: y, result: 'mine' });
        log(run, '청진: 통통. 지뢰예요. X로 바꿔 뒀어요. 오늘 청진 ' + d.survey + '번 남았어요.', 'good');
        endAct(run);
        return { ok: true, surveyed: 'mine' };
      }
      log(run, '청진: 둔탁해요. 지뢰가 아니라서 캐요. 오늘 청진 ' + d.survey + '번 남았어요.');
    }
    var cls = (run.record || (c.haz === 'mine' && !ember)) ? classify(run, c) : null;   // 지뢰 판정 한 줄은 지뢰일 때만 계산해요
    if (run.record && cls) d.rec[cls]++;
    beginAct(run, x, y);
    if (ember) { d.embers--; fx(run, { t: 'ember', left: d.embers }); if (d.embers === 1) log(run, TEXT.ember.last); }
    else spendCandle(run, hitCost(run));
    d.stats.hits++; d.stats.breaks++;
    if (c.haz) d.stats.hazDigs++; else d.stats.safeDigs++;
    var mark = c.mark;
    run.act.stop = CONFIG.fx.breakStop;
    fx(run, { t: 'break', x: x, y: y });
    resolveBreak(run, c, { direct: true, mark: mark, ember: ember, judge: cls });
    endAct(run);
    return { ok: true, broke: true, judge: cls, content: c.haz || (c.stair ? 'stair' : 'empty') };
  }
  // 둘레 한꺼번에 열기(재미 보고서 4.1): 서 있는 숫자 칸의 둘레에 그은 X·O 수가 숫자와 같으면, 나머지 덮인 칸을 촛불 한 번에 연다. 표시가 틀렸으면 지뢰가 터진다
  function chordInfo(run, x, y) {
    var d = run.d, f = d.floor, c = cellAt(f, x, y);
    if (!feat('chord') || !c || c.cover !== 'open' || (c.haz && !c.removed)) return null;
    var n = numAt(f, c); if (!n) return null;
    var cov = neighbors(f, x, y).filter(covered), marked = cov.filter(function (q) { return q.mark === 1 || q.mark === 2; });
    var rest = cov.filter(function (q) { return !q.mark && !(q.stair && f.stair && f.stair.blocked); });
    return { n: n, marked: marked.length, rest: rest, ready: marked.length === n && rest.length > 0 };
  }
  function chord(run, x, y) {
    if (!canAct(run) || run.d.embersOn) return { ok: false };
    var d = run.d, f = d.floor;
    if (d.px !== x || d.py !== y) return { ok: false, notHere: true };
    var I = chordInfo(run, x, y); if (!I) return { ok: false };
    if (I.marked !== I.n) { log(run, TEXT.chord.need); return { ok: false, need: true }; }
    if (!I.rest.length) { log(run, TEXT.chord.none); return { ok: false, none: true }; }
    var cost = hitCost(run);
    if (d.candle < cost) return { ok: false, short: true };
    var cls = I.rest.map(function (q) { return (run.record || (q.haz === 'mine')) ? classify(run, q) : null; });
    if (run.record) cls.forEach(function (k) { if (k) d.rec[k]++; });
    beginAct(run, x, y);
    spendCandle(run, cost);
    d.stats.hits++; d.stats.chords = (d.stats.chords || 0) + 1; run.stats.chords++;
    if (run.record) d.rec.chords = (d.rec.chords || 0) + 1;
    run.act.stop = CONFIG.fx.breakStop;
    var boom = false;
    for (var k = 0; k < I.rest.length && !boom; k++) {
      var q = I.rest[k]; if (q.cover === 'open') continue;
      d.stats.breaks++; if (q.haz) d.stats.hazDigs++; else d.stats.safeDigs++;
      fx(run, { t: 'break', x: q.x, y: q.y });
      if (q.haz === 'mine') boom = true;
      resolveBreak(run, q, { direct: true, mark: 0, judge: cls[k] });
    }
    endAct(run);
    return { ok: true, opened: I.rest.length, boom: boom };
  }
  function mark(run, x, y, to) {
    if (run.phase !== 'mine') return { ok: false };
    var c = cellAt(run.d.floor, x, y);
    if (!c || !covered(c)) return { ok: false };
    if (c.faded) { fx(run, { t: 'chalkDust', x: x, y: y }); return { ok: false, faded: true }; }   // 바랜 자국은 그대로예요
    c.mark = to != null ? to : (c.mark + 1) % 3;
    c.givenX = false;
    if (run.record && run.d) run.d.rec.marks++;
    fx(run, { t: 'chalk', x: x, y: y });
    return { ok: true, mark: c.mark };
  }
  function probe(run, x, y) {
    var d = run.d;
    if (!canAct(run) || d.embersOn) return { ok: false };
    var c = cellAt(d.floor, x, y);
    if (!c || cheb(d.px, d.py, x, y) !== 1 || !covered(c)) { log(run, TEXT.ops.noPath); return { ok: false }; }
    if (d.probes <= 0) { log(run, '오늘은 더 두드려 볼 수 없어요.'); return { ok: false }; }
    if (c.probe) { log(run, '이미 두드려 본 칸이에요.'); return { ok: false }; }
    if (d.candle < CONFIG.probeCost) { log(run, '촛불이 모자라요. 두드려 보기는 촛불 2.'); return { ok: false, short: true }; }
    d.face = { dx: sgn(x - d.px), dy: sgn(y - d.py) };
    var preHaz = deduce(d.floor).st[idx(c)] === 2;
    if (preHaz && c.haz !== 'mine') c.probeSure = true;
    beginAct(run, x, y);
    d.probes--; d.stats.probes++; if (run.record) d.rec.probes++;
    spendCandle(run, CONFIG.probeCost);
    c.probe = c.haz === 'mine' ? 'mine' : 'safe';
    if (c.probe === 'mine') { c.mark = 1; c.givenX = true; }   // 01 3.7: 지뢰면 X가 저절로 그어지고 '확인됨' 테두리
    orderFail(run, 'noProbe');
    fx(run, { t: 'probe', x: x, y: y, result: c.probe });
    var sure = c.probe === 'safe' && preHaz;   // 숫자로 이미 '뭔가 있는 칸'이었으면 보물로 확정(검수 13번)
    log(run, c.probe === 'mine' ? '두드려 보기: 통통. 지뢰예요. X를 그어 뒀어요.' : sure ? '두드려 보기: 둔탁해요. 지뢰가 아니에요. 숫자가 세고 있던 칸이라 보물이에요.' : '두드려 보기: 둔탁해요. 지뢰는 아니에요. 숫자가 세고 있었다면 보물이에요.');
    endAct(run);
    return { ok: true, result: c.probe };
  }
  // 발파(R10): X 칸에 점화. 지뢰면 피해 없이 터져 둘레 8칸이 열리고 범위 안 지뢰도 이어 터진다
  function igniteCost(run) { return CONFIG.igniteCost - (gang(run, 'dry') ? 1 : 0) + (charOf(run).igniteDelta || 0); }   // 마른 갱: 1 덜 든다
  function ignite(run, x, y, free) {
    var d = run.d;
    if (!canAct(run) || d.embersOn) { if (d && d.embersOn) log(run, TEXT.ember.noFire); return { ok: false }; }
    var f = d.floor, c = cellAt(f, x, y);
    if (!c || cheb(d.px, d.py, x, y) !== 1 || !covered(c)) { log(run, TEXT.ops.noPath); return { ok: false }; }
    if (c.mark !== 1) { log(run, TEXT.ops.needX); return { ok: false, noX: true }; }
    var cost = free ? 0 : igniteCost(run);
    if (d.candle < cost) { log(run, '촛불이 모자라요. 발파는 촛불 ' + cost); fx(run, { t: 'locked', x: x, y: y }); return { ok: false, short: true }; }
    d.face = { dx: sgn(x - d.px), dy: sgn(y - d.py) };
    if (run.record) { if (classify(run, c) === 'knownM') d.rec.blastSure++; else d.rec.blastBet++; }
    beginAct(run, x, y);
    spendCandle(run, cost);
    d.stats.blasts++; run.stats.blasts++;
    // 점화 대상: 긴 도화선이면 맞닿은 X 묶음
    var seeds = [c];
    if (owns(run, 'fuse')) {   // 긴 도화선: 두 걸음 안의 X 칸에 함께 불이 붙는다(이어서 번진다)
      var seen = {}; seen[idx(c)] = 1; var q = [c];
      while (q.length) { var p = q.shift(); f.cells.forEach(function (n) { if (!seen[idx(n)] && covered(n) && n.mark === 1 && cheb(n.x, n.y, p.x, p.y) <= 2) { seen[idx(n)] = 1; seeds.push(n); q.push(n); } }); }
      if (seeds.length > 1) fx(run, { t: 'proc', id: 'fuse', icon: 'fuse', label: 'X ' + seeds.length + '칸 점화' });
    }
    // 터지는 지뢰 집합(연쇄)
    var boom = [], bseen = {}, fizz = [];
    var queue = [];
    seeds.forEach(function (s) { if (s.haz === 'mine' && !s.removed) { if (!bseen[idx(s)]) { bseen[idx(s)] = 1; queue.push({ c: s, k: 0 }); } } else fizz.push(s); });
    while (queue.length) {
      var e = queue.shift(); boom.push(e);
      neighbors(f, e.c.x, e.c.y).forEach(function (n) { if (n.haz === 'mine' && !n.removed && !bseen[idx(n)]) { bseen[idx(n)] = 1; queue.push({ c: n, k: e.k + 1 }); } });
    }
    var tongs = owns(run, 'tongs'), moon = owns(run, 'moontongs');
    f.xOk = (f.xOk || 0) + boom.filter(function (e) { return e.c.mark === 1; }).length;
    f.xBad = (f.xBad || 0) + fizz.length;
    fizz.forEach(function (s) {
      judgeX(run, s); s.mark = 0; s.fizzle = true;
      var label = s.haz === 'chunk' ? TEXT.chunk.fizzle : (s.haz === 'treasure' && CONFIG.fizzle === 'melt' && !tongs) ? TEXT.fizzle.melt : s.haz === 'treasure' ? '' : TEXT.fizzle.empty.replace('{n}', cost);
      fx(run, { t: 'fizzle', x: s.x, y: s.y, text: label });
    });
    if (CONFIG.fizzle === 'melt' && !tongs) {   // 불이 닿은 보물은 녹아 없어진다(칸이 열리고 둘레 숫자가 준다)
      fizz.forEach(function (s) {
        if (s.haz !== 'treasure') return;
        openRaw(run, s, 0); s.removed = true; s.melted = true; d.stats.melted = (d.stats.melted || 0) + 1;
        hazardRemoved(run, s); if (numAt(f, s) === 0) chainFrom(run, s);
        if (s.box) { f.box.state = 'melted'; log(run, TEXT.box.melt, 'bad'); fx(run, { t: 'boxMelt', x: s.x, y: s.y }); }
        else log(run, TEXT.fizzle.meltName.replace('{name}', TREASURE_NAMES[s.tier]), 'bad');
        if (!run.meltSeen) { run.meltSeen = true; log(run, TEXT.fizzle.meltFirst); }
      });
    }
    if (tongs && fizz.length) {   // 해체 집게: 불발 칸을 그냥 깬다(촛불 1, 점화 촛불은 돌려받음)
      if (cost) addCandle(run, moon && !boom.length ? cost : Math.max(0, cost - fizz.length));   // 달빛 집게: 다 불발이면 촛불이 안 들어요
      fx(run, { t: 'proc', id: moon ? 'moontongs' : 'tongs', icon: moon ? 'moontongs' : 'tongs', label: moon ? '제값으로 꺼냄' : '불발 칸 깨기' });
      fizz.forEach(function (s) { d.stats.breaks++; if (moon) s.fizzle = false; resolveBreak(run, s, { direct: true, mark: 0 }); s.fizzle = false; });
    }
    if (!boom.length) {
      if (!tongs && !fizz.some(function (s) { return s.melted; })) log(run, fizz.some(function (s) { return s.haz === 'chunk'; }) ? TEXT.chunk.fizzle : '지뢰가 아니었어요(불발). 촛불 ' + cost + '만 탔어요. 칸에 "지뢰 아님"이 남아요.', 'bad');
      endAct(run); return { ok: true, mines: 0 };
    }
    var bev = emit(run, 'on_blast', { mines: boom.length, scorch: true });
    var range = {}, inRange = [];
    boom.forEach(function (e) {
      var m = e.c; judgeX(run, m); m.removed = true; m.scorch = true; m.mark = 0; openRaw(run, m, e.k);
      fx(run, { t: 'boom', x: m.x, y: m.y, delay: 120 * e.k, blast: true });
      neighbors(f, m.x, m.y).forEach(function (n) { if (!range[idx(n)] && covered(n) && !bseen[idx(n)]) { range[idx(n)] = 1; inRange.push({ c: n, k: e.k }); } });
    });
    var scorched = 0;
    inRange.forEach(function (e) {
      var n = e.c;
      if (n.mark === 1 && n.haz !== 'mine') f.xBad = (f.xBad || 0) + 1;
      if (n.haz === 'chunk' && !n.removed) return;   // 덩이는 단단해서 남는다
      if (n.haz === 'treasure' && !n.removed) {
        openRaw(run, n, e.k + 1); n.removed = true;
        if (bev.scorch) scorched++;
        d.stats.floorT++; f.treasuresDug++; orderEvent(run, 'floorT');
        if (n.box) { gainBox(run, n, { scorch: bev.scorch }); return; }
        if (n.tier === 2) { d.stats.gems++; orderEvent(run, 'gem'); }
        gainTreasure(run, n.x, n.y, CONFIG.treasureValue[n.tier], { tier: n.tier, scorch: bev.scorch });
      } else if (!liveHaz(n)) {
        openRaw(run, n, e.k + 1); run.act.gravel += cellRes(n); run.act.chainCount++;
      }
    });
    boom.forEach(function (e) { d.stats.blastMines++; emit(run, 'on_blast_mine', { x: e.c.x, y: e.c.y, n: boom.length }); orderEvent(run, 'blastMine'); });
    if (boom.length >= 3) orderEvent(run, 'blastChain');
    if (!scorched) orderEvent(run, 'cleanBlast');   // 그을린 발파는 세지 않을 뿐 실패는 아니다
    // 열린 칸과 지뢰 둘레 숫자로 와르르
    boom.forEach(function (e) { hazardRemoved(run, e.c); });
    inRange.forEach(function (e) { if (e.c.cover === 'open' && !e.c.haz && numAt(f, e.c) === 0) chainFrom(run, e.c); });
    log(run, '지뢰 ' + boom.length + '개를 터뜨렸어요.' + (scorched ? ' 보물 ' + scorched + '개가 그을렸어요(반값).' : '') + (fizz.length && !tongs ? ' 불발 ' + fizz.length + '칸.' : ''), 'good');
    run.act.stop = CONFIG.fx.mineStop;
    endAct(run);
    return { ok: true, mines: boom.length, scorched: scorched };
  }
  function useCons(run, slot, tx, ty) {
    var d = run.d;
    if (!canAct(run)) return { ok: false };
    var a = run.cons[slot]; if (!a) return { ok: false };
    var ok = false;
    if (a.id === 'match') { if (!d.embersOn) { log(run, '성냥은 촛불이 꺼진 뒤에만 켤 수 있어요.'); return { ok: false }; } addCandle(run, CONFIG.matchCandle); log(run, '성냥 묶음. 촛불 +' + CONFIG.matchCandle + '. 다시 불이 붙었어요.'); ok = true; }
    else if (a.id === 'powder') { var t = tx != null ? { x: tx, y: ty } : { x: d.px + d.face.dx, y: d.py + d.face.dy }; var r = ignite(run, t.x, t.y, true); ok = r.ok; }
    if (ok) { a.n--; if (a.n <= 0) run.cons.splice(slot, 1); }
    return { ok: ok };
  }
  function pathTo(run, tx, ty) {
    var d = run.d, f = d.floor, start = cellAt(f, d.px, d.py), prev = {}, q = [start];
    prev[idx(start)] = -1;
    while (q.length) {
      var c = q.shift();
      if (c.x === tx && c.y === ty) { var p = [], k = idx(c); while (k !== -1) { p.unshift(k); k = prev[k]; } return p; }
      var nb = neighbors(f, c.x, c.y);
      for (var i = 0; i < nb.length; i++) if (!(idx(nb[i]) in prev) && walkable(f, nb[i])) { prev[idx(nb[i])] = idx(c); q.push(nb[i]); }
    }
    return null;
  }
  function travelTo(run, x, y) {
    if (!canAct(run)) return { ok: false };
    var p = pathTo(run, x, y); if (!p) return { ok: false };
    var d = run.d;
    if (p.length >= 2) { var a = p[p.length - 2], b = p[p.length - 1]; d.face = { dx: sgn(b % W - a % W), dy: sgn(Math.floor(b / W) - Math.floor(a / W)) }; }
    d.px = x; d.py = y;
    return { ok: true, steps: p.length - 1 };
  }
  function approach(run, x, y) {
    if (!canAct(run)) return { ok: false };
    var d = run.d, f = d.floor;
    if (cheb(d.px, d.py, x, y) === 1) { d.face = { dx: sgn(x - d.px), dy: sgn(y - d.py) }; return { ok: true, steps: 0 }; }
    var start = cellAt(f, d.px, d.py), seen = {}, q = [start]; seen[idx(start)] = 1;
    while (q.length) {
      var c = q.shift();
      if (cheb(c.x, c.y, x, y) === 1) { d.px = c.x; d.py = c.y; d.face = { dx: sgn(x - c.x), dy: sgn(y - c.y) }; return { ok: true }; }
      var nb = neighbors(f, c.x, c.y);
      for (var i = 0; i < nb.length; i++) if (!seen[idx(nb[i])] && walkable(f, nb[i])) { seen[idx(nb[i])] = 1; q.push(nb[i]); }
    }
    return { ok: false };
  }
  function onStair(run) { var d = run.d; if (!d || !d.floor || !d.floor.stair || d.floor.stair.blocked) return false; return d.px === d.floor.stair.x && d.py === d.floor.stair.y && d.floor.stair.found; }
  function travelCost(run, depth) { return Math.max(1, CONFIG.travelBase + depth - (gang(run, 'deep') ? 1 : 0) + keepSum(run, 'travel')); }

  // 갈림길(R3): 다음 층 광맥 둘 중 하나. 가끔 샘·상인 방
  function forkOptions(run, depth) {
    var d = run.d, rng = rngFrom(hashSeed(run.seed, run.day, depth, d.floorIdx, 9));
    d.forkCount++;
    var chunkHere = d.chunkSpec && d.chunkSpec.depth === depth && !d.chunkDone;
    var opts;
    var tl = run.tutorial && TUTORIAL.later[run.day + '-' + depth];
    if (run.tutorial && run.day === 1 && TUTORIAL.floors[depth] && TUTORIAL.floors[depth].options) opts = TUTORIAL.floors[depth].options.slice();
    else if (tl && tl.options) opts = tl.options.slice();
    else {
      var PL = poolList(run);
      var pool = chunkHere ? CHUNK_RULES.filter(function (r) { return !PL || PL.indexOf(r) >= 0; }) : rulePoolFor(run, depth, twinDay(run));
      if (!pool.length) pool = CHUNK_RULES.slice();   // 덩이 층에 맞는 광맥이 풀에 없으면 덩이 층 광맥 셋에서
      if (chunkHere && twinDay(run)) pool = pool.filter(function (r) { return !(CONFIG.twinBoth && r === 'lonely'); });
      opts = drawRules(pool, rng, 2);
    }
    // 갈림길 덤(R42): 카드마다 하나. 그날 방이 붙는 갈림길이면 한 장의 덤이 샘·상인 방
    var room = d.roomForks[d.forkCount];
    var bpool = shuffle(CONFIG.forkBonus.pool.slice(), rng), fixedB = run.tutorial && run.day === 1 && TUTORIAL.floors[depth] && TUTORIAL.floors[depth].bonus;
    var list = opts.map(function (r, i) { var b = !feat('forkBonus') ? null : fixedB ? fixedB[r] : bpool[i % bpool.length]; return { kind: 'floor', rule: r, depth: depth, chunk: chunkHere, bonus: b }; });
    if (room && !chunkHere && list.length) list[Math.floor(rng() * list.length)].bonus = room;
    list.forEach(function (o) { o.est = floorEstimate(run, depth, o.rule, o.bonus); });
    return list;
  }
  function descend(run, optIdx) {
    if (!canAct(run) || run.d.embersOn) return { ok: false };
    var d = run.d, f = d.floor;
    if (!onStair(run)) return { ok: false };
    var o = f.forkOptions[optIdx]; if (!o) return { ok: false };
    var cost = travelCost(run, o.depth);
    if (d.candle < cost) { log(run, '촛불이 모자라요. 지하 ' + o.depth + '층까지 촛불 ' + cost + '.'); return { ok: false, short: true }; }
    if (f.chunk && !f.chunk.done && f.chunk.dug > 0) d.lastLeftChunk = true;
    spendCandle(run, cost);
    emit(run, 'on_floor_leave', { depth: f.depth, reason: 'descend' });
    judgeFloorX(run);
    var roomKind = o.kind !== 'floor' ? o.kind : (o.bonus === 'spring' || o.bonus === 'merchant') ? o.bonus : null;
    if (!roomKind) { log(run, '지하 ' + o.depth + '층 · ' + RULES[o.rule].name + '.'); enterFloor(run, o.depth, o.rule, d.px, d.py, o.bonus); }
    else {   // 덤 '가는 길에 샘·상인 방': 방에 들렀다가 카드의 광맥 층으로(01 8.3)
      run.room = { kind: roomKind, next: o.depth, rule: o.kind === 'floor' ? o.rule : 'plain', x: d.px, y: d.py, serviced: false };
      if (roomKind === 'merchant') { run.room.stock = pickStock(run, 3, 1, true); run.room.sold = {}; }
      run.phase = 'room';
      log(run, roomKind === 'spring' ? '샘이 있는 방이에요.' : '상인 방이에요. 상인 심 씨가 물건을 펼쳐 놨어요.');
    }
    if (d.candle <= 0 && run.phase === 'mine') { beginAct(run, d.px, d.py); endAct(run); }
    return { ok: true, kind: roomKind || 'floor' };
  }
  function springChoose(run, kind) {
    if (run.phase !== 'room' || run.room.kind !== 'spring') return { ok: false };
    var d = run.d;
    if (kind === 'hp') { if (d.hp >= d.hpMax) return { ok: false, full: true }; d.hp = Math.min(d.hpMax, d.hp + CONFIG.spring.hp); log(run, '샘물을 마셨어요. 체력 +1.'); }
    else { addCandle(run, CONFIG.spring.candle); log(run, '심지를 말렸어요. 촛불 +' + CONFIG.spring.candle + '.'); }
    return leaveRoom(run);
  }
  function merchantService(run) {
    var S = CONFIG.shop.merchantService;
    if (run.phase !== 'room' || run.room.kind !== 'merchant' || run.room.serviced || run.cash < servicePrice(run)) return { ok: false };
    run.cash -= servicePrice(run); run.room.serviced = true; addCandle(run, S.candle);
    log(run, '촛불 손질. 촛불 +' + S.candle + '.');
    return { ok: true };
  }
  function leaveRoom(run) {
    if (run.phase !== 'room') return { ok: false };
    var r = run.room; run.room = null; run.phase = 'mine';
    log(run, '지하 ' + r.next + '층 · ' + RULES[r.rule || 'plain'].name + '.');
    enterFloor(run, r.next, r.rule || 'plain', r.x, r.y);
    return { ok: true };
  }
  function returnUp(run) {
    if (run.phase !== 'mine' && run.phase !== 'room') return { ok: false };
    if (run.phase === 'room') { run.room = null; run.phase = 'mine'; }
    log(run, run.d.candle > 0 ? '버린 촛불 ' + run.d.candle + ' · 금고 +' + fmt(run.d.pocket) : '올라왔어요. 금고 +' + fmt(run.d.pocket));   // 02 6.8 (숫자 뒤 조사 없음)
    endDay(run, 'return');
    return { ok: true };
  }

  // ---------- 주문 ----------
  function orderEvent(run, kind, data) {
    var o = run.order; if (!o || o.done || o.failed || !run.d) return;
    var d = run.d, id = o.id, def = ORDER_BY_ID[id];
    var inc = 0, setTo = null;
    if (id === 'blast4' && kind === 'blastMine') inc = 1;
    if (id === 'chain3' && kind === 'blastChain') inc = 1;
    if (id === 'clean3' && kind === 'cleanBlast') inc = 1;
    if (id === 'streak3' && kind === 'streak' && CONFIG.streakLadder[d.streak] >= 3) inc = 1;
    if (id === 'deepStreak' && kind === 'depth' && data.depth >= 4 && streakMult(run) >= 2) inc = 1;
    if (id === 'chalkO' && kind === 'chalkO') inc = 1;
    if (id === 'bigNum' && kind === 'bigNum') inc = 1;
    if (id === 'chain20' && kind === 'chain20') inc = 1;
    if (id === 'floor5' && kind === 'floorT') setTo = d.stats.floorT;
    if (id === 'xRight' && kind === 'xJudge') { if (data.bad) { o.failed = true; return; } inc = data.ok || 0; }
    if (id === 'reach5' && kind === 'depth' && data.depth >= 5) inc = 1;
    if (id === 'noProbe' && kind === 'noProbeT') setTo = d.stats.noProbeT;
    if (id === 'emberT' && kind === 'emberT') inc = 1;
    if (id === 'gems2' && kind === 'gem') inc = 1;
    if (id === 'noMine' && kind === 'dayEnd' && d.stats.dugT >= 4) inc = 1;   // 치기로 지뢰를 안 터뜨리고 보물 4개 이상(쓰러지면 실패)
    if (id === 'keep20' && kind === 'dayEnd' && data.reason === 'return' && data.candle > 20 && data.depth >= 4) inc = 1;
    if (setTo != null) o.prog = Math.max(o.prog, setTo); else o.prog += inc;
    if (o.prog >= def.goal) completeOrder(run);
  }
  function orderPocket(run, v) { return Math.floor(v * stage(run).valueMul); }   // 주문 주머니 보상에도 시세가 붙는다(01 11.3)
  function orderFail(run, id) { if (run.order && run.order.id === id && !run.order.done) run.order.failed = true; }
  // 분필 X 채점(01 3.6): 정체가 밝혀질 때. 두드려 보기가 그어 준 X, 첫 판에 미리 그어 둔 X는 '내가 그은 X'가 아니다
  function judgeX(run, c) {
    if (c.mark !== 1 || c.givenX || !run.d) return;
    var ok = c.haz === 'mine';
    if (ok) run.d.xOk++; else run.d.xBad++;
    orderEvent(run, 'xJudge', ok ? { ok: 1 } : { bad: 1 });
  }
  function judgeFloorX(run) { var f = run.d && run.d.floor; if (!f) return; f.cells.forEach(function (c) { if (c.cover !== 'open' && c.mark === 1) { judgeX(run, c); c.givenX = true; } }); }
  function completeOrder(run) {
    var o = run.order, def = ORDER_BY_ID[o.id], R = def.reward, d = run.d;
    o.done = true; o.prog = def.goal;
    var txt = '';
    if (R.pocket) { var pk = orderPocket(run, R.pocket); d.pocket += pk; d.pocketLines.order += pk; txt = '주머니 +' + pk; fx(run, { t: 'gain', x: d.px, y: d.py, base: pk, mult: 1, bonus: 0, total: pk, label: '주문', order: true }); }
    if (R.candle) { addCandle(run, R.candle); txt = '촛불 +' + R.candle; }
    if (R.cons) { var got = giveCons(run, R.cons, R.n); txt = TOOL_BY_ID[R.cons].name + ' ' + got + '개'; }
    log(run, '주문 달성: ' + def.text + ' → ' + txt, 'good');
    fx(run, { t: 'order', text: txt });
  }
  function giveCons(run, id, n) {
    var got = 0;
    for (var k = 0; k < n; k++) {
      var s = consSlotFor(run, id); if (s < 0) break;
      if (s === run.cons.length) run.cons.push({ id: id, n: 0 });
      run.cons[s].n++; got++;
    }
    return got;
  }
  function consSlotFor(run, id) {
    for (var i = 0; i < run.cons.length; i++) if (run.cons[i].id === id && run.cons[i].n < CONFIG.shop.stack) return i;
    return run.cons.length < CONFIG.shop.consSlots ? run.cons.length : -1;
  }

  // ---------- 하루 끝 / 정산 / 납부 ----------
  function endDay(run, reason) {
    var d = run.d;
    if (run.phase === 'settle') return;
    d.endReason = reason;
    judgeFloorX(run);
    if (reason !== 'collapse') orderEvent(run, 'dayEnd', { reason: reason, candle: d.candle, depth: d.floor.depth });
    emit(run, 'on_floor_leave', { depth: d.floor.depth, reason: reason });
    emit(run, 'on_day_end', { reason: reason });
    var lossRate = reason === 'collapse' ? (gang(run, 'idle') ? 0.25 : keepWith(run, 'collapseLoss') ? keepWith(run, 'collapseLoss').collapseLoss : CONFIG.collapseLoss) : 0;
    var lost = Math.floor(d.pocket * lossRate);
    var gross = d.pocket, net = gross - lost;
    if (reason === 'collapse') run.stats.collapses++;
    var before = run.cash;
    run.cash += net; run.stats.earned += net;
    var pay = paymentFor(run.day, run);
    var quote = null;
    if (reason === 'collapse') quote = (d.embersOn ? TEXT.collapseEmber : pick(TEXT.collapse, run.metaRng)).replace('{n}', fmt(lost));
    var np = nextPayment(run), line = '';
    if (np) {
      var short = np.amount - run.cash;
      if (d.chunkSpec && !d.chunkDone && (d.lastLeftChunk || (d.floor.chunk && d.floor.chunk.dug > 0))) line = TEXT.dayEnd.chunkLeft;
      else if (d.stats.emberT > 0) line = TEXT.dayEnd.emberT.replace('{n}', d.stats.emberT);
      else if (short <= 0) line = TEXT.dayEnd.over.replace('{pay}', np.name);
      else if (np.day === run.day + 1) line = TEXT.dayEnd.eve.replace('{short}', fmt(short));
      else line = TEXT.dayEnd.normal.replace('{n}', fmt(net)).replace('{pay}', np.name).replace('{short}', fmt(short));
      if (np.day === run.day && pay) line = '';
    }
    run.history.push({ day: run.day, income: net, gross: gross, collapsed: reason === 'collapse', depth: d.stats.depth, stats: d.stats, reason: reason,
                      candleLeft: d.candle, rec: run.record ? Object.assign({}, d.rec) : null });
    run.settle = { day: run.day, reason: reason, lines: Object.assign({}, d.pocketLines), gross: gross, lost: lost, net: net, before: before, after: run.cash,
                   quote: quote, line: line, floors: d.floorsVisited.slice(), ember: d.embersOn, chunkDone: d.chunkDone, payDay: !!pay };
    run.phase = 'settle';
    run.room = null;
  }
  function afterSettle(run) {
    if (run.phase !== 'settle' || run.boxOffer) return { ok: false };
    var pay = paymentFor(run.day, run);
    if (pay) {
      var i = paymentIndex(pay, run), ok = run.cash >= pay.amount;
      var P = { idx: i, name: pay.name, amount: pay.amount, ok: ok, before: run.cash, short: Math.max(0, pay.amount - run.cash) };
      run.payment = P;
      run.phase = 'payment';
      if (ok) completePay(run);
      else if (canRescue(run)) { P.pending = true; P.quote = TEXT.short.quote.replace('{short}', fmt(P.short)); }   // 오늘 밤 안에 도구를 팔거나 심 씨에게 빌려 채울 수 있어요
      else failPay(run);
      return { ok: true, payment: true };
    }
    openShop(run);
    return { ok: true };
  }
  // 도장 찍기(금고가 넉넉할 때). 모자랐다가 채운 경우에도 여기로 와요
  function completePay(run) {
    var P = run.payment, i = P.idx, pay = pays(run)[i - 1], rng = rngFrom(hashSeed(run.seed, run.day, 3));
    P.ok = true; P.pending = false; P.before = run.cash; P.short = 0;
    run.cash -= pay.amount; run.paid += pay.amount; run.stamps++;
    P.after = run.cash;
    var mulNext = stage(run).valueMul;   // 도장이 찍힌 뒤의 시세(내일부터)
    P.quote = pick((pays(run).length === 5 ? TEXT.pay5 : TEXT.pay)[i].ok, rng).replace('{amt}', fmt(pay.amount)).replace('{left}', fmt(run.cash)).replace('{mul}', mulNext);
    var np = pays(run)[i];
    if (np) {
      var muts = (run.mutationPlan[np.day] || []).slice();
      P.next = { name: np.name, amount: np.amount, day: np.day, mutations: muts };
      P.fixed = [pays(run).length === 5 ? TEXT.payFixed.stamp2.replace('{n}', run.stamps).replace('{change}', stageChangeText(run)) : TEXT.payFixed.stamp.replace('{n}', run.stamps).replace('{mul}', mulNext),
                 (muts.length > 1 ? TEXT.payFixed.next2 : muts.length ? TEXT.payFixed.next1 : TEXT.payFixed.next0).replace('{name}', stampNames(run)[i]).replace('{amt}', fmt(np.amount)).replace('{day}', np.day)];
      if (P.loanTaken) P.fixed.push(TEXT.short.loanLine.replace('{n}', fmt(P.loanTaken)));
    }
    return { ok: true };
  }
  function failPay(run) {
    var P = run.payment, rng = rngFrom(hashSeed(run.seed, run.day, 3));
    P.ok = false; P.pending = false; P.short = Math.max(0, P.amount - run.cash); P.before = run.cash; P.after = run.cash;
    P.quote = pick((pays(run).length === 5 ? TEXT.pay5 : TEXT.pay)[P.idx].fail, rng).replace('{short}', fmt(P.short));
  }
  function loanInfo(run) {   // 심 씨 외상: 한 판에 한 번, 마지막 도장은 안 돼요. 모자란 돈을 받고 다음 도장에 1.5배를 함께 내요
    var P = run.payment;
    if (!feat('loan') || !P || !P.pending) return null;
    var short = Math.max(0, P.amount - run.cash);
    return { short: short, repay: Math.ceil(short * CONFIG.relic.loanMul / 10) * 10, used: run.loanUsed, last: P.idx >= pays(run).length,
             ok: !run.loanUsed && P.idx < pays(run).length && short > 0 };
  }
  function canRescue(run) {
    var P = run.payment, sellable = feat('toolSell') && run.owned.some(function (id) { return canRemove(run, id, false); });
    var loan = feat('loan') && !run.loanUsed && P.idx < pays(run).length;
    return sellable || loan;
  }
  function takeLoan(run) {
    var L = loanInfo(run); if (!L || !L.ok) return { ok: false };
    var P = run.payment;
    run.cash += L.short; run.loanUsed = true;
    var np = pays(run)[P.idx]; np.amount += L.repay;
    run.loan = { amount: L.repay, day: np.day }; P.loanTaken = L.repay;
    log(run, TEXT.short.loanLine.replace('{n}', fmt(L.repay)));
    completePay(run);
    return { ok: true, repay: L.repay };
  }
  function payNow(run) {   // 도구를 팔아 금고가 찼으면 도장을 찍어요
    var P = run.payment; if (run.phase !== 'payment' || !P || !P.pending || run.cash < P.amount) return { ok: false };
    return completePay(run);
  }
  function afterPayment(run) {
    if (run.phase !== 'payment') return { ok: false };
    var P = run.payment;
    if (P.pending) { if (run.cash >= P.amount) completePay(run); else { failPay(run); return finish(run, false); } }
    if (!P.ok) return finish(run, false);
    if (run.day >= CONFIG.days || run.stamps >= pays(run).length) return finish(run, true);
    if (feat('stampReward')) {   // 도장 선물: 셋 중 하나 또는 금고 돈
      run.giftOpts = rewardOpts(run); run.giftCash = CONFIG.stampReward.cash[Math.min(run.stamps, CONFIG.stampReward.cash.length) - 1] || 0;
      run.giftDone = false; run.giftNext = 'shop'; run.giftKind = 'stamp'; run.phase = 'gift';
      return { ok: true, reward: true };
    }
    openShop(run);
    return { ok: true };
  }
  // 계약 해지 화면 비교 한 줄(02 6.2): 해지된 납부 구간의 수입과 그 납부를 낸 판의 평균
  function voidCompare(run, P) {
    var PP = pays(run), i = P && P.idx ? P.idx : Math.min(PP.length, run.stamps + 1), from = i === 1 ? 1 : PP[i - 2].day + 1, to = PP[i - 1].day;
    var inc = run.history.filter(function (h) { return h.day >= from && h.day <= to; }).reduce(function (a, h) { return a + h.income; }, 0);
    var name = stampNames(run)[i - 1], avg = CONFIG.voidCompare[i] || 0;
    var line = from + '~' + to + '일째 수입 ' + fmt(inc) + ' · ' + name + '을 찍은 판의 평균 ' + fmt(avg);
    if (i >= 2 && i < PP.length) line += ' · 산 도구 ' + Object.keys(run.paidFor).filter(function (k) { return run.paidFor[k] > 0; }).length + '개';
    if (i === PP.length) line += ' · 큰 덩이 ' + (run.stats.chunks || 0) + '개';
    return line;
  }
  function finish(run, success) {
    var rng = rngFrom(hashSeed(run.seed, 99));
    var P = run.payment;
    run.final = { success: success, score: success ? run.cash : 0, cash: run.cash, stamps: run.stamps, day: run.day,
                  short: P ? P.short : 0,
                  compare: success ? null : voidCompare(run, P),
                  body: success ? null : [TEXT.voidBody[0], run.stamps > 0 ? TEXT.voidBody[1] : null, TEXT.voidBody[2]].filter(Boolean).map(function (s) { return s.replace('{day}', run.day).replace('{short}', fmt(P ? P.short : 0)).replace('{n}', run.stamps).replace('{total}', pays(run).length); }) };
    run.phase = 'final';
    return { ok: true, final: true };
  }

  // ---------- 상점 ----------
  function pickStock(run, nTools, nCons, merchant) {
    var rng = run.metaRng;
    var avail = toolPool().filter(function (t) { return t.kind === 'passive' && !owns(run, t.id); });
    var tools = [];   // 희귀도 가중치로 겹치지 않게 뽑는다(05 5.1)
    while (tools.length < nTools && avail.length) {
      var k = weightedIdx(rng, avail.map(function (t) { return CONFIG.shop.rarityWeight[t.rarity] || 1; }));
      tools.push(avail[k].id); avail.splice(k, 1);
    }
    var cons = shuffle(toolPool().filter(function (t) { return t.kind === 'consumable'; }).map(function (t) { return t.id; }), rng).slice(0, nCons);
    return tools.concat(cons);
  }
  function openShop(run) {
    var stock;
    if (run.tutorial && run.day === 1) stock = CONFIG.tutorialShopDay1.slice();   // R50
    else stock = pickStock(run, CONFIG.shop.tools, CONFIG.shop.cons, false);
    run.shop = { stock: stock, sold: {}, rerolls: 0, fuse: fusionsReady(run) };
    run.phase = 'shop';
  }
  function priceOf(run, id, merchant) {   // 도구 값은 판 내내 같다(시세가 붙지 않는다). 05 5.1
    var t = TOOL_BY_ID[id];
    return Math.round(t.price * (merchant ? 1 - CONFIG.shop.merchantDiscount : 1) / 10) * 10;
  }
  function rerollPrice(run) { return CONFIG.shop.reroll; }
  function servicePrice(run) { return CONFIG.shop.merchantService.price; }
  function buy(run, slot) {
    var merchant = run.phase === 'room' && run.room && run.room.kind === 'merchant';
    if (run.phase !== 'shop' && !merchant) return { ok: false };
    var S = merchant ? run.room : run.shop, id = S.stock[slot];
    if (!id || S.sold[slot]) return { ok: false };
    var t = TOOL_BY_ID[id], price = priceOf(run, id, merchant);
    if (run.cash < price) return { ok: false, poor: true };
    if (t.kind === 'passive') {
      if (owns(run, id)) return { ok: false };
      if (run.owned.length >= slotsOf(run)) { log(run, feat('sellBack') || feat('toolSell') ? '도구 칸이 가득이에요. 하나 팔아서 비우세요.' : '도구 칸이 가득이에요.'); return { ok: false, full: true }; }
    } else if (consSlotFor(run, id) < 0) { log(run, '한 번 쓰는 물건을 더 넣을 칸이 없어요.'); return { ok: false, full: true }; }
    run.cash -= price;
    S.sold[slot] = true;
    if (t.kind === 'passive') addTool(run, id, price);
    else giveCons(run, id, 1);
    return { ok: true, price: price };
  }
  // 팔 값: v2.1은 산 값의 절반(선물은 0). v22는 상점 값의 50%(곽 씨에게 판 위에서 넘기면 25%), 심 씨 단골 장부가 있으면 +25%
  function toolValue(run, id, where) {
    var R = CONFIG.relic, rate = (where === 'site' ? R.sellSite : R.sellShop) + (owns(run, 'regular') ? R.sellBonus : 0);
    return Math.floor(TOOL_BY_ID[id].price * rate / 10) * 10;
  }
  function sellPrice(run, id) {
    if (feat('toolSell')) return toolValue(run, id, 'shop');
    return Math.floor((run.paidFor[id] != null ? run.paidFor[id] : TOOL_BY_ID[id].price) * CONFIG.shop.sellBack / 10) * 10;   // 선물로 받은 도구는 0
  }
  function sellBack(run, id) {
    var payPending = run.phase === 'payment' && run.payment && run.payment.pending;
    if ((run.phase !== 'shop' && !payPending) || run.owned.indexOf(id) < 0 || !(feat('sellBack') || feat('toolSell'))) return { ok: false };
    if (!canRemove(run, id, false)) return { ok: false, belt: true };
    var v = sellPrice(run, id);
    run.cash += v; removeTool(run, id); run.stats.sold++;
    if (run.shop) run.shop.fuse = fusionsReady(run);
    return { ok: true, cash: v };
  }
  // ---------- 도구 넣고 빼기 ----------
  function addTool(run, id, paid) {
    var t = TOOL_BY_ID[id];
    run.owned.push(id); run.paidFor[id] = paid || 0;
    if (run.d) (t.fusion || []).concat([id]).forEach(function (k) { var q = TOOL_BY_ID[k]; if (q.hooks && q.hooks.on_day_start) q.hooks.on_day_start.call(q, toolCtx(run, q), {}); });   // 오늘 하루 한 번짜리도 바로 준비
  }
  function removeTool(run, id) { var k = run.owned.indexOf(id); if (k >= 0) run.owned.splice(k, 1); delete run.paidFor[id]; if (run.boxed) delete run.boxed[id]; }
  function canRemove(run, id, adding) {   // 넓은 연장 띠를 빼면 칸이 줄어요. 남은 도구가 칸에 들어가야 해요
    if (run.owned.indexOf(id) < 0) return false;
    if (id !== 'belt') return true;
    return run.owned.length - 1 + (adding ? 1 : 0) <= CONFIG.shop.passiveSlots;
  }
  // ---------- 판 위 옛 연장함 ----------
  function placeBox(run, f, depth) {
    var d = run.d, R = CONFIG.relic;
    if (!feat('relicBox') || f.tutorial || (d.stats.boxes || 0) > 0 || d.chunkSpec || depth < R.minDepth || run.day < R.minDay) return;   // 하루에 하나 캘 때까지 층마다 확률로 묻혀요
    var rng = rngFrom(hashSeed(run.seed, run.day, d.floorIdx, 0x424f58));
    var pity = run.day >= R.pityDay && !run.stats.boxes;   // 둘째 도장 날까지 하나도 못 주웠으면 다음 층에 꼭
    if (!pity && rng() >= R.chance) return;
    var T = f.cells.filter(function (c) { return c.haz === 'treasure' && !c.removed && covered(c) && !c.chunk && !c.mark; });
    if (!T.length) return;
    var c = T[Math.floor(rng() * T.length)];
    c.box = true; f.box = { x: c.x, y: c.y, state: 'buried' };
    log(run, TEXT.box.arrive, 'good'); fx(run, { t: 'boxHere' });
  }
  // 바랜 분필 자국: 앞서 다녀간 광부가 남긴 X(지뢰)와 O(보물). 늘 맞고, 지우거나 바꿀 수 없어요
  function placeFaded(run, f) {
    if (!feat('fadedChalk') || f.tutorial) return;
    var d = run.d, P = keepWith(run, 'faded') ? keepWith(run, 'faded').faded : CONFIG.fadedChalk, rng = rngFrom(hashSeed(run.seed, run.day, d.floorIdx, 0x46414445));
    var nO = P.o[Math.floor(rng() * P.o.length)], nX = P.x[Math.floor(rng() * P.x.length)], n = 0;
    function pick(list, k, m) {
      for (var i = 0; i < k && list.length; i++) { var j = Math.floor(rng() * list.length), c = list.splice(j, 1)[0]; c.mark = m; c.faded = m; if (m === 1) c.givenX = true; n++; }
    }
    pick(f.cells.filter(function (c) { return c.haz === 'treasure' && !c.removed && covered(c) && !c.chunk && !c.box && !c.mark; }), nO, 2);
    pick(f.cells.filter(function (c) { return c.haz === 'mine' && !c.removed && covered(c) && !c.mark; }), nX, 1);
    if (n && !run.fadedSeen) { run.fadedSeen = true; log(run, TEXT.faded.first, 'good'); }
  }
  function boxOpts(run, n, rng) {
    var avail = toolPool().filter(function (t) { return t.kind === 'passive' && !owns(run, t.id); }), out = [], W = CONFIG.relic.rarity;
    while (out.length < n && avail.length) { var j = weightedIdx(rng, avail.map(function (t) { return W[t.rarity] || 1; })); out.push(avail[j].id); avail.splice(j, 1); }
    return out;
  }
  function gainBox(run, c, o) {
    var d = run.d, f = d.floor;
    if (f.box) f.box.state = 'dug';
    run.stats.boxes++; d.stats.boxes = (d.stats.boxes || 0) + 1;
    curFloorRec(run).box = true;
    if (!o.scorch) streakUp(run, 1 + (o.extraStep || 0));   // 보물처럼 콤보가 올라요(그을리면 안 올라요). 돈은 없어요
    var rng = rngFrom(hashSeed(run.seed, run.day, d.floorIdx, 0x4f505453));
    var kAvail = KEEPSAKES.filter(function (k) { return (run.keeps || []).indexOf(k.id) < 0; });
    if (feat('keepsake') && !o.scorch && kAvail.length && rng() < CONFIG.keepsake.share) {   // 가끔은 도구 대신 유품 하나
      run.boxOffer = { keep: kAvail[Math.floor(rng() * kAvail.length)].id, opts: [], scorch: false, quote: TEXT.keep.kwak };
      fx(run, { t: 'box', x: c.x, y: c.y, scorch: false, keep: true });
      log(run, TEXT.keep.dug, 'good');
      if (run.act) run.act.stop = Math.max(run.act.stop, CONFIG.fx.boxStop);
      return;
    }
    run.boxOffer = { opts: boxOpts(run, o.scorch ? 1 : CONFIG.relic.n + keepSum(run, 'boxPlus'), rng), scorch: !!o.scorch, quote: o.scorch ? TEXT.box.kwakScorch : pick(TEXT.box.kwak, rng) };
    fx(run, { t: 'box', x: c.x, y: c.y, scorch: !!o.scorch });
    log(run, o.scorch ? TEXT.box.scorched : TEXT.box.dug, 'good');
    if (run.act) run.act.stop = Math.max(run.act.stop, CONFIG.fx.boxStop);
  }
  function addMoney(run, v) {   // 판 위에서 받은 돈은 오늘 주머니로(쓰러지면 절반을 잃어요). 하루가 끝난 뒤면 금고로
    if (run.d && (run.phase === 'mine' || run.phase === 'room')) { run.d.pocket += v; run.d.pocketLines.sold += v; curFloorRec(run).value += v; }
    else run.cash += v;
  }
  function boxPassValue(run) {
    var B = run.boxOffer; if (!B) return 0;
    if (!B.opts.length) return CONFIG.relic.junk;
    return Math.max.apply(null, B.opts.map(function (id) { return toolValue(run, id, 'site'); }));
  }
  // 연장함 고르기: i = 고른 도구(-1이면 곽 씨에게 넘기기). 칸이 가득이면 dropId(내려놓을 도구)를 함께 줘요
  function chooseBox(run, i, dropId) {
    var B = run.boxOffer; if (!B) return { ok: false };
    var money = 0, id = null;
    if (B.keep) { if (i === -1) log(run, TEXT.keep.left); else { id = B.keep; addKeep(run, id); } run.boxOffer = null; if (run.d && run.phase === 'mine') checkPerfect(run); return { ok: true, id: id, keep: true, money: 0 }; }
    if (i === -1) { money = boxPassValue(run); addMoney(run, money); log(run, TEXT.box.passed.replace('{n}', fmt(money)), 'good'); }
    else {
      id = B.opts[i]; if (!id) return { ok: false };
      if (run.owned.length >= slotsOf(run)) {
        if (!dropId || !canRemove(run, dropId, true)) return { ok: false, full: true };
        money = toolValue(run, dropId, 'site'); removeTool(run, dropId); addMoney(run, money); run.stats.sold++;
        log(run, TEXT.box.dropped.replace('{name}', josa(TOOL_BY_ID[dropId].name, '을', '를')).replace('{n}', fmt(money)));
      }
      addTool(run, id, 0); (run.boxed = run.boxed || {})[id] = true;   // 연장함에서 나온 옛 연장: 합치기 재료가 돼요
      log(run, TEXT.box.took.replace('{name}', josa(TOOL_BY_ID[id].name, '을', '를')), 'good');
    }
    run.boxOffer = null;
    if (run.d && run.phase === 'mine') checkPerfect(run);
    return { ok: true, id: id, money: money, drop: dropId || null };
  }
  // 유품 챙기기: 체력과 촛불은 바로 바뀌어요
  function addKeep(run, id) {
    var k = KEEP_BY_ID[id]; (run.keeps = run.keeps || []).push(id); run.stats.keeps = (run.stats.keeps || 0) + 1;
    var d = run.d;
    if (d && k.hp) { d.hpMax = Math.max(1, d.hpMax + k.hp); d.hp = Math.max(1, Math.min(d.hpMax, d.hp + k.hp)); }
    if (d && k.candle) { d.candleMax += k.candle; d.candle = Math.max(1, d.candle + k.candle); }
    log(run, TEXT.keep.took.replace('{name}', josa(k.name, '을', '를')), 'good');
  }
  // ---------- 합친 도구 ----------
  function fusionsReady(run) {
    if (!feat('fusion')) return [];
    if (CONFIG.relic.fuseNight === 'stamp' && !(run.payment && run.payment.ok && run.payment.idx && pays(run)[run.payment.idx - 1].day === run.day)) return [];   // 곽 씨는 도장 찍은 밤에만 와요
    if (CONFIG.relic.fuseMax && run.stats.fused >= CONFIG.relic.fuseMax) return [];
    return TOOLS.filter(function (t) { return t.fusion && (!t.sets || t.sets.indexOf(CONFIG.toolSet) >= 0) && run.owned.indexOf(t.id) < 0 && t.fusion.every(function (p) { return run.owned.indexOf(p) >= 0; }) && fuseSourceOk(run, t); }).map(function (t) { return t.id; });
  }
  // 재료 출처: 'box'면 재료 하나는 연장함에서 나온 옛 연장이어야 해요
  function fuseSourceOk(run, t) {
    return CONFIG.relic.fuseFrom !== 'box' || t.fusion.some(function (p) { return run.boxed && run.boxed[p]; });
  }
  function fuse(run, id) {
    if (run.phase !== 'shop' || !run.shop || (run.shop.fuse || []).indexOf(id) < 0) return { ok: false };
    var t = TOOL_BY_ID[id], paid = t.fusion.reduce(function (a, p) { return a + (run.paidFor[p] || 0); }, 0);
    t.fusion.forEach(function (p) { removeTool(run, p); });
    addTool(run, id, paid); run.stats.fused++;
    log(run, TEXT.fuse.done.replace('{a}', josa(TOOL_BY_ID[t.fusion[0]].name, '과', '와')).replace('{b}', josa(TOOL_BY_ID[t.fusion[1]].name, '을', '를')).replace('{name}', josa(t.name, '을', '를')), 'good');
    run.shop.fuse = fusionsReady(run);
    return { ok: true };
  }
  function reroll(run) {
    if (run.phase !== 'shop' || run.cash < rerollPrice(run)) return { ok: false };
    run.cash -= rerollPrice(run); run.shop.rerolls++;
    var fresh = pickStock(run, CONFIG.shop.tools, 0, false);
    for (var i = 0; i < CONFIG.shop.tools; i++) { run.shop.stock[i] = fresh[i] || null; delete run.shop.sold[i]; }
    return { ok: true };
  }
  function nextDay(run) {
    if (run.phase !== 'shop') return { ok: false };
    run.day++;
    run.shop = null; run.d = null;
    prepareDay(run);
    return { ok: true };
  }

  // ---------- 디버그 ----------
  function debugFillCandle(run) { if (run.d) { run.d.candle = run.d.candleMax; run.d.embersOn = false; run.d.embers = 0; run.d.embersGiven = false; run.d.lowWarned = false; } }
  function debugEndDay(run) { if (run.phase === 'mine' || run.phase === 'room') { if (run.phase === 'room') { run.room = null; run.phase = 'mine'; } endDay(run, 'return'); } }
  // 오늘을 바로 끝내고(주머니 그대로) 정산·납부까지 처리한 뒤 다음 날 게시판으로
  function debugSkipDay(run) {
    if ((run.phase === 'deed' || run.phase === 'gift') && !run.giftDone) chooseGift(run, 0);
    if (run.phase === 'deed' || run.phase === 'board' || run.phase === 'ready' || run.phase === 'gift') startDay(run);
    if (run.phase === 'mine' || run.phase === 'room') debugEndDay(run);
    if (run.phase === 'settle') afterSettle(run);
    if (run.phase === 'payment') afterPayment(run);
    if (run.phase === 'gift') chooseGift(run, -1);
    if (run.phase === 'shop') nextDay(run);
    return run.phase;
  }

  return {
    W: W, H: H, newRun: newRun, prepareDay: prepareDay, chooseOrder: chooseOrder, startDay: startDay,
    move: move, hit: hit, mark: mark, chord: chord, chordInfo: chordInfo, rateText: rateText, stampNames: stampNames, payments: pays, applyPreset: applyPreset, poolList: poolList, toolPool: toolPool,
    dailySeed: function (dateStr) { var p = String(dateStr).split('-').map(Number); return hashSeed(p[0] || 0, p[1] || 0, p[2] || 0, 0xDA11); }, probe: probe, ignite: ignite, useCons: useCons, travelTo: travelTo, approach: approach,
    onStair: onStair, descend: descend, travelCost: travelCost, springChoose: springChoose, merchantService: merchantService, leaveRoom: leaveRoom,
    returnUp: returnUp, afterSettle: afterSettle, afterPayment: afterPayment, buy: buy, sellBack: sellBack, sellPrice: sellPrice, reroll: reroll,
    slotsOf: slotsOf, toolValue: toolValue, canRemove: canRemove, chooseBox: chooseBox, boxPassValue: boxPassValue, fuse: fuse, fusionsReady: fusionsReady,
    loanInfo: loanInfo, takeLoan: takeLoan, payNow: payNow,
    nextDay: nextDay, priceOf: priceOf, rerollPrice: rerollPrice, servicePrice: servicePrice, stage: stage, orderPocket: orderPocket, goalInfo: goalInfo, nextPayment: nextPayment, paymentFor: paymentFor,
    deduce: deduce, numAt: numAt, cellAt: cellAt, neighbors: neighbors, orthN: orthN, cheb: cheb, liveHaz: liveHaz, idx: idx,
    genFloor: genFloor, usefulCount: usefulCount, checkRule: checkRule, checkFloor: checkFloor, isSolvable: isSolvable, startChainSize: startChainSize, tallyRow: tallyRow, remaining: remaining, shownStair: shownStair, forkOptions: forkOptions,
    hashSeed: hashSeed, rngFrom: rngFrom, fmt: fmt, josa: josa, streakMult: streakMult, streakCapIdx: streakCapIdx, hitCost: hitCost, igniteCost: igniteCost,
    isBorder: isBorder, owns: owns, mut: mut, gang: gang, canAct: canAct,
    propagated: propagated, toGift: toGift, chooseGift: chooseGift, floorEstimate: floorEstimate, placeGraffiti: placeGraffiti, floorFromMap: floorFromMap, tutorialFloor: tutorialFloor, walkable: walkable, TUT_TEST: TUT_TEST, planRun: planRun,
    TOOL_BY_ID: TOOL_BY_ID, KEEP_BY_ID: KEEP_BY_ID, KEEPSAKES: KEEPSAKES, keepSum: keepSum, ORDER_BY_ID: ORDER_BY_ID, CHAR_BY_ID: CHAR_BY_ID, charOf: charOf, innate: innate, debugFillCandle: debugFillCandle, debugEndDay: debugEndDay, debugSkipDay: debugSkipDay
  };
})();

export { PRESETS, Core, CONFIG, TOOLS, CHARACTERS, RULES, RULE_IDS, CHUNK_RULES, GANG, ORDERS, MUTATIONS, MUTATION_IDS, TUTORIAL_MUT8, TEXT, TUTORIAL, TREASURE_NAMES };
