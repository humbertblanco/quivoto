#!/usr/bin/env python3
"""
Repara el GeoJSON que escup el WFS de l'ICGC.

EL PROBLEMA. Amb `outputFormat=GEOJSON`, el servei aplana cada MultiPolygon en
un sol Polygon amb TOTS els anells encadenats i en ordre arbitrari. Segons
l'RFC 7946, el primer anell d'un Polygon és l'exterior i la resta són forats;
per tant qualsevol lector correcte interpreta la resta d'illes i trams de costa
com a forats del primer anell que li ha tocat.

A Barcelona això és espectacular: el primer anell té 136 punts i 73 unitats
d'àrea, i el novè —que és la ciutat de debò— en té 1201 i 10.662. La ciutat
sencera passa a ser un «forat» d'un tros de costa, i qualsevol eina que respecti
l'especificació (mapshaper, GDAL, D3) la fa desaparèixer.

Afecta 63 municipis, gairebé tots costaners, i entre ells Barcelona: el 26% de
la població de Catalunya. Sense reparar, el mapa surt amb forats blancs
exactament allà on viu més gent.

LA REPARACIÓ. El sentit de gir sí que és correcte: els exteriors venen en sentit
antihorari (àrea signada positiva) i els forats en horari (negativa). Amb això es
pot reconstruir la niuada sense ambigüitat: cada forat va a l'exterior més petit
que el conté.

Ús:  python3 repara.py entrada.geojson sortida.geojson
"""
import json, sys


def area_signada(anell):
    s = 0.0
    for i in range(len(anell) - 1):
        s += anell[i][0] * anell[i + 1][1] - anell[i + 1][0] * anell[i][1]
    return s / 2


def dins(punt, anell):
    """Punt dins d'un anell, per llançament de raig."""
    x, y = punt
    dins_ = False
    j = len(anell) - 1
    for i in range(len(anell)):
        xi, yi = anell[i][0], anell[i][1]
        xj, yj = anell[j][0], anell[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-300) + xi:
            dins_ = not dins_
        j = i
    return dins_


def caixa(anell):
    xs = [p[0] for p in anell]
    ys = [p[1] for p in anell]
    return min(xs), min(ys), max(xs), max(ys)


def renidua(anells):
    """De la llista plana d'anells, torna una llista de polígons ben formats."""
    exteriors, forats = [], []
    for r in anells:
        if len(r) < 4:
            continue
        (exteriors if area_signada(r) > 0 else forats).append(r)
    if not exteriors:                       # tot forats: el gir venia al revés
        exteriors, forats = [list(reversed(r)) for r in forats], []

    caixes = [caixa(r) for r in exteriors]
    arees = [abs(area_signada(r)) for r in exteriors]
    poligons = [[r] for r in exteriors]

    for h in forats:
        millor, millor_area = None, float("inf")
        for i, ext in enumerate(exteriors):
            x0, y0, x1, y1 = caixes[i]
            p = h[0]
            if not (x0 <= p[0] <= x1 and y0 <= p[1] <= y1):
                continue
            if arees[i] < millor_area and dins(p, ext):
                millor, millor_area = i, arees[i]
        if millor is not None:
            poligons[millor].append(h)
        # un forat que no cau dins de cap exterior es descarta: és soroll
    return poligons


def repara_geom(g):
    if g is None:
        return None
    t, c = g["type"], g["coordinates"]
    if t == "Polygon":
        anells = c
    elif t == "MultiPolygon":
        anells = [r for p in c for r in p]
    else:
        return g
    pols = renidua(anells)
    if not pols:
        return None
    if len(pols) == 1:
        return {"type": "Polygon", "coordinates": pols[0]}
    return {"type": "MultiPolygon", "coordinates": pols}


def main():
    ent, sor = sys.argv[1], sys.argv[2]
    d = json.load(open(ent))
    canviats = 0
    for f in d["features"]:
        abans = json.dumps(f["geometry"], sort_keys=True)
        f["geometry"] = repara_geom(f["geometry"])
        if json.dumps(f["geometry"], sort_keys=True) != abans:
            canviats += 1
    d.pop("crs", None)                      # RFC 7946: sempre CRS84
    json.dump(d, open(sor, "w"))
    print("reparats %d de %d municipis -> %s" % (canviats, len(d["features"]), sor))


if __name__ == "__main__":
    main()
