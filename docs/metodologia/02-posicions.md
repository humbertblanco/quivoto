# Com determinem la posició de cada partit

> **Estat a 29 d'agost de 2026.** Aquest document descriu el mètode que aplicarem
> per determinar la posició de cada candidatura. **Encara no hem calculat ni
> publicat cap posició de cap partit, i no hi ha cap acta llegida.** D'això que
> llegiràs, avui està implementat només el tram final —el que passa un cop les
> posicions ja existeixen—: el model de tres estats (`answered`, `no_data`,
> `no_position`), la penalització de −1 quan un subjecte declara que no s'hi
> posiciona, l'exclusió dels «sense dades» del denominador i el llindar de
> cobertura del 70%, tot a
> [`packages/shared-schemas/src/matching.ts`](../../packages/shared-schemas/src/matching.ts)
> amb 14 tests que passen. També hi ha ingerits els subjectes: 947 municipis i
> 10.788 candidatures de tres eleccions. La resta —les cites, les etiquetes de
> base, les confiances, les capes de verificació, el dret de rèplica— és
> compromís, no descripció. Ho marquem secció a secció: ⏳ vol dir que no està
> construït; ✅, que sí i que ho pots obrir.

Per a cada afirmació del test i cada candidatura del municipi, quivoto haurà de
dir una de tres coses: «hi està d'acord», «hi està en desacord» o «no ho sabem».
La tercera és tan legítima com les altres i la donarem sovint.

La regla que ho governa tot ja està decidida: **una posició només existirà si hi
ha una cita literal, datada i localitzable que la sostingui**. Sense cita, la
posició serà «sense dades», encara que tinguem una intuïció clara de què votaria
aquell partit. Preferim un forat visible a una atribució que no puguem defensar.

## Què és això de la IA i què la deixarem fer

Perquè la resta del document s'entengui, val la pena dir-ho aviat i en paraules
planes. Un «model de llenguatge» és un programa que llegeix text i proposa
respostes a partir de com de probable és cada continuació. No entén de política,
no sap què és just i no comprova res: proposa. S'equivoca sobretot amb papers
escanejats, amb llenguatge administratiu i quan la resposta que busca no és al
text —llavors tendeix a omplir el buit.

Per això el paper que li donarem és petit i acotat: **llegir documents i proposar
una posició amb la cita literal que la sosté**. El que no podrà fer mai és
publicar res tot sol, inventar-se una cita (una comprovació sense IA la
descartarà) ni pujar-se la confiança per sobre del sostre que li marca el tipus
d'evidència. Tot això encara s'ha de construir; avui no hi ha cap crida a cap
model en tot el repositori.

Com es redacten les afirmacions és a [01-afirmacions.md](01-afirmacions.md); d'on
surten els vots del ple, a [03-actes-i-mocions.md](03-actes-i-mocions.md); com es
converteix tot plegat en un percentatge, a [04-coincidencia.md](04-coincidencia.md);
les regles d'igualtat i de dades, a [05-neutralitat-i-dades.md](05-neutralitat-i-dades.md).

## Qui és el subjecte d'una posició

> ✅ **Implementat en part.** Els subjectes ja són a la base de dades: 947
> municipis, 10.788 candidatures de tres eleccions i la taula `political_groups`
> ([`packages/db/src/schema/elections.ts`](../../packages/db/src/schema/elections.ts)),
> que la feina J2 crea a partir de cada candidatura amb escons. El que no
> existeix és cap taula de posicions, de cites ni de fonts: aquests subjectes,
> avui, no tenen cap posició associada. Tampoc no hi ha detecció d'escissions.

El subjecte no és la marca («ERC», «PSC»), sinó la **candidatura local**: «ERC-AM
de Sabadell» i «ERC-AM de Reus» són dos subjectes diferents i poden tenir
posicions oposades sobre la mateixa afirmació. El 2023 hi va haver 2.626
candidatures amb escons a 947 municipis, i les decisions que volem mesurar (un
pla urbanístic, una taxa, un carril bici) es prenen al ple, no a la seu nacional.

