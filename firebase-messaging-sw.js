// Import des scripts Firebase (version compat pour Service Worker)
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js");

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDe7lEGbcqztNmgpqfd7jm5qbq5Z4MG8Wg",
  authDomain: "upmre-f9b70.firebaseapp.com",
  projectId: "upmre-f9b70",
  storageBucket: "upmre-f9b70.firebasestorage.app",
  messagingSenderId: "762559305412",
  appId: "1:762559305412:web:00b965e628718a0b7e1b91",
  measurementId: "G-EMSCVXG71V"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Quand une notif arrive en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Notification reçue en arrière-plan:", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon-192.png"
  });
});
