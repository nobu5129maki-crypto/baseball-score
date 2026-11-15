<?php
require __DIR__ . '/auth.php';
rs_session_start();

if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

$error = '';
$postedId = '';
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $postedId = isset($_POST['login_id']) ? trim((string) $_POST['login_id']) : '';
    $postedPassword = isset($_POST['password']) ? (string) $_POST['password'] : '';
    $postedToken = isset($_POST['csrf']) ? (string) $_POST['csrf'] : '';
    $tokenOk = is_string($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $postedToken);
    if ($tokenOk && rs_check_login($postedId, $postedPassword)) {
        session_regenerate_id(true);
        $_SESSION['rakuscore_user'] = $postedId;
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        header('Location: ' . rs_base_href(), true, 303);
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        exit;
    }
    $error = 'IDまたはパスワードが違います';
}

if (rs_logged_in()) {
    rs_serve_app();
    exit;
}

if (rs_is_data_request()) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "ログインが必要です\n";
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
http_response_code(200);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#070a08">
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23070a08'/%3E%3Ccircle cx='32' cy='32' r='16' fill='none' stroke='%23f5c518' stroke-width='4'/%3E%3C/svg%3E">
    <title>ログイン｜らくスコア</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif;
            color: #f4f7f0;
            background:
                radial-gradient(800px 360px at 50% -10%, rgba(245, 197, 24, 0.18), transparent 55%),
                #070a08;
        }
        main { max-width: 420px; margin: 0 auto; padding: 48px 16px 64px; }
        header { text-align: center; }
        .mark {
            width: 72px;
            height: 72px;
            margin: 0 auto;
            border-radius: 18px;
            background: #121a14;
            border: 1px solid #2c3c30;
            color: #f5c518;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: 700;
        }
        h1 { margin: 14px 0 0; font-size: 1.7rem; letter-spacing: 0.04em; }
        .lead { margin: 8px 0 0; color: #9aa894; line-height: 1.7; }
        form {
            margin-top: 22px;
            background: #121a14;
            border: 1px solid #2c3c30;
            border-radius: 24px;
            padding: 20px;
        }
        label { display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 6px; }
        .field { margin-bottom: 14px; }
        input {
            width: 100%;
            border: 1px solid #2c3c30;
            background: #070a08;
            border-radius: 12px;
            padding: 12px 14px;
            font: inherit;
            color: inherit;
        }
        .password-row { display: flex; gap: 8px; }
        .password-row input { min-width: 0; }
        button, .toggle { font: inherit; cursor: pointer; }
        .toggle {
            flex: 0 0 auto;
            border-radius: 12px;
            border: 1px solid #f5c518;
            background: transparent;
            color: #f5c518;
            padding: 0 14px;
            font-weight: 700;
        }
        .submit {
            width: 100%;
            border: none;
            border-radius: 14px;
            background: #f5c518;
            color: #14180c;
            font-weight: 700;
            padding: 14px;
        }
        .error {
            margin: 0 0 14px;
            padding: 10px 12px;
            border-radius: 12px;
            background: #3a1614;
            color: #ffb4a8;
            font-size: 0.95rem;
            font-weight: 700;
        }
        [hidden] { display: none !important; }
    </style>
</head>
<body>
    <main>
        <header>
            <div class="mark" aria-hidden="true">球</div>
            <h1>らくスコア</h1>
            <p class="lead">入るには ID とパスワードが必要です</p>
        </header>
        <form method="post" action="" autocomplete="off">
            <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($_SESSION['csrf'], ENT_QUOTES, 'UTF-8'); ?>">
            <p id="loginError" class="error" role="alert"<?php echo $error === '' ? ' hidden' : ''; ?>><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
            <div class="field">
                <label for="login_id">ID</label>
                <input id="login_id" name="login_id" type="text" inputmode="text" autocomplete="username" required maxlength="64" value="<?php echo htmlspecialchars($postedId, ENT_QUOTES, 'UTF-8'); ?>">
            </div>
            <div class="field">
                <label for="password">パスワード</label>
                <div class="password-row">
                    <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128">
                    <button type="button" class="toggle" id="togglePassword" aria-controls="password" aria-pressed="false">表示</button>
                </div>
            </div>
            <button type="submit" class="submit">入る</button>
        </form>
    </main>
    <script>
        var idKey = 'rakuscore_login_id';
        var passwordKey = 'rakuscore_login_password';
        var form = document.querySelector('form');
        var idInput = document.getElementById('login_id');
        var passwordInput = document.getElementById('password');
        var errorBox = document.getElementById('loginError');

        document.getElementById('togglePassword').addEventListener('click', function () {
            var showing = passwordInput.type === 'text';
            passwordInput.type = showing ? 'password' : 'text';
            this.textContent = showing ? '表示' : '隠す';
            this.setAttribute('aria-pressed', showing ? 'false' : 'true');
        });

        form.addEventListener('submit', function () {
            try {
                sessionStorage.setItem('rakuscore_pending_id', idInput.value.trim());
                sessionStorage.setItem('rakuscore_pending_password', passwordInput.value);
            } catch (err) {}
        });

        try {
            var failed = errorBox && !errorBox.hasAttribute('hidden') && errorBox.textContent;
            if (failed) {
                localStorage.removeItem(passwordKey);
                sessionStorage.removeItem('rakuscore_pending_id');
                sessionStorage.removeItem('rakuscore_pending_password');
            }
            var savedId = localStorage.getItem(idKey) || '';
            var savedPassword = localStorage.getItem(passwordKey) || '';
            if (!failed && savedId && savedPassword && !form.getAttribute('data-submitting')) {
                form.setAttribute('data-submitting', '1');
                idInput.value = savedId;
                passwordInput.value = savedPassword;
                form.submit();
            } else if (savedId && !idInput.value) {
                idInput.value = savedId;
            }
        } catch (err) {}
    </script>
</body>
</html>
<?php

function rs_inside_root($path)
{
    $root = realpath(__DIR__);
    $real = realpath($path);
    if ($root === false || $real === false || !is_file($real)) {
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

function rs_find_page($relative, $rsc)
{
    $relative = rs_safe_relative($relative);
    $root = realpath(__DIR__);
    if ($root === false) {
        return '';
    }
    $names = array();
    if ($relative === '') {
        $names[] = $rsc ? 'index.txt' : 'index.html';
    } else {
        $stem = preg_replace('/\\.(html|txt)$/', '', $relative);
        if (!is_string($stem) || $stem === '') {
            $stem = $relative;
        }
        if ($rsc) {
            $names[] = $stem . '.txt';
            $names[] = $stem . '/index.txt';
            $names[] = $relative . '.txt';
            $names[] = $relative . '/index.txt';
        } else {
            $names[] = $stem . '/index.html';
            $names[] = $stem . '.html';
            $names[] = $relative . '/index.html';
            $names[] = $relative . '.html';
        }
    }
    $seen = array();
    foreach ($names as $name) {
        $name = rs_safe_relative($name);
        if ($name === '' || isset($seen[$name])) {
            continue;
        }
        $seen[$name] = true;
        $found = rs_inside_root($root . '/' . $name);
        if ($found !== '') {
            return $found;
        }
    }
    return '';
}

function rs_serve_app()
{
    $relative = rs_requested_path();
    $rsc = rs_is_data_request();
    $file = rs_find_page($relative, $rsc);
    if ($file === '' && !$rsc) {
        $root = realpath(__DIR__);
        if ($root !== false) {
            $file = rs_inside_root($root . '/404.html');
        }
        if ($file === '') {
            http_response_code(404);
            header('Content-Type: text/plain; charset=UTF-8');
            header('Cache-Control: no-store');
            echo "見つかりません\n";
            return;
        }
        http_response_code(404);
    }
    if ($file === '') {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        header('Cache-Control: no-store');
        echo "見つかりません\n";
        return;
    }

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    if ($ext === 'txt' || $rsc) {
        header('Content-Type: text/x-component; charset=UTF-8');
        header('Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch');
        readfile($file);
        return;
    }

    $html = file_get_contents($file);
    if (!is_string($html)) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=UTF-8');
        echo "画面を読み込めません\n";
        return;
    }
    $save = '<script>(function(){try{var i=sessionStorage.getItem("rakuscore_pending_id");var p=sessionStorage.getItem("rakuscore_pending_password");if(i&&p){localStorage.setItem("rakuscore_login_id",i);localStorage.setItem("rakuscore_login_password",p);sessionStorage.removeItem("rakuscore_pending_id");sessionStorage.removeItem("rakuscore_pending_password");}}catch(e){}})();</script>';
    $count = 0;
    $html = preg_replace('/<\\/head>/', $save . '</head>', $html, 1, $count);
    if ($count !== 1) {
        $html = $save . $html;
    }
    header('Content-Type: text/html; charset=UTF-8');
    echo $html;
}
