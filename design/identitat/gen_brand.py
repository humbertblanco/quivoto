import gen_icons as G   # reuses ICONS, svg(), COLD, eyesD
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'tools'))
import icons_lib as IL


ICONS, svg, COLD, eyesD = G.ICONS, G.svg, G.COLD, G.eyesD
FD = "https://fonts.googleapis.com/css2?family=Gabarito:wght@500;700;900&family=Nunito+Sans:ital,opsz,wght@0,6..12,400;0,6..12,600;0,6..12,700;1,6..12,400&display=swap"
font = '"Nunito Sans", "Helvetica Neue", Arial, sans-serif'; disp = "'Gabarito', sans-serif"
INK='#1E1B2E'; PAPER='#FBF7EE'; CORAL='#E2735A'; MINT='#BFE8D2'; LAV='#C9C4F2'; PEACH='#FFD8B8'

def head(bg):
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="{FD}">
  <style>
    body {{ margin: 0; background: {bg}; font-family: {font}; color: {INK}; }}
    a {{ color: {CORAL}; }} a:hover {{ color: {INK}; }}
  </style>
</helmet>
'''
TAIL = '</x-dc>\n</body>\n</html>\n'

def neighbour_o(idx, size=86):
    """La 'o' final del wordmark: sempre la cara de la protagonista, mai una icona de tema.
    Per sota de 64 px es fa servir una 'o' normal (a mida petita el disc no es llegeix)."""
    cara = IL.face(24, 24, 5, sclera=IL.WHITE)
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" style="vertical-align: -10%;" aria-hidden="true">'
            f'<circle cx="24" cy="24" r="22" fill="{IL.WHITE}" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M34 8 l6 6" stroke="{PEACH}" stroke-width="6" stroke-linecap="round"/>{cara}</svg>')


def wordmark(stem, idx, fs=86):
    return (f'<span style="display: inline-flex; align-items: baseline; gap: 2px; font-family: {disp}; font-weight: 900; '
            f'font-size: {fs}px; line-height: 0.9; letter-spacing: -0.045em;">{stem}{neighbour_o(idx, int(fs))}</span>')

# ---------------- MarcaD ----------------
langs = [("Català","quivot",0,"quivoto.cat"),("Castellà","quienvot",1,"quienvoto.com"),("Portuguès","quemvot",5,"quemvoto.com"),("Italià","chivot",3,"chivoto.it")]
langcards = ''.join(f'''<div style="background: #FFFFFF; border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start;">
      <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">{lang}</span>
      {wordmark(stem, i, 44)}
      <span style="font-size: 13px; font-weight: 700; color: {CORAL};">{dom}</span>
    </div>''' for lang,stem,i,dom in langs)

oswaps = ''.join(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">{neighbour_o(i,64)}<span style="font-size: 11px; font-weight: 700;">{ICONS[i][0]}</span></div>' for i in [0,1,5,14,3,6])

palette = [(PAPER,'Paper','#FBF7EE','fons general'),(INK,'Tinta','#1E1B2E','text i traç'),(CORAL,'Coral','#E2735A','acció primària'),(MINT,'Menta','#BFE8D2','confirmació, temes verds'),(LAV,'Lavanda','#C9C4F2','destacats freds'),(PEACH,'Préssec','#FFD8B8','temes càlids')]
swatches = ''.join(f'''<div style="display: flex; flex-direction: column; gap: 6px;">
      <div style="height: 66px; border-radius: 14px; background: {hexv}; border: 1px solid rgba(30,27,46,0.12);"></div>
      <div style="font-size: 13px; font-weight: 700;">{name}</div>
      <div style="font-size: 11px; color: #6B6680; font-family: ui-monospace, Menlo, monospace;">{hexv}</div>
      <div style="font-size: 11px; color: #6B6680;">{role}</div>
    </div>''' for hexv,name,_,role in palette)

domains = [("quivoto.cat","TRIAT · principal, Catalunya","LLIURE"),("quivoto.com","Recomanat: defensiu","LLIURE"),("quienvoto.com","Recomanat: defensiu","LLIURE"),("quienvoto.es","TRIAT · Espanya","a confirmar"),("quivoto.app","Reserva","LLIURE"),("quemvoto.com · chivoto.it","Reserva PT · IT","LLIURE")]
domrows = ''.join(f'''<div style="display: flex; align-items: center; gap: 10px; font-size: 14px;">
      <span style="width: 10px; height: 10px; border-radius: 50%; background: {MINT if st=='LLIURE' else PEACH}; flex: none;"></span>
      <strong style="flex: 1;">{d}</strong><span style="color: #6B6680;">{u}</span>
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: {'#2F5B47' if st=='LLIURE' else '#8A5A2B'};">{st}</span>
    </div>''' for d,u,st in domains)

donts = [("Degradats, ombres suaus i vidre","Color pla, una vora fina si cal separar."),
         ("Emojis com a icones","Sempre el set propi de 16 icones."),
         ("Colors de partit a la interfície","Només com a marca de dades, mida xip."),
         ("Text sobre coral a menys de 16 px","Coral només amb text de 16 px o més, o tinta a sobre."),
         ("Estirar o girar el wordmark","La 'o' canvia de veí; la resta, mai.")]
dontrows = ''.join(f'''<div style="display: flex; gap: 10px; align-items: flex-start;">
      <svg width="20" height="20" viewBox="0 0 20 20" style="flex: none; margin-top: 2px;"><circle cx="10" cy="10" r="9" fill="{CORAL}"/><path d="M6.5 6.5 l7 7 M13.5 6.5 l-7 7" stroke="{PAPER}" stroke-width="2.2" stroke-linecap="round"/></svg>
      <div style="font-size: 14px; line-height: 1.35;"><strong>{a}</strong><br><span style="color: #6B6680;">{b}</span></div>
    </div>''' for a,b in donts)

marca = head(PAPER) + f'''<div style="width: 1440px; min-height: 1180px; background: {PAPER}; padding: 44px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px;">
  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: inline-flex; background: {INK}; color: {PAPER}; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; width: max-content;">Identitat tancada · Direcció D</div>
      <h1 style="margin: 0; font-family: {disp}; font-weight: 900; font-size: 44px; line-height: 1; letter-spacing: -0.02em;">quivoto — la marca, el sistema i els dominis</h1>
      <p style="margin: 0; font-size: 17px; max-width: 900px; line-height: 1.4;">Un veïnat de personatges explica què es vota al teu municipi. El nom canvia de llengua, però la "o" final sempre és un veí: el logotip viatja sense perdre's.</p>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 22px;">
    <div style="background: {CORAL}; color: {PAPER}; border-radius: 28px; padding: 32px; display: flex; flex-direction: column; gap: 18px; justify-content: center;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85;">Wordmark principal</div>
      {wordmark('quivot', 0, 96)}
      <div style="font-size: 19px; line-height: 1.3; font-style: italic;">Tot el poble té alguna cosa a dir-te.</div>
    </div>
    <div style="background: #FFFFFF; border-radius: 28px; padding: 28px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">La "o" és un veí i canvia segons on ets</div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 8px;">{oswaps}</div>
      <div style="font-size: 14px; line-height: 1.4; color: #6B6680;">A la portada, l'urna. A una pàgina de mobilitat, el bus. A la de medi ambient, l'arbre. Mai dues "o" diferents a la mateixa pantalla.</div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 22px;">
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">El mateix logotip en cada llengua</div>
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">{langcards}</div>
    </div>
    <div style="background: #FFFFFF; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Dominis (comprovats el 26 d'agost de 2026)</div>
      {domrows}
      <div style="font-size: 12px; color: #6B6680; line-height: 1.4; margin-top: 4px;">Els <strong>.es</strong> no es poden comprovar per RDAP: cal mirar-los a un registrador abans de decidir.</div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 22px;">
    <div style="background: #FFFFFF; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Paleta</div>
      <div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px;">{swatches}</div>
      <div style="font-size: 13px; color: #6B6680; line-height: 1.4;">Cap color de partit a la interfície: PSC vermell, ERC groc, Junts turquesa, Comuns lila, PP blau, Vox verd i CUP groc només apareixen com a xip de 26 px al costat d'un nom.</div>
    </div>
    <div style="background: #FFFFFF; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 10px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Tipografia</div>
      <div style="font-family: {disp}; font-weight: 900; font-size: 34px; line-height: 1; letter-spacing: -0.02em;">Gabarito 900</div>
      <div style="font-size: 13px; color: #6B6680;">Titulars i xifres · −2% de tracking</div>
      <div style="font-size: 17px; line-height: 1.4; margin-top: 6px;">Nunito Sans 400/700 per al text. Cos 17 px al mòbil, mai per sota de 13 px.</div>
      <div style="font-size: 15px; font-style: italic; color: #6B6680;">La cursiva només per a la veu dels veïns.</div>
    </div>
    <div style="background: #FFFFFF; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Mai</div>
      {dontrows}
    </div>
  </div>

  <div style="background: {LAV}; border-radius: 28px; padding: 24px; display: flex; align-items: center; gap: 22px;">
    <div style="font-family: {disp}; font-weight: 900; font-size: 22px; line-height: 1.1; width: 220px;">Botons i etiquetes</div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; flex: 1;">
      <span style="background: {CORAL}; color: {PAPER}; border-radius: 999px; padding: 14px 26px; font-size: 16px; font-weight: 800;">Comença el test</span>
      <span style="background: {INK}; color: {PAPER}; border-radius: 999px; padding: 13px 22px; font-size: 15px; font-weight: 700;">Continua</span>
      <span style="background: #FFFFFF; border-radius: 999px; padding: 13px 22px; font-size: 15px; font-weight: 700;">Secundari</span>
      <span style="background: #FFFFFF; border-radius: 999px; padding: 8px 16px 8px 8px; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px;">{svg(0,COLD[0],INK,24)}Habitatge</span>
      <span style="background: {MINT}; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 700;">Resposta del partit</span>
      <span style="background: {PEACH}; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 700;">Posició inferida</span>
      <span style="background: #FFFFFF; border: 2px dashed rgba(30,27,46,0.35); border-radius: 999px; padding: 6px 16px; font-size: 13px; font-weight: 700; color: #6B6680;">Sense dades</span>
    </div>
  </div>
