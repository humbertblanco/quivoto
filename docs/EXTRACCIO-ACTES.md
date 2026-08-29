# Extracció de vots de les actes de ple

Mesura empírica del 28-29 d'agost de 2026 per decidir si el registre de mocions de quivoto pot
dir "aquest partit va votar X" amb evidència documental.

## 1. Què hem mesurat i com

Sis agents en paral·lel sobre actes reals de l'índex obert de l'AOC (`dadesobertes.seu-e.cat`, recurs
`b5d370d0-7916-48b6-8a69-3c7fa62a1467`) i, quan l'ajuntament no hi és, del portal propi: **43 actes
de Ple de 18 municipis** en quatre trams de població; text amb `pdftotext -layout` i comptatge de
punts, votacions i desglossaments **a mà**, un per un. Dos agents més han inventariat la capa de
portals: cobertura AOC dels 947 municipis i **51 portals de vídeo-acta sondejats amb peticions reals**.

**Quina confiança se li pot donar.** Poca als percentatges, molta als fets qualitatius. 43 actes sobre
les ~24.000 del mandat és el 0,2% i **no és una mostra aleatòria**: cada agent va triar municipis que
publiquen bé i les actes més recents, i el biaix apunta a l'optimisme. Sí que és robust el catàleg de
formats i paranys, i el fet que **la unanimitat domina el municipi petit**. Avís: "% amb vot per grup"
no vol dir el mateix a cada tram — els agents van usar denominadors diferents.

## 2. El resultat, tram per tram

| Tram | Municipis | Actes | Actes amb vot identificat | Punts | Punts amb vot desglossat | Escanejades | Tokens/acta (cru) |
|---|---|---|---|---|---|---|---|
| >100.000 | Girona, Reus, Sabadell | 9 | 6/9 (**de fet 3/3/0**) | 210 | 114 (54%) | 0 | 93.694 |
| 20.000–100.000 | Rubí, Vic, Figueres, Tortosa | 12 | 12/12 | 242 | 128 (53%) | 0 | 57.453 |
| 5.000–20.000 | Torelló, Piera, Deltebre, Ripoll, Alcarràs | 10 | 10/10 | 152 | 71 (47%) | 0 | 70.652 |
| <5.000 | Vilalba dels Arcs, St. Julià de Cerdanyola, Pont de Molins, Vallfogona de Ripollès, St. Guim, Artesa de Segre | 12 | 7/12 | 115 | 30 (26%) | 0 | 24.824 |
| **Total** | **18** | **43** | **35/43** | **719** | **343 (48%)** | **0** | — |

- **Girona no publica actes**, publica "Acords adoptats en sessió": en 3 actes, **zero** ocurrències de
  "vots a favor", "abstenció", "unanimitat" o "votació". El 6/9 del primer tram és 3/3 Reus, 3/3
  Sabadell i **0/3 Girona**; des de 2024 els punts de Girona ni tenen títol.
- **"Acta amb vot identificat" ≠ "vot per grup extraïble"**: al tram 5-20k, 41 dels 71 punts desglossats
  són de Piera i donen **noms sense partit** (per grup: 30/61 = **49%**); al tram <5k el camp diu 7 actes
  de 12, però només **un** dels sis municipis (Vilalba) escriu el vot per grup, en 7 punts de 115.
- **Denominador honest**: molts punts no es voten (donar compte, precs). Tram 5-20k: 102 punts votats
  de 152; tram 20-100k: 166 votacions de 242 punts.
- **Zero PDFs escanejats en 43 actes**: no cal OCR. Els tokens són de `pdftotext -layout` cru, inflat
  per farciment d'espais (Deltebre ×4,5); amb espais col·lapsats el tram mitjà baixa a **39.722**.

**El fet que decideix el projecte:** al tram de menys de 5.000 habitants, **77 de 79 punts votats
s'aproven per unanimitat**, i en 12 actes només hi ha **2 votacions dividides**. No és un problema
d'extracció: no hi ha discrepància registrada. Amb extracció perfecta, poder discriminant zero.

## 3. Què vol dir per al projecte

