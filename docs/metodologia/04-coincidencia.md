# Com es calcula la coincidència

> **Estat a 29 d'agost de 2026.** Aquest document descriu el mètode que aplicarem.
> D'això, avui està implementat **el càlcul sencer**: l'escala −2..2, la fórmula, els
> pesos, la penalització de −1 per esquivar, l'exclusió de les afirmacions sense dades, el
> llindar de cobertura del 70%, la cadena de desempats, `tiedLeaders()` i `needsShootOut()`.
> Tot viu a `packages/shared-schemas/src/matching.ts` i té 14 tests que passen
> (`packages/shared-schemas/src/matching.test.ts`).
> No està implementat res del que envolta el càlcul: no hi ha test a la web, ni taula de
> posicions a la base de dades, ni cap paquet de dades de municipi, ni aranya per temes, ni
> `localStorage`, ni enllaç per compartir, ni analítica. **Cap municipi no té encara
> brúixola publicada.**
> La resta és compromís, no descripció. Ho marquem secció a secció.

Quan acabis el test, quivoto et dirà un percentatge per a cada candidatura del teu
municipi. Aquest document explica com sortirà aquest número. El càlcul ja està escrit i viu
en un sol fitxer, curt i sense dependències: `packages/shared-schemas/src/matching.ts`. La
funció és `computeMatch(answers, subjects, opts)` i és pura: mateixes entrades, mateix
resultat.

El repositori, ara mateix, **no és públic**: no el pots obrir des d'enlloc. El publicarem
amb el primer municipi amb brúixola i llavors enllaçarem aquest fitxer des d'aquí amb una
URL completa. Mentrestant, la via d'auditoria que tens és l'exemple complet del final
d'aquesta pàgina: està fet només amb sumes i divisions i el pots refer amb un llapis.

Les seccions «La fórmula», «Els pesos», «La penalització per esquivar», «Quan no tenim
dades», «El llindar del 70%» i «L'ordre i els desempats» descriuen exactament el que fa
aquest fitxer, no una versió simplificada. Les altres descriuen coses que encara no
existeixen, i van marcades.

Una decisió determinant es pren **fora** d'aquest fitxer, i convé saber-ho: el llindar de
confiança 0,45 que separarà una posició utilitzable d'un «Sense dades»
([02-posicions.md](02-posicions.md)) s'aplicarà en construir el paquet de dades del
municipi, no en calcular la coincidència. `matching.ts` no té cap camp de confiança ni de
base d'evidència: només veu `answered`, `no_data` i `no_position`. Aquest constructor de
paquets encara no existeix.

D'on sortiran les afirmacions ho expliquem a [01-afirmacions.md](01-afirmacions.md); d'on
sortiran les posicions dels partits, a [02-posicions.md](02-posicions.md), i com llegirem
els plens i les mocions, a [03-actes-i-mocions.md](03-actes-i-mocions.md).

## L'escala: cinc posicions i una sortida

> ✅ **Implementat.** L'escala i el tractament de les omissions són a
> `packages/shared-schemas/src/matching.ts` (`isValue`, filtre `answeredIds`), amb tests a
> `matching.test.ts` («ignora del tot les afirmacions que l'usuari omet», «ometre no altera
> la posició relativa dels subjectes que hi coincidien»). El botó «Omet» és interfície i
> encara no existeix.

Tu i cada candidatura us situareu a la mateixa escala de cinc punts, codificada de −2 a 2:

| Valor | Etiqueta |
|---|---|
| −2 | Totalment en desacord |
| −1 | Més aviat en desacord |
| 0 | Ni una cosa ni l'altra |
| 1 | Més aviat d'acord |
| 2 | Totalment d'acord |

**El 0 és una posició real.** Vol dir "no ho tinc clar" o "tal com està plantejat, ni sí
ni no", i puntua com qualsevol altre valor: si tu dius 0 i un partit diu 2, hi ha una
distància de 2 punts i el càlcul la compta.

**Ometre no és una posició.** Quan premis "Omet", aquella afirmació desapareixerà del
càlcul **per a tothom**: no comptarà ni a favor ni en contra de ningú. Al codi això ja és
literal: només entren al bucle les afirmacions on la teva resposta passa `isValue()`, és a
dir, un enter de −2 a 2. Un `null` o una clau absent queden fora abans de començar.