</div>
''' + TAIL
open('MarcaD.dc.html','w').write(marca)

# ---------------- CaresD: cast + expressions ----------------
def face(kind, cx=24, cy=24, ink=INK, paper=PAPER):
    if kind=='molt_no':
        return (f'<path d="M{cx-11} {cy-6} l7 4 M{cx+11} {cy-6} l-7 4" stroke="{ink}" stroke-width="2.4" stroke-linecap="round"/>'
                f'<circle cx="{cx-6}" cy="{cy+2}" r="2.4" fill="{ink}"/><circle cx="{cx+6}" cy="{cy+2}" r="2.4" fill="{ink}"/>'
                f'<path d="M{cx-6} {cy+11} q6 -5 12 0" stroke="{ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>')
    if kind=='no':
        return (f'<circle cx="{cx-7}" cy="{cy}" r="3.4" fill="{paper}"/><circle cx="{cx+7}" cy="{cy}" r="3.4" fill="{paper}"/>'
                f'<circle cx="{cx-6}" cy="{cy+0.6}" r="1.8" fill="{ink}"/><circle cx="{cx+8}" cy="{cy+0.6}" r="1.8" fill="{ink}"/>'
                f'<path d="M{cx-6} {cy+10} q6 -3 12 0" stroke="{ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>')
    if kind=='neutre':
        return (f'<circle cx="{cx-7}" cy="{cy}" r="3.4" fill="{paper}"/><circle cx="{cx+7}" cy="{cy}" r="3.4" fill="{paper}"/>'
                f'<circle cx="{cx-6}" cy="{cy+0.6}" r="1.8" fill="{ink}"/><circle cx="{cx+8}" cy="{cy+0.6}" r="1.8" fill="{ink}"/>'
                f'<path d="M{cx-6} {cy+10} h12" stroke="{ink}" stroke-width="2.4" stroke-linecap="round"/>')
    if kind=='si':
        return (f'<circle cx="{cx-7}" cy="{cy}" r="3.4" fill="{paper}"/><circle cx="{cx+7}" cy="{cy}" r="3.4" fill="{paper}"/>'
                f'<circle cx="{cx-6}" cy="{cy+0.6}" r="1.8" fill="{ink}"/><circle cx="{cx+8}" cy="{cy+0.6}" r="1.8" fill="{ink}"/>'
                f'<path d="M{cx-6} {cy+8} q6 5 12 0" stroke="{ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>')
    return (f'<path d="M{cx-11} {cy} q5 -6 10 0 M{cx+1} {cy} q5 -6 10 0" stroke="{ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
            f'<path d="M{cx-7} {cy+7} q7 9 14 0z" fill="{ink}"/>')

EXPR = [('molt_no','Gens<br>d\'acord'),('no','Poc<br>d\'acord'),('neutre','Ni sí<br>ni no'),('si','Força<br>d\'acord'),('molt_si','Molt<br>d\'acord')]

def bubble_neighbour(i, size=96):
    fill = COLD[i]; l,b,d,ey = ICONS[i]
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" aria-hidden="true">'
            f'{b.format(fill=fill,ink=INK)}{d.format(fill=fill,ink=INK)}{eyesD(ey)}</svg>')

cast_tiles = ''.join(f'''<div style="background: #FFFFFF; border-radius: 22px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
    {bubble_neighbour(i, 76)}<span style="font-size: 12px; font-weight: 700; text-align: center;">{ICONS[i][0]}</span></div>''' for i in range(16))

def expr_row(i, label):
    fill = COLD[i]
    cells = ''.join(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
      <svg width="72" height="72" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="{fill}"/>{face(k)}</svg>
      <span style="font-size: 10px; font-weight: 700; text-align: center; line-height: 1.15;">{lab}</span></div>''' for k,lab in EXPR)
    return f'''<div style="display: flex; align-items: center; gap: 16px;">
      <div style="width: 130px; display: flex; align-items: center; gap: 8px;">{svg(i,fill,INK,34)}<span style="font-size: 13px; font-weight: 700;">{label}</span></div>
      <div style="display: flex; gap: 12px; flex: 1; justify-content: space-between;">{cells}</div></div>'''

