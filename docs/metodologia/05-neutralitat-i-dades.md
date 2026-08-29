# Neutralitat, correccions i dades personals

> **Estat a 29 d'agost de 2026.** Aquest document descriu el mètode que aplicarem. D'això,
> avui està implementat: les dades del titular legal, l'allotjament i els dominis (secció 1);
> la paleta de la interfície, a `web/public/assets/styles.css`, aplicada a la landing; el
> formulari d'avís de la portada i el seu tractament de dades personals
> (`web/public/api/subscribe.php` i `api/lib.php`), que és l'únic tractament realment en
> producció; el tractament de les posicions «sense dades» dins del càlcul de coincidència
> (`packages/shared-schemas/src/matching.ts`, 14 tests); i les dades obertes ja ingerides
> (947 municipis, 10.788 candidatures de 2015, 2019 i 2023, participació, 11.873 alcaldies
> des del 1979 i el recompte de 25.902 actes a l'índex de l'AOC).
> La resta —el registre públic de canvis, el circuit de reclamacions, la publicació de dades
> de regidors i candidats, el test i la seva privadesa, l'analítica i els fitxers oberts— és
> compromís, no descripció. Ho marquem secció a secció.

El compromís públic de quivoto i la lletra petita, en un sol lloc: qui hi ha darrere, com
corregirem els errors, què podrà reclamar un partit, quines dades personals publicarem i
quines no, què passarà amb les teves respostes i amb quina llicència reutilitzem i publicarem
dades. **Encara no s'ha publicat cap municipi amb brúixola**: avui hi ha el mètode i les dades
obertes ja ingerides.

Les altres peces del mètode: [afirmacions](01-afirmacions.md), [posicions](02-posicions.md),
[actes i mocions](03-actes-i-mocions.md), [coincidència](04-coincidencia.md). Darrera
actualització: 29 d'agost de 2026; els canvis d'aquesta pàgina aniran al registre públic quan
el registre existeixi (secció 3).

## 1. Qui hi ha darrere

