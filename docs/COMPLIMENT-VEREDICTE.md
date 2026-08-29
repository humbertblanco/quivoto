# Veredicte sobre el comptador de promeses

**29 d'agost de 2026.** Aquest document respon a una sola pregunta: el comptador de promeses de
quivoto es pot fer o no. La resposta surt d'haver-ho provat una vegada de veritat, sobre el
programa del PSC de Reus del 2023, amb la mostra i les xifres que hi ha a
[COMPLIMENT.md §8](COMPLIMENT.md) i el detall a
`packages/pipeline/src/publish/promeses-mostra.json`.

## Es pot fer?

**Tècnicament sí, i el resultat és pobre.** Sobre una mostra sistemàtica de 20 de les 260 accions
numerades del programa d'una candidatura que **governa** —el millor cas possible, perquè només qui
governa deixa rastre—, classificades a cegues abans de mirar cap document:

- **14 de 20 (70%)** eren verificables o parcialment verificables abans de buscar res.
- **4 de 20 (20%)** s'han pogut resoldre amb un document: 2 complertes i 2 en curs.
- **16 de 20 (80%)** han quedat en **no verificable**, i 6 d'aquestes ho eren des del primer dia
  perquè el text era una intenció.
- **0 incomplertes**, i no per prudència: el mandat acaba el 23 de maig de 2027 i la regla
  d'absència de COMPLIMENT.md §2 exigeix que el mandat s'hagi acabat.

Dit altrament: de cada cinc promeses del partit que mana, quatre no es poden respondre avui. La
xifra que aquest projecte publicaria no seria un percentatge de compliment, seria **«el 80% no ho
sabem»**, i seria una xifra honesta però gairebé inútil per a qui vota.

Tres coses valen més que aquest percentatge, i les tres són sorpreses reals:

1. **La verificabilitat prèvia no prediu res.** De les 5 promeses classificades V1 —les més
   concretes i acreditables— només 1 s'ha resolt. De les 9 V2, 3. El filtre V1/V2/V3 mesura la
   qualitat de l'escriptura del programa, no la probabilitat de trobar el document.
2. **Els registres exhaustius fan la feina; el text no.** Les 3 úniques absències que es poden
   defensar —cap convocatòria d'ajuts a joves ni de beques de recerca entre les 450 de la BDNS,
   cap revisió de l'ordenança d'activitats en 45 actes de ple— venen de registres que publiquen
   *sempre* i *tot*. Cercar per paraules dins les actes va donar zero en 9 de 14 casos.
3. **Un llindar V2 laxe premia la continuïtat.** La promesa 209 («impuls del programa CER de
   colònies felines») surt complerta perquè hi ha contractes de veterinari, però el servei ja
   existia abans del mandat. El llindar mesurava existència i el verb prometia creixement. Això és
   un error nostre, i seria sistemàtic: mig programa municipal està escrit amb «impulsar» i
   «potenciar».

## A quin abast

**Només els pilots, i a estirar molt, els 70 municipis de més de 20.000 habitants.** L'abast el
limita el mateix embut que [EXTRACCIO-ACTES.md §3](EXTRACCIO-ACTES.md) ja va trobar per als vots,
agreujat per un embut nou: **el programa del 2023 s'ha de poder trobar quatre anys després**, i el
rastreig d'agost de 2026 sobre quatre municipis diu que sovint no. Els 947 municipis són
impensables: ni hi ha programes recuperables, ni actes a la meitat, ni hores.

## Què costa

Mesurat sobre aquesta passada, no estimat de memòria:

| Partida | Aquesta mostra (20 promeses) | Projecció a 260 promeses |
|---|---|---|
| Descàrrega i conversió del corpus | 45 actes, 16,2 MB, ~3 min | igual: **és cost fix per municipi**, no per candidatura |
| Consultes als registres | PSCP (1.084), BDNS (450), convenis (56), ~2 min | igual, cost fix per municipi |
| Cerca d'evidència amb el model | ~25 min de sessió | ~5 h si es fa amb agent exploratori |
| Cost d'IA ben arquitecturat | — | **35-40 € amb Claude Opus 5, 15-20 € amb Sonnet 5** (una crida per promesa, ~20k tokens d'entrada de resultats de `grep` i ~2k de sortida) |
| Cost d'IA fet com aquí, amb agent | — | 250-400 € sense memòria cau: **l'agent exploratori és 8 vegades més car** |
| **Persona obrint cada document citat** | ~40 min | **3-5 h per candidatura** |

