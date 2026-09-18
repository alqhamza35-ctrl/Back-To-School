// Back to School — authentication (login + signup pages)
// Local credential store with SHA-256 salted hashes, Firebase Auth mirrored
// when reachable so the account can carry a cloudId for Firestore sync.
(function () {
    'use strict';

    var USERS_KEY = 'bts:v1:users';
    var SESSION_KEY = 'bts:v1:session';
    var DEVICE_KEY = 'bts:v1:device';
    var ATTEMPTS_KEY = 'bts:v1:attempts';
    var MAX_ATTEMPTS = 5;
    var LOCKOUT_MS = 5 * 60 * 1000;

    function t(key) { return window.I18N ? window.I18N.t(key) : key; }

    function getUsers() {
        try {
            var u = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
            return Array.isArray(u) ? u : [];
        } catch (e) { return []; }
    }
    function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

    function getDeviceId() {
        var id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    }

    async function hashPassword(password, salt) {
        var data = new TextEncoder().encode(salt + password);
        var buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    function generateSalt() {
        var a = new Uint8Array(32);
        crypto.getRandomValues(a);
        return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

    // ---------- rate limiting ----------
    function lockMinutes(email) {
        try {
            var d = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}')[email];
            if (d && d.count >= MAX_ATTEMPTS && Date.now() - d.last < LOCKOUT_MS) {
                return Math.ceil((LOCKOUT_MS - (Date.now() - d.last)) / 60000);
            }
        } catch (e) { /* ignore */ }
        return 0;
    }
    function recordAttempt(email, ok) {
        var all;
        try { all = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}'); } catch (e) { all = {}; }
        if (ok) delete all[email];
        else all[email] = { count: (all[email] ? all[email].count : 0) + 1, last: Date.now() };
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
    }

    function showError(msg) {
        var el = document.getElementById('authError');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
    }

    function startSession(user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
        window.location.href = 'dashboard.html';
    }

    // Mirror credentials to Firebase without blocking the local flow.
    function mirrorFirebase(user, password, isSignup) {
        if (!window.BtsCloud || !window.BtsCloud.ready) return;
        var done = function (fbUser) {
            if (!fbUser) return;
            var users = getUsers();
            var idx = users.findIndex(function (u) { return u.id === user.id; });
            if (idx === -1) return;
            users[idx].cloudId = fbUser.uid;
            saveUsers(users);
            window.BtsCloud.saveProfile(fbUser.uid, {
                displayName: user.displayName,
                email: user.email,
                parentCode: users[idx].parentCode || ''
            }).catch(function () { /* rules may deny; retried from dashboard */ });
        };
        if (isSignup) {
            window.BtsCloud.signUp(user.email, password, user.displayName).then(done)
                .catch(function (err) { console.warn('Firebase sign-up skipped:', err.code || err.message); });
        } else {
            window.BtsCloud.signIn(user.email, password).then(function (cred) { done(cred.user); })
                .catch(function (err) { console.warn('Firebase sign-in skipped:', err.code || err.message); });
        }
    }

    // Already signed in?
    if (localStorage.getItem(SESSION_KEY)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // ---------- Login ----------
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            var email = document.getElementById('email').value.trim().toLowerCase();
            var password = document.getElementById('password').value;
            if (!validEmail(email)) return showError(t('err_invalid_email'));
            var mins = lockMinutes(email);
            if (mins) return showError(t('err_locked') + mins + t('err_locked_min'));

            var users = getUsers();
            var user = users.find(function (u) { return u.email === email; });
            var ok = false;
            if (user) {
                var hash = await hashPassword(password, user.salt);
                ok = hash === user.passwordHash;
            }
            if (!ok && window.BtsCloud && window.BtsCloud.ready && !user) {
                // Cloud-only account on a new device: sign in remotely then mirror locally.
                try {
                    var cred = await window.BtsCloud.signIn(email, password);
                    var fbUser = cred.user;
                    var rec = {
                        id: fbUser.uid, cloudId: fbUser.uid, email: email,
                        displayName: fbUser.displayName || email.split('@')[0],
                        salt: generateSalt(), passwordHash: await hashPassword(password, ''),
                        deviceId: getDeviceId(), createdAt: new Date().toISOString(),
                        parentCode: '', firstLogin: true
                    };
                    rec.passwordHash = await hashPassword(password, rec.salt);
                    users.push(rec);
                    saveUsers(users);
                    recordAttempt(email, true);
                    startSession(rec);
                    return;
                } catch (err) {
                    recordAttempt(email, false);
                    showError(t('err_wrong_credentials'));
                    return;
                }
            }
            if (!ok) {
                recordAttempt(email, false);
                return showError(t('err_wrong_credentials'));
            }
            if (user.deviceId && user.deviceId !== getDeviceId()) return showError(t('err_device'));
            user.deviceId = getDeviceId();
            var sIdx = users.findIndex(function (u) { return u.id === user.id; });
            users[sIdx] = user;
            saveUsers(users);
            recordAttempt(email, true);
            mirrorFirebase(user, password, false);
            startSession(user);
        });

        var forgot = document.getElementById('forgotPw');
        if (forgot) forgot.addEventListener('click', function (e) {
            e.preventDefault();
            var email = document.getElementById('email').value.trim().toLowerCase();
            if (!validEmail(email)) return showError(t('err_invalid_email'));
            if (!window.BtsCloud || !window.BtsCloud.ready) return showError(t('err_generic'));
            window.BtsCloud.sendReset(email).then(function () { showError(''); var el = document.getElementById('authError'); el.classList.add('show'); el.style.color = 'var(--success)'; el.textContent = t('pw_reset_sent'); })
                .catch(function () { showError(t('err_generic')); });
        });
    }

    // ---------- Signup ----------
    var signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            var displayName = document.getElementById('displayName').value.trim();
            var email = document.getElementById('email').value.trim().toLowerCase();
            var password = document.getElementById('password').value;
            var confirm = document.getElementById('confirmPassword').value;

            if (displayName.length < 2 || displayName.length > 50) return showError(t('err_name_length'));
            if (!validEmail(email)) return showError(t('err_invalid_email'));
            if (password.length < 6) return showError(t('err_pw_short'));
            if (password !== confirm) return showError(t('err_pw_match'));

            var users = getUsers();
            if (users.find(function (u) { return u.email === email; })) return showError(t('err_email_taken'));

            var salt = generateSalt();
            var user = {
                id: 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                cloudId: null,
                displayName: displayName.replace(/[<>]/g, ''),
                email: email,
                salt: salt,
                passwordHash: await hashPassword(password, salt),
                deviceId: getDeviceId(),
                createdAt: new Date().toISOString(),
                parentCode: ''
            };
            users.push(user);
            saveUsers(users);
            mirrorFirebase(user, password, true);
            startSession(user);
        });

        var pw = document.getElementById('password');
        if (pw) pw.addEventListener('input', function () {
            var fill = document.getElementById('strengthFill');
            var txt = document.getElementById('strengthText');
            if (!fill || !txt) return;
            var v = pw.value, score = 0;
            if (v.length >= 6) score++;
            if (v.length >= 10) score++;
            if (/[A-Z]/.test(v) && /[0-9]/.test(v)) score++;
            if (/[^A-Za-z0-9]/.test(v)) score++;
            var pct = [25, 40, 70, 100][score] || 10;
            fill.style.width = pct + '%';
            fill.style.background = score <= 1 ? 'var(--danger)' : score === 2 ? 'var(--warning)' : 'var(--success)';
            txt.textContent = t('pw_strength') + (score <= 1 ? t('pw_weak') : score === 2 ? t('pw_medium') : t('pw_strong'));
        });
    }

    // Language toggle + init (shared by both pages)
    var langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.addEventListener('click', function () {
        window.I18N.setLang(window.I18N.lang === 'ar' ? 'en' : 'ar');
    });
    window.I18N.init();
})();
