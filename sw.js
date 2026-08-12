/* Bonne Pioche — service worker : l'application s'ouvre même sans réseau.
   - index (navigation) : réseau d'abord, cache en secours
   - polices & icônes : cache d'abord
   - Firebase (synchro temps réel) : jamais mis en cache */
const SLUG = (self.registration.scope.split("/").filter(Boolean).pop() || "app").replace(/[^a-z0-9-]/gi, "");
const CACHE = "bp-" + SLUG + "-v1";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.indexOf("bp-" + SLUG + "-") === 0 && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // synchro Firebase : toujours en direct, jamais de cache
  if (url.hostname.endsWith("firebasedatabase.app")) return;

  // la page elle-même : réseau d'abord (pour avoir la dernière version), cache si hors-ligne
  if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(req, c)); return r; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // le reste (polices, icônes, manifest) : cache d'abord, réseau en complément
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(r => {
        if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(req, c)); }
        return r;
      })
    )
  );
});
