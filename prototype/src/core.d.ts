// 규칙 모듈(core.js)의 타입 선언이에요.
// 지금은 자주 쓰는 모양(칸, 층, 하루, 한 판)과 바깥에서 부르는 함수만 적었고, 나머지 필드는 느슨하게 열어 뒀어요.
// 여기를 하나씩 좁혀 가면 TypeScript 쪽(봇, 테스트, 앞으로의 코드)이 그만큼 검사를 받아요.

export type RuleId = 'plain' | 'pair' | 'lonely' | 'rows' | 'tally' | 'minepair' | 'border';
export type Phase = 'deed' | 'gift' | 'board' | 'ready' | 'mine' | 'room' | 'settle' | 'payment' | 'shop' | 'final';

/** 판의 한 칸 */
export interface Cell {
  x: number;
  y: number;
  /** 'mine' | 'treasure' | 빈 값. 봇은 행동 결정에 이 값을 읽지 않아요 */
  haz?: 'mine' | 'treasure' | null | '' | false;
  cover?: string;
  stair?: boolean;
  /** 분필 표시: 0 없음, 1 X, 2 O */
  mark?: number;
  tier?: number;
  [k: string]: any;
}

/** 한 층 */
export interface Floor {
  depth: number;
  rule: RuleId;
  cells: Cell[];
  stair: (Cell & { blocked?: boolean }) | null;
  [k: string]: any;
}

/** 오늘(광산 안에 있는 동안)의 상태 */
export interface DayState {
  floor: Floor;
  candle: number;
  candleMax: number;
  hp: number;
  pocket: number;
  streak: number;
  embers: number;
  embersOn: boolean;
  probes: number;
  px: number;
  py: number;
  [k: string]: any;
}

/** 한 판(15일) */
export interface Run {
  seed: number;
  day: number;
  phase: Phase;
  cash: number;
  stamps: number;
  tutorial?: boolean;
  d: DayState;
  owned: string[];
  /** 소모품(옛 저장에는 없을 수 있어요) */
  consumables?: ConsumableStack[];
  giftOpts: string[];
  mutationPlan: Record<number, string[]>;
  plan: { gang: (string | null)[]; orders: string[][]; firstRule: (string | null)[]; [k: string]: any };
  order: { id: string; prog: number; done: boolean; failed: boolean; [k: string]: any } | null;
  history: DayHistory[];
  record?: boolean;
  [k: string]: any;
}

export interface ActResult { ok: boolean; [k: string]: any }

/** 소모품 id(reviews/24). 도구·유물 id와 겹치지 않아요 */
export type ConsumableId = 'matchstick' | 'bandage' | 'stub' | 'mapscrap';
/** 소모품 표 한 줄. target 'x'면 쓸 때 X 칸을 골라요 */
export interface ConsumableDef { id: ConsumableId; name: string; desc: string; icon: string; target?: 'x' }
/** 가진 소모품 한 칸(run.consumables). 한 가지가 도구 칸 하나, 개수 제한 없음 */
export interface ConsumableStack { id: ConsumableId | string; n: number }
/** useConsumable 결과. refused: 쓸 수 없어서 그대로 둠(체력 가득, 모르는 지뢰 없음 등) */
export interface ConsumableUseResult {
  ok: boolean; id?: string; n?: number; refused?: boolean; needTarget?: boolean; noX?: boolean;
  mines?: number; hp?: number; candle?: number; x?: number; y?: number;
}
/** 도구 신호에 오는 값(도구 hooks에서 고쳐 효과를 바꿔요) */
export interface ConsumableEvent { id: string; n: number; refuse?: string; candle?: number; hp?: number; x?: number; y?: number; source?: string; result?: ConsumableUseResult }

/** 기록 장치(newRun의 record)가 하루에 세는 것. 치기·발파 직전 칸을 화면에 보이는 정보로 가른 결과예요 */
export interface DayRecord {
  safe: number; knownT: number; knownM: number; bet: number; unknown: number;
  blastSure: number; blastBet: number; marks: number; probes: number; chords: number;
}

