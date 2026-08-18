import { FIELD_RESULTS, needsField } from "./rules";
import { POSITION_SHORT, type PlayResult, type Position } from "./types";

export const PLAY_LABELS: Record<PlayResult, string> = {
  single: "シングル",
  double: "ツーベース",
  triple: "スリーベース",
  homerun: "ホームラン",
  strikeout: "三振",
  dropped_third: "振り逃げ",
  walk: "四球",
  hbp: "死球",
  groundout: "ゴロ",
  flyout: "フライ",
  lineout: "ライナー",
  gidp: "併殺",
  error: "エラー",
  fielders_choice: "野選",
  sac_bunt: "送りバント",
  sac_fly: "犠牲フライ",
  runner_hit: "走者当たり",
};

export const PLAY_SHORT: Record<PlayResult, string> = {
  single: "安",
  double: "二",
  triple: "三",
  homerun: "本",
  strikeout: "三振",
  dropped_third: "振逃",
  walk: "四",
  hbp: "死",
  groundout: "ゴ",
  flyout: "飛",
  lineout: "直",
  gidp: "併",
  error: "失",
  fielders_choice: "野選",
  sac_bunt: "犠",
  sac_fly: "犠飛",
  runner_hit: "走当",
};

export const HIT_RESULTS: PlayResult[] = ["single", "double", "triple", "homerun"];
export const OUT_RESULTS: PlayResult[] = ["groundout", "flyout", "lineout", "gidp"];
export const OTHER_RESULTS: PlayResult[] = ["fielders_choice", "sac_bunt", "sac_fly"];

export { FIELD_RESULTS, needsField };

export function isHitResult(result: PlayResult): boolean {
  return HIT_RESULTS.includes(result);
}

export function playLabel(result: PlayResult, field?: Position): string {
  const short = PLAY_SHORT[result];
  if (!field) return short;
  return `${POSITION_SHORT[field]}${short}`;
}