> ✅ **Implementat.** Les dades d'aquesta taula són les del titular legal i les del servidor
> on corre el portal; el contacte hola@quivoto.cat funciona i és el mateix que declara
> [quivoto.cat/privadesa.html](https://quivoto.cat/privadesa.html).

| | |
|---|---|
| Titular legal | Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern |
| Contacte general | hola@quivoto.cat |
| Allotjament | servidor a OVH SAS (França, UE), gestionat per estic.online |
| Dominis | quivoto.cat (català) i quienvoto.es (castellà) |

quivoto no està vinculat a cap partit, candidatura, grup municipal ni administració. Cap
càrrec electe, càrrec de confiança ni persona afiliada a un partit decideix sobre el
contingut publicat.

Avui el projecte el fa un equip molt petit i les decisions editorials no estan repartides
entre diverses persones. *(Proposta, pendent de confirmar: publicar en aquesta mateixa
secció el nom i el càrrec de la persona responsable editorial i la llista de qui revisa, i
signar cada aprovació amb nom i cognom en comptes d'inicials, tal com preveu
[02-posicions.md](02-posicions.md).)*

### Compromís de finançament

1. **No acceptem diners, serveis ni espècie de partits, candidatures, grups municipals,
   fundacions de partit ni de càrrecs electes o de confiança.** Ni publicitat, ni
   patrocini, ni «col·laboració».
2. No acceptem pagaments a canvi de tractament, ordre, destacats o correccions. Respondre
   el qüestionari i replicar serà gratuït i no donarà cap avantatge de posició.
3. Tot ingrés superior a 1.000 € l'any es publicarà aquí amb import, procedència i data.
   *(Proposta, pendent de confirmar: llindar i periodicitat.)*

**Avui (29-08-2026)** el projecte està finançat íntegrament pel titular legal, sense
ingressos externs, i no hi ha hagut cap ingrés a publicar. El cost dominant serà la lectura
automàtica de les actes i la inferència de posicions: 10.000–18.000 $ per a la primera
passada sobre els 855 municipis amb corpus. Aquesta despesa encara no s'ha fet: cap acta
s'ha descarregat ni s'ha llegit. *(Proposta, pendent de confirmar: si s'obren donacions,
subvencions a projectes periodístics o convenis amb mitjans locals, i amb quines
incompatibilitats.)*

**Què passa si s'acaben els diners.** És una possibilitat real i val més dir-ho abans que
després. Els compromisos, si arriba el cas:

- El que ja s'hagi publicat en obert (secció 8) queda publicat: el bolcat de dades no es
  retira ni es tanca darrere d'un pagament, i n'hi haurà una còpia amb la mateixa llicència.
- Queden descartades per sempre tres sortides: la publicitat de partits o candidatures, la
  venda o cessió de la llista de correus i qualsevol pagament per posició, ordre o
  destacat. Vendre el portal a un partit, a una fundació de partit o a un càrrec electe
  també.
- Si el projecte s'atura abans del maig del 2027, ho direm al portal amb data, publicarem
  l'últim bolcat complet i no deixarem el lloc en peu fingint que està actualitzat.

*(Proposta, pendent de confirmar: la forma jurídica d'aquest compromís i qui custodiaria el
bolcat.)*

## 2. Tractament visual neutral

> ⏳ **Encara no construït, excepte la paleta.** Els colors i la tipografia són a
> `web/public/assets/styles.css` i s'apliquen a la landing. La interfície del test, els xips
> de dades, la barra de coincidència, l'hemicicle i els gràfics no existeixen. El que segueix
> és el criteri de disseny que aplicarem quan els construïm, i es podrà comprovar el dia que
> es publiqui el primer municipi.

La neutralitat també és una decisió de disseny, no només editorial.

- La interfície farà servir **només la paleta de quivoto**: paper `#FBF7EE`, tinta `#1E1B2E`,
  coral `#E2735A`, menta, lavanda i préssec. Cap no és el color d'un partit català.
- Els **colors oficials de les candidatures** (PSC `#D00C3C`, Junts `#00c3b2`, ERC
  `#ffb232`, Comuns `#662483`, PP `#234b90`, Vox `#00c118`, CUP `#ffff00`…, tal com els
  publica el fitxer oficial de resultats) s'usaran **només com a marca de dades**: xip de
  26 px, extrem de la barra de coincidència, hemicicle, aranya i marcadors dels gràfics.
  Mai com a fons, capçalera, botó ni color d'accent.
- **Acord i desacord no seran verd i vermell**: serà una rampa de tinta amb les expressions
  de la mascota. El verd i el vermell són colors de partit i exclouen qui té daltonisme.
- **Ordre**: els partits, per vots a les municipals del 2023 al municipi, i es dirà
  explícitament sota la llista; les candidatures noves al final, alfabèticament; els
  candidats, per posició a la llista. Al resultat del test l'ordre el decidiràs tu.
- Els logotips mai més grans que el xip de dades: cap candidatura tindrà més superfície
  visual que una altra. Cap adjectiu editorial acompanyarà un nom.

## 3. Correccions

> ⏳ **Encara no construït.** No hi ha cua de correccions, ni taula on desar-les, ni les
> rutes `/canvis` i `/m/{municipi}/canvis`: `web/public/` són vuit pàgines estàtiques (quatre en català i quatre en castellà), tres
> punts d'entrada PHP del formulari de correu i, des del 29-08-2026, els esborranys de
> `proves/`; el
> `sitemap.xml` no en llista cap més. Avui l'única via operativa per avisar d'un error és
> **hola@quivoto.cat**, i és una bústia de correu, no un circuit. Tot aquest apartat és un
> compromís que es podrà comprovar quan es publiqui el primer municipi.

Publicar 947 municipis a partir de 25.902 actes en PDF vol dir que hi haurà errors. La
pregunta no és si n'hi haurà, sinó què farem quan apareguin. **Terminis** que ens
comprometem a complir des del primer municipi publicat *(proposta, pendent de confirmar amb
el volum real de la bústia)*:

| Tipus | Confirmarem recepció | Resoldrem |
|---|---|---|
| Error material evident (nom, data, enllaç trencat, xifra) | 24 h | **72 h** |
| Vot d'un grup mal extret d'una acta | 3 dies feiners | **10 dies feiners** |
| Discrepància sobre una posició inferida | 3 dies feiners | **10 dies feiners** |
| Retirada d'una foto | — | **48 h, sense preguntar res** |
| Drets RGPD (accés, rectificació, supressió) | 72 h | 1 mes (màxim legal) |
| Qualsevol dels anteriors, en campanya (27-04-2027 → 23-05-2027) | 24 h | **72 h** |

**Mentre revisem**, la dada en disputa seguirà visible amb la insígnia «En revisió» i la
data de la reclamació. Si la reclamació ve amb prova documental adjunta, la posició quedarà
suspesa automàticament; si no en porta, decidirem en 72 hores amb una explicació escrita, i
publicarem el comptador de reclamacions suspeses i rebutjades en aquesta fase preliminar, no
només les resoltes. Una posició suspesa no comptarà al càlcul de coincidència, en comptes de
quedar-s'hi amb un valor que potser és fals, però **no podrà fer baixar la cobertura de la
candidatura que reclama**: reclamar contra una dada no pot fer que la teva candidatura caigui
al calaix «Dades insuficients». Això últim encara no ho sap fer el codi: a `matching.ts` la
cobertura és `known / answered` i una posició tractada com a `no_data` la baixa. Canviar-ho
és una de les feines pendents abans de publicar el primer municipi. No esborrarem res en
silenci.

**Registre públic de canvis**: hi haurà un registre a `/canvis` (i `/m/{municipi}/canvis`),
amb RSS: tipus, data, municipi i el diff (afirmació afegida o reformulada, posició
actualitzada, resposta d'un partit, candidat afegit, correcció aplicada, font retirada). El
comptador «N correccions aplicades» serà públic i no es reiniciarà mai. Hi haurà un enllaç
«Informa d'un error» a cada posició, cita, foto i fet, que anirà a la mateixa cua que faci
servir la redacció. Aquestes rutes no s'anunciaran enlloc fins que responguin.

## 4. Reclamacions d'un partit o d'una persona

> ⏳ **Encara no construït.** No hi ha formulari a `/reclamacions`, ni número d'expedient, ni
> registre de resolucions, ni cap bústia específica. **Avui l'única adreça operativa és
> hola@quivoto.cat**, i no n'anunciarem cap altra fins que estigui creada i rebi correu.

Quan el circuit estigui obert hi haurà un formulari a `/reclamacions`; mentrestant, i també
després, es podrà escriure a **hola@quivoto.cat**.

El formulari demanarà municipi, què es reclama (posició, vot, cita, foto, dada personal),
què n'és incorrecte, què hi hauria de dir i **quina prova documental ho sosté** (acta,
acord, programa, nota de premsa, enllaç, PDF). Sense prova també s'admetrà, amb el termini
llarg. Procediment:

1. Acusarem recepció amb un número, i una persona diferent de qui va aprovar la dada la
   revisarà contra la font primària.
2. Resolució: **corregim** (queda al registre de canvis, citant la reclamació com a
   origen), **mantenim** amb explicació escrita, o **matisem** (context o menys confiança).
3. Si mantenim la dada i el partit hi continua en desacord, tindrà **dret de rèplica**: un
   comentari públic seu, signat, al costat de la posició. No l'editarem; només l'acotarem en
   longitud. *(Proposta, pendent de confirmar: 600 caràcters.)*
4. Les reclamacions resoltes es publicaran agregades (nombre, tipus, temps mitjà, quantes
   van acabar en correcció), sense el text de la reclamació.

Res d'això dependrà que el partit hagi respost el qüestionari: el dret de rèplica sobre una
posició inferida serà de tothom, hagi participat o no.

**Requisit de llançament.** No publicarem posicions inferides de cap municipi fins que
tinguem tres coses fetes, i no com a proposta sinó com a condició per obrir:

1. la bústia de reclamacions i el formulari de `/reclamacions` funcionant i responent;
2. la fitxa prèvia de cada candidatura enviada a la candidatura mateixa, amb les posicions
   que li atribuirem i les cites que les sostenen;
3. un termini mínim de resposta abans de la publicació pública. *(Proposta, pendent de
   confirmar: 15 dies.)*

Publicarem la data d'enviament de la fitxa de cada candidatura al costat del municipi, de
manera que es pugui comprovar que el termini s'ha respectat.

## 5. Dades personals de regidors i candidats

> ⏳ **Encara no construït.** El portal públic no publica avui cap fitxa de persona: la base
> de dades té candidatures, mandats i alcaldies ingerits de fonts oficials, però no hi ha
> pàgines de regidor, ni fotos, ni cites, ni cap circuit de retirada. L'única dada personal
> realment en tractament és el correu de qui s'apunta a l'avís de la portada (secció 6).

**Base legal.** Tractarem dades de persones que exerceixen o aspiren a un càrrec públic
electe: articles 6.1(e) i (f) del RGPD (missió d'interès públic i interès legítim en la
informació política), LOPDGDD i article 8.2(a) de la LO 1/1982 (imatge de càrrecs públics
en actes públics). Finalitat única: informar sobre l'activitat pública d'aquestes persones
abans d'unes eleccions.

**Què publicarem**: nom i cognoms, candidatura i marca, càrrec i àrea, posició a la llista,
data de nomenament, grup municipal i canvis de grup, vots i intervencions al ple,
declaracions públiques amb font, trajectòria pública prèvia i el correu **institucional**
quan el publiqui el mateix ajuntament. Tot vindrà de fonts oficials obertes (composició dels
plens, llistes de candidats, actes) o de mitjans identificats.

**Què no publicarem**: adreça i telèfon particulars, correu personal, data de naixement
completa, dades de familiars, ideologia fora de l'àmbit polític, salut, orientació sexual,
dades econòmiques que no siguin la declaració patrimonial que ja publica l'ajuntament, cap
dada de menors i cap perfil privat de xarxes.

**Fotos**, per ordre: (1) cedida pel partit o la persona amb casella de drets; (2) retrat
oficial de l'ajuntament, amb crèdit «Foto: Ajuntament de X»; (3) kit de premsa del partit;
(4) Wikimedia Commons, amb autor i llicència al peu. **Mai avatars de xarxes socials.**
Sense foto, un monograma sobre fons tintat —mai una silueta grisa— i «Demana-la al partit».

**Retirada.** Qualsevol persona que hi surti podrà escriure a **hola@quivoto.cat** —l'adreça
que ja funciona i la mateixa que declara la política de privadesa del portal— per demanar
accés, rectificació, supressió, oposició o limitació; les fotos es retiraran en 48 hores
sense discussió. La informació sobre l'activitat pública d'un càrrec electe (vots, mocions,
declaracions) no es retirarà a petició —és el que empara l'interès públic—, però es
corregirà si és inexacta i s'hi podrà afegir la rèplica de la persona. Reclamació davant
l'Autoritat Catalana de Protecció de Dades sempre disponible. Quan algú deixi de ser
candidat o càrrec electe, la fitxa passarà a històric i es desindexarà. *(Proposta: 12 mesos
després del mandat.)* Si algun dia obrim una bústia específica per a aquestes peticions,
s'anunciarà aquí el dia que rebi correu, no abans.

## 6. La privadesa de qui fa el test

> ⏳ **Encara no construït.** No hi ha test: `web/public/` és la landing de «properament» i
> `assets/app.js` només fa el compte enrere i l'enviament del formulari de correu. No hi ha
> `localStorage`, ni enllaç `?r=`, ni pàgina de resultat. **I avui el portal no té cap
> analítica**: cap esdeveniment, cap comptador, cap tercer. Els compromisos d'aquest apartat
> es podran comprovar amb les eines del navegador el dia que el test es publiqui. L'únic
> punt d'aquesta secció que ja és real avui és el formulari d'avís de la portada, marcat amb
> ✅ més avall.

- **Les teves respostes no sortiran del navegador.** Es desaran a `localStorage` del teu
  dispositiu. No hi haurà comptes ni registre; no enviarem les respostes a cap servidor i,
  per tant, no les podrem vendre, filtrar ni entregar. El càlcul es farà al teu telèfon sobre
  el paquet de dades publicat del municipi. Hi haurà un botó **«Esborra les meves
  respostes»** al resultat.
- **Analítica**: quan n'hi hagi, seran només esdeveniments agregats (afirmació vista,
  resposta donada sense saber quin valor, test acabat) amb `session_hash` = sha256(sal que
  canvia cada dia + identificador aleatori del client). **No desarem la IP.** Retenció 90
  dies i s'esborrarà la partició sencera. Hi haurà un interruptor visible per desactivar-la.
  Avui, insistim, no n'hi ha cap. Mentre no existeixi, el mecanisme de retirada d'afirmacions
  que descriu [01-afirmacions.md](01-afirmacions.md) —que depèn d'aquests agregats— tampoc no
  es podrà aplicar.
