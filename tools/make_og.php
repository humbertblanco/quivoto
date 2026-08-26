<?php
/**
 * Genera la imatge de previsualització per a xarxes (1200x630).
 *   php tools/make_og.php
 * Fa servir GD i la primera tipografia TrueType que troba al sistema.
 */
declare(strict_types=1);
$W = 1200; $H = 630;
$im = imagecreatetruecolor($W, $H);
$c = function (string $hex) use ($im) {
    [$r,$g,$b] = sscanf($hex, "#%02x%02x%02x");
    return imagecolorallocate($im, $r, $g, $b);
};
$paper = $c('#FBF7EE'); $ink = $c('#1E1B2E'); $coral = $c('#E2735A');
$mint = $c('#BFE8D2'); $peach = $c('#FFD8B8'); $white = $c('#FFFFFF');
imagefilledrectangle($im, 0, 0, $W, $H, $paper);
imagefilledrectangle($im, 0, $H - 26, $W, $H, $coral);

// La papereta, a la dreta
$x = 830; $y = 150; $w = 240; $h = 320;
imagefilledrectangle($im, $x, $y, $x + $w, $y + $h, $white);
imagerectangle($im, $x, $y, $x + $w, $y + $h, $ink);
for ($i = 1; $i <= 4; $i++) imagefilledrectangle($im, $x-$i, $y-$i, $x+$w+$i, $y+$h+$i, $white) ?: null;
imagesetthickness($im, 6);
imagerectangle($im, $x, $y, $x + $w, $y + $h, $ink);
imagefilledpolygon($im, [$x + $w - 62, $y, $x + $w, $y, $x + $w, $y + 62], $peach);
imageline($im, $x + $w - 62, $y, $x + $w, $y + 62, $ink);
imagefilledellipse($im, $x + 86, $y + 150, 34, 34, $ink);
imagefilledellipse($im, $x + 156, $y + 150, 34, 34, $ink);
imagesetthickness($im, 8);
imagearc($im, $x + 121, $y + 186, 90, 70, 20, 160, $ink);
imagesetthickness($im, 12);
imageline($im, $x + 60, $y + 260, $x + 180, $y + 260, $coral);
imageline($im, $x + 60, $y + 288, $x + 140, $y + 288, $mint);

// Text
$fonts = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Supplemental/Arial.ttf',
          '/Library/Fonts/Arial Bold.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'];
$font = null;
foreach ($fonts as $f) { if (is_readable($f)) { $font = $f; break; } }
if ($font) {
    imagettftext($im, 66, 0, 90, 250, $ink, $font, 'quivoto');
    imagettftext($im, 34, 0, 90, 330, $ink, $font, 'A qui votes al teu poble?');
    imagettftext($im, 24, 0, 90, 400, $coral, $font, 'Municipals 23 de maig de 2027');
    imagettftext($im, 20, 0, 90, 470, $ink, $font, '25 afirmacions del teu municipi · 7 minuts');
} else {
    imagestring($im, 5, 90, 240, 'quivoto', $ink);
    imagestring($im, 4, 90, 280, 'A qui votes al teu poble?', $ink);
}
$sortida = __DIR__ . '/../web/public/assets/og.png';
imagepng($im, $sortida, 8);
imagedestroy($im);
printf("og.png: %d bytes%s\n", filesize($sortida), $font ? '' : ' (sense TTF: text bàsic)');
