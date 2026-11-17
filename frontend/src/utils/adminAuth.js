import { ADMIN_TOKEN_KEY } from "./constants";

export function hasValidAdminToken() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return false;

  try {
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = atob(encodedPayload);
    const payload = JSON.parse(decodeURIComponent(
      Array.from(bytes, (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
      ).join("")
    ));
    if (payload.is_admin === true && Number(payload.exp) * 1000 > Date.now()) return true;
  } catch {
    // Invalid tokens are treated as an expired admin session.
  }

  localStorage.removeItem(ADMIN_TOKEN_KEY);
  return false;
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}
