# Vilanova i la Geltrú: conjunt bloquejat per aparellament de punts

Revisió feta el 31 d'agost de 2026 sobre el corpus AOC/Acteca del mandat.

- Documents recuperats: **47**.
- Documents llegibles i segmentables: **46 de 47**.
- Punts detectats: **1.034**; votacions detectades: **817**; votacions no unànimes: **733**.

La cobertura documental és àmplia, però el format d'aquestes actes fa que l'extractor associï
en molts casos el recompte amb un subtítol intern de l'expedient (per exemple «Pressupost del
projecte», «Conclusions» o una referència reglamentària) en lloc del títol del punt de l'ordre
del dia. El recompte pot ser literalment correcte i, alhora, quedar vinculat a la decisió
equivocada. Això impedeix garantir la traçabilitat punt → proposta → vot sense una lectura
manual completa o una correcció específica del segmentador.

Per tant, **no es crea `vilanova-i-la-geltru.json`** en aquest lot. No s'han convertit els 733
recomptes en preguntes automàticament perquè això inflaria el conjunt amb aparellaments no
verificats. La premsa pot orientar la revisió temàtica, però no substitueix aquest vincle.
