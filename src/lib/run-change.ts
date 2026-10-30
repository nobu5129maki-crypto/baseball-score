/** 攻撃側がこの点数に達したら攻守交代する特別ルール。未設定・0 は使わない。 */
export const RUN_CHANGE_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const CHOICES = new Set<number>(RUN_CHANGE_CHOICES);

export function normalizeRunChangeAt(value: number | undefined | null): number | undefined {
  if (value == null || !Number.isInteger(value) || !CHOICES.has(value)) return undefined;
  return value;
}

export function runChangeRuleLabel(value: number | undefined | null): string | null {
  const runs = normalizeRunChangeAt(value);
  return runs ? `${runs}点で交代` : null;
}

export function runChangeRuleSuffix(value: number | undefined | null): string {
  const label = runChangeRuleLabel(value);
  return label ? `　${label}` : "";
}

/** 交代したときに画面へ出す文。点数はその回に実際入った得点。 */
export function runChangeMessage(runs: number): string {
  return `${runs}点取ったから交代です`;
}
