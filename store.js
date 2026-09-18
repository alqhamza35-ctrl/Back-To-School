// Back to School — Firestore sync (debounced push, timestamped pull)
// Every document lives under users/{cloudId}; the local user id never touches
// Firestore paths, so profile, planner and FCM token share one identity.
(function () {
    'use strict';

    var PUSH_DEBOUNCE_MS = 4000;
    var PULL_INTERVAL_MS = 60000;
    var pushTimer = null;

    function cloudReady() {
        return window.BtsCloud && window.BtsCloud.ready;
    }
    function uid() {
        return State.user && State.user.cloudId ? State.user.cloudId : null;
    }
    function signedInMatches() {
        return cloudReady() && uid() && window.BtsCloud.currentUid() === uid();
    }

    function setStatus(kind, text) {
        var el = document.getElementById('syncStatus');
        if (!el) return;
        el.className = 'sync-status ' + kind;
        el.innerHTML = '<span class="dot"></span> ' + text;
    }

    window.Store = {
        busy: false,

        queuePush: function () {
            if (!signedInMatches()) { setStatus('', window.I18N.t('offline_only')); return; }
            clearTimeout(pushTimer);
            pushTimer = setTimeout(function () { Store.push(); }, PUSH_DEBOUNCE_MS);
        },

        push: function () {
            if (!signedInMatches()) return Promise.resolve();
            this.busy = true;
            var data = JSON.parse(JSON.stringify(State.data));
            return Promise.all([
                window.BtsCloud.saveProfile(uid(), {
                    displayName: State.user.displayName,
                    email: State.user.email,
                    parentCode: State.data.parentCode,
                    savedAt: data.savedAt
                }),
                window.BtsCloud.savePlanner(uid(), data)
            ]).then(function () {
                setStatus('online', window.I18N.t('synced'));
            }).catch(function (err) {
                console.warn('Cloud push failed:', err.message);
                setStatus('error', 'sync error');
            }).then(function () { Store.busy = false; });
        },

        pull: function () {
            if (!signedInMatches()) return Promise.resolve(false);
            return window.BtsCloud.getPlanner(uid()).then(function (cloud) {
                if (!cloud) { Store.push(); return false; }
                if ((cloud.savedAt || 0) > (State.data.savedAt || 0)) {
                    State.replaceAll(cloud);
                    return true;
                }
                return false;
            }).catch(function (err) {
                console.warn('Cloud pull failed:', err.message);
                setStatus('error', 'sync error');
                return false;
            });
        },

        start: function () {
            if (!cloudReady()) { setStatus('', window.I18N.t('offline_only')); return; }
            window.BtsCloud.onAuthChange(function (fbUser) {
                if (fbUser && State.user && !State.user.cloudId) {
                    State.user.cloudId = fbUser.uid;
                    var users = State.users();
                    var idx = users.findIndex(function (u) { return u.id === State.user.id; });
                    if (idx !== -1) { users[idx].cloudId = fbUser.uid; State.saveUsers(users); }
                }
            });
            this.pull().then(function (changed) {
                if (changed && window.Dash) window.Dash.rerenderAll();
                if (!changed) Store.push();
            });
            setInterval(function () {
                if (document.hidden || Store.busy) return;
                Store.pull().then(function (changed) {
                    if (changed && window.Dash) window.Dash.rerenderAll();
                });
            }, PULL_INTERVAL_MS);
        }
    };
})();
