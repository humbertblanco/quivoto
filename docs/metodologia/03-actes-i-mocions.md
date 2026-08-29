# El registre de mocions: com llegirem 25.902 actes

> **Estat a 29 d'agost de 2026.** Aquest document descriu el mètode que aplicarem per
> convertir les actes dels plens en dades. D'això, avui està implementat: **el recompte de
> cobertura d'actes** del feed obert del Consorci AOC (25.902 actes, 855 municipis dels 947),
> desat municipi a municipi amb la data de l'última acta, i l'avís automàtic quan un municipi
> de més de 20.000 habitants no té cap acta al feed — `packages/pipeline/src/adapters/aoc.ts`
> (`minutesCoverage`) i `packages/pipeline/src/jobs/j1-territory.ts`.
> **Cap acta no s'ha descarregat ni llegit mai.** No hi ha descàrrega de PDFs, ni OCR, ni
> segmentació, ni cap crida a cap model de llenguatge, ni cap taula de mocions, punts, vots o
> cites a la base de dades. Tota la resta d'aquest document és compromís, no descripció. Ho
> marquem secció a secció.

Quan un partit diu què faria, ho podrem contrastar amb el que ha fet. Aquesta pàgina
explica com convertirem les actes dels plens municipals —PDFs escampats per 947 seus
electròniques— en una base de dades de punts de l'ordre del dia, resultats i vots per
grup. És la peça que ha d'alimentar la [comparació entre el que diuen i el que fan](02-posicions.md)
i donar matèria primera a [les afirmacions del test](01-afirmacions.md).

No és un procés màgic. Fallarà sovint, i la part més important d'aquest document és la
darrera secció.

## La font: el feed obert del Consorci AOC

> ✅ **Implementat.** L'índex i el recompte de cobertura: `packages/pipeline/src/adapters/aoc.ts`
> (`minutesCoverage`, una sola consulta SQL contra el CKAN de l'AOC) i
> `packages/pipeline/src/jobs/j1-territory.ts`, que desa `minutes_count` i
> `minutes_last_date` a cada municipi. Els trams de la taula de sota surten de
> `packages/pipeline/src/report.ts`. Del feed només en llegim l'índex: cap PDF descarregat.

El Consorci AOC —l'Administració Oberta de Catalunya, el consorci públic que dona serveis
digitals als ens locals catalans— publica un dataset obert amb l'índex de les actes que els
ajuntaments pengen a la seva seu electrònica (recurs `b5d370d0-7916-48b6-8a69-3c7fa62a1467`).

| Camp | Contingut |
|---|---|
| `CODI_ENS` / `NOM_ENS` | Ajuntament (codi de 10 dígits; `INE5 = codi_ens[0:5]`) |
| `DATA_ACORD` | Data de la sessió |
| `TIPUS` | Ordinària · Extraordinària · Urgent |
| `CODI_ACTA` | Identificador de l'acta a la seu |
| `ENLLAÇ_ACTA` | URL del PDF a `media.seu-e.cat` |

El feed és **només un índex**: no conté ni el text de l'acta ni cap vot. Tot el que
publiquem sobre què s'ha votat haurà de sortir de llegir el PDF, i això encara no ho fem.

Xifres comptades el 28 d'agost de 2026, des del 17 de juny de 2023 (constitució
dels plens del mandat actual):

| Actes al feed des de juny 2023 | Municipis |
|---|---|
| 20 o més | 646 |
| 10–19 | 150 |
| 1–9 | 59 |
| Cap | 92 |
| **Total amb actes** | **855 de 947** |

En total, **25.902 actes**. Els tres municipis pilot hi són al dia (juliol de 2026):
Girona 307 actes, Reus 244, Sabadell 217. Entre els municipis de més de 20.000 habitants,
només en falten tres: **Terrassa, Sant Adrià de Besòs i Premià de Mar**.

