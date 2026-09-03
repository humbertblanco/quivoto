#!/usr/bin/env python3
"""Genera la landing de quivoto (ca) i quienvoto (es) a web/public/.

    python3 tools/build_landing.py

Font única: tools/icons_lib.py (icones + mascota). No cal cap dependència.
"""
import os, re, sys, html
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
  'title':'quivoto — A qui votes al teu poble? Municipals 2027',
  'desc':'Brúixola electoral per a les municipals del 23 de maig de 2027 i observatori dels 947 municipis de Catalunya. Respon 25 afirmacions i mira qui pensa com tu.',
  'og_alt':'quivoto: la papereta mascota i la pregunta «A qui votes al teu poble?»',
  'locale':'ca_ES','locale_alt':'es_ES',
  'aviat':'Aviat',
  'salta':'Vés al contingut','menu_aria':'Seccions de l’Observatori',
  'h1':'A qui votes<br>al teu poble?',
  'entrada':'Les municipals no van de sigles: van de si es tanca un carril, de si puja l’IBI, de si es compren pisos. <strong>quivoto</strong> et fa 25 preguntes sobre el teu municipi i et diu qui pensa com tu.',
  'compte':'Falten {dies} dies per al 23 de maig de 2027',
  'form_titol':'Avisa’m quan la meva ciutat estigui llesta',
  'form_sub':'Un sol correu quan obrim el teu municipi. Res més, i te’n pots donar de baixa quan vulguis.',
  'email_ph':'El teu correu','muni_ph':'El teu municipi (opcional)',
  'cerca_ph':'Busca el teu municipi, alcaldia o regidor',
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
  'obs_nota':'Gratuït i sense registre. Google Analytics només mesura visites de manera agregada. És un esborrany: hi treballem a la vista de tothom i encara no està revisat del tot.',
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
  'peu_premsa':'Premsa','premsa_url':'/premsa.html',
  'peu':'quivoto — brúixola electoral de les municipals 2027.',
  'credit':'Un projecte d’<a href="https://x.com/humbertblanco">Humbert Blanco</a> gràcies a <a href="https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits">Damos en el Blanco</a> · <a href="https://github.com/humbertblanco/quivoto">GitHub</a>',
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
  'title':'quienvoto — ¿A quién votas en tu pueblo? Municipales 2027',
  'desc':'Brújula electoral para las municipales del 23 de mayo de 2027 y observatorio de los 947 municipios de Cataluña. 25 afirmaciones para ver quién piensa como tú.',
  'og_alt':'quienvoto: la papeleta mascota y la pregunta «¿A quién votas en tu pueblo?»',
  'locale':'es_ES','locale_alt':'ca_ES',
  'aviat':'Pronto',
  'salta':'Ir al contenido','menu_aria':'Secciones del Observatorio',
  'h1':'¿A quién votas<br>en tu pueblo?',
  'entrada':'Las municipales no van de siglas: van de si se quita un carril, de si sube el IBI, de si se compran pisos. <strong>quienvoto</strong> te hace 25 preguntas sobre tu municipio y te dice quién piensa como tú.',
  'compte':'Faltan {dies} días para el 23 de mayo de 2027',
  'form_titol':'Avísame cuando mi ciudad esté lista',
  'form_sub':'Un solo correo cuando abramos tu municipio. Nada más, y puedes darte de baja cuando quieras.',
  'email_ph':'Tu correo','muni_ph':'Tu municipio (opcional)',
  'cerca_ph':'Busca tu municipio, alcaldía o concejal',
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
  'obs_nota':'Gratuito y sin registro. Google Analytics solo mide visitas de forma agregada. Las fichas están en catalán, que es la lengua de las fuentes oficiales. Es un borrador: trabajamos a la vista de todos y todavía no está revisado del todo.',
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
  'peu_premsa':'Prensa','premsa_url':'/es/prensa.html',
  'peu':'quienvoto — brújula electoral de las municipales 2027.',
  'credit':'Un proyecto de <a href="https://x.com/humbertblanco">Humbert Blanco</a> gracias a <a href="https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits">Damos en el Blanco</a> · <a href="https://github.com/humbertblanco/quivoto">GitHub</a>',
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


def versio(fitxer):
    """Empremta curta d'un fitxer d'assets, per a la cadena de consulta de l'enllaç.

    L'.htaccess fa que el CSS es guardi set dies a la memòria cau del navegador.
    Sense això, qui ja hagués visitat el web veuria el HTML nou amb el full
    d'estil vell fins a una setmana: una capçalera amb menú i sense estil, per
    exemple. Canvia el fitxer, canvia l'adreça, i el navegador el torna a demanar.
    """
    import hashlib
    cami = os.path.join(OUT, 'assets', fitxer)
    if not os.path.exists(cami):
        raise SystemExit(f'Falta {cami}. Els fitxers cercador.* els escriu el generador de '
                         "l'Observatori (packages/pipeline/src/publish/cercador.ts) i van al git.")
    with open(cami, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


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


# El menú de l'Observatori, copiat de packages/pipeline/src/publish/capcalera.ts
# (DESTINS): les mateixes entrades, en el mateix ordre i amb els mateixos
# camins. Si allà canvia un nom o l'ordre, aquí també: el web és un de sol i el
# menú s'ha de veure igual a la portada que a la fitxa d'un poble.
MENU = [
  ('portada',     'Observatori',  ''),
  ('947',         'Els 947',      'els947.html'),
  ('mapa',        'Mapa',         'mapa/'),
  ('ranquings',   'Rànquings',    'ranquings/'),
  ('comarques',   'Comarques',    'c/'),
  ('partits',     'Partits',      'partit/'),
  ('trajectoria', 'Trajectòries', 'trajectoria/'),
  ('comparador',  'Comparador',   'comparador/'),
]


def capcalera(lang, actual='cap'):
    """La mateixa capçalera que l'Observatori, a totes les pàgines de la landing.

    La ranura buida després del menú és on el guió del cercador compartit
    (assets/cercador.js) posa el botó «Cerca», igual que a capcalera.ts: sense
    guió no hi ha botó, en comptes d'una lupa que no fa res.

    La marca porta a la portada de l'idioma; el menú és el de capcalera.ts, amb
    enllaços absoluts (t['obs_url']) perquè funcionin des de / i des de /es/:
    '/observatori/…' en català i 'https://quivoto.cat/observatori/…' en
    castellà, que és on viu l'Observatori. Com que encara només és en català,
    els noms del menú no es tradueixen i a la versió castellana porten
    hreflang="ca", igual que la resta d'enllaços de la pàgina cap allà.

    `actual` és la clau del destí on som; a la landing no n'hi ha cap, perquè
    la portada no és una secció de l'Observatori, i per tant no s'hi subratlla res.
    """
    t = T[lang]
    base = t['obs_url']
    hl = '' if lang == 'ca' else ' hreflang="ca"'
    items = ''.join(
      f'<span class="ara" aria-current="page">{html.escape(text)}</span>' if clau == actual
      else f'<a href="{base}{on}"{hl}>{html.escape(text)}</a>'
      for clau, text, on in MENU)
    arrel = '/' if lang == 'ca' else '/es/'
    return f'''<header class="capcalera">
  <a class="logo" href="{arrel}">{wordmark(t, 30)}</a>
  <nav class="menu" aria-label="{t['menu_aria']}">{items}</nav>
  <span class="ranura-cerca"></span>
  <span class="etiqueta">{t['aviat']}</span>
  <a href="{t['altra_url']}" hreflang="{t['altra_lang']}" class="idioma">{t['altra']}</a>
</header>'''


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

def cercador_compartit(lang):
    """El diàleg del cercador de l'Observatori, tal com l'escriu
    packages/pipeline/src/publish/cercador.ts a web/public/assets/cercador.html.

    La landing tenia un cercador propi —un altre aspecte, sense fletxes ni
    accents ni alcaldies d'abans— i el propietari vol el mateix a tot arreu.
    Aquí no se'n copia res: es llegeix el fragment, i el guió i el full
    s'enllacen des de /assets/. El diàleg queda en català; en castellà només
    canvia el text de la casella buida, que és l'únic que es llegeix abans
    d'escriure-hi."""
    with open(os.path.join(OUT, 'assets', 'cercador.html'), encoding='utf-8') as f:
        fragment = f.read().strip()
    if lang != 'ca':
        fragment, n = re.subn(r'placeholder="[^"]*"',
                              f'placeholder="{html.escape(T[lang]["cerca_ph"], quote=True)}"', fragment, count=1)
        assert n == 1, 'el fragment del cercador ha canviat de forma: mira cercador.ts'
    return fragment


def ctx_cercador(lang):
    """Les tres peces que tota pàgina de la landing necessita del cercador."""
    return {'cercador': cercador_compartit(lang),
            'cercador_css_v': versio('cercador.css'),
            'cercador_js_v': versio('cercador.js')}


LUPA = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2.4" stroke-linecap="round" aria-hidden="true">'
        '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 L21 21"/></svg>')


