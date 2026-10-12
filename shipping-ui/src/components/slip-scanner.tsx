import { useEffect, useRef, useState } from "react";
import { readSlipPhoto, photoBlurScore, BLURRY_SCAN } from "@/lib/pallet/scan";

type SlipScannerProps = {
  stream: MediaStream;
  onClose: () => void;
  onPage: (text: string) => boolean;
};

function sampleDiff(video: HTMLVideoElement, previous: Uint8ClampedArray | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 72;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || video.videoWidth === 0) return { diff: 999, pixels: previous };
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8ClampedArray(canvas.width * canvas.height);
  let diff = 0;
  for (let index = 0, pixel = 0; index < frame.length; index += 4, pixel += 1) {
    const tone = Math.round(frame[index] * 0.299 + frame[index + 1] * 0.587 + frame[index + 2] * 0.114);
    pixels[pixel] = tone;
    if (previous) diff += Math.abs(tone - previous[pixel]);
  }
  return { diff: previous ? diff / pixels.length : 999, pixels };
}

function captureFrame(video: HTMLVideoElement): Promise<File> {
  const long = Math.max(video.videoWidth, video.videoHeight);
  const scale = long > 2400 ? 2400 / long : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Could not capture the page."));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not capture the page."));
        else resolve(new File([blob], "packing-slip.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function SlipScanner({ stream, onClose, onPage }: SlipScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  const [hint, setHint] = useState("Hold the camera steady over the packing slip.");
  const [reading, setReading] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let closed = false;
    let timer = 0;
    let previous: Uint8ClampedArray | null = null;
    let steady = 0;
    let armed = true;
    let busy = false;

    const tick = async () => {
      if (closed || busy || video.videoWidth === 0) {
        timer = window.setTimeout(() => void tick(), 300);
        return;
      }
      const sample = sampleDiff(video, previous);
      previous = sample.pixels;
      if (sample.diff > 26) {
        steady = 0;
        armed = true;
        setHint("Hold the camera steady over the packing slip.");
      } else if (armed && sample.diff < 11) {
        steady += 1;
        setHint("Hold still. Scanning the page…");
        if (steady >= 3) {
          steady = 0;
          armed = false;
          busy = true;
          setReading(true);
          setHint("Reading the packing slip…");
          try {
            const file = await captureFrame(video);
            const sharp = await photoBlurScore(file);
            if (sharp < 70) throw new Error(BLURRY_SCAN);
            const text = await readSlipPhoto(file);
            if (closed) return;
            const ok = onPageRef.current(text);
            setHint(
              ok
                ? "Page read. Move to the next page and hold still, or tap Done."
                : "No products read. Fill the frame with the slip and hold still.",
            );
          } catch (error) {
            if (!closed) {
              const message = error instanceof Error ? error.message : "The camera could not read that page.";
              setHint(message === BLURRY_SCAN ? BLURRY_SCAN : message);
              armed = message === BLURRY_SCAN;
            }
          } finally {
            busy = false;
            if (!closed) setReading(false);
          }
        }
      } else {
        steady = 0;
      }
      if (!closed) timer = window.setTimeout(() => void tick(), busy ? 400 : 280);
    };

    const start = async () => {
      try {
        video.srcObject = stream;
        await video.play();
        timer = window.setTimeout(() => void tick(), 400);
      } catch {
        if (!closed) setHint("Allow the camera, then hold it over the packing slip.");
      }
    };

    void start();
    return () => {
      closed = true;
      window.clearTimeout(timer);
    };
  }, [stream]);

  return (
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={videoRef} className="min-h-0 flex-1 w-full object-contain" playsInline muted autoPlay />
      <div className="pointer-events-none absolute inset-x-6 top-16 bottom-40 border-2 border-mustard/80" />
      <div className="absolute inset-x-0 bottom-0 space-y-3 bg-black/80 px-4 py-4" aria-busy={reading}>
        <p className="text-sm text-white" aria-live="polite">
          {hint}
        </p>
        <div className="flex gap-3">
          <button type="button" className="katchup-btn is-lit" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
