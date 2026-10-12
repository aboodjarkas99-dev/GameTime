import type { OrderLine, PalletRule, Settings } from "./types";

/** Layer counts from the floor. Full pallets stay at or under 60 in: pails 3×15.1, quarts 9×6.2, 4-gal boxes 5×9.31. */
export const DEFAULT_RULES: PalletRule[] = [
  {
    size: "quart",
    label: "Quart",
    unitsPerCase: 4,
    casesPerLayer: 20,
    layers: 9,
    mixGroup: "small",
    poundsPerUnit: 3,
  },
  {
    size: "pint",
    label: "Pint",
    unitsPerCase: 4,
    casesPerLayer: 20,
    layers: 9,
    mixGroup: "small",
    poundsPerUnit: 2,
  },
  {
    size: "gal1",
    label: "1 Gal",
    unitsPerCase: 4,
    casesPerLayer: 6,
    layers: 5,
    mixGroup: "small",
    poundsPerUnit: 11,
  },
  {
    size: "gal125",
    label: "1.25 Gal",
    unitsPerCase: 2,
    casesPerLayer: 12,
    layers: 4,
    mixGroup: "small",
    poundsPerUnit: 14,
  },
  {
    size: "gal15",
    label: "1.5 Gal",
    unitsPerCase: 2,
    casesPerLayer: 40,
    layers: 1,
    mixGroup: "small",
    poundsPerUnit: 16,
  },
  {
    size: "gal5",
    label: "5 Gal",
    unitsPerCase: 1,
    casesPerLayer: 12,
    layers: 3,
    mixGroup: "pail",
    poundsPerUnit: 55,
  },
  {
    size: "vinyl",
    label: "Paint vinyl box 60 or 64×8×8",
    unitsPerCase: 1,
    casesPerLayer: 1,
    layers: 7,
    mixGroup: "pail",
    poundsPerUnit: 12,
  },
  {
    size: "drawdown",
    label: "Paint drawdown 10×8×2",
    unitsPerCase: 1,
    casesPerLayer: 16,
    layers: 30,
    mixGroup: "pail",
    poundsPerUnit: 1,
  },
];

export const DEFAULT_SETTINGS: Settings = {
  mixSmall: true,
  palletTareLb: 45,
};

export const SAMPLE_META = {
  orderName: "134626-SAA",
  customer: "Sports Floors Inc.",
  notes: "PO 1720",
};

/** Shipment 134626 — the GameTime packing slip shape. */
export const SAMPLE_LINES: OrderLine[] = [
  { id: "s1", sku: "GT500-F", description: "Sport Poly Oil Finish", size: "gal5", qty: 216 },
  { id: "s2", sku: "GTHS-5", description: "Hybild Sealer", size: "gal5", qty: 36 },
  { id: "s3", sku: "GTOT-5", description: "OverTime Finish 2k Part A", size: "gal5", qty: 36 },
  { id: "s4", sku: "GTOTCAT-QT", description: "OverTime Catalyst Part B", size: "quart", qty: 36 },
  { id: "s5", sku: "GTCWP-1", description: "Chameleon Paint H2O Based", size: "gal1", qty: 2 },
];
