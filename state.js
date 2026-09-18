// Back to School — local state container (offline-first)
(function () {
    'use strict';

    var USERS_KEY = 'bts:v1:users';
    var SESSION_KEY = 'bts:v1:session';
    var DATA_PREFIX = 'bts:v1:data:';

    function defaultData() {
        return {
            version: 1,
            savedAt: 0,
            classes: [],
            homework: [],
            exams: [],
            quizzes: [],
            schedule: [],
            scheduleDay: '',
            routine: {
                wake: '06:00', sleep: '22:00', schoolStart: '07:30', schoolEnd: '14:00',
                breakfast: '06:30', lunch: '14:30', dinner: '20:00', exercise: '16:00', shower: '21:00'
            },
            gam: { points: 0, xp: 0, level: 1, streak: 0, lastActive: '', badges: [], log: [], hwDone: 0, pomoDone: 0 },
            pomo: {
                settings: { work: 25, short: 5, long: 15, rounds: 4 },
                stats: { day: '', sessions: 0, minutes: 0 },
                history: []
            },
            rewards: [],
            parentCode: '',
            notif: { homework: true, exams: true, daily: true },
            lang: 'ar',
            theme: 'dark'
        };
    }

    var listeners = [];

    window.State = {
        user: null,
        data: null,

        boot: function () {
            var session;
            try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }
            if (!session || !session.userId) {
                window.location.href = 'login.html';
                return false;
            }
            var users;
            try { users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) { users = []; }
            this.user = users.find(function (u) { return u.id === session.userId; });
            if (!this.user) {
                localStorage.removeItem(SESSION_KEY);
                window.location.href = 'login.html';
                return false;
            }
            var def = defaultData();
            try {
                var raw = JSON.parse(localStorage.getItem(DATA_PREFIX + this.user.id));
                if (raw) {
                    var merged = Object.assign(def, raw);
                    merged.routine = Object.assign(defaultData().routine, raw.routine || {});
                    merged.gam = Object.assign(defaultData().gam, raw.gam || {});
                    merged.pomo = Object.assign(defaultData().pomo, raw.pomo || {});
                    merged.pomo.settings = Object.assign(defaultData().pomo.settings, (raw.pomo || {}).settings || {});
                    merged.notif = Object.assign(defaultData().notif, raw.notif || {});
                    this.data = merged;
                } else {
                    this.data = def;
                }
            } catch (e) { this.data = def; }
            return true;
        },

        save: function () {
            this.data.savedAt = Date.now();
            localStorage.setItem(DATA_PREFIX + this.user.id, JSON.stringify(this.data));
            if (window.Store) window.Store.queuePush();
            listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
        },

        replaceAll: function (newData) {
            var def = defaultData();
            this.data = Object.assign(def, newData);
            localStorage.setItem(DATA_PREFIX + this.user.id, JSON.stringify(this.data));
        },

        onChange: function (fn) { listeners.push(fn); },

        users: function () {
            try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) { return []; }
        },
        saveUsers: function (users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); },
        dataKey: function () { return DATA_PREFIX + this.user.id; },

        uid: function () {
            return 'x-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }
    };
})();
