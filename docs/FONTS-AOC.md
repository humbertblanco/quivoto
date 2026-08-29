# Fonts de dades obertes per a la radiografia municipal

> **Estat a 29 d'agost de 2026.** Tot el que hi ha en aquest document s'ha comprovat amb
> crides reals a les API el 28 i 29 d'agost de 2026. Les xifres de cobertura són comptatges
> (`count(DISTINCT CODI_ENS)`), no estimacions, excepte allà on diu explícitament «mostra».
> La versió llegible per màquina d'aquesta mateixa taula és
> [`packages/pipeline/src/adapters/aoc-catalog.json`](../packages/pipeline/src/adapters/aoc-catalog.json).

## Resposta curta

**Sí, de la seu electrònica de l'AOC en podem treure molt més del que fem servir avui, però
molt menys del que el volum del catàleg fa pensar.** El portal CKAN
[dadesobertes.seu-e.cat](https://dadesobertes.seu-e.cat) té **912 datasets** i la immensa
majoria són **d'un sol municipi**: qui els publica és cada ajuntament pel seu compte, amb el
seu propi esquema. De tot el catàleg, **una quinzena llarga de datasets globals arriben als
947 municipis** i són els únics que permeten comparar. La resta serveix per a exemples
qualitatius, no per a una radiografia comparable.

**I sí, les fotos dels regidors s'hi poden treure**, sense autenticació i amb una URL trivial
—està verificat amb descàrrega real—, **però la cobertura és de 350 municipis dels 947 (37 %)
i 3.588 fotos**, i són dades personals amb drets d'un fotògraf tercer al damunt. La
recomanació és **no mirallar-les**: enllaçar la fitxa de seu-e i dissenyar la fitxa municipal
perquè funcioni sense foto. El detall és a [Fotos dels càrrecs electes](#fotos-dels-carrecs-electes).

Tres avisos que canvien el que teníem apuntat al pla:

1. El patró de fotos que el pla donava per bo (`p_p_id=organigramapolitic…&cmd=getPhotoBytes`)
   **és fals**: retorna HTTP 400 i el portlet no existeix. La ruta bona és una altra.
2. El dataset d'actes de ple **no té 25.902 actes des del juny del 2023 sinó 142.067 actes de
   2010 a 2026**, en 939 municipis. Hi ha molta més matèria primera per a la brúixola de la
   que la metodologia assumeix.
3. **Les retribucions dels càrrecs electes no es poden comparar**: només 4 municipis dels 947
   les publiquen com a dada oberta, amb quatre esquemes incompatibles. No ho prometem.

## Fonts globals: les que arriben als 947

Ordenades per utilitat per a la radiografia. `RID` és el `resource_id` de CKAN; totes les
consultes CKAN es fan amb
`https://dadesobertes.seu-e.cat/api/3/action/datastore_search_sql?sql=SELECT … FROM "<RID>"`.

| Font | Com s'hi accedeix | Cobertura mesurada | Camps útils | Què en construïm |
|---|---|---|---|---|
| **Resultats electorals 1979-2023** | RID `3539f7e6-4a48-4b57-9b55-b8c41079b3cd` · CSV: `https://dadesobertes.seu-e.cat/csv/eleccions-locals-vots.csv` | **947/947**, 36.743 files, 12 eleccions (1979: 934 municipis → 2015-2023: 947) | `ANY_ELECCIO`, `SIGLES`, `NOM`, `VOTS`, `REGIDORS`, `CODI_ENS`, `COMARCA` | El cor de la radiografia: sèrie de vots i regidories per candidatura i municipi. `VOTS_PERCENT` ve a 0: recalcular-lo. |
| **Càrrecs electes (AOC)** | RID `eb131bb1-f521-4aeb-9004-2fea1f372e89` amb `WHERE "NOM_ENS" LIKE 'Ajuntament%'` | **947/947**, 9.147 regidors d'ajuntament (verificat avui) contra 9.122 regidories elegides el 2023 | `NOM_REGIDOR`, `CARREC`, `PARTIT`, `SEXE`, `AREA`, `DATA_NOMENAMENT`, `E_MAIL` | Composició nominal del ple actual i **paritat per municipi** (`SEXE` al 100 %). Coincideix exactament amb els elegits del 2023 en 942/947. |
| **Càrrecs electes (Generalitat)** | `https://analisi.transparenciacatalunya.cat/resource/m5nd-xjza.json?$limit=12000` | **947/947**, mateixes 9.147 files | igual, en minúscules | **Mateixa extracció** que l'AOC per tres canals. Aquesta manté `codi_ens` de 10 caràcters amb el zero inicial: és la que fem servir per als joins. No té `e_mail`. |
| **Historial d'alcaldes/esses 1979-2027** | `https://analisi.transparenciacatalunya.cat/resource/2v2p-vu4h.json?$limit=20000` | **947/947 i les 12 legislatures**, 11.873 files (verificat avui) | `codi_10`, `nom_alcalde`, `partit_alcalde`, `legislatura_alcalde`, `data_pressa_possessio`, `data_baixa` | La troballa gran i que no era al pla: continuïtat i relleus a l'alcaldia des del 1979. Tapa el forat de l'AOC, que només identifica l'alcalde en 738/947. |
| **Liquidació per capítols** | RID `81f18313-547f-4c87-adbd-c6ce873cb406` | **947/947** cada any 2011-2023; 945 el 2024; 827 el 2025 | `ANY_EXERCICI`, `TIPUS_PARTIDA`, `CODI_CAPITOL`, `IMPORT_PRESSU_FINAL`, `IMPORT_LIQUIDAT` | La columna vertebral del semàfor financer: estalvi, saldo no financer, càrrega financera i grau d'execució, tot d'una sola font. 258.014 files: es baixa sencera. |
| **Endeutament 2010-2025** | RID `34db8dc5-ad5e-4bf0-83cc-537cd8671342` · bessó `c9ag-cye6` a la Generalitat | **947/947 tots els anys, sense cap forat** | `ANY`, `DEUTE_VIU`, `CENS` | Deute viu a 31/12, 16 anys: permet dir si un govern l'ha pujat o baixat. Quadra a l'euro amb el fitxer d'Hisenda del 2025. |
| **Actes del Ple** | RID `b5d370d0-7916-48b6-8a69-3c7fa62a1467` | **939/947**, 142.067 actes de 2010-09-01 a 2026-08-13 | `DATA_ACORD`, `TIPUS`, `ENLLAÇ_ACTA`, `CODI_ACTA`, `CODI_ENS` | Font de la brúixola i, de retruc, mesura d'activitat plenària per mandat (84.200 ordinàries, 51.607 extraordinàries, 5.751 urgents). |
| **Padró per municipi, any i sexe** | RID `e0be5678-0bdd-48e0-99af-05cd5404a9a5` | **947/947** (2022-2025), 946 el 2026 | `ANY`, `HOMES`, `DONES`, `TOTAL` | Denominador net de tots els «per habitant». No fer servir el camp `CENS` d'altres datasets, que s'arrossega repetit. |
| **Dades generals de l'ens** | RID `ab53cbf3-a439-4f59-a2f5-658bee1994e5` | **947/947**, una fila per ens | `CIF`, `COMARCA`, `PROVINCIA`, `SUPERFICIE`, `WEB`, `GENTILICI`, `DIR3`, `CODI_ENS` | Taula de dimensions amb què lligar-ho tot per `CODI_ENS`. |
| **PMP a proveïdors** | RID `eecca986-a51b-4b0e-a03b-6fc8bb71d387` | **943/947**, 32.185 files | `PERIODE_MIG_PAGAMENT`, `DATA_ACTUALITZACIO` | Dies que triga l'ajuntament a pagar: l'indicador de gestió més llegible que existeix. |
| **Resum d'indicadors econòmics** | RID `16416882-d418-4be6-9b82-ceb398bd60f8` · CSV 2,8 MB | **947/947** el 2015-2016 i 2019-2025 | `PRESSUPOST_HAB`, `ENDEUTAMENT_HAB`, `INVERSIONS_HAB`, `INGRESSOS_HAB`, `DESPESES_HAB` | Drecera «una fila per municipi i any». El fem servir per **contrastar**, no per publicar: el camp `INGRESSOS` aplica una depuració no documentada (exacte només en 816/945 el 2024). |
| **Liquidacions amb àrees de despesa (Generalitat)** | `https://analisi.transparenciacatalunya.cat/resource/ytva-5kp3.json` | **947/947** els anys 2011-2013 i 2015-2023 | `codi_document`, `desc_estructura`, `import`, `euros_habitant` | Mateixes xifres liquidades que l'AOC (comprovat a l'euro), però amb les 6 àrees de despesa i la recaptació real per figura tributària, **plusvàlua inclosa** (codi 1106). |
| **Tipus impositius** | RID `82ae0ea2-6fc6-4fd5-b944-4ef6d18717bc` | **947/947**; per any: 936 (2021) … 923 (2025) | `ANY`, `DESC_ESTRUCTURA`, `IMPORT` | Pressió fiscal comparable: IBI urbana, IAE, ICIO, IVTM per trams, any de la darrera revisió cadastral. |
| **Cost efectiu dels serveis** | RID `12c13cdd-03ca-48d3-92cb-f3e586e1135a` | **920/947**, 2016-2024 | `DESCRIPCIO_SERVEI`, `TIPUS_GESTIO`, `COST_EFECTIU` | Quant costa cada servei obligatori i si es presta directament o per contracte, amb criteri homogeni del MINHAP. |
| **Emplenament dels portals de transparència** | RID `1a9c1ede-8486-4a00-a48f-1b3271f6115c` | **936/947**, 190 ítems estàndard | `CODIINE`, `CODIITEM`, `VISIBLE`, `DADESAUTOMATIQUES`, `DARRERAACTUALITZACIODM` | Índex propi de compliment: «aquest ajuntament publica 5 dels 6 apartats obligatoris». El camp d'ens és `CODIINE`, no `CODI_ENS`. |
| **Cartipàs (enllaç al document)** | RID `1dda84e8-1f08-415b-a7c7-c45b50424249` | 932/947 amb alguna fila; **905/947 amb cartipàs del mandat 2023-2027** | `RESUM`, `DATA_PUB`, `ENLLAÇ`, `VIGENT` | Enllaç al PDF oficial a CIDO i data de constitució del govern. `VIGENT` val `True`/`False`, no `S`/`N`. |
| **Ordenances i reglaments** | RID `4597729c-7325-4525-bada-65c74dfd8877` | **946/947**, 33.988 documents | `RESUM`, `DATA_PUB`, `ENLLAÇ` | Quanta normativa pròpia té cada poble, i l'enllaç. Sense text. |
| **Convenis de col·laboració** | RID `8747a24f-aa98-4a7e-938a-df81cc16769a` | **919/947**, 81.873 convenis | `CODI_ENS`, `ENLLAÇ`, dates | Amb qui es relaciona cada ajuntament. Molt poc explotat. |
| **Convocatòries de personal** | RID `0e11c4f5-ce15-401f-b86f-f9d2604b94f6` | **928/947**, 219.342 files | places, dates | Proxy d'activitat de contractació de personal per mandat. |
| **Contractes de la PSCP** | RID `7448c675-8880-464e-9980-1b92119e59c8` | **806/947** identificats per nom d'òrgan, 477.888 licitacions (2018-2026) | `NOM_ORGAN`, `CODI_INE10`, `IMPORT_ADJUDICACIO_SENSE_IVA`, `DENOMINACIO_ADJUDICATARI`, `OFERTES_REBUDES` | «Qui contracta qui» i concentració d'adjudicataris. **No té `CODI_ENS`**: el lligam és per `CODI_INE10` o per nom. |
| **Sindicatura de Comptes 2023** | RID `846d700b-a2e3-441b-82e0-b130356581a6` | **947/947**, 1.100 files, només l'exercici 2023 | `TotIngressGestOrd`, `ResultNetExer`, `DespesesPersonal`, `Impostos`, `Taxes` | Compte de resultats complet. **El nom del dataset diu «prova» i no declara llicència: cal confirmar-ho abans de publicar-ho.** |
| **Ajuntaments sense oposició (Síndic)** | RID `943d6174-f0cc-41b4-b7c7-3f92041b22c1` | 185 municipis llistats, campanya 2026 | `AJUNTAMENT`, `CAMPANYA` | Llista oficial dels plens d'una sola candidatura. Fet polític explicable en una frase. El `CODI_ENS` és el del Síndic: join per nom. |
| **Compensacions a electes de pobles petits** | `https://analisi.transparenciacatalunya.cat/resource/bepu-nr6b.json` | 589/947 (només fins a 2.000 hab.), 2023 | `compensacio_maxima_anual`, `import_recursos_ordinaris` | **L'única xifra de diners lligada a electes que és comparable**, perquè la calcula la Generalitat amb la mateixa fórmula. És un sostre subvencionable, no un sou. |

## Fonts per municipi: quan val la pena baixar-hi

De les 912 col·leccions del portal, la gran majoria són datasets d'un sol ajuntament, i
formen quatre famílies:

- **Retribucions, dietes i aportacions a grups** — 4 municipis amb retribucions (Manresa,
  Manlleu, Ascó, Palau-solità i Plegamans), 1 amb dietes, 1 amb aportacions a grups.
- **Padrons, censos i indicadors locals** — desenes de municipis, cadascun amb el seu esquema.
- **Agenda política i grups d'interès (portals DIBA)** — 12 municipis amb agenda vigent,
  20 amb històric, 8 amb grups d'interès.
- **Factures i concessions** — e.FACT amb 169 municipis receptors; concessions de subvencions
  del MINHAP amb 304.

**El criteri per anar-hi poble a poble és un de sol i és de cobertura, no de qualitat.** Una
dada excel·lent que tenen 12 pobles no entra a la radiografia: trencaria la comparació i
faria semblar que els altres 935 amaguen alguna cosa. La regla que apliquem:

- **≥ 900 municipis** → entra a la fitxa com a dada comparable.
- **600-900** → entra com a dada amb nota explícita de qui hi falta i per què.
- **200-600** → només com a **marca positiva** («aquest ajuntament sí que ho publica»), mai
  com a rànquing: no publicar-ho no vol dir no tenir-ho.
- **< 200** → fora de la fitxa. Com a molt, exemple qualitatiu en un article signat.

Amb aquesta regla, cap dataset per municipi entra a la radiografia. L'única excepció és la
llista del Síndic dels 185 ajuntaments sense oposició, que **no és una dada d'ajuntament sinó
un cens oficial** i, per tant, la no-presència hi és informativa.

## Fotos dels càrrecs electes

**Veredicte: es pot fer, i no ho farem a la primera versió.**

El procediment, verificat amb descàrregues reals (avui: HTTP 200, `image/jpeg`, 7.361.171
bytes per a l'id 142):

1. Pàgina de llistat, un GET pelat sense cap paràmetre (les dades venen al HTML, no per AJAX):
   `https://seu-e.cat/ca/web/<slug>/govern-obert-i-transparencia/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions/carrecs-electes`
2. `grep` de `grupPolitic/getPhotoBytes/([0-9]+)`, `grupPolitic/veureCarrec/([0-9]+)` i `alt="Foto ([^"]+)"`.
3. Imatge: `…/carrecs-electes/-/grupPolitic/getPhotoBytes/<carrecId>`. El `carrecId` és
   **global**, no per municipi: el slug del path és decoratiu. `HEAD` dona 200/404 net.

Cobertura, mesurada sobre el cens sencer dels 947 (no una mostra): 925 municipis tenen la
pàgina, 461 tenen el mòdul emplenat i **350 (37,0 %) tenen com a mínim una foto**, 3.588 en
total, el 39 % dels regidors en actiu. El gradient és per mida (24,5 % als pobles de menys de
1.000 habitants, 65,2 % entre 20.000 i 50.000) i Barcelona, Terrassa i Reus no hi són.

Per què no ho fem ara: (1) amb un 37 % la fitxa quedaria visualment esbiaixada contra els
pobles petits; (2) el lligam foto-persona exigeix *matching* difús de noms; (3) són 5,6 GB
sense `Cache-Control` ni `ETag`, tot a origen; (4) l'avís legal és de **cada ajuntament**, no
de l'AOC, i limita expressament la reutilització per dades personals i per drets de tercers
—l'EXIF delata fotògraf professional (Canon, Lightroom). Wikidata no és alternativa: només
134 municipis (14 %) tenen l'alcalde amb imatge.

**El que sí que fem:** guardar el mapa de slugs de seu-e (933/947 resolts i verificats) i
**enllaçar** la fitxa de cada regidor a seu-e. Zero risc, dona trànsit a la font i compleix la
citació. I la via bona per al 2027 és demanar la foto a les candidatures amb cessió per
escrit, quan ja les tinguem al telèfon per validar el qüestionari.

**Troballa col·lateral que val més que la foto:** `…/-/grupPolitic/veureCarrec/<id>` s'obre
sense autenticació i conté retribució anual bruta, retribucions liquidades de l'any anterior,
lloc de naixement, biografia, currículum polític, comissions i òrgans, i enllaços a agenda i
a la declaració de béns. Mateixa cobertura (4.697 càrrecs, 461 municipis) i moltes més dades
personals: cal avaluar-ho a part, i amb calma.

## Salut financera

Els indicadors es calculen a partir de la **liquidació per capítols** (`81f18313`), el
**deute viu** (`34db8dc5`), el **PMP** (`eecca986`) i el **padró** (`e0be5678`). Tot ve del
mateix formulari normalitzat que els ens trameten, i per tant és comparable entre municipis.
Els percentils són reals, calculats sobre els **945 municipis amb liquidació del 2024**.

| Indicador | Fórmula | Font | Mediana 2024 | Llindar |
|---|---|---|---|---|
| Deute viu per habitant | `DEUTE_VIU / padró` | endeutament + padró | 3,7 € (400 municipis a 0) | > 582 € = decil pitjor |
| Deute sobre ingressos corrents | `DEUTE_VIU / (I1..I5)` | endeutament + liquidació | 0,2 % | **75 %** avís (8 municipis), **110 %** alerta legal (2) |
| Estalvi brut | `(I1..I5 − D1−D2−D4) / (I1..I5)` | liquidació | 15,1 % | < 0 = insuficient |
| Estalvi net | estalvi brut − amortització (D9) | liquidació | 12,2 % | **< 0 = pla de sanejament** (86 municipis el 2024) |
| Saldo no financer | `(I1..I7 − D1..D7) / (I1..I5)` | liquidació | 10,2 % | < 0 dos anys seguits = avís |
| Càrrega financera | `(D3 + D9) / (I1..I5)` | liquidació | 1,0 % | > 8,4 % = decil pitjor |
| Grau d'execució d'inversions | `IMPORT_LIQUIDAT / IMPORT_PRESSU_FINAL` (D6) | liquidació | 44,6 % | < 29 % = quartil pitjor |
| PMP a proveïdors | mitjana de l'any | PMP | 18 dies | **> 30 dies** incompliment (173 municipis), **> 60** greu (40) |

Dues honestedats obligatòries a la fitxa: (1) el **deute 0 de 400 municipis no és un forat de
dades** —el fitxer d'Hisenda diu el mateix— però «deute viu» és només deute financer i no
inclou el comercial, que és on s'amaga el problema dels pobles petits: per això el PMP hi va
al costat; (2) aquestes xifres són de l'entitat principal i els seus organismes autònoms,
**no de les societats mercantils municipals**, de manera que un ajuntament que ha tret l'aigua
o l'esport a una SA municipal «sembla» més petit i menys endeutat del que és.

## Límits, llicències i dades personals

- **Llicències.** Els datasets CKAN de l'AOC són **CC0**. Els de la Generalitat
  (`analisi.transparenciacatalunya.cat`) són «See Terms of Use», amb **atribució obligatòria**.
  El de la Sindicatura (`846d700b`) **no declara llicència i es diu «prova»**: no el publiquem
  fins a confirmar-ho. Les pàgines HTML de seu-e no són CC0: cada ajuntament n'és el titular.
- **`CODI_ENS`.** A l'AOC és **enter** i perd el zero inicial (Sabadell: `818780001`); a la
  Generalitat és text de 10 caràcters (`0818780001`). Tot join fa `zfill(10)`. Al dataset
  d'emplenament el camp es diu `CODIINE`; a la PSCP, `CODI_INE10`; i la PSCP no té `CODI_ENS`.
- **`CARREC` és text lliure** («Alcalde President», «ALCALDE», «Alcaldessa», 3 files buides):
  només 738/947 municipis tenen una fila identificable com a alcalde, i `ORDRE=1` **no** és un
  substitut (222 municipis hi tenen un regidor ras). No publiquem «alcalde actual» d'una sola
  font: l'historial i l'AOC discrepen en 29 dels 738 casos comparables (3,9 %).
- **`PARTIT` té 1.024 valors distints** per a 9.147 files (`ERC - AM` / `ERC-AM`): s'ha de
  normalitzar abans de creuar-lo amb `SIGLES` del dataset electoral.
- **Grup municipal ≠ candidatura.** Reconstruir els grups agrupant `PARTIT` dona el
  repartiment de la investidura, no el ple d'avui. Ho direm així a la fitxa.
- **Correus.** Dels 3.370 correus de regidors, **539 són comptes personals gratuïts** (397
  Gmail, 114 Hotmail). No els republiquem. Els institucionals, només si aporten alguna cosa.
- **Fotos i fitxes personals.** Dades personals amb drets de tercer. Enllaç, no còpia.
- **Escrapatge.** El `robots.txt` de seu-e prohibeix `/csv/`, les rutes d'actes de ple i
  qualsevol URL amb `p_p_id=` o `p_auth=`. La ruta de càrrecs electes no hi és prohibida, cosa
  que no és permís per fer milers de descàrregues: una sola passada, concurrència baixa i
  User-Agent identificatiu amb contacte.

## Què incorporem i quan

**Fase 1 — radiografia de desembre del 2026 (947 municipis).** Resultats electorals
1979-2023, càrrecs electes amb paritat, historial d'alcaldes des del 1979 reconciliat amb
l'AOC, dades generals i padró, i el bloc de salut financera sencer (liquidació per capítols,
deute, PMP). Més el recompte d'activitat plenària que ja tenim del dataset d'actes. Tot
CC0 o amb atribució, tot ≥ 939 municipis.

**Fase 2 — durant el 2027, abans de la brúixola.** Tipus impositius i àrees de despesa
(`ytva-5kp3`, per dir en què gasta cada poble), cost efectiu dels serveis (920), índex propi
d'emplenament del portal de transparència (936), enllaç al cartipàs (905) i a les ordenances
(946), i la marca del Síndic per als 185 ajuntaments sense oposició. Enllaç a la fitxa de cada
regidor a seu-e, sense copiar-ne la imatge.

**Més endavant, si hi ha mans.** Contractació de la PSCP (806, join per nom o INE10), convenis
(919), convocatòries de personal (928), la Sindicatura de Comptes un cop aclarida la llicència,
i el mirall de fotos només si les demanem a les candidatures amb cessió escrita.

**Descartat, i queda escrit perquè no s'hi torni a perdre temps.** Retribucions comparables
d'electes (4 municipis, 4 esquemes incompatibles), declaracions de béns i activitats (zero com
a dada estructurada), grups municipals i portaveus (zero), règim de dedicació (zero), agenda
política dels alcaldes (12 i 20 municipis), e.FACT (169), concessions del MINHAP (304),
estatuts (229), plecs de clàusules (374), personal de concessionaris (1 municipi), fotos de
Wikidata (134) i el portlet `organigramapolitic` del pla, que **no existeix**.
