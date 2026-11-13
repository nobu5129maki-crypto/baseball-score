import type { BattedBall, GameState, PlayResult } from "./types";

/** 採点ルールの単一ソース。ここを直すとボタン表示・成績集計・用語解説が追随する。 */

export type RuleTerm = {
  id: string;
  title: string;
  plain: string;
  when: string;
  symbol: string;
};

export type PlayRule = {
  needsField: boolean;
  isAb: boolean;
  hitValue: 0 | 1 | 2 | 3 | 4;
  awardsRbi: boolean;
  blocked?: (state: Pick<GameState, "outs" | "bases">) => string | null;
  term?: RuleTerm;
};

function hasRunner(state: Pick<GameState, "bases">): boolean {
  return state.bases.some(Boolean);
}

export const PLAY_RULES: Record<PlayResult, PlayRule> = {
  single: { needsField: true, isAb: true, hitValue: 1, awardsRbi: true },
  double: { needsField: true, isAb: true, hitValue: 2, awardsRbi: true },
  triple: { needsField: true, isAb: true, hitValue: 3, awardsRbi: true },
  homerun: { needsField: true, isAb: true, hitValue: 4, awardsRbi: true },
  strikeout: { needsField: false, isAb: true, hitValue: 0, awardsRbi: true },
  strikeout_looking: {
    needsField: false,
    isAb: true,
    hitValue: 0,
    awardsRbi: true,
    term: {
      id: "kl",
      title: "見逃し三振",
      plain: "3ストライク目をバットを振らずに見送って、打者がアウトになった三振です。スコアブックでは「見三」と書きます。",
      when: "3ストライク目がストライクゾーンを通って、打者が振らなかったとき。",
      symbol: "見三",
    },
  },
  strikeout_swinging: {
    needsField: false,
    isAb: true,
    hitValue: 0,
    awardsRbi: true,
    term: {
      id: "ksw",
      title: "空振り三振",
      plain: "3ストライク目をバットが空振りして、打者がアウトになった三振です。スコアブックでは「空三」と書きます。",
      when: "3ストライク目にバットがボールに当たらなかったとき（ファウルでなく空振り）。",
      symbol: "空三",
    },
  },
  dropped_third: { needsField: false, isAb: true, hitValue: 0, awardsRbi: true },
  walk: { needsField: false, isAb: false, hitValue: 0, awardsRbi: true },
  hbp: { needsField: false, isAb: false, hitValue: 0, awardsRbi: true },
  groundout: { needsField: true, isAb: true, hitValue: 0, awardsRbi: true },
  flyout: { needsField: true, isAb: true, hitValue: 0, awardsRbi: true },
  lineout: { needsField: true, isAb: true, hitValue: 0, awardsRbi: true },
  gidp: {
    needsField: true,
    isAb: true,
    hitValue: 0,
    awardsRbi: false,
    blocked: (state) => {
      if (state.outs >= 2) return "2アウトでは併殺になりません。";
      if (!hasRunner(state)) return "走者がいないと併殺になりません。";
      return null;
    },
  },
  error: { needsField: true, isAb: true, hitValue: 0, awardsRbi: false },
  fielders_choice: {
    needsField: true,
    isAb: true,
    hitValue: 0,
    awardsRbi: true,
    blocked: (state) => (hasRunner(state) ? null : "走者がいないと野選になりません。"),
    term: {
      id: "fc",
      title: "野選（やせん）",
      plain:
        "内野手が、打者をアウトにする代わりに、すでに出ている走者をアウトにしようとしたプレーです。打者は1塁に出ますが、ヒットには数えません。",
      when:
        "たとえば1塁に走者がいて、ゴロを捕った野手が2塁へ送球したとき。走者を狙った結果、打者が1塁に生きたら野選です。",
      symbol: "FC",
    },
  },
  sac_bunt: {
    needsField: true,
    isAb: false,
    hitValue: 0,
    awardsRbi: true,
    blocked: (state) => {
      if (state.outs >= 2) return "2アウトでは送りバント（犠打）になりません。";
      if (!hasRunner(state)) return "走者がいないと送りバントになりません。";
      return null;
    },
    term: {
      id: "sh",
      title: "犠打・送りバント（SH）",
      plain: "打者が自分はアウトになり、走者を次の塁へ進めたバント。2アウトでは犠打になりません。",
      when: "2アウト未満で、バントで走者を進めて打者はアウトになったとき。",
      symbol: "SH",
    },
  },
  sac_fly: {
    needsField: true,
    isAb: false,
    hitValue: 0,
    awardsRbi: true,
    blocked: (state) => {
      if (state.outs >= 2) return "2アウトでは犠牲フライになりません。";
      if (!state.bases[2]) return "3塁に走者がいないと犠牲フライになりません。";
      return null;
    },
    term: {
      id: "sf",
      title: "犠飛（SF）",
      plain: "外野フライで打者はアウト、3塁走者がタッチアップして得点したとき。2アウトでは犠飛になりません。",
      when: "2アウト未満で、フライの間に3塁走者がホームに帰ったとき。",
      symbol: "SF",
    },
  },
  runner_hit: {
    needsField: false,
    isAb: true,
    hitValue: 1,
    awardsRbi: false,
    term: {
      id: "rh",
      title: "走者当たり",
      plain:
        "打ったフェアの打球が、野手に触れる前に走者に当たったときです。当たった走者はアウト、打者は1塁に出ます。打者には安打が記録されます。",
      when: "ゴロやライナーが走者の体に当たって、プレーが止まったとき。当たった走者をタップして記録します。",
      symbol: "走当",
    },
  },
  catcher_interference: {
    needsField: false,
    isAb: false,
    hitValue: 0,
    awardsRbi: true,
    term: {
      id: "ci",
      title: "打撃妨害",
      plain:
        "捕手などが、打者のバットを振るのを邪魔したときです。ボールはデッドになり、打者は1塁へ出ます。1塁から順に走者が詰まっているときだけ、その走者は次の塁へ押されます。空いている塁の先にいる走者は進みません。打数には入りません。ヒットでも四球でも失策でもありません。出塁率には入ります。満塁で押し出された点には打点が付きます。",
      when: "審判が「打撃妨害」と宣告したとき。空振りのバットが捕手のミットに当たったときが典型です。「その他」から記録します。",
      symbol: "打妨",
    },
  },
  offensive_interference: {
    needsField: false,
    isAb: true,
    hitValue: 0,
    awardsRbi: false,
    term: {
      id: "oi",
      title: "守備妨害",
      plain:
        "打者や走者が、野手の捕球や送球を邪魔したときです。邪魔した人がアウトになり、ボールはデッドです。打者が邪魔したときは打者アウトで、走者は投球当時の塁に残ります。走者が邪魔したときはその走者がアウトです。2アウト未満なら打者は1塁に出ます。すでに2アウトのときは、その走者で3アウトになり打者は出塁しません。打数には入ります。ヒットや失策にはなりません。",
      when: "審判が「守備妨害」と宣告したとき。盗塁の送球を打者が妨げた、走者がゴロを処理する野手にぶつかった、などが典型です。「その他」から、邪魔した人を選んで記録します。",
      symbol: "守妨",
    },
  },
};

