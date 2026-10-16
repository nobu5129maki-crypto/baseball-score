import { describe, expect, it } from "vitest";
import { createSaveQueue } from "./save-queue";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("保存の順番", () => {
  it("同時に積んでも、前の結果を見てから次を書く", async () => {
    const enqueue = createSaveQueue();
    let value = 0;
    const seen: number[] = [];

    const tasks = [1, 2, 3, 4].map(() =>
      enqueue(async () => {
        const start = value;
        await wait(5);
        value = start + 1;
        seen.push(value);
      }),
    );
    await Promise.all(tasks);

    expect(seen).toEqual([1, 2, 3, 4]);
    expect(value).toBe(4);
  });

  it("前が失敗しても次の保存は止まらない", async () => {
    const enqueue = createSaveQueue();
    const done: string[] = [];

    const first = enqueue(async () => {
      throw new Error("fail");
    });
    const second = enqueue(async () => {
      done.push("second");
    });

    await expect(first).rejects.toThrow("fail");
    await second;
    expect(done).toEqual(["second"]);
  });
});
