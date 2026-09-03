/**
 * El dibuixant de les imatges per a xarxes: un Chrome sense finestra que
 * s'obre una sola vegada i captura cada composició a la mida que toca.
 *
 * És el mateix mecanisme que `packages/pipeline/src/publish/og.ts` (Chrome pel
 * protocol de depuració, tipografies incrustades com a `data:`), però en un
 * fitxer a part: `og.ts` importa la base de dades i les feines de publicació,
 * i aquest generador ha de poder córrer llegint només els fitxers publicats a
 * `web/public/observatori/`. Copiar quaranta línies val més que arrossegar
 * PGlite per fer un PNG.
 *
 * A diferència de l'OG, aquí cada imatge té la seva mida (1600×900 per a X,
 * 1080×1350 per al 4:5) i el seu propi CSS: el document base només porta les
 * fonts i els colors del sistema de disseny, i `pinta()` hi injecta el cos i
 * l'estil de cada proposta.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ARREL = new URL("../../", import.meta.url).pathname;
const FONTS = join(ARREL, "web/public/assets/fonts");

const CHROME_CANDIDATS = [
  process.env.QUIVOTO_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((x): x is string => Boolean(x));

/** Els colors del sistema de disseny, els mateixos de `styles.css`. */
export const COLORS = {
  paper: "#FBF7EE", tinta: "#1E1B2E", tintaSuau: "#5B5870", coral: "#E2735A",
  menta: "#BFE8D2", lavanda: "#C9C4F2", presec: "#FFD8B8", vora: "#EDE7DA", blanc: "#FFFFFF",
} as const;

/** Incrusta un woff2 del web com a `data:`: des d'un document `file:` Chrome
 *  no pot anar a buscar la tipografia, i sortiria la lletra del sistema. */
function fontIncrustada(fitxer: string): string {
  const dades = readFileSync(join(FONTS, fitxer));
  return `url(data:font/woff2;base64,${dades.toString("base64")}) format('woff2')`;
}

/** El document base: fonts, colors i un `pinta()` que hi posa cada proposta. */
export function documentBase(): string {
  const gabaritoLlati = fontIncrustada("QGYtz_0dZAGKJJ4t3HtoW4XGnfBI.woff2");
  const gabaritoEstes = fontIncrustada("QGYtz_0dZAGKJJ4t3HtmW4XGnfBI2fk.woff2");
  const nunitoLlati = fontIncrustada("pe0AMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUVwoNnq4CLz0_kJ3xzHGGVFM.woff2");
  const nunitoEstes = fontIncrustada("pe0AMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUVwoNnq4CLz0_kJPxzHGGVFMV2w.woff2");
  return `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><title>xarxes</title>
<style>
@font-face{font-family:Gabarito;font-weight:400 900;src:${gabaritoLlati}}
@font-face{font-family:Gabarito;font-weight:400 900;src:${gabaritoEstes}}
@font-face{font-family:"Nunito Sans";font-weight:200 1000;src:${nunitoLlati}}
@font-face{font-family:"Nunito Sans";font-weight:200 1000;src:${nunitoEstes}}
:root{--paper:${COLORS.paper};--ink:${COLORS.tinta};--ink-suau:${COLORS.tintaSuau};--coral:${COLORS.coral};
  --menta:${COLORS.menta};--lavanda:${COLORS.lavanda};--presec:${COLORS.presec};--vora:${COLORS.vora}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden}
body{background:var(--paper);color:var(--ink);font-family:"Nunito Sans",sans-serif;-webkit-font-smoothing:antialiased}
</style>
<style id="extra"></style>
</head><body>
<script>
window.pinta = async (d) => {
  document.documentElement.style.width = d.ample + "px";
  document.documentElement.style.height = d.alt + "px";
  document.body.style.width = d.ample + "px";
  document.body.style.height = d.alt + "px";
  document.body.className = d.classes || "";
  document.getElementById("extra").textContent = d.css;
  document.body.innerHTML = d.html;
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((fet) => { img.onload = img.onerror = fet; })));
  // Dos fotogrames: el primer aplica l'estil, el segon garanteix que ja s'ha pintat.
  await new Promise((fet) => requestAnimationFrame(() => requestAnimationFrame(fet)));
  return true;
};
</script>
</body></html>`;
}

export type Cdp = {
  crida: (metode: string, params?: Record<string, unknown>) => Promise<any>;
  tanca: () => Promise<void>;
};

async function esperaPort(perfil: string, proces: ChildProcess): Promise<number> {
  const fins = Date.now() + 20_000;
  while (Date.now() < fins) {
    if (proces.exitCode !== null) throw new Error(`Chrome ha sortit amb codi ${proces.exitCode}`);
    try {
      const port = Number((await readFile(join(perfil, "DevToolsActivePort"), "utf8")).split("\n")[0]);
      if (Number.isFinite(port) && port > 0) return port;
    } catch { /* encara no hi és */ }
    await new Promise((fet) => setTimeout(fet, 50));
  }
  throw new Error("Chrome no ha obert el port de depuració en 20 s");
}

