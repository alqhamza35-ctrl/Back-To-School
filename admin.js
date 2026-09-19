// Back to School — admin panel (loaded by admin.html)
// Lists every account stored in this browser plus a per-account activity summary.
(function () {
    'use strict';

    var USERS_KEY = 'bts:v1:users';
    var SESSION_KEY = 'bts:v1:session';
    var DATA_PREFIX = 'bts:v1:data:';
    var MINUTE = 60000, HOUR = 3600000, DAY = 86400000;

    function t(key) { return window.I18N ? window.I18N.t(key) : key; }
    function esc(v) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(v == null ? '' : String(v)));
        return d.innerHTML;
    }
    function getUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
    function getPlanner(id) {
        try { return JSON.parse(localStorage.getItem(DATA_PREFIX + id) || 'null'); } catch (e) { return null; }
    }
    // Same credential scheme auth.js uses: random salt + SHA-256 digest, never the plaintext.
    function generateSalt() {
        var a = new Uint8Array(32);
        crypto.getRandomValues(a);
        return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    async function hashPassword(password, salt) {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password));
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    function randomPassword() {
        var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        var bytes = new Uint8Array(10), out = '';
        crypto.getRandomValues(bytes);
        for (var i = 0; i < bytes.length; i++) out += abc.charAt(bytes[i] % abc.length);
        return out;
    }
    function toast(msg, kind) {
        var wrap = document.getElementById('toastContainer');
        if (!wrap) return;
        var el = document.createElement('div');
        el.className = 'toast ' + (kind || 'success');
        el.innerHTML = '<i class="fas ' + (kind === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle') + '"></i><span></span>';
        el.querySelector('span').textContent = msg;
        wrap.appendChild(el);
        setTimeout(function () { el.remove(); }, 3200);
    }

    // ---------- gate ----------
    var session;
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { session = null; }
    var adminUser = session && getUsers().find(function (u) { return u.id === session.userId; });
    if (!adminUser || !adminUser.isAdmin) { window.location.href = 'login.html'; return; }

    // ---------- formatting ----------
    function locale() { return I18N.lang === 'ar' ? 'ar-EG' : 'en-GB'; }
    function fmtDate(value) {
        var d = value;
        if (typeof value === 'number') d = new Date(value);
        else if (typeof value === 'string' && value.length === 10) d = new Date(value + 'T00:00:00');
        else if (typeof value === 'string' && value) d = new Date(value);
        if (!d || isNaN(d.getTime())) return '—';
        return d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function fmtAgo(ms) {
        if (!ms) return '—';
        var diff = Date.now() - ms;
        if (diff < MINUTE) return t('admin_now');
        if (diff < HOUR) return t('admin_min_ago').replace('{n}', Math.round(diff / MINUTE));
        if (diff < DAY) return t('admin_hour_ago').replace('{n}', Math.round(diff / HOUR));
        if (diff < 7 * DAY) return t('admin_day_ago').replace('{n}', Math.round(diff / DAY));
        return fmtDate(ms);
    }

    // ---------- account summaries ----------
    function list(v) { return Array.isArray(v) ? v : []; }
    function summarize(user) {
        var d = getPlanner(user.id) || {};
        var gam = d.gam || {};
        var hw = list(d.homework);
        return {
            user: user, data: d,
            points: gam.points || 0,
            level: gam.level || 1,
            streak: gam.streak || 0,
            badges: list(gam.badges).length,
            hwOpen: hw.filter(function (h) { return !h.done; }).length,
            hwAll: hw.length,
            classes: list(d.classes).length,
            exams: list(d.exams).length,
            quizzes: list(d.quizzes).length,
            plan: list(d.schedule).length,
            rewards: list(d.rewards).length,
            chat: list(d.chat).length,
            pomoSessions: gam.pomoDone || 0,
            items: hw.length + list(d.classes).length + list(d.exams).length + list(d.quizzes).length + list(d.schedule).length,
            last: d.savedAt || 0
        };
    }

    var query = '';
    var sort = 'recent';

    function visibleRows() {
        var rows = getUsers().filter(function (u) { return u && u.id; }).map(summarize);
        var q = query.trim().toLowerCase();
        if (q) {
            rows = rows.filter(function (r) {
                return (r.user.email || '').toLowerCase().indexOf(q) > -1
                    || (r.user.displayName || '').toLowerCase().indexOf(q) > -1
                    || (r.user.parentCode || '').toLowerCase().indexOf(q) > -1;
            });
        }
        rows.sort(function (a, b) {
            if (sort === 'points') return b.points - a.points;
            if (sort === 'newest') return new Date(b.user.createdAt || 0) - new Date(a.user.createdAt || 0);
            return b.last - a.last;
        });
        return rows;
    }

    // ---------- rendering ----------
    function render() {
        var all = getUsers().filter(function (u) { return u && u.id; }).map(summarize);
        var active = all.filter(function (r) { return r.last && Date.now() - r.last < DAY; }).length;
        var points = all.reduce(function (s, r) { return s + r.points; }, 0);
        var fresh = all.filter(function (r) { return Date.now() - new Date(r.user.createdAt || 0).getTime() < 7 * DAY; }).length;

        setNum('admTotal', all.length);
        setNum('admActive', active);
        setNum('admPoints', points);
        setNum('admNew', fresh);

        var rows = visibleRows();
        var host = document.getElementById('adminList');
        if (!host) return;

        if (!all.length) {
            host.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>' + esc(t('admin_no_accounts')) + '</p></div>';
            return;
        }
        if (!rows.length) {
            host.innerHTML = '<div class="empty-state"><i class="fas fa-magnifying-glass"></i><p>' + esc(t('admin_no_results')) + '</p></div>';
            return;
        }

        var html = '<div class="admin-head">'
            + '<span>' + esc(t('admin_col_account')) + '</span>'
            + '<span>' + esc(t('admin_col_created')) + '</span>'
            + '<span>' + esc(t('admin_col_last')) + '</span>'
            + '<span>' + esc(t('admin_col_points')) + '</span>'
            + '<span>' + esc(t('admin_col_level')) + '</span>'
            + '<span>' + esc(t('admin_col_streak')) + '</span>'
            + '<span>' + esc(t('admin_col_items')) + '</span>'
            + '<span>' + esc(t('admin_col_actions')) + '</span>'
            + '</div>';

        rows.forEach(function (r) {
            var isSelf = r.user.id === adminUser.id;
            var isAdm = !!r.user.isAdmin;
            html += '<div class="admin-row" data-id="' + esc(r.user.id) + '">'
                + '<div class="admin-acc">'
                + '<div class="user-avatar">' + esc((r.user.displayName || r.user.email || '؟').charAt(0)) + '</div>'
                + '<div class="admin-acc-text"><b>' + esc(r.user.displayName || '—') + '</b>'
                + '<div class="hint">' + esc(r.user.email || '—') + '</div></div>'
                + (isAdm ? '<span class="chip chip-primary">' + esc(t('admin_role')) + '</span>' : '')
                + (isSelf ? '<span class="chip chip-success">' + esc(t('admin_me')) + '</span>' : '')
                + '</div>'
                + cell(t('admin_col_created'), fmtDate(r.user.createdAt))
                + cell(t('admin_col_last'), fmtAgo(r.last))
                + cell(t('admin_col_points'), '<b>' + r.points + '</b>', true)
                + cell(t('admin_col_level'), r.level)
                + cell(t('admin_col_streak'), r.streak)
                + cell(t('admin_col_items'), r.items)
                + '<div class="admin-actions">'
                + '<button type="button" class="btn btn-ghost btn-sm" data-act="view">' + esc(t('admin_details')) + '</button>'
                + (isAdm ? '' : '<button type="button" class="btn btn-danger btn-sm" data-act="delete">' + esc(t('delete')) + '</button>')
                + '</div></div>';
        });
        host.innerHTML = html;
    }

    // raw = already-escaped markup (numbers and fmt* output only)
    function cell(label, value, raw) {
        return '<div class="admin-cell" data-label="' + esc(label) + '">'
            + (raw ? value : esc(value)) + '</div>';
    }

    function setNum(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ---------- details modal ----------
    function kv(label, value) {
        return '<div class="adm-kv"><span>' + esc(label) + '</span><b>' + esc(value == null || value === '' ? '—' : value) + '</b></div>';
    }
    function openDetails(row) {
        var d = row.data;
        var hasData = !!getPlanner(row.user.id);
        var html = '<div class="adm-grid">';
        html += kv(t('admin_email'), row.user.email);
        html += kv(t('admin_role'), row.user.isAdmin ? t('admin_role') : t('admin_student'));
        html += kv(t('admin_created'), fmtDate(row.user.createdAt));
        html += kv(t('admin_last_act'), fmtAgo(row.last));
        html += kv(t('admin_points'), row.points);
        html += kv(t('admin_level'), row.level);
        html += kv(t('admin_streak'), row.streak);
        html += kv(t('admin_classes_c'), row.classes);
        html += kv(t('admin_hw_c'), row.hwOpen + ' / ' + row.hwAll);
        html += kv(t('admin_exams_c'), row.exams);
        html += kv(t('admin_quiz_c'), row.quizzes);
        html += kv(t('admin_plan_c'), row.plan);
        html += kv(t('admin_pomo_c'), row.pomoSessions);
        html += kv(t('admin_badges_c'), row.badges);
        html += kv(t('admin_rewards_c'), row.rewards);
        html += kv(t('admin_chat_c'), row.chat);
        html += kv(t('admin_code'), row.user.parentCode);
        html += kv(t('admin_lang'), d.lang || 'ar');
        html += kv(t('admin_theme'), d.theme || '—');
        html += kv(t('admin_device'), row.user.deviceId);
        html += kv(t('admin_cloud'), row.user.cloudId);
        html += '</div>';

        if (!hasData) {
            html += '<p class="hint" style="margin-top:14px">' + esc(t('admin_none')) + '</p>';
        } else {
            var open = list(d.homework).filter(function (h) { return !h.done; });
            html += '<div class="card-title" style="margin-top:18px"><i class="fas fa-file-alt"></i> <span>' + esc(t('admin_hw_open')) + '</span></div>';
            if (!open.length) html += '<p class="hint">' + esc(t('admin_no_hw')) + '</p>';
            else {
                html += '<div class="item-list">' + open.slice(0, 12).map(function (h) {
                    return '<div class="item"><div class="item-body">'
                        + '<div class="item-title">' + esc(h.subject || '—') + '</div>'
                        + '<div class="item-meta"><span>' + esc(h.title || '—') + '</span><span>' + esc(h.due ? fmtDate(h.due) : '—') + '</span></div>'
                        + '</div></div>';
                }).join('') + '</div>';
            }
        }

        html += '<div class="card-title" style="margin-top:18px"><i class="fas fa-key"></i> <span>' + esc(t('admin_pw_sec')) + '</span></div>'
            + '<p class="hint">' + esc(t('admin_pw_hint')) + '</p>'
            + '<div class="adm-pw-row">'
            + '<div class="field"><label for="admPwInput">' + esc(t('admin_pw_new')) + '</label>'
            + '<input type="text" id="admPwInput" autocomplete="off"></div>'
            + '<button type="button" class="btn btn-ghost" id="admPwGen">' + esc(t('generate')) + '</button>'
            + '<button type="button" class="btn btn-primary" id="admPwSet">' + esc(t('admin_pw_set')) + '</button>'
            + '</div><div class="pv-error" id="admPwErr"></div>';

        document.getElementById('admTitle').textContent = row.user.displayName || row.user.email || '—';
        document.getElementById('admBody').innerHTML = html;
        document.getElementById('adminModal').classList.add('active');

        var pwInput = document.getElementById('admPwInput');
        var pwErr = document.getElementById('admPwErr');
        document.getElementById('admPwGen').onclick = function () { pwInput.value = randomPassword(); pwErr.textContent = ''; };
        document.getElementById('admPwSet').onclick = function () {
            var value = pwInput.value;
            if (value.length < 6) { pwErr.textContent = t('err_pw_short'); return; }
            setPassword(row.user.id, value).then(function (ok) {
                if (!ok) { pwErr.textContent = t('err_generic'); return; }
                pwErr.textContent = '';
                pwInput.value = '';
                toast(t('admin_pw_updated'), 'success');
            });
        };
    }
    function closeDetails() { document.getElementById('adminModal').classList.remove('active'); }

    // ---------- delete ----------
    function confirmBox(msg, onYes) {
        var overlay = document.getElementById('modalConfirm');
        var box = document.getElementById('confirmMsg');
        if (box) box.textContent = msg;
        var yes = document.getElementById('confirmYes'), no = document.getElementById('confirmNo');
        var close = function () {
            overlay.classList.remove('active');
            yes.onclick = no.onclick = overlay.onclick = null;
        };
        yes.onclick = function () { close(); onYes(); };
        no.onclick = close;
        overlay.onclick = function (e) { if (e.target === overlay) close(); };
        overlay.classList.add('active');
    }

    async function createAccount(name, email, password, role) {
        var salt = generateSalt();
        var users = getUsers();
        users.push({
            id: 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            cloudId: null,
            displayName: name.replace(/[<>]/g, ''),
            email: email,
            salt: salt,
            passwordHash: await hashPassword(password, salt),
            deviceId: localStorage.getItem('bts:v1:device') || '',
            createdAt: new Date().toISOString(),
            parentCode: '',
            isAdmin: role === 'admin'
        });
        saveUsers(users);
    }

    async function setPassword(id, password) {
        var users = getUsers();
        var idx = users.findIndex(function (u) { return u.id === id; });
        if (idx === -1) return false;
        var salt = generateSalt();
        users[idx].salt = salt;
        users[idx].passwordHash = await hashPassword(password, salt);
        saveUsers(users);
        return true;
    }

    function removeAccount(id) {
        var users = getUsers();
        var idx = users.findIndex(function (u) { return u.id === id; });
        if (idx === -1) return;
        if (users[idx].isAdmin) { toast(t('admin_cannot_delete'), 'error'); return; }
        users.splice(idx, 1);
        saveUsers(users);
        localStorage.removeItem(DATA_PREFIX + id);
        toast(t('admin_deleted'), 'success');
        render();
    }

    // ---------- wiring ----------
    document.addEventListener('DOMContentLoaded', function () {
        I18N.init();
        render();

        var search = document.getElementById('adminSearch');
        search.addEventListener('input', function () { query = search.value; render(); });
        var sortSel = document.getElementById('adminSort');
        sortSel.addEventListener('change', function () { sort = sortSel.value; render(); });

        document.getElementById('refreshBtn').addEventListener('click', function () { render(); });

        var addForm = document.getElementById('addForm');
        var addErr = document.getElementById('addErr');
        addForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = document.getElementById('nfName').value.trim();
            var email = document.getElementById('nfEmail').value.trim().toLowerCase();
            var password = document.getElementById('nfPw').value;
            var role = document.getElementById('nfRole').value;
            if (name.length < 2 || name.length > 50) { addErr.textContent = t('err_name_length'); return; }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { addErr.textContent = t('err_invalid_email'); return; }
            if (password.length < 6) { addErr.textContent = t('err_pw_short'); return; }
            if (getUsers().some(function (u) { return (u.email || '').toLowerCase() === email; })) { addErr.textContent = t('err_email_taken'); return; }
            addErr.textContent = '';
            createAccount(name, email, password, role).then(function () {
                addForm.reset();
                toast(t('admin_created_ok'), 'success');
                render();
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', function () {
            localStorage.removeItem(SESSION_KEY);
            window.location.href = 'login.html';
        });
        document.getElementById('langToggle').addEventListener('click', function () {
            I18N.setLang(I18N.lang === 'ar' ? 'en' : 'ar');
            render();
        });

        document.getElementById('adminList').addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('[data-act]') : null;
            if (!btn) return;
            var rowEl = btn.closest('.admin-row');
            if (!rowEl) return;
            var id = rowEl.getAttribute('data-id');
            var act = btn.getAttribute('data-act');
            if (act === 'view') {
                var found = getUsers().find(function (u) { return u.id === id; });
                if (found) openDetails(summarize(found));
            } else {
                confirmBox(t('admin_delete_q'), function () { removeAccount(id); });
            }
        });

        var modal = document.getElementById('adminModal');
        document.getElementById('admClose').addEventListener('click', closeDetails);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeDetails(); });
    });
})();
