# Col·laboració Quivoto × Xamfrà: com vota cada barri

Document del 24-11-2026. Explica què s'ha portat de Xamfrà a Quivoto per a les municipals del 2027, per què s'ha fet així i com es fa córrer.

## La idea

[Xamfrà](https://xamfra.damosenelblanco.com) és el visor urbà 3D dels 36 municipis de l'AMB. Ja publica el vot per secció censal (municipals 2023, Parlament 2024, Congrés 2023 i europees 2024) amb un mètode comprovat, i el creua amb la renda, l'edat i els serveis de cada barri.

La col·laboració fa servir **el mètode i les dades obertes, no el visor**. Quivoto dibuixa el vot per secció a les fitxes amb el seu propi SVG, sense carregar res de Xamfrà, i als 36 municipis de l'AMB enllaça la pàgina del municipi a Xamfrà perquè qui vulgui ho vegi en 3D.

Opcions descartades:

- **Iframe del visor de Xamfrà** (`/embed/?t=…`). Carrega el visor 3D sencer (MapLibre, tessel·les, edificis) a cada fitxa, els enllaços caduquen al cap de 7 o 30 dies i depèn del servidor de Xamfrà. A més, la CSP de quivoto.cat no permet marcs ni connexions externes.
- **Mapa amb fons d'OpenStreetMap (MapLibre i tessel·les).** Demana obrir la CSP a un servidor de tessel·les i afegir uns 800 kB de JavaScript per fitxa. L'SVG de seccions ja es llegeix sol i pesa poc. Si més endavant es vol un fons de carrers, la via és servir tessel·les vectorials pròpies (PMTiles) des de quivoto.cat.

## Què hi ha

**Feina J47** (`packages/pipeline/src/jobs/j47-vot-seccions.ts`). Per a cada municipi amb dues seccions o més desa la mètrica `votSeccions`:

- vots i participació per secció de les **municipals 2023** i el **Parlament 2024** (Generalitat, `ntc4-rnwr` i `irrv-2mfc`, nivell `SE`, tot Catalunya);
- la geometria de les seccions censals del 2025 (ICGC, ZIP en UTM 31N), simplificada a un llenç de 1.000 d'ample, amb camins relatius d'enters;
- la renda neta per persona de cada secció (INE, ADRH: els mateixos CSV provincials de J23, ara llegint-ne les files de secció);
- per als municipis de l'AMB, la pàgina corresponent de Xamfrà.

El ZIP i el shapefile es llegeixen sense dependències (`lib/zip.ts`, `lib/shapefile.ts`).

**Bloc de la fitxa** (`publish/vot-seccions-fitxa.ts`): «Com vota cada barri», al capítol «Qui mana», just després de «Com vota aquest municipi a cada elecció».

- Sense JavaScript ja es veu el mapa pintat per la llista més votada, amb la intensitat segons el marge, la llegenda, tres frases i la taula equivalent (per secció fins a 250 seccions, per districte a les ciutats grans).
- Amb JavaScript es pot canviar d'elecció; pintar el guanyador, la participació, la renda o el vot de cada llista; tocar una secció per veure-la sencera; i veure un gràfic de punts de renda contra participació (o contra el vot de la llista triada) enllaçat amb el mapa.
- Segueix `design/MOVIMENT.md`: els colors de dades no fan transicions, els controls fan servir `--t-rapid` i `--corba-seca`, i `prefers-reduced-motion` ho apaga tot.

## Com es fa córrer

```bash
# Amb xarxa (al portàtil del pipeline): Generalitat + ICGC + INE, els 947
corepack pnpm --filter @quivoto/pipeline start j47 publica tots

# Sense xarxa, des d'un checkout de Xamfrà: només els 36 de l'AMB
QUIVOTO_XAMFRA_DADES=../xamfra/public/data corepack pnpm --filter @quivoto/pipeline start j47
```

El ZIP de l'ICGC es baixa un cop a `packages/db/.data/icgc/bseccen-2025.zip`. Va a mà, després de J1, i no és a `ORDER`.

## Per comprovar a la primera execució amb xarxa

Les dades de l'AMB s'han comprovat amb els fitxers de Xamfrà. Les crides a la Generalitat, l'ICGC i l'INE no s'han pogut fer des de l'entorn on s'ha escrit el codi, que no té accés a aquests servidors.

- Els noms de camp de secció del portal: `secci_` als vots i `seccio` a la participació (els mateixos que fa servir Xamfrà).
- Que el `.dbf` de l'ICGC porti `MUNICIPI` (6 xifres), `DISTRICTE` i `SECCIO`, com en llegeix Xamfrà.
- Que la columna `Secciones` del CSV de l'ADRH comenci pel codi de 10 xifres.
- La mida de les fitxes grans: el bloc de Barcelona (1.068 seccions) fa 243 kB d'HTML, 74 kB comprimit; el d'Esplugues (28 seccions), 32 kB i 10 kB.

## Idees per després

- Afegir el Congrés 2023 i les europees 2024, que J47 ja sabria llegir.
- Fer servir el mateix mapa a les **municipals del 2027**, la nit electoral i l'endemà, per comparar amb el 2023 secció a secció.
- Fer una pàgina de l'AMB que posi els 36 municipis de costat amb el mateix mapa.
