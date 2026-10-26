# quivoto — auditoria d'usabilitat i experiència d'usuari

> Annex del [pla de millores](PLA.md). Al pla, les troballes d'aquest document es citen amb el prefix **UX-** seguit del número o codi de l'apartat (per exemple, UX-5.1). Les referències `fitxer:línia` són del commit `e53c589` i es poden haver mogut.

Data: 26-10-2026. Només anàlisi: no s'ha tocat cap fitxer del repositori.

## Com s'ha fet

- **Web en directe** (quivoto.cat, /observatori/, fitxa d'Esplugues, fitxa de l'alcalde, mapa, dades, els947, comparador, brúixola de Badalona). Llegit amb WebFetch, que retorna un resum del text i no captures. El proxy bloqueja `curl` i no es podien fer captures del web en directe.
- **Pàgines generades en local** amb els *fixtures* dels tests: fitxa (Sabadell), regidora (Esplugues), portada de l'Observatori i brúixola de Badalona, aquesta amb el conjunt real `afirmacions/badalona.json`. Es van servir amb la landing real (`web/public`) en un servidor local i es van capturar amb Playwright a 390 px i a 1280 px, en mode clar i fosc. També s'hi va mesurar el desbordament horitzontal, el focus i el desplaçament.
- **Lectura de codi**: `capcalera.ts`, `cercador.ts`, `prova.ts`, `estil.ts`, `peu.ts`, `mapa-catalunya.ts`, `els947.ts`, `radiografia.ts`, `publish.ts`, `config.ts`, `tools/build_landing.py`. També s'ha comparat amb `design/prototip/*` i `design/MOVIMENT.md`.
- Les captures i l'HTML generat eren d'un entorn temporal i no s'han versionat. Per reproduir-les: generar les pàgines amb els *fixtures* i capturar-les amb Playwright a 390 i 1280 px.

Llegenda: **Esforç** S = menys d'un dia, M = 1–3 dies, L = una setmana o més. **Impacte**: alta, mitjana o baixa.

---

## 1. Arquitectura de la informació i navegació

### 1.1 La brúixola (el producte estrella) no és al menú
- **On**: `packages/pipeline/src/publish/capcalera.ts:57-65` (DESTINS) i la capçalera de la landing (`web/public/index.html:130`).
- **Problema**: el menú té Observatori, Els 947, Mapa, Comarques, Partits, Trajectòries i Comparador. «Les preguntes» i la demo de la brúixola només surten al peu i en una targeta de la landing. La landing promet «25 preguntes… i et diu qui pensa com tu», però des de cap capçalera no s'hi arriba. A més, el nom canvia segons la pàgina: «brúixola», «test», «preguntes», «Prova el test», «Demostració», «Respon les preguntes».
- **Per què importa**: el ciutadà ve a «a qui voto?» i el que troba és un portal de dades. No sap que ja pot provar la brúixola en 30 municipis.
- **Proposta**: afegir «Brúixola» com a primera o segona entrada del menú, cap a `preguntes/`, i fer servir un sol nom a tot el web («la brúixola»). Les pàgines `preguntes/` s'haurien de dir «La brúixola de X».
- **Esforç** S · **Impacte** alta

