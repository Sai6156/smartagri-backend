export interface User {
  user_id: string;
  email: string;
  name: string;
  token: string;
}

export function saveUser(user: User): void {
  localStorage.setItem("sa_token", user.token);
  localStorage.setItem("sa_user", JSON.stringify(user));
  window.dispatchEvent(new Event("sa-user-changed"));
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sa_user");
  return raw ? JSON.parse(raw) : null;
}

export function logout(): void {
  localStorage.removeItem("sa_token");
  localStorage.removeItem("sa_user");
  window.dispatchEvent(new Event("sa-user-changed"));
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sa_token") || "";
}
