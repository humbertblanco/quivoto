"""Font única del sistema d'icones i mascota de quivoto.

Cap efecte secundari: només dades i funcions que retornen SVG.
Ho fan servir tant els generadors del llenç de disseny (design/identitat/gen_*.py)
com el generador de la landing (tools/build_landing.py).

Les regles del joc
------------------
Abans, cada icona s'havia dibuixat pel seu compte: unes amb un filet de tinta
només a la teulada, d'altres sense cap vora, i detalls de tinta (les rodes del
bus, la grua, la tapa del cubell, el faristol del ple) penjats directament sobre
el fons. Sobre el paper, la menta i el préssec gairebé no es distingien del fons;
en mode fosc, tots aquells detalls de tinta desapareixien i la grua d'«Urbanisme»
es quedava en un quadradet. Ara totes segueixen les mateixes cinc regles:

1. **La graella.** viewBox de 48, que és una graella de 24 a doble resolució. El
   dibuix (la geometria) cap dins de 7–41 i la vora de tinta en surt 3, de
   manera que res no passa de 4–44. Es queda a 48 i no a 24 perquè l'animació de
   les pupil·les es mou en unitats del dibuix i la portada, el sprite i la fitxa
   ja hi estan fets.
2. **Un sol gruix: 3.** És el mateix pes visual que el contorn de 4 de la
   mascota quan la mascota surt a 96 px i la icona a 48. La vora exterior es fa
   amb `silueta()`: un traç de 6 per darrere i el color a sobre, de manera que
   en queden 3 a fora i cap a dins. Així una forma composta (el bus amb les
   rodes, la grua) té una sola vora contínua, sense costures. Els detalls de
   dins (finestres, ratlles) també van a 3, centrats.
3. **Cap tinta sobre el fons.** Tot detall de tinta va damunt d'un color de la
   casa. En fosc la vora es fon amb el fons, però el cos de color, el paper de
   les finestres i la tinta damunt del color continuen llegint-se.
4. **Colors només de la casa.** Un to principal per icona (`COLOR`), tinta i
   paper. Un segon to només quan és un objecte diferent (el tronc de l'arbre).
   Cap degradat, cap ombra.
5. **La cara és la mateixa a totes.** Ulls de 3,6 a ±5 (±4 quan el cos és
   estret), pupil·les d'1,9, parpelles de 8×8,4 i boca de 2,1. Va sempre sobre
   una zona llisa del cos, amb aire al voltant: cap detall no li passa per sota.
   Si un detall i la cara no hi caben junts, se'n va el detall, i si el detall
   és el que diu què és la cosa, el cos es redibuixa perquè hi càpiguen tots
   dos. La boca és més fina que la vora (2,1 i no 3) a posta, com a la mascota:
   les faccions són més fines que el contorn.
"""

PAPER = '#FBF7EE'
INK   = '#1E1B2E'
CORAL = '#E2735A'
MINT  = '#BFE8D2'
LAV   = '#C9C4F2'
PEACH = '#FFD8B8'
WHITE = '#FFFFFF'

# El gruix de la casa, en unitats del viewBox de 48.
TRAC = 3


def silueta(*formes, fill='{fill}', ink='{ink}'):
    """La vora exterior: un traç de 6 per darrere i el color per damunt.

    Del traç de 6, la meitat de dins queda tapada pel color i la de fora en
    surt 3, que és el gruix de la casa. Les formes es passen sense `fill`:
    l'hereten del grup. Per defecte deixa els marcadors `{fill}` i `{ink}` com
    a text, perquè `icon()` els substitueix amb `.format()`.
    """
    cos = ''.join(formes)
    return (f'<g fill="{ink}" stroke="{ink}" stroke-width="{2 * TRAC}" stroke-linejoin="round" '
            f'stroke-linecap="round">{cos}</g><g fill="{fill}">{cos}</g>')


def ratlla(d, ink='{ink}'):
    """Un detall de tinta, al gruix de la casa i amb el cap rodó."""
    return (f'<path d="{d}" fill="none" stroke="{ink}" stroke-width="{TRAC}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')


