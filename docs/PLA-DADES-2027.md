# Pla de dades cap al 23 de maig del 2027

## Què estem fent, dit sense adornar

No fem transparència. La transparència és publicar-ho tot i que s'espavili qui ho llegeixi;
això ho fan els portals oficials i ho fan malament perquè ningú no hi entra. El que fem és
**posar les cartes sobre la taula davant d'una decisió concreta**: el 23 de maig del 2027 una
persona entrarà en un col·legi electoral i haurà de triar. Fins llavors, el que necessita és
poder respondre tres preguntes sobre el seu poble:

1. **Què és aquest municipi** i en què s'assembla o es diferencia dels que se li semblen.
2. **Què ha fet aquest govern** aquests quatre anys, i què ha votat cada grup.
3. **Qui són aquestes persones**: qui seuen al ple, d'on venen, què han votat i què cobren.

Tota la resta és decoració. El filtre per a qualsevol dada nova és aquest i no un altre: **si no
ajuda a respondre una d'aquestes tres, no entra**, per bona que sigui la dada.

---

## La lliçó del 29 d'agost del 2026, que canvia com treballem

Una auditoria de les 175 primeres afirmacions en va trobar **115 amb algun problema**, i entre
elles **cites entre cometes que no existeixen al document citat**. Un alcalde deia una cosa que
no havia dit; una xifra del 8,5 % no apareixia en cap dels 125 documents del corpus; una moció
es citava tallant-li la part que la caracteritzava políticament.

Cap d'aquestes afirmacions no era mala fe. Totes venien del mateix lloc: **escriure a partir del
que recordes d'un document en comptes del document**. I totes tenien el mateix antídot, que
resulta que és mecànic.

### Les tres regles que en surten, i que ja són codi

**1. Sense acta, no hi ha afirmació.** Els conjunts pitjors compartien un tret mesurable sense
llegir-ne cap: no citaven actes. Terrassa tenia vint-i-cinc afirmacions i **zero** actes —vint
notes de premsa i dos enllaços al nostre propi web per acreditar una xifra nostra. Amb premsa es
pot escriure el que sigui i sona bé. Ara `verificacio.ts` exigeix que **tres quartes parts** de
les afirmacions citin l'acteca de l'AOC perquè el conjunt es pugui respondre. Terrassa i
Barcelona han quedat fora i s'han retirat de producció.

**2. Cada cita ha d'existir literalment.** El verificador que va escriure l'autoria dels conjunts
de Lleida, Mataró i Reus extreu totes les cites entre «...» i comprova que siguin al PDF, sobre
alfanumèrics i ignorant salts de línia. **176 de 176.** Això ha de deixar de ser una eina d'un
encàrrec i passar a ser una passada obligatòria abans de publicar cap conjunt.

**3. La posició d'un partit surt d'un vot o no existeix.** `posicions.ts` només situa un grup per
quatre vies —l'acta el desglossa, l'evidència l'anomena, l'aritmètica dels escons no admet cap
altre repartiment, o els vots contraris no caben a l'oposició— i davant del dubte no diu res.

### El que això costa i per què val la pena

Els tres conjunts nous tenen el 100 % d'afirmacions lligades a un vot i cap cita inventada. Els
set originals tenien 60 afirmacions netes de 175. La diferència no és el talent de qui les va
escriure: és que els segons es van escriure amb el verificador engegat.

---

## Bloc 1 — Qui són i què cobren

És el bloc que la gent més busca i el que ningú no respon, i té una trampa que l'ha de governar
del tot.

**La trampa:** la retribució que paga l'ajuntament **no és el que cobra un electe**. Molts cobren
també d'empreses municipals, patronats, fundacions, consorcis, mancomunitats, el consell
comarcal, la diputació o l'Àrea Metropolitana. Cadascun ho publica en un lloc diferent, si el
publica.