cares = head(PAPER) + f'''<div style="width: 1440px; min-height: 1020px; background: {PAPER}; padding: 44px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px;">
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div style="display: inline-flex; background: {INK}; color: {PAPER}; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; width: max-content;">Identitat tancada · El veïnat</div>
    <h1 style="margin: 0; font-family: {disp}; font-weight: 900; font-size: 44px; line-height: 1; letter-spacing: -0.02em;">16 veïns, una sola cara</h1>
    <p style="margin: 0; font-size: 17px; max-width: 940px; line-height: 1.4;">Cada tema municipal és un veí. Tots comparteixen els mateixos ulls i la mateixa boca, així que qualsevol pot fer de protagonista, d'icona de tema o de "o" del logotip sense semblar un personatge diferent.</p>
  </div>

  <div style="display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px;">{cast_tiles}</div>

  <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 22px;">
    <div style="background: #FFFFFF; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">L'escala de resposta és la cara del veí que et parla</div>
      {expr_row(0,'Habitatge')}
      {expr_row(1,'Mobilitat')}
      {expr_row(5,'Medi ambient')}
      <div style="font-size: 13px; color: #6B6680; line-height: 1.4;">Mateixes cinc cares per a tothom. Quan respons, el veí de la pantalla adopta la teva cara durant un instant i passa a la següent afirmació.</div>
    </div>
    <div style="background: {MINT}; border-radius: 28px; padding: 24px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2F5B47;">Com parlen</div>
      <div style="display: flex; align-items: flex-end; gap: 10px;">
        {bubble_neighbour(1, 74)}
        <div style="background: #FFFFFF; border-radius: 20px 20px 20px 4px; padding: 13px 15px; font-size: 15px; line-height: 1.35;">Sóc el bus 12. A Sabadell em volen fer gratuït per a menors de 25.</div>
      </div>
      <div style="display: flex; align-items: flex-end; gap: 10px;">
        {bubble_neighbour(0, 74)}
        <div style="background: #FFFFFF; border-radius: 20px 20px 20px 4px; padding: 13px 15px; font-size: 15px; line-height: 1.35;">Al ple del març es va votar comprar-me pisos. Tres partits van dir que no.</div>
      </div>
      <div style="font-size: 13px; color: #2F5B47; line-height: 1.4;">Primera persona, frases curtes, res d'institucional. El veí explica el fet; mai diu què has de votar.</div>
    </div>
  </div>
</div>
''' + TAIL
open('CaresD.dc.html','w').write(cares)
print("marca + cares ok")

