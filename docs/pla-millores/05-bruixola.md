# La brúixola de quivoto contra les brúixoles que funcionen: anàlisi i pla

> Annex de la segona ronda del [pla de millores](PLA.md) (26-10-2026). Al pla, les troballes d'aquest document es citen amb el prefix **BRU-** (per exemple, BRU-2.1).

Estat a: **26-10-2026** · Eleccions: **23-05-2027** (209 dies) · Abast: només la brúixola (test, afirmacions, posicions, càlcul, resultat, qüestionari a candidatures, ètica, privadesa, calendari).

Aquest document **no repeteix** el que ja diuen `docs/pla-millores/PLA.md`, `02-dades-i-grafiques.md` §4 (DAD-4.1 a 4.7) i `01-usabilitat.md` §5 (UX-5.1 a 5.7). Quan una troballa en toca una d'aquestes, hi remet i hi afegeix el que falta. Les fonts són a cada troballa amb URL, i la llista sencera és al final (§13). Tot el que hi ha aquí es va consultar el 26-10-2026. Allà on una font no ha permès verificar un detall, es diu.

Prefix de les troballes: **BRU-**. Esforç: **S** < 1 dia · **M** 1–3 dies · **L** > 3 dies. Impacte: **alt / mitjà / baix**.

---

## 0. Diagnosi en sis punts

1. **El mètode de càlcul de quivoto ja està alineat amb el millor que hi ha**, i no cal tocar-lo gaire. Fa servir la distància L1 (*city-block*), que smartvote va adoptar el 2025 i que la recerca recent troba més robusta contra la manipulació que l'euclidiana. Compta l'«esquivar» com a −1, com el Valkompass de la SVT. Té un desempat amb preguntes extra, com De Stemtest. El risc no és la fórmula: és **què hi entra** (posicions binàries ±2, cobertura esbiaixada cap al govern) i **com es presenta** (un sol percentatge sense incertesa).
2. **Cap brúixola fa 947 conjunts locals de 25 afirmacions.** Les que cobreixen centenars de municipis (SVT a Suècia: 290 municipis; StemWijzer als Països Baixos: 258 de 340 el 2026) fan servir un **nucli comú gran (≈15–17 afirmacions) i només 2–7 de locals**, o una versió gratuïta amb afirmacions estàndard per tipus de municipi. quivoto planteja el contrari (18 locals i 7 compartides) a tot arreu. Amb l'equip que té, això dona com a molt unes desenes de municipis.
3. **El que fa únic quivoto, «el que han fet», té precedents que se'n poden copiar peces**: EuroMPmatch / YourVoteMatters, una brúixola basada en 20 votacions reals del Parlament Europeu; TheyWorkForYou, amb els resums de vot i les regles per a les absències; smartmonitor; i l'estudi suís que troba un **85 %** de coherència entre el que es diu abans de l'elecció i el que es vota després. El que **cap** fa és barrejar en un sol percentatge posicions declarades i posicions deduïdes d'un vot. quivoto no ho hauria de fer tampoc.
4. **El 2027 el subjecte canvia i el disseny actual no ho preveu**: grups municipals → candidatures. Moltes llistes no tindran historial (candidatures noves, escissions, independents). El 2023 hi va haver **109 municipis amb una sola llista** i **173 amb llistes obertes** (menys de 250 habitants). Allà una brúixola de partits no té sentit.
5. **Hi ha dos riscos legals i de privadesa que encara no s'han tractat.** (a) La LOREG prohibeix publicar sondejos en els cinc dies anteriors a la votació, i la Junta Electoral Central ha obert expedient per «sondejos encoberts». Publicar agregats de resultats de la brúixola pot caure-hi. (b) L'enllaç `?r=` envia les respostes al servidor. Hi ha una solució trivial: posar-les al fragment `#`, que no viatja mai al servidor.
6. **Recomanació d'abast: N ≈ 30 municipis amb brúixola completa** (nivell A), **un nucli compartit de 12–15 afirmacions per a ≈ 100–150 municipis** (nivell B) i radiografia per a la resta (nivell C), amb criteris publicats i aplicats mecànicament (§11).

---

## 1. Benchmark: què fan les brúixoles de referència

