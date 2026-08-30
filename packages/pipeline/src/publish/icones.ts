/**
 * Les icones temàtiques, les mateixes que la portada.
 *
 * **El bloc `ICONES` d'aquí sota el genera `tools/genera_icones.py` des de
 * `tools/icons_lib.py`.** No el toquis aquí: es tornaria a sobreescriure i la
 * portada i l'Observatori quedarien amb dibuixos diferents. Tot el que va
 * després de la marca de «fi del bloc generat» sí que s'escriu a mà.
 *
 * Serveixen per encapçalar els blocs de la fitxa i per marcar el tema de cada
 * pregunta. Una pàgina de dades sense cap dibuix es llegeix com un full de
 * càlcul, i el que hi ha a dins és una decisió política que afecta la gent.
 */

export const ICONES: Readonly<Record<string, string>> = {
  "Habitatge": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Habitatge\" style=\"--retard: 0.0s\"><path d=\"M8 22 L24 8 L40 22 V40 H8 Z\" fill=\"#E2735A\"/><path d=\"M8 22 L24 8 L40 22\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"19\" cy=\"33\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"33\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"33.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"33.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"28.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"28.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 40.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Mobilitat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Mobilitat\" style=\"--retard: 0.9s\"><rect x=\"6\" y=\"12\" width=\"36\" height=\"24\" rx=\"6\" fill=\"#BFE8D2\"/><rect x=\"10\" y=\"17\" width=\"9\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><rect x=\"22\" y=\"17\" width=\"9\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><rect x=\"34\" y=\"17\" width=\"4\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><circle cx=\"14\" cy=\"39\" r=\"4\" fill=\"#1E1B2E\"/><circle cx=\"34\" cy=\"39\" r=\"4\" fill=\"#1E1B2E\"/><g class=\"cara\"><circle cx=\"19\" cy=\"30\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"30\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"30.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"30.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"25.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"25.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 37.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Urbanisme": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Urbanisme\" style=\"--retard: 1.8s\"><rect x=\"6\" y=\"26\" width=\"16\" height=\"16\" fill=\"#C9C4F2\"/><path d=\"M36 42 V8 M36 8 H10 M10 8 V16 M40 8 H44\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M16 16 L10 22 L22 22 Z\" fill=\"#1E1B2E\"/><g class=\"cara\"><circle cx=\"10\" cy=\"34\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"18\" cy=\"34\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"10\" cy=\"34.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"18\" cy=\"34.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"6\" y=\"29.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"14\" y=\"29.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M10 41.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Seguretat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Seguretat\" style=\"--retard: 2.7s\"><path d=\"M24 5 L40 11 V24 C40 34 32 40 24 43 C16 40 8 34 8 24 V11 Z\" fill=\"#FFD8B8\"/><g class=\"cara\"><circle cx=\"19\" cy=\"21\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"21\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"21.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"21.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"16.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"16.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 28.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Fiscalitat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Fiscalitat\" style=\"--retard: 3.6s\"><circle cx=\"24\" cy=\"24\" r=\"17\" fill=\"#BFE8D2\"/><path d=\"M30 16 A9 9 0 1 0 30 32 M14 21 H27 M14 27 H27\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><g class=\"cara\"><circle cx=\"19\" cy=\"14\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"14\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"14.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"14.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"9.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"9.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 21.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Medi ambient": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Medi ambient\" style=\"--retard: 4.5s\"><path d=\"M40 8 C20 8 8 20 10 40 C30 40 42 28 40 8 Z\" fill=\"#BFE8D2\"/><g class=\"cara\"><circle cx=\"21\" cy=\"24\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"31\" cy=\"24\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"21\" cy=\"24.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"31\" cy=\"24.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"17\" y=\"19.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"27\" y=\"19.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M22 31.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Cultura": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Cultura\" style=\"--retard: 5.4s\"><path d=\"M6 14 H42 V22 A4 4 0 0 0 42 30 V38 H6 V30 A4 4 0 0 0 6 22 Z\" fill=\"#C9C4F2\"/><path d=\"M30 19 L32.2 24 L37.5 24.4 L33.4 27.8 L34.7 33 L30 30.2 L25.3 33 L26.6 27.8 L22.5 24.4 L27.8 24 Z\" fill=\"#1E1B2E\"/><g class=\"cara\"><circle cx=\"13\" cy=\"26\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"23\" cy=\"26\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"13\" cy=\"26.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"23\" cy=\"26.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"9\" y=\"21.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"19\" y=\"21.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M14 33.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Educació": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Educació\" style=\"--retard: 6.3s\"><path d=\"M6 12 H22 A4 4 0 0 1 24 14 A4 4 0 0 1 26 12 H42 V36 H26 A4 4 0 0 0 24 38 A4 4 0 0 0 22 36 H6 Z\" fill=\"#FFD8B8\"/><path d=\"M11 19 H19 M11 25 H19 M29 19 H37 M29 25 H37\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><g class=\"cara\"><circle cx=\"18\" cy=\"31\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"30\" cy=\"31\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"18\" cy=\"31.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"30\" cy=\"31.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"14\" y=\"26.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"26\" y=\"26.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 38.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Serveis socials": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Serveis socials\" style=\"--retard: 0.0s\"><path d=\"M24 42 C10 32 4 24 6 16 C8 8 18 8 24 16 C30 8 40 8 42 16 C44 24 38 32 24 42 Z\" fill=\"#E2735A\"/><g class=\"cara\"><circle cx=\"19\" cy=\"17\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"17\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"17.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"17.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"12.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"12.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 24.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Comerç": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Comerç\" style=\"--retard: 0.9s\"><rect x=\"8\" y=\"20\" width=\"32\" height=\"22\" fill=\"#FFD8B8\"/><path d=\"M6 12 H42 L44 20 H4 Z\" fill=\"#FFD8B8\"/><path d=\"M4 20 H44\" stroke=\"#1E1B2E\" stroke-width=\"3\"/><path d=\"M12 12 V20 M20 12 V20 M28 12 V20 M36 12 V20\" stroke=\"#1E1B2E\" stroke-width=\"2.5\"/><g class=\"cara\"><circle cx=\"19\" cy=\"27\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"27\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"27.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"27.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"22.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"22.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 34.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Participació": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Participació\" style=\"--retard: 1.8s\"><rect x=\"10.2\" y=\"23\" width=\"5.6\" height=\"13\" rx=\"2.8\" fill=\"#C9C4F2\" transform=\"rotate(-32 13 29.5)\"/><rect x=\"17.4\" y=\"14\" width=\"5.8\" height=\"15\" rx=\"2.9\" fill=\"#C9C4F2\"/><rect x=\"24.6\" y=\"10\" width=\"5.8\" height=\"19\" rx=\"2.9\" fill=\"#C9C4F2\"/><rect x=\"31.8\" y=\"15\" width=\"5.8\" height=\"14\" rx=\"2.9\" fill=\"#C9C4F2\"/><path d=\"M14 27 H38 V35 A8 8 0 0 1 30 43 H22 A8 8 0 0 1 14 35 Z\" fill=\"#C9C4F2\"/><g class=\"cara\"><circle cx=\"21\" cy=\"34\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"31\" cy=\"34\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"21\" cy=\"34.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"31\" cy=\"34.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"17\" y=\"29.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"27\" y=\"29.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M22 41.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Llengua": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Llengua\" style=\"--retard: 2.7s\"><path d=\"M8 8 H40 V32 H22 L12 40 V32 H8 Z\" fill=\"#E2735A\"/><g class=\"cara\"><circle cx=\"19\" cy=\"18\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"18\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"18.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"18.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"13.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"13.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 25.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Esports": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Esports\" style=\"--retard: 3.6s\"><circle cx=\"24\" cy=\"24\" r=\"17\" fill=\"#BFE8D2\"/><g class=\"cara\"><circle cx=\"19\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 29.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Turisme": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Turisme\" style=\"--retard: 4.5s\"><path d=\"M24 44 C14 32 8 25 8 18 A16 16 0 0 1 40 18 C40 25 34 32 24 44 Z\" fill=\"#FFD8B8\"/><path d=\"M24 7 V4 M35 18 H38 M10 18 H13 M31.8 10.2 L34 8 M16.2 10.2 L14 8\" stroke=\"#1E1B2E\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><g class=\"cara\"><circle cx=\"19\" cy=\"18\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"18\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"18.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"18.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"13.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"13.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 25.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Neteja": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Neteja\" style=\"--retard: 5.4s\"><path d=\"M10 14 H38 L35 42 H13 Z\" fill=\"#C9C4F2\"/><rect x=\"6\" y=\"8\" width=\"36\" height=\"6\" rx=\"3\" fill=\"#1E1B2E\"/><path d=\"M19 20 V36 M29 20 V36\" stroke=\"#1E1B2E\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><g class=\"cara\"><circle cx=\"19\" cy=\"28\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"28\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"28.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"28.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"23.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"23.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 35.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "El ple": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"El ple\" style=\"--retard: 6.3s\"><path d=\"M6 30 A18 18 0 0 1 42 30 Z\" fill=\"#E2735A\"/><path d=\"M6 30 A18 18 0 0 1 42 30\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\"/><rect x=\"18\" y=\"34\" width=\"12\" height=\"8\" rx=\"2\" fill=\"#1E1B2E\"/><g class=\"cara\"><circle cx=\"19\" cy=\"24\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"24\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"24.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"24.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"19.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"19.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 31.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>"
};

