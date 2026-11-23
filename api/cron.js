// O agendamento diário agora é um GitHub Action com snapshot versionado.
module.exports=(_req,res)=>res.status(410).json({erro:"Rotina migrada para GitHub Actions; consulte /api/devolucao."});