/** Obre Chrome amb un document i retorna com parlar-hi pel protocol de depuració. */
export async function obreChrome(documentUrl: string): Promise<Cdp> {
  const binari = CHROME_CANDIDATS.find((ruta) => { try { readFileSync(ruta, { flag: "r" }); return true; } catch { return false; } });
  if (!binari) throw new Error(`No s'ha trobat Chrome. Provats: ${CHROME_CANDIDATS.join(", ")}. Es pot indicar amb QUIVOTO_CHROME.`);

  const perfil = await mkdtemp(join(tmpdir(), "quivoto-xarxes-"));
  const proces = spawn(binari, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking", "--disable-sync", "--mute-audio",
    `--user-data-dir=${perfil}`, "--window-size=1600,1350", "--remote-debugging-port=0", documentUrl,
  ], { stdio: "ignore" });
  const port = await esperaPort(perfil, proces);

  const objectius = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl?: string }[];
  const pagina = objectius.find((o) => o.type === "page" && o.webSocketDebuggerUrl);
  if (!pagina?.webSocketDebuggerUrl) throw new Error("Chrome no ha obert cap pestanya");

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  const pendents = new Map<number, { fet: (v: any) => void; fallat: (e: Error) => void }>();
  let seguent = 0;
  await new Promise<void>((fet, fallat) => {
    ws.addEventListener("open", () => fet(), { once: true });
    ws.addEventListener("error", () => fallat(new Error("no s'ha pogut connectar amb Chrome")), { once: true });
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    const espera = pendents.get(msg.id);
    if (!espera) return;
    pendents.delete(msg.id);
    if (msg.error) espera.fallat(new Error(`${msg.error.message ?? "error"} (${msg.method ?? ""})`));
    else espera.fet(msg.result);
  });
  const crida = (metode: string, params: Record<string, unknown> = {}): Promise<any> => {
    seguent += 1;
    const id = seguent;
    return new Promise((fet, fallat) => { pendents.set(id, { fet, fallat }); ws.send(JSON.stringify({ id, method: metode, params })); });
  };

  return {
    crida,
    tanca: async () => {
      try { ws.close(); } catch { /* tant se val */ }
      await new Promise<void>((fet) => {
        if (proces.exitCode !== null || proces.signalCode !== null) return fet();
        const insisteix = setTimeout(() => proces.kill("SIGKILL"), 3_000);
        proces.once("exit", () => { clearTimeout(insisteix); fet(); });
        proces.kill();
      });
      try { await rm(perfil, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* el sistema ja el buidarà */ }
    },
  };
}

/** Una composició a dibuixar: el cos i l'estil, a una mida concreta. */
export type Composicio = { ample: number; alt: number; html: string; css: string; classes: string };

/**
 * Obre el document base i retorna un dibuixant: `png(composicio)` dona els
 * bytes de la captura. Chrome espera amb el document carregat fins a `tanca()`.
 */
export async function obreDibuixant(): Promise<{ png: (c: Composicio) => Promise<Buffer>; cdp: Cdp; tanca: () => Promise<void> }> {
  const treball = await mkdtemp(join(tmpdir(), "quivoto-xarxes-doc-"));
  const documentPath = join(treball, "xarxes.html");
  await writeFile(documentPath, documentBase(), "utf8");
  const cdp = await obreChrome(`file://${documentPath}`);
  const fins = Date.now() + 20_000;
  for (;;) {
    const { result } = await cdp.crida("Runtime.evaluate", { expression: "typeof window.pinta" });
    if (result?.value === "function") break;
    if (Date.now() > fins) throw new Error("el document base no s'ha carregat");
    await new Promise((fet) => setTimeout(fet, 50));
  }
  let midaActual = "";
  return {
    cdp,
    png: async (c) => {
      const mida = `${c.ample}x${c.alt}`;
      if (mida !== midaActual) {
        // El llenç es fixa per emulació: `--window-size` no dona mides exactes.
        await cdp.crida("Emulation.setDeviceMetricsOverride", { width: c.ample, height: c.alt, deviceScaleFactor: 1, mobile: false });
        midaActual = mida;
      }
      await cdp.crida("Runtime.evaluate", { expression: `window.pinta(${JSON.stringify(c)})`, awaitPromise: true });
      const { data } = await cdp.crida("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: c.ample, height: c.alt, scale: 1 } });
      return Buffer.from(data as string, "base64");
    },
    tanca: async () => { await cdp.tanca(); await rm(treball, { recursive: true, force: true }); },
  };
}
