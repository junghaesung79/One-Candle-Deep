// 봇 모듈(bot.js)의 타입 선언이에요. core.d.ts 와 같이 느슨하게 시작해요.
import type * as CoreModule from '../src/core.js';

export type Env = typeof CoreModule;
export type Policy = 'cautious' | 'normal' | 'greedy';
export interface RunOptions { policy?: Policy; tutorial?: boolean; lazy?: boolean; spend?: boolean; noGift?: boolean; mutations?: Record<number, string[]>; startTools?: string[]; [k: string]: unknown }
export interface RunResult { final: any; days: any[]; run: any; bot: Record<string, number>; buys: any[]; pays: any[] }

export declare function load(): Env;
export declare function playRun(env: Env, seed: number, opts?: RunOptions): RunResult;
export declare const Bot: any;
export declare const POLICY: Record<Policy, any>;
export declare const TOOL_PREF: string[];
