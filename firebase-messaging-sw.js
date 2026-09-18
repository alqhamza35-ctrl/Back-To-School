// Back to School — push notification service worker (background)
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAXlP2sdYKQilWSp6IyQ_LjZrc40Kmwvog",
    authDomain: "back-to-school-4b24b.firebaseapp.com",
    projectId: "back-to-school-4b24b",
    storageBucket: "back-to-school-4b24b.firebasestorage.app",
    messagingSenderId: "364686643691",
    appId: "1:364686643691:web:202fc76959e1ab17c309ae"
});

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    var n = payload.notification || {};
    self.registration.showNotification(n.title || 'Back to School', {
        body: n.body || '',
        icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎓</text></svg>')
    });
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].url.indexOf('dashboard.html') !== -1 && 'focus' in list[i]) return list[i].focus();
            }
            if (clients.openWindow) return clients.openWindow('dashboard.html');
        })
    );
});