- **Cap galeta. Cap tercer.** Ni analítica externa, ni píxels, ni mapes de calor, ni
  incrustacions de xarxes. Les tipografies es serveixen des del nostre domini
  (`web/public/assets/fonts/`): visitar quivoto no fa cap petició a cap altra empresa. Això
  ja és cert avui i es pot comprovar amb la pestanya de xarxa del navegador.
- ✅ **El formulari d'avís de la portada** (l'únic lloc on demanem un correu, i l'únic
  tractament de dades personals que tenim en producció) funciona amb consentiment exprés,
  art. 6.1(a). Recull correu, municipi, idioma, un hash irreversible de la IP amb sal diària
  i el nom del navegador, els dos últims només per aturar robots
  (`web/public/api/lib.php`, `api/subscribe.php`). Baixa amb un clic; la llista s'esborra
  sencera com a molt tard el 31-12-2027. Detall a
  [quivoto.cat/privadesa.html](https://quivoto.cat/privadesa.html), que diu exactament el
  mateix.

### Què voldrà dir exactament l'enllaç per compartir

> ⏳ **Encara no construït.** No hi ha resultat, ni enllaç `?r=`, ni format de codificació
> escrit enlloc del repositori. El que segueix és l'especificació que volem complir.

El resultat es compartirà amb un enllaç que porti un paràmetre `?r=`. Què hi haurà a dins:

- Serà la **teva resposta a cada afirmació, codificada**: versió del format, identificador
  del joc d'afirmacions i 4 bits per afirmació (3 per al valor o «omet», 1 per «molt
  important»); uns 22 caràcters. *(Proposta, pendent de confirmar: aquesta mida i aquesta
  codificació; encara no estan implementades.)* **No estarà xifrat**: qui tingui l'enllaç
  podrà reconstruir totes les teves respostes. El mateix enllaç serà l'única manera de
  recuperar el resultat en un altre dispositiu, perquè no desarem res al servidor.