// --- fi del bloc generat per tools/genera_icones.py ---

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

// ------------------------------------------------------------- els serveis
//
// El bloc «On han posat els diners, servei a servei» de la fitxa treu quinze
// files —les quinze de `PROGRAMES` a `jobs/j15-despesa-serveis.ts`— i el bloc
// «Què costa cada servei» n'hi afegeix onze més del cost efectiu del Ministeri.
// Fins ara totes anaven amb el buit d'una icona al davant, perquè la família
// només tenia els setze temes de la portada i cap d'ells era ni el clavegueram
// ni el cementiri. Aquí es dibuixen els que faltaven, amb el mateix traç, els
// mateixos tons i la mateixa cara: totes les que ja hi havia en porten —s'ha
// comprovat, les setze duen el grup «cara» amb ulls, parpelles i boca— i una
// icona muda enmig d'una llista de mudes no seria del mateix joc.

/** Els tons de la casa. Els mateixos hexadecimals que `tools/icons_lib.py`. */
const PAPER = "#FBF7EE";
const TINTA = "#1E1B2E";
const CORAL = "#E2735A";
const MENTA = "#BFE8D2";
const LAVANDA = "#C9C4F2";
const PRESEC = "#FFD8B8";

/**
 * La cara, mesurada igual que la de les icones generades.
 *
 * Els ulls van a ±5 del centre amb radi 3,6; la pupil·la 0,4 més avall; la
 * parpella és un rectangle de 8×8,4 amb radi 3,4 que arrenca 4 a l'esquerra i
 * 4,2 amunt de cada ull, i la boca surt 7,4 per sota. Copiar aquestes xifres i
 * no arrodonir-les és el que fa que una icona nova parpellegi exactament com
 * les de la portada: el CSS d'`estil.ts` anima els grups pel nom de classe.
 */
