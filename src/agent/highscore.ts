const KEY = "spacemelon:hs:v1";

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    // Touch the API to surface any access errors (Safari private mode etc.).
    const probe = "__sm_probe__";
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function loadBestScore(): number {
  const s = safeStorage();
  if (!s) return 0;
  const raw = s.getItem(KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Returns true if `score` beat the previous best (or there was none).
export function saveBestScore(score: number): boolean {
  const s = safeStorage();
  if (!s) return false;
  const prev = loadBestScore();
  if (score <= prev) return false;
  try {
    s.setItem(KEY, String(score));
    return true;
  } catch {
    return false;
  }
}
