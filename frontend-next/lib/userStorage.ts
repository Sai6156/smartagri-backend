import { getUser } from "@/lib/auth";

/** Per-user localStorage key — isolates scan data between accounts on the same browser. */
export function userStorageKey(base: string): string {
  const uid = getUser()?.user_id;
  if (!uid) return `${base}:guest`;
  return `${base}:${uid}`;
}

export function notifyUserChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sa-user-changed"));
}
