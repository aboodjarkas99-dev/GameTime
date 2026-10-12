import type { SizeKey } from "./types";

/** 48×40 deck. One inch stays clear on every side so nothing hangs past the boards. */
export const PALLET_LENGTH = 48;
export const PALLET_WIDTH = 40;
export const EDGE_CLEAR = 1;
export const USABLE_LENGTH = PALLET_LENGTH - EDGE_CLEAR * 2;
export const USABLE_WIDTH = PALLET_WIDTH - EDGE_CLEAR * 2;
/** Product only. A finished pallet stays at or under this height. */
export const MAX_STACK = 60;

export type PackageSpec = {
  key: string;
  label: string;
  length: number;
  width: number;
  height: number;
};

/** Larger end of each typical range, so the inch of clearance still holds. */
export const PACKAGES = {
  quart4: { key: "quart4", label: "4 Quart", length: 10.25, width: 10.25, height: 6.2 },
  quart2: { key: "quart2", label: "2 Quart", length: 11.6, width: 6.4, height: 8.3 },
  gal1: { key: "gal1", label: "1 Gallon", length: 6.88, width: 6.88, height: 7.88 },
  gal2: { key: "gal2", label: "2 Gallon", length: 17, width: 8.5, height: 9.3 },
  gal4: { key: "gal4", label: "4 Gallon", length: 17, width: 17, height: 9.31 },
  pail5: { key: "pail5", label: "5 Gallon", length: 12.5, width: 12.5, height: 15.1 },
  vinyl: { key: "vinyl", label: "Paint vinyl", length: 64, width: 8, height: 8 },
  drawdown: { key: "drawdown", label: "Paint drawdown", length: 10, width: 8, height: 2 },
  pint: { key: "pint", label: "4 Pint", length: 10.25, width: 10.25, height: 6.2 },
} as const satisfies Record<string, PackageSpec>;

export type GridFit = {
  across: number;
  deep: number;
  perLayer: number;
  layersHigh: number;
  perPallet: number;
  face: number;
  depth: number;
  height: number;
};

/** Try both turns. Keep the turn that fits more, then the one that leaves less open edge. */
export function bestFit(spec: PackageSpec): GridFit {
  const turns = [
    { face: spec.length, depth: spec.width },
    { face: spec.width, depth: spec.length },
  ];
  let best: GridFit | null = null;
  for (const turn of turns) {
    const across = Math.floor(USABLE_LENGTH / turn.face);
    const deep = Math.floor(USABLE_WIDTH / turn.depth);
    if (across < 1 || deep < 1) continue;
    const perLayer = across * deep;
    const layersHigh = Math.max(1, Math.floor(MAX_STACK / spec.height));
    const leftover =
      2 * (USABLE_LENGTH - across * turn.face) + 2 * (USABLE_WIDTH - deep * turn.depth);
    const fit: GridFit = {
      across,
      deep,
      perLayer,
      layersHigh,
      perPallet: perLayer * layersHigh,
      face: turn.face,
      depth: turn.depth,
      height: spec.height,
    };
    if (
      !best ||
      fit.perLayer > best.perLayer ||
      (fit.perLayer === best.perLayer && leftover < leftoverOf(best))
    ) {
      best = fit;
    }
  }
  if (!best) {
    return {
      across: 1,
      deep: 1,
      perLayer: 1,
      layersHigh: 1,
      perPallet: 1,
      face: spec.length,
      depth: spec.width,
      height: spec.height,
    };
  }
  return best;
}

function leftoverOf(fit: GridFit): number {
  return 2 * (USABLE_LENGTH - fit.across * fit.face) + 2 * (USABLE_WIDTH - fit.deep * fit.depth);
}

export function packageFor(size: SizeKey, boxKind?: number): PackageSpec | null {
  if (size === "gal5") return PACKAGES.pail5;
  if (size === "vinyl") return PACKAGES.vinyl;
  if (size === "drawdown") return PACKAGES.drawdown;
  if (size === "pint") return PACKAGES.pint;
  if (size === "quart") return PACKAGES.quart4;
  if (size === "gal1") {
    if (boxKind === 1) return PACKAGES.gal1;
    if (boxKind === 2) return PACKAGES.gal2;
    return PACKAGES.gal4;
  }
  return null;
}

export type SideLayer = {
  slots: number;
  face: number;
  height: number;
};

export type SideBand = {
  name: string;
  spec: PackageSpec | null;
  count: number;
  across: number;
  deep: number;
  layers: SideLayer[];
  measured: boolean;
};

export function layerGrid(size: SizeKey, boxKind?: number): { across: number; deep: number; perLayer: number } {
  if (size === "gal5") return { across: 4, deep: 3, perLayer: 12 };
  if (size === "quart") return { across: 5, deep: 4, perLayer: 20 };
  if (size === "gal125") return { across: 4, deep: 3, perLayer: 12 };
  if (size === "gal1" && boxKind === 1) return { across: 6, deep: 5, perLayer: 30 };
  if (size === "gal1" && boxKind === 2) return { across: 5, deep: 2, perLayer: 10 };
  if (size === "gal1") return { across: 3, deep: 2, perLayer: 6 };
  if (size === "vinyl") return { across: 1, deep: 1, perLayer: 1 };
  if (size === "drawdown") return { across: 4, deep: 4, perLayer: 16 };
  if (size === "pint") return { across: 5, deep: 4, perLayer: 20 };
  return { across: 4, deep: 3, perLayer: 12 };
}