### 1.2 El menú de 7 entrades ocupa dues línies i ~150 px a dalt de cada pàgina en mòbil
- **On**: `estil.ts` `.capcalera .menu{flex-wrap:wrap}`. Es veu a les captures `v2-*-0.png`.
- **Problema**: a 390 px el menú baixa sencer en dues files a sobre del contingut, a totes les pàgines. És el 18 % de la primera pantalla abans de veure el nom del poble.
- **Proposta**: en mòbil, deixar una fila amb desplaçament horitzontal (scroll-snap, amb un indicador que n'hi ha més) o reduir-lo a «Brúixola · Municipis · Mapa · Més». El disseny ja diu «cap desplegable»: una fila lliscant ho respecta.
- **Esforç** S · **Impacte** mitjana

### 1.3 La landing barreja dos productes i la crida principal és un formulari de correu
- **On**: `tools/build_landing.py` (hero, `cerca_home`). Captura `v2-landing-0.png`.
- **Problema**: el primer que es veu és «A qui votes al teu poble?» amb un camp de correu i «Avisa'm». El cercador («Busca el teu municipi o electe») queda per sota de la mascota i del compte enrere, a la segona pantalla del mòbil. L'Observatori, que és el que funciona avui, és la tercera secció. Les xifres «25 afirmacions · 7 minuts · 200 municipis per començar» no quadren amb el que hi ha: 23 conjunts a `afirmacions/`, 30 a la portada i una demo.
- **Per què importa**: qui arriba avui no pot fer el que la portada li promet i no veu el que sí que pot fer.
- **Proposta**: posar el cercador dins del hero com a acció principal («Busca el teu poble») i el correu com a acció secundària. Afegir una línia d'estat honesta: «La brúixola obre el 2027; avui ja pots veure qui mana i què ha votat el teu ple». Treure la xifra «200» o fer-la sortir de les dades.
- **Esforç** S · **Impacte** alta

### 1.4 No hi ha camí de tornada clar des de la fitxa d'una persona
- **On**: `regidor.ts`. A la pàgina en directe de l'alcalde d'Esplugues només hi ha l'etiqueta petita «ESPLUGUES DE LLOBREGAT» a sobre del nom.
- **Problema**: no hi ha fil d'Ariadna (Observatori › Esplugues › Ple › Persona). Qui arriba des de Google o la cerca no sap on és. L'índex de la persona diu «Trajectòria» i «Transparència», però les seccions es diuen «Més enllà de l'ajuntament» i «Què en publica el seu ajuntament».
- **Proposta**: un `nav aria-label="Ets a"` amb un fil d'Ariadna a la fitxa de persona, de candidatura i de comarca. Fer coincidir el text de l'índex amb els títols.
- **Esforç** S · **Impacte** mitjana

### 1.5 «Esborrany» a tot arreu, fins i tot a les pàgines indexades
- **On**: `capcalera.ts:97` (etiqueta «esborrany · dades obertes»), `peu.ts:221` («Esborrany intern, encara no indexat»), `prova.ts` («esborrany»).
- **Problema**: el peu diu «encara no indexat» a totes les pàgines. Però les fitxes de municipi surten amb `index,follow` (`radiografia.ts:5134` amb `QUIVOTO_INDEXABLE=1`, i WebFetch ho confirma). En canvi, la portada de l'Observatori, els947, el mapa, el comparador, les comarques, la brúixola i les persones porten `noindex, nofollow` escrit a mà (`portada.ts:531`, `els947.ts:1142`, `mapa-catalunya.ts:767`, `comparador.ts:1539`, `regidor.ts:1715`…).
- **Per què importa**: un missatge de «esborrany intern» resta credibilitat a una eina electoral. A més, els hubs amb `nofollow` impedeixen que Google arribi a les fitxes si no és pel sitemap.
- **Proposta**: un sol interruptor (`INDEXABLE`) per a totes les pàgines públiques, i decidir explícitament si les persones s'indexen (és una qüestió de privadesa: documentar-ho). Canviar «esborrany» per «versió beta · dades revisades el …» i treure «encara no indexat» del peu.
- **Esforç** S · **Impacte** mitjana

---

## 2. Cerca (portada i capçalera)

### 2.1 La cerca de la landing calcula les adreces de les persones amb un slug diferent del del generador: hi haurà 404
- **On**: `tools/build_landing.py:381` (`function slug(s){return norm(s).replace(/\s+/g,'-')...}`) davant de `packages/pipeline/src/lib/text.ts:8-37`.
- **Problema**: el `normalize()` del pipeline converteix `·`, `'`, `’` i qualsevol caràcter que no sigui `[a-z0-9]` en espai. El de la landing no ho fa. Una persona que es digui «Gal·la», «D'Oliveira» o «Martí (Toni)» no té `exr` d'excepció, i a la landing tindrà l'enllaç `.../gal·la-.../`, quan el fitxer és a `.../gal-la-.../`, i això dona 404. El comentari de `cercador.ts` adverteix exactament d'aquest risc («copiada a mà… l'enllaç aniria a un 404»).
- **Proposta**: que el generador escrigui un `cerca-home.js` amb les mateixes funcions serialitzades (`clauCerca`, `slugify`, `classifica`) que fa servir `cercador.ts`, i que la landing el carregui. Una sola implementació. Afegir un test que compari els slugs de mostra.
- **Esforç** S · **Impacte** alta (enllaços trencats en noms catalans, que són precisament els habituals)

### 2.2 La cerca de la landing no ordena per rellevància i diu «cap coincidència» mentre carrega
- **On**: `tools/build_landing.py:375-395`.
- **Problema**:
  1. Fa servir `includes()` sobre la llista alfabètica (`cerca.ts:217` ordena per `k`). «sant» retorna Sant Adrià i Sant Agustí abans que Sant Cugat o Sabadell, i «marti» retorna 8 regidors qualssevol. La capçalera ja té un rànquing bo (`classifica`).
  2. Mentre `cerca.json` no ha arribat, o si falla, ensenya «No hi ha cap coincidència.», que és fals i no té cap `catch`.
  3. No funciona amb el teclat: no hi ha fletxes ni Intro per anar al primer resultat, i no hi ha `role=combobox` ni `aria-activedescendant`.
  4. No cerca comarques, partits ni candidatures, cosa que la capçalera sí que fa.
  5. Baixa 34 kB + 79 kB a l'obrir la portada, encara que l'usuari no cerqui mai. La capçalera només els baixa quan cal.
- **Proposta**: reutilitzar el mòdul de la capçalera (vegeu 2.1), carregar-lo en el primer `focus` del camp i mostrar «Carregant…» o «No s'ha pogut carregar la llista. Torna-hi».
- **Esforç** S · **Impacte** alta

### 2.3 El botó de tancar la cerca diu «Esc»
- **On**: `cercador.ts:76` (`<button value="tanca" class="cerca-tanca">Esc</button>`).
- **Problema**: al mòbil no hi ha tecla Esc, i el lector de pantalla llegeix «Esc». WebFetch el treu com a text solt a totes les pàgines.
- **Proposta**: un botó «Tanca» amb ×, `aria-label="Tanca la cerca"`, i el `<kbd>Esc</kbd>` només com a pista visual a partir de 768 px.
- **Esforç** S · **Impacte** mitjana

### 2.4 La cerca falla en silenci si no hi ha xarxa
- **On**: `cercador.ts` `baixa()`. Al `catch` posa `dades = {mun:[]…}` i acaba ensenyant «Cap resultat.».
- **Proposta**: un missatge d'error explícit amb l'enllaç a `els947.html`, que funciona sense JS.
- **Esforç** S · **Impacte** baixa

### 2.5 Recordar «el meu poble»
- **Proposta**: després de visitar una fitxa, desar el *slug* a `localStorage` (amb try/catch) i oferir a la landing i a l'Observatori «Tornar a Esplugues de Llobregat». És la principal tasca recurrent del ciutadà.
- **Esforç** S · **Impacte** mitjana

---

## 3. Fitxa de municipi (radiografia)

### 3.1 La fitxa és massa llarga per a un ciutadà: 19 seccions i més de 15.000 paraules
- **On**: `radiografia.ts:4689-5234`. A la fitxa en directe d'Esplugues hi ha 19 enllaços a l'índex. La fitxa de prova, amb una part de les dades, ja fa 15.800 px en mòbil (`v2-fitxa-*.png`).
- **Problema**: el que vol saber la majoria (qui mana, què ha fet, què em costa, què es vota el 2027) queda barrejat amb vehicles, agermanaments, cens des del 1979 o la sèrie de la participació. Hi ha 26 desplegables de «La lletra petita». L'índex en pastilles ocupa 4 files en mòbil i no fa d'àncora fixa.
- **Proposta**:
  1. Separar la fitxa en dos nivells: un **resum** (hero, cinc xifres, «Què t'hi jugues», qui mana, el balanç del mandat i tres canvis clau) i, a sota, **«Per aprofundir»** amb grups plegats (`<details>` per bloc o pestanyes per tema: Diners, Serveis, Gent, Eleccions, Seguretat).
  2. Fer l'índex enganxós (`position:sticky`) i lliscant en mòbil, amb la secció activa marcada (el `SEGUIDOR_INDEX` ja la calcula).
  3. Un enllaç «Torna a dalt / a l'índex» al final de cada secció.
- **Esforç** M · **Impacte** alta

### 3.2 Hi ha massa jargó sense explicar
- **On**: el text de les seccions de comptes, contractes i sous. Exemples de la fitxa en directe: «estalvi net», «saldo no financer», «càrrega financera», «capítol 6 liquidat», «període mitjà de pagament», «quota íntegra», «liquidació / obligacions reconegudes netes», «tinença d'alcaldia», «sense dedicació», «regidoria no adscrita», sigles (AOC, ACA, ARC, DGT, ISPA…).
- **Problema**: el projecte ja té `glossari.ts`, però a la fitxa els termes no porten cap explicació en línia. Algunes files sí que porten una subetiqueta («deute viu a 31 de desembre dividit pel padró»), i això funciona bé.
- **Proposta**: fer servir el glossari amb `<abbr>` / `<dfn>` i un popover accessible (`<button aria-describedby>`). Posar sempre primer la frase en llenguatge planer i després el terme tècnic entre parèntesis: «Diners que li sobren cada any (estalvi net)». Fer una passada editorial amb una llista de termes prohibits als titulars.
- **Esforç** M · **Impacte** alta

### 3.3 La pastilla «Mana des de» surt sense any
- **On**: `radiografia.ts:4349-4368`.
- **Problema**: si no hi ha `continuitat`, la tessel·la diu «MANA DES DE · PSC-CP · la llista més votada» sense cap data (captura `v2-fitxa-0.png`). L'etiqueta promet un «des de» que no hi és.
- **Proposta**: quan `desDe === ""`, canviar l'etiqueta per «Qui mana».
- **Esforç** S · **Impacte** baixa

### 3.4 Incoherències de recompte que el ciutadà detecta
- **On**: la fitxa en directe d'Esplugues (segons WebFetch, cal verificar-ho sobre l'HTML).
- **Problema**: la capçalera de grup diu «PSC-CP 10» mentre el resum diu «11 de 21». La taula d'alcaldies mostra dos alcaldes en el mandat 2023-2027 i el text diu «cinc persones des del 1979».
- **Per què importa**: en una web que viu de la confiança, una xifra que no quadra fa dubtar de totes. Probablement és un recompte de membres del grup actual davant d'escons obtinguts, o un canvi de regidor.
- **Proposta**: quan dues xifres semblin la mateixa cosa i no ho siguin, dir-ho («10 regidors al grup avui · 11 escons el 2023: 1 ha passat a no adscrit»). Afegir un test de coherència del hero contra els blocs.
- **Esforç** S · **Impacte** mitjana

### 3.5 Les gràfiques en mòbil tenen etiquetes de ~8–9 px i la línia que surt del marc
- **On**: `estil.ts:697-717` (`.eleccions .tros{font-size:.55rem}`, `.peu-any b{font-size:.58rem}`), `grafics.ts` (eixos), `candidatura.ts:526-538`. Captura `v2-fitxa-2.png`: a «Deute per habitant, any a any» els valors dels eixos i el «Farrés» són il·legibles, i la sèrie arriba fins al marge dret sense punt ni valor.
- **Proposta**: fer servir 11–12 px com a mínim a les etiquetes (i 0,75rem com a mínim a tot el text). Etiquetar directament l'últim valor de la sèrie («2025: 450 €»). En mòbil, treure eixos i deixar el primer i l'últim valor escrits. Hi ha 14 regles amb menys de 0,68rem (vegeu també 7.3).
- **Esforç** M · **Impacte** mitjana

### 3.6 Taules amples que desborden en mòbil
- **On**: portada de l'Observatori, `.comarques-taula` (`scrollWidth` 414 / 392 px amb 390 px de pantalla; la quarta columna queda tallada a `v2-portada-1.png`). També la pastilla «Independents de la Selva» surt del contenidor.
- **Proposta**: posar `overflow-x:auto` amb una ombra d'indicació al contenidor de les taules, o passar a llista apilada sota els 480 px. Afegir un test Playwright que comprovi `scrollWidth <= innerWidth` a 320 i 390 px a totes les plantilles. El codi ja té aquest tipus de regressió documentada (`radiografia.ts:5220`).
- **Esforç** S · **Impacte** mitjana

---

## 4. Fitxa de persona (regidor)

### 4.1 La primera secció és un «no ho sabem» de tres paràgrafs
- **On**: `regidor.ts`, secció «Què cobra». Captura `v2-regidor-0.png`.
- **Problema**: el primer que es llegeix d'una persona és un text llarg sobre per què no tenim el sou. A la fitxa en directe de l'alcalde: «Què cobra» sense import, «Punts votats: no disponible», assistència desconeguda i cronologia de dues línies. A més, el text de la font surt enganxat: «Ajuntament d'Esplugues de Llobregatalcaldia».
- **Proposta**:
  1. Ordenar per valor: primer qui és (càrrec, grup, govern/oposició, des de quan), després què ha votat i l'assistència si n'hi ha, i el sou al final si és buit.
  2. Unificar els buits en una sola caixa compacta: «Encara no sabem: sou · vots individuals · assistència. Per què?» amb un desplegable.
  3. Corregir la concatenació de la font, que és un espai o un separador que falta.
- **Esforç** S · **Impacte** mitjana

### 4.2 No hi ha OG ni forma de compartir la fitxa d'una persona
- **On**: `regidor.ts` (0 `og:image`, i tampoc a `prova.ts`, `portada.ts`, `els947.ts`, `mapa-catalunya.ts`, `comparador.ts`, `dades.ts`).
- **Problema**: quan algú enganxa l'enllaç d'una persona, del mapa o del comparador a WhatsApp o X, no surt cap targeta. Només el tenen les fitxes de municipi, candidatura i partit.
- **Proposta**: generar un `og:image` genèric per tipus de pàgina (i per persona: nom, càrrec, sigla i municipi, amb el `og.ts` que ja existeix) i afegir `og:title` i `og:description`.
- **Esforç** M · **Impacte** mitjana

---

## 5. Brúixola (prova)

### 5.1 En mòbil, en prémer «Comença» la pregunta queda fora de la pantalla
- **On**: `prova.ts:478` (`$("comenca")…intro.hidden = true; test.hidden = false; pinta();`).
- **Problema**: mesurat amb Playwright a 390×844, el botó «Comença» és a y = 1.176. Després de prémer-lo, la pàgina es manté a scrollY = 769 i la targeta queda a −520 px. **L'usuari veu el peu de pàgina** (`v2-prova-q.png`) i ha d'endevinar que ha de pujar. A més, el focus cau al `<body>`.
- **Proposta**: després de mostrar `#test`, fer `scrollTo({top:0})` (o `scrollIntoView` de la targeta) i moure el focus al títol de l'afirmació (`h2 tabindex="-1"`). Fer el mateix a `acaba()`, «Afina-ho» i «Torna-hi».
- **Esforç** S · **Impacte** alta

### 5.2 «Això m'importa molt» va després de l'escala, però respondre ja passa a la pregunta següent
- **On**: `prova.ts:279-286` i `respon()`.
- **Problema**: el flux natural és llegir, respondre i veure el botó d'importància quan ja és tard, perquè la resposta avança sola. Per marcar-ne una com a important cal fer-ho *abans* de respondre o tornar enrere. El prototip (`design/prototip/bruixola.html:366-377`) el posa **abans** de l'escala amb la nota «compta el doble».
- **Proposta**: seguir el prototip: el botó a dalt, amb la nota «compta el doble». O bé no avançar fins a prémer «Següent» (és més lent) o donar 600 ms per poder marcar-la abans d'avançar.
- **Esforç** S · **Impacte** alta (afecta el resultat)

### 5.3 Una pastilla buida de districte apareix a totes les preguntes
- **On**: `prova.ts:66` (`.districte{display:inline-block…}`) amb `<span class="districte" hidden>`.
- **Problema**: `display:inline-block` anul·la l'atribut `hidden`, i surt una pastilla lavanda buida al costat del tema (`v3-prova-q.png`). El prototip ja ho resol amb `[hidden]{display:none!important}`.
- **Proposta**: afegir `[hidden]{display:none!important}` a `RADIOGRAFIA_CSS`, perquè el mateix risc existeix a tot el web.
- **Esforç** S · **Impacte** mitjana

### 5.4 Abans de començar hi ha un mur de text
- **On**: `prova.ts:254-293`. Captura `v2-prova-0.png`.
- **Problema**: l'avís de demostració són 4 paràgrafs (tipus de deducció, grups bessons…) i el botó queda a la segona pantalla. Frases com «De 25 afirmacions, 0 surten de l'acta llegida; 5 de l'evidència…; 8 dels números» són de metodologia, no d'usuari, i amb 13 de 25 situades l'usuari pot sospitar que la meitat no compten.
- **Proposta**: una línia («Demostració: les posicions surten de com ha votat cada grup al ple. Com ho fem →») i el botó a dalt. Moure el detall a «Com es calcula» al resultat, que és el que fa el prototip `resultat.html`.
- **Esforç** S · **Impacte** mitjana

### 5.5 Al resultat: empats, grups amb poques dades i res per compartir
- **On**: `prova.ts:400-433`. Captura `v2-prova-res-0.png`.
- **Problema**:
  1. «T'assembles més a X» es diu encara que el segon estigui a 1 punt o empatat.
  2. Els grups amb menys de 5 afirmacions situades surten dins del rànquing amb opacitat 0,5, i el contrast baixa a ~3,2:1. El prototip els treu del rànquing en una caixa «Dades insuficients», amb un llindar de 10 de 25.
  3. No hi ha cap acció de compartir. El prototip té «Comparteix-ho» amb un enllaç sense respostes i una imatge OG del resultat.
  4. No es recupera la sessió: les respostes es desen a `localStorage`, però en tornar comença des de zero, sense «Continua on ho havies deixat».
  5. No hi ha «Què diuen / Què han fet», que és el valor diferencial del prototip (per al 2027).
- **Proposta**: un titular amb marge («Empat entre A i B»), separar la caixa d'insuficients, un botó de compartir (Web Share i copiar enllaç amb el rànquing sense respostes), i reprendre la sessió.
- **Esforç** M · **Impacte** alta

### 5.6 Accessibilitat del test
- **On**: `prova.ts`.
- **Problema**:
  - No hi ha `aria-live` ni s'anuncia la pregunta nova.
  - La barra de progrés no té `role="progressbar"`, cosa que el prototip sí que fa.
  - L'escala són 5 botons `aria-pressed` i no un `radiogroup`.
  - Les dreceres 1–5, O i E no estan documentades. El prototip les ensenya al peu.
  - En mòbil, l'etiqueta de l'escala és de 0,6rem (9,6 px) (`prova.ts:112`) i «Totalment d'acord» es parteix.
  - La resposta triada té el text clar sobre el coral: 2,87:1.
  - Sense JS, «Comença» no fa res i no hi ha `<noscript>`.
- **Proposta**: aplicar el patró del prototip: `moviment.radiogrup()`, `progressbar`, focus al títol, `aria-live="polite"` amb «Pregunta 3 de 25», etiquetes de 12 px com a mínim (es poden posar a sota en dues línies o deixar només els extrems «Gens / Totalment» a sobre de l'escala), tinta fosca sobre el coral i un `<noscript>` amb l'enllaç a la llista d'afirmacions.
- **Esforç** M · **Impacte** mitjana

### 5.7 Petites desviacions de `design/MOVIMENT.md`
- **On**: `prova.ts:46` i `:93` animen `width` amb `ease` i 0,5 s. També hi ha 20 o més `transition:… .12s ease` a `estil.ts`, `portada.ts`, `partit.ts` i a la landing (`.boto`).
- **Problema**: el document ho prohibeix explícitament («Cap `ease` per defecte», «mai `width`», «només `transform` i `opacity`», tres durades). No és un problema d'usuari greu, però trenca el contracte i la fluïdesa en mòbils modestos.
- **Proposta**: passar a `transform:scaleX(var(--valor))` i als *tokens* `--t-mig`/`--corba-suau`. Afegir un test que busqui `ease[;,} ]` i `transition:width` al CSS generat.
- **Esforç** S · **Impacte** baixa

---

## 6. Mapa

### 6.1 Els 947 enllaços del mapa són inaccessibles i fan nosa al teclat
- **On**: `mapa-catalunya.ts:714` i `:803` (`<svg role="img">` amb 947 `<a>` a dins).
- **Problema**: amb `role="img"`, els fills són presentacionals per als lectors de pantalla, però els `<a>` continuen sent focusables. Qui navega amb el teclat ha de fer 947 tabulacions per sortir del mapa, sense saber on és. No hi ha cap taula de valors de la capa: la llista alfabètica del final només porta enllaços, no la dada.
- **Proposta**: treure els `<a>` del recorregut de tabulació (`tabindex="-1"`) i oferir un «Salta el mapa» i una **taula de la capa activa** (municipi, valor, graó) ordenable, plegada en un `<details>`. Això respon també a «on queda el meu poble?».
- **Esforç** M · **Impacte** mitjana

### 6.2 En mòbil no hi ha manera de trobar ni de previsualitzar el teu municipi
- **On**: `mapa-catalunya.ts:950` (el tooltip només s'activa amb `(hover: hover)`).
- **Problema**: en pantalla tàctil, tocar un municipi navega directament, sense veure'n el valor. Els municipis petits són de 2–3 px i no hi ha zoom. Hi ha 13 capes generals més 15 de partit, totes amb botons.
- **Proposta**: (a) un camp «Troba el teu poble al mapa» que el ressalti i ensenyi la targeta; (b) en tàctil, el primer toc ensenya la targeta (amb «Obre la fitxa →») i el segon navega; (c) un `select` per a les capes en mòbil.
- **Esforç** M · **Impacte** mitjana

---

## 7. Accessibilitat transversal

### 7.1 El botó principal de la landing no arriba al contrast mínim
- **On**: `web/public/assets/styles.css` `.boto{background:var(--coral);color:var(--paper)}` i la banda `.final`.
- **Problema**: el text #FBF7EE sobre #E2735A fa 2,87:1. El text és de 16 px en negreta, i no compta com a text gran. WCAG AA demana 4,5:1. El mateix passa al botó triat de la brúixola. El codi ja ho sap (`--coral-text`), però no ho aplica als fons.
- **Proposta**: tinta fosca (#1E1B2E) sobre el coral, que fa ~6,5:1 i és el patró de les pastilles, o un coral fosc (#C24429) de fons per als botons.
- **Esforç** S · **Impacte** mitjana

### 7.2 L'atribut `hidden` no és fiable
- Vegeu 5.3. Cal una regla global `[hidden]{display:none!important}`.
- **Esforç** S · **Impacte** mitjana

### 7.3 Text massa petit
- **On**: 14 regles entre 0,55 i 0,66rem (8,8–10,6 px): `estil.ts:149, 476, 589, 651, 697, 703, 715, 717, 1248`, `candidatura.ts:526-538`, `prova.ts:112`. A la fitxa de prova hi ha 16–22 elements visibles amb menys d'11 px.
- **Proposta**: un *token* mínim `--mida-menut: .75rem` (12 px) i un test que el comprovi al CSS generat.
- **Esforç** S · **Impacte** mitjana

### 7.4 Coses que ja estan bé (cal mantenir-les)
- `lang="ca"` i `lang="es"`, enllaç «Ves al contingut», un sol `h1` per pàgina amb jerarquia h2/h3 correcta, `:focus-visible` amb contrast, fotos amb `alt=""` i nom al costat, taula accessible al costat de cada gràfica de sèrie, mode fosc coherent (`v3-fitxa-dark.png`), `prefers-reduced-motion`, i cap control sense JS que no faci res (a la capçalera).

---

## 8. Llegibilitat de xifres per a un ciutadà

### 8.1 Les dates en format ISO i la frescor no es veuen on toca
- **On**: `peu.ts:217` («Generat el 2026-09-03»).
- **Problema**: un ciutadà llegeix «3 de setembre de 2026» i no «2026-09-03». Tampoc no veu, al costat de cada bloc, de quin any és la dada: n'hi ha de 2023, de 2025 i de 2026 barrejades a la mateixa fitxa.
- **Proposta**: data en català al peu, i «Dades de: 2025 · Font» (un *timestamp* curt) a la capçalera de cada bloc o tessel·la. La regla de dades del README («cada dada porta any o període») ha de ser visible a primer cop d'ull.
- **Esforç** S · **Impacte** mitjana

### 8.2 Les etiquetes de filtre són ambigües
- **On**: `els947.ts:577` («Deute per sobre de ${xifra(l.deute)} €», que al web surt com **«Deute per sobre de 2 €»**) i `:599` («Hi entra menys de 15.813 € per persona»).
- **Problema**: falta «per habitant» i el valor de 2 € sembla un error de llindar o d'unitats (cal verificar `llindarsDe`). «Hi entra» no s'entén.
- **Proposta**: «Deute per habitant per sobre de la mediana (X €)» i «Renda per persona per sota de la mediana (15.813 €)». Comprovar el càlcul de `l.deute`.
- **Esforç** S · **Impacte** mitjana

### 8.3 Comparacions amb «la mediana» i percentils
- **On**: les tessel·les de la fitxa («més que 4 de cada 10 dels de la seva mida», «millor que el 60 %»).
- **Problema**: la idea és bona, però «el poble del mig de la seva mida» i «millor que el 60 %» conviuen amb altres formats. A més, «millor» és un judici: per al deute, menys és millor, però per a la despesa no és evident.
- **Proposta**: un sol format a tot el web («Per sobre de 6 de cada 10 municipis semblants») i evitar «millor/pitjor» llevat que hi hagi un criteri explícit.
- **Esforç** S · **Impacte** baixa

---

## 9. Confiança, fonts i correccions

### 9.1 No hi ha manera visible de comunicar un error
- **On**: `peu.ts` (no hi ha cap enllaç «Has vist un error?»). Només s'esmenta a la política de privadesa.
- **Problema**: en una eina electoral, un regidor o un veí que detecta una dada errònia ha de poder dir-ho en un clic. A més, és un senyal de confiança.
- **Proposta**: un enllaç per pàgina «Has vist un error en aquesta pàgina?» → `mailto:hola@quivoto.cat?subject=Error a <URL>` (o un formulari), i un registre públic de correccions («Corregit el …») a la fitxa, cosa que la política ja promet.
- **Esforç** S · **Impacte** alta

### 9.2 Falta una pàgina de mètode amb llenguatge planer
- **Problema**: hi ha `docs/METODOLOGIA.md` al repositori, però al web no hi ha «Com ho fem» a la capçalera ni al peu. Frases com «Sense cap model de llenguatge pel mig» són de tecnòleg, no de ciutadà.
- **Proposta**: una pàgina `/observatori/metode/` d'una pantalla (d'on surten les dades, què vol dir «sense dades», com es calcula la brúixola, qui ho fa i amb quins diners), enllaçada al peu i a cada «La lletra petita». Canviar el lema per «Fet amb dades oficials, sense inventar res: cada xifra porta la seva font».
- **Esforç** S · **Impacte** mitjana

### 9.3 Google Analytics sense consentiment
- **On**: `publish.ts:54-70` (injectat a tots els HTML) i `web/public/index.html:115-122`.
- **Problema**: GA4 desa identificadors (`_ga`) sense cap bàner ni consentiment previ. La política de privadesa ho reconeix i proposa bloquejar-ho des del navegador. Per a un projecte que fa bandera de «les teves respostes no surten del navegador», és un contrasenyal, i a la UE requereix consentiment (LSSI, art. 22).
- **Proposta**: passar a una analítica sense galetes (Plausible, GoatCounter o el mode sense galetes de GA amb Consent Mode «denied» per defecte) o afegir un bàner amb «Rebutja» igual de visible que «Accepta». No carregar mai GA a la brúixola.
- **Esforç** S · **Impacte** alta (confiança i legal)

---

## 10. Pàgina de dades

### 10.1 No serveix per a un no-expert
- **On**: `/observatori/dades/` (`dades.ts:1608`).
- **Problema**: la pàgina és bona per a periodistes (llicències, esquema, «això no és una API»), però no diu la mida dels fitxers, no ensenya cap vista prèvia i el diccionari (`ESQUEMA.md`) és un Markdown cru. Un ciutadà no sap que pot baixar «el seu poble» en un clic.
- **Proposta**: (a) un botó «Baixa les dades d'aquest municipi (CSV)» a cada fitxa; (b) la mida i el nombre de files al costat de cada fitxer; (c) el diccionari renderitzat com a taula HTML amb cerca; (d) una vista prèvia de 5 files.
- **Esforç** M · **Impacte** baixa

---

## 11. Rendiment i pes

### 11.1 68 kB de CSS repetits a cada pàgina i sense memòria cau
- **On**: `estil.ts:1343` (`RADIOGRAFIA_CSS` = 68.127 caràcters), incrustat a les 947 fitxes, 4.807 persones i 2.626 candidatures. També `prova.ts` i `GRAFICS_CSS`.
- **Problema**: la decisió és conscient (fitxa autònoma i arxivable). El preu és que cada navegació entre fitxes rebaixa ~68 kB de CSS (~12 kB amb gzip) i no se'n pot fer memòria cau. Les fitxes en directe són molt llargues (centenars de kB d'HTML).
- **Proposta**: un full `observatori.css?v=hash` comú enllaçat, i deixar el CSS en línia només per a l'exportació «arxivable». Fer `content-visibility:auto` a les seccions de sota la línia de flotació. Mesurar Lighthouse en mòbil: l'objectiu de MOVIMENT és ≥ 90.
- **Esforç** M · **Impacte** mitjana

### 11.2 El compte enrere estàtic queda desactualitzat
- **On**: landing (`Falten 262 dies` a l'HTML generat el 3 de setembre, quan avui en falten 209).
- **Problema**: sense JS, i per als rastrejadors i les previsualitzacions, el número és fals.
- **Proposta**: regenerar la landing cada dia (cron) o escriure «el 23 de maig de 2027» sense número a l'HTML base.
- **Esforç** S · **Impacte** baixa

---

## 12. Versió castellana

### 12.1 Mig traduïda
- **On**: `web/public/es/index.html:130-132`, `tools/build_landing.py` (dict `T['es']`).
- **Problema**: la portada en castellà enllaça un menú en català (Observatori, Els 947…). L'Observatori i la brúixola només existeixen en català. A la landing en català, «Castellano» porta a quienvoto.es marcat «Aviat». El consentiment en castellà enllaça `/privadesa.html` (català), cosa que cal verificar segons com es mapi quienvoto.es.
- **Per què importa**: a l'àrea metropolitana, una part rellevant de l'electorat llegeix més còmodament en castellà. Una brúixola que no s'entén no es fa servir.
- **Proposta**: com a mínim, traduir les etiquetes del menú i avisar «El Observatorio está en catalán; los nombres y cifras se entienden igual». A mitjà termini, generar en castellà la brúixola (afirmacions i escala) i el resum de la fitxa: el pipeline ja té els textos centralitzats per pàgina.
- **Esforç** L · **Impacte** mitjana

---

## 13. Diferències amb `design/`

| Proposta del disseny | Estat al web | Acció |
|---|---|---|
| Brúixola: pes «m'importa» abans de l'escala, amb «compta el doble» (`bruixola.html:366`) | Després de l'escala i sense explicació | 5.2 |
| `role=progressbar` i text «1 de 5» | Barra sense rol | 5.6 |
| Escala com a `radiogroup` (`moviment.radiogrup`) | 5 botons `aria-pressed` | 5.6 |
| Dreceres de teclat visibles al peu | Hi són però amagades | 5.6 |
| Cites «D'on surt» a cada targeta | Només al resultat | considerar-ho |
| Resultat: caixa «Dades insuficients» (<10 de 25) fora del rànquing | Dins del rànquing en gris (<5) | 5.5 |
| «Comparteix-ho»: enllaç sense respostes i imatge OG | No n'hi ha | 5.5 |
| «Què diuen / Què han fet» | No n'hi ha (és per al 2027) | full de ruta |
| Portada (`portada.html`): «Tria el teu municipi» com a primera acció i un estat de cobertura per municipi («Què vol dir cada estat») | Landing amb el correu primer; sense estat de cobertura per municipi | 1.3 |
| Radiografia (`radiografia.html`): «La cobertura de dades de Sabadell» i «Què no et podem dir» com a bloc visible | Existeix «Què en sabem i què no», al final | pujar-ne un resum al hero (p. ex. «Cobertura: 14 de 19 blocs») |
| MOVIMENT: només `transform/opacity`, sense `ease`, tres durades | Diverses infraccions | 5.7 |
| `[hidden]{display:none!important}` a `base.css` | No n'hi ha | 5.3 / 7.2 |

---

## 14. Oportunitats de dades amb impacte d'usabilitat (breu)

- **Estat de cobertura per municipi**, visible a la cerca i a la llista: «Fitxa completa / parcial / brúixola disponible». Ja hi ha prou dades (`x` = té radiografia, conjunts d'afirmacions).
- **Calendari electoral pràctic**: data límit del vot per correu, on es vota (cens/meses de l'INE quan es publiquin) i candidatures proclamades (BOP, abril de 2027). Al ciutadà li resol «què he de fer», no només «a qui».
- **Programes electorals de 2023 enllaçats** a cada candidatura, per alimentar el futur «Què diuen / Què han fet».

---

## Top 10 prioritzat

| # | Troballa | Esforç | Impacte |
|---|---|---|---|
| 1 | **5.1** Brúixola en mòbil: «Comença» deixa l'usuari al peu, i el focus es perd | S | alta |
| 2 | **2.1 + 2.2** La cerca de la landing té un slug divergent (404 en noms amb `·` i `'`), no té rànquing i diu «cap coincidència» mentre carrega: unificar-la amb `cercador.ts` | S | alta |
| 3 | **5.2** «M'importa molt» després de respondre: moure'l abans de l'escala, com al prototip | S | alta |
| 4 | **1.1 + 1.3** Posar la brúixola al menú amb un sol nom, i fer de la cerca l'acció principal de la landing, amb xifres honestes | S | alta |
| 5 | **9.3** Google Analytics sense consentiment: passar a analítica sense galetes o posar un bàner amb rebuig | S | alta |
| 6 | **9.1** «Has vist un error?» a cada pàgina i un registre de correccions visible | S | alta |
| 7 | **3.1 + 3.2** Fitxa de municipi en dos nivells (resum i «per aprofundir»), índex enganxós i glossari en línia per al jargó | M | alta |
| 8 | **5.3 / 7.2 + 7.1 + 7.3** Regla global `[hidden]`, contrast del coral als botons (2,87:1) i un mínim de 12 px al text | S | mitjana |
| 9 | **5.5** Resultat de la brúixola: empats, caixa «dades insuficients», compartir i reprendre la sessió | M | alta |
| 10 | **1.5 + 4.2** Treure «esborrany intern» del peu, unificar l'indexació i posar OG a persona, mapa, comparador i brúixola | S–M | mitjana |
