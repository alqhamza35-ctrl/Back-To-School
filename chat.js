// Back to School — study assistant chat (Gemini) with real actions on the planner
// History lives in State.data.chat; every mutation goes through the app's own modules.
(function () {
    'use strict';

    var MAX_STORED = 60;
    var MAX_SENT = 12;
    var busy = false;
    var rec = null;
    var heard = '';

    function t(k) { return window.I18N ? window.I18N.t(k) : k; }
    function cfg() { return window.BtsAI || {}; }
    function voiceLang() { return I18N.lang === 'ar' ? (cfg().arVoice || 'ar-SA') : (cfg().enVoice || 'en-US'); }
    function msgs() {
        if (!Array.isArray(State.data.chat)) State.data.chat = [];
        return State.data.chat;
    }
    function low(v) { return String(v == null ? '' : v).toLowerCase().trim(); }
    function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
    function isTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }
    function ok(action, extra) {
        return Object.assign({ ok: true, action: action }, extra || {});
    }
    function bad(error, extra) {
        return Object.assign({ ok: false, error: error }, extra || {});
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

    // ---------- tools ----------
    var TOOLS = [
        { name: 'add_homework', description: 'Add a homework task', parameters: { type: 'OBJECT', properties: {
            subject: { type: 'STRING' }, title: { type: 'STRING' },
            due: { type: 'STRING', description: 'YYYY-MM-DD' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high'] } }, required: ['subject', 'title', 'due'] } },
        { name: 'finish_homework', description: 'Mark one pending homework as done', parameters: { type: 'OBJECT', properties: {
            subject: { type: 'STRING' }, keyword: { type: 'STRING', description: 'part of the homework title' } }, required: ['subject'] } },
        { name: 'add_class', description: 'Add a weekly class', parameters: { type: 'OBJECT', properties: {
            name: { type: 'STRING' }, teacher: { type: 'STRING' },
            day: { type: 'INTEGER', description: '0=Sunday .. 6=Saturday' }, time: { type: 'STRING', description: 'HH:MM' } },
            required: ['name', 'day', 'time'] } },
        { name: 'add_exam', description: 'Add an exam date', parameters: { type: 'OBJECT', properties: {
            subject: { type: 'STRING' }, date: { type: 'STRING', description: 'YYYY-MM-DD' }, time: { type: 'STRING' } },
            required: ['subject', 'date'] } },
        { name: 'add_quiz', description: 'Add a multiple choice quiz question', parameters: { type: 'OBJECT', properties: {
            subject: { type: 'STRING' }, question: { type: 'STRING' },
            options: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 to 4 options' },
            correct: { type: 'INTEGER', description: 'index of the right option, starting at 0' } },
            required: ['subject', 'question', 'options', 'correct'] } },
        { name: 'add_plan_item', description: 'Add one item to today schedule', parameters: { type: 'OBJECT', properties: {
            time: { type: 'STRING', description: 'HH:MM' }, activity: { type: 'STRING' } }, required: ['time', 'activity'] } },
        { name: 'plan_day', description: 'Rebuild today schedule from routine, classes and pending homework' },
        { name: 'remove_item', description: 'Delete one homework, class, exam, quiz or schedule item', parameters: { type: 'OBJECT', properties: {
            kind: { type: 'STRING', enum: ['homework', 'class', 'exam', 'quiz', 'plan'] },
            subject: { type: 'STRING' }, keyword: { type: 'STRING' } }, required: ['kind'] } },
        { name: 'add_wish', description: 'Add a reward the student can redeem with points', parameters: { type: 'OBJECT', properties: {
            label: { type: 'STRING' }, cost: { type: 'INTEGER' } }, required: ['label', 'cost'] } },
        { name: 'set_timer', description: 'Change study timer lengths in minutes', parameters: { type: 'OBJECT', properties: {
            work: { type: 'INTEGER' }, short: { type: 'INTEGER' }, long: { type: 'INTEGER' }, rounds: { type: 'INTEGER' } } } },
        { name: 'start_timer', description: 'Open the study timer page and start a focus session' },
        { name: 'open_page', description: 'Navigate the app to a page', parameters: { type: 'OBJECT', properties: {
            page: { type: 'STRING', enum: ['overview', 'classes', 'homework', 'exams', 'quiz', 'schedule', 'calendar', 'focus', 'assistant', 'achievements', 'parent', 'settings'] } },
            required: ['page'] } },
        { name: 'set_language', description: 'Switch the app language', parameters: { type: 'OBJECT', properties: {
            lang: { type: 'STRING', enum: ['ar', 'en'] } }, required: ['lang'] } },
        { name: 'set_theme', description: 'Switch the app theme', parameters: { type: 'OBJECT', properties: {
            theme: { type: 'STRING', enum: ['dark', 'light'] } }, required: ['theme'] } }
    ];

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
        }
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

    function speak(text) {
        if (!('speechSynthesis' in window) || !State.data.chatSpeak || !text) return;
        var u = new SpeechSynthesisUtterance(text);
        u.lang = voiceLang();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
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

    // ---------- prompt ----------
    function systemText() {
        return [
            'You are the study assistant inside a student planner app. You can act, not just talk.',
            '- Use the tools whenever the student asks you to add, finish, delete or change something.',
            '- Never claim you did something unless a tool returned ok:true. Report tool errors honestly.',
            '- If a tool answers ambiguous with a matches list, ask the student which one.',
            '- When you open a page for the student, stay there — never navigate back to the assistant page.',
            '- Answers are often read aloud: keep them under 3 short sentences, no lists of more than 3 items.',
            '- Today is ' + new Date().toISOString().slice(0, 10) + '. Convert words like tomorrow or Sunday into real dates before calling tools.',
            '- Answer in the language the student writes in.',
            '- Plain text only: no markdown, no ** or # or backticks.',
            '- Student data:'
        ].join('\n') + '\n' + AI.context();
    }

    function contents() {
        return msgs().filter(function (m) { return m.role === 'user' || m.role === 'model'; })
            .slice(-MAX_SENT)
            .map(function (m) {
                return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] };
            });
    }

    function push(role, text) {
        var list = msgs();
        list.push({ id: State.uid(), role: role, text: text });
        if (list.length > MAX_STORED) list.splice(0, list.length - MAX_STORED);
    }

    function bubble(m) {
        var cls = m.role === 'model' ? 'bot' : m.role === 'action' ? 'act' : 'me';
        return '<div class="msg ' + cls + '">' + window.Dash.esc(m.text) + '</div>';
    }

    function render() {
        var list = msgs();
        var box = document.getElementById('chatThread');
        if (box) {
            var html = list.map(bubble).join('');
            if (heard) html += '<div class="msg me">' + window.Dash.esc(heard) + '</div>';
            if (busy) html += '<div class="msg bot thinking">' + window.Dash.esc(t('chat_thinking')) + '</div>';
            if (!list.length && !busy && !heard) {
                html = '<div class="empty-state"><i class="fas fa-robot"></i>' + window.Dash.esc(t('chat_empty')) + '</div>';
            }
            box.innerHTML = html;
            box.scrollTop = box.scrollHeight;
        }
        var log = document.getElementById('voiceLog');
        if (log) {
            var tail = list.slice(-3).map(bubble).join('');
            if (!tail && !heard) tail = '<div class="msg bot">' + window.Dash.esc(t('chat_voice_hint')) + '</div>';
            log.innerHTML = (heard ? '<div class="msg me">' + window.Dash.esc(heard) + '</div>' : '')
                + tail
                + (busy ? '<div class="msg bot thinking">' + window.Dash.esc(t('chat_thinking')) + '</div>' : '');
            log.scrollTop = log.scrollHeight;
        }
        var send = document.getElementById('chatSendBtn');
        if (send) send.disabled = busy;
        paintSpeak();
        var supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        ['chatMicBtn', 'voiceFab'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = supported ? '' : 'none';
        });
    }

    function runTurn(text) {
        text = (text || '').trim();
        if (!text || busy) return;
        if (!window.AI.ready()) { window.Dash.toast(t('ai_no_key'), 'error'); return; }
        push('user', text.slice(0, 800));
        State.save();
        busy = true;
        render();

        AI.turn(systemText(), contents(), TOOLS, function (name, args) {
            var h = HANDLERS[name];
            return h ? h(args) : bad('no such tool ' + name);
        }).then(function (res) {
            if (res.actions.length) {
                push('action', res.actions.join('  •  '));
                State.save();
                window.Dash.rerenderAll();
            }
            if (res.text) { push('model', res.text.slice(0, 2000)); State.save(); speak(res.text.slice(0, 2000)); }
        }).catch(function (err) {
            var why = window.AI.isKeyError(err) ? t('ai_key_bad') : t('chat_err') + ' (' + (err && err.message ? err.message : '?') + ')';
            window.Dash.toast(why, 'error');
        }).then(function () {
            busy = false;
            render();
        });
    }

    window.Chat = {
        render: render,
        tools: TOOLS,
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