Una advertència sobre aquestes xifres: el recompte inclou **totes** les actes del feed,
de Ple i de Junta de Govern Local barrejades, perquè el feed no les distingeix (vegeu la
secció següent). Com que només les de Ple donen vots atribuïbles a un grup, el nombre
d'actes realment aprofitables per a la brúixola serà sensiblement menor, i no el sabrem
fins que processem els PDFs. «646 municipis amb 20 actes o més» és, doncs, una cota
superior de l'evidència disponible, no una mesura d'on hi haurà brúixola.

## Ple o Junta de Govern: per què només un dels dos dona vots

> ⏳ **Encara no construït.** No hi ha classificació d'òrgan: caldria haver descarregat i
> llegit els PDFs, i no s'ha fet. El desbloqueja la feina de descàrrega i extracció de text
> de la secció següent.

El feed barreja sessions de **Ple** i de **Junta de Govern Local**. El camp `TIPUS` no ho
distingeix: només diu si la sessió era ordinària, extraordinària o urgent. La diferència
és fonamental:

- El **Ple** és l'òrgan on hi ha tots els grups municipals, també l'oposició. És l'únic
  lloc on una moció es vota i on el vot es pot atribuir a un grup. Només d'aquí sortiran
  dades que entrin al càlcul de posicions.
- La **Junta de Govern Local** és l'equip de govern. Els seus acords (contractes,
  subvencions, llicències) tenen valor informatiu propi i els publicarem al registre,
  però **mai** com a vot d'un partit, perquè l'oposició no hi és.

Classificarem cada acta amb dues senyals, per aquest ordre:

1. **Nom del fitxer i metadades del PDF** (`acta_ple_2024_03_21.pdf`, `JGL`, `junta`).
2. **Capçal del document**: la primera pàgina de tota acta diu l'òrgan («Acta de la sessió
   ordinària del Ple de l'Ajuntament de…»). Cerca amb tolerància a accents i a OCR brut.

Si les dues senyals no coincideixen, o si cap no és concloent, l'acta quedarà marcada
`organ = unknown` i **no generarà vots**. Preferim perdre dades abans que atribuir a
l'oposició un acord que no va votar.

## La cadena tècnica

> ⏳ **Encara no construït.** Cap dels sis passos d'aquesta secció existeix al codi.
> `packages/pipeline/src/` conté els adaptadors de dades obertes (`socrata`, `aoc`), les
> feines J1–J5 d'ingesta electoral i els indicadors derivats; no hi ha descàrrega de PDFs,
> ni `content_hash`, ni OCR, ni segmentació, ni cap crida a cap model. El desbloqueja la
> primera feina d'extracció (J6), que encara no està escrita.

```
feed AOC → descàrrega → content_hash → text (pdftotext | OCR) → segmentació per punt
        → extracció amb model → esquema estricte → revisió → registre de mocions
```

**1. Descàrrega.** Un PDF per acta, amb reintents i límit de concurrència per domini.
Guardarem el fitxer original a l'emmagatzematge: si demà millorem l'extracció, no caldrà
tornar a molestar les seus electròniques.

**2. `content_hash`.** Calcularem el SHA-256 del PDF. Les seus reindexen, canvien URLs i
republiquen el mateix document; el hash de contingut evitarà processar dues vegades la
mateixa acta i permetrà detectar quan un ajuntament **substitueix** una acta ja publicada
(mateix `CODI_ACTA`, hash diferent), cosa que obrirà una entrada a la cua de revisió.

