/**
 * Captures reals del web publicat, per a la família «captura emmarcada».
 *
 * Les pàgines de `web/public/` demanen els estils i les dades amb camins
 * absoluts (`/assets/…`, `/observatori/…`), i per això no es poden obrir amb
 * `file:`: s'aixeca un servidor estàtic de Python mentre dura la feina i es
 * tanca en acabar. Les captures es fan amb el mateix Chrome pel protocol de
 * depuració, amb emulació de mòbil (390×844 a ×2) o d'escriptori (1440×900),
 * perquè `--window-size` sol no dona un finestral de la mida exacta.
 *
 * Es retornen com a `data:` PNG per incrustar-les al document de la imatge.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { ARREL, obreChrome } from "./render";

export type Captura = {
  nom: string; cami: string; ample: number; alt: number; escala: number; mobil: boolean;
};

async function serveix(dir: string): Promise<{ port: number; atura: () => void }> {
  // Un port alt i poc habitual, per no trepitjar el `http.server 8788` que
  // l'usuari pugui tenir obert a mà.
  const port = 8790 + Math.floor(Math.random() * 100);
  const proces: ChildProcess = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: dir, stdio: "ignore" });
  const fins = Date.now() + 10_000;
  while (Date.now() < fins) {
    try { const r = await fetch(`http://127.0.0.1:${port}/`, { method: "HEAD" }); if (r.ok || r.status === 404) break; } catch { /* encara no */ }
    if (proces.exitCode !== null) throw new Error("el servidor local no s'ha pogut aixecar (cal python3)");
    await new Promise((fet) => setTimeout(fet, 100));
  }
  return { port, atura: () => { try { proces.kill(); } catch { /* ja és mort */ } } };
}

/** Fa totes les captures i les retorna per nom, com a `data:image/png;base64,…`. */
export async function captures(llista: readonly Captura[]): Promise<Record<string, string>> {
  if (llista.length === 0) return {};
  const { port, atura } = await serveix(join(ARREL, "web/public"));
  const base = `http://127.0.0.1:${port}`;
  const out: Record<string, string> = {};
  const chrome = await obreChrome(`${base}${llista[0]!.cami}`);
  try {
    await chrome.crida("Page.enable");
    for (const c of llista) {
      await chrome.crida("Emulation.setDeviceMetricsOverride", { width: c.ample, height: c.alt, deviceScaleFactor: c.escala, mobile: c.mobil });
      // El Chrome sense cap perfil arrenca amb el tema fosc del sistema, i el
      // web el respecta: la captura sortia en fosc i no s'assemblava al que
      // veu la majoria. S'hi força el tema clar, que és el de la marca.
      await chrome.crida("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
      if (c.mobil) {
        await chrome.crida("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
        await chrome.crida("Emulation.setTouchEmulationEnabled", { enabled: true });
      }
      await chrome.crida("Page.navigate", { url: `${base}${c.cami}` });
      // Esperem la càrrega, les fonts i un moment perquè els guions pintin (cercador, mapa).
      const fins = Date.now() + 15_000;
      for (;;) {
        const { result } = await chrome.crida("Runtime.evaluate", { expression: "document.readyState === 'complete'" });
        if (result?.value === true) break;
        if (Date.now() > fins) throw new Error(`la pàgina ${c.cami} no s'ha carregat`);
        await new Promise((fet) => setTimeout(fet, 100));
      }
      await chrome.crida("Runtime.evaluate", { expression: "document.fonts.ready.then(() => new Promise(r => setTimeout(r, 700)))", awaitPromise: true });
      await chrome.crida("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
      const { data } = await chrome.crida("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      out[c.nom] = `data:image/png;base64,${data}`;
      process.stdout.write(`  captura ${c.nom} (${c.ample}×${c.alt} ×${c.escala})\n`);
    }
  } finally {
    await chrome.tanca();
    atura();
  }
  return out;
}
