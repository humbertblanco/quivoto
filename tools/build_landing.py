#!/usr/bin/env python3
"""Genera la landing de quivoto (ca) i quienvoto (es) a web/public/.

    python3 tools/build_landing.py

Font única: tools/icons_lib.py (icones + mascota). No cal cap dependència.
"""
import os, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icons_lib as L

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'public')

T = {
 'ca': {
  'lang':'ca','marca':'quivoto','domini':'quivoto.cat','altra':'Castellano','altra_url':'https://quienvoto.es','altra_lang':'es',
  'micro':'Municipals · 23 de maig de 2027',
  'xifres':[('25','afirmacions del teu municipi'),('7','minuts'),('200','municipis, per començar'),('0','comptes i contrasenyes')],
  'parada_titol':'Això és el que es decideix al teu ajuntament',
  'parada_text':'Setze temes que no surten als debats de la tele i que decideixen com és el carrer on vius. A quivoto cadascun té el seu veí, i és ell qui et pregunta.',
  'exemple_etiqueta':'Sabadell · Mobilitat',
  'exemple_afirmacio':'La Gran Via ha de perdre un carril de cotxes per fer-hi carril bici i voreres més amples.',
  'exemple_context':'Es va votar al ple del març de 2025: el govern hi va votar en contra; ERC, Comuns i CUP, a favor.',
  'exemple_titol':'Una pregunta de veritat, no una enquesta',
  'exemple_text':'Cada afirmació surt d’una cosa que ha passat al teu poble: una moció, un pressupost, un pla urbanístic. Respons amb la cara que et vagi, i si un tema t’importa molt, el marques.',
  'exemple_peu':'Exemple. Les afirmacions reals les publicarem municipi per municipi.',
  'title':'quivoto — A qui votes al teu poble?',
  'desc':'La brúixola electoral de les municipals del 23 de maig de 2027. Respon 25 afirmacions sobre el teu municipi i descobreix quins partits i candidats pensen com tu.',
  'aviat':'Aviat',
  'h1':'A qui votes<br>al teu poble?',
  'entrada':'Les municipals no van de sigles: van de si es tanca un carril, de si puja l’IBI, de si es compren pisos. <strong>quivoto</strong> et fa 25 preguntes sobre el teu municipi i et diu qui pensa com tu.',
  'compte':'Falten {dies} dies per al 23 de maig de 2027',
  'form_titol':'Avisa’m quan la meva ciutat estigui llesta',
  'form_sub':'Un sol correu quan obrim el teu municipi. Res més, i te’n pots donar de baixa quan vulguis.',
  'email_ph':'El teu correu','muni_ph':'El teu municipi (opcional)',
  'consent':'Accepto rebre un avís quan quivoto obri el meu municipi i he llegit la <a href="/privadesa.html">política de privadesa</a>.',
  'boto':'Avisa’m','boto_ok':'Fet! Ens veiem aviat.','boto_error':'No ha funcionat. Torna-ho a provar.',
  'que_titol':'Què és quivoto',
  'que':[('25 afirmacions del teu poble','Res de preguntes genèriques sobre Europa. Parlem del carril bici de la teva avinguda, del pressupost de la teva escola, de la taxa d’escombraries que pagues tu.'),
         ('La posició de cada partit, amb proves','No ens creiem el que diuen els programes: mirem què han votat al ple, què van prometre el 2023 i què han dit a la premsa. Cada posició porta la seva font.'),
         ('Els candidats, un per un','Qui encapçala cada llista, què ha fet abans, què ha votat i en què es desmarca del seu propi partit.')],
  'com_titol':'Com funciona',
  'com':[('Tries el teu municipi','Comencem pels 200 més poblats i anem ampliant.'),
         ('Respons 25 afirmacions','Set minuts. Pots marcar les que més t’importen i saltar les que no.'),
         ('Veus qui pensa com tu','Percentatge amb cada partit i cada candidat, i on discrepeu.'),
         ('Ho comproves tu mateix','Cada posició enllaça a l’acta del ple, al programa o a la notícia.')],
  'escala':'Molt en desacord · Més aviat no · Ni sí ni no · Més aviat sí · Molt d’acord',
  'veinat_titol':'Tot el poble té alguna cosa a dir-te',
  'veinat_sub':'Cada tema municipal té el seu veí. Et parlen ells, no un formulari.',
  'dif_titol':'Per què no és una enquesta més',
  'dif':[('Els partits responen, i si no responen també es veu','Convidem cada candidatura a contestar el mateix qüestionari. Qui no contesta, surt marcat com a “no ha respost”.'),
         ('Diem què han dit i què han fet','Si el que un partit contesta no quadra amb el que va votar al ple, ho ensenyem tot dos.'),
         ('Les teves respostes no surten del teu mòbil','No hi ha comptes ni perfils. El càlcul es fa al teu navegador.'),
         ('Independent','Sense finançament de cap partit ni de cap administració. Metodologia pública i oberta a crítica.')],
  'qui_titol':'Qui hi ha al darrere',
  'qui':'Un projecte independent fet a Catalunya. Encara som pocs: si ets periodista local, treballes amb dades obertes o vols ajudar amb el teu municipi, escriu-nos.',
  'contacte':'hola@quivoto.cat',
  'peu_legal':'Avís legal','peu_priv':'Privadesa','peu_metod':'Metodologia (aviat)',
  'peu':'quivoto — brúixola electoral de les municipals 2027. Un projecte de Damos en el Blanco, S.L.',
  'gracies_h':'Fet!','gracies_p':'T’avisarem quan obrim el teu municipi. Mentrestant, ja pots tancar aquesta pestanya.','gracies_torna':'Tornar a l’inici',
 },
 'es': {
  'lang':'es','marca':'quienvoto','domini':'quienvoto.es','altra':'Català','altra_url':'https://quivoto.cat','altra_lang':'ca',
  'micro':'Municipales · 23 de mayo de 2027',
  'xifres':[('25','afirmaciones de tu municipio'),('7','minutos'),('200','municipios, para empezar'),('0','cuentas y contraseñas')],
  'parada_titol':'Esto es lo que se decide en tu ayuntamiento',
  'parada_text':'Dieciséis temas que no salen en los debates de la tele y que deciden cómo es la calle donde vives. En quienvoto cada uno tiene su vecino, y es él quien te pregunta.',
  'exemple_etiqueta':'Sabadell · Movilidad',
  'exemple_afirmacio':'La Gran Via debe perder un carril de coches para hacer carril bici y aceras más anchas.',
  'exemple_context':'Se votó en el pleno de marzo de 2025: el gobierno votó en contra; ERC, Comuns y CUP, a favor.',
  'exemple_titol':'Una pregunta de verdad, no una encuesta',
  'exemple_text':'Cada afirmación sale de algo que ha pasado en tu pueblo: una moción, un presupuesto, un plan urbanístico. Respondes con la cara que te encaje, y si un tema te importa mucho, lo marcas.',
  'exemple_peu':'Ejemplo. Las afirmaciones reales las publicaremos municipio a municipio.',
  'title':'quienvoto — ¿A quién votas en tu pueblo?',
  'desc':'La brújula electoral de las municipales del 23 de mayo de 2027. Responde 25 afirmaciones sobre tu municipio y descubre qué partidos y candidatos piensan como tú.',
  'aviat':'Pronto',
  'h1':'¿A quién votas<br>en tu pueblo?',
  'entrada':'Las municipales no van de siglas: van de si se quita un carril, de si sube el IBI, de si se compran pisos. <strong>quienvoto</strong> te hace 25 preguntas sobre tu municipio y te dice quién piensa como tú.',
  'compte':'Faltan {dies} días para el 23 de mayo de 2027',
  'form_titol':'Avísame cuando mi ciudad esté lista',
  'form_sub':'Un solo correo cuando abramos tu municipio. Nada más, y puedes darte de baja cuando quieras.',
  'email_ph':'Tu correo','muni_ph':'Tu municipio (opcional)',
  'consent':'Acepto recibir un aviso cuando quienvoto abra mi municipio y he leído la <a href="/privadesa.html">política de privacidad</a>.',
  'boto':'Avísame','boto_ok':'¡Hecho! Nos vemos pronto.','boto_error':'No ha funcionado. Inténtalo otra vez.',
  'que_titol':'Qué es quienvoto',
  'que':[('25 afirmaciones de tu pueblo','Nada de preguntas genéricas sobre Europa. Hablamos del carril bici de tu avenida, del presupuesto de tu escuela, de la tasa de basuras que pagas tú.'),
         ('La posición de cada partido, con pruebas','No nos creemos lo que dicen los programas: miramos qué han votado en el pleno, qué prometieron en 2023 y qué han dicho en prensa. Cada posición lleva su fuente.'),
         ('Los candidatos, uno a uno','Quién encabeza cada lista, qué ha hecho antes, qué ha votado y en qué se desmarca de su propio partido.')],
  'com_titol':'Cómo funciona',
  'com':[('Eliges tu municipio','Empezamos por los 200 más poblados y vamos ampliando.'),
         ('Respondes 25 afirmaciones','Siete minutos. Puedes marcar las que más te importan y saltar las que no.'),
         ('Ves quién piensa como tú','Porcentaje con cada partido y cada candidato, y dónde discrepáis.'),
         ('Lo compruebas tú mismo','Cada posición enlaza al acta del pleno, al programa o a la noticia.')],
  'escala':'Muy en desacuerdo · Más bien no · Ni sí ni no · Más bien sí · Muy de acuerdo',
  'veinat_titol':'Todo el pueblo tiene algo que decirte',
  'veinat_sub':'Cada tema municipal tiene su vecino. Te hablan ellos, no un formulario.',
  'dif_titol':'Por qué no es una encuesta más',
  'dif':[('Los partidos responden, y si no responden también se ve','Invitamos a cada candidatura a contestar el mismo cuestionario. Quien no contesta, aparece marcado como “no ha respondido”.'),
         ('Decimos qué han dicho y qué han hecho','Si lo que un partido contesta no cuadra con lo que votó en el pleno, lo enseñamos todo.'),
         ('Tus respuestas no salen de tu móvil','No hay cuentas ni perfiles. El cálculo se hace en tu navegador.'),
         ('Independiente','Sin financiación de ningún partido ni administración. Metodología pública y abierta a crítica.')],
  'qui_titol':'Quién hay detrás',
  'qui':'Un proyecto independiente hecho en Cataluña. Todavía somos pocos: si eres periodista local, trabajas con datos abiertos o quieres ayudar con tu municipio, escríbenos.',
  'contacte':'hola@quivoto.cat',
  'peu_legal':'Aviso legal','peu_priv':'Privacidad','peu_metod':'Metodología (pronto)',
  'peu':'quienvoto — brújula electoral de las municipales 2027. Un proyecto de Damos en el Blanco, S.L.',
  'gracies_h':'¡Hecho!','gracies_p':'Te avisaremos cuando abramos tu municipio. Mientras, ya puedes cerrar esta pestaña.','gracies_torna':'Volver al inicio',
 },
}

