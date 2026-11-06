const cheerio = require("cheerio");
const { list, put } = require("@vercel/blob");
const URL = "https://www.portalagendamentos.com.br/pt-br/site/devimportacao";
const BLOB_PATH = "maersk/manaus-programacao.json";
const tidy = (v) => (v || "").replace(/\u00a0/g," ").replace(/\s*\n\s*/g," ").replace(/\s+/g," ").replace(/\/\s*\/+/g,"/").trim();
const normalize = (v) => tidy(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function parseManaus(html){
 const $=cheerio.load(html);
 let table=null;
 $("table").each((_, el)=>{
   const t=$(el); if(t.find("table").length) return;
   if(/split de devolu(?:ç|c)(?:ã|a)o\s*[-–]\s*manaus/i.test(normalize(t.text())) || /split de devolucao\s*[-–]\s*manaus/i.test(normalize(t.text()))) table=t;
 });
 if(!table) throw Error("Tabela de Manaus não encontrada no portal.");
 table.find("br").replaceWith(" / ");
 const lines=[];
 table.find("tr").each((_, tr)=>{
   const cells=[]; $(tr).children("th,td").each((__,td)=>{
     const colspan=Math.max(1,Math.min(20,parseInt($(td).attr("colspan")||"1",10)||1));
     const value=tidy($(td).text());
     for(let i=0;i<colspan;i++)cells.push(value);
   }); if(cells.length)lines.push(cells);
 });
 const headerAt=lines.findIndex(x=>/tipo\s*\/\s*dia/i.test(x[0]||""));
 if(headerAt<0) throw Error("Cabeçalho Tipo/Dia não encontrado.");
 const header=lines[headerAt];
 const indexes=header.map((_,i)=>i).filter(i=>i===0||normalize(header[i])!==normalize(header[i-1]));
 const dias=indexes.slice(1).map(i=>header[i]);
 const rows=lines.slice(headerAt+1).filter(x=>x.length>1&&tidy(x[0])).map(x=>({tipo:tidy(x[0]),valores:indexes.slice(1).map(i=>tidy(x[i])||"-")}));
 if(dias.length<5||rows.length<3||!rows.some(r=>/20|40/.test(r.tipo)))throw Error("Dados incompletos no portal; última programação mantida.");
 return {dias,rows};
}
async function fetchPortal(){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(URL,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; ConsultaDevolucaoManaus/2.0)","Accept":"text/html,application/xhtml+xml"},cache:"no-store"});
  if(!response.ok)throw Error("Portal retornou HTTP "+response.status);
  const buffer=await response.arrayBuffer();
  let html=new TextDecoder("utf-8").decode(buffer);
  if(html.includes("\uFFFD"))html=new TextDecoder("windows-1252").decode(buffer);
  return parseManaus(html);
 }finally{clearTimeout(timer)}
}
async function snapshot(){
 try{
  const found=await list({prefix:BLOB_PATH,limit:10});
  const item=found.blobs.find(x=>x.pathname===BLOB_PATH);
  if(!item)return null;
  const response=await fetch(item.downloadUrl||item.url,{cache:"no-store",signal:AbortSignal.timeout(4500)});
  if(!response.ok)throw Error("Não foi possível ler o histórico");
  const doc=await response.json();
  return Array.isArray(doc.dias)&&Array.isArray(doc.rows)?doc:null;
 }catch(e){console.error("Erro ao ler snapshot",e.message);return null}
}
async function refresh(){
 const values=await fetchPortal();
 const result={...values,atualizadoEm:new Date().toISOString(),fonte:URL};
 await put(BLOB_PATH,JSON.stringify(result),{access:"public",allowOverwrite:true,addRandomSuffix:false,contentType:"application/json"});
 return result;
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({erro:"Método não permitido"});
 const isCron=req.url?.startsWith("/api/cron");
 if(isCron && (!process.env.CRON_SECRET||req.headers.authorization!=="Bearer "+process.env.CRON_SECRET))return res.status(401).json({erro:"Não autorizado"});
 if(req.method==="POST"&&!isCron){
   const previous=await snapshot();
   if(previous&&Date.now()-Date.parse(previous.atualizadoEm)<120000)return res.status(429).json({erro:"Atualização recente. Tente novamente em 2 minutos.",...previous});
 }
 if(req.method==="GET"&&!isCron){
   const previous=await snapshot();
   if(previous)return res.status(200).json({...previous,origem:"historico"});
 }
 try{return res.status(200).json({...await refresh(),origem:"portal"})}
 catch(e){
   console.error("Consulta Maersk:",e.message);
   const previous=await snapshot();
   if(previous)return res.status(200).json({...previous,desatualizado:true,aviso:"Portal indisponível: exibindo última programação salva.",erroAtualizacao:e.message});
   return res.status(503).json({erro:"Portal temporariamente indisponível e ainda não há uma programação salva.",detalhe:e.message});
 }
};
module.exports.parseManaus=parseManaus;
