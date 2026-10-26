# quivoto — audiència, distribució i idees de producte

> Annex de la segona ronda del [pla de millores](PLA.md) (26-10-2026). Al pla, les troballes d'aquest document es citen amb el prefix **AUD-** (per exemple, AUD-C1).

Estat a: 26-10-2026 · Eleccions: **23-05-2027** (209 dies) · Prefix de les recomanacions: **AUD-**

Aquest annex completa les quatre auditories de `docs/pla-millores/` (UX-, DAD-, FON-, TEC-). Aquelles miren **el producte per dins**; aquesta mira **qui el farà servir, com hi arribarà i què el faria imprescindible**. No repeteix troballes ja recollides; quan una recomanació en depèn, ho diu amb l'identificador (`F1-10`, `UX-2.5`, `TEC-SEO3`…).

Com s'ha fet: lectura del `README.md`, `web/README.md`, `tools/build_landing.py`, `design/MOVIMENT.md`, `docs/pla-millores/*`, `docs/COMPLIMENT*.md` i `docs/PLA-DADES-2027.md`; lectura del web en directe (portada, Observatori i `premsa.html`) a través de resums de text; i recerca web de projectes comparables, mitjans, convocatòries i dades d'audiència. **Google Trends i l'API de pàgines vistes de Wikimedia no han estat accessibles** des d'aquest entorn: la demanda de cerca es dedueix d'evidència indirecta (vegeu §4) i està marcada així.

Esforç: **S** < 1 dia · **M** 1–3 dies · **L** > 3 dies (mateixa convenció que el pla). Impacte: alt / mitjà / baix, pensant en arribar a gent abans del 23-M i en mantenir el projecte després.

---

## 0. Diagnosi en sis punts

