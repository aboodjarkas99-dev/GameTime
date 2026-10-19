import { packNoun, palletType } from "./format";
import { MAX_STACK, containerHeight, layerGrid } from "./layout";
import { isOvertime8ozText } from "./parse";
import {
  SIZE_ORDER,
  type LineCalc,
  type OrderLine,
  type Pallet,
  type PalletKind,
  type PalletRule,
  type Plan,
  type PlanLine,
  type Settings,
  type SizeKey,
  type SizeRollup,
  packsPerPallet,
  ruleError,
  ruleFor,
  unitsPerPallet,
} from "./types";

type PoolItem = {
  sku: string;
  description: string;
  size: SizeKey;
  units: number;
  perBox: number;
  onTop: boolean;
  /** Paint box size. Three gallons are stored as a 4 gallon box. */
  boxKind?: 1 | 2 | 4;
  /** Set when a partial box still counts, such as 3 gallons in a 4 gallon box. */
  boxes?: number;
};

/** Most pail pallets take 6 boxes on top. Xcel pails take 9. */
const TOP_BOX_LIMIT = 6;
const XCEL_TOP_BOX_LIMIT = 9;

function canon(text: string): string {
  return text.toLowerCase().replace(/excel/g, "xcel");
}

function isXcel(item: Pick<PoolItem, "sku" | "description">): boolean {
  return /xcel/.test(canon(`${item.sku} ${item.description}`));
}

function itemKey(item: Pick<PoolItem, "sku" | "description" | "size" | "onTop" | "boxKind">): string {
  const identity = productLabel(item.sku, item.description, item.size).toUpperCase();
  return `${item.size}\0${identity}\0${item.onTop ? "top" : "base"}\0${item.boxKind ?? ""}`;
}

type Draft = {
  items: Map<string, PoolItem>;
  source: "straight" | "combined";
};

const MIX_PRIORITY: SizeKey[] = ["gal15", "gal125", "gal1", "quart", "pint", "gal5"];

function perBoxFor(
  item: Pick<PoolItem, "sku" | "description" | "size">,
  rule: PalletRule,
): number {
  const text = canon(`${item.sku} ${item.description}`);
  if (item.size === "quart" && /cataly|catylist|gtotcat/.test(text)) return 9;
  if (item.size === "gal1" && /xcel/.test(text)) return 4;
  return rule.unitsPerCase;
}

export function unitsInBox(
  item: { sku: string; description: string; size: SizeKey },
  rules: PalletRule[],
): number {
  return perBoxFor(item, ruleFor(rules, item.size));
}

export function isPaintGallon(item: { sku: string; description: string; size: SizeKey }): boolean {
  if (item.size !== "gal1") return false;
  const text = canon(`${item.sku} ${item.description}`);
  if (/xcel/.test(text)) return false;
  return /paint|chameleon|\bcwp\b/.test(text);
}

/** 1, 2, or 4 gallon boxes. A remainder of 3 gallons fills a 4 gallon box. */
function paintBoxes(qty: number): { kind: 1 | 2 | 4; units: number }[] {
  const boxes: { kind: 1 | 2 | 4; units: number }[] = [];
  let left = Math.max(0, qty);
  while (left >= 4) {
    boxes.push({ kind: 4, units: 4 });
    left -= 4;
  }
  if (left === 3) boxes.push({ kind: 4, units: 3 });
  else if (left === 2) boxes.push({ kind: 2, units: 2 });
  else if (left === 1) boxes.push({ kind: 1, units: 1 });
  return boxes;
}

function addItem(draft: Draft, item: PoolItem, units: number, boxes?: number) {
  const key = itemKey(item);
  const addBoxes = boxes ?? (units === item.units ? item.boxes : undefined);
  const existing = draft.items.get(key);
  if (existing) {
    existing.units += units;
    if (addBoxes != null) existing.boxes = (existing.boxes ?? 0) + addBoxes;
  } else {
    draft.items.set(key, { ...item, units, boxes: addBoxes });
  }
}

function draftRank(draft: Draft, lines: OrderLine[]): number {
  let best = 100000;
  for (const item of draft.items.values()) {
    const idx = lines.findIndex((line) => {
      const sku = (line.sku.trim() || "UNASSIGNED").toUpperCase();
      return line.size === item.size && sku === item.sku.toUpperCase();
    });
    if (idx >= 0 && idx < best) best = idx;
  }
  return best;
}

function emptyDraft(source: Draft["source"]): Draft {
  return { items: new Map(), source };
}

function activeLines(lines: OrderLine[]): OrderLine[] {
  return lines.filter((line) => line.qty > 0);
}