def casella_hero(t):
    """La casella gran del primer bloc: un camp de debò que obre el diàleg
    compartit amb el que s'hi ha escrit (data-cerca-camp, a cercador.ts).
    Sense guió és un formulari GET cap a la portada de l'Observatori amb «?q=»,
    que el guió d'allà llegeix i obre: no hi ha cap control que no faci res."""
    ph = html.escape(t['cerca_ph'], quote=True)
    return f"""<form class="cerca-hero" role="search" action="{t['obs_url']}" method="get">
        <label for="cerca-hero-camp">{LUPA}<span class="nomes-lectors">{ph}</span></label>
        <input id="cerca-hero-camp" type="search" name="q" data-cerca-camp autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="{ph}">
      </form>"""


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


def xifres_observatori():
    """Els recomptes del peu, escrits pel generador de l'Observatori a
    web/public/observatori/xifres.json en cada publicació. Si no hi és (un
    clon net, sense cap publicació feta), el peu va sense xifres i sense data:
    val més no dir res que dir un número copiat a mà que envelleix sol."""
    import json
    cami = os.path.join(OUT, 'observatori', 'xifres.json')
    try:
        with open(cami, encoding='utf-8') as f:
            x = json.load(f)
        return {k: x[k] for k in ('municipis', 'electes', 'candidatures', 'generatedAt')}
    except (OSError, ValueError, KeyError):
        return None


def footer_complet(t):
    """El mateix peu editorial a la landing, els documents i l'Observatori:
    la targeta de qui som, les pastilles per anar a mirar coses i la lletra
    petita de les fonts. És la còpia en Python de peu.ts; si allà canvia una
    pastilla, aquí també."""
    es = t['lang'] == 'es'
    noms = (
      ('Los 947', 'El mapa', 'Rankings', 'El comparador', 'Las comarcas', 'El Área Metropolitana',
       'Las preguntas', 'Los datos', 'Todas las fuentes', 'Aviso legal', 'Privacidad') if es else
      ('Els 947', 'El mapa', 'Rànquings', 'El comparador', 'Les comarques', "L’Àrea Metropolitana",
       'Les preguntes', 'Les dades', 'Totes les fonts', 'Avís legal', 'Privadesa')
    )
    base = t['obs_url']
    urls = ('els947.html', 'mapa/', 'ranquings/', 'comparador/', 'c/', 'amb/', 'preguntes/', 'dades/', 'dades/#fonts')
    nav = ''.join(f'<a href="{base}{u}">{n}</a>' for n, u in zip(noms[:9], urls))
    x = xifres_observatori()
    municipis = f"{x['municipis']:,}".replace(',', '.') if x else '947'
    lema = (
      f'Quién gobierna cada uno de los {municipis} municipios de Cataluña, qué paga la gente y qué se '
      'prometió. <b>Sin ningún modelo de lenguaje por medio</b>: fuentes oficiales, cada cifra '
      'con la suya al lado y cálculos que cualquiera puede repetir.' if es else
      f'Qui mana a cada un dels {municipis} municipis de Catalunya, què hi paga la gent i què s’hi va '
      'prometre. <b>Sense cap model de llenguatge pel mig</b>: fonts oficials, cada xifra amb la '
      'seva al costat i càlculs que qualsevol pot repetir.'
    )
    if x:
        compte = lambda n, de: f'<li><b>{n:,}</b><span>{de}</span></li>'.replace(',', '.')
        xifres = ('<ul class="xifres">' + compte(x['municipis'], 'municipios' if es else 'municipis')
                  + compte(x['electes'], 'electos' if es else 'electes')
                  + compte(x['candidatures'], 'candidaturas' if es else 'candidatures') + '</ul>')
        quan = (f'<b>Observatorio actualizado el {x["generatedAt"]}</b> con' if es else
                f'<b>Observatori actualitzat el {x["generatedAt"]}</b> amb')
    else:
        xifres = ''
        quan = '<b>Hecho</b> con' if es else '<b>Fet</b> amb'
    fonts = (
      f'{quan} datos abiertos de la Generalitat de Cataluña, el Consorcio AOC, Idescat, el '
      f'Ministerio de Hacienda y el Síndic de Greuges. Consulta '
      f'<a href="{base}dades/#fonts">el catálogo completo de fuentes, métodos y licencias</a>.' if es else
      f'{quan} dades obertes de la Generalitat de Catalunya, el Consorci AOC, l’Idescat, el '
      f'Ministeri d’Hisenda i el Síndic de Greuges. Consulta '
      f'<a href="{base}dades/#fonts">el catàleg complet de fonts, mètodes i llicències</a>.'
    )
    catalunya = '''<svg class="catalunya" width="88" height="88" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M26 18Q36 20 48 25Q55 28 62 30Q70 33 77 33Q85 33 91 29L101 37Q98 47 91 57Q84 62 75 66Q67 72 59 77L41 83Q34 86 32 91L37 96 28 98 21 103Q14 100 14 93L16 79Q17 71 17 64Q19 57 24 52Q28 44 27 34Z" fill="#BFE8D2" stroke="#1E1B2E" stroke-width="4" stroke-linejoin="round"/>
      <g fill="#E2735A"><circle cx="36" cy="30" r="2.6"/><circle cx="58" cy="37" r="2.6"/><circle cx="81" cy="42" r="2.6"/><circle cx="33" cy="39" r="2.6"/><circle cx="23" cy="68" r="2.6"/><circle cx="32" cy="85" r="2.6"/><circle cx="24" cy="94" r="2.6"/></g>
      <g class="ulls"><circle cx="40" cy="53" r="9" fill="#fff" stroke="#1E1B2E" stroke-width="3"/><circle cx="62" cy="53" r="9" fill="#fff" stroke="#1E1B2E" stroke-width="3"/><circle cx="40" cy="54" r="4.2" fill="#1E1B2E"/><circle cx="62" cy="54" r="4.2" fill="#1E1B2E"/><path d="M40 68q10 9 20 0" stroke="#1E1B2E" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    </svg>'''
    return f'''<footer class="peu peu-complet"><div>
      <div class="crida"><div class="cara">{catalunya}</div>
        <div class="diu"><a class="marca-peu" href="/">{t['marca']}</a><p class="lema">{lema}</p></div>
        {xifres}</div>
      <nav class="anar" aria-label="{'Más del Observatorio' if es else 'Més de l’Observatori'}">{nav}</nav>
      <p class="lletra">{fonts}</p>
      <p class="legal"><a href="/avis-legal.html">{noms[9]}</a> · <a href="/privadesa.html">{noms[10]}</a> · <a href="{t['premsa_url']}">{t['peu_premsa']}</a></p>
      <p class="credit">{t['credit']}</p>
    </div></footer>'''


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

GOOGLE_TAG = '''<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9ZB1XZ3LHT"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-9ZB1XZ3LHT');
</script>'''

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
<meta property="og:site_name" content="{marca}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://{domini}/">
<meta property="og:image" content="https://{domini}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{og_alt}">
<meta property="og:locale" content="{locale}">
<meta property="og:locale:alternate" content="{locale_alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://{domini}/assets/og.png">
<meta name="twitter:image:alt" content="{og_alt}">
<meta name="theme-color" content="#FBF7EE">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css?v={css_v}">
<link rel="stylesheet" href="/assets/cercador.css?v={cercador_css_v}">
{estil_extra}
<script type="application/ld+json">
{json_ld}
</script>
{google_tag}
</head>
<body>
<a class="salta" href="#contingut">{salta}</a>

{capcalera}
{cercador}

<main id="contingut">

<section class="hero">
  <p class="micro">{micro}</p>
  <h1>{h1}</h1>
  <div class="hero-cos">
    <div>
      {casella}
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

<section class="qui-som">
  <h2>{qui_titol}</h2>
  <p>{qui}</p>
  <p><a class="correu" href="mailto:{contacte}">{contacte}</a></p>
</section>

</main>

{footer}

<script src="/assets/app.js" defer></script>
<script src="/assets/cercador.js?v={cercador_js_v}" defer></script>
</body>
</html>
'''

GRACIES = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{gracies_h} — {marca}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="{gracies_p}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css?v={css_v}">
<link rel="stylesheet" href="/assets/cercador.css?v={cercador_css_v}">
{google_tag}
</head>
<body class="pagina-simple">
<a class="salta" href="#contingut">{salta}</a>
{capcalera}
{cercador}
<main id="contingut">
  {mascota}
  <h1>{gracies_h}</h1>
  <p>{gracies_p}</p>
  <p><a class="boto" href="/">{gracies_torna}</a></p>
</main>
{footer}
<script src="/assets/cercador.js?v={cercador_js_v}" defer></script>
</body>
</html>
'''

