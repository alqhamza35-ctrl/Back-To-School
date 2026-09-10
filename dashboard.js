// ========================================
// Back to School - Dashboard Module
// ========================================

(function() {
    'use strict';

    // ========================================
    // Security Utilities
    // ========================================
    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function sanitizeInput(str) {
        return escapeHtml(str).trim();
    }

    // ========================================
    // Sound System
    // ========================================
    function playNotificationSound() {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var notes = [880, 1100, 1320];
            notes.forEach(function(freq, i) {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                var startTime = ctx.currentTime + (i * 0.15);
                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
                osc.start(startTime);
                osc.stop(startTime + 0.3);
            });
        } catch (e) {}
    }

    // Session timeout (30 minutes inactivity)
    let sessionTimer = null;
    const SESSION_TIMEOUT = 30 * 60 * 1000;

    function resetSessionTimer() {
        if (sessionTimer) clearTimeout(sessionTimer);
        sessionTimer = setTimeout(function() {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }, SESSION_TIMEOUT);
    }

    function setupSessionTracking() {
        ['click', 'keypress', 'mousemove', 'scroll'].forEach(function(event) {
            document.addEventListener(event, resetSessionTimer, { passive: true });
        });
        resetSessionTimer();
    }

    // Rate limit AI responses
    let lastAiCall = 0;
    const AI_RATE_LIMIT = 1000;

    // State
    let currentUser = null;
    let currentPage = 'dashboard';
    let conversations = [];
    let currentConversation = null;
    let homework = [];
    let exams = [];
    let classes = [];
    let dailySchedule = [];
    let calendarDate = new Date();

    // Gamification State
    let gamification = {
        points: 0,
        xp: 0,
        level: 1,
        totalCompletedHW: 0,
        totalPomodoroSessions: 0,
        streak: 0,
        lastActiveDate: '',
        badges: [],
        pointsLog: []
    };

    // Pomodoro State
    let pomodoro = {
        settings: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, roundsBeforeLong: 4 },
        todayStats: { date: '', completedSessions: 0, totalMinutes: 0, currentStreak: 0, history: [] }
    };
    let pomoTimer = null;
    let pomoState = 'idle';
    let pomoMode = 'work';
    let pomoBreakType = 'short';
    let pomoTimeLeft = 25 * 60;
    let pomoTotalTime = 25 * 60;
    let pomoRoundsDone = 0;

    // Parent Dashboard State
    let parentCode = '';

    // Task Tracking State
    let timeBlocks = [];
    let dailyActivity = {};

    // Notification Settings State
    let notificationSettings = {
        homework: true,
        exams: true,
        schedule: true,
        dailyReminder: true
    };

    // Theme State
    let currentTheme = 'dark';

    // Language State
    let currentLang = 'ar';

    // Translations
    var translations = {
        ar: {
            app_name: 'العودة للمدرسة',
            nav_dashboard: 'لوحة التحكم',
            nav_classes: 'مواد اليوم',
            nav_homework: 'الواجبات',
            nav_exams: 'الامتحانات',
            nav_schedule: 'الجدول اليومي',
            nav_calendar: 'التقويم',
            nav_pomodoro: 'مؤقت المذاكرة',
            nav_achievements: 'الإنجازات',
            nav_parent: 'لوحة الوالدين',
            nav_tasktracking: 'تتبع المهام',
            nav_settings: 'الإعدادات',
            conversations: 'المحادثات',
            no_conversations: 'لا توجد محادثات بعد',
            daily_schedule: 'جدول اليوم',
            no_schedule_yet: 'لم يتم إنشاء الجدول بعد',
            logout: 'تسجيل الخروج',
            page_dashboard: 'لوحة التحكم',
            welcome_today: 'مرحباً بك اليوم',
            stat_homework: 'واجب مستحق',
            stat_exams: 'امتحان قادم',
            stat_completed: 'مهمة مكتملة',
            stat_pending: 'مهمة معلقة',
            stat_classes: 'مادة اليوم',
            ai_title: 'مساعد التخطيط الذكي',
            ai_subtitle: 'دعني أساعدك في تنظيم يومك',
            btn_generate_schedule: 'إنشاء الجدول',
            ai_clear_chat: 'مسح المحادثة',
            ai_export_chat: 'تصدير المحادثة',
            ai_show_tips: 'نصائح الدراسة',
            ai_show_stats: 'إحصائياتي',
            ai_welcome: 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم?',
            ai_help_schedule: 'إنشاء جدول يومي',
            ai_help_hw: 'عرض الواجبات والامتحانات',
            ai_help_tips: 'نصائح للدراسة',
            ai_prompt: 'اكتب رسالتك هنا!',
            ai_no_chat: 'لا توجد محادثة',
            ai_no_chat_desc: 'ابدأ محادثة أولاً',
            ai_exported: 'تم التصدير',
            ai_exported_desc: 'تم تصدير المحادثة بنجاح',
            ai_rate_limit: 'يرجى الانتظار قليلاً قبل إرسال رسالة أخرى.',
            page_classes: 'مواد اليوم',
            btn_add_class: 'إضافة مادة',
            page_homework: 'إدارة الواجبات',
            btn_add_homework: 'إضافة واجب',
            page_exams: 'إدارة الامتحانات',
            btn_add_exam: 'إضافة امتحان',
            page_schedule: 'الجدول اليومي الذكي',
            btn_regenerate: 'إعادة إنشاء الجدول',
            page_calendar: 'التقويم',
            page_pomodoro: 'مؤقت المذاكرة (بومودورو)',
            page_achievements: 'الإنجازات والنقاط',
            page_parent: 'لوحة متابعة الوالدين',
            page_tasktracking: 'تتبع المهام الدراسية',
            page_settings: 'الإعدادات',
            settings_subtitle: 'تخصيص حسابك',
            classes_subtitle: 'المواد التي درستها اليوم',
            hw_subtitle: 'إدارة واجباتك المدرسية',
            exams_subtitle: 'تتبع امتحاناتك القادمة',
            schedule_subtitle: 'خطط يومك بذكاء',
            calendar_subtitle: 'عرض أحداثك ومواعيدك',
            pomodoro_subtitle: 'مؤقت المذاكرة',
            pomodoro_desc: 'تقنية بومودورو للمذاكرة الفعالة',
            achievements_subtitle: 'نقاطك وشاراتك',
            tasktracking_subtitle: 'تتبع ساعات المذاكرة والتقدم',
            parent_subtitle: 'متابعة التقدم الدراسي',
            settings_account: 'معلومات الحساب',
            settings_notifications: 'إعدادات الإشعارات',
            settings_password: 'تغيير كلمة المرور',
            settings_backup: 'النسخ الاحتياطي والبيانات',
            settings_account_section: 'الحساب',
            modal_add_homework: 'إضافة واجب جديد',
            modal_add_class: 'إضافة مادة للمذاكرة',
            modal_add_exam: 'إضافة امتحان جديد',
            filter_all: 'الكل',
            filter_today: 'اليوم',
            filter_upcoming: 'القادم',
            filter_completed: 'مكتمل',
            level_beginner: 'مبتدئ',
            xp_points: 'نقطة خبرة',
            badge_first_hw: 'أول واجب',
            badge_five_hw: '5 واجبات',
            badge_ten_hw: '10 واجبات',
            badge_first_exam: 'أول امتحان',
            badge_pomo_5: '5 جولات بومودورو',
            badge_pomo_20: '20 جولة بومودورو',
            badge_streak_3: '3 أيام متتالية',
            badge_streak_7: '7 أيام متتالية',
            badge_level_5: 'المستوى 5',
            badge_level_10: 'المستوى 10',
            badges_title: 'الشارات',
            points_log_title: 'سجل النقاط',
            no_points: 'لم تكسب نقاطاً بعد',
            daily_activity: 'النشاط اليومي',
            daily_activity_hint: 'أكمل مهامك اليومية لكسب نقاط إضافية',
            pomodoro_work: 'مذاكَرة',
            pomodoro_short: 'استراحة قصيرة',
            pomodoro_long: 'استراحة طويلة',
            pomodoro_start: 'بدء',
            pomodoro_pause: 'إيقاف مؤقت',
            pomodoro_reset: 'إعادة',
            pomodoro_skip: 'تخطي',
            pomodoro_sessions: 'جولات مكتملة',
            pomodoro_minutes: 'دقيقة مذاكرة',
            pomodoro_streak: 'أطول سلسلة',
            pomodoro_history: 'سجل الجولات',
            pomodoro_no_history: 'لا توجد جولات مسجلة بعد',
            pomodoro_stats: 'إحصائيات اليوم',
            pomodoro_work_min: 'المذاكرة (دقائق)',
            pomodoro_short_min: 'استراحة قصيرة (دقائق)',
            pomodoro_long_min: 'استراحة طويلة (دقائق)',
            pomodoro_rounds: 'جولات قبل استراحة طويلة',
            schedule_empty_hint: 'اضغط "إنشاء الجدول" لإنشاء جدول يومك',
            schedule_go_school: 'الذهاب للمدرسة',
            schedule_go_school_desc: 'السفر للمدرسة',
            schedule_study: 'مذاكرة',
            schedule_return_home: 'العودة للمنزل',
            schedule_lunch_break: 'استراحة وغداء',
            schedule_study_hw_time: 'وقت المذاكرة والواجبات',
            schedule_general_review: 'مراجعة عامة',
            schedule_physical: 'نشاط بدني',
            schedule_sleep_desc: 'نوم هادئ',
            pw_err_too_short: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل.',
            pw_err_no_match: 'كلمتا المرور الجديدتان غير متطابقتين.',
            pw_err_unexpected: 'حدث خطأ غير متوقع.',
            pw_err_current_wrong: 'كلمة المرور الحالية غير صحيحة.',
            pw_err_change_failed: 'حدث خطأ أثناء تغيير كلمة المرور.',
            level_titles: ['مبتدئ', 'متوسط', 'متمرس', 'خبير', 'سيد', 'أسطوري'],
            time_am: 'ص',
            time_pm: 'م',
            tip_time: 'خصص 25 دقيقة للمذاكرة + 5 دقائق استراحة',
            tip_difficult: 'ركز على المادة الصعبة أولاً',
            tip_sleep: 'حافظ على نوم كافٍ (7-8 ساعات)',
            tip_breakfast: 'تناول إفطار صحي',
            tip_phone: 'ابعد الهاتف أثناء المذاكرة',
            parent_tracking_code: 'رمز المتابعة',
            parent_share: 'شارك هذا الرمز مع ولي الأمر لمتابعة تقدمك',
            parent_generate: 'إنشاء رمز جديد',
            parent_completed_hw: 'واجب مكتمل',
            parent_pending_hw: 'واجب متبقي',
            parent_study_hours: 'ساعة مذاكرة',
            parent_points: 'نقطة',
            parent_hw_progress: 'نسب إنجاز الواجبات',
            parent_study_activity: 'نشاط المذاكَرة (آخر 7 أيام)',
            parent_upcoming_exams: 'الامتحانات القادمة',
            parent_no_exams: 'لا توجد امتحانات قادمة',
            parent_daily_schedule: 'جدول اليوم',
            parent_no_schedule: 'لم يتم إنشاء جدول بعد',
            tracking_weekly_hours: 'ساعة مذاكَرة هذا الأسبوع',
            tracking_completed: 'بلوك مكتمل',
            tracking_streak: 'أيام متتالية',
            tracking_efficiency: 'نسبة الإنجاز',
            tracking_weekly_activity: 'نشاط هذا الأسبوع',
            tracking_today_tasks: 'مهام اليوم',
            tracking_add_block: 'إضافة بلوك وقت جديد',
            tracking_time_blocks: 'بلوكات الوقت',
            tracking_no_blocks: 'لم تضف بلوكات وقت بعد',
            tracking_habit_analysis: 'تحليل العادات الذكي',
            tracking_no_habits: 'أضف بيانات أكثر للحصول على تحليلات ذكية',
            task_title: 'المهمة',
            task_subject: 'المادة',
            task_start: 'وقت البداية',
            task_end: 'وقت النهاية',
            task_priority: 'الأولوية',
            task_type: 'النوع',
            priority_high: 'عالية',
            priority_medium: 'متوسطة',
            priority_low: 'منخفضة',
            type_study: 'مذاكرة',
            type_review: 'مراجعة',
            type_homework: 'واجب',
            type_project: 'مشروع',
            btn_add: 'إضافة',
            save: 'حفظ',
            cancel: 'إلغاء',
            close: 'إغلاق',
            notif_homework: 'إشعارات الواجبات',
            notif_exams: 'إشعارات الامتحانات',
            notif_schedule: 'تذكيرات الجدول',
            notif_daily: 'تذكير النشاط اليومي',
            export_data: 'تصدير البيانات',
            export_desc: 'تحميل نسخة احتياطية من جميع بياناتك',
            btn_export: 'تصدير',
            import_data: 'استيراد البيانات',
            import_desc: 'استعادة البيانات من نسخة احتياطية',
            btn_import: 'استيراد',
            btn_logout: 'تسجيل الخروج',
            schedule_settings: 'إعدادات اليوم',
            schedule_school_start: 'بداية الدوام',
            schedule_school_end: 'نهاية الدوام',
            schedule_wake: 'وقت الاستيقاظ',
            schedule_sleep: 'وقت النوم',
            schedule_breakfast: 'وجبة الإفطار',
            schedule_lunch: 'وجبة الغداء',
            schedule_dinner: 'وجبة العشاء',
            schedule_exercise: 'وقت التمرين',
            schedule_shower: 'وقت الاستحمام',
            confirm_delete_hw: 'حذف هذا الواجب؟',
            confirm_delete_exam: 'حذف هذا الامتحان؟',
            confirm_delete_class: 'حذف المادة؟',
            confirm_delete_block: 'حذف بلوك الوقت؟',
            no_exams: 'لا توجد امتحانات',
            no_exams_desc: 'أضف امتحاناتك القادمة هنا',
            no_hw: 'لا توجد واجبات',
            no_hw_desc: 'ابدأ بإضافة واجباتك هنا',
            no_classes: 'لم تضف مواد اليوم بعد',
            no_classes_desc: 'أضف المواد التي درستها اليوم لتظهر في جدول المذاكَرة',
            today_events: 'حداث اليوم',
            no_events: 'لا توجد أحداث لهذا اليوم',
            exams_tomorrow: 'امتحانات غداً',
            no_exams_tomorrow: 'لا توجد امتحانات غداً',
            estimated_study: 'وقت المذاكَرة المقدر:',
            minutes: 'دقيقة',
            subjects_count: 'عدد المواد:',
            tb_title_ph: 'مثال: مراجعة رياضيات',
            tb_subject_ph: 'مثال: رياضيات',
            hw_title_ph: 'مثال: تمارين رياضيات',
            hw_subject_ph: 'مثال: رياضيات',
            hw_desc_ph: 'أضف تفاصيل الواجب...',
            class_name_ph: 'مثال: رياضيات، علوم، تاريخ...',
            class_notes_ph: 'أضف ملاحظات على المادة...',
            exam_name_ph: 'مثال: امتحان نهائي',
            exam_subject_ph: 'مثال: علوم',
            exam_notes_ph: 'أضف ملاحظات أو مذاكرة مقترحة...',
            toast_theme_changed: 'تم تبديل السمة',
            toast_dark: 'الوضع المظلم',
            toast_light: 'الوضع الفاتح',
            toast_daily_reminder: 'تذكير يومي: لا تنسَ متابعة جدولك!',
            toast_reminder_title: 'تذكير',
            toast_block_added: 'تمت إضافة بلوك الوقت بنجاح',
            toast_export_success: 'تم تصدير جميع البيانات بنجاح',
            toast_export_title: 'تم التصدير',
            toast_import_error: 'ملف الاستيراد غير صالح',
            toast_import_confirm: 'سيتم استبدال جميع بياناتك الحالية بالبيانات المستوردة. هل أنت متأكد؟',
            toast_import_success: 'تم استيراد جميع البيانات بنجاح',
            toast_import_title: 'تم الاستيراد',
            toast_import_error2: 'حدث خطأ أثناء قراءة الملف',
            toast_pw_changed: 'تم تغيير كلمة المرور بنجاح!',
            notif_hw_due: 'واجبات مستحقة اليوم!',
            notif_hw_due_body: 'لديك',
            notif_hw_due_count: 'واجبات مستحقة اليوم',
            notif_hw_tomorrow: 'واجبات مستحقة غداً!',
            notif_hw_tomorrow_body: 'لديك',
            notif_hw_tomorrow_count: 'واجبات مستحقة غداً',
            notif_exam_today: 'امتحان اليوم!',
            notif_exam_today_body: 'لديك',
            notif_exam_today_count: 'امتحانات اليوم:',
            notif_exam_tomorrow: 'امتحان غداً!',
            notif_exam_tomorrow_body: 'لديك',
            notif_exam_tomorrow_count: 'امتحانات غداً:',
            notif_schedule: 'تذكير بالجدول',
            notif_pomodoro: 'بومودورو',
            notif_pomodoro_body: 'انتهت الجولة! وقت',
            ai_resp_schedule: 'تم إنشاء جدول يومك بناءً على الوقت المحدد! يمكنك مشاهدته في قسم "الجدول اليومي".',
            ai_resp_classes_count: 'لديك ',
            ai_resp_classes_minutes: ' مواد اليوم (',
            ai_resp_no_classes: 'لم تضف مواد اليوم بعد.',
            ai_resp_hw_count: 'لديك ',
            ai_resp_hw_list: ' واجبات غير مكتملة:',
            ai_resp_no_hw: 'لا توجد واجبات مستحقة اليوم.',
            ai_resp_exams: 'امتحاناتك القادمة:',
            ai_resp_no_exams: 'لا توجد امتحانات قادمة.',
            ai_resp_tip_streak: 'سلسلة نشاط جيدة منذ ',
            ai_resp_tip_streak2: ' أيام! استمر.',
            ai_resp_tip_pomo: 'حاول إكمال 3 جولات بومودورو على الأقل اليوم.',
            ai_resp_tip_hw: 'لديك ',
            ai_resp_tip_hw2: ' واجبات معلقة. رتبها حسب الأولوية.',
            ai_resp_tip_start: 'بداية يومك جيدة! حاول إنشاء جدول يومي منظم.',
            ai_resp_tips: '💡 نصائحي لك:',
            ai_resp_tracking: 'تم الانتقال لصفحة تتبع المهام.',
            ai_resp_stats: 'إحصائياتك',
            ai_resp_export: 'تم الانتقال للإعدادات. يمكنك تصدير البيانات من قسم "النسخ الاحتياطي".',
            ai_resp_default: 'أنا هنا لمساعدتك! يمكنني:<br>• إنشاء جدول يومي<br>• عرض الواجبات والامتحانات<br>• نصائح للدراسة<br>• تتبع نشاطك<br>• تصدير البيانات',
            hw_title_label: 'عنوان الواجب',
            hw_subject_label: 'المادة',
            hw_desc_label: 'الوصف',
            hw_due_label: 'تاريخ التسليم',
            hw_day_label: 'اليوم',
            hw_priority_label: 'الأولوية',
            class_name_label: 'اسم المادة',
            class_duration_label: 'مدة المذاكَرة (بالدقائق)',
            class_priority_label: 'الأولوية',
            class_color_label: 'اللون',
            class_notes_label: 'ملاحظات (اختياري)',
            exam_name_label: 'اسم الامتحان',
            exam_subject_label: 'المادة',
            exam_date_label: 'التاريخ',
            exam_time_label: 'الوقت',
            exam_day_label: 'اليوم',
            exam_notes_label: 'ملاحظات',
            day_sat: 'السبت',
            day_sun: 'الأحد',
            day_mon: 'الإثنين',
            day_tue: 'الثلاثاء',
            day_wed: 'الأربعاء',
            day_thu: 'الخميس',
            day_fri: 'الجمعة',
            password_current: 'كلمة المرور الحالية',
            password_new: 'كلمة المرور الجديدة',
            password_confirm: 'تأكيد كلمة المرور الجديدة',
            btn_save_changes: 'حفظ التغييرات',
            points_label: 'نقطة',
            level_xp: 'نقطة خبرة',
            settings_name_label: 'الاسم',
            settings_email_label: 'البريد الإلكتروني',
            settings_change_pw_btn: 'حفظ التغييرات',
            settings_export_title: 'تصدير البيانات',
            settings_export_desc: 'تحميل نسخة احتياطية من جميع بياناتك',
            settings_import_title: 'استيراد البيانات',
            settings_import_desc: 'استعادة البيانات من نسخة احتياطية',
            settings_logout_btn: 'تسجيل الخروج',
            notif_hw_label: 'إشعارات الواجبات',
            notif_exams_label: 'إشعارات الامتحانات',
            notif_schedule_label: 'تذكيرات الجدول',
            notif_daily_label: 'تذكير النشاط اليومي',
            pw_current_ph: 'أدخل كلمة المرور الحالية',
            pw_new_ph: 'أدخل كلمة المرور الجديدة',
            pw_confirm_ph: 'أعد إدخال كلمة المرور الجديدة'
        },
        en: {
            app_name: 'Back to School',
            nav_dashboard: 'Dashboard',
            nav_classes: 'Today\'s Subjects',
            nav_homework: 'Homework',
            nav_exams: 'Exams',
            nav_schedule: 'Daily Schedule',
            nav_calendar: 'Calendar',
            nav_pomodoro: 'Study Timer',
            nav_achievements: 'Achievements',
            nav_parent: 'Parent Dashboard',
            nav_tasktracking: 'Task Tracking',
            nav_settings: 'Settings',
            conversations: 'Conversations',
            no_conversations: 'No conversations yet',
            daily_schedule: 'Today\'s Schedule',
            no_schedule_yet: 'No schedule created yet',
            logout: 'Logout',
            page_dashboard: 'Dashboard',
            welcome_today: 'Welcome back today',
            stat_homework: 'Homework Due',
            stat_exams: 'Upcoming Exam',
            stat_completed: 'Task Completed',
            stat_pending: 'Pending Task',
            stat_classes: 'Today\'s Subject',
            ai_title: 'Smart Planning Assistant',
            ai_subtitle: 'Let me help you organize your day',
            btn_generate_schedule: 'Generate Schedule',
            ai_clear_chat: 'Clear Chat',
            ai_export_chat: 'Export Chat',
            ai_show_tips: 'Study Tips',
            ai_show_stats: 'My Stats',
            ai_welcome: 'Hello! I\'m your smart assistant. How can I help you today?',
            ai_help_schedule: 'Create a daily schedule',
            ai_help_hw: 'View homework and exams',
            ai_help_tips: 'Study tips',
            ai_prompt: 'Type your message here!',
            ai_no_chat: 'No conversation',
            ai_no_chat_desc: 'Start a conversation first',
            ai_exported: 'Exported',
            ai_exported_desc: 'Chat exported successfully',
            ai_rate_limit: 'Please wait a moment before sending another message.',
            page_classes: 'Today\'s Subjects',
            btn_add_class: 'Add Subject',
            page_homework: 'Homework Management',
            btn_add_homework: 'Add Homework',
            page_exams: 'Exam Management',
            btn_add_exam: 'Add Exam',
            page_schedule: 'Smart Daily Schedule',
            btn_regenerate: 'Regenerate Schedule',
            page_calendar: 'Calendar',
            page_pomodoro: 'Study Timer (Pomodoro)',
            page_achievements: 'Achievements & Points',
            page_parent: 'Parent Dashboard',
            page_tasktracking: 'Task Tracking',
            page_settings: 'Settings',
            settings_subtitle: 'Customize your account',
            classes_subtitle: 'Subjects you studied today',
            hw_subtitle: 'Manage your homework',
            exams_subtitle: 'Track your upcoming exams',
            schedule_subtitle: 'Plan your day smartly',
            calendar_subtitle: 'View events and dates',
            pomodoro_subtitle: 'Study Timer',
            pomodoro_desc: 'Pomodoro technique for effective studying',
            achievements_subtitle: 'Your points and badges',
            tasktracking_subtitle: 'Track study hours and progress',
            parent_subtitle: 'Track academic progress',
            settings_account: 'Account Information',
            settings_notifications: 'Notification Settings',
            settings_password: 'Change Password',
            settings_backup: 'Backup & Data',
            settings_account_section: 'Account',
            modal_add_homework: 'Add New Homework',
            modal_add_class: 'Add Study Subject',
            modal_add_exam: 'Add New Exam',
            filter_all: 'All',
            filter_today: 'Today',
            filter_upcoming: 'Upcoming',
            filter_completed: 'Completed',
            level_beginner: 'Beginner',
            xp_points: 'XP',
            badge_first_hw: 'First Homework',
            badge_five_hw: '5 Homeworks',
            badge_ten_hw: '10 Homeworks',
            badge_first_exam: 'First Exam',
            badge_pomo_5: '5 Pomodoro Rounds',
            badge_pomo_20: '20 Pomodoro Rounds',
            badge_streak_3: '3 Day Streak',
            badge_streak_7: '7 Day Streak',
            badge_level_5: 'Level 5',
            badge_level_10: 'Level 10',
            badges_title: 'Badges',
            points_log_title: 'Points Log',
            no_points: 'No points earned yet',
            daily_activity: 'Daily Activity',
            daily_activity_hint: 'Complete your daily tasks to earn extra points',
            pomodoro_work: 'Study',
            pomodoro_short: 'Short Break',
            pomodoro_long: 'Long Break',
            pomodoro_start: 'Start',
            pomodoro_pause: 'Pause',
            pomodoro_reset: 'Reset',
            pomodoro_skip: 'Skip',
            pomodoro_sessions: 'Sessions Completed',
            pomodoro_minutes: 'Minutes Studied',
            pomodoro_streak: 'Longest Streak',
            pomodoro_history: 'Session History',
            pomodoro_no_history: 'No sessions recorded yet',
            pomodoro_stats: 'Today\'s Stats',
            pomodoro_work_min: 'Study (minutes)',
            pomodoro_short_min: 'Short Break (minutes)',
            pomodoro_long_min: 'Long Break (minutes)',
            pomodoro_rounds: 'Rounds before long break',
            schedule_empty_hint: 'Click "Generate Schedule" to create your day\'s schedule',
            schedule_go_school: 'Go to school',
            schedule_go_school_desc: 'Travel to school',
            schedule_study: 'Study',
            schedule_return_home: 'Return home',
            schedule_lunch_break: 'Break & lunch',
            schedule_study_hw_time: 'Study & homework time',
            schedule_general_review: 'General review',
            schedule_physical: 'Physical activity',
            schedule_sleep_desc: 'Restful sleep',
            pw_err_too_short: 'New password must be at least 6 characters.',
            pw_err_no_match: 'New passwords do not match.',
            pw_err_unexpected: 'An unexpected error occurred.',
            pw_err_current_wrong: 'Current password is incorrect.',
            pw_err_change_failed: 'An error occurred while changing password.',
            level_titles: ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master', 'Legendary'],
            time_am: 'AM',
            time_pm: 'PM',
            tip_time: 'Dedicate 25 min for studying + 5 min break',
            tip_difficult: 'Focus on difficult subjects first',
            tip_sleep: 'Get enough sleep (7-8 hours)',
            tip_breakfast: 'Eat a healthy breakfast',
            tip_phone: 'Put your phone away while studying',
            parent_tracking_code: 'Tracking Code',
            parent_share: 'Share this code with your parent to track your progress',
            parent_generate: 'Generate New Code',
            parent_completed_hw: 'Homework Completed',
            parent_pending_hw: 'Pending Homework',
            parent_study_hours: 'Study Hours',
            parent_points: 'Points',
            parent_hw_progress: 'Homework Completion Rate',
            parent_study_activity: 'Study Activity (Last 7 Days)',
            parent_upcoming_exams: 'Upcoming Exams',
            parent_no_exams: 'No upcoming exams',
            parent_daily_schedule: 'Today\'s Schedule',
            parent_no_schedule: 'No schedule created yet',
            tracking_weekly_hours: 'Study Hours This Week',
            tracking_completed: 'Blocks Completed',
            tracking_streak: 'Day Streak',
            tracking_efficiency: 'Completion Rate',
            tracking_weekly_activity: 'This Week\'s Activity',
            tracking_today_tasks: 'Today\'s Tasks',
            tracking_add_block: 'Add New Time Block',
            tracking_time_blocks: 'Time Blocks',
            tracking_no_blocks: 'No time blocks added yet',
            tracking_habit_analysis: 'Smart Habit Analysis',
            tracking_no_habits: 'Add more data for smart insights',
            task_title: 'Task',
            task_subject: 'Subject',
            task_start: 'Start Time',
            task_end: 'End Time',
            task_priority: 'Priority',
            task_type: 'Type',
            priority_high: 'High',
            priority_medium: 'Medium',
            priority_low: 'Low',
            type_study: 'Study',
            type_review: 'Review',
            type_homework: 'Homework',
            type_project: 'Project',
            btn_add: 'Add',
            save: 'Save',
            cancel: 'Cancel',
            close: 'Close',
            notif_homework: 'Homework Notifications',
            notif_exams: 'Exam Notifications',
            notif_schedule: 'Schedule Reminders',
            notif_daily: 'Daily Activity Reminder',
            export_data: 'Export Data',
            export_desc: 'Download a backup of all your data',
            btn_export: 'Export',
            import_data: 'Import Data',
            import_desc: 'Restore data from a backup',
            btn_import: 'Import',
            btn_logout: 'Logout',
            schedule_settings: 'Day Settings',
            schedule_school_start: 'School Start',
            schedule_school_end: 'School End',
            schedule_wake: 'Wake Up Time',
            schedule_sleep: 'Sleep Time',
            schedule_breakfast: 'Breakfast',
            schedule_lunch: 'Lunch',
            schedule_dinner: 'Dinner',
            schedule_exercise: 'Exercise Time',
            schedule_shower: 'Shower Time',
            confirm_delete_hw: 'Delete this homework?',
            confirm_delete_exam: 'Delete this exam?',
            confirm_delete_class: 'Delete this subject?',
            confirm_delete_block: 'Delete this time block?',
            no_exams: 'No Exams',
            no_exams_desc: 'Add your upcoming exams here',
            no_hw: 'No Homework',
            no_hw_desc: 'Start by adding your homework here',
            no_classes: 'No subjects added today',
            no_classes_desc: 'Add the subjects you studied today for the study schedule',
            today_events: 'Today\'s Events',
            no_events: 'No events for this day',
            exams_tomorrow: 'Exams Tomorrow',
            no_exams_tomorrow: 'No exams tomorrow',
            estimated_study: 'Estimated study time:',
            minutes: 'minutes',
            subjects_count: 'Subjects count:',
            tb_title_ph: 'e.g. Math review',
            tb_subject_ph: 'e.g. Math',
            hw_title_ph: 'e.g. Math exercises',
            hw_subject_ph: 'e.g. Math',
            hw_desc_ph: 'Add homework details...',
            class_name_ph: 'e.g. Math, Science, History...',
            class_notes_ph: 'Add notes about the subject...',
            exam_name_ph: 'e.g. Final exam',
            exam_subject_ph: 'e.g. Science',
            exam_notes_ph: 'Add notes or suggested study...',
            toast_theme_changed: 'Theme Changed',
            toast_dark: 'Dark Mode',
            toast_light: 'Light Mode',
            toast_daily_reminder: 'Daily reminder: Don\'t forget to check your schedule!',
            toast_reminder_title: 'Reminder',
            toast_block_added: 'Time block added successfully',
            toast_export_success: 'All data exported successfully',
            toast_export_title: 'Exported',
            toast_import_error: 'Invalid import file',
            toast_import_confirm: 'All your current data will be replaced with imported data. Are you sure?',
            toast_import_success: 'All data imported successfully',
            toast_import_title: 'Imported',
            toast_import_error2: 'Error reading file',
            toast_pw_changed: 'Password changed successfully!',
            notif_hw_due: 'Homework Due Today!',
            notif_hw_due_body: 'You have',
            notif_hw_due_count: 'homework due today',
            notif_hw_tomorrow: 'Homework Due Tomorrow!',
            notif_hw_tomorrow_body: 'You have',
            notif_hw_tomorrow_count: 'homework due tomorrow',
            notif_exam_today: 'Exam Today!',
            notif_exam_today_body: 'You have',
            notif_exam_today_count: 'exams today:',
            notif_exam_tomorrow: 'Exam Tomorrow!',
            notif_exam_tomorrow_body: 'You have',
            notif_exam_tomorrow_count: 'exams tomorrow:',
            notif_schedule: 'Schedule Reminder',
            notif_pomodoro: 'Pomodoro',
            notif_pomodoro_body: 'Round finished! Time for',
            ai_resp_schedule: 'Your daily schedule has been created! You can view it in the "Daily Schedule" section.',
            ai_resp_classes_count: 'You have ',
            ai_resp_classes_minutes: ' subjects today (',
            ai_resp_no_classes: 'No subjects added today yet.',
            ai_resp_hw_count: 'You have ',
            ai_resp_hw_list: ' incomplete homework:',
            ai_resp_no_hw: 'No homework due today.',
            ai_resp_exams: 'Your upcoming exams:',
            ai_resp_no_exams: 'No upcoming exams.',
            ai_resp_tip_streak: 'Good activity streak for ',
            ai_resp_tip_streak2: ' days! Keep going.',
            ai_resp_tip_pomo: 'Try to complete at least 3 pomodoro rounds today.',
            ai_resp_tip_hw: 'You have ',
            ai_resp_tip_hw2: ' pending homework. Sort by priority.',
            ai_resp_tip_start: 'Good start to your day! Try creating a structured daily schedule.',
            ai_resp_tips: '💡 My tips for you:',
            ai_resp_tracking: 'Navigated to task tracking page.',
            ai_resp_stats: 'Your stats',
            ai_resp_export: 'Navigated to settings. You can export data from the "Backup" section.',
            ai_resp_default: 'I\'m here to help! I can:<br>• Create a daily schedule<br>• Show homework & exams<br>• Study tips<br>• Track your activity<br>• Export data',
            hw_title_label: 'Homework Title',
            hw_subject_label: 'Subject',
            hw_desc_label: 'Description',
            hw_due_label: 'Due Date',
            hw_day_label: 'Day',
            hw_priority_label: 'Priority',
            class_name_label: 'Subject Name',
            class_duration_label: 'Study Duration (minutes)',
            class_priority_label: 'Priority',
            class_color_label: 'Color',
            class_notes_label: 'Notes (optional)',
            exam_name_label: 'Exam Name',
            exam_subject_label: 'Subject',
            exam_date_label: 'Date',
            exam_time_label: 'Time',
            exam_day_label: 'Day',
            exam_notes_label: 'Notes',
            day_sat: 'Saturday',
            day_sun: 'Sunday',
            day_mon: 'Monday',
            day_tue: 'Tuesday',
            day_wed: 'Wednesday',
            day_thu: 'Thursday',
            day_fri: 'Friday',
            password_current: 'Current Password',
            password_new: 'New Password',
            password_confirm: 'Confirm New Password',
            btn_save_changes: 'Save Changes',
            points_label: 'Points',
            level_xp: 'XP',
            settings_name_label: 'Name',
            settings_email_label: 'Email',
            settings_change_pw_btn: 'Save Changes',
            settings_export_title: 'Export Data',
            settings_export_desc: 'Download a backup of all your data',
            settings_import_title: 'Import Data',
            settings_import_desc: 'Restore data from a backup',
            settings_logout_btn: 'Logout',
            notif_hw_label: 'Homework Notifications',
            notif_exams_label: 'Exam Notifications',
            notif_schedule_label: 'Schedule Reminders',
            notif_daily_label: 'Daily Activity Reminder',
            pw_current_ph: 'Enter current password',
            pw_new_ph: 'Enter new password',
            pw_confirm_ph: 'Re-enter new password'
        }
    };

    // Helper functions
    function generateId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    function minutesToTime(mins) {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function formatTime12(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':').map(Number);
        var t = translations[currentLang];
        const period = hours >= 12 ? t.time_pm : t.time_am;
        const h12 = hours % 12 || 12;
        return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function getPriorityLabel(priority) {
        var t = translations[currentLang];
        var labels = { low: t.priority_low, medium: t.priority_medium, high: t.priority_high };
        return labels[priority] || priority;
    }

    function isValidColor(color) {
        return /^#[0-9a-fA-F]{6}$/.test(color);
    }

    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth();
        initUI();
        initLanguage();
        loadData();
        initEventListeners();
        updateStats();
        renderCalendar();
        setupSessionTracking();
    });

    // Auth Check
    function checkAuth() {
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = JSON.parse(userData);
        delete currentUser.password;
        delete currentUser.passwordHash;
        delete currentUser.salt;
        updateUserInfo();
    }

    // Update User Info
    function updateUserInfo() {
        const initial = currentUser.displayName ? currentUser.displayName.charAt(0) : 'م';
        var el;
        if (el = document.getElementById('userAvatar')) el.textContent = initial;
        if (el = document.getElementById('userAvatarSm')) el.textContent = initial;
        if (el = document.getElementById('userName')) el.textContent = currentUser.displayName || 'المستخدم';
        if (el = document.getElementById('userEmail')) el.textContent = currentUser.email;
        if (el = document.getElementById('settingsName')) el.textContent = currentUser.displayName;
        if (el = document.getElementById('settingsEmail')) el.textContent = currentUser.email;
        
        if (currentUser.settings) {
            if (el = document.getElementById('wakeUpTime')) el.value = currentUser.settings.wakeUpTime || '06:00';
            if (el = document.getElementById('sleepTime')) el.value = currentUser.settings.sleepTime || '22:00';
            if (el = document.getElementById('schoolStart')) el.value = currentUser.settings.schoolStart || '07:30';
            if (el = document.getElementById('schoolEnd')) el.value = currentUser.settings.schoolEnd || '14:00';
            if (el = document.getElementById('breakfastTime')) el.value = currentUser.settings.breakfastTime || '06:30';
            if (el = document.getElementById('lunchTime')) el.value = currentUser.settings.lunchTime || '14:30';
            if (el = document.getElementById('dinnerTime')) el.value = currentUser.settings.dinnerTime || '20:00';
            if (el = document.getElementById('exerciseTime')) el.value = currentUser.settings.exerciseTime || '16:00';
            if (el = document.getElementById('showerTime')) el.value = currentUser.settings.showerTime || '21:00';
        }
    }

    // Load Data
    function loadData() {
        const userId = currentUser.id;
        conversations = JSON.parse(localStorage.getItem('bts_conversations_' + userId) || '[]');
        homework = JSON.parse(localStorage.getItem('bts_homework_' + userId) || '[]');
        exams = JSON.parse(localStorage.getItem('bts_exams_' + userId) || '[]');
        classes = JSON.parse(localStorage.getItem('bts_classes_' + userId) || '[]');
        dailySchedule = JSON.parse(localStorage.getItem('bts_schedule_' + userId) || '[]');
        gamification = JSON.parse(localStorage.getItem('bts_gamification_' + userId) || 'null') || gamification;
        pomodoro = JSON.parse(localStorage.getItem('bts_pomodoro_' + userId) || 'null') || pomodoro;
        parentCode = localStorage.getItem('bts_parent_code_' + userId) || '';
        timeBlocks = JSON.parse(localStorage.getItem('bts_timeblocks_' + userId) || '[]');
        dailyActivity = JSON.parse(localStorage.getItem('bts_dailyactivity_' + userId) || '{}');
        notificationSettings = JSON.parse(localStorage.getItem('bts_notifsettings_' + userId) || 'null') || notificationSettings;
        currentTheme = localStorage.getItem('bts_theme_' + userId) || 'dark';

        const today = new Date().toISOString().split('T')[0];
        if (pomodoro.todayStats.date !== today) {
            pomodoro.todayStats = { date: today, completedSessions: 0, totalMinutes: 0, currentStreak: 0, history: [] };
        }

        updateStreak();
        renderConversations();
        renderHomework();
        renderExams();
        renderClasses();
        updateSubjectsSummary();
        renderDailySchedule();
        renderAchievements();
        renderPointsLog();
        renderBadges();
        initPomodoroDisplay();
        renderPomodoroStats();
        renderPomodoroHistory();
        initParentDashboard();
        renderTimeBlocks();
        renderTodayChecklist();
        renderWeeklyActivity();
        updateTrackingStats();
        generateHabitInsights();
        initTheme();
        initNotificationSettings();
        scheduleNotifications();
    }

    // Save Data
    function saveData() {
        const userId = currentUser.id;
        localStorage.setItem('bts_conversations_' + userId, JSON.stringify(conversations));
        localStorage.setItem('bts_homework_' + userId, JSON.stringify(homework));
        localStorage.setItem('bts_exams_' + userId, JSON.stringify(exams));
        localStorage.setItem('bts_classes_' + userId, JSON.stringify(classes));
        localStorage.setItem('bts_schedule_' + userId, JSON.stringify(dailySchedule));
        localStorage.setItem('bts_gamification_' + userId, JSON.stringify(gamification));
        localStorage.setItem('bts_pomodoro_' + userId, JSON.stringify(pomodoro));
        localStorage.setItem('bts_parent_code_' + userId, parentCode);
        localStorage.setItem('bts_timeblocks_' + userId, JSON.stringify(timeBlocks));
        localStorage.setItem('bts_dailyactivity_' + userId, JSON.stringify(dailyActivity));
        localStorage.setItem('bts_notifsettings_' + userId, JSON.stringify(notificationSettings));
        localStorage.setItem('bts_theme_' + userId, currentTheme);
    }

    // Init UI
    function initUI() {
        const today = new Date().toISOString().split('T')[0];
        const hwDueDate = document.getElementById('hwDueDate');
        const examDate = document.getElementById('examDate');
        if (hwDueDate) hwDueDate.value = today;
        if (examDate) examDate.value = today;
    }

    // Event Listeners
    function safeOn(id, event, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    // Language System
    function switchLanguage(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        if (currentUser) localStorage.setItem('bts_lang_' + currentUser.id, lang);
        var t = translations[lang];
        var langLabel = document.getElementById('langLabel');
        if (langLabel) langLabel.textContent = lang === 'ar' ? 'EN' : 'عربي';
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) el.placeholder = t[key];
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-title');
            if (t[key]) el.title = t[key];
        });
    }

    function initLanguage() {
        if (currentUser) currentLang = localStorage.getItem('bts_lang_' + currentUser.id) || 'ar';
        switchLanguage(currentLang);
    }

    function initEventListeners() {
        safeOn('langToggle', 'click', function() {
            switchLanguage(currentLang === 'ar' ? 'en' : 'ar');
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                navigateTo(this.dataset.page);
            });
        });

        safeOn('mobileMenuBtn', 'click', function() {
            document.getElementById('sidebar').classList.toggle('active');
        });

        safeOn('sidebarToggle', 'click', function() {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        safeOn('newChatBtn', 'click', createNewConversation);

        safeOn('chatInput', 'keypress', function(e) {
            if (e.key === 'Enter') sendChatMessage();
        });
        safeOn('sendChatBtn', 'click', sendChatMessage);

        safeOn('generateScheduleBtn', 'click', generateDailySchedule);
        safeOn('generateScheduleBtn2', 'click', generateDailySchedule);

        safeOn('aiMenuBtn', 'click', function(e) {
            e.stopPropagation();
            document.getElementById('aiDropdownMenu').classList.toggle('active');
        });

        safeOn('aiClearChat', 'click', function() {
            document.getElementById('aiDropdownMenu').classList.remove('active');
            clearChat();
        });

        safeOn('aiExportChat', 'click', function() {
            document.getElementById('aiDropdownMenu').classList.remove('active');
            exportChat();
        });

        safeOn('aiShowTips', 'click', function() {
            document.getElementById('aiDropdownMenu').classList.remove('active');
            var t = translations[currentLang];
            var tips = t.ai_resp_tips + '<br>• ' + t.tip_time + '<br>• ' + t.tip_difficult + '<br>• ' + t.tip_sleep + '<br>• ' + t.tip_breakfast + '<br>• ' + t.tip_phone;
            addChatMessage(tips, 'assistant');
        });

        safeOn('aiShowStats', 'click', function() {
            document.getElementById('aiDropdownMenu').classList.remove('active');
            var t = translations[currentLang];
            var stats = '📊 ' + t.ai_resp_stats + ':<br>• ' + t.nav_achievements + ': ' + gamification.level + '<br>• ' + t.points_label + ': ' + gamification.points + '<br>• ' + t.tracking_streak + ': ' + gamification.streak + (currentLang === 'ar' ? ' أيام' : ' days') + '<br>• ' + t.stat_completed + ': ' + gamification.totalCompletedHW + '<br>• ' + t.pomodoro_sessions + ': ' + gamification.totalPomodoroSessions;
            addChatMessage(stats, 'assistant');
        });

        document.addEventListener('click', function() {
            var menu = document.getElementById('aiDropdownMenu');
            if (menu) menu.classList.remove('active');
        });

        // Firebase Cloud Messaging foreground handler
        if (typeof FCM !== 'undefined' && messaging) {
            FCM.onMessage(function(payload) {
                var title = payload.notification?.title || translations[currentLang].notif_schedule;
                var body = payload.notification?.body || '';
                showToast(title, body, 'info');
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(title, { body: body });
                }
            });
            FCM.requestPermission();
        }

        ['wakeUpTime', 'sleepTime', 'schoolStart', 'schoolEnd', 'breakfastTime', 'lunchTime', 'dinnerTime', 'exerciseTime', 'showerTime'].forEach(id => {
            safeOn(id, 'change', saveSettings);
        });

        safeOn('addHomeworkBtn', 'click', () => document.getElementById('homeworkModal').classList.add('active'));
        safeOn('addExamBtn', 'click', () => document.getElementById('examModal').classList.add('active'));
        safeOn('addClassBtn', 'click', () => document.getElementById('classModal').classList.add('active'));

        safeOn('classForm', 'submit', addClass);
        safeOn('homeworkForm', 'submit', addHomework);
        safeOn('examForm', 'submit', addExam);

        document.querySelectorAll('.homework-filters .filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.homework-filters .filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                renderHomework(this.dataset.filter);
            });
        });

        safeOn('prevMonth', 'click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
        safeOn('nextMonth', 'click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });

        safeOn('changePasswordForm', 'submit', changePassword);
        safeOn('logoutBtn', 'click', logout);
        safeOn('logoutBtnSettings', 'click', logout);

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) this.classList.remove('active');
            });
        });

        safeOn('pomoStartBtn', 'click', startPomodoro);
        safeOn('pomoPauseBtn', 'click', pausePomodoro);
        safeOn('pomoResetBtn', 'click', resetPomodoro);
        safeOn('pomoSkipBtn', 'click', skipPomodoro);

        document.querySelectorAll('.pomo-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                if (pomoState === 'running') return;
                const mode = this.dataset.mode;
                setActivePomoTab(mode);
                pomoMode = mode === 'work' ? 'work' : 'break';
                pomoBreakType = mode === 'long' ? 'long' : 'short';
                const mins = mode === 'work' ? pomodoro.settings.workMinutes : (mode === 'long' ? pomodoro.settings.longBreakMinutes : pomodoro.settings.shortBreakMinutes);
                pomoTimeLeft = mins * 60;
                pomoTotalTime = mins * 60;
                pomoState = 'idle';
                updatePomodoroDisplay();
                updatePomodoroControls();
            });
        });

        ['pomoWorkMin', 'pomoShortMin', 'pomoLongMin', 'pomoRounds'].forEach(id => {
            safeOn(id, 'change', function() {
                pomodoro.settings.workMinutes = parseInt(document.getElementById('pomoWorkMin').value) || 25;
                pomodoro.settings.shortBreakMinutes = parseInt(document.getElementById('pomoShortMin').value) || 5;
                pomodoro.settings.longBreakMinutes = parseInt(document.getElementById('pomoLongMin').value) || 15;
                pomodoro.settings.roundsBeforeLong = parseInt(document.getElementById('pomoRounds').value) || 4;
                if (pomoState === 'idle') {
                    pomoTimeLeft = (pomoMode === 'work' ? pomodoro.settings.workMinutes : pomodoro.settings.shortBreakMinutes) * 60;
                    pomoTotalTime = pomoTimeLeft;
                    updatePomodoroDisplay();
                }
                saveData();
            });
        });

        safeOn('generateParentCode', 'click', generateParentCode);

        initTaskTracking();
        initExportImport();
    }

    // Navigation
    function navigateTo(page) {
        if (!page) return;
        currentPage = page;
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById('page-' + page);
        if (pageEl) pageEl.classList.add('active');
        
        const titles = {
            dashboard: { title: 'page_dashboard', subtitle: 'welcome_today' },
            classes: { title: 'page_classes', subtitle: 'classes_subtitle' },
            homework: { title: 'page_homework', subtitle: 'hw_subtitle' },
            exams: { title: 'page_exams', subtitle: 'exams_subtitle' },
            schedule: { title: 'page_schedule', subtitle: 'schedule_subtitle' },
            calendar: { title: 'page_calendar', subtitle: 'calendar_subtitle' },
            pomodoro: { title: 'pomodoro_subtitle', subtitle: 'pomodoro_desc' },
            achievements: { title: 'page_achievements', subtitle: 'achievements_subtitle' },
            tasktracking: { title: 'page_tasktracking', subtitle: 'tasktracking_subtitle' },
            parent: { title: 'page_parent', subtitle: 'parent_subtitle' },
            settings: { title: 'page_settings', subtitle: 'settings_subtitle' }
        };
        var t = translations[currentLang];
        const titleData = titles[page];
        if (titleData) {
            var pageTitle = document.getElementById('pageTitle');
            var titleText = t[titleData.title] || titleData.title;
            var subtitleText = t[titleData.subtitle] || titleData.subtitle;
            if (pageTitle) pageTitle.innerHTML = '<h1>' + titleText + '</h1><p>' + subtitleText + '</p>';
        }
        
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }

    // Updates Stats
    function updateStats() {
        const today = new Date();
        today.setHours(0,0,0,0);

        const pendingHw = homework.filter(h => !h.completed).length;
        const completedHw = homework.filter(h => h.completed).length;
        const upcomingExams = exams.filter(e => new Date(e.date) >= today).length;
        const todayDate = today.toISOString().split('T')[0];
        const todayClassesCount = classes.filter(c => c.date === todayDate).length;

        var el;
        if (el = document.getElementById('statHomework')) el.textContent = pendingHw;
        if (el = document.getElementById('statExams')) el.textContent = upcomingExams;
        if (el = document.getElementById('statCompleted')) el.textContent = completedHw;
        if (el = document.getElementById('statPending')) el.textContent = pendingHw;
        if (el = document.getElementById('statClasses')) el.textContent = todayClassesCount;
    }

    // Conversations
    function createNewConversation() {
        const conversation = {
            id: generateId(),
            title: translations[currentLang].conversations + ' ' + (conversations.length + 1),
            messages: [],
            createdAt: new Date().toISOString()
        };
        
        conversations.unshift(conversation);
        currentConversation = conversation;
        saveData();
        renderConversations();
        clearChat();
        navigateTo('dashboard');
    }

    function renderConversations() {
        const list = document.getElementById('conversationsList');
        if (!list) return;
        if (conversations.length === 0) {
            list.innerHTML = '<div class="conversation-empty">' + translations[currentLang].no_conversations + '</div>';
            return;
        }
        list.innerHTML = conversations.map(conv => `
            <div class="conversation-item ${currentConversation && currentConversation.id === conv.id ? 'active' : ''}" 
                 data-id="${escapeHtml(conv.id)}" onclick="loadConversation('${escapeHtml(conv.id)}')">
                <i class="fas fa-comment-dots"></i>
                <span>${escapeHtml(conv.title)}</span>
            </div>
        `).join('');
    }

    window.loadConversation = function(id) {
        currentConversation = conversations.find(c => c.id === id);
        renderConversations();
        loadChatHistory();
    };

    function loadChatHistory() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !currentConversation || currentConversation.messages.length === 0) {
            clearChat();
            return;
        }
        chatMessages.innerHTML = currentConversation.messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-avatar">
                    <i class="fas fa-${msg.role === 'assistant' ? 'robot' : 'user'}"></i>
                </div>
                <div class="message-content">${msg.role === 'user' ? escapeHtml(msg.content) : msg.content}</div>
            </div>
        `).join('');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        const t = translations[currentLang];
        chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <p>${t.ai_welcome || 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم?'}</p>
                    <ul>
                        <li>${t.ai_help_schedule || 'إنشاء جدول يومي'}</li>
                        <li>${t.ai_help_hw || 'عرض الواجبات والامتحانات'}</li>
                        <li>${t.ai_help_tips || 'نصائح للدراسة'}</li>
                    </ul>
                    <p>${t.ai_prompt || 'اكتب رسالتك هنا!'}</p>
                </div>
            </div>
        `;
    }

    function exportChat() {
        if (!currentConversation || currentConversation.messages.length === 0) {
            showToast(translations[currentLang].ai_no_chat || 'لا توجد محادثة', translations[currentLang].ai_no_chat_desc || 'ابدأ محادثة أولاً', 'warning');
            return;
        }
        var text = currentConversation.messages.map(function(m) {
            var role = m.role === 'user' ? (currentLang === 'ar' ? 'أنت' : 'You') : (currentLang === 'ar' ? 'المساعد' : 'Assistant');
            return role + ': ' + m.content.replace(/<[^>]*>/g, '');
        }).join('\n\n');
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'chat-export-' + new Date().toISOString().split('T')[0] + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(translations[currentLang].ai_exported || 'تم التصدير', translations[currentLang].ai_exported_desc || 'تم تصدير المحادثة بنجاح', 'success');
    }

    // AI Chat
    function sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;

        const now = Date.now();
        if (now - lastAiCall < AI_RATE_LIMIT) {
            addChatMessage(translations[currentLang].ai_rate_limit || 'يرجى الانتظار قليلاً قبل إرسال رسالة أخرى.', 'assistant');
            return;
        }
        lastAiCall = now;
        
        if (!currentConversation) createNewConversation();
        
        addChatMessage(message, 'user');
        input.value = '';
        
        setTimeout(() => {
            const response = generateAIResponse(message);
            addChatMessage(response, 'assistant');
        }, 500);
    }

    function addChatMessage(content, role) {
        const chatMessages = document.getElementById('chatMessages');
        const safeContent = role === 'user' ? escapeHtml(content) : content;
        const messageHtml = `
            <div class="message ${role}">
                <div class="message-avatar">
                    <i class="fas fa-${role === 'assistant' ? 'robot' : 'user'}"></i>
                </div>
                <div class="message-content">${safeContent}</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML('beforeend', messageHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        if (currentConversation) {
            currentConversation.messages.push({ role, content, timestamp: new Date().toISOString() });
            if (currentConversation.messages.length === 1 && role === 'user') {
                currentConversation.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
                renderConversations();
            }
            saveData();
        }
    }

    // Daily Schedule Generator
    function generateDailySchedule() {
        var scheduleWakeEl = document.getElementById('scheduleWakeUp');
        var scheduleSleepEl = document.getElementById('scheduleSleep');
        const wakeUp = scheduleWakeEl ? scheduleWakeEl.value : document.getElementById('wakeUpTime').value;
        const sleep = scheduleSleepEl ? scheduleSleepEl.value : document.getElementById('sleepTime').value;
        const schoolStart = document.getElementById('schoolStart').value;
        const schoolEnd = document.getElementById('schoolEnd').value;
        const breakfast = document.getElementById('breakfastTime').value;
        const lunch = document.getElementById('lunchTime').value;
        const dinner = document.getElementById('dinnerTime').value;
        const exercise = document.getElementById('exerciseTime').value;
        
        dailySchedule = [];
        var t = translations[currentLang];
        dailySchedule.push({ time: wakeUp, activity: t.schedule_wake, icon: 'sun', type: 'other', desc: t.schedule_wake });
        dailySchedule.push({ time: breakfast, activity: t.schedule_breakfast, icon: 'utensils', type: 'meal', desc: t.schedule_breakfast });
        
        const schoolStartMin = timeToMinutes(schoolStart);
        dailySchedule.push({ time: minutesToTime(schoolStartMin - 30), activity: t.schedule_go_school, icon: 'bus', type: 'other', desc: t.schedule_go_school_desc });
        dailySchedule.push({ time: schoolStart, activity: t.schedule_school_start, icon: 'school', type: 'school', desc: t.schedule_study });
        
        dailySchedule.push({ time: schoolEnd, activity: t.schedule_school_end, icon: 'home', type: 'school', desc: t.schedule_return_home });
        dailySchedule.push({ time: lunch, activity: t.schedule_lunch, icon: 'utensils', type: 'meal', desc: t.schedule_lunch_break });
        
        const todayDate = new Date().toISOString().split('T')[0];
        const todaySubjects = classes.filter(c => c.date === todayDate);
        let currentStudyTime = timeToMinutes(lunch) + 90;
        
        if (todaySubjects.length > 0) {
            todaySubjects.forEach(subj => {
                dailySchedule.push({ 
                    time: minutesToTime(currentStudyTime), 
                    activity: t.schedule_study + ': ' + subj.name, 
                    icon: 'book-open', 
                    type: 'study', 
                    desc: subj.duration + ' ' + t.minutes,
                    classColor: subj.color 
                });
                currentStudyTime += subj.duration;
            });
        } else {
            dailySchedule.push({ time: minutesToTime(currentStudyTime), activity: t.schedule_study_hw_time, icon: 'book', type: 'study', desc: t.schedule_general_review });
        }
        
        dailySchedule.push({ time: exercise, activity: t.schedule_exercise, icon: 'dumbbell', type: 'exercise', desc: t.schedule_physical });
        dailySchedule.push({ time: dinner, activity: t.schedule_dinner, icon: 'utensils', type: 'meal', desc: t.schedule_dinner });
        dailySchedule.push({ time: sleep, activity: t.schedule_sleep, icon: 'moon', type: 'sleep', desc: t.schedule_sleep_desc });
        
        dailySchedule.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        addPoints('schedule_generated');
        saveData();
        renderDailySchedule();
        navigateTo('schedule');
    }

    function renderDailySchedule() {
        const timeline = document.getElementById('scheduleTimeline');
        const preview = document.getElementById('dailySchedulePreview');
        
        if (!timeline || !preview) return;
        
        if (dailySchedule.length === 0) {
            var t = translations[currentLang];
            timeline.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-day"></i><h3>' + t.no_schedule_yet + '</h3></div>';
            preview.innerHTML = '<div class="schedule-empty">' + t.no_schedule_yet + '</div>';
            return;
        }
        
        timeline.innerHTML = dailySchedule.map(item => `
            <div class="timeline-item" style="${item.classColor && isValidColor(item.classColor) ? 'border-right: 3px solid ' + item.classColor : ''}">
                <div class="timeline-time">${formatTime12(item.time)}</div>
                <div class="timeline-icon ${item.type}">
                    <i class="fas fa-${item.icon}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${escapeHtml(item.activity)}</div>
                    <div class="timeline-desc">${escapeHtml(item.desc)}</div>
                </div>
            </div>
        `).join('');
        
        preview.innerHTML = dailySchedule.slice(0, 6).map(item => `
            <div class="schedule-item-preview">
                <span class="schedule-time">${formatTime12(item.time)}</span>
                <span class="schedule-activity">${escapeHtml(item.activity)}</span>
            </div>
        `).join('');
    }

    // Homework Management
    function addHomework(e) {
        e.preventDefault();
        const hw = {
            id: generateId(),
            title: document.getElementById('hwTitle').value,
            subject: document.getElementById('hwSubject').value,
            description: document.getElementById('hwDescription').value,
            dueDate: document.getElementById('hwDueDate').value,
            day: document.getElementById('hwDay').value,
            priority: document.getElementById('hwPriority').value,
            completed: false,
            createdAt: new Date().toISOString()
        };
        homework.push(hw);
        saveData();
        renderHomework();
        updateStats();
        closeModal('homeworkModal');
        document.getElementById('homeworkForm').reset();
        scheduleNotifications();
    }

    function renderHomework(filter = 'all') {
        const list = document.getElementById('homeworkList');
        let filtered = [...homework];
        const today = new Date();
        today.setHours(0,0,0,0);

        if (filter === 'today') {
            filtered = homework.filter(h => new Date(h.dueDate).setHours(0,0,0,0) === today.getTime() && !h.completed);
        } else if (filter === 'upcoming') {
            filtered = homework.filter(h => new Date(h.dueDate) > today && !h.completed);
        } else if (filter === 'completed') {
            filtered = homework.filter(h => h.completed);
        }

        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><h3>' + translations[currentLang].no_hw + '</h3></div>';
            return;
        }

        list.innerHTML = filtered.map(hw => `
            <div class="task-card ${hw.completed ? 'completed' : ''}">
                <div class="task-checkbox ${hw.completed ? 'checked' : ''}" onclick="toggleHomework('${escapeHtml(hw.id)}')"></div>
                <div class="task-info">
                    <div class="task-title">${escapeHtml(hw.title)}</div>
                    <div class="task-meta">
                        <span><i class="fas fa-book"></i> ${escapeHtml(hw.subject)}</span>
                        <span><i class="fas fa-calendar"></i> ${formatDate(hw.dueDate)}</span>
                        <span class="priority-badge priority-${hw.priority}">${getPriorityLabel(hw.priority)}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button onclick="deleteHomework('${escapeHtml(hw.id)}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    window.toggleHomework = function(id) {
        const hw = homework.find(h => h.id === id);
        if (hw) {
            hw.completed = !hw.completed;
            if (hw.completed) {
                gamification.totalCompletedHW++;
                addPoints('homework_completed');
                markDayActive();
                markActivity();
            }
            saveData();
            renderHomework();
            updateStats();
            initParentDashboard();
            renderTodayChecklist();
            updateTrackingStats();
        }
    };

    window.deleteHomework = function(id) {
        if (confirm(translations[currentLang].confirm_delete_hw || 'حذف هذا الواجب؟')) {
            homework = homework.filter(h => h.id !== id);
            saveData();
            renderHomework();
            updateStats();
            initParentDashboard();
        }
    };

    // Exams Management
    function addExam(e) {
        e.preventDefault();
        const exam = {
            id: generateId(),
            name: document.getElementById('examName').value,
            subject: document.getElementById('examSubject').value,
            date: document.getElementById('examDate').value,
            time: document.getElementById('examTime').value,
            day: document.getElementById('examDay').value,
            notes: document.getElementById('examNotes').value,
            createdAt: new Date().toISOString()
        };
        exams.push(exam);
        addPoints('exam_added');
        markDayActive();
        saveData();
        renderExams();
        updateStats();
        closeModal('examModal');
        document.getElementById('examForm').reset();
        scheduleNotifications();
    }

    function renderExams() {
        const list = document.getElementById('examsList');
        if (exams.length === 0) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>' + translations[currentLang].no_exams + '</h3></div>';
            return;
        }
        list.innerHTML = exams.map(exam => `
            <div class="task-card">
                <div class="timeline-icon exam"><i class="fas fa-file-alt"></i></div>
                <div class="task-info">
                    <div class="task-title">${escapeHtml(exam.name)}</div>
                    <div class="task-meta">
                        <span><i class="fas fa-book"></i> ${escapeHtml(exam.subject)}</span>
                        <span><i class="fas fa-calendar"></i> ${formatDate(exam.date)}</span>
                        <span><i class="fas fa-clock"></i> ${formatTime12(exam.time)}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button onclick="deleteExam('${escapeHtml(exam.id)}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    window.deleteExam = function(id) {
        if (confirm(translations[currentLang].confirm_delete_exam || 'حذف هذا الامتحان؟')) {
            exams = exams.filter(e => e.id !== id);
            saveData();
            renderExams();
            updateStats();
        }
    };

    // Classes Management
    function addClass(e) {
        e.preventDefault();
        const cls = {
            id: generateId(),
            name: document.getElementById('className').value,
            duration: parseInt(document.getElementById('classDuration').value) || 45,
            priority: document.getElementById('classPriority').value,
            color: document.querySelector('input[name="classColor"]:checked').value,
            notes: document.getElementById('classNotes').value,
            date: new Date().toISOString().split('T')[0]
        };
        classes.push(cls);
        addPoints('subject_added');
        markActivity();
        saveData();
        renderClasses();
        updateSubjectsSummary();
        closeModal('classModal');
        document.getElementById('classForm').reset();
    }

    function renderClasses() {
        const grid = document.getElementById('classesGrid');
        const today = new Date().toISOString().split('T')[0];
        const todayClasses = classes.filter(c => c.date === today);

        if (todayClasses.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-book-reader"></i><h3>' + translations[currentLang].no_classes + '</h3></div>';
            return;
        }

        grid.innerHTML = todayClasses.map(cls => `
            <div class="class-card">
                <div class="class-card-color" style="background: ${isValidColor(cls.color) ? cls.color : 'var(--primary)'}"></div>
                <div class="class-card-title">${escapeHtml(cls.name)}</div>
                <div class="class-card-info">
                    <span><i class="fas fa-clock"></i> ${cls.duration} ${translations[currentLang].minutes || 'دقيقة'}</span>
                </div>
                <div class="class-card-actions">
                    <button onclick="deleteClass('${escapeHtml(cls.id)}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    function updateSubjectsSummary() {
        const today = new Date().toISOString().split('T')[0];
        const todayClasses = classes.filter(c => c.date === today);
        const totalMinutes = todayClasses.reduce((sum, c) => sum + c.duration, 0);
        var el;
        if (el = document.getElementById('subjectsCount')) el.textContent = todayClasses.length;
        if (el = document.getElementById('estimatedStudyTime')) el.textContent = totalMinutes;
    }

    window.deleteClass = function(id) {
        if (confirm(translations[currentLang].confirm_delete_class || 'حذف المادة؟')) {
            classes = classes.filter(c => c.id !== id);
            saveData();
            renderClasses();
            updateSubjectsSummary();
        }
    };

    // Calendar
    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthNames = currentLang === 'ar' ? monthNamesAr : monthNamesEn;
        
        const calTitle = document.getElementById('calendarTitle');
        const calBody = document.getElementById('calendarBody');
        if (!calTitle || !calBody) return;

        calTitle.textContent = monthNames[month] + ' ' + year;
        const firstDay = new Date(year, month, 1).getDay();
        const firstDayOffset = firstDay;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let html = '';
        for (let i = 0; i < firstDayOffset; i++) {
            html += '<div class="calendar-day other-month"></div>';
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            html += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="showDayEvents('${dateStr}')">${day}</div>`;
        }
        
        calBody.innerHTML = html;
    }

    window.showDayEvents = function(dateStr) {
        const events = [];
        var t = translations[currentLang];
        homework.filter(h => h.dueDate === dateStr).forEach(h => events.push({ title: h.title, desc: t.nav_homework + ': ' + h.subject }));
        exams.filter(e => e.date === dateStr).forEach(e => events.push({ title: e.name, desc: t.nav_exams + ': ' + e.subject }));
        
        const list = document.getElementById('eventsList');
        if (!list) return;
        if (events.length === 0) {
            list.innerHTML = '<div class="empty-state-sm">' + t.no_events + '</div>';
            return;
        }
        list.innerHTML = events.map(e => `
            <div class="event-item">
                <div class="event-title">${escapeHtml(e.title)}</div>
                <div class="event-type">${escapeHtml(e.desc)}</div>
            </div>
        `).join('');
    };

    // Pomodoro Timer
    function startPomodoro() {
        if (pomoState === 'running') return;
        pomoState = 'running';
        updatePomodoroControls();
        pomoTimer = setInterval(() => {
            if (pomoTimeLeft > 0) {
                pomoTimeLeft--;
                updatePomodoroDisplay();
            } else {
                finishPomodoroRound();
            }
        }, 1000);
    }

    function pausePomodoro() {
        pomoState = 'paused';
        clearInterval(pomoTimer);
        updatePomodoroControls();
    }

    function resetPomodoro() {
        pomoState = 'idle';
        clearInterval(pomoTimer);
        const mins = pomoMode === 'work' ? pomodoro.settings.workMinutes : (pomoBreakType === 'long' ? pomodoro.settings.longBreakMinutes : pomodoro.settings.shortBreakMinutes);
        pomoTimeLeft = mins * 60;
        pomoTotalTime = pomoTimeLeft;
        updatePomodoroDisplay();
        updatePomodoroControls();
    }

    function skipPomodoro() {
        resetPomodoro();
    }

    function finishPomodoroRound() {
        clearInterval(pomoTimer);
        pomoState = 'idle';
        
        if (pomoMode === 'work') {
            pomoRoundsDone++;
            pomodoro.todayStats.completedSessions++;
            pomodoro.todayStats.totalMinutes += pomodoro.settings.workMinutes;
            pomodoro.todayStats.currentStreak++;
            gamification.totalPomodoroSessions++;
            addPoints('pomodoro_completed');
            markDayActive();
            markActivity();
            
            pomodoro.todayStats.history.push({
                time: formatTime12(new Date().toTimeString().slice(0, 5)),
                duration: pomodoro.settings.workMinutes,
                mode: 'work'
            });
            
            if (pomoRoundsDone % pomodoro.settings.roundsBeforeLong === 0) {
                pomoMode = 'break';
                pomoBreakType = 'long';
                pomoTimeLeft = pomodoro.settings.longBreakMinutes * 60;
            } else {
                pomoMode = 'break';
                pomoBreakType = 'short';
                pomoTimeLeft = pomodoro.settings.shortBreakMinutes * 60;
            }
        } else {
            pomoMode = 'work';
            pomoTimeLeft = pomodoro.settings.workMinutes * 60;
        }
        
        pomoTotalTime = pomoTimeLeft;
        saveData();
        updatePomodoroDisplay();
        updatePomodoroControls();
        renderPomodoroStats();
        renderPomodoroHistory();

        const nextTab = pomoMode === 'work' ? 'work' : (pomoBreakType === 'long' ? 'long' : 'short');
        setActivePomoTab(nextTab);

        playNotificationSound();

        const t = translations[currentLang];
        const nextLabel = nextTab === 'work' ? t.pomodoro_work : (nextTab === 'long' ? t.pomodoro_long : t.pomodoro_short);
        showToast(t.notif_pomodoro, t.notif_pomodoro_body + ' ' + nextLabel, 'info');

        if ('Notification' in window && Notification.permission === 'granted') {
            const label = nextTab === 'work' ? t.pomodoro_work : (nextTab === 'long' ? t.pomodoro_long : t.pomodoro_short);
            new Notification(t.notif_pomodoro, { body: t.notif_pomodoro_body + ' ' + label });
        }
    }

    function initPomodoroDisplay() {
        updatePomodoroDisplay();
    }

    function updatePomodoroDisplay() {
        const mins = Math.floor(pomoTimeLeft / 60);
        const secs = pomoTimeLeft % 60;
        var el;
        if (el = document.getElementById('timerMinutes')) el.textContent = String(mins).padStart(2, '0');
        if (el = document.getElementById('timerSeconds')) el.textContent = String(secs).padStart(2, '0');

        const labelEl = document.getElementById('timerLabel');
        if (labelEl) {
            var t = translations[currentLang];
            const labels = { work: t.pomodoro_work, break: pomoBreakType === 'long' ? t.pomodoro_long : t.pomodoro_short };
            labelEl.textContent = labels[pomoMode] || t.pomodoro_work;
        }

        const circle = document.getElementById('circleProgress');
        if (circle) {
            const circumference = 2 * Math.PI * 90;
            const offset = circumference - (pomoTimeLeft / pomoTotalTime) * circumference;
            circle.style.strokeDasharray = `${circumference}`;
            circle.style.strokeDashoffset = `${offset}`;
        }
    }

    function updatePomodoroControls() {
        const startBtn = document.getElementById('pomoStartBtn');
        const pauseBtn = document.getElementById('pomoPauseBtn');
        if (!startBtn || !pauseBtn) return;
        if (pomoState === 'running') {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-block';
            pauseBtn.style.display = 'none';
        }
    }

    function setActivePomoTab(mode) {
        document.querySelectorAll('.pomo-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
    }

    function renderPomodoroStats() {
        var el;
        if (el = document.getElementById('pomoSessions')) el.textContent = pomodoro.todayStats.completedSessions;
        if (el = document.getElementById('pomoTotalMin')) el.textContent = pomodoro.todayStats.totalMinutes;
        if (el = document.getElementById('pomoStreak')) el.textContent = gamification.streak;
    }

    function renderPomodoroHistory() {
        const list = document.getElementById('pomoHistoryList');
        if (!list) return;
        var t = translations[currentLang];
        if (!pomodoro.todayStats.history || pomodoro.todayStats.history.length === 0) {
            list.innerHTML = '<div class="empty-state-sm">' + t.pomodoro_no_history + '</div>';
            return;
        }
        list.innerHTML = pomodoro.todayStats.history.map(h => `
            <div class="pomo-history-item">
                <span class="pomo-hist-time">${h.time}</span>
                <span class="pomo-hist-mode">${h.mode === 'work' ? t.pomodoro_work : t.pomodoro_short}</span>
                <span class="pomo-hist-dur">${h.duration} ${t.minutes}</span>
            </div>
        `).join('');
    }

    // Gamification & Points
    function addPoints(reason) {
        const pointValues = {
            homework_completed: 10,
            homework_completed_high: 20,
            exam_added: 5,
            subject_added: 5,
            schedule_generated: 15,
            pomodoro_completed: 15,
            timeblock_added: 5,
            timeblock_completed: 10
        };
        const pts = pointValues[reason] || 5;
        gamification.points += pts;
        gamification.xp += pts;
        
        if (gamification.xp >= gamification.level * 100) {
            gamification.level++;
        }

        gamification.pointsLog.unshift({
            reason: reason,
            points: pts,
            date: new Date().toISOString()
        });

        checkBadges();
        saveData();
        renderAchievements();
        renderPointsLog();
    }

    function markDayActive() {
        const today = new Date().toISOString().split('T')[0];
        if (gamification.lastActiveDate !== today) {
            gamification.streak++;
            gamification.lastActiveDate = today;
            saveData();
        }
    }

    function updateStreak() {
        const today = new Date();
        if (gamification.lastActiveDate) {
            const lastActive = new Date(gamification.lastActiveDate);
            const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) {
                gamification.streak = 0;
            }
        }
    }

    function checkBadges() {
        if (gamification.totalCompletedHW >= 1) unlockBadge('first_homework');
        if (gamification.totalCompletedHW >= 5) unlockBadge('five_homework');
        if (gamification.totalCompletedHW >= 10) unlockBadge('ten_homework');
        if (exams.length >= 1) unlockBadge('first_exam');
        if (gamification.totalPomodoroSessions >= 5) unlockBadge('pomodoro_5');
        if (gamification.totalPomodoroSessions >= 20) unlockBadge('pomodoro_20');
        if (gamification.streak >= 3) unlockBadge('streak_3');
        if (gamification.streak >= 7) unlockBadge('streak_7');
        if (gamification.level >= 5) unlockBadge('level_5');
        if (gamification.level >= 10) unlockBadge('level_10');
    }

    function unlockBadge(badgeKey) {
        if (!gamification.badges.includes(badgeKey)) {
            gamification.badges.push(badgeKey);
            saveData();
            renderBadges();
        }
    }

    function renderAchievements() {
        var el;
        if (el = document.getElementById('totalPoints')) el.textContent = gamification.points;
        if (el = document.getElementById('levelNumber')) el.textContent = gamification.level;
        if (el = document.getElementById('currentXP')) el.textContent = gamification.xp;
        if (el = document.getElementById('nextLevelXP')) el.textContent = gamification.level * 100;

        const levelTitles = translations[currentLang].level_titles;
        const titleIndex = Math.min(Math.floor(gamification.level / 3), levelTitles.length - 1);
        const titleEl = document.getElementById('levelTitle');
        if (titleEl) titleEl.textContent = levelTitles[titleIndex];

        const xpPercent = Math.min(100, (gamification.xp / (gamification.level * 100)) * 100);
        if (el = document.getElementById('xpFill')) el.style.width = xpPercent + '%';
    }

    function renderPointsLog() {
        const list = document.getElementById('pointsLogList');
        if (!list) return;
        var t = translations[currentLang];
        if (!gamification.pointsLog || gamification.pointsLog.length === 0) {
            list.innerHTML = '<div class="empty-state-sm">' + t.no_points + '</div>';
            return;
        }
        list.innerHTML = gamification.pointsLog.slice(0, 5).map(log => `
            <div class="points-log-item">
                <span class="points-log-points">+${log.points} ${t.points_label}</span>
                <span class="points-log-reason">${escapeHtml(log.reason)}</span>
                <small class="points-log-date">${new Date(log.date).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US')}</small>
            </div>
        `).join('');
    }

    function renderBadges() {
        document.querySelectorAll('.badge-item').forEach(el => {
            const b = el.dataset.badge;
            if (gamification.badges.includes(b)) {
                el.classList.remove('locked');
                el.classList.add('unlocked');
            }
        });
    }

    // Parent Dashboard
    function initParentDashboard() {
        if (!parentCode) generateParentCode();
        document.getElementById('parentCode').textContent = parentCode;
        updateParentStats();
        updateHomeworkProgress();
        updateWeeklyChart();
        updateParentExams();
        updateParentSchedule();
        renderExamsTomorrow();
    }

    function updateWeeklyChart() {
        const today = new Date();
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const bars = document.querySelectorAll('.chart-bar');
        
        bars.forEach((bar, index) => {
            const dayOffset = (today.getDay() - index + 7) % 7;
            const date = new Date(today);
            date.setDate(date.getDate() - dayOffset);
            const dateStr = date.toISOString().split('T')[0];
            const dayClasses = classes.filter(c => c.date === dateStr);
            const totalMin = dayClasses.reduce((sum, c) => sum + (c.duration || 0), 0);
            const maxMin = 300;
            const height = Math.min(100, (totalMin / maxMin) * 100);
            bar.style.height = height + '%';
        });
    }

    function updateParentExams() {
        const list = document.getElementById('parentExamsList');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = exams.filter(e => new Date(e.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (upcoming.length === 0) {
            list.innerHTML = '<div class="empty-state-sm">' + translations[currentLang].parent_no_exams + '</div>';
            return;
        }
        list.innerHTML = upcoming.map(exam => `
            <div class="parent-exam-item">
                <span class="parent-exam-name">${escapeHtml(exam.name)}</span>
                <span class="parent-exam-subject">${escapeHtml(exam.subject)}</span>
                <span class="parent-exam-date">${formatDate(exam.date)}</span>
            </div>
        `).join('');
    }

    function updateParentSchedule() {
        const list = document.getElementById('parentSchedule');
        if (dailySchedule.length === 0) {
            list.innerHTML = '<div class="empty-state-sm">' + translations[currentLang].parent_no_schedule + '</div>';
            return;
        }
        list.innerHTML = dailySchedule.slice(0, 8).map(item => `
            <div class="parent-schedule-item">
                <span class="parent-sch-time">${formatTime12(item.time)}</span>
                <span class="parent-sch-activity">${escapeHtml(item.activity)}</span>
            </div>
        `).join('');
    }

    function generateParentCode() {
        parentCode = 'BTS-' + Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem('bts_parent_code_' + currentUser.id, parentCode);
        var users = JSON.parse(localStorage.getItem('bts_users') || '[]');
        var userIndex = users.findIndex(function(u){ return u.id === currentUser.id; });
        if (userIndex !== -1) {
            users[userIndex].parentCode = parentCode;
            localStorage.setItem('bts_users', JSON.stringify(users));
        }
        const codeEl = document.getElementById('parentCode');
        if (codeEl) codeEl.textContent = parentCode;
    }

    function updateParentStats() {
        const completed = homework.filter(h => h.completed).length;
        const pending = homework.filter(h => !h.completed).length;
        
        var el;
        if (el = document.getElementById('parentCompletedHW')) el.textContent = completed;
        if (el = document.getElementById('parentPendingHW')) el.textContent = pending;
        if (el = document.getElementById('parentStudyHours')) el.textContent = (pomodoro.todayStats.totalMinutes / 60).toFixed(1);
        if (el = document.getElementById('parentPoints')) el.textContent = gamification.points;
    }

    function updateHomeworkProgress() {
        const total = homework.length;
        const completed = homework.filter(h => h.completed).length;
        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
        
        const fill = document.getElementById('hwProgressFill');
        const text = document.getElementById('hwProgressText');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = pct + '%';

        updateParentExams();
        updateParentSchedule();
        renderExamsTomorrow();
    }

    function renderExamsTomorrow() {
        const list = document.getElementById('examsTomorrowList');
        const section = document.getElementById('examsTomorrow');
        if (!list) return;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowExams = exams.filter(e => e.date === tomorrowStr);
        if (tomorrowExams.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        if (section) section.style.display = 'block';
        list.innerHTML = tomorrowExams.map(e => `
            <div class="task-card">
                <div class="timeline-icon exam"><i class="fas fa-file-alt"></i></div>
                <div class="task-info">
                    <div class="task-title">${escapeHtml(e.name)}</div>
                    <div class="task-meta">
                        <span><i class="fas fa-book"></i> ${escapeHtml(e.subject)}</span>
                        <span><i class="fas fa-clock"></i> ${formatTime12(e.time)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Password & Security Extensions
    function saveSettings() {
        currentUser.settings = {
            wakeUpTime: document.getElementById('wakeUpTime')?.value || '06:00',
            sleepTime: document.getElementById('sleepTime')?.value || '22:00',
            schoolStart: document.getElementById('schoolStart')?.value || '07:30',
            schoolEnd: document.getElementById('schoolEnd')?.value || '14:00',
            breakfastTime: document.getElementById('breakfastTime')?.value || '06:30',
            lunchTime: document.getElementById('lunchTime')?.value || '14:30',
            dinnerTime: document.getElementById('dinnerTime')?.value || '20:00',
            exerciseTime: document.getElementById('exerciseTime')?.value || '16:00',
            showerTime: document.getElementById('showerTime')?.value || '21:00'
        };
        
        const users = JSON.parse(localStorage.getItem('bts_users') || '[]');
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            users[userIndex].settings = currentUser.settings;
            localStorage.setItem('bts_users', JSON.stringify(users));
        }
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }

    function generateSalt() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function verifyPassword(password, userRecord) {
        if (userRecord.salt && userRecord.passwordHash) {
            const hash = await hashPassword(password, userRecord.salt);
            return hash === userRecord.passwordHash;
        }
        return userRecord.password === password;
    }

    async function changePassword(e) {
        e.preventDefault();
        var t = translations[currentLang];
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        const errorEl = document.getElementById('passwordError');
        
        errorEl.textContent = '';
        
        if (newPassword.length < 6) {
            errorEl.textContent = t.pw_err_too_short;
            return;
        }
        if (newPassword !== confirmPassword) {
            errorEl.textContent = t.pw_err_no_match;
            return;
        }

        const users = JSON.parse(localStorage.getItem('bts_users') || '[]');
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex === -1) {
            errorEl.textContent = t.pw_err_unexpected;
            return;
        }

        try {
            const isValid = await verifyPassword(currentPassword, users[userIndex]);
            if (!isValid) {
                errorEl.textContent = t.pw_err_current_wrong;
                return;
            }
            const salt = generateSalt();
            const passwordHash = await hashPassword(newPassword, salt);
            
            users[userIndex].salt = salt;
            users[userIndex].passwordHash = passwordHash;
            delete users[userIndex].password;
            
            localStorage.setItem('bts_users', JSON.stringify(users));
            showToast(translations[currentLang].toast_pw_changed, translations[currentLang].toast_pw_changed, 'success');
            document.getElementById('changePasswordForm').reset();
        } catch (err) {
            errorEl.textContent = translations[currentLang].pw_err_change_failed;
        }
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    // ========================================
    // Theme Toggle System
    // ========================================
    function initTheme() {
        if (currentTheme === 'auto' || !currentTheme) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentTheme = prefersDark ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', currentTheme);
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', toggleTheme);
        }
    }

    function toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        saveData();
        showToast(translations[currentLang].toast_theme_changed, currentTheme === 'dark' ? translations[currentLang].toast_dark : translations[currentLang].toast_light, 'info');
    }

    // ========================================
    // Push Notifications System
    // ========================================
    function initNotificationSettings() {
        const hwToggle = document.getElementById('notifHomework');
        const examToggle = document.getElementById('notifExams');
        const schedToggle = document.getElementById('notifSchedule');
        const dailyToggle = document.getElementById('notifDailyReminder');

        if (hwToggle) {
            hwToggle.checked = notificationSettings.homework;
            hwToggle.addEventListener('change', function() {
                notificationSettings.homework = this.checked;
                saveData();
            });
        }
        if (examToggle) {
            examToggle.checked = notificationSettings.exams;
            examToggle.addEventListener('change', function() {
                notificationSettings.exams = this.checked;
                saveData();
            });
        }
        if (schedToggle) {
            schedToggle.checked = notificationSettings.schedule;
            schedToggle.addEventListener('change', function() {
                notificationSettings.schedule = this.checked;
                saveData();
            });
        }
        if (dailyToggle) {
            dailyToggle.checked = notificationSettings.dailyReminder;
            dailyToggle.addEventListener('change', function() {
                notificationSettings.dailyReminder = this.checked;
                saveData();
            });
        }
    }

    function scheduleNotifications() {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        setInterval(function() {
            checkHomeworkNotifications();
            checkExamNotifications();
            checkScheduleNotifications();
            checkDailyReminder();
        }, 60000);

        checkHomeworkNotifications();
        checkExamNotifications();
        checkDailyReminder();
    }

    function checkDailyReminder() {
        if (!notificationSettings.dailyReminder) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const today = new Date().toISOString().split('T')[0];
        const todayKey = 'bts_dailyReminderSent_' + currentUser.id;
        if (localStorage.getItem(todayKey) === today) return;
        const hour = new Date().getHours();
        if (hour < 9 || hour > 21) return;
        localStorage.setItem(todayKey, today);
        var t = translations[currentLang];
        new Notification(t.toast_reminder_title, {
            body: t.toast_daily_reminder,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>'
        });
        showToast(t.toast_reminder_title, t.toast_daily_reminder);
    }

    function checkHomeworkNotifications() {
        if (!notificationSettings.homework) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        var t = translations[currentLang];
        const today = new Date().toISOString().split('T')[0];
        const dueToday = homework.filter(h => !h.completed && h.dueDate === today);
        if (dueToday.length > 0 && Notification.permission === 'granted') {
            new Notification(t.notif_hw_due, {
                body: t.notif_hw_due_body + ' ' + dueToday.length + ' ' + t.notif_hw_due_count,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>'
            });
        }
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const dueTomorrow = homework.filter(h => !h.completed && h.dueDate === tomorrowStr);
        if (dueTomorrow.length > 0 && Notification.permission === 'granted') {
            new Notification(t.notif_hw_tomorrow, {
                body: t.notif_hw_tomorrow_body + ' ' + dueTomorrow.length + ' ' + t.notif_hw_tomorrow_count
            });
        }
    }

    function checkExamNotifications() {
        if (!notificationSettings.exams) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        var t = translations[currentLang];
        const today = new Date().toISOString().split('T')[0];
        const todayExams = exams.filter(e => e.date === today);
        if (todayExams.length > 0 && Notification.permission === 'granted') {
            new Notification(t.notif_exam_today, {
                body: t.notif_exam_today_body + ' ' + todayExams.length + ' ' + t.notif_exam_today_count + ' ' + todayExams.map(e => e.name).join(', ')
            });
        }
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowExams = exams.filter(e => e.date === tomorrowStr);
        if (tomorrowExams.length > 0 && Notification.permission === 'granted') {
            new Notification(t.notif_exam_tomorrow, {
                body: t.notif_exam_tomorrow_body + ' ' + tomorrowExams.length + ' ' + t.notif_exam_tomorrow_count + ' ' + tomorrowExams.map(e => e.name).join(', ')
            });
        }
    }

    function checkScheduleNotifications() {
        if (!notificationSettings.schedule || dailySchedule.length === 0) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        var t = translations[currentLang];
        const now = new Date();
        const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const currentMin = timeToMinutes(currentTime);

        dailySchedule.forEach(function(item) {
            const itemMin = timeToMinutes(item.time);
            if (Math.abs(itemMin - currentMin) === 0 && Notification.permission === 'granted') {
                new Notification(t.notif_schedule, { body: item.activity });
            }
        });
    }

    // ========================================
    // Toast Notification System
    // ========================================
    function showToast(title, message, type) {
        const toast = document.getElementById('notificationToast');
        if (!toast) return;
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = toast.querySelector('.toast-icon');

        if (toastTitle) toastTitle.textContent = title;
        if (toastMessage) toastMessage.textContent = message;
        if (toastIcon) {
            toastIcon.className = 'toast-icon ' + (type || 'info');
            const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', info: 'fa-info-circle' };
            toastIcon.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i>';
        }

        toast.classList.remove('hidden');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(function() { toast.classList.add('hidden'); }, 4000);

        var closeBtn = document.getElementById('toastClose');
        if (closeBtn) closeBtn.onclick = function() { toast.classList.add('hidden'); };
    }

    // ========================================
    // Task Tracking System
    // ========================================
    function initTaskTracking() {
        const form = document.getElementById('timeBlockForm');
        if (form) {
            form.addEventListener('submit', addTimeBlock);
        }
    }

    function addTimeBlock(e) {
        e.preventDefault();
        const block = {
            id: generateId(),
            title: document.getElementById('tbTitle').value,
            subject: document.getElementById('tbSubject').value,
            startTime: document.getElementById('tbStartTime').value,
            endTime: document.getElementById('tbEndTime').value,
            priority: document.getElementById('tbPriority').value,
            type: document.getElementById('tbType').value,
            completed: false,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };
        timeBlocks.push(block);
        addPoints('timeblock_added');
        saveData();
        renderTimeBlocks();
        renderTodayChecklist();
        updateTrackingStats();
        document.getElementById('timeBlockForm').reset();
        showToast(translations[currentLang].save, translations[currentLang].toast_block_added, 'success');
    }

    function renderTimeBlocks() {
        const grid = document.getElementById('timeBlocksGrid');
        if (!grid) return;
        const today = new Date().toISOString().split('T')[0];
        const todayBlocks = timeBlocks.filter(b => b.date === today);

        if (todayBlocks.length === 0) {
            grid.innerHTML = '<div class="empty-state-sm">' + translations[currentLang].tracking_no_blocks + '</div>';
            return;
        }

        var t = translations[currentLang];
        const typeLabels = { study: t.type_study, review: t.type_review, homework: t.type_homework, project: t.type_project };
        const typeIcons = { study: 'book', review: 'redo', homework: 'book-open', project: 'project-diagram' };

        grid.innerHTML = todayBlocks.sort(function(a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); }).map(function(block) {
            return '<div class="time-block-item priority-' + block.priority + ' ' + (block.completed ? 'completed' : '') + '">' +
                '<div class="time-block-time">' +
                    '<div class="start-time">' + formatTime12(block.startTime) + '</div>' +
                    '<div class="end-time">' + (currentLang === 'ar' ? 'إلى ' : 'to ') + formatTime12(block.endTime) + '</div>' +
                '</div>' +
                '<div class="time-block-info">' +
                    '<div class="time-block-title">' + escapeHtml(block.title) + '</div>' +
                    '<div class="time-block-meta">' +
                        '<span><i class="fas fa-book"></i> ' + escapeHtml(block.subject) + '</span>' +
                        '<span><i class="fas fa-' + (typeIcons[block.type] || 'tag') + '"></i> ' + (typeLabels[block.type] || block.type) + '</span>' +
                        '<span class="priority-badge priority-' + block.priority + '">' + getPriorityLabel(block.priority) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="task-actions">' +
                    '<button onclick="toggleTimeBlock(\'' + escapeHtml(block.id) + '\')" title="' + (block.completed ? t.cancel : t.btn_add) + '"><i class="fas fa-' + (block.completed ? 'undo' : 'check') + '"></i></button>' +
                    '<button onclick="deleteTimeBlock(\'' + escapeHtml(block.id) + '\')"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    window.toggleTimeBlock = function(id) {
        const block = timeBlocks.find(function(b) { return b.id === id; });
        if (block) {
            block.completed = !block.completed;
            if (block.completed) {
                gamification.totalCompletedHW++;
                addPoints('timeblock_completed');
                markDayActive();
            }
            saveData();
            renderTimeBlocks();
            renderTodayChecklist();
            updateTrackingStats();
        }
    };

    window.deleteTimeBlock = function(id) {
        if (confirm(translations[currentLang].confirm_delete_block || 'حذف بلوك الوقت؟')) {
            timeBlocks = timeBlocks.filter(function(b) { return b.id !== id; });
            saveData();
            renderTimeBlocks();
            renderTodayChecklist();
            updateTrackingStats();
        }
    };

    function renderTodayChecklist() {
        const container = document.getElementById('todayChecklist');
        if (!container) return;
        const today = new Date().toISOString().split('T')[0];
        const todayBlocks = timeBlocks.filter(function(b) { return b.date === today; });

        if (todayBlocks.length === 0) {
            container.innerHTML = '<div class="empty-state-sm">' + translations[currentLang].tracking_no_blocks + '</div>';
            return;
        }

        container.innerHTML = todayBlocks.map(function(block) {
            return '<div class="checklist-item ' + (block.completed ? 'completed' : '') + '">' +
                '<div class="checklist-check ' + (block.completed ? 'checked' : '') + '" onclick="toggleTimeBlock(\'' + escapeHtml(block.id) + '\')"></div>' +
                '<span class="checklist-label">' + escapeHtml(block.title) + ' - ' + escapeHtml(block.subject) + '</span>' +
                '<span class="checklist-time">' + formatTime12(block.startTime) + ' - ' + formatTime12(block.endTime) + '</span>' +
            '</div>';
        }).join('');

        const achContainer = document.getElementById('achievementsChecklist');
        if (achContainer) {
            achContainer.innerHTML = container.innerHTML;
        }
    }

    function renderWeeklyActivity() {
        const grid = document.getElementById('taskWeeklyActivityGrid');
        const achGrid = document.getElementById('achievementsActivityGrid');
        if (!grid && !achGrid) return;

        const dayLabels = currentLang === 'ar' ? ['سب','أح','إث','ثل','أر','خم','جم'] : ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
        const today = new Date();
        let html = '';

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayActivity = dailyActivity[dateStr] || 0;
            const level = dayActivity >= 4 ? 4 : dayActivity >= 3 ? 3 : dayActivity >= 2 ? 2 : dayActivity >= 1 ? 1 : 0;
            const dayIndex = date.getDay();
            const dayName = dayLabels[dayIndex];

            html += '<div class="activity-day">' +
                '<div class="activity-day-label">' + dayName + '</div>' +
                '<div class="activity-dot active-' + level + '"></div>' +
            '</div>';
        }

        if (grid) grid.innerHTML = html;
        if (achGrid) achGrid.innerHTML = html;
    }

    function updateTrackingStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayBlocks = timeBlocks.filter(function(b) { return b.date === today; });
        const completedBlocks = todayBlocks.filter(function(b) { return b.completed; });
        const totalMinutes = todayBlocks.reduce(function(sum, b) {
            return sum + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
        }, 0);
        const pct = todayBlocks.length > 0 ? Math.round((completedBlocks.length / todayBlocks.length) * 100) : 0;

        // page-tasktracking IDs
        var el1 = document.getElementById('taskTotalStudyHours');
        var el2 = document.getElementById('taskCompletedBlocks');
        var el3 = document.getElementById('taskStudyStreak');
        var el4 = document.getElementById('taskEfficiencyScore');
        if (el1) el1.textContent = (totalMinutes / 60).toFixed(1);
        if (el2) el2.textContent = completedBlocks.length;
        if (el3) el3.textContent = gamification.streak;
        if (el4) el4.textContent = pct + '%';
    }

    function markActivity() {
        const today = new Date().toISOString().split('T')[0];
        dailyActivity[today] = (dailyActivity[today] || 0) + 1;
        saveData();
    }

    // ========================================
    // AI Habit Analysis
    // ========================================
    function generateHabitInsights() {
        const container = document.getElementById('habitInsights');
        if (!container) return;

        const insights = [];
        const today = new Date().toISOString().split('T')[0];
        var t = translations[currentLang];

        if (homework.length > 0) {
            const completedRatio = homework.filter(function(h) { return h.completed; }).length / homework.length;
            if (completedRatio >= 0.8) {
                insights.push({ type: 'success', icon: 'fa-check-circle', title: currentLang === 'ar' ? 'أداء ممتاز!' : 'Great performance!', text: (currentLang === 'ar' ? 'أكملت ' : 'You completed ') + Math.round(completedRatio * 100) + (currentLang === 'ar' ? '% من واجباتك. استمر في هذا الأداء الرائع!' : '% of your homework. Keep up the great work!') });
            } else if (completedRatio < 0.4) {
                insights.push({ type: 'warning', icon: 'fa-exclamation-triangle', title: currentLang === 'ar' ? 'يجب مراجعة الواجبات' : 'Review homework needed', text: (currentLang === 'ar' ? 'لديك ' : 'You have ') + homework.filter(function(h) { return !h.completed; }).length + (currentLang === 'ar' ? ' واجبات معلقة. حاول تخصيص أوقات محددة للإنجاز.' : ' pending homework. Try setting specific times to complete them.') });
            }
        }

        if (exams.length > 0) {
            const upcomingExams = exams.filter(function(e) { return new Date(e.date) >= new Date(); });
            const nearestExam = upcomingExams.sort(function(a, b) { return new Date(a.date) - new Date(b.date); })[0];
            if (nearestExam) {
                const daysUntil = Math.ceil((new Date(nearestExam.date) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysUntil <= 3) {
                    insights.push({ type: 'warning', icon: 'fa-clock', title: currentLang === 'ar' ? 'امتحان قريب!' : 'Exam coming soon!', text: (currentLang === 'ar' ? 'امتحان ' : 'Exam: ') + nearestExam.subject + (currentLang === 'ar' ? ' بعد ' : ' in ') + daysUntil + (currentLang === 'ar' ? ' أيام. ركز على المراجعة المكثفة.' : ' days. Focus on intensive review.') });
                } else if (daysUntil <= 7) {
                    insights.push({ type: 'tip', icon: 'fa-lightbulb', title: currentLang === 'ar' ? 'تخطيط للامتحان' : 'Exam planning', text: (currentLang === 'ar' ? 'امتحان ' : 'Exam: ') + nearestExam.subject + (currentLang === 'ar' ? ' بعد ' : ' in ') + daysUntil + (currentLang === 'ar' ? ' أيام. ابدأ بمراجعة المواد الأساسية.' : ' days. Start reviewing core subjects.') });
                }
            }
        }

        if (gamification.streak >= 3) {
            insights.push({ type: 'success', icon: 'fa-fire', title: currentLang === 'ar' ? 'سلسلة نشاط!' : 'Activity streak!', text: (currentLang === 'ar' ? 'أنت نشط منذ ' : 'You have been active for ') + gamification.streak + (currentLang === 'ar' ? ' أيام متتالية. هذا رائع للحفاظ على الإيقاع!' : ' days straight. Great for maintaining momentum!') });
        }

        if (pomodoro.todayStats.completedSessions >= 4) {
            insights.push({ type: 'success', icon: 'fa-clock', title: currentLang === 'ar' ? 'مذاكرة منظمة!' : 'Organized studying!', text: (currentLang === 'ar' ? 'أكملت ' : 'Completed ') + pomodoro.todayStats.completedSessions + (currentLang === 'ar' ? ' جولات بومودورو اليوم. هذا يحسن التركيز والتركيز.' : ' pomodoro rounds today. This improves focus and concentration.') });
        }

        const totalStudyMin = classes.filter(function(c) { return c.date === today; }).reduce(function(sum, c) { return sum + c.duration; }, 0) + pomodoro.todayStats.totalMinutes;
        if (totalStudyMin < 60 && new Date().getHours() > 16) {
            insights.push({ type: 'tip', icon: 'fa-lightbulb', title: currentLang === 'ar' ? 'مذاكرة إضافية' : 'Additional study', text: currentLang === 'ar' ? 'لدت مذاكرتك اليوم قليلة. حاول إضافة بلوك وقت إضافي للمراجعة.' : 'Your study time today is low. Try adding an extra time block for review.' });
        }

        if (insights.length === 0) {
            insights.push({ type: 'tip', icon: 'fa-info-circle', title: currentLang === 'ar' ? 'ابدأ النشاط' : 'Start being active', text: currentLang === 'ar' ? 'أضف واجباتك وامتحاناتك ومواد اليوم للحصول على تحليلات ذكية مخصصة لعاداتك.' : 'Add your homework, exams, and today\'s subjects to get smart insights tailored to your habits.' });
        }

        const insightsHtml = insights.map(function(insight) {
            return '<div class="habit-insight-item ' + insight.type + '">' +
                '<div class="habit-insight-icon"><i class="fas ' + insight.icon + '"></i></div>' +
                '<div class="habit-insight-text">' +
                    '<strong>' + escapeHtml(insight.title) + '</strong>' +
                    '<p>' + escapeHtml(insight.text) + '</p>' +
                '</div>' +
            '</div>';
        }).join('');

        if (container) container.innerHTML = insightsHtml;
    }

    // ========================================
    // Data Export/Import System
    // ========================================
    function exportData() {
        const userId = currentUser.id;
        const exportObj = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            user: { displayName: currentUser.displayName, email: currentUser.email },
            data: {
                homework: homework,
                exams: exams,
                classes: classes,
                schedule: dailySchedule,
                gamification: gamification,
                pomodoro: pomodoro,
                timeBlocks: timeBlocks,
                dailyActivity: dailyActivity,
                notificationSettings: notificationSettings,
                conversations: conversations
            }
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'back-to-school-backup-' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(translations[currentLang].toast_export_title, translations[currentLang].toast_export_success, 'success');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (!imported.data || imported.version !== '2.0') {
                    showToast(translations[currentLang].close, translations[currentLang].toast_import_error, 'danger');
                    return;
                }

                if (!confirm(translations[currentLang].toast_import_confirm)) return;

                homework = imported.data.homework || [];
                exams = imported.data.exams || [];
                classes = imported.data.classes || [];
                dailySchedule = imported.data.schedule || [];
                gamification = imported.data.gamification || gamification;
                pomodoro = imported.data.pomodoro || pomodoro;
                timeBlocks = imported.data.timeBlocks || [];
                dailyActivity = imported.data.dailyActivity || {};
                notificationSettings = imported.data.notificationSettings || notificationSettings;
                conversations = imported.data.conversations || [];

                saveData();
                loadData();
                showToast(translations[currentLang].toast_import_title, translations[currentLang].toast_import_success, 'success');
            } catch(err) {
                showToast(translations[currentLang].close, translations[currentLang].toast_import_error2, 'danger');
            }
        };
        reader.readAsText(file);
    }

    function initExportImport() {
        const exportBtn = document.getElementById('exportDataBtn');
        const importBtn = document.getElementById('importDataBtn');
        const importInput = document.getElementById('importFileInput');

        if (exportBtn) exportBtn.addEventListener('click', exportData);
        if (importBtn) importBtn.addEventListener('click', function() { importInput.click(); });
        if (importInput) importInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) importData(e.target.files[0]);
            e.target.value = '';
        });
    }

    // ========================================
    // Enhanced AI Response with Habit Analysis
    // ========================================
    function generateAIResponse(message) {
        var t = translations[currentLang];
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('جدول') || lowerMsg.includes('تنظيم') || lowerMsg.includes('خطة') || lowerMsg.includes('schedule') || lowerMsg.includes('plan')) {
            generateDailySchedule();
            return t.ai_resp_schedule;
        }
        if (lowerMsg.includes('حصص') || lowerMsg.includes('حصة') || lowerMsg.includes('مواد') || lowerMsg.includes('subject') || lowerMsg.includes('class')) {
            const todayDate = new Date().toISOString().split('T')[0];
            const todaySubjects = classes.filter(function(c) { return c.date === todayDate; });
            if (todaySubjects.length > 0) {
                const totalTime = todaySubjects.reduce(function(sum, s) { return sum + (s.duration || 45); }, 0);
                return t.ai_resp_classes_count + todaySubjects.length + t.ai_resp_classes_minutes + totalTime + t.minutes + '):<br>' +
                    todaySubjects.map(function(c) { return '• ' + escapeHtml(c.name) + ' - ' + c.duration + ' ' + t.minutes + ' (' + t.task_priority + ': ' + getPriorityLabel(c.priority) + ')'; }).join('<br>');
            }
            return t.ai_resp_no_classes;
        }
        if (lowerMsg.includes('واجب') || lowerMsg.includes('homework')) {
            const todayHw = homework.filter(function(h) { return !h.completed; });
            if (todayHw.length > 0) {
                return t.ai_resp_hw_count + todayHw.length + t.ai_resp_hw_list + '<br>' +
                    todayHw.map(function(h) { return '• ' + escapeHtml(h.title) + ' - ' + escapeHtml(h.subject); }).join('<br>');
            }
            return t.ai_resp_no_hw;
        }
        if (lowerMsg.includes('امتحان') || lowerMsg.includes('اختبار') || lowerMsg.includes('exam') || lowerMsg.includes('test')) {
            const upcomingExams = exams.filter(function(e) { return new Date(e.date) >= new Date(); }).slice(0, 3);
            if (upcomingExams.length > 0) {
                return t.ai_resp_exams + '<br>' +
                    upcomingExams.map(function(e) { return '• ' + escapeHtml(e.name) + ' - ' + escapeHtml(e.subject) + ' (' + formatDate(e.date) + ')'; }).join('<br>');
            }
            return t.ai_resp_no_exams;
        }
        if (lowerMsg.includes('نصيحة') || lowerMsg.includes('اقتراح') || lowerMsg.includes('تحليل') || lowerMsg.includes('tip') || lowerMsg.includes('advice') || lowerMsg.includes('suggest')) {
            const tips = [];
            if (gamification.streak >= 3) tips.push(t.ai_resp_tip_streak + gamification.streak + t.ai_resp_tip_streak2);
            if (pomodoro.todayStats.completedSessions < 3) tips.push(t.ai_resp_tip_pomo);
            const pendingHw = homework.filter(function(h) { return !h.completed; }).length;
            if (pendingHw > 3) tips.push(t.ai_resp_tip_hw + pendingHw + t.ai_resp_tip_hw2);
            if (tips.length === 0) tips.push(t.ai_resp_tip_start);
            return t.ai_resp_tips + '<br>' + tips.map(function(tip) { return '• ' + tip; }).join('<br>');
        }
        if (lowerMsg.includes('تتبع') || lowerMsg.includes('بلوك') || lowerMsg.includes('وقت') || lowerMsg.includes('track') || lowerMsg.includes('block')) {
            navigateTo('tasktracking');
            return t.ai_resp_tracking;
        }
        if (lowerMsg.includes('إنجاز') || lowerMsg.includes('نقاط') || lowerMsg.includes('نiveau') || lowerMsg.includes('achievement') || lowerMsg.includes('point') || lowerMsg.includes('level')) {
            return '📊 ' + t.ai_resp_stats + ':<br>• ' + t.nav_achievements + ': ' + gamification.level + '<br>• ' + t.points_label + ': ' + gamification.points + '<br>• ' + t.tracking_streak + ': ' + gamification.streak + '<br>• ' + t.stat_completed + ': ' + gamification.totalCompletedHW;
        }
        if (lowerMsg.includes('تصدير') || lowerMsg.includes('نسخ') || lowerMsg.includes('احتياطي') || lowerMsg.includes('export') || lowerMsg.includes('backup')) {
            navigateTo('settings');
            return t.ai_resp_export;
        }
        return t.ai_resp_default;
    }

})();