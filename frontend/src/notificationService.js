import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getApp } from "firebase/app";
import { auth } from "./firebase";

const VAPID_KEY =
    "BC-HiU24deGRHYLerAtCeIA12f93wNKVa2E2RePr8Iz36TS5a5qOf1azhg2A_OpyKB4x35j7la9ayM53MxFCRPc";

const app = getApp();

async function getActiveServiceWorker() {
    console.log("🔧 Registering Firebase messaging service worker...");

    const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
    );

    console.log(
        "🔧 Service worker registration:",
        registration
    );

    // Already active
    if (registration.active) {
        console.log("✅ Firebase service worker is already active.");
        return registration;
    }

    // Wait until the service worker becomes active
    console.log("⏳ Waiting for service worker to become active...");

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(
                new Error(
                    "Firebase messaging service worker did not become active within 10 seconds."
                )
            );
        }, 10000);

        const checkState = () => {
            if (registration.active) {
                clearTimeout(timeout);
                resolve();
                return;
            }

            if (registration.installing) {
                registration.installing.addEventListener(
                    "statechange",
                    () => {
                        if (
                            registration.installing &&
                            registration.installing.state === "activated"
                        ) {
                            clearTimeout(timeout);
                            resolve();
                        }
                    }
                );
            }
        };

        checkState();
    });

    console.log("✅ Firebase messaging service worker is active.");

    return registration;
}

export async function requestNotificationPermission() {
    try {
        if (!("Notification" in window)) {
            console.warn(
                "This browser does not support notifications."
            );
            return null;
        }

        if (!("serviceWorker" in navigator)) {
            console.warn(
                "This browser does not support service workers."
            );
            return null;
        }

        const permission =
            await Notification.requestPermission();

        console.log(
            "🔔 Notification permission:",
            permission
        );

        if (permission !== "granted") {
            console.warn(
                "AcciSafe notification permission was not granted."
            );
            return null;
        }

        const registration =
            await getActiveServiceWorker();

        const messaging = getMessaging(app);

        console.log(
            "🔧 Requesting FCM registration token..."
        );

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (!token) {
            console.warn(
                "Firebase did not return an FCM token."
            );
            return null;
        }

        console.log(
            "✅ AcciSafe FCM registration token:",
            token
        );

        return token;

    } catch (error) {
        console.error(
            "❌ AcciSafe notification setup failed:",
            error
        );

        return null;
    }
}

export function listenForForegroundNotifications(callback) {
    try {
        const messaging = getMessaging(app);

        return onMessage(
            messaging,
            (payload) => {
                console.log(
                    "🚨 AcciSafe foreground notification:",
                    payload
                );

                if (callback) {
                    callback(payload);
                }
            }
        );

    } catch (error) {
        console.error(
            "Could not initialize foreground notifications:",
            error
        );

        return () => {};
    }
}

export async function registerFCMTokenWithBackend(token) {
    if (!token) {
        return false;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
        console.warn(
            "Cannot register FCM token: user is not authenticated."
        );
        return false;
    }

    try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch(
            "http://127.0.0.1:8000/notifications/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    token: token,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(
                `Token registration failed: ${response.status} ${errorText}`
            );
        }

        const result = await response.json();

        console.log(
            "✅ FCM token registered with AcciSafe backend:",
            result
        );

        return true;

    } catch (error) {
        console.error(
            "❌ Failed to register FCM token with backend:",
            error
        );

        return false;
    }
}