1. **Avui quivoto no té cap canal propi d'audiència.** No té butlletí (només un avís d'un sol ús, «Avisa'm quan la meva ciutat estigui llesta»), ni comptes del projecte a les xarxes (només l'X personal de l'autor), ni codi d'inserció, ni botó de donació. L'Observatori encara diu «Esborrany intern, encara no indexat» (vegeu `F1-10`). Tot el trànsit dependrà, de moment, del boca-orella. *(Font: lectura de quivoto.cat, quivoto.cat/observatori/ i quivoto.cat/premsa.html, 26-10-2026.)*
2. **Els projectes comparables que arriben a molta gent no ho fan sols, sinó a través de mitjans.** El Kandidierenden-Check d'abgeordnetenwatch, el StemWijzer municipal i els projectes de Civio i Openpolis viuen en bona part de mitjans que els insereixen o els citen (§2). quivoto té una avantatja que gairebé cap mitjà català té: **els 947 municipis amb les mateixes dades**. A la vegada, a la premsa local hi falten mans per fer periodisme de dades.
3. **La demanda és estacional i local.** El pic és la setmana abans i el dia mateix de les eleccions (StemWijzer). Entre eleccions, la gent busca coses concretes del seu poble: quant cobra l'alcalde, qui mana, què es va votar. quivoto ja respon aquestes preguntes, però encara no és indexat.
4. **La nit electoral no es pot guanyar.** 3Cat té una pàgina de resultats per a cada municipi, i VilaWeb, un mapa carrer a carrer. On quivoto sí que pot guanyar és **abans** (context, candidatures, brúixola) i **després** (pactes possibles, qui serà l'alcalde, nou ple). Són justament les finestres que els grans mitjans cobreixen poc per als municipis petits.
5. **La neutralitat és el principal actiu del projecte i alhora la principal restricció.** La portada promet «Sense finançament de cap partit ni de cap administració». Per tant, queden fora les subvencions de la Generalitat, de les diputacions i de les associacions municipalistes. El model que encaixa és el d'abgeordnetenwatch (98 % de donacions individuals) més fundacions privades amb una política escrita.
6. **El calendari és molt estret.** Per arribar al gener amb audiència, el 23-11-2026 («falten sis mesos») és la primera oportunitat. Abans d'aquesta data hi ha d'haver una via per subscriure's que funcioni de veritat (doble opt-in, `FX-6`).

---

## 1. Qui és l'audiència (segments i què necessita cadascun)

| Segment | Què busca | Quan | Per on hi arriba | Què li cal a quivoto |
|---|---|---|---|---|
| **A. Veí o veïna que vol votar informat** | «Qui mana al meu poble», «quant cobra», «qui es presenta», «a qui voto» | Pic els darrers 15 dies i el dia D; cua llarga tot l'any | Cercador, WhatsApp, mitjà local, xarxes | Fitxa curta (`F1-12`), brúixola en mòbil, targeta per compartir, avís per correu |
| **B. Periodista local o comarcal** | Dades fiables, citables i ja localitzades, i preguntes per als candidats | Tot l'any, i molt de febrer a maig | Correu directe, associacions (AMIC, ACPC), ACN | Kit per municipi, codi d'inserció, CSV versionat (`F2-9`), contacte ràpid |
| **C. Docent i alumnat (4t d'ESO, batxillerat, cicles)** | Material per a una unitat de ciutadania i el seu municipi com a cas | 2n trimestre (gener–març) | Xarxes docents, universitats | Una guia de 3 sessions, exercicis i la fitxa del poble del centre |
| **D. Entitats veïnals i socials** | Dades del poble per a debats i preguntes a candidats | Febrer–maig | Federacions d'entitats, biblioteques | Full imprimible, «preguntes per al debat» |
| **E. Persones amb necessitats de lectura fàcil** | Entendre què es vota i com | Campanya | Dincat i entitats | Resum en lectura fàcil (AUD-P9) |
| **F. Castellanoparlants** | Igual que A | Igual que A | Igual que A | Brúixola i resum en castellà (`D7`) |
| **G. Electes, candidats i equips** | Vigilar què es diu del seu poble i corregir-ho | Sempre | Directe | Via de correcció visible (`F1-4`). **No és el públic objectiu** i no s'hi ha de dissenyar res a mida |

Sobre F: només el **32,6 %** de la població té el català com a llengua habitual (EULP 2023). La premsa situa el castellà al voltant del 46 % (xifra **no verificada** a la font primària): [3Cat](https://www.3cat.cat/3catinfo/en-directe-presentacio-de-lenquesta-dusos-linguistics/noticia-amp/3336630/) · [Ara (es)](https://es.ara.cat/lengua/inmigracion-catalan-sea-lengua-habitual-32-poblacion_1_5289797.html). Una brúixola només en català deixa fora la majoria de qui no la buscaria en català. És un argument per resoldre `D7` a favor de «brúixola i resum».

Sobre B: segons el Digital News Report 2025, la premsa regional o local és la font en què més es confia a Espanya (**51 %**), molt per sobre de la mitjana del 31 %. L'interès per les notícies locals, però, ha baixat del 62 % al 47 % des del 2020, i entre els joves de 18 a 24 anys és només del 28 % ([DNR España 2025](https://www.unav.edu/web/digital-news-report/entradas/-/blogs/informe-ejecutivo-2025)). Arribar a la gent **a través del mitjà local** aprofita aquesta confiança. Per arribar als joves calen l'escola (C) i el vídeo curt.

---

## 2. Projectes comparables: què els va fer arribar a la gent

| Projecte | Model | Audiència (pública) | Tàctiques de distribució | Què pot copiar quivoto |
|---|---|---|---|---|
| **Civio** (ES): ¿Dónde van mis impuestos?, El BOE nuestro, Quién manda | Fundació. 35 % dels ingressos són donacions individuals; la resta, fundacions (OSF, Limelight, NEF). Ingressos de 596.664 € el 2024 | 1,1 M de visitants el 2024; 600.000 al contingut del BOE; ~110.000 a DVMI; 23.000 subscriptors del butlletí; 2.000 socis | **Republicació lliure** (CC BY-SA, codi HTML preparat per enganxar al CMS), programa de ràdio a la SER, formació (6.000 persones), coalicions | Una pàgina «Republica» amb codi d'inserció per a cada peça; formació per a periodistes; un codi ètic públic sobre finançament ([memòria 2024](https://civio.es/en/report-2024/), [republicar](https://civio.es/en/about-us/republish/), [comptes](https://civio.es/en/about-us/clear-accounts/)) |
| **abgeordnetenwatch** (DE) | Associació. **98 %** dels ingressos són donacions individuals i quotes; 13.303 donants regulars; 1,78 M€ el 2025; 34 persones en plantilla i 12 voluntaris (10 de curadors) | 4,6 M de visitants el 2025; el Kandidierenden-Check es va obrir més de 9,5 M de vegades a les federals; **173.565 subscriptors** del butlletí (1.672 van arribar pel Check) | **Cooperació amb mitjans**: *widgets* incrustables (el lector es queda al web del mitjà), CSV de votacions i respostes per a peces locals, anàlisi de les tesis per circumscripció; Lern-Kit per a 14+ anys | El paquet «mitjà associat» (AUD-D1), el kit escolar (AUD-P11), els curadors voluntaris per municipi (AUD-G3) i els donatius recurrents ([finançament](https://www.abgeordnetenwatch.de/node/17), [informe 2025](https://www.abgeordnetenwatch.de/sites/default/files/media/documents/2026-10/aw-jahresbericht2025_0.pdf), [cooperació amb mitjans](https://abgeordnetenwatch.de/sites/default/files/media/documents/2024-06/medienkooperation-ltw-sachsen-2024abgeordnetenwatchde.pdf), [Lern-Kit](https://www.abgeordnetenwatch.de/sites/default/files/media/documents/2026-07/aw-lern-kit-2026-begleitunterlagen.pdf)) |
| **StemWijzer / ProDemos** (NL), municipals | Entitat pública d'educació cívica. **Els ajuntaments paguen** la versió a mida; n'hi ha una de genèrica gratuïta | 2026: 258 municipis (55 el 2022) i més d'1 M de qüestionaris a mitja campanya. 2022: 1,6 M de qüestionaris per a 55 municipis. **El pic és la vigília i el dia de les eleccions** | Primera aliança amb DPG Media: **periodistes locals redacten 25–30 afirmacions per municipi**. Incident: un mur de subscripció va tapar l'eina, cosa que trencava l'acord que havia de ser oberta | Que siguin periodistes locals qui proposin o revisin afirmacions (amb la regla de l'acta de quivoto); un contracte d'inserció que garanteixi l'accés obert. **No** copiar que pagui l'ajuntament ([NOS](https://nos.nl/l/2602954), [nieuws.nl](https://nieuws.nl/algemeen/stemwijzer-gemeenteraadsverkiezingen-ruim-miljoen-keer-ingevuld)) |
| **smartvote** (CH), municipals | Empresa sense ànim de lucre. El municipi paga (Burgdorf: 11.000 CHF) | Burgdorf 2024: 2.577 recomanacions; **83 % dels candidats** van fer el perfil, i el 100 % dels que van sortir elegits | Ràdio i diari local expliquen l'eina | La taxa de resposta dels candidats pot ser alta si el qüestionari és curt i públic: és un argument per al qüestionari de `F3-6` ([informe Burgdorf](https://burgdorf.ch/wAssets/docs/Wahlen-Abstimmungen/Gemeindewahlen-2024/Schlussbericht-smartvote.pdf)) |
| **Wahl-O-Mat** (DE) | Agència federal d'educació cívica (bpb) | 26 M d'usos a les federals del 2025 | Marca pública i premsa | Mostra la mida del sostre quan l'eina és **la de referència**. Per als municipis, a Alemanya ho fan universitats (VOTO) ([bpb](https://www.bpb.de/die-bpb/presse/pressemitteilungen/559822/wahl-o-mat-zur-bundestagswahl-2025-uebertrifft-bisherigen-nutzungsrekord-deutlich/), [VOTO](https://www.sonntagsblatt.de/artikel/medien/kommunalwahl-2026-mit-voto-die-lokale-orientierung-behalten)) |
| **mySociety** (UK): TheyWorkForYou, WriteToThem, FixMyStreet | Organització benèfica, finançada per fundacions i serveis | TWFY: més de 6 M de pàgines vistes l'any, **13 M l'any electoral 2019**; ~1 M de vistes anuals de fitxes de diputat; el 20 % dels adults del Regne Unit l'han fet servir. **Alertes: 400.000 correus/mes**, el 84 % rebuts per ciutadans | **Cercadors**: la gent entra per Google («contact my MP») i salta la porta d'entrada prevista. Alertes per persona o paraula clau. Més del 50 % dels usuaris de WriteToThem escrivien per primera vegada | Dissenyar cada fitxa com a **pàgina d'aterratge** (qui ve de Google no passa per la portada); **alertes per municipi** (AUD-P1) ([TWFY 2023](https://www.mysociety.org/2023/07/04/learning-from-the-way-people-use-theyworkforyou/), [WriteToThem](https://www.mysociety.org/2013/09/16/who-uses-writetothem/), [FixMyStreet](https://www.mysociety.org/2023/07/21/fixmystreet-a-useful-tool-for-councillors/)) |
| **Openpolis** (IT): OpenBilanci, Openpolitici | Fundació: cofundadors, donacions, aliances (p. ex. Con i Bambini) | 2021: 4,6 M de pàgines vistes, **83.781 subscriptors** del butlletí; **1.236 articles de premsa local** citant-los (xifra extreta d'un PDF amb la maquetació barrejada: cal verificar-la) | Una anàlisi nova cada setmana sobre dades municipals; observatoris temàtics amb un soci finançador | Una peça de dades setmanal «des dels 947» pensada perquè la premsa local la reprengui ([fundació](https://www.openpolis.it/openpolis-foundation/), [informe 2021](https://www.openpolis.it/wp-content/uploads/2023/01/activity_report_2021_ita.pdf), [Con i Bambini](https://www.conibambini.org/en/?p=19500)) |
| **Bureau Local** (UK) | Unitat de periodisme col·laboratiu | 2017: més de 350 persones de 84 ciutats en 6 setmanes; 77 peces, 54 de les quals locals | Una base de dades comuna, *hack days*, metodologia a GitHub, crèdit obligatori | La «xarxa quivoto de periodistes locals» (AUD-D4) ([Bureau](https://thebureauinvestigates.com/blog/2017-07-31/six-weeks-77-stories-84-cities-and-350-people)) |
| **RADAR / PA Media** (UK) | Agència amb finançament de Google DNI (706.000 €) | Fins a 30.000 peces localitzades al mes | Plantilles a partir de dades obertes. La peça és «un fonament» per al periodista local | Un «dossier preelectoral» generat **sense LLM**, amb plantilles i xifres de la base (AUD-P4) ([journalism.co.uk](https://www.journalism.co.uk/press-association-is-using-artificial-intelligence-to-help-local-news-organisations-produce-more-data-driven-stories/)) |
| **Maldita.es** (ES) | Fundació i comunitat | Desenes de milers d'usuaris del bot de WhatsApp | **Bot de WhatsApp**: l'usuari hi envia el contingut i rep la resposta, fins i tot setmanes després; la comunitat fa de xarxa de distribució | Un canal de WhatsApp i, més endavant, un bot «escriu el teu poble i et torno la fitxa» (AUD-S2) ([Maldita WhatsApp](https://maldita.es/recibe-los-desmentidos-de-maldito-bulo-en-whatsapp)) |
| **Mitjans catalans** (3Cat, VilaWeb, NacióDigital/ACN, El Confidencial) | Comercials o públics | — | 3Cat: una pàgina de resultats per municipi i el «Pactòmetre». VilaWeb: mapa carrer a carrer. ACN: cercador de sous d'alcaldes (Datawrapper, ISPA) que NacióDigital insereix. El Confidencial: cercador municipal amb eleccions i finances | Són **competidors en cerca** i alhora **clients potencials** de dades. La peça de sous de l'ACN (novembre de 2025) demostra que la premsa catalana compra aquest tema cada any ([3Cat Vila-sana](https://www.3cat.cat/324/eleccions-28m-2023/municipals/vila-sana/09252725200/), [VilaWeb](https://www.vilaweb.cat/noticies/mapa-veins-resultats-a-catalunya-carrer-seccions-censals-municipals/), [NacióDigital](https://naciodigital.cat/politica/quant-cobra-lalcalde-del-teu-municipi-consulta-el-cercador.html), [3Cat sous](https://www.3cat.cat/3catinfo/que-cobren-els-alcaldes-catalans-i-com-es-fixa-el-seu-sou-de-0-a-104000-euros/noticia/3382660/), [Maldita: eines 28M](https://maldita.es/malditateexplica/20230523/herramientas-fuentes-datos-elecciones-28-mayo/)) |
| **Code for America, brigades** (US) | Xarxa de voluntaris, tancada el 2023 | — | — | **Lliçó negativa**: costos de més de 3 M$ i «els projectes curts rarament generen canvis duradors». Els voluntaris han de tenir tasques petites i ben definides, i el projecte no pot dependre d'ells ([StateScoop](https://statescoop.com/code-for-america-former-brigades-regroup/)) |
| **Montera34** (Bilbao) | Col·lectiu de dues persones, CC BY-SA i GPL | — | Tallers, *data commons labs*, col·laboracions | Un altre projecte petit i obert al costat: possible aliança tècnica o de tallers ([Montera34](https://montera34.com/en/about/)) |
| **Decidim** | Programari lliure de participació; Decidim.Catalunya de l'AOC per a ajuntaments | — | Institucional | Pot ser **font**: quins municipis tenen processos participatius actius. És una dada, no un canal ([AOC](https://www.aoc.cat/en/blog/2021/govern-financa-decidim-catalunya/)) |

**No verificat en aquesta ronda**: Newtral, Datadista, eldiario.es, El País, l'Ara i La Vanguardia no publiquen xifres d'ús de les seves eines electorals (les cerques no n'han trobat). Regards Citoyens / NosDéputés s'ha consultat només de manera indirecta.

### Lliçons transversals

1. **Qui arriba lluny ho fa a través de tercers**: mitjans (abgeordnetenwatch, StemWijzer), republicació (Civio), premsa local (Openpolis).
2. **La porta d'entrada real és Google, i va directament a la fitxa** (mySociety). Cada fitxa ha de funcionar sola.
3. **Les alertes i el butlletí donen retenció** (TWFY: 400.000 correus/mes; abgeordnetenwatch: 173.000 subscriptors). Sense correu, el trànsit electoral es perd l'endemà.
4. **Neutralitat demostrable**: abgeordnetenwatch publica el finançament fins al decimal i Civio té un codi ètic. Es fa amb una política escrita, no amb una frase a la portada.
5. **El pic arriba al final**: la majoria fa el qüestionari la vigília i el dia D. L'eina ha de ser ràpida i aguantar el pic (`F0-6`).

---

## 3. Recomanacions

### A. Distribució a través de mitjans i aliats

**AUD-D1 — Paquet «Mitjà associat» per a AMIC i l'ACPC (premsa comarcal)**
- **Què**: una oferta única i gratuïta per a mitjans locals i comarcals, amb fitxa incrustable (AUD-P2), brúixola incrustable (abril), dades CSV per municipi i un correu de suport, sota condicions clares: accés obert, sense mur de subscripció davant l'eina, i atribució.
- **Per què**: segons dades de l'associació (2022, no auditades per l'OJD), AMIC agrupa **500 capçaleres** i més de **15 M d'usuaris únics al mes** ([Ebre Digital](https://ebredigital.cat/?p=247024)). L'ACPC en té 137 i 5 M d'usuaris (dades del 2018) i va crear Catalunya News, que agrega 40 mitjans ([NacióDigital](https://naciodigital.cat/sant-cugat/societat-sant-cugat/neix-catalunya-news-un-mirador-digital-de-noticies-de-40-mitjans-comarcals.html)). abgeordnetenwatch fa exactament aquesta oferta ([PDF](https://abgeordnetenwatch.de/sites/default/files/media/documents/2024-06/medienkooperation-ltw-sachsen-2024abgeordnetenwatchde.pdf)). L'incident del StemWijzer amb DPG mostra que la condició d'accés obert s'ha d'escriure.
- **Com**: una pàgina `/premsa/mitjans/` (ampliació de `premsa.html`) amb el codi, les condicions i un formulari «Vull inserir quivoto». Primer contacte amb les dues associacions al novembre; 3–5 mitjans pilot al febrer.
- **Esforç**: M (pàgina i condicions) + depèn d'AUD-P2. **Impacte**: alt.

**AUD-D2 — Agència Catalana de Notícies (ACN) com a client de dades**
- **Què**: oferir a l'ACN peces de dades dels 947 municipis (sous, plens, alcaldies estables, fragmentació, padró), amb la font original i quivoto com a font derivada.
- **Per què**: l'ACN va fer el cercador de sous d'alcaldes que reprenen NacióDigital i altres mitjans ([NacióDigital](https://naciodigital.cat/politica/quant-cobra-lalcalde-del-teu-municipi-consulta-el-cercador.html)). Arriba a centenars de mitjans locals subscrits (dada general, **no verificada** per a l'ACN).
- **Com**: una nota mensual «Dada dels 947» (AUD-C4) enviada a la redacció de l'ACN i a les seccions de política local.
- **Esforç**: S per nota. **Impacte**: alt.

**AUD-D3 — Televisions i ràdios locals (La Xarxa / XAL)**
- **Què**: un full de dades per municipi, imprimible i en pantalla, per als debats electorals locals, amb 10 xifres, la seva font i preguntes possibles.
- **Per què**: les TV i ràdios locals fan els debats dels municipis mitjans i petits que 3Cat no cobreix. La XAL és un consorci públic: és **un mitjà, no un finançador**, i amb ell la relació és d'ús de dades, mai de diners.
- **Com**: es genera a partir de la plantilla del dossier (AUD-P4). Es contacta la XAL al gener.
- **Esforç**: S (si AUD-P4 ja existeix). **Impacte**: mitjà.

**AUD-D4 — Xarxa de periodistes locals (el model de Bureau Local)**
- **Què**: una llista de correu privada per a periodistes, amb una entrega de dades cada mes i, durant la campanya, cada setmana. Inclou avisos d'incidències («ja és aquí la liquidació 2025») i un fil per preguntar.
- **Per què**: en sis setmanes, Bureau Local va reunir més de 350 persones i va generar 54 peces locals ([Bureau](https://thebureauinvestigates.com/blog/2017-07-31/six-weeks-77-stories-84-cities-and-350-people)).
- **Com**: es reutilitza la mateixa eina del butlletí (AUD-C1) amb una llista «premsa». Hi ha un formulari a `premsa.html`.
- **Esforç**: S per crear-la, després S cada mes. **Impacte**: alt.

**AUD-D5 — Universitats: aval metodològic i estudiants**
- **Què**: un acord **no remunerat** amb un grup de ciència política (ICPS, UB, UAB, UPF) perquè revisi el mètode de la brúixola i, si s'escau, l'estudiï, i també perquè pugui oferir pràctiques i treballs de final de grau sobre dades municipals.
- **Per què**: a Alemanya les brúixoles municipals les fan universitats (VOTO; [Saarland](https://www.uni-saarland.de/en/news/voto-wahlhilfe-projekt-abschlussevent-33372.html), [Mannheim](https://www.bwl.uni-mannheim.de/news/online-wahlhilfe-fuer-mannheim/)). L'ICPS ja és font de dades de dones i poder local ([3Cat](https://www.3cat.cat/3catinfo/nomes-1-de-cada-4-municipis-catalans-te-alcaldessa-consulta-el-mapa/noticia/3354837/)). Un aval acadèmic redueix el risc d'acusacions de biaix durant la campanya.
- **Com**: una carta breu amb el mètode (`docs/metodologia/`) i una proposta de revisió entre desembre i febrer.
- **Esforç**: S per fer la proposta. **Impacte**: mitjà–alt (confiança).

**AUD-D6 — Biblioteques i entitats veïnals: cartell i full imprimible**
- **Què**: un cartell A4 amb codi QR, «El teu poble, en dades: qui mana, què cobra, què s'ha votat», i el full de dades del municipi.
- **Per què**: arriba a gent que no busca a Google. Penjar informació neutral en un espai públic no és finançament.
- **Com**: es genera un PDF per municipi a partir de la plantilla d'AUD-P4. L'oferta va a les federacions veïnals (p. ex. CONFAVC, **no verificat**) i a les xarxes de biblioteques.
- **Esforç**: S. **Impacte**: baix–mitjà.

**AUD-D7 — Associacions municipalistes (FMC, ACM): cap aliança**
- **Què**: no fer-hi cap acord, ni de dades ni de difusió, ni amb l'una ni amb l'altra.
- **Per què**: totes dues tenen una identificació política coneguda. L'ACM fa tallers preelectorals **per a candidats i equips de campanya** ([ACM 2019](https://www.acm.cat/sites/default/files/tallers_pre-electorals_2019_v9.pdf)). Qualsevol acord amb una sola de les dues trencaria la neutralitat percebuda.
- **Com**: si s'hi parla, que sigui com amb qualsevol usuari, amb les dues per igual i sense cap marca compartida. Cal escriure-ho a la política d'independència (AUD-G1).
- **Esforç**: S. **Impacte**: protegeix el projecte.

### B. Xarxes socials i formats que es comparteixen

**AUD-S1 — Comptes del projecte i un format que es repeteix: «el municipi del dia»**
- **Què**: obrir comptes de quivoto (Bluesky, Instagram, un canal de WhatsApp i un de Telegram) i publicar cada dia **una targeta d'un municipi** amb 3 xifres i l'enllaç. La rotació s'ordena per població amb una mica d'atzar, perquè el poble petit també hi surti.
- **Per què**: a Espanya, el **23 %** de la població fa servir WhatsApp per informar-se, el 46 % les xarxes socials, i el TikTok arriba al 25 % dels joves de 18 a 24 anys ([DNR 2025](https://www.unav.edu/web/digital-news-report/entradas/-/blogs/informe-ejecutivo-2025)). Un compte personal de l'autor no transmet la neutralitat del projecte. Amb 947 municipis hi ha contingut per a més de 2,5 anys sense repetir.
- **Com**: les imatges OG ja existeixen per municipi (`TEC-SEO4`). Cal afegir-hi el format vertical 9:16 (*stories* i estats de WhatsApp) i un *script* que trii el municipi i escrigui el text a partir de plantilla, sense LLM i amb revisió humana abans de publicar.
- **Esforç**: M (format vertical i *script*) + S cada dia. **Impacte**: mitjà–alt.

**AUD-S2 — Bot de WhatsApp o Telegram «escriu el nom del teu poble»**
- **Què**: l'usuari escriu un municipi i el bot li retorna la targeta i l'enllaç a la fitxa. No desa cap dada personal més enllà del que imposa la plataforma.
- **Per què**: el bot de Maldita funciona perquè l'usuari en fa la distribució ([Maldita](https://maldita.es/recibe-los-desmentidos-de-maldito-bulo-en-whatsapp)).
- **Com**: comenceu per Telegram, que té una API de bots gratuïta i simple. L'API de WhatsApp Business té cost per conversa (**no verificat** per a aquest cas). Només després d'AUD-S1.
- **Esforç**: M. **Impacte**: mitjà. És **opcional**.

**AUD-S3 — Targeta «el meu poble vs. un de semblant» que es pot baixar i compartir**
- **Què**: botó «Comparteix» a la fitxa i al comparador que genera una imatge (PNG de 1080×1350) amb el municipi, un de semblant (`F2-7`) i 3 xifres, sempre amb la font.
- **Per què**: a WhatsApp es comparteixen sobretot imatges. Ara la comparació viu en una taula que no viatja.
- **Com**: es reutilitza el generador d'OG (`F2-10` proposa satori/sharp).
- **Esforç**: M. **Impacte**: mitjà.

**AUD-S4 — Vídeo curt mensual «3 coses del teu ajuntament que no sabies»**
- **Què**: un vídeo d'entre 30 i 45 s amb la mascota i xifres reals de 3 municipis.
- **Per què**: és el canal que fan servir els joves (vegeu AUD-S1). La identitat ja té personatges i un moviment definit (`design/MOVIMENT.md`).
- **Com**: plantilla d'animació amb els cinc moviments que defineix MOVIMENT.md. Comenceu al gener.
- **Esforç**: M la plantilla, S cada vídeo. **Impacte**: baix–mitjà (és experimental).

### C. Butlletí i alertes (retenció)

**AUD-C1 — Convertir «Avisa'm» en «El butlletí del meu poble»**
- **Què**: substituir l'avís d'un sol ús per una subscripció doble: un butlletí general mensual (opcional) i **alertes del municipi triat**. El municipi es tria d'una llista amb el codi INE, no amb text lliure.
- **Per què**: TWFY envia 400.000 alertes al mes; abgeordnetenwatch té 173.565 subscriptors, Openpolis 83.781 i Civio 23.000 (§2). L'avís actual promet «un sol correu», i amb això el contacte es perd el 24-05.
- **Com**: el doble opt-in és obligatori (`FX-6`) **abans** de fer-ne res. Cal migrar el consentiment: qui ja s'ha apuntat amb «un sol correu» **no** passa al butlletí sense tornar a dir-hi que sí. Eina: llistes autoallotjades (p. ex. listmonk, de codi obert i amb segmentació per atributs; **no verificat** en detall) o un servei europeu. El camp `municipi` passa a ser un `codi_ine`.
- **Esforç**: M. **Impacte**: alt.

**AUD-C2 — Alertes per municipi generades pel *pipeline***
- **Què**: un correu automàtic quan canvia alguna cosa del poble: canvi d'alcaldia (moció de censura o renúncia), dades noves publicades (liquidació, padró, sous ISPA), candidatures presentades i proclamades, resultats i constitució del nou ple.
- **Per què**: les alertes són el producte més fidel de TWFY (84 % ciutadans; [mySociety](https://www.mysociety.org/2023/07/04/learning-from-the-way-people-use-theyworkforyou/)).
- **Com**: el `manifest.json` de cada publicació ja permet un diff. Un job compara la publicació nova amb l'anterior (vegeu `F2-3` sobre `run_id`) i escriu un fitxer `canvis/AAAA-MM-DD.json` per municipi. Un altre job en fa els correus. **Primer fase**: només les fites del calendari electoral, que són poques i d'alt valor.
- **Esforç**: L. **Impacte**: alt.

**AUD-C3 — Avisos de calendari pràctic**
- **Què**: correus amb data, sense política: «darrer dia per demanar el vot per correu (13-05)», «consulta on votes», «avui comença la campanya».
- **Per què**: «voto por correo» i «dónde voto» són de les cerques que més pugen en període electoral ([Menorca.info sobre el 23J](https://www.menorca.info/actualidad/elecciones-23j/2023/07/06/1970979/elecciones-generales-voto-por-correo-terminos-mas-buscados.html), [Vozpópuli](https://www.vozpopuli.com/espana/elecciones-municipales-2023/donde-tengo-votar-elecciones-28-m.html)). El calendari pràctic ja és a UX-§14; això n'és la versió per correu.
- **Esforç**: S. **Impacte**: mitjà.

**AUD-C4 — «La dada dels 947»: una peça setmanal o quinzenal**
- **Què**: una anàlisi curta que compara tots els municipis (p. ex. «on mana la mateixa força des del 1979», «quants plens no tenen oposició», «on s'ha canviat d'alcalde a mig mandat»). Va al butlletí, a la xarxa de periodistes (AUD-D4) i a l'ACN (AUD-D2).
- **Per què**: Openpolis manté «una anàlisi nova cada setmana» i la premsa local la reprèn ([informe 2021](https://www.openpolis.it/wp-content/uploads/2023/01/activity_report_2021_ita.pdf)).
- **Com**: cada peça surt d'una consulta reproduïble, guardada a `docs/peces/AAAA-MM-DD-*.md` amb la consulta i les xifres. Es publica amb llicència CC BY i un codi d'inserció a l'estil de Civio.
- **Esforç**: S per peça. **Impacte**: alt.

### D. Cerca (SEO) i pàgines per intenció

Vegeu §4 per a l'evidència i la taula d'intencions. La indexació (`F1-10`) i les dades estructurades (`TEC-SEO3`) són condició prèvia.

**AUD-W1 — Títols i *meta descriptions* que coincideixin amb la cerca real**
- **Què**: el `<title>` i el H1 de cada fitxa han de respondre la pregunta tal com es busca: «Alcalde de Vic, ple i resultats des del 1979 · quivoto». Afegiu-hi una línia de resum amb la resposta directa: «L'alcaldessa de X és N (partit) des de AAAA. El ple té 17 regidors: …».
- **Per què**: la gent entra per Google i va directament a la fitxa (TWFY). Els resultats amb la resposta visible tenen més clics (és pràctica SEO estàndard, sense una font concreta per a aquest cas).
- **Esforç**: S. **Impacte**: alt.

**AUD-W2 — Pàgines per intenció del 2027, amb URL estable des d'ara**
- **Què**: crear des del desembre `/m/<slug>/2027/`, «Eleccions municipals 2027 a X», amb data, calendari, qui es presenta (es va omplint quan hi ha dades oficials), el resultat del 2023 i l'enllaç a la brúixola.
- **Per què**: una URL que existeix i té enllaços **abans** del pic es posiciona millor que una que neix el 21-04. Ara mateix, la intenció «eleccions municipals 2027 [municipi]» la capturen notícies soltes.
- **Com**: una plantilla nova. Mentre no hi hagi candidatures oficials, la pàgina **no** recull rumors ni noms anunciats a la premsa: la secció diu «candidatures: es publiquen al BOP el 21-04».
- **Esforç**: M. **Impacte**: alt.

**AUD-W3 — Pàgina «Quant cobren els alcaldes» actualitzada el dia que surt l'ISPA**
- **Què**: un rànquing i un cercador amb el municipi, el sou ISPA, el tram legal màxim i la dedicació. S'actualitza el mateix dia que el Ministeri publiqui l'ISPA 2026 (nòmines del 2025).
- **Per què**: és un tema que la premsa compra cada any. L'ACN i 3Cat el van publicar el 26–29-11-2025 a partir de l'ISPA ([3Cat](https://www.3cat.cat/3catinfo/que-cobren-els-alcaldes-catalans-i-com-es-fixa-el-seu-sou-de-0-a-104000-euros/noticia/3382660/)). quivoto ja té les retribucions a la fitxa de persona. La data exacta de l'ISPA 2026 **no està verificada** (el precedent és finals de novembre; [instruccions ISPA 2026](https://digital.gob.es/content/dam/portal-mtdfp/funcion-publica/dgfp/ispa/ispa2026/documentos/INSTRUCCIONES_GENERALES_2026.pdf)).
- **Esforç**: S–M. **Impacte**: alt, perquè és el primer pic de trànsit possible.

**AUD-W4 — Viquipèdia i Wikidata com a canal (amb cura)**
- **Què**: aportar a Wikidata les alcaldies i els resultats amb **referència a la font oficial**, i proposar quivoto com a enllaç extern a les pàgines de municipi de la Viquipèdia, seguint les normes de conflicte d'interès (proposar-ho a la discussió, no editar directament).
- **Per què**: el panell de coneixement de Google per a «alcalde de X» sovint surt de Wikidata o Viquipèdia (és coneixement general **no verificat** per a aquest cas). quivoto ja llegeix Wikidata.
- **Esforç**: M. **Impacte**: mitjà.

### E. Producte: idees que no són al pla actual

**AUD-P1 — «El meu poble»: un tauler personal sense compte**
- **Què**: en triar el municipi, la portada ensenya la targeta del teu poble, què ha canviat des de l'última visita (a partir dels fitxers `canvis/` d'AUD-C2), el compte enrere i la brúixola del municipi.
- **Per què**: dona motiu per tornar. `UX-2.5` ja proposa recordar el municipi; això hi afegeix «què ha canviat».
- **Com**: el municipi es desa en `localStorage`, sense galetes de seguiment.
- **Esforç**: M. **Impacte**: mitjà.

**AUD-P2 — Fitxa incrustable (iframe i oEmbed) i targeta estàtica**
- **Què**: `/insereix/m/<slug>/`, una versió compacta de la fitxa (qui mana, el ple, el darrer resultat, 3 xifres i les fonts) que s'adapta a l'amplada. Ve amb un fragment `<iframe>` per copiar, un endpoint oEmbed perquè els CMS l'acceptin enganxant l'URL, i un PNG alternatiu per a la versió en paper.
- **Per què**: és la peça central d'AUD-D1. L'eina d'abgeordnetenwatch es manté al web del mitjà, i és per això que els mitjans l'accepten.
- **Com**: una plantilla mínima, sense JS de tercers, amb `?utm_source` o `ref` per mesurar on s'insereix sense galetes. La capçalera CSP ha de permetre `frame-ancestors *` **només** en aquesta ruta (`F0-8`).
- **Esforç**: M. **Impacte**: alt.

**AUD-P3 — Brúixola incrustable per municipi**
- **Què**: el mateix que AUD-P2, però per a la brúixola. Les respostes no surten del navegador (principi del projecte), i el resultat porta a quivoto.
- **Per què**: els mitjans associats d'abgeordnetenwatch hi insereixen el Check, i el StemWijzer viatja amb DPG Media.
- **Com**: depèn de `F3-1` i `F3-4`. La condició d'accés obert va escrita a AUD-D1.
- **Esforç**: M. **Impacte**: alt a l'abril i el maig.

**AUD-P4 — Dossier preelectoral per municipi (per a periodistes, TV locals i entitats)**
- **Què**: una pàgina o un PDF generat **de manera determinista** (plantilles i xifres, sense LLM) amb 10 fets del municipi, la font de cadascun, la comparació amb municipis semblants i **preguntes obertes possibles** que surten de les dades («El deute per habitant és el doble que el de municipis semblants: què proposen les candidatures?»).
- **Per què**: RADAR i Bureau Local demostren que el periodista local fa servir una base localitzada, i no una nota genèrica.
- **Com**: les preguntes es construeixen sobre fets, sense to ni judici, i es revisen amb la regla de `F1-3` (cap veredicte).
- **Esforç**: M. **Impacte**: alt.

**AUD-P5 — «Del resultat al govern»: majories possibles a cada municipi**
- **Què**: la nit del 23-05 i els dies següents, una pàgina per municipi amb la majoria absoluta (quants regidors), **les combinacions que hi arriben** i **l'historial de pactes** del municipi des del 1979. Com que quivoto ja té les alcaldies i les composicions, pot dir per exemple: «el 2019 i el 2023 va governar X amb Y».
- **Per què**: 3Cat té un «Pactòmetre» i resultats per municipi, però la pàgina de Vila-sana del 2023 només donava les dues primeres llistes i cap història ([3Cat](https://www.3cat.cat/324/eleccions-28m-2023/municipals/vila-sana/09252725200/)). L'historial de pactes de 947 municipis no el té ningú més. Així no cal competir amb el recompte (vegeu `F3-8`).
- **Com**: és un càlcul combinatori sobre els escons, i l'historial ja és a la base. Mentre no hi hagi l'escrutini definitiu, es publica amb el text «resultats provisionals de l'Interior». Si es decideix no ingerir resultats provisionals, la pàgina s'activa l'endemà amb els definitius.
- **Esforç**: M. **Impacte**: alt la setmana del 23-05 al 12-06.

**AUD-P6 — Constitució dels ajuntaments (12-06-2027): «Qui és el nou alcalde de X»**
- **Què**: actualitzar les alcaldies el mateix dissabte 12-06 (dia 20 després de les eleccions, art. 195 de la LOREG) a partir de la premsa local, amb la marca «pendent de confirmació oficial» fins que hi hagi la font oficial.
- **Per què**: és la segona gran onada de cerques («nou alcalde de X»), i els mitjans grans cobreixen sobretot les ciutats.
- **Com**: un formulari intern i aportacions de periodistes de la xarxa (AUD-D4) amb l'enllaç a la notícia o a l'acta. Es publica només amb la font enllaçada. Depèn de `F4-6`.
- **Esforç**: M. **Impacte**: alt.

**AUD-P7 — Qüestionari a candidatures: distribució i condicions**
- **Què**: el qüestionari de `F3-6` (és la promesa de la portada: «Els partits responen, i si no responen també es veu»). Es proposa enviar-lo el 28-04 a totes les candidatures proclamades, amb termini fins al 10-05 i publicació a mesura que arribin les respostes.
- **Per què**: smartvote va aconseguir un 83 % de perfils de candidats a Burgdorf. El factor clau és que el mitjà local en parli i pressioni ([informe](https://burgdorf.ch/wAssets/docs/Wahlen-Abstimmungen/Gemeindewahlen-2024/Schlussbericht-smartvote.pdf)).
- **Com**: un qüestionari curt (10–15 afirmacions, les mateixes de la brúixola). Els mitjans associats reben la llista de qui ha respost. A la pàgina, les candidatures surten en ordre aleatori o alfabètic, mai per vots.
- **Risc**: al voltant del 30–40 % dels municipis tenen una sola candidatura o molt poques (estimació **no verificada**; es pot calcular amb les dades del 2023). Allà, el qüestionari té poc sentit: cal dir-ho a la pàgina.
- **Esforç**: L. **Impacte**: alt.

**AUD-P8 — Arxiu de programes 2023 i 2027 (sense veredicte)**
- **Què**: per a cada candidatura, un enllaç al programa i una còpia arxivada (Wayback o còpia pròpia amb hash). **No** es fa seguiment de compliment.
- **Per què**: `COMPLIMENT-VEREDICTE.md` va concloure que cal **ajornar** el seguiment de compliment. L'arxiu, en canvi, és útil per als periodistes i comporta poc risc. Els programes desapareixen dels webs dels partits.
- **Esforç**: S–M. **Impacte**: mitjà.

**AUD-P9 — Resum en lectura fàcil de la fitxa i de la brúixola**
- **Què**: una versió del resum de la fitxa (blocs 0–2 de `DAD-2.9`) i de les instruccions de la brúixola en lectura fàcil, validada per persones usuàries.
- **Per què**: Dincat (prop de 300 entitats) reclama programes i documents electorals en lectura fàcil ([Dincat 2023](https://www.dincat.cat/wp-content/uploads/2023/03/NP-eleccions-accessibles.pdf)). Gairebé ningú ho ofereix a escala municipal.
- **Com**: plantilles de frase curta. La validació es pot demanar a l'Associació Lectura Fàcil o a Dincat (cost i condicions **no verificats**).
- **Esforç**: M. **Impacte**: mitjà (social i reputacional).

**AUD-P10 — Kit escolar «Investiga el teu ajuntament» (3 sessions, 14+ anys)**
- **Què**: diapositives, notes per al docent i 5 exercicis: trobar el teu municipi, llegir el ple, comparar-lo amb un de semblant, formular preguntes a candidats i fer la brúixola.
- **Per què**: abgeordnetenwatch té el Lern-Kit amb aquesta mateixa estructura ([PDF](https://www.abgeordnetenwatch.de/sites/default/files/media/documents/2026-07/aw-lern-kit-2026-begleitunterlagen.pdf)). A Catalunya hi ha precedent: «Aprenem a votar» (UB i Departament d'Educació), amb més de 2.000 alumnes ([3Cat](https://www.3cat.cat/3catinfo/del-polonia-al-vot-responsable-la-immersio-de-mes-de-2000-estudiants-en-el-mon-electoral/noticia/943846/)). Els joves són el grup amb menys interès per les notícies locals (28 %).
- **Com**: publicat al gener, per al segon trimestre. Es difon per xarxes docents i per les universitats d'AUD-D5. Llicència CC BY.
- **Esforç**: M. **Impacte**: mitjà, i a llarg termini.

**AUD-P11 — Respostes directes a les preguntes freqüents de cada municipi (sense LLM)**
- **Què**: un bloc «Preguntes ràpides» a cada fitxa, generat amb plantilles: «Quants alcaldes ha tingut X des del 1979?», «Quina força ha guanyat més vegades?», «Quants regidors té el ple i per què?».
- **Per què**: coincideix amb les cerques de cua llarga i amb el que necessita un periodista. Es pot marcar amb `FAQPage` (`TEC-SEO3`).
- **Esforç**: S–M. **Impacte**: mitjà.

**AUD-P12 — Botó «Cita aquesta dada»**
- **Què**: a cada xifra o bloc, un botó que copia la cita en el format de `premsa.html`: font original, quivoto, data de generació i URL amb ancoratge.
- **Per què**: abarateix la reutilització per part dels mitjans i fa que l'atribució es compleixi.
- **Esforç**: S. **Impacte**: mitjà.

### F. Sostenibilitat i governança

**AUD-G1 — Política d'independència i finançament, escrita i pública**
- **Què**: una pàgina `/independencia/` que digui què s'accepta (donacions individuals fins a un límit, fundacions privades sense afiliació partidista) i què no (partits, càrrecs electes, candidats, administracions, associacions municipalistes, i empreses que contracten amb ajuntaments). Inclou un llistat anual d'ingressos i un procediment si un donant resulta ser candidat.
- **Per què**: la portada ja ho promet en una frase. abgeordnetenwatch (98 % de donacions individuals) i Civio publiquen el detall ([abgeordnetenwatch](https://www.abgeordnetenwatch.de/node/17), [Civio](https://civio.es/en/about-us/clear-accounts/)).
- **Esforç**: S. **Impacte**: alt (confiança i protecció).

**AUD-G2 — Micro-donacions recurrents**
- **Què**: un botó «Fes que quivoto continuï» amb quota mensual (3, 5 o 10 €), visible a la fitxa i al butlletí, **no** a la brúixola.
- **Per què**: és el model principal d'abgeordnetenwatch (13.303 donants regulars, des de 5 €/mes) i el 35 % dels ingressos de Civio.
- **Com**: cal una persona jurídica per a les desgravacions. Una associació sense ànim de lucre només dona dret a desgravació fiscal (Llei 49/2002) si és d'utilitat pública, cosa que **cal verificar** amb un assessor. Mentrestant: Liberapay, GitHub Sponsors o un *fiscal host* europeu (p. ex. Open Collective Europe; **no verificat** que accepti projectes d'Espanya). Cada any es publica quant s'ha rebut i en què s'ha gastat.
- **Esforç**: S–M. **Impacte**: mitjà (econòmic baix el 2027, alt a llarg termini).

**AUD-G3 — Micromecenatge amb un lliurable concret (Verkami)**
- **Què**: una campanya de 30–40 dies, al gener o febrer de 2027, per un objectiu tancat, com ara «la brúixola per als 947 municipis» o «el kit escolar i la lectura fàcil».
- **Per què**: el micromecenatge és habitual en el periodisme català (Verkami) i un objectiu concret converteix en diners l'audiència del pic de novembre a gener ([eldiario.es](https://www.eldiario.es/colaboratorio/periodismo-crowdfunding-verkami-corrupcion-ciu-artur-mas-catalunya_132_5571786.amp.html), [UAB](https://ddd.uab.cat/record/181795)).
- **Esforç**: M. **Impacte**: mitjà.

**AUD-G4 — Subvencions i premis: avaluació de compatibilitat**

| Opció | Encaix | Neutralitat | Estat i data | Recomanació |
|---|---|---|---|---|
| **NLnet** (Restack, CodeSupply, crida oberta), 5.000–50.000 € | Desenvolupament tècnic obert (p. ex. el *pipeline* reproduïble, el format obert de candidatures, l'extractor de BOP com a llibreria) | Alta (fons europeus NGI, sense vincle polític) | Pròxima data **3-11-2026**. NGI Zero Commons va tancar l'1-06-2026. **NLnet diu que no li interessen «projectes o propostes generats amb IA»**: cal llegir les condicions i ser transparents sobre l'ús d'assistents ([NLnet](https://www.nlnet.nl/propose), [Commons](https://www.nlnet.nl/commonsfund)) | Preparar una proposta per a la convocatòria següent (si la del 3-11 no arriba a temps), centrada en una llibreria reutilitzable |
| **Civitates**, mitjans d'interès públic, fins a 160.000 € | Per a mitjans constituïts, amb pressupost propi | Alta | La darrera convocatòria va tancar el 2-03-2025; Espanya hi era elegible ([Civitates](https://civitates-eu.org/funding-opportunity/call-for-proposals-strengthening-independent-public-interest-journalism-in-europe/)) | Seguiment. Ara no és elegible (cal entitat i pressupost) |
| **Premi Lluís Carulla**, 60.000 € i acadèmia | Projectes de cultura i transformació social, participació | Alta (fundació privada) | L'edició 2026 va tancar el 13-01-2026; la propera edició es preveu cap al gener de 2027 (**no verificat**) ([bases](https://interaccio.diba.cat/printpdf/news/2025/11/12/oberta-convocatoria-del-premi-lluis-carulla-2026-per-projectes-culturals-amb-impac-0)) | Presentar-s'hi si la convocatòria s'obre al novembre o desembre |
| **EMIF** (Gulbenkian) | Verificació i alfabetització mediàtica | Alta | Convocatòries periòdiques ([EMIF](https://cdn.gulbenkian.pt/emifund/wp-content/uploads/sites/51/2022/03/CallFactCheckingJune2025.pdf)) | Encaix parcial: el kit escolar podria entrar com a alfabetització |
| **Open Society Foundations** | Han finançat Civio | Alta, però és un nom polaritzador en alguns sectors | No hi ha convocatòria oberta: és per invitació | Ara no |
| **European AI & Society Fund** | Polítiques d'IA | — | ([GFMD](https://gfmd.info/fundings/ai-accountability-grants/)) | **No encaixa** |
| **Fundació Bofill** | Equitat educativa | Alta | Recerca educativa | Encaix molt feble. Ara no |
| **Fundación Daniel y Nina Carasso** | Art ciutadà i alimentació sostenible | Alta | — | Encaix feble. Ara no |
| **Google News Initiative** | Innovació en mitjans | Mitjana (dependència d'una gran plataforma) | Convocatòries esporàdiques | Ara no |
| **Generalitat, diputacions, Premis de Comunicació Local (Diba), ACM o FMC** | — | **Incompatible** amb la promesa de la portada | ([bases Diba 2026](https://info-cemical.diba.cat/documents/d/premis-comunicacio-local/bases-premis-comunicacio-local-2026-pdf)) | **No**, llevat que es canviï la política explícitament i es justifiqui |

**AUD-G5 — Contribuïdors: tasques petites i ben definides**
- **Què**: escriure `CONTRIBUTING.md` (en català), afegir plantilles d'*issue* («error en una dada», «font nova», «millora d'accessibilitat») i obrir 10–15 *issues* etiquetats `bona-primera-tasca`. Es poden treure de tasques S del pla: un adaptador Socrata nou de `F2-5` (el patró ja existeix), tests de slug (`F1-6`), «−0,0 %» (`F1-7`), contrast i mida mínima de lletra (`F1-9`) i textos en lectura fàcil (AUD-P9).
- **Per què**: segons Code for America, sense tasques petites i sense una estructura estable, els voluntaris no tenen impacte duradorament ([StateScoop](https://statescoop.com/code-for-america-former-brigades-regroup/)). abgeordnetenwatch té 10 curadors voluntaris amb un rol clar.
- **Com**: una sessió el dissabte 6-03-2027 (setmana de l'Open Data Day, data **aproximada**; [opendataday.org](https://opendataday.org/)) per revisar fonts o municipis. Rol futur: un «padrí o padrina de municipi» que revisa la fitxa del seu poble i proposa correccions **amb font**, sense publicar res directament.
- **Esforç**: S–M. **Impacte**: mitjà.

**AUD-G6 — Bus factor: una segona persona amb accés**
- **Què**: una segona persona de confiança amb accés al domini, al servidor, a les còpies i al proveïdor de correu, a més d'un document «si l'autor no hi és».
- **Per què**: la campanya és el moment en què el projecte no pot caure. El pla ja ho apunta per al codi (`F0-*`), però no per a les persones.
- **Esforç**: S. **Impacte**: alt (risc).

### G. Mesura

**AUD-M1 — KPI de l'audiència, mesurats sense galetes**

Depèn de `F1-1` (analítica sense galetes). Ni a la brúixola ni a les respostes es mesura res més que «iniciada» i «acabada», sense respostes.

| KPI | Per què | Objectiu orientatiu a 23-05-2027 (cap referència directa: és una hipòtesi) |
|---|---|---|
| Municipis amb ≥ 1 visita/setmana | Cobertura territorial real, no només Barcelona | 600 al febrer, 900 al maig |
| Visitants únics al mes | Abast | 20.000 al gener, 150.000 al maig |
| Proporció d'entrades per cerca a fitxes de municipi | La porta d'entrada és Google (TWFY) | Més del 50 % |
| Subscriptors confirmats (doble opt-in), per municipi | Retenció | 5.000 (en tenen 23.000 Civio i 173.000 abgeordnetenwatch) |
| Dominis amb un *embed* actiu | Distribució per mitjans | 20 mitjans al maig |
| Citacions a la premsa (comptatge manual) | Influència | 50 entre gener i juny |
| Brúixoles acabades, sense respostes | Ús de la peça estrella | 50.000 |
| Correccions rebudes i temps fins a resoldre-les | Confiança | Mediana de menys de 72 h |
| Ràtio de compartir (clics «Comparteix» / visites a fitxa) | Viralitat | Més de l'1 % |

**AUD-M2 — Enquesta curta de sortida (3 preguntes, opcional)**: «Per què has vingut?», «Ho has trobat?» i «Com ens has conegut?». Sense dades personals, a la fitxa i al final de la brúixola. **S**.

**AUD-M3 — Informe públic d'impacte el juny del 2027**: xifres, què ha funcionat, ingressos i despeses. Serveix per a les subvencions de la tardor del 2027. **S**.

### H. Riscos legals i de neutralitat en campanya

- **Enquestes**: la LOREG prohibeix publicar sondejos en els cinc dies anteriors a la votació (des del 18-05-2027). **No** s'han de publicar mai agregats de resultats de la brúixola («el 30 % dels usuaris coincideix amb X»): sembla un sondeig i, a més, xoca amb el principi de privadesa del projecte. Si cal una consulta formal, s'ha de fer a la Junta Electoral (pendent de **verificar** l'abast de la norma per a eines com aquesta).
- **Jornada de reflexió (22-05)**: res d'apel·lar a votar una opció. Una eina informativa és legítima, però per prudència el 22-05 no es fa promoció a les xarxes.
- **Ordre de les candidatures**: sempre aleatori o alfabètic, i ho diu la pàgina.
- **Dades personals de candidats**: només nom, posició i partit, com ja indica FON-7.2. Hi ha d'haver una via d'oposició (`F1-2`).

---

## 4. Demanda de cerca i pàgines per intenció

**Limitació**: no s'ha pogut consultar Google Trends (`robots_disallowed`) ni l'API de pàgines vistes de Wikimedia (bloquejada pel proxy). La taula següent es basa en evidència indirecta: què van publicar els mitjans i què recullen els estudis d'ús (TWFY, StemWijzer, Maldita). **Abans del gener cal validar-la amb Google Search Console** (`F1-10`) i, si es pot, amb Trends des d'un navegador.

| Intenció (exemples de consulta) | Evidència | Qui la captura avui | Pàgina de quivoto | Pic previst |
|---|---|---|---|---|
| «qui és l'alcalde de X», «alcaldessa de X» | Cerca de cua llarga perenne; panell de Wikipedia/Wikidata | Viquipèdia, web de l'ajuntament | Fitxa del municipi amb la resposta al H1 (AUD-W1) | Tot l'any; el 12-06-2027 |
| «quant cobra l'alcalde de X», «sou alcalde X» | La premsa ho publica cada any (ACN i 3Cat, 11-2025) | NacióDigital, 3Cat (Datawrapper) | Rànquing i cercador ISPA (AUD-W3) | Finals de novembre (ISPA) |
| «resultats eleccions municipals X», «eleccions 2023 X» | 3Cat té una pàgina per municipi | 3Cat, El Punt Avui, Público | Fitxa amb l'historial des del 1979 | 23–24-05-2027 (amb poca possibilitat de guanyar-la el mateix dia) |
| «eleccions municipals 2027 X», «candidats X 2027», «llistes X» | Notícies locals soltes; candidatures al BOP | Premsa local | `/m/<slug>/2027/` (AUD-W2) | 21-04 → 23-05 |
| «a qui votar», «test municipals», «brúixola electoral» | Pic a la vigília i el dia D (StemWijzer) | Tests de mitjans | Brúixola per municipi (AUD-P3) | 7 → 23-05 |
| «on voto», «vot per correu termini», «mesa electoral» | Entre les cerques que més pugen (23J, 28M) | Interior, mitjans | Calendari pràctic (UX-§14, AUD-C3) | 30-03 → 23-05 |
| «pactes X», «qui governarà X» | Pactòmetre de 3Cat per a ciutats grans | 3Cat | Majories possibles i historial (AUD-P5) | 24-05 → 12-06 |
| «nou alcalde X», «investidura X» | Constitució dels ajuntaments, dia D+20 | Premsa local | Fitxa actualitzada (AUD-P6) | 12-06-2027 |
| «deute ajuntament X», «pressupost X», «IBI X» | Notícies de pressupostos i ordenances (oct.–des.) | Premsa local | Bloc de finances i comparador | Novembre–desembre |
| «població X 2026», «padró X» | Publicació de l'Idescat i l'INE | Idescat | Fitxa (després de `F4-2`) | Desembre 2026–gener 2027 |

---

## 5. Calendari, de novembre de 2026 a juny de 2027

Dates de la LOREG calculades sobre el precedent del 2023 (FON-7.1), **a confirmar amb el decret**. Les dates de publicació de dades (ISPA, padró) són **previsions** basades en anys anteriors.

| Data | Moment | Acció d'audiència i distribució | Depèn de |
|---|---|---|---|
| **Ara → 15-11-2026** | — | Política d'independència (AUD-G1). Doble opt-in i butlletí (AUD-C1, `FX-6`). Obrir els comptes del projecte (AUD-S1). `CONTRIBUTING.md` (AUD-G5) | `FX-6` |
| 3-11-2026 | Data límit NLnet | Valorar si hi ha temps per a una proposta. Si no, preparar la de la convocatòria següent (AUD-G4) | — |
| Novembre (dia **no verificat**) | Dia de la Premsa Comarcal (precedent: 13-11, al Born) | Primer contacte amb l'ACPC i AMIC (AUD-D1) | — |
| **23-11-2026 (dl.)** | **Falten 6 mesos** | Llançament públic de l'Observatori **indexat**. Nota a la premsa i a l'ACN. Primera «Dada dels 947» (AUD-C4) | `F1-10`, `F1-11` |
| ~25 → 30-11-2026 (**no verificat**) | ISPA 2026 (sous del 2025) | Pàgina «Quant cobren els alcaldes» el mateix dia (AUD-W3). Peça per a l'ACN | — |
| Desembre 2026 | Pressupostos i ordenances 2027; padró a 1-1-2026 (desembre–gener) | Peça «el teu poble creix o perd» quan surti el padró. Crear les URL `/2027/` (AUD-W2). Proposta a universitats (AUD-D5) | `F4-2` |
| Gener 2027 | Comença el segon trimestre escolar | Publicar el kit escolar (AUD-P10). Contacte amb la XAL (AUD-D3). Format vertical i primer vídeo (AUD-S3, S4) | — |
| Gener–febrer 2027 | — | Micromecenatge a Verkami (AUD-G3). Pilot d'*embed* amb 3–5 mitjans (AUD-D1, P2) | AUD-P2 |
| **22-02-2027 (dl.)** | Falten 90 dies | Obrir la xarxa de periodistes (AUD-D4) amb el dossier preelectoral (AUD-P4). Assaig general (`F3-7`) | AUD-P4 |
| ~6-03-2027 (ds., **aproximat**) | Setmana de l'Open Data Day | Sessió de contribució i revisió de municipis (AUD-G5) | — |
| Març 2027 | Liquidació 2025 (~940 municipis) | «Dada dels 947» sobre comptes | `F4-2` |
| **30-03-2027 (dt.)** | Decret de convocatòria (D−54) | Activar la pàgina de calendari pràctic i les alertes de calendari (AUD-C3). Nota de premsa | — |
| 5-04-2027 (dl.) | Consulta del cens (D−48) | Alerta «comprova on votes» | — |
| 14 → 19-04-2027 | Presentació de candidatures | Res públic: esperar a les dades oficials | — |
| **21-04-2027 (dc.)** | Candidatures presentades al BOP | Omplir les pàgines `/2027/` i enviar l'alerta per municipi (AUD-C2) | `F3-5`, `F4-1` |
| **26 / 28-04-2027** | Proclamació / publicació | Enviar el qüestionari a les candidatures (AUD-P7). Obrir la brúixola incrustable als mitjans (AUD-P3) | `F3-6` |
| **7-05-2027 (dv.)** | Comença la campanya | Màxima difusió de la brúixola, la targeta del poble i els *embeds* | `F0-6`, `F4-3` |
| 10-05-2027 | Tancament proposat de respostes al qüestionari | Publicar qui ha respost i qui no | AUD-P7 |
| 13-05-2027 (dj.) | Darrer dia per demanar el vot per correu (D−10) | Alerta de calendari | — |
| 18-05-2027 (dt.) | Comença la prohibició de publicar enquestes | Cap agregat de la brúixola (§3H) | — |
| 22-05-2027 (ds.) | Jornada de reflexió | Sense promoció a les xarxes | — |
| **23-05-2027 (dg.)** | **Eleccions** | Enllaç als resultats oficials. Pàgines de majories possibles (AUD-P5) amb resultats provisionals o l'endemà | `F3-8`, `F4-5` |
| 24-05 → 11-06-2027 | Negociacions | Historial de pactes per municipi, alertes i «Dada dels 947» sobre fragmentació | AUD-P5 |
| **12-06-2027 (ds.)** | Constitució dels ajuntaments (D+20) | Actualitzar les alcaldies el mateix dia, amb font (AUD-P6). Alerta per municipi | `F4-6` |
| Mitjan juny 2027 | Tancament del cicle | Informe públic d'impacte (AUD-M3). Enquesta d'usuaris. Preparar subvencions per a la tardor | — |

---

## 6. Top 10 (per fer en aquest ordre)

| # | Recomanació | Per què ara | Esforç | Impacte |
|---|---|---|---|---|
| 1 | **AUD-C1**: butlletí del meu poble amb doble opt-in (després de `FX-6`) | Sense això, tot el trànsit del 2027 es perd l'endemà | M | Alt |
| 2 | **AUD-G1**: política d'independència i finançament pública | És la condició per poder parlar amb mitjans, universitats i donants | S | Alt |
| 3 | **Llançament indexat el 23-11** («falten 6 mesos»), amb `F1-10` i **AUD-W1** | És el primer moment de notícia; Google necessita mesos | S | Alt |
| 4 | **AUD-W3**: pàgina de sous el dia que surti l'ISPA | Pic de demanda segur, any rere any | S–M | Alt |
| 5 | **AUD-P2 + AUD-D1**: fitxa incrustable i paquet per a AMIC i l'ACPC | La premsa local té la confiança (51 %) i l'abast | M + M | Alt |
| 6 | **AUD-C4 + AUD-D2 + AUD-D4**: «Dada dels 947», ACN i xarxa de periodistes | Converteix les dades en peces publicades, amb cost marginal baix | S/peça | Alt |
| 7 | **AUD-W2**: pàgines `/m/<slug>/2027/` creades al desembre | Posicionar-se abans del pic d'abril i maig | M | Alt |
| 8 | **AUD-P5 + AUD-P6**: majories possibles amb l'historial de pactes, i el nou alcalde el 12-06 | Allò que només quivoto pot fer, en les dues setmanes de més demanda després del 23-M | M + M | Alt |
| 9 | **AUD-S1 + AUD-S3**: comptes del projecte, municipi del dia i targeta per compartir | Sense canal propi, no hi ha distribució directa | M | Mitjà–alt |
| 10 | **AUD-P4 + AUD-P7**: dossier preelectoral i qüestionari a candidatures amb els mitjans | És la promesa de la portada, i el mitjà local fa que les candidatures responguin | M + L | Alt |

Fora del top 10, però amb data: el kit escolar (AUD-P10) ha d'estar llest el **gener**; si no, s'endarrereix un curs sencer.

---

## 7. Què no s'ha pogut verificar

- Les dades de Google Trends i Wikimedia (no accessibles). La taula de §4 s'ha de validar amb Search Console.
- Les xifres d'audiència d'AMIC (2022, de l'associació, sense auditoria de l'OJD) i de l'ACPC (2018).
- Les dates exactes de l'ISPA 2026, del Dia de la Premsa Comarcal 2026, de l'Open Data Day 2027 i de la propera convocatòria del Premi Carulla.
- La desgravació fiscal per a donatius (Llei 49/2002): depèn de la forma jurídica i de la declaració d'utilitat pública. Cal assessorament.
- Si Open Collective Europe accepta projectes radicats a Espanya; el cost de l'API de WhatsApp Business; el detall de listmonk.
- El nombre de municipis amb una sola candidatura el 2023 (es pot calcular amb les dades de quivoto).
- L'abast de la prohibició d'enquestes de la LOREG per a agregats de brúixoles.
- Les xifres d'ús de les eines electorals de Newtral, Datadista, eldiario.es, El País, l'Ara i La Vanguardia (no publicades o no trobades).
- La xifra de 1.236 articles de premsa local d'Openpolis (extreta d'un PDF amb la maquetació barrejada).
- La condició de NLnet sobre «projectes generats amb IA» aplicada a un repositori construït amb assistents: cal llegir les condicions completes.

## 8. Fonts

Civio: [memòria 2024](https://civio.es/en/report-2024/) · [republicar](https://civio.es/en/about-us/republish/) · [comptes](https://civio.es/en/about-us/clear-accounts/)
abgeordnetenwatch: [finançament](https://www.abgeordnetenwatch.de/node/17) · [informe 2025](https://www.abgeordnetenwatch.de/sites/default/files/media/documents/2026-10/aw-jahresbericht2025_0.pdf) · [cooperació amb mitjans](https://abgeordnetenwatch.de/sites/default/files/media/documents/2024-06/medienkooperation-ltw-sachsen-2024abgeordnetenwatchde.pdf) · [Lern-Kit](https://www.abgeordnetenwatch.de/sites/default/files/media/documents/2026-07/aw-lern-kit-2026-begleitunterlagen.pdf)
StemWijzer: [NOS 2026](https://nos.nl/l/2602954) · [nieuws.nl](https://nieuws.nl/algemeen/stemwijzer-gemeenteraadsverkiezingen-ruim-miljoen-keer-ingevuld)
smartvote: [Burgdorf 2024](https://burgdorf.ch/wAssets/docs/Wahlen-Abstimmungen/Gemeindewahlen-2024/Schlussbericht-smartvote.pdf) · Wahl-O-Mat: [bpb](https://www.bpb.de/die-bpb/presse/pressemitteilungen/559822/wahl-o-mat-zur-bundestagswahl-2025-uebertrifft-bisherigen-nutzungsrekord-deutlich/) · VOTO: [Sonntagsblatt](https://www.sonntagsblatt.de/artikel/medien/kommunalwahl-2026-mit-voto-die-lokale-orientierung-behalten), [Saarland](https://www.uni-saarland.de/en/news/voto-wahlhilfe-projekt-abschlussevent-33372.html)
mySociety: [TWFY 2023](https://www.mysociety.org/2023/07/04/learning-from-the-way-people-use-theyworkforyou/) · [WriteToThem](https://www.mysociety.org/2013/09/16/who-uses-writetothem/) · [FixMyStreet](https://www.mysociety.org/2023/07/21/fixmystreet-a-useful-tool-for-councillors/)
Openpolis: [fundació](https://www.openpolis.it/openpolis-foundation/) · [informe 2021](https://www.openpolis.it/wp-content/uploads/2023/01/activity_report_2021_ita.pdf) · [Con i Bambini](https://www.conibambini.org/en/?p=19500)
Bureau Local: [2017](https://thebureauinvestigates.com/blog/2017-07-31/six-weeks-77-stories-84-cities-and-350-people) · RADAR: [journalism.co.uk](https://www.journalism.co.uk/press-association-is-using-artificial-intelligence-to-help-local-news-organisations-produce-more-data-driven-stories/) · Code for America: [StateScoop](https://statescoop.com/code-for-america-former-brigades-regroup/) · Montera34: [about](https://montera34.com/en/about/) · Maldita: [WhatsApp](https://maldita.es/recibe-los-desmentidos-de-maldito-bulo-en-whatsapp), [eines 28M](https://maldita.es/malditateexplica/20230523/herramientas-fuentes-datos-elecciones-28-mayo/)
Mitjans catalans: [3Cat Vila-sana 2023](https://www.3cat.cat/324/eleccions-28m-2023/municipals/vila-sana/09252725200/) · [3Cat sous](https://www.3cat.cat/3catinfo/que-cobren-els-alcaldes-catalans-i-com-es-fixa-el-seu-sou-de-0-a-104000-euros/noticia/3382660/) · [NacióDigital sous](https://naciodigital.cat/politica/quant-cobra-lalcalde-del-teu-municipi-consulta-el-cercador.html) · [VilaWeb carrer a carrer](https://www.vilaweb.cat/noticies/mapa-veins-resultats-a-catalunya-carrer-seccions-censals-municipals/) · [3Cat alcaldesses](https://www.3cat.cat/3catinfo/nomes-1-de-cada-4-municipis-catalans-te-alcaldessa-consulta-el-mapa/noticia/3354837/) · [3Cat calendari 2023](https://www.3cat.cat/3catinfo/convocades-les-eleccions-municipals-les-dates-clau-fins-al-28-de-maig/noticia-amp/3221919/) · [betevé 2027](https://beteve.cat/politica/municipals-2027-comenca-compte-enrere-23-m-molts-candidats-per-proclamar/)
Associacions de mitjans: [AMIC (Ebre Digital)](https://ebredigital.cat/?p=247024) · [ACPC i Catalunya News](https://naciodigital.cat/sant-cugat/societat-sant-cugat/neix-catalunya-news-un-mirador-digital-de-noticies-de-40-mitjans-comarcals.html) · [Dia de la Premsa Comarcal](https://naciodigital.cat/cultura-i-mitjans/el-dia-de-la-premsa-comarcal-celebra-la-segona-edicio.html)
Audiències: [DNR España 2025](https://www.unav.edu/web/digital-news-report/entradas/-/blogs/informe-ejecutivo-2025) · [EULP 2023 (3Cat)](https://www.3cat.cat/3catinfo/en-directe-presentacio-de-lenquesta-dusos-linguistics/noticia-amp/3336630/) · [Ara (es)](https://es.ara.cat/lengua/inmigracion-catalan-sea-lengua-habitual-32-poblacion_1_5289797.html) · [vot per correu, cerques](https://www.menorca.info/actualidad/elecciones-23j/2023/07/06/1970979/elecciones-generales-voto-por-correo-terminos-mas-buscados.html) · [on voto](https://www.vozpopuli.com/espana/elecciones-municipales-2023/donde-tengo-votar-elecciones-28-m.html)
Educació i accessibilitat: [Aprenem a votar](https://www.3cat.cat/3catinfo/del-polonia-al-vot-responsable-la-immersio-de-mes-de-2000-estudiants-en-el-mon-electoral/noticia/943846/) · [Dincat](https://www.dincat.cat/wp-content/uploads/2023/03/NP-eleccions-accessibles.pdf) · [ACM, tallers per a candidats](https://www.acm.cat/sites/default/files/tallers_pre-electorals_2019_v9.pdf)
Finançament: [NLnet propose](https://www.nlnet.nl/propose) · [NLnet Commons](https://www.nlnet.nl/commonsfund) · [Civitates](https://civitates-eu.org/funding-opportunity/call-for-proposals-strengthening-independent-public-interest-journalism-in-europe/) · [Premi Carulla](https://interaccio.diba.cat/printpdf/news/2025/11/12/oberta-convocatoria-del-premi-lluis-carulla-2026-per-projectes-culturals-amb-impac-0) · [EMIF](https://cdn.gulbenkian.pt/emifund/wp-content/uploads/sites/51/2022/03/CallFactCheckingJune2025.pdf) · [AI & Society](https://gfmd.info/fundings/ai-accountability-grants/) · [Premis Comunicació Local Diba](https://info-cemical.diba.cat/documents/d/premis-comunicacio-local/bases-premis-comunicacio-local-2026-pdf) · [ISPA 2026](https://digital.gob.es/content/dam/portal-mtdfp/funcion-publica/dgfp/ispa/ispa2026/documentos/INSTRUCCIONES_GENERALES_2026.pdf) · [Decidim/AOC](https://www.aoc.cat/en/blog/2021/govern-financa-decidim-catalunya/) · [Verkami i periodisme](https://www.eldiario.es/colaboratorio/periodismo-crowdfunding-verkami-corrupcion-ciu-artur-mas-catalunya_132_5571786.amp.html) · [Open Data Day](https://opendataday.org/)
