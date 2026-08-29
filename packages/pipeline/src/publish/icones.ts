/**
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

export const ICONES: Readonly<Record<string, string>> = {
  "Habitatge": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Habitatge\"><path d=\"M8 22 L24 8 L40 22 V40 H8 Z\" fill=\"#E2735A\"/><path d=\"M8 22 L24 8 L40 22\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linejoin=\"round\"/><rect x=\"20\" y=\"28\" width=\"8\" height=\"12\" fill=\"#1E1B2E\"/></svg>",
  "Mobilitat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Mobilitat\"><rect x=\"6\" y=\"12\" width=\"36\" height=\"24\" rx=\"6\" fill=\"#BFE8D2\"/><rect x=\"10\" y=\"17\" width=\"9\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><rect x=\"22\" y=\"17\" width=\"9\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><rect x=\"34\" y=\"17\" width=\"4\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><circle cx=\"14\" cy=\"39\" r=\"4\" fill=\"#1E1B2E\"/><circle cx=\"34\" cy=\"39\" r=\"4\" fill=\"#1E1B2E\"/></svg>",
  "Urbanisme": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Urbanisme\"><rect x=\"6\" y=\"26\" width=\"16\" height=\"16\" fill=\"#C9C4F2\"/><path d=\"M36 42 V8 M36 8 H10 M10 8 V16 M40 8 H44\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M16 16 L10 22 L22 22 Z\" fill=\"#1E1B2E\"/></svg>",
  "Seguretat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Seguretat\"><path d=\"M24 5 L40 11 V24 C40 34 32 40 24 43 C16 40 8 34 8 24 V11 Z\" fill=\"#FFD8B8\"/><path d=\"M17 24 L22 29 L31 18\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "Fiscalitat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Fiscalitat\"><circle cx=\"24\" cy=\"24\" r=\"17\" fill=\"#BFE8D2\"/><path d=\"M30 16 A9 9 0 1 0 30 32 M14 21 H27 M14 27 H27\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3.5\" stroke-linecap=\"round\"/></svg>",
  "Medi ambient": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Medi ambient\"><path d=\"M40 8 C20 8 8 20 10 40 C30 40 42 28 40 8 Z\" fill=\"#BFE8D2\"/><path d=\"M12 38 C18 30 26 22 34 14\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
  "Cultura": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Cultura\"><path d=\"M6 14 H42 V22 A4 4 0 0 0 42 30 V38 H6 V30 A4 4 0 0 0 6 22 Z\" fill=\"#C9C4F2\"/><path d=\"M16 16 V36\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-dasharray=\"3 3\"/><path d=\"M30 19 L32.2 24 L37.5 24.4 L33.4 27.8 L34.7 33 L30 30.2 L25.3 33 L26.6 27.8 L22.5 24.4 L27.8 24 Z\" fill=\"#1E1B2E\"/></svg>",
  "Educació": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Educació\"><path d=\"M6 12 H22 A4 4 0 0 1 24 14 A4 4 0 0 1 26 12 H42 V36 H26 A4 4 0 0 0 24 38 A4 4 0 0 0 22 36 H6 Z\" fill=\"#FFD8B8\"/><path d=\"M24 14 V38 M11 19 H19 M11 25 H19 M29 19 H37 M29 25 H37\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
  "Serveis socials": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Serveis socials\"><path d=\"M24 42 C10 32 4 24 6 16 C8 8 18 8 24 16 C30 8 40 8 42 16 C44 24 38 32 24 42 Z\" fill=\"#E2735A\"/><path d=\"M14 22 C18 18 22 20 24 24 C26 20 30 18 34 22\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M19 24 L24 31 L29 24\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "Comerç": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Comerç\"><rect x=\"8\" y=\"20\" width=\"32\" height=\"22\" fill=\"#FFD8B8\"/><path d=\"M6 12 H42 L44 20 H4 Z\" fill=\"#FFD8B8\"/><path d=\"M4 20 H44\" stroke=\"#1E1B2E\" stroke-width=\"3\"/><path d=\"M12 12 V20 M20 12 V20 M28 12 V20 M36 12 V20\" stroke=\"#1E1B2E\" stroke-width=\"2.5\"/><rect x=\"20\" y=\"30\" width=\"8\" height=\"12\" fill=\"#1E1B2E\"/></svg>",
  "Participació": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Participació\"><rect x=\"10.2\" y=\"23\" width=\"5.6\" height=\"13\" rx=\"2.8\" fill=\"#C9C4F2\" transform=\"rotate(-32 13 29.5)\"/><rect x=\"17.4\" y=\"14\" width=\"5.8\" height=\"15\" rx=\"2.9\" fill=\"#C9C4F2\"/><rect x=\"24.6\" y=\"10\" width=\"5.8\" height=\"19\" rx=\"2.9\" fill=\"#C9C4F2\"/><rect x=\"31.8\" y=\"15\" width=\"5.8\" height=\"14\" rx=\"2.9\" fill=\"#C9C4F2\"/><path d=\"M14 27 H38 V35 A8 8 0 0 1 30 43 H22 A8 8 0 0 1 14 35 Z\" fill=\"#C9C4F2\"/><path d=\"M19 33 H33\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"2.4\" stroke-linecap=\"round\"/></svg>",
  "Llengua": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Llengua\"><path d=\"M8 8 H40 V32 H22 L12 40 V32 H8 Z\" fill=\"#E2735A\"/><text x=\"24\" y=\"27\" text-anchor=\"middle\" font-family=\"Gabarito, sans-serif\" font-weight=\"800\" font-size=\"18\" fill=\"#1E1B2E\">ç</text></svg>",
  "Esports": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Esports\"><circle cx=\"24\" cy=\"24\" r=\"17\" fill=\"#BFE8D2\"/><path d=\"M24 16 L31.6 21.5 L28.7 30.5 H19.3 L16.4 21.5 Z\" fill=\"#1E1B2E\"/><path d=\"M24 16 V8 M31.6 21.5 L39 19 M28.7 30.5 L33 38 M19.3 30.5 L15 38 M16.4 21.5 L9 19\" stroke=\"#1E1B2E\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
  "Turisme": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Turisme\"><path d=\"M24 44 C14 32 8 25 8 18 A16 16 0 0 1 40 18 C40 25 34 32 24 44 Z\" fill=\"#FFD8B8\"/><circle cx=\"24\" cy=\"18\" r=\"5\" fill=\"#1E1B2E\"/><path d=\"M24 7 V4 M35 18 H38 M10 18 H13 M31.8 10.2 L34 8 M16.2 10.2 L14 8\" stroke=\"#1E1B2E\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>",
  "Neteja": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Neteja\"><path d=\"M10 14 H38 L35 42 H13 Z\" fill=\"#C9C4F2\"/><rect x=\"6\" y=\"8\" width=\"36\" height=\"6\" rx=\"3\" fill=\"#1E1B2E\"/><path d=\"M19 20 V36 M29 20 V36\" stroke=\"#1E1B2E\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
  "El ple": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"El ple\"><path d=\"M6 30 A18 18 0 0 1 42 30 Z\" fill=\"#E2735A\"/><path d=\"M6 30 A18 18 0 0 1 42 30\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"12\" cy=\"22\" r=\"2.5\" fill=\"#1E1B2E\"/><circle cx=\"18\" cy=\"16\" r=\"2.5\" fill=\"#1E1B2E\"/><circle cx=\"24\" cy=\"14\" r=\"2.5\" fill=\"#1E1B2E\"/><circle cx=\"30\" cy=\"16\" r=\"2.5\" fill=\"#1E1B2E\"/><circle cx=\"36\" cy=\"22\" r=\"2.5\" fill=\"#1E1B2E\"/><rect x=\"18\" y=\"34\" width=\"12\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/></svg>"
};

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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const nom = ALIES[clau] ?? ALIES[tema.toLowerCase().trim()] ?? null;
  return nom === null ? "" : ICONES[nom] ?? "";
}
