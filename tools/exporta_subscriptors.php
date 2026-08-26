<?php
/**
 * Exporta la llista de subscriptors a CSV.
 *   php tools/exporta_subscriptors.php [ruta/base.sqlite] > subscriptors.csv
 * Per defecte llegeix web/private/data/quivoto.sqlite.
 */
declare(strict_types=1);
$db = $argv[1] ?? __DIR__ . '/../web/private/data/quivoto.sqlite';
if (!is_readable($db)) { fwrite(STDERR, "No trobo la base de dades: $db\n"); exit(1); }
$pdo = new PDO('sqlite:' . $db, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$out = fopen('php://stdout', 'w');
fputcsv($out, ['email', 'municipi', 'idioma', 'estat', 'creat_el']);
foreach ($pdo->query('SELECT email, municipi, idioma, estat, creat_el FROM subscriptors WHERE estat = "actiu" ORDER BY creat_el') as $f) {
    fputcsv($out, [$f['email'], $f['municipi'], $f['idioma'], $f['estat'], $f['creat_el']]);
}
fclose($out);
