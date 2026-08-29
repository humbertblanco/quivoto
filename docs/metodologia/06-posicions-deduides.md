# Com deduïm la posició de cada grup municipal

> **Estat a 29 d'agost de 2026.** Aquest document descriu una cosa que **sí que està
> escrita i provada**, a diferència de la major part de la metodologia. Les regles de
> deducció viuen a
> [`packages/pipeline/src/publish/posicions.ts`](../../packages/pipeline/src/publish/posicions.ts)
> (22 proves a [`posicions.test.ts`](../../packages/pipeline/src/publish/posicions.test.ts)) i
> el lligam entre una afirmació i el punt d'acta que cita, a
> [`enllac-actes.ts`](../../packages/pipeline/src/publish/enllac-actes.ts) (12 proves). Es fan
> servir a la **demo** de l'Observatori
> ([`prova.ts`](../../packages/pipeline/src/publish/prova.ts)), que va amb `noindex` i amb el
> segell «esborrany · sense validar».
> **El que això no és:** no és la brúixola publicada, les afirmacions no estan validades, i
> cap d'aquestes posicions no és una posició *declarada* per cap partit. Tampoc no hi ha
> encara camp `basis` ni `confidence` a la base de dades: les etiquetes que descrivim aquí
> viuen a la funció que genera la pàgina, no a l'esquema
> ([02-posicions.md](02-posicions.md)).

Aquest és el punt més delicat de tot el projecte. Aquí estem dient públicament què pensa un
partit sobre una afirmació, i ho hem de poder defensar davant d'aquell partit, amb el paper a
la mà, sense haver d'apel·lar a cap intuïció nostra. El document explica **fins on arribem i
exactament on ens aturem**.

La regla que ho governa tot és la mateixa de sempre i aquí es porta al límit: **quan no ho
sabem del cert, no ho diem**. El resultat és que la major part de les caselles queden buides,
i el buit es veu.

## 1. Dues coses que no són el mateix

Al 2027 la posició d'una candidatura la donarà la candidatura. Al gener del 2027 cada llista
amb representació rebrà el qüestionari amb les 25 afirmacions del seu municipi, respondrà, i
publicarem la seva resposta tal com arribi, amb data ([02-posicions.md](02-posicions.md)).
Això serà **què diu**.

Avui aquelles candidatures no existeixen. No hi ha llistes, ni caps de llista, ni programes
del 2027. El que sí que existeix, i és públic i datat, és **com han votat els grups
municipals del mandat 2023–2027 als plens del seu ajuntament**. Això és **què han fet**.

No són el mateix, i la diferència no és un detall:

- El subjecte no coincideix. Qui vota al ple és el **grup municipal**, que pot no ser la
  candidatura que es presenti el 2027: hi ha escissions, regidors no adscrits, marques que
  canvien de nom i llistes que no es tornen a presentar.
- El moment no coincideix. Un vot del 2024 diu què va fer aquell grup el 2024. No compromet
  ningú per al 2027, i el partit pot haver canviat d'opinió amb tot el dret.