LEGAL = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titol} — {marca}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://quivoto.cat/{canonical}">
<link rel="alternate" hreflang="ca" href="https://quivoto.cat/{nom}.html">
<link rel="alternate" hreflang="es" href="https://quivoto.cat/es/{nom}.html">
<link rel="alternate" hreflang="x-default" href="https://quivoto.cat/{nom}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{marca}">
<meta property="og:title" content="{titol} — {marca}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://quivoto.cat/{canonical}">
<meta property="og:image" content="https://quivoto.cat/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{locale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css?v={css_v}">
<link rel="stylesheet" href="/assets/cercador.css?v={cercador_css_v}">
{google_tag}
</head>
<body>
<a class="salta" href="#contingut">{salta}</a>
{capcalera}
{cercador}
<main id="contingut" class="document">
<h1>{titol}</h1>
{cos}
<p class="tornar"><a class="boto-secundari" href="/">{tornar}</a></p>
</main>
{footer}
<script src="/assets/cercador.js?v={cercador_js_v}" defer></script>
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
<li><strong>Empremta tècnica</strong>: un hash irreversible de la teva adreça IP amb sal diària i el nom del navegador, només per aturar enviaments automatitzats. No desem la IP i purguem tots dos camps al cap de 48 hores.</li>
<li><strong>Prova del consentiment</strong>: data, versió de la política acceptada i pàgina des d’on vas enviar el formulari.</li>
</ul>
<p>Consultar l’Observatori no demana registre ni compte. Google Analytics recull dades d’ús de manera agregada per ajudar-nos a entendre quines pàgines funcionen i millorar el servei.</p>
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
<p>Fem servir <strong>Google Analytics</strong>, un servei de Google, per mesurar de manera agregada les visites i l’ús del web. Això pot comportar la comunicació a Google de dades tècniques de la visita, com ara el dispositiu, el navegador i una adreça IP abreujada. No hi ha píxels publicitaris ni xarxes socials incrustades. Les tipografies es serveixen des d’aquest mateix domini. La resta de dades es desen en un servidor d’OVH SAS a França (Unió Europea), gestionat per estic.online.</p>
<h2>Cookies</h2>
<p>Google Analytics pot utilitzar identificadors o emmagatzematge local per distingir visites i elaborar estadístiques agregades. Pots bloquejar-los des de la configuració del navegador o amb un bloquejador de contingut.</p>
<h2>Els teus drets</h2>
<p>Pots demanar accés, rectificació, supressió, oposició, limitació i portabilitat escrivint a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>. Per donar-te de baixa a l’instant, fes servir l’enllaç de qualsevol correu que t’enviem. Si creus que no t’hem atès bé, pots reclamar a l’<a href="https://apdcat.gencat.cat">Autoritat Catalana de Protecció de Dades</a>.</p>
""" + FONTS_CA + """
<p class="peu-doc">Darrera actualització: 31 d’agost de 2026.</p>
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
<li><strong>Huella técnica</strong>: un hash irreversible de tu dirección IP con sal diaria y el nombre del navegador, solo para frenar envíos automatizados. No guardamos la IP y purgamos ambos campos a las 48 horas.</li>
<li><strong>Prueba del consentimiento</strong>: fecha, versión de la política aceptada y página desde la que enviaste el formulario.</li>
</ul>
<p>Consultar el Observatorio no requiere registro ni cuenta. Google Analytics recoge datos de uso de forma agregada para ayudarnos a entender qué páginas funcionan y mejorar el servicio.</p>
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
<p>Usamos <strong>Google Analytics</strong>, un servicio de Google, para medir de forma agregada las visitas y el uso de la web. Esto puede implicar la comunicación a Google de datos técnicos de la visita, como el dispositivo, el navegador y una dirección IP abreviada. No hay píxeles publicitarios ni redes sociales incrustadas. Las tipografías se sirven desde este mismo dominio. El resto de datos se guardan en un servidor de OVH SAS en Francia (Unión Europea), gestionado por estic.online.</p>
<h2>Cookies</h2>
<p>Google Analytics puede utilizar identificadores o almacenamiento local para distinguir visitas y elaborar estadísticas agregadas. Puedes bloquearlos desde la configuración del navegador o con un bloqueador de contenido.</p>
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


# Descripcions de les pàgines legals (≤ 158 caràcters): diuen de què va cada
# pàgina, no només el títol repetit, perquè és el que surt al resultat de cerca.
DESC_LEGAL = {
  'privadesa': {
    'ca': 'Quines dades recull quivoto (només el correu de qui demana avís), per a què, quant de temps i com donar-se de baixa. I què publiquem dels càrrecs electes.',
    'es': 'Qué datos recoge quienvoto (solo el correo de quien pide aviso), para qué, cuánto tiempo y cómo darse de baja. Y qué publicamos de los cargos electos.',
  },
  'avis-legal': {
    'ca': 'Qui hi ha darrere de quivoto, d’on surten les dades de l’Observatori, amb quina llicència les publiquem i què no ens podeu demanar.',
    'es': 'Quién está detrás de quienvoto, de dónde salen los datos del Observatorio, con qué licencia los publicamos y qué no nos podéis pedir.',
  },
}


def build_legal(lang):
    t = T[lang]
    sub = OUT if lang == 'ca' else os.path.join(OUT, 'es')
    for nom, taula in (('privadesa', PRIVADESA), ('avis-legal', AVIS)):
        titol, tornar, cos = taula[lang]
        pagina = LEGAL.format(lang=t['lang'], marca=t['marca'], titol=titol, tornar=tornar,
                              capcalera=capcalera(lang), salta=t['salta'], peu=t['peu'],
                              footer=footer_complet(t),
                              css_v=versio('styles.css'), google_tag=GOOGLE_TAG,
                              **ctx_cercador(lang),
                              canonical=("" if lang == "ca" else "es/") + nom + ".html",
                              nom=nom, desc=DESC_LEGAL[nom][lang], locale=t['locale'],
                              cos=cos.replace('{marca}', t['marca']))
        open(os.path.join(sub, nom + '.html'), 'w', encoding='utf-8').write(pagina)


def build_sitemap():
    """El sitemap de la landing: portada i pàgines legals, amb les alternatives
    d'idioma. Ni «gràcies» ni el 404 hi van (porten noindex i robots.txt els
    tanca). La versió castellana de la portada viu a quienvoto.es, i un sitemap
    no pot llistar adreces d'un altre domini: hi va només com a alternativa.
    L'Observatori té el seu propi sitemap, que genera el pipeline."""
    import datetime, json
    avui = datetime.date.today().isoformat()
    urls = []
    def url(loc, prioritat, alternatives):
        urls.append(
            f'  <url>\n    <loc>{loc}</loc>\n' +
            ''.join(f'    <xhtml:link rel="alternate" hreflang="{hl}" href="{href}"/>\n' for hl, href in alternatives) +
            f'    <lastmod>{avui}</lastmod>\n    <priority>{prioritat}</priority>\n  </url>')
    url('https://quivoto.cat/', '1.0',
        (('ca', 'https://quivoto.cat/'), ('es', 'https://quienvoto.es/'), ('x-default', 'https://quivoto.cat/')))
    for nom in ('privadesa', 'avis-legal'):
        alternatives = (('ca', f'https://quivoto.cat/{nom}.html'), ('es', f'https://quivoto.cat/es/{nom}.html'),
                        ('x-default', f'https://quivoto.cat/{nom}.html'))
        url(f'https://quivoto.cat/{nom}.html', '0.3', alternatives)
        url(f'https://quivoto.cat/es/{nom}.html', '0.3', alternatives)
    # La sala de premsa: en català es diu premsa.html i en castellà prensa.html,
    # que és com la buscarà qui la busqui. Val més que les legals: és la pàgina
    # que un periodista ha de trobar.
    alternatives = (('ca', 'https://quivoto.cat/premsa.html'), ('es', 'https://quivoto.cat/es/prensa.html'),
                    ('x-default', 'https://quivoto.cat/premsa.html'))
    url('https://quivoto.cat/premsa.html', '0.5', alternatives)
    url('https://quivoto.cat/es/prensa.html', '0.5', alternatives)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
           '\n'.join(urls) + '\n</urlset>\n')
    open(os.path.join(OUT, 'sitemap.xml'), 'w', encoding='utf-8').write(xml)


def json_ld(t):
    """El lloc web i qui el publica, en la mateixa forma que fa servir
    l'Observatori (packages/pipeline/src/publish/seo.ts): un sol @id per a
    l'organització perquè els cercadors lliguin totes les pàgines al mateix
    editor. Sense SearchAction: el cercador de l'Observatori no llegeix cap
    paràmetre `?q=` de l'adreça, i anunciar-ne un seria mentir."""
    import json
    org_id = 'https://quivoto.cat/#organitzacio'
    return json.dumps({
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'Organization', '@id': org_id, 'name': 'quivoto', 'url': 'https://quivoto.cat/',
             'logo': 'https://quivoto.cat/assets/og.png',
             'legalName': 'Damos en el Blanco, S.L.'},
            {'@type': 'WebSite', '@id': f"https://{t['domini']}/#lloc", 'name': t['marca'],
             'url': f"https://{t['domini']}/", 'description': t['desc'], 'inLanguage': t['lang'],
             'publisher': {'@id': org_id}},
        ],
    }, ensure_ascii=False)


