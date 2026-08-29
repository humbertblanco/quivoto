import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMandat20192023, parseMandatActual } from "../adapters/barcelona";
import { deLActa, encaixa, type Grup } from "../publish/posicions";
import { puntDe, type PuntActa } from "../publish/enllac-actes";
import {
  SENTIT_J12,
  alies,
  aplicaCanvis,
  cobertura,
  etiquetaPreferida,
  etiquetesQueLliguen,
  puntDesat,
  recompteDelAcord,
  resumPerGrup,
  retard,
  sentitJ12,
  tipusDelAcord,
  totalVots,
  valLaPenaDesar,
  votsDelAcord,
  type PuntDesat,
} from "./j16-barcelona-plenari";

/**
 * Les proves van sobre els **mateixos retalls literals** dels CSV oficials que
 * fa servir la prova de l'adaptador. No es fabrica cap CSV de mentida: el que ha
 * de quedar demostrat és que els casos rars de debò —la votació nominal, el grup
 * amb dues columnes, l'acord sense vot— surten bé a l'altra banda.
 *
 * El que es comprova, per ordre d'importància:
 *   1. que la sortida **encaixi** amb el que el `publish/` ja llegeix, provant-ho
 *      amb les seves pròpies funcions (`deLActa`, `encaixa`, `puntDe`);
 *   2. que la traducció de sentits no inventi cap vot;
 *   3. que les etiquetes de grup lliguin amb el ple de Barcelona escrit de les
 *      dues maneres en què el poden escriure les fonts.
 */
const FIXTURES = join(__dirname, "..", "adapters", "__fixtures__");
const acordsActual = parseMandatActual(
  readFileSync(join(FIXTURES, "barcelona-votacions-mandat-actual.csv"), "utf8"),
);
const acords2019 = parseMandat20192023(
  readFileSync(join(FIXTURES, "barcelona-votacions-2019-2023.csv"), "utf8"),
);

const puntsActual = acordsActual.map((a) => puntDesat(a).punt);
const punts2019 = acords2019.map((a) => puntDesat(a).punt);

/**
 * El ple de Barcelona del mandat 2023-2027, tal com el veurà `grupsDelPle()`:
 * PSC 10, Junts 11, BComú 9, ERC 5, PP 4 i Vox 2, amb el govern del PSC.
 *
 * Dues versions perquè no controlem com escriu els noms el registre de càrrecs:
 * amb sigles (que és com les publica Barcelona: «PSC», «PP», «ERC») i amb el nom
 * llarg. Si les etiquetes desades només lliguessin amb una de les dues, la fitxa
 * funcionaria o no segons d'on hagués sortit la llista de càrrecs.
 */
const PLE_AMB_SIGLES: Grup[] = [
  { nom: "PSC", sigles: "PSC-CP", escons: 10, govern: true, color: null },
  { nom: "Junts", sigles: "Junts", escons: 11, govern: false, color: null },
  { nom: "BComú", sigles: "BComú-Verds", escons: 9, govern: false, color: null },
  { nom: "ERC", sigles: "ERC-AM", escons: 5, govern: false, color: null },
  { nom: "PP", sigles: "PP", escons: 4, govern: false, color: null },
  { nom: "Vox", sigles: "VOX", escons: 2, govern: false, color: null },
];

const PLE_AMB_NOMS_LLARGS: Grup[] = [
  { nom: "Grup Municipal del Partit dels Socialistes de Catalunya", sigles: "PSC-CP", escons: 10, govern: true, color: null },
  { nom: "Grup Municipal de Junts per Barcelona", sigles: "Junts", escons: 11, govern: false, color: null },
  { nom: "Grup Municipal de Barcelona en Comú", sigles: "BComú-Verds", escons: 9, govern: false, color: null },
  { nom: "Grup Municipal d'Esquerra Republicana", sigles: "ERC-AM", escons: 5, govern: false, color: null },
  { nom: "Grup Municipal del Partit Popular", sigles: "PP", escons: 4, govern: false, color: null },
  { nom: "Grup Municipal de VOX", sigles: "VOX", escons: 2, govern: false, color: null },
];

// ─────────────────────────────────────────────────────────────────────────────

