# Revisió legal, electoral i ètica de quivoto (Espanya, Catalunya i UE)

> Annex de la segona ronda del [pla de millores](PLA.md) (26-10-2026). Al pla, les troballes d'aquest document es citen amb el prefix **LEG-** (per exemple, LEG-P1). No és assessorament jurídic: els punts legals s'han de confirmar amb un advocat.

Estat a 26-10-2026. Abast: repositori `quivoto` (commit de treball actual), `web/public/privadesa.html`, `web/public/avis-legal.html`, `docs/METODOLOGIA.md`, `docs/metodologia/05-neutralitat-i-dades.md`, `docs/FONTS-PERSONES.md`, `docs/pla-millores/PLA.md` i `04-tecnica.md` §2. No s'ha modificat el repositori.

> **No és assessorament jurídic.** És una anàlisi de risc feta amb fonts oficials i doctrina pública. On diu **[ADVOCAT]**, la conclusió és dubtosa o depèn d'una interpretació que hauria de confirmar un advocat especialista en dret electoral o en protecció de dades. Algunes fonts no s'han pogut llegir senceres (el BOE i l'APDCAT bloquegen la descàrrega automàtica). Quan una afirmació ve de memòria i no s'ha pogut tornar a comprovar, es diu **(verificar)**.

**Relació amb l'auditoria anterior.** `04-tecnica.md` §2 ja recull aquests punts: GA sense consentiment (TEC-S2), fotos d'exalcaldes contra la política (TEC-S3), alta sense doble confirmació (TEC-S5) i `.gitignore` (TEC-S10). Aquí no es repeteixen. Quan una troballa hi afegeix alguna cosa, s'hi remet amb «amplia TEC-Sx».

Esforç: **S** < 1 dia · **M** 1–3 dies · **L** > 3 dies. Risc: **alt / mitjà / baix**, combinant la probabilitat d'una reclamació o sanció amb el dany reputacional per a un projecte que es presenta com a neutral.

---

## 0. Resum en sis línies

1. **Electoral.** Una brúixola neutral **no és campanya electoral** prohibida a una persona jurídica (art. 50.5 LOREG; STS 6-7-2016). El risc real té tres fonts: publicar agregats de resultats de la brúixola, que es poden considerar un «sondeig» (art. 69); tractar de manera desigual les candidatures; i fer promoció pagada o activitat el dia de reflexió.
2. **La base jurídica de la política de privadesa és equivocada.** Una SL privada no pot invocar l'art. 6.1.e RGPD («missió d'interès públic») sense una llei que li encarregui la missió. La base és l'interès legítim (6.1.f) més la llibertat d'informació, i això activa el dret d'oposició (art. 21). L'autoritat de control competent és l'**AEPD**, no l'APDCAT.
3. **La política no descriu el que es publica.** El web publica l'any de naixement, sous amb nom, ofici, trajectòria de Wikidata, caps de llista sense escó i (al 2027) milers de candidats particulars. La política diu que no.
4. **Brúixola.** Les opinions polítiques són dades de categoria especial. Si l'enllaç per compartir porta les respostes a la *query* (`?r=`), aquestes arriben als *logs* del servidor i a Google Analytics. Cal fer-ho amb un fragment (`#r=`) i no tenir cap analítica en aquesta pàgina.
5. **Cal una avaluació d'impacte (AIPD) abans del 2027.** El tractament compleix almenys quatre criteris de la llista de l'AEPD. També calen el registre d'activitats, la ponderació de l'interès legítim i un protocol de rectificació.
6. **Per a la credibilitat**, cal dir el nom del responsable editorial, quina altra activitat té l'SL, el finançament (llindar del 5 %), una política d'ús d'IA i un registre de correccions. Ho fan Civio, l'IFCN i les brúixoles de referència.

---

## 1. Calendari electoral 2027 deduït de la LOREG

