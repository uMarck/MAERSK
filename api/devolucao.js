// GET: leitura instantânea da última programação versionada no GitHub.
// POST: consulta manual ao portal; sem dependência de Vercel Blob.
const snapshot=require("../data/manaus.json");
const {fetchPortal}=require("../lib/portal");
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store, max-age=0");
 if(req.method==="GET")return res.status(200).json({...snapshot,origem:snapshot.origem||"snapshot-github"});
 if(req.method!=="POST")return res.status(405).json({erro:"Método não permitido"});
 try{
   const result=await fetchPortal(21000);
   return res.status(200).json({...result,atualizadoEm:new Date().toISOString(),fonte:"https://www.portalagendamentos.com.br/pt-br/site/devimportacao",origem:"consulta-manual",temporario:true,desatualizado:false,aviso:"Consulta manual concluída. A atualização persistente de todos os usuários ocorre pelo sincronizador diário do GitHub."});
 }catch(err){
   console.warn("Consulta manual indisponível:",err.message);
   return res.status(200).json({...snapshot,desatualizado:true,origem:"snapshot-github",aviso:"Não foi possível consultar o portal agora. Exibindo última programação salva ("+new Date(snapshot.atualizadoEm).toLocaleDateString("pt-BR",{timeZone:"America/Manaus"})+"). Confirme a devolução no portal oficial."});
 }
};
