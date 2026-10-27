/**
 * Les icones de quivoto: els setze temes de la portada, els serveis municipals
 * i els ens i el govern local.
 *
 * **El bloc `ICONES` d'aquí sota surt de `tools/icons_lib.py`**, que és el que
 * fa servir la portada. No el toquis aquí: es tornaria a sobreescriure i la
 * portada i l'Observatori quedarien amb dibuixos diferents. Tot el que va
 * després de la marca de «fi del bloc generat» sí que s'escriu a mà. (Compte:
 * `tools/genera_icones.py` encara escriu el fitxer sencer amb una versió vella
 * de la part de sota; per refer només el bloc, cal que en substitueixi el tros
 * entre `export const ICONES` i la marca, i prou.)
 *
 * Les regles del sistema —graella, gruix, vora, colors i cara— són a la
 * capçalera d'`icons_lib.py`, i les eines de dibuix d'aquí sota les copien
 * perquè una icona feta a mà no es distingeixi d'una de generada.
 *
 * Serveixen per encapçalar els blocs de la fitxa i per marcar el tema de cada
 * pregunta. Una pàgina de dades sense cap dibuix es llegeix com un full de
 * càlcul, i el que hi ha a dins és una decisió política que afecta la gent.
 */

export const ICONES: Readonly<Record<string, string>> = {
  "Habitatge": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Habitatge\" style=\"--retard: 0.0s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M7 22 L24 8 L41 22 V41 H7 Z\"/><rect x=\"30\" y=\"9\" width=\"5\" height=\"9\"/></g><g fill=\"#E2735A\"><path d=\"M7 22 L24 8 L41 22 V41 H7 Z\"/><rect x=\"30\" y=\"9\" width=\"5\" height=\"9\"/></g><g class=\"cara\"><circle cx=\"19\" cy=\"28\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"28\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"28.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"28.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"23.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"23.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 35.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Mobilitat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Mobilitat\" style=\"--retard: 0.9s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><rect x=\"7\" y=\"8\" width=\"34\" height=\"28\" rx=\"6\"/></g><g fill=\"#BFE8D2\"><rect x=\"7\" y=\"8\" width=\"34\" height=\"28\" rx=\"6\"/></g><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><circle cx=\"13\" cy=\"37.5\" r=\"3.5\"/><circle cx=\"35\" cy=\"37.5\" r=\"3.5\"/></g><g fill=\"#BFE8D2\"><circle cx=\"13\" cy=\"37.5\" r=\"3.5\"/><circle cx=\"35\" cy=\"37.5\" r=\"3.5\"/></g><rect x=\"11\" y=\"11\" width=\"26\" height=\"7.5\" rx=\"2\" fill=\"#FBF7EE\" stroke=\"#1E1B2E\" stroke-width=\"3\"/><g class=\"cara\"><circle cx=\"19\" cy=\"25.5\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"25.5\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"25.9\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"25.9\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"21.3\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"21.3\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 32.9 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Urbanisme": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Urbanisme\" style=\"--retard: 1.8s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><rect x=\"32\" y=\"8\" width=\"5\" height=\"33\"/><rect x=\"10\" y=\"8\" width=\"31\" height=\"5\"/><rect x=\"7\" y=\"21\" width=\"18\" height=\"20\" rx=\"2\"/></g><g fill=\"#C9C4F2\"><rect x=\"32\" y=\"8\" width=\"5\" height=\"33\"/><rect x=\"10\" y=\"8\" width=\"31\" height=\"5\"/><rect x=\"7\" y=\"21\" width=\"18\" height=\"20\" rx=\"2\"/></g><g class=\"cara\"><circle cx=\"12\" cy=\"28\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"20\" cy=\"28\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"12\" cy=\"28.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"20\" cy=\"28.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"8\" y=\"23.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"16\" y=\"23.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M12 35.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Seguretat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Seguretat\" style=\"--retard: 2.7s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M24 7 L40 12 V23 C40 32 33 38 24 41 C15 38 8 32 8 23 V12 Z\"/></g><g fill=\"#FFD8B8\"><path d=\"M24 7 L40 12 V23 C40 32 33 38 24 41 C15 38 8 32 8 23 V12 Z\"/></g><g class=\"cara\"><circle cx=\"19\" cy=\"20\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"20\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"20.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"20.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"15.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"15.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 27.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Fiscalitat": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Fiscalitat\" style=\"--retard: 3.6s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><circle cx=\"24\" cy=\"24\" r=\"17\"/></g><g fill=\"#BFE8D2\"><circle cx=\"24\" cy=\"24\" r=\"17\"/></g><circle cx=\"24\" cy=\"24\" r=\"12.5\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\"/><g class=\"cara\"><circle cx=\"19\" cy=\"23\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"23\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"23.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"23.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"18.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"18.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 30.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Medi ambient": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Medi ambient\" style=\"--retard: 4.5s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M40 8 C21 8 8 20 9 40 C29 41 41 28 40 8 Z\"/></g><g fill=\"#BFE8D2\"><path d=\"M40 8 C21 8 8 20 9 40 C29 41 41 28 40 8 Z\"/></g><g class=\"cara\"><circle cx=\"20\" cy=\"23\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"30\" cy=\"23\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"20\" cy=\"23.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"30\" cy=\"23.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"16\" y=\"18.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"26\" y=\"18.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M21 30.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Cultura": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Cultura\" style=\"--retard: 5.4s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M7 13 H27 A2.5 2.5 0 0 0 32 13 H41 V35 H32 A2.5 2.5 0 0 0 27 35 H7 Z\"/></g><g fill=\"#C9C4F2\"><path d=\"M7 13 H27 A2.5 2.5 0 0 0 32 13 H41 V35 H32 A2.5 2.5 0 0 0 27 35 H7 Z\"/></g><path d=\"M36.0 19.4 L37.2 22.4 L40.4 22.6 L37.9 24.6 L38.7 27.7 L36.0 26.0 L33.3 27.7 L34.1 24.6 L31.6 22.6 L34.8 22.4 Z\" fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"13\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"21\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"13\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"21\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"9\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"17\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M13 29.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Educació": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Educació\" style=\"--retard: 6.3s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M7 12 H20 A4 4 0 0 1 24 15 A4 4 0 0 1 28 12 H41 V36 H28 A4 4 0 0 0 24 39 A4 4 0 0 0 20 36 H7 Z\"/></g><g fill=\"#FFD8B8\"><path d=\"M7 12 H20 A4 4 0 0 1 24 15 A4 4 0 0 1 28 12 H41 V36 H28 A4 4 0 0 0 24 39 A4 4 0 0 0 20 36 H7 Z\"/></g><path d=\"M11 17 H19 M29 17 H37\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"18\" cy=\"26\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"30\" cy=\"26\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"18\" cy=\"26.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"30\" cy=\"26.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"14\" y=\"21.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"26\" y=\"21.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 33.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Serveis socials": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Serveis socials\" style=\"--retard: 0.0s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M24 41 C11 32 7 25 7.5 17 C9 9.5 18.5 9 24 16 C29.5 9 39 9.5 40.5 17 C41 25 37 32 24 41 Z\"/></g><g fill=\"#E2735A\"><path d=\"M24 41 C11 32 7 25 7.5 17 C9 9.5 18.5 9 24 16 C29.5 9 39 9.5 40.5 17 C41 25 37 32 24 41 Z\"/></g><g class=\"cara\"><circle cx=\"19\" cy=\"20.5\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"20.5\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"20.9\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"20.9\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"16.3\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"16.3\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 27.9 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Comerç": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Comerç\" style=\"--retard: 0.9s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><rect x=\"9\" y=\"20\" width=\"30\" height=\"21\"/><path d=\"M10 10 H38 L41 20 H7 Z\"/></g><g fill=\"#FFD8B8\"><rect x=\"9\" y=\"20\" width=\"30\" height=\"21\"/><path d=\"M10 10 H38 L41 20 H7 Z\"/></g><path d=\"M7 20 H41\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M17.5 11.5 L16.5 18.5 M24 11.5 V18.5 M30.5 11.5 L31.5 18.5\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"19\" cy=\"26.5\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"26.5\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"26.9\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"26.9\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"22.3\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"22.3\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 33.9 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Participació": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Participació\" style=\"--retard: 1.8s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><rect x=\"9\" y=\"21\" width=\"6\" height=\"13\" rx=\"3\" transform=\"rotate(-28 12 31)\"/><rect x=\"15\" y=\"13\" width=\"6\" height=\"14\" rx=\"3\"/><rect x=\"21\" y=\"8\" width=\"6\" height=\"19\" rx=\"3\"/><rect x=\"27\" y=\"10\" width=\"6\" height=\"17\" rx=\"3\"/><rect x=\"33\" y=\"14\" width=\"6\" height=\"13\" rx=\"3\"/><path d=\"M15 23 H39 V33 A8 8 0 0 1 31 41 H23 A8 8 0 0 1 15 33 Z\"/></g><g fill=\"#C9C4F2\"><rect x=\"9\" y=\"21\" width=\"6\" height=\"13\" rx=\"3\" transform=\"rotate(-28 12 31)\"/><rect x=\"15\" y=\"13\" width=\"6\" height=\"14\" rx=\"3\"/><rect x=\"21\" y=\"8\" width=\"6\" height=\"19\" rx=\"3\"/><rect x=\"27\" y=\"10\" width=\"6\" height=\"17\" rx=\"3\"/><rect x=\"33\" y=\"14\" width=\"6\" height=\"13\" rx=\"3\"/><path d=\"M15 23 H39 V33 A8 8 0 0 1 31 41 H23 A8 8 0 0 1 15 33 Z\"/></g><path d=\"M21 17 V22 M27 13 V22 M33 17 V22\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"22\" cy=\"29\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"32\" cy=\"29\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"22\" cy=\"29.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"32\" cy=\"29.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"18\" y=\"24.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"28\" y=\"24.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M23 36.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Llengua": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Llengua\" style=\"--retard: 2.7s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M11 8 H37 A4 4 0 0 1 41 12 V28 A4 4 0 0 1 37 32 H23 L14 40 V32 H11 A4 4 0 0 1 7 28 V12 A4 4 0 0 1 11 8 Z\"/></g><g fill=\"#E2735A\"><path d=\"M11 8 H37 A4 4 0 0 1 41 12 V28 A4 4 0 0 1 37 32 H23 L14 40 V32 H11 A4 4 0 0 1 7 28 V12 A4 4 0 0 1 11 8 Z\"/></g><g class=\"cara\"><circle cx=\"19\" cy=\"17\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"17\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"17.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"17.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"12.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"12.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 24.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Esports": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Esports\" style=\"--retard: 3.6s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><circle cx=\"24\" cy=\"24\" r=\"17\"/></g><g fill=\"#BFE8D2\"><circle cx=\"24\" cy=\"24\" r=\"17\"/></g><path d=\"M11 13 C15 19 15 29 11 35 M37 13 C33 19 33 29 37 35\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"20\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"28\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"20\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"28\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"16\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"24\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 29.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Turisme": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Turisme\" style=\"--retard: 4.5s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><rect x=\"7\" y=\"15\" width=\"34\" height=\"25\" rx=\"4\"/><path d=\"M17 16 V12 A4 4 0 0 1 21 8 H27 A4 4 0 0 1 31 12 V16 H27 V12 H21 V16 Z\"/></g><g fill=\"#FFD8B8\"><rect x=\"7\" y=\"15\" width=\"34\" height=\"25\" rx=\"4\"/><path d=\"M17 16 V12 A4 4 0 0 1 21 8 H27 A4 4 0 0 1 31 12 V16 H27 V12 H21 V16 Z\"/></g><path d=\"M13 15 V40 M35 15 V40\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"20\" cy=\"25\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"28\" cy=\"25\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"20\" cy=\"25.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"28\" cy=\"25.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"16\" y=\"20.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"24\" y=\"20.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 32.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "Neteja": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"Neteja\" style=\"--retard: 5.4s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><rect x=\"20\" y=\"7\" width=\"8\" height=\"5\" rx=\"2\"/><rect x=\"7\" y=\"11\" width=\"34\" height=\"5\" rx=\"2.5\"/><path d=\"M10 16 H38 L35.5 41 H12.5 Z\"/></g><g fill=\"#C9C4F2\"><rect x=\"20\" y=\"7\" width=\"8\" height=\"5\" rx=\"2\"/><rect x=\"7\" y=\"11\" width=\"34\" height=\"5\" rx=\"2.5\"/><path d=\"M10 16 H38 L35.5 41 H12.5 Z\"/></g><path d=\"M8.5 16 H39.5\" fill=\"none\" stroke=\"#1E1B2E\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><g class=\"cara\"><circle cx=\"19\" cy=\"25\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"29\" cy=\"25\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"19\" cy=\"25.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"29\" cy=\"25.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"15\" y=\"20.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"25\" y=\"20.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 32.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>",
  "El ple": "<svg class=\"icona\" width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"El ple\" style=\"--retard: 6.3s\"><g fill=\"#1E1B2E\" stroke=\"#1E1B2E\" stroke-width=\"6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><path d=\"M7 33 A17 17 0 0 1 41 33 Z\"/></g><g fill=\"#E2735A\"><path d=\"M7 33 A17 17 0 0 1 41 33 Z\"/></g><g class=\"cara\"><circle cx=\"20\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><circle cx=\"28\" cy=\"22\" r=\"3.6\" fill=\"#FBF7EE\"/><g class=\"pupilles\"><circle cx=\"20\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/><circle cx=\"28\" cy=\"22.4\" r=\"1.9\" fill=\"#1E1B2E\"/></g><g class=\"parpelles\"><rect x=\"16\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/><rect x=\"24\" y=\"17.8\" width=\"8\" height=\"8.4\" rx=\"3.4\" fill=\"#FBF7EE\"/></g><path class=\"boca\" d=\"M20 29.4 q4 3 8 0\" stroke=\"#1E1B2E\" stroke-width=\"2.1\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>"
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

// ------------------------------------------------------- les eines de dibuix
//
// Les mateixes regles que `tools/icons_lib.py` (llegeix-ne la capçalera): viewBox
// de 48, geometria dins de 7–41, un sol gruix de 3, la vora exterior feta amb
// `silueta()`, cap tinta directament sobre el fons i la mateixa cara a totes.
// Les icones d'aquí sota no surten a la portada i per això s'escriuen a mà en
// TypeScript, però s'han de poder posar al costat de les generades sense que
// es noti quina és de quina casa.

/** Els tons de la casa. Els mateixos hexadecimals que `tools/icons_lib.py`. */
const PAPER = "#FBF7EE";
const TINTA = "#1E1B2E";
const CORAL = "#E2735A";
const MENTA = "#BFE8D2";
const LAVANDA = "#C9C4F2";
const PRESEC = "#FFD8B8";

/** El gruix de la casa, en unitats del viewBox de 48. */
const TRAC = 3;

/**
 * La cara, mesurada igual que la de les icones generades.
 *
 * Els ulls van a ±5 del centre (±4 quan el cos és estret) amb radi 3,6; la
 * pupil·la 0,4 més avall; la parpella és un rectangle de 8×8,4 amb radi 3,4
 * que arrenca 4 a l'esquerra i 4,2 amunt de cada ull, i la boca surt 7,4 per
 * sota. Copiar aquestes xifres i no arrodonir-les és el que fa que una icona
 * nova parpellegi exactament com les de la portada: el CSS d'`estil.ts` anima
 * els grups pel nom de classe.
 */
function cara(cx: number, cy: number, sep = 5): string {
  const esq = cx - sep;
  const dre = cx + sep;
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
 * La vora exterior d'un objecte: un traç de 6 per darrere i el color a sobre.
 *
 * La meitat de dins del traç queda tapada pel color i la de fora en surt 3,
 * que és el gruix de la casa. Diverses formes dins de la mateixa crida fan una
 * sola silueta sense costures (el bus amb les rodes); dues crides seguides fan
 * dos objectes, i la vora del segon passa per damunt del primer (les cases del
 * consell comarcal, la papereta dins de l'urna). És el mateix que
 * `silueta()` d'`icons_lib.py`, caràcter per caràcter.
 */
function silueta(color: string, ...formes: string[]): string {
  const cos = formes.join("");
  return (
    `<g fill="${TINTA}" stroke="${TINTA}" stroke-width="${2 * TRAC}" stroke-linejoin="round" ` +
    `stroke-linecap="round">${cos}</g><g fill="${color}">${cos}</g>`
  );
}

/** Un detall de tinta al gruix de la casa, amb el cap rodó. */
function ratlla(d: string): string {
  return (
    `<path d="${d}" fill="none" stroke="${TINTA}" stroke-width="${TRAC}" ` +
    'stroke-linecap="round" stroke-linejoin="round"/>'
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

// ------------------------------------------------------------- els serveis
//
// El bloc «On han posat els diners, servei a servei» de la fitxa treu quinze
// files —les quinze de `PROGRAMES` a `jobs/j15-despesa-serveis.ts`— i el bloc
// «Què costa cada servei» n'hi afegeix onze més del cost efectiu del Ministeri.
// La família de la portada només tenia els setze temes i cap d'ells era ni el
// clavegueram ni el cementiri: aquí es dibuixen els que faltaven, amb les
// mateixes regles i la mateixa cara.

/** Les dents de la roda dentada: vuit quadrats girats de 45 en 45 graus. */
const DENTS = Array.from(
  { length: 8 },
  (_, k) => `<rect x="20" y="7" width="8" height="8" rx="1.5" transform="rotate(${k * 45} 24 24)"/>`,
).join("");

/**
 * Les icones dels serveis municipals, les que no són a la portada.
 *
 * Totes es llegeixen a 24 px: a la fitxa surten a 26–28 px (`.ullada .dibuix
 * .icona` i `.mandat .tema .icona` a `estil.ts`), que és la mida on una silueta
 * amb tres detalls encara es distingeix i una amb sis ja no.
 */
export const ICONES_SERVEIS: Readonly<Record<string, string>> = {
  // La gota, plena, sense cap reflex: a 24 px la gota es reconeix per la punta
  // de dalt i prou, i qualsevol reflex li menjaria un ull.
  "Aigua potable": svg(
    "Aigua potable",
    0.0,
    silueta(MENTA, '<path d="M24 7 C16 18 11.5 23.5 11.5 28.5 A12.5 12.5 0 0 0 36.5 28.5 C36.5 23.5 32 18 24 7 Z"/>') +
      cara(24, 28),
  ),
  // La tapa de la claveguera amb una ranura a dalt i una a baix: és el que se'n
  // veu al carrer. Un tub seccionat només el reconeix qui l'ha instal·lat.
  Clavegueram: svg(
    "Clavegueram",
    0.9,
    silueta(LAVANDA, '<circle cx="24" cy="24" r="17"/>') + ratlla("M17 11.5 H31 M15 35.5 H33") + cara(24, 20.5),
  ),
  // El fanal: pantalla, pal i peu, tot d'una peça. La cara va a la pantalla,
  // que és l'única part prou ampla per encabir-hi dos ulls.
  "Enllumenat públic": svg(
    "Enllumenat públic",
    1.8,
    silueta(
      PRESEC,
      '<path d="M13 8 H35 L41 27 H7 Z"/>',
      '<rect x="21.5" y="27" width="5" height="10"/>',
      '<rect x="15" y="37" width="18" height="4" rx="2"/>',
    ) + cara(24, 15),
  ),
  // L'arbre. La copa rodona sola seria la pilota d'«Esports»: el tronc és tot
  // el que les separa. Va de préssec i no de tinta perquè en fosc no
  // desaparegui, i és l'únic segon to de la família: és un altre objecte.
  "Parcs i jardins": svg(
    "Parcs i jardins",
    2.7,
    silueta(PRESEC, '<rect x="21" y="30" width="6" height="11" rx="1.5"/>') +
      silueta(MENTA, '<circle cx="24" cy="20" r="13"/>') +
      cara(24, 20),
  ),
  // El carrer en perspectiva, que s'eixampla cap a baix, amb la ratlla del mig
  // a dalt i a baix de la cara. La falca sola ja diu carretera.
  "Vies públiques": svg(
    "Vies públiques",
    3.6,
    silueta(LAVANDA, '<path d="M7 41 L18 8 H30 L41 41 Z"/>') + ratlla("M24 11.5 V14 M24 36.5 V38.5") + cara(24, 24),
  ),
  // L'escombra. La «Neteja» és el cubell de les escombraries, i la neteja
  // viària és una partida diferent: si compartissin dibuix, dues files
  // consecutives de la llista es llegirien com la mateixa.
  "Neteja viària": svg(
    "Neteja viària",
    4.5,
    silueta(PRESEC, '<rect x="21.5" y="7" width="5" height="13"/>', '<path d="M11 19 H37 L41 41 H7 Z"/>') +
      ratlla("M10.5 23 H37.5") +
      cara(24, 29.5),
  ),
  // La planta, amb la xemeneia i la teulada de dents de serra. El tractament
  // no és la recollida —a la fitxa són dues xifres separades— i el cubell ja és
  // de la recollida, així que aquí hi va l'edifici on van a parar.
  "Tractament de residus": svg(
    "Tractament de residus",
    5.4,
    silueta(
      MENTA,
      '<rect x="7" y="23" width="34" height="18" rx="2"/>',
      '<rect x="9" y="8" width="7" height="16"/>',
      '<path d="M16 23 L23 16 L29 23 L35 16 L41 23 Z"/>',
    ) + cara(26, 29),
  ),
  // Dos llibres apilats, el de dalt més estret, amb el llom marcat al de baix.
  // El llibre obert ja és l'«Educació», i la biblioteca amb el mateix dibuix
  // que l'escola faria pensar que és la mateixa partida.
  "Biblioteques i arxius": svg(
    "Biblioteques i arxius",
    6.3,
    silueta(CORAL, '<rect x="10" y="7" width="28" height="9" rx="2"/>') +
      silueta(CORAL, '<rect x="7" y="16" width="34" height="25" rx="2.5"/>') +
      ratlla("M13 19 V38") +
      cara(25, 26),
  ),
  // La làpida sobre la base. Sense creu: el cementiri és un servei municipal i
  // no de cap confessió, i la creu hi posaria una que la dada no diu.
  Cementiri: svg(
    "Cementiri",
    0.0,
    silueta(LAVANDA, '<path d="M12 37 V22 A12 12 0 0 1 36 22 V37 Z"/>') +
      silueta(LAVANDA, '<rect x="7" y="36" width="34" height="5" rx="2"/>') +
      cara(24, 22),
  ),
  // El bitllet amb una moneda al davant. La moneda és la de la «Fiscalitat»
  // —la mateixa menta i el mateix cantell—, que és el que lliga el que es deu
  // amb el que es cobra; el bitllet és el que les separa.
  "Deute públic": svg(
    "Deute públic",
    0.9,
    silueta(CORAL, '<rect x="7" y="10" width="34" height="25" rx="3"/>') +
      silueta(MENTA, '<circle cx="34" cy="33" r="7"/>') +
      `<circle cx="34" cy="33" r="3.5" fill="none" stroke="${TINTA}" stroke-width="${TRAC}"/>` +
      cara(22, 19),
  ),
  // El moneder tancat amb el fermall. És el total de tot el que s'ha gastat, i
  // per això va sencer i no partit per parts. El fermall era de tinta i en fosc
  // semblava un mos: ara és corall amb vora.
  "Despesa total": svg(
    "Despesa total",
    1.8,
    silueta(PRESEC, '<rect x="7" y="13" width="34" height="27" rx="5"/>') +
      silueta(CORAL, '<path d="M31 20 H41 V32 H31 A2 2 0 0 1 29 30 V22 A2 2 0 0 1 31 20 Z"/>') +
      `<circle cx="35" cy="26" r="1.8" fill="${TINTA}"/>` +
      cara(17.5, 24.5, 4),
  ),
  // La roda dentada: els serveis públics bàsics són un sac de set programes
  // (seguretat, mobilitat, habitatge, urbanisme, aigua, residus i enllumenat) i
  // dibuixar-ne un de sol faria passar el sac per una de les set coses.
  "Serveis públics bàsics": svg(
    "Serveis públics bàsics",
    2.7,
    silueta(MENTA, DENTS, '<circle cx="24" cy="24" r="13.5"/>') + cara(24, 22),
  ),
  // La carpeta d'expedients. L'hemicicle ja és «El ple», que és on es decideix;
  // l'administració general és la casa que ho tramita.
  "Administració general": svg(
    "Administració general",
    3.6,
    silueta(PRESEC, '<path d="M7 12 H19 L23 16 H41 V39 A2 2 0 0 1 39 41 H9 A2 2 0 0 1 7 39 Z"/>') +
      ratlla("M8.5 20 H39.5") +
      cara(24, 28),
  ),
  // El recanvi. Un servei que no tingui dibuix no pot deixar el forat: la
  // llista queda desalineada i sembla que a aquella fila li falti la dada.
  "Un servei": svg(
    "Un servei",
    4.5,
    silueta(LAVANDA, '<rect x="8" y="8" width="32" height="32" rx="8"/>') + cara(24, 22),
  ),
};

// ------------------------------------------------------ els ens i el govern
//
// Les fitxes de les diputacions i dels consells comarcals, i les portades de
// la comarca i del poble, feien servir icones de prestat: «Municipis» duia la
// grua d'«Urbanisme», «Habitants» el cor dels «Serveis socials» i «La força
// amb més alcaldies» la mà de la «Participació». Es llegia, però deia una cosa
// que no era. Aquí hi ha els dibuixos propis, amb les mateixes regles.

/**
 * Les icones dels ens supramunicipals i de les xifres del govern local.
 *
 * Totes porten cara menys «Regidories»: l'hemicicle d'escons és un gràfic, no
 * un veí, i el forat del mig no té lloc per a dos ulls. «El ple» ja és
 * l'hemicicle amb cara per a qui en vulgui un.
 */
export const ICONES_ENS: Readonly<Record<string, string>> = {
  // El palau: frontó baix i ample, cornisa i la bandera dalt de tot. El frontó
  // pla i la bandera és el que el separa de la casa d'«Habitatge», que té la
  // teulada punxeguda.
  "Diputació": svg(
    "Diputació",
    5.4,
    silueta(CORAL, '<rect x="25.25" y="7" width="9" height="6" rx="1"/>') +
      silueta(
        LAVANDA,
        '<rect x="22.75" y="7" width="2.5" height="8"/>',
        '<path d="M7 22 L24 13 L41 22 Z"/>',
        '<rect x="9" y="22" width="30" height="19"/>',
      ) +
      ratlla("M8.5 22 H39.5") +
      cara(24, 29.5),
  ),
  // Tres cases: el consell comarcal és dels municipis de la comarca, i és la
  // seva gent la que hi seu. La del mig, al davant, és la que porta la cara.
  "Consell comarcal": svg(
    "Consell comarcal",
    6.3,
    silueta(MENTA, '<path d="M7 21 L14 14 L21 21 V41 H7 Z"/>') +
      silueta(MENTA, '<path d="M27 21 L34 14 L41 21 V41 H27 Z"/>') +
      silueta(MENTA, '<path d="M15 25 L24 17 L33 25 V41 H15 Z"/>') +
      cara(24, 30.5, 4),
  ),
  // L'ajuntament: la casa de la vila, ampla, amb la torre al mig i la finestra
  // fosca. Una finestra i no un rellotge: un cercle clar a la torre feia de
  // tercer ull. Sola, l'espadanya semblava un cadenat.
  Municipis: svg(
    "Municipis",
    0.0,
    silueta(
      PRESEC,
      '<path d="M16 14 L24 7.5 L32 14 Z"/>',
      '<rect x="18" y="13" width="12" height="10"/>',
      '<rect x="7" y="22" width="34" height="19" rx="1.5"/>',
    ) +
      `<rect x="22.5" y="15.5" width="3" height="4.5" rx="1.5" fill="${TINTA}"/>` +
      cara(24, 29.5),
  ),
  // Dos veïns, un davant de l'altre. El de davant porta la cara; el de darrere
  // és el que fa que sigui gent i no una persona.
  Habitants: svg(
    "Habitants",
    0.9,
    silueta(LAVANDA, '<circle cx="32" cy="14" r="6"/>', '<path d="M23 41 V33 A9 9 0 0 1 41 33 V41 Z"/>') +
      silueta(PRESEC, '<path d="M7 41 V38 A12 10 0 0 1 31 38 V41 Z"/>') +
      silueta(PRESEC, '<circle cx="19" cy="20" r="11"/>') +
      cara(19, 19.5),
  ),
  // La moneda que arriba a la casa: el que una administració dona a una altra
  // o a una entitat. La moneda és la de la «Fiscalitat», menta i amb cantell.
  Subvencions: svg(
    "Subvencions",
    1.8,
    silueta(PRESEC, '<path d="M7 25 L19 14 L31 25 V41 H7 Z"/>') +
      silueta(MENTA, '<circle cx="33" cy="15" r="7.5"/>') +
      `<circle cx="33" cy="15" r="3.6" fill="none" stroke="${TINTA}" stroke-width="${TRAC}"/>` +
      cara(19, 30.5, 4),
  ),
  // L'urna amb la papereta entrant. La papereta és de paper i el vist és el
  // corall de la mascota: en fosc és el que més es veu de tota la família.
  Vots: svg(
    "Vots",
    2.7,
    silueta(PAPER, '<rect x="15" y="7" width="18" height="17" rx="1.5"/>') +
      `<path d="M19.5 12.5 L22.5 15.5 L28.5 9.5" fill="none" stroke="${CORAL}" stroke-width="${TRAC}" stroke-linecap="round" stroke-linejoin="round"/>` +
      silueta(LAVANDA, '<rect x="7" y="20" width="34" height="21" rx="3"/>') +
      cara(24, 28.5),
  ),
  // L'hemicicle d'escons, partit en quatre grups per tres radis. Un sol to: amb
  // quatre colors es llegiria com el repartiment entre quatre partits concrets.
  Regidories: svg(
    "Regidories",
    3.6,
    silueta(CORAL, '<path d="M7 36 A17 17 0 0 1 41 36 H31 A7 7 0 0 0 17 36 Z"/>') +
      ratlla("M19.05 31.05 L11.98 23.98 M24 29 V19 M28.95 31.05 L36.02 23.98"),
  ),
  // La medalla de l'alcaldia: la cinta i el disc. És el que l'alcalde porta al
  // ple i el que la llei li dona, sense partit.
  Alcaldia: svg(
    "Alcaldia",
    4.5,
    silueta(LAVANDA, '<path d="M14 7 H21 L27 20 H20 Z"/>', '<path d="M34 7 H27 L21 20 H28 Z"/>') +
      silueta(PRESEC, '<circle cx="24" cy="28.5" r="12.5"/>') +
      cara(24, 27.5),
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
  // El deute viu de les diputacions i dels consells (J38) és el mateix bitllet.
  deute: "Deute públic",
  "deute viu": "Deute públic",
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

/**
 * Com es poden demanar les icones dels ens i del govern local.
 *
 * Els temes de les pastilles s'escriuen a mà a cada pàgina, i cadascú els
 * escriu com li surt: en singular, en plural o amb el nom de l'ens sencer.
 * Totes les formes porten al mateix dibuix.
 */
const ALIES_ENS: Readonly<Record<string, string>> = {
  diputacio: "Diputació",
  diputacions: "Diputació",
  "diputacio provincial": "Diputació",
  "consell comarcal": "Consell comarcal",
  "consells comarcals": "Consell comarcal",
  consell: "Consell comarcal",
  comarca: "Consell comarcal",
  municipis: "Municipis",
  municipi: "Municipis",
  ajuntament: "Municipis",
  ajuntaments: "Municipis",
  habitants: "Habitants",
  poblacio: "Habitants",
  padro: "Habitants",
  subvencions: "Subvencions",
  subvencio: "Subvencions",
  ajuts: "Subvencions",
  repartiment: "Subvencions",
  vots: "Vots",
  vot: "Vots",
  papereta: "Vots",
  eleccions: "Vots",
  regidories: "Regidories",
  regidors: "Regidories",
  escons: "Regidories",
  alcaldia: "Alcaldia",
  alcaldies: "Alcaldia",
  alcalde: "Alcaldia",
  alcaldessa: "Alcaldia",
};

/** La clau de cerca: sense accents, en minúscules i amb l'apòstrof normalitzat. */
function clauDe(tema: string): string {
  return tema
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .trim();
}

/** El nom d'icona d'una clau, miri a quin mapa d'àlies miri. */
function nomDe(clau: string): string | null {
  return ALIES[clau] ?? ALIES_SERVEIS[clau] ?? ALIES_ENS[clau] ?? null;
}

/** El dibuix d'un nom d'icona, sigui de la família que sigui. */
function dibuix(nom: string): string {
  return ICONES[nom] ?? ICONES_SERVEIS[nom] ?? ICONES_ENS[nom] ?? "";
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
 * crida existent no canvia ni un caràcter de sortida. Totes les crides d'avui
 * posen la icona al costat del seu nom escrit, i per a aquestes el bo és
 * `icona(tema, true)`: muda, perquè el lector de pantalla no llegeixi dues
 * vegades el mateix. L'omissió no es canvia perquè hi ha proves de pàgina que
 * compten amb l'`aria-label`.
 */
export function icona(tema: string, decorativa = false): string {
  const nom = nomDe(clauDe(tema)) ?? ALIES[tema.toLowerCase().trim()] ?? null;
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
  const nom = nomDe(clauDe(servei)) ?? "Un servei";
  const svgText = dibuix(nom) || ICONES_SERVEIS["Un servei"]!;
  return decorativa ? muda(svgText) : svgText;
}