function cara(cx: number, cy: number): string {
  const esq = cx - 5;
  const dre = cx + 5;
  return (
    '<g class="cara">' +
    `<circle cx="${esq}" cy="${cy}" r="3.6" fill="${PAPER}"/>` +
    `<circle cx="${dre}" cy="${cy}" r="3.6" fill="${PAPER}"/>` +
    '<g class="pupilles">' +
    `<circle cx="${esq}" cy="${cy + 0.4}" r="1.9" fill="${TINTA}"/>` +
    `<circle cx="${dre}" cy="${cy + 0.4}" r="1.9" fill="${TINTA}"/>` +
    "</g>" +
    '<g class="parpelles">' +
    `<rect x="${esq - 4}" y="${cy - 4.2}" width="8" height="8.4" rx="3.4" fill="${PAPER}"/>` +
    `<rect x="${dre - 4}" y="${cy - 4.2}" width="8" height="8.4" rx="3.4" fill="${PAPER}"/>` +
    "</g>" +
    `<path class="boca" d="M${cx - 4} ${cy + 7.4} q4 3 8 0" stroke="${TINTA}" stroke-width="2.1" fill="none" stroke-linecap="round"/>` +
    "</g>"
  );
}

/**
 * L'embolcall, idèntic al que escriu el generador.
 *
 * El retard escalona el parpelleig i torna a començar cada vuit icones, que és
 * el sostre que fixa «design/MOVIMENT.md» per a una tanda. Amb quinze files de
 * despesa a la mateixa pantalla, sense escalonar-ho les quinze cares
 * parpellejarien alhora i el que ha de passar desapercebut es veuria.
 */
function svg(etiqueta: string, retard: number, cos: string): string {
  return (
    `<svg class="icona" width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="${etiqueta}"` +
    ` style="--retard: ${retard.toFixed(1)}s">${cos}</svg>`
  );
}

