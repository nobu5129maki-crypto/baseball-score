import { describe, expect, it } from "vitest";
import {
  applyGameTimes,
  clockTime,
  formatDuration,
  gameTimeLabel,
  minutesBetween,
  normalizeTime,
  partsToTime,
  stampEndTime,
  stampStartTime,
  timeToParts,
} from "./game-time";
import type { Game } from "./types";

function game(times: { startTime?: string; endTime?: string } = {}): Game {
  return {
    id: "g1",
    myTeamId: "t1",
    myTeamName: "ひまわり",
    opponentName: "相手",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-08-23",
    status: "lineup",
    firstLineup: [],
    secondLineup: [],
    events: [],
    createdAt: 1,
    updatedAt: 1,
    ...times,
  };
}

describe("normalizeTime", () => {
  it("HH:MMと秒付きを正規化する", () => {
    expect(normalizeTime("13:05")).toBe("13:05");
    expect(normalizeTime("09:00:00")).toBe("09:00");
    expect(normalizeTime(" 18:30 ")).toBe("18:30");
  });

  it("空や不正な値は捨てる", () => {
    expect(normalizeTime("")).toBeUndefined();
    expect(normalizeTime("  ")).toBeUndefined();
    expect(normalizeTime("25:00")).toBeUndefined();
    expect(normalizeTime("10:61")).toBeUndefined();
    expect(normalizeTime("abc")).toBeUndefined();
  });
});

describe("clockTime", () => {
  it("現地時刻の時分になる", () => {
    expect(clockTime(new Date(2026, 7, 23, 9, 7))).toBe("09:07");
    expect(clockTime(new Date(2026, 7, 23, 15, 20))).toBe("15:20");
  });
});

describe("timeToParts / partsToTime", () => {
  it("時と分に分解する", () => {
    expect(timeToParts("13:05")).toEqual({ hour: "13", minute: "05" });
    expect(timeToParts("")).toEqual({ hour: "", minute: "" });
    expect(timeToParts("99:99")).toEqual({ hour: "", minute: "" });
  });

  it("数字の時分をHH:MMにする", () => {
    expect(partsToTime("9", "7")).toBe("09:07");
    expect(partsToTime("13", "05")).toBe("13:05");
    expect(partsToTime("0", "0")).toBe("00:00");
    expect(partsToTime("", "")).toBeUndefined();
  });

  it("片方だけ・範囲外は捨てる", () => {
    expect(partsToTime("13", "")).toBeUndefined();
    expect(partsToTime("", "05")).toBeUndefined();
    expect(partsToTime("24", "00")).toBeUndefined();
    expect(partsToTime("10", "60")).toBeUndefined();
    expect(partsToTime("1a", "00")).toBeUndefined();
  });
});

describe("applyGameTimes", () => {
  it("開始と終了を入れる", () => {
    const next = applyGameTimes(game(), { startTime: "13:00:00", endTime: "15:20" });
    expect(next.startTime).toBe("13:00");
    expect(next.endTime).toBe("15:20");
  });

  it("空にした項目は消す", () => {
    const next = applyGameTimes(game({ startTime: "13:00", endTime: "15:20" }), {
      startTime: "",
      endTime: "16:00",
    });
    expect(next.startTime).toBeUndefined();
    expect(next.endTime).toBe("16:00");
  });
});

describe("stampStartTime / stampEndTime", () => {
  const at = new Date(2026, 7, 23, 13, 5);

  it("空なら今の時刻を入れる", () => {
    expect(stampStartTime(game(), at).startTime).toBe("13:05");
    expect(stampEndTime(game(), at).endTime).toBe("13:05");
  });

  it("既にある値は上書きしない", () => {
    expect(stampStartTime(game({ startTime: "12:00" }), at).startTime).toBe("12:00");
    expect(stampEndTime(game({ endTime: "16:00" }), at).endTime).toBe("16:00");
  });
});

describe("minutesBetween / formatDuration / gameTimeLabel", () => {
  it("試合時間を分で出す", () => {
    expect(minutesBetween("13:00", "15:20")).toBe(140);
    expect(minutesBetween("13:00", "13:00")).toBe(0);
  });

  it("日をまたいでも計算できる", () => {
    expect(minutesBetween("22:30", "00:15")).toBe(105);
  });

  it("時間の表記が日本語になる", () => {
    expect(formatDuration(20)).toBe("20分");
    expect(formatDuration(120)).toBe("2時間");
    expect(formatDuration(140)).toBe("2時間20分");
  });

  it("開始と終了のラベルを組み立てる", () => {
    expect(gameTimeLabel({})).toBe("");
    expect(gameTimeLabel({ startTime: "13:00" })).toBe("13:00開始");
    expect(gameTimeLabel({ endTime: "15:20" })).toBe("15:20終了");
    expect(gameTimeLabel({ startTime: "13:00", endTime: "15:20" })).toBe("13:00〜15:20（2時間20分）");
  });
});
