# -*- coding: utf-8 -*-
"""Retalla el sprite de quivoto als símbols que una pàgina fa servir de debò.

    from sprite_pagina import bloc
    bloc(['vei-habitatge', 'papereta-felic'])

El sprite sencer són 41 <symbol> i 26 kB. Cap pantalla no els gasta tots
(la brúixola en fa servir 1 de temàtica), i el bloc anava com a primer fill
del <body>: el parser havia de mastegar 26 kB d'SVG abans d'arribar a cap
píxel visible. Amb un sprite per pàgina i al final del document, la brúixola
passa de 26 kB a menys de 3.
"""
import os, re

ARREL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ARREL, 'design', 'prototip', 'assets', 'sprite.svg')

_RE = re.compile(r'<symbol id="([^"]+)".*?</symbol>', re.S)

def simbols():
    text = open(FONT, encoding='utf-8').read()
    return {m.group(1): m.group(0) for m in _RE.finditer(text)}

CAP = ('<!-- Sprite de quivoto, retallat als símbols que aquesta pàgina fa servir.\n'
       '     Generat per tools/build_sprite.py des de tools/icons_lib.py i retallat\n'
       "     per tools/sprite_pagina.py. NO s'edita a mà.\n"
       '     Va al FINAL del <body>: abans era el primer fill i el parser havia de\n'
       "     mastegar-lo sencer abans d'arribar a cap píxel visible. -->")

def bloc(ids, sagnat=''):
    tots = simbols()
    falten = [i for i in ids if i not in tots]
    if falten:
        raise SystemExit('símbols que no existeixen al sprite: %s' % falten)
    cos = '\n'.join(tots[i] for i in ids)
    return (f'{CAP}\n'
            '<svg xmlns="http://www.w3.org/2000/svg" class="sprite-quivoto" aria-hidden="true" '
            'style="position:absolute;width:0;height:0;overflow:hidden">\n<defs>\n'
            f'{cos}\n</defs>\n</svg>')
