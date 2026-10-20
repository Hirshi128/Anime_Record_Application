import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it, vi } from "vitest";

const origin = "https://anime.example";
type RequestKey = string | { url: string };
type WorkerEvent = { request?: { url: string; method: string; mode: string }; data?: { type: string; urls: unknown[] }; ports?: { postMessage: (data: unknown) => void }[]; waitUntil: (promise: Promise<unknown>) => void; respondWith: (promise: Promise<Response>) => void };

function worker() {
  const stores = new Map<string, Map<string, Response>>();
  const listeners: Record<string, (event: WorkerEvent) => void> = {};
  const key = (request: RequestKey) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const fetch = vi.fn(async () => new Response("public shell", { headers: { "content-type": "text/html" } }));
  async function open(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name)!;
    return {
      match: async (request: RequestKey) => entries.get(key(request))?.clone(),
      put: async (request: RequestKey, response: Response) => { entries.set(key(request), response); },
      add: async (request: RequestKey) => { entries.set(key(request), new Response("asset")); },
      addAll: async (requests: string[]) => { requests.forEach(request => entries.set(key(request), new Response("public shell"))); },
      keys: async () => [...entries.keys()].map(url => ({ url })),
      delete: async (request: RequestKey) => entries.delete(key(request)),
    };
  }
  const caches = { open, keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name), match: async (request: RequestKey) => {
    for (const entries of stores.values()) { const found = entries.get(key(request)); if (found) return found.clone(); }
  } };
  const self = { location: { origin }, clients: { claim: vi.fn() }, skipWaiting: vi.fn(), addEventListener: (type: string, listener: (event: WorkerEvent) => void) => { listeners[type] = listener; } };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches, fetch, URL, Response, Promise });
  async function dispatch(type: string, init: Partial<WorkerEvent> = {}) {
    const promises: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners[type]({ ...init, waitUntil: promise => { promises.push(promise); }, respondWith: promise => { response = promise; } });
    await Promise.all(promises);
    return response;
  }
  return { stores, fetch, dispatch, caches };
}

it("pre-caches only public shells and static icons, not private or API responses", async () => {
  const app = worker(); await app.dispatch("install");
  const keys = [...app.stores.values()].flatMap(entries => [...entries.keys()]);
  expect(keys).toContain(`${origin}/`); expect(keys).toContain(`${origin}/library`);
  expect(keys.some(url => url.includes("/users") || url.includes("/api"))).toBe(false);
});

it("leaves APIs, cross-origin URLs, server components and POST requests untouched", async () => {
  const app = worker();
  for (const request of [
    { url: `${origin}/api/anime-title-suggestions?query=test`, method: "GET", mode: "cors" },
    { url: `${origin}/library?_rsc=1`, method: "GET", mode: "cors" },
    { url: "https://external.example/_next/static/one.js", method: "GET", mode: "cors" },
    { url: `${origin}/library`, method: "POST", mode: "navigate" },
  ]) expect(await app.dispatch("fetch", { request })).toBeUndefined();
  expect(app.fetch).not.toHaveBeenCalled(); expect(app.stores.size).toBe(0);
});

it("opens the cached personal shell offline but uses only the fallback for legacy URLs", async () => {
  const app = worker(); await app.dispatch("install");
  app.fetch.mockRejectedValue(new Error("offline"));
  const request = (path: string) => ({ url: origin + path, method: "GET", mode: "navigate" });
  const shell = await app.dispatch("fetch", { request: request("/library?year=2025") });
  expect(await shell?.text()).toBe("public shell");
  await app.dispatch("fetch", { request: request("/users/account") });
  const keys = [...app.stores.values()].flatMap(entries => [...entries.keys()]);
  expect(keys.some(url => url.includes("/users"))).toBe(false);
});

it("rejects cache warm-up URLs outside immutable Next assets and bounds the cache", async () => {
  const app = worker(); const postMessage = vi.fn();
  await app.dispatch("message", { data: { type: "CACHE_PERSONAL_ASSETS", urls: [`${origin}/api/private`, `${origin}/users`, "https://external.example/_next/static/x.js", null, ...Array.from({ length: 200 }, (_, i) => `${origin}/_next/static/${i}.js`)] }, ports: [{ postMessage }] });
  const keys = [...app.stores.values()].flatMap(entries => [...entries.keys()]);
  expect(keys).toHaveLength(160);
  expect(keys.every(url => url.startsWith(`${origin}/_next/static/`))).toBe(true);
  expect(postMessage).toHaveBeenCalledWith({ ready: true });
});

it("keeps live pages and assets working when cache storage becomes unavailable", async () => {
  const app = worker();
  vi.spyOn(app.caches, "open").mockRejectedValue(new Error("cache unavailable"));
  const page = await app.dispatch("fetch", { request: { url: origin + "/", method: "GET", mode: "navigate" } });
  expect(await page?.text()).toBe("public shell");
  const asset = await app.dispatch("fetch", { request: { url: origin + "/_next/static/app.js", method: "GET", mode: "cors" } });
  expect(await asset?.text()).toBe("public shell");
});
