# quivoto

Brúixola electoral per a les **eleccions municipals del 23 de maig de 2027** a Catalunya.
Respon 25 afirmacions sobre el teu municipi i descobreix quins partits i candidats
pensen com tu — amb l'evidència al costat: què han votat al ple, què deia el programa,
què han dit a la premsa.

Dominis: **quivoto.cat** (català) i **quienvoto.es** (castellà).

## Estat

| Fase | Estat |
|---|---|
| Pla del producte i de les dades | Fet — `~/.claude/plans/giggly-frolicking-kahn.md` |
| Identitat visual | Fet — direcció «el veïnat», mascota la papereta |
| Landing de properament | **Fet, a punt de desplegar** — `web/` |
| Base de dades i pipeline de recerca | Pendent (Fase 1) |

## Carpetes

```
design/identitat/   Llenç de disseny: noms, direccions, icones, mascota
tools/              icons_lib.py (icones + mascota), build_landing.py, make_og.php
web/                La landing: web/README.md
docs/               DESPLEGAMENT.md
```

## Ordre de feina

```bash
python3 tools/build_landing.py          # regenera la landing
php -S 127.0.0.1:8788 -t web/public     # per veure-la en local
```

Per desplegar: **docs/DESPLEGAMENT.md**.
