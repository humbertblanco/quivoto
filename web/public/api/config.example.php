<?php
/**
 * Copia'l a config.php al servidor i omple els valors. NO el pugis mai al repositori.
 *   cp config.example.php config.php && chmod 640 config.php
 */
return [
    // Ruta absoluta de la base de dades, sempre FORA de httpdocs.
    'db'         => '/var/www/vhosts/quivoto.cat/private/data/quivoto.sqlite',
    // Sal per als hashos d'IP. Genera-la amb: php -r 'echo bin2hex(random_bytes(24));'
    'sal'        => 'POSA-AQUI-UNA-SAL-LLARGA-I-ALEATORIA',
    // Deixa-ho buit per no rebre avisos de cada alta.
    'avis_email' => '',
    'origens'    => ['https://quivoto.cat','https://www.quivoto.cat','https://quienvoto.es','https://www.quienvoto.es'],
];
