# Fonts noves per a quivoto — recerca del 26-10-2026

> Annex del [pla de millores](PLA.md). Al pla, les troballes d'aquest document es citen amb el prefix **FON-** seguit del número o codi de l'apartat (per exemple, FON-2.1). Les referències `fitxer:línia` són del commit `e53c589` i es poden haver mogut.

> **Abast.** Fonts obertes oficials amb granularitat municipal que **quivoto encara no fa servir**
> (ni a `packages/pipeline/src/adapters`, ni als jobs J1–J30, ni a `docs/FONTS-AOC.md` /
> `PLA-DADES-2027.md` / `FONTS-PERSONES.md`). Cada font s'ha comprovat amb una crida real
> (API de Socrata `analisi.transparenciacatalunya.cat`, API de taules de l'Idescat, catàleg de
> datos.gob.es, portal de la Diputació de Barcelona) el 26-10-2026. Les xifres de cobertura
> són recomptes (`count(distinct …)`) fets avui, llevat d'on diu «metadades» o «no verificat».
>
> **Limitació de la recerca.** Des del contenidor no hi ha sortida directa (curl) cap a aquests
> dominis; tot s'ha verificat via WebFetch. No s'ha pogut baixar cap fitxer sencer: les
> cobertures són de consultes SoQL agregades. **No s'ha modificat el repositori.**

## Què ja fa servir quivoto (per no repetir-ho)

AOC/seu-e (resultats 1979-2023, càrrecs electes, liquidació per capítols i per programes,
deute, PMP, padró, tipus impositius, cost efectiu, emplenament del portal de transparència,
cartipàs, ordenances, convenis, convocatòries, PSCP còpia AOC, Sindicatura 2023, sense
oposició del Síndic, actes), Generalitat Socrata (`2v2p-vu4h` alcaldes, `m5nd-xjza`/`nm3n-3vbj`
plens, `ntc4-rnwr`, `irrv-2mfc`, `xnfg-weec`, `x4tc-npww`, `6nei-4b44`, `ytva-5kp3`,
`8squ-bk4r`, `bepu-nr6b`, `2r5q-tsxs`, `qww9-bvhh` lloguer, `69zu-w48s` residus), Idescat
(EMEX només per enllaços, padró/censph a J18, RFDB a J23), INE ADRH (renda), ACA (preu aigua),
Idescat IBI, Ministeri d'Interior (criminalitat >20.000 hab.), ISPA (retribucions), Ajuntament
de Barcelona (retribucions, plenari), AMB, diputacions i consells comarcals (sous), Wikidata/
Commons, ICGC (geometria).

## Criteri aplicat (el de `FONTS-AOC.md` i `PLA-DADES-2027.md`)

- **Cobertura**: ≥900 → dada comparable; 600-900 → amb nota; 200-600 → només marca positiva;
  <200 → fora.
- **Respon una de les tres preguntes**: (1) què és el municipi, (2) què ha fet el govern,
  (3) qui són. Si no, no entra.
- **Sèrie** (comparar mandat 2019-23 amb 2023-27) i **atribuïbilitat** a una decisió municipal
  (o dir-ho clar si no ho és).
- Esforç: **S** (adaptador Socrata/Idescat existent, < 1 dia), **M** (nou parseig o join no
  trivial, 1-3 dies), **L** (PDF, scraping, matching difús, > 3 dies).

---

## 1. Diners que arriben a l'ajuntament i diners que reparteix

### 1.1 PUOSC — Pla Únic d'Obres i Serveis de Catalunya ★

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/v5fj-86q3.json |
| Què conté | Cada actuació subvencionada pel PUOSC: `any`, `codi_ens` (10 xifres, com el nostre), `ens_local`, `titol_actuacio`, `tipologia_obra`, `subvenci_puosc` (€), comarca i línies (impuls econòmic, equipaments, serveis…) |
| Cobertura | Files per any: 1996-2012 (680-1.596/any), **2020-2029** (2020: 442 · 2023: 459 · 2026: 450 · **2027: 568** · 2028: 728 · 2029: 415). Les convocatòries 2020-2024 i 2025-2029 ja estan adjudicades |
| Freqüència | Per convocatòria; darrera actualització 28-07-2026 |
| Format / llicència | Socrata JSON/CSV · condicions d'ús Generalitat (atribució) |
| A quivoto | Bloc 2, «Què ha fet aquest govern»: «En aquest mandat l'ajuntament ha obtingut X € del PUOSC per a N obres (pavimentació, equipaments…)». Comparat amb el grup de mida. I la llista d'obres previstes 2027-2029, que és el que heretarà el govern nou |
| Esforç / valor | **S / alta** |
| Caveats | És capacitat de **captar** inversió, no gestió de l'obra. Hi ha files amb `codi_ens` d'EMD i consells comarcals: filtrar per ajuntament. Imports subvencionats, no cost total de l'obra |

