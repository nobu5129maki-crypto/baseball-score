import { jerseyLabel, orderLabel } from "@/lib/labels";

export function PlayerIdentity({
  order,
  name,
  number,
  size = "md",
}: {
  order?: number;
  name: string;
  number?: string;
  size?: "sm" | "md" | "lg";
}) {
  const jersey = jerseyLabel(number);
  const orderSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "";
  const nameSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "";
  const jerseySize = size === "lg" ? "text-base" : "text-xs";

  return (
    <span className={`inline-flex items-baseline gap-1.5 min-w-0 max-w-full ${size === "lg" ? "flex-wrap" : ""}`}>
      {order != null ? (
        <span className={`shrink-0 tabular-nums font-bold ${orderSize}`}>{orderLabel(order)}</span>
      ) : null}
      <span className={`font-bold ${size === "lg" ? "break-words" : "truncate"} ${nameSize}`}>{name}</span>
      {jersey ? (
        <span className={`shrink-0 tabular-nums font-semibold text-[#9aa894] print:text-black ${jerseySize}`}>
          {jersey}
        </span>
      ) : null}
    </span>
  );
}
