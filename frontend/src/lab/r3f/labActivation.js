export const R3F_LAB_QUERY_KEY = "lab";
export const R3F_LAB_QUERY_VALUE = "r3f";
export const R3F_LAB_STORAGE_KEY = "dv:lab";

function readQueryValue(search) {
  const rawSearch = String(search || "").trim();
  const params = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch : `?${rawSearch}`);
  return String(params.get(R3F_LAB_QUERY_KEY) || "")
    .trim()
    .toLowerCase();
}

export function isR3FLabQueryEnabled(search) {
  return readQueryValue(search) === R3F_LAB_QUERY_VALUE;
}

export function isR3FLabStorageEnabled(storage) {
  if (!storage || typeof storage.getItem !== "function") return false;
  return (
    String(storage.getItem(R3F_LAB_STORAGE_KEY) || "")
      .trim()
      .toLowerCase() === R3F_LAB_QUERY_VALUE
  );
}

export function rememberR3FLabActivation(storage) {
  if (!storage || typeof storage.setItem !== "function") return false;
  storage.setItem(R3F_LAB_STORAGE_KEY, R3F_LAB_QUERY_VALUE);
  return true;
}

export function clearR3FLabActivation(storage) {
  if (!storage || typeof storage.removeItem !== "function") return false;
  storage.removeItem(R3F_LAB_STORAGE_KEY);
  return true;
}

export function shouldOpenR3FLab({ isDev = false, search = "", storage = null } = {}) {
  if (!isDev) return false;
  return isR3FLabQueryEnabled(search) || isR3FLabStorageEnabled(storage);
}
