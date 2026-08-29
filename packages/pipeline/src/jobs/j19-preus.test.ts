import { describe, expect, it } from "vitest";
import { variacioEntre } from "./j9-habitatge-residus";
import {
  anysImplausibles,
  modelDeGestio,
  parseSerieIbi,
  preuMunicipal,
  primerAnyAmbTarifaSocial,
  quadraElTotal,
  rebutMitja,
  rebutSencer,
  revaloracioDinsFinestra,
  variacioInterpretable,
  type FilaIbi,
} from "./j19-preus";
import type { FilaAca } from "../adapters/aca";

/** Una fila de l'ACA amb el que calgui, per no repetir els dotze camps a cada prova. */
const fila = (parcial: Partial<FilaAca>): FilaAca => ({
  idescat6: "081878",
  municipi: "Sabadell",
  comarca: "Vallès Occidental",
  subministrament: null,
  canon: null,
  clavegueram: null,
  clavegueramNota: null,
  total: null,
  gestora: null,
  gestioSubministrament: null,
  gestioClavegueram: null,
  quotaComptadorApart: false,
  tarifaSocial: null,
  dataRevisio: null,
  ...parcial,
});

describe("rebutSencer", () => {
  it("marca els municipis on el TOTAL no és el rebut sencer", () => {
    // Sabadell, Badalona i Terrassa hi són: cobren el clavegueram i la
    // depuració sobre el valor cadastral i no sobre el consum d'aigua, i per
    // això el full els posa un zero. Són 307 dels 947, i comparar el seu TOTAL
    // amb el de Reus no és comparar el mateix rebut.
    expect(rebutSencer({ clavegueram: 0 })).toBe(false);
    expect(rebutSencer({ clavegueram: null })).toBe(false);
    expect(rebutSencer({ clavegueram: 0.496 })).toBe(true);
  });
});

describe("preuMunicipal i el cànon", () => {
  const sabadell = fila({ subministrament: 1.5, canon: 0.654, clavegueram: 0, total: 2.154 });
  const girona = fila({ subministrament: 0.42, canon: 0.654, clavegueram: 0.117, total: 1.191 });

  it("separa el que decideix l'ajuntament del que decideix la Generalitat", () => {
    // El cànon és idèntic el 2023 i el 2025 a 913 dels 947 municipis: si es
    // deixés dins del preu, la variació de tots es mouria alhora el dia que la
    // Generalitat el toqués, com si ho haguessin decidit 947 plens.
    expect(preuMunicipal(sabadell)).toBe(1.5);
    expect(preuMunicipal(girona)).toBe(0.537);
  });

  it("el municipal més el cànon torna a donar el TOTAL que publica el full", () => {
    expect(quadraElTotal(sabadell)).toBe(true);
    expect(quadraElTotal(girona)).toBe(true);
    expect(quadraElTotal(fila({ subministrament: 1, canon: 0.5, clavegueram: 0, total: 9 }))).toBe(false);
  });

  it("no inventa un preu municipal quan no hi ha subministrament", () => {
    // Dos municipis dels 947 no tenen preu de subministrament al full del 2025.
    expect(preuMunicipal(fila({ subministrament: null, clavegueram: 0.2 }))).toBeNull();
    expect(quadraElTotal(fila({ subministrament: null, canon: 0.654, total: 1 }))).toBeNull();
  });

  it("la variació del mandat sobre el preu municipal no arrossega el cànon", () => {
    // El mateix municipi, amb el cànon pujant 0,02 i el preu municipal quiet:
    // sobre el total sembla que hagi apujat l'aigua, i sobre el municipal es veu
    // que no ha tocat res.
    const total = [
      { any: 2023, valor: 2.154 },
      { any: 2025, valor: 2.174 },
    ];
    const municipal = [
      { any: 2023, valor: 1.5 },
      { any: 2025, valor: 1.5 },
    ];
    expect(variacioEntre(total, 2023, 2025)!.diferencia).toBe(0.02);
    expect(variacioEntre(municipal, 2023, 2025)!.diferencia).toBe(0);
  });
});

