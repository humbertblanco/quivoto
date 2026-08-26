"""Font única del sistema d'icones i mascota de quivoto.

Cap efecte secundari: només dades i funcions que retornen SVG.
Ho fan servir tant els generadors del llenç de disseny (design/identitat/gen_*.py)
com el generador de la landing (tools/build_landing.py).
"""

PAPER = '#FBF7EE'
INK   = '#1E1B2E'
CORAL = '#E2735A'
MINT  = '#BFE8D2'
LAV   = '#C9C4F2'
PEACH = '#FFD8B8'
WHITE = '#FFFFFF'

# (etiqueta, cos, detall, y dels ulls)  ·  viewBox 0 0 48 48
ICONS = [
 ("Habitatge",   '<path d="M8 22 L24 8 L40 22 V40 H8 Z" fill="{fill}"/>', '<path d="M8 22 L24 8 L40 22" fill="none" stroke="{ink}" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="28" width="8" height="12" fill="{ink}"/>', 34),
 ("Mobilitat",   '<rect x="6" y="12" width="36" height="24" rx="6" fill="{fill}"/>', '<rect x="10" y="17" width="9" height="8" rx="2" fill="{ink}"/><rect x="22" y="17" width="9" height="8" rx="2" fill="{ink}"/><rect x="34" y="17" width="4" height="8" rx="2" fill="{ink}"/><circle cx="14" cy="39" r="4" fill="{ink}"/><circle cx="34" cy="39" r="4" fill="{ink}"/>', 30),
 ("Urbanisme",   '<rect x="6" y="26" width="16" height="16" fill="{fill}"/>', '<path d="M36 42 V8 M36 8 H10 M10 8 V16 M40 8 H44" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16 L10 22 L22 22 Z" fill="{ink}"/>', 34),
 ("Seguretat",   '<path d="M24 5 L40 11 V24 C40 34 32 40 24 43 C16 40 8 34 8 24 V11 Z" fill="{fill}"/>', '<path d="M17 24 L22 29 L31 18" fill="none" stroke="{ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>', 13),
 ("Fiscalitat",  '<circle cx="24" cy="24" r="17" fill="{fill}"/>', '<path d="M30 16 A9 9 0 1 0 30 32 M14 21 H27 M14 27 H27" fill="none" stroke="{ink}" stroke-width="3.5" stroke-linecap="round"/>', 38),
 ("Medi ambient",'<path d="M40 8 C20 8 8 20 10 40 C30 40 42 28 40 8 Z" fill="{fill}"/>', '<path d="M12 38 C18 30 26 22 34 14" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>', 20),
 ("Cultura",     '<path d="M6 14 H42 V22 A4 4 0 0 0 42 30 V38 H6 V30 A4 4 0 0 0 6 22 Z" fill="{fill}"/>', '<path d="M16 16 V36" fill="none" stroke="{ink}" stroke-width="3" stroke-dasharray="3 3"/><path d="M30 19 L32.2 24 L37.5 24.4 L33.4 27.8 L34.7 33 L30 30.2 L25.3 33 L26.6 27.8 L22.5 24.4 L27.8 24 Z" fill="{ink}"/>', 40),
 ("Educació",    '<path d="M6 12 H22 A4 4 0 0 1 24 14 A4 4 0 0 1 26 12 H42 V36 H26 A4 4 0 0 0 24 38 A4 4 0 0 0 22 36 H6 Z" fill="{fill}"/>', '<path d="M24 14 V38 M11 19 H19 M11 25 H19 M29 19 H37 M29 25 H37" fill="none" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>', 33),
 ("Serveis socials", '<path d="M24 42 C10 32 4 24 6 16 C8 8 18 8 24 16 C30 8 40 8 42 16 C44 24 38 32 24 42 Z" fill="{fill}"/>', '<path d="M14 22 C18 18 22 20 24 24 C26 20 30 18 34 22" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/><path d="M19 24 L24 31 L29 24" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', 14),
 ("Comerç",      '<rect x="8" y="20" width="32" height="22" fill="{fill}"/><path d="M6 12 H42 L44 20 H4 Z" fill="{fill}"/>', '<path d="M4 20 H44" stroke="{ink}" stroke-width="3"/><path d="M12 12 V20 M20 12 V20 M28 12 V20 M36 12 V20" stroke="{ink}" stroke-width="2.5"/><rect x="20" y="30" width="8" height="12" fill="{ink}"/>', 26),
 ("Participació",'<path d="M18 44 V26 C18 22 14 22 14 26 V18 C14 14 20 14 20 18 V10 C20 6 26 6 26 10 V16 C26 12 32 12 32 16 V22 C32 18 38 18 38 22 V34 C38 40 32 44 26 44 Z" fill="{fill}"/>', '<path d="M18 44 V26 C18 22 14 22 14 26 V18 C14 14 20 14 20 18 V10 C20 6 26 6 26 10 V16 C26 12 32 12 32 16 V22 C32 18 38 18 38 22 V34 C38 40 32 44 26 44 Z" fill="none" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>', 34),
 ("Llengua",     '<path d="M8 8 H40 V32 H22 L12 40 V32 H8 Z" fill="{fill}"/>', '<text x="24" y="27" text-anchor="middle" font-family="Gabarito, sans-serif" font-weight="800" font-size="18" fill="{ink}">ç</text>', 12),
 ("Esports",     '<circle cx="24" cy="24" r="17" fill="{fill}"/>', '<path d="M24 16 L31.6 21.5 L28.7 30.5 H19.3 L16.4 21.5 Z" fill="{ink}"/><path d="M24 16 V8 M31.6 21.5 L39 19 M28.7 30.5 L33 38 M19.3 30.5 L15 38 M16.4 21.5 L9 19" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>', 40),
 ("Turisme",     '<path d="M24 44 C14 32 8 25 8 18 A16 16 0 0 1 40 18 C40 25 34 32 24 44 Z" fill="{fill}"/>', '<circle cx="24" cy="18" r="5" fill="{ink}"/><path d="M24 7 V4 M35 18 H38 M10 18 H13 M31.8 10.2 L34 8 M16.2 10.2 L14 8" stroke="{ink}" stroke-width="2.2" stroke-linecap="round"/>', 33),
 ("Neteja",      '<path d="M10 14 H38 L35 42 H13 Z" fill="{fill}"/>', '<rect x="6" y="8" width="36" height="6" rx="3" fill="{ink}"/><path d="M19 20 V36 M29 20 V36" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>', 30),
 ("El ple",      '<path d="M6 30 A18 18 0 0 1 42 30 Z" fill="{fill}"/>', '<path d="M6 30 A18 18 0 0 1 42 30" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="22" r="2.5" fill="{ink}"/><circle cx="18" cy="16" r="2.5" fill="{ink}"/><circle cx="24" cy="14" r="2.5" fill="{ink}"/><circle cx="30" cy="16" r="2.5" fill="{ink}"/><circle cx="36" cy="22" r="2.5" fill="{ink}"/><rect x="18" y="34" width="12" height="8" rx="2" fill="{ink}"/>', 27),
]

