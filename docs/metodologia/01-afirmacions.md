# Com triem les afirmacions

> **Estat a 29 d'agost de 2026.** Aquest document descriu el mètode que aplicarem per triar
> les afirmacions de cada municipi. D'això, avui està implementat: **el recompte de cobertura
> d'actes per municipi** (`minutesCoverage()` a `packages/pipeline/src/adapters/aoc.ts`), d'on
> surten les xifres de 25.902 actes i 855 municipis que se citen aquí; i **el càlcul que
> consumirà les afirmacions** un cop existeixin, amb els desempats i la detecció de *shoot-out*
> (`packages/shared-schemas/src/matching.ts`, 14 tests que passen).
> No està implementat res més: **cap afirmació escrita, cap municipi publicat amb brúixola**.
> A l'esquema de base de dades no hi ha taules d'afirmacions, de posicions, de cites ni de
> mocions; no s'ha descarregat mai cap acta; no hi ha agent, ni cua de revisió, ni analítica,
> ni pàgina de canvis.
> La resta d'aquest document és compromís, no descripció. Ho marquem secció a secció.

Cada municipi de quivoto tindrà **25 afirmacions**. Seran la columna vertebral del portal: si
estan mal triades, tota la resta —posicions, evidència, percentatge— mesura una cosa que no
importa a ningú. Aquí expliquem d'on sortiran, com es redactaran, com es triarà el conjunt i
quan es retiraran.

Documents germans: [02-posicions.md](02-posicions.md) (on és cada candidatura),
[03-actes-i-mocions.md](03-actes-i-mocions.md) (com llegirem els plens),
[04-coincidencia.md](04-coincidencia.md) (el càlcul, ja implementat) i
[05-neutralitat-i-dades.md](05-neutralitat-i-dades.md) (drets, correccions i dades obertes).

## Què és una afirmació

Una frase que descriu **una decisió política concreta que l'ajuntament pot prendre**, i
davant la qual una persona pot dir que hi està totalment d'acord, més aviat d'acord, ni una
cosa ni l'altra, més aviat en desacord o totalment en desacord.