Qui vota al ple és el **grup municipal**, que sol coincidir amb la candidatura
però pot fragmentar-se durant el mandat (no adscrits, escissions). El lligam
entre grup i candidatura del 2023 ja el fa J2; el vot s'assignarà al grup quan
tinguem vots, i la fragmentació durant el mandat encara no la sabem detectar.

Els caps de llista tindran posicions pròpies, i només pròpies: valdrà la
declarada i, si no n'hi ha, la inferida d'una cita **on aparegui la persona**. Si
no tenim ni l'una ni l'altra, a la seva fitxa hi dirà «no tenim cap declaració
seva sobre això», amb l'enllaç a la posició de la seva candidatura. **A la fitxa
d'una persona no hi posarem mai un valor a l'escala heretat del grup.** Una
posició de grup pot ser un pacte o disciplina de vot, i penjar-la d'un nom i uns
cognoms és dir que aquella persona defensa una cosa que potser no ha dit mai. Una
versió anterior d'aquest document preveia aquesta herència amb una etiqueta
petita; l'hem retirada, perquè l'etiqueta petita no impedeix la lectura «X
defensa Y».

## La jerarquia: declarada > editorial > inferida

> ⏳ **Encara no construït.** No hi ha taula de posicions, ni camp d'origen, ni
> cua editorial, ni registre públic de canvis. Ho desbloqueja l'esquema de
> posicions i cites, que és la primera peça pendent de tot aquest document.

| Ordre | Origen | Qui la fixa | Confiança |
|---|---|---|---|
| 1 | **Declarada** | El partit o el candidat responen el qüestionari, amb motivació pròpia | 1,00 |
| 2 | **Editorial** | Un editor corregeix una inferència amb evidència que el pipeline no havia trobat, i signa | el sostre de la `basis` de l'evidència que aporta; mai 1,00 |
| 3 | **Inferida** | El pipeline llegeix actes, programes i premsa i proposa un valor amb cites | 0,00–0,95 |

La declarada sempre manarà. Si un partit ens diu que està en contra d'una cosa
que va votar a favor el 2024, publicarem la declarada com a vigent **i**
mantindrem la inferida al costat, visible: no corregirem la història amb la
declaració, ni al revés.

Les respostes dels partits no s'editaran mai; es publicaran tal com arribin, amb
data. Si contradiuen una evidència documental que tinguem, els ho farem notar
abans de publicar i podran esmenar resposta o motivació; si la mantenen, es
publicarà igualment i la contradicció es veurà.

**La capa editorial no és un comodí, i abans ho semblava.** Un editor no aporta
confiança, aporta evidència: la seva correcció quedarà sotmesa exactament als
mateixos sostres de `basis` que la inferida —si el que ha trobat és una cita de
premsa, el sostre serà 0,75, encara que ho signi ell. A més, cada correcció
editorial exigirà **dues signatures** de persones diferents, amb inicials i data;
publicarà al registre de canvis la cita literal i l'enllaç a la font que la
justifica; i cada municipi tindrà un comptador públic de quantes de les seves
posicions són d'origen editorial. Una correcció editorial sense font enllaçada no
es podrà publicar.

## Tipus de base de l'evidència

> ⏳ **Encara no construït.** No hi ha camp `basis` enlloc del codi: el tipus
> `SubjectPosition` de `matching.ts` només té `kind`, `value` i `priority`.
> Aquests sostres són, avui, una taula d'aquest document i res més.

Cada posició inferida portarà una etiqueta `basis` que digui de què surt. Cada
tipus tindrà un sostre de confiança que el model **no podrà superar**:

| `basis` | Què és | Sostre |
|---|---|---|
| `vote` | Vot del grup municipal en un punt del ple lligat a l'afirmació | 0,90 |
| `own_proposal` | El grup és qui presenta la moció o l'esmena | 0,95 |
| `programme` | Compromís explícit al programa electoral de 2023 | 0,80 |
| `press` | Declaració atribuïda al portaveu o al cap de llista en un mitjà | 0,75 |
| `social` | Publicació a xarxes del compte oficial de la candidatura | 0,65 |
| `interview` | Entrevista pròpia o resposta pública a un qüestionari extern | 0,75 |
| `brand_inherited` | Només tenim la posició de la marca supramunicipal | **0,40** |
| `mixed` | Diverses bases coincidents | la més alta de les seves |

