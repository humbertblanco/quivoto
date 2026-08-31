import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { councillorMandates, municipalityMetrics, openDb, people, type Db } from "@quivoto/db";
import { carregaCarrecsAlcaldia, carregaPleDelRegistre, resolAlcaldia, type CarrecAlcaldia } from "./alcaldia";
import { adrecesRegidors } from "./regidor";

/**
 * L'alcaldia es resol una sola vegada per a tot el web, i el que s'ha de
 * provar és cadascun dels casos que feien que tres pàgines diguessin tres
 * coses: la seu que marca l'alcaldia, la que no la marca perquè hi ha hagut
 * relleu, el portal de ciutat que escriu el càrrec d'una altra manera, i el
 * municipi que no publica cap llista.
 */
const carrec = (nom: string, carrec: string, foto: string | null = null): CarrecAlcaldia => ({
  nom,
  carrec,
  foto: foto ? foto.replace("/160/", "/320/") : null,
  fotoPetita: foto,
});

describe("resolAlcaldia", () => {
  it("troba l'alcaldia per la paraula «alcald» al càrrec, com sempre", () => {
    const llista = [carrec("Anna Riera", "Regidora"), carrec("Jaume Collboni Cuadrado", "Alcalde", "/observatori/fotos/160/1.webp")];
    const r = resolAlcaldia(llista, { mayorName: "Jaume Collboni Cuadrado", mayorSigles: "PSC-CP" });
    expect(r.carrec).toBe(llista[1]);
    expect(r.nom).toBe("Jaume Collboni Cuadrado");
    expect(r.fotoPetita).toBe("/observatori/fotos/160/1.webp");
    expect(r.foto).toBe("/observatori/fotos/320/1.webp");
    expect(r.adreca).toBe("regidor/jaume-collboni-cuadrado/");
  });

  it("l'Hospitalet: sense cap «alcald» a la llista, troba l'alcalde pel nom oficial", () => {
    // La seu electrònica encara no marca ningú després del relleu, però la
    // cara del nou alcalde hi és, entre les vint-i-quatre.
    const llista = [
      carrec("Núria Marín Martínez", "Regidora", "/observatori/fotos/160/10.webp"),
      carrec("DAVID QUIRÓS BRITO", "Regidor", "/observatori/fotos/160/11.webp"),
    ];
    const r = resolAlcaldia(llista, { mayorName: "David Quirós i Brito", mayorSigles: "PSC-CP" });
    expect(r.carrec).toBe(llista[1]);
    expect(r.fotoPetita).toBe("/observatori/fotos/160/11.webp");
    expect(r.adreca).toBe("regidor/david-quiros-brito/");
  });

  it("Lleida: el portal escriu «Paer en cap» i el nom oficial l'hi troba igualment", () => {
    const llista = [carrec("Fèlix Larrosa Pomés", "Paer en cap", "/observatori/fotos/160/25.webp"), carrec("Toni Postius", "Tinent d'alcalde")];
    const r = resolAlcaldia(llista, { mayorName: "FÈLIX LARROSA I POMÉS", mayorSigles: "PSC-CP" });
    expect(r.carrec).toBe(llista[0]);
    expect(r.fotoPetita).toBe("/observatori/fotos/160/25.webp");
  });

  it("el Catllar: la seu encara marca l'alcaldia del mandat passat, i el nom oficial mana", () => {
    // Després d'un relleu el registre de la Generalitat es posa al dia i hi ha
    // seus que no: la d'el Catllar duia «ALCALDIA» al costat de qui manava
    // abans, i la fitxa ensenyava una cara mentre la llista dels 947 i la
    // taula d'alcaldies de la mateixa pàgina deien un altre nom.
    const llista = [
      carrec("Alba López Domínguez", "ALCALDIA", "/observatori/fotos/160/3.webp"),
      carrec("Jordi Ruiz Domènech", "Regidor", "/observatori/fotos/160/4.webp"),
    ];
    const r = resolAlcaldia(llista, { mayorName: "JORDI RUIZ DOMÈNECH", mayorSigles: null });
    expect(r.carrec).toBe(llista[1]);
    expect(r.nom).toBe("Jordi Ruiz Domènech");
    expect(r.fotoPetita).toBe("/observatori/fotos/160/4.webp");
    expect(r.adreca).toBe("regidor/jordi-ruiz-domenech/");
  });

  it("Castellgalí: l'alcaldia oficial no és a la llista de la seu; surt el nom pelat i no la cara de qui ja no ho és", () => {
    const llista = [carrec("Marcos Álvarez Rebolo", "Alcalde i Regidor delegat d'Hisenda", "/observatori/fotos/160/5.webp")];
    const r = resolAlcaldia(llista, { mayorName: "Cristòfol Gimeno Iglesias", mayorSigles: null });
    expect(r.carrec).toBeNull();
    expect(r.nom).toBe("Cristòfol Gimeno Iglesias");
    expect(r.foto).toBeNull();
    expect(r.adreca).toBeNull();
  });

  it("Albons: el mateix nom escrit en català per la seu i en castellà pel registre és la mateixa persona", () => {
    // «Josep Ramon» contra «José Ramón» no lliga per la clau normalitzada,
    // però els cognoms sí: la seu no s'ha quedat enrere i es queda la cara i
    // el càrrec, com sempre.
    const llista = [carrec("Josep Ramon Llavero Rodríguez", "Alcalde", "/observatori/fotos/160/6.webp")];
    const r = resolAlcaldia(llista, { mayorName: "JOSÉ RAMÓN LLAVERO RODRÍGUEZ", mayorSigles: null });
    expect(r.carrec).toBe(llista[0]);
    expect(r.nom).toBe("Josep Ramon Llavero Rodríguez");
    expect(r.fotoPetita).toBe("/observatori/fotos/160/6.webp");
  });

  it("Cardedeu, la Sénia i Viladecans: ni «Vicealcalde», ni «Tinença Alcaldia», ni «Tta.Alcaldessa» són l'alcaldia", () => {
    // El vicealcalde de Cardedeu surt escrit abans que l'alcalde i sortia amb
    // la cara de qui mana a la portada de la fitxa.
    const cardedeu = [carrec("Josep Quesada Tornero", "Vicealcalde"), carrec("Xavier Orozco Delclòs", "Alcalde")];
    expect(resolAlcaldia(cardedeu, { mayorName: "XAVIER OROZCO DELCLÒS", mayorSigles: null }).carrec).toBe(cardedeu[1]);
    const senia = [
      carrec("Artur Martínez Hernández", "1ª Tinença Alcaldia. Regidories: Hisenda"),
      carrec("Maria Victòria Almuni Balada", "Alcaldessa. Regidories: Governació i Cultura"),
    ];
    expect(resolAlcaldia(senia, { mayorName: "Maria Victoria Almuni i Balada", mayorSigles: null }).carrec).toBe(senia[1]);
    const viladecans = [
      carrec("Joana Sánchez Morillo", "5aTta.Alcaldessa.Vpdta.Àmbit Presidència i Ciutat 2030"),
      carrec("Olga Morales Segura", "Regidora"),
    ];
    expect(resolAlcaldia(viladecans, { mayorName: "Olga Morales i Segura", mayorSigles: null }).carrec).toBe(viladecans[1]);
  });

  it("«Tinent d'alcalde» i «regidor d'Alcaldia» porten la paraula i no són l'alcaldia", () => {
    // Amb la regla de la fitxa municipal —que hi sigui «alcald»— el primer
    // tinent d'alcalde escrit abans que l'alcalde sortia amb la cara de qui
    // mana.
    const llista = [
      carrec("Segona", "Primera tinenta d'alcalde"),
      carrec("Tercer", "Regidor d’Alcaldia i Comunicació"),
      carrec("Qui mana", "Alcalde"),
    ];
    expect(resolAlcaldia(llista, { mayorName: "Qui mana", mayorSigles: null }).carrec).toBe(llista[2]);
    // I si l'alcalde no porta càrrec, el tinent no ocupa el seu lloc: es
    // busca pel nom oficial.
    const senseCarrec = [carrec("Segona", "Tinent d'alcalde"), carrec("Qui mana", "Regidor")];
    expect(resolAlcaldia(senseCarrec, { mayorName: "Qui mana", mayorSigles: null }).carrec).toBe(senseCarrec[1]);
    expect(resolAlcaldia(senseCarrec, { mayorName: "Ningú", mayorSigles: null }).carrec).toBeNull();
  });

  it("quan ni el càrrec ni el nom lliguen, no s'inventa res i deixa el nom oficial", () => {
    const llista = [carrec("Una Persona", "Regidora"), carrec("Una Altra", "Regidor")];
    const r = resolAlcaldia(llista, { mayorName: "Tercera Persona", mayorSigles: null });
    expect(r.carrec).toBeNull();
    expect(r.nom).toBe("Tercera Persona");
    expect(r.foto).toBeNull();
    expect(r.fotoPetita).toBeNull();
    expect(r.adreca).toBeNull();
  });

  it("sense llista i sense nom oficial, no hi ha res", () => {
    expect(resolAlcaldia(null, null)).toEqual({ carrec: null, nom: null, foto: null, fotoPetita: null, adreca: null });
    expect(resolAlcaldia([], { mayorName: "  ", mayorSigles: null }).nom).toBeNull();
  });

  it("dona el retrat que hi ha, sigui de la mida que sigui", () => {
    const nomesGran = { nom: "Qui mana", carrec: "Alcalde", foto: "/observatori/fotos/320/2.webp", fotoPetita: null };
    const r = resolAlcaldia([nomesGran], { mayorName: "Qui mana", mayorSigles: null });
    expect(r.fotoPetita).toBe("/observatori/fotos/320/2.webp");
    expect(r.foto).toBe("/observatori/fotos/320/2.webp");
  });

  it("l'adreça és la que dona adrecesRegidors sobre la mateixa llista, sufix inclòs", () => {
    // Dues persones del ple es diuen igual i l'alcaldessa és la segona: la
    // seva pàgina viu a «-2», i enviar a l'altra seria el pitjor dels errors.
    const llista = [carrec("Anna Riera", "Regidora"), carrec("Anna Riera", "Alcaldessa"), carrec("Pau Sol", "Regidor")];
    const r = resolAlcaldia(llista, { mayorName: "Anna Riera", mayorSigles: null });
    expect(r.carrec).toBe(llista[1]);
    expect(r.adreca).toBe(`regidor/${adrecesRegidors(llista).get(llista[1]!)}/`);
    expect(r.adreca).toBe("regidor/anna-riera-2/");
  });

  describe("els 483 municipis sense llista a la seu electrònica", () => {
    const registre = [{ nom: "MARIA PUIG VILA" }, { nom: "JOAN PONS" }, { nom: "Maria Puig Vila" }];

    it("l'adreça surt del ple del registre, que és qui anomena les seves fitxes", () => {
      const r = resolAlcaldia(null, { mayorName: "Maria Puig i Vila", mayorSigles: "ERC-AM" }, registre);
      expect(r.carrec).toBeNull();
      expect(r.nom).toBe("Maria Puig i Vila");
      expect(r.fotoPetita).toBeNull();
      expect(r.adreca).toBe("regidor/maria-puig-vila/");
    });

    it("però només pel nom: el càrrec del registre és el del dia de la constitució", () => {
      const ambCarrec = [{ nom: "Vell Alcalde", carrec: "Alcalde" }, { nom: "Nova Alcaldessa", carrec: "Regidora" }];
      const r = resolAlcaldia([], { mayorName: "Nova Alcaldessa", mayorSigles: null }, ambCarrec);
      expect(r.adreca).toBe("regidor/nova-alcaldessa/");
    });

    it("i no s'hi mira quan la seu sí que té llista: llavors la fitxa no existeix", () => {
      const seu = [carrec("Una Persona", "Regidora")];
      const r = resolAlcaldia(seu, { mayorName: "Joan Pons", mayorSigles: null }, registre);
      expect(r.adreca).toBeNull();
    });

    it("qui no és al registre va a l'apartat d'alcaldies", () => {
      expect(resolAlcaldia(null, { mayorName: "Ningú Conegut", mayorSigles: null }, registre).adreca).toBeNull();
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Les dues lectures, sobre una base en memòria
// ───────────────────────────────────────────────────────────────────────────

async function creaTaula(db: Db, taula: PgTable): Promise<void> {
  const { name, columns } = getTableConfig(taula);
  const definicions = columns.map((c) => `"${c.name}" ${c.getSQLType()}${c.primary ? " primary key" : ""}`);
  await db.execute(sql.raw(`create table "${name}" (${definicions.join(", ")})`));
}

/**
 * La projecció de càrrecs va en SQL perquè el document sencer no arribi mai a
 * JavaScript, i una subconsulta amb `jsonb_agg` no es pot provar sense un
 * motor de debò: es prova sobre PGlite en memòria, que és el que fa córrer la
 * publicació.
 */
describe("carregaCarrecsAlcaldia i carregaPleDelRegistre", () => {
  let base: Db;
  let tancar: () => Promise<void>;

  beforeAll(async () => {
    const { db, close } = await openDb({ dir: "memory://" });
    base = db;
    tancar = close;
    for (const taula of [municipalityMetrics, councillorMandates, people]) await creaTaula(db, taula);
    await db.insert(municipalityMetrics).values([
      {
        municipalityId: 1,
        kind: "carrecs",
        data: {
          font: "seu-e", url: "https://x", slug: "x", descarregat: "2026-08-01", totalCarrecs: 2, ambFoto: 1, cobertura: "completa",
          carrecs: [
            { nom: "Anna Riera", carrec: "Alcaldessa", grup: "ERC", equipGovern: true, foto: "/observatori/fotos/320/1.webp", fotoPetita: "/observatori/fotos/160/1.webp", fitxa: "https://x/1" },
            { nom: "Pau Sol", carrec: "Regidor", grup: "Junts", equipGovern: false, foto: null, fotoPetita: null, fitxa: null },
          ],
        },
      },
      // Una seu que serveix un tauler i no publica cap càrrec.
      { municipalityId: 2, kind: "carrecs", data: { font: "seu-e", carrecs: [], totalCarrecs: 0, ambFoto: 0, cobertura: "cap" } },
      // Una mètrica d'una altra mena, que no s'ha de llegir.
      { municipalityId: 3, kind: "government", data: { mayorName: "Algú" } },
    ]);
    const [a, b] = await db
      .insert(people)
      .values([
        { fullName: "MARIA PUIG VILA", nameNormalized: "maria puig vila" },
        { fullName: "JOAN PONS", nameNormalized: "joan pons" },
      ])
      .returning({ id: people.id });
    await db.insert(councillorMandates).values([
      { municipalityId: 2, personId: b!.id, role: "Regidor", orderNum: 2, source: "socrata_nm3n" },
      { municipalityId: 2, personId: a!.id, role: "Alcaldessa", orderNum: 1, source: "socrata_nm3n" },
      { municipalityId: 3, personId: a!.id, role: "Regidora", orderNum: 1, source: "socrata_nm3n" },
    ]);
  });

  afterAll(async () => {
    await tancar();
  });

  it("porta el nom, el càrrec i el retrat petit de tothom, i res més", async () => {
    const carrecs = await carregaCarrecsAlcaldia(base);
    expect(carrecs.get(1)).toEqual([
      { nom: "Anna Riera", carrec: "Alcaldessa", fotoPetita: "/observatori/fotos/160/1.webp" },
      { nom: "Pau Sol", carrec: "Regidor", fotoPetita: null },
    ]);
    // Qui no publica cap càrrec no hi és: per a la resolució és com no tenir seu.
    expect(carrecs.has(2)).toBe(false);
    expect(carrecs.has(3)).toBe(false);
  });

  it("el ple del registre va per municipi i en l'ordre amb què s'anomenen les fitxes", async () => {
    const ple = await carregaPleDelRegistre(base);
    expect(ple.get(2)).toEqual([{ nom: "MARIA PUIG VILA" }, { nom: "JOAN PONS" }]);
    expect(ple.get(3)).toEqual([{ nom: "MARIA PUIG VILA" }]);
  });

  it("i les dues lectures juntes resolen el municipi sense seu cap a la seva fitxa", async () => {
    const carrecs = await carregaCarrecsAlcaldia(base);
    const ple = await carregaPleDelRegistre(base);
    const ambSeu = resolAlcaldia(carrecs.get(1) ?? null, { mayorName: "Anna Riera" }, ple.get(1) ?? null);
    expect(ambSeu.fotoPetita).toBe("/observatori/fotos/160/1.webp");
    expect(ambSeu.adreca).toBe("regidor/anna-riera/");
    const senseSeu = resolAlcaldia(carrecs.get(2) ?? null, { mayorName: "Maria Puig i Vila" }, ple.get(2) ?? null);
    expect(senseSeu.fotoPetita).toBeNull();
    expect(senseSeu.adreca).toBe("regidor/maria-puig-vila/");
  });
});
