import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** True in a normal browser tab. Installed app starts false after mount. */
export function useShowHomeIntro() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const sync = () => setShowIntro(!isStandalone());
    sync();
    const media = window.matchMedia("(display-mode: standalone)");
    const onInstalled = () => setShowIntro(false);
    media.addEventListener("change", sync);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return showIntro;
}

export function InstallApp() {
  const showIntro = useShowHomeIntro();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (false) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!showIntro) return null;

  function addToHome() {
    if (prompt) {
      void prompt.prompt();
      setPrompt(null);
      return;
    }
    const page = new URL(window.location.href);
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const android = /android/i.test(ua);
    const path = `${page.host}${page.pathname}${page.search}${page.hash}`;

    if (android) {
      window.location.href = `intent://${path}#Intent;scheme=${page.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(page.href)};end`;
      return;
    }

    if (ios) {
      const inSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
      if (!inSafari) {
        const scheme = page.protocol === "https:" ? "x-safari-https" : "x-safari-http";
        window.location.href = `${scheme}://${path}`;
        return;
      }
    }

    const share = navigator.share?.bind(navigator);
    if (share) {
      void share({ title: "GameTime Logistics", url: page.href }).catch(() => undefined);
      return;
    }
    window.open(page.href, "_blank", "noopener");
  }

  return (
    <div className="no-print fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-56 max-h-52 overflow-y-auto border border-white/20 bg-[#0c1014] p-2 text-[11px] leading-snug text-white/80 shadow-lg">
          <p className="font-semibold text-mustard">iPhone</p>
          <p>Share, then Add to Home Screen, then Add.</p>
          <p className="mt-2 font-semibold text-mustard">Android</p>
          <p>Menu, then Install app or Add to Home screen.</p>
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="border border-white/20 bg-[#0c1014] px-2 py-1 font-mono text-[10px] tracking-wide text-mustard"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "How"}
        </button>
        <button
          type="button"
          className="bg-mustard px-2.5 py-1 text-xs font-bold text-black"
          onClick={addToHome}
        >
          Add to Home
        </button>
      </div>
    </div>
  );
}
