// Back to School — points, XP, levels, streaks, badges
(function () {
    'use strict';

    function t(key) { return window.I18N.t(key); }

    var BADGES = [
        { id: 'first_hw', icon: 'fa-check', label: 'badge_first_hw', test: function (g) { return g.hwDone >= 1; } },
        { id: 'hw10', icon: 'fa-book', label: 'badge_hw10', test: function (g) { return g.hwDone >= 10; } },
        { id: 'streak7', icon: 'fa-fire', label: 'badge_streak7', test: function (g) { return g.streak >= 7; } },
        { id: 'pomo10', icon: 'fa-clock', label: 'badge_pomo10', test: function (g) { return g.pomoDone >= 10; } },
        { id: 'points500', icon: 'fa-coins', label: 'badge_points500', test: function (g) { return g.points >= 500; } },
        { id: 'level5', icon: 'fa-star', label: 'badge_level5', test: function (g) { return g.level >= 5; } }
    ];

    function todayStr() { return new Date().toISOString().slice(0, 10); }

    window.Game = {
        addPoints: function (pts, labelKey, extraKey) {
            var g = State.data.gam;
            g.points += pts;
            g.xp += pts;
            g.level = 1 + Math.floor(g.xp / 100);
            g.log.unshift({ label: t(labelKey) + (extraKey ? ': ' + extraKey : ''), pts: pts, at: new Date().toISOString() });
            if (g.log.length > 80) g.log.length = 80;
            this.checkBadges();
            State.save();
        },

        spendPoints: function (pts, label) {
            var g = State.data.gam;
            if (g.points < pts) return false;
            g.points -= pts;
            g.log.unshift({ label: label, pts: -pts, at: new Date().toISOString() });
            State.save();
            return true;
        },

        updateStreak: function () {
            var g = State.data.gam;
            var today = todayStr();
            if (g.lastActive === today) return;
            var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            g.streak = g.lastActive === yesterday ? g.streak + 1 : 1;
            g.lastActive = today;
            State.save();
        },

        checkBadges: function () {
            var g = State.data.gam;
            BADGES.forEach(function (b) {
                if (g.badges.indexOf(b.id) === -1 && b.test(g)) {
                    g.badges.push(b.id);
                    g.points += 50;
                    g.log.unshift({ label: t('nav_achievements') + ': ' + t(b.label), pts: 50, at: new Date().toISOString() });
                    if (window.Dash) window.Dash.toast(t(b.label) + ' 🏅', 'success');
                }
            });
        },

        render: function () {
            var g = State.data.gam;
            var xpPct = (g.xp % 100);
            var ring = document.getElementById('levelRing');
            if (ring) {
                ring.style.setProperty('--pct', xpPct);
                ring.querySelector('b').textContent = g.level;
            }
            var ptsEl = document.getElementById('pointsBalance');
            if (ptsEl) ptsEl.textContent = g.points + ' ' + t('points');
            var xpEl = document.getElementById('xpText');
            if (xpEl) xpEl.textContent = xpPct + ' / 100 ' + t('xp_progress');

            var badgesEl = document.getElementById('badgesGrid');
            if (badgesEl) {
                badgesEl.innerHTML = BADGES.map(function (b) {
                    var earned = g.badges.indexOf(b.id) !== -1;
                    return '<div class="card badge-card' + (earned ? ' earned' : '') + '">' +
                        '<div class="badge-icon"><i class="fas ' + b.icon + '"></i></div>' +
                        '<b>' + t(b.label) + '</b><span>' + (earned ? '+50' : '—') + '</span></div>';
                }).join('');
            }

            var logEl = document.getElementById('pointsLog');
            if (logEl) {
                logEl.innerHTML = g.log.length ? g.log.map(function (e) {
                    return '<div class="log-item"><span>' + Dash.esc(e.label) + ' <small class="hint">' + Dash.fmtDate(e.at.slice(0, 10)) + '</small></span>' +
                        '<span class="pts">' + (e.pts > 0 ? '+' : '') + e.pts + '</span></div>';
                }).join('') : '<div class="empty-state">' + t('points_log') + '</div>';
            }

            var rewardsEl = document.getElementById('rewardsList');
            if (rewardsEl) {
                var rewards = State.data.rewards || [];
                if (!rewards.length) {
                    rewardsEl.innerHTML = '<div class="empty-state"><i class="fas fa-gift"></i>' + t('no_rewards') + '</div>';
                } else {
                    rewardsEl.innerHTML = rewards.map(function (r) {
                        var btn = '';
                        if (r.status === 'available') btn = '<button class="btn btn-sm btn-accent" data-redeem="' + r.id + '">' + t('redeem') + '</button>';
                        else if (r.status === 'pending') btn = '<span class="chip chip-warning">' + t('requested') + '</span>';
                        else btn = '<span class="chip chip-success">' + t('redeemed') + '</span>';
                        return '<div class="reward-item"><div class="reward-body"><div class="reward-label">' + Dash.esc(r.label) + '</div>' +
                            '<div class="reward-cost">' + r.cost + ' ' + t('points') + '</div></div>' + btn + '</div>';
                    }).join('');
                    rewardsEl.querySelectorAll('[data-redeem]').forEach(function (b) {
                        b.addEventListener('click', function () { Game.redeem(b.dataset.redeem); });
                    });
                }
            }
        },

        redeem: function (id) {
            var r = (State.data.rewards || []).find(function (x) { return x.id === id; });
            if (!r || r.status !== 'available') return;
            if (State.data.gam.points < r.cost) { window.Dash.toast(t('current_points') + ': ' + State.data.gam.points, 'error'); return; }
            this.spendPoints(r.cost, r.label);
            r.status = 'pending';
            State.save();
            this.render();
            window.Dash.toast(t('toast_reward_req'), 'success');
        }
    };
})();