| Eina (país) | Afirmacions | Qui les escriu | Posicions dels partits | Càlcul | Resultat | Escala municipal |
|---|---|---|---|---|---|---|
| **Wahl-O-Mat** (DE, bpb) | 80 → 38 | Redacció de 24 joves + experts; els partits no hi participen | Les responen els partits (sí / no / neutral), amb una justificació de fins a 500 caràcters; la bpb no les edita | Coincidència 2 punts, parcial 1, oposats 0; pes ×2; l'omesa surt | Percentatge per partit | **Lokal-O-Mat** (Universitat de Düsseldorf, HHU) a 10 ciutats de Rin del Nord-Westfàlia el 2025, ≈30 tesis, tallers amb joves de cada ciutat |
| **StemWijzer** (NL, ProDemos) | longlist 60–70 → 25–30 | Redactor de ProDemos + taller amb els partits locals; el municipi revisa els fets | Les responen els partits amb una explicació; ProDemos en comprova la coherència amb el programa | Acord; pes per a les importants | Llista ordenada | **258 de 340 municipis el 2026**: 73 de pagament amb afirmacions locals (11.250–15.750 €) i 185 amb la versió gratuïta d'afirmacions estàndard per tipus de municipi |
| **Kieskompas** (NL) | ≈30 | Investigadors + partits + veïns | Els partits responen; Kieskompas «comprova totes les posicions» (mètode mixt: codificació d'experts + autoposicionament) | Espai 2D + acord | Mapa i llista | 49 municipis el 2026; ≈9.500 € per municipi |
| **smartvote** (CH) | ≥30 locals | smartvote, amb propostes dels partits i del municipi; la decisió final és de smartvote | **Candidats** individuals; han de respondre-ho tot | **L1 (*city-block*) des del 2025**; abans, euclidiana; pesos 0,5 / 1 / 2 | Percentatge, *smartspider* (8 eixos), *smartmap* 2D | Més de 200 eleccions; un 70–80 % dels candidats municipals hi responen; 11.000–14.750 CHF per municipi |
| **Valkompass SVT** (SE) | Nacional 35; municipal **17 generals + 2–7 locals** | SVT, amb un panell de 2.600 persones; propostes dels partits locals i de les redaccions locals | Les responen els partits locals, **sense revisió** de la SVT a escala local | Punts 11 / 8; ×2 si és important; **−1 si el partit no respon** | Percentatge | **290 municipis** el 2026; 2,1 milions d'usos de les locals el 2022; contacte amb ≈2.500 organitzacions locals de partit |
| **De Stemtest** (BE, UAntwerpen / UCLouvain) | 35, binàries | Equip acadèmic amb la rúbrica pròpia | Els partits responen i hi posen pesos; es va **excloure** un partit perquè el seu programa només permetia respondre un 10 % de les afirmacions | Acord ponderat; **5 preguntes extra si hi ha empat** | Rànquing, sense percentatge; **no publiquen agregats** | (Edicions locals en anys anteriors) |
| **Vote Compass** (CA/AU) | ≈30 | Vox Pop Labs + acadèmics, amb un pilot de 1.000 persones representatives | **Codificades pels investigadors** a partir de documents (dos codificadors). Els partits s'autoposicionen; les discrepàncies es resolen amb un informe i, si cal, amb un **consell assessor acadèmic** | Pesos | Mapa multidimensional + barres per tema | Edicions municipals: els candidats s'autocodifiquen sense validació |
| **EuroMPmatch / YourVoteMatters** (UE) | 20 votacions clau | Panell d'experts (VoteWatch) que tria les votacions; l'equip les explica de manera neutral amb arguments a favor i en contra | **Vots reals** dels eurodiputats | Proximitat (Hix) | Eurodiputat, partit i grup més propers | — (870.000 qüestionaris acabats el 2019) |
| **DecidirBCN / Decidir23J** (CAT/ES, UPF + UOC) | 24–25 | Rodon, Guinjoan i Ioannidis | Experts que codifiquen els programes | Distància | Percentatge + mapa 2D | Només Barcelona el 2023 |

**Lectura per a quivoto.** (1) 25 afirmacions és la mida normal; el rang és 20–38. (2) Totes les que escalen tenen un **nucli comú** i delegueen la redacció local, sigui en tallers, en redaccions locals o en el municipi. (3) Gairebé totes **pregunten als partits**. Només Vote Compass, EuroMPmatch i Decidir posicionen sense preguntar, i en aquests casos hi ha codificació doble o un panell. (4) Cap no publica un rànquing agregat de resultats d'usuaris abans de la votació.

---

## 2. Disseny i selecció d'afirmacions

### BRU-2.1 Invertir la proporció local/compartida segons el nivell del municipi
- **Què:** el pla actual és 18 locals + 7 compartides a tots els municipis (`01-afirmacions.md`, «Locals i compartides: 18 + 7»).
- **Per què:** les brúixoles que cobreixen centenars de municipis fan el contrari. La **SVT** fa 17 generals + 2–7 locals a les 290 brúixoles municipals ([SVT, «Så tog vi fram kompassfrågorna»](https://www.svt.se/nyheter/inrikes/sa-tog-vi-fram-kompassfragorna-och-sa-beraknas-matchningen-mot-partier-och-kandidater); [SVT, «SVT:s valkompass igång»](https://www.svt.se/nyheter/inrikes/svts-valkompass-igang-sa-fungerar-den)). El **StemWijzer** «start» fa servir afirmacions estàndard per tipus de municipi (rural, urbà, gran ciutat) i hi afegeix alguna local; 185 dels 258 municipis del 2026 van triar aquesta versió ([NOS](https://nos.nl/l/2602954); [ProDemos](https://prodemos.nl/app/uploads/2025/05/StemWijzer_ProDemos_Gemeenteraadsverkiezingen2026.pdf)). A quivoto, el coll d'ampolla documentat és la revisió humana (23.675 frases), i a l'Hospitalet i a Terrassa no hi ha cap vot citable (`AFIRMACIONS-MOSTRA.md`).
- **Proposta:**
  - **Nivell A** (≈30 municipis): 25 = 15 locals + 10 compartides.
  - **Nivell B** (≈100–150): 12–15 compartides + 0–5 locals, en tres variants per tipus de municipi: rural / intermedi / urbà-metropolità, com el StemWijzer «start».
  - Les compartides tenen text únic i un **context local generat** amb les xifres de la radiografia (IBI, habitatge, turisme) i, si n'hi ha, el vot d'aquell ple sobre aquell tema.
- **Esforç:** M (redefinir les quotes a `01-afirmacions.md` i a l'esquema DAD-4.1) · **Impacte:** alt (és el que fa possible passar de 3 a 150 municipis).

### BRU-2.2 Un nucli compartit dissenyat com una enquesta, no com un conjunt local
- **Què:** les 7 compartides estan definides per tema (habitatge, IBI, turisme, mobilitat, seguretat, llengua, participació), però no tenen text ni procés.
- **Per què:**
  - [Walgrave, Nuytemans i Pepermans (2009)](https://medialibrary.uantwerpen.be/oldcontent/container2608/files/Walgrave%20et%20al%202009%20-%20voting%20aid%20applications.pdf) van simular 500.000 conjunts de 36 afirmacions triades d'un fons de 50. La quota de consells d'un mateix partit anava del **5 % al 32 %** segons el conjunt.
  - [Lefevere i Walgrave (2014)](https://dare.uva.nl/id/c55af723-1679-47c7-8949-61e8828bf5b2): més afirmacions esquerra-dreta afavoreixen els partits extrems, i més afirmacions sobre temes salients perjudiquen els partits.
  - La SVT prova la bateria general amb un panell de 2.600 persones i la tria per poder de discriminació (ETA), equilibri de respostes i taxa de «no ho sé».
  - [Tangian (2017)](https://econpapers.wiwi.kit.edu/downloads/KITe_WP_100.pdf) proposa triar el subconjunt que maximitza la distància entre els perfils dels partits.
- **Proposta:**
  1. Una longlist de 30–40 compartides, escrita **una sola vegada** amb una lectura contrària externa (§8).
  2. Una prova amb panell (BRU-8.3).
  3. Una selecció final de 10–15 amb una **funció publicada** que maximitzi la discriminació entre les famílies de partit catalanes i compleixi les quotes direccionals, amb la sensibilitat «Walgrave» publicada (BRU-8.1).
  4. Cada compartida porta `clau_compartida`. Això permet comparar «ERC a Reus contra ERC a Sabadell» i alimenta el control de qualitat entre municipis que ja preveu `01-afirmacions.md`.
- **Esforç:** M · **Impacte:** alt.

### BRU-2.3 Afegir un tercer tipus d'ítem: «Com hauries votat tu?», amb la moció real
- **Què:** avui un vot del ple es tradueix en una afirmació de futur reescrita. L'error 6 de `01-afirmacions.md` (el vot d'un paquet presentat com a divisió sobre un punt de dins) i el límit «van votar en contra per qui la presentava» venen d'aquesta traducció.
- **Per què:**
  - **EuroMPmatch / YourVoteMatters** (EUI i LSE, Hix) pregunta directament per 20 votacions clau triades per un panell d'experts. L'equip escriu una explicació neutral i els arguments de les dues bandes, i compara l'usuari amb el **vot real** de cada eurodiputat ([EUmatrix](https://eumatrix.eu/en/blog/EUmatrix-partners-with-European-University-Institute-to-launch-EuroMPmatch); [LSE](https://www.lse.ac.uk/government/research/impact/case-studies/helping-votes-make-choices-in-european-elections)).
  - Un experiment de camp amb aquesta eina troba que els usuaris voten 2–6 punts més sovint el partit més proper ([Frese, Hix i Lachat 2025, *BJPolS*](https://doi.org/10.1017/S000712342510118X)).
- **Proposta:**
  - Al nivell A, un **bloc opcional de 6–10 «Vota com un regidor»** amb el títol literal del punt, un resum neutre de 2 línies, un argument a favor i un en contra (escrits i signats en la doble lectura) i l'enllaç a l'acta.
  - L'usuari respon **A favor / En contra / M'abstindria / No ho sé**.
  - El càlcul d'aquest bloc és **binari**, com la dada, i resol DAD-4.6 (l'escala que en realitat és binària) sense inventar intensitats.
  - El resultat es mostra **separat**: «En el que han votat aquest mandat coincideixes un X % amb…» (BRU-6.2).
- **Esforç:** M (la dada ja existeix als JSON i a les votacions estructurades de F3-3) · **Impacte:** alt (és la versió més fidel del valor diferencial del projecte).

### BRU-2.4 Mida de la longlist: 2× no basta quan les posicions surten d'inferència
- **Què:** el pla és un fons de 35 per a 25 en viu + 10 de reserva.
- **Per què:**
  - StemWijzer parteix de 60–70 per arribar a 25–30. Wahl-O-Mat, de 80 per arribar a 38 ([bpb FAQ](https://www.bpb.de/themen/wahl-o-mat/bundestagswahl-2025/558464/haeufig-gestellte-fragen-zum-wahl-o-mat)).
  - El 2024, De Stemtest va descartar un 19 % de les afirmacions per no discriminar (`01-afirmacions.md`).
  - A quivoto la pèrdua és més alta perquè a més cal que hi hagi un vot citable per grup: Esplugues situa grups en 16 de 25, Badalona en 10 de 25 i Sant Just en 7 de 22 (`06-posicions-deduides.md`).
- **Proposta:** longlist de **≥ 50** al nivell A. La selecció final es fa **després** de saber la cobertura real per grup (no abans) i amb una restricció de cobertura mínima per grup (BRU-4.4).
- **Esforç:** S (canvi de regla) · **Impacte:** mitjà.

### BRU-2.5 Detectar la incomprensió amb un botó propi, no amb el «ni una cosa ni l'altra»
- **Què:** avui l'escala té un 0 («ni una cosa ni l'altra») i un «Ometre». La retirada d'afirmacions depèn d'una analítica que no existeix (`01-afirmacions.md`, «Retirar…»).
- **Per què:**
  - [Kamoen i Holleman (2017)](https://doi.org/10.18148/srm/2017.v11i2.6728) van estudiar **34 brúixoles municipals** neerlandeses amb 357.858 usuaris i van fer entrevistes cognitives a 60 persones.
  - Els problemes de comprensió venen de la **terminologia tècnica i fiscal, l'argot de l'administració local i les referències a llocs concrets**. Exactament el que tenen les afirmacions locals de quivoto («ordenança fiscal núm. 25», «porta a porta comercial»…).
  - Els usuaris quasi mai busquen el terme: endevinen i responen. Els problemes semàntics acaben en «no ho sé» i els pragmàtics, en el punt mig. Els dos botons es confonen ([Kamoen i Holleman 2025](https://research.tilburguniversity.edu/en/publications/difficult-wordings-in-vaas-predicting-no-opinion-and-middle-respo/)).
- **Proposta:**
  1. Separar **«No l'entenc»** d'«Ometre» i del 0.
  2. El comptador de «No l'entenc» per afirmació **no revela cap opinió política**: es pot recollir agregat sense tocar l'article 9 del RGPD (vegeu BRU-9.3). Seria el primer indicador de retirada que funciona fins i tot als pobles petits.
  3. Mostrar el **context i l'statu quo abans de respondre**, en un toc. Els usuaris del xatbot de [Kamoen, Liebrecht i van Lieshout (2026)](https://doi.org/10.17645/pag.11234) demanaven sobretot informació d'statu quo.
  4. Una regla de redacció nova: cap topònim menor ni número d'ordenança a l'enunciat. Van al context.
- **Esforç:** S–M · **Impacte:** alt.

### BRU-2.6 Ordre de les preguntes i efecte d'ordre
- **Què:** les afirmacions surten en un ordre fix dins el JSON.
- **Per què:** [Berdoz et al. (ETH, 2025)](https://arxiv.org/pdf/2505.13329) identifiquen 11 vulnerabilitats a smartvote i proposen, com a mitigació, **aleatoritzar l'ordre de les preguntes i dels desempats**.
- **Proposta:**
  - Ordre aleatori per blocs temàtics, amb una llavor desada per sessió perquè l'enllaç compartit continuï funcionant.
  - Treure el desempat alfabètic final de `sortMatches` (afavoreix sistemàticament les llistes que comencen per «A», com «Acord per…»). Substituir-lo per «empat» declarat (BRU-4.3).
- **Esforç:** S · **Impacte:** mitjà.

---

## 3. Com escalen StemWijzer, smartvote i la SVT: flux, qüestionari, terminis i cost

### BRU-3.1 Copiar el calendari de ProDemos: la feina dura comença 5 mesos abans
- **Què:** `PLA-DADES-2027.md` situa l'escriptura dels conjunts al gener–març i el formulari a les candidatures a finals d'abril.
- **Per què:** el calendari del StemWijzer per a una elecció del **18 de març de 2026** va ser: oct–nov afirmacions, des. respostes dels partits, gen. control de les respostes, feb. publicació ([ProDemos](https://prodemos.nl/app/uploads/2025/05/StemWijzer_ProDemos_Gemeenteraadsverkiezingen2026.pdf)). Burgdorf (smartvote) va fer una sessió informativa als partits **8 mesos abans**, va donar accés als candidats 8 setmanes abans i va publicar el web 6 setmanes abans ([informe final de Burgdorf](https://burgdorf.ch/wAssets/docs/Wahlen-Abstimmungen/Gemeindewahlen-2024/Schlussbericht-smartvote.pdf)). Wetzikon: des.–gen. qüestionari, finals de gener tancat, a mitjan febrer el web per als candidats, a finals de febrer el web per al públic, i eleccions el 12-04 ([Wetzikon](https://www.wetzikon.ch/wAssets/docs/stadtratbeschluesse/2025/SRB-139-Begleitung-Behoerdenwahlen-2026-durch-Online-Wahlhilfe-von-smartvote-Kreditbewilligung.pdf)).
- **Proposta:** a §11 hi ha el calendari complet. La clau és **enviar el qüestionari als partits que ja tenen grup municipal al febrer**, no a l'abril, i deixar per a després del 28-04 només les candidatures noves.
- **Esforç:** S (decisió) · **Impacte:** alt.

### BRU-3.2 Contactar els partits per les federacions, i començar ara la llista de contactes
- **Què:** quivoto no té correus de càrrecs electes: el camp `e_mail` és buit a totes les files de `m5nd-xjza` (`docs/metodologia/05-neutralitat-i-dades.md` §7).
- **Per què:** la SVT va arribar a **≈2.500 organitzacions locals de partit** a través de les organitzacions nacionals i de recerca pròpia, amb Indikator Opinion per recollir-ho ([SVT FAQ](https://www.svt.se/nyheter/inrikes/fragor-och-svar-om-svts-valkompasser)). smartvote informa els partits a través del municipi.
- **Proposta:**
  - Al novembre, demanar a les secretaries d'organització de PSC, ERC, Junts, Comuns, CUP, PP, Vox, Aliança Catalana i a les federacions d'independents (p. ex. Independents de la Selva, Tots per l'Empordà; [VilaWeb](https://www.vilaweb.cat/noticies/anomalies-municipals-meitat-catalans-batlle/)) un **punt de contacte per municipi**, i fer servir el registre de grups municipals de cada seu electrònica.
  - Desar cada contacte amb la font i la data, en una taula `contactes_candidatura` sense dades privades.
  - Publicar l'estat «no contactada → convidada → recordada → ha respost», que ja promet `02-posicions.md`.
- **Esforç:** M (continu) · **Impacte:** alt.

### BRU-3.3 Regles del qüestionari, preses de les que funcionen
- **Què:** el qüestionari està esbossat a `02-posicions.md` («Dret de rèplica») i a DAD-4.7, però sense regles de resposta.
- **Per què:**
  - **Wahl-O-Mat:** justificació de **≤ 500 caràcters**; la redacció no edita les respostes, però pot assenyalar incoherències, i només el partit les pot canviar ([bpb](https://www.bpb.de/themen/wahl-o-mat/bundestagswahl-2025/558464/haeufig-gestellte-fragen-zum-wahl-o-mat)).
  - **smartvote:** els candidats **han de respondre totes les preguntes** per sortir-hi ([smartvote, mètode *city-block*](https://blog.smartvote.ch/wp-content/uploads/2026/01/sv25_Wahlempfehlung_de-city-block.pdf)).
  - **Vote Compass:** autoposicionament **sense l'opció neutral**, amb un comentari obligatori si es vol el neutral. Si no coincideix amb la codificació documental, hi ha un **informe de reconciliació amb cites** i, al final, un **consell assessor acadèmic** ([Vox Pop Labs](https://files.voxpoplabs.com/votecompass/methodology.pdf)).
  - **SVT:** si un partit va respondre estratègicament, s'hi va parlar i en alguns casos es va pactar una resposta revisada; a escala local no es va poder revisar.
- **Proposta:**
  1. Resposta obligatòria a totes les afirmacions, o cap. Això **tanca l'asimetria «el silenci surt més barat que la franquesa»** que `04-coincidencia.md` es compromet a tancar: qui respon no pot deixar forats, i qui no respon queda com a «no ha respost», visible.
  2. Justificació de ≤ 500 caràcters, publicada tal qual.
  3. **Informe de reconciliació** automàtic quan la declarada i la inferida difereixen en ≥ 2 punts (ja és el llindar de «què diuen / què han fet»), amb 7 dies per respondre.
  4. Un **consell assessor de 3 politòlegs** sense vincle de partit (p. ex. proposats per l'ACCP o per universitats) que resolgui les disputes que quedin, amb les resolucions publicades.
  5. Les prioritats del partit (×2 a `matching.ts`) només es poden declarar alhora que les respostes.
- **Esforç:** M (esquema i formulari) + S (consell) · **Impacte:** alt.

### BRU-3.4 Qui proposa els temes locals: redaccions locals i un formulari obert
- **Què:** les afirmacions locals surten d'un agent que llegeix actes, programes i premsa.
- **Per què:**
  - La SVT fa servir les seves redaccions locals i mitjans associats, a més de les propostes dels partits.
  - ProDemos, des del 2026, treballa amb DPG Media i els periodistes regionals ([NOS](https://nos.nl/l/2602954)).
  - El Lokal-O-Mat fa tallers amb joves de cada ciutat ([MKW NRW](https://www.mkw.nrw/system/files/media/document/file/mkw_2025-08-20_pm_lokal-o-mat.pdf)).
  - Burgdorf recull propostes dels partits però deixa la decisió final a l'operador, per independència.
- **Proposta:**
  - Un formulari «Proposa un tema per al teu poble» obert a partits, entitats i periodistes, que entri a la mateixa cua de l'agent amb l'etiqueta de procedència.
  - Proposar a l'**Associació Catalana de la Premsa Comarcal**, a l'AMIC i a la XAL (La Xarxa) que els mitjans locals proposin temes i publiquin (incrustin) la brúixola del seu municipi, sense que puguin editar les afirmacions. És el model SVT/DPG.
  - **Avís:** el cas DPG del 2026 (la brúixola darrere d'un mur de subscripció) mostra que cal un contracte que garanteixi l'accés obert.
- **Esforç:** M · **Impacte:** alt (abaixa el cost per municipi i en multiplica l'abast).

### BRU-3.5 El cost real d'una brúixola local: una referència per decidir N
- **Què:** no hi ha cap estimació de cost per municipi a la documentació de la brúixola. `COMPLIMENT-VEREDICTE.md` en té una només per a les promeses.
- **Per què:** els preus de mercat d'una brúixola municipal amb afirmacions locals són **9.500 €** (Kieskompas; [Noordenveld](https://noordenveld.bestuurlijkeinformatie.nl/Document/View/c0d74b4f-f1e3-4f0a-b859-a82e65d50d03)), **11.250–15.750 €** (StemWijzer) i **11.000–14.750 CHF** (smartvote a Burgdorf i a Wetzikon). Són equips professionals amb redaccions i amb els partits obligats a respondre.
- **Proposta:** fer servir com a pressupost intern **10–15 h de persona per municipi de nivell A**:
  - 3–4 h per revisar 25 afirmacions;
  - 3–5 h per verificar ≈100–150 cel·les de posició (25 × 4–6 grups) contra l'acta;
  - 2–3 h per al qüestionari i la reconciliació;
  - 1–2 h per a la publicació i les correccions.
  
  Amb 1 persona equivalent a temps complet a la brúixola entre desembre i abril (≈600 h útils), el sostre és **40–50 municipis A**. Per tant, **N = 30** deixa marge per a correccions en campanya. Validar la xifra amb el pilot de desembre (cronometrar-lo) i publicar el ritme real, com ja promet `01-afirmacions.md`.
- **Esforç:** S · **Impacte:** alt (evita prometre el que no es pot fer).

---

## 4. La fórmula i com es mostra el resultat

### BRU-4.1 Mantenir L1: ara té suport empíric i precedent
- **Què:** `matching.ts` fa servir la distància de Manhattan (L1). `04-coincidencia.md`, a «Límits», ho presenta gairebé com una feblesa («tracta tots els salts igual»).
- **Per què:**
  - smartvote va passar de l'euclidiana a **city-block** el 2025 ([smartvote](https://smartvote.ch/en/voting-advice); [document de mètode](https://blog.smartvote.ch/wp-content/uploads/2026/01/sv25_Wahlempfehlung_de-city-block.pdf)).
  - [Berdoz et al. (2025)](https://arxiv.org/pdf/2505.13329) troben que **L1 i la distància angular resisteixen millor la manipulació que L2**, sense perdre precisió. Canviar la funció de distància pot moure la freqüència de recomanació d'un partit fins a un **105 %**, i triar les preguntes, fins a un **261 %**.
- **Proposta:** documentar-ho a `04-coincidencia.md` com a decisió justificada, amb les dues cites. Però **no presentar mai un sol algorisme com a veritat**: vegeu BRU-4.2.
- **Esforç:** S · **Impacte:** mitjà (credibilitat).

### BRU-4.2 Mostrar la robustesa del resultat, no només un percentatge
- **Què:** el resultat és un percentatge per candidatura. Hi ha `needsShootOut` amb un marge fix de 3 punts.
- **Per què:**
  - [Louwerse i Rosema (2014)](https://doi.org/10.1057/ap.2013.30): **la majoria** dels usuaris del StemWijzer haurien rebut un altre consell amb un altre model espacial.
  - [Rosema i Louwerse (2016)](https://doi.org/10.1002/poi3.139) recomanen presentar **una llista de preferència i no un «millor partit»**.
  - [Stockinger et al. (2024)](https://link.springer.com/article/10.1007/s10676-024-09790-6) recomanen reconèixer la subjectivitat de manera visible i oferir presentacions amb algorismes alternatius.
  - De Stemtest mostra un rànquing sense percentatge.
- **Proposta:** al navegador, que ja té totes les dades:
  1. **Estabilitat per remostreig**: recalcular el rànquing traient una afirmació cada vegada (*leave-one-out*, 25 càlculs) o amb 200 remostrejos *bootstrap* de les afirmacions respostes.
  2. Si el primer canvia en més d'un 20 % dels remostrejos, el titular diu **«Empat: A i B»**, i no «T'assembles més a A». Substitueix el marge fix de 3 punts per un criteri amb fonament, i resol de passada DAD/UX-5.5 (empats).
  3. Mostrar el percentatge **arrodonit a 5** i una etiqueta verbal per franges, a l'estil de TheyVoteForYou (95–100 «coincidiu gairebé sempre», 60–85 «sovint», 40–60 «a mitges»…; [exemple](https://theyvoteforyou.org.au/people/representatives/lalor/joanne_ryan/policies/167)).
  4. A «Com es calcula», un commutador **«Calcula-ho amb un altre mètode»** (L1 contra acord simple binari, com el del Wahl-O-Mat), amb el rànquing que surt de cadascun.
- **Esforç:** M (funció pura a `matching.ts` + tests) · **Impacte:** alt.

### BRU-4.3 Res de mapa 2D; sí comparació per tema, però amb el nombre d'ítems
- **Què:** `04-coincidencia.md` descarta l'eix esquerra-dreta i promet una «aranya per temes».
- **Per què:**
  - smartvote fa *smartspider* (8 eixos) i *smartmap*, però amb ≥30 preguntes i candidats que les responen totes.
  - Vote Compass avisa que les seves gràfiques **es poden contradir** perquè mesuren coses diferents.
  - A quivoto, amb 25 afirmacions i 12–15 temes, molts temes tindran **1–2 ítems** i una cobertura parcial per grup. Una aranya convertiria un sol vot en un radi sencer.
- **Proposta:**
  - Una **taula de punts per tema**: files = temes, una marca per candidatura i el text «basat en N afirmacions» a cada fila, sense polígon.
  - Mostrar només els temes amb ≥ 2 afirmacions amb posició.
  - Mantenir la decisió de no fer mapa 2D, i citar Lefevere i Walgrave (2014) com a argument afegit: més ítems esquerra-dreta afavoreixen els extrems.
- **Esforç:** S–M · **Impacte:** mitjà.

### BRU-4.4 La cobertura esbiaixada cap al govern és un biaix de rànquing, i s'ha de mesurar
- **Què:** a Esplugues, les 16 afirmacions situades ho són «pràcticament només per al bloc de govern» (`06-posicions-deduides.md` §7). A l'Hospitalet, la regla «moció rebutjada = govern en contra» garanteix que el govern tingui posició i l'oposició no (`AFIRMACIONS-MOSTRA.md`).
- **Per què:** l'article 4.2 de la **Declaració de Lausana** diu que «els creadors de VAA han de vigilar que el disseny no afavoreixi sistemàticament cap partit o candidat» ([citat a la Universitat de Southampton](https://eprints.soton.ac.uk/450905/1/AM_A_normative_set.pdf)). Amb el llindar del 70 %, l'oposició cau a «Dades insuficients» i desapareix del rànquing per una qüestió d'arxiu, no de política.
- **Proposta:**
  1. Una **quota de cobertura per grup a la selecció**: cap grup amb representació no pot quedar per sota del 60 % de les afirmacions en viu; si passa, es baixa al nivell B a aquell municipi.
  2. Publicar per municipi l'**índex de paritat de cobertura** (mínim/màxim d'afirmacions situades per grup).
  3. Comptar com a «situat» un grup només per les vies `acta` i `nominal`. Les vies `aritmetica` i `bloc` són fortes per al govern i febles per a l'oposició (que les mostri, però que no omplin la quota).
- **Esforç:** M · **Impacte:** alt (neutralitat).

### BRU-4.5 Les respostes declarades i les deduïdes no poden tenir la mateixa escala sense avís
- **Què:** les posicions deduïdes són ±2 (DAD-4.6). Les declarades podran ser ±1.
- **Per què:** el maig del 2027, una candidatura que respon el qüestionari tindrà valors intermedis i el 100 % de cobertura. Una que no respon, ±2 en un 40–60 % de les afirmacions. Amb L1, els valors extrems s'allunyen més de la majoria d'usuaris (que fan servir ±1). Les deduïdes **perden** sistemàticament contra les declarades, i no per raó política. Berdoz et al. ho mostren a smartvote: **les respostes moderades fan pujar la visibilitat**, i alguns partits la podrien quadruplicar.
- **Proposta:** decidir-ho com a D-BRU-1 (§12). Recomanació: **el rànquing principal del maig es calcula només amb posicions declarades per a totes les candidatures que responen**, en igualtat. El que han fet es mostra com a capa (BRU-6.2), i les candidatures que no responen surten amb un rànquing propi «segons el que han votat», amb càlcul binari (BRU-2.3) i etiquetat.
- **Esforç:** M · **Impacte:** alt.

---

## 5. Llistes noves, independents i candidatures sense historial al ple

### BRU-5.1 Regla de continuïtat grup 2023 → candidatura 2027, escrita i publicada
- **Què:** `brands.ts` mapeja marques entre eleccions, però no hi ha regla per heretar l'historial d'un grup municipal cap a una candidatura nova.
- **Per què:** la SVT tracta una fusió durant el mandat com a partit nou sense escons, i quan hi ha una escissió només convida la part que representa la llista elegida el 2022 ([SVT FAQ](https://www.svt.se/nyheter/inrikes/fragor-och-svar-om-svts-valkompasser)). TheyWorkForYou separa vots que «puntuen» de vots «informatius» i calcula per període ([mySociety 2024](https://www.mysociety.org/2024/04/23/improving-the-focus-of-theyworkforyous-voting-summaries/)).
- **Proposta:** una candidatura 2027 hereta el «què han fet» d'un grup només si (a) és la mateixa marca o coalició segons `brands.ts` **i** (b) no hi ha hagut escissió del grup durant el mandat (canvis de grup ja ingerits). Si no, «candidatura sense historial al ple», sense excepcions editorials. Els regidors no adscrits no traspassen mai el vot a cap llista. Publicar la taula de continuïtat per municipi.
- **Esforç:** M · **Impacte:** alt.

### BRU-5.2 Candidatures noves: només declarades, i en igualtat de visibilitat
- **Què:** els documents assumeixen subjectes amb historial.
- **Per què:**
  - El VG Köln va aturar el Wahl-O-Mat el 2019 perquè limitar la comparació a 8 partits perjudicava els petits; es va reactivar després d'un acord extrajudicial ([LTO](https://www.lto.de/recht/nachrichten/n/bpb-beschwerde-entscheidung-vg-koeln-wahl-o-mat-verfassungswidrig); [t-online](https://www.t-online.de/nachrichten/id_85808940/europawahl-2019-wahl-o-mat-ist-wieder-online-.html)).
  - De Stemtest va excloure un partit perquè no tenia prou programa: és un criteri explícit, no un buit silenciós ([VRT](https://www.vrt.be/vrtnws/nl/2024/04/09/de-stemtest-2024-wat-is-het-hoe-werkt-het-en-wat-kan-ik-eruit/)).
  - Les candidatures independents són presents en prop d'**un terç** dels municipis.
- **Proposta:**
  - Totes les candidatures proclamades apareixen a la brúixola **sempre**, mai filtrades.
  - Les que no responen surten en una caixa «No ha respost el qüestionari» amb la data de la invitació.
  - L'ordre de les caixes no és per vots del 2023: és alfabètic o aleatori amb llavor. L'ordre per vots afavoreix els que ja hi eren; `docs/metodologia/05-neutralitat-i-dades.md` §2 ho preveu, i s'hauria de canviar per a la llista del resultat.
- **Esforç:** S · **Impacte:** alt (legal i de neutralitat).

### BRU-5.3 Municipis amb una sola llista o amb llistes obertes: no hi ha brúixola de partits
- **Què:** el pla parla dels 947 municipis i no exclou cap cas per construcció.
- **Per què:**
  - El 2023 hi va haver **109 municipis amb una sola llista** (17 d'independents sols) ([VilaWeb](https://www.vilaweb.cat/noticies/anomalies-municipals-meitat-catalans-batlle/)).
  - **173 municipis** van votar amb llistes obertes (menys de 250 habitants, vot a persones i majoria relativa) i 6 funcionen en consell obert ([3Cat](https://www.3cat.cat/3catinfo/com-es-vota-als-municipis-petits-un-sistema-diferent-per-als-pobles/noticia/3229033/)).
  - Als municipis de menys de 10.000 habitants, el **68 %** votaria un candidat que li agrada encara que fos d'un partit que no li agrada.
- **Proposta:** excloure **per regla** del nivell A i del B els municipis amb menys de 3 candidatures el 2023 o el 2027, els de llistes obertes i els de consell obert. Allà la pàgina diu per què i ofereix la radiografia i la llista de candidats. Si mai es fa res als pobles de llistes obertes, ha de ser a nivell de **candidat** (model smartvote / vaalikone finlandès), no de partit, i no abans del 2031.
- **Esforç:** S · **Impacte:** alt (evita pàgines buides i malentesos).

---

## 6. «Què diuen» i «què han fet»: precedents i disseny

### BRU-6.1 Precedents per citar i dels quals aprendre
- **Schwarz, Schädel i Ladner (2010)** compara les respostes a smartvote amb els vots al Consell Nacional suís (2003–2009): **≈85 % de coherència**. Els canvis són més probables en diputats nous, vots poc visibles, temes no centrals per al partit, partits de centre i, sobretot, quan la posició prèvia del diputat **difereix de la majoria del seu grup** ([SPSR](https://serval.unil.ch/notice/serval:BIB_254A6225FF57)).
- **TheyWorkForYou** (2024–2025):
  - els resums de vot es limiten a votacions que fan servir poders reals («accions, no paraules»);
  - les absències ja no compten com a abstencions;
  - s'hi afegeixen els **acords sense votació** («Agreements»);
  - el resum no ha de ser hipersensible a la fórmula;
  - el 73 % dels resums no van canviar amb la reforma i 120 de 80.000 van girar de sentit ([mySociety 2024](https://www.mysociety.org/2024/04/23/improving-the-focus-of-theyworkforyous-voting-summaries/); [TWFY Votes 2025](https://www.mysociety.org/2025/05/19/theyworkforyou-votes/)).
  - TheyWorkForYou Votes permet **anotar** vots i preveu que els mateixos representants anotin els seus.
- **TheyVoteForYou (AU):** pes 25 per a les votacions principals i 5 per a les menors, absència = 50 % i pes 1, i l'avís «policy in draft» a les polítiques sense revisar ([exemple](https://theyvoteforyou.org.au/people/representatives/lalor/joanne_ryan/policies/167)).
- **EuroMPmatch** (BRU-2.3) i **smartmonitor** de Politools, una base de dades del comportament parlamentari suís des del 2012 ([Politools](https://politools.net/en/projects-services/smartmonitor/)).
- **Qué hacen los diputados** (Political Watch): etiqueta automàticament les iniciatives del Congrés amb 23 temes i és de codi obert ([civictech.guide](https://civictech.guide/projects/que-hacen-los-diputados)). És un precedent espanyol de seguiment, no de brúixola.

### BRU-6.2 Dos percentatges separats, mai barrejats
- **Què:** `02-posicions.md` preveu un sol valor per afirmació i un commutador «Mostra la trajectòria» que no és una promesa.
- **Per què:** cap precedent barreja en una sola xifra les declaracions i el comportament. Schwarz et al. mostren que la discrepància té causes estructurals (disciplina de grup, centre), no necessàriament incoherència.
- **Proposta:** al resultat del maig:
  - **«Segons el que diuen per al 2027»**: percentatge, qüestionari.
  - **«Segons el que han votat 2023–2027»**: percentatge, bloc BRU-2.3 i posicions deduïdes, càlcul binari.
  
  Totes dues amb la seva cobertura. Sense diferència en punts («−6 pt»): és la xifra més acusadora i la menys robusta. A la fila de cada afirmació, la marca plena (diuen) i l'anella (fan), com ja preveu `02-posicions.md`, i una **anotació del partit per vot** (model TWFY Votes), que és el dret de rèplica aplicat a cada vot.
- **Esforç:** M · **Impacte:** alt.

### BRU-6.3 Votacions que «puntuen» i votacions «informatives»
- **Què:** totes les afirmacions amb evidència de vot compten igual.
- **Per què:** TWFY ha passat de tenir votacions fortes i febles a tenir votacions que «puntuen» i votacions «informatives»: les informatives no entren a la xifra.
- **Proposta:** un camp `relacio_vot: "directa" | "informativa"`, on «informativa» és un vot de paquet, una esmena o un vot d'una moció d'un altre grup amb motius declarats a l'acta. Les informatives es mostren a la fila però no entren a cap percentatge. Concreta l'error 6 de `01-afirmacions.md` i encaixa amb el model `Votacio` de DAD-4.3.
- **Esforç:** S (sobre DAD-4.3) · **Impacte:** mitjà-alt.

---

## 7. Transparència i ètica: la Declaració de Lausana com a llista de comprovació

La **Declaració de Lausana sobre les VAA** (Anderson et al., 2014; vegeu Garzia i Marschall, eds., *Matching Voters with Parties and Candidates*, ECPR Press) fixa «estàndards i requisits mínims» per a tots els creadors de VAA: organització i gestió, usabilitat, accés, selecció i funcionament. No n'hem pogut consultar el text original. Els articles que segueixen es citen a través de [l'article normatiu de la Universitat de Southampton](https://eprints.soton.ac.uk/450905/1/AM_A_normative_set.pdf) i de [Stockinger et al. 2024](https://link.springer.com/article/10.1007/s10676-024-09790-6). **Cal obtenir el text íntegre** abans de publicar el compliment.

### BRU-7.1 Una «fitxa tècnica» pública per municipi i per versió
| Requisit (font) | Què ha de fer quivoto | Estat avui |
|---|---|---|
| Art. 4.2: el disseny no ha d'afavorir sistemàticament cap partit | Informe de biaix per municipi (BRU-8.1) i paritat de cobertura (BRU-4.4) | No existeix |
| Art. 5.1: fer visible el supòsit que la proximitat és coincidència en polítiques | Una frase fixa al resultat: «Només mesura coincidència en aquestes N afirmacions; no mesura gestió, confiança ni persones» | Parcial (`04-coincidencia.md`, «No és un consell de vot») |
| Art. 5.4: l'algorisme documentat i explicat als usuaris | Enllaç al codi **que s'executa** (lligat a DAD-4.4 i al *hash*) i l'exemple a mà | El codi provat no és el que corre (DAD-4.4) |
| Stockinger 1: subjectivitat visible i algorismes alternatius | BRU-4.2 | No |
| Stockinger 2: participació diversa | Formulari de temes (BRU-3.4), panell (BRU-8.3), consell assessor (BRU-3.3) | No |
| Stockinger 3: documentació pensada per a l'usuari | «Com es calcula» d'una pantalla, amb l'exemple de l'usuari | Prototip `resultat.html` |
| Stockinger 4: valors i supòsits explícits | Llista pública de decisions editorials (70 %, −1, ×2, quotes) amb el seu efecte mesurat | Les decisions estan escrites, però no se n'ha mesurat l'efecte |
| Padilla (Southampton): fiabilitat mesurable (precisió, rang mitjà, matrius de confusió) | Proves de «pseudovotant» (BRU-8.2) | No |

- **Proposta:** generar `fitxa-tecnica.json` i una pàgina per municipi amb:
  - qui ha escrit, revisat i fet la lectura contrària de les afirmacions;
  - la mida de la longlist, les afirmacions descartades i per què;
  - les quotes assolides;
  - el percentatge d'afirmacions proposades per IA i retocades;
  - la versió de l'algorisme (*hash*);
  - la taula de sensibilitat (70 % / −1 / ×2 sí o no);
  - l'estat de resposta de cada candidatura;
  - els canvis.
  
  És l'equivalent de la «ficha técnica» que la LOREG exigeix als sondejos (BRU-9.1), aplicada voluntàriament.
- **Esforç:** M · **Impacte:** alt.

### BRU-7.2 Declarar l'ús d'IA amb xifres
- **Què:** `METODOLOGIA.md` explica que els agents proposen i que hi ha autoaprovació amb `approved_by: auto`.
- **Per què:** els xatbots de brúixola augmenten el coneixement percebut però no el real ([Kamoen et al. 2026](https://doi.org/10.17645/pag.11234)). Les guies europees d'IA fiable, aplicades a les VAA, puntuen baix en transparència ([Stockinger et al. 2024](https://link.springer.com/article/10.1007/s10676-024-09790-6)).
- **Proposta:** a la fitxa tècnica, el **% d'afirmacions i de posicions que cap persona ha llegit**. Recomanació ferma: **0 % d'autoaprovació a les posicions del nivell A** abans del 23-M. Amb N = 30 es pot pagar (BRU-3.5).
- **Esforç:** S · **Impacte:** alt (confiança).

---

## 8. Auditories i validació abans de publicar

### BRU-8.1 Simulació «Walgrave» per municipi: quant depèn el resultat de la tria
- **Què:** l'anàlisi de sensibilitat promesa és només sobre el llindar del 70 %.
- **Per què:** Walgrave et al. (2009) i Berdoz et al. (2025) mostren que la tria de les preguntes pot moure més que qualsevol altre paràmetre.
- **Proposta:** un script del pipeline que, per a cada municipi:
  1. genera 10.000 usuaris sintètics, amb respostes uniformes i també amb respostes «realistes» mostrejades de la distribució del panell (BRU-8.3);
  2. calcula la **quota de primers llocs** de cada candidatura amb el conjunt publicat i amb 1.000 conjunts alternatius de 25 trets de la longlist;
  3. assenyala si el conjunt publicat deixa una candidatura **fora del rang interquartílic** de les alternatives.
  
  El resultat surt a la fitxa tècnica. És **intern** fins al 24-05-2027 (BRU-9.1). Són usuaris sintètics, no resultats reals.
- **Esforç:** M · **Impacte:** alt.

### BRU-8.2 Proves de «pseudovotant» a CI
- **Proposta:** per a cada municipi publicat, un test que comprovi que:
  - (a) un usuari que respon exactament com la candidatura X té X primera, o empatada si n'hi ha de bessones;
  - (b) un usuari que respon exactament el contrari de X té X última;
  - (c) cap candidatura no és primera per a més d'un *p* % (p. ex. 60 %) dels usuaris uniformes sense una raó documentada.
  
  És la idea de «fiabilitat» de l'article de Southampton, en forma de test barat.
- **Esforç:** S · **Impacte:** mitjà-alt.

### BRU-8.3 Proves amb persones: cognitives als pilots, panell per a les compartides
- **Per què:** la SVT fa servir un panell de 2.600 persones (Universitat de Göteborg) i Vote Compass un pilot de ≥1.000 persones representatives. Kamoen i Holleman van fer **60 entrevistes cognitives**. ProDemos fa revisar els fets al municipi.
- **Proposta:**
  1. Als 3 pilots: **5–8 entrevistes cognitives** per municipi amb el protocol de «pensar en veu alta», com proposa `01-afirmacions.md`, centrades en el vocabulari local (BRU-2.5).
  2. Per a les compartides: proposar al **Centre d'Estudis d'Opinió** o a l'equip de **Decidir** (Rodon i Guinjoan, UPF/UOC; [UOC](https://www.uoc.edu/es/news/2023/121-decidirbcn-recomendador-voto-votantes-partidos-politicos)) un mòdul de 30–40 ítems en un panell existent. Dona discriminació per partit (ETA, com la SVT) i una distribució «realista» per a BRU-8.1.
  3. Proves d'usabilitat amb 5 persones de més de 65 anys i 5 de menys de 25 a 390 px. StemWijzer té una versió per a lectors amb poca alfabetització i una per a joves (Young Voice).
- **Esforç:** M (1), L amb partner (2), S (3) · **Impacte:** alt.

### BRU-8.4 Comprovació creuada amb les compartides entre municipis
- **Proposta:** l'alarma ja descrita a `01-afirmacions.md` («la mateixa marca a 3 punts en dos municipis veïns») s'ha d'implementar com a **informe automàtic** quan hi hagi ≥ 5 municipis amb la mateixa compartida. Per a la mateixa marca, assenyala els municipis que se separen de la mediana de la marca en ≥ 2 punts. Schwarz et al. donen la base empírica per esperar desviacions (≈15 %) i no tractar-les automàticament com a errors.
- **Esforç:** S · **Impacte:** mitjà.

---

## 9. Privadesa i marc legal

### BRU-9.1 LOREG, article 69: cap agregat de resultats d'usuaris abans del 24-05-2027
- **Què:** `01-afirmacions.md` preveu una analítica agregada de respostes per retirar afirmacions. No hi ha cap política sobre publicar agregats.
- **Per què:**
  - L'article 69.7 de la LOREG prohibeix publicar sondejos en els **cinc dies anteriors** a la votació. L'article 69.1 exigeix una fitxa tècnica (qui l'ha fet, mostra…).
  - La Instrucció 1/2024 de la JEC s'aplica «amb independència de la denominació» als qüestionaris amb preguntes d'intenció de vot o de valoració de partits ([BOE](https://www.boe.es/eli/es/ins/2024/02/01/1/con)).
  - La JEC va obrir expedient a Electomanía per «sondejos encoberts» publicats en la darrera setmana; la llei preveu de 3.000 a 30.000 € de multa o la via penal ([Qué!](https://www.que.es/2022/02/25/jec-expediente-electomania-sondeos-13f/)).
  - De Stemtest es nega a publicar quants usuaris surten amb cada partit.
- **Proposta:**
  - Regla escrita: **quivoto no publica cap distribució de resultats ni de respostes de la brúixola fins al 24-05-2027.** Tampoc «X persones han fet la brúixola a Reus», si porta qualsevol desglossament per candidatura.
  - Les xifres d'ús total sense desglossament sí que es poden publicar.
  - Obtenir **una consulta escrita a la Junta Electoral** abans de l'abril.
  - Corregir `03-fonts-noves.md` §7.1: la veda va del **18 al 22-05-2027**; el darrer dia per publicar és el **17-05**, no el 18 com diu la taula (a confirmar amb el decret).
- **Esforç:** S · **Impacte:** alt (risc legal).

### BRU-9.2 L'enllaç per compartir al fragment `#`, no a `?r=`
- **Què:** `docs/metodologia/05-neutralitat-i-dades.md` §6 diu que el paràmetre `?r=` «viatjarà al nostre servidor» i que el compromís de no registrar-lo és «una promesa que no podràs verificar».
- **Per què:** el fragment d'URL (`#…`) **no s'envia mai** en la petició HTTP. El navegador el guarda per a la pàgina. Fa la promesa verificable per construcció. Les preferències polítiques són categoria especial (article 9 del RGPD).
- **Proposta:**
  - `https://quivoto.cat/sabadell/bruixola#r=…`. La imatge OG es genera a partir d'un paràmetre **només amb el rànquing** (`?o=psc,erc,…`) o és genèrica del municipi.
  - Treure de la política de privadesa el «confia en nosaltres» i substituir-lo per «les respostes no surten mai del teu navegador, ni quan comparteixes».
  - La SVT desa a `localStorage` i ofereix «Nollställ valkompasserna». quivoto ja preveu «Esborra les meves respostes».
- **Esforç:** S · **Impacte:** alt.

### BRU-9.3 Cap tercer a la pàgina de la brúixola, comprovat a CI
- **Per què:** **7 d'11** brúixoles finlandeses del 2023 enviaven informació sensible a tercers ([Heino et al. 2024](https://doi.org/10.1007/978-981-97-1313-4_30)). El StemWijzer diu explícitament que no fa servir galetes ni analítica. Els socis del Wahl-O-Mat estan obligats a minimitzar el seguiment.
- **Proposta:** (complementa F1-1)
  - CSP específica de la brúixola amb `connect-src 'self'` i sense `script-src` extern.
  - Un **test de Playwright a CI** que obri la brúixola, la respongui i falli si hi ha cap petició a un domini que no sigui el propi.
  - Si s'incrusta en mitjans (BRU-3.4), contracte com el del Wahl-O-Mat: cap analítica de respostes al soci.
  - Per al comptador de «No l'entenc» (BRU-2.5) i per a qualsevol agregat intern de respostes, valorar la **resposta aleatòria** (*randomized response*): cada navegador envia el valor real amb probabilitat *p* i un valor aleatori si no. Dona distribucions per afirmació sense saber mai què ha respost ningú. Només per a ús intern i després del 23-M, i amb consulta a un DPD.
- **Esforç:** S (CSP + test) / M (resposta aleatòria) · **Impacte:** alt.

---

## 10. Mètriques d'avaluació (què mesurar i amb quin llindar)

| Mètrica | Com es mesura sense dades personals | Referència | Llindar d'alerta |
|---|---|---|---|
| Taxa de compleció | Esdeveniment agregat «començat» / «acabat», sense valors | De Stemtest 2019: un 15 % no acaba | > 30 % d'abandonament |
| «No l'entenc» per afirmació | Comptador agregat (BRU-2.5) | Kamoen i Holleman 2017 | > 10 % → revisar el text |
| Omissions per afirmació | Comptador agregat | `01-afirmacions.md`: 25 % | > 25 % |
| Resposta de candidatures | Taula d'estat del qüestionari | smartvote municipal: 70–80 %; Burgdorf: 83 % (i el 100 % dels elegits) | < 50 % en un municipi → avís a la pàgina |
| Paritat de cobertura | Mín./màx. d'afirmacions situades per grup | BRU-4.4 | < 0,6 |
| Inversió de signe | Mostra etiquetada (Rubí, Barcelona) | `03-actes-i-mocions.md`: < 0,5 % | Bloquejant |
| Estabilitat del primer lloc | BRU-4.2, per usuari i agregada en simulació | Louwerse i Rosema 2014 | > 20 % d'inestabilitat → titular «empat» |
| Biaix de selecció | BRU-8.1 | Walgrave et al. 2009 | Fora del rang interquartílic |
| Correccions | Nombre, temps de resolució i % acceptades | `docs/metodologia/05-neutralitat-i-dades.md` §3 | Fora dels terminis publicats |
| Peticions a tercers | Test de CI (BRU-9.3) | Heino et al. 2024 | > 0 |

**Què no s'ha de mesurar:** quin partit surt primer a quanta gent (fins al 24-05, BRU-9.1). Tampoc l'«efecte sobre el vot»: la literatura ja mostra que existeix ([Germann, Mendez i Gemenis 2023](https://doi.org/10.1080/10584609.2023.2181896); Frese, Hix i Lachat 2025) i que **no** augmenta la participació en els experiments recents. El que s'ha d'evitar és prometre que la brúixola «fa votar més». La pàgina de ProDemos ho afirma; la recerca experimental més recent no ho confirma.

---

## 11. Calendari realista i N recomanat

### 11.1 Criteris de selecció de municipis (publicats i aplicats mecànicament)
La tria de municipis és en si mateixa una decisió política: si la majoria dels triats tenen el mateix partit a l'alcaldia, és un biaix. Per això:

**Nivell A (brúixola completa), N ≈ 30.** Han de complir **tots** aquests criteris:
1. ≥ 20.000 habitants. Al repositori es compten uns 70 municipis per sobre d'aquest llindar (`COMPLIMENT-VEREDICTE.md`).
2. ≥ 3 candidatures amb escó el 2023.
3. ≥ 8 votacions **amb vot desglossat per grup** comptades al pipeline d'actes (no actes al feed).
4. Paritat de cobertura ≥ 0,6 (BRU-4.4).

Entre els que ho compleixen, es tria amb:
- **quotes territorials**: totes quatre demarcacions, i com a mínim una capital de comarca no metropolitana per vegueria;
- **equilibri de l'alcaldia**: cap partit amb més del 40 % de les alcaldies de la mostra;
- prioritat per població.

Es publica la llista de candidats a entrar i el motiu de cada exclusió.

**Nivell B (nucli compartit), ≈ 100–150.** De 5.000 a 20.000 habitants (o més, quan no es compleix A), ≥ 3 candidatures. Hi ha 12–15 compartides i el qüestionari a les candidatures. El «què han fet» només hi és on hi ha un vot citable per a la compartida.

**Nivell C (radiografia).** Tota la resta, inclosos per regla els 109 municipis amb una sola llista, els 173 de llistes obertes i els 6 de consell obert (BRU-5.3).

### 11.2 Calendari (de 26-10-2026 a 23-05-2027)

| Quan | Brúixola | Fet quan… |
|---|---|---|
| **Nov 2026** | Decidir D-BRU-1…5 (§12). Longlist de 30–40 compartides. Demanar contactes a les federacions (BRU-3.2). Consulta a la JEC (BRU-9.1). Proposta de panell a Decidir o al CEO (BRU-8.3). Proposta a la premsa comarcal (BRU-3.4) | Decisions escrites a `PLA.md`; sol·licituds enviades |
| **Des 2026** | **3 pilots de punta a punta** (p. ex. Sabadell, Badalona i Esplugues, que tenen les millors dades segons `AFIRMACIONS-MOSTRA.md`): votacions estructurades (F3-3), selecció amb quotes, entrevistes cognitives, BRU-8.1/8.2, fitxa tècnica. **Cronometrar les hores** (BRU-3.5) | 3 municipis llestos en *staging*; ritme mesurat |
| **Gen 2027** | Ajustar N segons el ritme. **Onada 1** (10 municipis A). Compartides: panell i selecció final | 10 conjunts congelats |
| **Feb 2027** | Publicar l'onada 1 com a **«Brúixola del mandat»**: grups municipals 2023–2027 i el que han votat. **Enviar el qüestionari** (amb la fitxa feta) als grups de l'onada 1 i a tots els grups del nivell B, amb 4 setmanes de termini. **Onada 2** (10 A) | Brúixola del mandat pública a 10 municipis; qüestionari enviat |
| **Mar 2027** | **Onada 3** (10 A). Nivell B publicat (compartides + vots on n'hi hagi). Reconciliacions i consell assessor | 30 A + nivell B en línia |
| **30-03** | Decret de convocatòria | — |
| **14 → 21-04** | Candidatures presentades (BOP del 21-04): extractor F3-5, mapa de continuïtat (BRU-5.1) | Taula de continuïtat publicada |
| **26 → 28-04** | Proclamació. **Qüestionari a les candidatures noves** amb termini de 7 dies (fins al 5-05). **Congelació de les afirmacions** el 27-04 | Totes les proclamades visibles (BRU-5.2) |
| **7-05** | Inici de campanya: **Brúixola 2027** amb dos percentatges (BRU-6.2) | — |
| **7 → 21-05** | Correccions en 72 h (`docs/metodologia/05-neutralitat-i-dades.md` §3). Posicions congelades 48 h abans | — |
| **18 → 22-05** | Veda: cap agregat, cap «tendència» | — |
| **Juny 2027** | Informe públic: ús, «No l'entenc», correccions, distribució (ara sí, amb fitxa tècnica), lliçons per al 2031 | Informe publicat |

### 11.3 Per què no més de 30 municipis A
- Els serveis professionals cobren ≈10.000–15.000 € per municipi (BRU-3.5).
- La primera mostra no va donar cap conjunt publicable de set.
- Hi ha municipis grans sense vot citable (l'Hospitalet, Terrassa).
- La promesa de revisió humana de `METODOLOGIA.md` §2 només és creïble amb un N petit.

Amb 30 municipis A de més de 20.000 habitants i un nivell B ben fet, es cobreix probablement **més de la meitat de la població catalana**. Cal comprovar-ho amb el padró, perquè no s'ha pogut descarregar en aquesta anàlisi. Això és el que importa per a l'impacte.

---

## 12. Decisions obertes (per al responsable del projecte)

| # | Decisió | Opcions | Recomanació |
|---|---|---|---|
| D-BRU-1 | Base del rànquing principal del maig | (a) Declarades per a qui respon, i el vot com a capa; (b) Barreja declarada > inferida per afirmació; (c) Només vots | **(a)**, amb dos percentatges separats (BRU-4.5, BRU-6.2) |
| D-BRU-2 | Proporció local/compartida | 18+7 a tot arreu / per nivells | **Per nivells** (BRU-2.1) |
| D-BRU-3 | Bloc «Vota com un regidor» | Sí, al nivell A / no | **Sí**, 6–10 ítems (BRU-2.3) |
| D-BRU-4 | N del nivell A | 10 / 30 / 70 | **30**, a revisar després del pilot de desembre |
| D-BRU-5 | Publicar agregats de respostes | Mai / després del 23-M / en campanya | **Després del 24-05**, amb fitxa tècnica (BRU-9.1) |
| D-BRU-6 | Qüestionari: resposta completa obligatòria? | Sí / no | **Sí** (BRU-3.3); tanca l'asimetria del −1 |
| D-BRU-7 | Desempat alfabètic | Mantenir / substituir per «empat» | **Substituir** (BRU-2.6, BRU-4.2) |
| D-BRU-8 | Consell assessor de 3 politòlegs | Sí / no | **Sí** (BRU-3.3) |

---

## 13. Top 10 (ordre d'execució recomanat)

| # | Què | Ref. | Esforç | Impacte |
|---|---|---|---|---|
| 1 | **Fixar N ≈ 30 (A) + nucli compartit (B) + C**, amb criteris publicats, i excloure per regla els municipis d'una llista o de llistes obertes | BRU-2.1, 5.3, 11.1 | S | alt |
| 2 | **Enviar el qüestionari als grups existents al febrer**, amb la fitxa feta, resposta completa obligatòria, 500 caràcters, reconciliació i consell assessor; contactes demanats al novembre | BRU-3.1–3.3 | M | alt |
| 3 | **Dos percentatges separats el maig** («diuen» / «han votat») i rànquing principal amb declarades en igualtat | BRU-4.5, 6.2, D-BRU-1 | M | alt |
| 4 | **Cap agregat de resultats fins al 24-05** i consulta a la JEC; corregir la data de veda | BRU-9.1 | S | alt |
| 5 | **Enllaç per compartir al fragment `#`** i test de CI sense tercers | BRU-9.2, 9.3 | S | alt |
| 6 | **Robustesa al resultat** (remostreig, «empat» declarat, etiquetes verbals, mètode alternatiu) | BRU-4.2 | M | alt |
| 7 | **Paritat de cobertura per grup** com a quota de selecció i com a xifra publicada | BRU-4.4 | M | alt |
| 8 | **Bloc «Vota com un regidor»** amb la moció real i càlcul binari | BRU-2.3 | M | alt |
| 9 | **Simulació de biaix de selecció + proves de pseudovotant** a cada municipi, i fitxa tècnica | BRU-8.1, 8.2, 7.1 | M | alt |
| 10 | **«No l'entenc» separat, context i statu quo abans de respondre, i entrevistes cognitives als pilots** | BRU-2.5, 8.3 | S–M | alt |

---

## 14. Fonts

**Brúixoles i processos**
- bpb, Wahl-O-Mat FAQ (2025): https://www.bpb.de/themen/wahl-o-mat/bundestagswahl-2025/558464/haeufig-gestellte-fragen-zum-wahl-o-mat
- ProDemos, StemWijzer gemeenteraadsverkiezingen 2026: https://prodemos.nl/app/uploads/2025/05/StemWijzer_ProDemos_Gemeenteraadsverkiezingen2026.pdf · https://prodemos.nl/app/uploads/2025/04/ProDemos_gemeenteraadsverkiezingen-2026.pdf
- NOS, «Stemhulpen voor raadsverkiezingen online…» (18-02-2026): https://nos.nl/l/2602954
- Kieskompas, oferta a Noordenveld: https://noordenveld.bestuurlijkeinformatie.nl/Document/View/c0d74b4f-f1e3-4f0a-b859-a82e65d50d03
- smartvote, mètode *city-block* (2025): https://blog.smartvote.ch/wp-content/uploads/2026/01/sv25_Wahlempfehlung_de-city-block.pdf · https://smartvote.ch/en/voting-advice
- Wetzikon, crèdit smartvote 2026: https://www.wetzikon.ch/wAssets/docs/stadtratbeschluesse/2025/SRB-139-Begleitung-Behoerdenwahlen-2026-durch-Online-Wahlhilfe-von-smartvote-Kreditbewilligung.pdf
- Burgdorf, informe final de smartvote 2024: https://burgdorf.ch/wAssets/docs/Wahlen-Abstimmungen/Gemeindewahlen-2024/Schlussbericht-smartvote.pdf
- Politools, smartmonitor: https://politools.net/en/projects-services/smartmonitor/
- SVT, metodologia del Valkompass: https://www.svt.se/nyheter/inrikes/sa-tog-vi-fram-kompassfragorna-och-sa-beraknas-matchningen-mot-partier-och-kandidater · FAQ 2026: https://www.svt.se/nyheter/inrikes/fragor-och-svar-om-svts-valkompasser · 290 brúixoles: https://www.svt.se/nyheter/inrikes/svts-valkompass-igang-sa-fungerar-den
- VRT, De Stemtest 2024: https://www.vrt.be/vrtnws/nl/2024/04/09/de-stemtest-2024-wat-is-het-hoe-werkt-het-en-wat-kan-ik-eruit/
- Vox Pop Labs, metodologia de Vote Compass: https://files.voxpoplabs.com/votecompass/methodology.pdf
- MKW NRW, Lokal-O-Mat 2025: https://www.mkw.nrw/system/files/media/document/file/mkw_2025-08-20_pm_lokal-o-mat.pdf
- EUmatrix / EUI, EuroMPmatch: https://eumatrix.eu/en/blog/EUmatrix-partners-with-European-University-Institute-to-launch-EuroMPmatch · LSE, YourVoteMatters: https://www.lse.ac.uk/government/research/impact/case-studies/helping-votes-make-choices-in-european-elections
- mySociety, TheyWorkForYou: https://www.mysociety.org/2024/04/23/improving-the-focus-of-theyworkforyous-voting-summaries/ · https://www.mysociety.org/2025/05/19/theyworkforyou-votes/
- TheyVoteForYou (AU), exemple de política: https://theyvoteforyou.org.au/people/representatives/lalor/joanne_ryan/policies/167
- Qué hacen los diputados: https://civictech.guide/projects/que-hacen-los-diputados
- UOC, DecidirBCN (2023): https://www.uoc.edu/es/news/2023/121-decidirbcn-recomendador-voto-votantes-partidos-politicos · Decidir23J: https://www.uoc.edu/es/news/2023/178-investigadores-de-la-uoc-y-la-upf-lanzan-decidir23j
- LTO, VG Köln contra el Wahl-O-Mat (2019): https://www.lto.de/recht/nachrichten/n/bpb-beschwerde-entscheidung-vg-koeln-wahl-o-mat-verfassungswidrig · https://www.t-online.de/nachrichten/id_85808940/europawahl-2019-wahl-o-mat-ist-wieder-online-.html

**Recerca**
- Walgrave, Nuytemans i Pepermans (2009), *West European Politics*: https://medialibrary.uantwerpen.be/oldcontent/container2608/files/Walgrave%20et%20al%202009%20-%20voting%20aid%20applications.pdf
- Lefevere i Walgrave (2014), *Electoral Studies* 36: https://dare.uva.nl/id/c55af723-1679-47c7-8949-61e8828bf5b2
- Van Camp, Lefevere i Walgrave, sobre el contingut i la formulació d'afirmacions en 26 VAA: https://medialibrary.uantwerpen.be/oldcontent/container2608/files/Van%20Camp%2C%20Lefevere%2C%20Walgrave%20-%20The%20content%20and%20formulation%20of%20statements%20in%20VAAs.pdf
- Louwerse i Rosema (2014), *Acta Politica* 49(3): https://www.tomlouwerse.nl/publications/2014-louwerse-rosema-actapolitica/
- Rosema i Louwerse (2016), *Policy & Internet* 8(4): https://www.tomlouwerse.nl/publications/2016-rosema-louwerse-pi/
- Wagner i Ruusuvirta (2012), *Acta Politica* 47(4): https://eprints.lse.ac.uk/46760
- Mendez (2012), *IJEG* 5(3/4): https://www.inderscience.com/offer.php?id=51316
- Krouwel, Vitiello i Wall (2012), *IJEG*: https://inderscience.com/offers.php?id=51308
- Gemenis (2015), *Quality & Quantity* 49(6): https://research.utwente.nl/en/publications/an-iterative-expert-survey-approach-for-estimating-parties-policy/
- Germann, Mendez i Gemenis (2023), *Political Communication* 40(5): https://researchportal.bath.ac.uk/en/publications/do-voting-advice-applications-affect-party-preferences-evidence-f/
- Frese, Hix i Lachat (2025), *BJPolS* 55: https://doi.org/10.1017/S000712342510118X
- Kamoen i Holleman (2017), *Survey Research Methods* 11(2): https://ojs.ub.uni-konstanz.de/srm/article/view/6728 · (2025, ECPR): https://research.tilburguniversity.edu/en/publications/difficult-wordings-in-vaas-predicting-no-opinion-and-middle-respo/
- Kamoen, Liebrecht i van Lieshout (2026), *Politics and Governance* 14: https://www.cogitatiopress.com/politicsandgovernance/article/view/11234
- Garzia, Marschall, Tromborg i Albertsen (2026), editorial de *Politics and Governance*: https://www.cogitatiopress.com/politicsandgovernance/article/view/12331/5014
- Tangian (2017), KIT WP 100: https://econpapers.wiwi.kit.edu/downloads/KITe_WP_100.pdf
- Berdoz, Brunner, Vonlanthen i Wattenhofer (ETH), «Recommender Systems for Democracy»: https://arxiv.org/pdf/2505.13329
- Stockinger et al. (2024), *Ethics and Information Technology* 26:55: https://link.springer.com/article/10.1007/s10676-024-09790-6
- Article normatiu (Southampton) amb la cita de la Declaració de Lausana: https://eprints.soton.ac.uk/450905/1/AM_A_normative_set.pdf
- Schwarz, Schädel i Ladner (2010), *Swiss Political Science Review* 16(3): https://serval.unil.ch/notice/serval:BIB_254A6225FF57
- Heino et al. (2024), «Leaky Democracy»: https://www.utupub.fi/items/3e4b45e8-512d-4ab6-a699-e80ca3fcbb6d/full

**Context català i legal**
- 3Cat, llistes obertes i consell obert: https://www.3cat.cat/3catinfo/com-es-vota-als-municipis-petits-un-sistema-diferent-per-als-pobles/noticia/3229033/
- VilaWeb, anomalies de les municipals (dades del CEO): https://www.vilaweb.cat/noticies/anomalies-municipals-meitat-catalans-batlle/
- BOE, Instrucció 1/2024 de la JEC: https://www.boe.es/eli/es/ins/2024/02/01/1/con
- Qué!, expedient de la JEC a Electomanía: https://www.que.es/2022/02/25/jec-expediente-electomania-sondeos-13f/
- AOC, VideoActa (pista no verificada per a la segmentació per punts): https://www.aoc.cat/en/blog/2014/videoacta-un-nou-sistema-de-gestio-dactes-municipals/

## 15. Què no s'ha pogut verificar
- El text íntegre de la Declaració de Lausana: només se n'han vist els articles 4.2, 5.1 i 5.4, citats per tercers.
- El nombre exacte de municipis catalans per tram de població i la població que cobreixen: les API de l'Idescat i de Socrata eren inaccessibles des d'aquest entorn (403 del *proxy*). La xifra de «≈70 municipis de més de 20.000 habitants» és la del repositori.
- Si la versió local del De Stemtest 2024 va cobrir tots els municipis flamencs.
- Els termes de l'acord de 2019 entre la bpb i Volt.
- Si el VideoActa de l'AOC exposa un índex estructurat per punt.
- Cap recomanació s'ha provat sobre el codi. Les estimacions d'hores (BRU-3.5) són una projecció que s'ha de validar amb el pilot de desembre.
