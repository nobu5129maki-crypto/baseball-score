import type { PlayResult } from "./types";

export const PLAY_LABELS: Record<PlayResult, string> = {
  single: "シングル",
  double: "ツーベース",
  triple: "スリーベース",
  homerun: "ホームラン",
  strikeout: "三振",
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
};

export const HIT_RESULTS: PlayResult[] = ["single", "double", "triple", "homerun"];
export const OUT_RESULTS: PlayResult[] = ["groundout", "flyout", "lineout", "gidp"];
export const OTHER_RESULTS: PlayResult[] = [
  "error",
  "fielders_choice",
  "sac_bunt",
  "sac_fly",
];