def estrella(cx, cy, r_ext, r_int):
    """Una estrella de cinc puntes, amb la primera punta amunt."""
    import math
    punts = []
    for k in range(10):
        r = r_ext if k % 2 == 0 else r_int
        a = math.radians(k * 36 - 90)
        punts.append(f'{cx + r * math.cos(a):.1f} {cy + r * math.sin(a):.1f}')
    return 'M' + ' L'.join(punts) + ' Z'


# (etiqueta, cos, detall, y dels ulls)  ·  viewBox 0 0 48 48
ICONS = [
 # La casa amb la xemeneia. La porta només va a la versió sense cara: queia
 # entre els ulls i es menjava la boca.
 ("Habitatge", silueta('<path d="M7 22 L24 8 L41 22 V41 H7 Z"/>', '<rect x="30" y="9" width="5" height="9"/>'),
  '<rect x="20" y="30" width="8" height="11" rx="1.5" fill="{ink}"/>', 28),
 # El bus de cara: la finestra és de paper amb vora, i les rodes són de color
 # amb la seva vora per davant de la carrosseria. Les de tinta en fosc no hi
 # eren, i foses amb la carrosseria semblaven dents.
 ("Mobilitat", silueta('<rect x="7" y="8" width="34" height="28" rx="6"/>') +
               silueta('<circle cx="13" cy="37.5" r="3.5"/>', '<circle cx="35" cy="37.5" r="3.5"/>'),
  f'<rect x="11" y="11" width="26" height="7.5" rx="2" fill="{PAPER}" stroke="{{ink}}" stroke-width="{TRAC}"/>', 25.5),
 # La grua i l'edifici que aixeca. La grua era de tinta pura i en fosc no es
 # veia: ara és del mateix lila que l'edifici, amb vora.
 ("Urbanisme", silueta('<rect x="32" y="8" width="5" height="33"/>', '<rect x="10" y="8" width="31" height="5"/>',
                       '<rect x="7" y="21" width="18" height="20" rx="2"/>'),
  '', 28),
 # L'escut. El vistiplau només a la versió sense cara: feia de boca.
 ("Seguretat", silueta('<path d="M24 7 L40 12 V23 C40 32 33 38 24 41 C15 38 8 32 8 23 V12 Z"/>'),
  ratlla('M17 23 L22 28 L31 17'), 20),
 # La moneda amb el cantell. Sense el cantell era la pilota d'«Esports»; amb
 # l'euro i la cara alhora, tot plegat era una taca a 24 px.
 ("Fiscalitat", silueta('<circle cx="24" cy="24" r="17"/>'),
  ratlla('M30 17 A8 8 0 1 0 30 31 M16 21.5 H27 M16 26.5 H27') +
  f'<circle cx="24" cy="24" r="12.5" fill="none" stroke="{{ink}}" stroke-width="{TRAC}"/>', 23),
 # La fulla. La nervadura passava pel mig dels ulls: només sense cara.
 ("Medi ambient", silueta('<path d="M40 8 C21 8 8 20 9 40 C29 41 41 28 40 8 Z"/>'),
  ratlla('M13 36 C19 29 26 22 34 14'), 23),
 # L'entrada, amb l'estrella a la matriu i les osques a la línia de tall.
 ("Cultura", silueta('<path d="M7 13 H27 A2.5 2.5 0 0 0 32 13 H41 V35 H32 A2.5 2.5 0 0 0 27 35 H7 Z"/>'),
  f'<path d="{estrella(36, 24, 4.6, 2.0)}" fill="{{ink}}" stroke="{{ink}}" stroke-width="{TRAC}" stroke-linejoin="round"/>', 22),
 # El llibre obert, amb una ratlla per pàgina per sobre dels ulls. El llom
 # partia la cara pel mig: només sense cara.
 ("Educació", silueta('<path d="M7 12 H20 A4 4 0 0 1 24 15 A4 4 0 0 1 28 12 H41 V36 H28 A4 4 0 0 0 24 39 A4 4 0 0 0 20 36 H7 Z"/>'),
  ratlla('M11 17 H19 M29 17 H37'), 26),
 # El cor, sol.
 ("Serveis socials", silueta('<path d="M24 41 C11 32 7 25 7.5 17 C9 9.5 18.5 9 24 16 C29.5 9 39 9.5 40.5 17 C41 25 37 32 24 41 Z"/>'),
  '', 20.5),
 # La botiga amb el tendal de ratlles.
 ("Comerç", silueta('<rect x="9" y="20" width="30" height="21"/>', '<path d="M10 10 H38 L41 20 H7 Z"/>'),
  ratlla('M7 20 H41') + ratlla('M17.5 11.5 L16.5 18.5 M24 11.5 V18.5 M30.5 11.5 L31.5 18.5'), 26.5),
 # La mà alçada: quatre dits, el polze i el palmell en una sola silueta, i
 # tres ratlles curtes que separen els dits.
 ("Participació", silueta('<rect x="9" y="21" width="6" height="13" rx="3" transform="rotate(-28 12 31)"/>',
                          '<rect x="15" y="13" width="6" height="14" rx="3"/>', '<rect x="21" y="8" width="6" height="19" rx="3"/>',
                          '<rect x="27" y="10" width="6" height="17" rx="3"/>', '<rect x="33" y="14" width="6" height="13" rx="3"/>',
                          '<path d="M15 23 H39 V33 A8 8 0 0 1 31 41 H23 A8 8 0 0 1 15 33 Z"/>'),
  ratlla('M21 17 V22 M27 13 V22 M33 17 V22'), 29),
 # La bafarada. La ç només sense cara: quedava sota la boca.
 ("Llengua", silueta('<path d="M11 8 H37 A4 4 0 0 1 41 12 V28 A4 4 0 0 1 37 32 H23 L14 40 V32 H11 A4 4 0 0 1 7 28 V12 A4 4 0 0 1 11 8 Z"/>'),
  '<text x="24" y="27" text-anchor="middle" font-family="Gabarito, sans-serif" font-weight="800" font-size="18" fill="{ink}">ç</text>', 17),
 # La pilota amb les dues costures, que és el que la separa de la moneda.
 ("Esports", silueta('<circle cx="24" cy="24" r="17"/>'),
  ratlla('M11 13 C15 19 15 29 11 35 M37 13 C33 19 33 29 37 35'), 22),
 # La maleta. El pin del mapa amb raigs era, a 24 px, una gota del revés: es
 # confonia amb l'«Aigua potable» i els raigs de tinta en fosc no hi eren.
 ("Turisme", silueta('<rect x="7" y="15" width="34" height="25" rx="4"/>',
                     '<path d="M17 16 V12 A4 4 0 0 1 21 8 H27 A4 4 0 0 1 31 12 V16 H27 V12 H21 V16 Z"/>'),
  ratlla('M13 15 V40 M35 15 V40'), 25),
 # El cubell amb la tapa i el pom, tot de color. Les costelles passaven pels ulls.
 ("Neteja", silueta('<rect x="20" y="7" width="8" height="5" rx="2"/>', '<rect x="7" y="11" width="34" height="5" rx="2.5"/>',
                    '<path d="M10 16 H38 L35.5 41 H12.5 Z"/>'),
  ratlla('M8.5 16 H39.5'), 25),
 # L'hemicicle, sol. Els escons de tinta semblaven ulls, i el faristol a sota,
 # amb la vora, el convertia en un bolet.
 ("El ple", silueta('<path d="M7 33 A17 17 0 0 1 41 33 Z"/>'),
  '', 22),
]

