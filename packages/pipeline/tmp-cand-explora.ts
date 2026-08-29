import { openDb } from "@quivoto/db";
const { db, close } = await openDb();
const q = async (sql: string) => ((await (db as any).execute(sql as any)) as any).rows;
const K = (c:string)=>`regexp_replace(lower(translate(${c},'àáâãäçèéêëìíîïñòóôõöùúûüÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ·''’.','aaaaaceeeeiiiinooooouuuuAAAAACEEEEIIIINOOOOOUUUU   ')), '[^a-z0-9]', '', 'g')`;
// tier 3: agrupacio_sigles única dins del ple
const t3 = await q(`
  with pend as (select cm.id, cm.municipality_id, cm.term_id, ${K("cm.party_raw")} k from councillor_mandates cm
    where cm.group_id is null and not exists (select 1 from political_groups g where g.municipality_id=cm.municipality_id and g.term_id=cm.term_id and ${K("g.name")}=${K("cm.party_raw")}))
  select count(*) n from pend p where 1=(select count(*) from political_groups g join candidatures c on c.id=g.candidature_id
    where g.municipality_id=p.municipality_id and g.term_id=p.term_id and ${K("c.agrupacio_sigles")}=p.k)`);
console.log("tier3 agrupacio", JSON.stringify(t3));
// tier 4: denominacio
const t4 = await q(`
  with pend as (select cm.id, cm.municipality_id, cm.term_id, ${K("cm.party_raw")} k from councillor_mandates cm
    where cm.group_id is null and not exists (select 1 from political_groups g where g.municipality_id=cm.municipality_id and g.term_id=cm.term_id and ${K("g.name")}=${K("cm.party_raw")}))
  select count(*) n from pend p where 1=(select count(*) from political_groups g join candidatures c on c.id=g.candidature_id
    where g.municipality_id=p.municipality_id and g.term_id=p.term_id and (${K("c.agrupacio_sigles")}=p.k or ${K("c.denominacio")}=p.k))`);
console.log("tier3+4", JSON.stringify(t4));
await close();