# Color fix per tema (mai canvia entre pantalles)
COLOR = [CORAL, MINT, LAV, PEACH, MINT, MINT, LAV, PEACH, CORAL, PEACH, LAV, CORAL, MINT, PEACH, LAV, CORAL]

# Quan la icona porta cara, alguns detalls li trepitgen els ulls o la boca.
# Aquí hi ha què s'ha de dibuixar en comptes del detall normal ('' = no res).
DETALL_AMB_CARA = {
 3:  '',                                                                          # Seguretat: l'escut ja s'entén; el vistiplau feia de boca
 5:  '',                                                                          # Medi ambient: la nervadura passava pel mig dels ulls
 6:  '<path d="M30 19 L32.2 24 L37.5 24.4 L33.4 27.8 L34.7 33 L30 30.2 L25.3 33 L26.6 27.8 L22.5 24.4 L27.8 24 Z" fill="{ink}"/>',  # Cultura: fora la línia de puntets
 8:  '',                                                                          # Serveis socials: el cor sol
 11: '',                                                                          # Llengua: la bafarada sola, sense la ç sota la boca
 12: '',                                                                          # Esports: la pilota sola, sense pentàgon ni radis
 13: '<path d="M24 7 V4 M35 18 H38 M10 18 H13 M31.8 10.2 L34 8 M16.2 10.2 L14 8" stroke="{ink}" stroke-width="2.2" stroke-linecap="round"/>',  # Turisme: els raigs, sense el cercle que feia de tercer ull
 15: '<path d="M6 30 A18 18 0 0 1 42 30" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/><rect x="18" y="34" width="12" height="8" rx="2" fill="{ink}"/>',  # El ple: fora els escons, que semblaven més ulls
}

SLUG = ["habitatge","mobilitat","urbanisme","seguretat","fiscalitat","medi-ambient","cultura",
        "educacio","serveis-socials","comerc","participacio","llengua","esports","turisme","neteja","el-ple"]


# Posició dels ulls per icona: (centre x, centre y, separació). Mesurada perquè
# sempre caiguin dins del cos de la icona i no trepitgin el detall.
EYES = [
 (24, 33, 5),   # Habitatge — dins la casa, sota la teulada
 (24, 30, 5),   # Mobilitat — sota les finestres del bus
 (14, 34, 4),   # Urbanisme — dins l'edifici petit
 (24, 21, 5),   # Seguretat — a la part alta de l'escut, sobre el vistiplau
 (24, 14, 5),   # Fiscalitat — a dalt de la moneda, sobre l'euro
 (26, 24, 5),   # Medi ambient — al mig de la fulla
 (18, 26, 5),   # Cultura — a l'esquerra de l'estrella
 (24, 31, 6),   # Educació — a les pàgines del llibre
 (24, 17, 5),   # Serveis socials — dins el cor
 (24, 27, 5),   # Comerç — dins la botiga
 (26, 34, 5),   # Participació — al palmell de la mà
 (24, 18, 5),   # Llengua — a dalt de la bafarada, sobre la ç
 (24, 22, 5),   # Esports — a dalt de la pilota
 (24, 18, 5),   # Turisme — a la part baixa del pin, més juntets
 (24, 28, 5),   # Neteja — dins el contenidor
 (24, 24, 5),   # El ple — dins l'hemicicle, sota els escons
]


