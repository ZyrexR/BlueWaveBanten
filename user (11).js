// user.js - LOGIKA USER DASHBOARD
// =============================================

// --- Konfigurasi dan State Global ---
const API_BASE = 'https://bluewavebanten.my.id/api/'; 
let currentUser = null;
let currentToken = null;
let currentWisataId = null; // Untuk pemesanan tiket
let userLocation = null; // Menyimpan koordinat pengguna saat ini

// --- 1. Fungsi Utility API dan Notifikasi ---

async function apiCall(endpoint, options = {}) {
    let url = API_BASE + `api.php?action=${endpoint}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Tambahkan token ke body jika bukan GET
    let bodyData = options.body || {};
    if (config.method.toUpperCase() !== 'GET') {
        if (currentToken) {
            bodyData.token = currentToken;
        }
        config.body = JSON.stringify(bodyData);
    }
    
    if (options.params) {
        const urlParams = new URLSearchParams(options.params).toString();
        url += (url.includes('?') ? '&' : '?') + urlParams;
    }

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            handleLogout();
            return { success: false, message: 'Unauthorized' };
        }
        
        const result = await response.json();
        return result;

    } catch (error) {
        console.error('API call error:', error);
        showNotification('Terjadi kesalahan koneksi ke server.', 'error');
        return { success: false, message: 'Koneksi gagal.' };
    }
}

function showNotification(message, type = 'success') {
    // Implementasi notifikasi sederhana (untuk mencegah crash)
    const notification = document.createElement('div');
    notification.textContent = message;
    console.log(`[NOTIF ${type.toUpperCase()}]: ${message}`);
}

function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount || 0);
}

// --- 2. Autentikasi & Routing ---

function checkAuthStatus() {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('auth_token');
    
    if (user && token) {
        try {
            currentUser = JSON.parse(user);
            currentToken = token;
            // Perbarui header UI
            document.getElementById('welcomeName').textContent = currentUser.name;
            document.getElementById('profileName').textContent = currentUser.name;
            document.getElementById('profileEmail').textContent = currentUser.email;
            document.getElementById('userName').textContent = currentUser.name;
            
            showPage('beranda');
        } catch (e) {
            handleLogout();
        }
    } else {
        // Logika redirect ke login ada di <script> tag di index.html
    }
}

function handleLogout() {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    window.location.href = 'login.html';
}

function showPage(page) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    
    const targetSection = document.getElementById(page);
    const navItem = document.querySelector(`[data-section="${page}"]`);

    if (targetSection) {
        targetSection.classList.add('active');
        document.getElementById('pageTitle').textContent = navItem ? navItem.querySelector('span').textContent : 'Dashboard';
    }
    if (navItem) navItem.classList.add('active');

    // Load data spesifik
    if (page === 'beranda') loadDashboardData();
    if (page === 'wisata') loadWisataList();
    if (page === 'tiket-saya') loadTiketSaya();
    if (page === 'profil') loadUserProfile();
    if (page === 'riwayat') loadRiwayat();
}

// --- 3. DASHBOARD LOGIC ---

async function loadDashboardData() {
    const statsResult = await apiCall('get_user_dashboard', { method: 'POST', body: {} });
    const locationResult = await getCurrentLocation();
    
    if (statsResult.success && statsResult.data) {
        const data = statsResult.data;
        document.getElementById('totalTiketCount').textContent = data.total_tiket;
        document.getElementById('activeTiketCount').textContent = data.active_tiket;
        document.getElementById('totalSpent').textContent = formatRupiah(data.total_spent);
        document.getElementById('favoriteCount').textContent = data.favorite_count;
    }
    
    loadPromoFeatures();
    loadRecentActivity();
    
    if (userLocation) loadNearbyWisata();
}

async function getCurrentLocation() {
    const locationTextEl = document.getElementById('userLocationText');
    const weatherEl = document.getElementById('currentWeather');
    locationTextEl.textContent = 'Mendeteksi lokasi...';

    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
            });
            
            userLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
            locationTextEl.textContent = `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`;
            
            // Dapatkan data cuaca
            const weatherResult = await apiCall('get_weather', { params: userLocation, method: 'GET' });
            if (weatherResult.main) {
                const temp = Math.round(weatherResult.main.temp);
                const desc = weatherResult.weather[0].description;
                weatherEl.innerHTML = `<div class="flex items-center space-x-3"><i class="fas fa-sun text-yellow-300 text-3xl"></i><span>${temp}°C, ${desc}</span></div>`;
            } else {
                weatherEl.innerHTML = 'Gagal memuat cuaca.';
            }

            return userLocation;

        } catch (error) {
            locationTextEl.textContent = 'Lokasi tidak dapat dideteksi.';
            weatherEl.innerHTML = 'Gagal mendeteksi lokasi.';
            return null;
        }
    } else {
        locationTextEl.textContent = 'Geolocation tidak didukung browser.';
        return null;
    }
}

async function loadNearbyWisata() {
    const container = document.getElementById('nearbyWisata');
    container.innerHTML = `<div class="text-center py-4">Mencari wisata terdekat...</div>`;
    
    // API endpoint ini belum dibuat, jadi kita mock data
    const mockData = [
        { id: 1, nama: 'Pantai Carita', jarak: 5.2, status: 'dekat' },
        { id: 2, nama: 'Taman Nasional Ujung Kulon', jarak: 50.0, status: 'jauh' }
    ];

    container.innerHTML = mockData.map(w => `
        <div class="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
            <span class="font-semibold text-gray-800">${w.nama}</span>
            <span class="text-sm ${w.status === 'dekat' ? 'text-green-600' : 'text-gray-600'}">${w.jarak} km</span>
        </div>
    `).join('');
}


// --- 4. DATA LOADER FUNCTIONS ---

async function loadPromoFeatures() {
    const promoResult = await fetchApiData('get_promo');
    const container = document.getElementById('promoWisata');
    if (promoResult.length > 0 && container) {
        container.innerHTML = promoResult.slice(0, 2).map(promo => `
            <div class="p-4 rounded-lg border border-orange-300 bg-orange-50">
                <h4 class="font-bold text-lg text-orange-700">${promo.nama_promo}</h4>
                <p class="text-sm text-orange-600">${promo.jenis_diskon === 'persen' ? `${promo.nilai_diskon}%` : formatRupiah(promo.nilai_diskon)} Diskon</p>
                <p class="text-xs text-gray-500 mt-2">Berakhir: ${new Date(promo.tanggal_berakhir).toLocaleDateString()}</p>
                <button class="mt-3 text-sm bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition">Klaim</button>
            </div>
        `).join('');
    } else if (container) {
        container.innerHTML = '<p class="text-gray-500 col-span-full py-4 text-center">Tidak ada promo aktif.</p>';
    }
}

async function loadRecentActivity() {
    const activityContainer = document.getElementById('recentActivities');
    activityContainer.innerHTML = `<ul class="space-y-3">
        <li class="text-sm text-gray-700"><i class="fas fa-check-circle text-green-500 mr-2"></i> Tiket Pulau Umang divalidasi.</li>
        <li class="text-sm text-gray-700"><i class="fas fa-credit-card text-blue-500 mr-2"></i> Pembelian 3 tiket Sukarame.</li>
    </ul>`;
}

// --- 5. PAGE LOADERS ---

async function loadWisataList() {
    const container = document.getElementById('wisataList');
    const wisataData = await fetchApiData('get_wisata');
    if (wisataData.length > 0 && container) {
        container.innerHTML = wisataData.map(w => `
            <div class="bg-white rounded-xl shadow-md overflow-hidden card-hover">
                <img src="${w.gambar_url}" alt="${w.nama}" class="w-full h-40 object-cover">
                <div class="p-4">
                    <h5 class="font-bold text-lg text-gray-800">${w.nama}</h5>
                    <p class="text-sm text-gray-600 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${w.lokasi}</p>
                    <p class="text-xl font-bold text-blue-600">${formatRupiah(w.harga_tiket)}</p>
                    <button onclick="selectWisata(${w.id})" class="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">Pesan Tiket</button>
                </div>
            </div>
        `).join('');
    } else if (container) {
        container.innerHTML = '<p class="text-gray-500 col-span-full py-8 text-center">Tidak ada wisata tersedia saat ini.</p>';
    }
}

async function loadTiketSaya() {
    const container = document.getElementById('daftarTiket');
    container.innerHTML = `<div class="text-center py-8">Memuat data...</div>`;
    
    // API endpoint ini belum dibuat, jadi kita mock data
    const mockData = [
        { id: 1, kode: 'BW001', wisata: 'Pulau Umang', tgl: '2025-12-25', status: 'active' },
        { id: 2, kode: 'BW002', wisata: 'Pantai Anyer', tgl: '2025-11-20', status: 'used' }
    ];

    container.innerHTML = mockData.map(t => `
        <div class="p-4 border border-gray-200 rounded-lg shadow-sm">
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-bold text-xl text-blue-600">${t.wisata}</h4>
                <span class="text-xs font-semibold ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">${t.status.toUpperCase()}</span>
            </div>
            <p class="text-sm text-gray-700">Kode: <span class="font-mono font-semibold">${t.kode}</span></p>
            <p class="text-sm text-gray-600">Tanggal: ${t.tgl}</p>
            <button onclick="showQRCode('${t.kode}')" class="mt-3 text-sm bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">Tampilkan QR Code</button>
        </div>
    `).join('');
}

async function loadUserProfile() {
    const profileData = await apiCall('get_user_profile', { method: 'POST', body: {} });
    if (profileData.success && profileData.data) {
        const user = profileData.data;
        document.getElementById('inputNama').value = user.name || '';
        document.getElementById('inputEmail').value = user.email || '';
        document.getElementById('inputTelepon').value = user.phone || '';
        document.getElementById('inputAlamat').value = user.address || '';
        document.getElementById('profileAvatar').textContent = user.name ? user.name[0] : 'U';
    } else {
        showNotification('Gagal memuat profil pengguna.', 'error');
    }
}

async function loadRiwayat() {
    document.getElementById('riwayatTransaksi').innerHTML = '<p class="text-gray-500 py-8 text-center">Fitur riwayat transaksi sedang disiapkan.</p>';
}

// --- 6. USER INTERACTION & MODALS ---

function selectWisata(id) {
    showNotification(`Wisata #${id} dipilih. Melanjutkan ke detail tiket.`, 'info');
    // Implementasi: Pindah ke Step 2 Pemesanan Tiket
}

function showQRCode(kodeTiket) {
    const container = document.getElementById('qrCodeContainer');
    container.innerHTML = '';
    
    // Asumsi qrcode.js sudah dimuat
    new QRCode(container, {
        text: kodeTiket,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('qrTiketCode').textContent = kodeTiket;
    document.getElementById('qrModal').classList.remove('hidden');
}

// --- 7. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup event listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.section;
            showPage(page);
        });
    });
    
    // 2. Attach handlers for quick actions (PLACEHOLDER)
    document.getElementById('quickBuyTicket').addEventListener('click', () => showPage('pembelian'));
    document.getElementById('quickExplore').addEventListener('click', () => showPage('wisata'));
    document.getElementById('quickQRCode').addEventListener('click', () => showQRCode('DEMO001'));
    document.getElementById('refreshLocation').addEventListener('click', loadDashboardData);

    // 3. Attach handlers for profile
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleSaveProfile);
    
    // 4. Check Auth Status (Ini akan memicu loadDashboardData)
    checkAuthStatus();
    loadDashboardData();
});