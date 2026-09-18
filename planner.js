// Back to School — classes, homework, exams, schedule, calendar
(function () {
    'use strict';

    function t(k) { return window.I18N.t(k); }
    function todayStr() { return new Date().toISOString().slice(0, 10); }
    var calCursor = new Date();
    var hwFilter = 'all';

    function priorityChip(p) {
        var cls = { high: 'chip-danger', medium: 'chip-warning', low: 'chip-primary' }[p] || 'chip';
        return '<span class="chip ' + cls + '">' + t(p) + '</span>';
    }

    function openModal(id) { document.getElementById(id).classList.add('active'); }
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }

    window.Planner = {
        openModal: openModal, closeModal: closeModal, setHwFilter: function (f) { hwFilter = f; this.renderHomework(); },

        // ---------- classes ----------
        addClass: function (form) {
            form.preventDefault();
            State.data.classes.push({
                id: State.uid(),
                name: document.getElementById('clName').value.trim(),
                teacher: document.getElementById('clTeacher').value.trim(),
                day: +document.getElementById('clDay').value,
                time: document.getElementById('clTime').value
            });
            State.save();
            closeModal('modalClass');
            this.renderClasses(); this.renderScheduleLists();
            window.Dash.toast(t('toast_saved'), 'success');
        },
        deleteClass: function (id) {
            if (!confirm(t('confirm_delete'))) return;
            State.data.classes = State.data.classes.filter(function (c) { return c.id !== id; });
            State.save(); this.renderClasses();
        },
        renderClasses: function () {
            var list = document.getElementById('classesList');
            if (!list) return;
            var day = new Date().getDay();
            var sorted = State.data.classes.slice().sort(function (a, b) { return a.time.localeCompare(b.time); });
            if (!sorted.length) { list.innerHTML = '<div class="empty-state"><i class="fas fa-book-reader"></i>' + t('empty_classes') + '</div>'; return; }
            list.innerHTML = sorted.map(function (c) {
                var isToday = c.day === day;
                return '<div class="item' + (isToday ? ' today-hl' : '') + '"><div class="item-body">' +
                    '<div class="item-title">' + Dash.esc(c.name) + '</div>' +
                    '<div class="item-meta"><span><i class="fas fa-user"></i> ' + Dash.esc(c.teacher || '-') + '</span>' +
                    '<span><i class="fas fa-calendar"></i> ' + I18N.dayName(c.day) + '</span>' +
                    '<span><i class="fas fa-clock"></i> ' + I18N.fmtTime(c.time) + '</span></div></div>' +
                    (isToday ? '<span class="chip chip-accent">' + t('today') + '</span>' : '') +
                    '<div class="item-actions"><button class="btn-icon" data-del-class="' + c.id + '"><i class="fas fa-trash"></i></button></div></div>';
            }).join('');
            list.querySelectorAll('[data-del-class]').forEach(function (b) {
                b.addEventListener('click', function () { Planner.deleteClass(b.dataset.delClass); });
            });
        },

        // ---------- homework ----------
        addHomework: function (e) {
            e.preventDefault();
            var subject = document.getElementById('hwSubject').value.trim();
            var title = document.getElementById('hwTitle').value.trim();
            var due = document.getElementById('hwDue').value;
            if (!subject || !title || !due) return;
            State.data.homework.push({
                id: State.uid(), subject: subject, title: title, due: due,
                priority: document.getElementById('hwPriority').value,
                done: false, createdAt: new Date().toISOString()
            });
            State.save();
            closeModal('modalHomework');
            e.target.reset(); document.getElementById('hwDue').value = todayStr();
            this.renderHomework(); this.renderOverview();
            window.Dash.toast(t('toast_saved'), 'success');
        },
        toggleHomework: function (id) {
            var hw = State.data.homework.find(function (h) { return h.id === id; });
            if (!hw) return;
            hw.done = !hw.done;
            if (hw.done) {
                State.data.gam.hwDone += 1;
                Game.addPoints(20, 'nav_homework', hw.title);
                window.Dash.toast(t('toast_done'), 'success');
            } else {
                State.save();
            }
            this.renderHomework(); this.renderOverview();
        },
        deleteHomework: function (id) {
            if (!confirm(t('confirm_delete'))) return;
            State.data.homework = State.data.homework.filter(function (h) { return h.id !== id; });
            State.save(); this.renderHomework(); this.renderOverview();
            window.Dash.toast(t('toast_deleted'), 'info');
        },
        renderHomework: function () {
            var list = document.getElementById('homeworkList');
            if (!list) return;
            document.querySelectorAll('#hwFilters .filter-btn').forEach(function (b) {
                b.classList.toggle('active', b.dataset.filter === hwFilter);
            });
            var today = todayStr();
            var items = State.data.homework.filter(function (h) {
                if (hwFilter === 'pending') return !h.done;
                if (hwFilter === 'completed') return h.done;
                return true;
            }).sort(function (a, b) { return a.due.localeCompare(b.due); });
            if (!items.length) { list.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i>' + t('empty_homework') + '</div>'; return; }
            list.innerHTML = items.map(function (h) {
                var overdue = !h.done && h.due < today;
                return '<div class="item' + (overdue ? ' overdue' : '') + '">' +
                    '<button class="item-check' + (h.done ? ' checked' : '') + '" data-hw="' + h.id + '"><i class="fas fa-check"></i></button>' +
                    '<div class="item-body"><div class="item-title' + (h.done ? ' done' : '') + '">' + Dash.esc(h.title) + '</div>' +
                    '<div class="item-meta"><span>' + Dash.esc(h.subject) + '</span><span><i class="fas fa-calendar"></i> ' + I18N.fmtDate(h.due) + '</span>' +
                    priorityChip(h.priority) + (overdue ? '<span class="chip chip-danger">' + t('stat_homework') + '</span>' : '') + '</div></div>' +
                    '<div class="item-actions"><button class="btn-icon" data-del-hw="' + h.id + '"><i class="fas fa-trash"></i></button></div></div>';
            }).join('');
            list.querySelectorAll('[data-hw]').forEach(function (b) {
                b.addEventListener('click', function () { Planner.toggleHomework(b.dataset.hw); });
            });
            list.querySelectorAll('[data-del-hw]').forEach(function (b) {
                b.addEventListener('click', function () { Planner.deleteHomework(b.dataset.delHw); });
            });
        },

        // ---------- exams ----------
        addExam: function (e) {
            e.preventDefault();
            var subject = document.getElementById('exSubject').value.trim();
            var date = document.getElementById('exDate').value;
            if (!subject || !date) return;
            State.data.exams.push({ id: State.uid(), subject: subject, date: date, time: document.getElementById('exTime').value || '08:00' });
            State.save();
            closeModal('modalExam');
            e.target.reset(); document.getElementById('exDate').value = todayStr();
            this.renderExams(); this.renderOverview();
            window.Dash.toast(t('toast_saved'), 'success');
        },
        deleteExam: function (id) {
            if (!confirm(t('confirm_delete'))) return;
            State.data.exams = State.data.exams.filter(function (x) { return x.id !== id; });
            State.save(); this.renderExams(); this.renderOverview();
        },
        upcomingExams: function () {
            var today = todayStr();
            return State.data.exams.filter(function (x) { return x.date >= today; })
                .sort(function (a, b) { return a.date.localeCompare(b.date); });
        },
        renderExams: function () {
            var list = document.getElementById('examsList');
            if (!list) return;
            var items = this.upcomingExams();
            if (!items.length) { list.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i>' + t('no_exams') + '</div>'; return; }
            list.innerHTML = items.map(function (x) {
                var days = Math.max(0, Math.round((new Date(x.date) - new Date(todayStr())) / 86400000));
                return '<div class="item"><div class="item-body"><div class="item-title">' + Dash.esc(x.subject) + '</div>' +
                    '<div class="item-meta"><span><i class="fas fa-calendar"></i> ' + I18N.fmtDate(x.date) + '</span>' +
                    '<span><i class="fas fa-clock"></i> ' + I18N.fmtTime(x.time) + '</span></div></div>' +
                    '<span class="chip ' + (days <= 2 ? 'chip-danger' : days <= 5 ? 'chip-warning' : 'chip-primary') + '">' + days + ' ' + t('days_left') + '</span>' +
                    '<div class="item-actions"><button class="btn-icon" data-del-ex="' + x.id + '"><i class="fas fa-trash"></i></button></div></div>';
            }).join('');
            list.querySelectorAll('[data-del-ex]').forEach(function (b) {
                b.addEventListener('click', function () { Planner.deleteExam(b.dataset.delEx); });
            });
        },

        // ---------- daily schedule ----------
        generate: function () {
            var r = State.data.routine;
            var day = new Date().getDay();
            var items = [];
            function add(time, key) { items.push({ id: State.uid(), time: time, activity: t(key), done: false }); }
            add(r.wake, 'wake_up'); add(r.breakfast, 'breakfast');
            add(r.schoolStart, 'school_start');
            State.data.classes.filter(function (c) { return c.day === day; })
                .forEach(function (c) { items.push({ id: State.uid(), time: c.time, activity: c.name, done: false }); });
            add(r.schoolEnd, 'school_end'); add(r.lunch, 'lunch'); add(r.exercise, 'exercise');
            State.data.homework.filter(function (h) { return !h.done; }).slice(0, 3).forEach(function (h) {
                items.push({ id: State.uid(), time: '17:00', activity: t('nav_homework') + ' — ' + h.subject, done: false });
            });
            add(r.dinner, 'dinner'); add(r.shower, 'shower'); add(r.sleep, 'sleep');
            items.sort(function (a, b) { return a.time.localeCompare(b.time); });
            State.data.schedule = items;
            State.data.scheduleDay = todayStr();
            State.save();
            this.renderSchedule(); this.renderOverview();
            window.Dash.toast(t('toast_gen'), 'success');
        },
        addItem: function (e) {
            e.preventDefault();
            var time = document.getElementById('scTime').value;
            var act = document.getElementById('scActivity').value.trim();
            if (!time || !act) return;
            State.data.schedule.push({ id: State.uid(), time: time, activity: act, done: false });
            State.data.schedule.sort(function (a, b) { return a.time.localeCompare(b.time); });
            State.save();
            closeModal('modalScheduleItem'); e.target.reset();
            this.renderSchedule(); this.renderOverview();
        },
        toggleItem: function (id) {
            var it = State.data.schedule.find(function (x) { return x.id === id; });
            if (it) { it.done = !it.done; State.save(); this.renderSchedule(); this.renderOverview(); }
        },
        deleteItem: function (id) {
            State.data.schedule = State.data.schedule.filter(function (x) { return x.id !== id; });
            State.save(); this.renderSchedule(); this.renderOverview();
        },
        renderSchedule: function () {
            var list = document.getElementById('scheduleList');
            if (!list) return;
            if (!State.data.schedule.length) {
                list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-day"></i>' + t('empty_schedule') + '</div>';
            } else {
                list.innerHTML = State.data.schedule.map(function (x) {
                    return '<div class="item"><button class="item-check' + (x.done ? ' checked' : '') + '" data-sc="' + x.id + '"><i class="fas fa-check"></i></button>' +
                        '<div class="item-body"><div class="item-title' + (x.done ? ' done' : '') + '">' + Dash.esc(x.activity) + '</div>' +
                        '<div class="item-meta"><span>' + I18N.fmtTime(x.time) + '</span></div></div>' +
                        '<div class="item-actions"><button class="btn-icon" data-del-sc="' + x.id + '"><i class="fas fa-trash"></i></button></div></div>';
                }).join('');
                list.querySelectorAll('[data-sc]').forEach(function (b) {
                    b.addEventListener('click', function () { Planner.toggleItem(b.dataset.sc); });
                });
                list.querySelectorAll('[data-del-sc]').forEach(function (b) {
                    b.addEventListener('click', function () { Planner.deleteItem(b.dataset.delSc); });
                });
            }
        },
        renderScheduleLists: function () { this.renderSchedule(); },

        // ---------- calendar ----------
        prevMonth: function () { calCursor.setMonth(calCursor.getMonth() - 1); this.renderCalendar(); },
        nextMonth: function () { calCursor.setMonth(calCursor.getMonth() + 1); this.renderCalendar(); },
        renderCalendar: function () {
            var grid = document.getElementById('calendarGrid');
            if (!grid) return;
            var lang = I18N.lang;
            var label = document.getElementById('calLabel');
            label.textContent = calCursor.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' });
            var first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
            var daysIn = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
            var startOffset = first.getDay();
            var today = todayStr();
            var dows = '';
            for (var d = 0; d < 7; d++) dows += '<div class="cal-dow">' + I18N.dayName(d).slice(0, 4) + '</div>';
            var cells = [];
            for (var i = 0; i < startOffset; i++) cells.push('<div class="cal-day other"></div>');
            for (var dayNum = 1; dayNum <= daysIn; dayNum++) {
                var iso = calCursor.getFullYear() + '-' + String(calCursor.getMonth() + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
                var evs = '';
                State.data.homework.filter(function (h) { return h.due === iso && !h.done; }).forEach(function (h) {
                    evs += '<span class="cal-event hw">' + Dash.esc(h.subject) + '</span>';
                });
                State.data.exams.filter(function (x) { return x.date === iso; }).forEach(function (x) {
                    evs += '<span class="cal-event exam">' + Dash.esc(x.subject) + '</span>';
                });
                cells.push('<div class="cal-day' + (iso === today ? ' today' : '') + '"><span class="day-num">' + dayNum + '</span>' + evs + '</div>');
            }
            grid.innerHTML = dows + cells.join('');
        },

        // ---------- overview ----------
        renderOverview: function () {
            var today = todayStr();
            var overdue = State.data.homework.filter(function (h) { return !h.done && h.due < today; }).length;
            var doneToday = State.data.schedule.filter(function (x) { return x.done; }).length;
            var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
            set('statHomework', overdue);
            set('statExams', this.upcomingExams().length);
            set('statCompleted', doneToday);
            set('statStreak', State.data.gam.streak);

            var plan = document.getElementById('overviewPlan');
            if (plan) {
                if (!State.data.schedule.length) {
                    plan.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-day"></i>' + t('no_plan') + '</div>';
                } else {
                    plan.innerHTML = State.data.schedule.slice(0, 8).map(function (x) {
                        return '<div class="item"><button class="item-check' + (x.done ? ' checked' : '') + '" data-ov-sc="' + x.id + '"><i class="fas fa-check"></i></button>' +
                            '<div class="item-body"><div class="item-title' + (x.done ? ' done' : '') + '">' + Dash.esc(x.activity) + '</div>' +
                            '<div class="item-meta"><span>' + I18N.fmtTime(x.time) + '</span></div></div></div>';
                    }).join('');
                    plan.querySelectorAll('[data-ov-sc]').forEach(function (b) {
                        b.addEventListener('click', function () { Planner.toggleItem(b.dataset.ovSc); });
                    });
                }
            }
        },

        renderAll: function () {
            this.renderOverview(); this.renderClasses(); this.renderHomework();
            this.renderExams(); this.renderSchedule(); this.renderCalendar();
        }
    };
})();
