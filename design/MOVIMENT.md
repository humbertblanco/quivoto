# El moviment de quivoto

Aquest document mana. Si una pantalla necessita un moviment que no és aquí, primer
es discuteix aquí i després es fa. L'objectiu no és que quedi bonic: és que les
quatre pantalles semblin la mateixa mà.

La idea de fons: a quivoto les coses són **de paper**. El paper no fa fosos, no fa
degradats i no rellisca. S'enganxa, es despenja, cau i s'atura. Tot el sistema de
moviment surt d'aquí.

## Durades

Tres, definides a `design/prototip/base.css`. No se n'inventa cap quarta.

| Token | Valor | Quan |
|---|---|---|
| `--t-rapid` | 120 ms | Resposta al dit: botó premut, casella marcada, filtre canviat. Per sota no es veu; per sobre el control sembla endarrerit. |
| `--t-mig` | 240 ms | El gruix del sistema: entrades, targetes que arriben, obertures, confirmacions. |
| `--t-lent` | 420 ms | Recorreguts llargs de veritat: una barra de resultats que creix de zero, la mascota que travessa. Res que passi sovint pot durar tant. |
| `--t-pas` | 60 ms | No és una durada, és el graó entre dos elements d'una mateixa tanda. |

Un número que compta amunt és l'única excepció, i és deliberada: dura ~900 ms
perquè el que s'ha de percebre no és el moviment sinó **la magnitud** (35.799 vots
ha de trigar a arribar-hi).

## Corbes

Cap `ease` per defecte enlloc. `ease` és la corba de qui no n'ha triat cap.

| Token | Corba | Per a què |
|---|---|---|
| `--corba-seca` | `cubic-bezier(.2,0,.2,1)` | Controls. Surt de pressa i frena en sec: el botó ha d'anar allà on el dit ja l'ha posat. |
| `--corba-suau` | `cubic-bezier(.4,0,.2,1)` | Coses que entren o creixen. L'ull vol veure el trajecte. |
| `--corba-salt` | `cubic-bezier(.34,1.56,.64,1)` | Lleugerament elàstica. **Només** la mascota i la confirmació d'una resposta. És el que fa que una cosa sembli viva; fora d'aquí, mareja. |
| `--corba-sortida` | `cubic-bezier(.5,0,1,1)` | El que marxa. Arrenca de cop i s'accelera: qui se'n va no demana atenció mentre se'n va. |

Regla curta: **elàstic només per a coses amb cara.** Si té ulls, pot saltar. Si és
un control, no.

## Com s'escalona

- Escalonar és dir «aquestes peces van juntes», no fer un espectacle.
- El graó és `--t-pas` (60 ms) i el sostre són **8 elements**: a partir d'aquí,
  l'últim arribaria tan tard que semblaria que la pàgina s'ha encallat.
- S'escalona **per tanda**, no per posició al document: els elements que entren al
  mateix fotograma es reparteixen el retard entre ells. Baixar la pàgina no ha de
  fer que la vintena targeta esperi 1,2 s.
- Ho fa `moviment.escalona(nodes)`, i `moviment.observaEntrada()` ja el crida sol.
  Cap pantalla escriu `transition-delay` a mà.

## Què no s'anima mai, i per què

1. **`width`, `height`, `top`, `left`, `margin`, `padding`.** Provoquen *layout* a
   cada fotograma. Una barra de resultats s'anima amb `scaleX(var(--valor))`, mai
   amb `width`. Això no és una preferència: és la diferència entre 60 fps i 30 fps
   en un mòbil de fa quatre anys.
2. **Les ombres.** `box-shadow` es repinta. L'ombra dura canvia només en el moment
   d'un clic (`--t-rapid`, dos fotogrames) i prou; no hi ha cap ombra que respiri.
3. **Els colors de dades.** Un color de partit no fa fosos ni pulsa. Una dada no
   ha de cridar l'atenció més que una altra dada.
4. **El text.** Res de lletres que apareixen d'una en una. El text de quivoto és
   informació electoral: hi ha d'haver-hi tot des del primer fotograma.
5. **El `scroll`.** No hi ha parallax, no hi ha *scroll-jacking*, no hi ha res que
   es mogui perquè l'usuari baixa. L'usuari mana la pàgina.
6. **Res en bucle a la vista principal** llevat de la cara: parpelleig, mirada i
   surada. Són lentes (5,5–9 s), no demanen res i es poden ignorar.

## `prefers-reduced-motion`

No n'hi ha prou d'apagar les animacions: **la pantalla ha de ser igual de
comprensible sense cap.** El contracte és aquest:

- L'estat inicial amagat de `[data-entrada]` només existeix si `<html>` porta la
  classe `js-mou`, i `moviment.js` **no la posa** quan l'usuari demana menys
  moviment. Resultat: qui no vol animacions no veu mai res amagat, ni un instant.
- Si el JavaScript no carrega, `js-mou` tampoc no hi és: sense JS, tot es veu.
- Les xifres s'escriuen directament al valor final; no compten.
- Les barres es pinten al valor final sense transició, i sempre porten el número
  escrit al costat: una barra sola no és una dada llegible.
- Les parpelles queden **obertes** (aixafades, `scaleY(0)`) i la creu de la
  papereta queda **dibuixada**. Res no es queda a mig camí.
- L'estat d'un control no es diu mai només amb moviment: el botó triat també
  canvia de fons i guanya una vora doble.
- Es consulta en viu: si l'usuari canvia la preferència amb la pàgina oberta,
  `moviment.js` ho aplica a l'instant.

La consulta es fa **en un sol lloc**: `moviment.movimentReduit()` i
`moviment.siEsMou(anima, alDirecte)`. Cap pantalla crida `matchMedia` pel seu
compte.

## Rendiment

- Només `transform` i `opacity`. Si un efecte no es pot fer amb aquests dos, no es
  fa.
- `will-change` **només mentre dura l'animació**, i el posa i el treu `moviment.js`
  (`capaTemporal`). Cap `will-change` permanent al CSS: reservar una capa de
  composició per sempre és una de les maneres més fàcils que un mòbil modest vagi
  a empentes.
- Un sol `IntersectionObserver` per pantalla, i cada element s'observa **una
  vegada**: quan ha entrat, `unobserve`. Les coses no tornen a entrar en tornar a
  passar-hi.
- Res no s'anima fora de pantalla, i els comptadors s'aturen si la pestanya no es
  veu.
- El gra de paper és `position:fixed` amb `pointer-events:none`: no participa ni
  del scroll ni del *hit-testing*.
- Objectiu, i és mesurable: 60 fps a un mòbil modest i Lighthouse ≥ 90. Si una
  animació nova no hi arriba, l'animació nova és la que marxa.

## Els cinc moviments que existeixen

1. **Premuda** — el botó baixa 3 px i perd l'ombra. `--t-rapid`, `--corba-seca`.
2. **Entrada** — 10 px amunt i opacitat, escalonat. `--t-mig`, `--corba-suau`.
3. **Creixement** — barres i comptadors, de zero al valor. `--t-lent`,
   `--corba-suau`.
4. **Salt** — confirmació d'una resposta (`.pujada`). `--t-mig`, `--corba-salt`.
5. **Vida** — parpelleig, mirada, surada, la creu que es dibuixa. Bucle lent,
   sense interacció, ve de la identitat de la landing i no es toca.

Qualsevol cosa que no sigui una d'aquestes cinc, no existeix.