**La brúixola basada en vots reals és viable a partir dels 20.000 habitants i parcialment entre
5.000 i 20.000. Per sota de 5.000 no ho és, i no ho serà amb aquesta font.**

| Àmbit | Municipis | Població | % població |
|---|---|---|---|
| ≥100.000 hab | 11 | 3.477.185 | 42,7% |
| ≥20.000 hab | 70 | 5.870.489 | **72,1%** |
| ≥5.000 hab | 218 | 7.356.075 | **90,3%** |
| <5.000 hab | 729 | 790.190 | 9,7% |

Amb 70 municipis ben resolts cobrim tres quartes parts de la població amb evidència de vot real; amb
218, el 90%. Els 729 restants són el 77% dels ajuntaments i el 9,7% de la població. **Pla B on no hi
ha vot desglossat**: no inventar posicions ni derivar-les del silenci, sinó tres capes amb l'etiqueta
de confiança visible a la interfície:

1. **Vot registrat** (alta): només on l'acta desglossa. Cita literal + enllaç al PDF i pàgina.
2. **Vot derivat d'unanimitat** (mitjana): "per unanimitat" + assistents = a favor dels grups presents.
   Exigeix extreure **sempre** assistents i absències, o s'atribueixen vots a grups que no eren a la
   sala. Al tram 20-100k recupera 38 votacions de 166 (23%).
3. **Posició declarada, no votada** (baixa): què porta cada grup al ple i qui ho presenta —extraïble
   arreu—, més programa 2027, intervencions de vídeo-acta i premsa local. Marcada com a *no verificada*.

Palanca per al tram petit: les **mocions supramunicipals de text idèntic** (la del menjador escolar
gratuït surt paraula per paraula a Artesa de Segre i a Sant Guim, presentada per ERC). Comparar
municipis sobre ítems idèntics és més sòlid que comparar partits dins d'un ple unànime.

## 4. Patrons d'extracció (per a J11)

