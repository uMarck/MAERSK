// Executado diariamente pelo GitHub Actions; não depende da cota de Vercel Blob.
const fs=require("node:fs/promises");
const path=require("node:path");
const {fetchPortal}=require("../lib/portal");
const file=path.join(__dirname,"..","data","manaus.json");
async function main(){
 const latest=await fetchPortal(80000);
 const old=JSON.parse(await fs.readFile(file,"utf8"));
 if(JSON.stringify({dias:latest.dias,rows:latest.rows})===JSON.stringify({dias:old.dias,rows:old.rows})){
  // Só gera commit quando o conteúdo da programação muda; a data da fonte não é falsificada.
  console.log("Programação idêntica: sem alterações nem novo deploy.");
  return;
 }
 const updated={...latest,atualizadoEm:new Date().toISOString(),fonte:"https://www.portalagendamentos.com.br/pt-br/site/devimportacao",origem:"coleta-automatica-github",desatualizado:false};
 await fs.writeFile(file,JSON.stringify(updated,null,2)+"\n");
 console.log("Programação de Manaus atualizada: "+updated.rows.length+" tipos e "+updated.dias.length+" dias.");
}
main().catch(error=>{console.error("Coleta não concluída; snapshot preservado:",error.message);process.exitCode=1});
