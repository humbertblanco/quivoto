# Pla de solucions i millores de quivoto (octubre 2026 → juny 2027)

Estat a: 26-10-2026 (primera i segona ronda) · Commit analitzat: `e53c589` · Eleccions: **23-05-2027** (209 dies)

Aquest pla resumeix i prioritza vuit anàlisis fetes el 26-10-2026: quatre auditories del producte (primera ronda) i quatre exploracions més a fons (segona ronda). Cada tasca remet a la troballa original, on hi ha el detall (on és el problema, per què passa i la solució proposada):

| Annex | Prefix | Què cobreix |
|---|---|---|
| [01-usabilitat.md](01-usabilitat.md) | **UX-** | Navegació, cerca, fitxa de municipi i de persona, brúixola, mapa, accessibilitat, llegibilitat, confiança, castellà, diferències amb `design/` |
| [02-dades-i-grafiques.md](02-dades-i-grafiques.md) | **DAD-** | Recollida i cobertura de dades, incidències, calendari, gràfics, ordre de la fitxa, descàrregues, model de la brúixola |
| [03-fonts-noves.md](03-fonts-noves.md) | **FON-** | Fonts obertes que encara no es fan servir, verificades una a una, amb calendari de publicació abans del 23-M |
| [04-tecnica.md](04-tecnica.md) | **TEC-** | Operació i desplegament, seguretat i privadesa, arquitectura, tests, rendiment, SEO, preparació del maig 2027 |
| [05-bruixola.md](05-bruixola.md) | **BRU-** | *Segona ronda.* La brúixola comparada amb StemWijzer, smartvote, Wahl-O-Mat, SVT i altres; recerca acadèmica; abast (N municipis), qüestionari a partits, fórmula, validació, calendari |
| [06-legal-i-electoral.md](06-legal-i-electoral.md) | **LEG-** | *Segona ronda.* LOREG i Junta Electoral, RGPD de càrrecs i candidats, galetes i butlletí, llicències, dret a l'honor i rectificació, governança. Llista de comprovació del període electoral i preguntes per a un advocat |
| [07-audiencia-i-difusio.md](07-audiencia-i-difusio.md) | **AUD-** | *Segona ronda.* Audiència, projectes comparables, mitjans locals, xarxes, butlletí, SEO per intenció, idees de producte, finançament compatible amb la neutralitat, calendari de difusió |
| [08-dades-segona-passada.md](08-dades-segona-passada.md) | **DD2-** | *Segona ronda.* Pipeline d'actes (votacions estructurades, validació, revisió humana), resultats per secció censal, programes electorals, fonts municipals noves, controls creuats entre fonts |

Com reprendre la feina: vegeu el [README](README.md) d'aquesta carpeta.

---

## 1. Diagnosi en cinc punts

1. **El producte és sòlid, el risc és d'operació.** El codi té bona disciplina («sense dada, no estimació», 2.200 tests amb *fixtures* reals). El que pot fallar en campanya és tot el que l'envolta: la base de dades, les actes i l'HTML generat només existeixen en un portàtil; no hi ha CI ni còpies; el desplegament documentat pot esborrar l'Observatori (TEC-O1, TEC-O2, TEC-O4).
2. **El que hi ha en producció no surt del repositori.** La fitxa en directe té blocs i fitxers (`manifest.json`, `fonts.json`, «On cau entre els seus», vehicles) que no són al codi (DAD-1.1). Fins que no es resolgui, cap altra persona pot reprendre la feina amb garanties.
3. **El maig del 2027 està escrit a mà.** L'elecció `M20231`, els anys de les fonts i el mandat apareixen en desenes de fitxers (TEC-A3, DAD-1.5). No hi ha adaptador per a les candidatures del 2027 ni per a la nit electoral.
4. **La lectura per a un ciutadà es pot millorar molt amb poc.** La fitxa té 15–19 blocs; la mateixa barra vol dir quatre coses; el verd/vermell fa veredictes que el projecte diu que no fa; la brúixola en mòbil deixa l'usuari al peu de pàgina (DAD-2.1, DAD-2.2, DAD-2.9, UX-3.1, UX-5.1).
5. **Hi ha dades noves de valor alt a l'abast.** Set fonts Socrata/Idescat amb codi municipal entren amb els adaptadors que ja existeixen, unes dues setmanes de feina en total (FON-§9). La de candidatures (BOP) té data límit dura i s'ha de provar amb el 2023 abans de març.

Afegit a la segona ronda:

6. **La brúixola no pot ser completa als 947.** Cap brúixola del món fa centenars de conjunts locals de 25 afirmacions; les que cobreixen centenars de municipis fan un nucli comú gran i poques preguntes locals. La recomanació és tres nivells: ~30 municipis amb brúixola completa, un nucli compartit per a 100–150 i radiografia per a la resta (BRU-§0, BRU-11). La fórmula actual (L1) és bona; el risc és el que hi entra i com es presenta.
7. **Hi ha riscos legals concrets i datats.** Qualsevol agregat de resultats de la brúixola es pot llegir com un sondeig (prohibit del 18 al 22-05); la base jurídica de la política de privadesa és incorrecta per a una empresa privada i l'autoritat que cita no és la competent; els candidats no electes del 2027 són particulars; l'enllaç `?r=` portaria opinions polítiques al servidor (LEG-§0, BRU-9).
8. **No hi ha cap canal d'audiència propi.** No hi ha butlletí real, ni comptes del projecte, ni codi d'inserció. Els projectes semblants arriben a la gent a través de mitjans locals. La nit electoral no es pot guanyar; el «abans» i el «després» (pactes, nou alcalde) sí (AUD-§0).
9. **Una dada que ja tenim val més del que fem servir.** El conjunt de resultats que ja es llegeix porta districte, secció i mesa per als 947 municipis (2015–2023): mapes de vot dins de les ciutats grans amb poc esforç. El pipeline d'actes necessita una taula de votacions amb validació abans que la brúixola en depengui (DD2-B1, DD2-A).

---

## 2. Fases i calendari

| Fase | Quan | Objectiu | Tasques |
|---|---|---|---|
| **0. Fonaments** | Ara → mitjan novembre 2026 | Que el repositori sigui la font de veritat, que els tests passin i que res es pugui perdre | F0-1 … F0-11 |
| **1. Confiança i lectura** | Novembre → desembre 2026 | Treure els errors que un ciutadà o un periodista detecta, fer llegible la fitxa, posar la privadesa en regla i llançar-ho indexat el 23-11 | F1-1 … F1-18 |
| **2. Dades noves i comparacions** | Desembre 2026 → febrer 2027 | Fonts noves de valor alt, «municipis semblants», votacions estructurades, mapes per secció, distribució amb mitjans, pilots de la brúixola | F2-1 … F2-18 |
| **3. Brúixola i candidatures** | Gener → abril 2027 | Brúixola per nivells, qüestionari a partits, extractor de candidatures provat, guia electoral, assaig general | F3-1 … F3-16 |
| **4. Campanya i canvi de mandat** | Abril → desembre 2027 | Publicar candidatures, complir el calendari electoral, aguantar el pic, passar al mandat 2027-2031 i tancar el cicle | F4-1 … F4-10 |
| **Fons** | Quan hi hagi mans | Deute de mantenibilitat que no és urgent però abarateix tota la resta | FX-1 … FX-6 |

Esforç: **S** < 1 dia · **M** 1–3 dies · **L** > 3 dies. Estat: `pendent` / `en curs` / `fet` / `descartat` (actualitzeu-lo aquí quan canviï).

---

## 3. Fase 0 — Fonaments (ara → mitjan novembre 2026)

