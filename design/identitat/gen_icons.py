# Generates IconesA/IconesD boards and Home/Resultat phone screens. Run: python3 gen_icons.py
import json
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
 ("Llengua",     '<path d="M8 8 H40 V32 H22 L12 40 V32 H8 Z" fill="{fill}"/>', '<text x="24" y="27" text-anchor="middle" font-family="Bricolage Grotesque, Gabarito, sans-serif" font-weight="800" font-size="18" fill="{ink}">ç</text>', 12),
 ("Esports",     '<circle cx="24" cy="24" r="17" fill="{fill}"/>', '<path d="M24 16 L31.6 21.5 L28.7 30.5 H19.3 L16.4 21.5 Z" fill="{ink}"/><path d="M24 16 V8 M31.6 21.5 L39 19 M28.7 30.5 L33 38 M19.3 30.5 L15 38 M16.4 21.5 L9 19" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>', 40),
 ("Turisme",     '<path d="M24 44 C14 32 8 25 8 18 A16 16 0 0 1 40 18 C40 25 34 32 24 44 Z" fill="{fill}"/>', '<circle cx="24" cy="18" r="5" fill="{ink}"/><path d="M24 7 V4 M35 18 H38 M10 18 H13 M31.8 10.2 L34 8 M16.2 10.2 L14 8" stroke="{ink}" stroke-width="2.2" stroke-linecap="round"/>', 33),
 ("Neteja",      '<path d="M10 14 H38 L35 42 H13 Z" fill="{fill}"/>', '<rect x="6" y="8" width="36" height="6" rx="3" fill="{ink}"/><path d="M19 20 V36 M29 20 V36" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>', 30),
 ("El ple",      '<path d="M6 30 A18 18 0 0 1 42 30 Z" fill="{fill}"/>', '<path d="M6 30 A18 18 0 0 1 42 30" fill="none" stroke="{ink}" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="22" r="2.5" fill="{ink}"/><circle cx="18" cy="16" r="2.5" fill="{ink}"/><circle cx="24" cy="14" r="2.5" fill="{ink}"/><circle cx="30" cy="16" r="2.5" fill="{ink}"/><circle cx="36" cy="22" r="2.5" fill="{ink}"/><rect x="18" y="34" width="12" height="8" rx="2" fill="{ink}"/>', 27),
]
# stable colour per theme (A / D)
COLA = ['#E9FF7A','#3B4BF6','#F08A4B','#E9FF7A','#3B4BF6','#E9FF7A','#F08A4B','#3B4BF6','#F08A4B','#E9FF7A','#3B4BF6','#F08A4B','#E9FF7A','#F08A4B','#3B4BF6','#E9FF7A']
COLD = ['#E2735A','#BFE8D2','#C9C4F2','#FFD8B8','#BFE8D2','#BFE8D2','#C9C4F2','#FFD8B8','#E2735A','#FFD8B8','#C9C4F2','#E2735A','#BFE8D2','#FFD8B8','#C9C4F2','#E2735A']
def inkA(i): return '#F6F1E7' if COLA[i]=='#3B4BF6' else '#111111'
def eyesA(y): return f'<circle cx="19" cy="{y}" r="3.6" fill="#F6F1E7"/><circle cx="29" cy="{y}" r="3.6" fill="#F6F1E7"/><circle cx="20" cy="{y+0.5}" r="1.8" fill="#111111"/><circle cx="30" cy="{y+0.5}" r="1.8" fill="#111111"/><path d="M20 {y+7} q4 3 8 0" stroke="#111111" stroke-width="2" fill="none" stroke-linecap="round"/>'
def eyesD(y): return f'<circle cx="19" cy="{y}" r="3.4" fill="#FBF7EE"/><circle cx="29" cy="{y}" r="3.4" fill="#FBF7EE"/><circle cx="20" cy="{y+0.5}" r="1.8" fill="#1E1B2E"/><circle cx="30" cy="{y+0.5}" r="1.8" fill="#1E1B2E"/><path d="M20 {y+7} q4 3 8 0" stroke="#1E1B2E" stroke-width="2" fill="none" stroke-linecap="round"/>'
def svg(i, fill, ink, size, eyes=None):
    l,b,d,ey = ICONS[i]
    e = eyes(ey) if eyes else ''
    return f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" aria-hidden="true">{b.format(fill=fill,ink=ink)}{d.format(fill=fill,ink=ink)}{e}</svg>'
