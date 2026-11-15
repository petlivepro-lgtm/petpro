// Service worker do app do tutor — existe só para o Web Push.
//
// Ele NÃO faz cache de nada: o app é online por natureza (agenda, reservas e
// o atendimento ao vivo mudam a todo momento) e um cache errado mostraria dado velho.
// A única razão de existir é que o navegador só entrega push a um service
// worker, mesmo com todas as abas fechadas.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "MyLivePet", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "MyLivePet";
  const options = {
    body: payload.body || "",
    icon: "/brand/faviconpet.svg",
    badge: "/brand/faviconpet.svg",
    // `tag` faz o navegador substituir o aviso anterior em vez de empilhar.
    tag: payload.tag || "mylivepet",
    // Android/desktop: sem isto o aviso some sozinho em poucos segundos, e a
    // ideia aqui é justamente pegar quem não está olhando a tela.
    requireInteraction: true,
    data: { href: payload.href || "/atendimentos" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/atendimentos";
  const url = new URL(href, self.location.origin).href;

  // Reaproveita uma aba já aberta em vez de abrir outra: o tutor
  // pode estar com o MyLivePet já aberto acompanhando o pet.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