### 1.2 Fons de Cooperació Local de Catalunya (FCLC)

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/ka4a-fyht.json |
| Què conté | `nif`, `codi_10`, `ens_beneficiari`, `municipi`, `any`, `import`, `fclc_extraordinari` |
| Cobertura | Tots els ens locals que en reben (ajuntaments, EMD, consells, AMB); anual, fins al 2025 |
| A quivoto | Fitxa de finances: «transferència incondicionada de la Generalitat» per habitant, per entendre la part dels ingressos que no depèn de l'ajuntament |
| Esforç / valor | **S / mitjana** |
| Caveats | No és una decisió municipal; és context. Ja és dins del capítol 4 d'ingressos de la liquidació: usar-lo per explicar, no per sumar |

### 1.3 Deutes pendents de la Generalitat amb els ens locals

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/4w8y-gf8x.json |
| Què conté | Obligacions reconegudes pendents de pagament de la Secretaria de Governs Locals: `data`, `nifcreditor`, `nomcreditor` (Ajuntament de…), `tipusajut` (FCL, PUOSC…), `exercici`, `importnet` |
| Freqüència | Talls periòdics (darrera actualització 07-10-2026) |
| A quivoto | Context del PMP i la tresoreria: «la Generalitat li deu X € a data d'avui». Explica pobles petits amb tensions de tresoreria sense culpar el govern local |
| Esforç / valor | **S / mitjana** |
| Caveats | Lligam per NIF (P08xxxxx) → cal taula NIF↔`codi_ens` (la tenim a «Dades generals de l'ens» de l'AOC, camp `CIF`) |

### 1.4 RAISC — Registre de subvencions i ajuts de Catalunya (concessions) ★

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/s9xt-n979.json (convocatòries: `khxn-nv6a`) |
| Què conté | Cada concessió: convocatòria, `codi_bdns`, finalitat, `cif_beneficiari`, `ra_social_del_beneficiari` (persones físiques anonimitzades), `import_subvenci_pr_stec_ajut`, `data_concessi`, `administraci_` (Autonòmica / Local-Municipi / Local-Comarca / Local-Província…), `departament_o_entitat_local_d_adscripci_` |
| Cobertura | Convocatòries del 2024: 121.114 concessions atorgades per **municipis**, però de només **277 ajuntaments** concedents diferents (la resta publiquen directament a la BDNS). També permet veure què **reben** els ajuntaments (CIF P…) de la Generalitat i les diputacions |
| Freqüència | Diària (actualitzat 08-09-2026) |
| A quivoto | Bloc 2: «A qui dona diners l'ajuntament»: subvencions per finalitat (cultura, esport, social), concentració en pocs beneficiaris, subvencions nominatives a entitats. Pregunta de brúixola: «L'ajuntament hauria de repartir les subvencions per concurrència i no de forma directa?» |
| Esforç / valor | **M / alta** (volum gran: cal filtrar per `administraci_` i any al servidor) |
| Caveats | 277 concedents → només **marca positiva** si no es complementa amb la BDNS. Persones físiques no identificades (bé). Imports de convocatòria plurianual repetits per data de concessió |

### 1.5 BDNS — Base de Datos Nacional de Subvenciones (Infosubvenciones)

| | |
|---|---|
| URL | Portal: https://www.infosubvenciones.es/bdnstrans/GE/es/inicio · API REST: https://www.infosubvenciones.es/bdnstrans/doc/swagger · fitxa: https://datos.gob.es/es/catalogo/e05250001-base-de-datos-nacional-de-subvenciones |
| Què conté | Convocatòries i concessions de totes les administracions (estatal des del 2014, la resta des del 2016) amb òrgan concedent, beneficiari, import |
| Cobertura | Tots els ajuntaments obligats a publicar-hi (Llei 38/2003); cobertura real per municipi **no verificada** |
| Freqüència / format | Diària · JSON (API), CSV, XLSX |
| A quivoto | Igual que el RAISC però amb la cobertura que li falta. És la font de veritat per a les subvencions municipals |
| Esforç / valor | **L / alta** (identificar l'òrgan concedent «Ajuntament de X» per DIR3 i paginar l'API) |
| Caveats | Llicència no declarada a la fitxa de datos.gob.es (aplicar l'avís legal genèric RISP de l'IGAE, cal confirmar). L'API té límits de ràtio («Buenas prácticas API SNPSAP») |

### 1.6 Contractació pública: font canònica de la PSCP amb `codi_ine10`

