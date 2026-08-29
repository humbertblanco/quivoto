#!/usr/bin/env python3
"""
Escriu les icones temàtiques a `packages/pipeline/src/publish/icones.ts`.

La font única continua sent `tools/icons_lib.py`, que és el que fa servir la
portada. El pipeline és TypeScript i no pot importar Python, i tenir-les
dibuixades dues vegades acabaria amb dues cases: una portada amb una casa i una
fitxa amb una altra. Es generen d'aquí, i si algú canvia una icona, es torna a
executar això.

Ús: python3 tools/genera_icones.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icons_lib as L

# `with_face=True` és tota la diferència: sense això sortien els mateixos
# dibuixos sense cara, i la fitxa municipal era l'única pantalla de quivoto amb
# les icones mudes mentre la portada les tenia mirant i parpellejant. La posició
# dels ulls de cada icona i quin detall s'ha de treure perquè no els trepitgi ja
# ho porta `icons_lib` mesurat (EYES i DETALL_AMB_CARA); aquí només s'hi demana.
#
# El retard escalona el parpelleig. Sense ell, les setze icones d'una pàgina
# parpellegen alhora i el que hauria de passar desapercebut es converteix en un
# esdeveniment. El pas és 0,9 s i torna a començar cada vuit, que és el sostre
# que fixa `design/MOVIMENT.md` per a una tanda.
sortida = {}
for i, (etiqueta, _, _, _) in enumerate(L.ICONS):
    sortida[etiqueta] = L.icon(i, 48, with_face=True, delay=(i % 8) * 0.9)

cami = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    '..', 'packages', 'pipeline', 'src', 'publish', 'icones.ts')
with open(cami, 'w', encoding='utf-8') as f:
    f.write('''/**
 * Les icones temàtiques, les mateixes que la portada.
 *
 * **Generat per `tools/genera_icones.py` des de `tools/icons_lib.py`.** No les
 * toquis aquí: es tornarien a sobreescriure i la portada i l'Observatori
 * quedarien amb dibuixos diferents.
 *
 * Serveixen per encapçalar els blocs de la fitxa i per marcar el tema de cada
 * pregunta. Una pàgina de dades sense cap dibuix es llegeix com un full de
 * càlcul, i el que hi ha a dins és una decisió política que afecta la gent.
 */

export const ICONES: Readonly<Record<string, string>> = ''')
    f.write(json.dumps(sortida, ensure_ascii=False, indent=2))
    f.write(''';

/** Els temes de les preguntes no s'escriuen igual que les etiquetes de les icones. */
const ALIES: Readonly<Record<string, string>> = {
  fiscalitat: "Fiscalitat",
  habitatge: "Habitatge",
  mobilitat: "Mobilitat",
  urbanisme: "Urbanisme",
  seguretat: "Seguretat",
  residus: "Neteja",
  "medi ambient": "Medi ambient",
  cultura: "Cultura",
  educacio: "Educació",
  educació: "Educació",
  esports: "Esports",
  "cultura i esports": "Cultura",
  comerc: "Comerç",
  "comerç": "Comerç",
  turisme: "Turisme",
  llengua: "Llengua",
  participacio: "Participació",
  "participació": "Participació",
  "serveis socials": "Serveis socials",
  ple: "El ple",
  "el ple": "El ple",
};

/** La icona d'un tema, o cadena buida si no en té cap. Mai peta per un tema nou. */
export function icona(tema: string): string {
  const clau = tema
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();
  const nom = ALIES[clau] ?? ALIES[tema.toLowerCase().trim()] ?? null;
  return nom === null ? "" : ICONES[nom] ?? "";
}
''')
print(f"{len(sortida)} icones escrites a packages/pipeline/src/publish/icones.ts")
