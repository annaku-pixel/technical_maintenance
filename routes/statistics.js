'use strict';
const express=require('express');
module.exports=svc=>{
  const router=express.Router(),c=require('../controllers/statisticsController')(svc);
  const w=f=>(req,res,next)=>Promise.resolve(f(req,res,next)).catch(next);
  router.get('/status',w(c.status));
  router.get('/period',w(c.periodForm));
  router.post('/period',w(c.period));
  return router;
};