No és una pregunta d'opinió general («t'agrada el teu barri?»), ni un valor («la ciutat ha
de ser justa»), ni un fet comprovable («l'IBI ha pujat un 4%»). És una proposta de futur
sobre la qual dos partits del mateix ple poden votar diferent.

Fins a 5 de les 25 podran ser de tipus **més/menys** («Quants diners ha de dedicar
l'Ajuntament a X?»: molts menys · menys · igual · més · molts més), amb la mateixa escala i
el mateix tracte. L'escala de cinc punts −2..2 que rebrà el càlcul sí que està implementada
(`packages/shared-schemas/src/types.ts`).

## El procés, en cinc passos

> ⏳ **Encara no construït.** Cap dels cinc passos existeix: no hi ha extracció de temes, ni
> agent, ni cua de revisió, ni cap afirmació proposada. El desbloqueja el pipeline d'actes
> descrit a [03-actes-i-mocions.md](03-actes-i-mocions.md), que és el que ha de donar la
> matèria primera del pas 1.

| Pas | Qui | Què en sortirà |
|---|---|---|
| 1. Reunir matèria primera | Pipeline (determinista) | 60–100 temes locals amb evidència citada |
| 2. Proposar | Agent d'IA | Un *pool* de ~35 afirmacions amb predicció de posició |
| 3. Seleccionar el conjunt | Agent + regles de quota | 25 en viu + 10 de reserva |
| 4. Revisar i aprovar | Persones (editor + lectura contrària) | Text final ca/es/oc, context, estat `published` |
| 5. Vigilar i retirar | Analítica agregada + avisos dels lectors + editor | Substitucions des de la reserva |

Cap afirmació es publicarà sense que **una persona l'hagi aprovada**. L'agent proposarà; no
publicarà. Aquest compromís es podrà comprovar el dia que existeixi el registre públic de
canvis de `/canvis` ([05-neutralitat-i-dades.md](05-neutralitat-i-dades.md)), on cada
publicació ha de dur signatura.

## D'on surten els temes

> ⏳ **Encara no construït**, amb una excepció: la cobertura d'actes ja està comptada. Sabem
> quantes actes hi ha per municipi, però **no n'hem descarregat ni llegit cap**. Ni el
> registre de mocions, ni els programes, ni els feeds de premsa existeixen encara.

**1. Els punts del ple amb vot no unànime.** Serà la font principal. Del registre de mocions
([03-actes-i-mocions.md](03-actes-i-mocions.md)) sortirà, per a cada municipi, la llista de
punts de l'ordre del dia amb el vot per grup, ordenats per **polarització**: com de repartit
queda el ple entre el sí i el no, ponderat per regidors. Un punt on 14 regidors voten sí i
13 voten no és millor matèria primera que un aprovat per unanimitat: sabrem del cert que hi
ha desacord real, sabrem qui és a cada banda i el vot és públic i citable. Aquests punts
donaran també el pont determinista vot → posició (una taula `statement_links`, encara no
existent a l'esquema, amb la relació «sí vol dir d'acord» o «sí vol dir en desacord»).

> ✅ **Implementat**, només això: la **cobertura**. 25.902 actes des del 17 de juny de 2023;
> 855 dels 947 municipis en tenen alguna al feed de l'AOC i 646 en tenen 20 o més. Ho compta
> `minutesCoverage()` (`packages/pipeline/src/adapters/aoc.ts`), que fa un recompte per ens
> contra el CKAN de dades obertes. És un índex: **cap d'aquestes actes no s'ha obert**.

**2. Els programes electorals del 2023.** Compromisos concrets i datats de cada candidatura.
Serviran per proposar afirmacions sobre temes que el ple no ha arribat a votar, i per
mesurar la distància entre el que es va prometre i el que s'ha votat. Encara no n'hem
recollit cap.

**3. La premsa local.** Els feeds per municipi donaran les polèmiques que el ple encara no ha
tractat, o que ha tractat sense votació formal. Serà la font més fràgil (agenda del mitjà,
cobertura desigual) i per això no serà mai l'única: una afirmació que només surti d'una peça
de premsa anirà a la reserva, no al conjunt en viu, i quedarà **marcada com a no
promocionable** (vegeu més avall).

## Com es redacta una afirmació

> ⏳ **Encara no construït.** No hi ha cap afirmació escrita ni cap validador que comprovi
> aquestes regles. Avui són la llista de comprovació que aplicarem a mà i que codificarem al
> prompt de l'agent; el compte de paraules i la detecció de noms propis són les úniques que
> podrem automatitzar, i encara no ho estan.

Regles de forma, que aplicarem tant a l'agent com a la revisió humana:

- **Una sola proposició.** Res de «i», «alhora que», «sempre que». Si en conté dues, qui
  n'aprovi una i en rebutgi l'altra no pot respondre.
- **En futur, i preferiblement un canvi.** «L'Ajuntament ha de…», no «L'Ajuntament fa bé
  de…». L'statu quo com a afirmació obliga a saber quin és l'statu quo per respondre.
- **Màxim 25 paraules.** Es llegeix al mòbil, sovint dempeus.
- **Sense noms propis** de persones ni de candidatures: una afirmació que digui «la proposta
  del PSC» ja no mesura la política, mesura la marca.
- **Sense doble negació**, i **sense arguments dins l'enunciat** («per reduir la
  contaminació», «tot i el cost»): això va al context.
- **Dins de la competència municipal**: urbanisme, mobilitat, habitatge local, taxes i IBI,
  serveis, seguretat local, cultura, equipaments, neteja, comerç, turisme. Una afirmació
  sobre política d'immigració estatal no la decideix cap ple.
- **Desacord raonable a totes dues bandes.** Ha d'existir una persona sensata que hi digui
  que sí i una que hi digui que no. Si no, no és una afirmació, és una consigna.
- **Legal**: res que proposi el que l'ordenament no permet.

Exemples de **forma**, no de contingut; el redactat de cada municipi el fixarà la seva revisió
editorial. Cap d'aquests exemples és una afirmació real de cap municipi: no n'hi ha.

| Malament | Per què | Millor |
|---|---|---|
| «L'Ajuntament ha de millorar la mobilitat i abaixar l'IBI.» | Dues proposicions | Dues afirmacions separades |
| «Ha estat un encert vianalitzar el centre.» | Passat, i valora en lloc de proposar | «S'han de convertir en zona de vianants més carrers del centre.» |
| «No s'ha de deixar de subvencionar les entitats.» | Doble negació | «L'Ajuntament ha de mantenir les subvencions a les entitats.» |

## Com es tria el conjunt de 25

> ⏳ **Encara no construït.** No hi ha cap conjunt, ni cap comprovador de quotes. Aquestes
> quotes són el criteri que aplicarem i que volem que se'ns pugui exigir; el desbloqueja el
> pas 1 del procés. Quan hi hagi conjunts, cada municipi publicarà el resultat d'aquesta
> taula al costat del test, perquè es pugui comprovar sense creure'ns.

Una afirmació pot ser impecable i el conjunt continuar sent dolent. Aquestes quotes es
comprovaran **sobre el conjunt sencer**, abans de publicar:

| Criteri | Regla |
|---|---|
| Afirmacions direccionals | Mínim **15 de 25** classificades com a direccionals; per sota, el conjunt no es publica |
| Equilibri direccional | Sobre les direccionals: 40–60% formulades de manera que «d'acord» sigui la posició de l'esquerra; la resta, a l'inrevés |
| Equilibri govern/oposició | 40–60% amb «d'acord» = posició del govern municipal actual |
| Lligades a un vot real del ple | Mínim **8** amb enllaç a un punt votat i citable |
| Procedents de programes del 2023 | Mínim **5** amb cita literal del programa d'alguna candidatura |
| Fiscalitat · habitatge · mobilitat | Mínim 3 de cada |
| Per tema | Cap tema per sota d'1 ni per sobre de 5 |
| Discriminació prevista | Cap afirmació amb totes les candidatures del ple al mateix costat |

**Sobre l'eix esquerra-dreta.** [04-coincidencia.md](04-coincidencia.md) explica per què no
col·loquem ningú en un mapa ideològic: a escala municipal l'eix sovint no ordena res. Aquí
l'eix no serveix per situar el lector, sinó com a **control intern de la redacció**: que no
totes les afirmacions estiguin escrites de manera que dir «d'acord» sigui sempre la posició
del mateix bloc. Per això les afirmacions que no hi encaixen es marcaran com a **no
direccionals** i sortiran del càlcul de la quota —i per això hi posem un mínim de 15, perquè
el control no es pugui evaporar marcant-ne moltes com a no direccionals. Cada municipi
publicarà quantes n'han quedat marcades així, amb quin criteri i signades per qui.

Els mínims de **8** (vot del ple) i **5** (programa) són una **convenció editorial nostra**,
no un resultat de cap recerca ni de cap rúbrica externa: són el 32% i el 20% del conjunt, i
els posem perquè són justament el que separa quivoto d'un test d'opinió. Els revisarem amb
els primers municipis pilot i, si no aguanten, els canviarem dient-ho. Les forquilles de
40–60% i el límit d'1–5 afirmacions per tema tenen el mateix estatus.

**Quan les quotes no es poden complir.** Hi haurà municipis amb poques actes, amb totes les
votacions per unanimitat o amb llistes de veïns sense programa escrit. La regla és que **les
quotes no es rebaixen en silenci**: si un municipi no arriba a 8 afirmacions lligades a un vot
i 5 lligades a un programa, no es publica amb conjunt local. Surt amb les 7 compartides i un
avís explícit que allà la brúixola és mínima, i entra a la llista d'espera fins que el corpus
d'actes en doni prou. No inflarem el conjunt fins a 25 amb afirmacions de premsa.

L'agent generarà ~35 afirmacions: **25 en viu i 10 de reserva**. La reserva servirà per a
substitucions i per al *shoot-out* de [04-coincidencia.md](04-coincidencia.md): si les dues
primeres candidatures queden a 3 punts o menys, s'oferiran afirmacions extra que les separin
(la detecció d'aquest empat, `needsShootOut()`, sí que està implementada i provada). Les
afirmacions de **font única de premsa no són promocionables**: ni per substitució ni per
*shoot-out*. Per passar a viu necessitaran una segona font documental (acta, programa,
resposta oficial). El paquet publicat portarà aquest camp perquè es pugui comprovar des de
fora.

## Locals i compartides: 18 + 7

> ⏳ **Encara no construït.** No hi ha ni les 18 locals ni les 7 compartides. La família comuna
> de les compartides tampoc no existeix a l'esquema.

De les 25, **18 seran locals** (un projecte, un pla, un pressupost, una polèmica d'aquell
poble) i **7 seran compartides** entre tots els municipis: regulació de l'habitatge, IBI i
taxes, turisme, vianalització i transport, seguretat local, llengua i participació.

Per què cal la barreja:

- Sense les locals, el test és una enquesta ideològica genèrica i no aporta res que no
  aportin les brúixoles nacionals.
- Sense les compartides **no es pot comparar res entre municipis**: ni el teu poble amb el
  del costat, ni la mateixa marca a dos llocs. Serà també el control de qualitat més barat
  que tindrem: si la mateixa marca surt a 3 punts de distància en dos municipis veïns davant
  una afirmació quasi idèntica, alguna cosa falla a la inferència i saltarà a la cua de
  revisió.
- Les compartides donaran també una brúixola mínima —imperfecta i marcada com a tal— allà on
  encara no hi hagi conjunt local.

Les compartides tindran text únic i família comuna; el **context** («per què és rellevant
aquí») sí que serà local i portarà xifres del municipi.

## La rúbrica del Stemtest

> ⏳ **Encara no construït** com a codi: la llista de comprovació no està escrita enlloc del
> repositori. El que és cert avui és l'adopció: prenem aquesta rúbrica com a criteri i la
> publiquem perquè se'ns pugui exigir.

Adoptem la rúbrica pública de **De Stemtest** (Walgrave, Rihoux i Nuytemans, Universitat
d'Anvers), l'única metodologia de brúixola municipal amb els criteris de selecció publicats.
Es codificarà com a llista de comprovació de l'agent i de l'editor: (1) política **concreta**,
no actitud ni valor; (2) sobre política **futura**, preferiblement un canvi; (3) dins de les
**competències del nivell** de govern; (4) **no trivial**: rellevant o indicativa d'una
fractura política local; (5) **simple**: una idea, sense doble negació, sense arguments a
dins; (6) **discriminant**: hi ha partits a favor i en contra; (7) **equilibri direccional**
del paquet sencer. Els mínims numèrics de la taula anterior (8 i 5) **no venen d'aquesta
rúbrica**: són decisió nostra.

De la mateixa metodologia agafem el procediment: *long-list* del doble de la mida final,
prova de comprensió amb ciutadans, i selecció final per equilibri i discriminació. El 2024,
a Flandes, aquest procés va descartar el 19% de les afirmacions per no discriminar.

*Proposta oberta, encara no decidida:* fer la prova de comprensió amb **5 persones per
municipi pilot** i, a la resta, amb un panell únic sobre les 7 compartides i una mostra de 20
locals. Provar-ho als 947 no és realista.

## L'agent proposa, les persones aproven

> ⏳ **Encara no construït.** Al repositori no hi ha cap crida a cap model de llenguatge, cap
> eina d'agent, cap cua de revisió, cap estat `published` i cap traça editorial.
> `packages/pipeline/src/` només conté feines d'ingesta de dades obertes i indicadors
> derivats deterministes. Aquesta secció descriu com ho farem, i és el compromís que
> se'ns podrà exigir el dia que publiquem el primer municipi.

**L'agent** treballarà municipi a municipi amb eines de **només lectura** sobre el corpus:
perfil del municipi, punts del ple amb vot no unànime ordenats per polarització, cerca
híbrida, agrupació de temes de premsa, seccions de programa. L'única eina d'escriptura serà
la que registri les propostes. Per a cada afirmació haurà de lliurar text, tema, context amb
cites literals, direcció i **predicció de la posició de cada candidatura** amb l'evidència en
què es basa. Aquesta predicció no es publicarà: servirà per comprovar que l'afirmació
discrimina abans de gastar-hi la inferència de posicions ([02-posicions.md](02-posicions.md)).

**Les persones.** Tota afirmació entrarà a la cua de revisió com a proposta. Per publicar-se
necessitarà un **editor** que en validi text, tema, context i cites (i que en corregeixi el
redactat: la majoria s'hi retocaran); una **lectura contrària** signada per una segona
persona, que respondrà una sola pregunta —«si jo fos del partit contrari, em semblaria
carregada?»—; la llista de comprovació de neutralitat (verbs no carregats, una proposició,
competència municipal, dos pols defensables); i la traducció a `es` i `oc`, marcada com a
màquina o humana. Res que no estigui en estat `published` arribarà al paquet publicat. La
revisió deixarà rastre: qui, quan i què va canviar respecte de la proposta de l'agent.

## Versionat: família i versió

> ⏳ **Encara no construït.** No hi ha famílies, ni versions, ni identificador de conjunt, ni
> desat de respostes al navegador, ni enllaç `?r=`, ni avís de canvis. El web d'avui és només
> la pàgina de «properament».

Cada afirmació tindrà una **família** (estable en el temps, i comuna entre municipis per a
les compartides) i una **versió**. La distinció importa perquè les respostes de les persones
viuran al seu navegador, no al nostre servidor.

**Correcció que no canvia el significat** → mateixa afirmació, versió +1: les respostes
desades es conserven i el resultat no canvia. Hi entren faltes d'ortografia, puntuació,
concordança, un article, una xifra del context, una cita afegida i la traducció.

**Canvi de significat** → **nova afirmació** dins la mateixa família; la vella passarà a
retirada. Les respostes desades es descarten i la persona veurà l'avís «hi ha N afirmacions
noves». Hi entraran, com a **criteri nostre encara obert a esmena**:

- canviar el verb d'acció (limitar → prohibir, mantenir → ampliar);
- afegir, treure o moure una quantitat, un llindar o un termini;
- canviar l'àmbit territorial o el col·lectiu afectat;
- invertir la direcció de la frase;
- qualsevol canvi que faci que qui hi havia respost «d'acord» pogués ara respondre «en desacord».

En cas de dubte es tractarà com a canvi de significat: perdre una resposta desada és molt
menys greu que comptar-la per a una frase que ja no diu el mateix.

Afegir, retirar o substituir una afirmació canviarà l'identificador del conjunt del municipi.
Un enllaç de resultat compartit (`?r=…`) amb un identificador antic no es trencarà: es
recalcularà sobre la intersecció d'afirmacions i es mostrarà l'avís corresponent.

## Retirar les afirmacions que no discriminen

> ⏳ **Encara no construït, i depèn d'una peça que tampoc existeix.** El portal **no té avui
> cap analítica**: `web/public/assets/app.js` no envia cap esdeveniment. Sense analítica
> agregada, els dos primers indicadors d'aquesta taula no es poden calcular. Mentre no
> existeixi, l'única via de detecció serà que algú llegeixi les afirmacions i ens ho digui.

Una afirmació on gairebé tothom respon igual no informa: infla el percentatge de coincidència
de tothom i no separa ningú. Amb l'analítica agregada —mai respostes individuals, mai IP,
tal com la descriu [05-neutralitat-i-dades.md](05-neutralitat-i-dades.md)— vigilarem tres
indicadors per municipi:

| Indicador | Llindar | Acció |
|---|---|---|
| Respostes concentrades en un sol valor | **> 70%** | Candidata a retirada |
| Persones que l'ometen | **> 25%** | Candidata a retirada (senyal que no s'entén) |
| Totes les candidatures al mateix costat | qualsevol | Retirada, encara que la gent es divideixi |

**Una via que no depèn del trànsit.** Cada afirmació portarà un enllaç «aquesta pregunta no
s'entén» / «aquí falta un tema» que anirà a la mateixa cua de revisió, sense demanar cap dada
de qui l'envia. Als municipis petits, on els llindars de dalt no s'arribaran a poder calcular
mai, aquesta serà la via principal i no la secundària.

La retirada **no serà automàtica**: entrarà a la cua com a proposta i necessitarà **dues
signatures** —qui la proposa i un segon editor— i un motiu escrit, tots dos publicats al
registre de canvis de `/canvis`. Un sol editor no podrà moure el percentatge de cap
candidatura. La substitució sortirà de les 10 de reserva mantenint les quotes del conjunt.

*Proposta oberta, encara no decidida:* no avaluar aquests llindars amb menys de **300
respostes completes** al municipi, i no aplicar el llindar del 70% a les afirmacions de tipus
més/menys, on la concentració al centre és esperable. Cal fixar tots dos números abans del
primer llançament.

**Congelació.** El conjunt d'afirmacions de cada municipi es congelarà a l'inici del període
electoral, el **27 d'abril de 2027**, coherent amb la taula de terminis de
[05-neutralitat-i-dades.md](05-neutralitat-i-dades.md): a partir d'aquí no s'hi afegeix, no
se'n retira i no se'n substitueix cap, i només s'hi apliquen correccions que no canvien el
significat. Les posicions es congelaran 48 hores abans del 23 de maig.

## Límits d'aquest mètode

Ho diem clar, perquè afecta el que es podrà llegir al portal. El primer límit és el més gran
i és d'avui: **encara no hi ha cap municipi publicat amb brúixola**. Tota aquesta secció
descriu els límits que ja veiem del mètode que aplicarem.

- **92 municipis no tenen cap acta al feed de l'AOC** i 59 en tenen menys de 10 (això sí que
  està comptat, no previst). Allà la font principal no existeix: o bé no hi haurà conjunt
  local, o bé sortirà amb les 7 compartides i un avís explícit. No inflarem el conjunt amb
  afirmacions de premsa per arribar a 25.
- **Les actes no sempre desglossen el vot.** «Aprovat per majoria» sense detall no permet
  saber qui hi va votar a favor. Un municipi pot tenir 200 actes i molt pocs punts
  aprofitables, i això no es veurà fins que s'hagi processat el corpus —cosa que encara no
  hem fet en cap municipi.
- **El feed barreja actes de Ple i de Junta de Govern** i el camp de tipus només diu si la
  sessió és ordinària, extraordinària o urgent. Les de Junta no tenen vot per grup; si la
  classificació falla, l'agent podrà proposar afirmacions sobre decisions que el ple no ha
  votat.
- **Biaix del que es vota.** Un ple vota el que el govern hi porta. Els temes que el govern
  evita —els incòmodes— no surten a les actes i, si la premsa local no hi és, no arribaran al
  test. El mètode és conservador per construcció.
- **La premsa local és desigual**: on no hi ha cap mitjà, el conjunt serà més institucional
  i menys viu.
- **L'equilibri direccional es mesurarà sobre la nostra pròpia classificació** de què és
  «esquerra» i què és «dreta» en cada afirmació. En política municipal, moltes decisions (un
  pàrquing, un mercat, un pla de barris) no hi encaixen; quan no encaixin es marcaran com a
  no direccionals i sortiran del càlcul. El mínim de 15 direccionals i la publicació del
  recompte hi posen un terra, però el control continua sent més feble com més local és el
  tema.
- **La predicció de l'agent es podrà equivocar**, i llavors una afirmació que semblava
  discriminant a la selecció resultarà unànime a la publicació. Per això el control de
  discriminació es tornarà a passar després de la inferència real, no només abans.
- **L'anàlisi de retirada arribarà tard.** Els llindars del 70% i el 25% necessiten trànsit; als
  municipis petits potser no n'hi haurà prou mai, i allà les afirmacions dolentes només les
  detectarà algú llegint-les i prement l'enllaç d'avís.
- **La revisió humana serà el coll d'ampolla real.** 25 afirmacions × 947 municipis són 23.675
  frases per aprovar, i avui n'hi ha zero d'aprovades. Per això les onades de publicació
  aniran per cobertura i no per població: primer els municipis amb prou actes amb vot
  desglossat per omplir les quotes, no els més grans. Publicarem el calendari d'onades amb
  dates i el nombre de municipis que esperem cobrir realment abans del 23 de maig de 2027
  quan hàgim processat el primer lot d'actes i sapiguem el ritme de debò; prometre'l ara seria
  inventar-lo. Un municipi sense revisar es quedarà a la radiografia i no sortirà amb
  brúixola: preferim no publicar-ne que publicar-ne de no revisades.