**3. Text.** Primer `pdftotext -layout`. Si el resultat té menys de ~200 caràcters per
pàgina, tractarem el PDF com a escanejat i hi passarem **Tesseract amb `cat+spa`** (moltes
actes barregen català i castellà en el mateix document: noms de normativa, transcripcions
d'intervencions). El camp `extraction` de la font guardarà si el text és `native` o `ocr`,
i aquesta etiqueta viatjarà fins a la fitxa pública: una cita que ve d'OCR és menys fiable
i cal poder-ho saber.

**4. Segmentació per punt de l'ordre del dia.** Les actes segueixen una estructura
raonablement estable: una llista de punts numerats, i després el desenvolupament de cada
punt. Tallarem el text amb patrons de capçalera («Punt», «Moció», «Dictamen», «Proposta»,
numeració ordinal, «S'aprova per…») i deixarem fragments de 600 tokens amb 80 de solapament
per no partir una votació pel mig. Cada fragment conservarà l'acta d'origen i el número de
pàgina, perquè tota cita es pugui resseguir fins al PDF.

**5. Extracció.** Un model llegirà els fragments d'una sessió i retornarà l'esquema de sota.
El text de l'acta es tractarà com a **dada no fiable**: si un PDF conté text que sembla una
instrucció, s'ignorarà.

Sobre quin model: el pla inicial preveia fer servir un model petit als municipis petits i un
de gran a les ciutats, per cost. **Ho canviem**, perquè no tenim cap prova que l'encert sigui
equivalent i és justament als municipis petits on les actes són pitjors i on hi ha les
llistes locals. La regla que aplicarem és: **tot allò que generi un vot atribuït a un grup
s'extraurà amb el model gran, sigui quina sigui la mida del municipi**. Fer servir un model
més petit per a la resta (títols, resums, classificació d'òrgan) quedarà condicionat a
superar els mateixos llindars d'acceptació sobre el mateix conjunt d'or, i en publicarem la
comparació abans d'activar-lo. Les comprovacions deterministes i la revisió humana seran
idèntiques en els dos casos. El model i la versió amb què s'ha extret cada ítem quedaran
registrats al costat de l'ítem.

## Què n'extraiem, exactament

> ⏳ **Encara no construït.** No hi ha cap taula de punts, mocions, vots ni cites a
> `packages/db/src/schema/` (avui: territori, eleccions, persones, participació, alcaldies i
> traça d'ingesta). L'esquema de sota és l'especificació de l'extractor, no una descripció
> del que hi ha. El desbloqueja la migració que creï aquestes taules.

L'esquema serà estricte. El model no podrà inventar-se camps ni deixar-los ambigus.

| Camp | Tipus | Regla |
|---|---|---|
| `item_number` | text | Número del punt tal com surt a l'acta |
| `title` | text | Títol literal del punt, sense reescriure |
| `kind` | enum | `motion` · `agreement` · `ordinance` · `budget` · `tax` · `urban_plan` · `other` |
| `summary` | text | 1–3 frases neutres, sense adjectius |
| `proposers` | llista | Grup o grups que ho proposen, amb l'àlies tal com apareix |
| `outcome` | enum | `approved` · `rejected` · `withdrawn` · `left_on_table` · `unanimous` |
| `votes[]` | llista | Per grup: `vote` (sí/no/abstenció/absent) + comptadors `yes`, `no`, `abstain` |
| `evidence_quote` | text | Cita literal de l'acta que sosté el resultat i els vots |
| `confidence` | 0–1 | Confiança de l'extracció d'aquest ítem |

Dues comprovacions deterministes es faran **fora del model**, en codi. Cap de les dues està
escrita encara:

- La suma dels comptadors haurà de quadrar amb els regidors d'aquell mandat: farem servir
  **`council_terms.seats`**, els escons oficials del 2023 que la feina J2 ja té carregats.
  No farem servir `council_seats`, que és una altra cosa: una projecció per al 2027
  calculada amb el padró vigent segons l'article 179 de la LOREG (la llei electoral
  espanyola), i que dona el número equivocat a qualsevol municipi que hagi canviat de tram
  de població des del 2022. Si no quadra, l'ítem baixarà de confiança i anirà a revisió.
- `evidence_quote` haurà d'aparèixer literalment al fragment d'origen (coincidència exacta o
  difusa ≥ 0,92). Les cites que no hi apareguin s'esborraran, i sense cita no hi haurà vot.
  Avui no hi ha cap funció de similitud al repositori: `packages/pipeline/src/lib/text.ts`
  només normalitza noms de municipis i de persones.

La comprovació de coherència d'escons que **sí** que funciona avui és una altra, i val la
pena no confondre-les: el nostre recompte d'Hondt ha de reproduir els escons oficials del
2023 de cada candidatura, i cada discrepància queda desada com a `seats_mismatch` a
`data_issues` (`packages/pipeline/src/jobs/j2-results.ts`, amb els 12 tests de
`packages/shared-schemas/src/seats.test.ts`).

### La regla de l'«aprovat per majoria»

Molt sovint l'acta diu només:

> «Sotmesa la proposta a votació, s'aprova per majoria.»

Això no és un vot per grup. No sabem qui hi va votar a favor ni qui s'hi va abstenir.
En aquest cas guardarem **només l'`outcome`**, cap fila a `votes[]`, i la confiança quedarà
capada a 0,5. Un ítem així apareixerà al registre públic de mocions —és informació real i
útil— però **no generarà cap posició** de cap partit ni entrarà al càlcul de coincidència.

Els casos d'unanimitat sí que són literalment atribuïbles a tothom, perquè l'acta diu
explícitament que hi va votar tot el consistori. Però un vot unànime diu molt poc d'un grup
en concret: molts punts s'aproven per assentiment general —tràmits, condols, adhesions
institucionals, punts ja pactats a la junta de portaveus—, i convertir-ho en una posició de
±2 amb confiança alta per a cada grup del ple és la manera més fàcil d'omplir la fitxa d'un
partit petit amb posicions que no ha defensat mai. Per això la regla que aplicarem és:

- Una posició derivada **només** d'un vot unànime quedarà per sota del llindar de publicació
  si no té una segona base (programa, premsa, proposta pròpia).
- Un vot unànime **no comptarà** per a la cobertura del 70% del
  [càlcul de coincidència](04-coincidencia.md), perquè la unanimitat no serveix per
  classificar una candidatura de la qual, de fet, no se sap res.

## Com mesurem si això funciona

> ⏳ **Encara no construït, i tampoc no s'ha executat.** No hi ha adaptador de Rubí, ni
> conjunt d'or etiquetat, ni cap mesura feta. Tampoc no hi ha cap taula on desar els
> resultats d'una avaluació: l'única taula de traça del repositori és `ingest_runs`
> (`packages/db/src/schema/runs.ts`), amb les feines J1–J5 d'ingesta de dades obertes.
> **Cap de les xifres d'aquesta secció s'ha mesurat.** Les publicarem, amb data i versió de
> model, abans de publicar el primer municipi amb brúixola.

Farem servir dues vares de mesurar, i cap de les dues serà el model jutjant-se a si mateix.

**1. Rubí, veritat de terreny.** L'Ajuntament de Rubí és l'únic de Catalunya que publica
en obert el vot de cada regidor a cada moció, en CSV
(`public_expedients_ple_mocions.csv`: descripció, resultat, partit, assistent, vot
sí/no/abstenció, qui la presenta). Executarem l'extracció sobre les actes de Rubí i la
compararem, ítem a ítem i grup a grup, contra aquest CSV. Serà l'única comprovació que
farem contra dades oficials, no contra el nostre propi criteri. Aquesta comparació **encara
no s'ha executat cap vegada**.

**2. Conjunt d'or etiquetat a mà.** ~100 ítems dels tres pilots (Sabadell, Girona, Reus),
etiquetats per una persona llegint el PDF. Ha de cobrir el que Rubí no cobreix: actes
escanejades, sessions amb molts punts, formats de redacció diferents. Com que els tres
pilots són ciutats, l'ampliarem amb ítems de municipis petits i d'actes escanejades abans
de donar-lo per bo. Avui no n'hi ha cap ítem etiquetat.

Mètriques, que registrarem a cada canvi de model o de prompt:

| Mètrica | Què mesura |
|---|---|
| **Precisió** | Dels vots per grup que publiquem, quants són correctes |
| **Record** | Dels vots que hi ha realment a l'acta, quants n'hem trobat |
| **Taxa d'inversió de signe** | Percentatge de vots on diem «sí» i era «no» (o a l'inrevés) |
| Detecció d'ítems | Punts de l'ordre del dia trobats vs punts reals |
| Encert de `outcome` | Aprovat/rebutjat/retirat correcte |

La inversió de signe serà la mètrica que mani. Un vot que falta és un buit; un vot invertit
és una acusació falsa contra un partit.

**Llindars d'acceptació abans de publicar** — *proposta oberta, no fixada al pla; la
decisió final s'ha de prendre amb les xifres reals de Rubí a la mà*:

| Mètrica | Llindar proposat |
|---|---|
| Inversió de signe | **< 0,5%** — bloquejant |
| Precisió del vot per grup | ≥ 95% |
| Record del vot per grup | ≥ 80% |
| Detecció d'ítems | ≥ 90% |

Que siguin proposta oberta té una conseqüència que ha de quedar escrita: **no publicarem
vots per grup a cap municipi fins que aquests quatre números estiguin fixats en aquest
document i publicats al costat de les xifres mesurades.** Un llindar no fixat és una porta
oberta a publicar amb l'error que surti, i la mètrica que mana és precisament la que el
mateix mètode considera difamatòria.

Si la inversió de signe no baixa del llindar, la conseqüència també està decidida: el
registre de mocions sortirà igualment, però **sense vots per grup**, només amb punts i
resultats. El producte no depèn que això funcioni perfectament.

**Una porta per família de format, no una de sola per a tot Catalunya.** Rubí és un sol
municipi, i mesurar-hi la precisió és mesurar un format d'acta concret d'una secretaria
concreta. Per això el llindar no serà una única porta global: abans d'activar la publicació
de vots per grup en un municipi, exigirem una mostra mínima d'ítems etiquetats a mà de la
seva **família de format d'acta** (agrupades pel proveïdor del gestor documental de la seu
i, quan no es pugui determinar, per comarca). Els municipis la família dels quals no s'hagi
validat mai publicaran punts i resultats, sense vots per grup. La fitxa de cada municipi
dirà si la seva extracció s'ha validat amb mostra pròpia, amb mostra de la seva família, o
encara amb cap de les dues. *Proposta oberta*: quants ítems per família són prou.

## Municipis que necessiten un camí propi

> ⏳ **Encara no construït.** Cap d'aquests adaptadors existeix; l'únic adaptador de fonts
> d'actes escrit és el de l'índex de l'AOC, que només compta. La situació de la columna
> «Situació» sí que està verificada contra el feed.

| Municipi | Situació | Què cal |
|---|---|---|
| Terrassa | No al feed AOC (l'índex s'atura el 2018) | Adaptador del portal municipal |
| Barcelona | Al feed només des del 2018; té «Acords del Plenari» amb vots per grup | Adaptador propi; el pla del projecte anota que el portal bloqueja peticions automàtiques senzilles, però encara no ho hem comprovat nosaltres |
| Sant Adrià de Besòs | Sense actes al feed | Adaptador del portal |
| Premià de Mar | Sense actes al feed | Adaptador del portal |

A part, desenes d'ajuntaments (Gavà, Igualada, Mollet, Vilanova i la Geltrú, Blanes…)
tenen **VideoActa**: el vídeo del ple indexat per punt de l'ordre del dia i signat pel
secretari. La pàgina de sessió incrusta un JSON amb els punts (`topicsInfo`) i les
intervencions per regidor amb el segon d'inici (`interventions`). Això donaria una cosa que
el PDF no dona: **la cita amb marca de temps al vídeo**. És una font de segona onada, no
del primer llançament, perquè afegeix transcripció d'àudio a la cadena.

## Els 92 municipis sense cap acta

> ✅ **La xifra és real** (surt del recompte de cobertura ja implementat). ⏳ **Les decisions
> de sota són compromisos**: ni la brúixola ni la radiografia estan publicades encara.

Són pobles petits. No hi ha manera honesta d'inventar-los un historial de votacions, i no
ho farem. La decisió és:

- Tindran **radiografia** —la fitxa de resultats electorals 2015–2023, composició del ple,
  qui governa contra qui va guanyar, paritat i canvis de grup— com tots els altres. Aquestes
  dades ja estan ingerides.
- **No tindran brúixola basada en trajectòria** —el test que et compara amb cada
  candidatura—, i la pàgina ho dirà amb aquestes paraules: «No hi ha prou evidència pública
  per fer la brúixola aquí».
- Podran accedir a les 7 afirmacions compartides «Catalunya municipal», que no depenen
  d'actes locals, si el municipi arriba a tenir candidatures amb posició declarada.
- *Proposta oberta*: un formulari perquè veïns o el mateix ajuntament ens facin arribar
  les actes, i un avís automàtic si el municipi comença a publicar-les al feed.

Un municipi amb poques actes no quedarà automàticament fora: el que ho decidirà serà una
llista de comprovació de publicació (nombre d'ítems amb vot desglossat, percentatge de
posicions sense dades, taxa de desacord del verificador). **Aquests llindars encara no estan
fixats, i per tant encara no són escrits enlloc.** Quan ho estiguin, aniran a
[la nota sobre neutralitat i dades](05-neutralitat-i-dades.md) i els enllaçarem des d'aquí.

## Límits d'aquest mètode

Coses que sabem que no funcionaran bé, i que cal saber abans de refiar-se de cap xifra que
en surti:

- **La majoria de les actes no desglossen el vot.** L'«aprovat per majoria» és la norma,
  no l'excepció, sobretot als municipis petits. El registre tindrà molts més punts que
  vots atribuïbles.
- **Una acta no és una transcripció.** El secretari resumeix. Un debat de mitja hora pot
  quedar en dues línies, i els matisos d'una posició (votar a favor «amb reserves») es
  perden abans que hi arribem nosaltres.
- **Els noms dels grups ballen.** El mateix grup apareix com «GM ERC-AM», «Esquerra»,
  «el grup republicà» i, de vegades, pel nom del portaveu. La normalització d'àlies
  fallarà amb llistes locals i amb regidors no adscrits, i cada error de normalització és
  un vot atribuït a qui no toca.
- **L'OCR degrada les xifres.** En actes escanejades, els comptadors («13 vots a favor»)
  són justament el que més pateix. La comprovació contra `council_terms.seats` en detectarà
  una part, no totes.
- **Les Juntes de Govern es poden colar.** Si el nom del fitxer menteix i el capçal està
  mal reconegut, un acord de govern podria entrar com a acord de Ple. El filtre
  `organ = unknown` reduirà el risc; no l'eliminarà.
- **Rubí és un sol municipi.** La precisió que hi mesurem serà la d'un format d'acta
  concret, d'una secretaria concreta. No hi ha cap garantia que es traslladi a Tortosa o
  a Puigcerdà, i el conjunt d'or de tres pilots és petit per a 855 municipis. La porta per
  família de format és la resposta a això, i és la part del mètode amb més probabilitats
  de deixar municipis sense vots per grup.
- **Votar no és opinar.** Un vot a favor pot ser un pacte de pressupostos, un intercanvi
  amb un altre punt o disciplina de grup. Per això el vot mai serà l'única evidència d'una
  posició: [com el convertim en posició](02-posicions.md) explica els *priors* i els
  topalls de confiança, i [el càlcul de coincidència](04-coincidencia.md) exclou del
  denominador tot allò que no sabem.
- **Cobertura desigual per disseny.** Girona té 307 actes i desenes de municipis en tenen
  menys de 10. Comparar dos pobles amb corpus tan diferents pot fer semblar que un partit
  és més actiu quan el que passa és que el seu ajuntament publica més. Al registre públic
  hi haurà sempre el nombre d'actes llegides i la data de l'última.
- **Depenem que les seus electròniques segueixin publicant.** Si un ajuntament deixa
  d'alimentar el feed, les seves dades s'envelleixen sense avís. La data de l'última acta
  del feed ja la desem avui (`minutes_last_date`), i la publicarem a la pàgina de cada
  municipi. L'alerta automàtica quan un municipi porti més de 90 dies sense actes noves
  encara no està escrita.
