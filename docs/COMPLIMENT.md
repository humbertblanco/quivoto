# Promeses i compliment: contrastar el programa de 2023 amb el mandat

> **Estat a 29 d'agost de 2026.** Aquest document descriu un mètode que **encara no existeix**. D'això, avui està
> implementat: **res** — cap taula de promeses, cap programa processat, cap veredicte emès, cap línia de codi que
> llegeixi un programa. L'única feina feta és un **rastreig manual de disponibilitat de programes** als quatre
> municipis pilot (Esplugues, Sabadell, Girona, Reus), l'agost de 2026, d'on surten els exemples d'aquestes pàgines:
> es van obrir llavors, no s'han tornat a comprovar, i valen com a il·lustració, no com a dada publicable. La resta
> és compromís, i va marcada amb ⏳ secció a secció.

Contrastar el que un partit va prometre amb el que ha passat és la peça més delicada de quivoto, perquè és l'única
on la temptació d'opinar entra per la porta del davant. Aquí es fixa la ratlla: **només diem si allò escrit ha
passat, i amb quin document ho sabem**. No diem si la promesa era bona, ni si valia la pena, ni si el partit ha
governat bé. Comparteix escala d'evidència amb [com convertim vots en posicions](metodologia/02-posicions.md) i
depèn del [registre d'actes](metodologia/03-actes-i-mocions.md), que tampoc no existeix.

## 1. Què és una promesa

> ⏳ **Encara no construït.** No hi ha extractor, ni esquema `promise`, ni cap programa segmentat. Els criteris són
> una convenció escrita, sense cap prova de concordança entre anotadors.

Un programa barreja compromisos concrets, intencions genèriques i declaracions de valors. Només els primers es poden
contrastar amb un document. Una frase entra al comptador com a **promesa** si compleix les cinc condicions alhora:

1. **Acció identificable.** Verb amb objecte: construir, aprovar, obrir, suprimir, rebaixar. «Impulsar», «apostar
   per», «vetllar per» i «posar al centre» no són accions: són postures.
2. **Objecte delimitat.** Es pot dir on, què o quant: «una escola bressol al barri X» sí, «més places» no.
3. **Subjecte que es compromet.** Ho farà la candidatura o l'ajuntament. Si el subjecte real és la Generalitat o
   Renfe, va a la via `altri` (§4).
4. **Termini dins del mandat.** Si el text posa un horitzó posterior al 2027, queda fora.
5. **Acreditació nomenable per endavant.** Es pot dir, **abans de mirar res**, quin tipus de document acreditaria que
   ha passat: acord de ple, partida, llicència, ordenança al BOP. Si no sabem anomenar el document, no és verificable.

El cinquè criteri fa tota la feina: és un test operatiu, no una valoració. Exemples reals dels programes dels pilots:

| Frase | Classificació | Per què |
|---|---|---|
| «Construir la comissaria de l'Àrea Montesa» (Junts, Esplugues) | Promesa | Acció, lloc i acreditació nomenable: llicència o adjudicació |
| «Crearemos una partida con 125.000 € para familias con hijos con necesidades especiales» (PP, Esplugues) | Promesa | Xifra i instrument: la partida és al pressupost aprovat o no hi és |
| «Rebaixar a la meitat la taxa de terrasses» (Junts, Esplugues) | Promesa | Contrastable amb l'ordenança fiscal publicada al BOP |
| «Apostar per l'habitatge assequible» | Intenció | Cap objecte delimitat, cap document nomenable |
| «Posar les persones al centre» | Valor | No hi ha acció |

Els programes numerats faciliten la feina (Sabadell En Comú Podem numera de l'1 a la 330; el PSC de Girona, de l'1 a
la 478 a través de nou PDFs de capítol); els que no, com Junts a Girona o els fullets en format imatge de Junts i VOX
a Esplugues, exigeixen segmentació manual i deixen més marge d'error.

### L'escala de verificabilitat, decidida a cegues

L'error que arruïnaria l'exercici seria classificar la promesa **després** de saber què ha passat: acabaríem
declarant «no verificable» tot allò incòmode. Per evitar-ho es decideix en una passada prèvia i tancada, sense haver
mirat cap document del mandat.

| Nivell | Què vol dir | Conseqüència |
|---|---|---|
| **V1 · verificable** | Compleix els cinc criteris i té un tipus de document acreditatiu clar | Entra al comptador |
| **V2 · parcialment** | Té acció i subjecte, però l'objecte admet lectures diferents («millorar l'enllumenat del barri») | Entra amb el llistó declarat per escrit abans de mirar res |
| **V3 · no verificable** | Intenció, valor o acció sense document nomenable | No entra al comptador; es publica igualment a la fitxa |