Sense aquesta fase, la resta no es pot fer de manera segura ni per una segona persona.

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F0-1 | **Pujar al repositori el codi que hi ha en producció** (la branca o els canvis locals posteriors al 31-08) i escriure el commit a `manifest.json` i al peu | `git status` net al portàtil, el commit del peu existeix a `origin` | DAD-1.1 | S | pendent |
| F0-2 | **Arreglar `pnpm test`**: script de `shared-schemas` amb `--root ../..`; `dades.test.ts` amb PGlite en memòria o saltat si no hi ha base; reparar o treure `db:reset` | `corepack pnpm test` passa en un clon net | TEC-T1, TEC-T2, DAD-0 | S | pendent |
| F0-3 | **CI a GitHub Actions** (`ci.yml`: install, typecheck, tests a cada push i PR) i treure la insígnia estàtica del README | Cada PR mostra el resultat dels tests | TEC-O2 | S | pendent |
| F0-4 | **Còpia de seguretat externa diària** de `packages/db/.data/`, actes, fotos i HTML publicat | Hi ha una còpia de fa < 24 h fora del portàtil i s'ha provat de restaurar-la | TEC-O1 | M | pendent |
| F0-5 | **Desplegament atòmic** (`tools/desplega.sh`): directori de *release*, *symlink*, *rollback* de les 3 darreres; publicar a un directori temporal i esborrar pàgines obsoletes | Un desplegament des d'un clon net no pot esborrar l'Observatori; hi ha *rollback* en una ordre | TEC-O4, TEC-O5, TEC-O6 | S | pendent |
| F0-6 | **Cloudflare en mode proxy** amb memòria cau a `/observatori/*`, *bypass* a `/api/*` i límit de peticions al formulari; fer que `CF-Connecting-IP` només es cregui si ve de Cloudflare | El lloc respon des de la CDN i el formulari no accepta inundacions | TEC-O9, TEC-S4 | S | pendent |
| F0-7 | **Credencials i documentació d'infraestructura**: rotar la clau global de Cloudflare a *tokens* de zona, treure dades d'infraestructura del repo públic | Cap dada d'infraestructura al repo; clau global revocada | TEC-O8, TEC-S10 | S | pendent |
| F0-8 | **Verificar la CSP i les capçaleres reals** de producció i alinear `.htaccess` del repo | Les capçaleres del repo i les de producció coincideixen | TEC-S1 | S | pendent |
| F0-9 | **Baixar ara les candidatures 2015–2023 de la Diputació de Barcelona** (la pàgina avisa de manteniment) i guardar-ne còpia | Còpia desada amb data i hash | DD2-D1 | S | pendent |
| F0-10 | **Correccions petites de J12 (actes)**: no tornar a baixar els PDF que fallen, desar `sha256` i pàgina, no sobreescriure els vots oficials de Barcelona, no reescriure el JSON amb una execució parcial | Una execució parcial no perd dades | DD2-A1 | S | pendent |
| F0-11 | **Política d'independència i finançament** i pàgina «Qui som»: responsable editorial amb nom, activitat de l'empresa titular, fonts de finançament, conflictes d'interès, ús d'IA | Pàgina publicada i enllaçada al peu | AUD-G1, LEG-G1, LEG-G2 | S | pendent |

---

## 4. Fase 1 — Confiança i lectura (novembre → desembre 2026)

### 4a. Privadesa i neutralitat (abans que res)

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F1-1 | **Analítica sense galetes** (Plausible, GoatCounter o logs) o bàner amb «Rebutja» igual de visible; mai analítica a la brúixola | Cap galeta de tercers sense consentiment | TEC-S2, UX-9.3 | S | pendent |
| F1-2 | **Alinear la política de privadesa amb les fotos d'exalcaldes** (o retirar-les) i afegir «Corregir o oposar-me» a les fitxes de persona | Política i web diuen el mateix | TEC-S3 | S | pendent |
| F1-3 | **Treure el verd/vermell de «millor/pitjor»**: direcció neutra i paraules descriptives; color d'avís només on hi ha un llindar legal | Cap color de judici fora de llindars legals citats | DAD-2.2, UX-8.3 | S | pendent |
| F1-4 | **«Has vist un error?» a cada pàgina** i registre de correccions visible | Enllaç present a totes les plantilles | UX-9.1 | S | pendent |

### 4b. Errors que el ciutadà veu

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F1-5 | **Brúixola en mòbil**: tornar a dalt i moure el focus en començar; «M'importa molt» abans de l'escala; regla global `[hidden]` | Provat a 390 px amb Playwright | UX-5.1, UX-5.2, UX-5.3 | S | pendent |
| F1-6 | **Unificar la cerca de la landing amb `cercador.ts`** (mateix slug, rànquing, estat de càrrega i error, teclat) | Noms amb `·` i `'` no donen 404; test de slugs | UX-2.1, UX-2.2 | S | pendent |
| F1-7 | **Correccions de dades petites**: buit convertit en zero a finances, sèrie del deute retallada a la descàrrega, avís del cost efectiu, «−0,0 %», xifres escrites a mà a la fitxa, llicència de les dades (CC BY 4.0 a tot arreu) | Test per a cada cas | DAD-1.6, DAD-3.1, DAD-3.2, DAD-2.7, DAD-2.6, DAD-3.4 | S | pendent |
| F1-8 | **Verificar les tres incoherències vistes al web en directe**: PSC-CP 10 vs 11 a Esplugues, font «Llobregatalcaldia», filtre «Deute per sobre de 2 €» | Corregides o descartades amb l'HTML real | UX-3.4, UX-4.1, UX-8.2 | S | pendent |
| F1-9 | **Accessibilitat bàsica**: contrast del coral als botons, mida mínima de 12 px, taules dels gràfics visibles (`<details>`), mapa sense 947 tabulacions | Revisat amb axe sobre 10 pàgines | UX-7.1, UX-7.3, DAD-2.3, UX-6.1 | S–M | pendent |