export const DROPPED_THIRD = {
  allowed(state: Pick<GameState, "outs" | "bases">): boolean {
    return state.outs >= 2 || state.bases[0] == null;
  },
  choosePrompt: "3ストライクです。見逃し・空振り・振り逃げを選んでください。",
  strikeoutOnlyPrompt: "3ストライクです。見逃し三振か空振り三振を選んでください。",
  blockedHint: "1塁に走者がいて2死未満のため、振り逃げはできません。",
  term: {
    id: "ks",
    title: "振り逃げ",
    plain:
      "3ストライク目を捕手が捕れず、打者が1塁へ走ってセーフになることです。できるのは、1塁に走者がいないとき、または2アウトのときだけです。満塁でも2アウトならできます。1塁に走者がいて2死未満のときは、捕手が落としても打者は三振アウトです。",
    when: "三振なのにキャッチャーが落として、打者が1塁に生きたとき。1塁が空いているか、2アウトのときだけ記録します。",
    symbol: "K",
  } satisfies RuleTerm,
};

export const SITUATION_TERMS: RuleTerm[] = [
  {
    id: "pb",
    title: "捕逸（PB）",
    plain:
      "捕手が普通に取れそうな球を後ろにそらして、走者が進塁したとき。投手の暴投ではない。一塁と三塁に走者がいるときは、三塁はホームへ進み、一塁が進むか残るかを選べます。",
    when: "キャッチャーが捕球をこぼして走者が動いたとき。",
    symbol: "PB",
  },
  {
    id: "wp",
    title: "暴投（WP）",
    plain:
      "投手が捕手の取れないところに投げ、走者が進塁したとき。一塁と三塁に走者がいるときは、三塁はホームへ進み、一塁が進むか残るかを選べます。",
    when: "ワンバウンドや大きく外れた球で走者が動いたとき。",
    symbol: "WP",
  },
  {
    id: "hr",
    title: "本塁打の書き方",
    plain:
      "スコアブックでは飛んだ方向を付けて、左本・中本・右本と書きます。本塁打そのものが得点になるので、マスに「点」は重ねません。",
    when: "ホームランを記録するとき。方向を選んでください。",
    symbol: "左本",
  },
  {
    id: "po",
    title: "牽制死",
    plain: "投手が塁へ送球して走者がアウトになったとき。スコアブックの走者のマスには牽制死と書きます。",
    when: "牽制で走者が刺されたとき。",
    symbol: "牽制死",
  },
  {
    id: "bk",
    title: "ボーク",
    plain: "投手の反則投球。走者は1つずつ進塁する。",
    when: "投手がセットから変な動きをして、審判がボークを宣告したとき。",
    symbol: "BK",
  },
  {
    id: "dead",
    title: "ボールデッド",
    plain:
      "ボールがベンチ、スタンドなどプレーできない場所に入り、審判がボールデッドにしたときです。送球がそれたときは、いる走者がそれぞれ1つ進みます。1塁は2塁、2塁は3塁、3塁はホームです。打者の打席はそのままです。打球のあと後逸して入ったときは、打者もエラーで1塁に出ます。",
    when: "送球やこぼれ球がベンチなどに入り、プレーが止まったとき。",
    symbol: "失",
  },
];