### 4.0 Neteja prèvia — obligatòria, és el pas zero
El marge de signatura s'insereix **enmig de les frases de votació** i les parteix (`"vint vots a [CSV]
favor"`). Sense això el recall de Reus cau de 24-50 a 2-7. Esborrar també signants solts i dates òrfenes.
```regex
Aquest document ha estat signat electrònicament amb data \d{1,2}/\d{1,2}/\d{4}|L'autenticitat d'aquest document es pot comprovar a https://serveis\.reus\.cat/cve mitjançant el CVE: \w+
Document signat electrònicament des de la plataforma esPublico Gestiona \| Pàgina \d+ de \d+|Pàgina \d+ de \d+|^\s*Signat electrònicament$
El codi segur de verificació és \S+|Codi Validació:\s*\S+|Verificació:\s*https?://\S+|HASH:\s*[0-9a-f]{32}|Número:\s*\d{4}-\d{4}\s+Data:\s*\d{2}/\d{2}/\d{4}
\d+\.- [A-ZÀ-Ú ]+ \(SIG\), \d{2}/\d{2}/\d{4} \d{2}:\d{2}|Ajuntament de Sabadell · Plaça de Sant Roc[^\n]*\d+/\d+
(?<=[A-Za-zÀ-ÿ])f\s(?=[aeiouíìó])|(?<=\b)f\s(?=avor|onament|inal)   # Vallfogona: "vots a f avor"; a Sabadell, reunir el guionet partit per salt de línia
```
### 4.1 Inici / títol de punt — el coll d'ampolla real, més difícil que el vot. Recall ~89%
```regex
(?:^|\n|\s)(\d{1,2})\.\s+((?:Aprovació|Moció|Dació|Modificació|Elecció|Ratificació|Declaració|Resolució|Designació|Adhesió|Nomenament|Delegació|Precs)[^\n]{5,220}?)(?=\s+(?:El dictamen|La moció|D['’]acord|Antecedents|Vist|Atès|«))   # Sabadell
(?m)^\s*(?:-{2,6}\s*(?P<nf>\d{1,2})\.-\s+(?P<tf>[^\n]{5,120})|(?P<nt>\d{2})\s*[-–]\s+(?=[A-ZÀ-Ö]{3})(?P<tt>[A-ZÀ-Ö0-9'ÍÓÚÈÒÀÏÜÇ·,\.\-\(\)/–— ]{20,})|Expedient\s+(?P<exp>\d+/\d{4})\.\s*(?P<tv>[A-ZÀ-Ö][^\n]{5,})|(?P<nr>\d{1,2})\.\s+(?P<tr>[A-ZÀ-Ö][A-ZÀ-Ö0-9'ÍÓÚÈÒÀÏÜÇ·,\.\-\(\)/ ]{15,}))\s*$   # Figueres '---- 8.-' | Tortosa '07 – TÍTOL' | Vic 'Expedient 10281/2026.' | Rubí '8. TÍTOL'
(?m)^[ \t]*Expedient\s+(?P<exp>\d{1,5}/\d{4})\.\s*(?P<titol>.{10,300}?)[ \t]*$   # esPublico (l'expedient és clau estable entre convocatòria, acta i anuncis) i Absis/Aytos
(?m)^[ \t]*(?P<num>\d{1,2})[.\-](?P<sub>\d{1,2})?[.\-]{1,2}\s*(?P<titol>.{5,200}?)(?:\.-\s*(?P<accio>Aprovació|Ratificació|Donar compte)\.-)?[ \t]*$
```
**Paranys**: les llistes d'Antecedents reinicien a "1." i trenquen qualsevol comptador; a Alcarràs els
punts van desordenats; la variant de Figueres dona 133 falsos positius per acta si abans no s'exclou el
bloc de signatura. **Ancorar al bloc de votació, fiable, i pujar cap enrere fins al títol.**
### 4.2 Resultat global de la votació
```regex
[Ss]otmes(?:a|es|os|ès)\s+(?:l[a'’]|el|els|les)?\s*(proposta|moci(?:ó|ons)|urgència|assumpte|declaració|esmena|dictamen|punt)[^.]{0,60}?\s+a\s+votació\s*,?\s*(s['’]aprova|es rebutja|es desestima)   # Reus — obertura del bloc + sentit global
(?:el dictamen|la moció|la proposta|la urgència|l['’]esmena)\s+se\s+sotmet\s+a\s+votació\s+amb\s+el\s+resultat\s+següent\s*:?   # Sabadell — obertura (0 falsos positius en 75 votacions) i tancament (verificació creuada de la suma)
En\s+conseqüència,\s+(?:el\s+dictamen|la\s+moció|la\s+proposta|la\s+urgència)\s+(s['’]aprova|es\s+rebutja)\s+per\s+(unanimitat|majoria\s+absoluta|majoria\s+simple)
(?m)^[ \t]*(?P<sentit>Favorable|Desfavorable)[ \t]{2,}Tipus de votació:[ \t]*(?P<mod>Unanimitat/Assentiment|Nominal|Ordinària|Secreta)[ \t]*$   # esPublico Gestiona — les DUES ordenacions de columna; amb una sola es perden punts en silenci
(?m)^[ \t]*Tipus de votació:[ \t]*(?P<mod>[\wÀ-ÿ/]+)[ \t]*\n[ \t]*(?P<sentit>Favorable|Desfavorable)[ \t]*$
(?:Resolució:\s*)?A favor:\s*(?P<f>\d+),\s*En contra:\s*(?P<c>\d+),\s*Abstencions:\s*(?P<a>\d+)(?:,\s*Absents:\s*(?P<x>\d+))?   # esPublico — recompte agregat: el millor control de qualitat del corpus
(?i)(?:queda|queden|és|s['’])\s*aprovad?[ast]?\s*(?:la proposta\s*)?per unanimitat(?!\s*at[eè]s el resultat)   # Unanimitat sense desglossament (els 4 trams). El lookahead negatiu és imprescindible
S['’]ha\s+desestimat\s+la\s+proposta\s+següent\s*:   # Girona — l'ÚNIC senyal de resultat que existeix als seus documents
```
### 4.3 Vot per grup municipal
```regex
La votació dóna el següent resultat:\s*-?\s*Vots\s+a\s+favor:\s*:?\s*(?P<fav>(?:\d+\s*\([^)\n]{1,30}\)[,;\s i]*)*)-?\s*Vots\s+en\s+contra:\s*:?\s*(?P<con>(?:\d+\s*\([^)\n]{1,30}\)[,;\s i]*)*)-?\s*Abstencions:\s*:?\s*(?P<abs>(?:\d+\s*\([^)\n]{1,30}\)[,;\s i]*)*)   # Rubí — el més net: taula de tres files, 47/48 (98%). El ':?' cobreix una errata real de l'acta
(?:VOTS?\s+(?P<sentit>A\s+FAVOR|EN\s+CONTRA)|(?P<abs>ABSTENCIONS))\s*,\s*(?P<n>\d+)\s*:\s*(?P<grups>[^➢•\n]{2,200})   # Vic (plantilla juny 2026) — sigles per sentit, total en xifres. 77 blocs
(?P<num>[\wàèéíòóúïüç]+)\s+(?:vots?|abstenci(?:ó|ons))\s+(?:a\s+favor|en\s+contra)?[^.]{0,140}?corresponents?\s+als?\s+membres?\s+de\s+la\s+corporació\s+(?:dels?|del)\s+grups?\s+municipals?\s+de\s+(?P<grups>[^;.]{2,220})   # Tortosa — prosa amb recompte per grup entre parèntesis. 31 blocs. Sigles amb guionet llarg U+2013
(?m)^\s*Vots (?:a )?favor\s*:\s*(?P<favor>\d+|Cap)\s*(?:\((?P<gfav>[^)]*)\))?|^\s*Vots en contra\s*:\s*(?P<contra>\d+|Cap)\s*(?:\((?P<gcon>[^)]*)\))?|^\s*Abstencions\s*:\s*(?P<abst>\d+|Cap)\s*(?:\((?P<gabs>[^)]*)\))?   # Ripoll — 'Cap' és zero legítim; els noms de grup contenen comes: reconciliar amb llista tancada
(?:vots?\s+(?P<s1>a favor|en contra)|d.(?P<s2>abstenci[oó]))\s+d[e'’]?\s*(?P<grup>[A-ZÀ-Ú][A-Za-zÀ-ú\-]*(?:\s*-\s*[A-Za-zÀ-Ú]+)*)\s*\((?P<n>\d+)\)   # Deltebre — parells (sentit, sigla, recompte) en una línia sota el títol. 26 coincidències
(?P<n>\d+)\s+(?P<sentit>vots? a favor|m[eé]s|altres? positius?|en blanc|abstencions?|en contra)\s+d(?:e|el|els|’|')\s*(?P<grup>[A-ZÀ-Ú][A-Za-zÀ-ú\-\.]{1,25})   # Alcarràs — prosa lliure, vocabulari OBERT ("3 més de Junts" = a favor per anàfora)
amb els vots\s+(?P<sentit>favorables|en contra|d[’']abstenció|contraris)\s+del(?:s)?\s+grup(?:s)?\s+municipal(?:s)?\s+(?P<grup>[^()]{3,120}?)\s*\((?P<sigla>[^()]{1,25})\)\s*\((?P<n>\d+)\)   # Vilalba dels Arcs — únic patró per grup de tot el tram petit
en obtenir (?P<n>\d+) vots a favor \((?P<detall>[^)]{5,400})\)(?:[^.]{0,80}?(?P<nc>\d+) vots en contra \((?P<dc>[^)]{0,300})\))?(?:[^.]{0,80}?(?P<na>\d+) abstencions \((?P<da>[^)]{0,300})\))?   # Premià de Mar i Sant Adrià de Besòs (portals propis, §6)
(?P<sentit>Vots a favor|Vots en contra|Abstencions):\s*(?P<lletra>[\wàèéíòóú]+)\s*\((?P<n>\d+)\)\s*[–-]\s*(?P<grups>[^\n]{2,200})
```
### 4.4 Vot per regidor
```regex
(Sra?\.)\s+([A-ZÀÈÉÍÓÚÇÑ][^,]{2,60}),\s+(?:regidora?|Alcaldessa|Alcalde)(?:\s+del\s+grup\s+municipal\s+(?:de\s+|d['’]|del\s+)?([^,.]{2,70}?))?(?=\s*(?:Sra?\.|Vots|Abstencions|En conseqüència))   # Sabadell — crida nominal completa: 75/75 votacions (100%). 412 i 788 coincidències
\((?P<grup>[A-ZÀÈÉÍÓÚÇ0-9][A-ZÀÈÉÍÓÚÇ0-9\-–·\. ]{0,26}|regidor(?:a)? no adscrit(?:a)?)\)\s*:?\s*(?:Sr(?:a|es|s)?\.?/?)*\s*:?\s*(?P<noms>[^;()]{0,220})   # Reus — grup -> regidors dins de cada recompte
(?P<nom>[A-ZÀ-Ú][\wàèéíòóúïüç\.]+(?:\s+[A-ZÀ-Ú][\wàèéíòóúïüç\.]+){1,3})\s*\((?P<grup>[A-Z][A-Za-z0-9\-\s]{1,18})\)   # Vic (plantilla MAIG 2026) — nom complet AMB sigla: el format més ric del corpus
en\s+votar-hi\s+a\s+favor\s+(?:els?\s+|les?\s+)?(?P<num>[\wàèéíòóúïüç]+)\s+membres[^:]{0,60}:\s*(?P<noms>[^;.]{5,600})   # Figueres — nominal per cognom, recompte EN LLETRES, sense sigla. L'article és opcional
(?P<num>[\wàèéíòóúïüç]+)\s+(?:vots?\s+en\s+contra|abstenci(?:ó|ons))\s+(?:dels?\s+membres\s+electes\s+següents|del?\s+membre|de)\s*:?\s*(?P<noms>[^;.]{3,400})
Grup [Mm]unicipal(?:\s+d[e’'](?:l)?)?\s*(?P<grup>[^()]{2,60}?)\s*\((?P<regidors>[^)]{5,600})\)   # Torelló — grup I regidors alhora, separats per ';'
(?ms)^[ \t]*A favor[ \t]{3,}(?P<favor>.+?)^[ \t]*En contra[ \t]{3,}(?P<contra>.+?)^[ \t]*Abstencions[ \t]{3,}(?P<abst>.+?)^[ \t]*Absents[ \t]{3,}(?P<absents>.+?)(?=\n\s*\n)   # esPublico bloc nominal («---» = categoria buida) i Absis/Aytos (Pont de Molins, Vallfogona)
(?:Aprovat|Aprovada|S[’']apro(?:va|ven)|Es ratifica)\s+per\s+(?P<n>\d+)\s+vots?\s+a\s+favor\s*\((?P<noms>[^)]{5,600})\)
```
**Piera**: l'etiqueta de la cel·la es parteix verticalment (`A f/avo/r`, `A/fa/v/o/r`) i varia dins de la
mateixa acta. Cal `pdftotext -bbox-layout` i tallar per columna x (~90pt), no per línia.
### 4.5 Assistents i autoria de la moció
Sense assistents no s'interpreten ni les unanimitats ni les actes que donen només cognoms.
**Construir la taula per acta, no per municipi** (una regidora canvia de grup entre maig i juny).
```regex
(?m)^\s*(?P<carrec>Alcald\w+|President\w+|Regidor[a]?)\s{2,}(?P<nom>[^\n]{5,45}?)\s{2,}(?P<grup>[A-Z][A-Za-z0-9\-\s]{1,20})\s*$   # Columnes alineades (Rubí, Tortosa) i prosa (Figueres)
(?m)^(?P<nom2>[A-ZÀ-Ú][^,\n]{5,45}),\s*Grup Municipal de\s+(?P<grup2>[^\n.]{3,50})\.
(?i)\bmoci(?:ó|ons)\s+(?:conjunta\s+)?(?:de(?:l|ls)?|d['’])\s*(?:GRUPS?\s+MUNICIPALS?\s+)?(?P<autor>[^,.\n]{3,90}?)\s*(?:,|\s+(?:per|referent|relatiu|relativa|de\s+suport|sobre)\b)   # Autoria de la moció — NO sempre és un partit (a Sabadell: FAV, CCOO, un casal)
```
### 4.6 Set trampes verificades que condicionen l'esquema
1. **Un grup pot partir el vot** (Tortosa: MT–PSC–CP, 5 a favor i 2 en contra al mateix punt). L'esquema ha d'admetre **N files (grup, sentit, n_vots) per punt** des del dia u.
2. **El vot en blanc existeix** (Alcarràs, "5 en blanc del PSC"): cinquena categoria de sentit.
3. **El text narratiu menteix**: a Sant Julià un punt votat 3-1-0 tanca amb "El Ple per unanimitat ACORDA". **El bloc "Tipus de votació" mana sobre la narració.**
4. **Vocabulari de sentit obert** ("1 altre positiu de la CUP"): ho resol un LLM, no una regex.
5. **Recomptes en lletres** (Figueres, Tortosa, Sant Adrià): cal conversor de numerals catalans per validar sumes; sense això no es detecta una extracció truncada.
6. **Les sigles canvien dins del mandat** (Reus: ERC-AM 2023 → ERC 2025): àlies per municipi **i any**.
7. **La plantilla deriva dins del mateix ajuntament**: Vic va passar de vot nominal amb grup a llista de sigles **entre el 4 de maig i l'1 de juny de 2026**. Validació per acta, no per municipi, i alerta quan canvia la forma.

