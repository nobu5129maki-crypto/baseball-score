<?php
// 公開フォルダの外にある htpasswd と照合する。パスワードは画面にもログにも出さない。

ini_set('display_errors', '0');

if (isset($_SERVER['SCRIPT_FILENAME']) && realpath((string) $_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    echo "閲覧できません\n";
    exit;
}

function rs_htpasswd_path()
{
    $override = getenv('RAKUSCORE_HTPASSWD');
    if (is_string($override) && $override !== '') {
        return $override;
    }
    return '/home/xs519923/baseball-score.htpasswd';
}

function rs_cookie_path()
{
    $script = isset($_SERVER['SCRIPT_NAME']) ? str_replace('\\', '/', (string) $_SERVER['SCRIPT_NAME']) : '';
    $dir = str_replace('\\', '/', dirname($script));
    if ($dir === '/' || $dir === '.' || $dir === '') {
        return '/';
    }
    return rtrim($dir, '/');
}

function rs_base_href()
{
    $path = rs_cookie_path();
    if ($path === '/') {
        return '/';
    }
    return $path . '/';
}

function rs_session_start()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '2592000');
    session_name('rakuscore');
    $path = rs_cookie_path();
    session_set_cookie_params(array(
        'lifetime' => 2592000,
        'path' => $path,
        'domain' => '',
        'secure' => false,
        'httponly' => true,
        'samesite' => 'Lax',
    ));
    session_start();
}

function rs_logged_in()
{
    rs_session_start();
    return isset($_SESSION['rakuscore_user']) && is_string($_SESSION['rakuscore_user']) && $_SESSION['rakuscore_user'] !== '';
}

function rs_apr1_64($value, $count)
{
    $itoa = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    $out = '';
    while ($count > 0) {
        $out .= $itoa[$value & 0x3f];
        $value >>= 6;
        $count -= 1;
    }
    return $out;
}

function rs_apr1($password, $salt)
{
    $password = (string) $password;
    $salt = substr((string) $salt, 0, 8);
    $magic = '$apr1$';
    $len = strlen($password);
    $mixin = md5($password . $salt . $password, true);
    $ctx = $password . $magic . $salt;
    for ($i = $len; $i > 0; $i -= 16) {
        $ctx .= substr($mixin, 0, min(16, $i));
    }
    for ($i = $len; $i > 0; $i >>= 1) {
        $ctx .= ($i & 1) ? "\x00" : $password[0];
    }
    $final = md5($ctx, true);
    for ($i = 0; $i < 1000; $i++) {
        $next = '';
        $next .= ($i & 1) ? $password : $final;
        if ($i % 3) {
            $next .= $salt;
        }
        if ($i % 7) {
            $next .= $password;
        }
        $next .= ($i & 1) ? $final : $password;
        $final = md5($next, true);
    }
    $chars = array_values(unpack('C*', $final));
    $encoded = rs_apr1_64(($chars[0] << 16) | ($chars[6] << 8) | $chars[12], 4)
        . rs_apr1_64(($chars[1] << 16) | ($chars[7] << 8) | $chars[13], 4)
        . rs_apr1_64(($chars[2] << 16) | ($chars[8] << 8) | $chars[14], 4)
        . rs_apr1_64(($chars[3] << 16) | ($chars[9] << 8) | $chars[15], 4)
        . rs_apr1_64(($chars[4] << 16) | ($chars[10] << 8) | $chars[5], 4)
        . rs_apr1_64($chars[11], 2);
    return $magic . $salt . '$' . $encoded;
}

function rs_password_matches($password, $hash)
{
    $hash = (string) $hash;
    if (strncmp($hash, '$2y$', 4) === 0 || strncmp($hash, '$2a$', 4) === 0 || strncmp($hash, '$2b$', 4) === 0) {
        return password_verify((string) $password, $hash);
    }
    if (strncmp($hash, '$apr1$', 6) !== 0) {
        return false;
    }
    $rest = substr($hash, 6);
    $salt = strstr($rest, '$', true);
    if (!is_string($salt) || $salt === '') {
        return false;
    }
    $calc = rs_apr1($password, $salt);
    return hash_equals($hash, $calc);
}

function rs_check_login($id, $password)
{
    $id = (string) $id;
    $password = (string) $password;
    if ($id === '' || $password === '') {
        return false;
    }
    $path = rs_htpasswd_path();
    if (!is_file($path) || !is_readable($path)) {
        return false;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return false;
    }
    foreach ($lines as $line) {
        $parts = explode(':', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }
        if (!hash_equals($parts[0], $id)) {
            continue;
        }
        return rs_password_matches($password, $parts[1]);
    }
    return false;
}

function rs_safe_relative($relative)
{
    $relative = str_replace('\\', '/', (string) $relative);
    $relative = rawurldecode($relative);
    if ($relative === '' || strpos($relative, "\0") !== false) {
        return '';
    }
    $parts = explode('/', $relative);
    $safe = array();
    foreach ($parts as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..' || $part[0] === '.') {
            return '';
        }
        $safe[] = $part;
    }
    return implode('/', $safe);
}

function rs_requested_path()
{
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    $path = parse_url($uri, PHP_URL_PATH);
    $path = rawurldecode(is_string($path) ? $path : '');
    $base = rs_cookie_path();
    if ($base !== '/' && strpos($path, $base) === 0) {
        $path = substr($path, strlen($base));
    }
    return rs_safe_relative($path);
}

function rs_is_data_request()
{
    if (isset($_GET['_rsc'])) {
        return true;
    }
    if (isset($_SERVER['HTTP_RSC'])) {
        return true;
    }
    if (isset($_SERVER['HTTP_NEXT_ROUTER_PREFETCH']) || isset($_SERVER['HTTP_NEXT_ROUTER_STATE_TREE'])) {
        return true;
    }
    $accept = isset($_SERVER['HTTP_ACCEPT']) ? (string) $_SERVER['HTTP_ACCEPT'] : '';
    if (strpos($accept, 'text/x-component') !== false) {
        return true;
    }
    return false;
}