def tile(label, s, bg, fg, radius):
    return f'<div style="background: {bg}; color: {fg}; border-radius: {radius}; padding: 14px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px;">{s}<span style="font-size: 12px; font-weight: 700; text-align: center;">{label}</span></div>'
def head(fonts,bg,font,color,link):
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="{fonts}">
  <style>
    body {{ margin: 0; background: {bg}; font-family: {font}; color: {color}; }}
    a {{ color: {link}; }} a:hover {{ color: {color}; }}
  </style>
</helmet>
'''
TAIL = '</x-dc>\n</body>\n</html>\n'
FA = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Familjen+Grotesk:wght@400;600;700&display=swap"
FD = "https://fonts.googleapis.com/css2?family=Gabarito:wght@500;700;900&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap"
fontA='"Familjen Grotesk", "Helvetica Neue", Arial, sans-serif'; dispA="'Bricolage Grotesque', sans-serif"
fontD='"Nunito Sans", "Helvetica Neue", Arial, sans-serif'; dispD="'Gabarito', sans-serif"

# ---- Icones A ----
tilesA = ''.join(tile(l, svg(i,COLA[i],inkA(i),56), '#FFFFFF', '#111111', '16px') for i,(l,*_) in enumerate(ICONS))
tilesA_eyes = ''.join(tile(l, svg(i,COLA[i],inkA(i),56, eyesA), '#F6F1E7', '#111111', '16px') for i,(l,*_) in enumerate(ICONS[:8]))
chipsA = ''.join(f'<span style="display: inline-flex; align-items: center; gap: 8px; background: #F6F1E7; border: 2px solid #111111; border-radius: 999px; padding: 6px 14px 6px 8px; font-size: 14px; font-weight: 700;">{svg(i,COLA[i],inkA(i),24)}{ICONS[i][0]}</span>' for i in range(6))
open('IconesA.dc.html','w').write(head(FA,'#F6F1E7',fontA,'#111111','#3B4BF6') + f'''<div style="width: 1440px; min-height: 900px; background: #F6F1E7; padding: 40px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px;">
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <div style="display: inline-flex; background: #3B4BF6; color: #E9FF7A; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; width: max-content;">Iteració · Icones municipals (univers A)</div>
    <h1 style="margin: 0; font-family: {dispA}; font-weight: 800; font-size: 40px; line-height: 1; letter-spacing: -0.02em;">16 temes, un sol traç: forma plana + detall en tinta</h1>
    <p style="margin: 0; font-size: 16px; max-width: 900px; line-height: 1.4;">Graella de 48 px, cantonades rodones, un color fix per tema (llima, blau o coral) i els detalls sempre en tinta. Serveixen d'etiqueta de tema, d'etiqueta d'afirmació, de marca al resultat i de targeta de tema.</p>
  </div>
  <div style="display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px;">{tilesA}</div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
    <div style="background: #3B4BF6; color: #F6F1E7; border-radius: 22px; padding: 22px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #E9FF7A;">Variant "amb ulls": les icones són els personatges</div>
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">{tilesA_eyes}</div>
      <div style="font-size: 13px; opacity: 0.9;">Si tota icona pot tenir cara, no cal una mascota única: el tema que estàs responent és qui et parla.</div>
    </div>
    <div style="background: #FFFFFF; border: 2px solid #111111; border-radius: 22px; padding: 22px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555555;">Com s'usen: etiquetes de tema</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">{chipsA}</div>
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555555; margin-top: 6px;">Etiqueta d'afirmació i marca de resultat</div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="display: inline-flex; align-items: center; gap: 8px; background: #E9FF7A; border-radius: 999px; padding: 6px 12px 6px 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">{svg(1,COLA[1],inkA(1),22)}Sabadell · Mobilitat</span>
        <span style="display: inline-flex; align-items: center; gap: 10px; font-size: 14px;">{svg(0,COLA[0],inkA(0),28)}<span style="width: 140px; height: 12px; background: #EDE7DB; border-radius: 6px; overflow: hidden; display: inline-block;"><span style="display: block; width: 82%; height: 100%; background: #111111;"></span></span><strong style="font-family: {dispA}; font-size: 18px;">82%</strong> en habitatge</span>
      </div>
    </div>
  </div>
