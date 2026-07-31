import * as X from "xlsx-js-style";
import { readFileSync } from "fs";
const load = (p:string)=>{const b=readFileSync(p);return X.read(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{type:"array",cellStyles:true});};
for (const f of ["/mnt/user-uploads/DESEMPENHO_SALTON_1_SEMESTRE_26_AJUSTADO.xlsx","/mnt/user-uploads/BI_DESEMPENHO_SALTON_FABIO_1_SEMESTRE_26_PERCENTUAIS.xlsx"]) {
  try { const wb=load(f); const ws=wb.Sheets[wb.SheetNames[0]];
    console.log("###",f.split("/").pop(),wb.SheetNames);
    for(const a of ["A1","C2","D2","E2","F2"]) console.log(" ",a,JSON.stringify(ws[a]));
  } catch(e:any){console.log("ERR",f,e.message);} }
