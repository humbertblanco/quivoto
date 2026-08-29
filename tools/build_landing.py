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
  'exemple_titol':'Prova-ho aquí mateix',
  'exemple_text':'Cinc afirmacions de veritat del ple de Badalona. Respon amb la cara que et vagi i et diem amb quin grup del ple coincideixes. Cada afirmació surt d’un punt votat: una moció, unes ordenances, una modificació de pressupost.',
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
  'obs_url':'/observatori/',
  'obs_micro':'Això ja ho pots obrir avui',
  'obs_titol':'La brúixola és el 2027. L’Observatori ja hi és',
  'obs_text':'Qui mana al teu poble i amb qui, què s’hi ha votat des del 1979, com estan els comptes i què paga cadascú: els 947 municipis de Catalunya, un per un. Tot fet amb dades obertes i càlculs que qualsevol pot repetir —cap model de llenguatge pel mig— i cada xifra amb la seva font al costat.',
  'obs_xifres':[('947','fitxes municipals'),('2.626','pàgines de candidatura'),('43','comarques'),('1.894','fitxers de dades')],
  'obs_reixa':[
    ('els947.html','tot Catalunya','Els 947',
     'Tots els municipis en una llista, amb cercador i filtres: on hi va haver pacte, on ha canviat l’alcaldia a mig mandat, on mana sempre la mateixa força, on no hi ha oposició.'),
    ('m/esplugues-de-llobregat/','una per municipi','La fitxa d’un poble',
     'Qui mana i amb qui, el ple amb nom i cognoms, les dotze eleccions des del 1979, els comptes, els impostos, i què en sabem i què no.'),
    ('comparador/','costat a costat','El comparador',
     'Fins a quatre municipis mesurats amb la mateixa vara: deute, despesa per habitant, impostos, participació i fragmentació del ple.'),
    ('c/barcelones/','43 comarques','Qui mana a la comarca',
     'Quantes alcaldies té cada força, com queda cada municipi respecte de la mitjana comarcal i on són les excepcions.'),
    ('dades/','obertes','Baixa’t les dades',
     '1.894 fitxers en CSV i JSON, amb l’esquema documentat camp a camp i la font de cada xifra. Perquè ens puguis comprovar i reutilitzar.'),
    ('preguntes/','demostració','Les preguntes',
     'Les 25 preguntes que farà la brúixola, escrites llegint les actes del ple. Set municipis, i ja es poden respondre.'),
  ],
  'obs_boto':'Obre l’Observatori',
  'obs_nota':'Gratuït, sense registre i sense cookies. És un esborrany: hi treballem a la vista de tothom i encara no està revisat del tot.',
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
  'peu_legal':'Avís legal','peu_priv':'Privadesa','peu_metod':'Metodologia (aviat)','peu_obs':'Observatori',
  'peu':'quivoto — brúixola electoral de les municipals 2027. Un projecte de Damos en el Blanco, S.L.',
  'gracies_h':'Fet!','gracies_p':'T’avisarem quan obrim el teu municipi. Mentrestant, ja pots tancar aquesta pestanya.','gracies_torna':'Tornar a l’inici',
 },
 'es': {
  'lang':'es','marca':'quienvoto','domini':'quienvoto.es','altra':'Català','altra_url':'https://quivoto.cat','altra_lang':'ca',
  'micro':'Municipales · 23 de mayo de 2027',
  'xifres':[('25','afirmaciones de tu municipio'),('7','minutos'),('200','municipios, para empezar'),('0','cuentas y contraseñas')],
  'parada_titol':'Esto es lo que se decide en tu ayuntamiento',
  'parada_text':'Dieciséis temas que no salen en los debates de la tele y que deciden cómo es la calle donde vives. En quienvoto cada uno tiene su vecino, y es él quien te pregunta.',
  'exemple_titol':'Pruébalo aquí mismo',
  'exemple_text':'Cinco afirmaciones de verdad del pleno de Badalona. Responde con la cara que te encaje y te decimos con qué grupo del pleno coincides. Cada afirmación sale de un punto votado: una moción, unas ordenanzas, una modificación de presupuesto.',
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
  'obs_url':'https://quivoto.cat/observatori/',
  'obs_micro':'Esto ya lo puedes abrir hoy',
  'obs_titol':'La brújula es en 2027. El Observatorio ya está',
  'obs_text':'Quién manda en tu pueblo y con quién, qué se ha votado desde 1979, cómo están las cuentas y qué paga cada cual: los 947 municipios de Cataluña, uno a uno. Todo hecho con datos abiertos y cálculos que cualquiera puede repetir —ningún modelo de lenguaje de por medio— y cada cifra con su fuente al lado.',
  'obs_xifres':[('947','fichas municipales'),('2.626','páginas de candidatura'),('43','comarcas'),('1.894','ficheros de datos')],
  'obs_reixa':[
    ('els947.html','toda Cataluña','Los 947',
     'Todos los municipios en una lista, con buscador y filtros: dónde hubo pacto, dónde ha cambiado la alcaldía a mitad de mandato, dónde manda siempre la misma fuerza, dónde no hay oposición.'),
    ('m/esplugues-de-llobregat/','una por municipio','La ficha de un pueblo',
     'Quién manda y con quién, el pleno con nombres y apellidos, las doce elecciones desde 1979, las cuentas, los impuestos, y qué sabemos y qué no.'),
    ('comparador/','lado a lado','El comparador',
     'Hasta cuatro municipios medidos con la misma vara: deuda, gasto por habitante, impuestos, participación y fragmentación del pleno.'),
    ('c/barcelones/','43 comarcas','Quién manda en la comarca',
     'Cuántas alcaldías tiene cada fuerza, cómo queda cada municipio respecto de la media comarcal y dónde están las excepciones.'),
    ('dades/','abiertos','Descarga los datos',
     '1.894 ficheros en CSV y JSON, con el esquema documentado campo a campo y la fuente de cada cifra. Para que puedas comprobarnos y reutilizarlos.'),
    ('preguntes/','demostración','Las preguntas',
     'Las 25 preguntas que hará la brújula, escritas leyendo las actas del pleno. Siete municipios, y ya se pueden responder.'),
  ],
  'obs_boto':'Abre el Observatorio',
  'obs_nota':'Gratuito, sin registro y sin cookies. Las fichas están en catalán, que es la lengua de las fuentes oficiales. Es un borrador: trabajamos a la vista de todos y todavía no está revisado del todo.',
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
  'peu_legal':'Aviso legal','peu_priv':'Privacidad','peu_metod':'Metodología (pronto)','peu_obs':'Observatorio',
  'peu':'quienvoto — brújula electoral de las municipales 2027. Un proyecto de Damos en el Blanco, S.L.',
  'gracies_h':'¡Hecho!','gracies_p':'Te avisaremos cuando abramos tu municipio. Mientras, ya puedes cerrar esta pestaña.','gracies_torna':'Volver al inicio',
 },
}