Per al partit hi ha tres estats possibles:

- `answered` — tenim posició, declarada per ells o inferida amb prou confiança.
- `no_data` — no tenim prou evidència. L'afirmació surt del seu denominador.
- `no_position` — declaren explícitament que no s'hi posicionen. Es penalitza.

Dues subtileses del codi que val la pena conèixer: una candidatura sense cap entrada per
a una afirmació es tracta com `no_data`, i una entrada marcada `answered` però amb un
valor invàlid o buit també es degrada a `no_data`. Mai s'inventa un valor per omplir un
forat.

## La fórmula

> ✅ **Implementat.** `computeMatch()` a `matching.ts`; tests «reprodueix un exemple
> calculat a mà» i «decreix monòtonament a mesura que augmenta la distància».

Per a cada afirmació que tu has respost i on el partit té posició:

```
s = 4 − |u − p|
```

`u` és el teu valor, `p` el seu. És la distància de Manhattan sobre l'escala, invertida
perquè més punts vulgui dir més acord. Dona sempre un enter de 0 a 4:

| Distància | Punts | Etiqueta a la comparació |
|---|---|---|
| 0 | 4 | Coincidiu |
| 1 | 3 | A prop |
| 2 | 2 | Diferents |
| 3 | 1 | Oposats |
| 4 | 0 | Oposats |

## Els pesos

> ✅ **Implementat.** `weightFor(userImportant, subjectPriority)` a `matching.ts`, amb el
> test «multiplica per 2 la importància de l'usuari i per 2 la prioritat del partit». El
> que encara no existeix és la manera de recollir aquestes prioritats: no hi ha
> qüestionari, ni taula de posicions, ni cap candidatura que hagi declarat res. Avui el
> camp `priority` arriba sempre buit perquè no hi ha dades que l'omplin.

Cada afirmació entra al càlcul amb un pes:

```
w = (tu la marques «molt important» ? 2 : 1) × (el partit l'ha marcada prioritària ? 2 : 1)
```

O sigui: 1 de base, 2 si la marques com a molt important, 2 si el partit l'ha posada
entre les seves cinc prioritats, i 4 si totes dues coses. La lògica del segon multiplicador
és que quan tu i ells coincidiu que aquell tema és el que importa, l'acord (o el
desacord) hauria de pesar més.

El segon multiplicador és un comandament que posem a la mà de les candidatures, i això té
dos problemes que encara no estan resolts. Primer, res no impedeix que una llista triï com
a prioritàries justament les cinc afirmacions on preveu més acord amb la majoria, i es
dupliqui el pes del propi encert. Segon, només pot fer servir el ×2 qui respon el
qüestionari: una llista de veïns que no el respon mai no el tindrà, de manera que el mateix
grau d'acord li valdrà menys. Per acotar-ho ens comprometem a tres coses, cap de les quals
està construïda: les cinc prioritats s'hauran de declarar alhora que les respostes i sense
revisió posterior; les publicarem amb data al costat de la fitxa de cada candidatura; i
publicarem, per a cada municipi, el resultat calculat amb i sense aquest segon
multiplicador, perquè es vegi quant mou. Tot això serà comprovable a partir del primer
municipi publicat.

El percentatge final serà:

```
match% = round( 100 · Σ w·s / Σ w·4 )
```

acotat a l'interval [0, 100]. El denominador és el màxim assolible: el que trauria un
partit que et donés la raó en tot, amb els mateixos pesos.

## La penalització per esquivar

> ✅ **Implementat.** Constant `NO_POSITION_SCORE = -1` a `matching.ts`, amb el test
> «penalitza amb −1 qui declara que no es posiciona, i no l'exclou».

Si un partit declara que no es posiciona sobre una afirmació que tu has respost, no
l'excloem: li donem **−1 punt** (constant `NO_POSITION_SCORE`), multiplicat pel pes. Si tu
l'havies marcada com a molt important, la penalització efectiva és de −2. L'afirmació sí
que entra al denominador, amb els seus `w·4` punts màxims.

Això és deliberat. Sense penalització, declarar "no ens hi posicionem" seria una jugada
gratuïta per no perdre punts amb ningú. Amb ella, esquivar costa.

