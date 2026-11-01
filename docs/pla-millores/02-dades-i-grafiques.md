# Auditoria de dades i gràfics de quivoto

> Annex del [pla de millores](PLA.md). Al pla, les troballes d'aquest document es citen amb el prefix **DAD-** seguit del número o codi de l'apartat (per exemple, DAD-1.5). Les referències `fitxer:línia` són del commit `e53c589` i es poden haver mogut.

Data: 26-10-2026. Abast: el repositori `/home/claude/quivoto` (últim commit del 31-08-2026) i la web en directe (fitxa de Sabadell i `/observatori/dades/`, consultades amb WebFetch). Només és una anàlisi: no s'ha modificat res.

Format de cada troballa: **On** (fitxer:línia) · **Problema** · **Impacte** · **Proposta** · **Esforç** (S/M/L) · **Impacte** (alta/mitjana/baixa).

---

## 0. Estat dels tests

- `corepack pnpm install` funciona (6,5 s).
- **`corepack pnpm test` falla abans d'executar res.** `packages/shared-schemas/package.json` té `"test": "vitest run"`. Vitest agafa la configuració de l'arrel (`vitest.config.ts:5`, `include: ["packages/*/src/**/*.test.ts"]`), però amb el directori del paquet com a arrel, i no troba cap test. Amb el primer error, `pnpm -r` s'atura i no arriba a provar el pipeline.
  - Proposta: copiar el patró del pipeline (`vitest run --root ../.. packages/shared-schemas`) o fer que l'arrel faci `vitest run`. Esforç S, impacte alt: avui la CI, si n'hi ha, diria que tot falla.
- Executat des de l'arrel (`npx vitest run`): **2.233 tests passen, 8 se salten i 1 suite falla**. És `publish/dades.test.ts`, que necessita la base PGlite local (`packages/db/.data/quivoto`), una base que no es versiona.
  - Proposta: una fixture petita (5–10 municipis) amb PGlite en memòria, o marcar la suite com a `integration` i saltar-la si la base no hi és. Esforç M, impacte mitjà.
- `package.json:11` defineix `db:reset`, que crida `pnpm --filter @quivoto/db reset`, però `packages/db/package.json` no té cap script `reset`. El comandament està trencat. Esforç S.

---

## 1. Recollida, normalització, versionat i cobertura

