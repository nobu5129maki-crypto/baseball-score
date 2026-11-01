import type { LegendItem } from "@/lib/print-legend";

export function PrintLegend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="print-legend">
      <h3 className="font-bold mb-1">略語</h3>
      <p className="text-xs leading-relaxed">
        {items.map((item, index) => (
          <span key={`${item.mark}-${item.meaning}`} className="print-legend-item">
            {index > 0 ? "　" : ""}
            {item.mark}＝{item.meaning}
          </span>
        ))}
      </p>
    </section>
  );
}
