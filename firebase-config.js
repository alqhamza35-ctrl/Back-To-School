// Back to School — Firebase layer (compat SDK loaded via script tags)
// Single canonical identity: the Firebase Auth UID. All Firestore documents
// (profile, planner data, FCM token) live under users/{uid}.
(function () {
    'use strict';

    var firebaseConfig = {
        apiKey: "AIzaSyAXlP2sdYKQilWSp6IyQ_LjZrc40Kmwvog",
        authDomain: "back-to-school-4b24b.firebaseapp.com",
        projectId: "back-to-school-4b24b",
        storageBucket: "back-to-school-4b24b.firebasestorage.app",
        messagingSenderId: "364686643691",
        appId: "1:364686643691:web:202fc76959e1ab17c309ae"
    };

    var ready = false;
    var auth = null;
    var db = null;
    var messaging = null;

    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            try { messaging = firebase.messaging(); } catch (e) { /* messaging not on this page */ }
            ready = true;
        }
    } catch (e) {
        console.warn('Firebase unavailable, running local-only:', e.message);
    }

    var VAPID_KEY = 'BHbgjZrsMxy8Y5YVQWDU5CuMRFzCT1Lotc0yy0HuEgZs3tKRE2nh2vz_E_WSDzo2HlI2ouVKweBx0VMsEf5dmI';

    window.BtsCloud = {
        ready: ready,
        auth: auth,
        db: db,

        currentUid: function () {
            return auth && auth.currentUser ? auth.currentUser.uid : null;
        },

        onAuthChange: function (fn) {
            if (auth) auth.onAuthStateChanged(fn);
        },

        signUp: function (email, password, displayName) {
            return auth.createUserWithEmailAndPassword(email, password)
                .then(function (cred) {
                    return cred.user.updateProfile({ displayName: displayName }).then(function () { return cred.user; });
                });
        },
        signIn: function (email, password) {
            return auth.signInWithEmailAndPassword(email, password);
        },
        signOut: function () {
            return auth ? auth.signOut() : Promise.resolve();
        },
        sendReset: function (email) {
            return auth.sendPasswordResetEmail(email);
        },
        updatePassword: function (newPassword) {
            if (auth && auth.currentUser) return auth.currentUser.updatePassword(newPassword);
            return Promise.reject(new Error('not signed in'));
        },

        // ---------- Firestore documents ----------
        saveProfile: function (uid, profile) {
            return db.collection('users').doc(uid).set(profile, { merge: true });
        },
        findUserByParentCode: function (code) {
            return db.collection('users').where('parentCode', '==', code).limit(1).get();
        },
        savePlanner: function (uid, data) {
            return db.collection('users').doc(uid).collection('planner').doc('data')
                .set({ state: data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        },
        getPlanner: function (uid) {
            return db.collection('users').doc(uid).collection('planner').doc('data').get()
                .then(function (snap) { return snap.exists ? snap.data().state : null; });
        },

        // ---------- FCM ----------
        requestPush: function () {
            if (!messaging || !('Notification' in window)) return Promise.resolve(null);
            return Notification.requestPermission().then(function (perm) {
                if (perm !== 'granted') return null;
                return messaging.requestPermission ? messaging.requestPermission() : null;
            }).then(function () {
                return messaging.getToken({ vapidKey: VAPID_KEY });
            }).then(function (token) {
                var uid = window.BtsCloud.currentUid();
                if (token && uid) {
                    db.collection('users').doc(uid).set({ fcmToken: token }, { merge: true })
                        .catch(function (err) { console.warn('FCM token save failed:', err); });
                }
                return token || null;
            }).catch(function (err) {
                console.warn('FCM not available:', err.message);
                return null;
            });
        },
        onMessage: function (fn) {
            if (messaging) messaging.onMessage(fn);
        }
    };
})();
