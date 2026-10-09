/*
GAME TIME SHIPPING — one file. No passwords or keys.

Use:
  import { planFromSlip, planShipment } from "./gametim-shipping.mjs";
  const plan = planFromSlip(slipText);

Or run the built-in examples:
  node gametim-shipping.mjs

planFromSlip reads a packing slip (PDF text or photo text already extracted).
planShipment takes lines that are already parsed.
qty is eaches. A color stays in the description as [[color]].
Drawdowns stay on lines and do not get a pallet.

This file is the pallet splitter and the slip reader.
It does not open the camera and it does not subtract inventory.
When GameTime marks the shipment SHIPPED, subtract each line qty once.
If it is already SHIPPED, do not subtract again.
*/

// src/lib/pallet/defaults.ts
var DEFAULT_RULES = [
  {
    size: "quart",
    label: "Quart",
    unitsPerCase: 4,
    casesPerLayer: 20,
    layers: 9,
    mixGroup: "small",
    poundsPerUnit: 3
  },
  {
    size: "pint",
    label: "Pint",
    unitsPerCase: 4,
    casesPerLayer: 20,
    layers: 9,
    mixGroup: "small",
    poundsPerUnit: 2
  },
  {
    size: "gal1",
    label: "1 Gal",
    unitsPerCase: 4,
    casesPerLayer: 6,
    layers: 5,
    mixGroup: "small",
    poundsPerUnit: 11
  },
  {
    size: "gal125",
    label: "1.25 Gal",
    unitsPerCase: 2,
    casesPerLayer: 12,
    layers: 4,
    mixGroup: "small",
    poundsPerUnit: 14
  },
  {
    size: "gal15",
    label: "1.5 Gal",
    unitsPerCase: 2,
    casesPerLayer: 40,
    layers: 1,
    mixGroup: "small",
    poundsPerUnit: 16
  },
  {
    size: "gal5",
    label: "5 Gal",
    unitsPerCase: 1,
    casesPerLayer: 12,
    layers: 3,
    mixGroup: "pail",
    poundsPerUnit: 55
  },
  {
    size: "vinyl",
    label: "Paint vinyl box 60 or 64\xD78\xD78",
    unitsPerCase: 1,
    casesPerLayer: 1,
    layers: 7,
    mixGroup: "pail",
    poundsPerUnit: 12
  },
  {
    size: "drawdown",
    label: "Paint drawdown 10\xD78\xD72",
    unitsPerCase: 1,
    casesPerLayer: 16,
    layers: 30,
    mixGroup: "pail",
    poundsPerUnit: 1
  }
];
var DEFAULT_SETTINGS = {
  mixSmall: true,
  palletTareLb: 45
};

