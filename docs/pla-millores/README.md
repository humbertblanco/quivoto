# Pla de millores: com fer-lo servir

Aquesta carpeta recull una anàlisi completa de quivoto (usabilitat, dades i gràfiques, fonts noves i tècnica) i el pla que en surt, ordenat fins al canvi de mandat del juny del 2027. Està pensada perquè qualsevol persona la pugui reprendre sense haver de preguntar res.

## Què hi ha

| Fitxer | Per a què |
|---|---|
| [PLA.md](PLA.md) | **Comenceu aquí.** Diagnosi, fases amb dates, tasques amb criteri de «fet», decisions obertes i què no s'ha pogut verificar |
| [01-usabilitat.md](01-usabilitat.md) | Auditoria d'experiència d'usuari (prefix **UX-**) |
| [02-dades-i-grafiques.md](02-dades-i-grafiques.md) | Auditoria de dades, gràfics, descàrregues i model de la brúixola (prefix **DAD-**) |
| [03-fonts-noves.md](03-fonts-noves.md) | Fonts obertes noves verificades, amb URL, cobertura, llicència i calendari (prefix **FON-**) |
| [04-tecnica.md](04-tecnica.md) | Revisió tècnica: operació, seguretat, arquitectura, tests, rendiment i SEO (prefix **TEC-**) |
| [05-bruixola.md](05-bruixola.md) | Segona ronda: la brúixola comparada amb les de referència i amb la recerca; abast i calendari (prefix **BRU-**) |
| [06-legal-i-electoral.md](06-legal-i-electoral.md) | Segona ronda: LOREG, protecció de dades, llicències, rectificació i governança; llista de comprovació electoral (prefix **LEG-**) |
| [07-audiencia-i-difusio.md](07-audiencia-i-difusio.md) | Segona ronda: audiència, mitjans locals, xarxes, butlletí, SEO, idees de producte i finançament (prefix **AUD-**) |
| [08-dades-segona-passada.md](08-dades-segona-passada.md) | Segona ronda: actes i votacions, resultats per secció, programes, fonts municipals noves i controls creuats (prefix **DD2-**) |

Cada tasca del pla té un identificador (`F0-1`, `F1-5`…) i remet a les troballes dels annexos (`UX-5.1`, `TEC-O4`…). Les troballes porten `fitxer:línia`, el problema, per què importa, la solució proposada, l'esforç i l'impacte.

## Com reprendre una tasca

1. Trieu una tasca del [PLA.md](PLA.md) en estat `pendent`, començant per la fase més baixa. La fase 0 va abans que tot: sense ella, la resta no es pot provar ni desplegar amb seguretat.
2. Llegiu les troballes que cita a la columna «Refs». Les referències `fitxer:línia` són del commit `e53c589`; si el codi s'ha mogut, cerqueu el nom de la funció o la constant.
3. Comproveu si depèn d'una decisió oberta (secció 9 del pla). Si és així, cal la decisió abans de començar.
4. Feu-la en una branca pròpia amb el codi de la tasca al nom o al missatge (per exemple, `F1-5: brúixola en mòbil`).
5. Quan estigui feta segons la columna «Fet quan…», canvieu-ne l'estat al pla a `fet` en el mateix PR.

## Convencions

- **Idioma**: català, com la resta del repositori.
- **Esforç**: S < 1 dia, M 1–3 dies, L > 3 dies.
- **Impacte**: alta, mitjana, baixa, pensant en el ciutadà i en el calendari del 23-05-2027.
- **Estat**: `pendent`, `en curs`, `fet`, `descartat` (amb una línia que digui per què).
- Si una troballa resulta falsa en revisar-la, marqueu-la com a `descartat` al pla i corregiu l'annex; no l'esborreu.

## Com es va fer

El 26-10-2026 es van fer dues rondes. A la primera, quatre auditories en paral·lel sobre el commit `e53c589`: lectura del codi i de `docs/` i `design/`, generació de pàgines amb els *fixtures* dels tests, captures amb Playwright a 390 i 1280 px, execució de `pnpm test` i `typecheck`, lectura del web en directe a través de resums de text, i consultes reals a les API de Socrata, l'Idescat i datos.gob.es per a les fonts noves. A la segona, quatre exploracions més a fons (brúixola, marc legal, audiència i dades) amb recerca web i consultes reals a les fonts. No es va modificar cap fitxer del codi. Els límits d'aquesta anàlisi són a la secció 10 del pla.