def build_404(lang):
    t = T[lang]
    es = lang == 'es'
    sub = OUT if lang == 'ca' else os.path.join(OUT, 'es')
    title = 'Pàgina no trobada' if not es else 'Página no encontrada'
    lead = ('Aquesta papereta no és en aquesta urna. Potser l’adreça ha canviat o hi ha una lletra de més.' if not es else
            'Esta papeleta no está en esta urna. Puede que la dirección haya cambiado o sobre alguna letra.')
    actions = ('<a class="boto" href="/">Torna a l’inici</a><a class="boto secundari" href="/observatori/">Obre l’Observatori</a>' if not es else
               '<a class="boto" href="/es/">Volver al inicio</a><a class="boto secundari" href="https://quivoto.cat/observatori/">Abrir el Observatorio</a>')
    page = f'''<!doctype html><html lang="{t['lang']}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 · {title} · {t['marca']}</title><meta name="robots" content="noindex, nofollow"><meta name="description" content="{lead}"><link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/assets/styles.css?v={versio('styles.css')}"><link rel="stylesheet" href="/assets/cercador.css?v={versio('cercador.css')}">{GOOGLE_TAG}<style>.error404{{max-width:760px;margin:0 auto;padding:clamp(70px,12vw,150px) var(--e3);text-align:center}}.error404 .codi{{font-family:var(--display);font-weight:900;font-size:clamp(5rem,20vw,11rem);line-height:.75;color:var(--coral);text-shadow:5px 5px 0 var(--ink);-webkit-text-stroke:2px var(--ink)}}.error404 h1{{margin-top:var(--e4)}}.error404 .accions{{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:var(--e3)}}.error404 .secundari{{background:var(--paper);color:var(--ink)}}</style></head><body><a class="salta" href="#contingut">{t['salta']}</a>{capcalera(lang)}{cercador_compartit(lang)}<main id="contingut" class="error404"><div class="codi" aria-hidden="true">404</div><p class="micro">{title}</p><h1>{title}</h1><p class="entrada">{lead}</p><div class="accions">{actions}</div></main>{footer_complet(t)}<script src="/assets/cercador.js?v={versio('cercador.js')}" defer></script></body></html>'''
    open(os.path.join(sub, '404.html'), 'w', encoding='utf-8').write(page)


# ---------------------------------------------------------------------------
# La sala de premsa: web/public/premsa.html i es/prensa.html.
#
# És la pàgina que obre un periodista que ha d'escriure sobre quivoto i no
# vol trucar: què és, qui ho fa, les xifres, com treballem, el logotip i la
# paleta, com citar-nos i on escriure. Tot el que diu ja és al web —l'avís
# legal, el peu, l'Observatori— i les xifres es llegeixen dels fitxers que
# publica el generador, mai s'escriuen a mà: una xifra copiada envelleix sola
# i aquesta pàgina la copiaran tal qual.
#
# No hi ha biografies ni càrrecs: el web diu «un projecte d'Humbert Blanco
# gràcies a Damos en el Blanco» i el titular legal de l'avís, i és tot el que
# aquí es repeteix.