Ara bé, hi ha una asimetria que hem de dir clarament perquè juga en contra de qui
col·labora: **qui declara que no es posiciona perd punts, i qui no contesta res no en
perd cap.** Un partit sense evidència queda com a `no_data` i l'afirmació li surt del
denominador (secció següent). Dit d'una altra manera, tal com està el càlcul avui, el
silenci surt més barat que la franquesa. El valor −1 tampoc no està derivat de res: és una
tria nostra, no un resultat mesurat, i el document no pot pretendre el contrari. Ens
comprometem a tancar-ho abans de publicar el primer municipi, per una d'aquestes dues
vies: o bé el `no_position` deixa de restar punts i només es marca visualment, o bé la
mateixa regla s'aplica a qui, havent estat convidat i tenint la fitxa feta, no respon res.
Sigui quina sigui la decisió, publicarem el rànquing calculat amb i sense penalització
perquè se'n vegi l'efecte.

## Quan no tenim dades

> ✅ **Implementat.** L'exclusió del numerador i del denominador és a `computeMatch()`, amb
> el test «deixa fora del càlcul les afirmacions sense dades». La fila amb l'etiqueta
> «Sense dades» és interfície i encara no existeix: el camp que la sustenta (`label:
> "unknown"` dins de `breakdown`) sí que hi és.

Si l'estat és `no_data`, l'afirmació surt **del numerador i del denominador d'aquell
partit**. No li resta ni li suma: el seu percentatge es calcula només sobre el que sabem
d'ells. La fila igualment apareixerà a la comparació afirmació a afirmació, amb l'etiqueta
"Sense dades", perquè el forat es vegi.

Dos partits del mateix municipi poden estar, doncs, puntuats sobre bases diferents. Per
això hi ha el llindar de cobertura.

## El llindar del 70%

> ✅ **Implementat.** `DEFAULT_COVERAGE_THRESHOLD = 0.7` a `matching.ts`, amb el test
> «classifica just a partir del 70% de cobertura». El grup visual "Dades insuficients" i la
> barra de cobertura són interfície i encara no existeixen.

`cobertura = afirmacions amb posició / afirmacions que tu has respost`

Si la cobertura és inferior a **0,70** (`DEFAULT_COVERAGE_THRESHOLD`), la candidatura
**no es classifica**: no li ensenyarem cap percentatge. Anirà al grup "Dades insuficients",
amb la barra de cobertura ("Posició coneguda en 12 de 25"). Un partit també queda sense
classificar si el seu denominador és zero o si tu no has respost cap afirmació.

Preferim dir "no ho sabem prou" que publicar un 71% calculat sobre quatre respostes.

El 0,70, però, **no està derivat de res**: és un número triat, no el resultat de cap
anàlisi, i la seva conseqüència no és neutra. Qui cau al calaix "Dades insuficients"
desapareix del rànquing, i qui hi cau depèn sovint de com d'ordenat és l'arxiu del seu
ajuntament, no del partit. Amb 25 afirmacions respostes, vuit forats basten per treure una
llista local del resultat. Abans de publicar el primer municipi farem i publicarem una
anàlisi de sensibilitat —com canvia l'ordre amb 0,50, 0,60, 0,70 i 0,80— i decidirem el
llindar amb aquella taula a la mà. També hi ha oberta l'opció de no amagar el número i
mostrar-lo sempre amb l'avís i la barra de cobertura al costat: dir "no ho sabem prou" i
alhora ocultar la xifra és una decisió editorial amb efecte de rànquing, i com a tal l'hem
de justificar o canviar.

## L'ordre i els desempats

> ✅ **Implementat.** `sortMatches()` i `tiedLeaders()` a `matching.ts`, amb els tests
> «desempata per l'encert a les afirmacions marcades com a importants», «posa els no
> classificats al final» i «detecta els subjectes empatats al capdamunt».

Primer els classificats, després els del grup "Dades insuficients". Dins dels
classificats, per percentatge de més a menys. Quan dos empaten al percentatge arrodonit,
el codi aplica aquesta cadena:

1. **Encert a les afirmacions que has marcat com a molt importants.** Es recalcula la
   mateixa fracció `Σ w·s / Σ w·4` només sobre aquestes files.
