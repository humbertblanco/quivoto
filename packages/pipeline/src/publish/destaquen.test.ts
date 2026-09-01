import { describe,expect,it } from "vitest";
import { calculaDestaquen,renderDestaquen,type FilaDestaquen } from "./destaquen";

const fila=(i:number,extra:Partial<FilaDestaquen>={}):FilaDestaquen=>({s:`poble-${i}`,n:`Poble ${i}`,c:"Comarca",p:1000+i,r:9,a:null,g:null,ar:null,ac:null,w:null,m:0,k:0,t:0,d:i*10,e:null,f:30+i,v:null,q:null,y:null,o:0,pt:50+i/10,rn:10_000+i*100,ra:2023,...extra});

describe("Destaquen",()=>{
  it("exigeix 90%, vint casos i una cohort temporal homogènia",()=>{
    expect(calculaDestaquen(Array.from({length:19},(_,i)=>fila(i)))).toEqual([]);
    const barrejats=Array.from({length:20},(_,i)=>fila(i,{ra:i<17?2023:2022}));
    expect(calculaDestaquen(barrejats).some(d=>d.titol.includes("Renda"))).toBe(false);
  });
  it("prefereix la mediana equivalent quan té cobertura",()=>{
    const renda=calculaDestaquen(Array.from({length:20},(_,i)=>fila(i,{rm:20_000+i,rma:2023}))).filter(d=>d.titol.toLowerCase().includes("renda"));
    expect(renda).toHaveLength(2); expect(renda.every(d=>d.titol.includes("Mediana"))).toBe(true);
  });
  it("mostra tots els empats, període, font i semàntica accessible",()=>{
    const html=renderDestaquen(Array.from({length:20},(_,i)=>fila(i,{pt:i<2?80:60})),"2026-09-01");
    expect(html).toContain("2 municipis empatats"); expect(html).toContain('../m/poble-0/'); expect(html).toContain('../m/poble-1/');
    expect(html).toContain("https://analisi.transparenciacatalunya.cat/d/irrv-2mfc"); expect(html).toContain("<dt>Període</dt><dd>2023</dd>");
    expect(html).toContain('aria-labelledby="titol-destacats"'); expect(html).toContain('class="mascota" aria-hidden="true"');
  });
  it("no publica camps sense any ni confon zero amb absència",()=>{
    const d=calculaDestaquen(Array.from({length:20},(_,i)=>fila(i,{pt:i===0?0:50,d:9999,pa:9,y:100})));
    expect(d.some(x=>x.valor==="0,00%")).toBe(true); expect(d.some(x=>/deute|aigua|transparència/i.test(x.titol))).toBe(false);
  });
});