</div>
''' + TAIL)

# ---- Icones D ----
tilesD = ''.join(tile(l, svg(i,COLD[i],'#1E1B2E',56), '#FFFFFF', '#1E1B2E', '20px') for i,(l,*_) in enumerate(ICONS))
tilesD_eyes = ''.join(tile(l, svg(i,COLD[i],'#1E1B2E',56, eyesD), '#FBF7EE', '#1E1B2E', '20px') for i,(l,*_) in enumerate(ICONS[:8]))
chipsD = ''.join(f'<span style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; border-radius: 999px; padding: 6px 14px 6px 8px; font-size: 14px; font-weight: 700; box-shadow: 0 1px 0 #E6E0D2;">{svg(i,COLD[i],"#1E1B2E",24)}{ICONS[i][0]}</span>' for i in range(6))
open('IconesD.dc.html','w').write(head(FD,'#FBF7EE',fontD,'#1E1B2E','#E2735A') + f'''<div style="width: 1440px; min-height: 900px; background: #FBF7EE; padding: 40px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 22px;">
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <div style="display: inline-flex; background: #1E1B2E; color: #FBF7EE; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; width: max-content;">Iteració · Icones municipals (univers D)</div>
    <h1 style="margin: 0; font-family: {dispD}; font-weight: 900; font-size: 40px; line-height: 1; letter-spacing: -0.02em;">Els mateixos 16 temes, en pastel i amb cara opcional</h1>
    <p style="margin: 0; font-size: 16px; max-width: 900px; line-height: 1.4;">Mateixes formes que a A, però el color és suau (coral, menta, lavanda, préssec) i el detall en tinta violeta. Amb ulls, cada icona es converteix en un veí: així el veïnat de D i el sistema d'icones són la mateixa cosa.</p>
  </div>
  <div style="display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px;">{tilesD}</div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
    <div style="background: #FFFFFF; border-radius: 26px; padding: 22px; display: flex; flex-direction: column; gap: 12px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Variant "amb ulls": icona = veí</div>
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">{tilesD_eyes}</div>
    </div>
    <div style="background: #FFFFFF; border-radius: 26px; padding: 22px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Com s'usen: etiquetes de tema</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">{chipsD}</div>
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680; margin-top: 6px;">Marca de resultat per tema</div>
      <div style="display: flex; align-items: center; gap: 10px; font-size: 14px;">{svg(0,COLD[0],"#1E1B2E",28)}<span style="width: 160px; height: 12px; background: #F1ECE0; border-radius: 6px; overflow: hidden; display: inline-block;"><span style="display: block; width: 82%; height: 100%; background: #1E1B2E; border-radius: 6px;"></span></span><strong style="font-family: {dispD}; font-size: 18px;">82%</strong> en habitatge</div>
    </div>
  </div>