PREMSA_T = {
 'ca': {
  'nom':'premsa', 'titol':'Premsa',
  'desc':'Sala de premsa de quivoto: què és, qui hi ha darrere, les xifres de l’Observatori, com treballem, logotip i paleta, i com citar-nos. Contacte: hola@quivoto.cat.',
  'lead':'El que necessita un periodista per explicar quivoto sense haver-nos de trucar: què és, qui ho fa, les xifres, com treballem i els materials per publicar. Si hi falta alguna cosa, escriu a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>.',
  'sumari_aria':'Apartats d’aquesta pàgina',
  'sumari':[('que-es','Què és'),('redaccio','La redacció'),('xifres','En xifres'),('com-treballem','Com treballem'),
            ('materials','Materials'),('citar','Com citar-nos'),('contacte','Contacte'),('notes','Notes de premsa')],
  'que_titol':'Què és quivoto',
  'que':[
    'quivoto són dues coses. Una <strong>brúixola electoral</strong> per a les municipals del 23 de maig del 2027: 25 afirmacions sobre el teu municipi i amb quin partit coincideixes. I l’<a href="/observatori/">Observatori municipal</a>, que ja es pot obrir: una fitxa per a cadascun dels {municipis} municipis de Catalunya amb qui hi mana, què s’hi ha votat des del 1979, com estan els comptes i què paga la gent.',
    'Tot surt de fonts oficials, no hi ha cap model de llenguatge pel mig, els càlculs es poden repetir i les dades derivades són obertes, amb llicència CC BY 4.0.'],
  'redaccio_titol':'La redacció',
  'redaccio':[
    'quivoto és un projecte d’<a href="https://x.com/humbertblanco">Humbert Blanco</a> gràcies a <a href="https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits">Damos en el Blanco</a>. El titular legal és <strong>Damos en el Blanco, S.L.</strong>, amb seu a Sant Just Desvern (Barcelona); les dades completes són a l’<a href="/avis-legal.html">avís legal</a>. El codi és a <a href="https://github.com/humbertblanco/quivoto">GitHub</a>.',
    'No som un mitjà de comunicació i no rebem diners de cap partit, candidatura ni administració. Publiquem dades i expliquem com les hem calculades.'],
  'xifres_titol':'En xifres',
  'xifres_lab':{'municipis':'municipis, una fitxa cadascun','electes':'electes al ple','candidatures':'pàgines de candidatura',
                'comarques':'comarques','partits':'partits amb pàgina','fonts':'fonts oficials','1979':'des de quan hi ha resultats: dotze eleccions'},
  'xifres_nota':'Xifres de l’Observatori actualitzat el {data}. Les tres primeres les escriu el generador a cada publicació; les altres es compten en fer aquesta pàgina.',
  'xifres_nota_sense':'Les xifres es compten en fer aquesta pàgina a partir del que hi ha publicat a l’Observatori.',
  'com_titol':'Com treballem',
  'com':[
    'Cada xifra porta la font al costat: el conjunt de dades, l’organisme que el publica i l’any.',
    'No fem veredictes. Que un ajuntament tingui més deute o un termini de pagament més llarg vol dir exactament això, no que ho faci malament.',
    'Un buit no és un zero. Si una font no cobreix un municipi, la fitxa ho diu; no estimem res.',
    'Les preguntes de la brúixola surten de les actes del ple —mocions, ordenances, modificacions de pressupost— i cada afirmació enllaça el punt votat.',
    'Comparem municipis de mida semblant, i el fitxer de dades sencer es pot baixar per repetir qualsevol càlcul.'],
  'com_enllacos':[('/observatori/dades/','Les dades i l’esquema, camp a camp'),('/observatori/dades/#fonts','El catàleg de fonts, mètodes i llicències')],
  'materials_titol':'Materials',
  'materials_intro':'Fitxers per publicar tal qual. Feu servir el logotip sense deformar-lo ni canviar-li els colors, sobre paper o blanc. El disseny, la mascota i les il·lustracions no entren a la llicència CC BY: es poden reproduir per parlar de quivoto, no per a altres usos.',
  'fitxers':[
    ('logo','Logotip','SVG, vectorial. El nom amb la papereta com a «o».','logo.svg'),
    ('mascota','La papereta','SVG. La mascota: una papereta amb cara.','mascota.svg'),
    ('favicon','Icona','SVG quadrat, per a llistes i avatars.','favicon.svg'),
    ('og','Imatge social','PNG de 1200 × 630, la de la portada.','og.png')],
  'baixa':'Baixa',
  'paleta_titol':'La paleta',
  'paleta':[('Paper','FBF7EE'),('Tinta','1E1B2E'),('Coral','E2735A'),('Menta','BFE8D2'),('Lavanda','C9C4F2'),('Préssec','FFD8B8')],
  'tipus_titol':'Les tipografies',
  'tipus':[('gabarito','Gabarito','Títols i xifres, en negreta (700 i 900).'),('nunito','Nunito Sans','Text de lectura. Totes dues són a Google Fonts i les servim des del nostre domini.')],
  'socials_titol':'Les imatges socials',
  'socials':'Cada pàgina de l’Observatori té la seva imatge de 1200 × 630, la que surt en compartir-la. Serveixen per il·lustrar una peça sobre quivoto, citant-nos. Les de persones porten un retrat amb la seva pròpia llicència, que consta a la fitxa: comproveu-la abans de reutilitzar-les.',
  'socials_ex':[('/observatori/og/barcelona.png','un municipi: /observatori/og/<i>municipi</i>.png'),
                ('/observatori/og/c/barcelones.png','una comarca: /observatori/og/c/<i>comarca</i>.png'),
                ('/observatori/og/partit/erc.png','un partit: /observatori/og/partit/<i>partit</i>.png'),
                ('/observatori/og/observatori.png','l’Observatori sencer')],
  'citar_titol':'Com citar-nos',
  'cita':'quivoto, Observatori municipal, {data}. https://quivoto.cat/observatori/',
  'citar':[
    'Per a una dada concreta, enllaceu la fitxa i poseu-hi la data de generació que hi surt.',
    'Les nostres dades derivades són <a href="https://creativecommons.org/licenses/by/4.0/deed.ca">CC BY 4.0</a>; les originals mantenen la llicència de cada font, i cal citar-la també. No presenteu una xifra nostra com si fos oficial: és el nostre càlcul a partir d’una font oficial.'],
  'contacte_titol':'Contacte de premsa',
  'contacte':'hola@quivoto.cat',
  'contacte_text':'Si és sobre una dada, digueu-nos el municipi i l’enllaç de la fitxa.',
  'xarxes':[('https://x.com/humbertblanco','Humbert Blanco a X'),('https://github.com/humbertblanco/quivoto','El codi a GitHub'),('https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits','Damos en el Blanco')],
  'notes_titol':'Notes de premsa',
  'notes':[('2026-09','Setembre del 2026','quivoto obre l’Observatori municipal amb els 947 municipis',
            'Una fitxa per municipi amb qui hi mana i amb qui, el ple amb nom i cognoms, els resultats de les dotze eleccions des del 1979, els comptes i els impostos. Tot fet amb dades obertes i cap model de llenguatge pel mig, i els 1.894 fitxers de dades es poden baixar en CSV i JSON.')],
  'notes_avis':'<b>Esborrany intern, encara no indexat.</b> L’Observatori es fa a la vista de tothom i encara no està revisat del tot. Quan s’obri, ho direm aquí.',
  'tornar':'Tornar a l’inici',
 },
 'es': {
  'nom':'prensa', 'titol':'Prensa',
  'desc':'Sala de prensa de quivoto: qué es, quién hay detrás, las cifras del Observatorio, cómo trabajamos, logotipo y paleta, y cómo citarnos. Contacto: hola@quivoto.cat.',
  'lead':'Lo que necesita un periodista para explicar quivoto sin tener que llamarnos: qué es, quién lo hace, las cifras, cómo trabajamos y los materiales para publicar. Si falta algo, escribe a <a href="mailto:hola@quivoto.cat">hola@quivoto.cat</a>.',
  'sumari_aria':'Apartados de esta página',
  'sumari':[('que-es','Qué es'),('redaccio','La redacción'),('xifres','En cifras'),('com-treballem','Cómo trabajamos'),
            ('materials','Materiales'),('citar','Cómo citarnos'),('contacte','Contacto'),('notes','Notas de prensa')],
  'que_titol':'Qué es quivoto',
  'que':[
    'quivoto son dos cosas. Una <strong>brújula electoral</strong> para las municipales del 23 de mayo de 2027: 25 afirmaciones sobre tu municipio y con qué partido coincides. Y el <a href="https://quivoto.cat/observatori/">Observatorio municipal</a>, que ya se puede abrir: una ficha para cada uno de los {municipis} municipios de Cataluña con quién manda, qué se ha votado desde 1979, cómo están las cuentas y qué paga la gente. En castellano la portada se llama quienvoto; el Observatorio está en catalán, que es la lengua de las fuentes oficiales.',
    'Todo sale de fuentes oficiales, no hay ningún modelo de lenguaje de por medio, los cálculos se pueden repetir y los datos derivados son abiertos, con licencia CC BY 4.0.'],
  'redaccio_titol':'La redacción',
  'redaccio':[
    'quivoto es un proyecto de <a href="https://x.com/humbertblanco">Humbert Blanco</a> gracias a <a href="https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits">Damos en el Blanco</a>. El titular legal es <strong>Damos en el Blanco, S.L.</strong>, con sede en Sant Just Desvern (Barcelona); los datos completos están en el <a href="/es/avis-legal.html">aviso legal</a>. El código está en <a href="https://github.com/humbertblanco/quivoto">GitHub</a>.',
    'No somos un medio de comunicación y no recibimos dinero de ningún partido, candidatura ni administración. Publicamos datos y explicamos cómo los hemos calculado.'],
  'xifres_titol':'En cifras',
  'xifres_lab':{'municipis':'municipios, una ficha cada uno','electes':'electos en el pleno','candidatures':'páginas de candidatura',
                'comarques':'comarcas','partits':'partidos con página','fonts':'fuentes oficiales','1979':'desde cuándo hay resultados: doce elecciones'},
  'xifres_nota':'Cifras del Observatorio actualizado el {data}. Las tres primeras las escribe el generador en cada publicación; las demás se cuentan al hacer esta página.',
  'xifres_nota_sense':'Las cifras se cuentan al hacer esta página a partir de lo publicado en el Observatorio.',
  'com_titol':'Cómo trabajamos',
  'com':[
    'Cada cifra lleva la fuente al lado: el conjunto de datos, el organismo que lo publica y el año.',
    'No hacemos veredictos. Que un ayuntamiento tenga más deuda o un plazo de pago más largo significa exactamente eso, no que lo haga mal.',
    'Un hueco no es un cero. Si una fuente no cubre un municipio, la ficha lo dice; no estimamos nada.',
    'Las preguntas de la brújula salen de las actas del pleno —mociones, ordenanzas, modificaciones de presupuesto— y cada afirmación enlaza el punto votado.',
    'Comparamos municipios de tamaño parecido, y el fichero de datos entero se puede descargar para repetir cualquier cálculo.'],
  'com_enllacos':[('https://quivoto.cat/observatori/dades/','Los datos y el esquema, campo a campo'),('https://quivoto.cat/observatori/dades/#fonts','El catálogo de fuentes, métodos y licencias')],
  'materials_titol':'Materiales',
  'materials_intro':'Ficheros para publicar tal cual. Usad el logotipo sin deformarlo ni cambiarle los colores, sobre papel o blanco. El diseño, la mascota y las ilustraciones no entran en la licencia CC BY: se pueden reproducir para hablar de quivoto, no para otros usos.',
  'fitxers':[
    ('logo','Logotipo','SVG, vectorial. El nombre con la papeleta como «o».','logo.svg'),
    ('mascota','La papeleta','SVG. La mascota: una papeleta con cara.','mascota.svg'),
    ('favicon','Icono','SVG cuadrado, para listas y avatares.','favicon.svg'),
    ('og','Imagen social','PNG de 1200 × 630, la de la portada.','og.png')],
  'baixa':'Descarga',
  'paleta_titol':'La paleta',
  'paleta':[('Papel','FBF7EE'),('Tinta','1E1B2E'),('Coral','E2735A'),('Menta','BFE8D2'),('Lavanda','C9C4F2'),('Melocotón','FFD8B8')],
  'tipus_titol':'Las tipografías',
  'tipus':[('gabarito','Gabarito','Títulos y cifras, en negrita (700 y 900).'),('nunito','Nunito Sans','Texto de lectura. Las dos están en Google Fonts y las servimos desde nuestro dominio.')],
  'socials_titol':'Las imágenes sociales',
  'socials':'Cada página del Observatorio tiene su imagen de 1200 × 630, la que sale al compartirla. Sirven para ilustrar una pieza sobre quivoto, citándonos. Las de personas llevan un retrato con su propia licencia, que consta en la ficha: comprobadla antes de reutilizarlas.',
  'socials_ex':[('https://quivoto.cat/observatori/og/barcelona.png','un municipio: /observatori/og/<i>municipio</i>.png'),
                ('https://quivoto.cat/observatori/og/c/barcelones.png','una comarca: /observatori/og/c/<i>comarca</i>.png'),
                ('https://quivoto.cat/observatori/og/partit/erc.png','un partido: /observatori/og/partit/<i>partido</i>.png'),
                ('https://quivoto.cat/observatori/og/observatori.png','el Observatorio entero')],
  'citar_titol':'Cómo citarnos',
  'cita':'quivoto, Observatori municipal, {data}. https://quivoto.cat/observatori/',
  'citar':[
    'Para un dato concreto, enlazad la ficha y poned la fecha de generación que aparece en ella.',
    'Nuestros datos derivados son <a href="https://creativecommons.org/licenses/by/4.0/deed.es">CC BY 4.0</a>; los originales mantienen la licencia de cada fuente, y hay que citarla también. No presentéis una cifra nuestra como si fuera oficial: es nuestro cálculo a partir de una fuente oficial.'],
  'contacte_titol':'Contacto de prensa',
  'contacte':'hola@quivoto.cat',
  'contacte_text':'Si es sobre un dato, decidnos el municipio y el enlace de la ficha.',
  'xarxes':[('https://x.com/humbertblanco','Humbert Blanco en X'),('https://github.com/humbertblanco/quivoto','El código en GitHub'),('https://damosenelblanco.com/?utm_source=quivoto&amp;utm_medium=referral&amp;utm_campaign=credits','Damos en el Blanco')],
  'notes_titol':'Notas de prensa',
  'notes':[('2026-09','Septiembre de 2026','quivoto abre el Observatorio municipal con los 947 municipios',
            'Una ficha por municipio con quién manda y con quién, el pleno con nombres y apellidos, los resultados de las doce elecciones desde 1979, las cuentas y los impuestos. Todo hecho con datos abiertos y ningún modelo de lenguaje de por medio, y los 1.894 ficheros de datos se pueden descargar en CSV y JSON.')],
  'notes_avis':'<b>Borrador interno, todavía no indexado.</b> El Observatorio se hace a la vista de todos y todavía no está revisado del todo. Cuando se abra, lo diremos aquí.',
  'tornar':'Volver al inicio',
 },
}

