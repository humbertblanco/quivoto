# Segona passada de dades: actes, dades per secció, programes, fonts municipals i controls creuats

> Annex de la segona ronda del [pla de millores](PLA.md) (26-10-2026). Al pla, les troballes d'aquest document es citen amb el prefix **DD2-** (per exemple, DD2-B1).

> Annex de la segona ronda del pla de millores (`docs/pla-millores/PLA.md`; per copiar com a `docs/pla-millores/05-dades-2.md`, on l'enllaç relatiu seria `PLA.md`). Prefix proposat: **DD2-**.
> Data: 26-10-2026. Commit analitzat: `e53c589`. **No s'ha modificat el repositori.**
>
> **Com s'ha verificat.** Des del contenidor no es pot fer `curl` cap enfora (el proxy respon 403). Tot s'ha comprovat amb WebFetch, amb consultes reals a les API (SoQL de Socrata, CKAN de la Diputació, pàgines oficials). Cada troballa diu si està **verificada** (s'ha fet la consulta i es dona el resultat) o **no verificada** (el lloc bloqueja els robots o la descàrrega és binària). No es repeteix res de `03-fonts-noves.md` (FON-) ni de `02-dades-i-grafiques.md` (DAD-), llevat de quan una troballa d'aquí ho corregeix.
>
> **Format de cada troballa:** On/URL · Què · Valor per al ciutadà · Esforç (S < 1 dia, M 1-3 dies, L > 3 dies) · Valor (alt/mitjà/baix) · Advertiments.

---

## Resum en sis línies

1. **La troballa més gran no és una font nova: és la que ja fem servir.** El conjunt de resultats `ntc4-rnwr`, que J2 llegeix només a nivell municipal, porta **districte, secció censal i mesa per als 947 municipis** a les eleccions del 2015, 2019 i 2023. Les sumes quadren al vot. Juntament amb les geometries ICGC/Idescat (CC BY 4.0), permet fer **mapes de vot dins de les 70 ciutats grans** amb un esforç S-M (DD2-B1).
2. **Actes:** l'extractor (J12) és bo, però desa el resultat com un JSON per municipi que es reescriu sencer a cada execució. No guarda ni el hash del PDF ni la pàgina, i no valida les sumes contra els escons. Sense una taula `votacions` amb validació i cua de revisió, la porta de qualitat que la metodologia es compromet a aplicar (inversió de signe < 0,5 %) no es pot mesurar (DD2-A2 a A6).
3. **Girona té solució.** Publica un certificat per moció amb el vot per grup, en una URL previsible (DD2-A7).
4. **Candidatures:** la Diputació de Barcelona publica en CSV les **candidatures del 2015, 2019 i 2023** dels seus 311 municipis. Serveix d'oracle per provar l'extractor del BOP i, probablement, de font directa el 2027 (DD2-D1).
5. **Programes del 2023:** no hi ha cap arxiu central. PADICAT va capturar només 278 recursos. Per a qui governa, la font útil és el **PAM** (Pla d'Actuació Municipal). Per al 2027 cal capturar els programes el mateix dia que surten (DD2-C1 a C4).
6. **Controls creuats:** es proposen 14 parelles concretes, que es poden automatitzar i que ara no s'executen (DD2-E).

---

## A. Actes de ple: com funciona avui i com hauria de funcionar

### A1. Diagnosi del pipeline actual (llegit al codi)

| Pas | On | Què fa avui | Mancança |
|---|---|---|---|
| Índex | `jobs/j12-actes.ts:338-352` | Consulta l'índex CKAN de l'AOC (`b5d370d0…`) per lots de 20 `CODI_ENS`, des de `MANDATE_START`. Només municipis de ≥ 20.000 hab. (70) | No cobreix Terrassa (no és a l'índex des del 2018), Sant Adrià ni Premià. Girona i L'Hospitalet hi publiquen extractes sense vot |
| Descàrrega | `j12-actes.ts:107-237` | Una sola descàrrega alhora, amb 1 s de pausa i `User-Agent` identificat. Desa la memòria cau a `.data/actes/<codi_ens>/<codi_acta>.{pdf,txt}` | **No hi ha memòria cau negativa.** Si un fitxer no és PDF (`acta_no_es_pdf`) o el text és il·legible, no s'escriu cap `.txt` i el document **es torna a baixar a cada execució**. Hi ha 3 casos de 133 a la mostra (.doc/.docx) i actes amb la font xifrada (Palafrugell) |
| Text | `adapters/actes.ts:123` | `pdftotext -layout`; la comprovació de llegibilitat busca 7 paraules clau | No hi ha OCR. Una acta escanejada o amb la font xifrada queda fora, sense alternativa. No es detecta l'idioma: castellà, i aranès a la Val d'Aran |
| Neteja | `actes.ts:181` `netejaMarge` | Treu els fragments que es repeteixen a ≥ 50 % de les pàgines. Molt ben resolt | Els fragments repetits **són l'empremta de la plataforma** (esPublico, Absis…) i no es desen. Es podrien fer servir per classificar la família de format gratis |
| Òrgan | `actes.ts:252` | Ple, junta de govern o desconegut, segons el capçal | Els «desconegut» compten com a ple (`j12:399`) |
| Punts i vot | `actes.ts:1470` `extreuActa` | Ancora a la votació i puja fins al títol. Quatre lectures del vot per grup | No relaciona el recompte amb `councilSeats`, ni el vot de cada grup amb els seus escons |
| Desat | `j12:487-528` | Un sol `municipality_metrics(kind="mocions")` per municipi, amb una `llista` JSON | (a) **Es reescriu sencer**: una execució amb `maxActesPerMunicipi` esborra la passada completa anterior. (b) `PuntDesat` **no té `sha256` ni pàgina**: el hash es calcula però es perd, i ni la cita ni l'enllaç poden apuntar a una pàgina concreta. (c) Els punts unànimes que no són mocions es descarten (`valLaPenaDesar`), i amb ells el denominador de la «capa 2, unanimitat derivada». (d) Els grups es desen tal com els escriu l'acta; la correspondència amb `political_groups` es fa més tard, a `publish/posicions.ts`. (e) L'assistència es compta per nom normalitzat, sense `person_id` |
| Barcelona | `jobs/j16-barcelona-plenari.ts:48` | Escriu la mateixa fila `mocions` amb el CSV oficial | **Si J12 s'executa després de J16, la desfà** (el mateix codi ho reconeix). J12 no exclou Barcelona |
| Avaluació | `docs/metodologia/03-actes-i-mocions.md` §«Com mesurem» | Llindars proposats: inversió de signe < 0,5 %, precisió ≥ 95 % | **No s'ha mesurat res.** No hi ha conjunt d'or ni taula on desar l'avaluació. Barcelona (J16) ja és un oracle disponible i no s'utilitza per mesurar J12 |

**Esforç per tancar les mancances petites:** memòria cau negativa, desar `sha256` i pàgina, excloure Barcelona de J12 i no reescriure amb execucions parcials. Total **S**. Valor **alt**: totes condicionen la fiabilitat del que es publica.

### A2. Proposta d'esquema: votacions estructurades (substitueix el JSON `mocions`)

Taules noves a `packages/db` (Drizzle):

```
actes_documents(id, municipality_id, codi_acta, data_sessio, url, sha256 UNIQUE, bytes,
                pagines, productor_pdf, empremta_plataforma, idioma, text_origen ENUM(pdf,ocr),
                organ ENUM(ple,junta_de_govern,desconegut), estat ENUM(ok,no_pdf,illegible,massa_gran),
                extractor_versio, baixat_el)
punts_ple(id, acte_id, ordre, numero, titol, tipus, expedient, proposant_text, proposant_grup_id NULL,
          pagina_inici, offset_inici, offset_fi)
votacions(id, punt_id, seq /* fons, esmena, urgència */, resultat, mode ENUM(ordinaria,nominal,assentiment,secreta),
          favor, contra, abstencio, blanc, absents, membres_presents, cita, pagina, patro,
          confianca ENUM(A,B,C), estat_revisio ENUM(pendent,acceptada,corregida,rebutjada), extractor_versio)
vots_grup(votacio_id, grup_text, group_id NULL, sentit, n_vots NULL,
          base ENUM(acta,nominal,aritmetica,unanimitat_amb_assistents))
assistencia(acte_id, person_id NULL, nom_text, grup_text, present BOOLEAN)
alies_grup(municipality_id, mandat, text_normalitzat, group_id)   -- «ERC-AM 2023 → ERC 2025»
revisions(votacio_id, clau_estable /* sha256+offset */, revisor, decisio, correccio JSONB, nota, data)
```

- La **clau estable** d'una votació és `sha256 del PDF + offset`. Així una correcció humana sobreviu a una nova extracció si el document no canvia.
- `mocions` (el JSON actual) passa a ser una **vista derivada**. El `publish/` no s'ha de tocar el primer dia.
- J16 (Barcelona) escriu a les mateixes taules amb `base=acta` i `confianca=A`.
- Esforç **M** (2-3 dies, migració inclosa). Valor **alt**. És el requisit de F3-3 (DAD-4.3) i el desbloqueja.

### A3. Validació automàtica (regles amb codi d'error)

| Codi | Regla | Dades que necessita |
|---|---|---|
| V1 | Suma de `vots_grup` per sentit = recompte de la votació | Ja és a l'extracció |
| V2 | favor + contra + abstenció + blanc ≤ `councilSeats` | `municipalities.councilSeats` |
| V3 | Total de vots = membres presents, si hi ha llista d'assistents | `assistencia` |
| V4 | `n_vots` d'un grup ≤ escons del grup a la data del ple | Composició del ple de l'acta (cartipàs, `nm3n-3vbj`) |
| V5 | Cada `grup_text` es resol a un grup del mandat; si no, la votació baixa a C | `alies_grup` |
| V6 | El resultat és coherent amb els vots (aprovat ⇔ favor > contra), llevat que l'acta digui majoria qualificada | Text del bloc |
| V7 | Hi diu «unanimitat» però hi ha vots en contra o abstencions → **el bloc «Tipus de votació» mana** (EXTRACCIO §4.6.3) | Ja és a l'extracció |
| V8 | La data cau dins del mandat i l'òrgan és `ple` | `actes_documents` |
| V9 | No hi ha cap altra votació amb el mateix (municipi, data, número de punt) en un altre `codi_acta` (duplicats de l'índex) | Índex |
| V10 | Si el municipi és Barcelona, l'extracció del PDF coincideix amb J16 (oracle) | J16 |

**Confiança:** A = l'acta desglossa i passa V1-V9. B = deduït (aritmètica única, o unanimitat amb assistents), o només falla V3 perquè no hi ha llista d'assistents. C = qualsevol altre cas. **Es publiquen A i B, amb l'etiqueta visible. C no es publica.** Esforç **M**. Valor **alt**.

### A4. Revisió humana (cua)

- **Entren a la cua:** (1) totes les votacions C que són mocions o declaracions; (2) les **20 primeres votacions de cada família de format nova** (DD2-A5); (3) una **mostra aleatòria del 5 % de les A**, que dona la precisió amb interval de confiança; (4) tota votació citada per una afirmació de la brúixola, sense excepció.
- **Interfície mínima:** una pàgina HTML estàtica generada pel pipeline (`publish/revisio.ts`, no pública). Per a cada votació mostra la imatge de la pàgina (`pdftoppm -f p -l p`), la cita, les files extretes i tres botons (accepta, corregeix, rebutja). En corregir, s'escriu un JSON a `revisions/` versionat al repositori, de manera que les correccions **es poden revisar en un PR**.
- **Rendiment esperat:** uns 30 s per votació en revisió. 70 municipis × ~40 mocions al mandat ≈ 2.800 mocions. Si en revisem el 30 % (C, famílies noves i mostra), són **~25 hores de persona**. És assumible abans del març.
- Esforç **M-L** (3-5 dies). Valor **alt**: és l'única manera de complir la regla de la metodologia de «no publicar vot per grup fins tenir les xifres».

### A5. Classificació per família de format (gairebé gratis)

- `pdfinfo` → `Producer`/`Creator`, més els fragments que `netejaMarge` ja descarta (p. ex. «Document signat electrònicament des de la plataforma esPublico Gestiona»), fan una **empremta**. Agrupant per empremta surten les famílies, i la porta de validació va per família, tal com demana la metodologia.
- Respon la pregunta oberta d'EXTRACCIO §7.8(d): **quants municipis fan servir esPublico**. Es pot comptar sobre els PDF ja baixats, sense cap petició nova.
- També detecta la deriva de plantilla dins d'un mateix municipi (Vic, entre maig i juny del 2026): si l'empremta o el patró que encerta canvia, es genera un avís.
- Esforç **S**. Valor **mitjà-alt**.

### A6. OCR i idiomes

- **Detecció:** a més de la comprovació lèxica que ja hi ha, `pdffonts` ens diu si falta `ToUnicode` (font xifrada) i la proporció de caràcters per pàgina ens diu si està escanejada.
- **Alternativa:** `ocrmypdf --language cat+spa` (Tesseract) només sobre aquests documents, amb `text_origen=ocr` i **confiança màxima B** (el vot per OCR no és A sense revisió).
- **Mida del problema:** la mostra no va trobar cap escanejat en 43 actes (EXTRACCIO §2), però sí fonts xifrades (Palafrugell 2023). És petit, però sense alternativa aquests municipis queden muts en silenci.
- **Idioma:** vocabulari de vot en castellà («votos a favor», «abstenciones», «por unanimidad») a les regex de `ETIQUETA_SENTIT` i `UNANIMITAT`. L'aranès afecta 9 municipis de menys de 20.000 hab., fora de l'abast de J12: es pot ajornar. **No s'ha mesurat** quantes actes del tram ≥ 20.000 són en castellà; cal comptar-ho amb el detector.
- Esforç **S-M**. Valor **mitjà**.

### A7. Girona: certificats de moció amb vot per grup ★ (verificat)

- **URL:** `https://seu.girona.cat/cdn/dades/transparencia/mocions/mocio2025-036.pdf` (també `mocioentitat2025-018.pdf`). Patró `mocio{AAAA}-{NNN}.pdf` i `mocioentitat{AAAA}-{NNN}.pdf`.
- **Què és:** el certificat de la secretaria per a cada moció, amb el text íntegre i el resultat. Exemple verificat: ple del 14-04-2025, moció sobre Font de la Pólvora, «ha desestimat per majoria absoluta… amb vuit vots a favor del grup municipal PSC-CP», 16 en contra (Guanyem, JxCat, ERC-AM) i 1 abstenció (VOX).
- **Valor:** resol l'únic municipi de més de 100.000 hab. que avui no té cap vot (EXTRACCIO §2), i de passada dona **el text de la moció**, que les actes no sempre porten.
- **Advertiments:** el recompte del costat contrari pot sortir agregat («16 vots en contra» de tres grups). Es resol amb V4 (escons) i amb la deducció aritmètica de `posicions.ts`. També hi ha actes antigues senceres a `seu.girona.cat/export/sites/default/dades/actes_plenaries/_descarrega/` (2014, amb vot per grup).
- Esforç **S** (cal enumerar la seqüència NNN per any fins a trobar un 404). Valor **alt**.

### A8. Terrassa, L'Hospitalet i els altres absents

- **Terrassa (233.000 hab.):** continua sense cap via verificada (EXTRACCIO §6). El portal `governobert.terrassa.cat` publica plans i balanços (DD2-C3), però no s'han trobat actes recents des d'aquí. Recomanació: **sol·licitud formal** (o GAIP) de les actes del mandat en bloc. És més barat que vèncer un repte de Cloudflare i ho pot fer qualsevol persona. Esforç S de gestió, L tècnic. Valor alt.
- **L'Hospitalet (~280.000 hab.):** l'AOC només té extractes. La plataforma Decidim de la Diputació (`participa311-lhospitalet.diba.cat`) publica els **ordres del dia** del Plenari en PDF (verificat a la cerca: «OD Plenari 03 06 25»). No porten vot, però serveixen per enumerar els punts i es poden llegir per l'API GraphQL de Decidim (`/api`, només lectura, 100 peticions/minut, verificat). Per al vot, cal la mateixa via que a Terrassa. Esforç M. Valor mitjà.
- **Reus:** a més de l'AOC, té la plataforma de videoacta `serveis.reus.cat/actes/session/downloadItem/<id>` (verificat a la cerca). És una via de reserva si l'índex falla.

### A9. Vídeo dels plens: què es pot fer i què no

| Font | Estat | Ús proposat | Esforç / valor |
|---|---|---|---|
| **VideoActa / Àudio Vídeo Actes** (113 portals, 51 sondejats; EXTRACCIO §6) | JSON amb `topicsInfo` (punts) i `interventions` (orador i segon d'inici). El mòdul de votació arriba buit | (1) **Enllaç «veure-ho al vídeo»** a cada votació: es casa el `titol` del punt amb el `chapterMark` i es posa el segon d'inici. (2) **Control de recall** de `segmentaPunts`: punts del vídeo contra punts del PDF. (3) Cap cita literal surt del vídeo sense transcripció | M / mitjà-alt |
| **Acord marc de l'ACM 2024.03** (lots d'eCityclic i Telefónica, fitxes de maig 2025) | Les fitxes **inclouen el mòdul de votació** (secreta, ordinària, nominal i ponderada; a Telefónica, vot per regidor des de l'app SÉNECA VT). Cap no esmenta transcripció ni exportació oberta. Verificat: `acm.cat/wp-content/uploads/2025/12/Caracteristiques-lot-1-ECITYCLIC-SOLUTIONS.pdf` i `…lot-1-TELEFONICA…pdf` | Els ajuntaments que comprin per aquest acord poden començar a omplir `<votings>`. **Tornar a sondejar els 51 portals cada trimestre** buscant `votID≠0`: si apareix, seria vot nominal estructurat sense cap PDF | S (sonda) / alt si apareix |
| **YouTube dels ajuntaments** | L'API `captions.download` exigeix **permís d'edició del vídeo** (verificat a la documentació de Google). No es poden baixar els subtítols d'un vídeo d'un altre | Només enllaçar. Descartar la baixada d'àudio, que xoca amb les condicions de YouTube | — / baix |
| **Transcripció pròpia (ASR en català)** | Volum: 70 municipis × ~11 plens/any × 4 anys × ~3 h ≈ **9.000 h d'àudio** | Fora d'abast abans del 23-M. Fer-ho només en un pilot (Sabadell o Rubí) per a les cites de la capa 3 («posició declarada»), sempre amb enllaç al segon del vídeo | L / baix ara |

### A10. Model de llenguatge de reserva (només per finestres)

- Es passa al model **només la finestra de la votació** (≤ 3.000 caràcters, `extreuActa` ja la calcula) i **només** quan la regex dona C o falla V1/V4. La sortida ha de ser JSON amb esquema (Zod), i **la validació A3 s'aplica igual** a les files del model. El model no fa mai de jutge.
- **Volum estimat:** ~70 municipis × ~35 actes × ~15 votacions ≈ 37.000 finestres. Si en cal el 30 %, són ~11.000 crides d'uns 1.500 tokens d'entrada, és a dir **~17 M tokens** per passada completa. El preu s'ha de calcular amb la tarifa vigent, però és una fracció dels «380 M tokens» d'EXTRACCIO §7.5 per a actes senceres.
- Esforç **M**. Valor **mitjà-alt**, i el valor real el diu A4 (mostra revisada).

### A11. Esforç total del bloc A

| Paquet | Esforç |
|---|---|
| Correccions petites (A1: memòria cau negativa, sha256 i pàgina, Barcelona, execucions parcials) | S (1 dia) |
| Esquema i migració (A2) | M (3 dies) |
| Validadors i confiança (A3), oracle de Barcelona | M (2-3 dies) |
| Famílies de format (A5) i OCR/idioma (A6) | S + M (3 dies) |
| Cua de revisió (A4) i primera passada de revisió (~25 h de persona) | M-L (4 dies + 25 h) |
| Girona (A7) | S (1 dia) |
| Enllaç al vídeo (A9) | M (2-3 dies) |
| Model de reserva (A10) | M (2-3 dies) |
| **Total** | **~4-5 setmanes d'una persona** (més 25 h de revisió) |

---

## B. Dades electorals per secció i mesa (mapes dins de les ciutats grans)

### B1. Resultats per districte, secció i mesa al conjunt que ja fem servir ★★ (verificat)

- **On:** `https://analisi.transparenciacatalunya.cat/resource/ntc4-rnwr.json` (el mateix `DATASETS.resultats` de `adapters/socrata.ts:15`). J2 el filtra amb `id_nivell_territorial: "MU"` (`j2-results.ts`).
- **Què hi ha per a M20231:** `ME` (mesa) **104.120 files**, `SE` (secció) **60.612**, `DM` (districte) **6.400**, `MU` 3.564. Camps: `territori_codi` (INE5 amb zero, p. ex. `08015`), `districte`, `secci_` (sic, amb guió baix), `mesa`, `candidatura_codi/sigles/denominacio`, `agrupacio_*`, `vots`, `candidatura_color`.
- **Cobertura:** `count(distinct territori_codi)` amb `SE` = **947 per a M20231 i per a M20191**, i amb `ME` = **947 per a M20151**. Hi ha tres eleccions completes.
- **Coherència:** a M20231, la suma de `vots` és **2.955.549 als 8 nivells** (CA, PR, VE, CO, MU, DM, SE, ME). A Badalona, 88.929 a MU, DM, SE i ME. **No falta cap secció.** (VilaWeb va dir el 2023 que l'Interior no havia publicat algunes seccions de la Selva: aquí no passa.)
- **Participació per secció:** `irrv-2mfc` (el `PARTICIPATION_DATASET` de J5) té `SE` (5.115 files a M20231), `ME` (8.945) i `DM` (1.239), amb `cens_electoral`, `votants`, `abstencio`, `vots_nuls`, `vots_blancs`, `vots_valids` i els avanços de les 14 h i les 18 h. **Atenció:** aquí `territori_codi` ve **sense zero inicial** (`8001`) i `districte`/`seccio` sense farciment (`1`), mentre que a `ntc4-rnwr` van amb zeros (`08011`, `01`, `001`). Cal normalitzar abans de fer cap join.
- **Valor per al ciutadà:** «Què va votar el meu barri?». És la pregunta electoral més compartida (3Cat i VilaWeb en van fer mapes carrer a carrer el 2023), i a quivoto respondria amb les tres eleccions i la participació. Als 70 municipis de més de 20.000 hab. hi ha prou seccions perquè el mapa digui alguna cosa.
- Esforç **S** per a la ingesta (un job J2b amb les mateixes funcions). Valor **alt**.
- **Advertiments:** (1) Les **seccions canvien** d'una elecció a l'altra (es parteixen i es fusionen): les comparacions 2019→2023 per secció necessiten la capa de cada any, i un avís quan la secció no existeix a totes dues. (2) El **districte censal** no sempre coincideix amb el districte administratiu de la ciutat. A Barcelona sí (10); a la resta, cal dir «districte censal». (3) Mida de les dades: unes 170.000 files per elecció entre SE i ME. Cal desar-les en una taula pròpia, no a `municipality_metrics`. (4) Al municipi petit (1 secció, 1 mesa) no aporta res: s'ha d'amagar per sota de 3 seccions.

### B2. Geometries de les seccions censals: ICGC i Idescat ★ (verificat parcialment)

- **URL:** pàgina `https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Geoinformacio-cartografica/Seccions-censals` → descàrrega `https://datacloud.icgc.cat/datacloud/bseccen_etrs89/shp` (el lloc bloqueja els robots: **el llistat de fitxers no s'ha pogut veure**). WMS disponible. Especificació: `https://datacloud.ide.cat/especificacions/seccions-censals-v1r0-esp-01ca-20210414.pdf`.
- **Què:** capes anuals amb data de referència l'**1 de gener, del 2002 al 2025** (novetat de l'Idescat del 13-02-2026, `https://www.idescat.cat/novetats/?id=5469`). Format SHP, ETRS89. **Llicència CC BY 4.0** (ICGC i Idescat).
- **Alternativa estatal:** INE, «Cartografía digitalizada de secciones censales», SHP 2001-2025 en UTM30, i serveis WFS (`https://servicios.ine.es/arcgis/services/WFS_INE_SECCIONES_G01/MapServer/WFSServer`) i OGC API Features (`https://www.ine.es/geoserver/ogc/features/v1/collections`). La pàgina diu CC BY 4.0 o CC BY-SA 4.0 segons on es miri: cal confirmar la llicència. **Preferir ICGC**, que és la mateixa geometria de base que ja fem servir per als municipis (J1).
- **Quina capa per a cada elecció:** 2023-05-28 → capa 2023 (1-1-2023); 2019-05-26 → capa 2019; 2015 → capa 2015. Es comprova automàticament que cada `(municipi, districte, secció)` de B1 tingui un polígon (DD2-E10).
- **Valor:** el mapa de B1. Amb `mapshaper` es poden simplificar només els 70 municipis grans: uns quants centenars de kB per ciutat.
- Esforç **S-M** (inclou el patró de mapa per secció). Valor **alt**.

### B3. Ministeri de l'Interior: fitxers MESA (no verificat per al 2023)

- **Patró:** `https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/04AAAAMM_MESA.zip` (també `_MUNI` i `_TOTA`). Llistat de tercers (`github.com/JaimeObregon/infoelectoral`, `assets/municipales.txt`) verificat per al 1987-2019. **El fitxer del 2023 (`04202305_MESA.zip`) no s'ha pogut comprovar**: el lloc bloqueja els robots i el proxy no hi deixa fer `curl`.
- **Format:** fitxers `.DAT` d'amplada fixa (09 = mesa, 10 = vots per candidatura i mesa, segons el paquet R `infoelectoral`, que en treu `codigo_distrito`, `codigo_seccion`, `codigo_mesa`, `votos`).
- **Valor:** només com a **control creuat** (DD2-E2) i per a les eleccions anteriors al 2015, si mai calen. Per a 2015-2023, B1 és més fàcil i ja està normalitzat.
- Esforç M (parser d'amplada fixa) · Valor **baix** (redundant).

### B4. Renda per secció: ja la baixem i la llencem ★ (codi)

- **On:** `jobs/j23-riquesa.ts:52` i `:376-380`. El CSV de l'ADRH (INE) porta files de districte i secció, i J23 les **filtra** a propòsit («districte i secció no tenen ni ple ni alcalde»).
- **Proposta:** desar-les en una taula `seccions_indicadors` per creuar-les amb B1 («a les seccions amb renda més baixa, la participació va ser de X»). Cost marginal zero: el fitxer ja es baixa.
- **Advertiment:** l'ADRH tapa per secret estadístic les seccions petites, i la seva capa de seccions és la de l'any de la renda. Cal casar-les amb B2 de l'any corresponent.
- Esforç **S**. Valor **mitjà-alt** (context, no veredicte).

### B5. Barcelona: resultats per secció al seu portal (no verificat)

- `opendata-ajuntament.barcelona.cat`: la cerca CKAN retorna 4 conjunts `est-eleccions-*-seccio-censal` (generals, autonòmiques, europees i, pel nom de la cerca, locals: `est-eleccions-locals-seccio-censal`). La fitxa no s'ha pogut obrir.
- Té sentit com a **control creuat** de B1 per a Barcelona i per aprofitar la seva relació secció → barri (73 barris), que la Generalitat no dona.
- Esforç S · Valor baix-mitjà.

---

## C. Programes electorals: 2023 i com recollir els del 2027

### C1. No hi ha cap arxiu central del 2023 (verificat el que hi ha)

- **PADICAT** (Biblioteca de Catalunya), monografia «28M 2023»: **278 recursos** capturats entre el 16-05 i el 27-06-2023 (partits, candidats, institucions i mitjans) (`https://padicat.cat/en/node/9014`). No esmenta PDF de programes ni té cerca a text complet. Serveix per a casos puntuals, no com a font.
- **Wayback Machine (CDX API):** l'eina de cerca la bloqueja; **no s'ha pogut verificar res des d'aquí**. El mètode és conegut (`/cdx/search/cdx?url=<domini>/*&from=202304&to=202306&filter=mimetype:application/pdf`) i és la via més probable per als programes perduts.
- **Nació Digital, el banner de l'AOC, el BOPB:** només candidatures, cap programa (verificat).
- **Conclusió:** COMPLIMENT-VEREDICTE té raó, el 2023 no es pot reconstruir de manera sistemàtica. El que es pot fer és **un esforç acotat als municipis amb conjunt d'afirmacions**:
  1. Llista de candidatures del 2023 (ja la tenim, `xnfg-weec`).
  2. Domini de cada candidatura local (web del partit + `/<municipi>`).
  3. Consulta CDX per domini i finestra (abril-juny 2023) filtrant PDF i `programa`.
  4. Si no hi és, petició directa a la candidatura.
  - Mesurat a COMPLIMENT §4: a Sabadell només els dos partits petits conserven el programa. Esforç: ~30 min per candidatura amb CDX. Per a 10 municipis i ~60 candidatures, **M-L** (~30 h). Valor **mitjà** (desbloqueja el llindar de 5 cites de programa dels conjunts).

### C2. Programes del 2027: capturar-los el primer dia

| Pas | Com | Quan |
|---|---|---|
| Inventari | Per a cada candidatura proclamada (BOP del 28-04-2027): web i xarxes. Formulari de quivoto «envia'ns el programa» | Del 21-04 al 28-04-2027 |
| Captura | Baixar el PDF i desar `sha256`, URL, data i hora i capçaleres HTTP. **Demanar una còpia a Wayback** (Save Page Now) com a prova pública independent | Cada dia del 21-04 al 22-05 |
| Arxiu col·laboratiu | Enviar la llista d'URL a **PADICAT** perquè les inclogui a la col·lecció del 2027 (té una col·lecció electoral cada convocatòria) | Abril de 2027 |
| Classificació | Verificabilitat V1/V2/V3 congelada abans del 23-M (COMPLIMENT-VEREDICTE, «El que va al calendari») | Maig de 2027 |
| Esquema | Taula `programes(candidatura_id, url, sha256, data_captura, wayback_url, estat)` i `promeses(programa_id, num, text, pagina, verificabilitat)` | Febrer de 2027 |

- Esforç **M** per a la canonada (2-3 dies) i una persona dedicada les tres setmanes de campanya. Valor **alt**: és la «finestra única» que diu el veredicte.

### C3. El PAM (Pla d'Actuació Municipal) com a «què havien promès» del govern ★

- **Què:** molts municipis grans aproven un PAM o pla de mandat amb accions numerades, i alguns en publiquen el seguiment. Exemples verificats:
  - **Barcelona**, PAM 2023-2027 (`ajuntament.barcelona.cat/premsa/wp-content/uploads/2024/04/PAM2023-2027-Projecte-PAM-15ABRIL2024.pdf`).
  - **Terrassa**, «Pla Accions 2024-2027» (`terrassa.cat/documents/12006/45104157/...`) i el precedent «Balanç Pla Mandat juny 2019» (`governobert.terrassa.cat/.../Balanç_Pla_Mandat_Jun_2019_4_84.pdf`).
  - **Plataforma «Plans» de la Diputació de Barcelona**: `plans-<municipi>.diba.cat`. A Sant Joan de Vilatorrada, ~200 accions amb grau d'execució actualitzat cada sis mesos. A Barberà del Vallès, PAM 2023-2027 amb 262 accions, encara sense seguiment publicat. No s'ha trobat cap API (`/api` no respon).
- **Valor:** per a qui governa, el PAM és **més verificable que el programa** (és un document de govern, amb accions i sovint pressupost) i té **seguiment oficial**. Permet la frase «el govern va aprovar 262 accions; segons el seu propi balanç, n'ha acabat X». Sempre ha de quedar clar que és autoavaluació.
- **Cobertura:** desconeguda. Es pot mesurar amb l'ítem «Pla de mandat / PAM» del conjunt d'emplenament dels portals de transparència (`1a9c1ede…`, que ja tenim; FONTS-AOC). **Es mesura abans de decidir.**
- Esforç **M** (PDF heterogenis; començar pels 11 municipis de més de 100.000 hab.). Valor **alt** per al bloc «què ha fet el govern».
- **Advertiment:** no fer servir mai el PAM per jutjar l'oposició (COMPLIMENT §4, asimetria).

### C4. Les candidatures del 2023 en dades: oracle per a l'extractor del BOP

Vegeu DD2-D1. És la peça que fa que l'extractor de candidatures (F3-5) es pugui **provar amb el 2023 per a 311 municipis** sense etiquetar res a mà.

---

## D. Altres fonts municipals (cap no és a FON- ni a DAD-)

### D1. Candidatures a les eleccions municipals, Diputació de Barcelona ★★ (verificat)

- **URL:** fitxa `https://dadesobertes.diba.cat/datasets/candidatures-a-les-eleccions-municipals`. CSV `https://do.diba.cat/api/dataset/candidatures/camp-identificador_eleccio/M20231/format/csv` (respon amb contingut binari, probablement comprimit). Cal paginar amb `/pag-ini/1/pag-fi/6000`, perquè sense paginació es talla a ~1.000 files. Metadades CKAN `package_show?id=0f1049dd-5ca0-48a9-9fad-6ed7bd3ee189`.
- **Què:** les candidatures del **2015, 2019 i 2023** de cada municipi de la demarcació de Barcelona (311), tal com surten al BOPB (art. 47.5 LOREG): nom, partit, sigla, posició a la llista, suplent i independent.
- **Llicència:** **CC0**. Actualització irregular; la darrera, el 04-05-2023.
- **Valor:** (1) **Oracle** per provar l'extractor de BOP (F3-5) amb el 2023. (2) Molt probablement es tornarà a publicar el 2027 → **la font més barata de candidatures per a 311 municipis**, que tenen el 74 % de la població. (3) Control creuat amb `xnfg-weec` (DD2-E5).
- **Advertiment:** la fitxa avisa «Els recursos estan en fase de manteniment i temporalment no estaran disponibles». Cal **baixar-ne una còpia ja**, i preguntar a la Diputació si el 2027 el publicaran (i quan).
- Esforç **S**. Valor **alt**.

### D2. Dibaròmetre: enquesta de satisfacció amb el municipi ★ (verificat)

- **URL:** `https://dadesobertes.diba.cat/datasets/dibarometre-enquestes-de-valoracio-ciutadana`. Microdades `https://do.diba.cat/api/dataset/dibarometre/format/csv/pag-ini/1/pag-fi/1000` (paginat). Diccionaris `https://media-do.diba.cat/dibarometre/pro/dades/data_list_variables.csv` i `…data_list_valors.csv`. Visor `https://dibarometre.diba.cat/`.
- **Què:** percepció ciutadana del municipi, dels serveis, del bon govern, de la participació i de la transparència. **Edició 2.0 (desembre 2023 – desembre 2024): els 310 municipis de la província menys Barcelona.** Els 83 de més de 10.000 hab. tenen mostra pròpia (400 entrevistes a l'edició 1, per a 80 municipis el 2022). Els 227 petits estan agrupats. Inclou pes de ponderació.
- **Llicència:** CC0.
- **Valor:** «Què en pensen els meus veïns dels serveis?». És la **única dada d'opinió municipal comparable** que s'ha trobat. Hi ha dues onades, abans i dins del mandat.
- **Advertiments:** només la província de Barcelona; als municipis petits la mostra no és municipal; cal publicar sempre l'interval d'error (n ≈ 400 → ±4,9 punts). No és atribuïble al govern de manera directa.
- Esforç **M** (ponderació i diccionaris). Valor **mitjà-alt** per als 83 municipis de més de 10.000 hab.

### D3. Agenda política municipal (Diputació de Barcelona) (verificat)

- **URL:** `https://dadesobertes.diba.cat/datasets/agenda-politica-municipal`. CSV `https://opendata.diba.cat/export?dataset=actes_politics_municipals_historic`. API `https://opendata-api.diba.cat/`.
- **Què:** reunions dels electes amb grups d'interès i amb la ciutadania (art. 33 del Decret 8/2021). ~310 municipis hi apareixen, però **només els que ho han autoritzat**. Actualització diària. CC0.
- **Valor:** «Amb qui es reuneix l'alcalde?». Té valor de transparència, però la cobertura real (municipis amb dades i no buits) **s'ha de mesurar**: si és < 200, queda fora pel criteri de FON-.
- Esforç S · Valor **mitjà** (si la cobertura passa el llindar).

### D4. Sol·licituds d'accés a la informació (SAIP, Diputació de Barcelona) (verificat)

- **URL:** `https://do.diba.cat/api/dataset/saip/format/csv`.
- **Què:** cada sol·licitud d'accés feta a un ajuntament que fa servir SeTDIBA: tema, canal, dies de resposta, sentit de la resolució, motiu de denegació, reclamació a la GAIP. **32 municipis** a les metadades. CC0.
- **Valor:** «Quant triga a respondre l'ajuntament?». Complementa GAIP (FON-6.1). Cobertura baixa → **només marca positiva** («aquest ajuntament publica les seves sol·licituds»).
- Esforç S · Valor **baix-mitjà**.

### D5. Caixer mòbil (exclusió financera, Diputació de Barcelona) (verificat)

- **URL:** `https://dadesobertes.diba.cat/sites/default/files/public/recursos/files/dades_obertes_caixer_mobil_0.csv` (CC0, 27-11-2024).
- **Què:** més de 90 municipis sense oficina ni caixer que reben el caixer mòbil (una o dues vegades al mes).
- **Valor:** «Al meu poble hi ha banc?». Per a Girona, Lleida i Tarragona no s'ha trobat cap llista oberta equivalent (3Cat parla de «més de 450 pobles sense banc amb caixer mòbil» al conjunt de Catalunya). El Banc d'Espanya no publica oficines per municipi en obert (no verificat).
- Esforç S · Valor **mitjà** (rural) però **parcial** (només Barcelona).

### D6. Farmàcies per municipi (Generalitat) (verificat)

- **URL:** `https://analisi.transparenciacatalunya.cat/resource/nrmq-ytje.json` (Establiments sanitaris autoritzats; `tipus_establiment_codi='F'`).
- **Què:** 3.308 farmàcies amb `municipi_codi` (INE5), ABS i coordenades. **611 municipis en tenen almenys una**, i per tant **336 no en tenen cap**. Actualitzat el 21-10-2026.
- **Valor:** junt amb D7, la fitxa «serveis bàsics al poble» (farmàcia, escola, caixer, transport). No és competència municipal: s'ha de presentar com a context.
- **Advertiment:** és una foto. Si volem veure tancaments, cal fer captures periòdiques (com FON-2.2).
- Esforç **S**. Valor **mitjà**.

### D7. Escoles per municipi i any: obertures i tancaments ★ (verificat)

- **URL:** `https://analisi.transparenciacatalunya.cat/resource/kvmv-ahh4.json` (Directori de centres docents anual, base 2020). Sèrie anterior a `e2ef-eiqj` (2015-16 a 2019-20).
- **Què:** un registre per centre i curs, amb `codi_municipi_6`, naturalesa i ensenyaments. **Cursos 2020/21 a 2026/27**, amb 734-736 municipis i ~5.430 centres per curs (`count(distinct codi_municipi_6)` verificat).
- **Valor:** «S'ha tancat l'escola del poble?», «Hi ha llar d'infants pública?» (el 0-3 és **competència municipal**). Amb la sèrie es veuen els tancaments i les obertures del mandat. Uns 211 municipis no tenen cap centre.
- **Advertiment:** cal confirmar el nom del camp d'ensenyament de 0-3 (llar d'infants, `EINF1C` a l'esquema del Departament) abans de comptar llars municipals. Les ZER fan que una «escola» pugui ser una seu d'una escola rural agrupada: s'ha de dir.
- Esforç **S**. Valor **mitjà-alt**.

### D8. Cobertura de banda ampla per municipi (Ministeri) (verificat el catàleg)

- **URL:** `https://avance.digital.gob.es/banda-ancha/cobertura/Documents/Cobertura_BA_Espa%C3%B1a_2021-2024_MUN_PROV_CCAA_Nacional_datosgob.xlsx` (i `…2013-2020_ESP_MUN_PROV_CCAA_Nacional_datosgob.xlsx`). Fitxa: `datos.gob.es/en/catalogo/e05251701-…`.
- **Què:** percentatge de llars amb cobertura per tecnologia (FTTH, ≥ 100 Mbps, 4G, 5G) **per municipi**, 2013-2024. Des del 2021 es calcula per parcel·la cadastral. L'informe del 2025 (data 30-06-2025) encara no surt com a fitxer municipal al catàleg.
- **Valor:** «Al meu poble hi ha fibra?». Molt rellevant a la Catalunya rural. Respon la pregunta 1 (què és el municipi); el govern local no en té la competència, però sí capacitat de pressió.
- **Advertiments:** la llicència és l'avís legal de datos.gob.es (reutilització amb atribució, no CC). El fitxer 2021-2024 no s'ha obert (binari): **cal comprovar que hi ha 947 files catalanes**.
- Esforç **S**. Valor **mitjà**.

### D9. Transport públic per municipi (verificat parcialment)

- **GTFS d'autobusos interurbans de la Generalitat:** `https://analisi.transparenciacatalunya.cat/download/bca2-b4i3/application/zip` (mensual).
- **GTFS de Renfe Rodalies:** `datos.gob.es/es/catalogo/ea0003337-horarios-cercanias1`.
- **Indicador de l'Observatori de la Mobilitat:** `omc.cat/.../number-of-public-transport-services-per-municipality` («serveis de transport públic per municipi», font ATM, anual). No té descàrrega visible.
- **Què en traiem:** expedicions per dia laborable amb parada dins del polígon municipal (GTFS + geometria J1).
- **Valor:** «Com estic connectat?». És context, no competència municipal (excepte el bus urbà).
- Esforç **M**. Valor **mitjà**.

### D10. Participació ciutadana: portals Decidim i panel de polítiques locals ★ (verificat)

- **`efbr-3itw`** (Recull de portals Decidim de les administracions catalanes, actualització diària): **237 portals municipals**, amb URL, `codi_municipi` (6 xifres) i usuaris registrats.
- **`62wr-uxxx`** (Panel de Polítiques Públiques Locals de Participació, Fundació Carles Pi i Sunyer): onades del 2020, 2022 i 2024. **Al 2024 hi van respondre 545 municipis** (102 no), amb ~70 variables: existència d'òrgans, de processos (pressupostos participatius, POUM, habitatge…), reglament de participació, tècnic de participació, dotació pressupostària, plataforma.
- **API GraphQL de Decidim** (p. ex. `participa311-lhospitalet.diba.cat/api`, només lectura): processos, pressupostos participatius i resultats. La xarxa Participa311 de la Diputació té 127 plataformes (121 ajuntaments, 97 actius al 2024).
- **Valor:** «L'ajuntament fa pressupostos participatius? Quins projectes van guanyar i s'han executat?». El panel de 545 municipis respon el «sí o no» amb sèrie. Decidim dona el detall on n'hi ha.
- **Advertiment:** el panel és autodeclarat. Els 545 són sobre 947: es publica amb nota (dins del tram 200-600 del criteri → marca positiva, o comparable amb nota si s'hi afegeixen els 102 «no»).
- Esforç **S** (panel i inventari) + **M** (GraphQL dels pressupostos participatius). Valor **mitjà-alt**.

### D11. Biblioteques, esports i equipaments (verificat el catàleg)

| Font | URL | Cobertura | Valor / esforç |
|---|---|---|---|
| Enquesta de biblioteques (Generalitat), biennal, per municipi | `4bib-weqb` (no s'ha pogut consultar, error 4xx) | Tota Catalunya (metadades) | Préstecs i visites per habitant, despesa en biblioteca. M / mitjà. **Cal verificar** |
| Biblioteques municipals (Diputació de Barcelona) | `dadesobertes.diba.cat/datasets/biblioteques-municipals` | Província de Barcelona | Ubicació i horaris. S / baix |
| Equipaments esportius locals (Diputació de Barcelona) | `do.diba.cat/api/dataset/puntesports/...`, `.../puntesports_detall/...` (CC0, 18-10-2026) | Província de Barcelona | Inventari d'instal·lacions, gestor, tipus de gestió (directa o indirecta). S / baix-mitjà |
| Cens d'activitats GIA-DIBA | `txvw-xc3g` | Només municipis amb GIA | Comerç de proximitat. Baix |
| Urbanitzacions amb dèficits (Diputació de Barcelona) | `dadesobertes.diba.cat/datasets/cataleg-durbanitzacions-amb-deficits-de-la-demarcacio-de-barcelona` | Província de Barcelona | Un conflicte local real (Sant Fost, Bigues…). S / mitjà per als municipis afectats |
| Registre de serveis socials | `ivft-vegh` | Catalunya | Recursos per municipi (context). S / baix |

### D12. Fonts comprovades que **no** aporten, o que corregeixen la primera ronda

| Font | Conclusió |
|---|---|
| **Hermes (Diputació de Barcelona)** `indicadors-socioeconomics-hermes` | L'únic recurs obert és l'**EPA provincial** (`diba.cat/hg2/epa.asp?prid=1796`, modificat el 2021). No té indicadors municipals descarregables. **Descartada** |
| **CIDO, normativa local** (FON-§8 la deixava sense verificar) | **Només la demarcació de Barcelona** (verificat a la fitxa). Subjectes útils: «Pressupostos i plantilles» (85), «Ordenances fiscals» (104). CC BY 4.0. Serveix per a «el pressupost està prorrogat?» als 311 municipis de Barcelona; a la resta, no |
| **Diputacions de Girona, Lleida i Tarragona** | No s'hi ha trobat cap portal de dades propi amb conjunts municipals comparables. Publiquen via la plataforma de l'AOC (no verificat del tot) |
| **e-TAULER (edictes, AOC)** | No hi ha cap conjunt global obert. Cada ajuntament el publica pel seu compte. **Descartat** |
| **Declaracions de béns i interessos** | Només en PDF, a cada portal de transparència (Girona en té reglament propi). No són dades. La forma barata de mesurar **qui les publica** és l'ítem corresponent del conjunt d'emplenament de transparència (`1a9c1ede…`), que ja tenim. Privadesa: enllaçar, mai reproduir |
| **Plantilla / RLT** | No hi ha cap font oberta comparable (el CIDO «pressupostos i plantilles» és en PDF i només de Barcelona). **Descartat** |
| **YouTube (subtítols)** | Vegeu A9: l'API no ho permet |

---

## E. Controls de qualitat entre fonts (automàtics, a CI o al final de cada execució)

Cada control és una funció pura que retorna incidències amb `kind` i `severity` per a `data_issues` (amb el `run_id` de DAD-1.3). **Avui no se n'executa cap**, llevat del d'Hondt de J2 (E1).

| # | Parella | Regla | Tolerància | Gravetat si falla |
|---|---|---|---|---|
| E1 | Vots de `ntc4-rnwr` (MU) → d'Hondt contra els escons publicats | Ja hi és a J2. **Ampliar**: també contra `REGIDORS` de l'AOC (`3539f7e6…`) | 0 | alta |
| E2 | `ntc4-rnwr` MU contra el fitxer `04AAAAMM_MUNI.zip` de l'Interior | Vots per candidatura i municipi | 0 (avís si l'Interior hi té correccions posteriors) | mitjana |
| E3 | `ntc4-rnwr`: suma de ME = SE = DM = MU per municipi i candidatura | Verificat avui que quadra al total (2.955.549) i a Badalona | 0 | alta (bloqueja el mapa per secció) |
| E4 | `irrv-2mfc`: `vots_valids` per MU = Σ vots de candidatura + blancs a `ntc4-rnwr` | Cal normalitzar el codi (`8001` → `08001`) | 0 | alta |
| E5 | Electes de `xnfg-weec` (`electe=S`) contra els càrrecs de l'AOC `eb131bb1…` i de la Generalitat `m5nd-xjza` al principi del mandat | Recompte per municipi i partit. FONTS-AOC ja ho va comprovar a mà una vegada (942/947): **convertir-ho en test** | ≤ 5 municipis de diferència | mitjana |
| E6 | Candidatures de la Diputació de Barcelona (D1, M20231) contra `xnfg-weec` | Mateix nombre de llistes i de persones per municipi | 0 | mitjana (és l'oracle del BOP) |
| E7 | Alcaldia vigent: `2v2p-vu4h` (`data_baixa` buida) contra el càrrec «Alcalde/ssa» de l'AOC i contra el capçal de les actes (president de la sessió) | Mateixa persona (nom normalitzat) | 0 | alta (és dada de portada) |
| E8 | Padró: AOC `e0be5678…` contra Idescat (J18) contra INE | Mateix any de referència | 0 (INE i Idescat publiquen la mateixa xifra oficial); avís si AOC ≠ | mitjana |
| E9 | Liquidació: AOC per capítols `81f18313…` contra `ytva-5kp3` per àrees (totals) | FONTS-AOC diu «comprovat a l'euro»: fer-ne un test per any | ≤ 1 € | alta |
| E10 | Cada (municipi, districte, secció) de B1 té polígon a la capa ICGC de l'any de l'elecció | Join per codi | 0 | alta (mapa) |
| E11 | Deute AOC `34db8dc5…` contra el bessó de la Generalitat `c9ag-cye6` | Per municipi i any | 0 | mitjana |
| E12 | Votacions (A3, V2/V4): vots d'una votació ≤ `councilSeats`, i n per grup ≤ escons del grup | Contra `nm3n-3vbj` (composició dels plens) | 0 | alta (inversió de signe) |
| E13 | Barcelona: votacions de J16 contra J12 sobre els mateixos plens | Precisió i record de J12 | Llindars de la metodologia | **bloqueja la publicació del vot per grup** |
| E14 | Escons totals: `municipalities.councilSeats` contra la població (escala de l'art. 179 LOREG) | Taula legal | 0 | alta |

- **Implementació:** un mòdul `pipeline/src/checks/` amb un fitxer per parella, executat per `cli.ts checks`, i a CI amb fixtures petites (5 municipis). El resultat va al registre de cobertura (F2-4) com a segell «controls superats N/14».
- Esforç **M** (3 dies per a tots), **S** per a E3, E4, E7 i E14. Valor **alt**: són els errors que un periodista detecta primer.

---

## Top-12 prioritzat (mirant el 23-05-2027)

| # | Què | Ref. | Esforç | Valor | Termini |
|---|---|---|---|---|---|
| 1 | **Correccions petites de J12**: memòria cau negativa, desar `sha256` i pàgina, excloure Barcelona, no reescriure amb execucions parcials | DD2-A1 | S | Alt | **Novembre 2026** |
| 2 | **Resultats i participació per secció i mesa** (`ntc4-rnwr` + `irrv-2mfc`, 2015-2023) en una taula pròpia, amb E3/E4 | DD2-B1, E3, E4 | S | Alt | Desembre 2026 |
| 3 | **Candidatures de la Diputació de Barcelona 2015-2023: baixar-les ara** (avís de manteniment) i fer-les servir com a oracle del BOP; preguntar pel 2027 | DD2-D1, E6 | S | Alt | **Ara**, i oracle abans del **març 2027** |
| 4 | **Taules `votacions`, `vots_grup`, `assistencia`** i vista `mocions` compatible | DD2-A2 | M | Alt | Desembre 2026 |
| 5 | **Validadors V1-V10, confiança A/B/C i oracle de Barcelona** (mesurar per fi la precisió de J12) | DD2-A3, E12, E13 | M | Alt | Gener 2027 |
| 6 | **Girona: certificats de moció** | DD2-A7 | S | Alt | Desembre 2026 |
| 7 | **Suite de controls entre fonts** (E1-E14) a CI | DD2-E | M | Alt | Gener 2027 |
| 8 | **Mapes per secció als 70 municipis grans** (geometria ICGC de l'any de l'elecció + renda per secció de J23) | DD2-B2, B4, E10 | S-M | Alt | Febrer 2027 |
| 9 | **Cua de revisió humana** i primera passada (~25 h) | DD2-A4, A5 | M-L | Alt | Febrer-març 2027 (abans de publicar vot per grup) |
| 10 | **Canonada de programes del 2027** (captura el dia u, Wayback, PADICAT) i **PAM** dels 11 municipis de més de 100.000 hab. | DD2-C2, C3 | M | Alt | Esquema al **febrer**, captura del **21-04 al 22-05-2027** |
| 11 | **Serveis bàsics al poble**: escoles 2020-2027 (`kvmv-ahh4`), farmàcies (`nrmq-ytje`), banda ampla 2021-2024, caixer mòbil | DD2-D5 a D8 | 4 × S | Mitjà-alt | Març 2027 |
| 12 | **Participació**: panel de 545 municipis (`62wr-uxxx`) + inventari Decidim (`efbr-3itw`); Dibaròmetre per als 83 municipis de més de 10.000 hab. de Barcelona | DD2-D10, D2 | S + M | Mitjà-alt | Març 2027 |

**Fora del top-12, a la cua:** OCR i idioma (A6, S-M, abans de pujar el tram de població); enllaç al minut de vídeo (A9, M); model de reserva per finestres (A10, M, només si A4 diu que la regex no arriba); sonda trimestral de `<votings>` als portals de VideoActa (A9, S); L'Hospitalet per Decidim (A8); programes del 2023 per CDX (C1, ~30 h); agenda política i SAIP (D3, D4); transport (D9); biblioteques (D11, cal verificar `4bib-weqb`).

**Què no s'ha pogut verificar des d'aquí:** el fitxer `04202305_MESA.zip` de l'Interior; el llistat de fitxers de `datacloud.icgc.cat` (robots); el contingut dels CSV binaris de la Diputació (candidatures) i de l'XLSX de banda ampla; les consultes CDX de Wayback; la fitxa de resultats per secció de l'Ajuntament de Barcelona; `4bib-weqb`. En cada cas es dona l'URL perquè es comprovi amb `curl` des d'una màquina sense proxy.