# ---------------- FusioD: protagonista + veïnat ----------------

def urnaD(pose, size=120):
    """La protagonista: la papereta. (El nom de la funció es manté per compatibilitat.)"""
    mood = {'hola': 'feliç', 'pregunta': 'pregunta', 'contenta': 'feliç',
            'assenyala': 'neutre', 'dorm': 'neutre'}.get(pose, 'feliç')
    svg = IL.papereta(size, cls='papereta-quieta', mood=mood)
    if pose == 'pregunta':
        svg = svg.replace('</svg>', f'<text x="104" y="34" font-family="Gabarito, sans-serif" font-weight="900" font-size="30" fill="{LAV}">?</text></svg>')
    if pose == 'dorm':
        svg = svg.replace('</svg>', f'<text x="98" y="34" font-family="Gabarito, sans-serif" font-weight="900" font-size="22" fill="{LAV}">z</text></svg>')
    if pose == 'assenyala':
        svg = svg.replace('</svg>', f'<path d="M104 78 h14" stroke="{CORAL}" stroke-width="8" stroke-linecap="round"/><path d="M114 70 l8 8 l-8 8" fill="{CORAL}"/></svg>')
    return svg


poses = [('hola','Saluda','portada'),('pregunta','Pregunta','afirmació'),('contenta','Celebra','resultat'),('assenyala','Assenyala','ajuda i metodologia'),('dorm','Reposa','estat buit i error')]
posecards = ''.join(f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
    {urnaD(p, 118)}<span style="font-size: 13px; font-weight: 700;">{t}</span><span style="font-size: 11px; color: #6B6680;">{w}</span></div>''' for p,t,w in poses)

rules = [("Portada, resultat, targeta per compartir, estats buits","La protagonista", CORAL),
         ("Etiqueta de tema, targeta d'afirmació, pàgina de tema","El veí d'aquell tema", MINT),
         ("La \"o\" del logotip","La protagonista; el veí del tema dins una pàgina de tema", LAV),
         ("Escala de resposta","Sempre les cinc cares de qui et parla en aquell moment", PEACH)]
rulerows = ''.join(f'''<div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid rgba(30,27,46,0.08);">
    <span style="width: 12px; height: 12px; border-radius: 4px; background: {c}; flex: none; margin-top: 4px;"></span>
    <div style="flex: 1; font-size: 15px; line-height: 1.35;"><strong>{a}</strong></div>
    <div style="width: 300px; font-size: 15px; line-height: 1.35; color: #6B6680;">{b}</div></div>''' for a,b,c in rules)

mini = ''.join(bubble_neighbour(i, 54) for i in range(16))

fusio = head(PAPER) + f'''<div style="width: 1440px; min-height: 900px; background: {PAPER}; padding: 44px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px;">
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div style="display: inline-flex; background: {CORAL}; color: {PAPER}; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; width: max-content;">La fusió · una protagonista + 16 veïns</div>
    <h1 style="margin: 0; font-family: {disp}; font-weight: 900; font-size: 44px; line-height: 1; letter-spacing: -0.02em;">Una que et porta pel test, setze que expliquen cada tema</h1>
    <p style="margin: 0; font-size: 17px; max-width: 960px; line-height: 1.4;">La mascota que t'acompanya és una: l'urna. Els altres quinze no són mascotes, són <strong>les icones dels temes amb cara</strong>: el mateix dibuix que fa d'etiqueta de tema es gira i et parla quan et toca respondre sobre el seu tema. Un personatge memorable, un univers sencer, cap dibuix duplicat.</p>
  </div>

  <div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 22px;">
    <div style="background: #FFFFFF; border-radius: 28px; padding: 26px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">La protagonista i les seves cinc postures</div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 8px;">{posecards}</div>
      <div style="background: {PEACH}; border-radius: 18px; padding: 14px 16px; font-size: 14px; line-height: 1.4;">Com li diem? Tres opcions damunt la taula: <strong>la Papereta</strong> (descriptiu i clar) · <strong>la Pepa</strong> (curt i afectuós) · <strong>la Voto</strong> (lliga amb el nom). Ho deixo obert.</div>
    </div>
    <div style="background: {INK}; color: {PAPER}; border-radius: 28px; padding: 26px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: {MINT};">El veïnat: icona i personatge alhora</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">{mini}</div>
      <div style="font-size: 15px; line-height: 1.4; opacity: 0.9;">Sense ulls fan d'icona (etiquetes, taules, resultats). Amb ulls es converteixen en veí i parlen en primera persona. És el mateix fitxer SVG amb una capa que s'encén.</div>
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
        {svg(1,COLD[1],INK,44)}<span style="font-size: 22px; font-weight: 800;">→</span>{bubble_neighbour(1,52)}
        <span style="font-size: 13px; opacity: 0.85; flex: 1;">Icona de mobilitat · el bus que et parla</span>
      </div>
    </div>
  </div>

  <div style="background: #FFFFFF; border-radius: 28px; padding: 26px; display: flex; flex-direction: column; gap: 6px;">
    <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680; margin-bottom: 6px;">Qui surt on</div>
    {rulerows}
    <div style="font-size: 13px; color: #6B6680; line-height: 1.4; padding-top: 10px;">Regla d'or: mai dos personatges parlant a la mateixa pantalla. Si hi ha veí de tema, la protagonista es queda a la barra de dalt, quieta i petita.</div>
  </div>
</div>
''' + TAIL
open('FusioD.dc.html','w').write(fusio)
print("fusio ok")
