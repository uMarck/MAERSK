// Executado diariamente pelo GitHub Actions; não depende da cota de Vercel Blob.
const fs=require("node:fs/promises");
const path=require("node:path");
const {fetchPortal}=require("../lib/portal");
const file=path.join(__dirname,"..","data","manaus.json");
async function main(){
 const latest=await fetchPortal(80000);
 // Uma verificação bem-sucedida renova a data e o selo de confiabilidade,
 // mesmo que os locais não tenham mudado. Isso cria um registro por dia.
 const updated={...latest,atualizadoEm:new Date().toISOString(),fonte:"https://www.portalagendamentos.com.br/pt-br/site/devimportacao",origem:"coleta-automatica-github",desatualizado:false};
 await fs.writeFile(file,JSON.stringify(updated,null,2)+"\n");
 console.log("Programação de Manaus atualizada: "+updated.rows.length+" tipos e "+updated.dias.length+" dias.");
}
main().catch(error=>{console.error("Coleta não concluída; snapshot preservado:",error.message);process.exitCode=1});
