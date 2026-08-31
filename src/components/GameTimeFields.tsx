"use client";

import { useEffect, useRef, useState } from "react";
import { clockTime, formatClockJa, partsToTime, timeToParts } from "@/lib/game-time";

/** 試合開始後に一度だけ出す。時刻を入れると確認表示へ切り替わる */
export function StartTimePrompt({ onSave }: { onSave: (time: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="mx-3 my-2 rounded-2xl border-2 border-[#f5c518] bg-[#1a281c] px-3 py-3">
      <p className="text-sm font-bold text-[#f5c518]">開始時間</p>
      <p className="text-xs text-[#9aa894] mt-1 mb-2 leading-relaxed">
        試合の開始時刻を入れてください。「今」でも好きな時刻でも大丈夫です。
      </p>
      <TimeField
        label="開始時間"
        value={value}
        onChange={(next) => {
          setValue(next);
          if (next) onSave(next);
        }}
      />
    </div>
  );
}

/** 設定完了のひとこと。少し見せてから静かに消える */
export function StartTimeConfirmed({
  time,
  onDismiss,
  onEdit,
}: {
  time: string;
  onDismiss: () => void;
  onEdit: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), 4200);
    const gone = window.setTimeout(onDismiss, 5000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, [onDismiss]);

  return (
    <div
      className={`mx-3 my-2 rounded-2xl border border-[#3ddc84]/50 bg-[#122018] px-3 py-3 transition-opacity duration-700 ${leaving ? "opacity-0" : "opacity-100"}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-bold text-[#3ddc84] leading-relaxed">
        試合開始は、{formatClockJa(time)}と設定されました
      </p>
      <p className="text-xs text-[#9aa894] mt-1 leading-relaxed">このまま記録に進めます。</p>
      <div className="flex gap-3 mt-2">
        <button type="button" className="text-xs font-bold text-[#9aa894] underline" onClick={onEdit}>
          時刻をなおす
        </button>
        <button type="button" className="text-xs font-bold text-[#9aa894] underline" onClick={onDismiss}>
          閉じる
        </button>
      </div>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const parts = timeToParts(value);
  const [hour, setHour] = useState(parts.hour);
  const [minute, setMinute] = useState(parts.minute);
  const emitted = useRef(value);
  const draft = useRef({ hour: parts.hour, minute: parts.minute, value });
  draft.current = { hour, minute, value };

  useEffect(() => {
    if (value === emitted.current) return;
    const next = timeToParts(value);
    setHour(next.hour);
    setMinute(next.minute);
    emitted.current = value;
  }, [value]);

  function commit(nextHour: string, nextMinute: string, fromBlur = false) {
    draft.current = { ...draft.current, hour: nextHour, minute: nextMinute };
    setHour(nextHour);
    setMinute(nextMinute);
    if (!nextHour && !nextMinute) {
      emitted.current = "";
      onChange("");
      return;
    }
    const minuteReady = fromBlur || nextMinute.length === 2;
    if (!minuteReady) return;
    const paddedMinute = fromBlur && nextHour && !nextMinute ? "00" : nextMinute;
    const time = partsToTime(nextHour, paddedMinute);
    if (!time) {
      if (!fromBlur) return;
      const next = timeToParts(draft.current.value);
      setHour(next.hour);
      setMinute(next.minute);
      return;
    }
    if (fromBlur) {
      const next = timeToParts(time);
      draft.current = { hour: next.hour, minute: next.minute, value: time };
      setHour(next.hour);
      setMinute(next.minute);
    }
    emitted.current = time;
    onChange(time);
  }

  function finishIfLeft(root: HTMLElement) {
    window.setTimeout(() => {
      if (root.contains(document.activeElement)) return;
      const next = draft.current;
      commit(next.hour, next.minute, true);
    }, 0);
  }

  function stampNow() {
    const time = clockTime();
    const next = timeToParts(time);
    draft.current = { hour: next.hour, minute: next.minute, value: time };
    setHour(next.hour);
    setMinute(next.minute);
    emitted.current = time;
    onChange(time);
  }

  return (
    <fieldset onBlur={(e) => finishIfLeft(e.currentTarget)}>
      <legend className="text-sm text-[#9aa894] mb-1">{label}</legend>
      <div className="flex gap-2 items-center">
        <DigitField
          ariaLabel={`${label}の時`}
          placeholder="13"
          suffix="時"
          value={hour}
          onChange={(next) => commit(next, draft.current.minute)}
        />
        <DigitField
          ariaLabel={`${label}の分`}
          placeholder="00"
          suffix="分"
          value={minute}
          onChange={(next) => commit(draft.current.hour, next)}
        />
        <button type="button" className="tap px-3 text-sm shrink-0" onClick={stampNow}>
          今
        </button>
      </div>
    </fieldset>
  );
}

function DigitField({
  ariaLabel,
  placeholder,
  suffix,
  value,
  onChange,
}: {
  ariaLabel: string;
  placeholder: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 min-w-0 flex-1">
      <input
        className="tap px-3 bg-[#121a14] w-full min-w-0 text-center tabular-nums"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={2}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
      />
      <span className="text-sm text-[#9aa894] shrink-0">{suffix}</span>
    </label>
  );
}
