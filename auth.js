// ========================================
// Back to School - Authentication Module
// ========================================

(function() {
    'use strict';

    // Check if already logged in
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');
            
            errorMessage.textContent = '';
            
            // Get users from localStorage
            const users = JSON.parse(localStorage.getItem('bts_users') || '[]');
            
            // Find user
            const user = users.find(u => u.email === email && u.password === password);
            
            if (user) {
                // Check device binding
                const deviceId = getDeviceId();
                if (user.deviceId && user.deviceId !== deviceId) {
                    errorMessage.textContent = 'هذا الحساب مرتبط بجهاز آخر.';
                    return;
                }
                
                // Update device binding
                user.deviceId = deviceId;
                const userIndex = users.findIndex(u => u.id === user.id);
                users[userIndex] = user;
                localStorage.setItem('bts_users', JSON.stringify(users));
                
                // Save current user session
                localStorage.setItem('currentUser', JSON.stringify(user));
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                errorMessage.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
            }
        });
    }

    // Signup Form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const displayName = document.getElementById('displayName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const errorMessage = document.getElementById('errorMessage');
            
            errorMessage.textContent = '';
            
            // Validation
            if (password.length < 6) {
                errorMessage.textContent = 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.';
                return;
            }
            
            if (password !== confirmPassword) {
                errorMessage.textContent = 'كلمتا المرور غير متطابقتين.';
                return;
            }
            
            // Get existing users
            const users = JSON.parse(localStorage.getItem('bts_users') || '[]');
            
            // Check if email exists
            if (users.find(u => u.email === email)) {
                errorMessage.textContent = 'البريد الإلكتروني مسجل بالفعل.';
                return;
            }
            
            // Create new user
            const newUser = {
                id: generateId(),
                displayName: displayName,
                email: email,
                password: password,
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
            
            // Auto login
            localStorage.setItem('currentUser', JSON.stringify(newUser));
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        });
    }

    // Password strength checker
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
                label = 'ضعيفة';
                color = '#e17055';
                break;
            case 2:
            case 3:
                label = 'متوسطة';
                color = '#fdcb6e';
                break;
            case 4:
            case 5:
                label = 'قوية';
                color = '#00b894';
                break;
        }
        
        strengthFill.style.width = (strength / 5 * 100) + '%';
        strengthFill.style.background = color;
        strengthText.textContent = password.length > 0 ? 'قوة كلمة المرور: ' + label : '';
        strengthText.style.color = color;
    };

    // Toggle password visibility
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

    // Generate unique device ID
    function getDeviceId() {
        let deviceId = localStorage.getItem('bts_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('bts_device_id', deviceId);
        }
        return deviceId;
    }

    // Generate unique ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

})();