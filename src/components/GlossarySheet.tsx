import { GLOSSARY, glossaryById } from "@/lib/glossary";
import { Sheet } from "./Sheet";

export function GlossarySheet({
  termId,
  onClose,
}: {
  termId: string | "index";
  onClose: () => void;
}) {
  if (termId === "index") {
    return (
      <Sheet title="これのこと？" onClose={onClose}>
        <ul className="space-y-2">
          {GLOSSARY.map((g) => (
            <li key={g.id} className="rounded-xl border border-[#2c3c30] p-3">
              <p className="font-bold">{g.title}</p>
              <p className="text-sm text-[#d5dccf] mt-1">{g.plain}</p>
              <p className="text-xs text-[#9aa894] mt-1">こんなとき: {g.when}</p>
              <p className="text-xs text-[#9aa894] mt-1">スコアブック: {g.symbol}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    );
  }

  const g = glossaryById(termId);
  if (!g) return null;
  return (
    <Sheet title={g.title} onClose={onClose}>
      <p className="text-base leading-relaxed">{g.plain}</p>
      <p className="text-sm text-[#9aa894] mt-3">こんなときに使う</p>
      <p className="text-sm mt-1">{g.when}</p>
      <p className="text-xs text-[#9aa894] mt-4">スコアブック記号: {g.symbol}</p>
    </Sheet>
  );
}