/**
 * Les icones dels serveis municipals, les que no són a la portada.
 *
 * Totes es dibuixen dins de 4–44 del quadre de 48 perquè el traç de tinta de
 * 2,5–3,5 no toqui la vora, i totes es llegeixen a 24 px: a la fitxa surten a
 * 28 px (`.mandat .tema .icona` a `estil.ts`), que és la mida on una silueta
 * amb tres detalls encara es distingeix i una amb sis ja no.
 */
export const ICONES_SERVEIS: Readonly<Record<string, string>> = {
  // La gota, plena, sense cap detall a dins: a 24 px la gota es reconeix per
  // la punta de dalt i prou, i qualsevol reflex li menjaria un ull.
  "Aigua potable": svg(
    "Aigua potable",
    0.0,
    `<path d="M24 5 C14 18 10 24 10 30 A14 14 0 0 0 38 30 C38 24 34 18 24 5 Z" fill="${MENTA}"/>` + cara(24, 27),
  ),
  // La tapa de la claveguera amb les dues ranures: és el que se'n veu al
  // carrer. Un tub seccionat només el reconeix qui l'ha instal·lat.
  Clavegueram: svg(
    "Clavegueram",
    0.9,
    `<circle cx="24" cy="26" r="17" fill="${LAVANDA}"/>` +
      `<circle cx="24" cy="26" r="17" fill="none" stroke="${TINTA}" stroke-width="3"/>` +
      `<path d="M14 36 H34 M17 40 H31" stroke="${TINTA}" stroke-width="2.6" stroke-linecap="round"/>` +
      cara(24, 22),
  ),
  // El fanal: pantalla trapezoïdal, pal i peu. La cara va a la pantalla, que
  // és l'única part prou ampla per encabir-hi dos ulls de 3,6.
  "Enllumenat públic": svg(
    "Enllumenat públic",
    1.8,
    `<path d="M10 6 H38 L44 30 H4 Z" fill="${PRESEC}"/>` +
      `<rect x="21" y="30" width="6" height="12" fill="${TINTA}"/>` +
      `<rect x="14" y="41" width="20" height="4" rx="2" fill="${TINTA}"/>` +
      cara(24, 18),
  ),
  // L'arbre. La copa rodona sola seria la pilota d'«Esports»: el tronc de
  // tinta és tot el que les separa, i per això va gruixut.
  "Parcs i jardins": svg(
    "Parcs i jardins",
    2.7,
    `<circle cx="24" cy="19" r="14" fill="${MENTA}"/>` +
      `<rect x="20.5" y="29" width="7" height="15" rx="1.5" fill="${TINTA}"/>` +
      cara(24, 18),
  ),
  // El carrer en perspectiva, que s'eixampla cap a baix. Un rectangle amb la
  // ratlla al mig ja el tenien tres icones més d'aquesta llista i totes es
  // confonien a 24 px; la falca, no: la silueta sola ja diu carretera.
  "Vies públiques": svg(
    "Vies públiques",
    3.6,
    `<path d="M2 44 L16 8 H32 L46 44 Z" fill="${LAVANDA}"/>` +
      `<path d="M24 34 V41" stroke="${TINTA}" stroke-width="3.4" stroke-linecap="round"/>` +
      cara(24, 20),
  ),
  // L'escombra. La «Neteja» que ja hi havia és el cubell de les escombraries, i
  // la neteja viària és una partida diferent: si compartissin dibuix, dues
  // files consecutives de la llista es llegirien com la mateixa.
  "Neteja viària": svg(
    "Neteja viària",
    4.5,
    `<rect x="21" y="4" width="6" height="17" rx="3" fill="${TINTA}"/>` +
      `<path d="M9 20 H39 L43 42 H5 Z" fill="${PRESEC}"/>` +
      `<path d="M9 23 H39" stroke="${TINTA}" stroke-width="2.5" stroke-linecap="round"/>` +
      cara(24, 30),
  ),
  // La planta, amb la teulada de dents de serra. El tractament no és la
  // recollida —a la fitxa són dues xifres separades— i el cubell ja és de la
  // recollida, així que aquí hi va l'edifici on van a parar.
  "Tractament de residus": svg(
    "Tractament de residus",
    5.4,
    `<rect x="4" y="23" width="40" height="19" rx="2" fill="${MENTA}"/>` +
      `<rect x="5" y="5" width="8" height="19" fill="${MENTA}"/>` +
      `<path d="M13 24 L21 16 L29 24 L37 16 L44 24 Z" fill="${MENTA}"/>` +
      `<path d="M13 24 L21 16 L29 24 L37 16 L44 24" fill="none" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<path d="M5 10 H13" stroke="${TINTA}" stroke-width="2.6"/>` +
      cara(24, 31),
  ),
  // Tres llibres apilats. El llibre obert ja és l'«Educació», i la biblioteca
  // amb el mateix dibuix que l'escola faria pensar que és la mateixa partida.
  "Biblioteques i arxius": svg(
    "Biblioteques i arxius",
    6.3,
    `<rect x="7" y="5" width="34" height="9" rx="2.5" fill="${CORAL}"/>` +
      `<rect x="5" y="15" width="38" height="9" rx="2.5" fill="${CORAL}"/>` +
      `<rect x="9" y="25" width="30" height="19" rx="2.5" fill="${CORAL}"/>` +
      `<path d="M14 5 V14 M14 15 V24" stroke="${TINTA}" stroke-width="2.4"/>` +
      cara(24, 33),
  ),
  // La làpida amb la base. Sense creu: el cementiri és un servei municipal i
  // no de cap confessió, i la creu hi posaria una que la dada no diu.
  Cementiri: svg(
    "Cementiri",
    0.0,
    `<path d="M12 41 V22 A12 12 0 0 1 36 22 V41 Z" fill="${LAVANDA}"/>` +
      `<rect x="8" y="40" width="32" height="5" rx="2.5" fill="${TINTA}"/>` +
      cara(24, 23),
  ),
  // El bitllet. La moneda amb l'euro ja és la «Fiscalitat» —el que es cobra— i
  // el deute és el que es deu: mateix món, dibuix diferent.
  "Deute públic": svg(
    "Deute públic",
    0.9,
    `<rect x="4" y="11" width="40" height="26" rx="3" fill="${CORAL}"/>` +
      `<path d="M9 16 V32 M39 16 V32" stroke="${TINTA}" stroke-width="2.4" stroke-linecap="round"/>` +
      cara(24, 21),
  ),
  // El moneder tancat amb el fermall. És el total de tot el que s'ha gastat, i
  // per això va sencer i no partit per parts.
  "Despesa total": svg(
    "Despesa total",
    1.8,
    `<rect x="5" y="13" width="38" height="27" rx="5" fill="${PRESEC}"/>` +
      `<path d="M35 13 H38 A5 5 0 0 1 43 18 V35 A5 5 0 0 1 38 40 H35 Z" fill="${TINTA}"/>` +
      cara(23, 23),
  ),
  // La roda dentada: els serveis públics bàsics són un sac de set programes
  // (seguretat, mobilitat, habitatge, urbanisme, aigua, residus i enllumenat) i
  // dibuixar-ne un de sol faria passar el sac per una de les set coses.
  "Serveis públics bàsics": svg(
    "Serveis públics bàsics",
    2.7,
    `<rect x="19.5" y="3" width="9" height="13" rx="2" fill="${MENTA}"/>` +
      `<rect x="19.5" y="32" width="9" height="13" rx="2" fill="${MENTA}"/>` +
      `<rect x="3" y="19.5" width="13" height="9" rx="2" fill="${MENTA}"/>` +
      `<rect x="32" y="19.5" width="13" height="9" rx="2" fill="${MENTA}"/>` +
      `<circle cx="24" cy="24" r="15" fill="${MENTA}"/>` +
      cara(24, 21),
  ),
  // La carpeta d'expedients. L'hemicicle ja és «El ple», que és on es decideix;
  // l'administració general és la casa que ho tramita.
  "Administració general": svg(
    "Administració general",
    3.6,
    `<path d="M5 11 H20 L24 16 H43 V40 A2 2 0 0 1 41 42 H7 A2 2 0 0 1 5 40 Z" fill="${PRESEC}"/>` +
      `<path d="M5 20 H43" stroke="${TINTA}" stroke-width="2.4"/>` +
      cara(24, 28),
  ),
  // El recanvi. Un servei que no tingui dibuix no pot deixar el forat: la
  // llista queda desalineada i sembla que a aquella fila li falti la dada.
  "Un servei": svg(
    "Un servei",
    4.5,
    `<rect x="7" y="7" width="34" height="34" rx="9" fill="${LAVANDA}"/>` + cara(24, 21),
  ),
};

