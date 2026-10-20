import { parseRecordId } from "./record-id";

export function socialReturnPath(formData?: FormData) {
  const value = formData?.get("returnTo");
  if (typeof value !== "string" || value.length > 4096 || !value.startsWith("/users/search")) return "/users/search";
  let url: URL;
  try { url = new URL(value, "https://local.invalid"); }
  catch { return "/users/search"; }
  if (url.origin !== "https://local.invalid" || url.pathname !== "/users/search") return "/users/search";
  const params = new URLSearchParams();
  const query = url.searchParams.get("q")?.trim();
  if (query) params.set("q", query);
  for (const key of ["page", "friendPage", "requestPage"]) {
    const page = parseRecordId(url.searchParams.get(key));
    if (page && page > 1) params.set(key, String(page));
  }
  const fragment = ["#user-results", "#friends", "#friend-requests"].includes(url.hash) ? url.hash : "";
  return `/users/search${params.size ? `?${params}` : ""}${fragment}`;
}
