import { pickPlayerProfile } from "./player-profile";
import type { PlayerProfile } from "./types";

export type SharedPlayer = { name: string; number: string; kana?: string } & PlayerProfile;

export type SharedRoster = {
  v: 1;
  name: string;
  players: SharedPlayer[];
};

const PREFIX = "RAKUSCORE1:";

export function encodeRoster(name: string, players: SharedPlayer[]): string {
  const pack: SharedRoster = {
    v: 1,
    name,
    players: players.map((p) => ({
      name: p.name,
      number: p.number,
      ...(p.kana ? { kana: p.kana } : {}),
      ...pickPlayerProfile(p),
    })),
  };
  const json = JSON.stringify(pack);
  return PREFIX + btoa(unescape(encodeURIComponent(json)));
}

export function decodeRoster(raw: string): SharedRoster | null {
  const text = raw.trim();
  try {
    if (text.startsWith(PREFIX)) {
      const json = decodeURIComponent(escape(atob(text.slice(PREFIX.length))));
      const parsed = JSON.parse(json) as SharedRoster;
      if (parsed.v === 1 && parsed.name && Array.isArray(parsed.players)) return parsed;
    }
    const parsed = JSON.parse(text) as SharedRoster;
    if (parsed.v === 1 && parsed.name && Array.isArray(parsed.players)) return parsed;
  } catch {
    return parsePlain(text);
  }
  return parsePlain(text);
}

function parsePlain(text: string): SharedRoster | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const name = lines[0].replace(/^チーム[:：]/, "").trim();
  const players: SharedPlayer[] = [];
  for (const line of lines.slice(1)) {
    const [n, pname, kana] = line.split(/[,、\t]/).map((s) => s.trim());
    if (!pname && !n) continue;
    if (/^\d+$/.test(n)) players.push({ number: n, name: pname || n, kana });
    else players.push({ number: "", name: n, kana: pname });
  }
  if (!name || players.length === 0) return null;
  return { v: 1, name, players };
}
