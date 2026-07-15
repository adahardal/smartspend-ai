self.addEventListener("push", (event) => {
  let payload = { title: "SmartSpend AI", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "SmartSpend AI", {
      body: payload.body || "",
      icon: "/next.svg",
      badge: "/next.svg",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/dashboard");
    })
  );
});