**La conseqüència, i és una regla:** una xifra baixa perquè no hem trobat els complements és
**pitjor que no publicar-ne cap**, perquè exculpa. Si només podem donar la retribució de
l'ajuntament, s'ha de dir «això és el que li paga l'ajuntament, i no sabem si cobra d'algun altre
ens», i s'ha de dir al costat de la xifra i no en una nota al peu.

Hi ha una investigació en marxa sobre què es pot saber de debò: el dataset de retribucions de
l'AOC, les compensacions als electes de pobles petits (`bepu-nr6b`), els portals seu-e, els
organismes dependents (`iio-ii-organismes-dependents`, 718 files) i si els consells comarcals,
les diputacions i l'AMB publiquen les indemnitzacions dels seus membres. **Si la conclusió és que
no es pot fer honestament, no es fa.**

El que sí que ja tenim i s'ha de completar:
- **Fitxa de cada regidor**, feta: qui és, de quina llista va sortir i en quina posició, si és a
  l'equip de govern, si va entrar a mig mandat i si va canviar de grup.
- **Què ha votat, atribuït a la persona quan es pot.** Les actes no publiquen vots individuals,
  però quan un grup de divuit regidories hi posa divuit vots, tots divuit han votat allò: no
  queda ningú a qui atribuir un vot diferent. Quan el grup hi posa menys vots que regidories,
  algú no hi era o va votar a part, i llavors s'atribueix al grup i no a la persona.

---

## Bloc 2 — Què ha fet aquest govern

**El canvi de vara, que ja està fet i era el defecte més gros.** Els diners es comparaven amb la
mediana catalana, i això mesura població i no gestió: el 96 % dels pobles de menys de cent
habitants sortien «per sobre» i el 0 % de les ciutats de més de cinquanta mil, facin el que
facin els seus governs. Ara es comparen amb els municipis de la seva mida.

**El que hi falta:**
- **Sèrie temporal.** Totes les xifres de despesa són d'un sol any. L'única sèrie completa és el
  deute (2015-2025, 947 municipis) i no es dibuixa enlloc. «Com ha anat el deute comparat amb els
  del seu grup» és la peça que converteix una foto en un judici, i es pot fer sense cap dada nova.
- **La diferència en euros del pressupost sencer** al costat del percentil. Un percentil 76 sona
  molt; dir que són 2,8 milions d'euros l'any s'entén sol.
- **Dades noves amb sèrie**, que és el que està investigant l'altra recerca. El criteri: cobertura
  de 800+ municipis, que discrimini de veritat, amb sèrie temporal, i atribuïble a una decisió
  municipal —o si no ho és, dir-ho.

**El que s'ha retirat i per què**, perquè quedi escrit: el cost efectiu dels serveis (en
clavegueram, el percentil 90 és 507 vegades el percentil 10: no és un cost, és un apunt
comptable), la comparació del tipus d'IBI (correlaciona +0,08 amb el que es paga de veritat) i
quatre de les vuit barres del semàfor financer (dues parelles amb correlació 0,98 i 0,86 que
inflaven el comptador).

---

## Bloc 3 — El 2027, quan hi hagi programes i candidats

Aquesta és la part que encara no existeix i que ho canvia tot. El calendari mana:

| Quan | Què passa | Què fem |
|---|---|---|
| Fins al desembre del 2026 | No hi ha res del 2027 | Acabar l'Observatori i tancar les preguntes de mandat |
| Gener–març del 2027 | Els partits preparen candidatures | Escriure els conjunts dels municipis que en tindran |
| **Finals d'abril del 2027** | La Junta Electoral proclama les candidatures | Publicar les llistes i obrir el formulari perquè cada candidatura respongui |
| Maig del 2027 | Campanya | La brúixola oberta, amb les respostes que hagin arribat |

**Les dues columnes.** Fins ara la posició d'un partit la deduïm del seu vot. Quan les
candidatures responguin, en tindrem dues: **el que diuen** i **el que han fet**. Ensenyar-les una
al costat de l'altra és el producte de debò, i és una cosa que no fa ningú. Un partit que va
votar en contra d'una moció i ara diu que hi està d'acord no és necessàriament un mentider —potser
va votar en contra de qui la presentava—, però la pregunta és legítima i les dues dades hi han de ser.