- **Es generarà només si prems «Compartir».** Si no ho fas, aquest enllaç no existirà.
- En obrir-lo, el paràmetre viatjarà al nostre servidor dins la petició (per exemple, per
  dibuixar la imatge de previsualització). El compromís és **no registrar-lo**: l'endpoint
  de la imatge no desarà el payload ni escriurà els paràmetres de consulta al registre
  d'accés, i aquestes pàgines aniran amb `noindex`.
- Honestament: és una promesa nostra que no podràs verificar des de fora. Si no vols córrer
  el risc, no comparteixis l'enllaç; la imatge que generem mai contindrà les respostes.

## 7. Fonts que reutilitzem i com les citem

> ⚠️ **Mig i mig.** De la taula següent, avui només s'han descarregat i ingerit les dues
> primeres files: les dades obertes de la Generalitat (`packages/pipeline/src/jobs/j1`–`j5`)
> i l'índex de l'AOC, del qual només hem comptat quantes actes hi ha per ens
> (`packages/pipeline/src/adapters/aoc.ts`, `minutesCoverage()`). **Cap acta en PDF s'ha
> descarregat mai**, ni s'ha fet servir cap foto, cap cita de premsa ni el CSV de Rubí. Les
> altres files són fonts que preveiem utilitzar, amb les condicions que ja hem comprovat.

