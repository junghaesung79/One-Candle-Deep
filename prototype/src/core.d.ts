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
  giftOpts: string[];
  mutationPlan: Record<number, string[]>;
  plan: { gang: (string | null)[]; orders: string[][]; firstRule: (string | null)[]; [k: string]: any };
  order: { id: string; prog: number; done: boolean; failed: boolean; [k: string]: any } | null;
  [k: string]: any;
}

export interface ActResult { ok: boolean; [k: string]: any }

export interface CoreApi {
  W: number;
  H: number;
  newRun(seed: number, opts?: { tutorial?: boolean }): Run;
  startDay(run: Run): void;
  genFloor(spec: { depth: number; rule: RuleId | string; sx: number; sy: number; seed: number; twin?: boolean; chunk?: unknown }): Floor;
  cellAt(f: Floor, x: number, y: number): Cell;
  neighbors(f: Floor, x: number, y: number): Cell[];
  numAt(f: Floor, c: Cell): number;
  deduce(f: Floor, opt?: unknown): { safe: number[]; [k: string]: any };
  hashSeed(...parts: number[]): number;
  hit(run: Run, x: number, y: number): ActResult;
  mark(run: Run, x: number, y: number, to: number): unknown;
  probe(run: Run, x: number, y: number): unknown;
  ignite(run: Run, x: number, y: number, free?: boolean): ActResult;
  [k: string]: any;
}

export declare const Core: CoreApi;
export declare const CONFIG: any;
export declare const TOOLS: any[];
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
