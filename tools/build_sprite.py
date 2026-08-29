#!/usr/bin/env python3
"""Genera design/prototip/assets/sprite.svg a partir de tools/icons_lib.py.

    python3 tools/build_sprite.py

Un sol fitxer amb <symbol>. Cap dependència. Si canvia icons_lib.py, es torna
a executar i el sprite queda al dia: no s'edita el sprite a mà, mai.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icons_lib as L

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'design', 'prototip', 'assets', 'sprite.svg')

parts = []
parts.append(
 '<svg xmlns="http://www.w3.org/2000/svg" class="sprite-quivoto" aria-hidden="true" '
 'style="position:absolute;width:0;height:0;overflow:hidden">\n<defs>\n'
 '<!-- Sprite de quivoto. Generat per tools/build_sprite.py des de tools/icons_lib.py.\n'
 '     NO s\'edita a ma. Dues families per tema:\n'
 '       #ic-<tema>   icona sola, per a llistes i controls\n'
 '       #vei-<tema>  la mateixa icona amb cara, per quan el tema parla\n'
 '     Mascota: #papereta-felic | #papereta-neutre | #papereta-pregunta\n'
 '     Escala de resposta: #escala-1 (gens) ... #escala-5 (molt)\n'
 '     Marca: #cara-marca (la cara sola, per a la o de quivoto)\n'
 '     Marques de trac: #marca-si #marca-no #marca-abst #marca-absent #fletxa -->\n')

for i, (label, body, detail, _y) in enumerate(L.ICONS):
    slug = L.SLUG[i]
    fill = L.COLOR[i]
    cx, cy, sep = L.EYES[i]
    b = body.format(fill=fill, ink=L.INK)
    d = detail.format(fill=fill, ink=L.INK)
    d_cara = L.DETALL_AMB_CARA.get(i, detail).format(fill=fill, ink=L.INK)
    parts.append(
      f'<symbol id="ic-{slug}" viewBox="0 0 48 48"><title>{label}</title>{b}{d}</symbol>\n')
    parts.append(
      f'<symbol id="vei-{slug}" viewBox="0 0 48 48"><title>{label}</title>'
      f'{b}{d_cara}{L.face(cx, cy, sep)}</symbol>\n')

# --- mascota: el mateix SVG que la landing, convertit en symbol ---
for mood, nom in (("feliç", "felic"), ("neutre", "neutre"), ("pregunta", "pregunta")):
    svg = L.papereta(size=120, mood=mood)
    cos = svg.split('>', 1)[1].rsplit('</svg>', 1)[0]
    parts.append(
      f'<symbol id="papereta-{nom}" viewBox="0 0 120 140">'
      f'<title>La papereta, mascota de quivoto</title>{cos}</symbol>\n')

parts.append(f'<symbol id="cara-marca" viewBox="0 0 48 48">{L.cara_marca()}</symbol>\n')

# --- marques de trac: el vist, l'aspa, la ratlla, el punt i la fletxa ---
for nom, cos, titol in (
    ('marca-si', L.marca_si(), 'A favor'),
    ('marca-no', L.marca_no(), 'En contra'),
    ('marca-abst', L.marca_abst(), 'Abstenció'),
    ('marca-absent', L.marca_absent(), 'No hi era'),
    ('fletxa', L.fletxa(), 'Hi porta'),
):
    parts.append(f'<symbol id="{nom}" viewBox="0 0 48 48"><title>{titol}</title>{cos}</symbol>\n')

# --- escala de cinc cares (les mateixes que la landing) ---
BOQUES = [
  f'<path d="M20 34 q4 -3 8 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
  f'<path d="M14 20 l5 3 M34 20 l-5 3" stroke="{L.INK}" stroke-width="2.2" stroke-linecap="round"/>',
  f'<path d="M20 33 q4 -2 8 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  f'<path d="M20 32 h8" stroke="{L.INK}" stroke-width="2.2" stroke-linecap="round"/>',
  f'<path d="M20 30 q4 3 8 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  f'<path d="M19 29 q5 6 10 0 z" fill="{L.INK}"/>'
  f'<path d="M15 21 q3 -4 6 0 M27 21 q3 -4 6 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
]
COLS = [L.CORAL, L.PEACH, L.PAPER, L.MINT, L.MINT]
NOMS = ["Totalment en desacord", "Més aviat en desacord", "Ni d'acord ni en desacord",
        "Més aviat d'acord", "Totalment d'acord"]
for n, (b, c, nom) in enumerate(zip(BOQUES, COLS, NOMS), start=1):
    ulls = '' if n in (1, 5) else (
      f'<circle cx="19" cy="23" r="2.4" fill="{L.INK}"/><circle cx="29" cy="23" r="2.4" fill="{L.INK}"/>')
    parts.append(
      f'<symbol id="escala-{n}" viewBox="0 0 48 48"><title>{nom}</title>'
      f'<circle cx="24" cy="24" r="22" fill="{c}" stroke="{L.INK}" stroke-width="2.5"/>{ulls}{b}</symbol>\n')

parts.append('</defs>\n</svg>\n')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(''.join(parts))
print(f'sprite escrit a {OUT}  ({os.path.getsize(OUT)} bytes)')