def wordmark(t, size=30):
    """El nom amb la 'o' final dibuixada com la papereta. Per sota de 64 px, 'o' normal."""
    stem = t['marca'][:-1]
    if size < 64:
        return f'<span class="marca" style="font-size:{size}px">{t["marca"]}</span>'
    cara = L.cara_marca(sclera=L.WHITE)
    o = (f'<svg class="marca-o" width="{size}" height="{size}" viewBox="0 0 48 48" aria-hidden="true">'
         f'<circle cx="24" cy="24" r="22" fill="{L.WHITE}" stroke="{L.INK}" stroke-width="3"/>'
         f'<path d="M34 8 l6 6" stroke="{L.PEACH}" stroke-width="6" stroke-linecap="round"/>{cara}</svg>')
    return f'<span class="marca" style="font-size:{size}px">{stem}{o}</span>'


def xifres(t):
    return '\n'.join(
      f'      <div class="xifra"><b>{n}</b><span>{lab}</span></div>' for n, lab in t['xifres'])

def parada(t):
    """El veïnat com una cinta d'adhesius, cada un amb la seva inclinació."""
    angles = [-4, 3, -2, 5, -3, 2, -5, 4, -2, 3, -4, 2, -3, 5, -2, 4]
    return '\n'.join(
      f'      <li style="--gir: {angles[i]}deg; --retard: {(i%7)*0.9:.1f}s">'
      f'{L.icon(i, 58, with_face=True, delay=(i%7)*0.9)}<span>{L.ICONS[i][0]}</span></li>'
      for i in range(16))

