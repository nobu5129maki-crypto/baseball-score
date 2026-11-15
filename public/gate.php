<?php
require __DIR__ . '/auth.php';

function rs_deny()
{
    http_response_code(401);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "ログインが必要です\n";
    exit;
}

function rs_miss()
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "見つかりません\n";
    exit;
}

function rs_content_type($path)
{
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $map = array(
        'html' => 'text/html; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'mjs' => 'application/javascript; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'txt' => 'text/x-component; charset=UTF-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'webmanifest' => 'application/manifest+json; charset=UTF-8',
        'map' => 'application/json; charset=UTF-8',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
    );
    if (isset($map[$ext])) {
        return $map[$ext];
    }
    return 'application/octet-stream';
}

function rs_resolve($relative)
{
    $relative = rs_safe_relative($relative);
    if ($relative === '') {
        return '';
    }
    if (preg_match('/\\.php$/', $relative)) {
        return '';
    }
    if ($relative === 'index.html' || substr($relative, -11) === '/index.html') {
        return '';
    }

    $root = realpath(__DIR__);
    if ($root === false) {
        return '';
    }
    $candidate = $root . '/' . $relative;
    if (!is_file($candidate)) {
        return '';
    }
    $real = realpath($candidate);
    if ($real === false || !is_file($real)) {
        return '';
    }
    $prefix = rtrim($root, '/') . '/';
    if (strpos($real, $prefix) !== 0) {
        return '';
    }
    if (substr($real, -4) === '.php' || substr($real, -10) === '.htaccess' || substr($real, -9) === '.user.ini') {
        return '';
    }
    return $real;
}

if (!rs_logged_in()) {
    rs_deny();
}

$relative = '';
if (isset($_GET['rs_path']) && !is_array($_GET['rs_path'])) {
    $relative = (string) $_GET['rs_path'];
} else {
    $relative = rs_requested_path();
}

$file = rs_resolve($relative);
if ($file === '') {
    rs_miss();
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . rs_content_type($file));
header('X-Content-Type-Options: nosniff');
$base = basename($file);
if ($ext === 'html' || $base === 'sw.js' || $ext === 'webmanifest') {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
} else {
    header('Cache-Control: private, max-age=86400');
}
readfile($file);