## 5. Ple contra Junta de Govern

**Es distingeix amb fiabilitat, però només pel capçal del document**: 100% d'encerts sobre les 43 actes.
El que **no** serveix: (a) **el nom del fitxer** — Tortosa no hi escriu mai "Ple" (`01842026-05-04 Acta
08 - O.pdf`), i a Piera 51 fitxers són només una data, un dels quals era una Junta de Govern; (b) **el
camp `TIPUS` de l'API AOC**, que només diu Ordinària/Extraordinària/Urgent, mai l'òrgan; (c) **un `grep`
global de "Junta de Govern"** — al cos d'actes de Ple hi surt fins a 9 vegades (Tortosa) perquè el Ple
ratifica acords de la JG, i classificaria malament 9 de 12 actes; a més "AJUNTAMENTS" conté "junta". El
que sí que funciona, ancorat a **inici de línia dins dels primers ~3.000-3.500 caràcters**, amb
precedència PLE > JG (JG només si JG coincideix i PLE no):
```regex
PLE = (?im)^[ \t]*(?:Òrgan[ \t]*:?[ \t]*Ple\b|ACTA[ \t]+DE[ \t]+LA[ \t]+SESSI[ÓO][ \t]+PLEN[ÀA]RIA|ACTA[ \t]+DEL[ \t]+PLE\b|ACTA[ \t]+DE[ \t]+SESSI[ÓO][ \t]+DEL[ \t]+PLE|PLE[ \t]+(MUNICIPAL|DE[ \t]+LA[ \t]+CORPORACI[ÓO])|PLN?/\d{4}/\d+|PLE\d{10})
JG  = (?im)^[ \t]*(?:Òrgan[ \t]*:?[ \t]*(?:La[ \t]+)?[Jj]unta[ \t]+de[ \t]+govern|ACTA[ \t]+DE[ \t]+LA[ \t]+JUNTA[ \t]+DE[ \t]+GOVERN|JGL?/\d{4}/\d+)
```
**Contaminació mesurada** al dataset AOC (nominalment només de Ple): 1-3% de Juntes de Govern (3/206
Torelló, 4/236 Deltebre, 6/189 Alcarràs, 5/247 Ripoll, 2 Tortosa, 4 Vic, 1/58 Girona, 2/35 Reus).
Filtrar sempre i **desar l'òrgan detectat com a camp de la BD**. L'índex també té duplicats de la
mateixa sessió (Girona, 2 i 3 còpies): deduplicar per CODI_ACTA i data.