function runnerAdvanceBits(bases: GameState["bases"]): string[] {
  const bits: string[] = [];
  if (bases[0]) bits.push("1塁の走者は2塁へ進みます。");
  if (bases[1]) bits.push("2塁の走者は3塁へ進みます。");
  if (bases[2]) bits.push("3塁の走者はホームへ進みます。");
  return bits;
}

/** 打球がベンチに入ったボールデッド。打者は1塁、いる走者はそれぞれ1つ。 */
export function deadBallAdvanceNote(bases: GameState["bases"]): string {
  return [
    "ボールデッドです。打者は1塁へ出ます。いる走者はそれぞれ1つ進みます。",
    ...runnerAdvanceBits(bases),
    "違うときは進塁先を直してから確定してください。",
  ].join("");
}

/** 妨害で走者がいるとき、確定前に見せる進塁の説明。 */
export function interferenceAdvanceNote(result: PlayResult): string | null {
  if (result === "catcher_interference") {
    return "打撃妨害です。打者は1塁へ出ます。1塁から順に詰まっている走者だけ進みます。違うときは進塁先を直してから確定してください。";
  }
  if (result === "offensive_interference") {
    return "守備妨害です。邪魔した人はアウトです。2アウト未満で走者が邪魔したときは打者は1塁に出ます。すでに2アウトなら、その走者で3アウトになり打者は出塁しません。違うときは進塁先を直してください。";
  }
  return null;
}

/** 送球がベンチに入ったボールデッド。いる走者だけがそれぞれ1つ進む。 */
export function benchAdvanceNote(bases: GameState["bases"]): string {
  return [
    "ボールがベンチなどに入ってボールデッドです。いる走者はそれぞれ1つ進みます。打者はそのままです。",
    ...runnerAdvanceBits(bases),
    "違う走者だけ、進塁先を直してから確定してください。",
  ].join("");
}

export function isStrikeoutResult(result: PlayResult): boolean {
  return result === "strikeout" || result === "strikeout_looking" || result === "strikeout_swinging";
}

/** 打球種類。ヒットに明示があればそれを使い、アウトは結果から推定する */
export function inferredBattedBall(result: PlayResult, batted?: BattedBall): BattedBall | undefined {
  if (batted) return batted;
  if (result === "groundout" || result === "gidp") return "ground";
  if (result === "flyout" || result === "sac_fly" || result === "homerun") return "fly";
  if (result === "lineout") return "line";
  return undefined;
}

export function playRule(result: PlayResult): PlayRule {
  return PLAY_RULES[result];
}

export function needsField(result: PlayResult): boolean {
  return PLAY_RULES[result].needsField;
}

export function playIsAtBat(result: PlayResult): boolean {
  return PLAY_RULES[result].isAb;
}

export function playHitValue(result: PlayResult): 0 | 1 | 2 | 3 | 4 {
  return PLAY_RULES[result].hitValue;
}

export function playAwardsRbi(result: PlayResult): boolean {
  return PLAY_RULES[result].awardsRbi;
}

export function playBlockedReason(
  result: PlayResult,
  state: Pick<GameState, "outs" | "bases">,
): string | null {
  return PLAY_RULES[result].blocked?.(state) ?? null;
}

export function droppedThirdAllowed(state: Pick<GameState, "outs" | "bases">): boolean {
  return DROPPED_THIRD.allowed(state);
}

export function scoringRuleTerms(): RuleTerm[] {
  const fromPlays = Object.values(PLAY_RULES)
    .map((rule) => rule.term)
    .filter((term): term is RuleTerm => Boolean(term));
  return [...fromPlays, DROPPED_THIRD.term, ...SITUATION_TERMS];
}

export const FIELD_RESULTS: PlayResult[] = (Object.keys(PLAY_RULES) as PlayResult[]).filter(
  (result) => PLAY_RULES[result].needsField,
);