/**
 * Com s'escriuen aquests serveis a les dades.
 *
 * Les etiquetes surten tal qual de `PROGRAMES` (j15) i de la taula del cost
 * efectiu, i no coincideixen amb el nom de la icona: «Escombraries i residus»
 * és el cubell de la «Neteja», i «Òrgans de govern» és «El ple». On la casa ja
 * tenia el dibuix, s'hi apunta, i no se'n dibuixa un de nou que se li assembli.
 */
const ALIES_SERVEIS: Readonly<Record<string, string>> = {
  // --- els quinze programes del bloc «On han posat els diners, servei a servei»
  "escombraries i residus": "Neteja",
  "neteja viaria": "Neteja viària",
  "enllumenat public": "Enllumenat públic",
  "aigua potable": "Aigua potable",
  clavegueram: "Clavegueram",
  "parcs i jardins": "Parcs i jardins",
  "vies publiques": "Vies públiques",
  "escoles d'infantil i primaria": "Educació",
  "biblioteques i arxius": "Biblioteques i arxius",
  "instal·lacions esportives": "Esports",
  "policia local i seguretat": "Seguretat",
  "organs de govern": "El ple",
  "deute public": "Deute públic",
  // El programa 011 de J15 es diu «Pagar el deute» perquè no es confongui amb
  // «Deute per habitant» a la mateixa llista; el dibuix és el mateix bitllet.
  "pagar el deute": "Deute públic",
  // --- els onze serveis del cost efectiu, «Què costa cada servei»
  "recollida d'escombraries": "Neteja",
  "tractament de residus": "Tractament de residus",
  "atencio social": "Serveis socials",
  biblioteca: "Biblioteques i arxius",
  cementiri: "Cementiri",
  // --- les àrees del bloc «On van els diners»
  "despesa total": "Despesa total",
  "serveis publics basics": "Serveis públics bàsics",
  "educacio, cultura i esport": "Educació",
  "administracio general": "Administració general",
  "proteccio i promocio social": "Serveis socials",
  "actuacions economiques": "Comerç",
};

