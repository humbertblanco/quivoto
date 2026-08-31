# Fonts candidates per a les fitxes personals

Inventari de fonts públiques que podem incorporar al pipeline. No s'hi afegeix
cap camp fins que la font tingui cobertura, llicència i una clau d'aparellament
verificables.

## Prioritat 1: fonts transversals

- **Càrrecs electes (AOC)**: registre global de persones, càrrec i partit. És la
  font base per detectar canvis i comprovar que una persona continua al ple.
- **Retribucions i indemnitzacions dels càrrecs electes (AOC)**: quan un
  ajuntament ho publica en CSV/XLSX, permet substituir una xifra agregada per
  l'import mensual o anual de la persona, sempre indicant pagador i exercici.
- **Cartipàs i òrgans de govern (AOC)**: delegacions, tinences d'alcaldia i
  composició de la junta de govern. Són càrrecs, no sous, i es mostraran com a
  funcions institucionals.
- **Actes i votacions (AOC / portals municipals)**: data, punt, resultat i vot
  per grup. Només s'atribueix a una persona quan el recompte del grup ho fa
  matemàticament inequívoc.

## Prioritat 2: activitat i transparència

- **Agenda institucional dels alts càrrecs**: només per als municipis que la
  publiquen en dades obertes; resum d'activitats per any, sense contactes ni
  dades de tercers.
- **Viatges, obsequis i invitacions de càrrecs electes**: indicadors de
  transparència amb import, organisme i data quan la font ho publica. Mai no es
  copiaran descripcions que continguin dades personals innecessàries.
- **Dret d'accés a la informació pública**: nombre de sol·licituds i resolució,
  com a context de transparència municipal, no com a atribut de cap persona.

## Prioritat 3: fonts supramunicipals i trajectòria

- **Diputacions, consells comarcals i AMB**: retribucions i càrrecs, amb el
  pagador separat del municipi i sense cap total sumat.
- **Registre electoral de la Generalitat**: candidatures, posició i resultats;
  les xifres són de la llista, no de la persona.
- **Wikidata i Wikimedia Commons**: trajectòria i fotografies només amb
  aparellament inequívoc, enllaç a l'ítem original i llicència explícita.

## Criteris d'entrada

1. URL estable i font identificable.
2. Llicència o règim de reutilització documentat.
3. Data d'actualització i període de la dada.
4. Clau d'aparellament robusta (codi d'ens, ID o nom inequívoc).
5. Test amb casos positius, absències i homònims.
6. Si la font no publica una dada, es mostra **no disponible**; mai no es
   converteix el buit en zero ni en una inferència.

