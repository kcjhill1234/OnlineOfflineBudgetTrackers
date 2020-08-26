console.log("Hello from service worker Plus!")

const FILES_TO_CACHE = [
    "/",
    "/models/transaction.js",
    "/public/icons/icon-192x192.png",
    "/public/icons/icon-512x512.png",
    "/public/index.html",
    "/public/index.js",
    "/public/service-worker.js",
    "/public/styles.css",   
    "/node_modules/",
    "/routes/api.js",
    "/package-lock.json",
    "/package.json",
    "/server.js",
    "/public/bootstrap.min.css"
];

let CACHE_NAME = "records"; 

self.addEventListener("install", event => {
    console.log("installing...");
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(FILES_TO_CACHE);
            })
            .catch(err => console.log(err)),
            console.log(err)
    );
});

// self.addEventListener("fetch", event => {
//     console.log("You fetched " + event.url);
// });

self.addEventListener("fetch", event => {
    if (event.request.url === "http://localhost:3000/") {
        event.respondWith(
            fetch(event.request).catch(err =>
                self.cache.open(CACHE_NAME).then(cache => cache.match("/offline.html"))
            )
        );
    } else {
        event.respondWith(
            fetch(event.request).catch(err =>
                caches.match(event.request).then(response => response)
            )
        );
    }
});