El coll d'ampolla no són els diners d'IA: són les hores de persona. COMPLIMENT.md §6 no és
negociable —dues signatures per a «complerta» i «incomplerta»—, i això vol dir 3-5 h humanes per
candidatura. Els 70 municipis de més de 20.000 habitants són unes 420 candidatures: **entre 1.300 i
2.100 hores**, una persona a temps complet durant un any. Els quatre pilots són ~20 candidatures:
**80-100 hores**. Això sí que es pot fer.

## Els tres riscos més grans

1. **Publicar un percentatge que mesura la transparència de l'ajuntament i no el compliment del
   partit.** És el risc que mata el projecte per reputació. *Mitigació:* mai un percentatge únic;
   sempre el denominador i el nombre de no verificables al davant, i mai comparar municipis, tal
   com ja diu COMPLIMENT.md §5.
2. **Que el llindar V2 decideixi el veredicte en comptes del document.** S'ha vist en viu a la
   promesa 209. *Mitigació:* prohibir el llindar «existeix un contracte» per a verbs de creixement;
   exigir que el llindar digui **respecte de què** creix i amb quina xifra base, o baixar la
   promesa a V3.
3. **El buit de la junta de govern local.** Reus publica 45 actes de ple i **cap acta de junta de
   govern** al recurs de l'AOC, i és a la junta on s'aproven la majoria de plans i bases. Tota
   promesa de «fer un pla» és irresoluble per construcció. *Mitigació:* no acceptar mai «no
   verificable» com a incomplerta fora dels tres registres realment exhaustius —BDNS, ordenances al
   BOPT via ple, i perfil del contractant— i dir-ho a la fitxa.

## Recomanació

**Ajornar el comptador retrospectiu del 2023 i recollir els programes del 2027 el dia que surtin.**

Fer-lo ara costaria un any de persona per obtenir, en el millor cas, quatre de cada cinc caselles
buides. I la meitat d'aquell buit no és culpa dels partits ni nostra: és que el document que
acreditaria el fet no s'ha publicat mai, o s'ha publicat en un lloc que no és cap registre.

El que sí que s'ha de fer, i és barat:

- **Publicar aquesta mostra tal com és**, com a peça de mètode, amb les xifres al davant i sense
  veredicte de candidatura. Té valor perquè diu una cosa certa: *els programes municipals estan
  escrits perquè no es puguin comprovar*.
- **Fer el mateix exercici, exactament igual, sobre una candidatura de l'oposició** abans de tancar
  cap decisió. Aquesta prova s'ha fet sobre qui governa, que és el cas favorable; sense el cas
  desfavorable la comparació de vies `ple` i `grup` de COMPLIMENT.md §4 continua sense mesurar.
- **Deixar muntada la canonada de registres**, que és el que ha funcionat: PSCP, BDNS i convenis
  responen per codi i no per paraules, i serveixen igual el 2027.

### El que va al calendari

| Data | Què |
|---|---|
| **Abril de 2027** | Recollir els programes del 2027 el mateix dia que es publiquin, amb còpia local, URL i empremta. És l'única finestra en què existeixen tots alhora. |
| **Abril de 2027** | Congelar la classificació de verificabilitat de cada programa **abans** del 23-M, i publicar-la. Fer-ho abans de l'elecció és el que impedeix acomodar-la després. |
| **Maig de 2027** | Publicar, per candidatura, quantes promeses V1 té el seu programa. És una dada del programa, no del compliment, i es pot dir el dia 1. |
| **Últim ple del mandat 2027-2031** | Única data en què el comptador pot emetre «incomplerta». Abans, no. |

I una nota que val per a tot el projecte: el 2023 ja no es pot arreglar, però el 2027 sí. Un
programa arxivat el dia que surt costa deu minuts; recuperar-lo quatre anys després costa una
setmana i sovint no es pot.