MESOS = {
  'ca': ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'],
  'es': ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
}

def data_llarga(iso, lang):
    """«2026-09-02» → «2 de setembre del 2026» / «2 de septiembre de 2026»."""
    a, m, d = (int(x) for x in iso.split('-'))
    mes = MESOS[lang][m - 1]
    if lang == 'ca':
        return f"{d} {'d’' if mes[0] in 'aeiou' else 'de '}{mes} del {a}"
    return f'{d} de {mes} de {a}'


def xifres_premsa():
    """Els recomptes de la sala de premsa, tots llegits del que hi ha publicat a
    web/public/observatori/ i cap escrit a mà.

    Municipis, electes i candidatures venen de xifres.json (els escriu el
    generador a cada publicació); les comarques i els partits són les carpetes
    que hi ha a c/ i a partit/; les fonts, `sources` de dades/fonts.json. El que
    no es pot comptar no surt: val més una pastilla menys que un número vell."""
    import json
    obs = os.path.join(OUT, 'observatori')
    x = xifres_observatori() or {}
    def carpetes(sub):
        cami = os.path.join(obs, sub)
        if not os.path.isdir(cami):
            return 0
        return sum(1 for n in os.listdir(cami) if os.path.isdir(os.path.join(cami, n)))
    try:
        with open(os.path.join(obs, 'dades', 'fonts.json'), encoding='utf-8') as f:
            fonts = len(json.load(f)['sources'])
    except (OSError, ValueError, KeyError, TypeError):
        fonts = 0
    return {'municipis': x.get('municipis', 0), 'electes': x.get('electes', 0),
            'candidatures': x.get('candidatures', 0), 'comarques': carpetes('c'),
            'partits': carpetes('partit'), 'fonts': fonts, 'generatedAt': x.get('generatedAt')}


def font_incrustada(fitxer):
    """El woff2 en base64 dins del mateix SVG, com fa og.ts amb les imatges
    socials: un SVG obert com a imatge no pot demanar cap fitxer extern, i sense
    la lletra incrustada el logotip sortiria en la tipografia de qui l'obre."""
    import base64
    with open(os.path.join(OUT, 'assets', 'fonts', fitxer), 'rb') as f:
        return f"url(data:font/woff2;base64,{base64.b64encode(f.read()).decode('ascii')}) format('woff2')"

# El fitxer llatí de Gabarito (pesos 400-900 en un de sol), el mateix que
# enllaça assets/fonts.css. El nom és el de Google Fonts.
GABARITO_LLATI = 'QGYtz_0dZAGKJJ4t3HtoW4XGnfBI.woff2'


def sense_parpelles(svg):
    """Fora les parpelles: les tanca el CSS del web (scaleY 0 i parpelleig), i
    en un fitxer solt no hi ha CSS. Sense treure-les, la cara sortiria amb dos
    rectangles blancs damunt dels ulls."""
    return re.sub(r'<g class="parpelles">.*?</g>', '', svg, flags=re.S)


def logo_svg():
    """El logotip net, a partir del mateix wordmark que fa `wordmark()`: el nom
    en Gabarito 900 amb la «o» final dibuixada com la papereta.

    Les mides surten de mesurar la marca tal com la pinta Chrome a la imatge
    social de l'Observatori (observatori/og/observatori.png, 34 px): «quivot»
    amb el seguiment de -0,05 em avança 2,56 em, i la «o» hi va a 0,03 em, que
    és el px de separació de la capçalera. `textLength` fixa aquella amplada
    perquè el resultat no depengui de qui obre el fitxer: si un visor no té la
    lletra incrustada, reparteix la diferència en l'espaiat i la «o» queda on
    toca. En vertical es repeteix l'alineació de la capçalera: línia de base a
    0,82 em i la «o» de la mida del cos, baixada 0,045 em."""
    S = 100
    marge = 8
    ample_text = round(2.56 * S)
    o_x = marge + ample_text + round(0.03 * S)
    o_y = marge + round(0.045 * S)
    W = o_x + S + marge
    H = o_y + S + marge
    base = marge + round(0.82 * S)
    cara = sense_parpelles(L.cara_marca(sclera=L.WHITE))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="quivoto">
  <title>quivoto</title>
  <style>@font-face{{font-family:Gabarito;font-weight:900;src:{font_incrustada(GABARITO_LLATI)}}}</style>
  <text x="{marge}" y="{base}" font-family="Gabarito, sans-serif" font-weight="900" font-size="{S}" fill="{L.INK}" textLength="{ample_text}" lengthAdjust="spacing">quivot</text>
  <g transform="translate({o_x} {o_y}) scale({S / 48:.4f})">
    <circle cx="24" cy="24" r="22" fill="{L.WHITE}" stroke="{L.INK}" stroke-width="3"/>
    <path d="M34 8 l6 6" stroke="{L.PEACH}" stroke-width="6" stroke-linecap="round"/>{cara}
  </g>
</svg>
'''


def mascota_svg():
    """La papereta com a fitxer solt: el mateix dibuix de `papereta()`, amb
    l'espai de noms que un fitxer necessita i sense les parpelles."""
    svg = sense_parpelles(L.papereta(240, cls='papereta'))
    return svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1) + '\n'


def escriu_materials():
    """Els dos fitxers que la sala de premsa ofereix i que no existien: el
    logotip i la mascota. Van a /assets/ amb el favicon i l'og.png, que ja hi
    eren. S'escriuen a cada generació, que no costa res, i així mai van
    desfasats del wordmark ni de la mascota."""
    for nom, cos in (('logo.svg', logo_svg()), ('mascota.svg', mascota_svg())):
        open(os.path.join(OUT, 'assets', nom), 'w', encoding='utf-8').write(cos)


def json_ld_premsa(lang, url, p):
    """La pàgina sobre l'organització, lligada al mateix @id que la portada i
    l'Observatori. Del qui som, només el que diu el web: nom legal, seu, correu,
    el codi i qui la fa; cap dada que no surti a l'avís legal o al peu."""
    import json
    org_id = 'https://quivoto.cat/#organitzacio'
    return json.dumps({
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'Organization', '@id': org_id, 'name': 'quivoto', 'url': 'https://quivoto.cat/',
             'logo': 'https://quivoto.cat/assets/og.png', 'legalName': 'Damos en el Blanco, S.L.',
             'email': 'hola@quivoto.cat',
             'address': {'@type': 'PostalAddress', 'addressLocality': 'Sant Just Desvern',
                         'addressRegion': 'Barcelona', 'addressCountry': 'ES'},
             'sameAs': ['https://github.com/humbertblanco/quivoto'],
             'founder': {'@type': 'Person', 'name': 'Humbert Blanco', 'url': 'https://x.com/humbertblanco'}},
            {'@type': 'AboutPage', '@id': url + '#pagina', 'url': url, 'name': p['titol'],
             'description': p['desc'], 'inLanguage': lang, 'about': {'@id': org_id},
             'isPartOf': {'@id': 'https://quivoto.cat/#lloc'}},
        ],
    }, ensure_ascii=False)


CSS_PREMSA = '''<style>
/* ---------- la sala de premsa ------------------------------------------
   Cada apartat és una fila: el número i el títol a l'esquerra, el cos a la
   dreta, com un índex de redacció. Sota 860px tot va en una columna. */
.premsa{max-width:var(--ample);margin:0 auto;padding:var(--e4) var(--e3) var(--e5)}
.premsa h1{font-size:clamp(2.4rem,7vw,4rem);margin-bottom:var(--e2)}
.premsa .lead{font-size:1.15rem;max-width:56ch;margin-bottom:var(--e3)}
.pr-sumari{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0 0 var(--e4);padding:0}
.pr-sumari a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;
  border:2px solid var(--vora);border-radius:var(--r-max);background:var(--paper-2);
  font-size:.88rem;font-weight:700;text-decoration:none}