/** La clau de cerca: sense accents, en minúscules i amb l'apòstrof normalitzat. */
function clauDe(tema: string): string {
  return tema
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .trim();
}

/** El dibuix d'un nom d'icona, miri al mapa generat o al dels serveis. */
function dibuix(nom: string): string {
  return ICONES[nom] ?? ICONES_SERVEIS[nom] ?? "";
}

/**
 * Treu el rol i l'etiqueta i deixa la icona muda.
 *
 * Dins d'una llista, la icona repeteix el nom del servei que ja hi ha escrit al
 * costat: anunciar-la seria fer llegir «Aigua potable, Aigua potable». Amb
 * `aria-hidden` el lector de pantalla se la salta, i `focusable="false"` evita
 * que a l'Internet Explorer antic hi caigui el tabulador.
 */
function muda(svgText: string): string {
  return svgText.replace(/role="img" aria-label="[^"]*"/, 'aria-hidden="true" focusable="false"');
}

/**
 * La icona d'un tema, o cadena buida si no en té cap. Mai peta per un tema nou.
 *
 * El segon paràmetre és opcional i per omissió val el de sempre, així que cap
 * crida existent no canvia ni un caràcter de sortida.
 */
export function icona(tema: string, decorativa = false): string {
  const clau = clauDe(tema);
  const nom = ALIES[clau] ?? ALIES_SERVEIS[clau] ?? ALIES[tema.toLowerCase().trim()] ?? null;
  const svgText = nom === null ? "" : dibuix(nom);
  return svgText === "" ? "" : decorativa ? muda(svgText) : svgText;
}

/**
 * La icona d'un servei o d'una àrea de despesa, sempre amb dibuix.
 *
 * A diferència d'`icona`, aquí no hi ha resposta buida: la llista de despesa
 * és una graella de dues columnes i una fila sense dibuix desquadra les altres.
 * Un servei que encara no tingui icona surt amb el recanvi, que no diu res de
 * mal —és una peça neutra— i deixa la fila alineada. Va muda per defecte:
 * dins de la llista el nom del servei ja hi és escrit al costat.
 */
export function iconaDeServei(servei: string, decorativa = true): string {
  const clau = clauDe(servei);
  const nom = ALIES[clau] ?? ALIES_SERVEIS[clau] ?? "Un servei";
  const svgText = dibuix(nom) || ICONES_SERVEIS["Un servei"]!;
  return decorativa ? muda(svgText) : svgText;
}
