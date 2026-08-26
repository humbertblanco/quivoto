# quivoto — web

Landing de «properament» per a **quivoto.cat** (català) i **quienvoto.es** (castellà),
amb recollida de correus per avisar quan s'obri cada municipi.

## Com està fet

No hi ha framework ni pas de compilació complicat: un generador de Python escriu HTML
estàtic, i un únic fitxer PHP rep els correus. Tot es pot servir amb Apache o Nginx.

```
tools/
  icons_lib.py          Font única de les 16 icones i de la mascota (la papereta)
  build_landing.py      Genera les pàgines de web/public/ (ca i es)
  make_og.php           Genera assets/og.png (imatge per a xarxes)
  exporta_subscriptors.php  Treu la llista a CSV

web/public/             ← arrel web (document root)
  index.html            Portada en català          (generada)
  es/index.html         Portada en castellà        (generada)
  privadesa.html, avis-legal.html, gracies.html    (generades, i les seves versions /es/)
  assets/styles.css     Full d'estil únic, amb les animacions de les cares
  assets/app.js         Compte enrere + enviament del formulari
  assets/fonts.css      Tipografies servides des del nostre domini
  assets/fonts/*.woff2  Gabarito i Nunito Sans (subconjunts latin i latin-ext)
  assets/favicon.svg, assets/og.png
  api/subscribe.php     Alta de correu (JSON o redirecció)
  api/baixa.php         Baixa amb token, sense preguntes
  api/lib.php           Base de dades i utilitats
  api/config.example.php → copiar a config.php al servidor

web/private/data/       Base SQLite. MAI dins de l'arrel web.
```

## Editar i regenerar

Els textos viuen al diccionari `T` de `tools/build_landing.py` (una entrada per idioma).
Després de tocar-hi res:

```bash
python3 tools/build_landing.py     # regenera les 8 pàgines
php tools/make_og.php              # només si canvia la imatge de xarxes
```

Per veure-ho en local:

```bash
php -S 127.0.0.1:8788 -t web/public
# http://127.0.0.1:8788/
```

## Les icones i la mascota

`tools/icons_lib.py` és l'única font de veritat: 16 temes municipals, cadascun amb
un color fix, i la posició exacta dels ulls perquè caiguin dins de la forma (`EYES`).
Sense ulls són icones; amb ulls (`icon(i, with_face=True)`) es converteixen en veïns.
Les animacions (parpelleig, mirada, flotar) són CSS a `assets/styles.css` i es desactiven
soles amb `prefers-reduced-motion`.

## Correus

- Es desen a SQLite amb el consentiment marcat, l'idioma i el municipi opcional.
- No desem mai la IP: només un hash amb sal que canvia cada dia, per limitar l'abús.
- Cada alta té un token de baixa: `/api/baixa.php?t=…` esborra l'adreça a l'instant.
- Exportar: `php tools/exporta_subscriptors.php > subscriptors.csv`

## Privadesa i legal

- Cap cookie, cap analítica de tercers, cap tipografia externa.
- `privadesa.html` i `avis-legal.html` tenen camps entre claudàtors —
  `[NOM DEL RESPONSABLE]`, `[NIF]`, `[ADREÇA]`, `[PROVEÏDOR D'ALLOTJAMENT]` —
  que **s'han d'omplir abans de publicar**.
