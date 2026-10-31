/* Sitera sakin uygulaması — service worker (M4-T0).
   Kurallar:
   - `/api/` istekleri ASLA önbelleğe alınmaz ve SW tarafından ele alınmaz (kişisel/finansal veri, KVKK). Çevrimdışı
     "son görülen borç" önbellekte DEĞİL, uygulamanın yazdığı tarih damgalı yerel kayıttadır (`sitera.lastDebt`) ve
     yalnız `offline.html`de GÖSTERİM içindir.
   - Yalnız GET ve aynı köken; gezinme ağ-öncelikli, ağ yoksa `offline.html`; derlenmiş varlıklar (<BASE>assets/, <BASE>icons/)
     önbellek-öncelikli.
   - Yeni sürüm kendiliğinden devralmaz: kullanıcı "Yenile" deyince uygulama SKIP_WAITING gönderir (yarım form kaybolmasın).
   - Çıkışta uygulama `CLEAR_CACHES` gönderir: tüm önbellek silinir, yalnız kişisel olmayan kabuk yeniden yazılır (v1 O2).
   - Push (M4-T3c): `push` bildirimi gösterir (yük: {title, body, url, tag}; `url` uygulama içi göreli yol), açık sekmelere
     `PUSH_RECEIVED` bildirir (zil sayısı tazelensin); `notificationclick` açık sekmeye odaklanır ya da yeni sekme açar.
     Yük KİŞİSEL veri taşır (tutar vb.): önbelleğe ya da günlüğe yazılmaz, yalnız bildirim olarak gösterilir. */
const CACHE = "sitera-resident-v3";
const PUSH_RECEIVED = "PUSH_RECEIVED";
// Alt yol yayında (demo: /drafts/sitera/sakin/) varlıklar SW'nin bulunduğu dizine göredir; üretimde BASE = "/" (davranış aynı).
// `/api/` denetimi kökte kalır: API her zaman kök yoludur.
const BASE = new URL("./", self.location.href).pathname;
const FALLBACK_URL = `${BASE}notifications`;
const OFFLINE_URL = `${BASE}offline.html`;
const ICON_URL = `${BASE}icons/icon-192.png`;
const SHELL = [OFFLINE_URL, `${BASE}manifest.webmanifest`, ICON_URL, `${BASE}icons/icon.svg`];

function precache() {
  return caches.open(CACHE).then((cache) => cache.addAll(SHELL));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (type === "CLEAR_CACHES") {
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .then(precache),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // tarayıcıya bırak: önbelleğe girmez

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith(`${BASE}assets/`) || url.pathname.startsWith(`${BASE}icons/`)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// --- Push (M4-T3c) ---------------------------------------------------------------------------------------------

/** Yalnız uygulama içi göreli yol: dış adres/`//` açık yönlendirme olur; geçersizse bildirim kutusu açılır. */
function safeUrl(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : FALLBACK_URL;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {}; // JSON olmayan yük: genel başlıkla göster, uydurma içerik yok
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Sitera", {
        body: data.body || "",
        icon: ICON_URL,
        badge: ICON_URL,
        tag: data.tag, // aynı bildirim iki kez gösterilmez
        data: { url: safeUrl(data.url) },
      }),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
        for (const client of windows) client.postMessage({ type: PUSH_RECEIVED });
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      // Denetimsiz sekmede `navigate` reddedilir: o durumda yeni pencere açılır.
      if (open) {
        return open
          .focus()
          .then((focused) => (focused || open).navigate(url))
          .catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