**Els programes.** El llindar de publicació exigeix cinc afirmacions amb cita literal de programa
i **cap dels deu conjunts no el compleix**: no tenim cap programa del 2023 al repositori. Això és
la feina pendent més gran del bloc de preguntes, i té dues meitats: recollir els programes del
2023 dels municipis on ja hi ha conjunt, i muntar la recollida dels del 2027 quan surtin.

**Preguntes d'àmbit supramunicipal.** Hi ha temes que es voten a molts plens amb la mateixa
forma —fiscalitat, habitatge d'ús turístic, zones de baixes emissions, llengua— i que permeten
una espina dorsal comuna instanciada amb l'acta de cada poble. Això fa dues coses: baixa el cost
d'escriure un conjunt nou, i permet comparar municipis entre ells («al teu poble van votar això;
al del costat, el contrari»). El contingut ha de continuar sent local i sostingut per una acta
d'aquell ajuntament.

---

## Bloc 4 — Com ensenyar-ho

Res d'això val si no es llegeix. El que ha funcionat i s'ha de repetir:

- **Una frase abans que un gràfic.** «Governa el PSC tot i que la llista més votada va ser
  Trias» diu més que qualsevol barra.
- **La comparació sempre amb qui toca**, i dient quants són: «els 56 municipis catalans de
  10.001 a 20.000 habitants dels quals tenim la liquidació».
- **El buit s'ha de dir.** Un bloc que desapareix sense explicació fa pensar que no hi ha res a
  dir; 112 municipis no tenen liquidació i ara la fitxa ho diu.
- **El mapa**, que ensenya coses que una llista de 947 files no ensenya mai: on hi ha majoria
  absoluta, on no governa qui va guanyar, on mana la mateixa força des del 1979.
- **La mascota i el moviment.** No és decoració: una pàgina de dades que no es mou ni respira
  sembla un full de càlcul, i el que hi ha a dins és una decisió política que afecta la gent.

---

## Ordre d'execució

1. **Tancar el que ja està començat**: reingerir les actes amb l'extractor corregit (els vots mal
   atribuïts baixen del 19,5 % al 0,6 %), republicar-ho tot i desplegar.
2. **Fer del verificador de cites una passada obligatòria**, no una eina d'un encàrrec.
3. **Netejar o retirar els conjunts amb problemes** de l'auditoria, començant per les onze cites
   que no existeixen.
4. **Decidir sobre les retribucions** quan torni la investigació, amb la regla que abans que una
   xifra que exculpi, no en publiquem cap.
5. **Sèrie temporal del deute contra el grup** i la diferència en euros: cap dada nova, molt valor.
6. **Incorporar les fonts noves** que passin el filtre de cobertura, discriminació, sèrie i
   atribuïbilitat.
7. **Recollir els programes del 2023** dels municipis amb conjunt, que és el que bloqueja el
   llindar de tots deu.
8. **Muntar la recollida de respostes de les candidatures** per a l'abril del 2027.

## Els riscos, dits clar

| Risc | Què el conté |
|---|---|
| Publicar una cita que no existeix | El verificador literal, obligatori abans de publicar |
| Atribuir a un partit un vot que no va fer | Quatre vies de deducció i, davant del dubte, callar |
| Una xifra de sou que exculpi perquè no hem trobat els complements | No publicar-ne cap fins saber què hi falta, i dir-ho al costat |
| Comparar municipis que no es poden comparar | Grup de mida a tota comparació, i dir quants són |
| Semblar que prenem partit | Cap veredicte de gestió: la dada, la font i el context, i que jutgi qui llegeix |
| Que sembli un portal d'estadística | Tota pàgina acaba parlant del 23 de maig del 2027 |
