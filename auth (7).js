// auth.js - USER LOGIN & REGISTER HANDLER
// =============================================

const API_AUTH_BASE = 'https://bluewavebanten.my.id/api/auth.php';

// --- Global Utility ---

function showAuthNotification(message, type = 'success') {
    const container = document.querySelector('.auth-card .p-8');
    if (!container) return;

    // Hapus notifikasi lama
    document.querySelectorAll('.auth-notification').forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `auth-notification p-3 rounded-lg text-sm font-medium mt-4 ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
    notification.textContent = message;
    
    container.insertBefore(notification, container.querySelector('form'));

    setTimeout(() => notification.remove(), 5000);
}

function updateButtonState(btnId, isLoading, defaultText) {
    const btn = document.getElementById(btnId);
    const textSpan = document.getElementById('btnText');
    const loadingDiv = document.getElementById('btnLoading');

    if (btn && textSpan && loadingDiv) {
        btn.disabled = isLoading;
        if (isLoading) {
            textSpan.textContent = 'Memproses...';
            loadingDiv.classList.remove('hidden');
        } else {
            textSpan.textContent = defaultText;
            loadingDiv.classList.add('hidden');
        }
    }
}

// --- Login Handler ---

async function handleUserLogin(e) {
    e.preventDefault();
    updateButtonState('loginBtn', true, 'Masuk');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_AUTH_BASE}?action=user_login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();

        if (result.success && result.token) {
            // SUCCESS: Simpan token dan data user (sesuai index.html)
            localStorage.setItem('auth_token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user)); // Key 'user'
            
            showAuthNotification('Login berhasil! Mengalihkan...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html'; // Redirect ke dashboard user
            }, 1000);

        } else {
            throw new Error(result.message || 'Login gagal.');
        }
        
    } catch (error) {
        showAuthNotification(error.message, 'error');
    } finally {
        updateButtonState('loginBtn', false, 'Masuk');
    }
}

// --- Register Handler ---

async function handleRegister(e) {
    e.preventDefault();
    updateButtonState('registerBtn', true, 'Buat Akun');

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showAuthNotification('Password dan Konfirmasi Password tidak cocok!', 'error');
        updateButtonState('registerBtn', false, 'Buat Akun');
        return;
    }
    if (password.length < 6) {
        showAuthNotification('Password minimal 6 karakter!', 'error');
        updateButtonState('registerBtn', false, 'Buat Akun');
        return;
    }

    const data = {
        nama: document.getElementById('nama').value.trim(),
        email: document.getElementById('email').value.trim(),
        telepon: document.getElementById('telepon').value.trim(),
        alamat: document.getElementById('alamat').value.trim(),
        password: password
    };
    
    try {
        const response = await fetch(`${API_AUTH_BASE}?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();

        if (result.success) {
            showAuthNotification(result.message || 'Registrasi berhasil!', 'success');
            setTimeout(() => {
                window.location.href = 'login.html'; // Redirect ke halaman login
            }, 1000);
        } else {
            throw new Error(result.message || 'Registrasi gagal.');
        }

    } catch (error) {
        showAuthNotification(error.message, 'error');
    } finally {
        updateButtonState('registerBtn', false, 'Buat Akun');
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    // Attach handlers to login form (for login.html)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleUserLogin);
    }

    // Attach handlers to register form (for register.html)
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});