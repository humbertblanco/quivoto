<?php
/** GET /api/baixa.php?t=<token> — baixa immediata, sense preguntes. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$token = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['t'] ?? ''));
$ok = false;
if ($token !== '') {
    try {
        $u = qv_db()->prepare('UPDATE subscriptors SET estat = "baixa", email = "baixa-" || id, baixa_el = ? WHERE token = ? AND estat = "actiu"');
        $u->execute([gmdate('Y-m-d H:i:s'), $token]);
        $ok = $u->rowCount() > 0;
    } catch (PDOException $e) { error_log('quivoto baixa: ' . $e->getMessage()); }
}
header('Content-Type: text/html; charset=utf-8');
$titol = $ok ? 'Ja no rebràs res més' : 'Aquest enllaç ja no és vàlid';
$text  = $ok ? 'Hem esborrat el teu correu de la llista. Gràcies per haver-hi estat.'
             : 'O bé ja t’havies donat de baixa, o l’enllaç és incorrecte.';
echo '<!doctype html><html lang="ca"><head><meta charset="utf-8">'
   . '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
   . '<title>' . htmlspecialchars($titol) . ' — quivoto</title>'
   . '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">'
   . '<link rel="stylesheet" href="/assets/styles.css"></head><body class="pagina-simple"><main>'
   . '<h1>' . htmlspecialchars($titol) . '</h1><p>' . htmlspecialchars($text) . '</p>'
   . '<p><a class="boto" href="/">Tornar a l\'inici</a></p></main></body></html>';