</div>
''' + TAIL)

# ---- phones ----
urnaA = '<svg width="120" height="104" viewBox="0 0 120 110" aria-hidden="true"><rect x="14" y="34" width="92" height="66" rx="16" fill="#E9FF7A"></rect><rect x="40" y="30" width="40" height="8" rx="4" fill="#111111"></rect><circle cx="45" cy="62" r="9" fill="#F6F1E7"></circle><circle cx="75" cy="62" r="9" fill="#F6F1E7"></circle><circle cx="47" cy="63" r="4.5" fill="#111111"></circle><circle cx="77" cy="63" r="4.5" fill="#111111"></circle><path d="M48 82 q12 10 24 0" stroke="#111111" stroke-width="4" fill="none" stroke-linecap="round"></path><rect x="22" y="100" width="76" height="8" rx="4" fill="#111111"></rect></svg>'
urnaA_happy = urnaA.replace('<circle cx="45" cy="62" r="9" fill="#F6F1E7"></circle><circle cx="75" cy="62" r="9" fill="#F6F1E7"></circle><circle cx="47" cy="63" r="4.5" fill="#111111"></circle><circle cx="77" cy="63" r="4.5" fill="#111111"></circle><path d="M48 82 q12 10 24 0" stroke="#111111" stroke-width="4" fill="none" stroke-linecap="round"></path>','<path d="M34 62 q6 -8 12 0 M74 62 q6 -8 12 0" stroke="#111111" stroke-width="4" fill="none" stroke-linecap="round"></path><path d="M46 76 q14 14 28 0z" fill="#111111"></path>').replace('width="120" height="104"','width="96" height="84"')
parties = [("ERC",'#ffb232','#111',78,"ERC-AM"),("ECP",'#662483','#fff',71,"Comuns"),("PSC",'#D00C3C','#fff',64,"PSC"),("JxC",'#00c3b2','#111',52,"Junts"),("CUP",'#ffff00','#111',49,"CUP"),("PP",'#234b90','#fff',31,"PP")]
def rows(track, ink, disp):
    return ''.join(f'<div style="display: flex; align-items: center; gap: 10px;"><span style="width: 28px; height: 28px; border-radius: 50%; background: {c}; color: {fc}; font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center;">{ab}</span><span style="width: 62px; font-size: 13px; font-weight: 700;">{n}</span><span style="flex: 1; height: 14px; background: {track}; border-radius: 7px; overflow: hidden;"><span style="display: block; width: {p}%; height: 100%; background: {ink}; border-radius: 7px;"></span></span><strong style="font-family: {disp}; font-size: 18px; width: 44px; text-align: right;">{p}%</strong></div>' for ab,c,fc,p,n in parties)
themesA = ''.join(f'<span style="display: inline-flex; align-items: center; gap: 6px; background: #FFFFFF; border: 2px solid #111111; border-radius: 999px; padding: 6px 12px 6px 6px; font-size: 13px; font-weight: 700;">{svg(i,COLA[i],inkA(i),22)}{ICONS[i][0]}</span>' for i in [0,1,4,5,3,6])
themeRowsA = ''.join(f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">{svg(i,COLA[i],inkA(i),24)}<span style="flex: 1;">{ICONS[i][0]}</span><strong>{p}%</strong></div>' for i,p in [(0,90),(1,82),(4,60),(3,45)])
open('HomeA.dc.html','w').write(head(FA,'#3B4BF6',fontA,'#111111','#3B4BF6') + f'''<div style="width: 390px; height: 844px; background: #3B4BF6; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
  <div style="padding: 64px 20px 20px; color: #F6F1E7; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: center;"><span style="font-family: {dispA}; font-weight: 800; font-size: 22px;">urna</span><span style="font-size: 12px; font-weight: 700; border: 2px solid #F6F1E7; border-radius: 999px; padding: 4px 10px;">CA · ES · OC</span></div>
    <div style="display: flex; align-items: flex-end; gap: 12px;">{urnaA}
      <div style="display: flex; flex-wrap: wrap; gap: 6px; font-family: {dispA}; font-size: 19px; font-weight: 600;">
        <span style="background: #F6F1E7; color: #111111; border-radius: 999px; padding: 5px 13px;">A qui</span><span style="background: #F6F1E7; color: #111111; border-radius: 999px; padding: 5px 13px;">votes</span><span style="background: #F6F1E7; color: #111111; border-radius: 999px; padding: 5px 13px;">al teu</span><span style="background: #F6F1E7; color: #111111; border-radius: 999px; padding: 5px 13px;">poble</span><span style="background: #E9FF7A; color: #111111; border-radius: 999px; padding: 5px 13px;">?</span>
      </div>
    </div>
    <div style="font-size: 15px; line-height: 1.4; opacity: 0.95;">25 afirmacions sobre el que es decideix de debò al teu municipi. 7 minuts. Res es desa fora del teu mòbil.</div>
  </div>
  <div style="flex: 1; background: #F6F1E7; border-radius: 28px 28px 0 0; padding: 22px 20px; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; align-items: center; gap: 10px; background: #FFFFFF; border: 2px solid #111111; border-radius: 999px; padding: 12px 16px; font-size: 15px; color: #777777;"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="8" cy="8" r="6" fill="none" stroke="#111111" stroke-width="2.5"></circle><path d="M12.5 12.5 l4 4" stroke="#111111" stroke-width="2.5" stroke-linecap="round"></path></svg>Escriu el teu municipi</div>
    <div style="font-size: 13px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px;">Fes servir la meva ubicació</div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555555;">Temes que es voten a Sabadell</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">{themesA}</div>
    </div>
    <div style="background: #FFFFFF; border: 2px solid #111111; border-radius: 18px; padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 12px; font-weight: 700; color: #555555;">Continua on ho vas deixar</span><span style="font-family: {dispA}; font-weight: 700; font-size: 17px;">Sabadell · 14 de 25</span></div>
      <span style="background: #111111; color: #F6F1E7; border-radius: 999px; padding: 10px 16px; font-size: 14px; font-weight: 700;">Continua</span>
    </div>
    <div style="margin-top: auto; display: flex; justify-content: space-between; font-size: 12px; color: #555555;"><span>Falten 270 dies</span><span>Metodologia · Privadesa</span></div>
  </div>