## 6. Cobertura de fonts i ajuntaments amb adaptador propi

**L'índex AOC cobreix 855 dels 947 municipis (90,3%)**, amb 23.936 actes del mandat actual (des del
17-06-2023) i mediana de 27 per municipi. **92 no hi tenen cap registre** (>100k: 1; 20-100k: 2; 5-20k:
6; <5k: 83).

| Municipi | Hab. | Situació | Adreça | Viable | Com |
|---|---|---|---|---|---|
| Barcelona | 1.731.649 | **Resolt, i millor del que esperàvem.** CSV de totes les votacions del plenari: 814 propostes, 39 sessions, 07/2023–03/2026, columna per grup **i 41 per regidor**; 800/814 (98%) amb vot de grup. `part_acta` aïlla "D) Part d'impuls i control" (200 files, 198 amb vot) = el registre de mocions | `ajuntament.barcelona.cat/sites/default/files/votacions_plenari/votacions_plenari_mandat_actual.csv` | **Sí** | `curl` (200 OK, 1,3 MB). **CSV mal escapat**: el camp `text` conté `;` sense cometes i un `csv.reader` desalinea 242/814 files. Ancorar al primer camp amb forma dd/mm/aaaa, no per posició: hi ha files amb tres referències d'expedient dins del mateix camp, 55 per la dreta. Mandat 2019-2023 a la mateixa ruta. Desfasament ~5 mesos |
| Terrassa | 233.270 | **Sense resoldre.** Únic >100k absent de l'AOC. La seu està darrere d'un repte de Cloudflare (403 "Just a moment...") i no respon a `curl`; només hem recuperat actes de 2017 i 2019 via Wayback | `seuelectronica.terrassa.cat` | **Dubtós** | Cal navegador real o acord amb l'ajuntament. Té VideoActa amb índex de punts, sense votacions. Prioritat alta |
| Girona | 104.700 | **A l'AOC però inservible**: publica extractes d'acords, no actes; zero dades de vot | índex AOC (72 registres) | **No amb aquesta font** | Provar `sessions.girona.cat` (Acta Digital), sol·licitud de transparència, o substituir-la com a pilot |
| Sant Adrià de Besòs | 39.323 | Absent de l'AOC; publica al web propi (Plone). Les actes **desglossen per grup** | `www.sant-adria.cat/el-govern/ple-municipal/actes/<any>/` | **Sí** | Scraper de llistat per any + PDF. Patró a §4.3 |
| Premià de Mar | 29.431 | Absent de l'AOC; fitxa a seu-e.cat sense enllaços directes. Les actes **desglossen per grup amb recompte** | `premiademar.cat` | **Sí** | Scraper del portal propi. Patró a §4.3 |
| 89 municipis més | — | 83 de menys de 5.000 hab (Bigues i Riells, Solsona, Sant Fost, Centelles, Riudoms, Arbúcies…) | — | **Ajornable** | 9,7% de població i sense vot discriminant |

