// Back to School — shared i18n (Arabic / English)
(function () {
    'use strict';

    var DICT = {
        ar: {
            app_name: 'العودة للمدرسة',
            // nav
            nav_overview: 'الرئيسية', nav_classes: 'مواد اليوم', nav_homework: 'الواجبات',
            nav_exams: 'الامتحانات', nav_schedule: 'الجدول اليومي', nav_calendar: 'التقويم',
            nav_focus: 'مؤقت المذاكرة', nav_achievements: 'الإنجازات', nav_parent: 'لوحة الوالدين',
            nav_settings: 'الإعدادات', logout: 'تسجيل الخروج',
            // common
            add: 'إضافة', save: 'حفظ', delete: 'حذف', cancel: 'إلغاء', close: 'إغلاق',
            subject: 'المادة', title: 'العنوان', due_date: 'تاريخ التسليم', priority: 'الأولوية',
            low: 'منخفضة', medium: 'متوسطة', high: 'عالية', teacher: 'المعلم', day: 'اليوم',
            time: 'الوقت', today: 'اليوم', confirm_delete: 'هل أنت متأكد من الحذف؟',
            copy: 'نسخ', generate: 'توليد', refresh: 'تحديث', all: 'الكل', pending: 'قيد الانتظار',
            completed: 'مكتمل', days_left: 'يوم متبقي', activity: 'النشاط', name: 'الاسم',
            empty_homework: 'لا توجد واجبات بعد', empty_exams: 'لا توجد امتحانات قادمة',
            empty_classes: 'لم تضف مواد بعد', empty_schedule: 'لم يتم إنشاء الجدول بعد',
            // overview
            welcome: 'مرحباً بك اليوم', stat_homework: 'واجب متأخر', stat_exams: 'امتحان قادم',
            stat_completed: 'مهمة مكتملة', stat_streak: 'أيام متتالية', todays_plan: 'خطة اليوم',
            quick_actions: 'إجراءات سريعة', no_plan: 'لم يتم إنشاء الجدول بعد — أنشئه من صفحة الجدول',
            // classes
            classes_title: 'مواد اليوم', add_class: 'إضافة مادة', class_name: 'اسم المادة',
            day_0: 'الأحد', day_1: 'الاثنين', day_2: 'الثلاثاء', day_3: 'الأربعاء',
            day_4: 'الخميس', day_5: 'الجمعة', day_6: 'السبت',
            // homework
            homework_title: 'الواجبات', add_homework: 'إضافة واجب', hw_subject: 'مادة الواجب',
            hw_title: 'وصف الواجب', mark_all_done: 'تم',
            // exams
            exams_title: 'الامتحانات', add_exam: 'إضافة امتحان', exam_subject: 'مادة الامتحان',
            exam_date: 'تاريخ الامتحان', exam_time: 'وقت الامتحان', no_exams: 'لا توجد امتحانات قادمة',
            nav_quiz: 'اختباراتي', quiz_title: 'الاختبارات السريعة', add_quiz: 'إضافة اختبار',
            quiz_subject: 'مادة الاختبار', quiz_question: 'السؤال', quiz_opt: 'الخيار',
            quiz_correct: 'الإجابة الصحيحة', quiz_check: 'تحقق', quiz_done: 'مكتمل',
            quiz_right: 'إجابة صحيحة! +15', quiz_wrong: 'إجابة خاطئة، راجع درسك وحاول مجدداً',
            no_quizzes: 'لا توجد اختبارات بعد — أضف واحداً للمراجعة', quiz_number: 'رقم',
            // schedule
            schedule_title: 'الجدول اليومي', auto_generate: 'توليد تلقائي',
            generate_hint: 'يُنشأ الجدول من أوقاتك المدرجة في الإعدادات وموادك وواجباتك',
            add_item: 'إضافة بند',
            // calendar
            calendar_title: 'التقويم',
            // focus
            focus_title: 'مؤقت المذاكرة', work: 'مذاكرة', short_break: 'استراحة قصيرة',
            long_break: 'استراحة طويلة', start: 'بدء', pause: 'إيقاف مؤقت', resume: 'متابعة',
            reset: 'تصفير', sessions_today: 'جلسات اليوم', minutes_today: 'دقائق اليوم',
            focus_settings: 'إعدادات المؤقت', work_min: 'مدة المذاكرة', short_min: 'الاستراحة القصيرة',
            long_min: 'الاستراحة الطويلة', rounds: 'جولات قبل الاستراحة الطويلة',
            history: 'سجل الأيام الماضية',
            // achievements
            ach_title: 'الإنجازات', points: 'نقطة', level: 'المستوى', xp_progress: 'خبرة للمستوى التالي',
            badges: 'الأوسمة', points_log: 'سجل النقاط', current_points: 'رصيدك',
            badge_first_hw: 'أول واجب', badge_hw10: '١٠ واجبات', badge_streak7: 'أسبوع نشط',
            badge_pomo10: '١٠ جلسات مذاكرة', badge_points500: '٥٠٠ نقطة', badge_level5: 'المستوى ٥',
            rewards_shop: 'متجر المكافآت', rewards_hint: 'اطلب مكافأة من والديك بنقاطك',
            redeem: 'طلب استبدال', requested: 'بانتظار موافقة الوالدين', redeemed: 'تم الاستبدال',
            no_rewards: 'لم يضف والداك مكافآت بعد',
            // parent (student side)
            parent_title: 'لوحة الوالدين', parent_desc: 'شارك هذا الرمز مع والديك ليتابعوا تقدمك',
            parent_code: 'رمز المتابعة', generate_code: 'توليد رمز جديد', code_copied: 'تم نسخ الرمز!',
            share_hint: 'افتح صفحة الوالدين وأدخل هذا الرمز',
            // settings
            settings_title: 'الإعدادات', daily_routine: 'الروتين اليومي', wake_up: 'وقت الاستيقاظ',
            sleep: 'وقت النوم', school_start: 'بداية الدوام', school_end: 'نهاية الدوام',
            breakfast: 'الفطور', lunch: 'الغداء', dinner: 'العشاء', exercise: 'الرياضة', shower: 'الاستحمام',
            appearance: 'المظهر', theme: 'السمة', dark: 'داكن', light: 'فاتح',
            notifications: 'الإشعارات', notif_homework: 'تذكير الواجبات', notif_exams: 'تذكير الامتحانات',
            notif_daily: 'تذكير يومي بالجدول', notif_enable: 'تفعيل إشعارات المتصفح',
            data: 'البيانات', export_data: 'تصدير نسخة', import_data: 'استيراد نسخة',
            security: 'الأمان', change_password: 'تغيير كلمة المرور', current_pw: 'كلمة المرور الحالية',
            new_pw: 'كلمة المرور الجديدة', confirm_pw: 'تأكيد كلمة المرور',
            sync_status: 'المزامنة', synced: 'متزامن مع السحابة', sync_now: 'مزامنة الآن',
            offline_only: 'محلي (غير متصل)',
            // auth
            login_title: 'مرحباً بعودتك!', login_subtitle: 'سجّل دخولك للمتابعة',
            email: 'البريد الإلكتروني', password: 'كلمة المرور', remember: 'تذكرني',
            forgot: 'نسيت كلمة المرور؟', login_submit: 'تسجيل الدخول', no_account: 'ليس لديك حساب؟',
            create_account: 'أنشئ حساباً جديداً', back_home: 'العودة للرئيسية',
            parent_login: 'دخول الوالدين', signup_title: 'حساب جديد', signup_subtitle: 'ابدأ تنظيم يومك الدراسي',
            display_name: 'الاسم الكامل', confirm_password: 'تأكيد كلمة المرور', signup_submit: 'إنشاء الحساب',
            have_account: 'لديك حساب بالفعل؟', go_login: 'سجّل دخولك',
            pw_strength: 'قوة كلمة المرور: ', pw_weak: 'ضعيفة', pw_medium: 'متوسطة', pw_strong: 'قوية',
            hero_tag: 'نظّم يومك الدراسي من الاستيقاظ حتى النوم',
            hero_title_a: 'خطتك الدراسية', hero_hl: 'الكاملة', hero_title_b: ' تبدأ هنا',
            hero_sub: 'متابعة الواجبات والامتحانات والجدول اليومي، مع مؤقت مذاكرة وإنجازات تحفّزك — واطمئنان والديك بلمحة بسيطة.',
            cta_start: 'ابدأ الآن مجاناً', cta_parent: 'دخول الوالدين',
            feat_t1: 'واجبات وامتحانات', feat_d1: 'تبديل الأولوية ومتابعة الاستحقاق دون نسيان أي تسليم.',
            feat_t2: 'جدول ذكي', feat_d2: 'جدول يومي كامل من الاستيقاظ حتى النوم بضغطة واحدة.',
            feat_t3: 'إنجازات ومكافآت', feat_d3: 'نقاط ومستويات وأوسمة ومكافآت يمنحك إياها والداك.',
            feat_t4: 'متابعة الوالدين', feat_d4: 'رمز مشاركة بسيط يمنح والديك رؤية تقدمك.',
            footer_note: 'منصّة تنظيم الطالب — صُنعت بحب للطلاب العرب',
            // toasts / errors
            toast_saved: 'تم الحفظ', toast_deleted: 'تم الحذف', toast_done: 'أحسنت! +نقاط',
            toast_gen: 'تم إنشاء الجدول', toast_pw_changed: 'تم تغيير كلمة المرور',
            toast_synced: 'تمت المزامنة', toast_exported: 'تم تنزيل الملف', toast_imported: 'تم الاستيراد',
            toast_reward_req: 'تم إرسال الطلب لوالديك',
            err_invalid_email: 'البريد الإلكتروني غير صالح.',
            err_wrong_credentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
            err_email_taken: 'البريد الإلكتروني مسجل بالفعل.',
            err_name_length: 'يجب أن يكون الاسم بين ٢ و ٥٠ حرفاً.',
            err_pw_short: 'كلمة المرور ٦ أحرف على الأقل.',
            err_pw_match: 'كلمتا المرور غير متطابقتين.',
            err_locked: 'تم حظر الحساب مؤقتاً. حاول بعد ',
            err_locked_min: ' دقيقة.',
            err_device: 'هذا الحساب مرتبط بجهاز آخر.',
            err_pw_current: 'كلمة المرور الحالية غير صحيحة.',
            err_generic: 'حدث خطأ، حاول مجدداً.',
            pw_reset_sent: 'أُرسلت رابط إعادة التعيين إلى بريدك'
        },
        en: {
            app_name: 'Back to School',
            nav_overview: 'Overview', nav_classes: 'Today\'s Classes', nav_homework: 'Homework',
            nav_exams: 'Exams', nav_schedule: 'Daily Schedule', nav_calendar: 'Calendar',
            nav_focus: 'Study Timer', nav_achievements: 'Achievements', nav_parent: 'Parent Zone',
            nav_settings: 'Settings', logout: 'Log out',
            add: 'Add', save: 'Save', delete: 'Delete', cancel: 'Cancel', close: 'Close',
            subject: 'Subject', title: 'Title', due_date: 'Due date', priority: 'Priority',
            low: 'Low', medium: 'Medium', high: 'High', teacher: 'Teacher', day: 'Day',
            time: 'Time', today: 'Today', confirm_delete: 'Are you sure you want to delete?',
            copy: 'Copy', generate: 'Generate', refresh: 'Refresh', all: 'All', pending: 'Pending',
            completed: 'Done', days_left: 'days left', activity: 'Activity', name: 'Name',
            empty_homework: 'No homework yet', empty_exams: 'No upcoming exams',
            empty_classes: 'No classes added yet', empty_schedule: 'Schedule not created yet',
            welcome: 'Welcome back today', stat_homework: 'Overdue homework', stat_exams: 'Upcoming exam',
            stat_completed: 'Completed tasks', stat_streak: 'Day streak', todays_plan: 'Today\'s plan',
            quick_actions: 'Quick actions', no_plan: 'No schedule yet — create one on the Schedule page',
            classes_title: 'Today\'s Classes', add_class: 'Add class', class_name: 'Class name',
            day_0: 'Sunday', day_1: 'Monday', day_2: 'Tuesday', day_3: 'Wednesday',
            day_4: 'Thursday', day_5: 'Friday', day_6: 'Saturday',
            homework_title: 'Homework', add_homework: 'Add homework', hw_subject: 'Subject',
            hw_title: 'Homework description', mark_all_done: 'Done',
            exams_title: 'Exams', add_exam: 'Add exam', exam_subject: 'Exam subject',
            exam_date: 'Exam date', exam_time: 'Exam time', no_exams: 'No upcoming exams',
            nav_quiz: 'My Quizzes', quiz_title: 'Quick Quizzes', add_quiz: 'Add quiz',
            quiz_subject: 'Quiz subject', quiz_question: 'Question', quiz_opt: 'Option',
            quiz_correct: 'Correct answer', quiz_check: 'Check', quiz_done: 'Completed',
            quiz_right: 'Correct! +15', quiz_wrong: 'Wrong answer — review and try again',
            no_quizzes: 'No quizzes yet — add one to revise', quiz_number: 'Q',
            schedule_title: 'Daily Schedule', auto_generate: 'Auto-generate',
            generate_hint: 'Built from your routine times, classes and pending homework',
            add_item: 'Add item',
            calendar_title: 'Calendar',
            focus_title: 'Study Timer', work: 'Focus', short_break: 'Short break',
            long_break: 'Long break', start: 'Start', pause: 'Pause', resume: 'Resume',
            reset: 'Reset', sessions_today: 'Sessions today', minutes_today: 'Minutes today',
            focus_settings: 'Timer settings', work_min: 'Focus minutes', short_min: 'Short break',
            long_min: 'Long break', rounds: 'Rounds before long break',
            history: 'Last days',
            ach_title: 'Achievements', points: 'pts', level: 'Level', xp_progress: 'XP to next level',
            badges: 'Badges', points_log: 'Points log', current_points: 'Your balance',
            badge_first_hw: 'First homework', badge_hw10: '10 homeworks', badge_streak7: 'Week streak',
            badge_pomo10: '10 study sessions', badge_points500: '500 points', badge_level5: 'Level 5',
            rewards_shop: 'Rewards shop', rewards_hint: 'Spend points on rewards your parents set',
            redeem: 'Request', requested: 'Awaiting parent approval', redeemed: 'Redeemed',
            no_rewards: 'Your parents haven\'t added rewards yet',
            parent_title: 'Parent Zone', parent_desc: 'Share this code with your parents to track your progress',
            parent_code: 'Tracking code', generate_code: 'Generate new code', code_copied: 'Code copied!',
            share_hint: 'Open the parent page and enter this code',
            settings_title: 'Settings', daily_routine: 'Daily routine', wake_up: 'Wake up',
            sleep: 'Sleep', school_start: 'School starts', school_end: 'School ends',
            breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', exercise: 'Exercise', shower: 'Shower',
            appearance: 'Appearance', theme: 'Theme', dark: 'Dark', light: 'Light',
            notifications: 'Notifications', notif_homework: 'Homework reminders', notif_exams: 'Exam reminders',
            notif_daily: 'Daily schedule reminder', notif_enable: 'Enable browser notifications',
            data: 'Data', export_data: 'Export backup', import_data: 'Import backup',
            security: 'Security', change_password: 'Change password', current_pw: 'Current password',
            new_pw: 'New password', confirm_pw: 'Confirm password',
            sync_status: 'Sync', synced: 'Synced with cloud', sync_now: 'Sync now',
            offline_only: 'Local only (offline)',
            login_title: 'Welcome back!', login_subtitle: 'Sign in to continue',
            email: 'Email', password: 'Password', remember: 'Remember me',
            forgot: 'Forgot password?', login_submit: 'Sign in', no_account: 'No account yet?',
            create_account: 'Create one', back_home: 'Back to home',
            parent_login: 'Parent access', signup_title: 'New account', signup_subtitle: 'Start organising your school days',
            display_name: 'Full name', confirm_password: 'Confirm password', signup_submit: 'Create account',
            have_account: 'Already have an account?', go_login: 'Sign in',
            pw_strength: 'Password strength: ', pw_weak: 'Weak', pw_medium: 'Medium', pw_strong: 'Strong',
            hero_tag: 'Your school day, from wake-up to bedtime',
            hero_title_a: 'Your complete', hero_hl: 'study plan', hero_title_b: ' starts here',
            hero_sub: 'Homework, exams, a smart daily schedule, a focus timer and achievements that keep you going — plus simple peace of mind for your parents.',
            cta_start: 'Start free', cta_parent: 'Parent access',
            feat_t1: 'Homework & exams', feat_d1: 'Prioritise and never miss a deadline again.',
            feat_t2: 'Smart schedule', feat_d2: 'A full daily plan from wake-up to sleep in one click.',
            feat_t3: 'Points & rewards', feat_d3: 'Levels, badges and rewards your parents unlock for you.',
            feat_t4: 'Parent tracking', feat_d4: 'One share code gives parents a progress snapshot.',
            footer_note: 'The student planning app — made with care',
            toast_saved: 'Saved', toast_deleted: 'Deleted', toast_done: 'Nice! +points',
            toast_gen: 'Schedule created', toast_pw_changed: 'Password changed',
            toast_synced: 'Synced', toast_exported: 'Backup downloaded', toast_imported: 'Backup imported',
            toast_reward_req: 'Request sent to your parents',
            err_invalid_email: 'Invalid email address.',
            err_wrong_credentials: 'Invalid email or password.',
            err_email_taken: 'Email is already registered.',
            err_name_length: 'Name must be between 2 and 50 characters.',
            err_pw_short: 'Password must be at least 6 characters.',
            err_pw_match: 'Passwords do not match.',
            err_locked: 'Account temporarily locked. Try again in ',
            err_locked_min: ' minutes.',
            err_device: 'This account is bound to another device.',
            err_pw_current: 'Current password is incorrect.',
            err_generic: 'Something went wrong. Try again.',
            pw_reset_sent: 'Password reset link sent to your email'
        }
    };

    var KEY = 'bts:v1:lang';

    var I18N = {
        lang: 'ar',
        t: function (key) {
            return DICT[this.lang][key] || DICT.ar[key] || key;
        },
        setLang: function (lang) {
            this.lang = lang === 'en' ? 'en' : 'ar';
            localStorage.setItem(KEY, this.lang);
            document.documentElement.lang = this.lang;
            document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
            this.apply();
        },
        init: function (saved) {
            this.lang = saved || localStorage.getItem(KEY) || 'ar';
            document.documentElement.lang = this.lang;
            document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
            this.apply();
        },
        apply: function (root) {
            var self = this;
            var scope = root || document;
            scope.querySelectorAll('[data-i18n]').forEach(function (el) {
                el.textContent = self.t(el.getAttribute('data-i18n'));
            });
            scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
                el.placeholder = self.t(el.getAttribute('data-i18n-placeholder'));
            });
            scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
                el.title = self.t(el.getAttribute('data-i18n-title'));
            });
            var label = document.getElementById('langLabel');
            if (label) label.textContent = self.lang === 'ar' ? 'EN' : 'عربي';
        },
        dayName: function (idx) { return this.t('day_' + idx); },
        fmtDate: function (dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr + 'T00:00:00').toLocaleDateString(
                this.lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
        },
        fmtTime: function (hhmm) {
            if (!hhmm) return '';
            var p = hhmm.split(':'), h = +p[0];
            var period = h >= 12 ? (this.lang === 'ar' ? 'م' : 'PM') : (this.lang === 'ar' ? 'ص' : 'AM');
            return (h % 12 || 12) + ':' + p[1] + ' ' + period;
        }
    };

    window.I18N = I18N;
})();
