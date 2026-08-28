export type NaverLatLng = unknown;

export type NaverLatLngBounds = {
  extend: (latLng: NaverLatLng) => void;
  getCenter?: () => NaverLatLng;
};

export type NaverMap = {
  fitBounds: (bounds: NaverLatLngBounds, padding?: number | Record<string, number>) => void;
  setCenter: (latLng: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
};

export type NaverMarker = {
  setMap: (map: NaverMap | null) => void;
};

export type NaverPolyline = {
  setMap: (map: NaverMap | null) => void;
};

let naverMapScriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    naver?: {
      maps: {
        Event: {
          addListener: (target: NaverMarker, eventName: string, listener: () => void) => void;
        };
        LatLng: new (latitude: number, longitude: number) => NaverLatLng;
        LatLngBounds: new () => NaverLatLngBounds;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMap;
        Marker: new (options: Record<string, unknown>) => NaverMarker;
        Point: new (x: number, y: number) => unknown;
        Polyline: new (options: Record<string, unknown>) => NaverPolyline;
      };
    };
  }
}

export {};

export function getNaverMapClientId() {
  return process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID ?? "";
}

export function isNaverMapReady() {
  return typeof window !== "undefined" && Boolean(window.naver?.maps);
}

export function loadNaverMapScript() {
  const clientId = getNaverMapClientId();
  if (!clientId) return Promise.reject(new Error("Missing Naver Maps client id"));
  if (isNaverMapReady()) return Promise.resolve();

  if (!naverMapScriptPromise) {
    naverMapScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>("script[data-dailyos-naver-map]");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Naver Maps script")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.dataset.dailyosNaverMap = "true";
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Naver Maps script"));
      document.head.appendChild(script);
    });
  }

  return naverMapScriptPromise;
}
