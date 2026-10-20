const offlineCacheName = "anime-record-offline-v2";
const assetCacheName = "anime-record-assets-v2";
const offlineAssets = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];
const personalPages = ["/", "/library"];
const assetLimit = 160;

function isStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - assetLimit)).map(key => cache.delete(key)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(offlineCacheName);
      await cache.addAll(offlineAssets);
      // Only the public, record-free app shell is cached. API and legacy pages are excluded.
      await cache.addAll(personalPages);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith("anime-record-offline-") || key.startsWith("anime-record-assets-")) &&
              key !== offlineCacheName && key !== assetCacheName,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_PERSONAL_ASSETS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(assetCacheName);
    const urls = [...new Set(event.data.urls.filter(value => {
      try { return typeof value === "string" && isStaticAsset(new URL(value, self.location.origin)); }
      catch { return false; }
    }))].slice(0, assetLimit);
    const results = await Promise.allSettled(urls.map(async url => {
      if (!(await cache.match(url))) await cache.add(url);
    }));
    await trimAssets(cache);
    event.ports?.[0]?.postMessage({ ready: results.every(result => result.status === "fulfilled") });
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (offlineAssets.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
  } else if (isStaticAsset(url)) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(assetCacheName);
        const cached = await cache.match(event.request);
        if (cached) return cached;
      } catch { /* Cache storage must not break an otherwise working network request. */ }
      const response = await fetch(event.request);
      if (cache && response.ok) {
        await cache.put(event.request, response.clone()).then(() => trimAssets(cache)).catch(() => {});
      }
      return response;
    })());
  } else if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(async response => {
        if (personalPages.includes(url.pathname) && response.ok && response.headers.get("content-type")?.includes("text/html")) {
          try {
            const cache = await caches.open(offlineCacheName);
            await cache.put(url.pathname, response.clone());
          } catch { /* The live page is still usable when caching is unavailable. */ }
        }
        return response;
      }).catch(async () => {
        if (personalPages.includes(url.pathname)) {
          const shell = await caches.match(url.pathname);
          if (shell) return shell;
        }
        const offline = await caches.match("/offline.html");
        return (
          offline ||
          new Response("オフラインです。接続を確認してください。", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
  }
});
