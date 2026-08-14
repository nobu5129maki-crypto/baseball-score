"use client";

import { useMemo, useState } from "react";
import { kanjiCandidates } from "@/lib/kanji-names";

export function KanjiNameField({
  value,
  onChange,
  placeholder = "選手名",
}: {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}) {
  const [kana, setKana] = useState("");
  const candidates = useMemo(() => kanjiCandidates(kana || value), [kana, value]);

  return (
    <div className="flex flex-col gap-2">
      <input
        className="tap px-3 bg-[#121a14]"
        lang="ja"
        autoCapitalize="off"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="tap px-3 bg-[#070a08] min-h-12 text-sm"
        lang="ja"
        autoCapitalize="off"
        placeholder="ひらがな → 漢字候補"
        value={kana}
        onChange={(e) => setKana(e.target.value)}
      />
      {candidates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <button
              key={c}
              type="button"
              className="tap tap-accent px-3 min-h-12 text-sm"
              onClick={() => {
                onChange(c);
                setKana("");
              }}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