// src/lib/pallet/format.ts
function packNoun(size, count) {
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
function sizeTitle(size) {
  if (size === "quart") return "Quarts";
  if (size === "pint") return "Pints";
  if (size === "gal1") return "1 Gallon";
  if (size === "gal125") return "1.25 Gallons";
  if (size === "gal15") return "1.5 Gallons";
  if (size === "vinyl") return "Paint vinyl box 60 or 64\xD78\xD78";
  if (size === "drawdown") return "Paint drawdown 10\xD78\xD72";
  return "5 Gallons";
}

// src/lib/pallet/types.ts
var SIZE_ORDER = ["gal5", "gal15", "gal125", "gal1", "quart", "pint", "vinyl", "drawdown"];
function isSizeKey(value) {
  return SIZE_ORDER.includes(value);
}
function unitsPerPallet(rule) {
  return rule.unitsPerCase * rule.casesPerLayer * rule.layers;
}
function ruleFor(rules, size) {
  const rule = rules.find((item) => item.size === size);
  if (!rule) throw new Error(`Missing pallet rule for ${size}`);
  return rule;
}
function ruleError(rules) {
  const seen = /* @__PURE__ */ new Set();
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

// src/lib/pallet/parse.ts
var SIZE_LABEL = {
  quart: "Quart",
  pint: "Pint",
  gal1: "1 Gallon",
  gal125: "1.25 Gallon",
  gal15: "1.5 Gallon",
  gal5: "5 Gallon",
  vinyl: "Paint vinyl box",
  drawdown: "Paint drawdown"
};
function detectSize(line) {
  const text = line.toLowerCase();
  if (/\bvinyls?\b/.test(text)) return "vinyl";
  if (/\bdraw\s*-?\s*downs?\b/.test(text)) return "drawdown";
  if (/\bpints?\b/.test(text) || /(?<![-_])\bpts?\b/.test(text)) return "pint";
  if (/\b1\s*(?:\.|-|,)\s*25\s*[-\s]?(?:gal|gallon)s?\b/.test(text) || /\b1\s+1\/4\s*(?:gal|gallon)s?\b/.test(text) || /\b1\.25\b/.test(text) && /\b(?:gal|gallon)s?\b/.test(text)) {
    return "gal125";
  }
  if (/\b1\s*(?:\.|-|,)\s*5\s*[-\s]?(?:gal|gallon)s?\b/.test(text) || /\b1\s+1\/2\s*(?:gal|gallon)s?\b/.test(text) || /\b1\.5\b/.test(text) && /\b(?:gal|gallon)s?\b/.test(text)) {
    return "gal15";
  }
  if (/\b5\s*[-\s]?(?:gal|gallon)s?\b/.test(text) || /\bpails?\b/.test(text) || /\bbuckets?\b/.test(text)) {
    return "gal5";
  }
  if (/\bquarts?\b/.test(text) || /(?<![-_])\bqts?\b/.test(text)) return "quart";
  if (/\b1\s*[-\s]?(?:gal|gallon)s?\b/.test(text) || /\bgallons?\b/.test(text) || /\bgal\b/.test(text)) {
    return "gal1";
  }
  return null;
}
function stripSize(line) {
  return line.replace(/\b1\s*(?:\.|-|,)\s*25\s*[-\s]?(?:gal|gallon)s?\b/gi, " ").replace(/\b1\s+1\/4\s*(?:gal|gallon)s?\b/gi, " ").replace(/\b1\s*(?:\.|-|,)\s*5\s*[-\s]?(?:gal|gallon)s?\b/gi, " ").replace(/\b1\s+1\/2\s*(?:gal|gallon)s?\b/gi, " ").replace(/\b5\s*[-\s]?(?:gal|gallon)s?\b/gi, " ").replace(/\b1\s*[-\s]?(?:gal|gallon)s?\b/gi, " ").replace(/\b(?:quarts?|gallons?|pails?|buckets?|gal)\b/gi, " ").replace(/(?<![-_])\bqts?\b/gi, " ");
}
function detectQty(line) {
  const stripped = stripSize(line);
  const each = stripped.match(/\b(\d{1,6})\s*(?:ea|each|pcs|pc|units?|cans?)\b/i);
  const pack = stripped.match(/\b(\d{1,6})\s*(?:cs|cases?|bx|boxes?|cartons?)\b/i);
  if (each && pack) return { qty: Number(each[1]), basis: "each" };
  if (pack) return { qty: Number(pack[1]), basis: "case" };
  if (each) return { qty: Number(each[1]), basis: "each" };
  const labeled = stripped.match(/\b(?:qty|quantity|order(?:ed)?)\s*[:#]?\s*(\d{1,6})\b/i);
  if (labeled) return { qty: Number(labeled[1]), basis: "each" };
  const nums = [...stripped.matchAll(/\b(\d{1,6})\b/g)].map((match) => Number(match[1])).filter((value) => value > 0 && value < 1e5);
  if (nums.length === 0) return null;
  return { qty: nums[nums.length - 1], basis: "each" };
}
function detectSku(line) {
  const tokens = line.split(/\s+/);
  for (const token of tokens) {
    const clean = token.replace(/^[#(]+|[,:;)>\]]+$/g, "");
    if (/^[A-Z0-9]{1,12}(?:[-_][A-Z0-9]+)+$/i.test(clean)) return clean;
  }
  const first = tokens[0]?.replace(/^[#(]+|[,:;)>\]]+$/g, "") ?? "";
  if (/^[A-Z]{1,8}\d{2,}[A-Z0-9]*$/i.test(first)) return first;
  if (/^\d{4,10}$/.test(first)) return first;
  return "";
}
function cleanupDescription(line, sku) {
  let text = stripSize(line);
  if (sku) {
    const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "i"), " ");
  }
  text = text.replace(/\b\d{1,6}\s*(?:ea|each|pcs|pc|units?|cans?|cs|cases?|bx|boxes?|cartons?)\b/gi, " ").replace(/\b(?:qty|quantity)\s*[:#]?\s*\d{1,6}\b/gi, " ").replace(/\b\d{1,6}\b/g, (number) => number === "275" || number === "450" || number === "500" ? number : " ").replace(/[|,]{2,}/g, " ").replace(/\s+/g, " ").replace(/[\s\-–—]+$/g, "").trim();
  return text.slice(0, 80);
}
function isNoise(line) {
  return /packing slip|bill to|ship to|sold to|page \d|subtotal|sales tax|invoice total|phone|fax|@|www\.|thank you|picking list/i.test(
    line
  );
}
function paintColor(line) {
  const pantone = line.match(/\bPantone\s+[A-Za-z0-9]+(?:\s+[A-Za-z][A-Za-z0-9.'-]*){0,5}/i);
  if (pantone) return pantone[0].replace(/\s+/g, " ").trim();
  const match = line.match(/\bSW\s*\d{3,5}\b(?:\s+[A-Za-z][A-Za-z0-9.'-]*){0,4}/i);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}
function cleanColor(line) {
  return line.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}
function colorNearBullet(rawLines, index, body) {
  const bodyKey = body.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (let back = index - 1; back >= 0 && index - back <= 6; back -= 1) {
    const previous = rawLines[back].trim();
    if (/[•●]/.test(previous)) break;
    if (/^\d{1,6}$/.test(previous)) continue;
    if (/coatings\s*&\s*paints|^product\s*:|^description\s*:|^quantity\b|shipment|page \d/i.test(previous)) continue;
    const marked = paintColor(previous);
    if (marked) return marked;
    const key = previous.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || key === bodyKey || bodyKey.includes(key) || key.includes(bodyKey)) continue;
    if (!/[A-Za-z]{3,}/.test(previous)) continue;
    const color = cleanColor(previous);
    if (color) return color;
  }
  return "";
}
function detailNearBullet(rawLines, index, body) {
  const bodyKey = body.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!bodyKey) return "";
  for (let back = index - 1; back >= 0 && index - back <= 8; back -= 1) {
    const previous = rawLines[back].trim();
    if (/[•●]/.test(previous)) break;
    if (/^\d{1,6}$/.test(previous)) continue;
    if (/coatings\s*&\s*paints|^product\s*:|^description\s*:|^quantity\b|shipment|page \d/i.test(previous)) continue;
    const key = previous.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (key.includes(bodyKey) && key.length > bodyKey.length + 2) return previous.replace(/\s+/g, " ").trim();
  }
  return "";
}
function fixOcrWords(line) {
  return line.replace(/\bga(?:ll|l1|11|il|li|ii)on\b/gi, "Gallon").replace(/\bgalion\b/gi, "Gallon").replace(/\bgai+on\b/gi, "Gallon").replace(/\b[0o]uarts?\b/gi, (word) => word.toLowerCase().endsWith("s") ? "Quarts" : "Quart").replace(/\bpai[l1]s?\b/gi, (word) => word.toLowerCase().endsWith("s") ? "pails" : "pail");
}
function looksLikeProduct(body) {
  if (/shipping|freight|package\(s\)|ship date|ship via|invoice|page\s+\d/i.test(body)) return false;
  return detectSize(body) !== null || /\b(?:stencil|vinyl|t-?shirts?|boxes?\s+of|draw\s*-?\s*downs?|pints?)\b/i.test(body);
}
function normalizeSlipText(text) {
  const raw = text.replace(/\u00a0/g, " ").split(/\r?\n/).map((line) => fixOcrWords(line).replace(/[|]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const lines = [];
  const alreadyBulleted = raw.some((line) => /[•●]\s*\d{1,4}\s*,/.test(line));
  if (alreadyBulleted) return raw.join("\n");
  for (let index = 0; index < raw.length; index += 1) {
    const line = raw[index];
    if (/^\d{1,4}$/.test(line)) {
      let at = -1;
      for (let back = lines.length - 1; back >= 0 && lines.length - back <= 5; back -= 1) {
        if (lines[back].startsWith("\u2022 ")) break;
        if (looksLikeProduct(lines[back]) && !/^\d{1,4}\b/.test(lines[back])) {
          at = back;
          break;
        }
      }
      if (at >= 0) {
        const product = lines[at];
        const between = lines.slice(at + 1);
        lines.splice(at, lines.length - at, ...between, `\u2022 ${line}, ${product}`);
        continue;
      }
    }
    const lead = line.match(/^(?:[•●*·∙\-–—]\s*)?(\d{1,4})\s*[,.]?\s+(\S.*)$/);
    if (lead && looksLikeProduct(lead[2])) {
      lines.push(`\u2022 ${lead[1]}, ${lead[2]}`);
      continue;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
function parseBulletLines(rawLines) {
  const lines = [];
  rawLines.forEach((source, index) => {
    const match = source.match(/[•●]\s*(\d{1,6})\s*,\s*([^•\n]+)/);
    if (!match) return;
    const body = match[2].trim().replace(/[.,]+$/, "");
    if (/shipping|freight|package\(s\)|ship date|ship via|invoice/i.test(body)) return;
    const size = detectSize(body);
    if (!size) return;
    const qty = Number(match[1]);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const sku = detectSku(body);
    const fuller = size === "drawdown" ? detailNearBullet(rawLines, index, body) : "";
    const isPaint = !fuller && size !== "vinyl" && size !== "drawdown" && /chameleon|\bpaint\b|\bcwp\b|\bgtcop\b/i.test(body);
    const tinted = /hybild/i.test(body) && /tinted/i.test(body);
    const color = isPaint || tinted ? colorNearBullet(rawLines, index, body) || paintColor(body) : "";
    const description = (fuller || `${cleanupDescription(body, sku) || body}${color ? ` [[${color}]]` : ""}`).replace(/\s+/g, " ").trim();
    lines.push({
      sku,
      description,
      size,
      qty,
      basis: "each",
      basisQty: qty,
      source
    });
  });
  return lines;
}
function isCustomerLine(line) {
  if (!line || line.length > 80 || line.includes(":")) return false;
  if (/@|www\.|gametime|\(\d{3}\)|\d{3}-\d{4}|^\d/.test(line)) return false;
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}/.test(line)) return false;
  return /[A-Za-z]/.test(line);
}
function customerFromSlip(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => /^shipped\s+to:?$/i.test(line) || /^ship\s+to:?$/i.test(line));
  const window = start >= 0 ? lines.slice(start + 1, start + 30) : lines;
  const stop = window.findIndex((line) => /^(description|quantity|product)\b/i.test(line));
  const block = stop >= 0 ? window.slice(0, stop) : window;
  const company = block.find((line) => /\b(?:Inc\.?|LLC|L\.L\.C\.|Corp\.?|Company|Co\.|Ltd\.?)\b/i.test(line));
  if (company) return company.replace(/\s+/g, " ").trim();
  const streetAt = block.findIndex((line) => /^\d+\s+\S/.test(line));
  if (streetAt > 0 && isCustomerLine(block[streetAt - 1])) return block[streetAt - 1];
  const cityAt = block.findIndex((line) => /^[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}/.test(line));
  if (cityAt >= 0 && block[cityAt + 1] && isCustomerLine(block[cityAt + 1])) return block[cityAt + 1];
  return "";
}
function extractBatchCodes(text) {
  return text.match(/\d-\d{2}-\d{2}-\d{2}/g) ?? [];
}
function parseSlipMeta(text) {
  const shipment = text.match(/Shipment\s*#?\s*:?\s*([A-Za-z0-9-]+)/i);
  const po = text.match(/PO\s*#:\s*([A-Za-z0-9-]+)/i);
  return {
    orderName: shipment?.[1] ?? "",
    customer: customerFromSlip(text),
    po: po?.[1] ?? ""
  };
}
function salespersonFromSlip(text) {
  const block = text.split(/Salesperson\s*:/i)[1] ?? "";
  const email = block.match(/[A-Za-z0-9._%+-]+@gametime[a-z0-9.-]*\.[a-z]{2,}/i)?.[0] ?? "";
  if (!email) return { name: "", email: "" };
  const after = block.slice(block.toLowerCase().indexOf(email.toLowerCase()) + email.length);
  const name = after.split(/\r?\n/).map((line) => line.trim()).find((line) => /^[A-Za-z][A-Za-z .'-]{1,40}$/.test(line) && line.split(/\s+/).length <= 4) ?? "";
  return { name, email };
}
function parsePackingSlip(text) {
  const rawLines = normalizeSlipText(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = parseBulletLines(rawLines);
  if (bullets.length > 0) return { lines: bullets, warnings: [] };
  const lines = [];
  const warnings = [];
  for (const source of rawLines) {
    const size = detectSize(source);
    if (!size) continue;
    if (isNoise(source) && !detectQty(source)) continue;
    const qty = detectQty(source);
    if (!qty) {
      warnings.push(`Size found but no quantity: ${source.slice(0, 90)}`);
      continue;
    }
    const sku = detectSku(source);
    const description = cleanupDescription(source, sku) || SIZE_LABEL[size];
    lines.push({
      sku,
      description,
      size,
      qty: qty.qty,
      basis: qty.basis,
      basisQty: qty.qty,
      source
    });
  }
  if (lines.length === 0) {
    warnings.push("No product lines detected. Add them by hand, or paste text that includes a size and a quantity.");
  }
  return { lines, warnings };
}
function splitCsv(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}
function headerIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header.trim().toLowerCase()));
}
function parseDelimited(text) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) return null;
  const delimiter = rows[0].includes("	") ? "	" : rows[0].includes(",") ? "," : "";
  if (!delimiter) return null;
  const headers = splitCsv(rows[0], delimiter).map((cell) => cell.toLowerCase());
  const qtyCol = headerIndex(headers, ["qty", "quantity", "units", "ordered", "order qty"]);
  if (qtyCol < 0) return null;
  const skuCol = headerIndex(headers, ["sku", "item", "item #", "item no", "item number", "code", "product"]);
  const descCol = headerIndex(headers, ["description", "desc", "name", "product name"]);
  const sizeCol = headerIndex(headers, ["size", "pack", "uom", "unit", "container"]);
  if (skuCol < 0 && descCol < 0 && sizeCol < 0) return null;
  const lines = [];
  const warnings = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsv(row, delimiter);
    const blob = [cells[sizeCol] ?? "", cells[descCol] ?? "", cells[skuCol] ?? "", row].join(" ");
    const size = detectSize(cells[sizeCol] ?? "") ?? detectSize(blob);
    const qtyRaw = Number((cells[qtyCol] ?? "").replace(/,/g, ""));
    if (!size || !Number.isFinite(qtyRaw) || qtyRaw <= 0) continue;
    const sizeText = sizeCol >= 0 ? cells[sizeCol] ?? "" : "";
    const basis = /\b(cs|cases?|bx|boxes?|cartons?)\b/i.test(sizeText) ? "case" : "each";
    lines.push({
      sku: skuCol >= 0 ? cells[skuCol] ?? "" : detectSku(row),
      description: (descCol >= 0 ? cells[descCol] : cleanupDescription(row, "")) || SIZE_LABEL[size],
      size,
      qty: Math.round(qtyRaw),
      basis,
      basisQty: Math.round(qtyRaw),
      source: row
    });
  }
  if (lines.length === 0) {
    warnings.push("The table has a quantity column, but no rows had both a size and a quantity.");
  }
  return { lines, warnings };
}
function parseOrderText(text) {
  const table = parseDelimited(text);
  if (table && table.lines.length > 0) return table;
  const slip = parsePackingSlip(text);
  if (table && slip.lines.length === 0) return table;
  return slip;
}
function toUnits(line, rules) {
  if (line.basis !== "case") return line.qty;
  return line.basisQty * ruleFor(rules, line.size).unitsPerCase;
}

// src/lib/pallet/layout.ts
var PALLET_LENGTH = 48;
var PALLET_WIDTH = 40;
var EDGE_CLEAR = 1;
var USABLE_LENGTH = PALLET_LENGTH - EDGE_CLEAR * 2;
var USABLE_WIDTH = PALLET_WIDTH - EDGE_CLEAR * 2;
var MAX_STACK = 60;
var PACKAGES = {
  quart4: { key: "quart4", label: "4 Quart", length: 10.25, width: 10.25, height: 6.2 },
  quart2: { key: "quart2", label: "2 Quart", length: 11.6, width: 6.4, height: 8.3 },
  gal1: { key: "gal1", label: "1 Gallon", length: 6.88, width: 6.88, height: 7.88 },
  gal2: { key: "gal2", label: "2 Gallon", length: 17, width: 8.5, height: 9.3 },
  gal4: { key: "gal4", label: "4 Gallon", length: 17, width: 17, height: 9.31 },
  pail5: { key: "pail5", label: "5 Gallon", length: 12.5, width: 12.5, height: 15.1 },
  vinyl: { key: "vinyl", label: "Paint vinyl", length: 64, width: 8, height: 8 },
  drawdown: { key: "drawdown", label: "Paint drawdown", length: 10, width: 8, height: 2 },
  pint: { key: "pint", label: "4 Pint", length: 10.25, width: 10.25, height: 6.2 }
};
function layerGrid(size, boxKind) {
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
function containerHeight(size, boxKind) {
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

// src/lib/pallet/plan.ts
var TOP_BOX_LIMIT = 6;
var XCEL_TOP_BOX_LIMIT = 9;
function canon(text) {
  return text.toLowerCase().replace(/excel/g, "xcel");
}
function isXcel(item) {
  return /xcel/.test(canon(`${item.sku} ${item.description}`));
}
function itemKey(item) {
  const identity = productLabel(item.sku, item.description, item.size).toUpperCase();
  return `${item.size}\0${identity}\0${item.onTop ? "top" : "base"}\0${item.boxKind ?? ""}`;
}
var MIX_PRIORITY = ["gal15", "gal125", "gal1", "quart", "pint", "gal5"];
function perBoxFor(item, rule) {
  const text = canon(`${item.sku} ${item.description}`);
  if (item.size === "quart" && /cataly|catylist|gtotcat/.test(text)) return 9;
  if (item.size === "gal1" && /xcel/.test(text)) return 4;
  return rule.unitsPerCase;
}
function isPaintGallon(item) {
  if (item.size !== "gal1") return false;
  const text = canon(`${item.sku} ${item.description}`);
  if (/xcel/.test(text)) return false;
  return /paint|chameleon|\bcwp\b/.test(text);
}
function paintBoxes(qty) {
  const boxes = [];
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
function addItem(draft, item, units, boxes) {
  const key = itemKey(item);
  const addBoxes = boxes ?? (units === item.units ? item.boxes : void 0);
  const existing = draft.items.get(key);
  if (existing) {
    existing.units += units;
    if (addBoxes != null) existing.boxes = (existing.boxes ?? 0) + addBoxes;
  } else {
    draft.items.set(key, { ...item, units, boxes: addBoxes });
  }
}
function draftRank(draft, lines) {
  let best = 1e5;
  for (const item of draft.items.values()) {
    const idx = lines.findIndex((line) => {
      const sku = (line.sku.trim() || "UNASSIGNED").toUpperCase();
      return line.size === item.size && sku === item.sku.toUpperCase();
    });
    if (idx >= 0 && idx < best) best = idx;
  }
  return best;
}
function emptyDraft(source) {
  return { items: /* @__PURE__ */ new Map(), source };
}
function activeLines(lines) {
  return lines.filter((line) => line.qty > 0);
}
function mergeSameSku(lines) {
  const map = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const sku = line.sku.trim() || "UNASSIGNED";
    const plain = line.description.replace(/\s*\[\[[^\]]+\]\]\s*/g, " ").replace(/\s+/g, " ").trim();
    const color = (line.description.match(/\[\[([^[\]]+)\]\]/)?.[1] ?? "").trim();
    const distinct = line.size === "drawdown" || line.size === "vinyl" || Boolean(color) || /hybild|tinted/i.test(`${line.sku} ${plain}`);
    const named = distinct ? productLabel(line.sku, plain, line.size).toUpperCase() : "";
    const key = distinct ? `${line.size}\0${sku.toUpperCase()}\0${color.toUpperCase()}\0${named}` : `${line.size}\0${sku.toUpperCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += line.qty;
      if (!existing.description.trim() && plain) existing.description = plain;
    } else {
      map.set(key, {
        ...line,
        sku,
        description: color ? `${plain} [[${color}]]` : plain,
        qty: line.qty
      });
    }
  }
  return [...map.values()];
}
function paintRowName(sku, description, size) {
  const detail = paintDetail(sku, description);
  if (detail && size === "gal1") {
    const tint = slipColor(description);
    return [detail.title, tint || detail.color].filter(Boolean).join(" \xB7 ");
  }
  return productLabel(sku, description, size);
}
function readPaintMix(description) {
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
function paintShareBoxes(lines) {
  const gallons = lines.filter((line) => isPaintGallon(line)).reduce((sum, line) => sum + Math.max(0, Math.round(line.qty)), 0);
  const counts = /* @__PURE__ */ new Map();
  for (const slot of paintBoxes(gallons)) counts.set(slot.kind, (counts.get(slot.kind) ?? 0) + 1);
  return [4, 2, 1].flatMap((kind) => {
    const boxes = counts.get(kind) ?? 0;
    return boxes > 0 ? [{ kind, boxes }] : [];
  });
}
function sharedPaintLots(lines) {
  const queue = lines.filter((line) => line.qty > 0).map((line) => ({ sku: line.sku, description: line.description, left: Math.round(line.qty) }));
  const total = queue.reduce((sum, line) => sum + line.left, 0);
  const grouped = /* @__PURE__ */ new Map();
  for (const slot of paintBoxes(total)) {
    let need = slot.units;
    const parts = [];
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
    const description = mixed ? `Chameleon Paint [[MIX:${parts.map((part) => `${paintRowName(part.sku, part.description, "gal1").replace(/[|=]/g, " ")}=${part.units}`).join("|")}]]` : parts[0].description;
    const key = `${slot.kind}\0${description}`;
    const group = grouped.get(key) ?? {
      lot: {
        sku: parts[0].sku,
        description,
        per: slot.kind,
        paint: true,
        pieces: null,
        boxes: 0,
        loose: 0
      },
      pieceUnits: []
    };
    group.lot.boxes += 1;
    group.pieceUnits.push(slot.units);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => ({
    ...group.lot,
    pieces: group.pieceUnits.map((units) => ({ kind: group.lot.per, units }))
  }));
}
function packGallonBoxes(lines, rule) {
  const boxLimit = Math.max(1, rule.casesPerLayer * rule.layers);
  const merged = mergeSameSku(lines);
  const lots = [
    ...sharedPaintLots(merged.filter((line) => isPaintGallon(line))),
    ...merged.filter((line) => !isPaintGallon(line)).map((line) => {
      const per = Math.max(1, perBoxFor(line, rule));
      return {
        sku: line.sku,
        description: line.description,
        per,
        paint: false,
        pieces: null,
        boxes: Math.floor(Math.max(0, line.qty) / per),
        loose: Math.max(0, line.qty) % per
      };
    })
  ];
  const full = [];
  const boxCount = () => lots.reduce((sum, lot) => sum + lot.boxes, 0);
  while (boxCount() >= boxLimit) {
    const draft = emptyDraft("combined");
    let need = boxLimit;
    for (const lot of lots) {
      if (need === 0 || lot.boxes <= 0) continue;
      const take = Math.min(lot.boxes, need);
      if (lot.pieces) {
        const taken = lot.pieces.splice(0, take);
        const groups = /* @__PURE__ */ new Map();
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
              boxes: group.boxes
            },
            group.units,
            group.boxes
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
            onTop: false
          },
          take * lot.per
        );
      }
      lot.boxes -= take;
      need -= take;
    }
    full.push(draft);
  }
  const leftover = [];
  for (const lot of lots) {
    if (lot.pieces) {
      const groups = /* @__PURE__ */ new Map();
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
          boxes: group.boxes
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
      onTop: false
    });
  }
  return { full, leftover };
}
function packToFull(items, upp) {
  const queue = items.filter((item) => item.units > 0).map((item) => ({ ...item })).sort((a, b) => b.units - a.units || a.sku.localeCompare(b.sku));
  const full = [];
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
function usedFill(draft, rules) {
  let used = 0;
  for (const item of draft.items.values()) {
    if (item.onTop) continue;
    used += item.units / unitsPerPallet(ruleFor(rules, item.size));
  }
  return used;
}
function fitUnits(draft, size, rules) {
  const upp = unitsPerPallet(ruleFor(rules, size));
  const room = 1 - usedFill(draft, rules);
  if (room <= 1e-9) return 0;
  return Math.max(0, Math.floor(room * upp + 1e-8));
}
function isFullPailDeck(draft) {
  const units = [...draft.items.values()].filter((item) => item.size === "gal5" && !item.onTop).reduce((sum, item) => sum + item.units, 0);
  return units >= 36;
}
function isFullBoxPallet(draft) {
  const items = [...draft.items.values()].filter((item) => !item.onTop);
  if (items.length === 0 || items.some((item) => item.size !== "gal1")) return false;
  const boxes = items.reduce(
    (sum, item) => sum + (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox))),
    0
  );
  return boxes >= 30;
}
function isCatalyst(item) {
  return item.size === "quart" && /cataly|catylist|gtotcat/.test(canon(`${item.sku} ${item.description}`));
}
function hasFullBox(item) {
  if ((item.boxes ?? 0) > 0) return true;
  return Math.floor(item.units / Math.max(1, item.perBox)) > 0;
}
function parkBoxesBeforePails(drafts, mixPool, rules) {
  const stay = [];
  const boxed = [];
  for (const item of mixPool) {
    if (isCatalyst(item) || !hasFullBox(item)) stay.push(item);
    else boxed.push(item);
  }
  const paint = boxed.filter((item) => isPaintGallon(item));
  const xcel = boxed.filter((item) => isXcel(item) && !isPaintGallon(item));
  const others = boxed.filter((item) => !isXcel(item) && !isPaintGallon(item));
  const boxDrafts = others.length > 0 ? binPack(others, rules) : [];
  drafts.push(...boxDrafts);
  const hasPails = drafts.some(
    (draft) => [...draft.items.values()].some((item) => item.size === "gal5" && !item.onTop && item.units > 0)
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
  const xcelLeft = [];
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
function binPack(items, rules) {
  const queue = items.filter((item) => item.units > 0).map((item) => ({ ...item })).sort(
    (a, b) => MIX_PRIORITY.indexOf(a.size) - MIX_PRIORITY.indexOf(b.size) || b.units - a.units || a.sku.localeCompare(b.sku)
  );
  const pallets = [];
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
function draftFill(draft, rules) {
  const base = [...draft.items.values()].filter((item) => !item.onTop);
  const gallons = base.filter((item) => item.size === "gal1");
  if (gallons.length > 0 && gallons.length === base.length) {
    const rule = ruleFor(rules, "gal1");
    const limit = Math.max(1, rule.casesPerLayer * rule.layers);
    const boxes = gallons.reduce(
      (sum, item) => sum + (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox))),
      0
    );
    if (boxes >= limit) return 1;
  }
  const fill = usedFill(draft, rules);
  return fill >= 0.999 ? 1 : fill;
}
function classify(draft, rules) {
  const sizes = new Set(
    [...draft.items.values()].filter((item) => !item.onTop).map((item) => item.size)
  );
  if (sizes.size > 1) return "mixed";
  const only = [...sizes][0];
  if (only === "gal15" || only === "gal125") return "mixed";
  if (draftFill(draft, rules) >= 0.999) return "full";
  return "partial";
}
function toPlanLines(draft, rules) {
  return [...draft.items.values()].sort(
    (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size) || a.sku.localeCompare(b.sku)
  ).map((item) => {
    const rule = ruleFor(rules, item.size);
    const per = item.perBox > 0 ? item.perBox : rule.unitsPerCase;
    const packs = item.boxes != null ? item.boxes : Math.floor(item.units / per);
    const loose = item.boxes != null ? 0 : item.units % per;
    return {
      sku: item.sku,
      description: item.description,
      size: item.size,
      units: item.units,
      packs,
      loose,
      pounds: item.units * rule.poundsPerUnit,
      onTop: item.onTop,
      boxKind: item.boxKind
    };
  });
}
function loadNote(lines, rules) {
  const base = lines.filter((line) => !line.onTop);
  const tops = lines.filter((line) => line.onTop);
  const note = base.length > 0 ? baseNote(base, rules) : "Boxes only.";
  if (tops.length === 0) return note;
  const riding = tops.map((line) => {
    if (line.packs > 0 && line.loose === 0) {
      return `${line.packs} ${packNoun(line.size, line.packs)} ${line.sku}`;
    }
    if (line.packs > 0) return `${line.packs} ${packNoun(line.size, line.packs)} + ${line.loose} loose ${line.sku}`;
    return `${line.loose} loose ${line.sku}`;
  }).join(", ");
  return `${note} On top: ${riding}.`;
}
function baseNote(lines, rules) {
  const sizes = SIZE_ORDER.filter((size2) => lines.some((line) => line.size === size2));
  if (sizes.length !== 1) {
    const labels = sizes.map((size2) => ruleFor(rules, size2).label);
    return `Bottom to top: ${labels.join(" \u2192 ")}. Heavier containers on the bottom.`;
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
  let note;
  if (stackUnits === 0) {
    note = `${loose} loose ${loose === 1 ? "unit" : "units"} \u2014 no full pack.`;
  } else if (extra === 0) {
    note = `${fullLayers} ${fullLayers === 1 ? "layer" : "layers"} \xD7 ${per} ${noun}.`;
  } else if (fullLayers === 0) {
    note = `${extra} ${packNoun(size, extra)} on one layer.`;
  } else {
    note = `${fullLayers} full ${fullLayers === 1 ? "layer" : "layers"} \xD7 ${per}, plus ${extra} on top.`;
  }
  if (loose > 0 && rule.unitsPerCase > 1 && packs > 0) {
    note += ` ${loose} loose on top.`;
  }
  return note;
}
function familyScore(base, top) {
  const skip = /* @__PURE__ */ new Set(["part", "paint", "based", "finish", "gallon", "quart", "with"]);
  const tokens = (text) => canon(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !skip.has(word));
  const baseTokens = new Set(tokens(`${base.sku} ${base.description}`));
  let score = 0;
  for (const word of tokens(`${top.sku} ${top.description}`)) {
    if (baseTokens.has(word)) score += 1;
  }  const stem = (sku) => sku.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const baseStem = stem(base.sku);
  const topStem = stem(top.sku);
  if (baseStem.length >= 4 && baseStem === topStem) score += 3;
  return score;
}
function primaryPail(draft) {
  return [...draft.items.values()].find((item) => item.size === "gal5" && !item.onTop);
}
function draftInches(draft) {
  const bands = /* @__PURE__ */ new Map();
  for (const item of draft.items.values()) {
    const count = item.size === "gal5" ? item.units : item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox));
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
function heightBoxes(draft, item) {
  const height = containerHeight(item.size, item.boxKind);
  const layers = Math.floor((MAX_STACK - draftInches(draft) + 1e-6) / height);
  if (layers <= 0) return 0;
  return layers * layerGrid(item.size, item.boxKind).perLayer;
}
function topLimit(draft) {
  const pail = primaryPail(draft);
  return pail && isXcel(pail) ? XCEL_TOP_BOX_LIMIT : TOP_BOX_LIMIT;
}
function stackOnPails(drafts, pool) {
  const pails = drafts.filter((draft) => primaryPail(draft));
  if (pails.length === 0 || pool.length === 0) return;
  const used = /* @__PURE__ */ new Map();
  const best = (item) => {
    const paint = isPaintGallon(item);
    const open = pails.filter((draft) => {
      const cap = paint ? TOP_BOX_LIMIT : topLimit(draft);
      return cap - (used.get(draft) ?? 0) > 0 && heightBoxes(draft, item) > 0;
    });
    if (open.length === 0) return void 0;
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
  const pending = pool.filter((item) => item.units > 0 && item.size !== "gal5").sort((a, b) => {
    const scoreA = Math.max(...pails.map((draft) => familyScore(primaryPail(draft) ?? a, a)));
    const scoreB = Math.max(...pails.map((draft) => familyScore(primaryPail(draft) ?? b, b)));
    return scoreB - scoreA || b.units - a.units;
  });
  const leftover = [];
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
      addItem(target, { ...item, onTop: true }, take * per, item.boxes != null ? take : void 0);
      if (boxesLeft != null) boxesLeft -= take;
      used.set(target, (used.get(target) ?? 0) + take);
      left -= take * per;
    }
    if (left > 0) {
      const target = best(item);
      if (target && heightBoxes(target, item) > 0) {
        addItem(target, { ...item, onTop: true }, left, boxesLeft != null ? Math.max(boxesLeft, 1) : void 0);
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
function topFourGallonOnBulk(drafts) {
  const decks = drafts.filter(
    (draft) => [...draft.items.values()].some((item) => item.size === "gal5" && !item.onTop && item.units > 0)
  );
  if (decks.length === 0) return;
  const takeBoxes = (draft, count) => {
    for (const item of draft.items.values()) {
      if (!isPaintGallon(item) || item.onTop || item.size === "gal5") continue;
      const boxes = item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox));
      const take = Math.min(count, boxes);
      if (take <= 0) continue;
      const units = item.boxes && item.boxes > 0 ? Math.min(item.units, Math.max(1, Math.round(item.units / item.boxes * take))) : Math.min(item.units, take * Math.max(1, item.perBox));
      const key = itemKey(item);
      item.units -= units;
      if (item.boxes != null) item.boxes -= take;
      if (item.units <= 0 || item.boxes != null && item.boxes <= 0) draft.items.delete(key);
      return { item, units, boxes: take };
    }
    return null;
  };
  for (const deck of decks) {
    let room = Math.min(TOP_BOX_LIMIT, heightBoxes(deck, { size: "gal1", boxKind: 4, perBox: 4, units: 4, sku: "", description: "", onTop: true }));
    const already = [...deck.items.values()].filter((item) => item.onTop).reduce((sum, item) => sum + (item.boxes ?? Math.floor(item.units / Math.max(1, item.perBox))), 0);
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
function finalize(drafts, rules) {
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
      note: loadNote(lines, rules)
    };
  });
}
function lineCalcs(lines, rules, pallets) {
  return lines.map((line) => {
    const rule = ruleFor(rules, line.size);
    const qty = Math.max(0, Math.round(line.qty));
    const upp = unitsPerPallet(rule);
    const upc = rule.unitsPerCase;
    const fullPallets = qty > 0 ? Math.floor(qty / upp) : 0;
    const unitsOnFull = fullPallets * upp;
    const remainderUnits = qty - unitsOnFull;
    const sku = line.sku.trim() || "UNASSIGNED";
    const palletNumbers = pallets.filter(
      (pallet) => pallet.source === "combined" && pallet.lines.some(
        (item) => item.size === line.size && item.sku.toUpperCase() === sku.toUpperCase()
      )
    ).map((pallet) => pallet.number);
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
      palletNumbers
    };
  });
}
function sizeRollups(lines, rules) {
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
      pounds: units * rule.poundsPerUnit
    };
  });
}
function buildPlan(lines, rules, settings) {
  const error = ruleError(rules);
  if (error) return { error };
  if (settings.palletTareLb < 0) return { error: "Pallet tare can't be negative." };
  const usable = activeLines(lines).filter((line) => line.size !== "drawdown").map((line) => ({
    ...line,
    qty: Math.round(line.qty)
  }));
  const drafts = [];
  const mixPool = [];
  for (const size of SIZE_ORDER) {
    const rule = ruleFor(rules, size);
    if (size === "gal1") {
      const packed2 = packGallonBoxes(
        usable.filter((line) => line.size === "gal1"),
        rule
      );
      drafts.push(...packed2.full);
      if (packed2.leftover.length === 0) continue;
      if (rule.mixGroup === "small" && settings.mixSmall) mixPool.push(...packed2.leftover);
      else {
        const draft = emptyDraft("combined");
        for (const item of packed2.leftover) addItem(draft, item, item.units);
        drafts.push(draft);
      }
      continue;
    }
    const upp = unitsPerPallet(rule);
    const merged = mergeSameSku(usable.filter((line) => line.size === size));
    const pool = [];
    for (const line of merged) {
      const full = Math.floor(line.qty / upp);
      const rem = line.qty % upp;
      const perBox = perBoxFor(line, rule);
      for (let index = 0; index < full; index += 1) {
        const draft = emptyDraft("straight");
        addItem(
          draft,
          { sku: line.sku, description: line.description, size, units: upp, perBox, onTop: false },
          upp
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
    lines.filter((line) => line.size !== "drawdown"),
    rules
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
    grossLb: productLb + pallets.length * settings.palletTareLb
  };
  return { pallets, lines: calcs, bySize, totals };
}
function isPlan(value) {
  return !("error" in value);
}
function slipColor(description) {
  return description.match(/\[\[([^[\]]+)\]\]/)?.[1]?.trim() ?? "";
}
function paintDetail(sku, description) {
  const text = `${sku} ${description}`;
  if (!/chameleon|\bcwp\b|\bgtcop\b/i.test(text)) return null;
  const color = text.match(/\bSW\s*\d{3,5}\b(?:\s+[A-Za-z][A-Za-z0-9.'-]*){0,4}/i)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
  const base = /h2o|water/i.test(text) ? "Chameleon Paint H2O Based" : /oil/i.test(text) ? "Chameleon Paint Oil Based" : "Chameleon Paint";
  const title = [sku.trim(), base].filter(Boolean).join(" ");
  return { title, color };
}
function productLabel(sku, description, size) {
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
      return tint ? `${base} \xB7 ${tint}` : base;
    }
    return sealer ? "Hybild Sealer" : "Hybild";
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

// src/lib/pallet/handoff.ts
function toPallets(plan) {
  return plan.pallets.map((pallet) => ({
    number: pallet.number,
    kind: pallet.kind,
    pounds: Math.round(pallet.pounds),
    items: pallet.lines.map((line) => ({
      product: readPaintMix(line.description) ? "Paint" : productLabel(line.sku, line.description, line.size),
      sku: line.sku,
      size: sizeTitle(line.size),
      units: line.units,
      boxes: line.size === "gal5" || line.packs === 0 ? null : line.packs,
      boxKind: line.boxKind ?? null,
      onTop: line.onTop
    }))
  }));
}
function planFromSlip(text) {
  const parsed = parseOrderText(text);
  if (parsed.lines.length === 0) {
    return { ok: false, error: parsed.warnings[0] ?? "No product lines found." };
  }
  const meta = parseSlipMeta(text);
  const lines = parsed.lines.map((line, index) => ({
    id: String(index + 1),
    sku: line.sku,
    description: line.description,
    size: line.size,
    qty: toUnits(line, DEFAULT_RULES)
  }));
  return planShipment({ orderName: meta.orderName, customer: meta.customer, lines }, text);
}
function planShipment(input, slipText = "") {
  const plan = buildPlan(input.lines, DEFAULT_RULES, DEFAULT_SETTINGS);
  if (!isPlan(plan)) return { ok: false, error: plan.error };
  const meta = slipText ? parseSlipMeta(slipText) : { orderName: "", customer: "", po: "" };
  return {
    ok: true,
    orderName: input.orderName || meta.orderName,
    customer: input.customer || meta.customer,
    po: meta.po,
    salesperson: slipText ? salespersonFromSlip(slipText) : { name: "", email: "" },
    batchCodes: slipText ? extractBatchCodes(slipText) : [],
    lines: input.lines,
    paintBoxes: paintShareBoxes(input.lines),
    pallets: toPallets(plan),
    totals: plan.totals
  };
}
var SAMPLE_SLIP = `
Shipment #: 134626-SAA
Customer's PO #: 1720
Sports Floors Inc.
\u2022 216, GT500-F Sport Poly Oil Finish - 5 Gallon
\u2022 36, GTHS-5 Hybild Sealer - 5 Gallon
\u2022 36, GTOT-5 OverTime Finish 2k Part A - 5 Gallon
\u2022 36, GTOTCAT-QT OverTime Catalyst Part B - Quart
\u2022 2, GTCWP-1 Chameleon Paint H2O Based - Gallon
`;
function printPlan(title, plan) {
  console.log("\n" + title);
  if (!plan.ok) {
    console.log(plan.error);
    return;
  }
  console.log(plan.totals.pallets + " pallets");
  for (const pallet of plan.pallets) {
    const items = pallet.items.map((item) => `${item.onTop ? "ON TOP " : ""}${item.product} ${item.units}${item.boxes ? " (" + item.boxes + " boxes)" : ""}`).join(" | ");
    console.log("#" + pallet.number + " " + pallet.kind + ": " + items);
  }
}
if (typeof process !== "undefined" && process.argv[1]?.endsWith("gametim-shipping.mjs")) {
  printPlan("134626", planFromSlip(SAMPLE_SLIP));
  printPlan(
    "Paint colors share one box",
    planShipment({
      lines: [
        { id: "a", sku: "GTCWP-1", description: "Chameleon Paint H2O Based [[Safety White]]", size: "gal1", qty: 2 },
        { id: "b", sku: "GTCWP-1", description: "Chameleon Paint H2O Based [[Cool Gray 10c]]", size: "gal1", qty: 2 }
      ]
    })
  );
  printPlan(
    "36 pails plus 24 paint gallons",
    planShipment({
      lines: [
        { id: "p", sku: "GT500-F", description: "500 Finish", size: "gal5", qty: 36 },
        { id: "c", sku: "CWP", description: "Chameleon Paint", size: "gal1", qty: 24 }
      ]
    })
  );
}
export {
  productLabel,
  DEFAULT_RULES,
  DEFAULT_SETTINGS,
  SAMPLE_SLIP,
  buildPlan,
  parseOrderText,
  planFromSlip,
  planShipment
};