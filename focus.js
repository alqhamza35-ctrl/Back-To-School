// Back to School — Pomodoro study timer
(function () {
    'use strict';

    function t(k) { return window.I18N.t(k); }
    function todayStr() { return new Date().toISOString().slice(0, 10); }

    var timerId = null;
    var mode = 'work';          // work | short | long
    var running = false;
    var secondsLeft = 25 * 60;
    var totalSeconds = 25 * 60;
    var roundsDone = 0;

    function modeSeconds(m) {
        var s = State.data.pomo.settings;
        return (m === 'work' ? s.work : m === 'short' ? s.short : s.long) * 60;
    }

    function fmt(sec) {
        var m = Math.floor(sec / 60), s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function paint() {
        var timeEl = document.getElementById('pomoTime');
        if (timeEl) timeEl.textContent = fmt(secondsLeft);
        var modeEl = document.getElementById('pomoMode');
        if (modeEl) modeEl.textContent = t(mode === 'work' ? 'work' : mode === 'short' ? 'short_break' : 'long_break');
        var prog = document.getElementById('pomoProgress');
        if (prog) prog.querySelector('span').style.width = (100 - (secondsLeft / totalSeconds) * 100) + '%';
        var btn = document.getElementById('pomoToggle');
        if (btn) btn.innerHTML = running
            ? '<i class="fas fa-pause"></i> ' + t('pause')
            : '<i class="fas fa-play"></i> ' + t(secondsLeft === totalSeconds ? 'start' : 'resume');
        var dots = document.getElementById('pomoDots');
        if (dots) {
            var rounds = State.data.pomo.settings.rounds;
            dots.innerHTML = Array.from({ length: rounds }, function (_, i) {
                return '<i class="fas fa-circle' + (i < roundsDone ? ' done' : '') + '"></i>';
            }).join('');
        }
        document.title = (running ? fmt(secondsLeft) + ' · ' : '') + t('app_name');
    }

    function tick() {
        if (secondsLeft > 0) { secondsLeft--; paint(); return; }
        if (mode === 'work') {
            roundsDone++;
            var p = State.data.pomo;
            if (p.stats.day !== todayStr()) p.stats = { day: todayStr(), sessions: 0, minutes: 0 };
            p.stats.sessions++;
            p.stats.minutes += p.settings.work;
            var hist = p.history.filter(function (h) { return h.date !== todayStr(); });
            var existing = p.history.find(function (h) { return h.date === todayStr(); });
            if (existing) { existing.sessions = p.stats.sessions; existing.minutes = p.stats.minutes; }
            else hist.push({ date: todayStr(), sessions: p.stats.sessions, minutes: p.stats.minutes });
            p.history = hist.slice(-7);
            State.data.gam.pomoDone = (State.data.gam.pomoDone || 0) + 1;
            Game.addPoints(30, 'focus_title');
            window.Dash.notify(t('focus_title'), t('toast_done'));
            mode = roundsDone >= p.settings.rounds ? 'long' : 'short';
            roundsDone = roundsDone >= p.settings.rounds ? 0 : roundsDone;
        } else {
            mode = 'work';
        }
        totalSeconds = modeSeconds(mode);
        secondsLeft = totalSeconds;
        running = false;
        clearInterval(timerId); timerId = null;
        renderStats();
        paint();
    }

    function renderStats() {
        var p = State.data.pomo;
        if (p.stats.day !== todayStr()) p.stats = { day: todayStr(), sessions: 0, minutes: 0 };
        var s = document.getElementById('pomoSessions');
        var m = document.getElementById('pomoMinutes');
        if (s) s.textContent = p.stats.sessions;
        if (m) m.textContent = p.stats.minutes;
        var hist = document.getElementById('pomoHistory');
        if (hist) {
            var days = p.history.slice(-7);
            var max = Math.max.apply(null, days.map(function (d) { return d.minutes; }).concat([1]));
            hist.innerHTML = days.map(function (d) {
                return '<div class="pomo-stat card"><b>' + d.minutes + '</b><span>' + I18N.fmtDate(d.date) + '</span>' +
                    '<div class="progress" style="margin-top:8px"><span style="width:' + Math.round(d.minutes / max * 100) + '%"></span></div></div>';
            }).join('') || '<div class="empty-state">' + t('history') + '</div>';
        }
        var inputs = ['pomoWork', 'pomoShort', 'pomoLong', 'pomoRounds'];
        var vals = [p.settings.work, p.settings.short, p.settings.long, p.settings.rounds];
        inputs.forEach(function (id, i) {
            var el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = vals[i];
        });
    }

    window.Focus = {
        toggle: function () {
            if (running) {
                running = false; clearInterval(timerId); timerId = null;
            } else {
                running = true;
                timerId = setInterval(tick, 1000);
            }
            paint();
        },
        reset: function () {
            running = false; clearInterval(timerId); timerId = null;
            totalSeconds = modeSeconds(mode);
            secondsLeft = totalSeconds;
            paint();
        },
        setMode: function (m) {
            mode = m; roundsDone = 0;
            this.reset();
        },
        saveSettings: function () {
            var p = State.data.pomo;
            p.settings.work = Math.max(1, +document.getElementById('pomoWork').value || 25);
            p.settings.short = Math.max(1, +document.getElementById('pomoShort').value || 5);
            p.settings.long = Math.max(1, +document.getElementById('pomoLong').value || 15);
            p.settings.rounds = Math.max(2, +document.getElementById('pomoRounds').value || 4);
            State.save();
            if (!running) { totalSeconds = modeSeconds(mode); secondsLeft = totalSeconds; }
            renderStats(); paint();
            window.Dash.toast(t('toast_saved'), 'success');
        },
        render: function () { renderStats(); paint(); }
    };
})();
