const handler=require("./devolucao");module.exports=async(req,res)=>{req.url="/api/cron";return handler(req,res)};