export type BuildStep = {
  sku: string;
  description: string;
  size: SizeKey;
  boxKind?: number;
  pail: boolean;
  across: number;
  deep: number;
  slots: number;
  repeats: number;
  layerFrom: number;
  layerTo: number;
};

/** Bottom to top. Full layers of one product share one drawing. */
export function buildSteps(
  lines: { sku: string; description: string; size: SizeKey; units: number; packs: number; boxKind?: number }[],
): BuildStep[] {
  const ordered = [...lines].sort((a, b) => stackRank(a) - stackRank(b) || a.sku.localeCompare(b.sku));
  const steps: BuildStep[] = [];
  let next = 1;
  for (const line of ordered) {
    const grid = layerGrid(line.size, line.boxKind);
    const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : Math.max(line.units, 1);
    if (count <= 0) continue;
    const full = Math.floor(count / grid.perLayer);
    const rem = count % grid.perLayer;
    if (full > 0) {
      steps.push({
        sku: line.sku,
        description: line.description,
        size: line.size,
        boxKind: line.boxKind,
        pail: line.size === "gal5",
        across: grid.across,
        deep: grid.deep,
        slots: grid.perLayer,
        repeats: full,
        layerFrom: next,
        layerTo: next + full - 1,
      });
      next += full;
    }
    if (rem > 0) {
      steps.push({
        sku: line.sku,
        description: line.description,
        size: line.size,
        boxKind: line.boxKind,
        pail: line.size === "gal5",
        across: grid.across,
        deep: grid.deep,
        slots: rem,
        repeats: 1,
        layerFrom: next,
        layerTo: next,
      });
      next += 1;
    }
  }
  return steps;
}

/** Tall end of the carton, so the 60 in cap still holds. */
export function containerHeight(size: SizeKey, boxKind?: number): number {
  if (size === "gal5") return PACKAGES.pail5.height;
  if (size === "quart") return PACKAGES.quart4.height;
  if (size === "gal1" && boxKind === 1) return PACKAGES.gal1.height;
  if (size === "gal1" && boxKind === 2) return PACKAGES.gal2.height;
  if (size === "gal125" || size === "gal15") return 10.5;
  if (size === "vinyl") return PACKAGES.vinyl.height;
  if (size === "drawdown") return PACKAGES.drawdown.height;
  if (size === "pint") return PACKAGES.pint.height;
  return PACKAGES.gal4.height;
}

export function stackInches(
  lines: { sku: string; description: string; size: SizeKey; units: number; packs: number; boxKind?: number }[],
): number {
  return buildSteps(lines).reduce(
    (sum, step) => sum + step.repeats * containerHeight(step.size, step.boxKind),
    0,
  );
}

/** Pails sit on the deck. Bigger cartons go above them. Smaller cartons go last. */
export function stackRank(line: { size: SizeKey; boxKind?: number }): number {
  if (line.size === "gal5") return 0;
  const spec = packageFor(line.size, line.boxKind);
  const area = spec ? spec.length * spec.width : 90;
  return 10000 - area;
}

export function sideBands(
  lines: { sku: string; description: string; size: SizeKey; units: number; packs: number; boxKind?: number; onTop: boolean }[],
): SideBand[] {
  const ordered = [...lines].sort(
    (a, b) => stackRank(a) - stackRank(b) || a.sku.localeCompare(b.sku),
  );
  return ordered.map((line) => {
    const spec = packageFor(line.size, line.boxKind);
    const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : Math.max(line.units, 1);
    const name = line.description.trim() || line.sku;
    if (!spec) {
      const slots = Math.min(Math.max(count, 1), 4);
      return {
        name,
        spec: null,
        count,
        across: slots,
        deep: 1,
        layers: [{ slots, face: 9, height: 7 }],
        measured: false,
      };
    }
    const fit = bestFit(spec);
    const full = Math.floor(count / fit.perLayer);
    const rem = count % fit.perLayer;
    const layers: SideLayer[] = [];
    for (let index = 0; index < full; index += 1) {
      layers.push({ slots: fit.across, face: fit.face, height: fit.height });
    }
    if (rem > 0) {
      const front = Math.min(fit.across, rem);
      layers.push({ slots: front, face: fit.face, height: fit.height });
    }
    if (layers.length === 0 && count > 0) {
      layers.push({ slots: 1, face: fit.face, height: fit.height });
    }
    return { name, spec, count, across: fit.across, deep: fit.deep, layers, measured: true };
  });
}

export function stackHeight(bands: SideBand[]): number {
  return bands.reduce(
    (sum, band) => sum + band.layers.reduce((layerSum, layer) => layerSum + layer.height, 0),
    0,
  );
}