| | |
|---|---|
| URL | Publicacions: https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json · Fase d'execució (modificacions, pròrrogues): `8idu-wkjv` · Registre públic de contractes: `hb6v-jcbf` |
| Què conté | `nom_ambit`, `nom_organ` («Ajuntament de Sabadell»), **`codi_ine10`**, `codi_dir3`, expedient, fase, objecte, enllaç, dates, imports i adjudicatari (a les fases d'adjudicació) |
| Cobertura | 800.825 publicacions d'«Entitats de l'administració local»; actualització diària (26-10-2026) |
| A quivoto | Ja era al pla «més endavant» via la còpia de l'AOC (`7448c675`, sense `CODI_ENS`). **Novetat**: el dataset de la Generalitat porta `codi_ine10` directament i té la fase d'execució (modificats i pròrrogues), que és on hi ha la notícia: «% de l'import adjudicat que s'ha modificat», «contractes amb una sola oferta», «principals adjudicataris del mandat» |
| Esforç / valor | **M / alta** |
| Caveats | Els contractes menors no hi són tots. Contractes d'empreses municipals amb òrgan propi: cal mapar òrgans → municipi. No confondre publicació amb contracte (una licitació té diverses publicacions) |

### 1.7 Compte general: qui ret comptes a temps (Sindicatura de Comptes)

| | |
|---|---|
| URL | Informe anual «Compte general de les corporacions locals», p. ex. Informe 29/2023 (exercici 2021): annex 4.3 amb la situació **de cada municipi** (tramès / complet). Portal: https://www.sindicatura.cat |
| Cobertura | 947 ajuntaments, un informe per exercici (2021 → publicat gener 2024; cadència anual, ~2 anys de retard) |
| A quivoto | Bloc 2, transparència: «Aquest ajuntament va retre el compte general del 2023 dins de termini / tard / no l'ha retut». Fet objectiu i 100 % atribuïble al govern |
| Esforç / valor | **M / alta** (parseig de PDF, un per any; 3-4 exercicis cobreixen el mandat) |
| Caveats | PDF, no dada oberta. Comprovar a cada informe que l'annex segueix l'estructura. El 2021 el 27 % dels ens locals no el van retre a temps: discrimina de debò |

---

## 2. Habitatge i territori

### 2.1 Indicadors territorials de l'Observatori del Territori ★★

| | |
|---|---|
| URL | 2023-…: https://analisi.transparenciacatalunya.cat/resource/8aaj-ypcb.json · sèrie 2017-2022: `b9cr-32i4` |
| Què conté | 77 camps per municipi i any: població i migracions; **habitatges acabats i HPO**, preu de lloguer; IST, renda, Gini; **places turístiques i habitatges d'ús turístic (nombre i per 100 hab.)**; composició del sòl i sòl urbanitzable romanent; **consum d'aigua per habitant**, **consum d'energia**, residus per hab./dia i % selectiva; **planejament general vigent i la seva antiguitat**, modificacions de POUM, autoritzacions en sòl no urbanitzable |
| Cobertura | **948 files/any (947 municipis + 1) el 2023 i el 2024**, tots els camps clau emplenats; amb `b9cr-32i4` hi ha sèrie des del 2017 |
| Freqüència / llicència | Anual · **Public Domain** (atribució «Observatori del Territori») |
| A quivoto | Una sola font per a quatre preguntes noves: (a) «Quants pisos turístics hi ha per cada 100 habitants?» (b) «Quina antiguitat té el pla urbanístic? (Normes subsidiàries dels anys 80 vs POUM recent)» — 100 % decisió municipal; (c) consum d'aigua domèstic per habitant; (d) sòl urbanitzable que queda. Brúixola: «Cal limitar els habitatges d'ús turístic?» |
| Esforç / valor | **S / alta** |
| Caveats | Alguns indicadors són biennals (cel·les buides). Agregats de fonts primàries (Registre de Turisme, ACA, ARC): citar l'Observatori **i** la font primària. Verificar que les sèries 2017-22 i 2023-24 tenen la mateixa definició abans d'unir-les |

### 2.2 Registre de Turisme de Catalunya (inclou habitatges d'ús turístic)

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/t2h3-cgys.json |
| Què conté | Cada establiment en alta: `tipus_establiment`, `n_mero_inscripci`, adreça, `codi_municipi_idescat`, `referencia_cadastral`, `total_places`, titular |
| Cobertura | **104.502 HUT en alta en 874 municipis**; hotels 3.222 (520 mun.), turisme rural 2.817 (629), càmpings 352 (184), llars compartides 1.457 (346) |
| Freqüència | Contínua (actualitzat 05-10-2026). Foto, no sèrie |
| A quivoto | Dada viva per a la fitxa (més fresca que 8aaj) i per al mapa: concentració de HUT. **Fer captures periòdiques** (mensuals) a partir d'ara per tenir variació fins al maig del 2027 |
| Esforç / valor | **S / alta** |
| Caveats | **Dades personals**: titulars persones físiques amb nom i cognoms → agregar per municipi i no republicar mai files. HUT il·legals no hi surten |

### 2.3 Àrees de referència en política d'habitatge (zones tensades)

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/fftm-v9b6.json |
| Què conté | Per municipi: àrea del PTSH (preferent/ADFA/rural), municipis d'intervenció/escassa demanda (impost d'habitatges buits), zona HPO A-D, obligació de PAC, **zona de mercat residencial tensat** (ZMRT 1: 140 municipis des del 16-03-2024; ZMRT 2: 131 des del 10-10-2024) |
| Cobertura | 947 |
| Freqüència | Variable (darrera: 14-02-2025) |
| A quivoto | Fitxa d'habitatge: «Aquest municipi és zona tensada des de…» al costat de la sèrie de lloguer (`qww9-bvhh`, ja la tenim). Brúixola: «Estàs d'acord amb la regulació del preu del lloguer?» amb el context de si s'hi aplica |
| Esforç / valor | **S / alta** |
| Caveats | La declaració la fa la Generalitat; si l'ajuntament la va demanar o no **no surt aquí** (caldria l'acta del ple: és material per a la brúixola). Nomenclatura de l'índex de la Llei 12/2023 |