Un vot al ple val més que una entrevista perquè és un acte administratiu amb
conseqüències; i un programa val menys que un vot perquè el programa és la
promesa i el vot és el que se n'ha fet. `own_proposal` va per sobre de `vote`
perquè la moció la redacta el mateix grup: el text és seu i el signa, mentre que
un vot és una resposta al text d'un altre. L'objecció és bona —presentar una
moció sovint és un gest tàctic—, i la resposta que hi donem és que el gest tàctic
també és una posició pública, datada i signada. Tot i així, els 0,05 de diferència
no surten de cap mesura.

**Aquests números són convencions provisionals, no probabilitats.** Cap d'ells no
ve de mesurar quantes vegades encertem: expressen un ordre de preferència entre
tipus d'evidència, escrit a mà. Els calibrarem contra el conjunt d'or i contra el
CSV obert de Rubí —quina taxa d'error observada correspon a quin valor de
confiança— i publicarem la corba resultant. Fins que això no estigui fet i
publicat, llegiu-los com un ordre, no com una probabilitat d'encert.

## El prior determinista vot→posició

> ⏳ **Encara no construït.** Aquesta taula no és enlloc del codi. Ho desbloqueja
> el pipeline d'actes ([03-actes-i-mocions.md](03-actes-i-mocions.md)), que
> tampoc no existeix: cap acta descarregada, cap vot extret.

En paraules planes: abans de preguntar res a cap model, aplicarem una regla fixa
i escrita per nosaltres —qui vota que sí a una moció, hi està d'acord— i el model
només podrà matisar-la o tombar-la, mai capgirar-la. En diem «prior determinista»
perquè és una decisió presa abans de mirar res i sempre igual.

Aquesta taula s'aplicarà **en codi, abans de cridar el model**, i el model no la
podrà invertir ni pujar-ne la confiança: només podrà matisar la justificació o
rebaixar el valor a «sense dades» si troba contra-evidència.

El pont entre l'afirmació i el punt del ple serà explícit: cada enllaç declararà
si un «sí» al ple significa acord o desacord (`yes_means_agree` /
`yes_means_disagree`), perquè hi ha mocions redactades en negatiu i el signe no
es dedueix del text. Exemple: a «Cal aturar la construcció del pàrquing», un «sí»
és acord amb aturar-lo; a «El Ple rebutja aturar la construcció del pàrquing», el
mateix «sí» vol dir el contrari.

| Situació | Valor | Confiança |
|---|---|---|
| El grup presenta la moció lligada a l'afirmació | ±2 | 0,95 |
| El grup vota sí o no | ±2 | 0,90 (0,80 si el vot té més de 2 anys) |
| El grup s'absté | **cap valor a l'escala** | estat propi `abstained`: no puntua ni entra al denominador |
| El grup és absent, o l'acta no desglossa el vot | — | cap prior |
| Vots contradictoris en el mateix mandat | el més recent si hi ha ≥6 mesos entre els dos; si no, 0 | 0,40 + revisió humana |
| Compromís explícit al programa 2023 | ±2 | 0,80 |
| Cita del portaveu a la premsa | ±1 o ±2 | 0,60–0,75 |
| Només posició de la marca estatal o catalana | ±1 | ≤0,40 |
| Resposta declarada pel partit | la que digui | 1,00 |

**L'abstenció no puntuarà.** Una versió anterior la col·locava al 0 de l'escala
amb confiança 0,50 —cinc centèsimes just per sobre del llindar de publicació, o
sigui, publicada—. Era un error: una abstenció pot voler dir «ni sí ni no», «no
volem trencar el pacte» o «hi estem d'acord però no amb la forma», i cap d'aquests
tres significats no és «el partit es situa al centre». Convertir-la en un 0 fa
perdre punts a aquell partit davant d'un votant amb opinió clara, per una cosa que
el partit no ha dit.

