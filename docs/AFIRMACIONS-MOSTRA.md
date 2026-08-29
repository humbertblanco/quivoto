# La primera mostra d'afirmacions: què hem après

**29 d'agost de 2026.** Set agents han redactat les 25 afirmacions de la brúixola per a
Barcelona, l'Hospitalet de Llobregat, Terrassa, Badalona, Sabadell, Esplugues de Llobregat i
Sant Just Desvern, seguint [la metodologia](metodologia/01-afirmacions.md). Sis crítics les
han repassades: dos buscant biaix, dos comptant regles i paraules, i dos comprovant que
l'evidència existís.

**Veredicte: esmenes greus. Cap dels set conjunts no és publicable tal com està.** Les
afirmacions es conserven a `packages/pipeline/src/publish/afirmacions/` perquè el valor
d'aquest exercici no són elles, és el que ha ensenyat.

## El que sí que funciona

Les regles de redacció es compleixen sense esforç. **Cap de les 175 afirmacions no passa de
25 paraules** —el màxim absolut és 24—, cap no porta nom propi de persona ni de candidatura,
totes són en futur i en forma de proposta, i els set conjunts compleixen la cobertura
temàtica i l'equilibri direccional: entre el 44 % i el 56 % d'afirmacions on el govern actual
cau del costat de l'«acord», dins de la forquilla del 40-60 %.

I hi ha una demostració que això es pot fer bé: **a Sabadell, 24 de les 25 afirmacions pengen
d'una votació nominal verificada a mà**, de 660 votacions extretes de les actes, 533 de les
quals no unànimes. Quan les actes desglossen el vot, el mètode funciona.

## El que falla, i per què no és un problema de redacció

**Cap dels set municipis no té una sola afirmació lligada a una cita literal d'un programa
electoral del 2023.** La metodologia en demana un mínim de cinc i diu que sense això no es
publica el conjunt local. Això lliga amb el que ja havia trobat
[el veredicte del comptador de promeses](COMPLIMENT-VEREDICTE.md): els programes del 2023
sovint no es poden localitzar quatre anys després.

**A l'Hospitalet i a Terrassa no hi ha cap afirmació lligada a un vot del ple citable per
grup**, quan el mínim són vuit. No és desídia dels agents:

- **L'Hospitalet només publica extractes d'acords, sense el sentit del vot.** La regla que
  se'n va derivar —«moció rebutjada vol dir que el govern hi era en contra»— garanteix per
  construcció que el govern tingui posició documentada i l'oposició, inferida. I deixa fora
  justament les votacions on el govern va perdre, que són les úniques on una oposició de 14
  regidors es va imposar.
- **Terrassa no té cap acta d'aquest mandat accessible**: divuit de les 25 afirmacions surten
  de premsa local, que segons la nostra pròpia metodologia és font no promocionable.

## Els sis patrons d'error, i com els evitarem

Aquests són la troballa que val la pena, perquè es repeteixen als set municipis i cap d'ells
no és obvi fins que algú te'ls ensenya.

1. **Els paràmetres exactes de la política del govern.** «Un euro l'any fins a vuit»,
   «vint-i-quatre euros», «cinc anys». Qui ha decidit aquella xifra treu coincidència perfecta
   i qualsevol altra proposta es converteix en un «no». → Les afirmacions han de proposar una
   **direcció**, no una xifra que ja existeix.
2. **La versió maximalista de la posició contrària.** «Tot» l'habitatge protegit, multes de
   900.000 €, «tots» els vehicles. Dir que sí a l'oposició sembla irraonable. → Si una banda
   surt caricaturitzada, l'afirmació no discrimina: mesura si el lector és raonable.
3. **Els verbs «continuar» i «mantenir».** Obliguen a saber com estan les coses ara i premien
   qui mana. → En futur i sense pressuposar l'statu quo.
4. **Obvietats amb verb buit**: «garantir», «millorar», «més diners a». El «no» és
   indefensable en abstracte perquè el cost queda amagat al context. → Si ningú sensat pot
   estar-hi en contra, fora.
5. **La finalitat dins de l'enunciat**: «encara que s'hi perdin places d'aparcament», «per
   accelerar la substitució de les canonades». La metodologia ja ho prohibeix, i tot i així
   hi ha aparegut. → L'argument va al context, mai a l'afirmació.
6. **El vot d'un paquet com a prova de divisió sobre un punt de dins.** Un pressupost, una
   plantilla o una modificació del planejament s'aproven sencers: que el ple es dividís sobre
   el paquet no vol dir que es dividís sobre la línia que ens interessa. Esplugues ho fa cinc
   vegades i Terrassa tres. → Una afirmació només es pot lligar a un vot si el punt votat és
   **aquell** punt.

I una absència comuna que diu molt: **en cap dels set municipis no hi ha una sola afirmació
sobre la mida de l'aparell municipal**, els organismes dependents, les retribucions del
cartipàs o el personal eventual. És un tema polític de primer ordre i el conjunt sencer se'l
salta.

## Què vol dir per al pla

La conclusió no és que les afirmacions estiguin mal escrites. És que **la brúixola no es pot
fer sense el registre de mocions**, i que la seva qualitat serà exactament la qualitat de
l'extracció de vots de cada municipi.

Això confirma l'ordre de treball i el fa més estricte:

1. **Primer les actes.** Sense vot desglossat no hi ha afirmacions defensables, i on no n'hi
   hagi val més dir-ho que omplir-ho amb premsa.
2. **Els programes del 2027 s'han de recollir el dia que surtin**, l'abril del 2027, perquè
   quatre anys després ja no hi són.
3. **El llistó de publicació per municipi** ha de comprovar-se de manera automàtica abans de
   publicar cap brúixola: mínim de vots citables, mínim de programa, equilibri i cobertura.
   Set agents amb la metodologia al davant no l'han complert; un comprovador sí que ho farà.

## Els fitxers

`packages/pipeline/src/publish/afirmacions/<municipi>.json` — les 25 de cada municipi amb el
tema, el text, el context, l'evidència amb la seva adreça, on cau el govern i per què hi pot
haver desacord raonable. **No estan validades i no s'han de publicar**: són el material de
treball d'aquesta anàlisi.