### 1.1 La web en producció no surt del repositori
- **On:** a la fitxa en directe de Sabadell hi ha blocs que no són enlloc del codi: «On cau entre els seus», «Quants vehicles hi ha» i «El cens i la participació des del 1979». La pàgina de dades ofereix `fonts.json`, `camps.json` i `manifest.json`. `grep` no troba cap d'aquests elements al repo, i el darrer commit és del 31-08, mentre que les dades de la web són del 2026-09-03.
- **Problema:** hi ha codi publicat que no està versionat (o està en una branca que no s'ha empès).
- **Impacte:** no es pot reproduir ni auditar el que veu el ciutadà, i això trenca el principi «cap xifra sense explicar».
- **Proposta:** empènyer la branca. Cada publicació hauria d'escriure el `git rev-parse HEAD` al `manifest.json` i al peu de la fitxa. Al desplegament, verificar que el commit és a `origin`.
- Esforç S · Impacte **alta**.

### 1.2 No hi ha registre de fonts a la base de dades
- **On:** `packages/db/src/schema/*`. Només hi ha `ingest_runs` (`runs.ts:8`) amb `job` i `summary` jsonb. Les fonts viuen en quatre llocs que no estan sincronitzats:
  - el diccionari `FONTS` de `publish/dades.ts:47-185`;
  - la llista feta a mà de `radiografia.ts:5040-5078`;
  - `adapters/aoc-catalog.json`;
  - les constants de cada job (`socrata.ts:11`, `j22-retribucions.ts:90-114`, etc.).
- **Problema:** la llista «D'on surt tot això» de la fitxa (`radiografia.ts:5040`) es manté a mà i **no cita** la criminalitat (Interior), les retribucions (ISPA, diputacions, consells), la contractació (PSCP), els residus (ARC), el lloguer (fiances), la renda (INE), Wikidata/Commons ni seu-e. La descàrrega sí que en cita algunes.
- **Impacte:** la procedència és incompleta i incoherent entre la fitxa, la descàrrega i la documentació. Algunes llicències (Idescat, INE, Interior) exigeixen una citació que pot quedar fora.
- **Proposta:** una taula `sources` amb `id`, `titol`, `organisme`, `url`, `llicencia`, `citacio_obligatoria`, `cadencia_esperada`, `ultima_actualitzacio_font`, `ultima_consulta` i `hash_contingut`. Una taula `metric_sources (kind → source_id[])`. Que `ingest_runs` porti `source_id`, l'URL efectiva i el hash. La llista de fonts de la fitxa, `ESQUEMA.md` i `fonts.json` s'haurien de generar d'aquesta taula.
- Esforç M · Impacte **alta**.

### 1.3 Les incidències no es tanquen mai i es dupliquen
- **On:** `lib/run.ts:40` fa `insert` a `data_issues` i no hi ha cap `delete` ni cap `update resolved` a cap lloc del codi (confirmat amb grep). `radiografia.ts:4768` mostra les incidències obertes.
- **Problema:** cada reingesta torna a inserir les mateixes incidències, i les ja corregides queden obertes per sempre. A més, `data_issues` no té `run_id`. La fitxa pot repetir la mateixa frase d'avís dues o tres vegades i mostrar errors que ja estan resolts.
- A més, el comentari de l'esquema (`territory.ts:79`: «cap dada entra al portal públic si té una incidència de gravetat alta oberta») **no s'aplica enlloc**: no hi ha cap porta a `publish`.
- **Proposta:** afegir `run_id` i `source_id`. En començar un job, marcar com a `superseded` les incidències del mateix `job+kind`. A la fitxa, deduplicar per `kind`. Implementar la porta: una incidència `alta` en un bloc amaga aquest bloc amb un avís, no tota la fitxa.
- Esforç M · Impacte **alta**.

### 1.4 Les mètriques es sobreescriuen sense historial
- **On:** `territory.ts:67-77`. `municipality_metrics` té una clau única `(municipality_id, kind)` i fa upsert.
- **Problema:** no queda cap traça del valor que es va publicar ahir. Si una font corregeix una dada, o si un canvi de fórmula mou un percentil, no es pot dir «abans dèiem X». METODOLOGIA promet un registre públic `/canvis`, i això és la seva base.
- **Proposta:** afegir `version`/`run_id` i conservar les N darreres versions, o escriure en cada publicació un snapshot `dades/arxiu/AAAA-MM-DD/catalunya.json` amb un diff automàtic de les xifres que es mouen més d'un llindar. Aquest diff alimentaria `/canvis`.
- Esforç M · Impacte mitjana-alta.

### 1.5 Anys i mandats escrits a mà en una dotzena de fitxers
- **On:**
  - `j6-finances.ts:77` (`TO_YEAR = 2025`);
  - `j18-poblacio.ts:154-227` (`SERIE_CENS` fins al 2025, `SERIE_PADRO` fins al 2025, `SERIE_CERA` fins al 2026, `ANY_CREUAMENT = 2025`);
  - `j8-diners.ts:104-106`, `j9:70`, `j15:68-75`, `j19:48-60`, `j23:275-282`, `j29:104-110`, `j14:124-127`;
  - `j27:99` (`ELECCIO = "M20231"`), `j28:119` (`TERME_ACTUAL`);
  - `radiografia.ts:852` (`ELECTIONS = ["M20231","M20191","M20151"]`);
  - `j22-retribucions.ts:104` (URL de l'ISPA **2025**).
- **Problema:**
  - El 2027 arriba una liquidació nova (2026) que no s'ingerirà sense tocar codi.
  - El 23-M de 2027 canvien el mandat, l'elecció i el ple, i caldrà editar uns 15 fitxers a mà en ple pic de trànsit.
  - L'ISPA 2026 tindrà una altra URL.
- **Proposta:** un mòdul `config/calendari.ts` amb `MANDAT_ACTUAL`, `MANDAT_ANTERIOR`, `ELECCIONS` i `ANY_DARRERA_LIQUIDACIO`, aquest darrer calculat consultant `MAX(ANY_EXERCICI)` a la font. Els jobs haurien de descobrir l'últim any disponible (`SELECT MAX`) en comptes de tenir-lo fixat. Per a l'ISPA, descobrir l'URL des de la pàgina índex. Afegir un test que falli si l'any en curs supera un límit escrit a mà.
- Esforç M · Impacte **alta** (és la bomba del maig del 2027).

### 1.6 Un buit pot acabar convertit en zero
- **On:** `j6-finances.ts:86-89`. `num()` fa `Number(value)` i, si no és finit, retorna 0. `Number(null)` dona 0. A `j6:186` es fa `debt = num(row.DEUTE_VIU)`, i els acumuladors de capítols comencen a 0 (`j6:150-175`).
- **Problema:** un `DEUTE_VIU` nul a l'origen es desa com a deute 0 i no com a «sense dada», i un any sense liquidació queda amb ingressos a 0. Contradiu el principi del README («mai una estimació») i el criteri 6 de FONTS-PERSONES. Hi ha 400 municipis amb deute 0 de veritat: el 0 fals no s'hi distingiria.
- **Proposta:** `numOrNull()` per a `debt`, `population` i `paymentDays`, i desar `null`. Marcar els anys sense cap fila de liquidació (`hasLiquidacio=false`). Afegir un test amb una fila nul·la.
- Esforç S · Impacte mitjana.

### 1.7 No s'escriu cap cadència d'actualització ni s'avisa quan una font queda vella
- **On:** no existeix. `report.ts` només compta municipis, actes i incidències, i el peu de la fitxa només dona la data de generació.
- **Problema:** les fonts tenen ritmes molt diferents: el padró i la renda (INE) un cop l'any, el PMP cada mes, l'Interior cada trimestre, la liquidació amb 1–2 anys de retard. Ningú no sap quina dada ha quedat vella. El README diu que J11, J12, J13, J14, J19 i J25–J28 «van a mà», però no diu quan.
- **Proposta:**
  - Afegir `cadencia_esperada` al registre de fonts (1.2).
  - Fer un `report frescor` que marqui les fonts amb `ultima_consulta > cadència × 1,5`.
  - Mostrar a cada bloc de la fitxa un segell «dada de 2025 · consultada el 03-09-2026» (la web en directe ja ho fa en alguns blocs: cal fer-ho a tots).
  - Fer un calendari d'ingesta (cron o GitHub Actions): un job setmanal per a les fonts a granel i un de mensual o manual per a les que van fitxa a fitxa.
- Esforç M · Impacte **alta**.

### 1.8 No es mesura la cobertura camp a camp
- **On:** `report.ts:24-37` (només cobertura d'actes). `dades.ts:1012-1016` compta, per bloc, els municipis amb «almenys un indicador», però no per camp. El prototip `design/prototip/radiografia.html`, a la secció `#t-cobertura`, sí que té una taula de cobertura per conjunt (Complet / Parcial / Inicial / Gairebé res / No ho tenim) i la llista «Què no et podem dir». La producció no l'ha implementada. A la web en directe ni tan sols surt la secció «Què en sabem» (l'índex hi enllaça, però el WebFetch no la troba).
- **Proposta:** generar `cobertura.json` amb una fila per `(camp, municipi)`: `present`, `any`, `font`, `motiu_absencia`. A la fitxa, una matriu compacta de 10–12 files (una per bloc) amb l'estat i l'any, com al prototip. A la pàgina de dades, un mapa de calor camp × tram de població.
- Esforç M · Impacte **alta**: és el que diu el README com a prioritat («mesurar cobertura camp a camp»).

### 1.9 Adaptadors fràgils (scraping HTML/PDF)
- **On:** `adapters/portals-municipals.ts` (portals propis de 7 ciutats), `seue.ts`, `barcelona.ts`, `fotos-ciutats.ts`, `j24-diputacions.ts:138-201` (pàgines HTML de diputacions i AMB), `j30-sous-consells.ts` (37 seus), `j14-electes-cost.ts`, `j19-preus.ts:427` (Idescat amb `f=ssv` municipi a municipi) i `posicions.ts` (regex sobre text lliure; vegeu 4.3).
- **Problema:** depenen de l'HTML de tercers. Els tests fan servir fixtures congelades (`__fixtures__`) i, quan l'estructura canvia, la ingesta pot donar 0 files sense fallar.
- **Proposta:**
  - Un «canari» per adaptador: un nombre mínim de files esperat, i el job falla, no només registra una incidència, si en surten menys del 80 % de l'última execució.
  - Desar la resposta crua (hash i mida) per poder fer un diff.
  - Classificar els adaptadors per fragilitat a la documentació (API estable / CSV estable / HTML / PDF).
- Esforç M · Impacte mitjana.

### 1.10 `http.ts`: branca morta i reintents
- **On:** `lib/http.ts:43-49`. Les dues branques del `if` llancen el mateix error. No es respecta `Retry-After` ni hi ha *jitter*.
- **Proposta:** netejar-ho, fer cas de `Retry-After` als 429 i afegir un *jitter* aleatori. Esforç S · Impacte baixa.

### 1.11 La documentació ha quedat enrere de la realitat
- **On:**
  - `docs/METODOLOGIA.md:13-18` i `:192-195` diuen que «al web només hi ha la pàgina de properament» i que no s'ha llegit cap acta. `PLA-DADES` i J12 diuen el contrari.
  - METODOLOGIA diu 25.902 actes a 855 municipis; `FONTS-AOC.md` en diu 142.067 a 939.
  - METODOLOGIA (taula d'estat) diu que la llicència de les nostres dades és «decisió oberta», però `dades.ts` publica CC BY 4.0 i el README diu «citant quivoto».
  - `FONTS-AOC.md` (Fase 2) inclou el cost efectiu, que `PLA-DADES-2027.md` dona per retirat.
- **Impacte:** són els documents que llegirà un periodista o un partit per atacar la credibilitat del projecte.
- **Proposta:** una passada de sincronització, amb una capçalera «Estat a» generada (data i commit) i un test que comprovi que les xifres clau dels documents coincideixen amb `report`.
- Esforç S-M · Impacte mitjana-alta.

### 1.12 Grups de comparació només per població
- **On:** `derive/peers.ts:33-60` (trams LOREG, `MIN_GROUP = 12`).
- **Problema:**
  - **Salts de tram:** 1.000 i 1.001 habitants cauen a grups diferents.
  - **El tram de més de 100.000 barreja Barcelona** amb Girona i Mataró.
  - **La població no ho explica tot:** municipis turístics (Salou, Lloret, Sitges), capitals de comarca, municipis de l'AMB, i renda.
  - **Una etiqueta no és un poble:** «els 24 municipis de més de 50.000» diu menys a un ciutadà que «Terrassa, Badalona, Mataró…».
- **Proposta:**
  - Afegir «**municipis semblants**»: k veïns més propers (k = 10) sobre població (en log), densitat, renda per persona (INE ADRH, ja ingerida), places turístiques per habitant (Idescat) i si és capital de comarca. Mostrar-ne els **noms**.
  - Mantenir el tram LOREG com a criteri oficial i auditable, i afegir-hi «semblants» com a segona lectura.
  - Treure Barcelona de qualsevol percentil (n = 1) i comparar-la amb Madrid, València, etc., o no comparar-la.
- Esforç M-L · Impacte **alta**: és la petició explícita de «comparacions amb municipis semblants».

### 1.13 Fonts noves recomanades (filtre: ≥ 800 municipis, sèrie temporal, atribuïble al ple, i que respongui una de les 3 preguntes de `PLA-DADES-2027.md`)

| Font (cal verificar-ne l'id) | Pregunta | Per què | Esforç |
|---|---|---|---|
| **Pressupost aprovat 2026 i 2027** (AOC, formulari normalitzat de pressupostos; complementa la liquidació, que porta 1–2 anys de retard) | 2 | És el que decideix el govern que es presenta: comparar pressupost amb liquidació (execució real) | M |
| **Atur registrat per municipi, mensual** (Departament d'Empresa i Treball / Observatori del Treball, dades obertes) | 1 | Context socioeconòmic amb sèrie mensual a 947 municipis | S |
| **Habitatges d'ús turístic** (Registre de Turisme de Catalunya, dades obertes) i places d'allotjament (Idescat) | 1-2 | Habitatge és el 3r tema més freqüent a les afirmacions (90). També corregeix el «per habitant» als municipis turístics | S-M |
| **Habitatges iniciats i acabats** (Idescat, a partir de dades del col·legi d'aparelladors / Agència de l'Habitatge) | 1-2 | El ple decideix el planejament | S |
| **Convenis** (AOC `8747a24f`, 919 municipis) i **convocatòries de personal** (AOC `0e11c4f5`, 928) | 2 | Ja són al catàleg i no s'exploten: activitat de govern per mandat | M |
| **Resultats d'altres eleccions per municipi** (Parlament 2024, Congrés 2023, Europees 2024; Generalitat `ntc4-rnwr` ja els porta) | 1 | «Vot dual»: on el vot local difereix del nacional, que és un indicador fort de llistes locals | S |
| **Subvencions rebudes i atorgades** (BDNS / RAISC) | 2 | Contractació i subvencions són a la prioritat del README | M |
| **Seguretat per a municipis de menys de 20.000 habitants** (Mossos; l'Idescat té l'operació «Estadística de seguretat ciutadana» però cal confirmar si la granularitat és municipal o només ABP) | 2 | Avui 877 dels 947 no tenen dada de criminalitat (`radiografia.ts:5161`) | M (cal verificar) |
| **Qualitat de l'aire / ZBE** (XVPCA) i **autoconsum i PAESC** (ICAEN) | 2 | Mobilitat és el tema més freqüent a les afirmacions (92) | M |
| **Sindicatura de Comptes** (`846d700b`) | 2 | Està descartada per llicència: cal escriure a la Sindicatura per aclarir-la | S (gestió) |

Abans d'entrar, cada font ha de passar els criteris de `FONTS-PERSONES.md` (URL estable, llicència, data, clau, tests amb absències).

---

## 2. Presentació: gràfics, escales, comparacions i ordre

### 2.1 La mateixa barra vol dir quatre coses diferents a l'«ullada»
- **On:** `radiografia.ts:4243-4400` (`renderUllada`):
  - **gasta:** `part = valor / (2 × mediana)` (`:4268`);
  - **deute:** percentil, on més llarg vol dir *més deute*, és a dir, pitjor (`:4291`);
  - **IBI i aigua:** percentil (`:4316`, `:4329`);
  - **participació:** percentatge cru (`:4347`).
- També `renderComQueda` (`:4196-4200`) gira el percentil perquè més llarg vulgui dir *millor*.
- **Problema:** amb una forma idèntica, el lector no pot saber si la barra plena és bona, dolenta, gran o petita.
- **Impacte:** és la primera peça que veu el ciutadà, i és la que menys es pot llegir.
- **Proposta:** un sol component, el «regle de grup»: mínim–màxim del grup, una marca a la mediana i un punt per al municipi. La web en directe el fa servir a «On cau entre els seus». A l'ullada, o es fa servir aquest regle a totes les pastilles, o no es posa cap barra i es deixa la frase. Mai una polaritat implícita.
- Esforç S-M · Impacte **alta**.

### 2.2 Verd i vermell = «millor» i «pitjor», contra el principi de no fer veredictes
- **On:**
  - `estil.ts:796-799` (`.balanc tr.millor .canvi` en verd, `pitjor` en coral);
  - `estil.ts:1008-1009` (`posicio-dalt` en menta, `posicio-baix` en coral);
  - `estil.ts:1098-1103` (`mandat li.millora` en verd);
  - els textos «millor que el X %» i «Destaca en N i va endarrerit en M» (`radiografia.ts:4201`, `:4210-4213`).
- **Problema:** `PLA-DADES-2027.md` diu «Cap veredicte de gestió», i METODOLOGIA diu que acord i desacord no seran verd i vermell (pel daltonisme i perquè són colors de partit). La lletra petita diu «no vol dir bé o malament», però el color sí que ho diu. A més, «millor» en personal/ingressos o en execució d'inversions és discutible.
- **Proposta:** colors neutres per a la direcció (amunt/avall, una tinta sola i la fletxa), i paraules descriptives («més deute que 7 de cada 10»). Si es vol polaritat, que sigui només on hi ha un llindar legal (PMP > 30 dies, estalvi net < 0, deute > 110 %), amb una icona d'avís i la norma citada.
- Esforç S · Impacte **alta** (és un risc reputacional per neutralitat).

### 2.3 Les taules accessibles només les poden llegir els lectors de pantalla
- **On:** `grafics.ts:244`, `:392`, `:605` (`<div class="nomes-lectors"><table>`) i `radiografia.ts:1063`.
- **Problema:** la taula equivalent existeix, però una persona que hi veu no la pot obrir. La gent que vol les xifres exactes, o periodistes que volen copiar-les, ha d'anar al CSV.
- **Proposta:** un `<details><summary>Veure les dades</summary>` visible sota cada gràfic, amb la mateixa taula, i un enllaç «descarrega aquesta sèrie» (un CSV per gràfic o una àncora al JSON del municipi).
- Esforç S · Impacte mitjana.

### 2.4 Hi ha gràfics fets amb CSS sense taula equivalent
- **On:**
  - la història per famílies (`radiografia.ts:1388-1440`) només té un `aria-label` llarg a una `<ul role="img">`, sense taula;
  - les barres de `com-queda` (`:4198`) i les de l'ullada (`:4391`);
  - `moneyRow` (`:1449`).
  - La web en directe confirma que «On cau entre els seus» no té taula.
- **Proposta:** aplicar la regla 1 de `grafics.ts` («si no es pot escriure en una taula…») a tots els gràfics. Migrar la història per famílies a `grafics.ts` com a barres apilades SVG amb taula.
- Esforç M · Impacte mitjana.

### 2.5 Paletes de partit duplicades i massa properes
- **On:** `radiografia.ts:1373-1377` (`FAMILY_COLORS`) contra `shared-schemas/src/brands.ts:38-55`.
- **Problema:**
  - La CUP és `#d8d000` en un lloc i `#ffff00` a l'altre.
  - PP `#234b90`, CiU `#18307b` i Aliança `#1d3f6e` són tres blaus foscos que no es distingeixen.
  - ERC `#ffb232` i CUP són molt propers.
  - Junts `#00c3b2` i Vox `#00c118` es confonen amb deuteranopia.
- **Proposta:** una sola font de color (`brands.ts`). Una prova automàtica de distància CIEDE2000 entre les marques que poden coincidir al mateix ple, i afegir-hi trama, contorn o etiqueta directa quan no arribin al llindar. Etiquetar directament els trams (ja es fa a partir del 12–14 %).
- Esforç S-M · Impacte mitjana.

### 2.6 Xifres i textos escrits a mà dins de la fitxa
- **On:**
  - `radiografia.ts:4987-4999`: «Són 112 dels 947, i entre ells hi ha ciutats grans com Badalona», escrit dues vegades;
  - el comptador «877 municipis» a `:5161`;
  - les dates de verificació a les capçaleres dels documents.
- **Problema:** `dades.ts:1010` ja diu: «una xifra escrita a mà a la documentació és una xifra que demà serà mentida». La fitxa no aplica aquesta mateixa regla.
- **Proposta:** calcular-les a `publish` (un comptador global que es passa a cada fitxa).
- Esforç S · Impacte mitjana.

### 2.7 Format de signes i unitats
- **On:** la web en directe mostra «Estalvi net: **-0,0 %**». `formatValue` (`radiografia.ts:1188`) fa `toFixed(1)` sense normalitzar el −0.
- **Proposta:** un helper `fmt` comú (`Intl.NumberFormat('ca')` amb `signDisplay` i el −0 normalitzat) que facin servir `radiografia.ts`, `dades.ts`, `grafics.ts` i `criminalitat.ts`. Avui n'hi ha almenys quatre (`formatValue`, `formatUnit`, `punts`, `number`/`decimal`).
- Esforç S · Impacte baixa.

### 2.8 Comparacions sense euros ni sèrie
- **On:** `renderComQueda` (`radiografia.ts:4176`), percentils sols. `PLA-DADES-2027.md` (Bloc 2) ja ho demana: «la diferència en euros del pressupost sencer al costat del percentil».
- **Proposta:**
  - A cada fila del regle de grup, escriure «X € per habitant per sobre de la mediana = Y M€ l'any».
  - Per a cada indicador financer, una *espurna* (ja existeix a `grafics.ts`, mida `espurna`) de la sèrie 2015–2025 amb la banda del grup.
- Esforç S-M · Impacte **alta**.

### 2.9 Massa blocs i un ordre que no respon les tres preguntes
La fitxa té 15 seccions i, segons el codi mateix (`radiografia.ts:4223`), «28.000 píxels i 5.700 paraules». A la web hi ha almenys 17 blocs (els de vehicles i cens s'hi han afegit). El context del poble («Qui hi viu») va a la posició 13, i «Dones i homes» a la 14.

**Ordre proposat** (seguint les 3 preguntes de `PLA-DADES-2027.md`, «una frase abans que un gràfic» i el prototip):

0. **Capçalera.**
   - Nom, comarca, habitants, regidories i escut.
   - **Frase resum** (`summarySentence`).
   - Targeta de l'alcaldia.
   - Mapa petit, plegable al mòbil.
1. **El 23-M en quatre xifres** (`renderJoc`): regidories, majoria, qui les té i canvis de mans, amb el botó de la brúixola. Es manté a dalt.
2. **«On cau entre els seus»** com a únic resum numèric, en lloc de l'ullada actual. Són 6–8 regles de grup amb el mateix component (2.1), i a sota la llista amb noms de «municipis semblants» (1.12). **Es treu l'ullada de 5 pastilles**: repeteix el mateix amb una altra forma.
3. **Qui mana** (pregunta 3):
   - el ple (hemicicle);
   - qui hi seu;
   - quant fa que mana el mateix;
   - les alcaldies des del 1979, en un desplegable.
4. **Què ha fet aquest govern** (pregunta 2), agrupat en un sol bloc amb pestanyes o subtítols:
   - a) **Els comptes**: balanç del mandat i deute any a any (amb banda del grup);
   - b) **Els diners**: quant, d'on, on van, i la diferència en € (2.8);
   - c) **Què paga la gent**: IBI, aigua i tipus;
   - d) **Què contracta**;
   - e) **Què ha votat el ple** (mocions, quan n'hi hagi).
   - «Com ha anat aquests quatre anys» (`renderMandat`) ha d'anar **dins** de (a)/(b): avui duplica el balanç del mandat.
5. **Serveis i resultats**: escombraries, seguretat i vehicles, en targetes compactes amb la xifra, el grup i la font. Si la seguretat no té dada (877 municipis), **una línia** i no un bloc.
6. **Què costa el govern** (sous): rere els comptes i separat, perquè té regles pròpies d'exculpació.
7. **Qui hi viu**: es pot moure a la posició 2-bis com a context breu, amb 3 xifres (edat, origen, renda). La resta, plegada.
8. **Com vota el poble**:
   - elecció a elecció (famílies des del 1979);
   - participació i cens;
   - dones i homes.
   - Són tres blocs de la mateixa naturalesa, que s'han de fusionar en un.
9. **Què en sabem i què no**: matriu de cobertura com al prototip (1.8), incidències deduplicades i l'enllaç CSV/JSON.
10. **Fonts**: generades del registre (1.2).

**Què es treu o es plega:** l'ullada de 5 pastilles (substituïda per 2), la línia de transparència «X % dels apartats» (va a 9), l'històric de vehicles per tipus (es deixa la xifra per 1.000 habitants i el detall en un desplegable) i la lletra petita repetida sobre el grup de comparació (s'explica un cop al punt 2 i després es fa servir com a clau).

**Què s'agrupa:**
- comptes + diners + mandat → «Què ha fet amb els diners»;
- participació + cens + paritat + història → «Com vota aquest poble».

En total, de 15–17 blocs a 9.

Esforç M · Impacte **alta**.

### 2.10 Coherència amb `design/`
- `MOVIMENT.md` exigeix que les barres s'animin amb `scaleX`. A la fitxa les barres fan servir `--w` amb `width` (`estil.ts` / `radiografia.ts:1089`): cal comprovar que no hi ha cap `transition: width` (hi ha `.ullada .xifra{transition…}` a `estil.ts:335`).
- `MOVIMENT.md` també diu que «les barres sempre porten el número escrit al costat», i això no es compleix a la barra de l'ullada ni a `com-queda`, que no escriu el valor del municipi, només el percentil.
- El prototip (`radiografia.html`) fa servir **cintes de marca entre eleccions** (escons 2015→2019→2023), més llegibles que les tres barres apilades de `renderSeries`. Recomanació: adoptar la cinta, *slopegraph*, per a «elecció a elecció».
- Esforç S-M · Impacte mitjana.

---

## 3. Dades descarregables

### 3.1 La descàrrega no és el mateix que mostra la fitxa
- **On:** `dades.ts:738` filtra `deute_habitant_serie` a `>= 2015`, però la fitxa dibuixa la sèrie des del 2010 (`radiografia.ts:1321-1345`, «tota la sèrie que la font dona»). Contradiu la regla de `dades.ts:17-20`.
- **Proposta:** treure el filtre i afegir un test de paritat entre fitxa i descàrrega (que les claus i els anys de les sèries coincideixin).
- Esforç S · Impacte mitjana.

### 3.2 El cost efectiu retirat es publica sense avís
- **On:** `dades.ts:373-390` (el bloc «Què costa cada servei»). La nota diu «Cost efectiu calculat amb el mateix criteri… per a tots els ajuntaments». En canvi, `radiografia.ts:1745-1754` i `PLA-DADES-2027.md` el donen per retirat perquè **no és comparable** («el percentil 90 és 507 vegades el percentil 10»), i diuen que es publica «amb l'avís». L'avís no hi és.
- **Proposta:** posar l'avís literal a `nota` i a cada `descripcio`, o treure'l de `catalunya.csv` i deixar-lo només al JSON del municipi com a `experimental`.
- Esforç S · Impacte mitjana-alta.

### 3.3 No hi ha esquema llegible per màquina ni arxiu de versions al repo
- **On:** al repo, `ESQUEMA.md` en Markdown (`dades.ts:1005-1200`). La web en directe ja té `camps.json`, `fonts.json` i `manifest.json`, però no es generen des del repo (1.1). Tampoc no hi ha versions arxivades: el contingut es sobreescriu.
- **Proposta:**
  - **Frictionless Data Package** (`datapackage.json`) amb un `schema` per fitxer (tipus, unitat, `missingValues`) i `licenses` per recurs.
  - Snapshots datats (`dades/2026-09-03/`) amb `SHA256SUMS`, i un `CHANGELOG` de claus.
  - Opcional: Parquet per a periodistes de dades.
- Esforç M · Impacte mitjana.

### 3.4 Llicència i citació incoherents
- **On:**
  - `README.md` (al final): «citant quivoto, la font i la data»;
  - `dades.ts:1176`: CC BY 4.0;
  - METODOLOGIA (taula d'estat): «llicència de les nostres dades: decisió oberta»;
  - `LICENSE`: MIT, només per al codi.
- **Proposta:** decidir-ho (CC BY 4.0 té sentit), afegir `LICENSE-DADES` i citar-lo als tres llocs.
- Esforç S · Impacte mitjana.

### 3.5 CSV en format català
- **On:** `dades.ts:940-965` (punt i coma, coma decimal, BOM, CRLF). Està ben pensat per a l'Excel en català, però trenca qualsevol eina per defecte.
- **Proposta:** publicar també `catalunya.intl.csv` (coma, punt decimal, sense BOM) i indicar-ho a la mateixa capçalera de la pàgina.
- Esforç S · Impacte baixa.

### 3.6 Absències: fila absent contra `null`
- **On:** `dades.ts:1067-1070`. Al CSV per municipi, una dada que no hi és queda com a fila absent, sense el motiu.
- **Proposta:** afegir `motiu_absencia` (`font_no_publica`, `no_aplica`, `retirat`, `incidencia`) al JSON. És la mateixa informació que la matriu de cobertura (1.8).
- Esforç S-M · Impacte mitjana.

---

## 4. La brúixola: model de dades i el que falta

### 4.1 Les afirmacions no tenen identificador ni versió
- **On:** `publish/afirmacions/*.json`, 23 fitxers i 561 afirmacions. Els camps són només `tema`, `text`, `context`, `evidencia`, `url_evidencia`, `posicio_govern`, `discrimina` i, de vegades, `districte`. Cap no té `id`, `versio`, `data`, `compartida`, `direccio` ni `aprovat_per`. `equilibri` i `notes` només surten en 6 fitxers, i `codi_ens`/`mandat` en 2.
- **Problema:** `docs/metodologia/01-afirmacions.md` («Versionat: família i versió», «18 + 7», equilibri direccional i govern/oposició) i METODOLOGIA §2 (`approved_by`, confiança) prometen camps que no existeixen. No hi ha cap esquema Zod, tot i que `zod` és dependència de `shared-schemas`.
- **Proposta:** un esquema `Afirmacio` a `shared-schemas` amb:
  - `id` estable (slug-família) i `versio`;
  - `ambit: local|compartida` i `clau_compartida` (per a les 7);
  - `tema` d'un vocabulari tancat;
  - `direccio` (esquerra/dreta/neutra) i `govern_acord`;
  - `evidencies[]` estructurades (4.3);
  - `aprovat_per`, `aprovat_el`, `estat` (`esborrany|validada|retirada`).
  - Validació en un test de CI sobre tots els JSON.
- Esforç M · Impacte **alta**.

### 4.2 Temes sense normalitzar
- **On:** comptatge sobre els JSON: `educació`/`educacio` (12/6), `comerç`/`comerc` (9/5), `esports`/`esport` (7/5), `participació`/`participacio` (3/3), `residus` i `residus i medi ambient`, i més de 40 valors diferents.
- **Impacte:** el desempat per temes de `matching.ts` (`statementThemes`) i qualsevol comparació entre municipis fallen.
- **Proposta:** un vocabulari de 12–15 temes alineat amb les icones de `icones.ts` i les àrees de despesa, i una migració.
- Esforç S · Impacte mitjana.

### 4.3 Les posicions es dedueixen amb regex sobre text lliure
- **On:** `publish/posicions.ts:80-` (`recompteDe`, que llegeix «17 vots a favor (PP) i 9 en contra» de l'`evidencia`).
- **Problema:** el vot no és una dada, és prosa. Qualsevol reescriptura editorial de l'evidència pot canviar la posició d'un partit. No hi ha taula `votacions` (data, òrgan, punt, recompte per grup, pàgina de l'acta, cita literal).
- **Proposta:** un model `Votacio {id, municipi, data, organ, punt, url_acta, pagina, cita, recompte_per_grup[]}` emmagatzemat a la base, i `Afirmacio.evidencies[] = {votacio_id, relacio: "si_es_acord"|"si_es_desacord"}`. Les posicions passen a ser un derivat reproduïble amb `base` i `confiança`. El verificador de cites (PLA §2) ha de comprovar `cita` contra el PDF desat (hash).
- Esforç L · Impacte **alta**.

### 4.4 El càlcul del navegador no és el que està provat
- **On:** `publish/prova.ts:353-369` (`coincidencia`) contra `shared-schemas/src/matching.ts`.
- **Problema:** la versió del navegador **no** aplica:
  - el llindar de cobertura del 70 % (fa servir `MINIM = 5`);
  - la penalització `no_position`;
  - els pesos de prioritat del partit;
  - els desempats (`sortMatches`);
  - `tiedLeaders` i `needsShootOut`.
- Els 14 tests de `matching.ts` proven un codi que l'usuari no executa. METODOLOGIA §4 afirma que «tot això és el que fa el codi avui».
- **Proposta:** empaquetar `matching.ts` (esbuild, d'uns 3 kB) i injectar-lo a la pàgina de la prova, o generar-lo des del mateix fitxer. Afegir un test que comprovi que el codi incrustat és el mateix (hash).
- Esforç S-M · Impacte **alta**.

### 4.5 Les respostes es desen per posició
- **On:** `prova.ts:342` i `:373-397`. `respostes[i]` es desa a `localStorage` amb la clau `quivoto-prova-<slug>`.
- **Problema:** si s'edita, es retira o es reordena una afirmació, les respostes desades queden assignades a una altra pregunta, en silenci.
- **Proposta:** desar per `id` d'afirmació (4.1) i `versio`, i descartar les respostes de versions incompatibles.
- Esforç S · Impacte mitjana-alta.

### 4.6 L'escala és en realitat binària
- **On:** `posicions.ts` (`valor: -2 | 2 | null`).
- **Problema:** els grups només poden ser −2 o +2, i la persona respon en 5 punts. Un «més aviat d'acord» (+1) contra +2 dona 3/4, i contra −2 dona 1/4. Mai no hi ha empat al mig: el percentatge s'infla cap als extrems.
- **Proposta:** documentar-ho a la pàgina de resultats. Quan arribin les respostes de les candidatures (abril del 2027), permetre ±1. Valorar fer un càlcul «d'acord/desacord» binari mentre només hi hagi vots.
- Esforç S · Impacte mitjana.

### 4.7 El que falta per a una brúixola municipal completa
1. **Afirmacions compartides (7)** amb una espina comuna entre municipis (PLA, Bloc 3). Avui no hi ha `ambit` i les afirmacions no es poden comparar entre pobles.
2. **Les candidatures del 2027 com a subjecte** (la candidatura local, i no el grup municipal): `candidatures.status = announced|proclaimed` ja existeix a `people.ts:44`, però no hi ha `Subject` per a la candidatura.
3. **El qüestionari a partits**, amb resposta, data, prioritats (màxim 5) i rèplica: falten les taules `respostes_candidatura` i `repliques`.
4. **Les dues columnes, «el que diuen» i «el que han fet»**: un model que guardi les dues posicions per a cada afirmació i candidatura.
5. **Programes del 2023 i del 2027** com a evidència (el llindar de 5 afirmacions amb cita de programa no el compleix cap conjunt).
6. **Cobertura de la brúixola per municipi**: la llista promesa a METODOLOGIA (completa / només compartides / només radiografia) no està generada.
7. **Registre de correccions `/canvis`** amb RSS, que depèn de 1.4.
8. **Enllaç per compartir** (`?r=`) i el seu avís de privadesa: està descrit però no implementat a `prova.ts`.

Esforç L · Impacte **alta**.

---

## 5. Top 10 prioritzat

| # | Acció | Ref. | Esforç | Impacte |
|---|---|---|---|---|
| 1 | Versionar el que hi ha en producció: empènyer la branca i posar el commit al `manifest.json` i al peu | 1.1 | S | alta |
| 2 | Arreglar `pnpm test` (shared-schemas) i fer hermètica `dades.test.ts`; reparar `db:reset` | 0 | S | alta |
| 3 | Fer servir `matching.ts` real al navegador, amb les respostes desades per `id` d'afirmació | 4.4, 4.5 | S-M | alta |
| 4 | Treure el verd/vermell de «millor/pitjor» i fer servir un sol «regle de grup» per a totes les comparacions | 2.1, 2.2 | S-M | alta |
| 5 | Centralitzar el calendari (mandats, eleccions, darrer exercici) abans del maig del 2027 | 1.5 | M | alta |
| 6 | Registre de fonts a la base i incidències amb `run_id`, que es tanquin i es dedupliquin; aplicar la porta de gravetat alta | 1.2, 1.3 | M | alta |
| 7 | Reordenar la fitxa de 15–17 blocs a 9, seguint les 3 preguntes | 2.9 | M | alta |
| 8 | Esquema Zod de les afirmacions (id, versió, àmbit, tema tancat) i votacions estructurades en lloc de regex | 4.1–4.3 | M-L | alta |
| 9 | Matriu de cobertura camp × municipi, cadència i frescor de cada font, i segell d'any a cada bloc | 1.7, 1.8 | M | alta |
| 10 | «Municipis semblants» amb noms, diferència en € i espurnes de sèrie a les comparacions | 1.12, 2.8 | M | alta |

Cal fer-ho tot just després de les correccions S: el cost efectiu sense avís (3.2), el buit convertit en zero a les finances (1.6), la sèrie del deute retallada a la descàrrega (3.1), el «−0,0 %» (2.7), les xifres escrites a mà (2.6) i la llicència de les dades (3.4).
