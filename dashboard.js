// Back to School — dashboard controller (routing, settings, parent zone, notifications)
(function () {
    'use strict';

    function t(k) { return window.I18N.t(k); }
    var notified = {};

    document.addEventListener('DOMContentLoaded', function () {
        if (!State.boot()) return;
        I18N.lang = State.data.lang || 'ar';
        document.documentElement.lang = I18N.lang;
        document.documentElement.dir = I18N.lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-theme', State.data.theme || 'dark');
        I18N.apply();

        var nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = State.user.displayName;
        var mailEl = document.getElementById('userEmail');
        if (mailEl) mailEl.textContent = State.user.email;
        var avEl = document.getElementById('userAvatar');
        if (avEl) avEl.textContent = (State.user.displayName || 'م').charAt(0);

        Game.updateStreak();
        bindEvents();
        fillRoutineForm();
        Planner.renderAll();
        Quiz.render();
        Game.render();
        Focus.render();
        renderParentPage();
        navigate('overview');

        Store.start();
        scheduleReminders();
        setInterval(scheduleReminders, 30000);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('firebase-messaging-sw.js').catch(function () { /* optional */ });
        }
        if (window.BtsCloud && window.BtsCloud.ready && window.BtsCloud.onAuthChange) {
            window.BtsCloud.onMessage(function (payload) {
                var n = (payload && payload.notification) || {};
                Dash.notify(n.title || t('app_name'), n.body || '');
            });
        }
    });

    // ---------- helpers ----------
    window.Dash = {
        esc: function (str) {
            var d = document.createElement('div');
            d.appendChild(document.createTextNode(str == null ? '' : String(str)));
            return d.innerHTML;
        },
        fmtDate: function (s) { return I18N.fmtDate(s); },

        toast: function (msg, kind) {
            var wrap = document.getElementById('toastContainer');
            if (!wrap) return;
            var el = document.createElement('div');
            el.className = 'toast ' + (kind || 'success');
            el.innerHTML = '<i class="fas ' + (kind === 'error' ? 'fa-exclamation-circle' : kind === 'info' ? 'fa-info-circle' : 'fa-check-circle') + '"></i><span></span>';
            el.querySelector('span').textContent = msg;
            wrap.appendChild(el);
            setTimeout(function () { el.remove(); }, 3200);
        },

        notify: function (title, body) {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            try { new Notification(title, { body: body }); } catch (e) { /* ignore */ }
        },

        rerenderAll: function () {
            I18N.apply();
            Planner.renderAll(); Quiz.render(); Game.render(); Focus.render(); renderParentPage(); fillRoutineForm();
        }
    };

    // ---------- routing ----------
    function navigate(page) {
        document.querySelectorAll('.page').forEach(function (p) {
            p.classList.toggle('active', p.id === 'page-' + page);
        });
        document.querySelectorAll('.nav-item').forEach(function (n) {
            n.classList.toggle('active', n.dataset.page === page);
        });
        var titles = { overview: 'nav_overview', classes: 'classes_title', homework: 'homework_title', exams: 'exams_title', quiz: 'quiz_title', schedule: 'schedule_title', calendar: 'calendar_title', focus: 'focus_title', achievements: 'ach_title', parent: 'parent_title', settings: 'settings_title' };
        var h1 = document.querySelector('#pageTitle h1');
        if (h1) h1.textContent = t(titles[page] || 'app_name');
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarBackdrop').classList.remove('show');
        if (page === 'focus') Focus.render();
        if (page === 'achievements') Game.render();
    }

    // ---------- events ----------
    function bindEvents() {
        document.querySelectorAll('.nav-item').forEach(function (n) {
            n.addEventListener('click', function (e) { e.preventDefault(); navigate(n.dataset.page); });
        });
        document.querySelectorAll('[data-nav]').forEach(function (b) {
            b.addEventListener('click', function () { navigate(b.dataset.nav); });
        });

        on('langToggle', 'click', function () {
            I18N.setLang(I18N.lang === 'ar' ? 'en' : 'ar');
            State.data.lang = I18N.lang;
            State.save();
            Dash.rerenderAll();
        });
        on('themeToggle', 'click', function () {
            State.data.theme = State.data.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', State.data.theme);
            State.save();
        });
        on('mobileMenuBtn', 'click', function () {
            document.getElementById('sidebar').classList.add('active');
            document.getElementById('sidebarBackdrop').classList.add('show');
        });
        on('sidebarBackdrop', 'click', function () {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarBackdrop').classList.remove('show');
        });
        on('logoutBtn', 'click', logout);

        // modals
        document.querySelectorAll('.modal-overlay').forEach(function (m) {
            m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('active'); });
        });
        document.querySelectorAll('[data-close]').forEach(function (b) {
            b.addEventListener('click', function () { document.getElementById(b.dataset.close).classList.remove('active'); });
        });
        document.querySelectorAll('[data-open]').forEach(function (b) {
            b.addEventListener('click', function () { document.getElementById(b.dataset.open).classList.add('active'); });
        });

        on('addClassForm', 'submit', Planner.addClass);
        on('addHomeworkForm', 'submit', Planner.addHomework);
        on('addExamForm', 'submit', Planner.addExam);
        on('addQuizForm', 'submit', function (e) { Quiz.add(e); });
        on('addScheduleForm', 'submit', Planner.addItem);

        document.querySelectorAll('#hwFilters .filter-btn').forEach(function (b) {
            b.addEventListener('click', function () { Planner.setHwFilter(b.dataset.filter); });
        });
        on('generateScheduleBtn', 'click', function () { Planner.generate(); });
        on('calPrev', 'click', function () { Planner.prevMonth(); });
        on('calNext', 'click', function () { Planner.nextMonth(); });

        on('pomoToggle', 'click', function () { Focus.toggle(); });
        on('pomoReset', 'click', function () { Focus.reset(); });
        on('pomoSaveSettings', 'click', function () { Focus.saveSettings(); });
        document.querySelectorAll('[data-pomo-mode]').forEach(function (b) {
            b.addEventListener('click', function () { Focus.setMode(b.dataset.pomoMode); });
        });

        on('routineForm', 'submit', saveRoutine);
        on('syncNowBtn', 'click', function () { Store.push().then(function () { Dash.toast(t('toast_synced'), 'success'); }); });
        on('exportBtn', 'click', exportData);
        on('importFile', 'change', importData);
        on('pwForm', 'submit', changePassword);
        on('genCodeBtn', 'click', generateParentCode);
        on('copyCodeBtn', 'click', copyParentCode);
        on('enablePushBtn', 'click', function () {
            if (window.BtsCloud && window.BtsCloud.ready) {
                window.BtsCloud.requestPush().then(function (tok) {
                    Dash.toast(tok ? t('toast_saved') : t('err_generic'), tok ? 'success' : 'error');
                });
            } else Dash.notify(t('app_name'), t('toast_gen'));
        });
        ['notifHomework', 'notifExams', 'notifDaily'].forEach(function (id) {
            on(id, 'change', function () {
                State.data.notif.homework = document.getElementById('notifHomework').checked;
                State.data.notif.exams = document.getElementById('notifExams').checked;
                State.data.notif.daily = document.getElementById('notifDaily').checked;
                State.save();
            });
        });
    }
    function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }

    // ---------- settings ----------
    var ROUTINE_FIELDS = ['wake', 'sleep', 'schoolStart', 'schoolEnd', 'breakfast', 'lunch', 'dinner', 'exercise', 'shower'];
    function fillRoutineForm() {
        ROUTINE_FIELDS.forEach(function (f) {
            var el = document.getElementById('rt' + f.charAt(0).toUpperCase() + f.slice(1));
            if (el) el.value = State.data.routine[f];
        });
        var nh = document.getElementById('notifHomework');
        if (nh) { nh.checked = State.data.notif.homework; document.getElementById('notifExams').checked = State.data.notif.exams; document.getElementById('notifDaily').checked = State.data.notif.daily; }
    }
    function saveRoutine(e) {
        e.preventDefault();
        ROUTINE_FIELDS.forEach(function (f) {
            var el = document.getElementById('rt' + f.charAt(0).toUpperCase() + f.slice(1));
            if (el && el.value) State.data.routine[f] = el.value;
        });
        State.save();
        Dash.toast(t('toast_saved'), 'success');
    }

    function exportData() {
        var blob = new Blob([JSON.stringify(State.data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'bts-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        Dash.toast(t('toast_exported'), 'success');
    }
    function importData(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var parsed = JSON.parse(reader.result);
                if (!parsed || typeof parsed !== 'object' || !parsed.routine || !Array.isArray(parsed.homework)) throw new Error('bad format');
                parsed.savedAt = Date.now();
                State.replaceAll(parsed);
                Dash.rerenderAll();
                Store.push();
                Dash.toast(t('toast_imported'), 'success');
            } catch (err) {
                Dash.toast(t('err_generic'), 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    async function changePassword(e) {
        e.preventDefault();
        var cur = document.getElementById('curPw').value;
        var next = document.getElementById('newPw').value;
        var conf = document.getElementById('confirmPw').value;
        var err = document.getElementById('pwError');
        err.classList.remove('show');
        if (next.length < 6) return showPwError(t('err_pw_short'), err);
        if (next !== conf) return showPwError(t('err_pw_match'), err);
        var users = State.users();
        var idx = users.findIndex(function (u) { return u.id === State.user.id; });
        if (idx === -1) return showPwError(t('err_generic'), err);
        var data = new TextEncoder().encode(users[idx].salt + cur);
        var hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
            .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        if (hash !== users[idx].passwordHash) return showPwError(t('err_pw_current'), err);
        var salt = '';
        var a = new Uint8Array(32);
        crypto.getRandomValues(a);
        salt = Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        var newHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + next))))
            .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        users[idx].salt = salt;
        users[idx].passwordHash = newHash;
        State.saveUsers(users);
        if (State.user.cloudId && window.BtsCloud && window.BtsCloud.ready && window.BtsCloud.currentUid() === State.user.cloudId) {
            window.BtsCloud.updatePassword(next).catch(function (err2) {
                console.warn('Firebase password not updated:', err2.message);
            });
        }
        document.getElementById('pwForm').reset();
        Dash.toast(t('toast_pw_changed'), 'success');
    }
    function showPwError(msg, err) { err.textContent = msg; err.classList.add('show'); }

    // ---------- parent zone ----------
    function generateParentCode() {
        State.data.parentCode = 'BTS-' + Math.floor(100000 + Math.random() * 900000);
        var users = State.users();
        var idx = users.findIndex(function (u) { return u.id === State.user.id; });
        if (idx !== -1) { users[idx].parentCode = State.data.parentCode; State.saveUsers(users); }
        State.save();
        renderParentPage();
        Store.push();
    }
    function renderParentPage() {
        var el = document.getElementById('parentCodeText');
        if (!el) return;
        var code = State.data.parentCode || '';
        el.textContent = code || '—';
        document.getElementById('copyCodeBtn').style.display = code ? '' : 'none';
    }
    function copyParentCode() {
        if (!State.data.parentCode) return;
        navigator.clipboard.writeText(State.data.parentCode)
            .then(function () { Dash.toast(t('code_copied'), 'success'); })
            .catch(function () { Dash.toast(State.data.parentCode, 'info'); });
    }

    // ---------- reminders ----------
    function scheduleReminders() {
        if (Notification.permission !== 'granted') return;
        var now = new Date();
        var hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        var key = now.toISOString().slice(0, 10);
        var n = State.data.notif;
        if (n.daily && hhmm === State.data.routine.wake && !notified[key + ':wake']) {
            notified[key + ':wake'] = true;
            Dash.notify(t('app_name'), t('todays_plan'));
        }
        if (n.homework) {
            State.data.homework.forEach(function (h) {
                if (h.done) return;
                var diff = Math.round((new Date(h.due) - new Date(key)) / 86400000);
                if ((diff === 0 || diff === 1) && !notified[key + ':hw' + h.id]) {
                    notified[key + ':hw' + h.id] = true;
                    Dash.notify(t('homework_title'), h.subject + ' — ' + (diff === 0 ? t('today') : '1 ' + t('days_left')));
                }
            });
        }
        if (n.exams) {
            State.data.exams.forEach(function (x) {
                var diff = Math.round((new Date(x.date) - new Date(key)) / 86400000);
                if (diff === 1 && !notified[key + ':ex' + x.id]) {
                    notified[key + ':ex' + x.id] = true;
                    Dash.notify(t('exams_title'), x.subject + ' — 1 ' + t('days_left'));
                }
            });
        }
    }

    // ---------- logout ----------
    function logout() {
        localStorage.removeItem('bts:v1:session');
        var done = function () { window.location.href = 'index.html'; };
        if (window.BtsCloud && window.BtsCloud.ready && window.BtsCloud.currentUid()) {
            window.BtsCloud.signOut().catch(function () { /* ignore */ }).then(done);
        } else done();
    }
})();
