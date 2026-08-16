import { scoringRuleTerms, type RuleTerm } from "./rules";

export type GlossaryTerm = RuleTerm;

const STAT_TERMS: GlossaryTerm[] = [
  {
    id: "ops",
    title: "OPS（おーぴーえす）",
    plain:
      "出塁率と長打率を足した数字です。出塁率は「どれだけ塁に出たか」、長打率は「どれだけ長打を打ったか」です。2つを足すので、数字が大きいほど得点につながりやすい打者です。1.000に近い、またはそれを超えるととてもよく打っています。",
    when: "成績で選手やチームの打撃を比べるとき。打率だけだと四球や長打が分からないので、OPSも見ます。",
    symbol: "OPS",
  },
  {
    id: "ab",
    title: "打数（だすう）",
    plain:
      "打席のうち、打率の計算に入れる回数です。ヒットやアウトになった打席は打数に入ります。次のものは打数に入りません。四球、死球、犠牲バント、犠牲フライ、打撃妨害・走塁妨害、打席の途中での交代です。これらは打席には数えますが、打数には入れないので打率が下がりません。",
    when: "成績の打率を見るとき。四球が多い選手は打席が多くても打数は少なくなります。",
    symbol: "AB",
  },
];

export const GLOSSARY: GlossaryTerm[] = [...scoringRuleTerms(), ...STAT_TERMS];

export function glossaryById(id: string): GlossaryTerm | undefined {
  return GLOSSARY.find((g) => g.id === id);
}
