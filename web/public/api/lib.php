<?php
/**
 * quivoto — funcions compartides de l'API pública.
 *
 * La base de dades és SQLite i viu FORA de l'arrel web (../../private/data).
 * No hi desem mai l'adreça IP en clar: només un hash amb sal rotativa diària,
 * que serveix per limitar l'abús però no permet reidentificar ningú.
 */
declare(strict_types=1);

const QV_MAX_EMAIL   = 190;
const QV_MAX_MUNICIPI= 120;
const QV_LIMIT_HORA  = 8;      // altes màximes per hash d'IP i hora

function qv_config(): array {
    $per_defecte = [
        'db'            => __DIR__ . '/../../private/data/quivoto.sqlite',
        'sal'           => 'canvia-aquesta-sal-en-desplegar',
        'avis_email'    => '',          // si s'omple, hi arriba un avís per cada alta
        'origens'       => ['https://quivoto.cat','https://www.quivoto.cat','https://quienvoto.es','https://www.quienvoto.es'],
    ];
    $fitxer = __DIR__ . '/config.php';
    return is_readable($fitxer) ? array_merge($per_defecte, (array) require $fitxer) : $per_defecte;
}

function qv_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $cfg = qv_config();
    $dir = dirname($cfg['db']);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $pdo = new PDO('sqlite:' . $cfg['db'], null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA busy_timeout=4000');
    $pdo->exec('CREATE TABLE IF NOT EXISTS subscriptors (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        email       TEXT NOT NULL UNIQUE,
        municipi    TEXT,
        idioma      TEXT NOT NULL DEFAULT "ca",
        estat       TEXT NOT NULL DEFAULT "actiu",   -- actiu | baixa
        token       TEXT NOT NULL UNIQUE,
        ip_hash     TEXT,
        agent       TEXT,
        creat_el    TEXT NOT NULL,
        baixa_el    TEXT
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_sub_creat ON subscriptors(creat_el)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_sub_iphash ON subscriptors(ip_hash, creat_el)');
    return $pdo;
}

/** Hash d'IP amb sal + dia: no reversible i caduca cada 24 h. */
function qv_ip_hash(): string {
    $cfg = qv_config();
    $ip  = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
    return substr(hash('sha256', $cfg['sal'] . '|' . gmdate('Y-m-d') . '|' . $ip), 0, 32);
}

function qv_json(int $codi, array $dades): void {
    http_response_code($codi);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dades, JSON_UNESCAPED_UNICODE);
    exit;
}

function qv_vol_json(): bool {
    return str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
}

function qv_origen_valid(): bool {
    $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origen === '') return true;                 // enviaments sense JS no porten Origin
    return in_array($origen, qv_config()['origens'], true);
}

function qv_missatge(string $clau, string $idioma): string {
    $t = [
        'ok'        => ['ca' => 'Fet! T’avisarem quan obrim el teu municipi.', 'es' => '¡Hecho! Te avisaremos cuando abramos tu municipio.'],
        'repetit'   => ['ca' => 'Ja et teníem apuntat. Gràcies!', 'es' => 'Ya te teníamos apuntado. ¡Gracias!'],
        'email'     => ['ca' => 'Aquest correu no sembla vàlid.', 'es' => 'Ese correo no parece válido.'],
        'consent'   => ['ca' => 'Cal acceptar la política de privadesa.', 'es' => 'Hay que aceptar la política de privacidad.'],
        'massa'     => ['ca' => 'Massa intents. Prova-ho d’aquí una estona.', 'es' => 'Demasiados intentos. Prueba dentro de un rato.'],
        'error'     => ['ca' => 'Ara mateix no podem desar-ho. Torna-ho a provar.', 'es' => 'Ahora mismo no podemos guardarlo. Inténtalo otra vez.'],
    ];
    return $t[$clau][$idioma] ?? $t[$clau]['ca'];
}
