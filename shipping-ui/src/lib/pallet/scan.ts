import { normalizeSlipText, parseOrderText } from "./parse";

const BLUR_LIMIT = 70;

export function laplacianVariance(gray: Uint8ClampedArray, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  const step = width > 800 ? 2 : 1;
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const center = gray[y * width + x];
      const lap =
        center * 4 -
        gray[y * width + (x - step)] -
        gray[y * width + (x + step)] -
        gray[(y - step) * width + x] -
        gray[(y + step) * width + x];
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

async function blurScore(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): Promise<number> {
  const long = Math.max(sourceWidth, sourceHeight);
  if (long < 32) return 0;
  const scale = 480 / long;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return BLUR_LIMIT;
  ctx.drawImage(source, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);
  for (let index = 0, pixel = 0; index < frame.data.length; index += 4, pixel += 1) {
    gray[pixel] = Math.round(frame.data[index] * 0.299 + frame.data[index + 1] * 0.587 + frame.data[index + 2] * 0.114);
  }
  return laplacianVariance(gray, width, height);
}

export async function photoBlurScore(file: File): Promise<number> {
  const bitmap = await createImageBitmap(file);
  try {
    return await blurScore(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export const BLURRY_SCAN = "That scan is blurry. Hold the phone steady, move a little closer, and try again.";

type Gray = { data: Uint8ClampedArray; width: number; height: number };

function grayFromCanvas(canvas: HTMLCanvasElement): Gray {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { data: new Uint8ClampedArray(0), width: canvas.width, height: canvas.height };
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = new Uint8ClampedArray(frame.data.length / 4);
  for (let index = 0, pixel = 0; index < frame.data.length; index += 4, pixel += 1) {
    data[pixel] = Math.round(frame.data[index] * 0.299 + frame.data[index + 1] * 0.587 + frame.data[index + 2] * 0.114);
  }
  return { data, width: canvas.width, height: canvas.height };
}

function canvasFromGray(gray: Gray): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, gray.width);
  canvas.height = Math.max(1, gray.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const frame = ctx.createImageData(canvas.width, canvas.height);
  for (let index = 0, pixel = 0; index < frame.data.length; index += 4, pixel += 1) {
    const tone = gray.data[pixel] ?? 255;
    frame.data[index] = tone;
    frame.data[index + 1] = tone;
    frame.data[index + 2] = tone;
    frame.data[index + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

function stretchContrast(gray: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  for (let index = 0; index < gray.length; index += 1) hist[gray[index]] += 1;
  const cut = gray.length * 0.015;
  let low = 0;
  let high = 255;
  let seen = 0;
  for (let tone = 0; tone < 256; tone += 1) {
    seen += hist[tone];
    if (seen >= cut) {
      low = tone;
      break;
    }
  }
  seen = 0;
  for (let tone = 255; tone >= 0; tone -= 1) {
    seen += hist[tone];
    if (seen >= cut) {
      high = tone;
      break;
    }
  }
  const span = Math.max(16, high - low);
  for (let index = 0; index < gray.length; index += 1) {
    let tone = ((gray[index] - low) * 255) / span;
    if (tone < 0) tone = 0;
    if (tone > 255) tone = 255;
    gray[index] = tone < 150 ? tone * 0.72 : Math.min(255, 220 + (tone - 150) * 0.33);
  }
}

function skewDegrees(gray: Gray): number {
  const step = Math.max(1, Math.floor(Math.max(gray.width, gray.height) / 420));
  const width = Math.floor(gray.width / step);
  const height = Math.floor(gray.height / step);
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      ink[y * width + x] = gray.data[y * step * gray.width + x * step] < 140 ? 1 : 0;
    }
  }
  let best = 0;
  let bestScore = -1;
  const cx = width / 2;
  const cy = height / 2;
  for (let degree = -6; degree <= 6; degree += 0.5) {
    const radians = (degree * Math.PI) / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const rows = new Float64Array(height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!ink[y * width + x]) continue;
        const row = Math.round(cy + (x - cx) * sin + (y - cy) * cos);
        if (row >= 0 && row < height) rows[row] += 1;
      }
    }
    let mean = 0;
    for (const value of rows) mean += value;
    mean /= height;
    let variance = 0;
    for (const value of rows) variance += (value - mean) * (value - mean);
    if (variance > bestScore) {
      bestScore = variance;
      best = degree;
    }
  }
  return Math.abs(best) < 0.5 ? 0 : best;
}

function rotate(gray: Gray, degrees: number): Gray {
  if (!degrees) return gray;
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.round(gray.width * cos + gray.height * sin);
  const height = Math.round(gray.width * sin + gray.height * cos);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return gray;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(canvasFromGray(gray), -gray.width / 2, -gray.height / 2);
  return grayFromCanvas(canvas);
}

function cropInk(gray: Gray): Gray {
  let minX = gray.width;
  let minY = gray.height;
  let maxX = 0;
  let maxY = 0;
  const stride = gray.width > 1600 ? 2 : 1;
  for (let y = 0; y < gray.height; y += stride) {
    for (let x = 0; x < gray.width; x += stride) {
      if (gray.data[y * gray.width + x] > 176) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return gray;
  const pad = 28;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(gray.width, maxX + pad);
  const y1 = Math.min(gray.height, maxY + pad);
  const width = x1 - x0;
  const height = y1 - y0;
  if (width > gray.width * 0.92 && height > gray.height * 0.92) return gray;
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    data.set(gray.data.subarray((y0 + y) * gray.width + x0, (y0 + y) * gray.width + x1), y * width);
  }
  return { data, width, height };
}

function scaleTo(gray: Gray, longEdge: number): Gray {
  const long = Math.max(gray.width, gray.height);
  if (Math.abs(long - longEdge) < 40) return gray;
  const scale = longEdge / long;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(gray.width * scale));
  canvas.height = Math.max(1, Math.round(gray.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return gray;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvasFromGray(gray), 0, 0, canvas.width, canvas.height);
  return grayFromCanvas(canvas);
}

function sharpen(gray: Gray): void {
  const { data, width, height } = gray;
  const blur = new Float64Array(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += data[yy * width + xx];
          count += 1;
        }
      }
      blur[y * width + x] = sum / count;
    }
  }
  for (let index = 0; index < data.length; index += 1) {
    let tone = data[index] + (data[index] - blur[index]) * 0.9;
    if (tone < 0) tone = 0;
    if (tone > 255) tone = 255;
    data[index] = tone;
  }
}

