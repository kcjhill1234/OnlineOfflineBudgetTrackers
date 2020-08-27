console.log("Hello from service worker Plus!")

const FILES_TO_CACHE = [
    "/",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/index.html",
    "/index.js",
    "/styles.css",
    "https://cdn.jsdelivr.net/npm/chart.js@2.8.0",
    "https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css",
    "https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/fonts/fontawesome-webfont.woff2?v=4.7.0"
];

const CACHE_NAME = "records-v2";
const DATA_CACHE_NAME = "data-cache-v1"
const DB_TABLE = 'post-requests'
let DB;
openIndexedDb();
let failedTransaction;


self.addEventListener("install", event => {
    console.log("installing...");
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(FILES_TO_CACHE);
            })
            .catch(err => console.log(err))
    );
    self.skipWaiting();
});

self.addEventListener('message', function (event) {
    console.log('form data', event.data)
    if (event.data.hasOwnProperty('transaction')) {
        // receives form data from script.js upon submission
        savePostRequests(event.data.transaction)
    }
})

function getObjectStore(storeName, mode) {
    return DB.transaction(storeName, mode).objectStore(storeName)
}

function savePostRequests(transaction) {
    const request = getObjectStore(DB_TABLE, 'readwrite').add({
        transaction
    })
    request.onsuccess = function (event) {
        console.log('a new post request has been added to indexedb')
    }

    request.onerror = function (error) {
        console.error(error)
    }
}


function openIndexedDb() {
    // if `transactions` does not already exist in our browser (under our site), it is created
    const indexedDBOpenRequest = indexedDB.open('transactions',)

    indexedDBOpenRequest.onerror = function (error) {
        // errpr creatimg db
        console.error('IndexedDB error:', error)
    }

    indexedDBOpenRequest.onupgradeneeded = function () {
        // This should only execute if there's a need to create/update db.
        this.result.createObjectStore(DB_TABLE, { autoIncrement: true, keyPath: 'id' })
    }

    // This will execute each time the database is opened.
    indexedDBOpenRequest.onsuccess = function () {
        DB = this.result
    }
}

function sendPostToServer() {
    const savedRequests = []
    const req = getObjectStore(DB_TABLE).openCursor()


    return new Promise((resolve) => {
        req.onsuccess = async function (event) {
            const cursor = event.target.result
    
            if (cursor) {
                // Keep moving the cursor forward and collecting saved requests.
                savedRequests.push(cursor.value)
                cursor.continue()
            } else {
                // At this point, we have collected all the post requests in indexedb.
                for (const { id, transaction } of savedRequests) {
                    // send them to the server one after the other
                    console.log('saved request', transaction)
                    const requestUrl = '/api/transaction'
                    const payload = JSON.stringify({
                        name: transaction.name,
                        value: transaction.value,
                        date: transaction.date
                    })
                    var headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    } // if you have any other headers put them here
                    const method = 'POST'
                    fetch(requestUrl, {
                        headers,
                        method: method,
                        body: payload
                    }).then(function (response) {
                        console.log('server response', response)
                        if (response.status < 400) {
                            // If sending the POST request was successful, then remove it from the IndexedDB.
                            getObjectStore(DB_TABLE, 'readwrite').delete(id)
                        }
                    }).catch(function (error) {
                        // This will be triggered if the network is still down. The request will be replayed again
                        // the next time the service worker starts up.
                        console.error('Send to Server failed:', error)
                        // since we are in a catch, it is important an error is thrown,
                        // so the background sync knows to keep retrying sendto server
                        throw error
                    })
                }
            }
            resolve()
        }
    })
    
}

// self.addEventListener("fetch", event => {
//     console.log("You fetched " + event.url);
// });

// activate
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList.map(key => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log("Removing old cache data", key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", event => {

    if (event.request.url.includes("/api/")) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(response => {
                        // If the response was good, clone it and store it in the cache.
                        if (response.status === 200) {
                            cache.put(event.request.url, response.clone());
                        }

                        return response;
                    })
                    .catch(err => {
                        // Network request failed, try to get it from the cache.
                        return cache.match(event.request);
                    });
            }).catch(err => console.log(err))
        );

    } else {

        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    return response || fetch(event.request);
                });
            })
        );
    }
});


self.addEventListener('sync', function (event) {
    console.log('now online')
    console.log(event.tag)
    if (event.tag === 'sendSavedRequests') { // event.tag name checked here must be the same as the one used while registering sync

        event.waitUntil(
            // Send our POST request to the server, now that the user is online
            sendPostToServer()
        )
    }
})