Cal confirmar-lo quan es publiqui el decret. Els articles són de la [LOREG](https://www.boe.es/eli/es/lo/1985/06/19/5/con).

| Fita | Regla | Data prevista |
|---|---|---|
| Eleccions | 4t diumenge de maig | **dg 23-05-2027** |
| Decret de convocatòria | art. 42.3: s'expedeix el dia 55 abans del 4t diumenge de maig | expedit el 29-03, publicat al BOE el **dt 30-03-2027** |
| Inici del «període electoral» | Des de la convocatòria s'apliquen l'art. 50.2-5 (institucions i persones jurídiques), l'art. 53.2 (propaganda abans de campanya) i l'art. 69 (sondejos) | **30-03-2027** |
| Candidatures presentades (BOP) | art. 47.1: dia 22 | **~21-04-2027** |
| Proclamació / publicació | art. 47.3 i 47.5: dies 27 i 28 | **~26-04 / 27-28-04-2027** |
| Campanya | art. 51: comença el dia 38 i dura 15 dies; acaba a les 0 h del dia anterior a la votació | **dj 7-05 00:00 → dv 21-05 24:00** |
| Prohibició de publicar sondejos | art. 69.7: els 5 dies anteriors al de la votació | **dt 18-05 → ds 22-05** |
| Jornada de reflexió | art. 53: cap propaganda ni acte de campanya un cop acabada la campanya | **ds 22-05-2027** |
| Constitució dels ajuntaments | art. 195.1: dia 20 després de les eleccions | **ds 12-06-2027** |

---

## 2. Troballes

### A. Dret electoral (LOREG, doctrina de la JEC, UE)

#### LEG-E1. Agregats de la brúixola i rànquings de candidatures poden ser «sondejos» (art. 69 LOREG)
- **Què diu la norma.** L'art. 69.7 prohibeix «la publicación y difusión o reproducción de sondeos electorales por cualquier medio de comunicación» durant els cinc dies anteriors al de la votació. Entre la convocatòria i la votació, tot sondeig publicat ha de portar una fitxa tècnica: qui l'ha fet i encarregat, sistema de mostreig, mida de la mostra, marge d'error, nivell de representativitat, procediment de selecció, dates del treball de camp i text íntegre de les preguntes (art. 69.2). La JEC pot exigir rectificacions en 3 dies (art. 69.4). Fonts: [art. 69 (text)](https://papelea.com/es/leyes/ley-organica-del-regimen-electoral-general/titulo-primero_capitulo-vi_seccion-viii-encuestas-electorales) i [Instrucció JEC 1/2024](https://www.boe.es/eli/es/ins/2024/02/01/1/con), que s'aplica als organismes públics però recorda l'abast de l'art. 69.7. Per la seva banda, l'[Acord JEC 502/2023](https://www.juntaelectoralcentral.es/cs/jec/doctrina/acuerdos?anyosesion=2023&idacuerdoinstruccion=121355&idsesion=1046&template=Doctrina%2FJEC_Detalle) diu que la JEC no autoritza per endavant la publicació d'estudis i recorda la prohibició a una empresa privada que analitzava xarxes socials.
- **Com afecta quivoto.** La brúixola en si no mesura intenció de vot i no és un sondeig. Però qualsevol peça del tipus «el 34 % dels usuaris de Reus coincideixen més amb X», «candidatura més triada» o un mapa de coincidències per municipi **sí que es pot llegir com un sondeig**. Una mostra autoseleccionada no pot complir mai la fitxa tècnica de l'art. 69.2. El pla de `docs/metodologia/05-neutralitat-i-dades.md` §6 preveu analítica agregada d'esdeveniments, i el mecanisme de retirada d'afirmacions depèn d'aquests agregats. Aquests agregats no es poden publicar mai per candidatura. **[ADVOCAT]** No s'ha trobat cap acord de la JEC sobre brúixoles electorals.
- **Què cal fer.** (1) Regla escrita a la metodologia: «quivoto no publica cap resultat agregat de la brúixola per candidatura o partit entre el 30-03 i el 23-05 a les 20:00; i fora d'aquest període, només amb una advertència de no representativitat». (2) No reproduir sondejos de tercers del 18 al 22-05, tampoc a les xarxes (ni retuits ni captures). (3) Si el web enllaça enquestes publicades abans del 18-05, citar-ne la fitxa tècnica. (4) Afegir un test o *lint* que bloquegi qualsevol plantilla que mostri percentatges d'usuaris per candidatura.
- **Esforç** S · **Risc** alt · **Data límit** abans del 30-03-2027; prohibició absoluta del 18-05 al 22-05.

#### LEG-E2. Una persona jurídica no pot fer campanya, però una brúixola neutral no és campanya (art. 50.5 LOREG)
- **Què diu la norma.** L'art. 50.4 defineix la campanya com les activitats dels candidats i partits «en orden a la captación de sufragios». L'art. 50.5 diu que «ninguna persona jurídica distinta de las mencionadas […] podrá realizar campaña electoral a partir de la fecha de la convocatoria», «sin perjuicio de lo establecido en el artículo 20 de la Constitución» ([text](https://www.iberley.es/legislacion/articulo-50-regimen-electoral-general)). El Tribunal Suprem, en la sentència de 6-7-2016 (cas HazteOír), va anul·lar una retirada ordenada per la JEC: «deben quedar fuera de esa prohibición aquellas otras actividades no directamente encaminadas a captar votos» ([nota del CGPJ](https://www.poderjudicial.es/cgpj/es/Poder-Judicial/Tribunales-Superiores-de-Justicia/TSJ-Madrid/Noticias-Judiciales-TSJ-Madrid/El-Tribunal-Supremo-avala-la-campana-publicidad-de--Hazteoir--contra-Cristina-Cifuentes-por-su-posicion-ante-el-aborto)). El 2024 la JEC va mantenir el mateix criteri ([premsa](https://theobjective.com/espana/tribunales/2025-01-15/psoe-supremo-camion-hazte-oir/)).
- **Com afecta quivoto.** Damos en el Blanco, S.L. és una persona jurídica. Una eina informativa i neutral és exercici de l'art. 20 CE i no captació de vots, sempre que **no demani el vot per ningú** ni en desaconselli cap. El risc apareix amb els detalls: un *call to action* («Vota X», «Que no guanyi Y»), adjectius editorials, un missatge a xarxes que destaqui una candidatura o un ordre de presentació que afavoreixi sistemàticament algú.
- **Què cal fer.** Una guia d'estil electoral (una pàgina): cap verb imperatiu associat a una candidatura; cap adjectiu valoratiu; el resultat de la brúixola sempre amb «no és un consell de vot» (ja hi és a l'avís legal). Les crides genèriques a la participació («Informa't i vota») són lícites. Revisar també els textos de xarxes i del butlletí.
- **Esforç** S · **Risc** mitjà · **Data límit** 30-03-2027.

#### LEG-E3. Jornada de reflexió i període de precampanya (art. 53 LOREG)
- **Què diu la norma.** L'art. 53.1 prohibeix difondre propaganda o fer actes de campanya un cop acabada la campanya, és a dir el 22-05. L'art. 53.2, entre la convocatòria i l'inici de la campanya, prohibeix la propaganda «mediante carteles, soportes comerciales o inserciones en prensa, radio u otros medios digitales». La [Instrucció JEC 3/2011](https://www.juntaelectoralcentral.es/cs/jec/doctrina/instrucciones?esinstruccion=true&idacuerdoinstruccion=25785&sPag=1&template=Doctrina/JEC_Detalle&total=109) ho concreta per a partits i candidats: prohibeix la contractació «directamente ni a través de tercero» de suports, *banners* inclosos, i admet webs i xarxes sense contractació comercial. La [Instrucció JEC 4/2007](https://www.juntaelectoralcentral.es/cs/jec/doctrina/instrucciones?esinstruccion=true&idacuerdoinstruccion=7787&sPag=1&template=Doctrina/JEC_Detalle&total=109) estén les regles de campanya a webs, correu i SMS.
- **Com afecta quivoto.** Aquestes regles es dirigeixen als actors electorals, però quivoto pot ser vist com a «tercer» si difon material de partits (rèpliques, respostes al qüestionari) el dia 22 o si fa promoció pagada amb noms o logotips de candidatures. **[ADVOCAT]** No hi ha doctrina sobre si una brúixola pot continuar en línia el dia de reflexió. Les brúixoles europees i els mitjans espanyols mantenen la informació publicada; el criteri prudent és mantenir-la i no fer-ne promoció.
- **Què cal fer.** El 22-05 i el 23-05 fins a les 20:00: cap enviament del butlletí, cap publicació a xarxes sobre partits o candidats, cap funcionalitat nova i cap rèplica nova de partit (les que arribin es publiquen a partir del 23-05 a les 20:00). El web es queda tal com està. Del 30-03 al 6-05: cap anunci pagat que porti noms, sigles o logotips de candidatures.
- **Esforç** S · **Risc** mitjà · **Data límit** 30-03 i 22-05-2027.

#### LEG-E4. Igualtat d'oportunitats entre candidatures (lliçó Wahl-O-Mat)
- **Què diu la norma.** A Espanya no hi ha cap norma específica per a brúixoles privades. La [Instrucció JEC 4/2011](https://www.juntaelectoralcentral.es/cs/jec/doctrina/instrucciones?esinstruccion=true&idacuerdoinstruccion=25790&sPag=1&template=Doctrina/JEC_Detalle&total=109) només obliga la ràdio i la TV (pluralisme, igualtat, proporcionalitat i neutralitat), no les webs. Com a precedent europeu, el VG Köln va aturar el Wahl-O-Mat el maig del 2019, a petició de Volt, perquè només deixava comparar 8 partits alhora i això perjudicava els petits ([resum](https://jura-online.de/blog/2019/05/21/vg-koln-wahl-o-mat-ist-verfassungswidrig/)). Aquell era un ens públic; quivoto és privat, però el risc reputacional i de queixa davant la Junta és el mateix.
- **Com afecta quivoto.** Els riscos concrets són aquests. (a) L'ordre és «per vots del 2023 i les noves al final alfabèticament»: és defensable, però una candidatura nova pot al·legar que la penalitza en el resultat. (b) Una candidatura sense rastre digital queda com a «dades insuficients», i la mateixa metodologia admet que «el mètode és més generós amb els partits organitzats». (c) La cobertura és desigual entre municipis.
- **Què cal fer.** (1) A la **pantalla de resultat**, mostrar totes les candidatures proclamades, sense límit, ordenades per coincidència i, en cas d'empat, alfabèticament. L'ordre per vots del 2023 només a les fitxes informatives. (2) Enviar el qüestionari a **totes** les candidatures proclamades el mateix dia i amb el mateix termini, i publicar la data d'enviament i qui ha respost. (3) Explicar, a la mateixa pantalla, per què una candidatura surt sense dades. (4) Conservar un registre amb data de cada enviament i resposta, com a prova davant d'una reclamació.
- **Esforç** M · **Risc** mitjà · **Data límit** 27-04-2027 (proclamació).

#### LEG-E5. Respostes dels partits: obligacions i límits
- **Què diu la norma.** Les respostes d'una candidatura són contingut editorial de quivoto quan les selecciona i presenta. El [Reglament (UE) 2024/900](https://eur-lex.europa.eu/eli/C/2025/5514/oj/eng/pdf) sobre publicitat política, aplicable des del 10-10-2025, exclou el contingut sota responsabilitat editorial i les opinions sense remuneració, però hi entra el que es publica **a canvi de pagament o d'una contraprestació en espècie** (Guidelines C/2025/5514, §2.1 i 2.2.1). La Instrucció JEC 4/2007 (apartat tercer) exigeix «neutralidad política, transparencia e igualdad de acceso» a les entitats locals que cedeixen plataformes a candidats. No s'aplica a quivoto, però és un bon estàndard de referència.
- **Com afecta quivoto.** Si mai s'accepta res de les candidatures (diners, serveis, «col·laboració»), o es publica material promocional seu sense editar (vídeos, eslògans, enllaços de donació), el contingut pot passar a ser **publicitat política**, amb etiquetatge, avís de transparència i registre, o propaganda difosa per un tercer.
- **Què cal fer.** (1) Una política escrita: les respostes es limiten al format del qüestionari (posició + 600 caràcters + font), sense imatges, enllaços promocionals ni crides al vot. (2) Una clàusula al qüestionari: gratuïtat, cap avantatge, publicació literal amb data i tractament de dades personals (vegeu LEG-P10). (3) Mantenir el compromís de no acceptar res de partits (`docs/metodologia/05-neutralitat-i-dades.md` §1) i ampliar-lo a «ni serveis de comunicació o consultoria prestats per l'SL».
- **Esforç** S · **Risc** mitjà · **Data límit** abans d'enviar el qüestionari (gener 2027).

#### LEG-E6. Promoció pagada i plataformes
- **Què diu la norma.** El Reglament 2024/900 defineix «publicitat política» de manera àmplia, incloent-hi missatges que poden influir en el resultat d'una elecció, i imposa obligacions als proveïdors. Des de l'octubre del 2025, Meta i Google han deixat d'acceptar anuncis polítics, electorals o de temes socials a la UE **(verificar l'estat de les polítiques el 2027)**.
- **Com afecta quivoto.** Un anunci pagat «Descobreix amb quin partit coincideixes» probablement serà rebutjat o classificat com a polític, i si porta noms de candidatures pot topar amb l'art. 53.2 LOREG.
- **Què cal fer.** Planificar una difusió **orgànica**: mitjans locals, entitats, premsa i SEO (F1-10). Si es paga promoció, que sigui genèrica (sense partits ni candidats), que acabi abans del 30-03 i que no la pagui mai un tercer amb interès polític.
- **Esforç** S · **Risc** baix · **Data límit** 30-03-2027.

#### LEG-E7. Col·laboracions amb administracions durant el període electoral
- **Què diu la norma.** L'art. 50.2 LOREG prohibeix als poders públics, des de la convocatòria, actes que facin referència als seus assoliments, i la [Instrucció JEC 2/2011](https://www.juntaelectoralcentral.es/cs/jec/doctrina/instrucciones?esinstruccion=true&idacuerdoinstruccion=25793&sPag=1&template=Doctrina/JEC_Detalle&total=109) n'interpreta l'abast. La Instrucció 4/2007 exigeix neutralitat a les plataformes que ofereixen les corporacions locals.
- **Com afecta quivoto.** Si un ajuntament o una diputació incrusta o promociona quivoto (enllaç destacat, nota de premsa, *widget*), pot ser denunciat per falta de neutralitat, i quivoto en pateix el dany reputacional. Reutilitzar dades obertes no hi té res a veure.
- **Què cal fer.** No signar convenis ni fer cobranding amb administracions entre el 30-03 i el 23-05. Un enllaç espontani d'un ajuntament no depèn de quivoto, però no s'ha de sol·licitar.
- **Esforç** S · **Risc** baix.

#### LEG-E8. Nit electoral i sondejos a peu d'urna
- **Què diu la norma.** La doctrina de la JEC no permet difondre sondejos a peu d'urna ni estimacions abans que tanquin els col·legis **(verificar l'acord concret)**. Els resultats provisionals oficials es poden publicar quan el Ministeri de l'Interior els difon.
- **Com afecta quivoto.** Afecta la decisió F3-8 / D6 del pla.
- **Què cal fer.** No publicar cap estimació pròpia, i no reproduir sondejos de tercers fins a les 20:00 del 23-05. Si hi ha nit electoral, que vingui només de la font oficial i amb la seva hora de càrrega.
- **Esforç** S · **Risc** mitjà · **Data límit** 23-05-2027.

#### LEG-E9. Reglament d'IA: transparència del text generat i possible classificació d'alt risc
- **Què diu la norma.** El Reglament (UE) 2024/1689 té dos punts rellevants. L'**art. 50.4, segon paràgraf**: qui desplega un sistema que genera text publicat «amb la finalitat d'informar el públic sobre qüestions d'interès públic» ha de dir que és artificial, **llevat que el text hagi passat revisió humana o control editorial i una persona en tingui la responsabilitat editorial**. S'aplica des del **2-08-2026** ([AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/faq)). L'**annex III, punt 8(b)** declara d'alt risc els sistemes «destinats a influir en el resultat d'una elecció o en el comportament de vot», excepte les eines administratives o logístiques. El *Digital Omnibus* n'ajorna les obligacions fins al **2-12-2027** ([Deloitte, juny 2026](https://www.deloitte.com/uk/en/blogs/ecrs/the-ai-omnibus-what-is-settled-and-what-is-still-in-play.html), pendent de publicació definitiva; verificar).
- **Com afecta quivoto.** La metodologia preveu que un LLM proposi afirmacions i posicions, i que es publiquin **auto-aprovades** quan tres capes coincideixin (`METODOLOGIA.md` §2). Una posició auto-aprovada és text generat per IA sense revisió humana, i obliga a l'etiquetatge de l'art. 50.4. Pel que fa a l'annex III: el càlcul de coincidència és determinista i informatiu, i probablement no és alt risc. Però un model que **infereix la posició d'un partit** i la mostra al votant en una eina de vot s'hi acosta. **[ADVOCAT]**
- **Què cal fer.** (1) En campanya, desactivar l'auto-aprovació: cada posició signada per una persona (`approved_by` amb nom). Així s'aplica l'excepció de l'art. 50.4 i es redueix el risc d'honor (LEG-H1). (2) Mentre hi hagi contingut auto-aprovat, etiquetar-lo de manera visible («proposat per IA, sense revisió humana»). (3) Publicar una política d'ús d'IA, com la de Civio (vegeu LEG-G2). (4) Tornar a valorar l'annex III quan surtin les directrius de la Comissió sobre alt risc.
- **Esforç** S–M · **Risc** mitjà · **Data límit** abans de publicar la primera posició inferida; ja és aplicable.

#### LEG-E10. Fer una consulta formal a la Junta Electoral Central
- **Què diu la norma.** La JEC respon consultes d'entitats privades: l'Acord 502/2023 en va respondre una d'una empresa de mitjans. Les juntes provincials i de zona són competents per a les queixes concretes en eleccions locals.
- **Què cal fer.** Al gener o febrer del 2027, presentar una consulta breu amb tres preguntes: (a) si una brúixola neutral pot continuar accessible el 22-05 i del 18 al 22-05; (b) si els agregats anònims d'ús de la brúixola es consideren sondeig a efectes de l'art. 69; (c) si publicar literalment la resposta d'una candidatura al qüestionari durant la campanya té algun límit. La resposta, o el silenci, documenta la diligència de quivoto.
- **Esforç** S · **Risc** — (mesura de mitigació) · **Data límit** 28-02-2027.

### B. Protecció de dades (RGPD, LOPDGDD)

#### LEG-P1. La base jurídica declarada (art. 6.1.e) no és vàlida per a una SL privada
- **Què diu la norma.** L'art. 6.3 del RGPD exigeix que la «missió d'interès públic» de l'art. 6.1.e tingui base en el dret de la Unió o de l'Estat. La Llei 19/2014 imposa la publicitat activa **als ajuntaments**, no a tercers. L'art. 17.1 de la mateixa llei fa lliure la reutilització «llevat» de la protecció d'altres drets ([text de la Llei 19/2014](https://cemical.diba.cat/codibasic/fitxers/Llei_19_2014_transparencia_cat.pdf)). Que una dada sigui pública no legitima per si sola el tractament: el Tribunal Suprem ho va dir el 8-2-2012 en anul·lar l'art. 10.2.b RLOPD ([CMS](https://cms.law/en/esp/publication/la-publicidad-del-dato-personal-no-otorga-per-se-legitimacion-para-su-tratamiento)), i l'AEPD hi va insistir en l'informe sobre el codi d'ASEDIE de 2021 ([Cuatrecasas](https://www.cuatrecasas.com/es/spain/propiedad-intelectual/art/aepd-no-aprueba-proyecto-codigo-de-conducta-sector-infomediario-promovido-asedie)), amb ponderació, limitació de finalitat i minimització.
- **Com afecta quivoto.** `privadesa.html` diu «Base legal: el compliment d'una missió d'interès públic (art. 6.1.e del RGPD)», i `docs/metodologia/05-neutralitat-i-dades.md` §5 hi afegeix el 6.1.f. La base correcta és **l'interès legítim (6.1.f)** en la informació política, recolzat en l'art. 20.1.d CE. Això implica tres coses: (a) cal una **ponderació escrita** (*Legitimate Interest Assessment*); (b) les persones tenen **dret d'oposició** (art. 21), que obliga a deixar de tractar les dades si no hi ha «motius legítims imperiosos»; (c) la ponderació ha de ser més prudent amb els particulars que amb els càrrecs (LEG-P4). A més, la política cita l'«article 15» de la Llei 19/2014, que tracta de subvencions; el de dades personals és l'**art. 24** i el de retribucions, l'**art. 11.1.b**.
- **Què cal fer.** Reescriure el bloc «Les dades dels càrrecs electes»: base 6.1.f + art. 20 CE; resum de la ponderació; procediment d'oposició amb criteris (què es retira i què no, com ja fa `docs/metodologia/05-neutralitat-i-dades.md` §5); citacions correctes. Desar la ponderació a `docs/legal/` (sense dades personals).
- **Esforç** S (text) + M (ponderació) · **Risc** alt · **Data límit** 15-12-2026, abans d'indexar (F1-10).

#### LEG-P2. Autoritat de control equivocada
- **Què diu la norma.** L'APDCAT supervisa el sector públic català i els privats que hi estan vinculats o que presten serveis públics. Una SL privada que tracta dades pel seu compte depèn de l'**AEPD** ([resum de competències](https://www.legiscope.com/blog/apdcat-autoridad-catalana-proteccion-datos.html)). L'art. 13.2.d del RGPD obliga a informar del dret a reclamar davant l'autoritat de control.
- **Com afecta quivoto.** La política diu «pots reclamar a l'Autoritat Catalana de Protecció de Dades».
- **Què cal fer.** Canviar-ho per l'AEPD (aepd.es, C/ Jorge Juan 6, Madrid).
- **Esforç** S · **Risc** mitjà · **Data límit** immediata.

#### LEG-P3. La política de privadesa no descriu el que es publica (amplia TEC-S3)
- **Què diu la norma.** Els arts. 5.1.a, 13 i 14 del RGPD exigeixen transparència: cal informar de les categories de dades, les fonts, la base i la conservació.
- **Com afecta quivoto.** Contradiccions noves, a més de les fotos d'exalcaldes:
  1. La política diu «cap data de naixement», però `regidor.ts:366-367` publica **l'any de naixement** dels caps de llista, tret de Wikidata (J27).
  2. La llista «Què publiquem, exactament… Res més» no inclou les **retribucions amb nom** (J22 Barcelona, J24 diputacions, J30 consells), l'**ofici anterior** (Wikidata P106), els **càrrecs supramunicipals**, l'enllaç a la Viquipèdia ni la trajectòria.
  3. La política diu «Tampoc publiquem res de persones que no hagin estat mai càrrec electe», però es publiquen caps de llista del 2023 sense escó i el pla F4-1 publicarà **totes les candidatures del 2027**.
  4. La política parla de la «fotografia oficial» publicada per l'ajuntament, però també n'hi ha de Wikimedia Commons.
  5. `docs/metodologia/05-neutralitat-i-dades.md` §6 diu «avui el portal no té cap analítica», i GA hi és.
  6. La privadesa i l'avís legal duen la data d'agost del 2026 i ja no reflecteixen el web.
- **Què cal fer.** Reescriure la política amb una **taula**: categoria de dada × font × base × qui hi surt (càrrec actual / excàrrec / candidat no electe) × conservació × com oposar-s'hi. Posar-la al dia a cada publicació que afegeixi una font de dades personals, i afegir-ho com a punt de la plantilla de revisió de *pull requests*.
- **Esforç** S–M · **Risc** alt · **Data límit** 15-12-2026.

#### LEG-P4. Candidats del 2027 que no són càrrecs electes: són particulars
- **Què diu la norma.** La publicació al BOP és un mandat legal amb finalitat electoral (art. 47 LOREG). Reutilitzar-la per informar el votant durant la campanya és una finalitat compatible i defensable per interès legítim. Però la mateixa persona deixa de ser rellevant quan acaba l'elecció si no surt escollida (minimització, art. 5.1.c; limitació de la conservació, art. 5.1.e). El dret de supressió (art. 17) i el dret a l'oblit (art. 93 LOPDGDD, [text](https://www.conceptosjuridicos.com/articulos/ley-organica-de-proteccion-de-datos-articulo-93/)) pesen més com més temps passa i com més privada és la persona.
- **Com afecta quivoto.** A Catalunya hi haurà desenes de milers de candidats, i la gran majoria no seran mai regidors. Combinar-los amb Wikidata, fotos o d'altres fonts (J27 ja busca per nom i lloc de naixement) crearia perfils de particulars.
- **Què cal fer.** (1) Per als candidats no electes: només nom, posició, llista i municipi. Sense foto (tret que la cedeixi la persona o el partit), sense Wikidata, sense pàgina pròpia indexable (`noindex` i fora del sitemap). (2) Conservació: les llistes completes es retiren o s'anonimitzen 6 mesos després del 12-06-2027 (constitució dels ajuntaments); només es conserven els agregats i els caps de llista. (3) Fora dels fitxers descarregables: noms només als regidors. (4) Retirada en 72 h a petició, sense ponderació, per als no electes.
- **Esforç** M · **Risc** alt · **Data límit** 21-04-2027 (primera publicació de candidatures).

#### LEG-P5. Excàrrecs, persones mortes i dret a l'oblit
- **Què diu la norma.** Hi ha el dret de supressió (art. 17 RGPD), la sentència Google Spain (STJUE C-131/12), el dret a l'oblit (art. 93 LOPDGDD) i la jurisprudència sobre hemeroteques digitals (STC 58/2018). L'interès històric d'un càrrec públic perdura, sobretot per als alcaldes, però s'afebleix per als regidors de fa anys i per a les dades que no són del càrrec. El RGPD no s'aplica a les persones mortes (considerant 27), però l'art. 3 de la LOPDGDD permet als hereus demanar l'accés, la rectificació o la supressió.
- **Com afecta quivoto.** Hi ha ~2.900 alcaldes des del 1979 amb trajectòria i ~230 retrats, i caldrà gestionar el canvi de mandat del 2027.
- **Què cal fer.** Una política de conservació per nivells. Alcaldes: es manté el nom, el càrrec i el mandat amb interès d'arxiu. Regidors no alcaldes, quan deixen el càrrec: es manté el nom, el càrrec i el mandat; l'enriquiment (foto, ofici, any de naixement) es retira i la pàgina es desindexa 12 mesos després, tal com ja proposa `docs/metodologia/05-neutralitat-i-dades.md` §5 (decisió D3). Hereus: una via de petició a la política. Cada sol·licitud es resol amb la ponderació documentada.
- **Esforç** M · **Risc** mitjà · **Data límit** 12-06-2027 (canvi de mandat, F4-6).

#### LEG-P6. Retribucions amb nom: correcte, però cal dir-ho i fixar-ne els límits
- **Què diu la norma.** El criteri CTBG-AEPD CI/001/2015 ([PDF](https://www.aepd.es/documento/ci-001-2015.pdf-0)) diu que la retribució dels alts càrrecs es pot donar amb nom, «en cómputo anual y en términos íntegros», sense desglossar (un desglossament podria revelar afiliació sindical o salut). L'art. 11.1.b de la Llei 19/2014 imposa publicar les retribucions dels alts càrrecs. L'Ajuntament de Barcelona les publica amb llicència CC BY 4.0.
- **Com afecta quivoto.** J22 ja segueix bones regles: no sumar fonts, no atribuir files de l'ISPA sense nom, distingir assistències de sou. Només cal que la política ho digui.
- **Què cal fer.** Posar-ho a la política (LEG-P3): import brut anual, pagador, any i font; mai desglossaments ni imports inferits. Conservar el test d'homònims.
- **Esforç** S · **Risc** baix.

#### LEG-P7. Categories especials a Wikidata: falta una llista tancada de propietats
- **Què diu la norma.** L'afiliació a la llista d'un partit és una opinió política que la persona ha fet **manifestament pública** (art. 9.2.e), i és lícita per als càrrecs i candidats en aquest context. No ho són altres propietats de Wikidata: religió (P140), orientació sexual (P91), grup ètnic (P172), afiliació sindical, ni el partit fora de la llista actual sense font.
- **Com afecta quivoto.** J21 descarta P26 i P1971 (cònjuge i fills), cosa bona. Però no hi ha cap llista tancada en codi que impedeixi que un canvi futur hi afegeixi propietats sensibles.
- **Què cal fer.** Una llista tancada de propietats de Wikidata permeses (P39, P106, P569 només l'any, P18, P580/P582, sitelinks) en un mòdul compartit, i un test que falli si una consulta SPARQL en demana cap altra.
- **Esforç** S · **Risc** mitjà.

#### LEG-P8. La brúixola tracta opinions polítiques: com evitar-ho del tot
- **Què diu la norma.** Les opinions polítiques són dades de categoria especial (art. 9.1 RGPD). L'**art. 9.1 LOPDGDD** diu que «el solo consentimiento del afectado no bastará para levantar la prohibición» quan la finalitat principal sigui identificar la ideologia ([text](https://papelea.com/es/leyes/ley-organica-de-proteccion-de-datos-personales-y-garantia-de-los-derechos-digitales/titulo-ii)). L'art. 22.2 LSSI (art. 5.3 ePrivacy) cobreix qualsevol emmagatzematge al dispositiu, `localStorage` inclòs, però exclou el que és estrictament necessari per al servei que demana l'usuari.
- **Com afecta quivoto.**
  1. El disseny actual desa les respostes a `localStorage` (`prova.ts:373-376`) i no les envia. És el millor patró: quivoto no tracta respostes. És necessari per al servei, i per tant no demana consentiment.
  2. **L'enllaç per compartir previst amb `?r=`** (`METODOLOGIA.md` §5) posa les respostes a la *query*. La *query* arriba als ***logs*** **d'Apache/OVH**, als de Cloudflare si s'activa (F0-6) i a **GA**, que desa la `page_location`. En aquell moment quivoto i Google **tracten opinions polítiques vinculades a una IP**, sense cap base de l'art. 9.2.
  3. L'analítica agregada que preveu `docs/metodologia/05-neutralitat-i-dades.md` §6 (esdeveniments «resposta donada», `session_hash`) és acceptable només si no conté mai el valor de la resposta ni la candidatura resultant.
  4. Un futur «desa el meu resultat» o un ús en recerca necessitaria l'art. 9.2.j amb les garanties de l'art. 89. El consentiment sol no n'hi ha prou a Espanya.
- **Què cal fer.** (1) Compartir amb **fragment** (`#r=…`), que el navegador no envia mai al servidor, i, encara millor, compartir només el resultat sense les respostes (com F3-4). (2) Cap etiqueta d'analítica ni de tercers a les pàgines de la brúixola, també quan l'analítica sigui pròpia. (3) Filtrar la *query* dels *logs* del servidor, o anonimitzar-ne la IP, a les rutes de la brúixola. (4) Escriure a la metodologia que la imatge OG del resultat revela coincidències quan l'usuari la comparteix. (5) Prohibir per escrit l'emmagatzematge de respostes al servidor sense una AIPD específica.
- **Esforç** S · **Risc** alt si es llança amb `?r=` i GA · **Data límit** abans de publicar la brúixola completa (F3-4).

#### LEG-P9. AIPD, registre d'activitats, ponderació i DPD
- **Què diu la norma.** La [llista de l'AEPD per a l'art. 35.4](https://www.aepd.es/documento/listas-dpia-es-35-4.pdf) fa obligatòria l'AIPD quan es compleixen **dos o més** criteris. quivoto en compleix almenys quatre: **7** (gran escala: ~9.150 regidors, ~2.900 exalcaldes i les candidatures del 2027), **8** (combinació de bases de dades amb finalitats o responsables diferents: AOC, Wikidata, ISPA, Barcelona, diputacions, seu-e), **11** (dades obtingudes d'un altre responsable sense informar la persona, art. 14.5.b) i **10** (inferència amb LLM). També podria complir el **4** (opinió política a gran escala). L'art. 30 obliga a portar registre d'activitats quan el tractament no és ocasional, també en una pime. El DPD de l'art. 37.1.c és obligatori si l'activitat principal és tractar categories especials a gran escala.
- **Com afecta quivoto.** No consta ni l'AIPD, ni el registre, ni la ponderació. Si el partit com a dada d'opinió política es considera «activitat principal», el DPD pot ser obligatori. **[ADVOCAT]**
- **Què cal fer.** (1) Registre d'activitats amb 4 tractaments: subscriptors, persones públiques, candidats 2027 i analítica. (2) AIPD de «persones públiques i candidats» amb la ponderació a dins. (3) Designar un contacte de privacitat (bústia `privacitat@`) i decidir amb l'advocat si cal DPD. (4) Revisar l'AIPD abans de cada font nova de dades personals.
- **Esforç** M · **Risc** alt · **Data límit** 1-03-2027.

#### LEG-P10. Informar les persones afectades (art. 14) i els partits
- **Què diu la norma.** L'art. 14.5.b eximeix d'informar cada persona quan l'esforç és desproporcionat, però obliga a «fer pública la informació» i a prendre mesures adequades.
- **Què cal fer.** (1) Un enllaç «Sóc aquesta persona: corregir o oposar-me» a cada fitxa de persona (amplia TEC-S3). (2) Al qüestionari i a la «fitxa prèvia» que s'envia a cada candidatura, una clàusula informativa breu sobre quines dades dels candidats es publiquen, amb quina base i com oposar-s'hi. És un canal real per arribar als afectats.
- **Esforç** S · **Risc** mitjà · **Data límit** gener 2027.

#### LEG-P11. Encarregats del tractament i transferències
- **Què diu la norma.** Cal un contracte d'encàrrec per escrit (art. 28) i, per a les transferències internacionals, una base del capítol V.
- **Com afecta quivoto.** Hi intervenen OVH, estic.online, Google (GA), Cloudflare (previst) i el futur proveïdor d'enviament de correu. Les transferències de GA als EUA es poden fer amb el Data Privacy Framework (decisió d'adequació del 10-7-2023, confirmada pel Tribunal General a T-553/23 el setembre del 2025; verificar).
- **Què cal fer.** Arxivar els contractes d'encàrrec (DPA) de cada proveïdor i llistar els encarregats a la política. Triar un proveïdor de correu amb seu a la UE.
- **Esforç** S · **Risc** baix.

### C. Galetes, analítica i butlletí

#### LEG-C1. Analítica: com s'ha de resoldre i fins quan (amplia TEC-S2)
- **Què diu la norma.** Art. 22.2 LSSI i [Guia de galetes de l'AEPD](https://www.aepd.es/documento/guia-cookies.pdf) (juliol 2023, exigible des de l'**11-01-2024**). El botó de rebutjar ha d'estar a la primera capa amb la mateixa visibilitat que el d'acceptar ([Cuatrecasas](https://www.cuatrecasas.com/es/spain/propiedad-intelectual/art/entra-vigor-nuevo-criterio-aepd-uso-de-cookies)). Remetre a la configuració del navegador no és vàlid. L'analítica de tercers com GA necessita consentiment; segons la lectura habitual, l'analítica pròpia, agregada i sense perfilat pot quedar exempta ([Legiscope](https://www.legiscope.com/blog/bandera-cookies-aepd-conformidad-2026.html)). Sancions LSSI: fins a 30.000 € (lleu) i 150.000 € (greu).
- **Com afecta quivoto.** GA s'injecta a totes les pàgines (`publish.ts:54-71`). Durant el període electoral, que un projecte de «neutralitat» enviï a Google la navegació per pàgines de partits i candidats té un cost reputacional desproporcionat.
- **Què cal fer.** Decisió D1: analítica pròpia, sense galetes, o *logs* agregats. Si es manté GA: bàner amb «Rebutja» al mateix nivell, Consent Mode en mode bàsic (cap etiqueta abans del consentiment) i una pàgina de galetes separada. En tots dos casos, cap analítica a la brúixola (LEG-P8). Corregir també `docs/metodologia/05-neutralitat-i-dades.md` §6.
- **Esforç** S · **Risc** alt · **Data límit** abans d'indexar (gener 2027).

#### LEG-C2. Butlletí: prova del consentiment i calendari d'enviaments (amplia TEC-S5)
- **Què diu la norma.** L'art. 7.1 RGPD obliga a poder **demostrar** el consentiment. L'art. 21 LSSI regula les comunicacions comercials per correu. Un avís informatiu d'un projecte cívic potser no és «comercial», però l'emissor és una SL; per prudència, convé aplicar-lo. L'art. 20 LSSI obliga a identificar l'emissor.
- **Què cal fer.** (1) Desar, per a cada alta, la prova: data i hora, versió del text del formulari i de la casella, idioma, hash de la IP i data de confirmació del doble *opt-in*. (2) Una plantilla de correu amb l'emissor (Damos en el Blanco, S.L., NIF), el motiu de l'enviament i la baixa amb un clic. (3) Cap enviament el 22-05 ni el 23-05 abans de les 20:00, i cap contingut que demani el vot (LEG-E2/E3). (4) Complir l'esborrat promès per al 31-12-2027 amb una tasca programada.
- **Esforç** S (a sumar al M de TEC-S5) · **Risc** mitjà · **Data límit** abans del primer enviament massiu.

#### LEG-C3. Falten dades obligatòries de l'art. 10 LSSI a l'avís legal
- **Què diu la norma.** L'art. 10.1.b LSSI exigeix les dades d'inscripció al **Registre Mercantil** (tom, foli, full) de qui presta el servei.
- **Com afecta quivoto.** L'avís legal té la denominació, el CIF, l'adreça i el correu, però no les dades registrals.
- **Què cal fer.** Afegir-les.
- **Esforç** S · **Risc** baix.

### D. Propietat intel·lectual, bases de dades i llicències

#### LEG-L1. Fonts oficials: com s'han de citar
| Font | Condicions | Font de la condició | Acció |
|---|---|---|---|
| Generalitat (dades obertes) | Llicència oberta d'ús d'informació – Catalunya, o CC0: citar la font, la data d'actualització i no desnaturalitzar. Format de crèdit: «Generalitat de Catalunya. Departament de …» | [Avís legal gencat](https://tramits.gencat.cat/ca/ajuda/avis_legal/) | Revisar que cada bloc porti el departament i la data |
| Idescat | Citar «Font: Idescat» o «elaboració pròpia a partir de dades de l'Idescat» i la data d'actualització; no suggerir patrocini; no fer servir el logotip | [Idescat, avís legal](https://idescat.cat/institut/web/) | Aplicar-ho a les fonts noves de FON (IST, etc.) |
| INE | Citar la font, sense alterar **(verificar l'avís legal de l'INE)** | — | Ídem |
| AOC (dadesobertes.seu-e.cat) | CC0 per als conjunts d'abast català; alguns municipals són NC i no es fan servir (correcte) | `privadesa.html` | Mantenir el filtre de llicència a `dades.ts` |
| Ajuntament de Barcelona | CC BY 4.0: atribució | J22 | Ja ho fa |
| Diputació de Barcelona | CC BY 4.0, amb clàusula de dades personals: base de l'art. 6.1 i **prohibició de reidentificar** | [Condicions DIBA 2024](https://transparencia.diba.cat/sites/transparencia.diba.cat/files/public/imce/comuns/2024_condicions_reutilitzacio_0.pdf) | Citar-la a la política (J24) |
| Hisenda (ISPA, CONPREL) | RD 1495/2011: citar la font i la data, i no alterar | `privadesa.html` | Ja ho fa |
- **Esforç** S · **Risc** baix.

#### LEG-L2. Fotos de les seus electròniques (J11): drets d'autor sense llicència
- **Què diu la norma.** Una fotografia té drets d'autor (art. 10 TRLPI) o, si és una «mera fotografia», un dret de 25 anys (art. 128). L'art. 17 de la Llei 19/2014 fa lliure la reutilització «llevat» de la protecció d'altres drets, i la Llei 37/2007 exclou els documents sobre els quals tercers tenen drets de propietat intel·lectual. Publicar la foto en un portal de transparència **no** n'autoritza la reutilització.
- **Com afecta quivoto.** J11 descarrega els retrats del mòdul «Càrrecs electes» de seu-e, que no és un conjunt de dades obertes amb llicència. Una reclamació és poc probable, però possible (un fotògraf professional contractat per l'ajuntament). L'art. 8.2.a LO 1/1982 cobreix el dret a la imatge dels càrrecs públics, no els drets d'autor de la foto.
- **Què cal fer.** (1) Preguntar per escrit al Consorci AOC quin règim tenen les fotos del mòdul. (2) Mantenir el crèdit i la retirada en 72 h, ja promesos. (3) Prioritzar les fotos cedides per la persona o el partit, amb casella de drets (ordre 1 de `docs/metodologia/05-neutralitat-i-dades.md` §5). (4) Cap foto de seu-e als fitxers descarregables ni a les imatges OG.
- **Esforç** S–M · **Risc** mitjà-baix.

#### LEG-L3. Wikimedia Commons, Wikidata i Viquipèdia
- **Què diu la norma.** La majoria de fitxers de Commons són CC BY-SA. Cal citar el títol, l'autor, la font i la llicència. Una adaptació (un retall o un reenquadrament) s'ha de compartir amb la mateixa llicència. Commons **no** gestiona els drets d'imatge de la persona retratada. Wikidata és CC0. Els textos de la Viquipèdia són CC BY-SA.
- **Com afecta quivoto.** `fotos-wikidata.ts` i J28 ja citen l'autor, la llicència i l'enllaç, cosa bona.
- **Què cal fer.** (1) Indicar «retallada» quan la miniatura es retalli i dir que la versió retallada té la mateixa llicència. (2) Fer que el crèdit acompanyi la imatge en qualsevol reutilització (JSON, descàrregues). (3) No copiar mai text de la Viquipèdia; només enllaçar-hi.
- **Esforç** S · **Risc** baix.

#### LEG-L4. BOP, actes municipals i dades de tercers dins de les cites
- **Què diu la norma.** L'art. 13 TRLPI exclou de la propietat intel·lectual les disposicions legals i els actes i resolucions dels òrgans públics. Les cites d'actes i de BOP, per tant, es poden reproduir. Però les actes contenen **dades de tercers**: veïns, treballadors, sancionats, persones que fan al·legacions.
- **Com afecta quivoto.** L'extractor conservarà la cita literal com a evidència (`METODOLOGIA.md`). Una cita amb el nom d'un veí denunciat o d'un empleat és tractament de dades d'un particular sense cap relació amb l'interès electoral.
- **Què cal fer.** Pas obligatori de **pseudonimització de tercers** a les cites: substituir els noms de persones que no siguin càrrecs per «[persona particular]». Test amb *fixtures* reals. Afegir-ho als criteris de verificació literal.
- **Esforç** M · **Risc** mitjà · **Data límit** abans de publicar la primera cita d'acta.

#### LEG-L5. Llicència de les dades pròpies i les dades personals que contenen (amplia F1-7/D4)
- **Què diu la norma.** La CC BY 4.0 també cobreix el dret *sui generis* sobre bases de dades (art. 133 TRLPI). Però una llicència de propietat intel·lectual **no** autoritza tractar dades personals: qui reutilitza n'és el responsable.
- **Com afecta quivoto.** L'avís legal declara CC BY 4.0, i el README diu només «citant quivoto».
- **Què cal fer.** (1) Unificar CC BY 4.0 al README, a la pàgina de dades i al `datapackage.json` (F2-9). (2) Afegir a les descàrregues: «Els noms de persones que conté aquest fitxer són dades personals; la llicència no n'autoritza usos incompatibles amb la finalitat informativa (màrqueting, perfilat, solvència)», copiant la clàusula de la DIBA. (3) Valorar treure els noms dels fitxers massius i deixar-los només a les fitxes.
- **Esforç** S · **Risc** mitjà.

### E. Honor, rectificació i correccions

#### LEG-H1. Risc d'intromissió en l'honor per afirmacions automàtiques
- **Què diu la norma.** LO 1/1982 (honor, intimitat i imatge) i art. 20.1.d CE. La informació **veraç** sobre actes públics de persones públiques té una protecció molt forta. La veracitat s'entén com a **diligència en la comprovació**, no com a exactitud absoluta.
- **Com afecta quivoto.** Hi ha quatre punts febles. (a) Posicions auto-aprovades per LLM, on una «aprovació automàtica» és difícil de defensar com a diligència. (b) Un homònim mal aparellat a Wikidata atribueix un ofici o una trajectòria a una altra persona; J27 busca per nom. (c) Una frase del tipus «el grup X va votar contra Y» quan el vot era per una altra raó; la metodologia ja ho admet. (d) Una retribució atribuïda a la persona equivocada.
- **Què cal fer.** Revisió humana obligatòria en campanya (LEG-E9). Cap enriquiment de Wikidata sense un segon criteri d'aparellament, que ja existeix, ni sense registre de la prova. El text de cada posició ha de dir «va votar», no «està en contra». Estat «En revisió» amb sortida del càlcul (ja previst). Conservar l'evidència de cada afirmació 4 anys com a prova de diligència.
- **Esforç** M · **Risc** mitjà.

#### LEG-H2. Dret de rectificació: adoptar-lo voluntàriament
- **Què diu la norma.** La LO 2/1984 s'aplica als «medios de comunicación social». Quan es rep una rectificació, s'ha de publicar **en 3 dies**, amb el mateix relleu i «sin comentarios ni apostillas». L'**art. 85.2 LOPDGDD** obliga els mitjans digitals a afegir als seus arxius un **avís aclaridor** al costat de la informació original. El Tribunal Suprem, l'11-1-2024, va dir que les dues obligacions es complementen ([Cuatrecasas](https://www.cuatrecasas.com/es/latam/tecnologia-medios-digitales/art/cual-alcance-derecho-rectificacion-medios-digitales)).
- **Com afecta quivoto.** L'avís legal diu «No som un mitjà de comunicació». **[ADVOCAT]** Un web que publica informació d'actualitat sobre candidats pot ser considerat mitjà a efectes de la LO 2/1984. En qualsevol cas, adoptar-ne el procediment és la millor defensa.
- **Què cal fer.** Aplicar el protocol de la secció 3.
- **Esforç** S · **Risc** mitjà.

#### LEG-H3. Decidir conscientment si quivoto és o no és periodisme
- **Què diu la norma.** El TJUE, a l'assumpte C-199/24 (9-7-2026, [comunicat](https://curia.europa.eu/site/upload/docs/application/pdf/2026-07/cp260100es.pdf)), diu que una base de dades de persones accessible en línia no és «en principi» periodisme. Perquè hi hagi finalitat periodística, cal informar el públic amb **estàndards ètics i professionals, treball editorial i verificació**. Espanya no té un desenvolupament complet de l'art. 85 RGPD ([Xnet](https://xnet-x.net/en/xnet-lack-transposition-art85-spain-freedom-information-data/)).
- **Com afecta quivoto.** En dir «no fem periodisme», quivoto renuncia a la protecció reforçada de la llibertat d'informació i queda pendent només del RGPD general (6.1.f). Probablement és la posició honesta per a l'Observatori. La brúixola, amb verificació i treball editorial, s'acosta al criteri del TJUE.
- **Què cal fer.** Decidir amb l'advocat com es descriu: per exemple, «projecte d'informació cívica amb estàndards editorials publicats», en lloc de negar qualsevol funció periodística. Ajustar l'avís legal en conseqüència.
- **Esforç** S (decisió) · **Risc** mitjà.

### F. Accessibilitat i llengua

#### LEG-A1. Accessibilitat: no hi ha obligació legal clara, però sí un compromís de credibilitat
- **Què diu la norma.** El RD 1112/2018 obliga només el sector públic. La Llei 11/2023, que transposa l'Acta Europea d'Accessibilitat i és aplicable des del 28-06-2025, cobreix serveis concrets (comerç electrònic, banca, llibres electrònics, transport, comunicacions) ([Cuatrecasas](https://www.cuatrecasas.com/es/global/propiedad-intelectual/art/claves-proxima-entrada-vigor-ley-accesibilidad-espana)). Un web informatiu sense venda no hi entra, i la Directiva 2019/882 (art. 4.5) eximeix les microempreses que presten serveis (verificar l'equivalent a la Llei 11/2023). Hi ha principis generals de no-discriminació al RDL 1/2013 i a la Llei catalana 13/2014.
- **Com afecta quivoto.** No consta cap obligació directa **[ADVOCAT: confirmar la mida de l'SL]**. Però una eina electoral que no pot fer servir una persona cega o gran contradiu el discurs de neutralitat.
- **Què cal fer.** Fixar com a objectiu WCAG 2.2 AA a la brúixola i a les fitxes (F1-9 ja en té una part) i publicar una **declaració d'accessibilitat** voluntària amb els límits coneguts i un contacte.
- **Esforç** S (declaració) · **Risc** baix.

#### LEG-A2. Llengua
- **Què diu la norma.** La Llei 1/1998 de política lingüística i el Codi de consum obliguen les empreses que ofereixen serveis al públic a poder atendre en català i en castellà. L'aranès és oficial a l'Aran (Llei 35/2010).
- **Com afecta quivoto.** Ho compleix: el català és la llengua principal i hi ha la versió quienvoto.es.
- **Què cal fer.** Respondre les sol·licituds de drets i les reclamacions en la llengua en què arribin. Opcionalment, la brúixola en aranès per als 9 municipis de l'Aran, com a gest de neutralitat.
- **Esforç** S · **Risc** baix.

### G. Governança i transparència

#### LEG-G1. Qui hi ha darrere, conflictes d'interès i finançament
- **Referents.** L'[IFCN](https://ifcncodeofprinciples.poynter.org/the-commitments) demana: forma jurídica; **cada font que aporti ≥5 % dels ingressos** de l'any anterior; qui té el control editorial; biografies de qui hi té un paper rellevant; política de no-partidisme del personal. [Civio](https://civio.es/en/about-us/clear-accounts/) publica comptes anuals **auditats** des del 2015, els donants amb nom (cap donació anònima) i cada subvenció amb import. La declaració de Lausana sobre brúixoles electorals (2013–2014, a Garzia i Marschall, *Matching Voters…*, ECPR Press, p. 227; verificar el text) i la [revisió de la fiabilitat de les brúixoles europees](https://link.springer.com/article/10.1007/s10676-024-09790-6) (2024) valoren la transparència del mètode, del finançament i de la privadesa. En aquesta revisió, el Wahl-O-Mat i StemWijzer surten ben valorats perquè no desen les respostes o només les desen agregades.
- **Com afecta quivoto.** Hi ha el titular (SL) i el compromís de no rebre diners de partits. Però: (a) no hi ha cap persona responsable amb nom (`docs/metodologia/05-neutralitat-i-dades.md` §1 ho deixa com a proposta); (b) no es diu a què més es dedica Damos en el Blanco, S.L. ni si té clients públics o polítics. L'avís legal diu «no rebem diners de cap administració»; si l'SL en rep per una altra activitat, la frase s'ha de precisar. (c) No hi ha política d'activitat política del personal.
- **Què cal fer.** Una pàgina «Qui som» amb: el responsable editorial (nom, bio, declaració d'afiliacions); l'activitat i els clients de l'SL dels darrers 4 anys en el sector públic o polític, o una declaració que no n'hi ha; una política de conflictes (qui té un vincle amb una candidatura no participa en la revisió d'aquell municipi); el finançament amb el llindar del 5 % o de 1.000 €; el cost del projecte i qui el paga.
- **Esforç** S · **Risc** alt (credibilitat) · **Data límit** abans del gener 2027.

#### LEG-G2. Estàndards editorials publicats
- **Què cal fer.** Publicar, abans de la brúixola: (1) una declaració d'independència editorial; (2) una **política d'ús d'IA** (com la de Civio): què fa el model, què revisa una persona, el percentatge d'auto-aprovació (ja promès); (3) el registre de correccions `/canvis` amb el comptador; (4) el procediment de reclamacions i de rèplica (ja dissenyat a `docs/metodologia/05-neutralitat-i-dades.md` §3–4); (5) un consell assessor extern de 2–3 politòlegs que revisi les afirmacions compartides i l'equilibri. És una pràctica habitual en brúixoles acadèmiques. **(verificar els casos concrets abans de citar-los)**
- **Esforç** M · **Risc** mitjà · **Data límit** 1-03-2027.

#### LEG-G3. Obertura del mètode (Lausana / Smartvote / StemWijzer)
- **Què cal fer.** Publicar com a dades obertes, per a cada municipi: les afirmacions i les posicions amb l'evidència, la data d'enviament del qüestionari, qui ha respost i el codi de `matching.ts` (MIT, ja previst). Explicar els límits a la mateixa pantalla de resultat («no és un consell de vot», cobertura). Després de les eleccions, publicar un informe de transparència: correccions, reclamacions, temps de resposta.
- **Esforç** M · **Risc** baix.

---

## 3. Protocol pràctic de correccions, rectificació i oposició

Adapta la LO 2/1984, l'art. 85 LOPDGDD, els arts. 12, 16, 17 i 21 del RGPD i els terminis ja promesos a `privadesa.html` i a `docs/metodologia/05-neutralitat-i-dades.md` §3.

1. **Entrada única.** Formulari `/reclamacions` i `hola@` (o `privacitat@`). Tipus: error material / rectificació (honor) / dret RGPD / foto / rèplica de partit. Acusament de recepció automàtic amb número d'expedient.
2. **Triatge en 24 h** (també en cap de setmana durant la campanya, del 7 al 23-05). Una persona diferent de qui va aprovar la dada.
3. **Mesura cautelar.** Si la reclamació és versemblant: «En revisió», fora del càlcul (ja previst). Una foto o un candidat no electe es retira immediatament.
4. **Resolució:**
   - **Error material:** es corregeix en 72 h (24 h en campanya), amb anotació a `/canvis`.
   - **Rectificació de fets que afecten l'honor:** si l'escrit es limita a fets, es publica íntegre **en 3 dies**, amb el mateix relleu, sense comentaris, enllaçat des de la peça original, i amb un **avís aclaridor** a la fitxa (art. 85.2 LOPDGDD). Si quivoto manté la seva versió, pot afegir una nota separada, mai dins de la rectificació.
   - **Oposició (art. 21):** es valora amb la ponderació de LEG-P1. Per a candidats no electes i hereus, s'accepta per defecte. Per a càrrecs en exercici, només es retira el que no és del càrrec. Resposta motivada en ≤1 mes.
   - **Rèplica de partit:** 600 caràcters, sense editar, al costat de la posició. En campanya, en 72 h; mai el 22-05 (LEG-E3).
5. **Comunicació a la font.** Si l'error ve de l'AOC, la Generalitat o Wikidata, s'avisa la font i es diu a qui reclama.
6. **Registre.** Data, tipus, decisió i temps. Un informe agregat trimestral i un altre després de les eleccions.
7. **Escalat.** Si la reclamació ve d'un advocat, menciona la LO 1/1982 o arriba d'una Junta Electoral: es comunica el mateix dia al responsable legal, i no es respon en calent.

---

## 4. Llista de comprovació per al període electoral

| Quan | Què | Ref. |
|---|---|---|
| **Abans del 15-12-2026** | Política de privadesa reescrita (base 6.1.f, AEPD, taula de dades, art. 24/11.1.b); analítica resolta; dades registrals a l'avís legal; enllaç «Corregir o oposar-me» | P1, P2, P3, C1, C3, P10 |
| **Gener 2027** | Qüestionari a partits amb clàusula de privadesa i gratuïtat; política d'IA; pàgina «Qui som» (responsable, SL, finançament, conflictes); consulta a la JEC | E5, E9, G1, E10 |
| **Abans de l'1-03-2027** | AIPD i registre d'activitats; decisió sobre el DPD; ponderació; política de conservació; protocol de reclamacions operatiu; pseudonimització de tercers a les cites | P9, P5, H2, L4 |
| **Abans del 30-03-2027** | Guia d'estil electoral; regla de «cap agregat de brúixola»; fi de la promoció pagada amb partits; cap conveni amb administracions | E1, E2, E3, E6, E7 |
| **30-03 (decret)** | Comença el període electoral: art. 50.5, 53.2 i 69 actius. Revisar textos de xarxes i butlletí | E1–E3 |
| **~21-04 (candidatures presentades)** | Publicar només nom, posició i llista; `noindex` als no electes; res de Wikidata ni fotos | P4 |
| **~26–28-04 (proclamació)** | Qüestionari a les candidatures noves, amb el mateix termini que la resta; mostrar totes les candidatures al resultat de la brúixola | E4 |
| **7-05 → 21-05 (campanya)** | Correccions i rèpliques en 24 h / 72 h; revisió humana de cada posició; registre de reclamacions | H1, H2, E9 |
| **18-05 → 22-05** | **Cap sondeig** propi ni de tercers (tampoc retuits), cap agregat de la brúixola | E1 |
| **22-05 (reflexió)** | Cap butlletí, cap publicació a xarxes sobre partits, cap rèplica nova, cap canvi de funcionalitat; el web es queda com està | E3, C2 |
| **23-05** | Res fins a les 20:00; després, només resultats oficials provisionals | E8 |
| **12-06 (constitució)** | Canvi de mandat; s'activen els terminis de conservació dels no electes i dels excàrrecs | P4, P5 |
| **~12-12-2027** | Retirar o anonimitzar les llistes completes de candidats no electes | P4 |
| **31-12-2027** | Esborrar la llista de correus, tal com es va prometre | C2 |

---

## 5. Les deu accions més importants

| # | Acció | Ref. | Esforç | Risc | Data |
|---|---|---|---|---|---|
| 1 | Canviar la base jurídica a 6.1.f amb ponderació escrita i procediment d'oposició; corregir les citacions (art. 24 i 11.1.b de la Llei 19/2014) | P1 | S+M | alt | 15-12-2026 |
| 2 | Reescriure la política de privadesa perquè digui el que realment es publica (any de naixement, sous, ofici, Commons, caps de llista, candidats 2027) i canviar l'autoritat per l'AEPD | P3, P2 | S–M | alt | 15-12-2026 |
| 3 | Analítica sense galetes, o GA amb consentiment real; **mai** analítica a la brúixola | C1 | S | alt | gener 2027 |
| 4 | Brúixola: compartir amb fragment `#` i no amb `?r=`; cap resposta al servidor ni als *logs* | P8 | S | alt | abans de F3-4 |
| 5 | Política per als candidats no electes del 2027: mínim de dades, `noindex`, retirada a petició, esborrat als 6 mesos | P4 | M | alt | 21-04-2027 |
| 6 | Cap agregat de la brúixola per candidatura durant el període electoral; cap sondeig del 18 al 22-05 | E1 | S | alt | 30-03-2027 |
| 7 | AIPD + registre d'activitats + decisió sobre el DPD amb advocat | P9 | M | alt | 1-03-2027 |
| 8 | Revisió humana signada de cada posició en campanya, i etiqueta d'IA per a la resta (art. 50.4 del Reglament d'IA) | E9, H1 | S–M | mitjà | abans de la primera posició |
| 9 | Pàgina «Qui som»: responsable editorial, activitat i clients de l'SL, finançament ≥5 %, conflictes d'interès, política d'IA | G1, G2 | S | alt (credibilitat) | gener 2027 |
| 10 | Igualtat entre candidatures (totes al resultat, el mateix qüestionari i termini, registre d'enviaments) i guia d'estil electoral (cap crida al vot); consulta a la JEC | E4, E2, E10 | M | mitjà | 28-02 / 27-04-2027 |

---

## 6. Preguntes concretes per a l'advocat

1. Una brúixola privada i neutral pot continuar accessible el 22-05 i del 18 al 22-05? Els agregats anònims d'ús són «sondejos» a efectes de l'art. 69? (Es pot plantejar com a consulta a la JEC.)
2. La base 6.1.f és suficient per publicar els candidats no electes del 2027, amb les mesures de LEG-P4? Quin termini de conservació és defensable?
3. Cal designar un DPD per l'art. 37.1.c, si el partit es considera opinió política a gran escala?
4. Convé que quivoto es presenti com a «mitjà» (LO 2/1984, protecció de la llibertat d'informació) o no?
5. Les posicions inferides per LLM en una brúixola entren a l'annex III, punt 8(b), del Reglament d'IA?
6. Les fotos del mòdul de càrrecs electes de seu-e es poden reutilitzar? Cal llicència de l'AOC o de cada ajuntament?
7. La mida de Damos en el Blanco, S.L. (microempresa o no) i l'aplicació de la Llei 11/2023.

## 7. Fonts principals consultades

- LOREG, text consolidat: https://www.boe.es/eli/es/lo/1985/06/19/5/con · art. 50: https://www.iberley.es/legislacion/articulo-50-regimen-electoral-general · art. 69: https://papelea.com/es/leyes/ley-organica-del-regimen-electoral-general/titulo-primero_capitulo-vi_seccion-viii-encuestas-electorales
- JEC, instruccions: https://www.juntaelectoralcentral.es/cs/jec/doctrina/instrucciones (1/2024, 3/2011, 4/2011, 4/2007, 2/2011) · Acord 502/2023 (enllaç a LEG-E1)
- STS 6-7-2016 (HazteOír): nota del CGPJ (enllaç a LEG-E2)
- Reglament (UE) 2024/900, Guidelines C/2025/5514: https://eur-lex.europa.eu/eli/C/2025/5514/oj/eng/pdf
- Reglament d'IA, FAQ del Service Desk: https://ai-act-service-desk.ec.europa.eu/en/faq
- AEPD: llista AIPD https://www.aepd.es/documento/listas-dpia-es-35-4.pdf · guia de galetes https://www.aepd.es/documento/guia-cookies.pdf · CI/001/2015 https://www.aepd.es/documento/ci-001-2015.pdf-0
- LOPDGDD art. 9: https://papelea.com/es/leyes/ley-organica-de-proteccion-de-datos-personales-y-garantia-de-los-derechos-digitales/titulo-ii
- TJUE C-199/24 (9-7-2026): https://curia.europa.eu/site/upload/docs/application/pdf/2026-07/cp260100es.pdf
- Llei 19/2014: https://cemical.diba.cat/codibasic/fitxers/Llei_19_2014_transparencia_cat.pdf
- Avís legal de la Generalitat: https://tramits.gencat.cat/ca/ajuda/avis_legal/ · Idescat: https://idescat.cat/institut/web/ · DIBA: https://transparencia.diba.cat/sites/transparencia.diba.cat/files/public/imce/comuns/2024_condicions_reutilitzacio_0.pdf
- Wahl-O-Mat, VG Köln 2019: https://jura-online.de/blog/2019/05/21/vg-koln-wahl-o-mat-ist-verfassungswidrig/ · Fiabilitat de les brúixoles europees: https://link.springer.com/article/10.1007/s10676-024-09790-6
- IFCN: https://ifcncodeofprinciples.poynter.org/the-commitments · Civio: https://civio.es/en/about-us/clear-accounts/