# Color fix per tema (mai canvia entre pantalles)
COLOR = [CORAL, MINT, LAV, PEACH, MINT, MINT, LAV, PEACH, CORAL, PEACH, LAV, CORAL, MINT, PEACH, LAV, CORAL]

# Què es dibuixa en comptes del detall normal quan la icona porta cara ('' = no
# res). Els cossos s'han redibuixat perquè la cara hi càpiga amb el detall que
# diu què és cada cosa; aquí només hi queden els detalls que sobren amb cara.
DETALL_AMB_CARA = {
 0:  '',                                                                          # Habitatge: sense porta
 3:  '',                                                                          # Seguretat: sense vistiplau
 4:  f'<circle cx="24" cy="24" r="12.5" fill="none" stroke="{{ink}}" stroke-width="{TRAC}"/>',  # Fiscalitat: el cantell sol
 5:  '',                                                                          # Medi ambient: sense nervadura
 11: '',                                                                          # Llengua: sense la ç
}

SLUG = ["habitatge","mobilitat","urbanisme","seguretat","fiscalitat","medi-ambient","cultura",
        "educacio","serveis-socials","comerc","participacio","llengua","esports","turisme","neteja","el-ple"]


# Posició dels ulls per icona: (centre x, centre y, separació). Mesurada perquè
# la cara sencera (ulls, parpelles i boca) quedi a 1 unitat o més de la vora i
# de qualsevol detall.
EYES = [
 (24, 28, 5),     # Habitatge — dins la casa, sota la teulada
 (24, 25.5, 5),   # Mobilitat — sota la finestra del bus
 (16, 28, 4),     # Urbanisme — dins l'edifici
 (24, 20, 5),     # Seguretat — a la part ampla de l'escut
 (24, 23, 5),     # Fiscalitat — dins del cantell de la moneda
 (25, 23, 5),     # Medi ambient — al mig de la fulla
 (17, 22, 4),     # Cultura — a la matriu, a l'esquerra del tall
 (24, 26, 6),     # Educació — a les pàgines, sota les ratlles
 (24, 20.5, 5),   # Serveis socials — dins el cor
 (24, 26.5, 5),   # Comerç — dins la botiga, sota el tendal
 (27, 29, 5),     # Participació — al palmell
 (24, 17, 5),     # Llengua — dins la bafarada
 (24, 22, 4),     # Esports — entre les costures
 (24, 25, 4),     # Turisme — entre les corretges de la maleta
 (24, 25, 5),     # Neteja — dins el cubell
 (24, 22, 4),     # El ple — dins l'hemicicle
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


# --- Marques de traç -------------------------------------------------------
# Les tres marques que més es repeteixen a les pantalles (vist, aspa, fletxa)
# NO poden ser glifs de la font del sistema: al costat d'un traç de 3 px fet a
# mà, un ✓ de la fallback UI font es veu prim i d'una altra família. Es dibuixen
# aquí, amb el mateix gruix i el mateix cap rodó que la resta del sprite, i es
# clonen amb moviment.icona() com qualsevol altra icona.
# El traç va en `currentColor`: qui les fa servir en decideix la tinta amb
# `color`, i així la mateixa marca serveix sobre menta, sobre coral i sobre
# paper fosc sense duplicar-la.
MARCA_GRUIX = 4.0

def marca_si(ink='currentColor'):
    """Vist. El mateix gest que la creu de la papereta, a viewBox 48."""
    return (f'<path d="M11 25 l8.5 9.5 l17.5 -21" fill="none" stroke="{ink}" '
            f'stroke-width="{MARCA_GRUIX}" stroke-linecap="round" stroke-linejoin="round"/>')

def marca_no(ink='currentColor'):
    """Aspa."""
    return (f'<path d="M14 14 L34 34 M34 14 L14 34" fill="none" stroke="{ink}" '
            f'stroke-width="{MARCA_GRUIX}" stroke-linecap="round"/>')

def marca_abst(ink='currentColor'):
    """Ratlla: abstenció."""
    return (f'<path d="M13 24 H35" fill="none" stroke="{ink}" '
            f'stroke-width="{MARCA_GRUIX}" stroke-linecap="round"/>')

def marca_absent(ink='currentColor'):
    """Punt: no hi era."""
    return f'<circle cx="24" cy="24" r="3.4" fill="{ink}"/>'

def fletxa(ink='currentColor'):
    """Fletxa cap a la dreta. Per a «↗» es gira -45° amb .ico--puja."""
    return (f'<path d="M9 24 H36 M26.5 14.5 L36 24 L26.5 33.5" fill="none" stroke="{ink}" '
            f'stroke-width="{MARCA_GRUIX}" stroke-linecap="round" stroke-linejoin="round"/>')
