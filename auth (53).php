<?php
// auth.php - VERSI FINAL DENGAN USER REGISTER
// =============================================

require_once 'config.php';

try {
    $conn = getDBConnection();
    
    // Ambil input
    $action = $_GET['action'] ?? '';
    $input = file_get_contents('php://input');
    $data = json_decode($input, true) ?? [];
    
    // Router authentication
    switch ($action) {
        case 'login':
            handleLogin($conn, $data); // Admin login
            break;
            
        case 'user_login': // BARU
            handleUserLogin($conn, $data); // User login (pakai email)
            break;
            
        case 'mitra_login':
            handleMitraLogin($conn, $data);
            break;
            
        case 'register': // BARU
            handleRegister($conn, $data);
            break;
            
        case 'verify_token':
            handleVerifyToken($data);
            break;
            
        case 'logout':
            handleLogout($conn, $data);
            break;
            
        default:
            sendJsonResponse($conn, [
                'success' => false, 
                'message' => 'Action tidak valid'
            ], 404);
    }
    
} catch (Exception $e) {
    sendJsonResponse(null, [
        'success' => false,
        'message' => 'Authentication error: ' . $e->getMessage()
    ], 500);
}

// --- FUNGSI BARU: REGISTER USER ---
function handleRegister($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }
    
    $required = ['nama', 'email', 'password'];
    $missing = validateRequiredFields($data, $required);
    if (!empty($missing)) {
        throw new Exception('Field berikut harus diisi: ' . implode(', ', $missing), 400);
    }
    
    $email = trim($data['email']);
    $password = $data['password'];
    $nama = $data['nama'];
    $telepon = $data['telepon'] ?? null;
    $alamat = $data['alamat'] ?? null;

    // Cek apakah email sudah terdaftar
    $check_stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $check_stmt->bind_param("s", $email);
    $check_stmt->execute();
    if ($check_stmt->get_result()->num_rows > 0) {
        throw new Exception('Email sudah terdaftar.', 409);
    }
    $check_stmt->close();

    $password_hash = password_hash($password, PASSWORD_DEFAULT);

    // Sesuai tabel users
    $stmt = $conn->prepare("INSERT INTO users (nama, email, password, telepon, alamat, role, status) VALUES (?, ?, ?, ?, ?, 'user', 'active')");
    $stmt->bind_param("sssss", $nama, $email, $password_hash, $telepon, $alamat);

    if ($stmt->execute()) {
        sendJsonResponse($conn, [
            'success' => true,
            'message' => 'Registrasi berhasil. Silakan login.'
        ]);
    } else {
        throw new Exception('Gagal mendaftarkan pengguna: ' . $stmt->error, 500);
    }
}

/**
 * Handle login user (Menggunakan EMAIL)
 */
function handleUserLogin($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        throw new Exception('Email dan password harus diisi', 400);
    }

    // Query database users
    $stmt = $conn->prepare("SELECT id, nama, email, role, password, status FROM users WHERE email = ? AND status = 'active'");
    if (!$stmt) {
        throw new Exception('Database error (prepare failed): ' . $conn->error);
    }
    
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        throw new Exception('Akun tidak ditemukan atau tidak aktif', 401);
    }

    $user = $result->fetch_assoc();

    // Verify password (kolom password di tabel users tidak di-hash, tapi di-hash di register, ini potensial BUG jika DB lama)
    // Asumsi: Kita pakai password_hash di sini untuk keamanan.
    if (!password_verify($password, $user['password'])) {
        throw new Exception('Email atau password salah', 401);
    }

    $userData = [
        'id' => (int)$user['id'],
        'name' => $user['nama'],
        'email' => $user['email'],
        'role' => $user['role']
    ];

    $token = generateJWTToken($userData);

    sendJsonResponse($conn, [
        'success' => true,
        'message' => 'Login berhasil',
        'user' => $userData, 
        'token' => $token
    ]);
}


/**
 * Handle login admin
 */
function handleLogin($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        throw new Exception('Username dan password harus diisi', 400);
    }

    // Query untuk Admin
    $stmt = $conn->prepare("SELECT id, name, username, role, password_hash FROM admin_users WHERE username = ? AND is_active = 1");
    
    if (!$stmt) {
        throw new Exception('Database error (prepare failed): ' . $conn->error);
    }
    
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        throw new Exception('Username tidak ditemukan atau akun tidak aktif', 401);
    }

    $user = $result->fetch_assoc();

    if (!password_verify($password, $user['password_hash'])) {
        throw new Exception('Password salah', 401);
    }

    $userData = [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'username' => $user['username'],
        'role' => $user['role']
    ];

    $token = generateJWTToken($userData);

    logActivity($conn, $user['id'], 'Login', 'Admin login berhasil');

    sendJsonResponse($conn, [
        'success' => true,
        'message' => 'Login berhasil',
        'user_data' => $userData,
        'token' => $token
    ]);
}

/**
 * Handle login mitra
 */
function handleMitraLogin($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        throw new Exception('Username dan password harus diisi', 400);
    }

    // Query untuk Mitra (FIXED: layanan = 'active')
    $stmt = $conn->prepare("SELECT id, nama_mitra, username, password_hash, wisata_id FROM mitra WHERE username = ? AND layanan = 'active'");
    
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        throw new Exception('Username atau password salah, atau akun Anda tidak aktif', 401);
    }

    $mitra = $result->fetch_assoc();

    if (!password_verify($password, $mitra['password_hash'])) {
        throw new Exception('Username atau password salah', 401);
    }

    if (empty($mitra['wisata_id'])) {
        throw new Exception('Akun Mitra belum terhubung ke Wisata. Hubungi Admin.', 403);
    }

    $userData = [
        'id' => (int)$mitra['id'],
        'name' => $mitra['nama_mitra'],
        'username' => $mitra['username'],
        'role' => 'mitra',
        'wisata_id' => (int)$mitra['wisata_id']
    ];

    $token = generateJWTToken($userData);

    sendJsonResponse($conn, [
        'success' => true,
        'message' => 'Login mitra berhasil',
        'user' => $userData, 
        'token' => $token
    ]);
}

/**
 * Handle token verification
 */
function handleVerifyToken($data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $token = $data['token'] ?? '';
    $auth = verifyToken($token);

    if ($auth['authenticated']) {
        sendJsonResponse(null, [
            'success' => true,
            'message' => 'Token valid',
            'user_data' => [
                'user_id' => $auth['user_id'],
                'role' => $auth['role'],
                'name' => $auth['name']
            ]
        ]);
    } else {
        throw new Exception('Token tidak valid: ' . $auth['message'], 401);
    }
}

/**
 * Handle logout
 */
function handleLogout($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $token = $data['token'] ?? '';
    $auth = verifyToken($token);

    if ($auth['authenticated']) {
        logActivity($conn, $auth['user_id'], 'Logout', $auth['role'] . ' logout');
    }

    sendJsonResponse($conn, [
        'success' => true,
        'message' => 'Logout berhasil'
    ]);
}
?>