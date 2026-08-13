export type GlossaryTerm = {
  id: string;
  title: string;
  plain: string;
  when: string;
  symbol: string;
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "fc",
    title: "野選（FC）",
    plain:
      "内野手が普通に投げれば打者をアウトにできた打球で、別の走者を狙って打者を1塁に生かしたとき。",
    when: "走者を刺しに行って、打者はセーフになったとき。",
    symbol: "FC",
  },
  {
    id: "pb",
    title: "捕逸（PB）",
    plain:
      "捕手が普通に取れそうな球を後ろにそらして、走者が進塁したとき。投手の暴投ではない。",
    when: "キャッチャーが捕球をこぼして走者が動いたとき。",
    symbol: "PB",
  },
  {
    id: "wp",
    title: "暴投（WP）",
    plain: "投手が捕手の取れないところに投げ、走者が進塁したとき。",
    when: "ワンバウンドや大きく外れた球で走者が動いたとき。",
    symbol: "WP",
  },
  {
    id: "sh",
    title: "犠打・送りバント（SH）",
    plain: "打者が自分はアウトになり、走者を次の塁へ進めたバント。",
    when: "バントで走者を進めて、打者はアウトになったとき。",
    symbol: "SH",
  },
  {
    id: "sf",
    title: "犠飛（SF）",
    plain: "外野フライで打者はアウト、3塁走者がタッチアップして得点したとき。",
    when: "フライの間に3塁走者がホームに帰ったとき。",
    symbol: "SF",
  },
  {
    id: "ks",
    title: "振り逃げ",
    plain:
      "3ストライク目を捕手が捕れず、打者が1塁へ走ってセーフになること。1塁に走者がいないとき（または2アウト）に起きる。",
    when: "三振なのにキャッチャーが落として、打者が1塁に生きたとき。",
    symbol: "K",
  },
  {
    id: "bk",
    title: "ボーク",
    plain: "投手の反則投球。走者は1つずつ進塁する。",
    when: "投手がセットから変な動きをして、審判がボークを宣告したとき。",
    symbol: "BK",
  },
];

export function glossaryById(id: string): GlossaryTerm | undefined {
  return GLOSSARY.find((g) => g.id === id);
}