describe("variacioInterpretable", () => {
  it("no dona per bona la variació d'un municipi que no revisa tarifes", () => {
    // Girona té la revisió del 9 de maig del 2023 —anterior a la constitució de
    // l'ajuntament, que és al juny— i el preu clavat des d'aleshores. Dels 306
    // municipis amb revisió del 2022 o abans, cap ni un no mou el preu entre el
    // 2023 i el 2025: dir «aquí no han apujat l'aigua» seria llegir un silenci
    // com si fos una decisió.
    const girona = variacioInterpretable("2023-05-09");
    expect(girona.valida).toBe(false);
    expect(girona.anyRevisio).toBe(2023);
    expect(girona.motiu).toMatch(/no es revisen des del 2023/);

    expect(variacioInterpretable("2022-03-15").valida).toBe(false);
  });

  it("la dona per bona a partir de la primera revisió que només pot ser d'aquest govern", () => {
    // Sabadell: revisió del 18 de juliol del 2024, ja dins del mandat.
    expect(variacioInterpretable("2024-07-18")).toEqual({
      valida: true,
      motiu: null,
      anyRevisio: 2024,
    });
    expect(variacioInterpretable("2025-03-26").valida).toBe(true);
  });

  it("sense data de revisió no s'interpreta res", () => {
    // Els fulls anteriors al 2020 no porten la columna.
    expect(variacioInterpretable(null).valida).toBe(false);
    expect(variacioInterpretable(null).motiu).toMatch(/no diu quan/);
    expect(variacioInterpretable("no ho sé").valida).toBe(false);
  });
});

describe("modelDeGestio", () => {
  it("tradueix el vocabulari del full de l'ACA al de J8", () => {
    expect(modelDeGestio("Directa")).toBe("directa");
    expect(modelDeGestio("Indirecta")).toBe("indirecta");
    expect(modelDeGestio("No presta")).toBe("noPrestat");
    expect(modelDeGestio(null)).toBeNull();
    expect(modelDeGestio("qualsevol altra cosa")).toBeNull();
  });
});

describe("primerAnyAmbTarifaSocial", () => {
  it("troba l'any que s'estrena la tarifa social", () => {
    expect(
      primerAnyAmbTarifaSocial([
        { any: 2022, tarifaSocial: null },
        { any: 2023, tarifaSocial: null },
        { any: 2024, tarifaSocial: true },
        { any: 2025, tarifaSocial: true },
      ]),
    ).toBe(2024);
  });

  it("una sèrie tota buida no vol dir que no en tinguin", () => {
    // La casella buida no està definida enlloc del full: pot ser que el
    // municipi no en tingui o que l'ACA no ho sàpiga.
    expect(primerAnyAmbTarifaSocial([{ any: 2025, tarifaSocial: null }])).toBeNull();
  });
});

// ─── IBI ─────────────────────────────────────────────────────────────────────

/** L'SSV tal com el serveix l'Idescat, amb la capçalera de text lliure inclosa. */
const SSV_SABADELL = `Impost de béns immobles de naturalesa urbana (IBI)
Sabadell
Font: Idescat, a partir de la Direcció General del Cadastre.
Nota: Dades provisionals.
(p) Dada provisional.
Institut d'Estadística de Catalunya
https://www.idescat.cat/pub/?id=ibi&n=173&geo=mun:081878
;Últim any de valoració cadastral urbà;Rebuts;Base imposable (milers d'euros);Quota íntegra (euros)
2025 (p);2002;133950;9626028;63973771
2024;2002;132962;9600828;61972916
2023;2002;131417;9724484;53200558
`;

describe("parseSerieIbi", () => {
  const serie = parseSerieIbi(SSV_SABADELL);

  it("llegeix la sèrie encara que la capçalera canviï de llargada", () => {
    // El nombre de línies de capçalera depèn del municipi: els que no tenen cap
    // dada confidencial no porten la línia que explica els «..». Saltar-ne un
    // nombre fix trencaria uns quants municipis sense avisar.
    expect(serie.municipi).toBe("Sabadell");
    expect(serie.files.map((f) => f.any)).toEqual([2023, 2024, 2025]);
  });

  it("guarda l'URL canònica, que la llicència de l'Idescat obliga a enllaçar", () => {
    expect(serie.urlCanonica).toBe("https://www.idescat.cat/pub/?id=ibi&n=173&geo=mun:081878");
  });

  it("calcula el rebut mitjà i marca els anys provisionals", () => {
    // Comprovat contra la font: 404,82 € el 2023 i 477,59 € el 2025, un 18 %
    // més sobre 133.950 rebuts.
    expect(serie.files[0]).toMatchObject({ any: 2023, rebuts: 131417, rebutMitja: 404.82, provisional: false });
    expect(serie.files[2]).toMatchObject({ any: 2025, rebuts: 133950, rebutMitja: 477.59, provisional: true });
    expect(variacioEntre(serie.files.map((f) => ({ any: f.any, valor: f.rebutMitja })), 2023, 2025)!.percentual).toBe(18);
  });

  it("no llegeix els «..» de l'Idescat com si fossin zeros", () => {
    // Un codi de municipi que no existeix torna HTTP 200 amb la taula sencera
    // de «..». Llegits com a zero, sortiria publicat amb un rebut de 0 €.
    const buida = parseSerieIbi(
      "Impost de béns immobles de naturalesa urbana (IBI)\n" +
        "Font: Idescat, a partir de la Direcció General del Cadastre.\n" +
        ";Últim any de valoració cadastral urbà;Rebuts;Base imposable (milers d'euros);Quota íntegra (euros)\n" +
        "2025 (p);..;..;..;..\n",
    );
    expect(buida.municipi).toBeNull();
    expect(buida.files[0]).toMatchObject({ rebuts: null, quota: null, rebutMitja: null, valoracio: null });
  });
});

