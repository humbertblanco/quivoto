<?php
/**
 * POST /api/subscribe.php
 * Camps: email (obligatori), municipi, lang, consent (obligatori), rebost (trampa antibot).
 * Resposta: JSON si el client demana JSON; si no, redirecció a /gracies.html.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

$idioma = ($_POST['lang'] ?? 'ca') === 'es' ? 'es' : 'ca';
$base   = $idioma === 'es' ? '/es' : '';

function qv_acaba(bool $ok, string $clau, string $idioma, string $base, int $codi = 200): void {
    if (qv_vol_json()) {
        qv_json($codi, ['ok' => $ok, 'missatge' => qv_missatge($clau, $idioma)]);
    }
    header('Location: ' . ($ok ? $base . '/gracies.html' : $base . '/#avisam'), true, 303);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    qv_acaba(false, 'error', $idioma, $base, 405);
}
if (!qv_origen_valid()) {
    qv_acaba(false, 'error', $idioma, $base, 403);
}
// Trampa antibot: camp ocult que cap persona omple.
if (trim((string) ($_POST['rebost'] ?? '')) !== '') {
    qv_acaba(true, 'ok', $idioma, $base);           // silenci: el bot creu que ha funcionat
}
if (!isset($_POST['consent'])) {
    qv_acaba(false, 'consent', $idioma, $base, 422);
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if ($email === '' || strlen($email) > QV_MAX_EMAIL || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    qv_acaba(false, 'email', $idioma, $base, 422);
}
$municipi = trim((string) ($_POST['municipi'] ?? ''));
if (strlen($municipi) > QV_MAX_MUNICIPI) $municipi = substr($municipi, 0, QV_MAX_MUNICIPI);
$municipi = $municipi === '' ? null : $municipi;

try {
    $db   = qv_db();
    $hash = qv_ip_hash();

    $q = $db->prepare('SELECT COUNT(*) c FROM subscriptors WHERE ip_hash = ? AND creat_el > ?');
    $q->execute([$hash, gmdate('Y-m-d H:i:s', time() - 3600)]);
    if ((int) $q->fetch()['c'] >= QV_LIMIT_HORA) {
        qv_acaba(false, 'massa', $idioma, $base, 429);
    }

    $ins = $db->prepare('INSERT INTO subscriptors (email, municipi, idioma, token, ip_hash, agent, creat_el)
                         VALUES (?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
        $email, $municipi, $idioma, bin2hex(random_bytes(16)), $hash,
        substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 190), gmdate('Y-m-d H:i:s'),
    ]);

    $cfg = qv_config();
    if ($cfg['avis_email'] !== '') {
        @mail($cfg['avis_email'], 'quivoto: alta nova',
              "Municipi: " . ($municipi ?? '-') . "\nIdioma: $idioma\n",
              'From: quivoto <no-reply@quivoto.cat>');
    }
    qv_acaba(true, 'ok', $idioma, $base);

} catch (PDOException $e) {
    // 23000 = clau única repetida: per a la persona, això és un èxit.
    if (($e->getCode() === '23000') || str_contains($e->getMessage(), 'UNIQUE')) {
        qv_acaba(true, 'repetit', $idioma, $base);
    }
    error_log('quivoto subscribe: ' . $e->getMessage());
    qv_acaba(false, 'error', $idioma, $base, 500);
}
