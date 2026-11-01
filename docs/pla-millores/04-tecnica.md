# quivoto — revisió tècnica (mantenibilitat i risc de cara al 23-05-2027)

> Annex del [pla de millores](PLA.md). Al pla, les troballes d'aquest document es citen amb el prefix **TEC-** seguit del número o codi de l'apartat (per exemple, TEC-O1). Les referències `fitxer:línia` són del commit `e53c589` i es poden haver mogut.

Data de la revisió: 26-10-2026 · Commit revisat: `e53c589` · Abast: tot el repositori (`packages/*`, `web/public`, `tools`, `docs`).
Revisió només de lectura: no s'ha modificat cap fitxer del repositori.

## 0. Què s'ha pogut comprovar i què no

| Comprovació | Resultat |
|---|---|
| `corepack pnpm install` | OK (9 s, la xarxa ho permet) |
| `corepack pnpm test` (arrel) | **FALLA a l'instant**: `@quivoto/shared-schemas` diu «No test files found» i atura tota la recursió (veure T1). Els tests del pipeline no arriben a executar-se. |
| `pnpm --filter @quivoto/pipeline test` | 81/82 fitxers OK, **2.181 tests passen**, 8 omesos; **1 suite falla** (`dades.test.ts`) perquè necessita la base local real (`packages/db/.data/quivoto`) que no és al repo (T2). 45 s. |
| `vitest run packages/shared-schemas` (des de l'arrel) | 3 fitxers, 52 tests OK |
| `corepack pnpm typecheck` | OK als tres paquets (28 s) |
| Mesura d'una fitxa municipal renderitzada amb les dades de prova | 143 kB HTML (32 kB gzip); **70 kB són CSS en línia (49 %)**, 14 kB JS, 19 kB SVG |
| Capçaleres del web en producció (`curl quivoto.cat`) | **No s'ha pogut**: el proxy de l'entorn bloqueja el domini (403). Tot el que diu de producció s'ha de verificar a mà. |
| Sortida generada (`web/public/observatori/`) i base PGlite | **No existeixen al repo** (gitignorades). No s'ha pogut executar `publica tots` ni mesurar-ne el temps. |

Context general: el codi és molt cuidat a nivell de domini (comentaris que expliquen el *perquè*, bona disciplina de «sense dada, no estimació», 2.200 tests unitaris amb fixtures reals). Els riscos grossos no són de qualitat del codi sinó d'**operació**: tot depèn d'un sol portàtil (macOS), no hi ha CI ni execució programada, el desplegament de l'Observatori no està documentat, i hi ha diverses peces de configuració (CSP, `noindex`, consentiment d'analítica) que poden fallar en silenci just quan el trànsit sigui màxim.

Format de cada troballa: **Fitxer:línia · Problema · Risc · Solució · Esforç (S/M/L) · Impacte (alta/mitjana/baixa)**.

---

## 1. Operació, desplegament i continuïtat (el bloc més crític)

### O1. Tota la producció de dades viu en un sol portàtil, sense còpia ni reproducció
- **On:** `.gitignore:16-21` (`packages/db/.data/`, `web/public/observatori/`), `packages/db/src/index.ts:20` (`LOCAL_DATA_DIR`), `packages/pipeline/src/jobs/j11-fotos.ts:221-223` (fotos dins de `web/public/observatori/fotos`).
- **Problema:** la base PGlite (amb ingestes que triguen hores: J11, J12, J13, J14, J19), les actes descarregades, les fotos processades i tot l'HTML generat només existeixen a la màquina del desenvolupador. La còpia de seguretat documentada (`docs/DESPLEGAMENT.md:14`, §9) només cobreix la SQLite de subscriptors.
- **Risc:** pèrdua o avaria del portàtil = setmanes per reconstruir i peticions massives a fonts públiques; *bus factor* 1 durant la campanya.
- **Solució:** (a) migrar a un Postgres gestionat (el codi ja ho suporta amb `DATABASE_URL`) o, mínim, `pg_dump`/tar diari de `.data/` a un emmagatzematge extern (S3/Backblaze); (b) desar els artefactes en cru descarregats (actes, CSV de fonts) en un *bucket* amb clau de contingut; (c) versionar el lliurable publicat com a artefacte (tarball per publicació, amb data) per poder fer *rollback*.
- **Esforç:** M · **Impacte:** alta

