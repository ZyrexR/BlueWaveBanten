<?php
// config.php - VERSI FINAL UNTUK USER
// =============================================

// PENGATURAN ERROR
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');
date_default_timezone_set('Asia/Jakarta');

// =============================================
// KEBUTUHAN LIBRARY (JWT)
// =============================================
/* Pastikan semua file .php dari library firebase/php-jwt ada di dalam folder /api/ */
try {
    require_once __DIR__ . '/JWTExceptionWithPayloadInterface.php';
    require_once __DIR__ . '/ExpiredException.php';
    require_once __DIR__ . '/BeforeValidException.php';
    require_once __DIR__ . '/SignatureInvalidException.php';
    require_once __DIR__ . '/JWT.php';
    require_once __DIR__ . '/Key.php';
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Internal Server Error: Gagal memuat dependensi library JWT. ' . $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}


// Deklarasi 'use' di level global (atas)
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;

// KONSTANTA APLIKASI
define('JWT_SECRET_KEY', 'bluewave_banten_jwt_secret_2024_secure_key');
define('WEATHER_API_KEY', '96153ad8631aa059a156e62a2596309f');
define('APP_VERSION', '3.0.0');

// KONFIGURASI DATABASE
$db_config = [
    'host' => 'localhost',
    'user' => 'bluewave_user1',
    'pass' => 'bluewave_user',
    'name' => 'bluewave_banten',
    'charset' => 'utf8mb4'
];

/**
 * Membuat koneksi database
 */
function getDBConnection() {
    global $db_config;
    
    $conn = new mysqli(
        $db_config['host'],
        $db_config['user'], 
        $db_config['pass'],
        $db_config['name']
    );
    
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        throw new Exception('Koneksi database gagal');
    }
    
    $conn->set_charset($db_config['charset']);
    return $conn;
}

/**
 * Verifikasi JWT Token
 */
function verifyToken($token) {
    if (empty($token)) {
        return ['authenticated' => false, 'message' => 'Token tidak disediakan'];
    }

    try {
        $tokenToDecode = $token;

        $decoded = JWT::decode($tokenToDecode, new Key(JWT_SECRET_KEY, 'HS256'));
        $data = (array)$decoded->data;
        
        if (!isset($data['user_id']) || !isset($data['role'])) {
            return ['authenticated' => false, 'message' => 'Data token tidak lengkap'];
        }

        return [
            'authenticated' => true,
            'user_id' => (int)$data['user_id'],
            'role' => $data['role'],
            'name' => $data['name'] ?? 'User',
            'wisata_id' => isset($data['wisata_id']) ? (int)$data['wisata_id'] : null
        ];
        
    } catch (ExpiredException $e) {
        return ['authenticated' => false, 'message' => 'Token expired'];
    } catch (Exception $e) {
        error_log("Token verification failed: " . $e->getMessage());
        return ['authenticated' => false, 'message' => 'Token invalid: ' . $e->getMessage()];
    }
}

/**
 * Generate JWT Token
 */
function generateJWTToken($userData) {
    
    $payload = [
        'iat' => time(),
        'exp' => time() + (3600 * 24), // 24 jam
        'data' => [
            'user_id' => $userData['id'],
            'role' => $userData['role'],
            'name' => $userData['name'],
            'wisata_id' => $userData['wisata_id'] ?? null
        ]
    ];
    
    return JWT::encode($payload, JWT_SECRET_KEY, 'HS256');
}

/**
 * Kirim response JSON
 */
function sendJsonResponse($conn, $data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    
    // Tambah info versi
    if (isset($data['success'])) {
        $data['version'] = APP_VERSION;
        $data['timestamp'] = time();
    }
    
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    if ($conn) {
        $conn->close();
    }
    exit();
}

/**
 * Log aktivitas admin
 */
function logActivity($conn, $user_id, $activity, $detail = '') {
    try {
        $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN';
        
        $stmt = $conn->prepare("INSERT INTO admin_activities (user_id, activity, detail, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            $stmt->bind_param("issss", $user_id, $activity, $detail, $ip_address, $user_agent);
            $stmt->execute();
            $stmt->close();
        }
    } catch (Exception $e) {
        error_log("Activity logging failed: " . $e->getMessage());
    }
}

/**
 * Validasi input required
 */
function validateRequiredFields($data, $requiredFields) {
    $missing = [];
    foreach ($requiredFields as $field) {
        if (empty($data[$field])) {
            $missing[] = $field;
        }
    }
    return $missing;
}

// Set CORS headers
function setCORSHeaders() {
    // Daftar domain yang diizinkan
    $allowed_origins = [
        'https://bluewavebanten.my.id',
        'https://admin.bluewavebanten.my.id',
        'https://mitra.bluewavebanten.my.id',
        'https://user.bluewavebanten.my.id',
        'http://localhost:3000' // Tambahan untuk development
    ];
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowed_origins)) {
        header("Access-Control-Allow-Origin: " . $origin);
        header("Access-Control-Allow-Credentials: true");
    }
    
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

// Panggil set CORS di awal
setCORSHeaders();
?>