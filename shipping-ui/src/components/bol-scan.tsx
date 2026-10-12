import { useEffect, useRef, useState } from "react";

type BolScanProps = {
  onClose: () => void;
  onCode: (code: string) => void;
};

type DetectorHit = { rawValue?: string };

function proNumber(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length >= cleaned.length - 2) return digits;
  return cleaned;
}

function pickCode(values: string[]): string {
  const ready = values.map(proNumber).filter((value) => value.length >= 6);
  ready.sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length);
  return ready[0] ?? "";
}

let zxingReader: { decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText: () => string } } | null = null;

async function readFrame(canvas: HTMLCanvasElement): Promise<string> {
  const detectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<DetectorHit[]> } }).BarcodeDetector;
  if (detectorCtor) {
    const detector = new detectorCtor({
      formats: ["code_128", "code_39", "codabar", "itf", "ean_13", "ean_8", "upc_a", "upc_e"],
    });
    const hits = await detector.detect(canvas);
    return pickCode(hits.map((hit) => hit.rawValue ?? ""));
  }
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  zxingReader ??= new BrowserMultiFormatReader();
  try {
    const result = zxingReader.decodeFromCanvas(canvas);
    return proNumber(result.getText());
  } catch {
    return "";
  }
}

export function BolScan({ onClose, onCode }: BolScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [hint, setHint] = useState("Point the camera at the PRO barcode.");
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let closed = false;
    let timer = 0;
    let stream: MediaStream | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const stop = () => {
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const tick = async () => {
      if (closed || !ctx || video.videoWidth === 0) {
        timer = window.setTimeout(() => void tick(), 280);
        return;
      }
      const scale = Math.min(1, 1400 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const code = await readFrame(canvas);
        if (code) {
          closed = true;
          stop();
          onCodeRef.current(code);
          return;
        }
      } catch {
        setHint("Hold the barcode steady in the box.");
      }
      timer = window.setTimeout(() => void tick(), 280);
    };

    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((next) => {
        if (closed) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        video.srcObject = next;
        void video.play().then(() => void tick());
      })
      .catch(() => {
        setError("Camera is blocked. Allow the camera, or type the PRO number.");
      });

    return () => {
      closed = true;
      stop();
    };
  }, []);

  return (
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold">{error || hint}</p>
        <button type="button" className="border border-white/40 px-3 py-2 text-sm font-semibold" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 border-2 border-mustard" />
      </div>
    </div>
  );
}