def llista_editorial(items):
    return '\n'.join(
      f'      <li><h3>{h}</h3><p>{p}</p></li>' for h, p in items)

def passos(items):
    return '\n'.join(
      f'      <li><b>{i+1}</b><div><h3>{h}</h3><p>{p}</p></div></li>'
      for i, (h, p) in enumerate(items))

def cards(items, cls):
    return '\n'.join(
      f'    <article class="{cls}"><h3>{h}</h3><p>{p}</p></article>' for h, p in items)

def steps(items):
    return '\n'.join(
      f'    <li><span class="num">{i+1}</span><div><h3>{h}</h3><p>{p}</p></div></li>'
      for i, (h, p) in enumerate(items))

def veinat():
    out = []
    for i, (label, *_rest) in enumerate(L.ICONS):
        out.append(f'    <li class="vei">{L.icon(i, 64, with_face=True, delay=(i%7)*0.9)}'
                   f'<span>{label}</span></li>')
    return '\n'.join(out)

def escala():
    """Les cinc cares de l'escala, dibuixades amb la mateixa mascota."""
    boques = [
      f'<path d="M20 34 q4 -3 8 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M14 20 l5 3 M34 20 l-5 3" stroke="{L.INK}" stroke-width="2.2" stroke-linecap="round"/>',
      f'<path d="M20 33 q4 -2 8 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      f'<path d="M20 32 h8" stroke="{L.INK}" stroke-width="2.2" stroke-linecap="round"/>',
      f'<path d="M20 30 q4 3 8 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      f'<path d="M19 29 q5 6 10 0 z" fill="{L.INK}"/><path d="M15 21 q3 -4 6 0 M27 21 q3 -4 6 0" stroke="{L.INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    ]
    cols = [L.CORAL, L.PEACH, L.PAPER, L.MINT, L.MINT]
    out = []
    for n, (b, c) in enumerate(zip(boques, cols)):
        ulls = '' if n in (0, 4) else (
          f'<circle cx="19" cy="23" r="2.4" fill="{L.INK}"/><circle cx="29" cy="23" r="2.4" fill="{L.INK}"/>')
        out.append(f'<svg class="cara-escala" width="56" height="56" viewBox="0 0 48 48" aria-hidden="true">'
                   f'<circle cx="24" cy="24" r="22" fill="{c}" stroke="{L.INK}" stroke-width="2.5"/>{ulls}{b}</svg>')
    return '\n      '.join(out)

PAGE = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://{domini}/">
<link rel="alternate" hreflang="ca" href="https://quivoto.cat/">
<link rel="alternate" hreflang="es" href="https://quienvoto.es/">
<link rel="alternate" hreflang="x-default" href="https://quivoto.cat/">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://{domini}/">
<meta property="og:image" content="https://{domini}/assets/og.png">
<meta property="og:locale" content="{lang}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBF7EE">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"WebSite","name":"{marca}","url":"https://{domini}/","inLanguage":"{lang}","description":"{desc}","publisher":{{"@type":"Organization","name":"Damos en el Blanco, S.L."}}}}
</script>
</head>
<body>
<a class="salta" href="#contingut">Vés al contingut</a>