La passada es **congela** amb data, signatura i empremta del fitxer, i tota reclassificació queda al registre de
canvis amb el motiu. Una V2 exigeix escriure llavors què comptarà com a complerta («mínim un contracte adjudicat
d'enllumenat en aquest barri»), i aquest llistó ja no es toca.

## 2. Els quatre estats

> ⏳ **Encara no construït.** No hi ha estats desats enlloc ni cap veredicte emès.

| Estat | Llistó documental |
|---|---|
| **Complerta** | Un o més documents públics amb efecte jurídic que acrediten el fet, dins del mandat, citats amb localitzador (data, expedient, punt de l'ordre del dia, pàgina). L'abast del document ha de cobrir el de la promesa: una partida de 40.000 € no acredita una promesa de 125.000 € |
| **En curs** | Un document acredita una **etapa necessària i intermèdia** —adjudicació sense recepció d'obra, aprovació inicial pendent de la definitiva, partida consignada i no executada— i s'escriu quina etapa falta. Sense nomenar-la, no és «en curs»: és «no verificable» |
| **Incomplerta** | Evidència **positiva** de no-fer: acord que ho desestima, retirada expressa de la partida, resposta escrita que ho nega. O bé el mandat s'acaba i el document acreditatiu no hi és **en un registre de publicació exhaustiva** on hauria d'haver estat necessàriament (pressupostos, ordenances al BOP, perfil del contractant) |
| **No verificable** | Tota la resta, incloent-hi «hem buscat i no hem trobat res» |

La segona via de l'«incomplerta» és la perillosa, i per això va limitada: l'absència només compta quan el document
acreditatiu es publica **sempre** i **tot** —si una taxa canvia, surt al BOP; si hi ha diners, surten al pressupost—
i quan la promesa no tenia cap altra via. Fora d'això, no trobar res vol dir no verificable.

**«No verificable» no és un fracàs del mètode: és un resultat.** Si la majoria de promeses d'un municipi hi acaben,
ho publiquem tal com és, amb el nombre al davant. Maquillar-ho seria la mentida.

Hi ha, a més, un estat **de candidatura**, no de promesa: **sense programa recuperable**. És el cas d'Esplugues en
Comú Podem, que va deixar caure el domini del programa de 2023 i avui és al govern: la seva fitxa no dirà 0 promeses
ni desapareixerà en silenci, dirà que el document no es va poder recuperar, què es va provar i quan.

## 3. Els tipus d'evidència

> ⏳ **Encara no construït.** No hi ha camp d'evidència, ni citador, ni còpia arxivada.

De més a menys força. Un veredicte de «complerta» exigeix almenys un document dels cinc primers nivells.

| # | Evidència | Per què val |
|---|---|---|
| 1 | Ordenança, reglament o ordenança fiscal al BOP o al DOGC | Acte normatiu, datat, oposable |
| 2 | Acord de ple o de junta de govern, amb número de punt i acta a la seu | Decisió amb efecte, atribuïble i votada |
| 3 | Adjudicació o formalització de contracte al perfil del contractant | Compromís de despesa amb tercer identificat |
| 4 | Partida al pressupost aprovat definitivament, i la seva liquidació | Distingeix el pressupostat de l'executat |
| 5 | Llicència, decret d'alcaldia o resolució amb número d'expedient | Acte administratiu individualitzat |
| 6 | Registre d'una altra administració (Generalitat, cadastre, entitats) | Font independent de l'ajuntament |
| 7 | Resposta escrita a una petició d'accés a la informació (Llei 19/2014) | Vincula l'administració al que respon |

**Només corroboren, mai acrediten soles:** l'informe de seguiment del PAM, la memòria de mandat, la nota de premsa i
el butlletí municipals, la xarxa social del partit, la peça periodística i el balanç d'un partit sobre si mateix.

**Per què una nota de premsa municipal no basta.** Perquè no diu què ha passat, diu què s'anuncia: apareix en el
moment de la voluntat i no en el del fet, l'escriu la part interessada, no en surt cap conseqüència jurídica si allò
no arriba mai, i el projecte anunciat es pot desestimar després sense cap nota que ho digui. **Pot ser la primera
baula d'una cadena, mai l'última**: serveix per trobar la data i l'expedient, i llavors cal anar a l'acord que sí que
acredita. El mateix val per als plans de govern i els seus informes de seguiment —el PAM d'Esplugues 2023-2027 o el
primer informe de seguiment del PAM de Sabadell, de desembre de 2024—: són el govern parlant de si mateix, i per tant
índex de pistes excel·lents i prova inservible.

## 4. L'asimetria entre govern i oposició

> ⏳ **Encara no construït.** No hi ha classificació de vies ni cap regla de publicació aplicada.

És el problema seriós d'aquest exercici, i en realitat són tres. **D'execució:** només qui governa pot construir una
escola bressol, i la promesa d'un partit amb tres regidors no va fracassar, no va estar mai a la seva mà.
**Documental:** en allò que l'oposició sí que pot fer, el rastre és més prim que el d'un govern que decreta cada dia.
I **de supervivència del programa**, que no esperàvem i és la pitjor: a Sabadell, els dos únics partits que encara
tenen el programa de 2023 al seu web són els dos més petits de l'oposició, el que governa amb majoria absoluta no en
té cap còpia consultable i el d'ERC només sobreviu perquè algú el va arxivar. La disponibilitat correlaciona **a la
inversa** amb el poder: un comptador ingenu premiaria qui ha desaparegut i castigaria qui ha estat transparent.

**La proposta: classificar cada promesa per via de compliment, també abans de mirar res.**

| Via | Què vol dir | Qui la pot complir |
|---|---|---|
| `govern` | Cal executar: obra, contracte, plantilla, pressupost | Només qui governa |
| `ple` | Es pot portar al ple: moció, esmena, proposta d'ordenança, vot | Qualsevol grup |
| `grup` | Depèn només del partit: assemblea de barri, publicar els comptes del grup, renunciar a una retribució | Qualsevol grup |
| `altri` | Depèn d'una altra administració | Ningú del tot; només es verifica si s'ha reclamat formalment |

- **Qui no ha governat no rep cap percentatge global**, sinó dos comptadors separats, `ple` i `grup`, que sí que
  mesuren coses que estaven a la seva mà. Les promeses `govern` van en una llista a part, etiquetades **«no depenia
  d'ells»**, i no compten ni com a complertes ni com a incomplertes: ni s'amaguen ni es puntuen.
- **Qui ha governat rep el comptador `govern`**, l'únic que respon la pregunta que la gent es fa. Els percentatges de
  govern i d'oposició no van mai a la mateixa escala visual, ni a la mateixa columna, ni ordenats junts.
- **Sempre es publica el denominador.** A Esplugues, PSC i ERC tenen programes de 3.500 i 4.300 paraules i els
  fullets de Junts i VOX unes 500: amb vuit promeses, una de sola mou el percentatge dotze punts. Per sota de **20
  promeses V1 no hi ha percentatge**, només la llista.
- **Els governs de coalició responen des de la data d'entrada.** A Sabadell, Junts no és oposició: va signar l'acord
  de govern amb el PSC, i tractar-lo com un partit petit sense rastre seria regalar-li «no verificables» on hi ha
  responsabilitat de govern. A Esplugues hi va haver relleu d'alcaldia l'octubre de 2024: les promeses s'atribueixen
  a la candidatura, no a la persona, però la fitxa diu qui presidia cada tram.

Un percentatge només és honest si el numerador i el denominador mesuren el mateix per a tothom qui hi surt. Com que
aquí no ho fan, publiquem menys xifra i més llista.

## 5. Què no farem mai

> ⏳ **Encara no construït**, com tota la resta. Val com a compromís.

- No **puntuarem governs**: cap índex de bona gestió, cap valoració de si una promesa valia la pena.
- No farem **rànquings de compliment entre municipis**. Girona té 307 actes al feed i Esplugues 40: comparar-los
  mesuraria la política de publicació, no el compliment.
- No ho convertirem en una **nota**, ni en un semàfor per partit, ni en un percentatge únic a la portada d'una
  candidatura, ni **inferirem el compliment** d'una nota de premsa, d'una foto d'inauguració o d'una observació
  nostra. Tampoc comptarem com a **incomplerta** una promesa que no hem sabut verificar.
- No **completarem** un programa que no trobem amb el programa marc estatal del partit ni amb el d'un altre municipi.
- No publicarem cap veredicte sense que **una persona hagi obert el document**.

## 6. El procediment

> ⏳ **Encara no construït.** No hi ha pipeline, ni cua de revisió, ni interfície de validació.

1. **Localitzar i arxivar el programa**, amb còpia local, URL i data: hi ha PDFs dels pilots que ja només existeixen
   a la nostra carpeta. *(Persona.)*
2. **Extreure el text** amb `pdftotext`; si el PDF és una imatge —els fullets de Junts i VOX a Esplugues— es marca
   com a transcripció manual i es fa constar a la fitxa.
3. **Segmentar en promeses candidates**, una frase per candidat. *(Model.)*
4. **Classificar verificabilitat i via, a cegues**, i congelar-ho amb data i signatura abans de mirar cap document
   del mandat. *(Model proposa, persona valida.)*
5. **Buscar documents acreditatius.** *(Model proposa candidats amb enllaç i localitzador.)*
6. **Obrir cada document i comprovar la cita literal.** *(Persona, obligatòriament.)*
7. **Assignar l'estat.** *(Persona, exclusivament.)*
8. **Signar:** dues signatures de persones diferents per a «complerta» i «incomplerta», una per a la resta.
9. **Publicar** amb identificador estable, cites i data de darrera comprovació.

**La frontera exacta.** El model proposa text, classificacions i documents candidats, i pot redactar la
justificació; **no assigna cap estat**, i cap sortida seva es publica sense que una persona hagi obert el document
citat i n'hagi comprovat cita, localitzador i data. Tres regles més: si la persona no pot obrir el document —enllaç
mort, mur de pagament, seu caiguda— l'estat és **no verificable** i el motiu queda escrit; l'estat mai pot ser més
favorable que allò comprovat, i el model el pot rebaixar però no apujar; i cada veredicte desa la versió del model i
el *prompt* que el va proposar, perquè es pugui refer.

## 7. Com es corregeix

> ⏳ **Encara no construït.** No hi ha formulari, ni expedient, ni registre de canvis. Ho comparteix tot amb
> [correccions i reclamacions](metodologia/05-neutralitat-i-dades.md).

Cada promesa tindrà identificador estable (`municipi/candidatura/2023/nnn`) i pàgina pròpia amb el text literal, la
classificació, l'estat, els documents citats i la data de comprovació, objectable per qualsevol persona i per la
candidatura.

- **Rèplica prèvia sobre l'extracció.** Trenta dies abans de publicar, cada candidatura rep la llista sencera de les
  promeses que n'hem extret i la seva classificació: és la finestra per dir «això no era una promesa», «aquesta en
  falta» o «l'heu partida malament». Es discuteix l'extracció, encara no els veredictes.
- **Rèplica sobre el veredicte, sempre oberta.** **Una rèplica amb document guanya**: si aporta un acord, una partida
  o una llicència que acrediten el fet, l'estat canvia i es diu qui l'ha aportat. Sense document s'arxiva com a
  al·legació, es publica al costat de la promesa i **no canvia l'estat**. Responem en quinze dies; si no hi arribem,
  es fa constar.
- **Registre de canvis.** Tot canvi d'estat surt amb data, estat anterior, estat nou, motiu i qui l'ha demanat. No
  esborrem veredictes: els superem.
- **El programa perdut és recuperable.** Si una candidatura ens envia el programa que no vam saber trobar, li refem
  la fitxa sencera. «Sense programa recuperable» és sempre reversible, i la fitxa dirà des de quin dia ho és.

## Límits d'aquest mètode

- **La major part de les promeses seran no verificables**, i el titular honest d'aquesta feina probablement serà
  aquest, no cap percentatge de compliment.
- **Depèn d'un document que sovint ja no existeix.** Quatre anys després, els programes de 2023 dels pilots estan
  escampats entre webs de partit, CDNs de mitjans locals, Scribd i el Wayback Machine, i almenys dos dominis han
  desaparegut del tot. Cap comptador no ho arregla.
- **La segmentació és una decisió nostra.** Partir un paràgraf en dues promeses o en una canvia el denominador;
  publicarem la segmentació sencera perquè es pugui discutir.
- **Un document acredita l'acte, no el resultat.** Que una escola bressol tingui llicència i adjudicació no vol dir
  que hi hagi criatures a dins; si la promesa parlava del resultat, l'estat és «en curs».
- **El llistó afavoreix qui promet coses barates de documentar.** El programa del PP d'Esplugues, amb costos xifrats,
  és més fàcil de verificar que un escrit en intencions: és un biaix a favor seu, i el diem.
- **Depenem que les seus electròniques publiquin.** Un ajuntament que no penja actes ni pressupostos genera «no
  verificables» que no són culpa de cap partit.
- **No hi ha conjunt d'or.** No tenim cap corpus de promeses ja classificades per mesurar la nostra concordança entre
  anotadors. Fins que no en fem un, tota xifra que surti d'aquí s'ha de llegir amb aquesta reserva al davant.