El que farem és tractar-la com un estat propi: `abstained` es mostrarà a la fitxa
amb la cita i la data —«el grup es va abstenir en aquest punt; això no és una
posició declarada»— però no entrarà al càlcul ni al denominador, igual que un
«sense dades». Això vol dir afegir un quart valor a `PositionKind`, que avui
només en té tres (`answered`, `no_data`, `no_position`): és un canvi pendent a
[`matching.ts`](../../packages/shared-schemas/src/matching.ts) i als seus tests.

## La regla dura: sense cita, no hi ha posició

> ⏳ **Encara no construït.** No hi ha sortida de model perquè no hi ha model, ni
> taula de cites, ni comprovació literal, ni test de la ingesta. Ho desbloqueja
> l'esquema de posicions i cites més la primera feina que cridi un model.

La sortida del model serà un objecte estricte amb `value`, `basis`, `confidence`,
una justificació de menys de 80 paraules, `citations` i `counter_evidence`. Cada
cita portarà el fragment d'origen i el text **literal**, de 300 caràcters com a
màxim, marcat com a `supports: value` o `supports: context`.

Si no hi ha cap cita `supports: value`, el valor passarà a `null` i la posició
quedarà com a «sense dades», amb un `no_data_reason` que també es publicarà. No
serà una recomanació de prompt: serà una comprovació posterior, sense IA, que
esborra el valor. Les fonts es tractaran com a dades no fiables: si una acta o una
notícia conté text que sembla una instrucció, s'ignorarà.

**Els dos tests que ho han de blindar encara no estan escrits.** El compromís és
que la ingesta falli, i no publiqui, si arriba al paquet d'un municipi una sola
posició amb una cita que no aparegui literalment al fragment d'origen. Avui els
únics tests del repositori són els de `matching.ts`, `seats.ts` i `lib/text.ts`, i
cap no toca cites ni confiança —de fet `SubjectPosition` no té ni camp `basis` ni
camp `confidence`, o sigui que ni tan sols hi ha on comprovar-ho. Quan
s'implementi caldrà o bé afegir aquests dos camps a `SubjectPosition`, o bé deixar
documentat que viuen al constructor del paquet publicat i no al càlcul. Aquest
test serà comprovable el mateix dia que es publiqui el primer municipi: si no hi
és, no publiquem.

## Llindars de visualització

> ⏳ **Encara no construït.** Aquest tall no viu ni viurà a `matching.ts`, que
> només veu `answered` / `no_data` / `no_position`: s'aplicarà en construir el
> paquet publicat de cada municipi, i aquest constructor encara no existeix. El
> que sí que està implementat és el que passa després: l'exclusió del denominador
> i el llindar de cobertura del 70%.

| Confiança | Com es mostrarà | Entrarà al càlcul? |
|---|---|---|
| < 0,45 | «Sense dades» | **No.** L'afirmació surt del denominador d'aquest subjecte |
| 0,45 – 0,69 | Valor amb insígnia «indici» i evidència a un clic | Sí |
| ≥ 0,70 | Valor normal, amb evidència a un clic | Sí |

Traduït a paraules, i a l'etiqueta que veurà el lector:

- **0,90** = ho hem llegit a l'acta del ple, amb el nom del grup al costat i la
  data. A la pantalla: el valor, i «votat al ple del 14/03/2024».
- **0,80** = ho diu el seu programa electoral, i en tenim la frase.
- **0,75** = ho va dir el portaveu a un mitjà, i en tenim l'enllaç.
- **0,45–0,69** = no en tenim cap prova directa, només un indici. A la pantalla hi
  sortirà una insígnia que dirà literalment **«indici»** i, si hi cliques, «tenim
  aquesta pista i res més; jutgeu-la vosaltres».
- **per sota de 0,45** = no ho ensenyem. A la pantalla: **«No ho sabem»**.

D'on surt el 0,45: és el sostre de `brand_inherited` (0,40) més un marge, escollit
perquè la posició heretada de marca no arribi mai a publicar-se. És una decisió de
disseny, no una mesura d'encert, i ho diem perquè es vegi. Entra al mateix
calibratge que els sostres.

