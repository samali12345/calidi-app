/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

let messaging = null;
let initialized = false;

function initFirebase(config) {
  if (initialized || !config) return;
  firebase.initializeApp(config);
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || "CALIDI Delivery Update";
    const body = payload?.notification?.body || "Your delivery status changed.";
    const link =
      payload?.fcmOptions?.link ||
      payload?.data?.link ||
      (payload?.data?.deliveryId ? `/delivery/${payload.data.deliveryId}` : "/orders");

    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      data: { link },
    });
  });

  initialized = true;
}

self.addEventListener("message", (event) => {
  if (event?.data?.type === "INIT_FIREBASE") {
    initFirebase(event.data.config);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/orders";
  event.waitUntil(clients.openWindow(link));
});

