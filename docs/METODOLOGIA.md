# Metodologia

> **Estat a 29 d'agost de 2026.** Aquest document descriu el mètode que aplicarem.
> D'això, avui està implementat: la ingesta de dades obertes electorals (947 municipis,
> 10.788 candidatures de les eleccions del 2015, 2019 i 2023, participació i 11.873
> alcaldies des del 1979), el càlcul de regidories i la llei d'Hondt
> (`packages/shared-schemas/src/seats.ts`, 12 tests), el mapatge de marques entre les tres
> eleccions (`brands.ts`), l'algorisme de coincidència
> (`packages/shared-schemas/src/matching.ts`, 14 tests) i el **recompte** de cobertura
> d'actes del feed de l'AOC (`packages/pipeline/src/adapters/aoc.ts`).
> La resta és compromís, no descripció. Ho marquem secció a secció.

**Encara no hi ha cap municipi publicat amb brúixola.** No hem descarregat ni llegit cap acta
de ple, no hem inferit cap posició de cap candidatura i el test no existeix a
[quivoto.cat](https://quivoto.cat), on ara mateix només hi ha la pàgina de «properament». El
que hi ha avui és aquest mètode escrit i les dades obertes ja ingerides i verificades. No és
poc —947 municipis, tres eleccions, gairebé dotze mil alcaldies i l'algorisme de càlcul amb
proves que passen— però no és el producte, i no volem que ho sembli.

Dues paraules que farem servir tota l'estona. La **brúixola** és el test: respons 25
afirmacions i et diu quant coincideixes amb cada candidatura del teu municipi. La
**radiografia** és la fitxa de dades electorals del municipi —resultats del 2015, 2019 i
2023, composició del ple, qui governa, paritat, canvis de grup—, que sortirà de dades
obertes i, per tant, hi podrà ser a tots els municipis. La brúixola depèn d'evidència
documental que en molts pobles no existeix; la radiografia, no.

Quan la brúixola existeixi, compararà les teves respostes amb la posició de cada candidatura
del teu municipi. La diferència amb una enquesta d'opinió serà que aquí **cada posició portarà
l'evidència al costat**: què va votar aquell grup al ple i quin dia, què deia el seu programa
del 2023, què va dir el seu portaveu a la premsa i on. No et demanarem que ens creguis; et
demanarem que comprovis.

El 2027 encara no ha arribat i no hi ha ni candidats ni programes nous, així que el portal
s'alimentarà del que els partits **han fet** des del juny del 2023. La font principal seran les
actes dels plens, que els ajuntaments pengen a la seva seu electrònica i que el Consorci AOC
—l'Administració Oberta de Catalunya, el consorci públic que agrega i publica dades de les
administracions catalanes— indexa en un feed obert. D'aquest feed n'hem comptat **25.902
actes** repartides en 855 municipis; aquest recompte és l'única cosa que hem fet amb el feed
fins ara. En traurem els punts votats i els lligarem a les afirmacions del test.

Res d'això serà automàtic de punta a punta. Farem servir models de llenguatge per llegir PDFs i
proposar posicions, però una posició només existirà si hi ha una **cita literal, datada i
localitzable** que la sostingui, i cap no es publicarà sense passar una verificació
independent. Quan no tinguem prou evidència ho direm: «sense dades» serà una resposta legítima
i la donarem sovint.

I la cobertura serà desigual per construcció: dels 947 municipis, 646 tenen 20 actes o més al
feed, 150 en tenen entre 10 i 19, 59 menys de 10 i **92 no en tenen cap**. Allà on no hi hagi
evidència pública no hi haurà brúixola, només la radiografia electoral.

> **Compte amb aquestes quatre xifres.** Compten *totes* les actes del feed sense distingir
> l'òrgan, perquè el feed no el distingeix: hi ha barrejades actes de Ple i de Junta de Govern
> Local, i les de Junta no serveixen per atribuir el vot d'un partit (§3). El nombre d'actes de
> Ple serà sensiblement menor i no el sabrem fins que haguem processat els PDFs. Fins llavors,
> «646 municipis amb 20 actes o més» és un sostre optimista, no una previsió de cobertura.

> ⏳ **Encara no construït.** No publiquem el que passarà al teu municipi en concret.
> Publicarem la llista completa dels 947 municipis —nom, nombre d'actes al feed, data de
> l'última i què hi haurà: brúixola completa, només les 7 afirmacions compartides, o només
> radiografia— amb un cercador pel nom del poble. Ho desbloqueja la classificació d'òrgan de
> les actes, perquè abans d'això la xifra que et donaríem seria enganyosa.

Aquí resumim les cinc peces del mètode i enllacem al detall de cadascuna.

---

## 1. Com triem les afirmacions

> ⏳ **Encara no construït.** No hi ha cap taula d'afirmacions a la base de dades, cap agent
> generador i cap circuit de validació. Ho desbloqueja tenir punts de ple extrets (§3), que és
> la matèria primera de la major part de les afirmacions.

Cada municipi tindrà **25 afirmacions**: 18 locals (un projecte, un pressupost, una polèmica
d'aquell poble) i 7 compartides amb tot Catalunya (habitatge, IBI i taxes, turisme, mobilitat,
seguretat, llengua, participació). Sense les locals seria una enquesta ideològica genèrica;
sense les compartides no es podria comparar el teu poble amb el del costat.

La matèria primera principal seran els **punts del ple amb vot no unànime**, ordenats per com
de repartit va quedar el consistori. Un punt on 14 regidors voten sí i 13 voten no és bona
matèria primera: hi ha desacord real, sabem qui és a cada banda i el vot és públic i citable.
Completaran la llista els programes del 2023 i la premsa local, que mai serà l'única font d'una
afirmació en viu.

Un agent d'IA proposarà unes 35 afirmacions amb l'evidència de cadascuna; una persona en
validarà text, tema i cites, i una segona en signarà una lectura contrària. Les regles de
redacció i l'equilibri direccional del conjunt —entre esquerra i dreta, entre govern i
oposició— venen de la rúbrica pública de *De Stemtest* (Anvers). Els mínims numèrics (8
afirmacions lligades a un vot real, 5 a un programa) **són decisió nostra**, no de la rúbrica,
i estan oberts a revisió.

→ **[Detall complet: metodologia/01-afirmacions.md](metodologia/01-afirmacions.md)**

## 2. Com determinem la posició de cada partit

> ⏳ **Encara no construït.** L'esquema de base de dades
> (`packages/db/src/schema/`) cobreix territori, eleccions, persones, participació, alcaldies i
> traça d'ingesta; **no hi ha cap taula de posicions, de cites ni de fonts**, i el pipeline no
> fa cap crida a cap model de llenguatge. Ho desbloqueja el pipeline d'actes (§3) i el
> qüestionari als partits, que s'enviarà el gener del 2027.

El subjecte d'una posició no serà la marca, sinó la **candidatura local**: «ERC de Sabadell» i
«ERC de Reus» són dos subjectes diferents i poden estar en pols oposats de la mateixa
afirmació. El 2023 hi va haver 2.626 candidatures amb escons —això sí que ho tenim ingerit i
comptat—, i el que mesurarem es decideix al ple.

Hi haurà una jerarquia: **declarada > editorial > inferida**. Si el partit respon el nostre
qüestionari, manarà la seva resposta, publicada tal com arribi i amb data. Si no, inferirem la
posició de l'evidència documental, i cada tipus tindrà un sostre de confiança que el model no
podrà superar: un vot al ple valdrà més (0,90) que un programa (0,80) o que una declaració a la
premsa (0,75). La posició heretada de la marca estatal o catalana tindrà un sostre de 0,40, per
sota del llindar de publicació: **no es mostrarà mai**. Seria inventar dades amb aparença de
rigor.

Hi haurà tres capes de verificació abans de publicar: una comprovació literal sense IA (la cita
i el nom de la candidatura hauran d'aparèixer a la font); un segon model que torni a buscar
evidència partint de l'afirmació **invertida**, per atacar el vici típic d'aquests sistemes
—trobar el que busques perquè busques el que ja has decidit—; i escombrades nocturnes sobre el
conjunt.

Sobre la porta humana hem de ser exactes, perquè és la promesa més seriosa que fem. **No
prometrem que una persona hagi llegit cada posició publicada.** El disseny previst és que
quan les tres capes coincideixin i la confiança quedi dins d'un marge estret, la posició
s'aprovi automàticament; qualsevol discrepància anirà a revisió humana. Perquè això sigui
comprovable des de fora, cada posició publicada portarà visible un camp `approved_by` amb el
valor `auto` o les inicials de qui la va aprovar i la data, i cada municipi publicarà quin
percentatge de les seves posicions són auto-aprovades. Si el detall d'algun dels cinc
documents diu una altra cosa, mana aquesta frase i t'agrairem que ens avisis.

→ **[Detall complet: metodologia/02-posicions.md](metodologia/02-posicions.md)**

## 3. Com llegirem les actes dels plens

> ⏳ **Encara no construït.** L'única cosa implementada del feed de l'AOC és el recompte de
> cobertura: `minutesCoverage()` a `packages/pipeline/src/adapters/aoc.ts` fa un `COUNT(*)` per
> ens des de l'inici del mandat. **Cap acta s'ha descarregat ni llegit mai**: no hi ha
> descàrrega de PDFs, ni OCR, ni segmentació, ni classificació d'òrgan, ni cap crida a cap
> model. Ho desbloqueja construir el pipeline d'actes, que és la propera peça de feina.

El feed de l'AOC és **només un índex**: dona la data, l'ajuntament i l'enllaç al PDF, però no
conté ni el text ni cap vot. Tot el que publiquem sobre què s'ha votat sortirà de llegir el PDF:
text natiu o OCR —reconeixement òptic de caràcters, per als PDFs que són imatges escanejades i
no text—, segmentació per punt de l'ordre del dia i extracció amb model a un esquema estricte.

El feed barreja actes de **Ple** i de **Junta de Govern Local** i no ho distingeix. La
diferència és crítica: a la Junta de Govern només hi ha l'equip de govern, i els seus acords no
són mai el vot d'un partit. Classificarem cada acta amb dues senyals independents i, si
discrepen, l'acta quedarà com a òrgan desconegut i **no generarà cap vot**. Dues comprovacions
més es faran fora del model, en codi: els comptadors hauran de quadrar amb el nombre de
regidors i la cita haurà d'aparèixer literalment a la font.

Mesurarem si això funciona contra el **CSV obert de l'Ajuntament de Rubí**, l'únic de Catalunya
que publica el vot de cada regidor a cada moció, i contra un centenar d'ítems etiquetats a mà.
Encara no ho hem executat ni un sol cop. La mètrica que manarà és la inversió de signe: un vot
que falta és un buit, un vot invertit és una acusació falsa. Si no baixa del llindar, el
registre es publicarà **sense vots per grup**. Publicarem el resultat d'aquesta mesura, amb
data, abans de publicar cap municipi amb brúixola.

→ **[Detall complet: metodologia/03-actes-i-mocions.md](metodologia/03-actes-i-mocions.md)**

## 4. Com es calcula el percentatge

> ✅ **Implementat.** L'algorisme viu a
> [`packages/shared-schemas/src/matching.ts`](../packages/shared-schemas/src/matching.ts) i té
> 14 tests que passen a
> [`matching.test.ts`](../packages/shared-schemas/src/matching.test.ts): l'escala, els pesos,
> la penalització de `no_position`, l'exclusió de `no_data`, el llindar de cobertura i els
> desempats. El que **no** existeix encara és la pàgina web que el faci servir: no hi ha test,
> ni desat al navegador, ni enllaç per compartir.

Tu i cada candidatura us situareu a la mateixa escala de cinc punts (−2 a 2). Per a cada
afirmació que hagis respost i on el partit tingui posició, la puntuació és `s = 4 − |la teva
resposta − la seva|`: 4 punts si coincidiu exactament, 0 si sou als extrems oposats. Cada fila
pesa 1, 2 si l'has marcada com a molt important o si és una prioritat del partit, i 4 si totes
dues.

Tres regles importen més que la fórmula. **Ometre no és una posició**: l'afirmació surt del
càlcul per a tots els partits alhora. **«Sense dades» no penalitza**: surt del numerador i del
denominador d'aquell partit, i la fila apareixerà igualment perquè el forat es vegi. **Declarar
que no es posicionen sí que penalitza** (−1 punt); sense això, esquivar seria gratuït. I una
candidatura amb posició coneguda en menys del **70%** de les afirmacions no es classifica.
Tot això és el que fa el codi avui i el que comproven els tests.

El càlcul es farà **al teu navegador**, sobre un fitxer curt i auditable
(`packages/shared-schemas/src/matching.ts`); les respostes no s'enviaran a cap servidor. No
dibuixarem cap eix esquerra-dreta: a escala municipal, qui defensa el comerç del centre o qui
s'oposa a un polígon no s'hi ordena, i una etiqueta abstracta ja no es pot auditar.

→ **[Detall complet: metodologia/04-coincidencia.md](metodologia/04-coincidencia.md)**

## 5. Neutralitat, correccions i dades

> ⏳ **Parcialment construït.** El compromís de finançament és una decisió ja presa i vigent.
> Tota la resta d'aquesta secció descriu la interfície i el tractament de dades personals d'un
> portal que encara no existeix: avui a quivoto.cat només hi ha una pàgina de «properament»
> amb un formulari d'avís, sense test, sense desat al navegador i sense enllaç per compartir.

quivoto no està vinculat a cap partit ni administració, i **no accepta diners, serveis ni
espècie de partits, candidatures, grups municipals ni fundacions de partit**. Avui el projecte
està finançat íntegrament pel seu titular legal, Damos en el Blanco SL.

La neutralitat també serà disseny. Els colors oficials de les candidatures apareixeran només
com a marca de dades de 26 píxels, mai com a fons ni accent. Acord i desacord no seran verd i
vermell —són colors de partit i exclouen qui té daltonisme—. Les candidatures s'ordenaran pels
vots del 2023, i es dirà explícitament sota la llista. Cap logotip serà més gran que un altre.

Sobre les persones: publicarem el que fa d'un càrrec electe un càrrec electe —vots, càrrec,
grup, declaracions públiques amb font— i no res de la seva vida privada.

Sobre tu, i en pla: **les teves respostes es quedaran desades al teu propi mòbil o ordinador i
no arribaran a cap servidor nostre.** No hi haurà comptes, no desarem la IP i no hi haurà cap
galeta ni cap tercer. Ara bé, si comparteixes l'enllaç del teu resultat, **qui el rebi podrà
veure exactament què has respost a cada afirmació**: les respostes viatgen dins de l'enllaç, en
un paràmetre `?r=`, i no van xifrades. En un poble on el resultat corre pel WhatsApp del
veïnat, això importa. Si no vols que ningú sàpiga el teu vot afirmació per afirmació, no
comparteixis l'enllaç.

→ **[Detall complet: metodologia/05-neutralitat-i-dades.md](metodologia/05-neutralitat-i-dades.md)**

---

## Què no farem

Els límits reals, agregats dels cinc documents. Si el portal sembla saber més del que aquí diem
que pot saber, avisa'ns.

- **92 municipis no tenen cap acta al feed** i 59 en tenen menys de 10. Allà no hi haurà
  brúixola, i la pàgina ho dirà així: «No hi ha prou evidència pública per fer la brúixola
  aquí».
- **La majoria de les actes no desglossen el vot.** «S'aprova per majoria» és la norma, no
  l'excepció. Un municipi pot tenir 200 actes i molt pocs punts aprofitables. I encara no ho
  hem pogut mesurar, perquè no n'hem obert cap.
- **Les llistes locals sovint no deixen rastre digital**: sense programa, web ni premsa, no en
  sabrem res. El mètode és més generós amb els partits organitzats i no sabem corregir-ho.
- **L'extracció automàtica tindrà marge d'error.** Els noms dels grups ballen, l'OCR degrada
  justament les xifres dels comptadors i una Junta de Govern mal classificada s'hi podria
  colar. Rubí és un sol format d'acta: no hi haurà garantia que la precisió es traslladi a
  Tortosa o a Puigcerdà.
- **Una posició inferida no serà una declaració del partit.** Que un grup votés a favor d'una
  moció el 2024 no vol dir que hagi dit mai que hi està d'acord: un vot pot ser un pacte o
  disciplina de grup. Per això cada posició portarà data, cita i confiança, i per això el partit
  hi podrà replicar.
- **El percentatge dependrà de les 25 afirmacions triades**, i triar-les ja és una decisió
  editorial: un partit pot tenir raó quan digui que el tema que més l'afavoreix no hi és. **No
  serà un consell de vot**: no sabrà res de la gestió ni del que farà cadascú al ple.
- **Fins a l'abril del 2027 no hi ha candidatures del 2027.** Tot el que publiquem abans parlarà
  del mandat 2023–2027, no de qui es presentarà.

## Com ens pots corregir

> ⏳ **Encara no construït.** No hi ha enllaç «Informa d'un error», ni cua de correccions, ni
> registre públic de canvis a `/canvis`, ni RSS: no hi ha portal on posar-los. L'única via que
> funciona avui és el correu. Ho desbloqueja publicar el primer municipi.

Quan el portal existeixi, qualsevol persona —no caldrà ser d'un partit— podrà informar d'un
error des de qualsevol posició, cita, foto o dada: hi haurà un enllaç «Informa d'un error» al
costat, que anirà a la mateixa cua que faci servir la redacció. Ja ara pots escriure a
**hola@quivoto.cat** (les bústies específiques de correccions i de dades personals encara són
una proposta pendent de crear).

Digues-nos el municipi, què reclames, què hi hauria de dir i, si en tens, **quina prova
documental ho sosté**; sense prova també ho admetrem, però anirà pel camí llarg. Acusarem
recepció amb un número; una persona **diferent** de qui va aprovar la dada la revisarà contra la
font primària; i resoldrem corregint, mantenint amb explicació escrita, o matisant amb context o
menys confiança. Si la reclamació és versemblant a primera vista, mentre la revisem la dada
quedarà marcada «En revisió» i **sortirà del càlcul** com a «sense dades», en comptes de
quedar-s'hi amb un valor que potser és fals.

Si mantenim la dada i el partit hi continua en desacord, tindrà **dret de rèplica**: un
comentari públic seu, signat, al costat de la posició, que no editarem. Cada candidatura amb
representació rebrà a més, des del gener del 2027, la seva fitxa ja feta per respondre el
qüestionari, discrepar o comentar-la; l'estat de cadascuna serà públic i qui no respongui també
es veurà. Tota correcció quedarà al **registre públic de canvis** de `/canvis`, amb RSS. No
esborrarem res en silenci.

## Glossari

Deu paraules que fem servir sense poder-les evitar.

- **Brúixola** — el test: respons 25 afirmacions i et diu quant coincideixes amb cada
  candidatura del teu municipi. Depèn d'evidència documental, i per això no hi serà a tots els
  municipis.
- **Radiografia** — la fitxa de dades electorals del municipi: resultats del 2015, 2019 i 2023,
  composició del ple, qui governa, paritat, canvis de grup. Surt de dades obertes i hi podrà ser
  a tot arreu.
- **Consorci AOC** — l'Administració Oberta de Catalunya, el consorci públic de la Generalitat i
  el món local que agrega i publica dades de les administracions catalanes. D'aquí surt el feed
  d'actes.
- **Acta de ple** — el document oficial que recull què es va tractar i què es va acordar en una
  sessió del ple municipal. És l'evidència més forta que fem servir.
- **Junta de Govern Local** — òrgan format només per membres de l'equip de govern. Els seus
  acords no són mai el vot d'un partit contra un altre, i per això les seves actes no generen
  posicions.
- **OCR** — reconeixement òptic de caràcters: convertir en text un PDF que en realitat és una
  imatge escanejada. Fa errors, sobretot amb xifres.
- **LOREG** — Llei Orgànica del Règim Electoral General. El seu article 179 fixa quants regidors
  té un ajuntament segons la població; és el que implementa `seats.ts`.
- **Llei d'Hondt** — la fórmula legal que reparteix les regidories entre les candidatures a
  partir dels vots, amb una barrera del 5% als municipis.
- **Posició declarada / editorial / inferida** — declarada és la que ens dona el partit
  responent el qüestionari; editorial, la que fixem nosaltres amb criteri explícit; inferida, la
  que deduïm d'un vot, un programa o una declaració, sempre amb cita.
- **`localStorage`** — el racó del teu navegador on una web pot desar coses al teu dispositiu.
  Les teves respostes viuran allà, no en un servidor nostre.

## Estat d'aquest document

| | |
|---|---|
| Versió | **0.2** |
| Data | 29 d'agost de 2026 |
| Estat del mètode | **En implementació.** Està construït i provat: la ingesta de dades obertes electorals (947 municipis, 10.788 candidatures, 11.873 alcaldies, participació), el càlcul de regidories i Hondt (`seats.ts`, 12 tests), el mapatge de marques (`brands.ts`) i l'algorisme de coincidència (`matching.ts`, 14 tests). No està construït: el pipeline d'actes, la inferència de posicions, el circuit de revisió humana i el portal públic. **Encara no s'ha publicat cap municipi amb brúixola.** |
| Xifres | Verificades el 28 d'agost de 2026 contra les fonts obertes de la Generalitat i del Consorci AOC. La cobertura d'actes (25.902 actes, 855 municipis) és un recompte del feed, no una lectura de les actes |
| Decisions obertes | Els cinc documents marquen com a **proposta oberta** el que encara no està decidit: terminis de resposta, llindars numèrics d'acceptació de l'extracció, mostra mínima per retirar afirmacions, llicència de les nostres dades i model de finançament |
| Actualitzacions | Aquest document canvia a mesura que es tanquen decisions; quan hi hagi portal, els canvis aniran al registre públic de `/canvis` |

Si trobes una contradicció entre aquesta pàgina i un dels cinc documents detallats, mana el
document detallat —excepte en el que diem sobre l'aprovació automàtica de posicions (§2), on
mana aquesta pàgina—, i t'agrairem que ens ho diguis.