.pr-sumari a:hover{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.pr-seccio{display:grid;gap:var(--e2) var(--e5);padding:var(--e4) 0;border-top:2.5px solid var(--ink);scroll-margin-top:var(--e2)}
@media(min-width:860px){.pr-seccio{grid-template-columns:minmax(0,13rem) minmax(0,1fr)}}
.pr-seccio h2{font-size:clamp(1.5rem,3vw,2rem)}
.pr-seccio .micro{margin-bottom:6px}
.pr-cos{max-width:64ch}
.pr-cos p:last-child{margin-bottom:0}
.pr-cos h3{font-size:1.1rem;margin:var(--e3) 0 var(--e2)}
.pr-cos h3:first-child{margin-top:0}

.pr-xifres{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.pr-xifres li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:3px 3px 0 var(--ink);padding:var(--e2)}
.pr-xifres b{display:block;font-family:var(--display);font-weight:900;line-height:.95;letter-spacing:-.04em;font-size:clamp(1.8rem,4vw,2.5rem)}
.pr-xifres span{font-size:.85rem;color:var(--ink-suau)}
.pr-nota{margin:var(--e2) 0 0;font-size:.85rem;color:var(--ink-suau)}

.pr-llista{list-style:none;margin:0 0 var(--e2);padding:0;display:grid;gap:12px}
.pr-llista li{padding-left:var(--e3);position:relative}
.pr-llista li::before{content:"";position:absolute;left:0;top:.45em;width:11px;height:11px;border-radius:50%;background:var(--coral);border:2px solid var(--ink)}
.pr-enllacos{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.pr-enllacos a,.pr-xarxes a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;
  border:2px solid var(--ink);border-radius:var(--r-max);background:var(--menta);font-weight:800;font-size:.9rem;text-decoration:none}
.pr-enllacos a:hover,.pr-xarxes a:hover{background:var(--ink);color:var(--paper)}

.pr-fitxers{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.pr-fitxers li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:3px 3px 0 var(--ink);padding:var(--e2);display:grid;gap:10px;align-content:start}
.pr-fitxers .mostra{display:flex;align-items:center;justify-content:center;min-height:130px;background:var(--paper);border-radius:var(--r-s);padding:var(--e2);overflow:hidden}
.pr-fitxers .mostra img,.pr-fitxers .mostra svg{max-width:100%;height:auto}
/* wordmark() escriu la mida en línia (és el que vol la capçalera); aquí ha de
   cabre en una targeta de 200px i per això es mana per damunt. La «o» segueix
   el cos de lletra, no els 64px del seu atribut. */
.pr-fitxers .mostra .marca{font-size:clamp(28px,7vw,44px)!important}
.pr-fitxers .mostra .marca-o{width:1em;height:1em}
.pr-fitxers b{font-family:var(--display);font-size:1.05rem}
.pr-fitxers small{display:block;color:var(--ink-suau);font-size:.8rem;line-height:1.4}
.pr-fitxers .fitxer{font-weight:800;font-size:.9rem}

.pr-paleta{list-style:none;margin:0 0 var(--e3);padding:0;display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
.pr-paleta li{border:2.5px solid var(--ink);border-radius:var(--r-m);overflow:hidden;background:var(--paper-2)}
.pr-paleta i{display:block;height:64px;background:var(--c);border-bottom:2px solid var(--ink)}
.pr-paleta b{display:block;padding:8px 12px 0;font-family:var(--display)}
.pr-paleta code{display:block;padding:0 12px 10px;font-size:.82rem;color:var(--ink-suau)}

.pr-tipus{display:grid;gap:var(--e2);grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin:0 0 var(--e3)}
.pr-tipus>div{border:2px dashed var(--vora);border-radius:var(--r-m);padding:var(--e2)}
.pr-tipus .gabarito{font-family:var(--display);font-weight:900;font-size:2rem;letter-spacing:-.03em;line-height:1;margin:0 0 6px}
.pr-tipus .nunito{font-family:var(--text);font-size:1.25rem;font-weight:700;margin:0 0 6px}
.pr-tipus small{color:var(--ink-suau);font-size:.82rem;line-height:1.4}
.pr-socials{margin:0;padding-left:1.1rem;font-size:.92rem}
.pr-socials li{margin-bottom:6px}

.pr-cita{margin:0 0 var(--e2);padding:var(--e2);background:var(--ink);color:var(--paper);border-radius:var(--r-m);
  font-size:.95rem;font-family:inherit;white-space:pre-wrap;overflow-wrap:anywhere}
.pr-contacte{display:inline-block;font-family:var(--display);font-weight:900;font-size:clamp(1.4rem,4vw,2rem);letter-spacing:-.02em;
  text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:5px;margin-bottom:var(--e2)}
.pr-xarxes{list-style:none;margin:var(--e2) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}

.pr-notes{list-style:none;margin:0;padding:0;display:grid;gap:var(--e2)}
.pr-notes li{background:var(--paper-2);border:2.5px solid var(--ink);border-radius:var(--r-m);box-shadow:4px 4px 0 var(--lavanda);padding:var(--e3)}
.pr-notes time{display:inline-block;background:var(--presec);border-radius:var(--r-max);padding:4px 11px;
  font-size:.66rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin-bottom:10px}
.pr-notes h3{font-size:1.3rem;margin:0 0 8px}
.pr-notes p{margin:0}
.pr-avis{margin:var(--e2) 0 0;background:var(--presec);border:2.5px solid var(--ink);border-radius:var(--r-m);padding:11px 15px;font-size:.88rem;line-height:1.45}
.premsa .tornar{margin-top:var(--e4)}
</style>'''


PREMSA = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titol} — {marca}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ca" href="https://quivoto.cat/premsa.html">
<link rel="alternate" hreflang="es" href="https://quivoto.cat/es/prensa.html">
<link rel="alternate" hreflang="x-default" href="https://quivoto.cat/premsa.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{marca}">
<meta property="og:title" content="{titol} — {marca}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://quivoto.cat/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{og_alt}">
<meta property="og:locale" content="{locale}">
<meta property="og:locale:alternate" content="{locale_alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{titol} — {marca}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://quivoto.cat/assets/og.png">
<meta name="theme-color" content="#FBF7EE">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/styles.css?v={css_v}">
<link rel="stylesheet" href="/assets/cercador.css?v={cercador_css_v}">
{estil_extra}
<script type="application/ld+json">
{json_ld}
</script>
{google_tag}
</head>
<body>
<a class="salta" href="#contingut">{salta}</a>
{capcalera}
{cercador}
<main id="contingut" class="premsa">
<h1>{titol}</h1>
<p class="lead">{lead}</p>
<nav aria-label="{sumari_aria}"><ul class="pr-sumari">
{sumari}
</ul></nav>

<section class="pr-seccio" id="que-es">
  <div><p class="micro">01</p><h2>{que_titol}</h2></div>
  <div class="pr-cos">
{que}
  </div>
</section>

<section class="pr-seccio" id="redaccio">
  <div><p class="micro">02</p><h2>{redaccio_titol}</h2></div>
  <div class="pr-cos">
{redaccio}
  </div>
</section>

<section class="pr-seccio" id="xifres">
  <div><p class="micro">03</p><h2>{xifres_titol}</h2></div>
  <div>
    <ul class="pr-xifres">
{xifres}
    </ul>
    <p class="pr-nota">{xifres_nota}</p>
  </div>
</section>

<section class="pr-seccio" id="com-treballem">
  <div><p class="micro">04</p><h2>{com_titol}</h2></div>
  <div class="pr-cos">
    <ul class="pr-llista">
{com}
    </ul>
    <ul class="pr-enllacos">
{com_enllacos}
    </ul>
  </div>
</section>

<section class="pr-seccio" id="materials">
  <div><p class="micro">05</p><h2>{materials_titol}</h2></div>
  <div class="pr-cos">
    <p>{materials_intro}</p>
    <ul class="pr-fitxers">
{fitxers}
    </ul>
    <h3>{paleta_titol}</h3>
    <ul class="pr-paleta">
{paleta}
    </ul>
    <h3>{tipus_titol}</h3>
    <div class="pr-tipus">
{tipus}
    </div>
    <h3>{socials_titol}</h3>
    <p>{socials}</p>
    <ul class="pr-socials">
{socials_ex}
    </ul>
  </div>
</section>

<section class="pr-seccio" id="citar">
  <div><p class="micro">06</p><h2>{citar_titol}</h2></div>
  <div class="pr-cos">
    <pre class="pr-cita">{cita}</pre>
{citar}
  </div>
</section>

<section class="pr-seccio" id="contacte">
  <div><p class="micro">07</p><h2>{contacte_titol}</h2></div>
  <div class="pr-cos">
    <a class="pr-contacte" href="mailto:{contacte}">{contacte}</a>
    <p>{contacte_text}</p>
    <ul class="pr-xarxes">
{xarxes}
    </ul>
  </div>
</section>

<section class="pr-seccio" id="notes">
  <div><p class="micro">08</p><h2>{notes_titol}</h2></div>
  <div class="pr-cos">
    <ul class="pr-notes">
{notes}
    </ul>
    <p class="pr-avis">{notes_avis}</p>
  </div>
</section>

<p class="tornar"><a class="boto-secundari" href="{arrel}">{tornar}</a></p>
</main>
{footer}
<script src="/assets/cercador.js?v={cercador_js_v}" defer></script>
</body>
</html>
'''


def build_premsa(lang):
    """Escriu la sala de premsa de l'idioma i, de passada, el logotip i la
    mascota que hi enllaça."""
    t = T[lang]
    p = PREMSA_T[lang]
    es = lang == 'es'
    escriu_materials()
    x = xifres_premsa()
    municipis = f"{x['municipis']:,}".replace(',', '.') if x['municipis'] else '947'
    data = data_llarga(x['generatedAt'], lang) if x['generatedAt'] else None
    paragrafs = lambda ps: '\n'.join(f'    <p>{s.replace("{municipis}", municipis)}</p>' for s in ps)

    # Les pastilles de xifres: només les que s'han pogut comptar, i cada una amb
    # el seu nom, que és la regla dura de la casa.
    lab = p['xifres_lab']
    pastilles = [(x[k], lab[k]) for k in ('municipis', 'electes', 'candidatures', 'comarques', 'partits', 'fonts') if x[k]]
    pastilles.append(('1979', lab['1979']))
    xifres = '\n'.join(
      f'      <li><b>{n if isinstance(n, str) else f"{n:,}".replace(",", ".")}</b><span>{l}</span></li>'
      for n, l in pastilles)

    # Les mostres dels fitxers: el wordmark i la mascota es pinten amb el CSS
    # de la pàgina (que és qui anima les parpelles); el favicon i l'og, com a
    # imatges, que és com són.
    mostres = {
      'logo': wordmark(T['ca'], 64),
      'mascota': L.papereta(96),
      'favicon': '<img src="/assets/favicon.svg" width="72" height="72" alt="">',
      'og': '<img src="/assets/og.png" width="240" height="126" alt="" loading="lazy">',
    }
    fitxers = '\n'.join(
      f'      <li><span class="mostra">{mostres[clau]}</span><b>{nom}</b><small>{desc}</small>'
      f'<a class="fitxer" href="/assets/{fitxer}" download>{p["baixa"]} {fitxer}</a></li>'
      for clau, nom, desc, fitxer in p['fitxers'])
    paleta = '\n'.join(
      f'      <li><i style="--c:#{hexa}"></i><b>{nom}</b><code>#{hexa}</code></li>' for nom, hexa in p['paleta'])
    tipus = '\n'.join(
      f'      <div><p class="{cls}">{nom}</p><small>{desc}</small></div>' for cls, nom, desc in p['tipus'])
    socials_ex = '\n'.join(f'      <li><a href="{u}">{u}</a> — {d}</li>' for u, d in p['socials_ex'])
    cita = p['cita'].replace('{data}', data or ('AAAA-MM-DD'))
    notes = '\n'.join(
      f'      <li><time datetime="{iso}">{quan}</time><h3>{tit}</h3><p>{txt}</p></li>'
      for iso, quan, tit, txt in p['notes'])

    url = f"https://quivoto.cat/{'es/' if es else ''}{p['nom']}.html"
    pagina = PREMSA.format(
      lang=lang, marca=t['marca'], titol=p['titol'], desc=p['desc'], url=url, og_alt=t['og_alt'],
      locale=t['locale'], locale_alt=t['locale_alt'], css_v=versio('styles.css'),
      estil_extra=CSS_PREMSA, json_ld=json_ld_premsa(lang, url, p), google_tag=GOOGLE_TAG,
      salta=t['salta'], capcalera=capcalera(lang), lead=p['lead'], sumari_aria=p['sumari_aria'],
      sumari='\n'.join(f'  <li><a href="#{i}">{s}</a></li>' for i, s in p['sumari']),
      que_titol=p['que_titol'], que=paragrafs(p['que']),
      redaccio_titol=p['redaccio_titol'], redaccio=paragrafs(p['redaccio']),
      xifres_titol=p['xifres_titol'], xifres=xifres,
      xifres_nota=p['xifres_nota'].replace('{data}', data) if data else p['xifres_nota_sense'],
      com_titol=p['com_titol'], com='\n'.join(f'      <li>{s}</li>' for s in p['com']),
      com_enllacos='\n'.join(f'      <li><a href="{u}">{s}</a></li>' for u, s in p['com_enllacos']),
      materials_titol=p['materials_titol'], materials_intro=p['materials_intro'], fitxers=fitxers,
      paleta_titol=p['paleta_titol'], paleta=paleta, tipus_titol=p['tipus_titol'], tipus=tipus,
      socials_titol=p['socials_titol'], socials=p['socials'], socials_ex=socials_ex,
      citar_titol=p['citar_titol'], cita=cita, citar=paragrafs(p['citar']),
      contacte_titol=p['contacte_titol'], contacte=p['contacte'], contacte_text=p['contacte_text'],
      xarxes='\n'.join(f'      <li><a href="{u}">{s}</a></li>' for u, s in p['xarxes']),
      notes_titol=p['notes_titol'], notes=notes, notes_avis=p['notes_avis'],
      arrel='/es/' if es else '/', tornar=p['tornar'], footer=footer_complet(t),
      **ctx_cercador(lang))
    sub = os.path.join(OUT, 'es') if es else OUT
    open(os.path.join(sub, p['nom'] + '.html'), 'w', encoding='utf-8').write(pagina)


def dies_restants():
    import datetime
    return (datetime.date(2027, 5, 23) - datetime.date.today()).days

def build(lang):
    t = dict(T[lang])
    d = dies_restants()
    ctx = dict(t)
    ctx['google_tag'] = GOOGLE_TAG
    ctx['compte_tpl'] = html.escape(t['compte'], quote=True)
    ctx['compte'] = t['compte'].format(dies=d)
    ctx['capcalera'] = capcalera(lang)
    ctx['css_v'] = versio('styles.css')
    ctx['mascota'] = L.papereta(210)
    ctx['dif_items'] = llista_editorial(t['dif'])
    ctx['com_steps'] = passos(t['com'])
    ctx['veinat_items'] = parada(t)
    ctx['xifres'] = xifres(t)
    ctx['obs_xifres_items'] = obs_xifres(t)
    ctx['obs_reixa_items'] = obs_reixa(t)
    ctx['prova'] = prova_html(t)
    ctx['casella'] = casella_hero(t)
    ctx.update(ctx_cercador(lang))
    ctx['estil_extra'] = CSS_EXTRA
    ctx['mascota_petita'] = L.papereta(150)
    ctx['footer'] = footer_complet(t)
    ctx['json_ld'] = json_ld(t)
    page = PAGE.format(**ctx)
    grac = GRACIES.format(**{**ctx, 'mascota': L.papereta(150)})
    sub = OUT if lang == 'ca' else os.path.join(OUT, 'es')
    os.makedirs(sub, exist_ok=True)
    comprova_cercador(page, sub)
    open(os.path.join(sub, 'index.html'), 'w', encoding='utf-8').write(page)
    open(os.path.join(sub, 'gracies.html'), 'w', encoding='utf-8').write(grac)
    return len(page)


def comprova_cercador(page, sub):
    """La portada porta el cercador compartit i cap resta del vell.

    És la prova de la landing: es passa a cada generació, sense cap eina més,
    i peta abans d'escriure res si la pàgina no té la ranura del botó a la
    capçalera, la casella del hero, el diàleg o els dos fitxers de /assets/,
    o si encara hi queda la secció «Busca el teu municipi o electe» que
    tenia el seu propi guió."""
    ha_de_tenir = ('class="ranura-cerca"', 'data-cerca-camp', '<dialog class="cercador"',
                   'data-base="/observatori/"', 'href="/assets/cercador.css?v=',
                   'src="/assets/cercador.js?v=', 'defer')
    no_pot_tenir = ('cerca-home', 'cerca-home-camp', "fetch('/observatori/cerca.json')")
    for tros in ha_de_tenir:
        if tros not in page:
            raise SystemExit(f'{sub}/index.html: hi falta {tros!r}')
    for tros in no_pot_tenir:
        if tros in page:
            raise SystemExit(f'{sub}/index.html: encara hi ha el cercador vell ({tros!r})')

if __name__ == '__main__':
    for lg in ('ca', 'es'):
        n = build(lg)
        build_legal(lg)
        build_404(lg)
        build_premsa(lg)
        print(f'  web/public/{"" if lg=="ca" else "es/"}index.html  ({n//1024} kB)')
    build_sitemap()
    print('Landing generada. Dies fins al 23-05-2027:', dies_restants())