/** 하루를 마친 기록 한 줄 */
export interface DayHistory {
  day: number; income: number; gross: number; collapsed: boolean; depth: number;
  reason: 'return' | 'collapse' | 'candle' | string; candleLeft: number;
  rec: DayRecord | null;
  [k: string]: any;
}

export interface CoreApi {
  W: number;
  H: number;
  newRun(seed: number, opts?: { tutorial?: boolean; record?: boolean; grade?: number; daily?: string | null; char?: string }): Run;
  startDay(run: Run): void;
  genFloor(spec: { depth: number; rule: RuleId | string; sx: number; sy: number; seed: number; twin?: boolean; chunk?: unknown }): Floor;
  cellAt(f: Floor, x: number, y: number): Cell;
  neighbors(f: Floor, x: number, y: number): Cell[];
  numAt(f: Floor, c: Cell): number;
  deduce(f: Floor, opt?: unknown): { safe: number[]; [k: string]: any };
  /** 층에 남은(없어지지 않은) 보물·지뢰 수 */
  remaining(f: Floor): { t: number; m: number };
  /** 프리셋 바꾸기: 'v21'(2차 기획 v2.1) / 'v22'(재미 보고서, 기본) */
  applyPreset(name: 'v21' | 'v22' | string): boolean;
  /** 둘레 한꺼번에 열기: 서 있는 숫자 칸에서 */
  chord(run: Run, x: number, y: number): ActResult;
  /** 처음부터 보이는 계단 칸 번호, 없으면 -1 */
  shownStair(f: Floor): number;
  hashSeed(...parts: number[]): number;
  hit(run: Run, x: number, y: number): ActResult;
  mark(run: Run, x: number, y: number, to?: number): { ok: boolean; mark?: number; faded?: boolean };
  probe(run: Run, x: number, y: number): unknown;
  ignite(run: Run, x: number, y: number, free?: boolean): ActResult;
  /** 도구 칸 수(넓은 연장 띠 포함) */
  slotsOf(run: Run): number;
  /** 도구 칸에 든 것: 도구 + 소모품 칸(소모품 칸 셈은 여기 한 곳) */
  slotsUsed(run: Run): number;
  CONSUMABLES: ConsumableDef[];
  CONS_BY_ID: Record<string, ConsumableDef>;
  /** 소모품 넣기. 넣은 개수를 돌려줘요(같은 것이 없고 칸이 가득이면 0) */
  addConsumable(run: Run, id: ConsumableId | string, n: number, source?: string): number;
  consumableCount(run: Run, id: ConsumableId | string): number;
  consumableTotal(run: Run): number;
  /** 이 소모품을 하나 더 받을 자리가 있는지(같은 것이 있으면 늘 있음) */
  consumableFits(run: Run, id: ConsumableId | string): boolean;
  /** 소모품 쓰기. 성냥은 target(X 칸)이 있어야 해요 */
  useConsumable(run: Run, id: ConsumableId | string, target?: { x: number; y: number }): ConsumableUseResult;
  /** 소모품 한 칸을 통째로 버려요(돈 없음) */
  discardConsumable(run: Run, id: ConsumableId | string): { ok: boolean; n?: number };
  /** 지도 조각이 바랜 X를 그을 수 있는 지뢰 칸 */
  mapTargets(run: Run): Cell[];
  [k: string]: any;
}

export declare const Core: CoreApi;
export declare const PRESETS: Record<string, { config: Record<string, any>; text: Record<string, string> }>;
export declare const CONFIG: any;
export declare const TOOLS: any[];
export declare const CONSUMABLES: ConsumableDef[];
export declare const RULES: Record<string, any>;
export declare const RULE_IDS: RuleId[];
export declare const CHUNK_RULES: RuleId[];
export declare const GANG: any[];
export declare const ORDERS: any[];
export declare const MUTATIONS: Record<string, any>;
export declare const MUTATION_IDS: string[];
export declare const TUTORIAL_MUT8: string;
export declare const TEXT: any;
export declare const TUTORIAL: any;
export declare const TREASURE_NAMES: Record<number, string>;
export declare const CHARACTERS: any[];