«Sense dades» no penalitzarà el partit: l'afirmació no comptarà per a ell. El que
sí que es veurà és la **cobertura**: si un subjecte té posició en menys del 70% de
les afirmacions respostes no es classifica i va al grup «Dades insuficients», amb
el comptador «Posició coneguda en 12 de 25». Qui no coneixem no pot guanyar el
test. Aquesta part sí que està implementada i provada
([`matching.ts`](../../packages/shared-schemas/src/matching.ts)).

Cas diferent: si el partit respon el qüestionari i diu «no ens hi posicionem»,
és una decisió seva, no un forat nostre, i puntua −1
([04-coincidencia.md](04-coincidencia.md)). Aquesta penalització també està
implementada.

## Per què la posició heretada de la marca no arriba mai a publicar-se

> ⏳ **Encara no construït.** Ni la etiqueta `brand_inherited`, ni el llindar, ni
> el test que ho hauria de garantir. El que sí que existeix és el mapatge de
> marques entre 2015, 2019 i 2023
> ([`brands.ts`](../../packages/shared-schemas/src/brands.ts)).

`brand_inherited` tindrà un sostre de 0,40, per sota del llindar de 0,45. És a
dir: **una posició basada només en el que diu la marca estatal o catalana no es
mostrarà mai i no entrarà mai al càlcul**. Ho volem blindar amb un test bloquejant
a la publicació; encara no està escrit, i mentre no ho estigui, la garantia és una
frase d'aquest document i no una comprovació de la màquina.

El motiu: el que volem mesurar són decisions municipals, i la disciplina de vot
supramunicipal en un ple és més feble del que sembla —la mateixa marca vota coses
oposades a dos pobles veïns segons qui governi i amb qui hagi pactat. Atribuir a
«ERC de Cardedeu» el que diu ERC al Parlament seria inventar-nos dades amb
aparença de rigor. El guardarem només com a **senyal intern**: si la heretada i la
inferida local divergeixen molt, l'ítem entrarà a la cua de revisió humana.

## Verificació adversarial en tres capes

> ⏳ **Encara no construït, cap de les tres.** No hi ha taula de posicions ni de
> cites, cap funció de similitud de text (`lib/text.ts` només normalitza noms),
> cap segon model i cap tasca programada. **Encara no s'ha calculat cap posició,
> o sigui que encara no hi ha hagut res a verificar.** Ho desbloqueja, per aquest
> ordre: l'esquema de posicions, la primera extracció, i llavors les capes.

Cap posició no es publicarà només perquè el model l'hagi proposada. En diem
«adversarial» perquè cada capa està feta per portar la contrària a l'anterior.

**Capa 1 — comprovació literal, sense IA.** Es farà en codi: la cita haurà
d'aparèixer al fragment d'origen (exacta o amb similitud ≥0,92 —o sigui,
pràcticament igual, amb marge per a espais i guionets), el nom de la candidatura o
un dels seus àlies haurà d'aparèixer a la font, i la data haurà de caure dins del
mandat o ser la del programa. Les cites que no passin s'esborraran; si s'esborra
l'única cita `supports: value`, la posició caurà a «sense dades».

**Capa 2 — verificador amb l'enunciat negat.** Un segon model, més potent,
tornarà a buscar evidència partint de l'afirmació **invertida**, i emetrà un
veredicte: `confirm`, `downgrade`, `flip` o `no_data`. Aquesta capa ataca el
problema típic d'aquests sistemes: el model troba el que busca perquè busca el que
ja ha decidit.

**Capa 3 — repàs nocturn de tot el conjunt** (escombrades SQL), no ítem a ítem:

- candidatura amb més del 30% de posicions sense dades → revisió de fonts;
- afirmacions gairebé idèntiques entre municipis on la mateixa marca discrepa en
  ≥3 punts → o és real i és notícia, o és un error nostre;
- afirmació on totes les candidatures cauen al mateix costat → no discrimina i
  es retira del test (però la posició es conserva).