**VideoActa i plataformes de vídeo-acta.** Inventari de **113 portals actius** (22 "Portal de VideoActa™"
d'Ambiser, 85 "Àudio Vídeo Actes", 5 "Acta Digital"), **51 sondejats amb peticions reals**: **35 exposen
un índex de punts navegable** (1.745 punts amb títol i marca de temps), **32 marquen intervencions
individuals** (22.709) i **0 publiquen el mòdul de votació** — el format XML **té** un element
`<votings>` i un `votID` per punt, però arriba `<votings/>` buit i tots els `votID="0"`. Conclusió: **la
vídeo-acta no és una font de vots**, però sí la millor font d'ordre del dia estructurat i d'intervencions
per orador (capa 3 del pla B). Endpoints: `POST /session/fragmentCustom` amb el `sessionTypeId` de "Ple",
després `GET /session/sessionDetail/<id>`; l'XML porta `chapterMark`, `desc` i `originalOrder`.

## 7. Recomanació

1. **Canviar els pilots: Reus + Sabadell + Rubí, i treure Girona.** Reus i Sabadell desglossen el 100%
   de les votacions (Sabadell fa crida nominal, 75/75) i Rubí és el més **regular** (47/48, taula fixa);
   per a un pipeline la regularitat val més que la riquesa. Girona no diu qui va votar què.
2. **Programar primer el netejador de signatura i el classificador Ple/JG.** Pas zero literal: sense
   neteja el recall cau un 80-90%; sense classificador ingerirem un 1-3% de Juntes de Govern com si
   fossin plens. Cost baix, risc de no fer-ho molt alt.
3. **Fixar l'esquema de la BD abans d'escriure l'extractor**: N files (punt, grup, sentit, n_vots);
   sentit amb 5 valors (favor/contra/abstenció/blanc/absent); camps `organ`, `tipus_proponent` (grup |
   regidor | entitat) i `confianca` (registrat | derivat | declarat). Refer-ho després és car.
4. **Extreure sempre assistents i absències, per acta.** És el que converteix les unanimitats en dades
   utilitzables (23% de les votacions al tram 20-100k) i evita atribuir vots a grups absents.
5. **Parser per plantilla + LLM de reserva, segmentant abans d'enviar.** esPublico Gestiona i Absis/Aytos
   cobreixen molts municipis amb dos parsers. L'acta sencera a un model són ~380M tokens/any (40k × 10
   plens × 947); amb la finestra del punt, una fracció.
