// Back to School — study assistant chat (offline brain.js) with real actions on the planner
// History lives in State.data.chat; every mutation goes through the app's own modules.
(function () {
    'use strict';

    var MAX_STORED = 60;
    var busy = false;
    var rec = null;
    var heard = '';

    function t(k) { return window.I18N ? window.I18N.t(k) : k; }
    function voiceLang() { return I18N.lang === 'ar' ? 'ar-SA' : 'en-US'; }
    function msgs() {
        if (!Array.isArray(State.data.chat)) State.data.chat = [];
        return State.data.chat;
    }
    function low(v) { return String(v == null ? '' : v).toLowerCase().trim(); }
    function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
    function isTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }
    function yes(v) { return typeof v === 'string' && v.trim().length > 0; }
    function ok(action, extra) {
        return Object.assign({ ok: true, action: action }, extra || {});
    }
    function bad(error, extra) {
        return Object.assign({ ok: false, error: error }, extra || {});
    }

    // ---------- reply formatting (markdown-lite, always escaped first) ----------
    function md(text) {
        var src = window.Dash.esc(String(text == null ? '' : text)).replace(/\r/g, '');
        src = src.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        src = src.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        var out = '', list = null;
        function close() { if (list) { out += '</' + list + '>'; list = null; } }
        src.split('\n').forEach(function (line) {
            var s = line.trim();
            var ul = /^[-*•]\s+(.+)$/.exec(s);
            var ol = /^\d+[.)]\s+(.+)$/.exec(s);
            var h = /^#{1,4}\s+(.+)$/.exec(s);
            if (!s) { close(); return; }
            if (h) { close(); out += '<p class="md-h">' + h[1] + '</p>'; return; }
            if (ul) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += '<li>' + ul[1] + '</li>'; return; }
            if (ol) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += '<li>' + ol[1] + '</li>'; return; }
            close();
            out += '<p>' + s + '</p>';
        });
        close();
        return out;
    }

    function plain(text) {
        return String(text == null ? '' : text)
            .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
            .replace(/[*`#>_]/g, '')
            .replace(/\s+/g, ' ').trim();
    }

    // ---------- item lookup, shared by finish/remove ----------
    var KINDS = {
        homework: {
            list: function () { return State.data.homework; },
            text: function (x) { return x.subject + ' ' + x.title; },
            label: function (x) { return x.subject + ': ' + x.title; },
            drop: function (id) { State.data.homework = State.data.homework.filter(function (x) { return x.id !== id; }); }
        },
        class: {
            list: function () { return State.data.classes; },
            text: function (x) { return x.name + ' ' + (x.teacher || ''); },
            label: function (x) { return x.name; },
            drop: function (id) { State.data.classes = State.data.classes.filter(function (x) { return x.id !== id; }); }
        },
        exam: {
            list: function () { return State.data.exams; },
            text: function (x) { return x.subject + ' ' + x.date; },
            label: function (x) { return x.subject + ' (' + x.date + ')'; },
            drop: function (id) { State.data.exams = State.data.exams.filter(function (x) { return x.id !== id; }); }
        },
        quiz: {
            list: function () { return State.data.quizzes; },
            text: function (x) { return x.subject + ' ' + x.question; },
            label: function (x) { return x.subject + ': ' + x.question; },
            drop: function (id) { State.data.quizzes = State.data.quizzes.filter(function (x) { return x.id !== id; }); }
        },
        plan: {
            list: function () { return State.data.schedule; },
            text: function (x) { return x.activity; },
            label: function (x) { return x.time + ' ' + x.activity; },
            drop: function (id) { State.data.schedule = State.data.schedule.filter(function (x) { return x.id !== id; }); }
        }
    };

    function find(kind, subject, keyword) {
        var spec = KINDS[kind];
        if (!spec) return { error: 'unknown kind ' + kind };
        var s = low(subject), k = low(keyword);
        var hits = spec.list().filter(function (x) {
            var hay = low(spec.text(x));
            return (!k || hay.indexOf(k) > -1) && (!s || hay.indexOf(s) > -1);
        });
        return { spec: spec, hits: hits };
    }

    // ---------- actions the assistant can perform ----------
    var PAGES = ['overview', 'classes', 'homework', 'exams', 'quiz', 'schedule', 'calendar', 'focus', 'assistant', 'achievements', 'parent', 'settings'];

    var HANDLERS = {
        add_homework: function (a) {
            if (!isDate(a.due)) return bad('due must be YYYY-MM-DD');
            State.data.homework.push({
                id: State.uid(), subject: String(a.subject).trim(), title: String(a.title).trim(),
                due: a.due, priority: ['low', 'medium', 'high'].indexOf(a.priority) > -1 ? a.priority : 'medium',
                done: false, createdAt: new Date().toISOString()
            });
            State.save();
            return ok(t('nav_homework') + ' + ' + a.subject + ': ' + a.title);
        },
        finish_homework: function (a) {
            var f = find('homework', a.subject, a.keyword);
            if (f.error) return bad(f.error);
            var pending = f.hits.filter(function (x) { return !x.done; });
            if (!pending.length) return bad('no pending homework matches');
            if (pending.length > 1) return bad('ambiguous', { matches: pending.map(f.spec.label) });
            Planner.toggleHomework(pending[0].id);
            return ok(t('nav_homework') + ' ✓ ' + f.spec.label(pending[0]), { points: 10 });
        },
        add_class: function (a) {
            if (!isTime(a.time) || !(a.day >= 0 && a.day <= 6)) return bad('bad day or time');
            State.data.classes.push({ id: State.uid(), name: String(a.name).trim(), teacher: String(a.teacher || '').trim(), day: +a.day, time: a.time });
            State.save();
            return ok(t('nav_classes') + ' + ' + a.name);
        },
        add_exam: function (a) {
            if (!isDate(a.date)) return bad('date must be YYYY-MM-DD');
            State.data.exams.push({ id: State.uid(), subject: String(a.subject).trim(), date: a.date, time: isTime(a.time) ? a.time : '08:00' });
            State.save();
            return ok(t('nav_exams') + ' + ' + a.subject + ' ' + a.date);
        },
        add_quiz: function (a) {
            var opts = (a.options || []).map(function (o) { return String(o).trim(); }).filter(Boolean).slice(0, 4);
            if (opts.length < 2) return bad('need at least 2 options');
            var c = +a.correct;
            if (!(c >= 0 && c < opts.length)) return bad('correct index out of range');
            State.data.quizzes.unshift({
                id: State.uid(), subject: String(a.subject).trim(), question: String(a.question).trim(),
                options: opts, correct: c, done: false
            });
            State.save();
            return ok(t('nav_quiz') + ' + ' + a.subject);
        },
        add_plan_item: function (a) {
            if (!isTime(a.time)) return bad('time must be HH:MM');
            State.data.schedule.push({ id: State.uid(), time: a.time, activity: String(a.activity).trim(), done: false });
            State.data.schedule.sort(function (x, y) { return x.time.localeCompare(y.time); });
            State.data.scheduleDay = new Date().toISOString().slice(0, 10);
            State.save();
            return ok(t('nav_schedule') + ' + ' + a.time + ' ' + a.activity);
        },
        plan_day: function () { Planner.generate(); return ok(t('nav_schedule') + ' ✓'); },
        remove_item: function (a) {
            var f = find(a.kind, a.subject, a.keyword);
            if (f.error) return bad(f.error);
            if (!f.hits.length) return bad('nothing matches');
            if (f.hits.length > 1) return bad('ambiguous', { matches: f.hits.map(f.spec.label) });
            f.spec.drop(f.hits[0].id);
            State.save();
            return ok(t('delete') + ': ' + f.spec.label(f.hits[0]));
        },
        add_wish: function (a) {
            var cost = Math.max(1, +a.cost || 0);
            if (!cost) return bad('cost must be a positive number');
            State.data.rewards.push({ id: State.uid(), label: String(a.label).trim(), cost: cost, status: 'available' });
            State.save();
            return ok(t('rewards') + ' + ' + a.label);
        },
        set_timer: function (a) {
            var s = State.data.pomo.settings;
            ['work', 'short', 'long'].forEach(function (k) { if (+a[k] > 0) s[k] = Math.min(180, +a[k]); });
            if (+a.rounds > 1) s.rounds = Math.min(10, +a.rounds);
            State.save();
            return ok(t('focus_settings') + ' ✓ ' + s.work + '/' + s.short);
        },
        start_timer: function () {
            window.Dash.go('focus');
            Focus.setMode('work');
            Focus.toggle();
            return ok(t('nav_focus') + ' ▶');
        },
        open_page: function (a) {
            if (PAGES.indexOf(a.page) === -1) return bad('unknown page');
            window.Dash.go(a.page);
            return ok(t('nav_' + a.page) + ' →');
        },
        set_language: function (a) {
            if (['ar', 'en'].indexOf(a.lang) === -1) return bad('lang must be ar or en');
            I18N.setLang(a.lang);
            State.data.lang = a.lang;
            State.save();
            return ok(t('language') + ' ✓ ' + (a.lang === 'ar' ? 'العربية' : 'English'));
        },
        set_theme: function (a) {
            if (['dark', 'light'].indexOf(a.theme) === -1) return bad('theme must be dark or light');
            State.data.theme = a.theme;
            document.documentElement.setAttribute('data-theme', a.theme);
            State.save();
            return ok(t('theme') + ' ✓ ' + t(a.theme));
        },
        complete_all_homework: function () {
            var pending = State.data.homework.filter(function (h) { return !h.done; });
            if (!pending.length) return bad('nothing pending');
            // toggleHomework owns the points and re-render, so reuse it instead of duplicating.
            pending.forEach(function (h) { Planner.toggleHomework(h.id); });
            return ok(t('nav_homework') + ' ✓ ' + pending.length);
        },
        update_item: function (a) {
            var f = find(a.kind, a.subject, a.keyword);
            if (f.error) return bad(f.error);
            if (!f.hits.length) return bad('nothing matches');
            if (f.hits.length > 1) return bad('ambiguous', { matches: f.hits.map(f.spec.label) });
            var x = f.hits[0], field = a.field, val = a.value, allowed = {
                homework: { due: isDate, priority: function (v) { return ['low', 'medium', 'high'].indexOf(v) > -1; }, title: yes, subject: yes },
                exam: { date: isDate, time: isTime, subject: yes },
                class: { time: isTime, name: yes, teacher: yes, day: function (v) { return v >= 0 && v <= 6; } },
                plan: { time: isTime, activity: yes }
            };
            var chk = (allowed[a.kind] || {})[field];
            if (!chk) return bad('cannot change ' + field + ' on ' + a.kind);
            if (!chk(val)) return bad('bad value for ' + field);
            x[field] = field === 'day' ? +val : val;
            if (a.kind === 'plan') State.data.schedule.sort(function (p, q) { return p.time.localeCompare(q.time); });
            State.save();
            window.Dash.rerenderAll();
            return ok(f.spec.label(x) + ' → ' + field + ': ' + (field === 'day' ? I18N.dayName(x.day) : val));
        },
        toggle_plan_item: function (a) {
            var f = find('plan', a.subject, a.keyword);
            if (f.error) return bad(f.error);
            if (!f.hits.length) return bad('nothing matches');
            if (f.hits.length > 1) return bad('ambiguous', { matches: f.hits.map(f.spec.label) });
            Planner.toggleItem(f.hits[0].id);
            return ok(t('nav_schedule') + ' ✓ ' + f.spec.label(f.hits[0]));
        },
        clear_plan: function () {
            if (!State.data.schedule.length) return bad('plan is empty');
            var n = State.data.schedule.length;
            State.data.schedule = [];
            State.save();
            window.Dash.rerenderAll();
            return ok(t('nav_schedule') + ' ✕ ' + n);
        },
        redeem_reward: function (a) {
            var k = low(a.label);
            var hits = (State.data.rewards || []).filter(function (r) { return r.status === 'available' && (!k || low(r.label).indexOf(k) > -1); });
            if (!hits.length) return bad('no available reward matches');
            if (hits.length > 1) return bad('ambiguous', { matches: hits.map(function (r) { return r.label + ' (' + r.cost + ')'; }) });
            var pts = State.data.gam.points;
            if (pts < hits[0].cost) return bad('not enough points', { points: pts, cost: hits[0].cost });
            Game.redeem(hits[0].id);
            return ok(t('rewards') + ' ✓ ' + hits[0].label);
        },
        set_routine: function (a) {
            var keys = ['wake', 'sleep', 'schoolStart', 'schoolEnd', 'breakfast', 'lunch', 'dinner', 'exercise', 'shower'];
            var done = keys.filter(function (k) { return isTime(a[k]); });
            if (!done.length) return bad('no valid HH:MM given');
            done.forEach(function (k) { State.data.routine[k] = a[k]; });
            State.save();
            window.Dash.rerenderAll();
            return ok(t('daily_routine') + ' ✓ ' + done.map(function (k) { return k + ' ' + a[k]; }).join(', '));
        },
        set_notification: function (a) {
            if (['homework', 'exams', 'daily'].indexOf(a.kind) === -1) return bad('kind must be homework, exams or daily');
            State.data.notif[a.kind] = a.on !== false;
            State.save();
            return ok(t('notifications') + ' ✓ ' + a.kind + (State.data.notif[a.kind] ? ' on' : ' off'));
        },
        set_filter: function (a) {
            if (['all', 'pending', 'done'].indexOf(a.filter) === -1) return bad('filter must be all, pending or done');
            window.Dash.go('homework');
            Planner.setHwFilter(a.filter);
            return ok(t('nav_homework') + ' → ' + t(a.filter === 'pending' ? 'pending' : a.filter === 'done' ? 'completed' : 'all'));
        },
        parent_code: function () {
            window.Dash.parentCode();
            return ok(t('parent_code') + ' ✓ ' + State.data.parentCode);
        },
        export_data: function () { window.Dash.exportJson(); return ok(t('export_data') + ' ✓'); }
    };

    // ---------- voice ----------
    function paintMic(on) {
        ['chatMicBtn', 'voiceFab'].forEach(function (id) {
            var b = document.getElementById(id);
            if (!b) return;
            b.classList.toggle('recording', !!on);
            b.title = t(on ? 'chat_listening' : 'chat_mic');
        });
    }

    function openVoicePanel() {
        var p = document.getElementById('voicePanel');
        if (p) p.classList.add('open');
    }

    function paintSpeak() {
        ['chatSpeakBtn', 'voiceSpeakBtn'].forEach(function (id) {
            var b = document.getElementById(id);
            if (!b) return;
            b.classList.toggle('on', !!State.data.chatSpeak);
            b.title = t('chat_speak');
        });
    }

    function sayNow(text) {
        if (!('speechSynthesis' in window)) { window.Dash.toast(t('chat_mic_err'), 'error'); return; }
        var u = new SpeechSynthesisUtterance(plain(text));
        u.lang = voiceLang();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    }

    function speak(text) {
        if (!State.data.chatSpeak) return;
        sayNow(text);
    }

    function recognizer() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return null;
        if (!rec) {
            rec = new SR();
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            rec.onresult = function (ev) {
                var text = '', done = false;
                for (var i = 0; i < ev.results.length; i++) {
                    text += ev.results[i][0].transcript;
                    done = done || ev.results[i].isFinal;
                }
                heard = text.trim();
                var input = document.getElementById('chatInput');
                if (input) input.value = heard;
                render();
                if (done) {
                    heard = '';
                    if (input) input.value = '';
                    runTurn(text.trim());
                }
            };
            rec.onerror = function (ev) {
                window.Dash.toast(t('chat_mic_err') + (ev && ev.error ? ' (' + ev.error + ')' : ''), 'error');
            };
            rec.onend = function () { paintMic(false); render(); };
        }
        rec.lang = voiceLang();
        return rec;
    }

    function push(role, text) {
        var list = msgs();
        list.push({ id: State.uid(), role: role, text: text });
        if (list.length > MAX_STORED) list.splice(0, list.length - MAX_STORED);
    }

    function bubble(m, tools) {
        var esc = window.Dash.esc;
        if (m.role === 'action') {
            return '<div class="msg act"><i class="fas fa-wand-magic-sparkles"></i> ' + esc(m.text) + '</div>';
        }
        if (m.role === 'model') {
            return '<div class="turn"><div class="turn-ico"><i class="fas fa-wand-magic-sparkles"></i></div><div class="msg bot">' +
                '<div class="msg-text">' + md(m.text) + '</div>' +
                (tools ? '<div class="msg-tools">' +
                    '<button type="button" class="mt" data-say="' + m.id + '" title="' + esc(t('chat_read_this')) + '"><i class="fas fa-volume-high"></i></button>' +
                    '<button type="button" class="mt" data-copy="' + m.id + '" title="' + esc(t('chat_copy')) + '"><i class="fas fa-copy"></i></button>' +
                '</div>' : '') +
                '</div></div>';
        }
        return '<div class="msg me"><div class="msg-text">' + md(m.text) + '</div></div>';
    }

    function textOf(id) {
        var hit = msgs().filter(function (m) { return m.id === id; })[0];
        return hit ? hit.text : '';
    }

    function copyText(txt) {
        var done = function () { window.Dash.toast(t('chat_copied'), 'info'); };
        var fail = function () { window.Dash.toast(t('chat_copy_err'), 'error'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(plain(txt)).then(done, fail);
            return;
        }
        var ta = document.createElement('textarea');
        ta.value = plain(txt);
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { fail(); }
        ta.remove();
    }

    function bindTools(scope) {
        scope.querySelectorAll('[data-say]').forEach(function (b) {
            b.addEventListener('click', function () { sayNow(textOf(b.dataset.say)); });
        });
        scope.querySelectorAll('[data-copy]').forEach(function (b) {
            b.addEventListener('click', function () { copyText(textOf(b.dataset.copy)); });
        });
    }

    function renderSugs(list) {
        var box = document.getElementById('chatSugs');
        if (!box) return;
        if (list.length >= 2) { box.innerHTML = ''; box.style.display = 'none'; return; }
        var keys = ['chat_sug1', 'chat_sug2', 'chat_sug3', 'chat_sug4'];
        box.style.display = '';
        box.innerHTML = keys.map(function (k) {
            return '<button type="button" class="sug" data-sug="' + window.Dash.esc(t(k)) + '">' + window.Dash.esc(t(k)) + '</button>';
        }).join('');
        box.querySelectorAll('[data-sug]').forEach(function (b) {
            b.addEventListener('click', function () { runTurn(b.dataset.sug); });
        });
    }

    function render() {
        var list = msgs();
        var box = document.getElementById('chatThread');
        if (box) {
            var html = list.map(function (m) { return bubble(m, m.role === 'model'); }).join('');
            if (heard) html += '<div class="msg me"><div class="msg-text">' + window.Dash.esc(heard) + '</div></div>';
            if (busy) html += '<div class="turn"><div class="turn-ico"><i class="fas fa-wand-magic-sparkles"></i></div><div class="msg bot"><div class="msg-text"><p class="thinking">' + window.Dash.esc(t('chat_thinking')) + '</p></div></div></div>';
            if (!list.length && !busy && !heard) {
                html = '<div class="empty-state"><i class="fas fa-robot"></i>' + window.Dash.esc(t('chat_empty')) + '</div>';
            }
            box.innerHTML = html;
            bindTools(box);
            box.scrollTop = box.scrollHeight;
        }
        var log = document.getElementById('voiceLog');
        if (log) {
            var tail = list.slice(-3).map(function (m) { return bubble(m); }).join('');
            if (!tail && !heard) tail = '<div class="msg bot"><div class="msg-text">' + window.Dash.esc(t('chat_voice_hint')) + '</div></div>';
            log.innerHTML = (heard ? '<div class="msg me"><div class="msg-text">' + window.Dash.esc(heard) + '</div></div>' : '')
                + tail
                + (busy ? '<div class="msg bot"><div class="msg-text"><p class="thinking">' + window.Dash.esc(t('chat_thinking')) + '</p></div></div>' : '');
            log.scrollTop = log.scrollHeight;
        }
        renderSugs(list);
        var send = document.getElementById('chatSendBtn');
        if (send) send.disabled = busy;
        paintSpeak();
        var supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        ['chatMicBtn', 'voiceFab'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = supported ? '' : 'none';
        });
    }

    function exec(name, args) {
        var h = HANDLERS[name];
        return h ? h(args || {}) : bad('no such tool ' + name);
    }

    function runTurn(text) {
        text = (text || '').trim();
        if (!text || busy) return;
        push('user', text.slice(0, 800));
        State.save();
        busy = true;
        render();

        // Small delay so the "thinking" bubble is visible; the reply never leaves the device.
        setTimeout(function () {
            var res = window.Brain ? window.Brain.answer(text) : { text: t('chat_err'), actions: [] };
            finish(res);
        }, 240);
    }

    function finish(res) {
        if (res.actions && res.actions.length) {
            push('action', res.actions.join('  •  '));
            State.save();
            window.Dash.rerenderAll();
        }
        if (res.text) { push('model', res.text.slice(0, 2000)); State.save(); speak(res.text.slice(0, 2000)); }
        busy = false;
        render();
    }

    window.Chat = {
        render: render,
        exec: exec,
        ask: runTurn,

        mic: function () {
            var r = recognizer();
            if (!r) { window.Dash.toast(t('chat_mic_err'), 'error'); return; }
            if (busy) { openVoicePanel(); return; }
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            if (!State.data.chatSpeak) { State.data.chatSpeak = true; State.save(); }
            openVoicePanel();
            try {
                r.start();
                paintMic(true);
            } catch (e) {
                r.stop();
            }
        },

        toggleSpeak: function () {
            if (!('speechSynthesis' in window)) { window.Dash.toast(t('chat_mic_err'), 'error'); return; }
            State.data.chatSpeak = !State.data.chatSpeak;
            State.save();
            paintSpeak();
            if (State.data.chatSpeak) {
                speak(I18N.lang === 'ar' ? 'أنا أقرأ الردود بصوتي.' : 'I will read the replies aloud.');
            } else {
                window.speechSynthesis.cancel();
            }
        },

        togglePanel: function (force) {
            var p = document.getElementById('voicePanel');
            if (!p) return;
            var open = force === undefined ? !p.classList.contains('open') : force;
            p.classList.toggle('open', open);
        },

        send: function (e) {
            if (e) e.preventDefault();
            var input = document.getElementById('chatInput');
            var text = (input.value || '').trim();
            if (!text) return;
            input.value = '';
            runTurn(text);
        },

        clear: function () {
            State.data.chat = [];
            State.save();
            render();
            window.Dash.toast(t('chat_cleared'), 'info');
        }
    };
})();