# ---------------------------------------------------------------------------
# La demostració jugable de la portada.
#
# Són cinc afirmacions REALS de Badalona, copiades de
# web/public/observatori/preguntes/badalona/prova/, i les posicions dels grups
# són les que allà es dedueixen del vot al ple. No són inventades ni d'exemple.
#
# Cinc, i no tres: el test complet no dóna percentatge a un grup amb menys de
# cinc afirmacions situades (MINIM = 5 a la pàgina de prova). Si aquí en
# poséssim menys i tot i així ensenyéssim un número, ens contradiríem.
#
# Les cinc triades són les úniques del bloc en què es pot situar els cinc grups
# alhora; si algun dia canvia la lectura de les actes, s'han de tornar a copiar
# d'allà, no reescriure de memòria.
#
# L'ordre de 'p' és el de 'grups'. L'escala va de -2 a 2.
PROVA = {
 'ca': {
  'muni':'Badalona',
  'grup_label':'Què en penses',
  'avis':'<b>Demostració.</b> Afirmacions reals del ple, però <b>encara sense validar</b>: mira’n l’evidència abans de fer-ne cas.',
  'compte':'Afirmació {n} de {t}',
  'sense_js':'Necessites JavaScript per respondre-hi aquí. També pots fer la demostració sencera a l’Observatori.',
  'privadesa':'Les teves respostes es queden al navegador. No se n’envia cap enlloc.',
  'resultat':'Amb qui coincideixes',
  'ningu':'No has respost cap afirmació.',
  'la_teva':'Tu:','el_ple':'Al ple:','acta':'l’acta',
  'detall':'Mira què es va votar a cada punt',
  'peu_nota':'Aquestes posicions no són el que el partit <em>diu</em> que pensa: es dedueixen del seu vot al ple. Un partit pot votar en contra d’una moció per qui la presenta i no pel que hi diu. El 2027 seran les candidatures qui responguin, i llavors es podran comparar les dues coses.',
  'peu_mes':'Cinc afirmacions és el mínim que ens posem per donar un número. A Badalona n’hi ha vint-i-cinc, i de moment set municipis en tenen.',
  'boto':'Fes les 25 de Badalona',
  'altres':'Els altres sis municipis',
  'torna':'Torna a començar',
  'grups':[
    ('Partit Popular','18 regidors · govern'),
    ('PSC-CP','4 regidors'),
    ('Esquerra Republicana','2 regidors'),
    ('Badalona En Comú Podem','2 regidors'),
    ('Guanyem Badalona','1 regidor'),
  ],
  'preguntes':[
   {'tema':'Fiscalitat',
    't':'L’Ajuntament ha de congelar el tipus de l’impost sobre béns immobles durant tot el proper mandat.',
    'ple':'Ple del 27-10-2025: s’aprova apujar un 2,4% els tipus de l’IBI per al 2026, amb 17 vots a favor (PP) i 9 en contra (PSC, ERC, BeCP i Guanyem).',
    'u':'https://media.seu-e.cat/acteca/801550006/2025/64b00b33-64ad-43a1-b1e0-2c42b8ca9dfe/Acta_15_Ple_27-10-2025.pdf',
    'p':[-2, 2, 2, 2, 2]},
   {'tema':'Habitatge',
    't':'L’Ajuntament ha de prohibir els habitatges d’ús turístic a tot el terme municipal.',
    'ple':'Ple del 02-03-2026: la moció per prohibir-los a tota la ciutat a partir de l’octubre del 2028 es rebutja amb 9 vots a favor i 18 en contra.',
    'u':'https://media.seu-e.cat/acteca/801550006/2026/6fb28919-82bb-4720-9c22-769aae94dcf8/ACTA_04_Ple_02-03-2026.pdf',
    'p':[-2, 2, 2, 2, 2]},
   {'tema':'Seguretat',
    't':'L’Ajuntament ha d’ampliar la xarxa de càmeres de videovigilància als carrers de la ciutat.',
    'ple':'Ple del 02-06-2025: modificació de pressupost de 12.000.000 € per a la xarxa de videovigilància, aprovada amb 22 vots a favor (PP i PSC) i 5 en contra (ERC, BeCP i Guanyem), amb informe desfavorable de la intervenció.',
    'u':'https://media.seu-e.cat/acteca/801550006/2025/b671500a-56cc-44e2-ae1b-2109148680c4/Acta_07_Ple_02-06-2025.pdf',
    'p':[2, 2, -2, -2, -2]},
   {'tema':'Seguretat',
    't':'L’Ajuntament ha de convertir la Guàrdia Urbana en una policia de barri i de proximitat.',
    'ple':'Ple del 02-02-2026: la moció per un nou model de seguretat urbana basat en la proximitat es rebutja amb 9 vots a favor i 18 en contra.',
    'u':'https://media.seu-e.cat/acteca/801550006/2026/51f8b74c-9fac-4d36-8aed-0ae3b19e3ece/ACTA_03_Ple_02-02-2026.pdf',
    'p':[-2, 2, 2, 2, 2]},
   {'tema':'Cultura',
    't':'L’Ajuntament ha de garantir que totes les biblioteques municipals obrin tot l’any.',
    'ple':'Ple del 19-01-2026: la moció per la reobertura de les biblioteques de Can Casacuberta, Llefià i Sant Roc es rebutja amb 9 vots a favor i 18 en contra.',
    'u':'https://media.seu-e.cat/acteca/801550006/2026/041dcf67-5f41-4a30-9252-680e65776fdd/ACTA_02_Ple_19-01-2026.pdf',
    'p':[-2, 2, 2, 2, 2]},
  ],
 },
 'es': {
  'muni':'Badalona',
  'grup_label':'Qué opinas',
  'avis':'<b>Demostración.</b> Afirmaciones reales del pleno, pero <b>todavía sin validar</b>: mira la evidencia antes de hacerles caso.',
  'compte':'Afirmación {n} de {t}',
  'sense_js':'Necesitas JavaScript para responder aquí. También puedes hacer la demostración entera en el Observatorio.',
  'privadesa':'Tus respuestas se quedan en el navegador. No se envía ninguna a ninguna parte.',
  'resultat':'Con quién coincides',
  'ningu':'No has respondido ninguna afirmación.',
  'la_teva':'Tú:','el_ple':'En el pleno:','acta':'el acta',
  'detall':'Mira qué se votó en cada punto',
  'peu_nota':'Estas posiciones no son lo que el partido <em>dice</em> que piensa: se deducen de su voto en el pleno. Un partido puede votar en contra de una moción por quien la presenta y no por lo que dice. En 2027 serán las candidaturas quienes respondan, y entonces se podrán comparar las dos cosas.',
  'peu_mes':'Cinco afirmaciones es el mínimo que nos ponemos para dar un número. En Badalona hay veinticinco, y de momento siete municipios las tienen. La demostración completa está en catalán, que es la lengua de las actas.',
  'boto':'Haz las 25 de Badalona',
  'altres':'Los otros seis municipios',
  'torna':'Empezar de nuevo',
  'grups':[
    ('Partit Popular','18 concejales · gobierno'),
    ('PSC-CP','4 concejales'),
    ('Esquerra Republicana','2 concejales'),
    ('Badalona En Comú Podem','2 concejales'),
    ('Guanyem Badalona','1 concejal'),
  ],
  'preguntes':[
   {'tema':'Fiscalidad',
    't':'El Ayuntamiento debe congelar el tipo del impuesto sobre bienes inmuebles durante todo el próximo mandato.',
    'ple':'Pleno del 27-10-2025: se aprueba subir un 2,4% los tipos del IBI para 2026, con 17 votos a favor (PP) y 9 en contra (PSC, ERC, BeCP y Guanyem).',
    'u':'https://media.seu-e.cat/acteca/801550006/2025/64b00b33-64ad-43a1-b1e0-2c42b8ca9dfe/Acta_15_Ple_27-10-2025.pdf',
    'p':[-2, 2, 2, 2, 2]},
   {'tema':'Vivienda',
    't':'El Ayuntamiento debe prohibir las viviendas de uso turístico en todo el término municipal.',
    'ple':'Pleno del 02-03-2026: la moción para prohibirlas en toda la ciudad a partir de octubre de 2028 se rechaza con 9 votos a favor y 18 en contra.',
    'u':'https://media.seu-e.cat/acteca/801550006/2026/6fb28919-82bb-4720-9c22-769aae94dcf8/ACTA_04_Ple_02-03-2026.pdf',
    'p':[-2, 2, 2, 2, 2]},
   {'tema':'Seguridad',
    't':'El Ayuntamiento debe ampliar la red de cámaras de videovigilancia en las calles de la ciudad.',
    'ple':'Pleno del 02-06-2025: modificación de presupuesto de 12.000.000 € para la red de videovigilancia, aprobada con 22 votos a favor (PP y PSC) y 5 en contra (ERC, BeCP y Guanyem), con informe desfavorable de la intervención.',
    'u':'https://media.seu-e.cat/acteca/801550006/2025/b671500a-56cc-44e2-ae1b-2109148680c4/Acta_07_Ple_02-06-2025.pdf',
    'p':[2, 2, -2, -2, -2]},
   {'tema':'Seguridad',
    't':'El Ayuntamiento debe convertir la Guardia Urbana en una policía de barrio y de proximidad.',
    'ple':'Pleno del 02-02-2026: la moción por un nuevo modelo de seguridad urbana basado en la proximidad se rechaza con 9 votos a favor y 18 en contra.',
    'u':'https://media.seu-e.cat/acteca/801550006/2026/51f8b74c-9fac-4d36-8aed-0ae3b19e3ece/ACTA_03_Ple_02-02-2026.pdf',
    'p':[-2, 2, 2, 2, 2]},
   {'tema':'Cultura',
    't':'El Ayuntamiento debe garantizar que todas las bibliotecas municipales abran todo el año.',
    'ple':'Pleno del 19-01-2026: la moción para la reapertura de las bibliotecas de Can Casacuberta, Llefià y Sant Roc se rechaza con 9 votos a favor y 18 en contra.',
    'u':'https://media.seu-e.cat/acteca/801550006/2026/041dcf67-5f41-4a30-9252-680e65776fdd/ACTA_02_Ple_19-01-2026.pdf',
    'p':[-2, 2, 2, 2, 2]},
  ],
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

def obs_xifres(t):
    return '\n'.join(
      f'      <li><b>{n}</b><span>{lab}</span></li>' for n, lab in t['obs_xifres'])

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
    return out


def obs_reixa(t):
    """Les portes de l'Observatori. Cada targeta és una cosa que ja existeix."""
    base = t['obs_url']
    return '\n'.join(
      f'      <li><a href="{base}{u}"><span class="obs-etiqueta">{et}</span>'
      f'<b>{tit}</b><span class="obs-txt">{txt}</span></a></li>'
      for u, et, tit, txt in t['obs_reixa'])


def escala_botons(t):
    """Les mateixes cinc cares, però clicables. L'escala va de -2 a 2."""
    etiquetes = [e.strip() for e in t['escala'].split('·')]
    return '\n        '.join(
      f'<button type="button" class="cara-boto" data-v="{i-2}">'
      f'{cara}<span class="nomes-lectors">{etiquetes[i]}</span></button>'
      for i, cara in enumerate(escala()))


def prova_html(t):
    """La demostració jugable: cinc afirmacions reals i el resultat.

    Sense JavaScript es veu la primera afirmació sencera, com abans, i un
    enllaç a la demostració completa. Amb JavaScript, es pot respondre.
    """
    import json
    p = PROVA[t['lang']]
    dades = json.dumps({
      'q': [{'t': q['t'], 'tema': q['tema'], 'ple': q['ple'], 'u': q['u'], 'p': q['p']}
            for q in p['preguntes']],
      'g': [{'nom': n, 'sub': s} for n, s in p['grups']],
      'txt': {k: p[k] for k in ('compte', 'resultat', 'ningu', 'la_teva', 'el_ple',
                                'acta', 'detall', 'peu_nota', 'peu_mes', 'boto',
                                'altres', 'torna', 'privadesa')},
      'escala': [e.strip() for e in t['escala'].split('·')],
      'boto_url': t['obs_url'] + 'preguntes/badalona/prova/',
      'altres_url': t['obs_url'] + 'preguntes/',
    }, ensure_ascii=False).replace('</', '<\\/')
    primera = p['preguntes'][0]
    return f'''<div class="prova" id="prova">
      <p class="prova-avis">{p['avis']}</p>
      <div class="prova-barra" role="presentation"><i id="prova-progres" style="width:0%"></i></div>
      <article class="carta-afirmacio" id="prova-carta">
        <p class="etiqueta-muni">{p['muni']} · <span id="prova-tema">{primera['tema']}</span></p>
        <p class="afirmacio" id="prova-text" aria-live="polite">{primera['t']}</p>
        <div class="cares" id="prova-cares" role="group" aria-label="{p['grup_label']}">
        {escala_botons(t)}
        </div>
        <p class="escala-text">{t['escala']}</p>
      </article>
      <div class="prova-fet" id="prova-fet" hidden aria-live="polite"></div>
      <p class="peu-exemple" id="prova-peu">{p['compte'].format(n=1, t=len(p['preguntes']))} · {p['privadesa']}</p>
      <noscript><p class="peu-exemple">{p['sense_js']}
        <a href="{t['obs_url']}preguntes/badalona/prova/">{p['boto']} →</a></p></noscript>
    </div>
    <script id="prova-dades" type="application/json">{dades}</script>
    <script>{PROVA_JS}</script>'''

CSS_EXTRA = '''<style>
/* ---------- Observatori: el que ja es pot obrir avui ---------- */
.observatori{background:var(--menta);border-top:2.5px solid var(--ink);border-bottom:2.5px solid var(--ink);padding:var(--e5) var(--e3)}
.obs-cos{max-width:var(--ample);margin:0 auto}
.observatori .micro{color:var(--ink)}
.observatori h2{max-width:20ch;margin-bottom:var(--e2)}
.obs-entrada{font-size:1.12rem;max-width:56ch}
.obs-xifres{list-style:none;margin:var(--e3) 0 0;padding:0;
  display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(135px,1fr))}
.obs-xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:3px 3px 0 var(--ink);padding:var(--e2)}
.obs-xifres b{display:block;font-family:var(--display);font-weight:900;line-height:.95;
  letter-spacing:-.04em;font-size:clamp(1.8rem,4.5vw,2.7rem)}
.obs-xifres span{font-size:.85rem;color:var(--ink-suau)}

.obs-reixa{list-style:none;margin:var(--e3) 0 0;padding:0;
  display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.obs-reixa a{display:block;height:100%;padding:var(--e2);text-decoration:none;
  background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);
  box-shadow:4px 4px 0 var(--ink);transition:transform .14s ease,box-shadow .14s ease}
.obs-reixa a:hover,.obs-reixa a:focus-visible{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
.obs-etiqueta{display:inline-block;background:var(--presec);border-radius:var(--r-max);
  padding:4px 11px;font-size:.66rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.obs-reixa b{display:block;font-family:var(--display);font-weight:900;letter-spacing:-.02em;
  font-size:1.3rem;line-height:1.05;margin:10px 0 5px}
.obs-txt{display:block;font-size:.9rem;line-height:1.45;color:var(--ink-suau)}
@media(min-width:820px){.obs-reixa{grid-template-columns:repeat(3,1fr)}}
.obs-accions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2);margin:var(--e3) 0 0}
.obs-nota{margin:var(--e2) 0 0;font-size:.9rem;color:var(--ink-suau);max-width:52ch}

/* ---------- la demostració jugable ----------------------------------------
   Les afirmacions són reals i encara no estan validades. L'avís va a dalt de
   tot i amb el mateix pes visual que la resta: no és lletra petita. */
.exemple{align-items:start}
.prova-avis{margin:0 0 var(--e2);font-size:.84rem;line-height:1.45;
  background:var(--presec);color:var(--ink);border:2.5px solid var(--ink);border-radius:var(--r-m);
  padding:11px 15px;box-shadow:3px 3px 0 var(--ink)}
.prova-barra{height:12px;border:2.5px solid var(--ink);border-radius:var(--r-max);
  background:var(--paper-2);overflow:hidden;margin:0 0 var(--e3)}
.prova-barra i{display:block;height:100%;background:var(--ink);transition:width .25s ease}
#prova-text{min-height:3.5em}
.cara-boto{flex:1 1 0;min-width:0;background:none;border:0;padding:2px;margin:0;
  cursor:pointer;line-height:0;border-radius:var(--r-max);transition:transform .12s ease}
.cara-boto .cara-escala{width:100%;height:auto;max-width:80px;display:block;margin:0 auto}
.cara-boto:hover{transform:translateY(-5px)}
.cara-boto:active{transform:translateY(0)}

.prova-fet{background:var(--paper-2);border:3px solid var(--ink);border-radius:var(--r-l);
  padding:var(--e3);box-shadow:8px 8px 0 var(--menta);transform:rotate(.7deg)}
.prova-titol{font-size:1.35rem;margin:0 0 var(--e3)}
.prova-grups{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:14px}
.prova-grups li{display:grid;gap:3px}
.prova-cap{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:10px;
  font-size:.9rem;font-weight:800;line-height:1.2}
.prova-sub{font-size:.72rem;font-weight:700;color:var(--ink-suau);margin-bottom:3px}
.prova-pct{font-family:var(--display);font-weight:900;font-size:1.15rem;letter-spacing:-.03em}
.prova-bar{display:block;height:14px;border:2.5px solid var(--ink);border-radius:var(--r-max);
  background:var(--paper);overflow:hidden}
.prova-bar i{display:block;height:100%;background:var(--lavanda)}
.prova-grups li.cap .prova-bar i{background:var(--coral)}
.prova-nota,.prova-mes{font-size:.84rem;line-height:1.5;color:var(--ink-suau);margin:0 0 var(--e2)}
.prova-detall{border-top:2px dashed var(--vora);border-bottom:2px dashed var(--vora);
  padding:var(--e2) 0;margin:0 0 var(--e2)}
.prova-detall summary{cursor:pointer;font-weight:800;font-size:.88rem}
.prova-detall ol{margin:var(--e2) 0 0;padding-left:1.15rem;display:grid;gap:var(--e2)}
.prova-detall li{font-size:.82rem;line-height:1.45}
.prova-detall b{display:block;font-weight:800;margin-bottom:4px}
.prova-teva,.prova-ple{display:block;color:var(--ink-suau)}
.prova-accions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e2);margin:0}
.prova-altres{font-weight:800;font-size:.88rem}
.prova-torna{background:none;border:0;padding:0;font:inherit;font-size:.88rem;font-weight:800;
  color:var(--ink-suau);text-decoration:underline;cursor:pointer}
@media(prefers-reduced-motion:reduce){
  .obs-reixa a,.cara-boto,.prova-barra i{transition:none}
}
</style>'''

# El motor de la demostració. Sense dependències i sense res que surti del
# navegador: les respostes no es desen ni s'envien enlloc.
#
# La fórmula de coincidència és la mateixa que a la pàgina de prova de
# l'Observatori (distància de Manhattan sobre −2..2). Si allà canvia, aquí
# també. Aquí no hi ha "això m'importa molt", així que tots els pesos són 1.
PROVA_JS = r'''
(function () {
  var arrel = document.getElementById('prova');
  var caixa = document.getElementById('prova-dades');
  if (!arrel || !caixa || !document.querySelector) return;
  var D; try { D = JSON.parse(caixa.textContent); } catch (e) { return; }
  var Q = D.q, G = D.g, T = D.txt;

  var carta = document.getElementById('prova-carta');
  var fet = document.getElementById('prova-fet');
  var peu = document.getElementById('prova-peu');
  var progres = document.getElementById('prova-progres');
  var tema = document.getElementById('prova-tema');
  var text = document.getElementById('prova-text');
  var cares = document.getElementById('prova-cares');
  if (!carta || !fet || !cares) return;

  var i = 0, respostes = [];

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function compte(n) { return T.compte.replace('{n}', n).replace('{t}', Q.length); }

  function pinta() {
    tema.textContent = Q[i].tema;
    text.textContent = Q[i].t;
    progres.style.width = Math.round(100 * i / Q.length) + '%';
    peu.textContent = compte(i + 1) + ' · ' + T.privadesa;
  }

  function coincidencia(n) {
    var num = 0, den = 0;
    for (var k = 0; k < Q.length; k++) {
      var r = respostes[k], p = Q[k].p[n];
      if (r === undefined || p === null || p === undefined) continue;
      num += 4 - Math.abs(r - p);
      den += 4;
    }
    return den === 0 ? null : Math.max(0, Math.min(100, Math.round(100 * num / den)));
  }

  function acaba() {
    progres.style.width = '100%';
    carta.hidden = true;
    peu.hidden = true;

    var res = [];
    for (var n = 0; n < G.length; n++) {
      var pct = coincidencia(n);
      if (pct !== null) res.push({ nom: G[n].nom, sub: G[n].sub, pct: pct });
    }
    res.sort(function (a, b) { return b.pct - a.pct; });

    var h = '<h3 class="prova-titol">' + esc(T.resultat) + '</h3>';
    if (!res.length) {
      h += '<p>' + esc(T.ningu) + '</p>';
    } else {
      h += '<ul class="prova-grups">';
      for (var j = 0; j < res.length; j++) {
        h += '<li' + (res[j].pct === res[0].pct ? ' class="cap"' : '') + '>' +
             '<span class="prova-cap"><span>' + esc(res[j].nom) + '</span>' +
             '<span class="prova-pct">' + res[j].pct + ' %</span></span>' +
             '<span class="prova-sub">' + esc(res[j].sub) + '</span>' +
             '<span class="prova-bar"><i style="width:' + res[j].pct + '%"></i></span></li>';
      }
      h += '</ul>';
    }
    h += '<p class="prova-nota">' + T.peu_nota + '</p>';
    h += '<details class="prova-detall"><summary>' + esc(T.detall) + '</summary><ol>';
    for (var k = 0; k < Q.length; k++) {
      var r = respostes[k];
      h += '<li><b>' + esc(Q[k].t) + '</b>' +
           '<span class="prova-teva">' + esc(T.la_teva) + ' ' +
           esc(r === undefined ? '—' : D.escala[r + 2]) + '</span>' +
           '<span class="prova-ple">' + esc(T.el_ple) + ' ' + esc(Q[k].ple) + ' ' +
           '<a href="' + Q[k].u + '" target="_blank" rel="nofollow noopener">' +
           esc(T.acta) + ' ↗</a></span></li>';
    }
    h += '</ol></details>';
    h += '<p class="prova-mes">' + esc(T.peu_mes) + '</p>';
    h += '<p class="prova-accions">' +
         '<a class="boto" href="' + D.boto_url + '">' + esc(T.boto) + ' →</a>' +
         '<a class="prova-altres" href="' + D.altres_url + '">' + esc(T.altres) + '</a>' +
         '<button type="button" class="prova-torna" id="prova-torna">' + esc(T.torna) + '</button></p>';

    fet.innerHTML = h;
    fet.hidden = false;
    var torna = document.getElementById('prova-torna');
    if (torna) torna.addEventListener('click', function () {
      i = 0; respostes = [];
      fet.hidden = true; fet.innerHTML = '';
      carta.hidden = false; peu.hidden = false;
      pinta();
      var b = cares.querySelector('button'); if (b) b.focus();
    });
  }

  cares.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('button[data-v]') : null;
    if (!b) return;
    respostes[i] = Number(b.getAttribute('data-v'));
    i += 1;
    if (i >= Q.length) acaba(); else pinta();
  });
})();
'''

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
{estil_extra}
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

<section class="observatori">
  <div class="obs-cos">
    <p class="micro">{obs_micro}</p>
    <h2>{obs_titol}</h2>
    <p class="obs-entrada">{obs_text}</p>
    <ul class="obs-xifres">
{obs_xifres_items}
    </ul>
    <ul class="obs-reixa">
{obs_reixa_items}
    </ul>
    <p class="obs-accions"><a class="boto" href="{obs_url}">{obs_boto} →</a></p>
    <p class="obs-nota">{obs_nota}</p>
  </div>
</section>

<section class="exemple" id="prova-seccio">
  <div class="exemple-carta">
    {prova}
  </div>
  <div class="exemple-text">
    <h2>{exemple_titol}</h2>
    <p>{exemple_text}</p>
    <ol class="passos">
{com_steps}
    </ol>
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
  <nav><a href="{obs_url}">{peu_obs}</a> · <a href="/avis-legal.html">{peu_legal}</a> · <a href="/privadesa.html">{peu_priv}</a> · <span>{peu_metod}</span></nav>
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

# Els terminis de resposta (72 h d'acusament, 7 dies per a un error de dada, 72 h per a
# retirar una foto, 30 dies per a la resta) són una PROPOSTA nostra, no una obligació legal:
# només els 30 dies surten de l'art. 12.3 del RGPD. Si algun dia no els podem sostenir,
# s'han de baixar aquí i a la versió castellana alhora, no prometre'n uns que no complim.
FONTS_CA = """
<h2>D’on surten les dades</h2>
<p>Res del que publiquem és una dada que haguem recollit nosaltres. Tot ve de conjunts de dades obertes que qualsevol pot descarregar, i cada fitxa diu de quin conjunt surt cada bloc i de quin any són les xifres.</p>
<ul>
<li><strong>Generalitat de Catalunya</strong> — <a href="https://analisi.transparenciacatalunya.cat">dades obertes</a>: càrrecs electes dels ens locals (Secretaria de Governs Locals i de Relacions amb l’Aran), historial d’alcaldies 1979-2027 i liquidacions dels pressupostos locals. <a href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies">Llicència oberta d’ús d’informació — Catalunya</a>, que obliga a citar la font, a dir-ne la data d’actualització i a no desnaturalitzar-ne el sentit.</li>
<li><strong>Consorci AOC</strong> — <a href="https://dadesobertes.seu-e.cat">dadesobertes.seu-e.cat</a>: resultats electorals de 1979 a 2023, càrrecs electes, liquidacions, endeutament, període mitjà de pagament a proveïdors, padró, tipus impositius, cost efectiu dels serveis i emplenament dels portals de transparència. Els conjunts d’abast català, que són els que fem servir, són <a href="https://creativecommons.org/publicdomain/zero/1.0/deed.ca">CC0 1.0</a>. Al mateix portal hi ha conjunts publicats per un sol ajuntament amb altres llicències, algunes no comercials: aquests no els fem servir.</li>
<li><strong>Síndic de Greuges</strong> — <a href="https://www.sindic.cat">sindic.cat</a>: el cens d’ajuntaments sense regidors de l’oposició, publicat com a CC0 al portal de l’AOC.</li>
<li><strong>Ministeri d’Hisenda</strong> — <a href="https://www.hacienda.gob.es/es-ES/Areas%20Tematicas/Administracion%20Electronica/OVEELL/Paginas/DeudaViva.aspx">Oficina Virtual per a la Coordinació Financera amb les Entitats Locals</a>: deute viu i cost efectiu dels serveis, que ens arriben redistribuïts pel portal de l’AOC. Reutilització segons les condicions generals del <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2011-17560">Reial decret 1495/2011</a>: citar la font i la data, i no alterar el contingut.</li>
</ul>
<p>Si una font no cobreix un municipi, la fitxa ho diu en comptes d’omplir el forat.</p>
"""

FONTS_ES = """
<h2>De dónde salen los datos</h2>
<p>Nada de lo que publicamos es un dato recogido por nosotros. Todo viene de conjuntos de datos abiertos que cualquiera puede descargar, y cada ficha dice de qué conjunto sale cada bloque y de qué año son las cifras.</p>
<ul>
<li><strong>Generalitat de Catalunya</strong> — <a href="https://analisi.transparenciacatalunya.cat">datos abiertos</a>: cargos electos de los entes locales (Secretaria de Governs Locals i de Relacions amb l’Aran), historial de alcaldías 1979-2027 y liquidaciones de los presupuestos locales. <a href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies">Licencia abierta de uso de información — Cataluña</a>, que obliga a citar la fuente, a indicar su fecha de actualización y a no desnaturalizar su sentido.</li>
<li><strong>Consorci AOC</strong> — <a href="https://dadesobertes.seu-e.cat">dadesobertes.seu-e.cat</a>: resultados electorales de 1979 a 2023, cargos electos, liquidaciones, endeudamiento, periodo medio de pago a proveedores, padrón, tipos impositivos, coste efectivo de los servicios y cumplimentación de los portales de transparencia. Los conjuntos de ámbito catalán, que son los que usamos, son <a href="https://creativecommons.org/publicdomain/zero/1.0/deed.ca">CC0 1.0</a>. En el mismo portal hay conjuntos publicados por un solo ayuntamiento con otras licencias, algunas no comerciales: esos no los usamos.</li>
<li><strong>Síndic de Greuges</strong> — <a href="https://www.sindic.cat">sindic.cat</a>: el censo de ayuntamientos sin concejales de la oposición, publicado como CC0 en el portal de la AOC.</li>
<li><strong>Ministerio de Hacienda</strong> — <a href="https://www.hacienda.gob.es/es-ES/Areas%20Tematicas/Administracion%20Electronica/OVEELL/Paginas/DeudaViva.aspx">Oficina Virtual para la Coordinación Financiera con las Entidades Locales</a>: deuda viva y coste efectivo de los servicios, que nos llegan redistribuidos por el portal de la AOC. Reutilización según las condiciones generales del <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2011-17560">Real Decreto 1495/2011</a>: citar la fuente y la fecha, y no alterar el contenido.</li>
</ul>
<p>Si una fuente no cubre un municipio, la ficha lo dice en vez de rellenar el hueco.</p>
"""

PRIVADESA = {
 'ca': ("Política de privadesa", "Tornar a l'inici", """
<p class="lead">D’aquesta web només en surt una dada teva: el correu, si ens el dones, per avisar-te quan obrim el teu municipi. A part d’això, a l’<a href="/observatori/">Observatori</a> hi publiquem dades de càrrecs electes que ja són públiques, i aquí t’expliquem exactament quines, per què podem fer-ho i com demanar-ne la correcció o la retirada.</p>
<h2>Qui és el responsable</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Quines dades teves tractem i per què</h2>
<ul>
<li><strong>Correu electrònic</strong> (obligatori): per enviar-te un únic avís quan la brúixola del teu municipi estigui disponible.</li>
<li><strong>Municipi</strong> (opcional): per saber per on començar i per avisar-te en el moment adequat.</li>
<li><strong>Idioma</strong>: per escriure’t en la llengua en què ens has escrit.</li>
<li><strong>Empremta tècnica</strong>: un hash irreversible de la teva adreça IP amb sal diària i el nom del navegador, només per aturar enviaments automatitzats. No desem la IP.</li>
</ul>
<p>Consultar l’Observatori no demana res de tot això: s’hi entra sense registre, sense compte i sense cookies.</p>
<h2>Base legal de la llista d’espera</h2>
<p>El teu consentiment exprés (art. 6.1.a del RGPD), que dones marcant la casella del formulari i que pots retirar quan vulguis.</p>
<h2>Les dades dels càrrecs electes</h2>
<p>A l’Observatori hi publiquem les persones que ocupen o han ocupat un càrrec electe als 947 ajuntaments de Catalunya. No som nosaltres qui les fa públiques: surten de conjunts de dades obertes publicats per la Generalitat de Catalunya i pel Consorci AOC, que qualsevol pot descarregar avui mateix.</p>
<p><strong>Base legal:</strong> el compliment d’una missió d’interès públic (art. 6.1.e del RGPD), lligat a la publicitat activa que la Llei 19/2014, de transparència, accés a la informació pública i bon govern, imposa als ajuntaments sobre els seus càrrecs electes, i a la ponderació entre transparència i protecció de dades que fa el seu article 15. La informació es refereix només a l’exercici d’un càrrec públic representatiu, no a la vida privada de ningú.</p>
<p><strong>Què publiquem, exactament:</strong> nom i cognoms, càrrec (alcaldia, tinença d’alcaldia, regidoria), candidatura o grup pel qual la persona va ser escollida, i mandat, és a dir el municipi i la legislatura. I, quan l’ajuntament l’hagi publicada al seu portal de transparència, la <strong>fotografia oficial del càrrec</strong>: la reproduïm en mida petita, citant sempre l’ajuntament que la publica i amb enllaç a la fitxa original. No en tenim de tothom —només una part dels ajuntaments les publiquen— i la fitxa funciona igual sense. No hi posem cap fotografia que no hagi publicat abans la mateixa administració, i les retirem a la primera petició de la persona, sense demanar-ne el motiu. Res més.</p>
<p><strong>Què no publiquem:</strong> cap adreça de correu —encara que la font en porti, la descartem quan ingerim les dades—, cap adreça postal, cap telèfon, cap data de naixement, cap dada patrimonial, cap dada de salut, ideologia, afiliació sindical, religió ni orientació sexual, i cap dada que no derivi directament del càrrec. Tampoc publiquem res de persones que no hagin estat mai càrrec electe, ni cap fotografia de ningú que no ocupi el càrrec ara mateix, ni els logotips dels grups polítics, que tenen l’ús reservat.</p>
<h2>Rectificació i retirada</h2>
<p>Si ets o has estat càrrec electe i alguna cosa que publiquem sobre tu és errònia o incompleta, o vols que la retirem, escriu-nos a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a> indicant el municipi i el mandat. Per demanar que retirem la teva fotografia no has de donar cap motiu: la traiem i prou.</p>
<ul>
<li><strong>Acusem recepció en 72 hores</strong> des que ens escrius, i et diem qui porta el cas.</li>
<li><strong>Un error de dada evident</strong> —un nom mal escrit, un càrrec canviat, una candidatura equivocada— el corregim <strong>en 7 dies naturals</strong>.</li>
<li><strong>Una fotografia la retirem en 72 hores</strong>, sense demanar-te motius i sense discutir-ho.</li>
<li><strong>La resta de peticions</strong> (supressió, oposició, limitació) les resolem <strong>en un màxim de 30 dies naturals</strong>, el termini de l’art. 12.3 del RGPD. Si el cas és complex t’avisem i el podem allargar dos mesos més, com preveu el mateix article, però t’haurem dit per què.</li>
<li><strong>Deixem constància del canvi</strong>: cada correcció queda anotada a la fitxa del municipi amb la data.</li>
</ul>
<p>Si l’error ve de la font —de la Generalitat o de l’AOC—, te’n direm quin conjunt és i el corregirem igualment a la nostra publicació, però la correcció definitiva l’ha de fer qui publica l’original.</p>
<h2>Quant de temps</h2>
<p>El teu correu, fins que et donis de baixa o, com a molt tard, el 31 de desembre de 2027. Després esborrem la llista sencera. Les dades de càrrecs electes es mantenen mentre l’interès públic ho justifiqui: l’històric electoral des del 1979 té valor d’arxiu i no el buidem, però una petició de retirada s’atén cas per cas amb els terminis d’aquí sobre.</p>
<h2>Amb qui les compartim</h2>
<p>Amb ningú. No hi ha analítica de tercers, ni píxels, ni xarxes socials incrustades. Les tipografies es serveixen des d’aquest mateix domini, o sigui que la teva visita no arriba a cap altra empresa. Les dades es desen en un servidor d’OVH SAS a França (Unió Europea), gestionat per estic.online.</p>
<h2>Cookies</h2>
<p>Cap. Aquesta web no en posa.</p>
<h2>Els teus drets</h2>
<p>Pots demanar accés, rectificació, supressió, oposició, limitació i portabilitat escrivint a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>. Per donar-te de baixa a l’instant, fes servir l’enllaç de qualsevol correu que t’enviem. Si creus que no t’hem atès bé, pots reclamar a l’<a href="https://apdcat.gencat.cat">Autoritat Catalana de Protecció de Dades</a>.</p>
""" + FONTS_CA + """
<p class="peu-doc">Darrera actualització: 29 d’agost de 2026.</p>
"""),
 'es': ("Política de privacidad", "Volver al inicio", """
<p class="lead">De esta web solo sale un dato tuyo: el correo, si nos lo das, para avisarte cuando abramos tu municipio. Aparte de eso, en el <a href="https://quivoto.cat/observatori/">Observatorio</a> publicamos datos de cargos electos que ya son públicos, y aquí te explicamos exactamente cuáles, por qué podemos hacerlo y cómo pedir su corrección o su retirada.</p>
<h2>Quién es el responsable</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Qué datos tuyos tratamos y para qué</h2>
<ul>
<li><strong>Correo electrónico</strong> (obligatorio): para enviarte un único aviso cuando la brújula de tu municipio esté disponible.</li>
<li><strong>Municipio</strong> (opcional): para saber por dónde empezar y avisarte en el momento adecuado.</li>
<li><strong>Idioma</strong>: para escribirte en la lengua en que nos has escrito.</li>
<li><strong>Huella técnica</strong>: un hash irreversible de tu dirección IP con sal diaria y el nombre del navegador, solo para frenar envíos automatizados. No guardamos la IP.</li>
</ul>
<p>Consultar el Observatorio no pide nada de todo esto: se entra sin registro, sin cuenta y sin cookies.</p>
<h2>Base legal de la lista de espera</h2>
<p>Tu consentimiento expreso (art. 6.1.a del RGPD), que das marcando la casilla del formulario y que puedes retirar cuando quieras.</p>
<h2>Los datos de los cargos electos</h2>
<p>En el Observatorio publicamos las personas que ocupan o han ocupado un cargo electo en los 947 ayuntamientos de Cataluña. No somos nosotros quienes los hacemos públicos: salen de conjuntos de datos abiertos publicados por la Generalitat de Catalunya y por el Consorci AOC, que cualquiera puede descargar hoy mismo.</p>
<p><strong>Base legal:</strong> el cumplimiento de una misión de interés público (art. 6.1.e del RGPD), ligado a la publicidad activa que la Ley 19/2014, de transparencia, acceso a la información pública y buen gobierno, impone a los ayuntamientos sobre sus cargos electos, y a la ponderación entre transparencia y protección de datos de su artículo 15. La información se refiere solo al ejercicio de un cargo público representativo, no a la vida privada de nadie.</p>
<p><strong>Qué publicamos, exactamente:</strong> nombre y apellidos, cargo (alcaldía, tenencia de alcaldía, concejalía), candidatura o grupo por el que la persona fue elegida, y mandato, es decir el municipio y la legislatura. Y, cuando el ayuntamiento la haya publicado en su portal de transparencia, la <strong>fotografía oficial del cargo</strong>: la reproducimos en tamaño pequeño, citando siempre al ayuntamiento que la publica y con enlace a la ficha original. No las tenemos de todo el mundo —solo una parte de los ayuntamientos las publican— y la ficha funciona igual sin ellas. No ponemos ninguna fotografía que no haya publicado antes la propia administración, y las retiramos a la primera petición de la persona, sin pedir el motivo. Nada más.</p>
<p><strong>Qué no publicamos:</strong> ninguna dirección de correo —aunque la fuente la traiga, la descartamos al ingerir los datos—, ninguna dirección postal, ningún teléfono, ninguna fecha de nacimiento, ningún dato patrimonial, ningún dato de salud, ideología, afiliación sindical, religión ni orientación sexual, y ningún dato que no derive directamente del cargo. Tampoco publicamos nada de personas que nunca hayan sido cargo electo, ni ninguna fotografía de quien no ocupe el cargo ahora mismo, ni los logotipos de los grupos políticos, que tienen el uso reservado.</p>
<h2>Rectificación y retirada</h2>
<p>Si eres o has sido cargo electo y algo de lo que publicamos sobre ti es erróneo o incompleto, o quieres que lo retiremos, escríbenos a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a> indicando el municipio y el mandato. Para pedir que retiremos tu fotografía no tienes que dar ningún motivo: la quitamos y ya está.</p>
<ul>
<li><strong>Acusamos recibo en 72 horas</strong> desde que nos escribes, y te decimos quién lleva el caso.</li>
<li><strong>Un error de dato evidente</strong> —un nombre mal escrito, un cargo cambiado, una candidatura equivocada— lo corregimos <strong>en 7 días naturales</strong>.</li>
<li><strong>Una fotografía la retiramos en 72 horas</strong>, sin pedirte motivos y sin discutirlo.</li>
<li><strong>El resto de peticiones</strong> (supresión, oposición, limitación) las resolvemos <strong>en un máximo de 30 días naturales</strong>, el plazo del art. 12.3 del RGPD. Si el caso es complejo te avisamos y podemos alargarlo dos meses más, como prevé el mismo artículo, pero te habremos dicho por qué.</li>
<li><strong>Dejamos constancia del cambio</strong>: cada corrección queda anotada en la ficha del municipio con la fecha.</li>
</ul>
<p>Si el error viene de la fuente —de la Generalitat o de la AOC—, te diremos de qué conjunto se trata y lo corregiremos igualmente en nuestra publicación, pero la corrección definitiva la tiene que hacer quien publica el original.</p>
<h2>Cuánto tiempo</h2>
<p>Tu correo, hasta que te des de baja o, como muy tarde, el 31 de diciembre de 2027. Después borramos la lista entera. Los datos de cargos electos se mantienen mientras el interés público lo justifique: el histórico electoral desde 1979 tiene valor de archivo y no lo vaciamos, pero una petición de retirada se atiende caso por caso con los plazos de aquí arriba.</p>
<h2>Con quién los compartimos</h2>
<p>Con nadie. No hay analítica de terceros, ni píxeles, ni redes sociales incrustadas. Las tipografías se sirven desde este mismo dominio, así que tu visita no llega a ninguna otra empresa. Los datos se guardan en un servidor de OVH SAS en Francia (Unión Europea), gestionado por estic.online.</p>
<h2>Cookies</h2>
<p>Ninguna. Esta web no pone.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>. Para darte de baja al instante, usa el enlace de cualquier correo que te enviemos. Si crees que no te hemos atendido bien, puedes reclamar ante la <a href="https://www.aepd.es">Agencia Española de Protección de Datos</a>.</p>
""" + FONTS_ES + """
<p class="peu-doc">Última actualización: 29 de agosto de 2026.</p>
"""),
}

AVIS = {
 'ca': ("Avís legal", "Tornar a l'inici", """
<p class="lead">{marca} és un projecte independent de <strong>Damos en el Blanco, S.L.</strong> Prepara una brúixola electoral per a les municipals del 23 de maig de 2027 i, mentrestant, publica l’<a href="/observatori/">Observatori municipal</a>: una fitxa per a cadascun dels 947 municipis de Catalunya, feta només amb dades obertes.</p>
<h2>Titular</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Què és l’Observatori</h2>
<p>Una fitxa per municipi amb qui hi mana, què s’hi ha votat a les dotze eleccions des del 1979, com han anat les alcaldies i com estan els comptes. Tot són fonts oficials i càlculs deterministes: no hi ha cap model de llenguatge pel mig i cada xifra porta la seva font i el seu any.</p>
<h2>Què no som</h2>
<ul>
<li><strong>No som un mitjà de comunicació.</strong> No fem periodisme ni opinió, ni estem inscrits com a mitjà. Publiquem dades i expliquem com les hem calculades.</li>
<li><strong>No rebem diners de cap partit ni de cap candidatura</strong>, ni de cap administració. No venem publicitat política ni acceptem contingut pagat.</li>
<li><strong>Les dades no són una valoració del govern municipal.</strong> Que un ajuntament tingui més deute, un període de pagament més llarg o menys actes de ple publicades no vol dir que ho faci malament: vol dir exactament això, el que en diuen les fonts oficials. Quan comparem, ho fem sempre amb municipis de mida semblant, i quan una dada falta ho diem en comptes d’estimar-la.</li>
<li><strong>No és un consell de vot.</strong> És una eina d’orientació perquè decideixis tu.</li>
</ul>
<h2>Dades de càrrecs electes</h2>
<p>Publiquem el nom, el càrrec, la candidatura i el mandat de les persones que ocupen o han ocupat un càrrec electe municipal, perquè és informació d’interès públic i perquè ja és oberta: la publiquen la Generalitat de Catalunya i el Consorci AOC. No publiquem cap correu, cap adreça, cap telèfon ni cap dada que no derivi del càrrec. Com demanar-ne la rectificació o la retirada, i en quins terminis responem, ho expliquem a la <a href="/privadesa.html">política de privadesa</a>.</p>
<h2>Independència</h2>
<p>No rebem finançament de cap partit polític, candidatura ni administració. No fem campanya per ningú: la nostra feina és ensenyar-te on és cada partit i amb quines proves ho diem, perquè decideixis tu.</p>
""" + FONTS_CA + """
<h2>Llicència de les nostres dades</h2>
<p>El que hi posem nosaltres —els agregats, els percentatges recalculats, les comparacions per grups de municipis semblants i els índexs propis— es publica sota <a href="https://creativecommons.org/licenses/by/4.0/deed.ca">Creative Commons Reconeixement 4.0 (CC BY 4.0)</a>. El pots copiar, transformar i fer-ne un ús comercial.</p>
<p>A canvi, si ho reutilitzes: cita «quivoto» amb l’enllaç a la fitxa i la data de generació que hi surt; cita també la font original de la dada, perquè les seves llicències obliguen a fer-ho; i no presentis les nostres xifres derivades com si fossin oficials, perquè no ho són: són el nostre càlcul a partir d’una font oficial. El disseny, els textos, les il·lustracions i la mascota no entren en aquesta llicència.</p>
<h2>Responsabilitat</h2>
<p>Posem molta cura a comprovar cada dada, però ni l’Observatori ni la brúixola són un oracle. Si hi trobes un error, escriu-nos i el corregirem, i deixarem constància del canvi.</p>
<h2>Propietat intel·lectual</h2>
<p>El disseny, els textos i les il·lustracions són de Damos en el Blanco, S.L. La metodologia i el codi es publicaran obertament.</p>
<h2>Llei aplicable</h2>
<p>Aquest avís es regeix per la legislació espanyola i europea.</p>
<p class="peu-doc">Darrera actualització: 29 d’agost de 2026.</p>
"""),
 'es': ("Aviso legal", "Volver al inicio", """
<p class="lead">{marca} es un proyecto independiente de <strong>Damos en el Blanco, S.L.</strong> Prepara una brújula electoral para las municipales del 23 de mayo de 2027 y, mientras tanto, publica el <a href="https://quivoto.cat/observatori/">Observatorio municipal</a>: una ficha para cada uno de los 947 municipios de Cataluña, hecha solo con datos abiertos.</p>
<h2>Titular</h2>
<p>Damos en el Blanco, S.L. · CIF B75676460 · Cta. Reial 95, 08960 Sant Just Desvern (Barcelona) · <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a></p>
<h2>Qué es el Observatorio</h2>
<p>Una ficha por municipio con quién manda, qué se ha votado en las doce elecciones desde 1979, cómo han ido las alcaldías y cómo están las cuentas. Todo son fuentes oficiales y cálculos deterministas: no hay ningún modelo de lenguaje de por medio y cada cifra lleva su fuente y su año. Las fichas están en catalán, que es la lengua de las fuentes oficiales.</p>
<h2>Qué no somos</h2>
<ul>
<li><strong>No somos un medio de comunicación.</strong> No hacemos periodismo ni opinión, ni estamos inscritos como medio. Publicamos datos y explicamos cómo los hemos calculado.</li>
<li><strong>No recibimos dinero de ningún partido ni de ninguna candidatura</strong>, ni de ninguna administración. No vendemos publicidad política ni aceptamos contenido pagado.</li>
<li><strong>Los datos no son una valoración del gobierno municipal.</strong> Que un ayuntamiento tenga más deuda, un periodo de pago más largo o menos actas de pleno publicadas no significa que lo haga mal: significa exactamente eso, lo que dicen las fuentes oficiales. Cuando comparamos, lo hacemos siempre con municipios de tamaño parecido, y cuando falta un dato lo decimos en vez de estimarlo.</li>
<li><strong>No es un consejo de voto.</strong> Es una herramienta de orientación para que decidas tú.</li>
</ul>
<h2>Datos de cargos electos</h2>
<p>Publicamos el nombre, el cargo, la candidatura y el mandato de las personas que ocupan o han ocupado un cargo electo municipal, porque es información de interés público y porque ya es abierta: la publican la Generalitat de Catalunya y el Consorci AOC. No publicamos ningún correo, ninguna dirección, ningún teléfono ni ningún dato que no derive del cargo. Cómo pedir su rectificación o su retirada, y en qué plazos respondemos, lo explicamos en la <a href="/privadesa.html">política de privacidad</a>.</p>
<h2>Independencia</h2>
<p>No recibimos financiación de ningún partido, candidatura ni administración. No hacemos campaña por nadie: nuestro trabajo es enseñarte dónde está cada partido y con qué pruebas lo decimos, para que decidas tú.</p>
""" + FONTS_ES + """
<h2>Licencia de nuestros datos</h2>
<p>Lo que ponemos nosotros —los agregados, los porcentajes recalculados, las comparaciones por grupos de municipios parecidos y los índices propios— se publica bajo <a href="https://creativecommons.org/licenses/by/4.0/deed.ca">Creative Commons Reconocimiento 4.0 (CC BY 4.0)</a>. Puedes copiarlo, transformarlo y hacer un uso comercial.</p>
<p>A cambio, si lo reutilizas: cita «quivoto» con el enlace a la ficha y la fecha de generación que aparece en ella; cita también la fuente original del dato, porque sus licencias obligan a hacerlo; y no presentes nuestras cifras derivadas como si fueran oficiales, porque no lo son: son nuestro cálculo a partir de una fuente oficial. El diseño, los textos, las ilustraciones y la mascota no entran en esta licencia.</p>
<h2>Responsabilidad</h2>
<p>Ponemos mucho cuidado en comprobar cada dato, pero ni el Observatorio ni la brújula son un oráculo. Si encuentras un error, escríbenos y lo corregiremos, dejando constancia del cambio.</p>
<h2>Propiedad intelectual</h2>
<p>El diseño, los textos y las ilustraciones son de Damos en el Blanco, S.L. La metodología y el código se publicarán abiertamente.</p>
<h2>Ley aplicable</h2>
<p>Este aviso se rige por la legislación española y europea.</p>
<p class="peu-doc">Última actualización: 29 de agosto de 2026.</p>
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
    ctx['xifres'] = xifres(t)
    ctx['obs_xifres_items'] = obs_xifres(t)
    ctx['obs_reixa_items'] = obs_reixa(t)
    ctx['prova'] = prova_html(t)
    ctx['estil_extra'] = CSS_EXTRA
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