### O2. No hi ha CI ni cap execució programada
- **On:** no existeix `.github/`; `README.md:7` mostra una insígnia «Tests» estàtica que no reflecteix res.
- **Problema:** ni tests ni typecheck s'executen en cada *push*; cap refresc automàtic de fonts; cap alerta quan una font canvia de format.
- **Risc:** regressions silencioses (ja n'hi ha: T1 i T2 fan que `pnpm test` falli avui i ningú ho ha vist); dades obsoletes en període electoral.
- **Solució:** GitHub Actions amb dos *workflows*: (1) `ci.yml` a cada PR/push: install, typecheck, tests (amb T1/T2 arreglats); (2) `refresh.yml` amb `schedule` (setmanal ara, diari a partir del març 2027) que executi les feines «lleugeres» (`j1…j29` d'`ORDER`) contra Postgres, publiqui en un directori nou, passi verificacions i obri un PR o desplegui. Requereix O3 (sortir de macOS).
- **Esforç:** M · **Impacte:** alta

### O3. El pipeline només corre a macOS
- **On:** `packages/pipeline/src/jobs/j11-fotos.ts:242` (`sips`, eina exclusiva de macOS), `packages/pipeline/src/publish/og.ts:40-46` (rutes `/Applications/...` primer), dependència de `pdftotext` i `cwebp` no declarades enlloc més que al README.
- **Problema:** dependències de sistema implícites i no portables.
- **Risc:** impossible moure el pipeline a CI/servidor o a una segona persona amb Linux.
- **Solució:** substituir `sips`+`cwebp` per `sharp` (npm, multiplataforma) o `vips`; per a les OG, `playwright`/`puppeteer` amb Chromium gestionat, o millor `satori`+`resvg` (sense navegador). Afegir un `Dockerfile` o `devcontainer` amb `poppler-utils`, Chromium i Node 22.
- **Esforç:** M · **Impacte:** alta

### O4. El desplegament de l'Observatori no està documentat i el `rsync --delete` pot esborrar-lo
- **On:** `docs/DESPLEGAMENT.md:121-131`.
- **Problema:** l'única ordre documentada és `rsync -avz --delete web/public/ …/httpdocs/`. Com que `web/public/observatori/` està gitignorat, des d'un clon net (o després d'una publicació parcial) aquest `rsync` **esborra tot l'Observatori en producció**. No hi ha cap pas documentat per pujar `observatori/`, ni per fer-ho de manera atòmica.
- **Risc:** caiguda total del producte principal amb una sola ordre «de la documentació».
- **Solució:** script `tools/desplega.sh` que: comprovi que `observatori/m/` té 947 fitxes i que `verificacio` passa; pugi a un directori versionat (`releases/2026-10-26T…`) i canviï un *symlink* (`httpdocs/observatori -> releases/…`) de manera atòmica; mantingui les 3 darreres versions per a *rollback*; exclogui `api/config.php` i qualsevol `.sqlite`.
- **Esforç:** S · **Impacte:** alta

### O5. La publicació escriu directament al directori servit i no és atòmica
- **On:** `packages/pipeline/src/publish/publish.ts:52` (`OUT_DIR` = `web/public/observatori/m/`), `publish.ts:255-274`, `publish.ts:449`.
- **Problema:** les 947 fitxes, ~4.800 de regidor i ~2.600 de candidatura s'escriuen d'una en una sobre la sortida «viva». Si qualsevol pas peta a mig camí (p. ex. `writeOgImages` sense Chrome a `publish.ts:449`, o el conegut «memory access out of bounds» de PGlite), queden pàgines noves barrejades amb velles i **les pàgines globals (sitemap, portada, els947) no es regeneren** perquè van després (`publish.ts:488-549`).
- **Risc:** web incoherent (xifres de portada que no quadren amb les fitxes), justament el tipus d'error que el projecte vol evitar.
- **Solució:** generar a un directori temporal (`observatori.next/`), executar la verificació, i fer `rename` atòmic. Fer que els passos opcionals (OG, descàrregues) no aturin la resta (try/catch amb incidència registrada).
- **Esforç:** S · **Impacte:** alta

### O6. Les pàgines obsoletes no s'esborren mai
- **On:** `packages/pipeline/src/publish/publish.ts:89-106` (`fitxesADisc` compta el que hi ha a disc), cap `rm` a `publish.ts`, `regidor.ts`, `candidatura.ts`.
- **Problema:** si un regidor dimiteix, canvia l'slug d'una candidatura o es corregeix un nom, la pàgina antiga continua servida i comptada. `fitxesADisc` fins i tot la fa entrar al sitemap/portada.
- **Risc:** pàgines de persones amb informació caducada (dada personal inexacta: problema RGPD i reputacional en campanya); després del maig 2027, milers de fitxes del mandat 2023 «penjades».
- **Solució:** amb O5 (directori net per publicació) desapareix sol. Mentrestant, manifest de fitxers escrits i neteja del que no hi és; redirecció 301 per a slugs que canvien (mapa d'àlies).
- **Esforç:** S · **Impacte:** alta

### O7. `pnpm ingest all` és tot-o-res: una font caiguda atura la publicació
- **On:** `packages/pipeline/src/cli.ts:133-137` (`ORDER`), `cli.ts:162-166`, `packages/pipeline/src/lib/run.ts:79-89` (`withRun` rellança l'error).
- **Problema:** les feines s'executen en sèrie i la primera excepció (p. ex. Socrata 502 després de 4 reintents, o un canvi de format a l'INE) avorta totes les següents, incloent `derive` i `publica`.
- **Risc:** en dies de molta activitat de fonts (nit electoral, publicació de candidatures al BOP) un sol proveïdor bloqueja l'actualització de tot.
- **Solució:** classificar feines en «crítiques» i «opcionals»; continuar amb les opcionals fallides i marcar-les a l'informe; *exit code* diferent (p. ex. 2 = parcial). Afegir `--des-de jN` per reprendre.
- **Esforç:** S · **Impacte:** mitjana

### O8. La documentació d'operació publica detalls d'infraestructura i una credencial d'abast massa ampli
- **On:** `docs/DESPLEGAMENT.md` (seccions de servidor i de Cloudflare).
- **Problema:** el repositori és públic i el document de desplegament descriu la infraestructura amb detall. A més, la configuració de Cloudflare es va fer amb una clau d'API de tot el compte, no amb un *token* limitat a la zona. Els detalls concrets s'ometen expressament aquí perquè aquest document també és públic.
- **Risc:** un web polític és un objectiu probable en campanya, i una credencial d'abast global multiplica el dany d'un compromís del servidor.
- **Solució:** moure les dades d'infraestructura a notes privades; rotar la clau global i fer servir *API Tokens* limitats a la zona; comprovar que cap fitxer de credencials és accessible per web; valorar separar quivoto en un servidor propi abans del 2027.
- **Esforç:** S · **Impacte:** alta

### O9. Sense CDN davant del servidor
- **On:** `docs/DESPLEGAMENT.md:38-40` (registres A amb «proxy: off»), `docs/DESPLEGAMENT.md:47-48` (CDN com a «pas opcional»).
- **Problema:** tot el trànsit va a un sol VPS Plesk compartit amb altres clients.
- **Risc:** pics de trànsit (debats, nit electoral, mencions a premsa) o un DDoS tomben el lloc.
- **Solució:** activar el proxy de Cloudflare (Full strict) **ara**, amb *Cache Rules*: `/observatori/*` «Cache Everything» amb TTL de vora 1 h + purga a cada publicació; `/api/*` *bypass*. Afegir una regla de *rate limiting* a `/api/subscribe.php`.
- **Esforç:** S · **Impacte:** alta

---

## 2. Seguretat i privadesa

### S1. La CSP del repo bloquejaria els estils en línia que fan servir totes les pàgines
- **On:** `web/public/.htaccess:24` (`style-src 'self'`), `web/public/index.html:23` (`<style>`) i 19 atributs `style=""`; `packages/pipeline/src/publish/radiografia.ts:5149` (tot el CSS de cada fitxa va en un `<style>`), i igual a la resta de plantilles.
- **Problema:** amb `style-src 'self'` els navegadors ignoren `<style>` i `style=""`. O bé producció no fa servir aquest `.htaccess` (deriva de configuració entre repo i servidor), o bé l'Observatori es veu sense estils.
- **Risc:** si algú «sincronitza» el `.htaccess` del repo, el lloc es trenca visualment; i el contrari, la CSP real és desconeguda.
- **Solució:** verificar les capçaleres reals; moure el CSS a fitxers externs amb *hash* al nom (vegeu P1), cosa que permet mantenir `style-src 'self'`; substituir `'unsafe-inline'` de `script-src` per *nonces* o *hashes* (els scripts són estàtics, es poden calcular en generar); afegir `report-uri`/`report-to`.
- **Esforç:** M · **Impacte:** alta

### S2. Google Analytics sense consentiment previ
- **On:** `packages/pipeline/src/publish/publish.ts:54-71` (s'injecta GA a **tota** pàgina HTML), `tools/build_landing.py:692-698`, `web/public/privadesa.html` (secció «Cookies»: «Pots bloquejar-los des del navegador»).
- **Problema:** GA4 instal·la galetes analítiques no exemptes sense banner ni opció prèvia. L'AEPD (guia de galetes, 2023) exigeix consentiment per a analítica de tercers; el text de privadesa remet al navegador, que no és vàlid.
- **Risc:** sanció LSSI art. 22.2 i, sobretot, dany reputacional per a un projecte que es ven com a neutral i transparent; s'agreuja en període electoral.
- **Solució:** canviar a analítica sense galetes i autoallotjada (Plausible/Umami/GoatCounter, o logs del servidor) — elimina també el `'unsafe-inline'` i el domini de tercers de la CSP; o bé *Consent Mode v2* amb banner real. La injecció a `writeFile` s'ha de fer per plantilla comuna (vegeu A2), no amb un `replace("</head>")` global.
- **Esforç:** S · **Impacte:** alta

### S3. La política de privadesa diu que no es publiquen fotos d'excàrrecs, però J28 les publica
- **On:** `web/public/privadesa.html:50` / `tools/build_landing.py:953` («ni cap fotografia de ningú que no ocupi el càrrec ara mateix») vs `packages/pipeline/src/jobs/j28-fotos-exalcaldes.ts:19-40` i `packages/pipeline/src/publish/trajectoria-electes.ts:115,820` (~230 retrats d'exalcaldes de Commons).
- **Risc:** incompliment de la pròpia política (principi de transparència RGPD art. 13), reclamació fàcil de guanyar.
- **Solució:** o actualitzar la política (base legal, interès públic històric, procediment d'oposició) o no publicar-les. Afegir un enllaç «Corregir o oposar-me» a cada fitxa de persona (`regidor.ts`, `trajectoria-electes.ts`) cap a un formulari/correu.
- **Esforç:** S · **Impacte:** alta

### S4. Límit d'abús del formulari fàcil de saltar (capçalera `CF-Connecting-IP` falsificable)
- **On:** `web/public/api/lib.php:58`.
- **Problema:** es confia en `HTTP_CF_CONNECTING_IP` encara que Cloudflare **no** està fent de proxy (O9). Qualsevol client pot posar-hi un valor diferent a cada petició i el límit de 8/h per IP desapareix. A més el límit només compta altes noves (`subscribe.php:50-53`): els duplicats i errors no compten.
- **Risc:** inundació de la base amb correus de tercers (vegeu S5), *mail bombing* a `avis_email` (`subscribe.php:63-67`).
- **Solució:** usar `CF-Connecting-IP` només si `REMOTE_ADDR` és dins dels rangs de Cloudflare; si no, `REMOTE_ADDR`. Comptar intents (taula d'intents o APCu), no altes. Afegir rate limit a Cloudflare/Apache (`mod_evasive`).
- **Esforç:** S · **Impacte:** mitjana

### S5. Alta sense doble confirmació i sense manera real de donar-se de baixa
- **On:** `web/public/api/subscribe.php:56-61` (insereix directament com a `actiu`), `tools/exporta_subscriptors.php:12-14` (l'exportació **no inclou el `token`**), `web/public/api/baixa.php:10`.
- **Problema:** qualsevol pot apuntar el correu d'un altre; no hi ha prova del consentiment (IP sense guardar, cap correu de confirmació). L'enllaç de baixa depèn d'un token que mai s'envia i que l'exportació no treu, de manera que el correu massiu que s'enviï el 2027 no podrà portar un enllaç de baixa individual.
- **Risc:** LSSI art. 21 (comunicacions comercials/informatives sense consentiment demostrable) i RGPD art. 7.1 (cal poder demostrar el consentiment); spam reports que cremen la reputació del domini just quan s'hagi d'avisar.
- **Solució:** *double opt-in* (estat `pendent` → correu amb enllaç de confirmació → `actiu`); exportar `token` i generar l'URL de baixa; capçaleres `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) al proveïdor d'enviament; baixa amb POST/confirmació per evitar que els antivirus de correu que obren enllaços (Outlook Safe Links) donin de baixa sols.
- **Esforç:** M · **Impacte:** alta

### S6. Sal per defecte silenciosa i SQL amb cometes dobles
- **On:** `web/public/api/lib.php:18` (`'canvia-aquesta-sal-en-desplegar'` si falta `config.php`), `lib.php:42-43` i `baixa.php:10` (`DEFAULT "ca"`, `estat = "baixa"`, `"actiu"`).
- **Problema:** (a) si `config.php` desapareix (p. ex. per un `rsync` mal fet), l'API continua funcionant amb una sal pública; (b) SQLite tracta `"..."` com a identificador i només cau a literal per compatibilitat (DQS). Builds de SQLite amb `SQLITE_DQS=0` (cada cop més habituals) trenquen la baixa i la creació de la taula.
- **Solució:** fallar tancat (HTTP 503 + `error_log`) si no hi ha config o la sal és la per defecte; usar cometes simples als literals SQL.
- **Esforç:** S · **Impacte:** mitjana

### S7. Injecció de fórmules a l'exportació CSV
- **On:** `tools/exporta_subscriptors.php:12-14`; camp lliure `municipi` (`subscribe.php:42-44`).
- **Risc:** un `municipi` com `=HYPERLINK(...)` s'executa en obrir el CSV amb Excel/Sheets.
- **Solució:** prefixar amb `'` els valors que comencin per `= + - @ \t \r`; validar `municipi` contra la llista dels 947 (ja existeix a `cerca.json`).
- **Esforç:** S · **Impacte:** baixa

### S8. JSON dins de `<script>` sense escapar `</script>` en algunes plantilles
- **On:** `packages/pipeline/src/publish/mapa-catalunya.ts:927` (`INFO` amb noms d'alcaldes), `els947.ts:1305`, `els947.ts:1327-1338`, `prova.ts:339-341`, `cercador.ts:88,111`. En canvi `comparador.ts:1038-1042` ja té `jsonSegur`.
- **Problema:** una cadena de dades amb `</script>` o `<!--` (Wikidata i portals municipals són fonts editables o poc controlades: J20, J27, J21) trenca el document i obre la porta a XSS emmagatzemat. Amb `'unsafe-inline'` a la CSP no hi ha segona línia de defensa.
- **Solució:** moure `jsonSegur` a un mòdul compartit i fer-lo servir a tots els `JSON.stringify` dins de `<script>`; test que injecti `</script><img onerror>` a un nom i comprovi la sortida.
- **Esforç:** S · **Impacte:** mitjana

### S9. Escapament duplicat 27 vegades i amb variants incompletes
- **On:** funcions `escape`/`esc` idèntiques a `capcalera.ts:69`, `comarques.ts:167`, `sigla.ts:25`, `partit.ts:495`, `peu.ts:37`, `radiografia.ts:864`, `amb.ts:141`, `comparador.ts:1035` i `:1697`, `mapa.ts:118`, `regidor.ts:108`, `og.ts:127`, `dades.ts:1570`… (27 còpies); `cercador.ts:206` (client) no escapa `"`; `mascota.ts:220` no escapa `>`.
- **Risc:** una correcció futura (p. ex. escapar `'`) s'aplicarà a unes plantilles sí i a d'altres no.
- **Solució:** un sol `lib/html.ts` amb `escapeHtml`, `escapeAttr`, `jsonSegur` i un *tagged template* `html\`` que escapi per defecte (patró «segur per defecte»; marcar explícitament el HTML de confiança amb `raw()`).
- **Esforç:** M · **Impacte:** mitjana

### S10. `.gitignore` incomplet per a dades personals i secrets
- **On:** `.gitignore:1-21`; `web/README.md:65` recomana `php tools/exporta_subscriptors.php > subscriptors.csv` (a l'arrel del repo).
- **Problema:** `subscriptors.csv`, `*.csv` fora de fixtures, `.env*`, `*.pem`, `credencials*` no estan ignorats; el README empeny a crear el CSV de correus dins del working tree. (Entrada `packages/db/.data/` duplicada.)
- **Solució:** afegir `*.csv` a l'arrel + `!packages/**/__fixtures__/*.csv`, `.env*`, `subscriptors*`, `*.key`, `*.pem`; canviar el README a `> ~/subscriptors.csv`; activar *secret scanning* i *push protection* a GitHub.
- **Esforç:** S · **Impacte:** mitjana

### S11. 404 sense pàgina pròpia
- **On:** `web/public/.htaccess:47` (`ErrorDocument 404 /index.html`).
- **Problema:** qualsevol URL inexistent a `/observatori/…` mostra la portada de la landing (amb estat 404, però amb el contingut d'una altra pàgina); els `fetch()` de JSON que fallen reben HTML.
- **Solució:** `404.html` propi amb cercador de municipi (el mateix `cerca.json`).
- **Esforç:** S · **Impacte:** baixa

---

## 3. Arquitectura i organització del codi

### A1. Fitxers de plantilla gegants que barregen consulta, càlcul, HTML, CSS i JS client
- **On:** `packages/pipeline/src/publish/radiografia.ts` (5.328 línies), `partit.ts` (2.712), `comparador.ts` (2.392), `regidor.ts` (1.838), `dades.ts` (1.710), `publish.ts` (1.544, amb ~700 línies de càrrega de dades: `publish.ts:597-1376`), `els947.ts` (1.467), `comarques.ts` (1.440), `estil.ts` (1.343 de CSS dins d'una cadena TS).
- **Problema:** cada fitxer fa quatre feines (lectura de BD, derivació, maquetació HTML en *template strings*, JS de navegador en cadenes sense tipus ni lint). Els comentaris documenten bugs que en són conseqüència directa (la portada generada dues vegades, `publish.ts:551-560`; consultes que petaven per memòria al final del bucle, `publish.ts:138-148`).
- **Risc:** cada canvi de 2027 (nou mandat, resultats nous, candidatures) toca fitxers de 2.000-5.000 línies; alt cost d'incorporar una segona persona.
- **Solució (incremental, sense reescriure):** per a cada pàgina, separar `carrega*.ts` (BD → model tipat), `model` (pur, testable) i `vista` (HTML). Partir `radiografia.ts` per blocs (govern, vot, comptes, seguretat…) que ja estan delimitats amb comentaris. Moure el JS de client a fitxers `.ts` reals a `publish/client/` compilats amb `esbuild` (ja és a l'arbre de dependències) a assets amb *hash*. Considerar una capa de plantilles lleugera (p. ex. JSX sense React amb `preact-render-to-string` o `@kitajs/html`) que escapi per defecte (resol S9).
- **Esforç:** L · **Impacte:** mitjana

### A2. Dues piles de generació, dos sistemes de disseny i dades copiades a mà
- **On:** `tools/build_landing.py` (1.129 línies Python, CSS a `web/public/assets/styles.css` + `<style>` inline) vs `packages/pipeline/src/publish/*` (TS, CSS a `estil.ts`); `tools/build_landing.py:148-165` copia «a mà» 5 afirmacions de Badalona i les posicions dels grups des de `publish/afirmacions/badalona.json`.
- **Problema:** la portada del domini i l'Observatori es mantenen en dos llenguatges; la demo de la portada pot divergir de la font sense que cap test ho detecti. A més hi ha scripts paral·lels (`portada-ara.ts`, `mapa-ara.ts`, `preguntes-ara.ts`) que regeneren pàgines per fora de `publica`.
- **Solució:** a curt termini, que `build_landing.py` llegeixi `badalona.json` (o un JSON exportat pel pipeline) en lloc de copiar; test que compari. A mitjà, portar la landing al pipeline TS i unificar tokens de disseny (un sol `tokens.css`).
- **Esforç:** M · **Impacte:** mitjana

### A3. L'elecció «actual» (M20231) està escrita a mà en desenes de llocs
- **On:** `packages/shared-schemas/src/brands.ts:119`, `packages/pipeline/src/jobs/j2-results.ts:25-29` (`TERM_DATES`), `publish/radiografia.ts:852,861,1160-1161,4326-4329,4703`, `publish/partit.ts:71`, `publish/candidatura.ts:33-36`, `publish/comarques.ts:451,460`, `publish/amb.ts:589`, `publish/comparador.ts:846`, `publish/nom-sencer-cli.ts:23` (≈55 aparicions a `publish/` i `derive/`).
- **Problema:** el 28 de maig de 2027 caldrà canviar «l'elecció de referència», afegir M20271 a les sèries i passar el mandat 2023 a històric. Avui és una cerca-i-substitueix per tot el codi.
- **Risc:** la nit/setmana electoral, quan més visites hi haurà, és quan més probable és oblidar-ne algun i publicar xifres barrejades.
- **Solució:** `shared-schemas/eleccions.ts` amb `ELECCIONS` (id, any, data, inici/fi de mandat) i `ELECCIO_ACTUAL`, `ELECCIO_ANTERIOR` derivats; prohibir literals `"M20…"` fora d'aquest fitxer amb un test (grep) o una regla de lint. Assajar el canvi a una branca amb dades simulades de 2027 abans del març.
- **Esforç:** M · **Impacte:** alta

### A4. Mètriques en `jsonb` sense esquema: el contracte entre feina i plantilla no es valida
- **On:** `packages/db/src/schema/territory.ts:72` (`data: jsonb`), 22 *casts* `f.data as X` a `packages/pipeline/src/publish/*` (p. ex. `publish.ts:226-230`, `:240-246`); `zod` declarat a `packages/shared-schemas/package.json` però **no s'importa enlloc**.
- **Problema:** si una feina canvia la forma d'una mètrica, la plantilla llegeix `undefined` i (pel principi «sense dada») mostra «sense dades» en silenci; els tests de plantilla fan servir fixtures escrites a mà que no detecten la divergència.
- **Solució:** un esquema `zod` per `kind`, definit una vegada a `shared-schemas`, usat a l'escriptura (feina) i a la lectura (publish) amb `safeParse` que generi incidència. Versió de l'esquema dins del JSON.
- **Esforç:** M · **Impacte:** mitjana

### A5. Sense migracions versionades de la base
- **On:** `packages/db/package.json` (`"push": "drizzle-kit push --force"`, no hi ha carpeta `drizzle/`); `package.json:10` (`db:reset` crida un script `reset` que no existeix).
- **Risc:** en passar a Postgres de producció (necessari per O1/O2), `push --force` pot esborrar columnes amb dades.
- **Solució:** `drizzle-kit generate` + migracions al repo; `migrate` a CI; arreglar o treure `db:reset`.
- **Esforç:** S · **Impacte:** mitjana

### A6. Utilitats HTTP duplicades i inconsistents
- **On:** `packages/pipeline/src/lib/http.ts:28` (només `fetchJson`); `fetchText` duplicat a `adapters/seue.ts:66` i `jobs/j23-riquesa.ts:643`; `fetch` cru amb lògica pròpia a 11 fitxers més (`j12-actes.ts`, `j13`, `j19`, `j27`, `j28`, `adapters/portals-municipals.ts`, `barcelona.ts`, `aca.ts`…); branca morta a `http.ts:44-47` (els dos `throw` són iguals).
- **Problema:** reintents, *timeouts*, `User-Agent`, respecte de `Retry-After` i límits per host varien per feina.
- **Solució:** un client únic (`fetchJson`, `fetchText`, `fetchBytes`) amb reintent exponencial + *jitter*, `Retry-After`, *timeout*, concurrència limitada per domini i **memòria cau en disc condicional** (`ETag`/`If-Modified-Since`) — reduiria hores de reingesta i càrrega sobre servidors públics.
- **Esforç:** M · **Impacte:** mitjana

### A7. Bytes NUL literals dins del codi font
- **On:** `packages/pipeline/src/publish/cerca.ts:395,431`, `publish/portada-mostra.ts:178` (separador `\0` escrit com a byte real).
- **Problema:** `grep`, `git diff` i GitHub tracten els fitxers com a binaris (no es veuen els diffs a les revisions).
- **Solució:** escriure `"\u0000"` o un separador imprimible (`|`).
- **Esforç:** S · **Impacte:** baixa

---

## 4. Tests i qualitat

### T1. `pnpm test` a l'arrel falla abans de començar
- **On:** `packages/shared-schemas/package.json:13` (`"test": "vitest run"`) + `vitest.config.ts:5` (`include: ["packages/*/src/**/*.test.ts"]`, relatiu a l'arrel).
- **Problema:** des de `packages/shared-schemas`, Vitest troba la configuració arrel però resol el patró relatiu al paquet → «No test files found» → codi 1 → `pnpm -r` s'atura i **els 2.181 tests del pipeline no s'executen**.
- **Solució:** igualar a pipeline: `"test": "vitest run --root ../.. packages/shared-schemas"`, o un sol `vitest` a l'arrel (`"test": "vitest run"`) amb `projects`.
- **Esforç:** S · **Impacte:** alta (sense això, qualsevol CI estarà vermell o desactivada)

### T2. Un test depèn de la base local real
- **On:** `packages/pipeline/src/publish/dades.test.ts:58-70` (`openDb()` sense opcions → `packages/db/.data/quivoto`).
- **Problema:** falla en qualsevol màquina que no sigui la del desenvolupador (ENOENT) i, a la seva, el resultat depèn de l'estat de la base.
- **Solució:** seguir el patró que ja fa servir `alcaldia.test.ts:205` (`openDb({ dir: "memory://" })`) amb una llavor mínima (3-5 municipis), o marcar-lo com a test d'integració amb `describe.runIf(existsSync(LOCAL_DATA_DIR))`.
- **Esforç:** S · **Impacte:** mitjana

### T3. Les feines centrals de resultats electorals no tenen tests
- **On:** sense `*.test.ts`: `jobs/j1-territory.ts`, `jobs/j2-results.ts`, `jobs/j5-context.ts`, `jobs/j6-finances.ts`, `jobs/j12-actes.ts`, `adapters/socrata.ts`, `adapters/aoc.ts`.
- **Problema:** justament J2/J5 (resultats i participació) són les que s'hauran de modificar el maig 2027.
- **Solució:** tests amb fixtures Socrata (una pàgina de resultats real per a 3 municipis, incloent un empat i un municipi de concejo abierto), i test de contracte que verifiqui els noms de columna del dataset en viu (setmanal, a CI, no bloquejant).
- **Esforç:** M · **Impacte:** mitjana

### T4. Sense lint/format ni proves de la sortida publicada
- **On:** arrel (cap `eslint`, `prettier`, `biome`, `.editorconfig`); el JS client dins de cadenes no passa per cap comprovació.
- **Solució:** `biome` (ràpid, zero config); un pas de «test de fum» sobre la sortida generada: validar HTML (`html-validate`), enllaços interns trencats (`lychee --offline`), mida màxima per pàgina, i `axe-core`/`pa11y` sobre una mostra de 10 pàgines.
- **Esforç:** M · **Impacte:** mitjana

---

## 5. Robustesa del pipeline i observabilitat

### R1. Incidències sense vincle a l'execució: s'acumulen i dupliquen
- **On:** `packages/db/src/schema/territory.ts:82-97` (`data_issues` sense `run_id`), `packages/pipeline/src/lib/run.ts:37-52`, `packages/pipeline/src/report.ts:42-46` (compta les no resoltes de sempre).
- **Problema:** cada reingesta torna a inserir les mateixes incidències; el report suma incidències d'execucions antigues; no es pot dir «aquesta execució ha empitjorat».
- **Solució:** afegir `run_id` i una clau de deduplicació (`kind+entity+municipalityId`) amb `onConflictDoUpdate(last_seen_at)`; el report compara amb l'execució anterior.
- **Esforç:** S · **Impacte:** mitjana

### R2. Cap alerta ni llindar de qualitat abans de publicar
- **On:** `packages/pipeline/src/report.ts` (només `stdout`), `publish/verificacio.ts` (verifica afirmacions, no la cobertura global).
- **Problema:** si una font retorna 0 files o la meitat (canvi de format, dataset retirat), les feines desen «sense dades» i la publicació surt igual.
- **Solució:** «pressupost» per feina (files esperades ±X % respecte de l'execució anterior; % de municipis amb dada per camp) que faci fallar la publicació o almenys enviï alerta (correu/Telegram/Slack via webhook des de CI). Pàgina interna `estat.json` amb data de darrera actualització per font, publicada i enllaçada al peu («dades actualitzades el …»).
- **Esforç:** M · **Impacte:** alta

### R3. Sense monitoratge en producció
- **On:** cap referència a *uptime*, logs d'Apache o errors JS.
- **Solució:** UptimeRobot/Better Stack (gratuït) sobre `/`, `/observatori/`, una fitxa i `POST /api/subscribe.php` sintètic; alerta d'expiració de certificat (el de Let's Encrypt venç el 24-11-2026 segons `docs/DESPLEGAMENT.md:43`; cal comprovar que la renovació de Plesk funciona).
- **Esforç:** S · **Impacte:** mitjana

### R4. PGlite com a base de treball: un sol procés, falles de memòria conegudes
- **On:** `packages/db/src/index.ts:22-29,62-75`, `packages/pipeline/src/cli.ts:176-201` (s'ignoren excepcions no capturades un cop `finished`), `publish.ts:138-148`.
- **Problema:** el codi conviu amb errors de WASM que se silencien; un error real posterior a `finished = true` també s'empassaria.
- **Solució:** Postgres (local amb Docker i a CI); retirar els *workarounds* un cop migrat.
- **Esforç:** M · **Impacte:** mitjana

### R5. Les imatges OG es regeneren sempre, amb Chrome, i són un punt únic de fallada
- **On:** `packages/pipeline/src/publish/og.ts:604-648`, cridat a `publish.ts:449`.
- **Problema:** 947 captures seqüencials en cada `publica tots`; si Chrome no hi és, la publicació s'atura a mitges (O5).
- **Solució:** *hash* de les dades de cada OG i saltar les que no canvien; envoltar en try/catch; idealment `satori`+`resvg` (Node pur).
- **Esforç:** S · **Impacte:** mitjana

---

## 6. Rendiment de les pàgines generades

### P1. 70 kB de CSS en línia repetits a cada una de les ~8.500 pàgines
- **On:** `packages/pipeline/src/publish/radiografia.ts:5149` (`<style>${RADIOGRAFIA_CSS}…`), `estil.ts:1343`; patró igual a la resta de plantilles.
- **Problema:** a la mostra, el 49 % dels bytes és CSS que el navegador no pot reaprofitar entre pàgines. Navegar de municipi a regidor a candidatura torna a baixar-lo cada vegada.
- **Solució:** `observatori/assets/obs.[hash].css` extern amb `Cache-Control: public, max-age=31536000, immutable`; mantenir en línia només el CSS crític de la capçalera (< 10 kB) si cal. Resol a la vegada S1.
- **Esforç:** S · **Impacte:** mitjana

### P2. Capçaleres de memòria cau incompletes
- **On:** `web/public/.htaccess:28-35`.
- **Problema:** no hi ha regla per a `image/webp`, `image/png` (fotos, OG), `application/json` (`cerca.json`, `cerca-electes.json`), `text/csv`; l'HTML té 10 min (bé), però els assets sense *hash* (`fonts.css`, `app.js`) en tenen 7 dies i no es poden invalidar. `mod_deflate` sense Brotli.
- **Solució:** afegir tipus; noms amb *hash* per a JS/CSS; `immutable` per a fotos (ja tenen id); Brotli via Cloudflare (O9).
- **Esforç:** S · **Impacte:** mitjana

### P3. Pes de la pàgina: SVG en línia i JS d'interacció
- **On:** mostra renderitzada: 19 kB d'SVG i 14 kB de JS en línia per fitxa; mapa de 947 polígons a `mapa-catalunya.ts` en línia.
- **Solució:** pressupost de rendiment a CI (p. ex. 60 kB gzip per fitxa); `content-visibility:auto` per a blocs inferiors; `loading="lazy"` i `decoding="async"` a les fotos de regidors; mesurar amb Lighthouse CI sobre 5 URL representatives.
- **Esforç:** S · **Impacte:** baixa

---

## 7. SEO i xarxes socials

### SEO1. `noindex, nofollow` fix a pàgines clau, encara que s'activi `QUIVOTO_INDEXABLE`
- **On:** `packages/pipeline/src/publish/config.ts:15` (interruptor), però **sense** l'interruptor: `portada.ts:531` (portada de l'Observatori!), `els947.ts:1142`, `mapa-catalunya.ts:767`, `comarques.ts:1329`, `comparador.ts:1539`, `amb.ts:1166`, `regidor.ts:1715`, `trajectoria-electes.ts:611`, `preguntes.ts:112`, `prova.ts:242`.
- **Problema:** el dia que s'activi la indexació, la portada de l'Observatori, el mapa, les comarques i els 947 continuaran amb `noindex, nofollow` — i a més són al sitemap (`publish.ts:490-500`). `nofollow` a les pàgines concentradores impedeix que Google arribi a les fitxes. Tampoc consta que la publicació de producció s'hagi fet amb `QUIVOTO_INDEXABLE=1`.
- **Risc:** Google necessita setmanes-mesos per indexar ~8.000 URL; si no s'activa abans de gener 2027, el trànsit orgànic de la campanya («qui governa a X», «resultats municipals X») anirà a la competència.
- **Solució:** una funció `metaRobots(tipus)` única que llegeixi `INDEXABLE`; decidir explícitament quines pàgines no s'indexen (proves/esborranys) i usar `noindex, follow` per a aquestes. Verificació a CI: cap pàgina del sitemap amb `noindex`.
- **Esforç:** S · **Impacte:** alta

### SEO2. `robots.txt` anuncia un sitemap de pàgines `noindex`, i el sitemap és incomplet
- **On:** `web/public/robots.txt:8`; `packages/pipeline/src/publish/publish.ts:488-514`.
- **Problema:** contradiu el comentari de `publish.ts:488` («només s'enllaça quan siguin indexables»). El sitemap no inclou fitxes de regidor (~4.800), candidatures (~2.600), preguntes, trajectòria ni `dades/`; `lastmod` és la data de generació per a totes les URL (Google l'acaba ignorant).
- **Solució:** índex de sitemaps (`sitemap-index.xml` → municipis, persones, candidatures, partits) amb `lastmod` real (hash del contingut); afegir-lo a robots només quan `INDEXABLE`; donar d'alta a Search Console i Bing Webmaster.
- **Esforç:** S · **Impacte:** mitjana

### SEO3. Sense dades estructurades a l'Observatori
- **On:** cap `application/ld+json` a `packages/pipeline/src/publish/*` (només la landing en té: `web/public/index.html:112`).
- **Solució:** `BreadcrumbList` a totes les pàgines; `Dataset` (amb `distribution` CSV/JSON i llicència) a `dades/` i a cada fitxa — és el que fa aparèixer el lloc a Google Dataset Search; `Place`/`AdministrativeArea` amb `sameAs` a Wikidata per municipi; `GovernmentOrganization` per a l'ajuntament; evitar `Person` amb dades sensibles.
- **Esforç:** S · **Impacte:** mitjana

### SEO4. Imatges socials genèriques o absents fora de la fitxa municipal
- **On:** `regidor.ts:1713-1720` (cap `og:*`), `candidatura.ts:677` i `partit.ts:1759` (`/assets/og.png` genèric).
- **Problema:** les pàgines que més es compartiran en campanya (candidatura, cap de llista, partit) es veuen igual a WhatsApp/X/Bluesky.
- **Solució:** reaprofitar el generador OG (R5) per a candidatures i partits; per a persones, OG amb nom+càrrec+municipi sense foto (privadesa).
- **Esforç:** M · **Impacte:** mitjana

### SEO5. `hreflang` cap a `quienvoto.es` i Observatori només en català
- **On:** `web/public/index.html` i `es/index.html` (`hreflang="es" → https://quienvoto.es/`), `web/public/sitemap.xml:5`; `docs/DESPLEGAMENT.md:208` («Comprovar i registrar `quienvoto.es`» encara pendent).
- **Problema:** si el domini no serveix `/es/`, els `hreflang` apunten a una URL que no respon i Google els descarta tots. L'Observatori no té versió castellana (part rellevant de l'electorat de l'àrea metropolitana busca en castellà).
- **Solució:** verificar `quienvoto.es`; si no està llest, apuntar `hreflang="es"` a `https://quivoto.cat/es/`. Valorar una capa mínima en castellà per a les pàgines de més trànsit (fitxa municipal, candidatures) amb `hreflang` creuat.
- **Esforç:** S (verificar) / L (traducció) · **Impacte:** mitjana

---

## 8. Preparació específica per al maig 2027

| Data aproximada | Què passarà | Què falta al codi |
|---|---|---|
| Gener-febrer 2027 | Trànsit creixent, premsa | SEO1/SEO2 activats i indexats; CDN (O9) |
| ~Abril 2027 | Proclamació de candidatures (BOP de cada província, JEC) | No hi ha adaptador per a candidatures 2027: cal un J nou (PDF del BOP o dataset de la Generalitat) i les pàgines de candidatura s'han d'obrir a M20271 (A3) |
| 23-05-2027 (nit electoral) | Pic de visites; resultats provisionals | No hi ha ingesta de resultats provisionals (només els datasets definitius de Socrata, `adapters/socrata.ts`). Decidir: o no publicar resultats la nit (i dir-ho), o un adaptador al servei de resultats provisionals amb publicació incremental només dels municipis canviats |
| Juny 2027 | Constitució dels nous ajuntaments | Canvi de mandat (A3), arxiu de les pàgines del mandat 2023 (O6), redireccions |

Recomanació: un «assaig general» al febrer 2027 amb dades simulades M20271, executant la cadena sencera a CI i desplegant a un subdomini de proves.

---

## 9. Top-10 prioritzat

| # | Acció | Troballes | Esforç | Impacte | Quan |
|---|---|---|---|---|---|
| 1 | Arreglar `pnpm test` (shared-schemas + `dades.test.ts` amb BD en memòria) i posar **CI a GitHub Actions** (typecheck + tests a cada push) | T1, T2, O2 | S | alta | Ja |
| 2 | **Còpia de seguretat externa** diària de la base del pipeline, actes i fotos; pla de migració a Postgres gestionat | O1, R4, A5 | M | alta | Novembre 2026 |
| 3 | **Script de desplegament atòmic** de l'Observatori (directori de *release* + symlink + rollback) i publicació a directori temporal amb neteja de pàgines obsoletes | O4, O5, O6 | S | alta | Novembre 2026 |
| 4 | **Verificar CSP i capçaleres reals**; treure CSS en línia a fitxer amb hash; `jsonSegur` i escapament únic a totes les plantilles | S1, P1, S8, S9 | M | alta | Desembre 2026 |
| 5 | **Analítica sense galetes** (o banner de consentiment real) i alinear la política de privadesa amb les fotos d'exalcaldes + enllaç de rectificació a les fitxes de persona | S2, S3 | S | alta | Ja |
| 6 | **Indexació**: `metaRobots` únic, treure `noindex` fix de portada/mapa/comarques/947, sitemap complet i Search Console, abans de gener 2027 | SEO1, SEO2, SEO3 | S | alta | Desembre 2026 |
| 7 | **Cloudflare en mode proxy** amb regles de cau i rate limit; corregir confiança en `CF-Connecting-IP`; rotar la *global key* i treure dades d'infraestructura del repo | O9, S4, O8 | S | alta | Ja |
| 8 | **Doble opt-in** i baixa amb token exportat + `List-Unsubscribe`; sal obligatòria; cometes SQL; CSV segur | S5, S6, S7, S10 | M | alta | Abans del primer enviament |
| 9 | **Centralitzar l'elecció actual** (`ELECCIO_ACTUAL`) i assaig general amb M20271 simulat; adaptador de candidatures 2027 | A3, T3, §8 | M | alta | Gener-febrer 2027 |
| 10 | **Observabilitat**: incidències per execució, pressupostos de cobertura per font amb alerta, *uptime* i caducitat de certificat; pipeline portable (sharp/satori en lloc de sips/Chrome) per poder córrer a CI programat | R1, R2, R3, O3, R5 | M | mitjana-alta | Desembre 2026-gener 2027 |

Deute de mantenibilitat a llarg termini (no urgent però recomanat abans de sumar una segona persona): partir `radiografia.ts`/`partit.ts`/`comparador.ts` en càrrega-model-vista i JS de client compilat (A1), unificar landing i Observatori (A2), esquemes `zod` per a les mètriques `jsonb` (A4), client HTTP únic amb memòria cau condicional (A6).