### 2.4 Habitatges iniciats i acabats (lliures i protegits)

| | |
|---|---|
| URL | Totals anual 1990-…: https://analisi.transparenciacatalunya.cat/resource/txkt-yjtq.json · HPO anual 2002-…: `v8i4-fa4q` · trimestral 2000-…: `j8h8-vxug` |
| Què conté | Per municipi i any: `iniciats_totals`, `acabats_totals` / `iniciats_hpo`, `acabats_hpo`, amb `codi_ine` i `codi_idescat` |
| Cobertura | Una fila per municipi i any (2025 inclòs) |
| A quivoto | Bloc 2: «Quants habitatges protegits s'han començat aquest mandat, comparat amb l'anterior i amb municipis semblants?». L'HPO és en bona part decisió municipal (sòl, promoció pública) |
| Esforç / valor | **S / alta** |
| Caveats | Font: llicències i certificats de final d'obra; zeros freqüents en pobles petits → presentar per mandat (4 anys sumats), no per any |

### 2.5 Activitat urbanística de la DGOTU per municipi

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/tz88-gjtz.json |
| Què conté | Per municipi i any (des del 2013): expedients de sòl no urbanitzable (favorables/desfavorables, masies, interès públic), plans derivats nous i modificats, modificacions de planejament general, pla nou |
| A quivoto | «Quantes modificacions del POUM ha tramitat aquest govern?» Complementa l'antiguitat del pla (2.1) |
| Esforç / valor | **S / mitjana** |
| Caveats | Comptatges d'expedients, no superfície ni contingut; necessita explicació |

---

## 3. Feina, renda i context socioeconòmic

### 3.1 Índex socioeconòmic territorial (IST) — Idescat ★