2. **Encert als temes que has triat**, si n'has triat cap (mateix càlcul, filtrant per tema).
3. **Més cobertura.**
4. **Ordre alfabètic** en català (`Intl.Collator("ca")`).

Dues coses que el codi fa i que convé saber: si un partit no té cap fila puntuable en el
criteri que s'està aplicant, aquell criteri li assigna −1 i, per tant, queda per sota de
qualsevol que en tingui; i aquesta mateixa cadena de desempats també ordena, entre si, els
partits del grup "Dades insuficients", tot i que allà el número no es mostrarà.

`tiedLeaders()` retorna tots els que empaten al capdamunt amb el mateix percentatge. La
interfície els haurà de mostrar amb el **mateix número d'ordre**, no un per damunt de
l'altre.

## El *shoot-out*

> ⏳ **Encara no construït.** L'única peça implementada és la detecció:
> `needsShootOut(results, margin = 3)` a `matching.ts`, amb el test «no demana shoot-out
> quan el primer va destacat». Ni la reserva d'afirmacions extra, ni la funció que les tria,
> ni el recàlcul, ni la pantalla existeixen. Ho desbloqueja tenir un fons d'afirmacions
> aprovat i publicat (vegeu [01-afirmacions.md](01-afirmacions.md)).

Si els dos primers classificats queden separats per **3 punts o menys**
(`needsShootOut(results, margin = 3)`), el resultat no és prou informatiu: aquesta
diferència pot venir d'un arrodoniment. Llavors t'oferirem afirmacions extra del fons no
seleccionat, triades perquè separin aquests dos, i es recalcularà tot amb elles incloses.

La funció que hi ha només decideix *si* cal el desempat; espera rebre la llista ja ordenada
per `computeMatch`. Quantes afirmacions extra s'oferiran (el pla en diu 5) i com es marcarà
el resultat després del *shoot-out* és una decisió d'interfície encara oberta.

Sobre la tria de les afirmacions extra, que és la part delicada —qui tria les preguntes que
decideixen qui guanya—, el compromís és aquest: sortiran de la reserva ja publicada i
aprovada amb la mateixa doble lectura que les 25 en viu, la tria la farà una funció
determinista i publicada que ordena la reserva per la distància prevista entre els dos
subjectes empatats, i cap persona no hi intervindrà en viu. Quan aquesta funció existeixi
l'enllaçarem aquí, amb els seus tests. Queda pendent de decidir si el mecanisme s'estén a
qualsevol parella consecutiva dins del marge o es queda només a la primera; tal com està
descrit ara, el segon lloc és una posició privilegiada, i això s'ha de resoldre.

## Exemple complet, comprovable a mà

> ✅ **Implementat.** Aquestes són les regles que ja executa `matching.ts`. El test
> «reprodueix un exemple calculat a mà» de `matching.test.ts` fa la mateixa comprovació amb
> unes altres xifres. Pots refer aquest exemple amb un llapis i comparar-lo.

Tres afirmacions, dos partits. Les teves respostes:

| Afirmació | La teva resposta | Molt important |
|---|---|---|
| A1 · Limitar els pisos turístics | 2 | Sí |
| A2 · Fer la zona de baixes emissions | −1 | No |
| A3 · Apujar l'IBI per pagar escoles bressol | 0 | No |

**Partit A** — posicions: A1 = 1 (prioritària per a ells), A2 = −2, A3 no s'hi posiciona.

| Afirmació | p | w | d | s | w·s | w·4 |
|---|---|---|---|---|---|---|
| A1 | 1 | 2×2 = 4 | 1 | 3 | 12 | 16 |
| A2 | −2 | 1 | 1 | 3 | 3 | 4 |
| A3 | *no es posiciona* | 1 | — | −1 | −1 | 4 |
| | | | | **Σ** | **14** | **24** |

Cobertura 3/3 = 1,00 ≥ 0,70 → es classifica.
`match% = round(100 · 14 / 24) = round(58,33) = **58**`

**Partit B** — posicions: A1 = −2, A2 = −1 (prioritària per a ells), A3 sense dades.