| Font | Què n'agafem o n'agafarem | Llicència / condicions |
|---|---|---|
| ✅ Dades obertes de la Generalitat (ens locals, resultats electorals, candidats, composició dels plens) | Municipis, població, alcaldia, vots i escons, llistes, regidors | Llicència oberta amb **atribució** |
| ✅ Consorci AOC — índex d'actes | Índex de 25.902 actes des del 17-06-2023: **comptades, no descarregades ni llegides** | Dades obertes, CC0 |
| ⏳ Correus dels càrrecs electes | **No en tenim.** El conjunt de la Generalitat `m5nd-xjza` té el camp buit a totes les files (`count(e_mail) = 0`, comprovat el 28-08-2026), i `packages/pipeline/src/jobs/j3-councillors.ts` obre una incidència per deixar-ne constància. Caldrà una altra font abans de l'outreach del 2027 | — |
| ⏳ Seu electrònica municipal (cartipàs, fotos, actes en PDF) | Retrats oficials, documents | L'avís legal autoritza la reutilització **citant font i data i sense alterar el contingut** |
| ⏳ Ajuntament de Rubí — vot de cada regidor a cada moció (CSV) | Veritat de terreny per mesurar la precisió de l'extracció | CC BY / CC BY-NC segons on es miri: **pendent de confirmar amb l'ajuntament** abans de publicar-ne res de derivat |
| ⏳ Diputació de Barcelona i butlletins oficials de província | Candidatures, procedència documental | Dades obertes / publicació oficial |
| ⏳ Wikimedia Commons | Fotos, quan no n'hi ha cap d'oficial | La que digui cada fitxer, amb autor i llicència al peu |
| ⏳ Premsa local | Cites literals curtes amb enllaç a l'original | **Dret de cita**: fragment breu, amb autoria, mitjà, data i enllaç. Mai el text sencer |