<header class="capcalera">
  <a class="logo" href="/">{wordmark_petit}</a>
  <nav>
    <span class="aviat">{aviat}</span>
    <a href="{altra_url}" hreflang="{altra_lang}" class="idioma">{altra}</a>
  </nav>
</header>

<main id="contingut">

<section class="hero">
  <p class="micro">{micro}</p>
  <h1>{h1}</h1>
  <div class="hero-cos">
    <div>
      <p class="entrada">{entrada}</p>
      <form class="form-rapid" method="post" action="/api/subscribe.php" novalidate data-idioma="{lang}">
        <input type="hidden" name="lang" value="{lang}">
        <div class="ocult" aria-hidden="true"><label>No omplis això <input type="text" name="rebost" tabindex="-1" autocomplete="off"></label></div>
        <label class="nomes-lectors" for="email-rapid">{email_ph}</label>
        <div class="fila">
          <input id="email-rapid" type="email" name="email" required autocomplete="email" placeholder="{email_ph}" inputmode="email">
          <button type="submit" class="boto">{boto}</button>
        </div>
        <label class="consent"><input type="checkbox" name="consent" required> <span>{consent}</span></label>
        <p class="resposta" role="status" aria-live="polite"></p>
      </form>
    </div>
    <div class="hero-mascota">
      {mascota}
      <span class="segell" id="compte" data-plantilla="{compte_tpl}">{compte}</span>
    </div>
  </div>
