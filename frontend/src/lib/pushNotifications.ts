import { getMessaging, getToken, isSupported } from "firebase/messaging";
import app, { firebaseConfig } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

const TOKEN_CACHE_KEY = "calidi_push_token";

function getCachedToken() {
  return localStorage.getItem(TOKEN_CACHE_KEY) || "";
}

function setCachedToken(token: string) {
  localStorage.setItem(TOKEN_CACHE_KEY, token);
}

function clearCachedToken() {
  localStorage.removeItem(TOKEN_CACHE_KEY);
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const target = registration.active || registration.waiting || registration.installing;
  if (target) {
    target.postMessage({
      type: "INIT_FIREBASE",
      config: firebaseConfig,
    });
  }
  return registration;
}

export async function registerPushToken(idToken: string) {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (!(await isSupported())) return;

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("VITE_FIREBASE_VAPID_KEY is missing; skipping push token registration.");
      return;
    }

    const registration = await registerServiceWorker();
    const messaging = getMessaging(app);
    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!fcmToken) return;
    if (getCachedToken() === fcmToken) return;

    await apiFetch("/auth/push-token", {
      method: "POST",
      token: idToken,
      body: { token: fcmToken, userAgent: navigator.userAgent },
    });

    setCachedToken(fcmToken);
  } catch (err) {
    console.error("Push token registration failed:", err);
  }
}

export async function unregisterPushToken(idToken: string) {
  try {
    const token = getCachedToken();
    if (!token) return;

    await apiFetch("/auth/push-token", {
      method: "DELETE",
      token: idToken,
      body: { token },
    });

    clearCachedToken();
  } catch (err) {
    console.error("Push token unregister failed:", err);
  }
}