| Afirmació | p | w | d | s | w·s | w·4 |
|---|---|---|---|---|---|---|
| A1 | −2 | 2×1 = 2 | 4 | 0 | 0 | 8 |
| A2 | −1 | 1×2 = 2 | 0 | 4 | 8 | 8 |
| A3 | *sense dades* | — | — | — | *exclosa* | *exclosa* |
| | | | | **Σ** | **8** | **16** |

Aritmèticament faria 100 · 8 / 16 = 50. Però la cobertura és 2/3 = 0,67, per sota de
0,70: **el partit B no es classifica** i no ensenyarem cap percentatge. Anirà al grup
"Dades insuficients" amb "Posició coneguda en 2 de 3".

Si demà trobem la seva posició sobre A3 i resulta ser 1, la fila sumaria d = 1, s = 3,
w = 1 → numerador 11, denominador 20 → **55%**. Llavors tots dos estarien classificats i
la diferència amb el partit A seria de 3 punts exactes: `needsShootOut` retornaria cert i
t'oferiríem afirmacions extra.

## Si ets d'un poble petit, això és el que veuràs

> ⏳ **Encara no construït.** No hi ha cap municipi publicat, i per tant aquestes xifres són
> una previsió raonada, no una mesura. Ho desbloqueja el primer paquet de dades municipal:
> llavors substituirem aquesta previsió pel recompte real.

Cal dir-ho abans que ho descobreixis tu sol: en un poble de 4.000 habitants és molt
probable que la brúixola et digui poca cosa. Les candidatures solen ser llistes de veïns
sense programa penjat, sense web i sense xarxes actives
([02-posicions.md](02-posicions.md)); les actes hi són més escadusseres i moltes coses
s'hi aproven per unanimitat, que no separa ningú
([03-actes-i-mocions.md](03-actes-i-mocions.md)). Amb un test de 25 afirmacions, si d'una
llista només en sabem la posició de 15, es queda al 60% de cobertura i **no li surt cap
percentatge**.

L'escenari previsible, doncs, és que en molts pobles cap candidatura o gairebé cap no
arribi al llindar. Quan això passi, la pantalla no farà veure que sí: dirà que no tenim
prou dades d'aquell municipi, ensenyarà la comparació afirmació a afirmació amb els forats
a la vista i la barra de cobertura de cada llista, i t'oferirà el camí per aportar-hi
evidència. Preferim que un poble petit vegi un buit honest que un rànquing fet amb quatre
dades. També és la raó per la qual el llindar del 70% està en revisió (secció «El llindar
del 70%»): la seva conseqüència recau, de manera desigual, sobre els municipis amb menys
arxiu.

## Per què no hi ha eix esquerra-dreta ni mapa ideològic

Altres brúixoles et col·loquen en un pla de dos eixos. Nosaltres no, i és una decisió, no
una mancança de temps.

