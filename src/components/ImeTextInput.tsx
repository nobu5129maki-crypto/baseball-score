"use client";

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type CompositionEvent,
  type FocusEvent,
  type ChangeEvent,
} from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> & {
  value: string;
  /** 変換確定後・通常入力・blur 時に呼ぶ（変換中は呼ばない） */
  onCommit: (value: string) => void;
};

/**
 * 日本語IME変換中に親stateへ毎キー反映しない入力。
 * 変換中のDB保存・再レンダーで漢字変換が壊れる問題を防ぐ。
 */
export function ImeTextInput({ value, onCommit, onBlur, onFocus, ...rest }: Props) {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    // フォーカス中／変換中は親の古い値で上書きしない
    if (!focusedRef.current && !composingRef.current) {
      setDraft(value);
    }
  }, [value]);

  function commit(next: string) {
    setDraft(next);
    if (next !== value) onCommit(next);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setDraft(next);
    const native = e.nativeEvent as InputEvent;
    if (composingRef.current || native.isComposing) return;
    onCommit(next);
  }

  function handleCompositionStart() {
    composingRef.current = true;
  }

  function handleCompositionEnd(e: CompositionEvent<HTMLInputElement>) {
    composingRef.current = false;
    commit(e.currentTarget.value);
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    focusedRef.current = true;
    onFocus?.(e);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    focusedRef.current = false;
    composingRef.current = false;
    commit(e.currentTarget.value);
    onBlur?.(e);
  }

  return (
    <input
      {...rest}
      value={draft}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