function mergeSameSku(lines: OrderLine[]): OrderLine[] {
  const map = new Map<string, OrderLine>();
  for (const line of lines) {
    const sku = line.sku.trim() || "UNASSIGNED";
    const plain = line.description.replace(/\s*\[\[[^\]]+\]\]\s*/g, " ").replace(/\s+/g, " ").trim();
    const color = (line.description.match(/\[\[([^[\]]+)\]\]/)?.[1] ?? "").trim();
    const distinct = line.size === "drawdown" || line.size === "vinyl" || Boolean(color) || /hybild|tinted/i.test(`${line.sku} ${plain}`);
    const named = distinct ? productLabel(line.sku, plain, line.size).toUpperCase() : "";
    const key = distinct
      ? `${line.size}\0${sku.toUpperCase()}\0${color.toUpperCase()}\0${named}`
      : `${line.size}\0${sku.toUpperCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += line.qty;
      if (!existing.description.trim() && plain) existing.description = plain;
    } else {
      map.set(key, {
        ...line,
        sku,
        description: color ? `${plain} [[${color}]]` : plain,
        qty: line.qty,
      });
    }
  }
  return [...map.values()];
}

export function paintRowName(sku: string, description: string, size?: SizeKey): string {
  const detail = paintDetail(sku, description);
  if (detail && size === "gal1") {
    const tint = slipColor(description);
    return [detail.title, tint || detail.color].filter(Boolean).join(" · ");
  }
  return productLabel(sku, description, size);
}

export function readPaintMix(description: string): { name: string; units: number }[] | null {
  const raw = description.match(/\[\[MIX:([^\]]+)\]\]/)?.[1];
  if (!raw) return null;
  return raw.split("|").flatMap((piece) => {
    const cut = piece.lastIndexOf("=");
    if (cut <= 0) return [];
    const units = Number(piece.slice(cut + 1));
    const name = piece.slice(0, cut);
    return name && units > 0 ? [{ name, units }] : [];
  });
}

export function paintShareBoxes(
  lines: { sku: string; description: string; size: SizeKey; qty: number }[],
): { kind: 1 | 2 | 4; boxes: number }[] {
  const gallons = lines
    .filter((line) => isPaintGallon(line))
    .reduce((sum, line) => sum + Math.max(0, Math.round(line.qty)), 0);
  const counts = new Map<1 | 2 | 4, number>();
  for (const slot of paintBoxes(gallons)) counts.set(slot.kind, (counts.get(slot.kind) ?? 0) + 1);
  return ([4, 2, 1] as const).flatMap((kind) => {
    const boxes = counts.get(kind) ?? 0;
    return boxes > 0 ? [{ kind, boxes }] : [];
  });
}

/** Quarts that are not catalyst. They pack 4 to a box and colors can share. */
export function isSharedQuart(item: { sku: string; description: string; size?: SizeKey }): boolean {
  if (item.size != null && item.size !== "quart") return false;
  return !/cataly|catylist|gtotcat/i.test(`${item.sku} ${item.description}`);
}

/** Same box math as paint gallons: 4 to a box, 3 fills a 4-box, then 2 or 1. */
export function quartShareBoxes(
  lines: { sku: string; description: string; size: SizeKey; qty: number }[],
): { kind: 1 | 2 | 4; boxes: number }[] {
  const quarts = lines
    .filter((line) => line.size === "quart" && isSharedQuart(line))
    .reduce((sum, line) => sum + Math.max(0, Math.round(line.qty)), 0);
  const counts = new Map<1 | 2 | 4, number>();
  for (const slot of paintBoxes(quarts)) counts.set(slot.kind, (counts.get(slot.kind) ?? 0) + 1);
  return ([4, 2, 1] as const).flatMap((kind) => {
    const boxes = counts.get(kind) ?? 0;
    return boxes > 0 ? [{ kind, boxes }] : [];
  });
}

type GallonLot = {
  sku: string;
  description: string;
  per: number;
  paint: boolean;
  pieces: { kind: 1 | 2 | 4; units: number }[] | null;
  boxes: number;
  loose: number;
};

function sharedPaintLots(lines: OrderLine[]): GallonLot[] {
  const queue = lines
    .filter((line) => line.qty > 0)
    .map((line) => ({ sku: line.sku, description: line.description, left: Math.round(line.qty) }));
  const total = queue.reduce((sum, line) => sum + line.left, 0);
  const grouped = new Map<string, { lot: GallonLot; pieceUnits: number[] }>();
  for (const slot of paintBoxes(total)) {
    let need = slot.units;
    const parts: { sku: string; description: string; units: number }[] = [];
    while (need > 0 && queue.length > 0) {
      const lot = queue[0];
      const take = Math.min(need, lot.left);
      parts.push({ sku: lot.sku, description: lot.description, units: take });
      lot.left -= take;
      need -= take;
      if (lot.left <= 0) queue.shift();
    }
    if (parts.length === 0) continue;
    const mixed = parts.length > 1;
    const description = mixed
      ? `Chameleon Paint [[MIX:${parts
          .map((part) => `${paintRowName(part.sku, part.description, "gal1").replace(/[|=]/g, " ")}=${part.units}`)
          .join("|")}]]`
      : parts[0].description;
    const key = `${slot.kind}\0${description}`;
    const group = grouped.get(key) ?? {
      lot: {
        sku: parts[0].sku,
        description,
        per: slot.kind,
        paint: true,
        pieces: null,
        boxes: 0,
        loose: 0,
      },
      pieceUnits: [],
    };
    group.lot.boxes += 1;
    group.pieceUnits.push(slot.units);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => ({
    ...group.lot,
    pieces: group.pieceUnits.map((units) => ({ kind: group.lot.per as 1 | 2 | 4, units })),
  }));
}

function sharedQuartLots(lines: OrderLine[]): GallonLot[] {
  const queue = lines
    .filter((line) => line.qty > 0 && isSharedQuart(line))
    .map((line) => ({ sku: line.sku, description: line.description, left: Math.round(line.qty) }));
  const total = queue.reduce((sum, line) => sum + line.left, 0);
  const grouped = new Map<string, { lot: GallonLot; pieceUnits: number[] }>();
  for (const slot of paintBoxes(total)) {
    let need = slot.units;
    const parts: { sku: string; description: string; units: number }[] = [];
    while (need > 0 && queue.length > 0) {
      const lot = queue[0];
      const take = Math.min(need, lot.left);
      parts.push({ sku: lot.sku, description: lot.description, units: take });
      lot.left -= take;
      need -= take;
      if (lot.left <= 0) queue.shift();
    }
    if (parts.length === 0) continue;
    const mixed = parts.length > 1;
    const description = mixed
      ? `Quarts [[MIX:${parts
          .map((part) => `${productLabel(part.sku, part.description, "quart").replace(/[|=]/g, " ")}=${part.units}`)
          .join("|")}]]`
      : parts[0].description;
    const key = `${slot.kind}\0${description}`;
    const group = grouped.get(key) ?? {
      lot: {
        sku: parts[0].sku,
        description,
        per: slot.kind,
        paint: false,
        pieces: null,
        boxes: 0,
        loose: 0,
      },
      pieceUnits: [],
    };
    group.lot.boxes += 1;
    group.pieceUnits.push(slot.units);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => ({
    ...group.lot,
    pieces: group.pieceUnits.map((units) => ({ kind: group.lot.per as 1 | 2 | 4, units })),
  }));
}

function packGallonBoxes(
  lines: OrderLine[],
  rule: PalletRule,
): { full: Draft[]; leftover: PoolItem[] } {
  const boxLimit = Math.max(1, rule.casesPerLayer * rule.layers);
  const merged = mergeSameSku(lines);
  const lots: GallonLot[] = [
    ...sharedPaintLots(merged.filter((line) => isPaintGallon(line))),
    ...merged
      .filter((line) => !isPaintGallon(line))
      .map((line) => {
        const per = Math.max(1, perBoxFor(line, rule));
        return {
          sku: line.sku,
          description: line.description,
          per,
          paint: false,
          pieces: null,
          boxes: Math.floor(Math.max(0, line.qty) / per),
          loose: Math.max(0, line.qty) % per,
        };
      }),
  ];
  const full: Draft[] = [];
  const boxCount = () => lots.reduce((sum, lot) => sum + lot.boxes, 0);
  while (boxCount() >= boxLimit) {
    const draft = emptyDraft("combined");
    let need = boxLimit;
    for (const lot of lots) {
      if (need === 0 || lot.boxes <= 0) continue;
      const take = Math.min(lot.boxes, need);
      if (lot.pieces) {
        const taken = lot.pieces.splice(0, take);
        const groups = new Map<1 | 2 | 4, { units: number; boxes: number }>();
        for (const piece of taken) {
          const group = groups.get(piece.kind) ?? { units: 0, boxes: 0 };
          group.units += piece.units;
          group.boxes += 1;
          groups.set(piece.kind, group);
        }
        for (const [kind, group] of groups) {
          addItem(
            draft,
            {
              sku: lot.sku,
              description: lot.description,
              size: "gal1",
              units: group.units,
              perBox: kind,
              onTop: false,
              boxKind: kind,
              boxes: group.boxes,
            },
            group.units,
            group.boxes,
          );
        }
      } else {
        addItem(
          draft,
          {
            sku: lot.sku,
            description: lot.description,
            size: "gal1",
            units: take * lot.per,
            perBox: lot.per,
            onTop: false,
          },
          take * lot.per,
        );
      }
      lot.boxes -= take;
      need -= take;
    }
    full.push(draft);
  }
  const leftover: PoolItem[] = [];
  for (const lot of lots) {
    if (lot.pieces) {
      const groups = new Map<1 | 2 | 4, { units: number; boxes: number }>();
      for (const piece of lot.pieces) {
        const group = groups.get(piece.kind) ?? { units: 0, boxes: 0 };
        group.units += piece.units;
        group.boxes += 1;
        groups.set(piece.kind, group);
      }
      for (const [kind, group] of groups) {
        leftover.push({
          sku: lot.sku,
          description: lot.description,
          size: "gal1",
          units: group.units,
          perBox: kind,
          onTop: false,
          boxKind: kind,
          boxes: group.boxes,
        });
      }
      continue;
    }
    const units = lot.boxes * lot.per + lot.loose;
    if (units <= 0) continue;
    leftover.push({
      sku: lot.sku,
      description: lot.description,
      size: "gal1",
      units,
      perBox: lot.per,
      onTop: false,
    });
  }
  return { full, leftover };
}

function packQuartBoxes(
  lines: OrderLine[],
  rule: PalletRule,
): { full: Draft[]; leftover: PoolItem[] } {
  const boxLimit = Math.max(1, rule.casesPerLayer * rule.layers);
  const lots = sharedQuartLots(mergeSameSku(lines));
  const full: Draft[] = [];
  const boxCount = () => lots.reduce((sum, lot) => sum + lot.boxes, 0);
  while (boxCount() >= boxLimit) {
    const draft = emptyDraft("combined");
    let need = boxLimit;
    for (const lot of lots) {
      if (need === 0 || lot.boxes <= 0 || !lot.pieces) continue;
      const take = Math.min(lot.boxes, need);
      const taken = lot.pieces.splice(0, take);
      const groups = new Map<1 | 2 | 4, { units: number; boxes: number }>();
      for (const piece of taken) {
        const group = groups.get(piece.kind) ?? { units: 0, boxes: 0 };
        group.units += piece.units;
        group.boxes += 1;
        groups.set(piece.kind, group);
      }
      for (const [kind, group] of groups) {
        addItem(
          draft,
          {
            sku: lot.sku,
            description: lot.description,
            size: "quart",
            units: group.units,
            perBox: kind,
            onTop: false,
            boxKind: kind,
            boxes: group.boxes,
          },
          group.units,
          group.boxes,
        );
      }
      lot.boxes -= take;
      need -= take;
    }
    full.push(draft);
  }
  const leftover: PoolItem[] = [];
  for (const lot of lots) {
    if (!lot.pieces) continue;
    const groups = new Map<1 | 2 | 4, { units: number; boxes: number }>();
    for (const piece of lot.pieces) {
      const group = groups.get(piece.kind) ?? { units: 0, boxes: 0 };
      group.units += piece.units;
      group.boxes += 1;
      groups.set(piece.kind, group);
    }
    for (const [kind, group] of groups) {
      leftover.push({
        sku: lot.sku,
        description: lot.description,
        size: "quart",
        units: group.units,
        perBox: kind,
        onTop: false,
        boxKind: kind,
        boxes: group.boxes,
      });
    }
  }
  return { full, leftover };
}

function packToFull(items: PoolItem[], upp: number): { full: Draft[]; leftover: PoolItem[] } {
  const queue = items
    .filter((item) => item.units > 0)
    .map((item) => ({ ...item }))
    .sort((a, b) => b.units - a.units || a.sku.localeCompare(b.sku));
  const full: Draft[] = [];
  let draft = emptyDraft("combined");
  let room = upp;
  for (const item of queue) {
    let left = item.units;
    while (left > 0) {
      const take = Math.min(left, room);
      addItem(draft, item, take);
      left -= take;
      room -= take;
      if (room === 0) {
        full.push(draft);
        draft = emptyDraft("combined");
        room = upp;
      }
    }
  }
  return { full, leftover: [...draft.items.values()] };
}

function usedFill(draft: Draft, rules: PalletRule[]): number {
  let used = 0;
  for (const item of draft.items.values()) {
    if (item.onTop) continue;
    used += item.units / unitsPerPallet(ruleFor(rules, item.size));
  }
  return used;
}

function fitUnits(draft: Draft, size: SizeKey, rules: PalletRule[]): number {
  const upp = unitsPerPallet(ruleFor(rules, size));
  const room = 1 - usedFill(draft, rules);
  if (room <= 1e-9) return 0;
  return Math.max(0, Math.floor(room * upp + 1e-8));
}

function isFourGallonBox(item: PoolItem): boolean {
  return item.size === "gal1" && item.boxKind === 4;
}

function isFullPailDeck(draft: Draft): boolean {
  const units = [...draft.items.values()]
    .filter((item) => item.size === "gal5" && !item.onTop)
    .reduce((sum, item) => sum + item.units, 0);
  return units >= 36;
}

function isFullBoxPallet(draft: Draft): boolean {
  const items = [...draft.items.values()].filter((item) => !item.onTop);
  if (items.length === 0 || items.some((item) => item.size !== "gal1")) return false;
  const boxes = items.reduce(
    (sum, item) => sum + (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox))),
    0,
  );
  return boxes >= 30;
}

function isCatalyst(item: PoolItem): boolean {
  return item.size === "quart" && /cataly|catylist|gtotcat/.test(canon(`${item.sku} ${item.description}`));
}

/** 1.25 OverTime. Each one ships with an 8 oz catalyst bottle in the same box. */
export function isOvertime125(item: { sku: string; description: string; size: SizeKey }): boolean {
  if (item.size !== "gal125") return false;
  const text = `${item.sku} ${item.description}`;
  if (/cataly|catylist/i.test(text)) return false;
  return /over\s*time|\bgtot/i.test(text);
}

/** 8 oz OverTime catalyst. It rides in the 1.25 box and is not its own carton. */
export function isOvertime8oz(item: { sku: string; description: string; size?: SizeKey }): boolean {
  if (item.size === "quart") return false;
  return isOvertime8ozText(`${item.sku} ${item.description}`);
}

/** Two 1.25 OverTime and two 8 oz catalyst bottles fill one box. A leftover pair gets another box. */
export function overtime125Pack(units: number): { boxes: number; extra: number; note: string } {
  const boxes = Math.floor(Math.max(0, units) / 2);
  const extra = Math.max(0, units) % 2;
  const note =
    boxes > 0 && extra > 0
      ? "A full box is 2 of 1.25 and 2 of 8 oz catalyst. Extra is 1 of each in another box."
      : extra > 0
        ? "1 of 1.25 / 1 of 8 oz catalyst in the box."
        : "2 of 1.25 / 2 of 8 oz catalyst in each box.";
  return { boxes, extra, note };
}

function hasFullBox(item: PoolItem): boolean {
  if ((item.boxes ?? 0) > 0) return true;
  return Math.floor(item.units / Math.max(1, item.perBox)) > 0;
}

/** Boxes that still fit with other boxes stay on a box pallet. Only the rest may ride pails. */
function parkBoxesBeforePails(drafts: Draft[], mixPool: PoolItem[], rules: PalletRule[]) {
  const stay: PoolItem[] = [];
  const boxed: PoolItem[] = [];
  for (const item of mixPool) {
    if (isCatalyst(item) || !hasFullBox(item)) stay.push(item);
    else boxed.push(item);
  }
  const paint = boxed.filter((item) => isPaintGallon(item));
  const xcel = boxed.filter((item) => isXcel(item) && !isPaintGallon(item));
  const others = boxed.filter((item) => !isXcel(item) && !isPaintGallon(item));
  const boxDrafts = others.length > 0 ? binPack(others, rules) : [];
  drafts.push(...boxDrafts);
  const hasPails = drafts.some((draft) =>
    [...draft.items.values()].some((item) => item.size === "gal5" && !item.onTop && item.units > 0),
  );
  if (hasPails) {
    stay.push(...paint);
  } else if (boxDrafts[0]) {
    for (const item of paint) addItem(boxDrafts[0], item, item.units);
  } else if (paint.reduce((sum, item) => sum + (item.boxes ?? 0), 0) > TOP_BOX_LIMIT) {
    const draft = emptyDraft("combined");
    for (const item of paint) addItem(draft, item, item.units);
    drafts.push(draft);
  } else {
    stay.push(...paint);
  }
  const xcelLeft: PoolItem[] = [];
  for (const item of xcel) {
    let units = item.units;
    for (const draft of boxDrafts) {
      if (units <= 0) break;
      const room = fitUnits(draft, item.size, rules);
      if (room <= 0) continue;
      const take = Math.min(units, room);
      addItem(draft, item, take);
      units -= take;
    }
    if (units > 0) xcelLeft.push({ ...item, units });
  }
  mixPool.length = 0;
  mixPool.push(...stay, ...xcelLeft);
}

function binPack(items: PoolItem[], rules: PalletRule[]): Draft[] {
  const queue = items
    .filter((item) => item.units > 0)
    .map((item) => ({ ...item }))
    .sort(
      (a, b) =>
        MIX_PRIORITY.indexOf(a.size) - MIX_PRIORITY.indexOf(b.size) ||
        b.units - a.units ||
        a.sku.localeCompare(b.sku),
    );
  const pallets: Draft[] = [];
  for (const item of queue) {
    let left = item.units;
    while (left > 0) {
      let target = pallets.find((pallet) => fitUnits(pallet, item.size, rules) > 0);
      if (!target) {
        target = emptyDraft("combined");
        pallets.push(target);
      }
      const take = Math.min(left, fitUnits(target, item.size, rules));
      if (take <= 0) break;
      addItem(target, item, take);
      left -= take;
    }
  }
  return pallets;
}

function draftFill(draft: Draft, rules: PalletRule[]): number {
  const base = [...draft.items.values()].filter((item) => !item.onTop);
  const gallons = base.filter((item) => item.size === "gal1");
  if (gallons.length > 0 && gallons.length === base.length) {
    const rule = ruleFor(rules, "gal1");
    const limit = Math.max(1, rule.casesPerLayer * rule.layers);
    const boxes = gallons.reduce(
      (sum, item) => sum + (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox))),
      0,
    );
    if (boxes >= limit) return 1;
  }
  const fill = usedFill(draft, rules);
  return fill >= 0.999 ? 1 : fill;
}

function classify(draft: Draft, rules: PalletRule[]): PalletKind {
  const sizes = new Set(
    [...draft.items.values()].filter((item) => !item.onTop).map((item) => item.size),
  );
  if (sizes.size > 1) return "mixed";
  const only = [...sizes][0];
  if (only === "gal15" || only === "gal125") return "mixed";
  if (draftFill(draft, rules) >= 0.999) return "full";
  return "partial";
}

function toPlanLines(draft: Draft, rules: PalletRule[]): PlanLine[] {
  return [...draft.items.values()]
    .sort(
      (a, b) =>
        SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size) || a.sku.localeCompare(b.sku),
    )
    .map((item) => {
      const rule = ruleFor(rules, item.size);
      const per = item.perBox > 0 ? item.perBox : rule.unitsPerCase;
      const catalyst = isCatalyst(item);
      const overtime = isOvertime125(item);
      const packs = overtime
        ? Math.ceil(item.units / 2)
        : catalyst
          ? Math.floor(item.units / 9) + (item.units % 9 > 0 ? 1 : 0)
          : item.boxes != null
            ? item.boxes
            : Math.floor(item.units / per);
      const loose = overtime || catalyst || item.boxes != null ? 0 : item.units % per;
      return {
        sku: item.sku,
        description: item.description,
        size: item.size,
        units: item.units,
        packs,
        loose,
        pounds: item.units * rule.poundsPerUnit,
        onTop: item.onTop,
        boxKind: item.boxKind,
      };
    });
}

function loadNote(lines: PlanLine[], rules: PalletRule[]): string {
  const base = lines.filter((line) => !line.onTop);
  const tops = lines.filter((line) => line.onTop);
  const note = base.length > 0 ? baseNote(base, rules) : "Boxes only.";
  if (tops.length === 0) return note;
  const riding = tops
    .map((line) => {
      if (line.packs > 0 && line.loose === 0) {
        return `${line.packs} ${packNoun(line.size, line.packs)} ${line.sku}`;
      }
      if (line.packs > 0) return `${line.packs} ${packNoun(line.size, line.packs)} + ${line.loose} loose ${line.sku}`;
      return `${line.loose} loose ${line.sku}`;
    })
    .join(", ");
  return `${note} On top: ${riding}.`;
}

function baseNote(lines: PlanLine[], rules: PalletRule[]): string {
  const sizes = SIZE_ORDER.filter((size) => lines.some((line) => line.size === size));
  if (sizes.length !== 1) {
    const labels = sizes.map((size) => ruleFor(rules, size).label);
    return `Bottom to top: ${labels.join(" → ")}. Heavier containers on the bottom.`;
  }
  const size = sizes[0];
  const rule = ruleFor(rules, size);
  const packs = lines.reduce((sum, line) => sum + line.packs, 0);
  const loose = lines.reduce((sum, line) => sum + line.loose, 0);
  const per = rule.casesPerLayer;
  const noun = packNoun(size, per);
  const stackUnits = rule.unitsPerCase === 1 ? lines.reduce((sum, line) => sum + line.units, 0) : packs;
  const fullLayers = Math.floor(stackUnits / per);
  const extra = stackUnits % per;
  let note: string;
  if (stackUnits === 0) {
    note = `${loose} loose ${loose === 1 ? "unit" : "units"} — no full pack.`;
  } else if (extra === 0) {
    note = `${fullLayers} ${fullLayers === 1 ? "layer" : "layers"} × ${per} ${noun}.`;
  } else if (fullLayers === 0) {
    note = `${extra} ${packNoun(size, extra)} on one layer.`;
  } else {
    note = `${fullLayers} full ${fullLayers === 1 ? "layer" : "layers"} × ${per}, plus ${extra} on top.`;
  }
  if (loose > 0 && rule.unitsPerCase > 1 && packs > 0) {
    note += ` ${loose} loose on top.`;
  }
  return note;
}

function familyScore(base: PoolItem, top: PoolItem): number {
  const skip = new Set(["part", "paint", "based", "finish", "gallon", "quart", "with"]);
  const tokens = (text: string) =>
    canon(text)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4 && !skip.has(word));
  const baseTokens = new Set(tokens(`${base.sku} ${base.description}`));
  let score = 0;
  for (const word of tokens(`${top.sku} ${top.description}`)) {
    if (baseTokens.has(word)) score += 1;
  }
  const stem = (sku: string) => sku.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const baseStem = stem(base.sku);
  const topStem = stem(top.sku);
  if (baseStem.length >= 4 && baseStem === topStem) score += 3;
  return score;
}

function primaryPail(draft: Draft): PoolItem | undefined {
  return [...draft.items.values()].find((item) => item.size === "gal5" && !item.onTop);
}

function draftInches(draft: Draft): number {
  const bands = new Map<string, { size: SizeKey; boxKind?: number; count: number }>();
  for (const item of draft.items.values()) {
    const count =
      item.size === "gal5" ? item.units : (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox)));
    const key = `${item.onTop ? "t" : "b"}|${item.sku}|${item.size}|${item.boxKind ?? ""}`;
    const band = bands.get(key) ?? { size: item.size, boxKind: item.boxKind, count: 0 };
    band.count += count;
    bands.set(key, band);
  }
  let inches = 0;
  for (const band of bands.values()) {
    if (band.count <= 0) continue;
    const per = Math.max(1, layerGrid(band.size, band.boxKind).perLayer);
    inches += Math.ceil(band.count / per) * containerHeight(band.size, band.boxKind);
  }
  return inches;
}

function heightBoxes(draft: Draft, item: PoolItem): number {
  const height = containerHeight(item.size, item.boxKind);
  const layers = Math.floor((MAX_STACK - draftInches(draft) + 1e-6) / height);
  if (layers <= 0) return 0;
  return layers * layerGrid(item.size, item.boxKind).perLayer;
}

function topLimit(draft: Draft): number {
  const pail = primaryPail(draft);
  return pail && isXcel(pail) ? XCEL_TOP_BOX_LIMIT : TOP_BOX_LIMIT;
}

/** Paint-can boxes ride on pallets of pails. Matched names go together. */
function stackOnPails(drafts: Draft[], pool: PoolItem[]) {
  const pails = drafts.filter((draft) => primaryPail(draft));
  if (pails.length === 0 || pool.length === 0) return;
  const used = new Map<Draft, number>();
  const best = (item: PoolItem): Draft | undefined => {
    const paint = isPaintGallon(item);
    const open = pails.filter((draft) => {
      const cap = paint ? TOP_BOX_LIMIT : topLimit(draft);
      return cap - (used.get(draft) ?? 0) > 0 && heightBoxes(draft, item) > 0;
    });
    if (open.length === 0) return undefined;
    open.sort((a, b) => {
      const score = familyScore(primaryPail(b) ?? item, item) - familyScore(primaryPail(a) ?? item, item);
      if (score !== 0) return score;
      const roomA = topLimit(a) - (used.get(a) ?? 0);
      const roomB = topLimit(b) - (used.get(b) ?? 0);
      if (roomB !== roomA) return roomB - roomA;
      return pails.indexOf(b) - pails.indexOf(a);
    });
    return open[0];
  };

  const pending = pool
    .filter((item) => item.units > 0 && item.size !== "gal5")
    .sort((a, b) => {
      const scoreA = Math.max(...pails.map((draft) => familyScore(primaryPail(draft) ?? a, a)));
      const scoreB = Math.max(...pails.map((draft) => familyScore(primaryPail(draft) ?? b, b)));
      return scoreB - scoreA || b.units - a.units;
    });

  const leftover: PoolItem[] = [];
  for (const item of pending) {
    let left = item.units;
    let boxesLeft = item.boxes;
    const per = Math.max(1, item.perBox);
    while (Math.floor(left / per) > 0) {
      const boxes = Math.floor(left / per);
      const target = best(item);
      if (!target) break;
      const cap = isPaintGallon(item) ? TOP_BOX_LIMIT : topLimit(target);
      const room = Math.min(cap - (used.get(target) ?? 0), heightBoxes(target, item));
      if (room <= 0) break;
      const take = Math.min(boxes, room);
      addItem(target, { ...item, onTop: true }, take * per, item.boxes != null ? take : undefined);
      if (boxesLeft != null) boxesLeft -= take;
      used.set(target, (used.get(target) ?? 0) + take);
      left -= take * per;
    }
    if (left > 0) {
      const target = best(item);
      if (target && heightBoxes(target, item) > 0) {
        addItem(target, { ...item, onTop: true }, left, boxesLeft != null ? Math.max(boxesLeft, 1) : undefined);
        if (boxesLeft != null) boxesLeft = 0;
        used.set(target, (used.get(target) ?? 0) + 1);
        left = 0;
      }
    }
    if (left > 0) leftover.push({ ...item, units: left, boxes: boxesLeft, onTop: false });
  }
  pool.length = 0;
  pool.push(...leftover);
}

/** Paint boxes ride a pail skid when six boxes and the 60 inch cap still hold. */
function topFourGallonOnBulk(drafts: Draft[]) {
  const decks = drafts.filter((draft) =>
    [...draft.items.values()].some((item) => item.size === "gal5" && !item.onTop && item.units > 0),
  );
  if (decks.length === 0) return;
  const takeBoxes = (draft: Draft, count: number): { item: PoolItem; units: number; boxes: number } | null => {
    for (const item of draft.items.values()) {
      if (!isPaintGallon(item) || item.onTop || item.size === "gal5") continue;
      const boxes = item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox));
      const take = Math.min(count, boxes);
      if (take <= 0) continue;
      const units =
        item.boxes && item.boxes > 0
          ? Math.min(item.units, Math.max(1, Math.round((item.units / item.boxes) * take)))
          : Math.min(item.units, take * Math.max(1, item.perBox));
      const key = itemKey(item);
      item.units -= units;
      if (item.boxes != null) item.boxes -= take;
      if (item.units <= 0 || (item.boxes != null && item.boxes <= 0)) draft.items.delete(key);
      return { item, units, boxes: take };
    }
    return null;
  };
  for (const deck of decks) {
    let room = Math.min(TOP_BOX_LIMIT, heightBoxes(deck, { size: "gal1", boxKind: 4, perBox: 4, units: 4, sku: "", description: "", onTop: true }));
    const already = [...deck.items.values()]
      .filter((item) => item.onTop)
      .reduce((sum, item) => sum + (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox))), 0);
    room = Math.max(0, room - already);
    if (room <= 0) continue;
    for (const donor of drafts) {
      if (donor === deck || isFullPailDeck(donor) || isFullBoxPallet(donor)) continue;
      while (room > 0) {
        const moved = takeBoxes(donor, room);
        if (!moved) break;
        addItem(deck, { ...moved.item, onTop: true, units: moved.units, boxes: moved.boxes }, moved.units, moved.boxes);
        room -= moved.boxes;
      }
    }
  }
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    if (drafts[index]?.items.size === 0) drafts.splice(index, 1);
  }
}

function finalize(drafts: Draft[], rules: PalletRule[]): Pallet[] {
  return drafts.map((draft, index) => {
    const lines = toPlanLines(draft, rules);
    const fill = draftFill(draft, rules);
    return {
      number: index + 1,
      kind: classify(draft, rules),
      source: draft.source,
      fill,
      lines,
      units: lines.reduce((sum, line) => sum + line.units, 0),
      packs: lines.reduce((sum, line) => sum + line.packs, 0),
      loose: lines.reduce((sum, line) => sum + line.loose, 0),
      pounds: lines.reduce((sum, line) => sum + line.pounds, 0),
      note: loadNote(lines, rules),
    };
  });
}

function lineCalcs(lines: OrderLine[], rules: PalletRule[], pallets: Pallet[]): LineCalc[] {
  return lines.map((line) => {
    const rule = ruleFor(rules, line.size);
    const qty = Math.max(0, Math.round(line.qty));
    const upp = unitsPerPallet(rule);
    const upc = rule.unitsPerCase;
    const fullPallets = qty > 0 ? Math.floor(qty / upp) : 0;
    const unitsOnFull = fullPallets * upp;
    const remainderUnits = qty - unitsOnFull;
    const sku = line.sku.trim() || "UNASSIGNED";
    const palletNumbers = pallets
      .filter(
        (pallet) =>
          pallet.source === "combined" &&
          pallet.lines.some(
            (item) => item.size === line.size && item.sku.toUpperCase() === sku.toUpperCase(),
          ),
      )
      .map((pallet) => pallet.number);
    return {
      id: line.id,
      sku: line.sku,
      description: line.description,
      size: line.size,
      qty,
      packs: qty > 0 ? Math.floor(qty / upc) : 0,
      loose: qty > 0 ? qty % upc : 0,
      fullPallets,
      unitsOnFull,
      remainderUnits,
      remainderPacks: Math.floor(remainderUnits / upc),
      remainderLoose: remainderUnits % upc,
      palletNumbers,
    };
  });
}

function sizeRollups(lines: OrderLine[], rules: PalletRule[]): SizeRollup[] {
  return SIZE_ORDER.map((size) => {
    const rule = ruleFor(rules, size);
    const upp = unitsPerPallet(rule);
    const upc = rule.unitsPerCase;
    const sized = activeLines(lines).filter((line) => line.size === size);
    const units = sized.reduce((sum, line) => sum + line.qty, 0);
    let straightFull = 0;
    let remainderUnits = 0;
    let packs = 0;
    let loose = 0;
    for (const line of sized) {
      straightFull += Math.floor(line.qty / upp);
      remainderUnits += line.qty % upp;
      packs += Math.floor(line.qty / upc);
      loose += line.qty % upc;
    }
    const extraFull = Math.floor(remainderUnits / upp);
    const partialUnits = remainderUnits % upp;
    return {
      size,
      units,
      packs,
      loose,
      straightFull,
      remainderUnits,
      extraFull,
      partialUnits,
      partialFill: upp > 0 ? partialUnits / upp : 0,
      pounds: units * rule.poundsPerUnit,
    };
  });
}

export function buildPlan(
  lines: OrderLine[],
  rules: PalletRule[],
  settings: Settings,
): Plan | { error: string } {
  const error = ruleError(rules);
  if (error) return { error };
  if (settings.palletTareLb < 0) return { error: "Pallet tare can't be negative." };

  const usable = activeLines(lines)
    .filter((line) => line.size !== "drawdown" && !isOvertime8oz(line))
    .map((line) => ({
      ...line,
      qty: Math.round(line.qty),
    }));
  const drafts: Draft[] = [];
  const mixPool: PoolItem[] = [];

  for (const size of SIZE_ORDER) {
    const rule = ruleFor(rules, size);
    if (size === "gal1") {
      const packed = packGallonBoxes(
        usable.filter((line) => line.size === "gal1"),
        rule,
      );
      drafts.push(...packed.full);
      if (packed.leftover.length === 0) continue;
      if (rule.mixGroup === "small" && settings.mixSmall) mixPool.push(...packed.leftover);
      else {
        const draft = emptyDraft("combined");
        for (const item of packed.leftover) addItem(draft, item, item.units);
        drafts.push(draft);
      }
      continue;
    }
    if (size === "quart") {
      const quarts = usable.filter((line) => line.size === "quart");
      const packed = packQuartBoxes(
        quarts.filter((line) => isSharedQuart(line)),
        rule,
      );
      drafts.push(...packed.full);
      if (packed.leftover.length > 0) {
        if (rule.mixGroup === "small" && settings.mixSmall) mixPool.push(...packed.leftover);
        else {
          const draft = emptyDraft("combined");
          for (const item of packed.leftover) addItem(draft, item, item.units, item.boxes);
          drafts.push(draft);
        }
      }
      const catalyst = mergeSameSku(quarts.filter((line) => !isSharedQuart(line)));
      const upp = unitsPerPallet(rule);
      const pool: PoolItem[] = [];
      for (const line of catalyst) {
        const full = Math.floor(line.qty / upp);
        const rem = line.qty % upp;
        const perBox = perBoxFor(line, rule);
        for (let index = 0; index < full; index += 1) {
          const draft = emptyDraft("straight");
          addItem(
            draft,
            { sku: line.sku, description: line.description, size, units: upp, perBox, onTop: false },
            upp,
          );
          drafts.push(draft);
        }
        if (rem > 0) pool.push({ sku: line.sku, description: line.description, size, units: rem, perBox, onTop: false });
      }
      const catalystPacked = packToFull(pool, upp);
      drafts.push(...catalystPacked.full);
      if (catalystPacked.leftover.length > 0) {
        if (rule.mixGroup === "small" && settings.mixSmall) mixPool.push(...catalystPacked.leftover);
        else {
          const draft = emptyDraft("combined");
          for (const item of catalystPacked.leftover) addItem(draft, item, item.units);
          drafts.push(draft);
        }
      }
      continue;
    }
    const upp = unitsPerPallet(rule);
    const merged = mergeSameSku(usable.filter((line) => line.size === size));
    const pool: PoolItem[] = [];
    for (const line of merged) {
      const full = Math.floor(line.qty / upp);
      const rem = line.qty % upp;
      const perBox = perBoxFor(line, rule);
      for (let index = 0; index < full; index += 1) {
        const draft = emptyDraft("straight");
        addItem(
          draft,
          { sku: line.sku, description: line.description, size, units: upp, perBox, onTop: false },
          upp,
        );
        drafts.push(draft);
      }
      if (rem > 0) {
        pool.push({ sku: line.sku, description: line.description, size, units: rem, perBox, onTop: false });
      }
    }
    const packed = packToFull(pool, upp);
    drafts.push(...packed.full);
    if (packed.leftover.length === 0) continue;
    if (rule.mixGroup === "small" && settings.mixSmall) {
      mixPool.push(...packed.leftover);
    } else {
      const draft = emptyDraft("combined");
      for (const item of packed.leftover) addItem(draft, item, item.units);
      drafts.push(draft);
    }
  }

  if (mixPool.length > 0) parkBoxesBeforePails(drafts, mixPool, rules);
  if (mixPool.length > 0) stackOnPails(drafts, mixPool);
  if (mixPool.length > 0) drafts.push(...binPack(mixPool, rules));
  topFourGallonOnBulk(drafts);

  drafts.sort((a, b) => draftRank(a, usable) - draftRank(b, usable));
  const pallets = finalize(drafts, rules);
  const calcs = lineCalcs(lines, rules, pallets);
  const bySize = sizeRollups(
    lines.filter((line) => line.size !== "drawdown" && !isOvertime8oz(line)),
    rules,
  );
  const productLb = bySize.reduce((sum, row) => sum + row.pounds, 0);
  const totals = {
    pallets: pallets.length,
    full: pallets.filter((pallet) => pallet.kind === "full").length,
    mixed: pallets.filter((pallet) => pallet.kind === "mixed").length,
    partial: pallets.filter((pallet) => pallet.kind === "partial").length,
    units: bySize.reduce((sum, row) => sum + row.units, 0),
    packs: pallets.reduce((sum, pallet) => sum + pallet.packs, 0),
    productLb,
    grossLb: productLb + pallets.length * settings.palletTareLb,
  };

  return { pallets, lines: calcs, bySize, totals };
}

export function isPlan(value: Plan | { error: string }): value is Plan {
  return !("error" in value);
}

export function expectedPalletCount(
  lines: OrderLine[],
  rules: PalletRule[],
  settings: Settings,
): number {
  const rollups = sizeRollups(
    activeLines(lines)
      .filter((line) => line.size !== "drawdown" && !isOvertime8oz(line))
      .map((line) => ({ ...line, qty: Math.round(line.qty) })),
    rules,
  );
  const straight = rollups.reduce((sum, row) => sum + row.straightFull, 0);
  const extra = rollups.reduce((sum, row) => sum + row.extraFull, 0);
  const small = rollups.filter((row) => row.size !== "gal5");
  const smallSum = small.reduce((sum, row) => sum + row.partialFill, 0);
  const smallPallets = settings.mixSmall
    ? smallSum <= 1e-9
      ? 0
      : Math.ceil(smallSum - 1e-9)
    : small.filter((row) => row.partialUnits > 0).length;
  const pail = rollups.find((row) => row.size === "gal5");
  const pailPartial = pail && pail.partialUnits > 0 ? 1 : 0;
  return straight + extra + smallPallets + pailPartial;
}

export function broughtIn(name: string, size?: SizeKey): boolean {
  if (size === "vinyl" || size === "drawdown") return true;
  if (/hybild/i.test(name) && /tinted/i.test(name)) return true;
  if (/chameleon|\bpaint\b|\bcwp\b|\bgtcop\b/i.test(name)) return true;
  if (/\bstains?\b/i.test(name)) return true;
  if (/\bstencils?\b/i.test(name)) return true;
  if (/\bvinyl\b/i.test(name)) return true;
  return false;
}

export function slipColor(description: string): string {
  return description.match(/\[\[([^[\]]+)\]\]/)?.[1]?.trim() ?? "";
}

export function paintDetail(sku: string, description: string): { title: string; color: string } | null {
  const text = `${sku} ${description}`;
  if (!/chameleon|\bcwp\b|\bgtcop\b/i.test(text)) return null;
  const color = text.match(/\bSW\s*\d{3,5}\b(?:\s+[A-Za-z][A-Za-z0-9.'-]*){0,4}/i)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
  const base = /h2o|water/i.test(text) ? "Chameleon Paint H2O Based" : /oil/i.test(text) ? "Chameleon Paint Oil Based" : "Chameleon Paint";
  const title = [sku.trim(), base].filter(Boolean).join(" ");
  return { title, color };
}

export function productLabel(sku: string, description: string, size?: SizeKey): string {
  const text = `${sku} ${description}`;
  const code = sku.match(/(?:^|[^0-9])(275|450|500)(?:[^0-9]|$)/)?.[1] ?? description.match(/\b(275|450|500)\b/)?.[1] ?? "";
  const sealer = /seal/i.test(text);
  const finish = /finish|sport\s*poly/i.test(text) || /(?:^|[-_])F(?:$|[^A-Z0-9])/i.test(sku);
  const catalyst = /cataly|catylist/i.test(text);
  const paint = /paint|chameleon/i.test(text);
  let kind = "";
  if (catalyst) kind = "Catalyst";
  else if (/(?:^|[-_])S(?:$|[^A-Z0-9])/i.test(sku) && sealer) kind = "Sealer";
  else if (/(?:^|[-_])F(?:$|[^A-Z0-9])/i.test(sku) && (finish || !sealer)) kind = "Finish";
  else if (sealer && !finish) kind = "Sealer";
  else if (finish && !sealer) kind = "Finish";
  else if (paint) kind = "Paint";
  if (size === "gal1" && code === "500" && (kind === "Sealer" || sealer || /omni/i.test(text))) return "Omni";
  if (/omni/i.test(text)) return "Omni";
  if (/hybild/i.test(text)) {
    if (/tinted/i.test(text)) {
      const tint = slipColor(description);
      const base = /seal/i.test(text) ? "Hybild Tinted Sealer" : "Tinted Hybild";
      return tint ? `${base} · ${tint}` : base;
    }
    return "Hybild Sealer";
  }
  if (code && kind) return `${code} ${kind}`;
  if (/over\s*time|\bgtot/i.test(text)) return catalyst ? "OverTime Catalyst" : "OverTime Finish";
  if (/xcel|excel/i.test(text)) return /part\s*b/i.test(text) ? "Xcel Part B" : "Xcel";
  const paintLine = paintDetail(sku, description);
  const marked = slipColor(description);
  if (marked) return marked;
  if (paintLine) return paintLine.color || paintLine.title;
  return description.trim() || sku.trim() || "Item";
}

export type LoadRow = {
  pallet: number;
  product: string;
  sizeLabel: string;
  ordered: number;
  boxes: number | null;
  palletType: "Full" | "Mixed" | "Partial" | "On top";
  onPallet: number;
};

export function loadRows(plan: Plan, lines: OrderLine[], rules: PalletRule[]): LoadRow[] {
  const rank = (sku: string, size: OrderLine["size"]) =>
    lines.findIndex(
      (line) =>
        line.size === size && (line.sku.trim() || "UNASSIGNED").toUpperCase() === sku.toUpperCase(),
    );
  return plan.pallets.flatMap((pallet) =>
    pallet.lines
      .slice()
      .sort((a, b) => Number(a.onTop) - Number(b.onTop) || rank(a.sku, a.size) - rank(b.sku, b.size))
      .map((line) => {
        const ordered = lines
          .filter(
            (item) =>
              item.size === line.size &&
              (item.sku.trim() || "UNASSIGNED").toUpperCase() === line.sku.toUpperCase(),
          )
          .reduce((sum, item) => sum + item.qty, 0);
        const label = productLabel(line.sku, line.description, line.size);
        const product = label === "Omni" ? "Omni" : line.sku && !label.startsWith(line.sku) ? `${line.sku} ${label}`.trim() : label || line.sku;
        return {
          pallet: pallet.number,
          product,
          sizeLabel: ruleFor(rules, line.size).label,
          ordered,
          boxes: line.size === "gal5" || line.packs === 0 ? null : line.packs,
          palletType: line.onTop ? "On top" : palletType(pallet.kind),
          onPallet: line.units,
        };
      }),
  );
}

export { packsPerPallet, unitsPerPallet };
