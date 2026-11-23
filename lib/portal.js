const cheerio=require("cheerio");
const URLS=[
  "https://www.portalagendamentos.com.br/pt-br/site/devimportacao",
  "https://portalagendamentos.com.br/pt-br/site/devimportacao"
];
const tidy=s=>String(s??"").replace(/\u00a0/g," ").replace(/\s*\n\s*/g," ").replace(/\s+/g," ").replace(/\s*\/\s*$/, "").trim();
const norm=s=>tidy(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function parseManaus(html){
 const $=cheerio.load(html); let table=null;
 $("table").each((_,el)=>{
  const t=$(el);
  if(t.find("table").length) return;
  const s=norm(t.text());
  if(s.includes("split de devolucao")&&/split de devolucao\s*[-–]\s*manaus/.test(s))table=t;
 });
 if(!table)throw Error("Não foi encontrada a tabela de Manaus no HTML da fonte.");
 table.find("br").replaceWith(" / ");
 const lines=[];
 table.find("tr").each((_,tr)=>{
  const cells=[];
  $(tr).children("td,th").each((__,cell)=>{
   const colspan=Math.max(1,Math.min(15,parseInt($(cell).attr("colspan")||"1",10)||1));
   const v=tidy($(cell).text());
   for(let i=0;i<colspan;i++)cells.push(v);
  });
  if(cells.length)lines.push(cells);
 });
 const h=lines.findIndex(r=>/tipo\s*\/\s*dia/i.test(r[0]||""));
 if(h<0)throw Error("Cabeçalho Tipo/Dia não encontrado.");
 const head=lines[h], keep=head.map((_,i)=>i).filter(i=>i===0||norm(head[i])!==norm(head[i-1]));
 const dias=keep.slice(1).map(i=>head[i]);
 const rows=lines.slice(h+1).filter(r=>r.length>1&&/20|40/.test(r[0]||"")).map(r=>({
  tipo:tidy(r[0]),
  valores:keep.slice(1).map(i=>tidy(r[i])||"-")
 }));
 if(dias.length!==7||rows.length<6||!rows.some(r=>norm(r.tipo).includes("high cube"))||rows.some(r=>r.valores.length!==7))throw Error("Programação incompleta ou formato inesperado: snapshot antigo mantido.");
 return {dias,rows};
}
async function download(url,timeoutMs){
 const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeoutMs);
 try{
  const r=await fetch(url,{signal:ac.signal,headers:{"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36","Accept":"text/html,application/xhtml+xml","Accept-Language":"pt-BR,pt;q=0.9"},redirect:"follow",cache:"no-store"});
  if(!r.ok)throw Error("HTTP "+r.status+" em "+new URL(url).host);
  const buffer=await r.arrayBuffer();
  if(buffer.byteLength<10000||buffer.byteLength>15000000)throw Error("Documento de tamanho inválido");
  let html=new TextDecoder("utf-8").decode(buffer);
  if(html.includes("\uFFFD"))html=new TextDecoder("windows-1252").decode(buffer);
  return parseManaus(html);
 }finally{clearTimeout(timer)}
}
async function fetchPortal(timeoutMs=45000){
 // Rotas alternativas do mesmo domínio, com expiração independente.
 const urls=URLS.map(url=>download(url,timeoutMs));
 try{return await Promise.any(urls)}
 catch(e){const causes=(e.errors||[]).map(x=>String(x.message||x));throw Error("Consulta ao portal falhou: "+(causes.join("; ")||e.message))}
}
module.exports={parseManaus,fetchPortal,URLS};
