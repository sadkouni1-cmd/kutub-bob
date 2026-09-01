import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const FAVORITES_KEY = "rwb:favorites";
const PROGRESS_KEY = "rwb:progress";
const CONTENT_PREFIX = "rwb:content:";

export interface CachedContent {
  pages: string[];
  source: string;
  savedAt: number;
}

export const getCachedContent = (id: string): CachedContent | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONTENT_PREFIX + id);
    return raw ? (JSON.parse(raw) as CachedContent) : null;
  } catch {
    return null;
  }
};

export const saveCachedContent = (id: string, pages: string[], source: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONTENT_PREFIX + id,
      JSON.stringify({ pages, source, savedAt: Date.now() } satisfies CachedContent),
    );
  } catch {
    /* quota exceeded — ignore */
  }
};

export const removeCachedContent = (id: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONTENT_PREFIX + id);
  } catch { /* ignore */ }
};

export const listCachedBookIds = (): string[] => {
  if (typeof window === "undefined") return [];
  const ids: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(CONTENT_PREFIX)) ids.push(k.slice(CONTENT_PREFIX.length));
  }
  return ids;
};

export interface BookProgress {
  spread: number;
  totalSpreads: number;
  updatedAt: number;
}

type ProgressMap = Record<string, BookProgress>;

const readJSON = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

/* ---------- Favorites: single shared store + per-id subscription ---------- */

let favoritesState: string[] = readJSON<string[]>(FAVORITES_KEY, []);
let favoritesSet = new Set(favoritesState);
const favListeners = new Set<() => void>();

const emitFav = () => favListeners.forEach((l) => l());

const subscribeFav = (cb: () => void) => {
  favListeners.add(cb);
  return () => favListeners.delete(cb);
};

export const toggleFavorite = (id: string) => {
  favoritesState = favoritesSet.has(id)
    ? favoritesState.filter((x) => x !== id)
    : [...favoritesState, id];
  favoritesSet = new Set(favoritesState);
  writeJSON(FAVORITES_KEY, favoritesState);
  emitFav();
};

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== FAVORITES_KEY) return;
    favoritesState = readJSON<string[]>(FAVORITES_KEY, []);
    favoritesSet = new Set(favoritesState);
    emitFav();
  });
}

// Subscribe only to the favorite-status of ONE book — re-renders only when THIS id flips.
export const useIsFavorite = (id: string) => {
  return useSyncExternalStore(
    subscribeFav,
    () => favoritesSet.has(id),
    () => false,
  );
};

// For pages that need the full list (MyBooks)
export const useFavorites = () => {
  const favorites = useSyncExternalStore(
    subscribeFav,
    () => favoritesState,
    () => favoritesState,
  );
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
  return { favorites, isFavorite, toggleFavorite };
};

/* ---------- Progress (unchanged behavior) ---------- */

export const useProgressMap = () => {
  const [progress, setProgress] = useState<ProgressMap>(() => readJSON<ProgressMap>(PROGRESS_KEY, {}));

  useEffect(() => {
    const sync = () => setProgress(readJSON<ProgressMap>(PROGRESS_KEY, {}));
    window.addEventListener("rwb:progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rwb:progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return progress;
};

export const getProgress = (id: string): BookProgress | undefined => {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  return map[id];
};

export const saveProgress = (id: string, spread: number, totalSpreads: number) => {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  map[id] = { spread, totalSpreads, updatedAt: Date.now() };
  writeJSON(PROGRESS_KEY, map);
  setLastRead(id);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rwb:progress"));
};

export const clearProgress = (id: string) => {
  const map = readJSON<ProgressMap>(PROGRESS_KEY, {});
  delete map[id];
  writeJSON(PROGRESS_KEY, map);
  if (getLastRead()?.id === id) writeJSON(LAST_READ_KEY, null);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rwb:progress"));
};

/* ---------- Last read book (resume after closing the app) ---------- */

const LAST_READ_KEY = "rwb:lastRead";

export interface LastRead {
  id: string;
  updatedAt: number;
}

export const getLastRead = (): LastRead | null => readJSON<LastRead | null>(LAST_READ_KEY, null);

export const setLastRead = (id: string) => {
  writeJSON(LAST_READ_KEY, { id, updatedAt: Date.now() } satisfies LastRead);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rwb:progress"));
};

export const useLastRead = (): LastRead | null => {
  const [last, setLast] = useState<LastRead | null>(() => getLastRead());

  useEffect(() => {
    const sync = () => setLast(getLastRead());
    window.addEventListener("rwb:progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rwb:progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return last;
};
