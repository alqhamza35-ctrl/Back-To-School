// Back to School — online assistant: Gemini drives the app's own action handlers.
// Talks only to the same-origin proxy in server.js; no API key lives in the browser.
// When server.js is not running the proxy reports no key and chat.js falls back to brain.js.
(function () {
    'use strict';

    var healthOk = null;
    var TIMEOUT = 25000;
    var MAX_ROUNDS = 4;

    var PAGES = ['overview', 'classes', 'homework', 'exams', 'quiz', 'schedule', 'calendar',
        'focus', 'assistant', 'achievements', 'parent', 'settings'];
    var KINDS = ['homework', 'exam', 'class', 'plan'];

    // Every entry maps 1:1 onto a handler already in chat.js — the model can only call these.
    var TOOLS = [
        { name: 'add_homework', d: 'Add a homework task', r: ['subject', 'title', 'due'], p: {
            subject: ['STRING', 'School subject, in the student language'],
            title: ['STRING', 'Short description of the task'],
            due: ['STRING', 'Due date YYYY-MM-DD'],
            priority: ['STRING', 'low, medium or high', ['low', 'medium', 'high']] } },
        { name: 'finish_homework', d: 'Mark one matching homework as done', r: ['subject'], p: {
            subject: ['STRING', 'Subject of the homework'], keyword: ['STRING', 'Word from its description'] } },
        { name: 'complete_all_homework', d: 'Mark every pending homework as done', r: [], p: {} },
        { name: 'add_class', d: 'Add a weekly school class', r: ['name', 'day', 'time'], p: {
            name: ['STRING', 'Subject name'], teacher: ['STRING', 'Teacher name'],
            day: ['INTEGER', '0=Sunday, 1=Monday … 6=Saturday'], time: ['STRING', 'Start time HH:MM'] } },
        { name: 'add_exam', d: 'Add an exam', r: ['subject', 'date'], p: {
            subject: ['STRING', 'Subject'], date: ['STRING', 'Exam date YYYY-MM-DD'], time: ['STRING', 'HH:MM'] } },
        { name: 'add_quiz', d: 'Add a quick revision quiz question', r: ['subject', 'question', 'options', 'correct'], p: {
            subject: ['STRING', 'Subject'], question: ['STRING', 'Question text'],
            options: ['ARRAY', '2 to 4 answer choices', 'STRING'], correct: ['INTEGER', 'Zero-based index of the right answer'] } },
        { name: 'add_plan_item', d: 'Add one item to today plan', r: ['time', 'activity'], p: {
            time: ['STRING', 'HH:MM'], activity: ['STRING', 'What to do'] } },
        { name: 'plan_day', d: 'Auto-build today plan from classes, homework and routine', r: [], p: {} },
        { name: 'clear_plan', d: 'Delete every item of today plan', r: [], p: {} },
        { name: 'toggle_plan_item', d: 'Tick or untick one plan item', r: [], p: {
            subject: ['STRING', 'Unused'], keyword: ['STRING', 'Word from the activity'] } },
        { name: 'remove_item', d: 'Delete one homework, exam, class or plan item', r: ['kind'], p: {
            kind: ['STRING', 'What to delete', KINDS], subject: ['STRING', 'Subject'], keyword: ['STRING', 'Word from its text'] } },
        { name: 'update_item', d: 'Change one field of an existing item', r: ['kind', 'field', 'value'], p: {
            kind: ['STRING', 'Item type', KINDS],
            field: ['STRING', 'due, priority, title, subject, date, time, name, teacher, day or activity'],
            value: ['STRING', 'New value'], subject: ['STRING', 'Subject'], keyword: ['STRING', 'Word from its text'] } },
        { name: 'add_wish', d: 'Add a reward the student can buy with points', r: ['label', 'cost'], p: {
            label: ['STRING', 'Reward name'], cost: ['INTEGER', 'Points price'] } },
        { name: 'redeem_reward', d: 'Redeem a reward with points', r: [], p: { label: ['STRING', 'Word from the reward name'] } },
        { name: 'set_timer', d: 'Change study timer lengths', r: [], p: {
            work: ['INTEGER', 'Minutes of focus'], short: ['INTEGER', 'Short break minutes'],
            long: ['INTEGER', 'Long break minutes'], rounds: ['INTEGER', 'Rounds before the long break'] } },
        { name: 'start_timer', d: 'Open the timer page and start a focus session', r: [], p: {} },
        { name: 'open_page', d: 'Navigate the app to a page', r: ['page'], p: { page: ['STRING', 'Page to open', PAGES] } },
        { name: 'set_filter', d: 'Filter the homework list', r: ['filter'], p: { filter: ['STRING', 'Which tasks', ['all', 'pending', 'done']] } },
        { name: 'set_language', d: 'Switch the app language', r: ['lang'], p: { lang: ['STRING', 'Language', ['ar', 'en']] } },
        { name: 'set_theme', d: 'Switch the app appearance', r: ['theme'], p: { theme: ['STRING', 'Theme', ['dark', 'light']] } },
        { name: 'set_routine', d: 'Set daily routine times', r: [], p: {
            wake: ['STRING', 'HH:MM'], sleep: ['STRING', 'HH:MM'], schoolStart: ['STRING', 'HH:MM'],
            schoolEnd: ['STRING', 'HH:MM'], breakfast: ['STRING', 'HH:MM'], lunch: ['STRING', 'HH:MM'],
            dinner: ['STRING', 'HH:MM'], exercise: ['STRING', 'HH:MM'], shower: ['STRING', 'HH:MM'] } },
        { name: 'set_notification', d: 'Turn a reminder on or off', r: ['kind'], p: {
            kind: ['STRING', 'Which reminder', ['homework', 'exams', 'daily']], on: ['BOOLEAN', 'True to enable'] } },
        { name: 'parent_code', d: 'Show or create the parent tracking code', r: [], p: {} },
        { name: 'export_data', d: 'Download the student data as JSON', r: [], p: {} }
    ];

    function lang() { return (window.I18N && I18N.lang) || (window.State && State.data && State.data.lang) || 'ar'; }

    function health() {
        // Only a good probe is cached: starting server.js later must switch the chat back to Gemini
        // without a page reload.
        if (healthOk) return Promise.resolve(healthOk);
        return fetch('/api/health', { method: 'GET' })
            .then(function (r) { return r.ok ? r.json() : { ok: false, ai: false }; })
            .then(function (h) { if (h && h.ai) healthOk = h; return h; })
            .catch(function () { return { ok: false, ai: false }; });
    }

    function list(items) { return items.length ? items.join(', ') : 'none'; }

    function contextText() {
        var d = window.State && State.data;
        if (!d) return 'No planner data available.';
        var todayIso = new Date().toISOString().slice(0, 10);
        var out = [];
        out.push('Today: ' + todayIso + ', weekday ' + new Date().getDay() + ' (0=Sunday). Language: ' + (lang() === 'ar' ? 'Arabic' : 'English') + '.');
        var rt = d.routine || {};
        out.push('Daily routine: wake ' + rt.wake + ', breakfast ' + rt.breakfast + ', school ' + rt.schoolStart + '-' + rt.schoolEnd +
            ', lunch ' + rt.lunch + ', exercise ' + rt.exercise + ', dinner ' + rt.dinner + ', sleep ' + rt.sleep + '.');
        var g = d.gam || {};
        out.push('Points: ' + (g.points || 0) + ', level: ' + (g.level || 1) + ', streak: ' + (g.streak || 0) + ' days.');
        var cls = (d.classes || []).slice(0, 12).map(function (c) { return c.name + ' (' + c.day + ' ' + (c.time || '') + ')'; });
        out.push('Classes: ' + list(cls));
        var hw = (d.homework || []).filter(function (h) { return !h.done; }).slice(0, 12)
            .map(function (h) { return h.subject + ' — ' + h.title + ' (due ' + h.due + (h.due < todayIso ? ', LATE' : '') + ')'; });
        out.push('Open homework: ' + list(hw));
        var ex = (d.exams || []).filter(function (e) { return e.date >= todayIso; }).slice(0, 8)
            .map(function (e) { return e.subject + ' on ' + e.date; });
        out.push('Upcoming exams: ' + list(ex));
        var plan = (d.schedule || []).slice(0, 10).map(function (p) {
            return p.time + ' ' + p.activity + (p.done ? ' (done)' : '');
        });
        out.push('Day plan (' + (d.scheduleDay || todayIso) + '): ' + list(plan));
        var rw = (d.rewards || []).filter(function (r) { return r.status === 'available'; }).slice(0, 8)
            .map(function (r) { return r.label + ' (' + r.cost + ' points)'; });
        out.push('Rewards: ' + list(rw));
        var st = (d.pomo && d.pomo.stats) || {};
        out.push('Focus today: ' + (st.sessions || 0) + ' sessions, ' + (st.minutes || 0) + ' minutes.');
        return out.join('\n');
    }

    function historyText() {
        var list2 = (window.State && State.data && State.data.chat) || [];
        var last = list2.slice(-6).filter(function (m) {
            return (m.role === 'user' || m.role === 'model') && m.text;
        });
        if (!last.length) return '';
        return 'Recent conversation:\n' + last.map(function (m) {
            return (m.role === 'user' ? 'Student: ' : 'Assistant: ') + String(m.text).slice(0, 300);
        }).join('\n');
    }

    function systemPrompt() {
        return [
            'You are the assistant inside "Back to School", a student planner app, and you can change the app',
            'through the listed tools: add or edit homework, classes, exams, quizzes, plan items and rewards,',
            'open pages, start the timer, switch language, theme and reminders.',
            'When the student asks for something a tool can do, call the tool instead of describing the steps.',
            'Questions about their own points, homework, exams or plan are already answered by the context below:',
            'reply from it directly and call no tool unless the student asks for a change or an action.',
            'For «تنظيم اليوم» / "plan my day" rebuild the whole plan: clear_plan, then add_plan_item for every',
            'block — wake and sleep, school hours, today\'s classes, any exam scheduled today, the homework due',
            'soonest, meals and short breaks — ordered HH:MM, 8 to 14 items, no overlap.',
            'Convert relative dates ("tomorrow", "الخميس الجاي") into YYYY-MM-DD using today\'s date.',
            'If a required value is missing or ambiguous, ask one short question instead of guessing.',
            'After tool results come back, confirm what changed in 1-3 short lines in the student language.',
            'Use **bold** for names and "- " bullets. No tables, no headings, no emojis.',
            'Never invent data that is not in the context.',
            '',
            'Student context:',
            contextText(),
            '',
            historyText()
        ].join('\n');
    }

    function declarations() {
        return TOOLS.map(function (tool) {
            var props = {}, required = tool.r || [];
            Object.keys(tool.p).forEach(function (key) {
                var spec = tool.p[key];
                var schema = { type: spec[0], description: spec[1] };
                if (spec[0] === 'ARRAY') {
                    schema.items = { type: spec[2] || 'STRING' };
                } else if (Array.isArray(spec[2])) {
                    schema.enum = spec[2];
                }
                props[key] = schema;
            });
            return {
                name: tool.name,
                description: tool.d + '. ' + Object.keys(tool.p).map(function (k) {
                    return k + (required.indexOf(k) > -1 ? ' (required)' : '');
                }).join(', '),
                parameters: { type: 'OBJECT', properties: props, required: required }
            };
        });
    }

    function post(payload, signal) {
        return fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: signal
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, json: j }; });
        });
    }

    function callModel(contents) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT) : null;
        return post({
            system: systemPrompt(),
            contents: contents,
            tools: declarations()
        }, controller && controller.signal).then(function (res) {
            if (timer) clearTimeout(timer);
            var j = res && res.json;
            if (!j || !j.ok) {
                return { ok: false, reason: (j && j.error) || ('http_' + (res && res.status)) };
            }
            return {
                ok: true,
                text: j.text || '',
                calls: (j.parts || []).filter(function (p) { return p.functionCall; })
                    .map(function (p) {
                        return { name: p.functionCall.name, args: p.functionCall.args || {}, sig: p.thoughtSignature };
                    })
            };
        }).catch(function (e) {
            if (timer) clearTimeout(timer);
            return { ok: false, reason: e && e.name === 'AbortError' ? 'timeout' : 'network' };
        });
    }

    function keep(out) {
        var r = { ok: !!(out && out.ok) };
        if (out && out.error) r.error = String(out.error).slice(0, 120);
        if (out && out.action) r.action = String(out.action).slice(0, 160);
        if (out && typeof out.points === 'number') r.points = out.points;
        if (out && typeof out.cost === 'number') r.cost = out.cost;
        if (out && Array.isArray(out.matches)) r.matches = out.matches.slice(0, 6).map(function (m) { return String(m).slice(0, 80); });
        return r;
    }

    // exec(name, args) is chat.js Chat.exec — the same handlers brain.js uses, so the app stays in charge.
    // hint tells the model what the offline parser already tried, so it does not repeat the mistake.
    function run(text, exec, hint) {
        return health().then(function (h) {
            if (!h || !h.ai) return { ok: false, reason: 'disabled' };
            var message = String(text || '').slice(0, 1500);
            if (hint) message += '\n(Offline note: ' + String(hint).slice(0, 200) + '. Try a different reading of the request, or ask for what is genuinely missing.)';
            var contents = [{ role: 'user', parts: [{ text: message }] }];
            var actions = [];
            var rounds = 0;

            function step() {
                return callModel(contents).then(function (res) {
                    if (!res.ok) return res;
                    rounds++;
                    if (!res.calls.length || rounds >= MAX_ROUNDS) {
                        return { ok: true, text: res.text, actions: actions };
                    }
                    contents.push({
                        role: 'model',
                        parts: res.calls.map(function (c) {
                            var part = { functionCall: { name: c.name, args: c.args } };
                            // The model refuses the follow-up turn without its own signature echoed back.
                            if (c.sig) part.thoughtSignature = c.sig;
                            return part;
                        })
                    });
                    res.calls.forEach(function (c) {
                        var out;
                        try { out = exec(c.name, c.args); } catch (e) { out = { ok: false, error: 'handler failed' }; }
                        out = out || { ok: false, error: 'no result' };
                        if (out.ok && out.action) actions.push(out.action);
                        contents.push({
                            role: 'user',
                            parts: [{ functionResponse: { name: c.name, response: keep(out) } }]
                        });
                    });
                    return step();
                });
            }
            return step();
        });
    }

    window.BtsAI = { run: run };
})();