### 4c. Llegibilitat i indexació

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F1-10 | **Indexació abans del gener**: una sola funció `metaRobots`, treure `noindex` fix de portada, mapa, comarques i 947; sitemap complet; Search Console; treure «esborrany intern» del peu | Cap pàgina del sitemap amb `noindex` (test a CI) | TEC-SEO1, TEC-SEO2, UX-1.5 | S | pendent |
| F1-11 | **Navegació i portada**: la brúixola al menú amb un sol nom; la cerca com a acció principal de la landing; xifres honestes; menú d'una fila en mòbil | Revisat a 390 px | UX-1.1, UX-1.2, UX-1.3 | S | pendent |
| F1-12 | **Reordenar la fitxa de municipi de 15–19 blocs a 9**, amb resum a dalt i «Per aprofundir» plegat; un sol component «regle de grup» per a totes les comparacions; glossari en línia | La fitxa respon les tres preguntes del pla de dades en aquest ordre | DAD-2.9, DAD-2.1, UX-3.1, UX-3.2 | M | pendent |

### 4d. Afegit a la segona ronda: privadesa, audiència i brúixola

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F1-13 | **Reescriure la política de privadesa i l'avís legal** abans del 15-12: base jurídica d'interès legítim amb ponderació escrita i procediment d'oposició, AEPD com a autoritat, citacions correctes de la Llei 19/2014, descripció del que realment es publica, dades registrals | Revisat per un advocat (LEG-§6) | LEG-P1, LEG-P2, LEG-P3, LEG-C3 | S–M | pendent |
| F1-14 | **Butlletí «el meu poble»** amb doble confirmació i segmentat per municipi (inclou FX-6, que s'avança) | Una alta deixa prova de consentiment i es pot donar de baixa en un clic | AUD-C1, FX-6, LEG-C2 | M | pendent |
| F1-15 | **Llançament públic indexat el 23-11-2026** («falten sis mesos») i comptes del projecte a les xarxes | Requereix F1-10 i F1-11 | AUD-§5, AUD-S1 | S | pendent |
| F1-16 | **Pàgina «Quant cobren els alcaldes»** publicada el mateix dia que surti l'ISPA (previst a finals de novembre, no confirmat) | Publicada el dia de l'ISPA | AUD-W3 | S–M | pendent |
| F1-17 | **Abast de la brúixola**: fixar els tres nivells (A ≈ 30, B ≈ 100–150, C) amb criteris publicats; demanar contactes a les federacions dels partits; preparar la consulta a la Junta Electoral Central | Criteris i llista de candidats a nivell A publicats | BRU-11.1, BRU-3.2, LEG-E10 | S | pendent |
| F1-18 | **Brúixola sense rastre**: enllaç per compartir amb `#r=` en lloc de `?r=`, cap analítica ni tercer a la pàgina, test a CI que ho comprovi | El test falla si la pàgina fa cap petició externa | BRU-9.2, BRU-9.3, LEG-P8 | S | pendent |

L'ordre proposat per a la fitxa és a DAD-2.9; la versió de dos nivells i l'índex enganxós, a UX-3.1. Són compatibles: els blocs 0–2 de DAD-2.9 són el «resum» d'UX-3.1.

---

## 5. Fase 2 — Dades noves i comparacions (desembre 2026 → febrer 2027)

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F2-1 | **Centralitzar el calendari** (`ELECCIO_ACTUAL`, mandats, darrer exercici) en un mòdul; prohibir literals `M20…` fora d'ell amb un test; els jobs descobreixen l'últim any disponible | Canviar d'elecció és editar un sol fitxer | TEC-A3, DAD-1.5 | M | pendent |
| F2-2 | **Registre de fonts a la base** (`sources`, cadència, llicència, citació) i llista de fonts de la fitxa, `fonts.json` i `ESQUEMA` generats d'aquí | Cap llista de fonts escrita a mà | DAD-1.2 | M | pendent |
| F2-3 | **Incidències per execució**: `run_id`, deduplicació, tancament; aplicar la porta «gravetat alta amaga el bloc»; pressupostos de cobertura per font amb alerta | El report compara amb l'execució anterior | DAD-1.3, TEC-R1, TEC-R2, DAD-1.9 | M | pendent |
| F2-4 | **Matriu de cobertura camp × municipi** i segell «dada de AAAA · consultada el …» a cada bloc | Bloc «Què en sabem» com al prototip de `design/` | DAD-1.7, DAD-1.8, UX-8.1 | M | pendent |
| F2-5 | **Fonts noves, lot 1 (S, valor alt)**: Observatori del Territori `8aaj-ypcb` + `b9cr-32i4`, IST de l'Idescat, PUOSC `v5fj-86q3`, GAIP `mpbu-t5zh`, zones tensades `fftm-v9b6`, HPO `v8i4-fa4q` + `txkt-yjtq` | Un job i un test per font, amb absències | FON-2.1, FON-3.1, FON-1.1, FON-6.1, FON-2.3, FON-2.4 | 6 × S | pendent |
| F2-6 | **Captures mensuals del Registre de Turisme** (`t2h3-cgys`) a partir d'ara, agregades per municipi (sense dades personals) | Hi ha una captura per mes des de novembre 2026 | FON-2.2 | S | pendent |
| F2-7 | **«Municipis semblants»**: k veïns per població, densitat, renda, IST i turisme; amb noms, diferència en euros i espurna de la sèrie | Cada comparació diu amb qui es compara | DAD-1.12, DAD-2.8, FON-3.1 | M | pendent |
| F2-8 | **Fonts noves, lot 2 (M, valor alt)**: PSCP canònica `ybgg-dgi6` + `8idu-wkjv`, RAISC `s9xt-n979`, compte general de la Sindicatura, atur registrat (EMEX/SEPE) | Ídem F2-5 | FON-1.6, FON-1.4, FON-1.7, FON-3.2 | M cadascuna | pendent |
| F2-9 | **Descàrregues**: `datapackage.json`, versions datades amb `SHA256SUMS`, CSV internacional, `motiu_absencia` | Un periodista pot citar una versió concreta | DAD-3.3, DAD-3.5, DAD-3.6 | M | pendent |
| F2-10 | **Pipeline portable i programat**: `sharp`/`satori` en lloc de `sips`/Chrome, Docker, `refresh.yml` setmanal (diari des del març) contra Postgres | El pipeline corre a CI sense el portàtil | TEC-O3, TEC-R5, TEC-R4, TEC-A5 | M | pendent |

### Afegit a la segona ronda

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F2-11 | **Votacions estructurades a partir de les actes**: taules `votacions`, `vots_grup` i `assistencia`; 10 regles de validació; confiança A/B/C; cua de revisió humana (~25 h); certificats de moció de Girona. És la base de F3-3 | Precisió de J12 mesurada contra l'oracle de Barcelona | DD2-A2 … DD2-A7 | ~4–5 setmanes | pendent |
| F2-12 | **Resultats i participació per secció i mesa** (2015–2023, del conjunt que ja es llegeix) i mapes dins dels ~70 municipis grans amb geometria ICGC/Idescat | Les sumes per secció quadren amb el total municipal | DD2-B1, DD2-B2, DD2-B4 | S–M | pendent |
| F2-13 | **Controls creuats entre fonts a CI** (14 parelles: escons, alcaldies, població…) | Cada publicació passa els controls | DD2-E | M | pendent |
| F2-14 | **Pàgines `/m/<slug>/2027/`** creades al desembre perquè Google les indexi abans d'abril | 947 pàgines al sitemap | AUD-W2 | M | pendent |
| F2-15 | **Distribució amb mitjans locals**: fitxa incrustable, paquet per a l'AMIC i la premsa comarcal, peça setmanal «Dada dels 947», xarxa de periodistes | Pilot amb 3–5 mitjans | AUD-P2, AUD-D1, AUD-C4, AUD-D2, AUD-D4 | M | pendent |
| F2-16 | **Avaluació d'impacte (AIPD), registre d'activitats i decisió sobre el DPD**, amb advocat, abans de l'1-03 | Documents desats fora del repo públic | LEG-P9 | M | pendent |
| F2-17 | **Fonts de serveis bàsics i participació**: escoles 2020–2027, farmàcies, banda ampla, caixer mòbil, panell de participació, Decidim, Dibaròmetre | Un job i un test per font | DD2-D2, DD2-D5 … DD2-D8, DD2-D10 | 4–6 × S | pendent |
| F2-18 | **Tres pilots de brúixola de punta a punta al desembre** (p. ex. Sabadell, Badalona, Esplugues), cronometrant les hores per decidir N | Ritme mesurat; N revisat | BRU-11.2, BRU-3.5 | M | pendent |

La resta de fonts (autoconsum, afiliats, deutes de la Generalitat, matriculació 0-3, accidents…) són a FON-§9 i FON-§3–5. Totes han de passar els criteris de `docs/FONTS-PERSONES.md` abans d'entrar.

---

## 6. Fase 3 — Brúixola i candidatures (gener → abril 2027)

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F3-1 | **Fer servir `matching.ts` real al navegador** (empaquetat amb esbuild) i desar les respostes per `id` d'afirmació, no per posició | Un test comprova que el codi incrustat és el provat | DAD-4.4, DAD-4.5 | S–M | pendent |
| F3-2 | **Esquema Zod de les afirmacions**: `id`, `versio`, `ambit` local/compartida, tema d'un vocabulari tancat, estat i aprovació; migrar els 23 JSON | CI valida tots els conjunts | DAD-4.1, DAD-4.2 | M | pendent |
| F3-3 | **Posicions derivades de les votacions estructurades** (F2-11) en lloc de regex sobre l'evidència | Cap posició depèn del text editorial | DAD-4.3, DD2-A2 | M (després de F2-11) | pendent |
| F3-4 | **Resultat de la brúixola**: empats, caixa «dades insuficients», compartir sense respostes, reprendre la sessió, accessibilitat (radiogroup, progressbar, aria-live) | Coincideix amb `design/prototip/resultat.html` | UX-5.5, UX-5.6, UX-5.4 | M | pendent |
| F3-5 | **Extractor de candidatures** dels BOP (API del BOPB, PDF de Girona, Lleida i Tarragona), provat amb el 2023 i validat amb els fitxers de l'Interior | Les llistes del 2023 surten bé per als 947 | FON-7.2, FON-7.3 | L | pendent |
| F3-6 | **Afirmacions compartides i candidatures del 2027 com a subjecte**, qüestionari a partits i model «què diuen / què han fet» | Hi ha almenys un municipi complet de punta a punta | DAD-4.7, DAD-4.6 | L | pendent |
| F3-7 | **Assaig general (febrer)** amb dades simulades `M20271`: cadena sencera a CI, desplegament a un subdomini de proves | Canvi d'elecció provat sense tocar codi | TEC-§8 | M | pendent |
| F3-8 | **Decidir la nit electoral**: o no publicar resultats provisionals (i dir-ho), o adaptador incremental | Decisió escrita en aquest pla | TEC-§8, AUD-§0, LEG-E8 | S (decidir) | pendent |

Afegit a la segona ronda:

| ID | Tasca | Fet quan… | Refs | Esforç | Estat |
|---|---|---|---|---|---|
| F3-9 | **Qüestionari als grups municipals actuals al febrer** (nivells A i B): resposta completa obligatòria, 500 caràcters, reconciliació amb els vots, consell assessor de 2–3 politòlegs; clàusula de gratuïtat i privadesa | Qüestionari enviat amb registre d'enviaments | BRU-3.1 … BRU-3.3, LEG-E5 | M | pendent |
| F3-10 | **Resultat de la brúixola en dues columnes**: «el que diuen» i «el que han votat» com a dos percentatges separats; robustesa i «empat» declarat; paritat de cobertura entre grups; bloc «Vota com un regidor»; botó «No l'entenc» | Coincideix amb el disseny de BRU-6.2 | BRU-6.2, BRU-4.2, BRU-4.4, BRU-2.3, BRU-2.5 | M | pendent |
| F3-11 | **Validació de cada brúixola abans de publicar-la**: simulació de biaix de selecció, proves de pseudovotant a CI, entrevistes cognitives als pilots, fitxa tècnica pública per municipi | Cap municipi es publica sense fitxa tècnica | BRU-8.1 … BRU-8.4, BRU-7.1 | M | pendent |
| F3-12 | **Programes electorals**: canonada per capturar els del 2027 el dia que surtin (amb còpia a Wayback) i PAM dels municipis de més de 100.000 habitants | Esquema llest al febrer; captura del 21-04 al 22-05 | DD2-C2, DD2-C3 | M | pendent |
| F3-13 | **Guia d'estil electoral** abans del 30-03: cap crida al vot, cap agregat de la brúixola per candidatura, revisió humana signada de cada posició, etiqueta d'IA on calgui | Guia publicada i aplicada | LEG-E1, LEG-E2, LEG-E9, LEG-H1 | S–M | pendent |
| F3-14 | **Política per als candidats no electes del 2027**: dades mínimes, `noindex`, retirada a petició, esborrat als 6 mesos | Llesta abans del 21-04 | LEG-P4 | M | pendent |
| F3-15 | **Kit escolar** (educació cívica) publicat al gener, o s'endarrereix un curs | Publicat al gener | AUD-P10 | M | pendent |
| F3-16 | **Finançament compatible amb la neutralitat**: donacions recurrents, micromecenatge, fundacions privades amb política escrita (cap administració ni partit) | Política i primer canal de donació en marxa | AUD-G2, AUD-G3, AUD-G4, AUD-§0 | M | pendent |

---

## 7. Fase 4 — Campanya i canvi de mandat (abril → juny 2027)

Dates previstes, a confirmar quan surti el decret (FON-7.1, LEG-§1): decret 30-03, candidatures presentades al BOP 21-04, **proclamació 26-04, publicació 28-04**, campanya 7–21-05, **prohibició de publicar sondejos 18–22-05**, reflexió 22-05, eleccions 23-05, constitució dels ajuntaments 12-06. La llista de comprovació dia a dia és a LEG-§4.

| ID | Tasca | Quan | Refs | Estat |
|---|---|---|---|---|
| F4-1 | Publicar les candidatures presentades i proclamades | 21-04 i 28-04-2027 | FON-7.2 | pendent |
| F4-2 | Refrescar les dades que surten abans del 23-M (padró 1-1-2026, liquidació 2025, lloguer, residus, atur d'abril, captura final de turisme) | Gener → maig 2027 | FON-§9 (calendari) | pendent |
| F4-3 | Monitoratge: *uptime*, caducitat del certificat, alertes de fonts | Abans de l'abril | TEC-R3 | pendent |
| F4-4 | OG per a candidatura, partit, persona i resultat de la brúixola | Abans de la campanya | TEC-SEO4, UX-4.2 | pendent |
| F4-5 | Nit electoral segons la decisió de F3-8 | 23-05-2027 | TEC-§8 | pendent |
| F4-6 | Canvi de mandat: `ELECCIO_ACTUAL = M20271`, arxiu de les pàgines del mandat 2023, redireccions | Juny 2027 | TEC-A3, TEC-O6 | pendent |
| F4-7 | Seguir la llista de comprovació del període electoral (cap sondeig ni agregat del 18 al 22-05, res el 22-05, res fins a les 20 h del 23-05) | 30-03 → 23-05-2027 | LEG-§4 | pendent |
| F4-8 | Majories possibles amb l'historial de pactes des del 1979, i el nou alcalde el mateix dia de la constitució | 24-05 → 12-06-2027 | AUD-P5, AUD-P6 | pendent |
| F4-9 | Informe públic d'impacte; agregats de la brúixola només a partir del 24-05, amb fitxa tècnica | Juny 2027 | AUD-M3, BRU-9.1 | pendent |
| F4-10 | Retirar o anonimitzar les llistes de candidats no electes (~12-12-2027) i esborrar la llista de correus com es va prometre (31-12-2027) | Desembre 2027 | LEG-P4, LEG-C2 | pendent |

---

## 8. Fons: mantenibilitat (quan hi hagi mans)

| ID | Tasca | Refs | Esforç |
|---|---|---|---|
| FX-1 | Un sol mòdul d'escapament HTML (`escapeHtml`, `jsonSegur`, plantilla segura per defecte) en lloc de 27 còpies; escapar tot el JSON dins de `<script>` | TEC-S8, TEC-S9 | M |
| FX-2 | CSS extern amb *hash* en lloc de 70 kB en línia a cada pàgina; capçaleres de memòria cau | TEC-P1, TEC-P2, UX-11.1 | S–M |
| FX-3 | Partir `radiografia.ts` (5.300 línies) i les altres plantilles grans en càrrega, model i vista; JS de client compilat | TEC-A1 | L |
| FX-4 | Unificar la landing (Python) amb el pipeline (TS) i un sol joc de *tokens* de disseny | TEC-A2 | M |
| FX-5 | Esquemes Zod per a les mètriques `jsonb`; client HTTP únic amb reintents i memòria cau condicional | TEC-A4, TEC-A6 | M |
| FX-6 | Formulari de correu: doble confirmació, baixa amb *token*, `List-Unsubscribe`, sal obligatòria, CSV segur. **Avançat a la fase 1 dins de F1-14** | TEC-S5, TEC-S6, TEC-S7 | M |

Altres millores d'usabilitat de prioritat mitjana o baixa (fil d'Ariadna, recordar «el meu poble», mapa en mòbil, pàgina de mètode, pàgina de dades per a no experts, castellà) són a UX-1.4, UX-2.5, UX-6.2, UX-9.2, UX-10.1 i UX-12.1.

---

## 9. Decisions obertes (les ha de prendre el responsable del projecte)

| # | Decisió | Opcions | Recomanació de l'anàlisi | Bloqueja |
|---|---|---|---|---|
| D1 | Analítica | Sense galetes autoallotjada / GA amb bàner / cap | Sense galetes (també simplifica la CSP) | F1-1 |
| D2 | Fotos d'exalcaldes | Actualitzar la política / retirar-les | Actualitzar la política amb base legal i via d'oposició | F1-2 |
| D3 | Indexar les fitxes de persona? | Sí / no / només càrrecs actuals | Documentar-ho com a decisió de privadesa | F1-10 |
| D4 | Llicència de les dades derivades | CC BY 4.0 / altra | CC BY 4.0, que ja és el que diu la pàgina de dades | F1-7 |
| D5 | On viu la base de dades | Postgres gestionat / còpies de PGlite | Postgres gestionat (el codi ja ho suporta) | F0-4, F2-10 |
| D6 | Nit electoral | No publicar provisionals / adaptador incremental | No competir la nit (3Cat i VilaWeb ja ho fan): enllaçar els resultats oficials i centrar-se en majories possibles i pactes (AUD-§0) | F3-8 |
| D7 | Abast del castellà | Només etiquetes / brúixola i resum / tot | Brúixola i resum de la fitxa | UX-12.1 |
| D8 | Grups de comparació | Només trams de població / trams + «semblants» | Mantenir els trams i afegir «semblants» | F2-7 |
| D9 | Quants municipis amb brúixola completa | 10 / 30 / 70 | 30 al nivell A, revisat després dels pilots de desembre | F1-17, F2-18 |
| D10 | Base del rànquing de la brúixola al maig | Declarades / barreja / només vots | Declarades per a tothom, i el vot com a segona columna, mai barrejats | F3-10 |
| D11 | Proporció d'afirmacions locals i compartides | 18 + 7 a tot arreu / per nivells | Per nivells | F1-17 |
| D12 | Publicar agregats de respostes de la brúixola | Mai / després del 23-M / en campanya | Només a partir del 24-05, amb fitxa tècnica | F3-13, F4-9 |
| D13 | Presentar quivoto com a mitjà de comunicació | Sí / no | Decidir-ho amb l'advocat: canvia la protecció i les obligacions | LEG-H3 |
| D14 | Consulta formal a la Junta Electoral Central | Fer-la / no | Fer-la al gener sobre agregats i dia de reflexió | F1-17 |
| D15 | Finançament | Donacions + fundacions privades / també administracions | Només donacions i fundacions privades, amb política escrita; la convocatòria NLnet té requisits sobre propostes generades amb IA que cal llegir | F3-16 |
| D16 | Qüestionari a partits: resposta completa obligatòria i consell assessor | Sí / no | Sí a totes dues | F3-9 |

Les set preguntes concretes per a l'advocat són a LEG-§6.

---

## 10. Què no s'ha pogut verificar

Les auditories es van fer des d'un entorn sense accés directe a `quivoto.cat` (només resums de text) i sense la base de dades ni l'HTML generat, que no són al repositori. Per tant:

- Les pàgines es van provar amb *fixtures* dels tests, no amb les dades reals.
- Les capçaleres de producció (CSP, memòria cau) no s'han pogut llegir.
- `publica tots` no s'ha executat ni cronometrat.
- Les tres incoherències de F1-8 surten d'un resum del web i s'han de confirmar sobre l'HTML real.
- Els identificadors de les fonts noves es van comprovar amb consultes reals a les API el 26-10-2026, però no s'ha baixat cap fitxer sencer.
- Segona ronda: no s'ha pogut consultar Google Trends ni Search Console, de manera que la demanda de cerca és deduïda (AUD-§7). No s'ha verificat el text íntegre de la Declaració de Lausana ni cap acord de la Junta Electoral Central sobre brúixoles (BRU-§15, LEG-E10). Els fitxers per mesa de l'Interior, la llista de fitxers de l'ICGC i alguns CSV i XLSX binaris no s'han pogut obrir (DD2, final). Les dates de l'ISPA, del Dia de la Premsa Comarcal i de l'Open Data Day són aproximades.
- Els punts legals no són assessorament jurídic: els marcats amb [ADVOCAT] a LEG- s'han de confirmar.