**Qui aprova, i com es veurà.** Aquí aquest document es contradeia i ho corregim.
No direm que cap posició no arriba al portal sense que una persona l'hagi
aprovada, perquè no serà cert: quan la capa 2 confirmi el valor i la confiança
quedi dins de ±0,15, la posició s'aprovarà automàticament; qualsevol altre
resultat anirà a revisió humana. El que sí que direm, i el que ens comprometem a
sostenir, és això: **cap posició no es publicarà sense passar una capa de
verificació independent de la que l'ha proposada, i les que no la superin passaran
per una persona.** Perquè es pugui comprovar des de fora, cada posició del paquet
públic portarà un camp visible `approved_by`, amb valor `auto` o les inicials i la
data de qui l'ha aprovada, i cada municipi publicarà quin percentatge de les seves
posicions són auto-aprovades.

La precisió de l'extracció de vots la mesurarem contra el CSV obert de Rubí
—l'únic ajuntament català que publica el vot de cada regidor a cada moció— i
contra un conjunt d'or d'uns 100 parells etiquetats a mà. Cap de les dues coses no
s'ha fet encara: el conjunt d'or no està construït i no hem descarregat mai el CSV
de Rubí. Publicarem la xifra el mateix dia que publiquem el primer municipi amb
brúixola, i abans no.

## «Què diuen» i «què han fet»

> ⏳ **Encara no construït.** Requereix tenir alhora posició declarada i inferida
> per al mateix subjecte i la mateixa afirmació, i avui no en tenim cap ni de
> l'una ni de l'altra.

Quan la declarada i la inferida difereixin en 2 punts o més de l'escala, la fitxa
mostrarà els dos valors alhora amb l'evidència de cadascun: marcador sòlid la
declarada, anell buit la inferida.

Com que serà el mòdul més acusador del portal, tindrà regles estrictes: exigirà
una explicació editorial escrita, no només els dos números; l'hauran d'aprovar
**dues persones** diferents abans de publicar-lo; i no s'hi faran servir
adjectius, només què van declarar, què van votar i quan.

**Decisió d'interfície pendent:** un commutador «Mostra la trajectòria» al
resultat, que recalculi la coincidència amb les posicions inferides allà on hi hagi
declarada i mostri la diferència per partit («−6 pt»), amb la declarada per
defecte. Tal com està definit avui el paquet publicat, això no es pot fer:
`Subject.positions` guarda **un sol** valor per afirmació i `SubjectPosition` no
distingeix declarada d'inferida
([`matching.ts`](../../packages/shared-schemas/src/matching.ts)). Caldria estendre
el tipus perquè cada posició pugui portar les dues variants i executar el càlcul
dues vegades. Mentre no es decideixi, el commutador no és una promesa.

## Dret de rèplica

> ⏳ **Encara no construït.** No hi ha portal, ni enllaços personals, ni cua de
> revisió, ni pàgina de canvis: `web/public/` és avui només la landing de
> «properament». Ho desbloqueja la publicació del primer municipi, que és el que
> dona contingut a la fitxa que enviarem.

A partir del gener de 2027, cada candidatura amb representació rebrà una invitació
amb enllaç personal que contindrà **la seva fitxa ja feta**: les posicions que
haurem inferit, amb les cites. Hi podran fer tres coses:

1. **Respondre el qüestionari**, i llavors la seva resposta passarà a ser la
   posició vigent, amb data.
2. **Discrepar d'una posició inferida**: obrirà una entrada a la cua de revisió
   amb la seva argumentació. Si aporten evidència que no teníem, la posició es
   corregirà i el canvi quedarà al registre públic de canvis.
3. **Publicar un comentari** al costat de qualsevol posició inferida, encara que
   no els donem la raó; es publicarà sense editar.

L'estat de cada candidatura serà públic: no contactada → convidada → recordada →
parcial → ha respost. Qui no respongui també es veurà. I qualsevol persona, no
només els partits, podrà informar d'un error des de qualsevol posició, cita o
dada; el nombre de correccions aplicades es publicarà.

**Proposta oberta** (no és al pla aprovat): fixar un termini de resposta a les
rèpliques —proposem 7 dies laborables per publicar el comentari del partit i 15
per resoldre la discrepància— i publicar-ne el compliment.

