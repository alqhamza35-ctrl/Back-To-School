// ========================================
// Back to School - Authentication Module
// ========================================

(function() {
    'use strict';

    var currentLang = localStorage.getItem('bts_lang') || 'ar';
    var authTranslations = {
        ar: {
            err_invalid_email: 'البريد الإلكتروني غير صالح.',
            err_locked: 'تم حظر الحساب مؤقتاً. حاول مرة أخرى بعد ',
            err_locked_min: ' دقيقة.',
            err_wrong_credentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
            err_attempts_remaining: ' محاولات متبقية.',
            err_device_bound: 'هذا الحساب مرتبط بجهاز آخر.',
            err_name_length: 'يجب أن يكون الاسم بين 2 و 50 حرف.',
            err_password_short: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.',
            err_password_long: 'كلمة المرور طويلة جداً (الحد الأقصى 128 حرف).',
            err_passwords_no_match: 'كلمتا المرور غير متطابقتين.',
            err_email_taken: 'البريد الإلكتروني مسجل بالفعل.',
            pw_weak: 'ضعيفة',
            pw_medium: 'متوسطة',
            pw_strong: 'قوية',
            pw_strength: 'قوة كلمة المرور: '
        },
        en: {
            err_invalid_email: 'Invalid email address.',
            err_locked: 'Account temporarily locked. Try again in ',
            err_locked_min: ' minutes.',
            err_wrong_credentials: 'Invalid email or password.',
            err_attempts_remaining: ' attempts remaining.',
            err_device_bound: 'This account is linked to another device.',
            err_name_length: 'Name must be between 2 and 50 characters.',
            err_password_short: 'Password must be at least 6 characters.',
            err_password_long: 'Password is too long (max 128 characters).',
            err_passwords_no_match: 'Passwords do not match.',
            err_email_taken: 'Email is already registered.',
            pw_weak: 'Weak',
            pw_medium: 'Medium',
            pw_strong: 'Strong',
            pw_strength: 'Password strength: '
        }
    };
    function t(key) { return authTranslations[currentLang][key] || authTranslations['ar'][key]; }

    // Security config
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes
    const SALT_LENGTH = 32;

    // Check if already logged in
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        window.location.href = 'dashboard.html';
        return;
    }

    // ========================================
    // Password Hashing (SHA-256 with salt)
    // ========================================
    async function hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function generateSalt() {
        const array = new Uint8Array(SALT_LENGTH);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ========================================
    // Rate Limiting
    // ========================================
    function getLoginAttempts(email) {
        try {
            const data = JSON.parse(localStorage.getItem('bts_login_attempts') || '{}');
            return data[email] || { count: 0, lastAttempt: 0 };
        } catch (e) {
            return { count: 0, lastAttempt: 0 };
        }
    }

    function recordLoginAttempt(email, success) {
        try {
            const data = JSON.parse(localStorage.getItem('bts_login_attempts') || '{}');
            if (success) {
                delete data[email];
            } else {
                const current = data[email] || { count: 0, lastAttempt: 0 };
                data[email] = {
                    count: current.count + 1,
                    lastAttempt: Date.now()
                };
            }
            localStorage.setItem('bts_login_attempts', JSON.stringify(data));
        } catch (e) {}
    }

    function isLockedOut(email) {
        const attempts = getLoginAttempts(email);
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            const elapsed = Date.now() - attempts.lastAttempt;
            if (elapsed < LOCKOUT_TIME) {
                const remaining = Math.ceil((LOCKOUT_TIME - elapsed) / 60000);
                return { locked: true, remaining: remaining };
            }
        }
        return { locked: false };
    }

    // ========================================
    // Input Sanitization
    // ========================================
    function sanitizeInput(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // ========================================
    // Login Form
    // ========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const errorMessage = document.getElementById('errorMessage');

            const email = sanitizeInput(emailInput.value.trim());
            const password = passwordInput.value;

            errorMessage.textContent = '';

            // Validate email
            if (!validateEmail(email)) {
                errorMessage.textContent = t('err_invalid_email');
                return;
            }

            // Check rate limiting
            const lockStatus = isLockedOut(email);
            if (lockStatus.locked) {
                errorMessage.textContent = t('err_locked') + lockStatus.remaining + t('err_locked_min');
                return;
            }

            // Get users from localStorage
            let users = [];
            try {
                const storedUsers = localStorage.getItem('bts_users');
                if (storedUsers) {
                    users = JSON.parse(storedUsers);
                    if (!Array.isArray(users)) {
                        users = [];
                    }
                }
            } catch (e) {
                users = [];
            }

            // Find user by email first, then verify password hash
            const userIndex = users.findIndex(u => u.email === email);

            if (userIndex === -1) {
                recordLoginAttempt(email, false);
                errorMessage.textContent = t('err_wrong_credentials');
                return;
            }

            const user = users[userIndex];
            let passwordValid = false;

            // Support both hashed and legacy plain-text passwords
            if (user.salt && user.passwordHash) {
                const hash = await hashPassword(password, user.salt);
                passwordValid = hash === user.passwordHash;
            } else {
                // Legacy: plain text comparison (one-time migration)
                passwordValid = user.password === password;
                if (passwordValid) {
                    // Migrate to hashed password
                    const salt = generateSalt();
                    user.salt = salt;
                    user.passwordHash = await hashPassword(password, salt);
                    delete user.password;
                    users[userIndex] = user;
                    localStorage.setItem('bts_users', JSON.stringify(users));
                }
            }

            if (!passwordValid) {
                recordLoginAttempt(email, false);
                const attempts = getLoginAttempts(email);
                const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
                if (remaining > 0 && remaining <= 2) {
                    errorMessage.textContent = t('err_wrong_credentials') + t('err_attempts_remaining') + remaining;
                } else {
                    errorMessage.textContent = t('err_wrong_credentials');
                }
                return;
            }

            // Success - clear rate limit
            recordLoginAttempt(email, true);

            // Check device binding
            const deviceId = getDeviceId();
            if (user.deviceId && user.deviceId !== deviceId) {
                errorMessage.textContent = t('err_device_bound');
                return;
            }

            // Update device binding
            user.deviceId = deviceId;
            users[userIndex] = user;
            localStorage.setItem('bts_users', JSON.stringify(users));

            // Remove sensitive fields from session
            const sessionUser = Object.assign({}, user);
            delete sessionUser.salt;
            delete sessionUser.passwordHash;
            delete sessionUser.password;

            // Save current user session
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));

            // Firebase Auth sign in (background, non-blocking)
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().signInWithEmailAndPassword(email, password).then(function() {
                    console.log('Firebase sign-in successful');
                    // Sync data from cloud after sign-in
                    if (typeof DataSync !== 'undefined') {
                        DataSync.syncFromCloud(user.id).catch(function(err) {
                            console.warn('Cloud sync failed:', err);
                        });
                        DataSync.startAutoSync(user.id);
                    }
                    // Get FCM token
                    if (typeof FCM !== 'undefined') {
                        FCM.requestPermission();
                    }
                }).catch(function(err) {
                    console.warn('Firebase sign-in failed (localStorage login still works):', err.message);
                });
            }

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        });
    }

    // ========================================
    // Signup Form
    // ========================================
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const displayNameInput = document.getElementById('displayName');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const confirmPasswordInput = document.getElementById('confirmPassword');
            const errorMessage = document.getElementById('errorMessage');

            const displayName = sanitizeInput(displayNameInput.value.trim());
            const email = sanitizeInput(emailInput.value.trim());
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            errorMessage.textContent = '';

            // Validate displayName
            if (displayName.length < 2 || displayName.length > 50) {
                errorMessage.textContent = t('err_name_length');
                return;
            }

            // Validate email
            if (!validateEmail(email)) {
                errorMessage.textContent = t('err_invalid_email');
                return;
            }

            // Validate password
            if (password.length < 6) {
                errorMessage.textContent = t('err_password_short');
                return;
            }

            if (password.length > 128) {
                errorMessage.textContent = t('err_password_long');
                return;
            }

            if (password !== confirmPassword) {
                errorMessage.textContent = t('err_passwords_no_match');
                return;
            }

            // Get existing users
            let users = [];
            try {
                const storedUsers = localStorage.getItem('bts_users');
                if (storedUsers) {
                    users = JSON.parse(storedUsers);
                    if (!Array.isArray(users)) {
                        users = [];
                    }
                }
            } catch (e) {
                users = [];
            }

            // Check if email exists
            if (users.find(u => u.email === email)) {
                errorMessage.textContent = t('err_email_taken');
                return;
            }

            // Hash password
            const salt = generateSalt();
            const passwordHash = await hashPassword(password, salt);

            // Create new user (no plain text password stored)
            const newUser = {
                id: generateId(),
                displayName: displayName,
                email: email,
                passwordHash: passwordHash,
                salt: salt,
                deviceId: getDeviceId(),
                createdAt: new Date().toISOString(),
                settings: {
                    wakeUpTime: '06:00',
                    sleepTime: '22:00',
                    schoolStart: '07:30',
                    schoolEnd: '14:00',
                    breakfastTime: '06:30',
                    lunchTime: '14:30',
                    dinnerTime: '20:00',
                    exerciseTime: '16:00',
                    showerTime: '21:00'
                }
            };

            // Save user
            users.push(newUser);
            localStorage.setItem('bts_users', JSON.stringify(users));

            // Auto login (session without sensitive fields)
            const sessionUser = Object.assign({}, newUser);
            delete sessionUser.salt;
            delete sessionUser.passwordHash;
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));

            // Firebase Auth sign up (background, non-blocking)
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().createUserWithEmailAndPassword(email, password).then(function(cred) {
                    return cred.user.updateProfile({ displayName: displayName });
                }).then(function() {
                    console.log('Firebase sign-up successful');
                    // Save user profile to Firestore
                    if (typeof FirebaseFirestore !== 'undefined') {
                        FirebaseFirestore.saveUser(newUser.id, {
                            id: newUser.id,
                            displayName: displayName,
                            email: email,
                            parentCode: '',
                            createdAt: newUser.createdAt,
                            settings: newUser.settings
                        });
                    }
                    if (typeof DataSync !== 'undefined') {
                        DataSync.startAutoSync(newUser.id);
                    }
                    // Get FCM token
                    if (typeof FCM !== 'undefined') {
                        FCM.requestPermission();
                    }
                }).catch(function(err) {
                    console.warn('Firebase sign-up failed (localStorage signup still works):', err.message);
                });
            }

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        });
    }

    // ========================================
    // Password Strength Checker
    // ========================================
    window.checkPasswordStrength = function(password) {
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');

        if (!strengthFill || !strengthText) return;

        let strength = 0;
        let label = '';
        let color = '';

        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        switch (strength) {
            case 0:
            case 1:
                label = t('pw_weak');
                color = '#e17055';
                break;
            case 2:
            case 3:
                label = t('pw_medium');
                color = '#fdcb6e';
                break;
            case 4:
            case 5:
                label = t('pw_strong');
                color = '#00b894';
                break;
        }

        strengthFill.style.width = (strength / 5 * 100) + '%';
        strengthFill.style.background = color;
        strengthText.textContent = password.length > 0 ? t('pw_strength') + label : '';
        strengthText.style.color = color;
    };

    // ========================================
    // Toggle Password Visibility
    // ========================================
    window.togglePassword = function(inputId, button) {
        const input = document.getElementById(inputId);
        const icon = button.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    // ========================================
    // Utilities
    // ========================================
    function generateId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function getDeviceId() {
        let deviceId = localStorage.getItem('bts_device_id');
        if (!deviceId) {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            deviceId = 'dev_' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem('bts_device_id', deviceId);
        }
        return deviceId;
    }

})();
