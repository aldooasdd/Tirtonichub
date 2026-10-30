// Service worker minimal: offline shell + cache-first untuk aset statis.
// ponytail: cukup untuk PWA installable + offline dasar. Bukan strategi caching canggih.
const CACHE = "tirtonic-v1";
const ASSETS = ["/beranda", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // jangan cache API/data dinamis
  if (new URL(req.url).pathname.startsWith("/api")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r ?? caches.match("/beranda"))),
  );
});

// Notifikasi push (Studio): tampilkan, lalu buka/fokuskan halaman saat diketuk.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "Tirtonic Studio", {
      body: d.body || "",
      icon: "/studio/icon-192.png",
      badge: "/studio/favicon-32.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || "/studio/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/studio/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const same = list.find((c) => c.url.startsWith(self.location.origin + "/studio"));
      if (same) return same.navigate(url).then((c) => (c || same).focus()).catch(() => same.focus());
      return self.clients.openWindow(url);
    }),
  );
});
