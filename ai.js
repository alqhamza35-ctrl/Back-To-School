// Back to School — Gemini access layer + day planner ("تنظيم اليوم")
// Reads the key from ai-config.js (git-ignored); AI.ask() is shared with chat.js.
(function () {
    'use strict';

    var BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
    var TIMEOUT_MS = 12000;
    var MAX_STEPS = 4;
    var busy = false;

    var INSTRUCTIONS = [
        'You plan one school-student study day. Rules:',
        '- Everything sits between the wake time and the sleep time, in 24h HH:MM.',
        '- Keep today\'s class times exactly as given; never schedule anything else during them.',
        '- One block per pending homework (30-60 min), closest due date and highest priority first, outside school hours.',
        '- Add revision blocks for exams happening within the next 3 days.',
        '- Keep breakfast, lunch, exercise, dinner and shower from the routine.',
        '- Add short breaks between study blocks. 10 to 16 items, unique times, sorted ascending.',
        'Reply with ONLY a JSON array such as [{"time":"16:30","activity":"..."}]. No markdown, no other keys.'
    ].join('\n');

    function models() {
        var c = cfg();
        if (Array.isArray(c.models) && c.models.length) return c.models;
        return [c.model || 'gemini-flash-latest', 'gemini-flash-lite-latest'];
    }

    function t(k) { return window.I18N ? window.I18N.t(k) : k; }
    function cfg() { return window.BtsAI || {}; }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function isTime(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }

    function contextText() {
        var r = State.data.routine;
        var day = new Date().getDay();
        var out = [];
        out.push('Write activity text in ' + (I18N.lang === 'ar' ? 'Arabic' : 'English') + '.');
        out.push('Date: ' + todayStr() + ' (weekday index ' + day + ', 0=Sunday).');
        out.push('Routine: wake ' + r.wake + ', breakfast ' + r.breakfast + ', school ' + r.schoolStart +
            '-' + r.schoolEnd + ', lunch ' + r.lunch + ', exercise ' + r.exercise + ', dinner ' + r.dinner +
            ', shower ' + r.shower + ', sleep ' + r.sleep + '.');
        var cl = State.data.classes.filter(function (c) { return c.day === day; });
        out.push('Classes today: ' + (cl.length
            ? cl.map(function (c) { return c.time + ' ' + c.name; }).join('; ')
            : 'none'));
        var hw = State.data.homework.filter(function (h) { return !h.done; });
        out.push('Pending homework: ' + (hw.length
            ? hw.map(function (h) { return h.subject + ' — ' + h.title + ' (due ' + h.due + ', priority ' + h.priority + ')'; }).join('; ')
            : 'none'));
        var ex = State.data.exams.filter(function (x) { return x.date >= todayStr(); })
            .sort(function (a, b) { return a.date.localeCompare(b.date); });
        out.push('Upcoming exams: ' + (ex.length
            ? ex.map(function (x) { return x.subject + ' on ' + x.date + ' at ' + x.time; }).join('; ')
            : 'none'));
        out.push('Preferred study block length: ' + State.data.pomo.settings.work + ' minutes.');
        return out.join('\n');
    }

    function parse(text) {
        var raw = (text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        var data = JSON.parse(raw);
        if (!Array.isArray(data) && Array.isArray(data.items)) data = data.items;
        if (!Array.isArray(data)) return [];
        var seen = {};
        return data.filter(function (x) {
            if (!x || !isTime(x.time) || typeof x.activity !== 'string') return false;
            x.activity = x.activity.trim();
            if (!x.activity || seen[x.time]) return false;
            seen[x.time] = true;
            return true;
        }).slice(0, 16).map(function (x) {
            return { id: State.uid(), time: x.time, activity: x.activity.slice(0, 120), done: false };
        }).sort(function (a, b) { return a.time.localeCompare(b.time); });
    }

    function callApi(model, payload) {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
        return fetch(BASE + model + ':generateContent?key=' + encodeURIComponent(cfg().apiKey || ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctrl.signal,
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.text().then(function (txt) {
                if (!res.ok) {
                    var err = new Error('gemini ' + res.status);
                    err.status = res.status;
                    err.keyBad = res.status === 401 || res.status === 403;
                    err.retryable = !err.keyBad && (res.status === 404 || res.status === 429 || res.status >= 500);
                    throw err;
                }
                var json = JSON.parse(txt);
                var cand = (json.candidates || [])[0] || {};
                if (!cand.content || !Array.isArray(cand.content.parts)) cand.content = { parts: [] };
                return cand;
            });
        }).finally(function () { clearTimeout(timer); });
    }

    function body(systemText, contents, jsonMode, tools) {
        return {
            systemInstruction: { parts: [{ text: systemText }] },
            contents: contents,
            generationConfig: Object.assign(
                { temperature: 0.4, maxOutputTokens: 2048 },
                jsonMode ? { responseMimeType: 'application/json' } : {}
            ),
            tools: tools ? [{ functionDeclarations: tools }] : undefined
        };
    }

    // Served models get retired (2.5-flash) and overload temporarily (503/hangs), so walk the list.
    function send(bdy) {
        var list = models();
        function attempt(i) {
            return callApi(list[i], bdy).catch(function (err) {
                if (err && (err.retryable || err.name === 'AbortError') && i + 1 < list.length) return attempt(i + 1);
                throw err;
            });
        }
        return attempt(0);
    }

    function textOf(cand) {
        return cand.content.parts.filter(function (p) { return p.text; })
            .map(function (p) { return p.text; }).join('');
    }

    function failDetail(err) {
        return err && err.name === 'AbortError' ? 'timeout' : (err && err.message ? err.message : '');
    }

    window.AI = {
        ready: function () { return !!(cfg().apiKey); },
        context: contextText,
        isKeyError: function (err) { return !!(err && err.keyBad); },

        ask: function (systemText, contents) {
            return send(body(systemText, contents, false)).then(textOf);
        },

        // Agentic turn: runs function calls through exec() and keeps talking until the model answers.
        turn: function (systemText, contents, tools, exec) {
            var log = [];
            var history = contents.slice();
            var step = 0;

            function loop() {
                return send(body(systemText, history, false, tools)).then(function (cand) {
                    var calls = cand.content.parts.filter(function (p) { return p.functionCall; })
                        .map(function (p) { return p.functionCall; });
                    if (!calls.length || step >= MAX_STEPS) return textOf(cand);
                    step++;
                    history.push({ role: 'model', parts: cand.content.parts });
                    history.push({
                        role: 'user',
                        parts: calls.map(function (c) {
                            var result;
                            try {
                                result = exec(c.name, c.args || {});
                            } catch (e) {
                                result = { ok: false, error: String((e && e.message) || e) };
                            }
                            result = result || { ok: false, error: 'no result' };
                            if (result.action) log.push(result.action);
                            return { functionResponse: { name: c.name, response: result } };
                        })
                    });
                    return loop();
                });
            }
            return loop().then(function (text) { return { text: (text || '').trim(), actions: log }; });
        },

        plan: function (btn) {
            if (busy) return;
            if (!window.AI.ready()) {
                window.Dash.toast(t('ai_no_key'), 'error');
                return;
            }
            busy = true;
            var label = btn ? btn.querySelector('span') : null;
            var old = label ? label.textContent : '';
            if (btn) btn.disabled = true;
            if (label) label.textContent = t('ai_loading');

            send(body(INSTRUCTIONS, [{ role: 'user', parts: [{ text: contextText() }] }], true)).then(function (cand) {
                var items = parse(textOf(cand));
                if (!items.length) throw new Error('empty plan');
                State.data.schedule = items;
                State.data.scheduleDay = todayStr();
                State.save();
                Planner.renderSchedule();
                Planner.renderOverview();
                window.Dash.toast(t('ai_done'), 'success');
            }).catch(function (err) {
                window.Dash.toast(window.AI.isKeyError(err) ? t('ai_key_bad') : t('ai_err') + ' (' + failDetail(err) + ')', 'error');
            }).then(function () {
                busy = false;
                if (btn) btn.disabled = false;
                if (label) label.textContent = old;
            });
        }
    };
})();