6. **Fer Barcelona ja, com a adaptador propi.** 21% de la població, ja resolt amb vot nominal, i serveix
   de **conjunt de validació daurat** per calibrar l'extractor de PDF contra dades oficials.
7. **Assumir el pla B als 729 municipis de menys de 5.000 habitants.** Amb 77 de 79 punts aprovats per
   unanimitat, insistir en el vot allà és llençar esforç.
8. **Què mesurar a continuació**: (a) **30 municipis aleatoris de 5.000-20.000 hab**, 2 actes cadascun
   —el tram frontissa, on el biaix de selecció és més gran— per validar el 49% de desglossament per grup;
   (b) **30 actes de 10 municipis de 20.000-100.000** a l'atzar, per confirmar el 77%; (c) **1 acta per
   any als 12 municipis ja analitzats**, per veure amb quina freqüència canvia la plantilla dins d'un
   mandat (Vic, canvi en quatre setmanes, és l'amenaça més seriosa); (d) **quants dels 947 municipis fan
   servir esPublico Gestiona**, que decideix si dos parsers cobreixen mig país o una desena part.


## Correccions posteriors

**29 d'agost de 2026.** Dues coses d'aquest document han quedat desmentides en implementar-lo,
i val més corregir-les que deixar-les:

1. **Barcelona no publica el vot de cada regidor**, com deia la taula. Publica el vot de cada
   **grup**: de 814 propostes, només una té les cel·les nominals plenes (41 cel·les nominals
   contra 4.800 de grup), i al mandat anterior aquestes columnes ni tan sols existeixen. Segueix
   sent la millor font que tenim i el conjunt de validació que buscàvem, però per grup.
2. **La descàrrega massiva d'actes no es farà.** El `robots.txt` de `media.seu-e.cat` prohibeix
   la ruta de l'acteca i el de `seu-e.cat` prohibeix les rutes d'actes de ple i el recurs del
   conjunt `agn-ag-actes-de-ple`. Aquest mateix projecte ja ho tenia anotat a
   [FONTS-AOC.md](FONTS-AOC.md) i ho vam passar per alt. Un projecte que demana als ajuntaments
   que siguin transparents no pot començar saltant-se el que aquests ajuntaments han dit que no
   volen: que una informació sigui pública no vol dir que se'n pugui fer una còpia massiva sense
   preguntar.

   El camí és demanar-ho. L'avís legal de seu-e preveu la «reutilització de documents prèvia
   sol·licitud» (art. 10 de la Llei 37/2007) i és una petició d'una pàgina. Fins que no hi hagi
   resposta per escrit, la feina `j12-actes` s'atura sola i només s'executa amb
   `QUIVOTO_ACTES_AUTORITZAT=1`.

   **Això no atura el projecte**: l'extractor està escrit i provat sobre les actes que ja teníem
   baixades per fer el calibratge, i Barcelona —el municipi més gran— té conjunt obert amb el vot
   de cada grup, que sí que és reutilitzable sense demanar res.
