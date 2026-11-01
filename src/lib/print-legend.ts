import type { Position } from "./types";
import { POSITION_SHORT } from "./types";

export type LegendItem = {
  mark: string;
  meaning: string;
};

const POSITION_MEANING: Record<string, string> = {
  投: "投手",
  捕: "捕手",
  一: "一塁",
  二: "二塁",
  三: "三塁",
  遊: "遊撃",
  左: "左翼",
  中: "中堅",
  右: "右翼",
  指: "指名打者",
};

const PLAY_MEANING: Record<string, string> = {
  安: "安打",
  二: "二塁打",
  三: "三塁打",
  本: "本塁打",
  見三: "見逃し三振",
  空三: "空振り三振",
  振逃: "振り逃げ",
  四: "四球",
  死: "死球",
  ゴ: "ゴロ",
  飛: "フライ",
  直: "ライナー",
  併: "併殺",
  失: "失策",
  野選: "野手選択",
  犠: "犠牲バント",
  犠飛: "犠牲フライ",
  走当: "走者に打球が当たったアウト",
  牽制死: "牽制アウト",
  盗: "盗塁",
  盗死: "盗塁死",
  盗本: "盗塁でホームイン",
  暴: "暴投",
  ボ: "ボーク",
  点: "この打席で入った得点",
  X: "この回は攻撃していない",
  守: "守備交代",
  S: "セーブ",
};

const POSITIONS = Object.keys(POSITION_MEANING);
const RESULTS = [
  "見三",
  "空三",
  "三振",
  "振逃",
  "野選",
  "犠飛",
  "走当",
  "牽制死",
  "盗死",
  "盗本",
  "代打",
  "代走",
  "捕逸",
  "安",
  "二",
  "三",
  "本",
  "四",
  "死",
  "ゴ",
  "飛",
  "直",
  "併",
  "失",
  "犠",
  "盗",
  "暴",
  "ボ",
].sort((a, b) => b.length - a.length);

const BATTED = ["ゴ", "飛", "直"];
const HITS = new Set(["安", "二", "三", "本"]);

const EXACT = new Set(["牽制死", "盗死", "盗本", "盗", "暴", "ボ", "捕逸", "代打", "代走", "X"]);

export type MarkTokens = { positions: string[]; plays: string[] };

const EMPTY_TOKENS: MarkTokens = { positions: [], plays: [] };

/** スコアブックの1マスを、守備位置と結果の記号に分ける。 */
export function tokensInMark(label: string): MarkTokens {
  if (label === "X" || EXACT.has(label)) return { positions: [], plays: [label] };
  if (/^\d+点$/.test(label)) return { positions: [], plays: ["点"] };
  if (/^\d+X$/.test(label)) return { positions: [], plays: [label] };

  for (const pos of POSITIONS) {
    if (!label.startsWith(pos)) continue;
    const rest = label.slice(pos.length);
    const result = RESULTS.find((token) => rest.startsWith(token) && token !== "三振");
    if (!result) continue;
    const after = rest.slice(result.length);
    if (after && !(HITS.has(result) && BATTED.includes(after))) continue;
    return { positions: [pos], plays: after ? [result, after] : [result] };
  }

  const result = RESULTS.find((token) => label.startsWith(token));
  if (!result || result === "三振") return EMPTY_TOKENS;
  const after = label.slice(result.length);
  if (after && !(HITS.has(result) && BATTED.includes(after))) return EMPTY_TOKENS;
  return { positions: [], plays: after ? [result, after] : [result] };
}

function meaningFor(mark: string, asPosition: boolean, asPlay: boolean): string | null {
  if (/^\d+X$/.test(mark)) return `${mark.slice(0, -1)}点でサヨナラ`;
  const parts: string[] = [];
  if (asPosition && POSITION_MEANING[mark]) parts.push(POSITION_MEANING[mark]);
  if (asPlay && PLAY_MEANING[mark]) parts.push(PLAY_MEANING[mark]);
  if (parts.length === 0) return null;
  return [...new Set(parts)].join("／");
}

const MARK_ORDER = [
  ...POSITIONS,
  "守",
  "安",
  "二",
  "三",
  "本",
  "見三",
  "空三",
  "振逃",
  "四",
  "死",
  "ゴ",
  "飛",
  "直",
  "併",
  "失",
  "野選",
  "犠",
  "犠飛",
  "走当",
  "牽制死",
  "盗",
  "盗死",
  "盗本",
  "暴",
  "ボ",
  "点",
  "X",
  "S",
];

export function legendForMarks(
  marks: string[],
  options?: { positions?: string[]; defensiveSub?: boolean; save?: boolean },
): LegendItem[] {
  const asPosition = new Set(options?.positions ?? []);
  const asPlay = new Set<string>();
  const walkOffs: string[] = [];

  for (const mark of marks) {
    if (/^\d+X$/.test(mark)) {
      if (!walkOffs.includes(mark)) walkOffs.push(mark);
      continue;
    }
    const tokens = tokensInMark(mark);
    for (const token of tokens.positions) asPosition.add(token);
    for (const token of tokens.plays) asPlay.add(token);
  }
  if (options?.defensiveSub) asPlay.add("守");
  if (options?.save) asPlay.add("S");

  const items: LegendItem[] = [];
  for (const mark of MARK_ORDER) {
    const meaning = meaningFor(mark, asPosition.has(mark), asPlay.has(mark));
    if (!meaning || meaning === mark) continue;
    items.push({ mark, meaning });
  }
  for (const mark of walkOffs) {
    items.push({ mark, meaning: `${mark.slice(0, -1)}点でサヨナラ` });
  }
  return items;
}

export function positionMarks(positions: Position[]): string[] {
  return [...new Set(positions.map((position) => POSITION_SHORT[position]))];
}

const STAT_TERMS: LegendItem[] = [
  { mark: "打数", meaning: "打率の計算に入れる打席。四球・死球・犠打・犠飛は除く" },
  { mark: "打点", meaning: "その打席で挙げた得点" },
  { mark: "打率", meaning: "安打÷打数" },
  { mark: "出塁率", meaning: "出塁した割合" },
  { mark: "長打率", meaning: "塁打÷打数" },
  { mark: "OPS", meaning: "出塁率＋長打率" },
  { mark: "勝利", meaning: "リードを奪ったまま勝った投手" },
  { mark: "敗戦", meaning: "勝ち越し点を許した投手" },
  { mark: "セーブ", meaning: "勝ち試合を締めくくった救援" },
  { mark: "回数", meaning: "アウト3つで1回。5.1は5回と1アウト" },
  { mark: "防御率", meaning: "9回あたりの自責点" },
  { mark: "ストライク率", meaning: "全投球のうちストライクの割合" },
  { mark: "奪空振り率", meaning: "「ストライク」で記録した球の割合" },
  { mark: "ゴロ率", meaning: "打球のうちゴロの割合" },
  { mark: "フライ率", meaning: "打球のうちフライの割合" },
];

/** 成績表に出ている見出しだけを説明する。 */
export function legendForStatHeaders(headers: string[]): LegendItem[] {
  const shown = new Set(headers);
  return STAT_TERMS.filter((item) => shown.has(item.mark));
}
