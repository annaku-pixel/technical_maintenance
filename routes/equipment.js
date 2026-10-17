'use strict';
const express=require('express');
module.exports=(services)=>{
  const router=express.Router();
  const controller=require('../controllers/crud')('equipment',services);
  const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
  router.get('/:id/edit',wrap(controller.edit));
  router.post('/:id/edit',wrap(controller.update));
  router.post('/:id/delete',wrap(controller.remove));
  return router;
};