Cada dada publicada portarà la font amb el nom del conjunt de dades, l'identificador i la
data de descàrrega; les cites de les actes seran literals i enllaçaran al PDF original amb la
pàgina. **L'evidència no es traduirà mai**: la cita es mostrarà en la llengua original,
encara que naveguis en castellà o en aranès. De tot això, el que ja funciona és la traça
d'ingesta (taula `ingest_runs`, `packages/db/src/schema/runs.ts`), que desa d'on i quan hem
baixat cada conjunt de dades.

## 8. Les nostres dades, en obert

> ⏳ **Encara no construït.** No hi ha cap exportació: `packages/db/src/cli/` i
> `packages/db/src/sql/` són directoris buits i la CLI del pipeline només té les feines
> j1–j5, `derive` i `report`, que escriu a la sortida estàndard. No hi ha cap fitxer públic
> descarregable, ni esquema versionat, ni registre de mocions o posicions que exportar,
> perquè no existeixen com a dades.

Tot el que construïm a partir de fonts públiques tornarà a ser públic. **Què publicarem**
(CSV i JSON, un fitxer per municipi i un de global, amb esquema documentat i versionat). Ho
separem pel que costa de construir:

Ja seria publicable avui, perquè les dades hi són a la base de dades i només falta
l'exportador:

- resultats 2015, 2019 i 2023 per candidatura, amb la marca supramunicipal normalitzada;
- composició del ple i canvis de grup durant el mandat, participació i alcaldies.

Depèn de peces que encara no existeixen (la lectura de les actes i la inferència de
posicions):

- **el registre de mocions**: cada punt de l'ordre del dia amb qui el proposa, què diu, com
  acaba i, quan l'acta ho detalli, el vot de cada grup, amb la cita, l'enllaç a l'acta i un
  camp explícit de confiança de l'extracció;
- les afirmacions i les posicions publicades, amb l'origen (declarada o inferida), la
  confiança i les cites; i el registre de canvis.