describe("rebutMitja", () => {
  it("és la quota íntegra dividida pels rebuts, i res més", () => {
    expect(rebutMitja(63973771, 133950)).toBe(477.59);
  });

  it("no divideix per zero ni inventa xifres que la font no dona", () => {
    expect(rebutMitja(1000, 0)).toBeNull();
    expect(rebutMitja(null, 100)).toBeNull();
    expect(rebutMitja(1000, null)).toBeNull();
  });
});

describe("anysImplausibles", () => {
  it("caça el salt de la sèrie de Sabadell", () => {
    // 30,95 M€ (2010) → 55,87 M€ (2011) → 39,08 M€ (2012) sobre un padró de
    // rebuts que amb prou feines es mou. El 2011 val un 58 % més que la mitjana
    // dels dos anys que l'envolten: no és cap pujada d'impostos, i publicar-ho
    // com si ho fos seria mentir amb dades oficials.
    const salt = anysImplausibles([
      { any: 2010, rebutMitja: 270.41 },
      { any: 2011, rebutMitja: 463.26 },
      { any: 2012, rebutMitja: 317.0 },
      { any: 2013, rebutMitja: 346.68 },
    ]);
    expect(salt).toEqual([{ any: 2011, valor: 463.26, veins: 293.71, rao: 1.58 }]);
  });

  it("també caça els sots, no només les puntes", () => {
    // Girona el 2011: la meitat del rebut dels anys del costat.
    expect(
      anysImplausibles([
        { any: 2010, rebutMitja: 400 },
        { any: 2011, rebutMitja: 179.2 },
        { any: 2012, rebutMitja: 420 },
      ]).map((a) => a.any),
    ).toEqual([2011]);
  });

  it("deixa passar les pujades de veritat, que són grosses però seguides", () => {
    // Una revisió cadastral pot moure el rebut un 30 % de cop i això sí que és
    // real: el que busquem és el salt que torna al seu lloc l'any següent.
    expect(
      anysImplausibles([
        { any: 2022, rebutMitja: 400 },
        { any: 2023, rebutMitja: 404.82 },
        { any: 2024, rebutMitja: 466.09 },
        { any: 2025, rebutMitja: 477.59 },
      ]),
    ).toEqual([]);
  });

  it("no jutja els extrems ni els anys sense dada", () => {
    // Del primer i l'últim any no en tenim els dos veïns, i sense els dos veïns
    // no hi ha res amb què comparar.
    expect(anysImplausibles([{ any: 2024, rebutMitja: 1 }, { any: 2025, rebutMitja: 900 }])).toEqual([]);
    expect(anysImplausibles([{ any: 2023, rebutMitja: null }, { any: 2024, rebutMitja: 100 }])).toEqual([]);
  });
});

describe("revaloracioDinsFinestra", () => {
  const serie = (parells: readonly [number, number][]): Pick<FilaIbi, "any" | "valoracio">[] =>
    parells.map(([any, valoracio]) => ({ any, valoracio }));

  it("marca la revisió cadastral, que no la decideix el ple", () => {
    // Terrassa passa de 1997 a 2018 l'any 2018: el que puja no és el tipus sinó
    // la base sobre la qual s'aplica.
    const terrassa = revaloracioDinsFinestra(serie([[2017, 1997], [2018, 2018], [2019, 2018]]), 2017, 2019);
    expect(terrassa.dins).toBe(true);
    expect(terrassa.anysDeCanvi).toEqual([2018]);
    expect(terrassa.valoracions).toEqual([1997, 2018]);
  });

  it("no en veu on no n'hi ha", () => {
    // Sabadell arrossega la valoració del 2002 tot el mandat: el que hagi pujat
    // el rebut, ho ha decidit el ple.
    expect(revaloracioDinsFinestra(serie([[2023, 2002], [2024, 2002], [2025, 2002]]), 2023, 2025)).toEqual({
      dins: false,
      anysDeCanvi: [],
      valoracions: [2002],
    });
  });

  it("només mira dins de la finestra", () => {
    // Barcelona va revalorar el 2018: fora del mandat que s'està jutjant, no
    // explica res del que ha passat del 2023 ençà.
    expect(
      revaloracioDinsFinestra(serie([[2017, 2002], [2018, 2018], [2023, 2018], [2025, 2018]]), 2023, 2025).dins,
    ).toBe(false);
  });
});
