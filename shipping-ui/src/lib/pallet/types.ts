export const SIZE_ORDER = ["gal5", "gal15", "gal125", "gal1", "quart", "pint", "vinyl", "drawdown"] as const;

export type SizeKey = (typeof SIZE_ORDER)[number];

export type MixGroup = "small" | "pail";

export type PalletRule = {
  size: SizeKey;
  label: string;
  unitsPerCase: number;
  casesPerLayer: number;
  layers: number;
  mixGroup: MixGroup;
  poundsPerUnit: number;
};

export type OrderLine = {
  id: string;
  sku: string;
  description: string;
  size: SizeKey;
  qty: number;
};

export type Settings = {
  mixSmall: boolean;
  palletTareLb: number;
};

export type PalletKind = "full" | "mixed" | "partial";

export type PlanLine = {
  sku: string;
  description: string;
  size: SizeKey;
  units: number;
  packs: number;
  loose: number;
  pounds: number;
  /** Paint gallons: 1, 2, or 4 gallon box. Three gallons use a 4 gallon box. */
  boxKind?: 1 | 2 | 4;
  /** Boxes or loose cans sitting on a pallet of pails, not the pallet itself. */
  onTop: boolean;
};

export type Pallet = {
  number: number;
  kind: PalletKind;
  /** straight = peeled off one SKU; combined = built from remainders */
  source: "straight" | "combined";
  fill: number;
  lines: PlanLine[];
  units: number;
  packs: number;
  loose: number;
  pounds: number;
  note: string;
};

export type LineCalc = {
  id: string;
  sku: string;
  description: string;
  size: SizeKey;
  qty: number;
  packs: number;
  loose: number;
  fullPallets: number;
  unitsOnFull: number;
  remainderUnits: number;
  remainderPacks: number;
  remainderLoose: number;
  palletNumbers: number[];
};

export type SizeRollup = {
  size: SizeKey;
  units: number;
  packs: number;
  loose: number;
  straightFull: number;
  remainderUnits: number;
  extraFull: number;
  partialUnits: number;
  partialFill: number;
  pounds: number;
};

export type PlanTotals = {
  pallets: number;
  full: number;
  mixed: number;
  partial: number;
  units: number;
  packs: number;
  productLb: number;
  grossLb: number;
};

export type Plan = {
  pallets: Pallet[];
  lines: LineCalc[];
  bySize: SizeRollup[];
  totals: PlanTotals;
};

export type WorkbookInput = {
  orderName: string;
  customer: string;
  date: string;
  notes: string;
  mixSmall: boolean;
  palletTareLb: number;
  rules: PalletRule[];
  lines: OrderLine[];
};

export function isSizeKey(value: string): value is SizeKey {
  return (SIZE_ORDER as readonly string[]).includes(value);
}

export function unitsPerPallet(rule: PalletRule): number {
  return rule.unitsPerCase * rule.casesPerLayer * rule.layers;
}

export function packsPerPallet(rule: PalletRule): number {
  return rule.casesPerLayer * rule.layers;
}

export function ruleFor(rules: PalletRule[], size: SizeKey): PalletRule {
  const rule = rules.find((item) => item.size === size);
  if (!rule) throw new Error(`Missing pallet rule for ${size}`);
  return rule;
}

export function ruleError(rules: PalletRule[]): string | null {
  const seen = new Set<SizeKey>();
  for (const rule of rules) {
    if (!isSizeKey(rule.size)) return "Unknown container size in the pallet rules.";
    if (seen.has(rule.size)) return `Duplicate rule for ${rule.label}.`;
    seen.add(rule.size);
    if (rule.unitsPerCase < 1 || rule.casesPerLayer < 1 || rule.layers < 1) {
      return `${rule.label} needs at least 1 per pack, 1 per layer, and 1 layer.`;
    }
    if (rule.poundsPerUnit < 0) return `${rule.label} weight can't be negative.`;
  }
  for (const size of SIZE_ORDER) {
    if (!seen.has(size)) return "Each container size needs a pallet rule.";
  }
  return null;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
