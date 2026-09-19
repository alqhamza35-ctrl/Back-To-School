// Back to School — offline assistant brain.
// Understands Arabic/English commands locally (no network, no API key) and runs them
// through the same actions the cloud assistant uses, which live in chat.js (Chat.exec).
(function () {
    'use strict';

    function t(k) { return window.I18N.t(k); }
    function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
    function today() { return new Date().toISOString().slice(0, 10); }

    var Q = '';
    var RAW = '';

    // ---------- text normalisation ----------
    function norm(s) {
        return String(s == null ? '' : s)
            .replace(/[ًٌٍَُِّْـ]/g, '')
            .replace(/[إأآٱ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/ئ/g, 'ي').replace(/ؤ/g, 'و')
            .replace(/ة/g, 'ه')
            .replace(/[\u200e\u200f]/g, '')
            .replace(/[؟?!,.:;'"«»()\[\]#*_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim().toLowerCase();
    }
    function has() {
        for (var i = 0; i < arguments.length; i++) {
            if (Q.indexOf(norm(arguments[i])) > -1) return true;
        }
        return false;
    }
    // Substring matching alone is dangerous for short Arabic verbs: «تم» lives inside «تمرين».
    // Words of 3+ letters must start a token; shorter ones must be the whole token.
    function isLetter(c) { return /[a-z\u0600-\u06FF]/.test(c); }
    function hasW() {
        for (var k = 0; k < arguments.length; k++) {
            var w = norm(arguments[k]);
            if (!w) continue;
            var i = Q.indexOf(w);
            while (i > -1) {
                var before = i === 0 ? '' : Q.charAt(i - 1);
                var after = Q.charAt(i + w.length);
                if (!isLetter(before) && (w.length > 2 || after === '' || !isLetter(after))) return true;
                i = Q.indexOf(w, i + 1);
            }
        }
        return false;
    }
    function cutFrom(str, words) {
        var out = ' ' + str + ' ';
        words.forEach(function (w) {
            var n = norm(w);
            if (!n) return;
            while (out.indexOf(' ' + n + ' ') > -1) out = out.replace(' ' + n + ' ', ' ');
        });
        return out.replace(/\s+/g, ' ').trim();
    }
    // \b does not work on Arabic, so words are cut as whole space-delimited tokens.
    function cut(words) { return cutFrom(Q, words); }
    var DATE_WORDS = ['اليوم', 'غدا', 'بكره', 'بعد غد', 'بعد يومين', 'يوم', 'الاسبوع الجاي', 'today', 'tomorrow', 'next week',
        'am', 'pm', 'a.m', 'p.m', 'صباحا', 'صباح', 'مساءا', 'مساء', 'ليلا', 'ظهرا', 'فجرا', 'الساعه', 'ساعه', 'at'];
    var DAYPART = 'صباحا|صباح|مساءا|مساء|مسا|ليلا|ليل|ظهرا|ظهر|فجرا|فجر|am|pm';
    function stripWhen(body) {
        var out = body
            .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
            .replace(/\d{1,2}[\/-]\d{1,2}([\/-]\d{4})?/g, ' ')
            .replace(/\d{1,2}:\d{2}\s*(' + DAYPART + ')?/g, ' ')
            .replace(/(?:الساع[هة]|ساع[هة]|at)\s*\d{1,2}(\s*(?:و|and)\s*\d{2})?\s*(' + DAYPART + ')?/g, ' ')
            .replace(/\d{1,2}\s*(' + DAYPART + ')/g, ' ')
            .replace(/بعد\s+\S+(\s+(يوم|ايام|ساعه|اسبوع|اسابيع|days?|hours?|weeks?))?/g, ' ');
        out = cutFrom(out, DATE_WORDS);
        for (var i = 0; i < 7; i++) out = cutFrom(out, [DAY_WORDS[i], EN_DAYS[i]]);
        return out.replace(/\s+/g, ' ').trim();
    }

    var AR_NUM = { 'صفر': 0, 'واحد': 1, 'وحده': 1, 'اثنين': 2, 'اثنتين': 2, 'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4, 'خمس': 5, 'خمسه': 5, 'ست': 6, 'سته': 6, 'سبع': 7, 'سبعه': 7, 'ثمان': 8, 'ثمن': 8, 'تسع': 9, 'تسعه': 9, 'عشر': 10, 'عشه': 10 };
    function num(v) {
        if (v == null) return null;
        var s = norm(v), d = parseInt(s, 10);
        if (!isNaN(d)) return d;
        return AR_NUM[s] === undefined ? null : AR_NUM[s];
    }

    // ---------- dates and times ----------
    // Index must match Date.getDay(): 0 = Sunday.
    var DAY_WORDS = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعه', 'السبت'];
    var EN_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    function shift(n) {
        var d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
    }
    function nextWeekday(idx) {
        var now = new Date(), delta = (idx - now.getDay() + 7) % 7;
        if (delta === 0 && has('جاي', 'القادم', 'next', 'الجاي')) delta = 7;
        return shift(delta);
    }
    function dateFrom() {
        var iso = /(\d{4}-\d{2}-\d{2})/.exec(Q);
        if (iso) return iso[1];
        var dm = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?/.exec(Q);
        if (dm) {
            var y = dm[3] || new Date().getFullYear();
            return y + '-' + pad(dm[2]) + '-' + pad(dm[1]);
        }
        if (has('بعد يومين', 'بعد غد', 'بعد غدًا', 'day after tomorrow')) return shift(2);
        if (has('غدا', 'غدا', 'بكره', 'بكرًا', 'tomorrow', 'bokra')) return shift(1);
        if (has('اليوم', 'النهارده', 'today')) return shift(0);
        var rel = /بعد\s+(\d+|[a-z\u0600-\u06FF]+)(?:\s+(يوم|ايام|ساعه|اسبوع|اسابيع|days?|hours?|weeks?))?/.exec(Q);
        if (rel) {
            var n = num(rel[1]);
            var unit = rel[2] || rel[1];
            // «بعد أسبوع» puts the unit where the number should be; the dual form means two.
            if (n == null && /(اسبوع|اسابيع|يوم|ايام|ساعه|week|day|hour)/.test(unit)) n = /ين$/.test(unit) ? 2 : 1;
            if (n != null) {
                if (unit.indexOf('اسبوع') > -1 || unit.indexOf('week') > -1) return shift(n * 7);
                if (unit.indexOf('ساعه') > -1) return shift(Math.ceil(n / 24) || 1);
                return shift(n);
            }
        }
        for (var i = 0; i < 7; i++) {
            if (Q.indexOf(DAY_WORDS[i]) > -1 || Q.indexOf(EN_DAYS[i]) > -1) return nextWeekday(i);
        }
        var nd = /(\d{1,2})\s+(يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)/.exec(Q);
        if (nd) return new Date().getFullYear() + '-' + pad(['يناير','فبراير','مارس','ابريل','مايو','يونيو','يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر'].indexOf(nd[2]) + 1) + '-' + pad(nd[1]);
        return null;
    }
    var PM_WORDS = 'مساءا|مساء|مسا|ليلا|ليل|بعد الظهر|pm|p\\.m';
    var NOON_WORDS = 'ظهرا|ظهر|noon';
    var AM_WORDS = 'صباحا|صباح|فجرا|فجر|am|a\\.m';
    function to24(h, marker) {
        marker = marker || '';
        if (new RegExp('(' + AM_WORDS + ')').test(marker) && h === 12) h = 0;
        if (new RegExp('(' + PM_WORDS + '|' + NOON_WORDS + ')').test(marker) && h < 12) h += 12;
        return h > 23 ? null : h;
    }
    function timeFrom() {
        var m = /(\d{1,2}):(\d{2})\s*(صباحا|صباح|مساءا|مساء|ليلا|ليل|ظهرا|ظهر|فجرا|فجر|am|pm)?/.exec(Q);
        if (m && +m[1] <= 23) {
            var h = to24(+m[1], m[3]);
            if (h === null) return null;
            return pad(h) + ':' + m[2];
        }
        var a = /(?:الساع[هة]|ساع[هة]|at)\s*(\d{1,2})(?:\s*(?:و|and)\s*(\d{2}))?\s*(صباحا|صباح|مساءا|مساء|مسا|ليلا|ليل|ظهرا|ظهر|فجرا|فجر|am|pm)?/.exec(Q);
        if (a) {
            var hh = to24(+a[1], a[3]);
            if (hh === null) return null;
            return pad(hh) + ':' + (a[2] || '00');
        }
        return null;
    }

    // ---------- known subjects make parsing much better ----------
    function knownSubjects() {
        var out = [];
        (State.data.classes || []).forEach(function (c) { if (c.name) out.push(c.name); });
        (State.data.homework || []).forEach(function (h) { if (h.subject) out.push(h.subject); });
        (State.data.exams || []).forEach(function (e) { if (e.subject) out.push(e.subject); });
        return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
    }
    function pickSubject(body) {
        var list = knownSubjects(), i, s;
        for (i = 0; i < list.length; i++) {
            s = norm(list[i]);
            if (!s) continue;
            // Whole tokens only: «math» inside «maths» would eat the trailing letters.
            var re = new RegExp('(?:^|[^a-z\\u0600-\\u06FF])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z\\u0600-\\u06FF])');
            if (re.test(body)) return { subject: list[i], rest: body.replace(re, ' ').replace(/\s+/g, ' ').trim() };
        }
        var m = /في\s+([\u0600-\u06FFa-zA-Z]{2,})/.exec(body);
        if (m) return { subject: m[1], rest: body.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
        var words = body.split(' ').filter(Boolean);
        return { subject: words[0] || '', rest: words.slice(1).join(' ') };
    }
    function priority() {
        if (has('مهم', 'عاجل', 'high', 'urgent')) return 'high';
        if (has('بسيط', 'سهل', 'low')) return 'low';
        return 'medium';
    }

    // ---------- shared word lists: Gulf / Levantine / Egyptian / English ----------
    var V_ADD = ['اضف', 'ضيف', 'اكتب', 'سجل', 'عندي', 'ابي', 'ابغى', 'ابغا', 'ابغي', 'اريد', 'عايز', 'حط', 'انش', 'اعمل', 'عمل', 'صمم', 'add', 'new', 'create', 'want', 'make', 'build'];
    var V_DONE = ['خلصت', 'خلص', 'انهيت', 'انجزت', 'انتهى', 'سويت', 'سوي', 'تم', 'done', 'finished', 'completed'];
    var V_DEL = ['احذف', 'حذف', 'شيل', 'ازال', 'زالة', 'remove', 'delete', 'cancel'];
    var V_SET = ['غير', 'حول', 'اجعل', 'عدل', 'تعديل', 'بدل', 'update', 'change', 'set'];
    var N_HW = ['واجب', 'واجبات', 'الواجب', 'homework', 'hw', 'تكاليف'];
    var N_CLASS = ['حصة', 'حصه', 'حصص', 'ماده', 'مادة', 'مواد', 'class', 'lesson', 'period', 'subject'];
    var N_EXAM = ['امتحان', 'اختبار', 'اكسم', 'exam', 'test'];
    var N_PLAN = ['بند', 'نشاط', 'جدول', 'الجدول', 'schedule', 'plan', 'item'];
    var N_QUIZ = ['كويز', 'سؤال', 'اسئله', 'اختيار', 'quiz', 'mcq', 'question'];
    function any(list) {
        for (var i = 0; i < list.length; i++) if (has(list[i])) return true;
        return false;
    }
    function anyW(list) {
        for (var i = 0; i < list.length; i++) if (hasW(list[i])) return true;
        return false;
    }
    // A question word means the user wants an answer, not a database write.
    function asking() {
        return hasW('شنو', 'ايش', 'ماذا', 'وش', 'متى', 'كم', 'هل', 'why', 'what', 'when', 'which', 'how', 'many');
    }
    function allWords() {
        var out = [];
        for (var i = 0; i < arguments.length; i++) out = out.concat(arguments[i]);
        return out;
    }
    function whichList(res) {
        return { text: t('brain_which') + '\n' + (res.matches || []).map(function (m) { return '* ' + m; }).join('\n'), actions: [] };
    }
    function weekdayFrom() {
        for (var i = 0; i < 7; i++) if (Q.indexOf(DAY_WORDS[i]) > -1 || Q.indexOf(EN_DAYS[i]) > -1) return i;
        var d = dateFrom();
        return d ? new Date(d + 'T00:00:00').getDay() : -1;
    }

    // ---------- helpers to run an action ----------
    function run(name, args) {
        var res = window.Chat.exec(name, args || {});
        return { res: res, label: res && res.action ? res.action : '' };
    }
    function say(text, res) {
        return { text: text, actions: res && res.ok && res.action ? [res.action] : [] };
    }
    function failed(err) {
        return { text: t('brain_failed') + ' ' + (err === 'ambiguous' ? t('brain_ambiguous') : t('brain_try')), actions: [] };
    }

    // ---------- intents ----------
    function greeting() {
        if (/^(اهلا|السلام|مرحبا|هاي|هلو|صباح|مساء|hi|hello|hey|salam|assalam|good (morning|evening))/.test(Q)) {
            var pending = (State.data.homework || []).filter(function (h) { return !h.done; }).length;
            return { text: t('brain_greet') + (pending ? ' ' + t('brain_greet_pending').replace('{n}', pending) : ''), actions: [] };
        }
        return null;
    }

    function thanks() {
        if (has('شكرا', 'تسلم', 'ممنون', 'thanks', 'thank you')) return { text: t('brain_thanks'), actions: [] };
        return null;
    }

    function help() {
        if (has('ماذا تستطيع', 'شنو تقدر', 'ايش تسوي', 'كيف تساعد', 'help', 'what can you')) {
            return { text: '* ' + t('brain_h1') + '\n* ' + t('brain_h2') + '\n* ' + t('brain_h3') + '\n* ' + t('brain_h4') + '\n* ' + t('brain_h5'), actions: [] };
        }
        return null;
    }

    function addHomework() {
        if (asking()) return null;
        if (!any(N_HW) || !anyW(V_ADD)) return null;
        var body = stripWhen(cut(allWords(V_ADD, N_HW, ['للتسليم', 'تسليم', 'due', 'بأولويه', 'اولويه', 'priority', 'مهمه', 'مهم', 'عاجل', 'بسيط', 'سهل', 'high', 'low', 'medium'])));
        var due = dateFrom() || shift(2);
        var pr = priority();
        var got = pickSubject(body);
        var subject = got.subject || t('brain_general');
        var title = got.rest || t('brain_task');
        var r = run('add_homework', { subject: subject, title: title, due: due, priority: pr });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_hw_added') + '\n* ' + t('subject') + ': **' + subject + '**\n* ' + t('title') + ': ' + title + '\n* ' + t('due_date') + ': ' + due, r.res);
    }

    function completeAll() {
        if (!anyW(V_DONE) || !any(N_HW)) return null;
        if (!hasW('كل', 'جميع', 'كامل', 'all', 'whole')) return null;
        var r = run('complete_all_homework', {});
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_all_done') + ' ' + r.res.action, r.res);
    }

    function finishHomework() {
        if (!anyW(V_DONE) || !any(N_HW)) return null;
        var body = cut(allWords(V_DONE, N_HW, ['الواجب']));
        var got = pickSubject(body);
        var r = run('finish_homework', { subject: got.subject, keyword: got.rest });
        if (!r.res.ok) return r.res.error === 'ambiguous' ? whichList(r.res) : failed(r.res.error);
        return say(t('brain_hw_done') + ' ' + r.res.action, r.res);
    }

    function addClass() {
        if (asking()) return null;
        if (!any(N_CLASS) || !anyW(V_ADD)) return null;
        var body = stripWhen(cut(allWords(V_ADD, N_CLASS, ['عند', 'كل', 'week', 'اسبوع'])));
        var time = timeFrom() || '08:00';
        var day = weekdayFrom();
        if (day < 0) day = new Date().getDay();
        var got = pickSubject(body);
        var name = got.subject || t('brain_general');
        if (/^[a-z\u0600-\u06FF]+$/.test(name)) name = name.charAt(0).toUpperCase() + name.slice(1);
        var teacher = cutFrom((got.rest || '').replace(/الاستاذ|الاستاذه|المعلم|الدكتور|teacher|mr|ms|prof/gi, ' '),
            allWords(['في', 'من', 'عن', 'ب', 'على', 'لل', 'all'], N_CLASS)).trim();
        var r = run('add_class', { name: name, teacher: teacher, day: day, time: time });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_class_added') + '\n* ' + t('subject') + ': **' + name + '**\n* ' + t('day') + ': ' + I18N.dayName(day) + '\n* ' + t('time') + ': ' + I18N.fmtTime(time) +
            (teacher ? '\n* ' + t('teacher') + ': ' + teacher : ''), r.res);
    }

    function addExam() {
        if (asking()) return null;
        if (!any(N_EXAM) || !anyW(V_ADD)) return null;
        var body = stripWhen(cut(allWords(V_ADD, N_EXAM, ['عند', 'في'])));
        var date = dateFrom();
        if (!date) return { text: t('brain_need_date'), actions: [] };
        var got = pickSubject(body);
        var name = got.subject || t('brain_general');
        var r = run('add_exam', { subject: name, date: date, time: timeFrom() || '08:00' });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_exam_added') + ' **' + name + '** ' + I18N.fmtDate(date), r.res);
    }

    // Multiple choice needs the separators, which norm() drops, so it reads the raw input.
    function addQuiz() {
        if (asking()) return null;
        if (!any(N_QUIZ) || !anyW(V_ADD)) return null;
        var raw = String(RAW || '').replace(/[\r\n]+/g, ' ').trim();
        var answer = '';
        var mk = /(الجواب|الاجابه|اجابه|صحيح|صح|correct|answer)\s*[:\-–>]?\s*/i.exec(raw);
        if (mk) { answer = norm(raw.slice(mk.index + mk[0].length)); raw = raw.slice(0, mk.index); }
        var parts = raw.split(/[,،;؛]|\s+-\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
        var q = norm(parts[0] || '')
            .replace(/^(?:اضف|ضيف|سجل|ابغى|ابغي|ابي|اريد|عايز|حط|انش\S*|اعمل|صمم|create|add|new|make|build|want)\s+/, '')
            .replace(/^(?:سؤال|اسئله|كويز|اختبار|question|quiz)\s*/, '').trim();
        var opts = parts.slice(1)
            .map(function (o) { return o.replace(/^\s*(?:[a-dA-D\u0621-\u064A]|\d+)\s*[).\-:]\s*/, '').trim(); })
            .filter(Boolean).slice(0, 4);
        if (opts.length < 2) return { text: t('brain_quiz_hint'), actions: [] };
        var correct = 0, i;
        if (answer) for (i = 0; i < opts.length; i++) {
            if (norm(opts[i]) === answer || norm(opts[i]).indexOf(answer) > -1) { correct = i; break; }
        }
        var subject = knownSubjects().filter(function (s) { return has(s); })[0] || t('brain_general');
        var r = run('add_quiz', { subject: subject, question: q || opts[0], options: opts, correct: correct });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_quiz_added') + ' **' + subject + '**\n* ' + q + '\n* ' + t('quiz_correct') + ': ' + opts[correct], r.res);
    }

    function planDay() {
        if (!has('رتب', 'رتب', 'نظم', 'خطط', 'جدول', 'plan', 'organize', 'schedule my day')) return null;
        if (!has('يومي', 'يومى', 'يوم', 'day', 'my day')) return null;
        var r = run('plan_day', {});
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_planned') + '\n' + (State.data.schedule || []).slice(0, 6).map(function (x) {
            return '* `' + x.time + '` ' + x.activity;
        }).join('\n') + ((State.data.schedule || []).length > 6 ? '\n' + t('brain_more_items') : ''), r.res);
    }

    function addPlanItem() {
        if (asking()) return null;
        var time = timeFrom();
        if (!time) return null;
        if (any(N_CLASS) || any(N_HW) || any(N_EXAM) || any(N_QUIZ)) return null;
        var body = stripWhen(cut(allWords(V_ADD, N_PLAN, ['في', 'عن', 'الساعه', 'ساعه', 'at'])));
        body = body.replace(/(^|\s)\d{1,2}(\s|$)/, ' ').replace(/\s+/g, ' ').trim();
        var activity = body || t('brain_task');
        var r = run('add_plan_item', { time: time, activity: activity });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_item_added') + ' `' + time + '` ' + activity, r.res);
    }

    function removeItem() {
        if (!anyW(V_DEL)) return null;
        if (hasW('كل', 'جميع', 'all') && any(N_PLAN) && !any(N_HW)) {
            var c = run('clear_plan', {});
            return c.res.ok ? say(t('brain_plan_cleared'), c.res) : failed(c.res.error);
        }
        var kind = 'homework';
        if (any(N_CLASS)) kind = 'class';
        else if (any(N_EXAM)) kind = 'exam';
        else if (any(N_QUIZ)) kind = 'quiz';
        else if (any(N_PLAN)) kind = 'plan';
        var body = stripWhen(cut(allWords(V_DEL, N_HW, N_CLASS, N_EXAM, N_EXAM, N_QUIZ, N_PLAN, ['من', 'today', 'اليوم'])));
        var got = pickSubject(body);
        var r = run('remove_item', { kind: kind, subject: got.subject, keyword: got.rest });
        if (!r.res.ok) return r.res.error === 'ambiguous' ? whichList(r.res) : failed(r.res.error);
        return say(t('brain_deleted') + ' ' + r.res.action, r.res);
    }

    var FIELD_WORDS = [
        ['homework', 'title', ['العنوان', 'عنوان', 'title']],
        ['homework', 'due', ['موعد التسليم', 'الموعد', 'موعد', 'تاريخ', 'due', 'date']],
        ['homework', 'priority', ['الاولويه', 'اولويه', 'الاهميه', 'priority']],
        ['exam', 'date', ['موعد', 'تاريخ', 'date']],
        ['class', 'name', ['اسم', 'الاسم', 'الماده', 'name']],
        ['class', 'time', ['الوقت', 'الساعه', 'ساعه', 'وقت', 'time']],
        ['class', 'teacher', ['المدرس', 'الاستاذ', 'المعلم', 'الدكتور', 'teacher']],
        ['class', 'day', ['اليوم الدراسي', 'يوم', 'day']],
        ['plan', 'activity', ['النشاط', 'المهمه', 'activity']],
        ['plan', 'time', ['الوقت', 'الساعه', 'time']]
    ];
    function updateItem() {
        if (!anyW(V_SET)) return null;
        // Prefer the row whose own noun the user actually said, so «تاريخ الحصة» is a class time,
        // not a homework due date.
        var pref = { homework: any(N_HW), exam: any(N_EXAM), class: any(N_CLASS), plan: any(N_PLAN) };
        var row = null, i;
        for (i = 0; i < FIELD_WORDS.length; i++) {
            if (has.apply(null, FIELD_WORDS[i][2]) && pref[FIELD_WORDS[i][0]]) { row = FIELD_WORDS[i]; break; }
        }
        if (!row) for (i = 0; i < FIELD_WORDS.length; i++) {
            if (has.apply(null, FIELD_WORDS[i][2])) { row = FIELD_WORDS[i]; break; }
        }
        var kind = row ? row[0] : null, field = row ? row[1] : null, words = row ? row[2] : [];
        // No field named explicitly: infer it from the value the user did give.
        if (!field) {
            if (any(N_EXAM) && dateFrom()) { kind = 'exam'; field = 'date'; }
            else if (any(N_HW) && dateFrom()) { kind = 'homework'; field = 'due'; }
            else if (any(N_PLAN) && timeFrom()) { kind = 'plan'; field = 'time'; }
            else if ((any(N_CLASS) || any(N_EXAM)) && timeFrom()) { kind = 'class'; field = 'time'; }
            else if (any(N_CLASS) && weekdayFrom() > -1) { kind = 'class'; field = 'day'; }
            if (!field) {
                if (any(N_HW) || any(N_CLASS) || any(N_EXAM) || any(N_PLAN)) return { text: t('brain_need_value'), actions: [] };
                return null;
            }
        }
        // «إلى» and the new value itself are not part of the item's name.
        var body = stripWhen(cut(allWords(V_SET, words, N_HW, N_CLASS, N_EXAM, N_QUIZ, N_PLAN,
            ['الي', 'الى', 'ل', 'في', 'من', 'عن', 'مع', 'the', 'this', 'to', 'جديد', 'مهم', 'عاجل', 'بسيط', 'سهل', 'high', 'low', 'medium'])));
        body = body.replace(/(^|\s)\d{1,2}([:\/-]\d{1,2})?(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
        var got = pickSubject(body);
        var val;
        if (field === 'due' || field === 'date') val = dateFrom();
        else if (field === 'time') val = timeFrom();
        else if (field === 'priority') val = priority();
        else if (field === 'day') val = weekdayFrom();
        else val = got.rest || body;
        if (val === null || val === '' || val < 0) return { text: t('brain_need_value'), actions: [] };
        // For a text field the leftover words are the new value, not a search term.
        var isText = ['title', 'name', 'teacher', 'activity', 'subject'].indexOf(field) > -1;
        var r = run('update_item', { kind: kind, field: field, value: val, subject: got.subject, keyword: isText ? '' : got.rest });
        if (!r.res.ok) return r.res.error === 'ambiguous' ? whichList(r.res) : failed(r.res.error);
        return say(t('brain_updated') + ' ' + r.res.action, r.res);
    }

    function togglePlanItem() {
        if (!anyW(V_DONE) || any(N_HW) || !any(N_PLAN)) return null;
        var body = stripWhen(cut(allWords(V_DONE, N_PLAN, ['من', 'today', 'اليوم', 'كل'])));
        var got = pickSubject(body);
        var r = run('toggle_plan_item', { subject: got.subject, keyword: got.rest || body });
        if (!r.res.ok) return r.res.error === 'ambiguous' ? whichList(r.res) : failed(r.res.error);
        return say(t('brain_item_done') + ' ' + r.res.action, r.res);
    }

    function redeem() {
        if (!has('استبدل', 'استبدال', 'افدي', 'بدل النقاط', 'redeem')) return null;
        var body = cut(allWords(['استبدل', 'استبدال', 'افدي', 'redeem', 'مكافاه', 'المكافاه', 'بنقاط', 'نقاط', 'points', 'ب', 'من', 'اريد', 'ابي', 'ابغى']));
        var r = run('redeem_reward', { label: body });
        if (!r.res.ok) {
            if (r.res.error === 'ambiguous') return whichList(r.res);
            if (r.res.error === 'not enough points') {
                return { text: t('brain_not_enough').replace('{p}', r.res.points).replace('{c}', r.res.cost), actions: [] };
            }
            if (r.res.error === 'no available reward matches') {
                var rw = (State.data.rewards || []).filter(function (x) { return x.status === 'available'; });
                return { text: t('brain_no_reward') + (rw.length ? '\n' + bullets(rw.slice(0, 5).map(function (x) { return x.label + ' — ' + x.cost + ' ' + t('points'); })) : ''), actions: [] };
            }
            return failed(r.res.error);
        }
        return say(t('brain_redeemed') + ' **' + body + '**', r.res);
    }

    // [routine field, i18n label, trigger words] — order matters: longer phrases first.
    var ROUTINE_WORDS = [
        ['wake', 'wake_up', ['الاستيقاظ', 'الاصحاح', 'اصحى', 'القيام', 'wake']],
        ['sleep', 'sleep', ['النوم', 'انام', 'نام', 'sleep']],
        ['schoolEnd', 'school_end', ['نهايه الدوام', 'الانصراف', 'school end']],
        ['schoolStart', 'school_start', ['بدايه الدوام', 'الدوام', 'school start']],
        ['breakfast', 'breakfast', ['الفطور', 'فطور', 'breakfast']],
        ['lunch', 'lunch', ['الغداء', 'غداء', 'lunch']],
        ['dinner', 'dinner', ['العشاء', 'عشاء', 'dinner']],
        ['exercise', 'exercise', ['الرياضه', 'رياضه', 'exercise', 'gym']],
        ['shower', 'shower', ['الاستحمام', 'حمام', 'shower']]
    ];
    function setRoutine() {
        if (!anyW(V_SET)) return null;
        var time = timeFrom();
        if (!time) return null;
        for (var i = 0; i < ROUTINE_WORDS.length; i++) {
            if (hasW.apply(null, ROUTINE_WORDS[i][2])) {
                var args = {};
                args[ROUTINE_WORDS[i][0]] = time;
                var r = run('set_routine', args);
                if (!r.res.ok) return failed(r.res.error);
                return say(t('brain_routine_set') + ' **' + t(ROUTINE_WORDS[i][1]) + '** ' + I18N.fmtTime(time), r.res);
            }
        }
        return null;
    }

    function notifyToggle() {
        if (!has('اشعار', 'تنبيه', 'تنبيهات', 'notification', 'notify')) return null;
        var off = has('اطفئ', 'طفي', 'اطفي', 'وقف', 'عطل', 'تعطيل', 'الغي', 'off', 'disable', 'stop');
        var kind = 'daily';
        if (any(N_HW)) kind = 'homework';
        else if (any(N_EXAM)) kind = 'exams';
        var r = run('set_notification', { kind: kind, on: !off });
        if (!r.res.ok) return failed(r.res.error);
        return say(t(off ? 'brain_notif_off' : 'brain_notif_on') + ' ' +
            t(kind === 'homework' ? 'notif_homework' : kind === 'exams' ? 'notif_exams' : 'notif_daily'), r.res);
    }

    function parentCode() {
        if (!has('رمز ولي', 'كود ولي', 'رمز الوالدين', 'كود الوالدين', 'رمز المتابعه', 'كود المتابعه', 'parent code')) return null;
        var r = run('parent_code', {});
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_code') + ' `' + State.data.parentCode + '`', r.res);
    }

    function exportData() {
        if (!has('تصدير', 'صدّر', 'نسخه احتياطيه', 'نسخه احتياطى', 'export', 'backup')) return null;
        var r = run('export_data', {});
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_exported'), r.res);
    }

    function filterHw() {
        if (!has('وريني', 'ارني', 'اعرض', 'اظهر', 'فقط', 'show only', 'filter')) return null;
        var f = 'all';
        if (has('المكتمله', 'مكتمله', 'المُنجزه', 'المنجزه', 'done', 'completed')) f = 'done';
        else if (has('المتبقيه', 'المتاخره', 'المعلقه', 'غير المنجزه', 'pending', 'late', 'overdue')) f = 'pending';
        var r = run('set_filter', { filter: f });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_filter') + ' ' + r.res.action, r.res);
    }

    function dayClasses() {
        if (any(N_HW) || any(N_EXAM) || any(N_QUIZ)) return null;
        if (!asking() && !any(N_CLASS) && !has('جدول')) return null;
        if (!asking() && (anyW(V_ADD) || anyW(V_DEL) || anyW(V_SET) || anyW(V_DONE))) return null;
        var d = weekdayFrom();
        if (d < 0) return null;
        var cs = (State.data.classes || []).filter(function (c) { return c.day === d; })
            .sort(function (a, b) { return a.time.localeCompare(b.time); });
        return {
            text: cs.length
                ? '**' + I18N.dayName(d) + ':**\n' + cs.map(function (c) { return '* `' + c.time + '` ' + c.name + (c.teacher ? ' — ' + c.teacher : ''); }).join('\n')
                : t('brain_no_classes_day') + ' ' + I18N.dayName(d),
            actions: []
        };
    }

    function addWish() {
        if (!has('امنيه', 'مكافاه', 'wish', 'reward')) return null;
        if (!has('اضف', 'ضيف', 'ابغا', 'ابغي', 'ابي', 'اريد', 'عايز', 'ارغب', 'add', 'i want', 'want')) return null;
        var body = cut(['اضف', 'ضيف', 'ابغا', 'ابغي', 'ابي', 'اريد', 'عايز', 'add', 'i want', 'want', 'امنيه', 'مكافاه', 'wish', 'reward', 'ب', 'نقطه', 'نقاط', 'points']);
        var cost = num((/(\d+|[a-z\u0600-\u06FF]+)/.exec(body.split(' ').slice(-1)[0]) || [])[1]) || 50;
        var label = body.split(' ').slice(0, -1).join(' ').trim() || body || t('brain_task');
        var r = run('add_wish', { label: label, cost: cost });
        if (!r.res.ok) return failed(r.res.error);
        return say(t('brain_wish_added') + ' **' + label + '** (' + cost + ' ' + t('points') + ')', r.res);
    }

    function timer() {
        if (has('شغل', 'ابدأ', 'ابداء', 'ابد', 'start', 'begin', 'tomato') && has('مؤقت', 'مذاكره', 'مذاكرة', 'focus', 'timer', 'بومودورو')) {
            var r = run('start_timer', {});
            return say(t('brain_timer_started'), r.res);
        }
        if (has('مؤقت', 'timer', 'بومودورو') && /(\d+)\s*(دقيق|min)/.test(Q)) {
            var mins = num((/(\d+)\s*(?:دقيق|min)/.exec(Q) || [])[1]);
            var rr = run('set_timer', { work: mins });
            if (!rr.res.ok) return failed(rr.res.error);
            return say(t('brain_timer_set') + ' **' + mins + '** ' + t('minutes'), rr.res);
        }
        return null;
    }

    // Each page lists both the definite and indefinite Arabic form: «افتح صفحه المواد» and
    // «افتح صفحه مواد اليوم» are the same request but only one contains «المواد».
    var PAGE_WORDS = [
        ['overview', ['الرئيسيه', 'رئيسيه', 'الراس', 'overview', 'home']],
        ['classes', ['الحصص', 'حصص', 'المواد', 'مواد', 'الماده', 'ماده', 'classes', 'subject']],
        ['homework', ['الواجبات', 'واجبات', 'الواجب', 'واجب', 'homework']],
        ['exams', ['الامتحانات', 'امتحانات', 'الاختبارات', 'اختبارات', 'exams']],
        ['quiz', ['الكويز', 'كويز', 'اختبار قصير', 'quiz']],
        ['schedule', ['الجدول', 'جدول', 'schedule', 'plan']],
        ['calendar', ['التقويم', 'تقويم', 'الروزنامه', 'calendar']],
        ['focus', ['المؤقت', 'مؤقت', 'التركيز', 'تركيز', 'timer', 'focus']],
        ['achievements', ['الانجازات', 'انجازات', 'النقاط', 'نقاط', 'achievements', 'points']],
        ['parent', ['ولي الامر', 'الوالدين', 'والدين', 'parent']],
        ['settings', ['الاعدادات', 'اعدادات', 'settings']]
    ];
    function openPage() {
        if (!has('افتح', 'فتح', 'روح', 'اذهب', 'ذهب', 'اودني', 'ودني', 'خذني', 'انتقل', 'open', 'go to', 'show')) return null;
        for (var i = 0; i < PAGE_WORDS.length; i++) {
            if (has.apply(null, PAGE_WORDS[i][1])) {
                var r = run('open_page', { page: PAGE_WORDS[i][0] });
                if (!r.res.ok) return failed(r.res.error);
                return say(t('brain_opened') + ' ' + t('nav_' + PAGE_WORDS[i][0]), r.res);
            }
        }
        return null;
    }

    function langTheme() {
        // «عربي» and «english» are also school subjects, so an item noun rules this out.
        var langNoun = has('بالعربي', 'بالعربيه', 'بالانجليزي', 'بالانجليزيه', 'arabic', 'english', 'language', 'اللغه', 'لغه');
        if (langNoun && !any(N_CLASS) && !any(N_EXAM) && !any(N_HW)) {
            if (!anyW(['حول', 'غير', 'اجعل', 'تحدث', 'تكلم', 'switch', 'change', 'speak', 'use'])) return null;
            if (has('عربي', 'العربيه', 'arabic')) { var a = run('set_language', { lang: 'ar' }); return say(t('brain_lang_ar'), a.res); }
            if (has('انجليزي', 'الانجليزيه', 'english')) { var b = run('set_language', { lang: 'en' }); return say(t('brain_lang_en'), b.res); }
        }
        if (has('داكن', 'ليلي', 'مظلم', 'dark') && has('مظهر', 'الوضع', 'ثيم', 'الوان', 'theme', 'mode', 'dark')) {
            var c = run('set_theme', { theme: 'dark' }); return say(t('brain_theme_dark'), c.res);
        }
        if (has('فاتح', 'مضيء', 'نور', 'light') && has('مظهر', 'الوضع', 'ثيم', 'الوان', 'theme', 'mode', 'light')) {
            var d = run('set_theme', { theme: 'light' }); return say(t('brain_theme_light'), d.res);
        }
        return null;
    }

    // ---------- questions answered from local data ----------
    function gam() { return State.data.gam || {}; }
    function bullets(list) { return list.map(function (x) { return '* ' + x; }).join('\n'); }
    function status() {
        var g = gam(), i, out;

        if (has('مذاكره', 'المذاكره', 'study', 'sessions', 'جلسات') && (has('دقيق', 'minutes', 'كم') || has('اليوم'))) {
            var st = (State.data.pomo || {}).stats || {};
            return { text: t('brain_study_stats').replace('{m}', st.minutes || 0).replace('{s}', st.sessions || 0), actions: [] };
        }
        if (has('سلسله', 'متتاليه', 'streak')) {
            return { text: t('brain_streak').replace('{n}', g.streak || 0), actions: [] };
        }
        if (has('شارات', 'الشارات', 'badge')) {
            return { text: t('brain_badges').replace('{n}', (g.badges || []).length) + ' / ' + 6, actions: [] };
        }
        if (has('نقاط', 'نقطه', 'مستوي', 'points', 'level', 'كم عندي')) {
            return { text: t('brain_points').replace('{p}', g.points || 0).replace('{l}', g.level || 1), actions: [] };
        }
        if (has('مكافاه', 'المكافاه', 'مكافآت', 'reward') && !any(V_ADD)) {
            var rw = (State.data.rewards || []).filter(function (r) { return r.status === 'available'; });
            return { text: rw.length
                ? '**' + t('rewards') + ':**\n' + bullets(rw.map(function (r) { return r.label + ' — ' + r.cost + ' ' + t('points'); }))
                : t('no_rewards'), actions: [] };
        }
        if (has('متاخر', 'متأخر', 'late', 'overdue')) {
            var late = (State.data.homework || []).filter(function (h) { return !h.done && h.due < today(); });
            return { text: late.length ? t('brain_late') + '\n' + bullets(late.map(function (h) { return '**' + h.subject + '**: ' + h.title + ' (' + h.due + ')'; })) : t('brain_no_late'), actions: [] };
        }
        if (has('الاسبوع', 'هذا الاسبوع', 'this week') && any(N_HW)) {
            var end = shift(7), wk = (State.data.homework || []).filter(function (h) { return !h.done && h.due <= end; });
            return { text: wk.length ? '**' + t('nav_homework') + ':**\n' + bullets(wk.map(function (h) { return h.subject + ': ' + h.title + ' — ' + I18N.fmtDate(h.due); })) : t('brain_nothing_today'), actions: [] };
        }
        if (has('مين مدرس', 'من مدرس', 'مين يدرس', 'من يدرس', 'teacher for', 'who teaches')) {
            var tb = stripWhen(cut(['مين', 'من', 'مدرس', 'يدرس', 'teacher', 'who', 'teaches', 'حصة', 'ماده', 'مواد']));
            var key = norm(tb);
            var hit = (State.data.classes || []).filter(function (c) { return !key || norm(c.name).indexOf(key) > -1; });
            out = hit.filter(function (c) { return c.teacher; }).map(function (c) { return c.name + ': ' + c.teacher; });
            return { text: out.length ? bullets(out) : t('brain_no_info'), actions: [] };
        }
        if (has('باقي على', 'كم يوم', 'days left', 'how many days')) {
            var nb = stripWhen(cut(['باقي', 'على', 'كم', 'يوم', 'days', 'left', 'how', 'many', 'امتحان', 'اختبار', 'exam']));
            var nk = norm(nb);
            var nx = (State.data.exams || []).filter(function (e) { return e.date >= today() && (!nk || norm(e.subject).indexOf(nk) > -1); })
                .sort(function (a, b) { return a.date.localeCompare(b.date); })[0];
            if (!nx) return { text: t('brain_no_exams'), actions: [] };
            var days = Math.round((new Date(nx.date) - new Date(today())) / 86400000);
            return { text: t('brain_days_left').replace('{s}', nx.subject).replace('{n}', days) + ' (' + I18N.fmtDate(nx.date) + ')', actions: [] };
        }
        if (has('امتحان قريب', 'اقرب امتحان', 'next exam', 'متي الامتحان', 'الامتحانات الجايه', 'كل الامتحانات')) {
            var up = (State.data.exams || []).filter(function (e) { return e.date >= today(); }).sort(function (a, b) { return a.date.localeCompare(b.date); });
            if (!up.length) return { text: t('brain_no_exams'), actions: [] };
            return { text: '**' + t('exams_title') + ':**\n' + bullets(up.slice(0, 5).map(function (e) { return e.subject + ' — ' + I18N.fmtDate(e.date); })), actions: [] };
        }
        if (has('جدول اليوم', 'عندي اليوم', 'ما عندي', 'today classes', 'my day', 'وش عندي', 'ايش عندي')) {
            var day = new Date().getDay();
            var cs = (State.data.classes || []).filter(function (c) { return c.day === day; }).sort(function (a, b) { return a.time.localeCompare(b.time); });
            var hw = (State.data.homework || []).filter(function (h) { return !h.done; });
            var txt = '';
            txt += cs.length ? '**' + t('today') + ':**\n' + bullets(cs.map(function (c) { return '`' + c.time + '` ' + c.name; })) + '\n' : '';
            txt += hw.length ? '**' + t('nav_homework') + ':** ' + hw.length + '\n' + bullets(hw.slice(0, 4).map(function (h) { return h.subject + ': ' + h.title + ' (' + h.due + ')'; })) : '';
            return { text: txt || t('brain_nothing_today'), actions: [] };
        }
        if (has('كم واجب', 'عدد الواجبات', 'how many')) {
            var p = (State.data.homework || []).filter(function (h) { return !h.done; }).length;
            return { text: t('brain_hw_count').replace('{n}', p), actions: [] };
        }
        // Last resort inside status(): any plain mention of homework that is not an edit.
        if (any(N_HW) && !anyW(V_ADD) && !anyW(V_DEL) && !anyW(V_DONE) && !anyW(V_SET)) {
            var pend = (State.data.homework || []).filter(function (h) { return !h.done; })
                .sort(function (a, b) { return a.due.localeCompare(b.due); });
            return { text: pend.length
                ? '**' + t('brain_pending') + ':**\n' + bullets(pend.slice(0, 8).map(function (h) { return h.subject + ': ' + h.title + ' — ' + I18N.fmtDate(h.due); }))
                    + (pend.length > 8 ? '\n' + t('brain_more_items') : '')
                : t('brain_no_hw_left'), actions: [] };
        }
        return null;
    }

    function fallback() {
        return { text: t('brain_unknown') + '\n* ' + t('brain_h1') + '\n* ' + t('brain_h2') + '\n* ' + t('brain_h3') + '\n* ' + t('brain_h4') + '\n* ' + t('brain_h5'), actions: [] };
    }

    // ---------- entry point ----------
    function answer(text) {
        Q = norm(text);
        RAW = String(text == null ? '' : text);
        var tries = [
            greeting, thanks, help, langTheme, filterHw, openPage, timer, parentCode, exportData, notifyToggle, setRoutine,
            completeAll, finishHomework, togglePlanItem, addQuiz, addHomework, addClass, addExam, updateItem, removeItem,
            redeem, addWish, planDay, addPlanItem, dayClasses, status, fallback
        ];
        for (var i = 0; i < tries.length; i++) {
            var out = null;
            try { out = tries[i](); } catch (e) { console.warn('Brain: ' + tries[i].name + ' failed', e); out = null; }
            if (out && out.text) return out;
        }
        return fallback();
    }

    window.Brain = { answer: answer, norm: norm };
})();
