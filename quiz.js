// Back to School — quick self-quizzes (question, 4 options, one correct)
(function () {
    'use strict';

    function t(k) { return window.I18N.t(k); }

    window.Quiz = {
        add: function (e) {
            e.preventDefault();
            var subject = document.getElementById('qSubject').value.trim();
            var question = document.getElementById('qQuestion').value.trim();
            var options = [1, 2, 3, 4].map(function (i) { return document.getElementById('qOpt' + i).value.trim(); });
            var correct = +document.getElementById('qCorrect').value;
            if (!subject || !question || !options[0] || !options[1]) return;
            options = options.filter(function (o) { return o; });
            if (correct >= options.length) correct = 0;
            State.data.quizzes.unshift({
                id: State.uid(), subject: subject, question: question,
                options: options, correct: correct, done: false, createdAt: new Date().toISOString()
            });
            State.save();
            Planner.closeModal('modalQuiz');
            e.target.reset();
            this.render();
            window.Dash.toast(t('toast_saved'), 'success');
        },
        delete: function (id) {
            var self = this;
            window.Dash.confirm(t('confirm_delete'), function () {
                State.data.quizzes = State.data.quizzes.filter(function (q) { return q.id !== id; });
                State.save(); self.render();
                window.Dash.toast(t('toast_deleted'), 'info');
            });
        },
        check: function (id, radioName) {
            var q = State.data.quizzes.find(function (x) { return x.id === id; });
            if (!q || q.done) return;
            var picked = document.querySelector('input[name="' + radioName + '"]:checked');
            if (!picked) return;
            if (+picked.value === q.correct) {
                q.done = true;
                Game.addPoints(15, 'nav_quiz', q.subject);
                window.Dash.toast(t('quiz_right'), 'success');
                this.render();
            } else {
                window.Dash.toast(t('quiz_wrong'), 'error');
            }
        },
        render: function () {
            var list = document.getElementById('quizList');
            if (!list) return;
            var qs = State.data.quizzes;
            if (!qs.length) {
                list.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-question"></i>' + t('no_quizzes') + '</div>';
                return;
            }
            list.innerHTML = qs.map(function (q, idx) {
                var opts = q.options.map(function (o, i) {
                    return '<label class="quiz-option"><input type="radio" name="quiz-' + q.id + '" value="' + i + '"> ' + Dash.esc(o) + '</label>';
                }).join('');
                return '<div class="item" style="align-items:flex-start">' +
                    '<div class="item-body"><div class="item-meta" style="margin-bottom:6px">' +
                    '<span class="chip chip-primary">' + Dash.esc(q.subject) + '</span>' +
                    '<span>' + t('quiz_number') + ' ' + (qs.length - idx) + '</span>' +
                    (q.done ? '<span class="chip chip-success">' + t('quiz_done') + '</span>' : '') + '</div>' +
                    '<div class="item-title">' + Dash.esc(q.question) + '</div>' +
                    (q.done ? '' : '<div style="margin-top:8px; display:grid; gap:4px">' + opts + '</div>') +
                    '</div>' +
                    '<div class="item-actions" style="flex-direction:column">' +
                    (q.done ? '' : '<button class="btn btn-sm btn-accent" data-qcheck="' + q.id + '">' + t('quiz_check') + '</button>') +
                    '<button class="btn-icon" data-qdel="' + q.id + '"><i class="fas fa-trash"></i></button></div></div>';
            }).join('');
            list.querySelectorAll('[data-qcheck]').forEach(function (b) {
                b.addEventListener('click', function () { Quiz.check(b.dataset.qcheck, 'quiz-' + b.dataset.qcheck); });
            });
            list.querySelectorAll('[data-qdel]').forEach(function (b) {
                b.addEventListener('click', function () { Quiz.delete(b.dataset.qdel); });
            });
        }
    };
})();
