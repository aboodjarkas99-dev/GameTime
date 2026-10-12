import type { Pallet, PalletKind, SizeKey } from "./types";

export function formatNum(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

/** 36 pails fill one pallet. Used only after a product is over that amount. */
export function pailSplit(pails: number, per = 36): { pallets: number; extra: number } {
  const size = Math.max(1, Math.round(per));
  const count = Math.max(0, Math.round(pails));
  return { pallets: Math.floor(count / size), extra: count % size };
}

/** Pallet math only when a 5-gallon product is more than one pallet. Otherwise the required amount. */
export function pailExplain(pails: number, per = 36): { line: string; note: string } {
  const size = Math.max(1, Math.round(per));
  const count = Math.max(0, Math.round(pails));
  const pailWord = count === 1 ? "pail" : "pails";
  if (count <= size) return { line: `${formatNum(count)} ${pailWord}`, note: "" };
  const { pallets, extra } = pailSplit(count, size);
  const palletWord = pallets === 1 ? "pallet" : "pallets";
  let line = `${formatNum(count)} ${pailWord} / ${formatNum(pallets)} ${palletWord}`;
  if (extra > 0) line += ` / ${formatNum(extra)} extra`;
  const note = extra > 0 ? "Extra can be loaded with other materials." : "";
  return { line, note };
}

export function formatPct(fill: number): string {
  const pct = Math.round(fill * 100);
  return `${pct}%`;
}

export function packNoun(size: SizeKey, count: number): string {
  const one = count === 1;
  if (size === "gal5") return one ? "pail" : "pails";
  if (size === "vinyl") return one ? "vinyl box" : "vinyl boxes";
  if (size === "drawdown") return one ? "drawdown" : "drawdowns";
  if (size === "pint") return one ? "pint box" : "pint boxes";
  if (size === "quart") return one ? "quart box" : "quart boxes";
  if (size === "gal1") return one ? "1-gallon box" : "1-gallon boxes";
  if (size === "gal125") return one ? "1.25-gallon box" : "1.25-gallon boxes";
  return one ? "1.5-gallon box" : "1.5-gallon boxes";
}

export function sizeTitle(size: SizeKey): string {
  if (size === "quart") return "Quarts";
  if (size === "pint") return "Pints";
  if (size === "gal1") return "1 Gallon";
  if (size === "gal125") return "1.25 Gallons";
  if (size === "gal15") return "1.5 Gallons";
  if (size === "vinyl") return "Paint vinyl box 60 or 64×8×8";
  if (size === "drawdown") return "Paint drawdown 10×8×2";
  return "5 Gallons";
}

export function containerPhrase(size: SizeKey, count: number, per = 36): string {
  const amount = formatNum(count);
  if (size === "gal5") return `${pailExplain(count, per).line} · 5 Gallons`;
  return `${amount} ${packNoun(size, count)}`;
}

export function palletType(kind: PalletKind): "Full" | "Mixed" | "Partial" {
  if (kind === "mixed") return "Mixed";
  if (kind === "partial") return "Partial";
  return "Full";
}

export function kindLabel(pallet: Pick<Pallet, "kind">): string {
  return palletType(pallet.kind);
}

export function kindTone(kind: PalletKind): "ink" | "amber" | "plain" {
  if (kind === "full") return "ink";
  if (kind === "mixed") return "amber";
  return "plain";
}
