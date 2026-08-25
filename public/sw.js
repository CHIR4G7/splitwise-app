// App-shell service worker.
//
// Precaching a fixed list isn't enough: the JS/CSS filenames are content-hashed at build time,
// so they can't be named here. Without runtime caching the shell loads offline and then fails
// to fetch its own bundle — a blank screen. Hashed assets are immutable, so they're cached
// on first use and served cache-first from then on.

const CACHE = "splitit-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so a deploy is picked up promptly, cached shell when offline.
  // Every client-side route resolves to index.html, same as the host's SPA rewrite.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((cached) => cached ?? Response.error()))
    );
    return;
  }

  if (!isImmutableAsset(url)) return;

  // Hashed assets never change under a given URL, so cache-first is safe and fastest.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
