const CACHE_NAME = "opportunities-app-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { mode: "cors" })
            .then((res) => res.ok && cache.put(url, res))
            .catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  // لا تُخزَّن مؤقتًا طلبات الـ API (بيانات العملاء يجب أن تُقرأ من الخادم دائمًا، وليست من الجهاز)
  if (url.includes("script.google.com") || event.request.method !== "GET") {
    return; // اترك الطلب يمر مباشرة للشبكة بدون تدخل الـ service worker
  }

  // الصفحة الرئيسية (index.html): الأولوية دائمًا للشبكة أولًا، حتى تظهر آخر التحديثات فورًا،
  // ولا يُستخدم الكاش إلا عند انقطاع الإنترنت فقط
  const isNavigation = event.request.mode === "navigate" || url.endsWith("/") || url.endsWith("index.html");
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // باقي الملفات الثابتة (أيقونات، مكتبات): كاش أولًا مع تحديث في الخلفية
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