describe("traducció de sentits", () => {
  it("tradueix els quatre vots que la font declara", () => {
    expect(sentitJ12("a_favor")).toBe("favor");
    expect(sentitJ12("en_contra")).toBe("contra");
    expect(sentitJ12("abstencio")).toBe("abstencio");
    // «-» al CSV: el grup va abandonar la sala. No és una abstenció.
    expect(sentitJ12("absent")).toBe("absent");
  });

  it("no converteix el silenci de la font en un vot en blanc", () => {
    // El parany: J12 té un valor «blanc» i és temptador encaixar-hi `no_consta`.
    // Però «blanc» és una papereta en blanc de veritat, i la cel·la buida del
    // CSV vol dir que no consta res. Traduir-ho seria inventar-se un vot.
    expect(sentitJ12("no_consta")).toBeNull();
  });

  it("només fa servir el vocabulari de J12", () => {
    const deJ12 = new Set(["favor", "contra", "abstencio", "blanc", "absent"]);
    for (const destí of Object.values(SENTIT_J12)) {
      if (destí !== null) expect(deJ12.has(destí)).toBe(true);
    }
  });

  it("no deixa cap sentit de l'adaptador sense decidir", () => {
    // Si l'adaptador n'afegeix un de nou, la taula deixa de ser exhaustiva i
    // TypeScript ho para; això comprova que avui hi són tots cinc.
    expect(Object.keys(SENTIT_J12).sort()).toEqual([
      "a_favor",
      "absent",
      "abstencio",
      "en_contra",
      "no_consta",
    ]);
  });
});

describe("votsDelAcord", () => {
  it("deixa el recompte a null quan la font només publica el sentit del grup", () => {
    // Barcelona no diu quants regidors hi va posar cada grup. `null` és com el
    // `publish/` llegeix «tot el grup»; posar-hi els escons seria inventar-ho.
    const { vots } = votsDelAcord(acordsActual[0]!);
    expect(vots.every((v) => v.vots === null)).toBe(true);
    expect(vots.map((v) => `${v.grup}=${v.sentit}`)).toEqual([
      "Barcelona en Comú=contra",
      "PSC=contra",
      "ERC=contra",
      "PP=favor",
      "VOX=abstencio",
      "Junts=contra",
    ]);
  });

  it("rescata la votació nominal comptant els regidors per grup", () => {
    // L'única votació nominal del mandat (qüestió de confiança, CP 14/25 EXT).
    // Sense això seria una fila sense cap vot, perquè no té columnes de grup
    // plenes; agregant els 41 regidors pel grup que declara la capçalera, en
    // surt el vot de tothom **amb xifres**, que és més del que dona la resta.
    const nominal = acordsActual.find((a) => a.sistemaVotacio === "nominal")!;
    const { vots, retrets } = votsDelAcord(nominal);
    expect(retrets).toEqual([]);
    expect(vots.map((v) => `${v.grup}=${v.sentit}:${v.vots}`).sort()).toEqual([
      "Barcelona en Comú=abstencio:8",
      "ERC=favor:5",
      "Junts=contra:11",
      "PP=contra:4",
      "PSC=favor:10",
      "VOX=contra:2",
    ]);
    // Barcelona en Comú té nou regidories i una regidora hi consta absent: el
    // grup hi va posar vuit vots, no nou. Comptar l'absent seria un vot fantasma.
    expect(recompteDelAcord(nominal)).toEqual({
      favor: 15,
      contra: 17,
      abstencio: 8,
      blanc: null,
      absent: 1,
    });
  });

  it("no duplica el grup que la font escriu amb dos noms alhora", () => {
    // Mandat 2019-2023: tres files tenen «BCN Canvi» i «Valents» plenes totes
    // dues. Són la mateixa força rebatejada, i han de sortir com un sol vot.
    const dosNoms = acords2019[0]!;
    expect(dosNoms.votsGrup.filter((v) => v.grup === "Valents")).toHaveLength(2);
    const { vots, retrets } = votsDelAcord(dosNoms);
    expect(vots.filter((v) => v.grup === "Valents")).toHaveLength(1);
    expect(retrets).toEqual([]);
  });

  it("no tria per un grup que es contradiu a si mateix", () => {
    // Si les dues columnes del mateix grup diguessin coses diferents no hi ha
    // manera de saber quina val: no s'emet cap vot i queda registrat.
    const contradictori = structuredClone(acords2019[0]!);
    contradictori.votsGrup = contradictori.votsGrup.map((v, i) =>
      v.grup === "Valents" && i % 2 === 0 ? { ...v, sentit: "en_contra" as const } : v,
    );
    const { vots, retrets } = votsDelAcord(contradictori);
    expect(vots.some((v) => v.grup === "Valents")).toBe(false);
    expect(retrets.map((r) => r.kind)).toEqual(["barcelona_grup_amb_dos_sentits"]);
  });

  it("no atribueix cap posició al grup que es parteix en una votació nominal", () => {
    const nominal = structuredClone(acordsActual.find((a) => a.sistemaVotacio === "nominal")!);
    const desertor = nominal.votsRegidor.find((v) => v.grup === "Junts")!;
    desertor.sentit = "a_favor";
    const { vots, retrets } = votsDelAcord(nominal);
    expect(vots.some((v) => v.grup === "Junts")).toBe(false);
    expect(retrets.map((r) => r.kind)).toEqual(["barcelona_grup_partit_en_votacio_nominal"]);
  });

  it("no inventa vots quan la font calla", () => {
    const sense = acordsActual.find((a) => a.sistemaVotacio === "no_consta")!;
    expect(votsDelAcord(sense).vots).toEqual([]);
    expect(recompteDelAcord(sense)).toBeNull();
  });
});

