// Back to School — parent portal logic (loaded by parent.html)
(function () {
    'use strict';

    var STR = {
        ar: {
            brand: 'لوحة الوالدين', home: 'الرئيسية', pvTitle: 'متابعة ابنك/ابنتك',
            pvDesc: 'أدخل رمز المتابعة الذي شاركه ابنك', connect: 'اتصال',
            err_code: 'رمز غير صحيح. تحقق وحاول مجدداً.', err_network: 'خطأ في الشبكة. حاول مجدداً.',
            ok_connect: 'تم الاتصال بنجاح!', disconnect: 'قطع الاتصال',
            doneHw: 'واجب منجز', pendingHw: 'واجب متبقٍ', studyMin: 'دقائق مذاكرة اليوم', points: 'النقاط',
            schTitle: 'جدول اليوم', exTitle: 'الامتحانات القادمة', hwTitle: 'الواجبات', rwTitle: 'المكافآت',
            rwLabel: 'المكافأة', rwCost: 'التكلفة (نقاط)', rwAdd: 'إضافة',
            empty: 'لا توجد بيانات بعد', updated: 'آخر تحديث:', ok_rw: 'تمت إضافة المكافأة',
            approve: 'موافقة', reject: 'رفض', pending: 'بانتظار الموافقة', redeemed: 'تم الاستبدال',
            available: 'متاحة', ok_approved: 'تمت الموافقة!', ok_rejected: 'تم الرفض ورُدّت النقاط',
            no_schedule: 'لا جدول', no_exams: 'لا امتحانات قادمة', no_homework: 'لا واجبات',
            refresh: 'تحديث'
        },
        en: {
            brand: 'Parent Dashboard', home: 'Home', pvTitle: 'Track your child',
            pvDesc: 'Enter the tracking code your child shared', connect: 'Connect',
            err_code: 'Invalid code. Check and try again.', err_network: 'Network error. Try again.',
            ok_connect: 'Connected!', disconnect: 'Disconnect',
            doneHw: 'Homework done', pendingHw: 'Homework left', studyMin: 'Study minutes today', points: 'Points',
            schTitle: 'Today\'s schedule', exTitle: 'Upcoming exams', hwTitle: 'Homework', rwTitle: 'Rewards',
            rwLabel: 'Reward', rwCost: 'Cost (points)', rwAdd: 'Add',
            empty: 'No data yet', updated: 'Last updated:', ok_rw: 'Reward added',
            approve: 'Approve', reject: 'Reject', pending: 'Pending approval', redeemed: 'Redeemed',
            available: 'Available', ok_approved: 'Approved!', ok_rejected: 'Rejected, points refunded',
            no_schedule: 'No schedule', no_exams: 'No upcoming exams', no_homework: 'No homework',
            refresh: 'Refresh'
        }
    };
    var lang = localStorage.getItem('bts:v1:lang') || 'ar';
    var studentUid = null, poll = null, lastData = null;

    function s(k) { return STR[lang][k]; }
    function esc(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str == null ? '' : String(str))); return d.innerHTML; }
    function fmtTime(hhmm) {
        if (!hhmm) return '';
        var p = hhmm.split(':'), h = +p[0];
        var period = h >= 12 ? (lang === 'ar' ? 'م' : 'PM') : (lang === 'ar' ? 'ص' : 'AM');
        return (h % 12 || 12) + ':' + p[1] + ' ' + period;
    }
    function fmtDate(dstr) {
        if (!dstr) return '';
        return new Date(dstr + 'T00:00:00').toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short', day: 'numeric' });
    }
    function toast(msg, kind) {
        var wrap = document.getElementById('toastContainer');
        var el = document.createElement('div');
        el.className = 'toast ' + (kind || 'success');
        el.innerHTML = '<i class="fas fa-check-circle"></i><span></span>';
        el.querySelector('span').textContent = msg;
        wrap.appendChild(el);
        setTimeout(function () { el.remove(); }, 3000);
    }

    function applyStrings() {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.getElementById('brandText').textContent = s('brand');
        document.getElementById('homeLink').textContent = s('home');
        document.getElementById('pvTitle').textContent = s('pvTitle');
        document.getElementById('pvDesc').textContent = s('pvDesc');
        document.getElementById('connectBtn').textContent = s('connect');
        document.getElementById('disconnectBtn').textContent = s('disconnect');
        document.getElementById('pvSchTitle').textContent = s('schTitle');
        document.getElementById('pvExTitle').textContent = s('exTitle');
        document.getElementById('pvHwTitle').textContent = s('hwTitle');
        document.getElementById('pvRwTitle').textContent = s('rwTitle');
        document.getElementById('pvRwLabel').textContent = s('rwLabel');
        document.getElementById('pvRwCost').textContent = s('rwCost');
        document.getElementById('pvRwAdd').textContent = s('rwAdd');
        document.getElementById('pvUpdated').textContent = s('updated');
        document.getElementById('refreshBtn').textContent = s('refresh');
        document.getElementById('langLabel').textContent = lang === 'ar' ? 'EN' : 'عربي';
        var labels = document.querySelectorAll('.stat-label');
        var keys = ['doneHw', 'pendingHw', 'studyMin', 'points'];
        labels.forEach(function (el, i) { el.textContent = s(keys[i]); });
    }

    function connect() {
        var input = document.getElementById('trackingCodeInput');
        var errEl = document.getElementById('codeError');
        var code = input.value.trim().toUpperCase();
        errEl.textContent = '';
        if (!code) { errEl.textContent = s('err_code'); return; }
        document.getElementById('loadingSpinner').classList.add('show');
        document.getElementById('connectBtn').disabled = true;
        BtsCloud.findUserByParentCode(code).then(function (snap) {
            document.getElementById('loadingSpinner').classList.remove('show');
            document.getElementById('connectBtn').disabled = false;
            if (snap.empty) { errEl.textContent = s('err_code'); return; }
            var doc = snap.docs[0];
            studentUid = doc.id;
            var profile = doc.data();
            document.getElementById('codeEntry').style.display = 'none';
            document.getElementById('parentDashboard').style.display = 'block';
            document.getElementById('studentName').textContent = profile.displayName || '—';
            document.getElementById('studentEmail').textContent = profile.email || '—';
            document.getElementById('studentAvatar').textContent = (profile.displayName || 'م').charAt(0);
            document.getElementById('trackingCodeText').textContent = code;
            toast(s('ok_connect'), 'success');
            load();
            poll = setInterval(load, 30000);
        }).catch(function (err) {
            console.error(err);
            document.getElementById('loadingSpinner').classList.remove('show');
            document.getElementById('connectBtn').disabled = false;
            errEl.textContent = s('err_network');
        });
    }

    function disconnect() {
        clearInterval(poll); poll = null;
        studentUid = null;
        document.getElementById('parentDashboard').style.display = 'none';
        document.getElementById('codeEntry').style.display = 'block';
        document.getElementById('trackingCodeInput').value = '';
    }

    function itemRow(title, meta) {
        return '<div class="item"><div class="item-body"><div class="item-title">' + esc(title) + '</div>' +
            (meta ? '<div class="item-meta"><span>' + esc(meta) + '</span></div>' : '') + '</div></div>';
    }

    function render(data) {
        var today = new Date().toISOString().slice(0, 10);
        var hw = data.homework || [];
        var done = hw.filter(function (h) { return h.done; }).length;
        document.getElementById('pvDoneHw').textContent = done;
        document.getElementById('pvPendingHw').textContent = hw.length - done;
        var pomo = data.pomo || {};
        document.getElementById('pvStudyMin').textContent = (pomo.stats && pomo.stats.day === today) ? pomo.stats.minutes : 0;
        document.getElementById('pvPoints').textContent = (data.gam && data.gam.points) || 0;

        var sch = data.schedule || [];
        document.getElementById('pvSchedule').innerHTML = sch.length ? sch.map(function (x) {
            return itemRow(x.activity, fmtTime(x.time) + (x.done ? ' ✓' : ''));
        }).join('') : '<div class="empty-state">' + s('no_schedule') + '</div>';

        var exams = (data.exams || []).filter(function (x) { return x.date >= today; })
            .sort(function (a, b) { return a.date.localeCompare(b.date); });
        document.getElementById('pvExams').innerHTML = exams.length ? exams.map(function (x) {
            var days = Math.round((new Date(x.date) - new Date(today)) / 86400000);
            return itemRow(x.subject, fmtDate(x.date) + ' · ' + days + (lang === 'ar' ? ' يوم' : ' days'));
        }).join('') : '<div class="empty-state">' + s('no_exams') + '</div>';

        document.getElementById('pvHomework').innerHTML = hw.length ? hw.map(function (h) {
            return itemRow(h.title, h.subject + ' · ' + fmtDate(h.due) + (h.done ? ' ✓' : ''));
        }).join('') : '<div class="empty-state">' + s('no_homework') + '</div>';

        var rewards = data.rewards || [];
        document.getElementById('pvRewards').innerHTML = rewards.map(function (r) {
            var actions = '';
            if (r.status === 'pending') actions = '<button class="btn btn-sm btn-accent" data-appr="' + r.id + '">' + s('approve') + '</button> ' +
                '<button class="btn btn-sm btn-danger" data-rej="' + r.id + '">' + s('reject') + '</button>';
            else actions = '<span class="chip ' + (r.status === 'redeemed' ? 'chip-success' : 'chip-primary') + '">' + s(r.status) + '</span>';
            return '<div class="reward-item"><div class="reward-body"><div class="reward-label">' + esc(r.label) + '</div>' +
                '<div class="reward-cost">' + r.cost + ' ' + s('points') + '</div></div>' + actions + '</div>';
        }).join('') || '<div class="empty-state">' + s('empty') + '</div>';
        document.querySelectorAll('[data-appr]').forEach(function (b) {
            b.addEventListener('click', function () { updateReward(b.dataset.appr, 'redeemed', 0); });
        });
        document.querySelectorAll('[data-rej]').forEach(function (b) {
            b.addEventListener('click', function () {
                var r = ((lastData && lastData.rewards) || []).find(function (x) { return x.id === b.dataset.rej; });
                updateReward(b.dataset.rej, 'available', r ? r.cost : 0);
            });
        });
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB');
    }

    function load() {
        if (!studentUid) return;
        BtsCloud.getPlanner(studentUid).then(function (data) {
            lastData = data || {};
            render(lastData);
        }).catch(function (err) { console.warn('load failed', err); });
    }

    function mutate(fn) {
        return BtsCloud.getPlanner(studentUid).then(function (data) {
            data = data || {};
            fn(data);
            data.savedAt = Date.now();
            return BtsCloud.savePlanner(studentUid, data).then(load);
        });
    }

    function updateReward(id, status, refund) {
        mutate(function (data) {
            var r = (data.rewards || []).find(function (x) { return x.id === id; });
            if (!r) return;
            r.status = status;
            if (refund && data.gam) {
                data.gam.points = (data.gam.points || 0) + refund;
                (data.gam.log = data.gam.log || []).unshift({ label: r.label + ' ✗', pts: refund, at: new Date().toISOString() });
            }
        }).then(function () { toast(status === 'redeemed' ? s('ok_approved') : s('ok_rejected'), 'success'); });
    }

    document.getElementById('rewardForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var label = document.getElementById('rewardLabel').value.trim();
        var cost = Math.max(10, +document.getElementById('rewardCost').value || 0);
        if (!label) return;
        mutate(function (data) {
            data.rewards = data.rewards || [];
            data.rewards.push({ id: 'rw-' + Date.now().toString(36), label: label, cost: cost, status: 'available' });
        }).then(function () {
            e.target.reset();
            toast(s('ok_rw'), 'success');
        });
    });

    document.getElementById('connectBtn').addEventListener('click', connect);
    document.getElementById('trackingCodeInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') connect();
    });
    document.getElementById('disconnectBtn').addEventListener('click', disconnect);
    document.getElementById('refreshBtn').addEventListener('click', load);
    document.getElementById('langToggle').addEventListener('click', function () {
        lang = lang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('bts:v1:lang', lang);
        applyStrings();
        if (studentUid) load();
    });

    if (!BtsCloud.ready) {
        document.getElementById('codeError').textContent = 'Firebase unavailable';
        document.getElementById('connectBtn').disabled = true;
    }
    applyStrings();
})();