def face(cx, cy, sep=5, ink=INK, sclera=PAPER, cls="cara"):
    """Cara animable: parpelles + pupil·les + boca. Les classes les anima el CSS."""
    r, e = 3.6, 1.9
    x1, x2 = cx - sep, cx + sep
    return (
      f'<g class="{cls}">'
      f'<circle cx="{x1}" cy="{cy}" r="{r}" fill="{sclera}"/><circle cx="{x2}" cy="{cy}" r="{r}" fill="{sclera}"/>'
      f'<g class="pupilles"><circle cx="{x1}" cy="{cy+0.4}" r="{e}" fill="{ink}"/>'
      f'<circle cx="{x2}" cy="{cy+0.4}" r="{e}" fill="{ink}"/></g>'
      f'<g class="parpelles"><rect x="{x1-4}" y="{cy-4.2}" width="8" height="8.4" rx="3.4" fill="{sclera}"/>'
      f'<rect x="{x2-4}" y="{cy-4.2}" width="8" height="8.4" rx="3.4" fill="{sclera}"/></g>'
      f'<path class="boca" d="M{cx-4} {cy+7.4} q4 3 8 0" stroke="{ink}" stroke-width="2.1" fill="none" stroke-linecap="round"/>'
      f'</g>')


def icon(i, size=48, with_face=False, fill=None, ink=INK, extra_class="", delay=0.0):
    """Icona d'un tema. Amb cara, es converteix en veí."""
    label, body, detail, _ = ICONS[i]
    f = fill or COLOR[i]
    cx, cy, sep = EYES[i]
    cara = face(cx, cy, sep) if with_face else ''
    if with_face and i in DETALL_AMB_CARA:
        detail = DETALL_AMB_CARA[i]
    style = f' style="--retard: {delay:.1f}s"' if with_face else ''
    cls = ("icona " + extra_class).strip()
    return (f'<svg class="{cls}" width="{size}" height="{size}" viewBox="0 0 48 48" role="img" '
            f'aria-label="{label}"{style}>{body.format(fill=f, ink=ink)}{detail.format(fill=f, ink=ink)}{cara}</svg>')


def cara_marca(cx=24, cy=24, sep=5, sclera=WHITE):
    """La cara sola, per a la 'o' del wordmark i el favicon."""
    return face(cx, cy, sep, sclera=sclera)


def papereta(size=180, cls="papereta", mood="feliç"):
    """La mascota: una papereta de vot amb cara. viewBox 0 0 120 140."""
    boca = {
      "feliç":   f'<path class="boca" d="M44 92 q16 14 32 0" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>',
      "neutre":  f'<path class="boca" d="M46 94 h28" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>',
      "pregunta":f'<path class="boca" d="M50 94 q10 -6 20 0" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>',
    }.get(mood, f'<path class="boca" d="M44 92 q16 14 32 0" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>')
    return f'''<svg class="{cls}" width="{size}" height="{int(size*1.17)}" viewBox="0 0 120 140" role="img" aria-label="La papereta, mascota de quivoto">
  <g class="cos">
    <path d="M18 14 H80 L102 36 V126 H18 Z" fill="{WHITE}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 14 V36 H102 Z" fill="{PEACH}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>
    <g class="ratlles">
      <path d="M32 112 H88" stroke="{CORAL}" stroke-width="5" stroke-linecap="round"/>
      <path d="M32 122 H70" stroke="{MINT}" stroke-width="5" stroke-linecap="round"/>
    </g>
    <g class="cara">
      <circle cx="46" cy="70" r="9" fill="{WHITE}" stroke="{INK}" stroke-width="3"/>
      <circle cx="76" cy="70" r="9" fill="{WHITE}" stroke="{INK}" stroke-width="3"/>
      <g class="pupilles"><circle cx="46" cy="71" r="4.2" fill="{INK}"/><circle cx="76" cy="71" r="4.2" fill="{INK}"/></g>
      <g class="parpelles">
        <circle cx="46" cy="70" r="9.6" fill="{WHITE}"/>
        <circle cx="76" cy="70" r="9.6" fill="{WHITE}"/>
      </g>
      {boca}
    </g>
    <path class="creu" d="M31 46 l7 8 l14 -16" stroke="{CORAL}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>'''
