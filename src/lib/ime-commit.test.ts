import { describe, expect, it } from "vitest";

/**
 * ImeTextInput と同じ判定ロジックを再現した回帰テスト。
 * 変換中の中間文字列は親へ渡さず、確定後だけ渡す。
 */
function runImeSession(steps: Array<{ type: "start" | "update" | "end" | "type"; value?: string }>) {
  let parent = "田中";
  let draft = parent;
  let composing = false;
  const commits: string[] = [];

  const onCommit = (next: string) => {
    if (next !== parent) {
      parent = next;
      commits.push(next);
    }
  };

  for (const step of steps) {
    if (step.type === "start") {
      composing = true;
      continue;
    }
    if (step.type === "update") {
      draft = step.value ?? draft;
      if (!composing) onCommit(draft);
      continue;
    }
    if (step.type === "end") {
      composing = false;
      draft = step.value ?? draft;
      onCommit(draft);
      continue;
    }
    if (step.type === "type") {
      draft = step.value ?? draft;
      if (!composing) onCommit(draft);
    }
  }

  return { parent, draft, commits };
}

describe("IME lineup name commit sequence", () => {
  it("や→ゃ→山 の変換中は親を更新しない", () => {
    const result = runImeSession([
      { type: "start" },
      { type: "update", value: "や" },
      { type: "update", value: "やま" },
      { type: "end", value: "山" },
    ]);
    expect(result.commits).toEqual(["山"]);
    expect(result.parent).toBe("山");
  });

  it("英数字の通常入力は都度反映する", () => {
    const result = runImeSession([
      { type: "type", value: "A" },
      { type: "type", value: "AB" },
    ]);
    expect(result.commits).toEqual(["A", "AB"]);
  });
});