</section>

<section class="xifres-banda">
  <div class="cinta">
{xifres}
  </div>
</section>

<section class="parada">
  <div class="parada-text">
    <h2>{parada_titol}</h2>
    <p>{parada_text}</p>
  </div>
  <ul class="veinat-cinta">
{veinat_items}
  </ul>
</section>

<section class="exemple">
  <div class="exemple-carta">
    <article class="carta-afirmacio">
      <p class="etiqueta-muni">{exemple_etiqueta}</p>
      <p class="afirmacio">{exemple_afirmacio}</p>
      <div class="cares">
        {escala_cares}
      </div>
      <p class="escala-text">{escala}</p>
      <p class="evidencia">{exemple_context}</p>
    </article>
    <p class="peu-exemple">{exemple_peu}</p>
  </div>
  <div class="exemple-text">
    <h2>{exemple_titol}</h2>
    <p>{exemple_text}</p>
    <ol class="passos">
{com_steps}
    </ol>
  </div>
</section>

<section class="dif">
  <h2>{dif_titol}</h2>
  <ul class="editorial">
{dif_items}
  </ul>
</section>

<section class="final" id="avisam">
  <div class="final-cos">
    <h2>{form_titol}</h2>
    <p class="sub">{form_sub}</p>
    <form id="form-avis" method="post" action="/api/subscribe.php" novalidate data-idioma="{lang}">
      <input type="hidden" name="lang" value="{lang}">
      <div class="ocult" aria-hidden="true"><label>No omplis això <input type="text" name="rebost" tabindex="-1" autocomplete="off"></label></div>
      <div class="camps">
        <label class="camp"><span class="etiqueta">{email_ph}</span>
          <input type="email" name="email" required autocomplete="email" placeholder="nom@correu.cat" inputmode="email"></label>
        <label class="camp"><span class="etiqueta">{muni_ph}</span>
          <input type="text" name="municipi" autocomplete="address-level2" placeholder="Sabadell" maxlength="120"></label>
      </div>
      <label class="consent"><input type="checkbox" name="consent" required> <span>{consent}</span></label>
      <button type="submit" class="boto boto-clar">{boto}</button>
      <p class="resposta" role="status" aria-live="polite"></p>
    </form>
  </div>
  <div class="final-mascota">{mascota_petita}</div>
</section>

<section class="qui">
  <h2>{qui_titol}</h2>
  <p>{qui}</p>
  <p><a class="correu" href="mailto:{contacte}">{contacte}</a></p>
</section>

</main>

<footer class="peu">
  <p>{peu}</p>
  <nav><a href="/avis-legal.html">{peu_legal}</a> · <a href="/privadesa.html">{peu_priv}</a> · <span>{peu_metod}</span></nav>
</footer>

<script src="/assets/app.js" defer></script>
</body>
</html>
'''

GRACIES = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{gracies_h} — {marca}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="pagina-simple">
<main>
  {mascota}
  <h1>{gracies_h}</h1>
  <p>{gracies_p}</p>
  <p><a class="boto" href="/">{gracies_torna}</a></p>
</main>
</body>
</html>
'''