**Proposta oberta**: exposar l'historial de posicions retirades. Es versionaran i
no se sobreescriuran mai, o sigui que hi seran; falta decidir si es publiquen.

## Límits d'aquest mètode

Els límits que descriuen com es comportarà el sistema són previsions, no
observacions: encara no hem processat ni una acta, i per tant no els hem vist
passar. Els que surten d'un recompte que ja hem fet van marcats.

- **Llistes locals sense rastre digital.** Una llista de veïns d'un poble de 800
  habitants sovint no té programa penjat, ni web, ni xarxes actives, ni surt a la
  premsa. Si el seu grup vota poc o les actes no desglossen, no en sabrem res i ho
  direm. El mètode serà estructuralment més generós amb els partits organitzats:
  és un biaix real que no sabem corregir.
- **Municipis petits.** ✅ Això sí que està comptat: dels 947 municipis, 92 no
  tenen cap acta al feed de l'AOC i 59 en tenen entre 1 i 9. Es quedaran amb
  radiografia i sense brúixola, amb l'avís explícit que no hi ha prou evidència
  pública. El recompte de cobertura és l'única part del pipeline d'actes que
  existeix avui
  ([`adapters/aoc.ts`](../../packages/pipeline/src/adapters/aoc.ts)); les actes
  no s'han descarregat mai.
- **Actes que no desglossen el vot.** «Aprovat per majoria» és una frase molt
  freqüent i no diu qui va votar què. Guardarem el resultat del punt, cap posició,
  i la confiança de l'extracció quedarà per sota de 0,50.
- **El feed barreja Ple i Junta de Govern**, i el camp que ens donen només diu
  Ordinària / Extraordinària / Urgent. Els classificarem pel nom del fitxer i la
  capçalera del PDF, i ens equivocarem algun cop. Les actes de Junta de Govern no
  tenen vots per grup i mai no generaran posicions.
- **Actes escanejades.** Si el PDF és una imatge haurà de passar per OCR i la
  qualitat del text baixarà. La comprovació literal de la cita farà caure aquestes
  posicions més sovint del que voldríem: fallarà cap a «sense dades», el costat
  segur.
- **El grup no sempre és la candidatura.** Si un grup es trenca o hi ha no
  adscrits, el vot posterior no representa la llista del 2023. Ho voldrem detectar
  comparant la composició actual del ple amb els electes —avui no ho fem—, i tot i
  així l'atribució serà discutible. **Proposta oberta**: a partir de la primera
  escissió, marcar les posicions posteriors del grup amb un avís a la fitxa de la
  candidatura.
- **La premsa cita marques, no candidatures.** Molts titulars diuen «el PSC defensa
  X» sense concretar quin PSC. Si l'àlies local no apareix a la font, la capa 1
  esborrarà la cita: perdrem evidència vàlida per no atribuir malament.
- **Les posicions caduquen i no ho sabem mesurar bé.** Baixarem la confiança d'un
  vot de fa més de dos anys, però un partit pot haver canviat d'opinió legítimament
  ahir. La data hi serà sempre; la interpretació és del lector. **Proposta oberta**:
  aplicar la mateixa davallada per antiguitat a les cites de premsa, que ara no en
  tenen cap.
- **Fins a l'abril de 2027 no hi ha candidats del 2027.** Tot el que publiquem
  abans parlarà del mandat 2023–2027, no de qui es presentarà. Ho direm a cada
  pàgina.
- **La IA hi serà, i és fal·lible.** Farem servir models per llegir actes,
  programes i premsa i proposar posicions amb cites, amb els límits que hem
  explicat a dalt. Les tres capes de verificació reduiran els errors però no els
  eliminaran, i mentre no estiguin construïdes no redueixen res. Per això cada
  posició portarà l'evidència al costat: justament perquè no ens hàgiu de creure,
  i pugueu anar a la font i comprovar-ho.
- **I el límit d'avui, que és el més gran de tots.** Cap d'aquests mecanismes no
  està construït. Aquest document és el contracte que ens imposem abans de
  començar, perquè després es pugui comprovar si l'hem complert.