| | |
|---|---|
| URL | https://api.idescat.cat/taules/v2/ist/14034/14994/mun/data (indicadors desagregats: taules `14036` i `14074`) |
| Què conté | Índex compost (Catalunya = 100) de 6 indicadors: ocupació, nivell educatiu, immigració, renda |
| Cobertura | **Tots els municipis** (comprovat també en un de 150 hab., Abella de la Conca), **2015-2024** (2024 provisional) |
| Freqüència / format | Anual (provisional + definitiu) · JSON-stat · condicions de l'API de l'Idescat (ja acceptades al projecte) |
| A quivoto | **Millora metodològica clau**: avui es compara «amb municipis de la seva mida». Afegir l'IST per definir «municipis semblants» (mida × IST) treu el biaix socioeconòmic de les comparacions de despesa, IBI i lloguer. També, una línia a «Què és aquest municipi» |
| Esforç / valor | **S / alta** (l'adaptador `idescat.ts` ja baixa taules `/mun/data`) |
| Caveats | No és una mesura de benestar ni de gestió; no presentar-lo com a rànquing. Provisional ≠ definitiu |

### 3.2 Atur registrat per municipi

| | |
|---|---|
| URL A (anual, recomanada) | Idescat EMEX: `https://api.idescat.cat/emex/v1/dades.json?id=<codi6>` → grups «Atur registrat per sectors / per sexe» (mitjanes anuals, 2025) |
| URL B (mensual, sèrie llarga) | SEPE «Paro registrado por municipio»: https://datos.gob.es/es/catalogo/ea0041513-paro-registrado-por-municipio → fitxers `https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/Paro_por_municipios_<any>_csv.csv` (2006-2026) |
| URL C (PDF mensual) | Observatori del Treball, «Atur per municipis» (p. ex. https://govern.cat/govern/docs/Atur%20per%20municipis%20202509.pdf), amb taxa d'atur registral |
| Cobertura | 947 (en pobles molt petits, valors suprimits o nuls) |
| A quivoto | «Què és aquest municipi»: atur registrat el maig 2023 vs darrer mes, comparat amb el grup. Pregunta del mandat, **no atribuïble** a l'ajuntament (dir-ho) |
| Esforç / valor | A: **S** · B: **M** · valor **mitjana-alta** (és el que la gent pregunta) |
| Caveats | Taxa d'atur «registral» ≠ EPA. El PDF de l'Observatori és CC BY-NC-ND: **no** usar-lo com a font de dades; usar EMEX o SEPE. Llicència del SEPE a datos.gob.es no explicitada (avís legal RISP) |

### 3.3 Afiliats a la Seguretat Social per residència — Idescat

| | |
|---|---|
| URL | https://api.idescat.cat/taules/v2/afi/8604/8704/mun/data (per sexe); hi ha 150+ taules (sector, nacionalitat, compte propi/aliè, temporalitat 10776, parcialitat 10777) |
| Cobertura | Municipal, **mensual des del 2020** (trimestral 2012-2019), darrer 09/2026 |
| A quivoto | Ocupació dels residents i la seva evolució de mandat; millor que l'atur en pobles petits |
| Esforç / valor | **S / mitjana** |
| Caveats | Arrodonit a múltiples de 5 des del 2022 |

### 3.4 Altres taules municipals de l'Idescat (no usades)

| Taula | URL API | Ús | Esforç/valor |
|---|---|---|---|
| Nivell d'estudis 25-64 anys (eep) | `taules/v2/eep/16211/19484/mun` | Context «Què és» | S / baixa |
| Projeccions municipals (base padró 2021, 3 escenaris) | `taules/v2/projm/16137` | «On anirà la població el 2030-2040?» Tots els municipis; edat detallada només ≥2.000 hab. | S / baixa-mitjana |
| Parc de vehicles, pensions, construcció, places turístiques (EMEX) | `emex/v1/dades.json?id=` | Context ràpid sense adaptador nou | S / baixa |

---

## 4. Energia i medi ambient

### 4.1 Instal·lacions d'autoconsum (RAC)

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/2b4s-skfm.json · producció agregada per municipi: `nex3-7nnw` |
| Què conté | Cada instal·lació: data d'inscripció i posada en servei, potència (kW), tecnologia, `codi_ine_municipi` |
| Cobertura | 2018-2025, ~139.000 instal·lacions; 904 municipis amb altes el 2023 |
| A quivoto | «Quanta potència d'autoconsum s'ha instal·lat per habitant aquest mandat?» Parcialment atribuïble (bonificació d'IBI/ICIO per a plaques — creuable amb ordenances fiscals) |
| Esforç / valor | **S / mitjana** |
| Caveats | Registre administratiu, amb retard d'inscripció (2025 encara incomplet) |

### 4.2 Consum d'electricitat i gas per municipi i sector (ICAEN)

| | |
|---|---|
| URL | Electricitat: https://analisi.transparenciacatalunya.cat/resource/8idm-becu.json · gas: `qvqg-zag8` |
| Cobertura | **947 municipis cada any 2020-2024** (sèrie des del 2013), per sector (primari, industrial, domèstic, serveis…) |
| A quivoto | Consum domèstic per habitant i tendència; context per a preguntes de transició energètica |
| Esforç / valor | **S / baixa-mitjana** |
| Caveats | No atribuïble; secret estadístic en sectors amb pocs clients |

### 4.3 Qualitat de l'aire — **descartada per a la fitxa**

`tasf-thgu` (automàtiques, 1991-…) i `qg74-87s9` (manuals): només municipis amb estació (unes desenes). Com a molt, marca qualitativa per a ciutats amb ZBE.

---

## 5. Serveis: educació, salut, social, seguretat viària, equipaments

### 5.1 Alumnes matriculats per centre i ensenyament

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/xvme-26kg.json · oferta de places: `vaht-2sjk` · mobilitat per estudis: `8w7y-2bfp` |
| Cobertura | Cursos 2015/16-2025/26; Educació infantil en 727 municipis, primària 725, ESO 292 |
| A quivoto | «Hi ha llar d'infants al poble? Quants infants 0-3 hi van?» (competència municipal: escoles bressol). Brúixola: «Cal ampliar places públiques 0-3?» |
| Esforç / valor | **M / mitjana** (cal separar 1r cicle d'infantil per `codi_ensenyament`/`nivell` i calcular taxa amb el padró per edat) |
| Caveats | El curs 2025/26 encara incomplet. Municipis sense centre → «no hi ha centre», no zero escolarització |

### 5.2 Accidents de trànsit amb morts o ferits greus

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/rmgc-ncpb.json |
| Què conté | Cada accident des del 2010: `nommun`, zona (urbana/interurbana), via, ferits, morts, tipus |
| Cobertura | ~1.200-1.700 accidents greus/any; darrer any **2023** (actualitzat 12-2024) |
| A quivoto | «Accidents greus en zona urbana per 10.000 hab., mandat vs mandat» (la via urbana és competència municipal) |
| Esforç / valor | **M / mitjana** |
| Caveats | Pocs casos per municipi → sumar per mandat i només per a ≥5.000 hab. Desfasat dos anys |

### 5.3 Equipaments de Catalunya

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/8gmd-gz7i.json (culturals: `48s6-82h2`) |
| Contingut | Tots els equipaments públics i privats geolocalitzats amb `codi_municipi` i `categoria` (ajuntaments, escoles, biblioteques, poliesportius, CAP…) |
| A quivoto | Inventari «què hi ha al poble» (biblioteca, piscina, CAP). Útil per al mapa, baix per a comparar |
| Esforç / valor | **M / baixa** |
| Caveats | Qualitat desigual de categories; no hi ha data d'obertura |

### 5.4 Serveis socials bàsics — **només per ABSS**

`fvnd-jbxf` (persones ateses), `qvkp-qkzs` (SAD), `n727-iuzr`, `jmq2-kiub`, `5ay8-u649`: nivell d'**àrea bàsica de serveis socials** (municipis >20.000 hab. + consells comarcals). Útil només per als ~65 municipis grans. **Valor baix**, esforç S.

### 5.5 Salut — **descartada per a la fitxa municipal**

Central de Resultats AP (`tt92-bngg`) i població RCA (`ftq4-h9vk`) són per ABS/EAP, no per municipi, i la salut no és competència municipal. Llistes d'espera: per hospital. Fora del filtre de les tres preguntes.

---

## 6. Transparència i bon govern

### 6.1 Reclamacions a la GAIP contra cada ajuntament ★

| | |
|---|---|
| URL | https://analisi.transparenciacatalunya.cat/resource/mpbu-t5zh.json |
| Què conté | Cada reclamació resolta: `administraci_reclamada` («Ajuntament de Seròs»), `tipologia_d_administraci`, data, informació reclamada, `sentit_de_la_resoluci` (estimada, desestimada, mediació…), temps, URL de la resolució |
| Cobertura | **9.564 reclamacions contra ajuntaments**, 1.261 administracions diferents, 2015-09 → 2026-07 |
| A quivoto | Bloc 2: «Quantes vegades la GAIP ha donat la raó a un veí contra l'ajuntament per no donar informació, aquest mandat?». Atribuïble, amb enllaç a cada resolució. Combina amb l'índex d'emplenament del portal (AOC) que ja tenim |
| Esforç / valor | **S / alta** |
| Caveats | Join per nom («Ajuntament de X»), cal normalitzar. Poques reclamacions per municipi: presentar recompte amb llindar i mai com a rànquing per a <200 municipis amb casos. Files duplicades CAT/CAST |

### 6.2 Comissió d'ètica, agendes i grups d'interès — **descartades per a ajuntaments**

`hd8k-y28e` (agenda d'alts càrrecs) i `gwpn-de62`/`fyya-wwrn` (Registre de grups d'interès) són de la **Generalitat**, no dels ajuntaments. Agendes municipals: 12-20 municipis (ja descartat a FONTS-AOC).

### 6.3 Índexs externs (Infoparticipa, Dyntra) — **no utilitzables**

- **Mapa Infoparticipa (UAB)**: avaluava els 947 webs municipals, però el domini `mapainfoparticipa.com` avui serveix una pàgina de spam (comprovat). Només queden notes de premsa amb la llista de segells (~93 ajuntaments el 2025). Fora.
- **Dyntra**: no s'ha trobat cap descàrrega oberta verificable per a ajuntaments catalans. Fora.

### 6.4 Síndic de Greuges i Oficina Antifrau — **sense dada oberta municipal**

No hi ha cap dataset (Socrata ni AOC) amb queixes per municipi; els informes per municipi existeixen només per als ajuntaments amb conveni (PDF «Informe VSS_<municipi>»). Antifrau: només memòries agregades. Fora.

---

## 7. Eleccions 2027: calendari i fonts de candidatures

### 7.1 Calendari (LOREG, calculat sobre el precedent del 2023)

El 2023 (eleccions el 28-05): decret al BOE el 4-04, candidatures del 19 al 24-04, proclamació el 2-05, campanya 12-26-05. Aplicant els mateixos terminis de la LOREG al **23-05-2027** (dates **a confirmar** quan surti el decret):

| Fita | Dia LOREG | Data prevista 2027 |
|---|---|---|
| Decret de convocatòria al BOE | −54 dies | **dimarts 30-03-2027** |
| Presentació de candidatures | dies 15-20 | **14 → 19-04-2027** |
| Publicació de les presentades al BOP | dia 22 | **21-04-2027** |
| **Proclamació** | dia 27 | **26-04-2027** |
| Publicació de les proclamades al BOP | dia 29 | **28-04-2027** |
| Campanya | dies 38-52 | **7 → 21-05-2027** |
| Darrer dia per publicar enquestes | −5 dies | 18-05-2027 |

### 7.2 Butlletins oficials de la província (font de les llistes)

| | |
|---|---|
| URL | BOPB (Diputació de Barcelona): https://dadesobertes.diba.cat/datasets/bopb-butlleti-oficial-de-la-provincia-de-barcelona — CC BY 4.0, diari des del 30-04-2015, RSS per emissor (inclou **«Administració electoral»**), metadades CKAN `api/3/action/package_show?id=a4464ce1-9e62-4941-86f2-c3968ff9448b` |
| Girona / Lleida / Tarragona | BOPG, BOPL, BOPT: **no s'ha verificat** cap API oberta; caldrà PDF |
| A quivoto | Les llistes completes de candidats (no només electes) per als 947, del 21-04 i del 28-04-2027. Imprescindible per a la fase «les dues columnes» |
| Esforç / valor | **L / alta** (PDF tabulars per circumscripció; 4 butlletins) |
| Caveats | **Assajar ara amb el BOP del 2023** (publicacions de ~25-04 i ~3-05-2023) per tenir l'extractor provat abans d'abril. Dades personals: nom i posició, sense DNI |

### 7.3 Ministeri de l'Interior — fitxers de candidats (després de les eleccions)

Els fitxers de resultats municipals de l'Interior (àrea de descàrregues d'infoelectoral, llegibles amb el paquet R `infoelectoral::candidatos("municipales", …)`) inclouen els candidats de totes les llistes. Útil per **validar** l'extracció dels BOP del 2023 i per carregar el 2027 després del 23-05. **M / mitjana.**

### 7.4 Enquestes (CEO, REO) — **descartades**

El Registre d'Estudis d'Opinió (`m5mb-xt5e`) i el baròmetre del CEO no tenen granularitat municipal (`mbit_territorial` = Catalunya). Només Barcelona té baròmetre municipal propi. No es pot fer res comparable.

---

## 8. Altres fonts comprovades, de valor baix o redundants

| Font | URL | Per què no (o no ara) |
|---|---|---|
| CONPREL (Hisenda) | https://serviciostelematicosext.hacienda.gob.es/SGFAL/CONPREL | Duplica la liquidació de l'AOC; l'únic afegit seria el **pressupost inicial 2026-2027** (detectar pressupost prorrogat). Accés i descàrrega no verificats. M / baixa |
| CIDO – Normativa local (pressupostos i plantilles publicats) | API `https://api.diba.cat/dadesobertes/cido/v1/normatives-locals` (CC BY 4.0, diària) | Alternativa per saber **si i quan** cada ajuntament va aprovar el pressupost. Les metadades diuen demarcació de Barcelona; cobertura de les altres 3 províncies no verificada. M / mitjana |
| Diba – Tècnics municipals, Pacte d'Alcaldes | https://dadesobertes.diba.cat/datasets/tecnics-municipals · …/municipis-adherits-al-pacte-dels-alcaldes-pel-clima-i-lenergia | Només 311 municipis (Barcelona). Pacte d'Alcaldes: marca positiva. S / baixa |
| Cadastre – estadístiques municipals | https://www.catastro.hacienda.gob.es/es-ES/estadisticas.html (Datos municipios, Urbana anual PC-Axis des del 2006) | El rebut d'IBI ja entra via Idescat (J19). Afegiria valor cadastral mitjà. M / baixa |
| Registre de convenis de la Generalitat | `exh2-diuf` | Ja tenim convenis de l'AOC (919 municipis) |
| Mossos – fets penals | `qnyt-emjc` | Nivell ABP/regió policial, no municipi. J29 (Interior, >20.000 hab.) és millor |
| Avaluació de 4t d'ESO | `59vm-wwq7` | Una fila per alumne, sense centre ni municipi (només «hàbitat»). Inservible per municipi |
| Centres de dia i residències | `yavr-pn8q` | Nivell comarca |
| Desnonaments (CGPJ) | — | Publicat per TSJ/província/partit judicial; no s'ha trobat granularitat municipal. Fora |

---

## 9. Top-15 prioritzat (valor ÷ esforç, i què ha d'estar llest abans del maig del 2027)

| # | Font | Pregunta que respon | Esforç | Valor | Termini |
|---|---|---|---|---|---|
| 1 | **Observatori del Territori** `8aaj-ypcb` (+ `b9cr-32i4`) | Pisos turístics/100 hab., antiguitat del POUM, aigua per hab. | S | Alta | **Desembre 2026** (fitxa tancada) |
| 2 | **IST Idescat** `ist/14034` | Definir «municipis semblants» (mida × IST) | S | Alta | **Desembre 2026** (canvia totes les comparacions; abans de congelar textos) |
| 3 | **PUOSC** `v5fj-86q3` | Quanta inversió ha captat el govern; obres 2027-29 heretades | S | Alta | Gener 2027 |
| 4 | **GAIP** `mpbu-t5zh` | Veïns que han guanyat a l'ajuntament per dret d'accés | S | Alta | Gener 2027 |
| 5 | **Zones tensades** `fftm-v9b6` | Context del lloguer + pregunta de brúixola | S | Alta | Gener 2027 (abans d'escriure conjunts d'habitatge) |
| 6 | **HPO iniciades/acabades** `v8i4-fa4q`, `txkt-yjtq` | Habitatge protegit del mandat vs anterior | S | Alta | Gener 2027 |
| 7 | **Registre de Turisme (HUT)** `t2h3-cgys` | Foto viva de pisos turístics; **començar captures mensuals ja** | S | Alta | Captura des de **novembre 2026** |
| 8 | **Atur registrat** (EMEX / SEPE) | Atur maig 2023 vs abril 2027 | S/M | Mitjana-alta | Darrera dada: **abril 2027** (publicada ~5-05-2027) |
| 9 | **PSCP canònica** `ybgg-dgi6` + `8idu-wkjv` | Modificats, ofertes úniques, adjudicataris del mandat | M | Alta | Febrer 2027 |
| 10 | **RAISC** `s9xt-n979` (i BDNS després) | A qui dona subvencions l'ajuntament | M (+L BDNS) | Alta | Febrer 2027 (RAISC); BDNS si hi ha mans |
| 11 | **Compte general (Sindicatura)** | Ret comptes a temps? | M | Alta | Febrer 2027 (informes d'exercicis 2022-2024) |
| 12 | **Candidatures als BOP** (BOPB API + PDF BOPG/BOPL/BOPT) | Qui es presenta | L | **Crítica** | Extractor provat amb 2023 **abans de març 2027**; en producció **21-04 i 28-04-2027** |
| 13 | **Autoconsum** `2b4s-skfm` | Transició energètica local | S | Mitjana | Març 2027 |
| 14 | **Afiliats per residència** `afi/8604` | Ocupació dels residents | S | Mitjana | Març 2027 |
| 15 | **Deutes Generalitat + FCLC** `4w8y-gf8x`, `ka4a-fyht` | Context de tresoreria (no culpar el govern local) | S | Mitjana | Març 2027 |

**Fora del top-15 però a la cua**: matriculació 0-3 (`xvme-26kg`, M), accidents greus (`rmgc-ncpb`, M), DGOTU (`tz88-gjtz`, S), consum elèctric (`8idm-becu`, S), projeccions (`projm`, S), CIDO pressupostos (M), equipaments (M).

### Calendari de fonts que es publiquen abans del 23-05-2027 (per no quedar-se amb dades velles)

- **Padró 1-1-2026** (Idescat/INE): previst desembre 2026 – gener 2027 → refrescar J18 i tots els «per habitant».
- **IST 2025 provisional**: durant el 2026-27 (comprovar calendari Idescat).
- **Liquidació 2025** (AOC): 827/947 avui; esperar ~940 cap al març 2027.
- **Lloguer Incasòl** (`qww9-bvhh`): trimestral, darrer abans de les eleccions ~abril 2027.
- **Residus 2025** (ARC): habitualment a final d'any.
- **Atur abril 2027**: primers dies de maig.
- **Registre de Turisme**: continu → captura final a mitjan maig.

### Recomanació transversal

Les set primeres fonts són **Socrata o Idescat amb `codi_ens`/`codi_ine`/`codi_idescat`**: totes entren amb el patró que ja existeix (`socrata.ts`, `idescat.ts`) i un job nou cadascuna. El 70 % del valor nou és a l'abast d'unes dues setmanes de feina. Les dues fonts difícils (BOP de candidatures i BDNS) són les úniques que tenen data límit dura o necessiten PDF: la de candidatures **no pot esperar** a l'abril.