- **I sobretot: un vot no és una declaració.** Un grup pot votar en contra d'una moció per
  qui la presenta, per com està redactada, per un pacte de pressupostos o per disciplina de
  grup, i no pel que la moció diu. Hi tornem a la [secció 6](#6-el-límit-honest), que és la
  part d'aquest document que menys ens agrada i que més necessitem escrita.

Per això la demo no diu mai «el grup X hi està d'acord». Diu, amb aquestes paraules a la
pantalla: *«La posició de cada grup no és la que el partit diu que té: és com va votar al
ple»*. Quan el 2027 tinguem les dues coses, es podran posar en dues columnes, i aquesta serà
la manera de veure qui fa el que diu.

## 2. Abans de res: quin punt de l'acta és

Cada afirmació porta una evidència escrita per una persona, que comença sempre igual: «Ple de
18 d'octubre de 2023, acord núm. 6», «Ple del 27/10/2025». Les actes ingerides porten la data
i el número de cada punt. Amb això busquem el punt exacte, i llavors el vot ja no s'ha de
deduir: es llegeix.

Tres decisions d'aquest lligam, totes tres cap al costat de no dir res:

- **Només mira el començament del text** (els primers 160 caràcters). Una evidència pot citar
  dos plens —«Ple del 27/10/2025: s'aprova incrementar l'IBI. El 18/10/2024 el tipus ja havia
  passat…»— i el que sosté l'afirmació és el primer; el segon hi és com a context.
- **Amb data i número d'acord, la coincidència ha de ser exacta**, i única. Si dos punts
  d'aquell dia porten el mateix número, no s'agafa cap.
- **Amb la data sola**, només val si aquell ple té **un únic punt amb vot desglossat**. Si
  n'hi ha dos, no hi ha manera de saber quin és, i triar-ne un a l'atzar seria atribuir a un
  partit el vot d'una altra cosa. Aquest és el pitjor error que podríem cometre.

Si no es troba el punt, no passa res greu: es continua amb el text de l'evidència i les vies
2, 3 i 4.

## 3. Les quatre vies, per ordre de força

Un grup només queda situat si alguna d'aquestes quatre vies el situa. S'apliquen en aquest
ordre i **la primera que parla d'un grup mana**: si l'acta llegida diu com va votar el PSC, ja
no es dedueix res més sobre el PSC.

| # | Etiqueta | D'on surt | Què assumeix | Quan falla |
|---|---|---|---|---|
| 1 | `acta` | El punt de l'acta, amb el vot desglossat per grup | Que hem llegit bé l'acta i que el nom del grup lliga | Si l'extracció de l'acta s'equivoca, s'equivoca tot |
| 2 | `nominal` | El resum de l'evidència anomena els grups de cada costat | Que el text entre parèntesis és la llista dels que hi van votar així | Si l'evidència està mal redactada o abreuja un nom que no reconeixem |
| 3 | `aritmetica` | Els escons només es podien repartir d'una manera | Que tothom hi era i que cada grup vota unit | Absències i vots trencats dins d'un grup |
| 4 | `bloc` | Els vots contraris no cabien a l'oposició | Que sabem qui és al govern i quants escons té cadascú | Si la composició del ple a la nostra base de dades no és la del dia de la votació |

### Via 1 — l'acta llegida

És la bona. Si hem trobat el punt (secció 2) i l'acta desglossa el vot, no hi ha res a
deduir: hi és escrit.

**Exemple** (Esplugues, ple del 18 de setembre de 2024, acord núm. 7, contractació del servei
de recollida de residus). L'acta dona: PSC-CP a favor, ECP-C a favor, Grup Municipal
Republicà abstenció, Junts per Esplugues en contra, VOX en blanc. La sortida situa quatre
grups —els dos del govern a un extrem, Junts a l'altre, els republicans al mig— i **deixa VOX
fora**, perquè un vot en blanc no és una posició.

**Què assumeix:** que l'acta s'ha llegit bé. Aquesta és una assumpció grossa i no la resol
aquest document, sinó [03-actes-i-mocions.md](03-actes-i-mocions.md): OCR, segmentació,
noms de grup que ballen, Juntes de Govern que es podrien colar. Si allà entra un error, aquí
surt amb l'aparença més sòlida de totes, que és el pitjor lloc on pot sortir.

**Per què l'hem considerada prou sòlida:** perquè no hi ha cap inferència pel mig. El risc és
tot a l'extracció, i l'extracció té la seva pròpia mesura pendent (el CSV obert de Rubí i el
conjunt d'or). Mentre aquella mesura no estigui publicada, aquesta via val el que valgui
l'extracció, ni més ni menys.

### Via 2 — el resum de l'evidència anomena els grups

Moltes evidències porten el desglossament escrit al costat dels números: «17 vots a favor
(PP) i 9 en contra (Guanyem, BeCP, ERC i PSC)». El que hi ha just abans del parèntesi marca
el costat, i el contingut del parèntesi es parteix per comes i per «i».

**Exemple** (Badalona, IBI). Evidència: *«s'aprova incrementar un 2,4% els tipus de l'IBI, amb
17 vots a favor (PP) i 9 en contra (Guanyem, BeCP, ERC i PSC)»*. L'afirmació diu que caldria
abaixar l'IBI, i la posició del govern hi és de desacord. Resultat: PP a −2, i PSC, ERC, BeCP
i Guanyem a +2.

**Què assumeix:** que sabem lligar cada nom escrit a l'acta amb un grup del ple. Les actes
escurcen («Guanyem» pel grup «Guanyem Badalona») i allarguen («BeCP» per «Badalona En Comú
Podem»). Ho resolem de dues maneres: totes les paraules distintives que diu l'acta han de ser
al nom del grup, o bé el que diu l'acta són les inicials del nom del grup. Davant del dubte,
**diu que no**: si un nom lliga amb dos grups, no lliga amb cap.

**Quan falla:** quan un nom no lliga amb res. I llavors **no es reparteixen ni els que sí que
hem entès**: si a l'evidència hi surt «Compromís per Badalona» i aquest grup no existeix al
ple, vol dir que no hem entès la frase, i tota la frase queda descartada. Val més callar que
repartir malament la meitat.

**Per què l'hem considerada prou sòlida:** perquè el resum de l'evidència l'ha escrit una
persona copiant l'acta, i la cita és comprovable des de la pàgina. És llegir, no deduir.

**Cas a part: «aprovat per unanimitat».** Posa tots els grups del ple al mateix costat. És
sòlid pel que fa al sentit del vot, però arrossega un supòsit que no podem comprovar des del
text: que hi eren tots. Qui aquell dia no hi era, també queda comptat com a favor. És el
lloc més fluix d'aquesta via i ho tenim obert.

### Via 3 — l'aritmètica dels escons

Quan l'evidència dona els números però no diu qui és qui, es prova de repartir els escons dels
grups entre els tres costats —a favor, en contra, abstenció— i **només s'accepta el
repartiment si n'hi ha exactament un de possible**. Amb deu grups són 59.049 combinacions: es
proven totes i no cal cap heurística ni cap estimació.

**Exemple** (el cas de prova de Badalona: un ple de 27 regidories on el grup del govern en té
18 i l'oposició, 4 + 2 + 2 + 1). Evidència: *«moció per limitar els habitatges d'ús turístic,
rebutjada amb 9 vots a favor i 18 en contra»*. Els 18 vots en contra només els pot posar el
grup de 18; els 9 restants són exactament tota la resta. No hi ha cap altra combinació, i el
repartiment queda tan determinat com si l'acta l'escrivís.

**Què assumeix:** dues coses, i totes dues es poden trencar. Que **hi era tothom**, i que
**cada grup vota unit**. La primera es comprova: si els vots emesos no sumen el ple sencer hi
ha hagut absències, i llavors qualsevol repartiment és possible i no es dedueix res —«18 a
favor i 7 en contra» en un ple de 27 no dedueix res, encara que hi hagi una lectura temptadora.
La segona **no la podem comprovar** i és un límit real: si un regidor trenca la disciplina del
seu grup, el repartiment que llegim serà fals encara que sigui l'únic possible.

**Quan falla:** gairebé sempre, en el sentit que gairebé mai hi ha un únic repartiment
possible. Amb quatre o cinc grups petits, unes abstencions es poden col·locar de moltes
maneres i el resultat és cap deducció. Això és exactament el que ha de passar.

**Per què l'hem considerada prou sòlida:** perquè la unicitat és una propietat comprovable
per qualsevol persona amb els escons a la mà i un full de càlcul. No és una estimació ni una
probabilitat: o hi ha una manera de repartir-ho, o n'hi ha més d'una.

### Via 4 — la regla del bloc

L'última, i la més feble de les quatre. Quan el repartiment no és únic, encara es pot saber
**de quin costat va votar el govern sencer**, si els números no deixen cap altra opció: si els
vots en contra i les abstencions plegats no arriben ni a totes les regidories de l'oposició, i
els vots a favor són com a mínim tants com en té el govern, no hi ha manera que cap regidor
del govern hagi votat en contra.

**Exemple** (Esplugues: 21 regidories, govern de 13 —PSC 10, ECP 2 i una regidora no
adscrita—, oposició de 8). Evidència: *«acord núm. 7: inici de la contractació del servei de
recollida, aprovat amb 17 vots a favor, 1 en contra i 1 abstenció»*. El vot contrari i
l'abstenció sumen 2, i caben de sobres a l'oposició; els 17 vots a favor no es poden fer sense
els 13 del govern. **El govern hi va votar a favor.** De l'oposició no en sabem res: aquell 1
en contra i aquella abstenció els podia posar qualsevol dels quatre grups, i per això cap grup
de l'oposició no queda situat.

**Què assumeix:** que la composició del ple que tenim a la base de dades —qui té quants escons
i qui és al govern— és la del dia d'aquella votació. Els canvis de grup a mig mandat, els no
adscrits i els canvis de govern encara no els sabem detectar
([02-posicions.md](02-posicions.md)). Si un pacte s'ha trencat entremig, la regla dedueix bé
l'aritmètica i malament la política.

**Quan falla:** quan el recompte suma **més** regidories que el ple. Això vol dir que
l'evidència ha barrejat dues votacions del mateix text, i llavors no s'hi pot raonar a sobre:
no es dedueix res. També quan els vots a favor no arriben al total del govern («12 a favor, 4
en contra i 4 abstencions» amb un govern de 13): algú del govern no hi és, i ja no sabem qui.

**Per què l'hem considerada prou sòlida:** perquè és una desigualtat aritmètica, no una
inferència sobre intencions. I perquè situa **només el govern**, que és el bloc del qual el
lector ja sap qui és, i mai l'oposició, que és on la temptació d'endevinar seria més gran.

## 4. Quan no diem res

Aquesta és la secció important. Cada un d'aquests casos és una decisió presa a consciència de
deixar la casella buida, i no un forat que ens hagi quedat sense tapar.

**El govern es parteix entre els dos costats.** Si en una coalició un soci vota a favor i
l'altre en contra, no es dedueix res **de ningú**, ni tan sols dels grups que sí que teníem
situats per una altra via. El motiu és el de la secció 5: l'escala s'orienta sabent de quin
costat cau el govern, i si el govern és als dos costats no hi ha manera d'orientar-la.
Qualsevol tria seria inventada.

**Un nom que no lliga amb cap grup del ple.** Ja explicat a la via 2, i val la pena repetir-ho
perquè és el cas que més cobertura ens menja: n'hi ha prou que un sol nom de la frase no
lligui perquè es descarti la frase sencera. Ens costa car —vegeu Esplugues a la secció 7— i el
mantenim.

**Un recompte que suma més regidories que el ple.** Senyal que el text ha ajuntat dues
votacions. No es dedueix res.

**Un recompte que no suma el ple sencer.** Hi ha hagut absències i el repartiment ja no és
determinable. Talla la via 3 de soca-rel.

**Vots en blanc i absències.** Qui vota en blanc o no hi és **no queda situat**. No és una
abstenció, i comptar-ho com a tal seria posar-li a aquell grup una opinió que no ha expressat.
A la fitxa hi surt com a «sense posició deduïble en aquesta».

**L'afirmació no té posició de govern establerta.** Si qui va escriure l'afirmació no ha pogut
fixar si el govern hi està d'acord o en desacord (`desconeguda`), l'afirmació no entra ni al
test. A Sant Just Desvern això són 3 de les 25 afirmacions, i per això el denominador d'aquell
municipi és 22 i no 25.

**L'evidència no descriu cap votació.** «Segons la liquidació del 2025, el romanent és de 342
M€» és una dada, no un vot. Cap grup no queda situat.

**El buit és una decisió, no una mancança.** Perquè es vegi i no s'hagi de creure, la demo
mostra al costat de cada grup **en quantes afirmacions se'l pot situar**, ordena la
classificació posant a part els grups situats en menys de 5 afirmacions, i llista sota cada
afirmació els grups que hi han quedat fora. Un grup situat en cinc afirmacions no és
comparable amb un que ho està en vint, i amagar-ho faria semblar precisa una xifra que no ho
és.

## 5. El sentit de l'escala

Saber que un grup va votar a favor encara no diu si està d'acord amb l'afirmació. L'afirmació
pot anar **en contra** del que es votava: «cal abaixar l'IBI» contra un punt que el puja. Qui
hi va votar a favor està en desacord amb l'afirmació.

Ho fixa un sol camp, `posicio_govern`, que diu si el govern està d'acord o en desacord amb
l'afirmació. No el dedueix cap màquina: el fixa qui escriu l'afirmació i es comprova obrint
l'acta. Sabent on cau el govern i com hi va votar, el sentit dels dos costats queda
determinat: si el govern va votar a favor i està d'acord amb l'afirmació, votar a favor vol
dir estar-hi d'acord, i qui hi va votar en contra hi està en desacord. Si el govern hi està en
desacord, al revés.

L'escala de sortida només té tres valors: **+2, 0 i −2**. Un vot no dona per a més. No
deduïm mai un «més aviat sí»: qui vota a favor d'un punt no ha dit que hi estigui *una mica*
d'acord, i posar-li un ±1 seria una precisió falsa. El zero és per a l'abstenció.

> **Una contradicció que hem de resoldre.** [02-posicions.md](02-posicions.md) diu —i ho
> sostenim— que **l'abstenció no hauria de puntuar**: hauria de ser un estat propi
> (`abstained`), visible a la fitxa amb la cita, però fora del càlcul i fora del denominador,
> perquè abstenir-se pot voler dir «ni sí ni no», «no volem trencar el pacte» o «hi estem
> d'acord però no amb la forma», i cap dels tres no és «aquest partit es situa al centre». La
> demo d'avui **no ho fa així**: hi posa un 0 a l'escala i el 0 entra al càlcul. És una
> divergència real entre el que està escrit al mètode i el que fa el codi. Mana el mètode, i
> el codi s'hi ha d'adaptar abans de publicar cap municipi de veritat.

## 6. El límit honest

Un partit pot votar en contra d'una moció **per qui la presenta**, i no pel que hi diu. Passa
sovint i tothom qui ha trepitjat un ple ho sap. També pot votar-hi a favor per un pacte de
pressupostos, per no trencar una coalició, per disciplina de grup, perquè la moció venia
acompanyada d'un altre punt que sí que li interessava, o perquè el text estava redactat de
manera que votar-hi en contra hauria semblat una altra cosa.

Res del que fem en aquest document no distingeix cap d'aquests casos d'un acord sincer. Ho
diem sense embuts: **la deducció recull el vot, no el motiu.** Si un grup ens diu «vam votar
que no perquè la moció era de tal, no perquè hi estiguem en contra», té raó i no tenim manera
de contradir-lo amb el paper que tenim.

Què hi farem:

- **Al 2027, preguntar-los.** La posició declarada mana sempre sobre la deduïda. Quan una
  candidatura respongui el qüestionari, la seva resposta serà la posició vigent, i la deduïda
  quedarà al costat, visible i datada: no corregirem la història amb la declaració ni la
  declaració amb la història. La discrepància entre les dues és informació, i és de les coses
  més útils que podrem publicar.
- **Mentrestant, dret de rèplica.** Qualsevol grup pot dir-nos que una deducció seva no
  reflecteix la seva posició. Si aporta evidència que no teníem, es corregeix; i si no li
  donem la raó, el seu comentari es publica igualment al costat, sense editar
  ([02-posicions.md](02-posicions.md)).
- **I dir-ho a la pantalla, no només aquí.** La demo ja ho porta escrit a la primera pàgina:
  *«Un partit pot votar en contra d'una moció per qui la presenta i no pel que hi diu»*. Si
  algun dia el portal ensenya aquestes posicions sense aquesta frase al costat, és un error
  nostre i s'ha de reclamar.

## 7. La cobertura d'avui

Xifres reals dels tres conjunts d'afirmacions treballats, amb les regles d'aquest document
aplicades. Són d'un material en esborrany i canviaran; les publiquem perquè es vegi l'ordre
de magnitud del que aquest mètode dona, que és **molt menys del que sembla que hauria de
donar**.

| Municipi | Afirmacions al test | Amb algun grup situat | Qui hi queda situat |
|---|---|---|---|
| Esplugues de Llobregat | 25 | **16** | pràcticament només el bloc de govern |
| Badalona | 25 | **10** | govern i oposició, segons la via |
| Sant Just Desvern | 22 (de 25) | **7** | — |

A Sant Just el denominador és 22 perquè 3 afirmacions tenen la posició de govern com a
desconeguda i no entren al test (secció 4).

**Per què Esplugues només hi situa el govern**, que és el cas que més ensenya. Té dues causes
i cap de les dues no és que les actes siguin dolentes:

1. **Els noms no lliguen.** Moltes evidències d'Esplugues sí que anomenen els grups —«13 vots
   a favor (PSC, ECP i la regidora no adscrita) i 7 en contra (ERC, PP, Junts i Vox)»—, però
   els grups del ple es diuen, a les nostres dades, «Grup Municipal Republicà» i «Grup
   Municipal Popular». «ERC» i «PP» no hi lliguen: no comparteixen cap paraula amb el nom del
   grup ni en són les inicials. I com que n'hi ha prou que un sol nom falli perquè es descarti
   tota la frase, aquestes evidències perden el desglossament sencer i cauen a les vies
   numèriques. De les 16 afirmacions situades, **una sola** situa un grup de l'oposició: aquella
   on l'acta escriu «Junts per Esplugues» amb el nom sencer, que sí que lliga.
2. **Els números sols no basten.** Amb un ple de 10-3-3-2-1-1-1 escons hi ha massa maneres de
   repartir qualsevol recompte, i la via 3 gairebé mai no és única. Queda la regla del bloc,
   que per construcció només situa el govern.

La primera causa **és arreglable** i la segona no. Un mapa d'àlies per municipi —dir-li al
sistema que a Esplugues «ERC» és el Grup Municipal Republicà— recuperaria el desglossament de
bona part d'aquestes 16 afirmacions i situaria l'oposició amb base `nominal`, que és de les
fortes. No està fet. Fins que ho estigui, la cobertura d'Esplugues que veieu és un sostre
artificialment baix, i preferim un sostre baix a un àlies mal endevinat.

## Límits d'aquest mètode

- **Tot això dedueix vots, no opinions.** El límit de la secció 6 no el resol cap millora
  tècnica: només el resol preguntar-ho als partits, i això no passa fins al 2027.
- **La via 1 hereta tots els errors de l'extracció d'actes**, i els presenta amb l'aparença
  més sòlida de les quatre. La mesura de precisió de l'extracció encara no s'ha fet
  ([03-actes-i-mocions.md](03-actes-i-mocions.md)); fins que no estigui publicada, l'etiqueta
  `acta` val el que valgui aquella extracció.
- **Les vies 3 i 4 assumeixen que cada grup vota unit.** No sabem detectar un regidor que
  trenca la disciplina del seu grup, i quan passi la deducció serà falsa sense que res no ho
  delati.
- **La via 4 assumeix que la composició del ple no ha canviat** des de l'inici del mandat. Els
  canvis de grup, els no adscrits sobrevinguts i els canvis de govern a mig mandat encara no
  els detectem.
- **La unanimitat compta també els absents.** «Aprovat per unanimitat» situa tots els grups a
  favor, i qui aquell dia no hi era hi queda situat igualment.
- **El lligam entre afirmacions i noms de grup és fràgil i, avui, sense àlies.** És la causa
  principal de la baixa cobertura d'Esplugues, i afectarà més els municipis on les actes
  anomenen els grups amb formes llargues o amb el nom del portaveu.
- **L'abstenció es tracta diferent del que diu el mètode** (secció 5). És una divergència
  coneguda i pendent de corregir al codi, no una decisió nova.
- **Les xifres de cobertura de la secció 7 són d'un material en esborrany**, calculades sobre
  afirmacions que no han passat cap validació. No són una previsió de la cobertura del portal
  ni s'han de llegir com a tal.
- **Cap d'aquestes posicions no porta encara confiança ni `basis` a la base de dades.** Les
  quatre etiquetes d'aquest document viuen a la funció que genera la pàgina. Fins que no
  siguin camps de l'esquema, amb els seus sostres, no es podran creuar amb la resta del
  mètode ([02-posicions.md](02-posicions.md)).
- **Res d'això no s'ha publicat.** Les pàgines on es fa servir van amb `noindex` i amb el
  segell «esborrany · sense validar», i no hi ha cap municipi obert amb brúixola.
