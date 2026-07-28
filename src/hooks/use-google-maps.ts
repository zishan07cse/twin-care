import { useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { __gmapsPromise?: Promise<any>; __gmapsInit?: () => void } }

const KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGoogleMaps(): { google: any | null; error: string | null } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [google, setGoogle] = useState<any | null>(
    typeof window !== "undefined" && (window as unknown as { google?: unknown }).google
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (window as any).google
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (google) return;
    if (typeof window === "undefined") return;
    if (!KEY) {
      setError("Google Maps key not configured");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setGoogle((window as any).google);
      return;
    }
    if (!window.__gmapsPromise) {
      window.__gmapsPromise = new Promise((resolve, reject) => {
        window.__gmapsInit = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resolve((window as any).google);
        };
        const s = document.createElement("script");
        const params = new URLSearchParams({
          key: KEY,
          loading: "async",
          callback: "__gmapsInit",
        });
        if (CHANNEL) params.set("channel", CHANNEL);
        s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        s.async = true;
        s.onerror = () => reject(new Error("Failed to load Google Maps"));
        document.head.appendChild(s);
      });
    }
    window.__gmapsPromise.then(setGoogle).catch((e) => setError((e as Error).message));
  }, [google]);

  return { google, error };
}