</div>
''' + TAIL)
open('ResultatA.dc.html','w').write(head(FA,'#F6F1E7',fontA,'#111111','#3B4BF6') + f'''<div style="width: 390px; height: 844px; background: #F6F1E7; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
  <div style="background: #E9FF7A; padding: 64px 20px 18px; display: flex; flex-direction: column; gap: 10px;">
    <div style="display: flex; justify-content: space-between; align-items: center;"><span style="font-family: {dispA}; font-weight: 800; font-size: 20px;">urna</span><span style="font-size: 12px; font-weight: 700;">Sabadell · 25/25</span></div>
    <div style="display: flex; align-items: center; gap: 12px;">{urnaA_happy}
      <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-family: {dispA}; font-weight: 800; font-size: 30px; line-height: 1; letter-spacing: -0.02em;">La teva urna</span><span style="font-size: 14px;">Coincideixes més amb <strong>ERC-AM</strong>. On més discrepes: habitatge.</span></div>
    </div>
  </div>
  <div style="flex: 1; padding: 18px 20px 0; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; flex-direction: column; gap: 10px;">{rows('#EDE7DB','#111111',dispA)}</div>
    <div style="display: flex; gap: 6px; font-size: 12px; font-weight: 700;"><span style="background: #111111; color: #F6F1E7; border-radius: 999px; padding: 6px 12px;">Partits</span><span style="border: 2px solid #111111; border-radius: 999px; padding: 4px 12px;">Candidats</span><span style="border: 2px solid #111111; border-radius: 999px; padding: 4px 12px;">Trajectòria</span></div>
    <div style="background: #FFFFFF; border: 2px solid #111111; border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555555;">Amb ERC-AM, per tema</div>
      {themeRowsA}
    </div>
  </div>
  <div style="padding: 12px 16px 28px; display: flex; gap: 8px;">
    <span style="flex: 1; background: #3B4BF6; color: #F6F1E7; border-radius: 999px; padding: 13px; font-size: 14px; font-weight: 700; text-align: center;">Compartir</span>
    <span style="flex: 1; border: 2px solid #111111; border-radius: 999px; padding: 11px; font-size: 14px; font-weight: 700; text-align: center;">Comparar afirmacions</span>
  </div>
