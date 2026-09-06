import { BATTED_LABELS } from "@/lib/labels";
import type { BattedBall } from "@/lib/types";

const HIT_KANJI = new Set(["安", "二", "三", "本"]);

export function BattedKanji({
  text,
  batted,
  hit = false,
}: {
  text: string;
  batted?: BattedBall;
  hit?: boolean;
}) {
  const last = text.slice(-1);
  const prefix = text.slice(0, -1);
  const decorate = Boolean(hit && batted && HIT_KANJI.has(last));
  const spoken = decorate && batted ? `${text}（${BATTED_LABELS[batted]}）` : text;

  return (
    <span className={hit ? "scorebook-hit" : undefined} aria-label={spoken} title={batted ? BATTED_LABELS[batted] : undefined}>
      {decorate ? (
        <>
          {prefix}
          <span className={`hit-batted hit-batted-${batted}`}>{last}</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}

export function BattedLegend() {
  return (
    <p className="scorebook-legend" aria-label="ヒットの当たり方の記号">
      <span>
        <BattedKanji text="安" hit batted="ground" />
        ゴロ
      </span>
      <span>
        <BattedKanji text="安" hit batted="fly" />
        フライ
      </span>
      <span>
        <BattedKanji text="安" hit batted="line" />
        ライナー
      </span>
    </p>
  );
}