LEGAL = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titol} — {marca}</title>
<meta name="description" content="{titol} de {marca}.">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
<header class="capcalera"><a class="logo" href="/">{wordmark_petit}</a></header>
<main id="contingut" class="document">
<h1>{titol}</h1>
{cos}
<p class="tornar"><a class="boto-secundari" href="/">{tornar}</a></p>
</main>
<footer class="peu"><p>{peu}</p></footer>
</body>
</html>
'''

PRIVADESA = {
 'ca': ("Política de privadesa", "Tornar a l'inici", """
<p class="lead">Aquesta pàgina només recull una cosa: el teu correu, si ens el dones, per avisar-te quan obrim el teu municipi. Res més.</p>
<h2>Qui és el responsable</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Quines dades tractem i per què</h2>
<ul>
<li><strong>Correu electrònic</strong> (obligatori): per enviar-te un únic avís quan la brúixola del teu municipi estigui disponible.</li>
<li><strong>Municipi</strong> (opcional): per saber per on començar i per avisar-te en el moment adequat.</li>
<li><strong>Idioma</strong>: per escriure’t en la llengua en què ens has escrit.</li>
<li><strong>Empremta tècnica</strong>: un hash irreversible de la teva adreça IP amb sal diària i el nom del navegador, només per aturar enviaments automatitzats. No desem la IP.</li>
</ul>
<h2>Base legal</h2>
<p>El teu consentiment exprés (art. 6.1.a del RGPD), que dones marcant la casella del formulari i que pots retirar quan vulguis.</p>
<h2>Quant de temps</h2>
<p>Fins que et donis de baixa o, com a molt tard, el 31 de desembre de 2027. Després esborrem la llista sencera.</p>
<h2>Amb qui les compartim</h2>
<p>Amb ningú. No hi ha analítica de tercers, ni píxels, ni xarxes socials incrustades. Les tipografies es serveixen des d’aquest mateix domini, o sigui que la teva visita no arriba a cap altra empresa. Les dades es desen un servidor d’OVH SAS a França (Unió Europea), gestionat per estic.online.</p>
<h2>Cookies</h2>
<p>Cap. Aquesta web no en posa.</p>
<h2>Els teus drets</h2>
<p>Pots demanar accés, rectificació, supressió, oposició, limitació i portabilitat escrivint a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>. Per donar-te de baixa a l’instant, fes servir l’enllaç de qualsevol correu que t’enviem. Si creus que no t’hem atès bé, pots reclamar a l’<a href="https://apdcat.gencat.cat">Autoritat Catalana de Protecció de Dades</a>.</p>
<p class="peu-doc">Darrera actualització: 26 d’agost de 2026.</p>
"""),
 'es': ("Política de privacidad", "Volver al inicio", """
<p class="lead">Esta página solo recoge una cosa: tu correo, si nos lo das, para avisarte cuando abramos tu municipio. Nada más.</p>
<h2>Quién es el responsable</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Qué datos tratamos y para qué</h2>
<ul>
<li><strong>Correo electrónico</strong> (obligatorio): para enviarte un único aviso cuando la brújula de tu municipio esté disponible.</li>
<li><strong>Municipio</strong> (opcional): para saber por dónde empezar y avisarte en el momento adecuado.</li>
<li><strong>Idioma</strong>: para escribirte en la lengua en que nos has escrito.</li>
<li><strong>Huella técnica</strong>: un hash irreversible de tu dirección IP con sal diaria y el nombre del navegador, solo para frenar envíos automatizados. No guardamos la IP.</li>
</ul>
<h2>Base legal</h2>
<p>Tu consentimiento expreso (art. 6.1.a del RGPD), que das marcando la casilla del formulario y que puedes retirar cuando quieras.</p>
<h2>Cuánto tiempo</h2>
<p>Hasta que te des de baja o, como muy tarde, el 31 de diciembre de 2027. Después borramos la lista entera.</p>
<h2>Con quién los compartimos</h2>
<p>Con nadie. No hay analítica de terceros, ni píxeles, ni redes sociales incrustadas. Las tipografías se sirven desde este mismo dominio, así que tu visita no llega a ninguna otra empresa. Los datos se guardan un servidor de OVH SAS en Francia (Unión Europea), gestionado por estic.online.</p>
<h2>Cookies</h2>
<p>Ninguna. Esta web no pone.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>. Para darte de baja al instante, usa el enlace de cualquier correo que te enviemos. Si crees que no te hemos atendido bien, puedes reclamar ante la <a href="https://www.aepd.es">Agencia Española de Protección de Datos</a>.</p>
<p class="peu-doc">Última actualización: 26 de agosto de 2026.</p>
"""),
}

AVIS = {
 'ca': ("Avís legal", "Tornar a l'inici", """
<p class="lead">{marca} és un projecte independent de <strong>Damos en el Blanco, S.L.</strong> que prepara una brúixola electoral per a les eleccions municipals del 23 de maig de 2027.</p>
<h2>Titular</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Independència</h2>
<p>No rebem finançament de cap partit polític, candidatura ni administració. No fem campanya per ningú: la nostra feina és ensenyar-te on és cada partit i amb quines proves ho diem, perquè decideixis tu.</p>
<h2>Dades de tercers</h2>
<p>Farem servir dades obertes de la Generalitat de Catalunya, l’Idescat, el Consorci AOC, les diputacions i els ajuntaments, sempre citant-ne la font i la data. Les fotografies de càrrecs i candidats s’identificaran amb el seu autor i llicència.</p>
<h2>Responsabilitat</h2>
<p>Posem molta cura a comprovar cada dada, però una brúixola electoral no és un consell de vot ni un oracle: és una eina d’orientació. Si hi trobes un error, escriu-nos i el corregirem, i deixarem constància del canvi.</p>
<h2>Propietat intel·lectual</h2>
<p>El disseny, els textos i les il·lustracions són de Damos en el Blanco, S.L. La metodologia i el codi es publicaran obertament.</p>
<h2>Llei aplicable</h2>
<p>Aquest avís es regeix per la legislació espanyola i europea.</p>
<p class="peu-doc">Darrera actualització: 26 d’agost de 2026.</p>
"""),
 'es': ("Aviso legal", "Volver al inicio", """
<p class="lead">{marca} es un proyecto independiente de <strong>Damos en el Blanco, S.L.</strong> que prepara una brújula electoral para las elecciones municipales del 23 de mayo de 2027.</p>
<h2>Titular</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Independencia</h2>
<p>No recibimos financiación de ningún partido, candidatura ni administración. No hacemos campaña por nadie: nuestro trabajo es enseñarte dónde está cada partido y con qué pruebas lo decimos, para que decidas tú.</p>
<h2>Datos de terceros</h2>
<p>Usaremos datos abiertos de la Generalitat de Catalunya, el Idescat, el Consorci AOC, las diputaciones y los ayuntamientos, citando siempre fuente y fecha. Las fotografías de cargos y candidatos se identificarán con su autor y licencia.</p>
<h2>Responsabilidad</h2>
<p>Ponemos mucho cuidado en comprobar cada dato, pero una brújula electoral no es un consejo de voto ni un oráculo: es una herramienta de orientación. Si encuentras un error, escríbenos y lo corregiremos, dejando constancia del cambio.</p>
<h2>Propiedad intelectual</h2>
<p>El diseño, los textos y las ilustraciones son de Damos en el Blanco, S.L. La metodología y el código se publicarán abiertamente.</p>
<h2>Ley aplicable</h2>
<p>Este aviso se rige por la legislación española y europea.</p>
<p class="peu-doc">Última actualización: 26 de agosto de 2026.</p>
"""),
}


def build_legal(lang):
    t = T[lang]
    sub = OUT if lang == 'ca' else os.path.join(OUT, 'es')
    for nom, taula in (('privadesa', PRIVADESA), ('avis-legal', AVIS)):
        titol, tornar, cos = taula[lang]
        pagina = LEGAL.format(lang=t['lang'], marca=t['marca'], titol=titol, tornar=tornar,
                              wordmark_petit=wordmark(t, 30), peu=t['peu'],
                              cos=cos.replace('{marca}', t['marca']))
        open(os.path.join(sub, nom + '.html'), 'w', encoding='utf-8').write(pagina)


def dies_restants():
    import datetime
    return (datetime.date(2027, 5, 23) - datetime.date.today()).days

def build(lang):
    t = dict(T[lang])
    d = dies_restants()
    ctx = dict(t)
    ctx['compte_tpl'] = html.escape(t['compte'], quote=True)
    ctx['compte'] = t['compte'].format(dies=d)
    ctx['wordmark_petit'] = wordmark(t, 30)
    ctx['mascota'] = L.papereta(210)
    ctx['dif_items'] = llista_editorial(t['dif'])
    ctx['com_steps'] = passos(t['com'])
    ctx['veinat_items'] = parada(t)
    ctx['escala_cares'] = escala()
    ctx['xifres'] = xifres(t)
    ctx['mascota_petita'] = L.papereta(150)
    page = PAGE.format(**ctx)
    grac = GRACIES.format(**{**ctx, 'mascota': L.papereta(150)})
    sub = OUT if lang == 'ca' else os.path.join(OUT, 'es')
    os.makedirs(sub, exist_ok=True)
    open(os.path.join(sub, 'index.html'), 'w', encoding='utf-8').write(page)
    open(os.path.join(sub, 'gracies.html'), 'w', encoding='utf-8').write(grac)
    return len(page)

if __name__ == '__main__':
    for lg in ('ca', 'es'):
        n = build(lg)
        build_legal(lg)
        print(f'  web/public/{"" if lg=="ca" else "es/"}index.html  ({n//1024} kB)')
    print('Landing generada. Dies fins al 23-05-2027:', dies_restants())
