importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyDvdFIIcHMctL0BDDr48Xr4WWs_UbYzFkk",
    authDomain: "accisafe-305ed.firebaseapp.com",
    projectId: "accisafe-305ed",
    storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
    messagingSenderId: "455217267041",
    appId: "1:455217267041:web:d52f325f4ec96e45dc8520"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log(
        "[AcciSafe] Background message received:",
        payload
    );

    const title =
        payload.notification?.title ||
        "AcciSafe Emergency Alert";

    const options = {
        body:
            payload.notification?.body ||
            "An emergency event has been detected.",
        data: payload.data || {}
    };

    self.registration.showNotification(title, options);
});