Un eix esquerra-dreta obliga a decidir per endavant quin costat de cada afirmació és
"esquerra". A escala municipal això sovint no vol dir res: qui defensa el comerç del
centre, qui vol la piscina coberta o qui s'oposa a un polígon no s'ordena en aquest eix.
A més, un mapa ideològic converteix una posició concreta i verificable ("van votar en
contra de la moció del 12 de març") en una etiqueta abstracta que ja no es pot auditar.

> ⏳ **Encara no construït.** L'aranya per temes no existeix: `matching.ts` no calcula cap
> agregat per tema. El camp `statementThemes` només s'hi fa servir com a segon criteri de
> desempat dins de `sortMatches`, i `SubjectMatch` no exposa cap xifra per tema. Ho
> desbloqueja escriure i provar una funció d'agregació (`agreementByTheme`) i tenir
> afirmacions amb tema assignat.

El que sí que **farem** és una aranya per temes (habitatge, mobilitat, cultura…): quota
d'acord tema a tema, descriptiva, al costat del resultat. Encara no està calculada: `matching.ts` fa servir el tema de cada afirmació només com a segon criteri de desempat. No entrarà al càlcul de la
coincidència ni n'alterarà l'ordre.

## Privadesa

> ⏳ **Encara no construït.** No hi ha test, ni paquet de dades de municipi, ni
> `localStorage`, ni enllaç `?r=`, ni analítica: a quivoto.cat només hi ha la pàgina de
> "properament". Tot aquest apartat és el compromís de com ho construirem, i es podrà
> comprovar amb el primer municipi publicat, mirant el codi de la pàgina i el trànsit de
> xarxa del navegador.

El càlcul es farà **al teu navegador**, amb JavaScript, sobre el paquet de dades del
municipi que ja s'haurà descarregat per pintar el test. Les teves respostes no s'enviaran a
cap servidor: no viatjaran ni per calcular ni per guardar. Es desaran al `localStorage` del
teu dispositiu perquè puguis continuar on ho vas deixar, i les podràs esborrar quan
vulguis.

L'única manera que les teves respostes surtin del dispositiu serà que **tu** decideixis
compartir el resultat: l'enllaç per compartir les portarà codificades al paràmetre `?r=`.
Si no vols que ningú les pugui llegir, no comparteixis l'enllaç.

Les analítiques del portal seran agregades i no guardaran IP. El que responguis no
s'associarà mai a una persona. El detall és a
[05-neutralitat-i-dades.md](05-neutralitat-i-dades.md).

## Límits d'aquest mètode

Els límits que segueixen són del mètode, no de l'estat de la construcció: valdran igual
quan tot això estigui fet.

- **El percentatge dependrà de les afirmacions triades.** Amb un altre conjunt de 25
  afirmacions, el mateix votant i el mateix partit donarien un número diferent. No és una
  mesura absoluta d'afinitat: és una mesura de coincidència sobre aquest qüestionari.
- **La distància de Manhattan tracta tots els salts igual.** Passar de "més aviat d'acord"
  a "totalment d'acord" val el mateix que passar de neutral a "més aviat d'acord". No hi
  ha cap raó forta per pensar que la gent viu l'escala així.
- **Amb poques afirmacions respostes, el llindar del 70% és molt sever.** A l'exemple
  d'aquí sobre, un sol forat deixa un partit fora. Amb 25 afirmacions respostes se'n
  toleren fins a 7. I el 0,70 és un número triat, no derivat: mentre no publiquem l'anàlisi
  de sensibilitat, s'ha de llegir com una decisió editorial nostra.
- **Un forat i una posició tèbia no es distingeixen prou.** Un partit amb evidència escassa
  però favorable pot semblar més proper que un altre amb evidència abundant i matisada,
  perquè només se'l puntua sobre el que sabem d'ell.
- **La penalització de −1 és un judici, no un fet.** Hem decidit que esquivar és pitjor que
  discrepar. És defensable, però un partit que no es posiciona per prudència queda igual
  de castigat que un que ho fa per càlcul.
- **El silenci surt més barat que la franquesa.** Declarar "no ens hi posicionem" resta
  punts; no dir res acaba en `no_data` i no en resta cap. És l'asimetria que hem de tancar
  abans de publicar (secció «La penalització per esquivar»).
- **El multiplicador de prioritat el controlen les candidatures.** Qui respon el
  qüestionari tria on es dobla el pes, i qui no el respon no té mai aquest ×2. Les mesures
  previstes per acotar-ho (declaració sense revisió posterior, publicació de les prioritats
  i del resultat sense el multiplicador) encara no existeixen.
- **El resultat s'acota a 0.** Un partit que ho esquivi gairebé tot pot generar un
  numerador negatiu; el mostrarem com a 0%, cosa que amaga *quant* de negatiu era.
- **Els empats a la baixa són fràgils.** Entre el 40% i el 60% la diferència de dos o tres
  punts no vol dir gairebé res, i per això preveiem el *shoot-out*. Per sota del primer
  parell no hi ha res equivalent: el tercer i el quart poden estar tan a prop com els dos
  primers i els mostrarem ordenats igualment.
- **La qualitat de l'evidència no alterarà l'ordre.** Una posició declarada pel partit i una
  d'inferida d'un vot al ple comptaran igual al càlcul: `matching.ts` no té camps de
  confiança ni de base d'evidència. La diferència es veurà a la fitxa i als punts de
  confiança, però no mourà ningú de lloc. És una decisió conservadora que es podria
  revisar.
- **No és un consell de vot.** El número dirà quantes de les nostres afirmacions responeu
  igual. No sabrà res de la gestió, de la confiança, de la trajectòria personal ni del que
  faran realment un cop al plenari. Per això, al costat de cada fila, hi haurà sempre
  l'evidència: perquè puguis desconfiar del número i mirar els fets.