function binarize(gray: Gray): Gray {
  const { data, width, height } = gray;
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let row = 0;
    for (let x = 1; x <= width; x += 1) {
      row += data[(y - 1) * width + (x - 1)];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
    }
  }
  const radius = 28;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * stride + (x1 + 1)] -
        integral[y0 * stride + (x1 + 1)] -
        integral[(y1 + 1) * stride + x0] +
        integral[y0 * stride + x0];
      out[y * width + x] = data[y * width + x] < sum / area - 10 ? 0 : 255;
    }
  }
  return { data: out, width, height };
}

async function prepareSlip(file: File): Promise<HTMLCanvasElement[]> {
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height);
  const first = long > 3400 ? 3200 / long : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * first));
  canvas.height = Math.max(1, Math.round(bitmap.height * first));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that photo.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let gray = grayFromCanvas(canvas);
  stretchContrast(gray.data);
  gray = rotate(gray, skewDegrees(gray));
  gray = cropInk(gray);
  const edge = Math.max(gray.width, gray.height);
  gray = scaleTo(gray, edge < 2200 ? 2800 : Math.min(edge, 3200));
  sharpen(gray);
  return [canvasFromGray(gray), canvasFromGray(binarize(gray))];
}

function scoreSlip(text: string): number {
  const parsed = parseOrderText(text);
  const words = text.match(/\b(?:gallons?|quarts?|pints?|pails?|stencils?|vinyl|draw\s*-?\s*downs?|shirts?)\b/gi)?.length ?? 0;
  const shipment = /shipment\s*#/i.test(text) ? 4 : 0;
  return parsed.lines.length * 100 + words * 3 + shipment;
}

export async function readSlipPhoto(file: File): Promise<string> {
  try {
    const score = await photoBlurScore(file);
    if (score < BLUR_LIMIT) throw new Error(BLURRY_SCAN);
  } catch (error) {
    if (error instanceof Error && error.message === BLURRY_SCAN) throw error;
  }
  let images: Array<HTMLCanvasElement | File> = [file];
  try {
    images = await prepareSlip(file);
  } catch {
    images = [file];
  }
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    let best = "";
    let bestScore = -1;
    for (const image of images) {
      const result = await worker.recognize(image);
      const text = result.data.text ?? "";
      const score = scoreSlip(text);
      if (score > bestScore) {
        best = text;
        bestScore = score;
      }
    }
    if (bestScore < 100 && images[0]) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const retry = await worker.recognize(images[0]);
      const text = retry.data.text ?? "";
      if (scoreSlip(text) > bestScore) best = text;
    }
    return normalizeSlipText(best);
  } finally {
    await worker.terminate();
  }
}

export function isSlipImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name);
}