</div>
''' + TAIL)
cast = ''.join(svg(i,COLD[i],'#1E1B2E',64, eyesD) for i in [0,1,5,14,3])
themesD = ''.join(f'<span style="display: inline-flex; align-items: center; gap: 6px; background: #FFFFFF; border-radius: 999px; padding: 6px 12px 6px 6px; font-size: 13px; font-weight: 700; box-shadow: 0 1px 0 #E6E0D2;">{svg(i,COLD[i],"#1E1B2E",22)}{ICONS[i][0]}</span>' for i in [0,1,4,5,3,6])
themeRowsD = ''.join(f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">{svg(i,COLD[i],"#1E1B2E",26, eyesD)}<span style="flex: 1;">{ICONS[i][0]}</span><strong>{p}%</strong></div>' for i,p in [(0,90),(1,82),(4,60),(3,45)])
open('HomeD.dc.html','w').write(head(FD,'#FBF7EE',fontD,'#1E1B2E','#E2735A') + f'''<div style="width: 390px; height: 844px; background: #FBF7EE; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
  <div style="padding: 64px 20px 0; display: flex; flex-direction: column; gap: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: center;"><span style="font-family: {dispD}; font-weight: 900; font-size: 22px;">voto</span><span style="font-size: 12px; font-weight: 700; background: #FFFFFF; border-radius: 999px; padding: 5px 10px; box-shadow: 0 1px 0 #E6E0D2;">CA · ES · OC</span></div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">{cast}</div>
    <div style="font-family: {dispD}; font-weight: 900; font-size: 34px; line-height: 1.02; letter-spacing: -0.02em; text-wrap: pretty;">Tot el poble té alguna cosa a dir-te.</div>
    <div style="font-size: 15px; line-height: 1.4; color: #6B6680;">25 afirmacions sobre el que es decideix al teu municipi, explicades pels seus veïns. 7 minuts, sense registre.</div>
  </div>
  <div style="flex: 1; padding: 18px 20px 0; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 999px; padding: 13px 16px; font-size: 15px; color: #9A95AA; box-shadow: 0 1px 0 #E6E0D2;"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="8" cy="8" r="6" fill="none" stroke="#1E1B2E" stroke-width="2.5"></circle><path d="M12.5 12.5 l4 4" stroke="#1E1B2E" stroke-width="2.5" stroke-linecap="round"></path></svg>Escriu el teu municipi</div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Temes que es voten a Sabadell</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">{themesD}</div>
    </div>
    <div style="background: #C9C4F2; border-radius: 20px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 12px; font-weight: 700; color: #3E3670;">Continua on ho vas deixar</span><span style="font-family: {dispD}; font-weight: 700; font-size: 17px;">Sabadell · 14 de 25</span></div>
      <span style="background: #1E1B2E; color: #FBF7EE; border-radius: 999px; padding: 10px 16px; font-size: 14px; font-weight: 700;">Continua</span>
    </div>
  </div>
  <div style="padding: 12px 20px 28px;"><span style="display: block; background: #E2735A; color: #FBF7EE; border-radius: 999px; padding: 15px; font-size: 16px; font-weight: 800; text-align: center;">Comença el test</span></div>
</div>
''' + TAIL)
open('ResultatD.dc.html','w').write(head(FD,'#FBF7EE',fontD,'#1E1B2E','#E2735A') + f'''<div style="width: 390px; height: 844px; background: #FBF7EE; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
  <div style="padding: 64px 20px 0; display: flex; flex-direction: column; gap: 10px;">
    <div style="display: flex; justify-content: space-between; align-items: center;"><span style="font-family: {dispD}; font-weight: 900; font-size: 20px;">voto</span><span style="font-size: 12px; font-weight: 700; color: #6B6680;">Sabadell · 25/25</span></div>
    <div style="display: flex; align-items: center; justify-content: center; position: relative; height: 160px;">
      <svg width="160" height="160" viewBox="0 0 170 170" style="position: absolute;"><circle cx="85" cy="85" r="70" fill="none" stroke="#F1ECE0" stroke-width="22"></circle><path d="M85 15 a70 70 0 1 1 -68.8 56.9" fill="none" stroke="#E2735A" stroke-width="22" stroke-linecap="round"></path></svg>
      <div style="text-align: center;"><div style="font-family: {dispD}; font-weight: 900; font-size: 46px; line-height: 1;">78%</div><div style="font-size: 13px; color: #6B6680;">amb ERC-AM</div></div>
    </div>
    <div style="font-size: 14px; text-align: center; color: #6B6680;">On més discrepes: <strong style="color: #1E1B2E;">habitatge</strong>. El bloc de pisos t'ho explica.</div>
  </div>
  <div style="flex: 1; padding: 12px 20px 0; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; flex-direction: column; gap: 9px;">{rows('#F1ECE0','#1E1B2E',dispD)}</div>
    <div style="background: #FFFFFF; border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 0 #E6E0D2;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B6680;">Per tema, amb ERC-AM</div>
      {themeRowsD}
    </div>
  </div>
  <div style="padding: 8px 16px 28px; display: flex; gap: 8px;">
    <span style="flex: 1; background: #1E1B2E; color: #FBF7EE; border-radius: 999px; padding: 13px; font-size: 14px; font-weight: 700; text-align: center;">Compartir</span>
    <span style="flex: 1; background: #BFE8D2; border-radius: 999px; padding: 13px; font-size: 14px; font-weight: 700; text-align: center;">Comparar</span>
  </div>
</div>
''' + TAIL)
print("generated")
