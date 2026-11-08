
const CACHE_NAME = "my-app-offline-v2";

const STATIC_FILES = [
  "./",
  "./top.png",
  "./blue.png",
  "./ios.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_FILES)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Rangeリクエスト（動画の部分取得）
    if (request.headers.has("range")) {
      const fullRequest = new Request(url.href);
      const cached = await cache.match(fullRequest);

      if (cached && cached.status === 200) {
        const buffer = await cached.arrayBuffer();
        const size = buffer.byteLength;
        const range = request.headers.get("range");

        const match = /^bytes=(\d*)-(\d*)$/.exec(range);

        if (match) {
          let start;
          let end;

          if (match[1] === "") {
            const suffix = Number(match[2]);
            if (!suffix) {
              return new Response(null, {
                status: 416,
                headers: {
                  "Content-Range": `bytes */${size}`
                }
              });
            }
            start = Math.max(0, size - suffix);
            end = size - 1;
          } else {
            start = Number(match[1]);
            end = match[2] === ""
              ? size - 1
              : Math.min(Number(match[2]), size - 1);
          }

          if (start >= size || end < start) {
            return new Response(null, {
              status: 416,
              headers: {
                "Content-Range": `bytes */${size}`
              }
            });
          }

          return new Response(buffer.slice(start, end + 1), {
            status: 206,
            headers: {
              "Content-Type":
                cached.headers.get("Content-Type") || "video/mp4",
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Content-Length": String(end - start + 1),
              "Accept-Ranges": "bytes"
            }
          });
        }
      }

      // キャッシュに動画がなければ通常通信
      return fetch(request);
    }

    // 通常リクエスト
    const cached = await cache.match(request);

    if (cached) return cached;

    return fetch(request);
  })());
});
