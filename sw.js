// Service worker del prontuario servito dal web. E' cio' che lo fa funzionare
// anche senza rete, dopo la prima apertura — come il file sul telefono Android.
//
// Strategia: prima la rete, poi la copia salvata. Con la rete si vede sempre
// l'ultima versione pubblicata; senza, l'ultima vista. Se la rete e' lenta —
// un corridoio d'ospedale — dopo 4 secondi si serve la copia salvata invece
// di lasciare lo schermo bianco.
//
// ES5 come il motore, anche se un iPhone con service worker lo leggerebbe
// comunque: test_safari.py controlla anche questo file.
// 2.4.0 la sostituisce scripts/pubblica_web.py: una versione nuova e'
// un file nuovo, e il browser installa il service worker nuovo da solo.

var CACHE = "prontuario-infusioni-2.4.0";
var FILE = ["./", "index.html", "manifest.webmanifest",
            "icona-180.png", "icona-192.png", "icona-512.png"];

function conTempo(promessa, ms) {
  return new Promise(function (ok, ko) {
    var t = setTimeout(function () { ko(new Error("rete lenta")); }, ms);
    promessa.then(function (r) { clearTimeout(t); ok(r); },
                  function (e) { clearTimeout(t); ko(e); });
  });
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE)
    .then(function (c) { return c.addAll(FILE); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys()
    .then(function (nomi) {
      return Promise.all(nomi.filter(function (n) { return n !== CACHE; })
                             .map(function (n) { return caches.delete(n); }));
    })
    .then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(function (salvata) {
    var rete = fetch(e.request).then(function (r) {
      if (r && r.ok) {
        var copia = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
      }
      return r;
    });
    rete["catch"](function () {});
    if (!salvata) return rete;
    return conTempo(rete, 4000)["catch"](function () { return salvata; });
  }));
});