describe("la forma de J12", () => {
  it("desa exactament els camps que J12 desa", () => {
    // Si en falta un, el `publish/` llegeix `undefined` i deixa de pintar el
    // bloc sense dir per què. Aquesta llista és el contracte amb J12.
    const punt = puntsActual[0]!;
    for (const camp of [
      "data",
      "codiActa",
      "url",
      "numero",
      "titol",
      "tipus",
      "proposant",
      "resultat",
      "unanimitat",
      "recompte",
      "vots",
      "cita",
    ]) {
      expect(punt).toHaveProperty(camp);
    }
    expect(punt.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(punt.url).toContain("ajuntament.barcelona.cat");
  });

  it("classifica la part d'impuls i control com a moció i les declaracions com a declaració", () => {
    expect(tipusDelAcord(acordsActual[0]!)).toBe("mocio");
    expect(tipusDelAcord(acordsActual[1]!)).toBe("acord");
    const declaracio = acords2019.find((a) => /Declaracions institucionals/i.test(a.partActa))!;
    expect(tipusDelAcord(declaracio)).toBe("declaracio");
  });

  it("marca la unanimitat tal com la declara la font", () => {
    const unanime = puntsActual.find((p) => p.resultat === "Aprovat per unanimitat")!;
    expect(unanime.unanimitat).toBe(true);
    // I amb el vot de cada grup igualment desglossat: no és una unanimitat
    // deduïda del text, és set caselles que diuen «a favor».
    expect(unanime.vots.every((v) => v.sentit === "favor")).toBe(true);
  });

  it("deixa el número de punt buit en comptes de posar-hi la referència d'expedient", () => {
    // `enllac-actes.ts` es queda els dígits del número per aparellar-lo amb
    // «acord núm. 6». De «23XI0095» en trauria «23» i el faria coincidir amb una
    // proposta que no té res a veure. Sense número no s'aparella; amb un número
    // inventat s'aparella malament, que és pitjor.
    expect(puntsActual.every((p) => p.numero === null)).toBe(true);
    const multiple = puntsActual.find((p) => p.refPropostes.length > 1)!;
    expect(multiple.refPropostes).toEqual(["23XI0095", "23XI0105", "25XI0020"]);

    const evidencia = "Ple del 21/11/2025, acord núm. 23.";
    expect(puntDe(evidencia, puntsActual as unknown as PuntActa[])).toBeNull();
  });

  it("cita el text literal de l'acord, no una frase escrita per nosaltres", () => {
    // La llicència demana no alterar el contingut: la cita és el camp `text` del
    // CSV, retallat com el retalla J12.
    expect(puntsActual[0]!.cita).toContain("El Plenari del Consell Municipal");
    expect(puntsActual[0]!.cita!.length).toBeLessThanOrEqual(400);
    // El mandat anterior no publica el text de l'acord: abans que muntar-ne un,
    // no se'n cita cap.
    expect(punts2019.every((p) => p.cita === null)).toBe(true);
  });

  it("desa les mocions encara que ningú no les hagi votades, com fa J12", () => {
    const declaracio = punts2019.find((p) => p.tipus === "declaracio")!;
    expect(declaracio.vots).toEqual([]);
    expect(valLaPenaDesar(declaracio)).toBe(true);
    const assabentat = puntsActual.find((p) => p.tipus === "acord" && p.vots.length === 0)!;
    expect(valLaPenaDesar(assabentat)).toBe(false);
  });
});

/**
 * El que desa el job: els punts amb les etiquetes ja ajustades al ple que hi ha.
 * És l'ordre real —primer s'ajusten les etiquetes, després s'escriu— i és l'únic
 * que té sentit provar, perquè és el que acabarà llegint el `publish/`.
 */
function comEsDesa(punts: readonly PuntDesat[], ple: Grup[]): PuntDesat[] {
  const copia = structuredClone(punts) as PuntDesat[];
  const { canvis, senseEncaix } = etiquetesQueLliguen(copia, ple);
  aplicaCanvis(copia, canvis);
  expect(senseEncaix).toEqual([]);
  return copia;
}

describe("encaix amb el que llegeix el publish/", () => {
  it("deLActa treu el costat de cada grup del ple d'avui", () => {
    // Aquesta és la prova que importa: la funció que el `publish/` fa servir per
    // saber qui va votar què, alimentada amb el que desem, ha de retornar els
    // sis grups del ple de Barcelona amb el costat correcte.
    const punt = comEsDesa(puntsActual, PLE_AMB_SIGLES)[0]! as unknown as PuntActa;
    const costats = deLActa(punt, PLE_AMB_SIGLES);
    expect(costats).not.toBeNull();
    expect(Object.fromEntries(costats!)).toEqual({
      "BComú": "contra",
      PSC: "contra",
      ERC: "contra",
      PP: "favor",
      Vox: "abstencio",
      Junts: "contra",
    });
  });

  it("funciona igual si el registre de càrrecs escriu els noms llargs", () => {
    const punt = comEsDesa(puntsActual, PLE_AMB_NOMS_LLARGS)[1]! as unknown as PuntActa;
    const costats = deLActa(punt, PLE_AMB_NOMS_LLARGS);
    expect(costats).not.toBeNull();
    expect(costats!.size).toBe(6);
    expect(costats!.get("Grup Municipal del Partit dels Socialistes de Catalunya")).toBe("favor");
    expect(costats!.get("Grup Municipal de Junts per Barcelona")).toBe("contra");
  });

  it("cap grup del mandat actual no es queda sense grup del ple", () => {
    // Escrit de les dues maneres, els sis grups del ple han de quedar resolts.
    for (const ple of [PLE_AMB_SIGLES, PLE_AMB_NOMS_LLARGS]) {
      for (const punt of comEsDesa(puntsActual, ple)) {
        for (const vot of punt.vots) expect(encaixa(vot.grup, ple), vot.grup).not.toBeNull();
      }
    }
  });

  it("ignora l'absència, que no és una posició", () => {
    // Junts va abandonar la sala en aquesta moció del mandat anterior: el vot es
    // desa com a `absent` i `deLActa` no li assigna cap costat.
    const abandonament = punts2019.find((p) => p.vots.some((v) => v.sentit === "absent"))!;
    const costats = deLActa(abandonament as unknown as PuntActa, PLE_AMB_SIGLES);
    expect(costats!.has("Junts")).toBe(false);
    expect(costats!.get("PP")).toBe("favor");
  });
});

describe("etiquetes de grup", () => {
  it("tria la forma que la taula de marques sap classificar", () => {
    expect(etiquetaPreferida("Partit dels Socialistes de Catalunya")).toBe("PSC");
    expect(etiquetaPreferida("Esquerra Republicana")).toBe("ERC");
    // Al revés que les altres: «BComú» no és a la taula de famílies i
    // «Barcelona en Comú» sí, perquè hi busca «encomu» a dins.
    expect(etiquetaPreferida("Barcelona en Comú")).toBe("Barcelona en Comú");
  });

  it("la forma preferida lliga tota sola amb el ple escrit de les dues maneres", () => {
    // Els cinc que la taula de famílies classifica als dos costats. Aquests
    // lliguen sense necessitat de cap alternativa.
    for (const canonic of [
      "Partit dels Socialistes de Catalunya",
      "Esquerra Republicana",
      "Partit Popular",
      "Junts",
      "VOX",
    ]) {
      const etiqueta = etiquetaPreferida(canonic);
      expect(encaixa(etiqueta, PLE_AMB_SIGLES), `${canonic} amb sigles`).not.toBeNull();
      expect(encaixa(etiqueta, PLE_AMB_NOMS_LLARGS), `${canonic} amb noms llargs`).not.toBeNull();
    }
    // El dels comuns és l'excepció i per això existeix el mecanisme d'alies:
    // «Barcelona en Comú» lliga amb el nom llarg, i quan el ple només en diu
    // «BComú» cal l'altra forma.
    expect(encaixa("Barcelona en Comú", PLE_AMB_NOMS_LLARGS)).not.toBeNull();
    expect(encaixa("Barcelona en Comú", PLE_AMB_SIGLES)).toBeNull();
    expect(encaixa("BComú", PLE_AMB_SIGLES)).not.toBeNull();
  });

  it("guarda les altres formes per si el ple s'escriu d'una altra manera", () => {
    expect(alies("Junts")).toContain("Junts per Barcelona");
    expect(alies("Valents")).toContain("BCN Canvi");
  });

  it("prova les altres formes abans de donar un grup per perdut", () => {
    // Un ple que només conegués «BComú» i no cap forma amb «en comú»: la forma
    // preferida no hi lliga, però l'alternativa sí, i és la que s'ha de desar.
    const ple: Grup[] = [{ nom: "BComú", sigles: "BComú", escons: 9, govern: false, color: null }];
    const punts: PuntDesat[] = [
      { ...puntsActual[0]!, vots: [{ grup: "Barcelona en Comú", sentit: "contra", vots: null }] },
    ];
    const { canvis, senseEncaix } = etiquetesQueLliguen(punts, ple);
    expect(senseEncaix).toEqual([]);
    expect(canvis.get("Barcelona en Comú")).toBe("BComú");
  });

  it("diu quins grups no lliguen en comptes de deixar-los caure en silenci", () => {
    const ple: Grup[] = [{ nom: "PSC", sigles: "PSC-CP", escons: 10, govern: true, color: null }];
    const punts: PuntDesat[] = [
      { ...puntsActual[0]!, vots: [{ grup: "Valents", sentit: "favor", vots: null }] },
    ];
    expect(etiquetesQueLliguen(punts, ple).senseEncaix).toEqual(["Valents"]);
  });

  it("no toca res quan encara no sabem qui seu al ple", () => {
    const { canvis, senseEncaix } = etiquetesQueLliguen(puntsActual, []);
    expect(canvis.size).toBe(0);
    expect(senseEncaix).toEqual([]);
  });
});

describe("resum i cobertura", () => {
  it("compta cada grup amb els mateixos camps que el resum de J12", () => {
    const resum = resumPerGrup(puntsActual.filter(valLaPenaDesar));
    const psc = resum.find((g) => g.grup === "PSC")!;
    expect(Object.keys(psc).sort()).toEqual([
      "abstencio",
      "blanc",
      "contra",
      "favor",
      "grup",
      "punts",
    ]);
    expect(psc.favor + psc.contra + psc.abstencio + psc.blanc).toBe(psc.punts);
  });

  it("no compta l'absència com si fos una posició", () => {
    const abandonament = punts2019.filter((p) => p.vots.some((v) => v.sentit === "absent"));
    const junts = resumPerGrup(abandonament).find((g) => g.grup === "Junts")!;
    expect(junts.punts).toBe(1);
    expect(junts.favor + junts.contra + junts.abstencio + junts.blanc).toBe(0);
  });

  it("mesura la cobertura de cada mandat per separat", () => {
    const actual = cobertura("2023-2027", puntsActual.filter(valLaPenaDesar));
    expect(actual.acords).toBe(5);
    expect(actual.ambVotDeGrup).toBe(5);
    expect(actual.votsDeGrup).toBe(30);
    expect(actual.sessions).toBe(4);
    expect(actual.primeraSessio).toBe("2023-09-29");
    expect(actual.darreraSessio).toBe("2025-11-26");
    // La font i la pàgina van amb la cobertura: la llicència obliga a citar-les.
    expect(actual.font).toContain("votacions_plenari_mandat_actual.csv");
    expect(actual.pagina).toContain("acords-del-plenari");

    const anterior = cobertura("2019-2023", punts2019.filter(valLaPenaDesar));
    expect(anterior.font).toContain("mandat_2019_2023");
    expect(totalVots(punts2019)).toBe(28);
  });
});

describe("retard de la font", () => {
  it("avisa quan l'última sessió publicada fa mesos", () => {
    // El cas real i documentat: el fitxer del mandat actual va amb uns cinc
    // mesos de retard. La fitxa ho ha de poder dir en comptes de deixar creure
    // que hi és tot fins avui.
    const avis = retard("2026-03-27", new Date("2026-08-29T10:00:00Z"));
    expect(avis.dies).toBe(155);
    expect(avis.preocupant).toBe(true);
    expect(avis.avis).toContain("2026-03-27");
    expect(avis.avis).toContain("no fins avui");
  });

  it("calla quan la font va al dia", () => {
    const avis = retard("2026-08-01", new Date("2026-08-29T10:00:00Z"));
    expect(avis.dies).toBe(28);
    expect(avis.preocupant).toBe(false);
    expect(avis.avis).toBeNull();
  });

  it("no s'inventa un retard quan no hi ha cap sessió", () => {
    expect(retard(null, new Date("2026-08-29T10:00:00Z"))).toEqual({
      darreraSessio: null,
      dies: null,
      preocupant: false,
      avis: null,
    });
  });
});