**Llicència proposada: CC BY 4.0**, atribució «quivoto.cat» amb enllaç i obligació de
mantenir el camp de confiança quan es reutilitzin posicions inferides. *(Proposta, pendent
de confirmar; depèn de la compatibilitat amb la llicència de cada font original, que en cap
cas podem ampliar.)*

**Què no publicarem, i per què**:

- els correus de contacte de partits i candidats recollits per convidar-los a respondre:
  seria regalar una llista per a correu brossa;
- els textos íntegres d'articles de premsa: només la cita i l'enllaç;
- l'analítica en brut: només agregats, perquè fins i tot amb hash de sessió una sèrie fina
  podria ser reidentificable;
- cap resposta del test: no existiran fora del teu navegador;
- les posicions que no hagin passat el control de revisió que els toqui. Compte: això **no**
  vol dir que una persona hagi llegit cada posició publicada; vegeu
  [02-posicions.md](02-posicions.md) sobre quan una posició es publica amb aprovació
  automàtica i quan necessita ulls humans.

## Límits d'aquest mètode

- **Res d'això s'ha publicat encara.** El límit més gran, avui, és que aquesta pàgina és
  sobretot un compromís: no hi ha cap municipi publicat amb brúixola, i per tant ningú no
  ha pogut comprovar encara si complim el que hi diem. El que sí que es pot comprovar és el
  codi i les dades ingerides.
- **La neutralitat de les afirmacions no es podrà demostrar, només auditar.** Publicarem
  l'equilibri direccional de cada paquet i la llista de comprovació, però qui tria els 25
  temes d'un municipi ja pren una decisió editorial. Un partit pot tenir raó quan digui
  que el tema que més l'afavoreix no hi és.
- **La cobertura és desigual i això no és neutral.** 646 municipis tenen 20 actes o més
  des del juny del 2023, 150 en tenen entre 10 i 19, 59 menys de 10 i **92 no en tenen
  cap**. Un partit d'un municipi amb poques actes tindrà més «sense dades» que el mateix
  partit en una ciutat gran, i això li penalitzarà la visibilitat encara que no li penalitzi
  el percentatge: a `matching.ts` les afirmacions sense dades queden fora del denominador,
  i això sí que està implementat i té tests.
- **Moltes actes no desglossen el vot.** Quan diuen «aprovat per majoria» sabrem el resultat
  però no qui va votar què: no hi haurà prior de vot i la posició, si n'hi ha, vindrà de
  fonts més febles.
- **Tindrem una sola veritat de terreny.** Només Rubí publica el vot de cada regidor a cada
  moció. La precisió que hi mesurem serà la millor estimació per als altres 946 municipis, i
  no té per què valer-hi: cada secretaria redacta les actes a la seva manera. Encara no
  s'ha fet cap mesura: el CSV de Rubí no s'ha descarregat.
- **Publicarem abans de contactar els partits** (model SVT): del desembre del 2026 al gener
  del 2027 el portal mostrarà posicions inferides que ningú del partit haurà pogut contestar
  encara. Ho compensaran el dret de rèplica i els terminis d'aquest document, però és un
  desequilibri real durant unes setmanes, i per això no obrirem cap municipi fins que el
  circuit de reclamacions funcioni i cada candidatura hagi rebut la seva fitxa prèvia amb
  temps de resposta (secció 4). Mentre aquest circuit no existeixi, la compensació no és
  real i no publicarem.
- **Els terminis d'aquesta pàgina són el compromís d'un equip petit.** Si arriben cent
  reclamacions el mateix dia d'abril del 2027, es dilataran; ho direm al registre de canvis
  en comptes de fingir que es compleixen.
- **La promesa de no registrar el payload `?r=` no serà verificable des de fora.** L'única
  garantia forta serà la que sí que podràs comprovar amb les eines del navegador: que les
  respostes no s'envien enlloc mentre fas el test.
- **No som independents del disseny de les fonts.** Si la Generalitat canvia un conjunt de
  dades o un ajuntament deixa de publicar actes, el retrat d'aquell municipi s'envelleix.
  Ho marcarem amb la data de frescor, però un segell de data no arregla un buit.
