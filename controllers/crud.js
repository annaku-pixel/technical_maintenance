 'use strict';
const definitions = {
 types: { table: 'equipment_type', key:'type_id', redirect:'/types', title:'Редагування типу обладнання', fields:[
 ['type_name','Назва типу','text',120], ['category','Категорія','categories',120], ['voltage_class_kv','Клас напруги, кВ','number',7], ['maintenance_interval_months','Періодичність ТО, міс.','number',5], ['regulation_document','Регламентний документ','text',255], ['purpose_description','Призначення','textarea',3000]]},
 equipment: {table:'equipment',key:'equipment_id',redirect:'/equipment',title:'Редагування обладнання',fields:[
 ['type_id','Тип обладнання','types'],['inventory_number','Інвентарний №','text',40],['equipment_name','Найменування','text',150],['manufacturer','Виробник','text',100],['model','Модель','text',100],['serial_number','Заводський №','text',100],['commissioned_on','Дата введення','date'],['installation_location','Місце встановлення','text',180],['technical_state','Технічний стан','states'],['note','Примітка','textarea',3000,true]]},
 plans:{table:'maintenance_plan',key:'plan_id',redirect:'/plans',title:'Редагування плану ТО',fields:[
 ['equipment_id','Обладнання','equipment'],['plan_number','Номер плану','text',40],['planned_date','Планова дата','date'],['maintenance_kind','Вид ТО','kinds'],['planned_work','Перелік робіт','textarea',5000],['priority','Пріоритет','priorities'],['estimated_duration_hours','Тривалість, год','number',7],['plan_status','Статус','planStatuses']]}
};
module.exports = function createCrud(group, svc) {
 const cfg=definitions[group]; const {pool,positiveId,field,optionalField,match,decimal,choice,dateField,ValidationError,startsWithLetter}=svc;
 async function validate(body) {
  if(group==='types') return [startsWithLetter(field(body,'type_name','Назва типу',3,120),'Назва типу'),choice(body.category,svc.categories,'Категорія'),decimal(body.voltage_class_kv,'Клас напруги',.01,99999.99,2),decimal(body.maintenance_interval_months,'Періодичність',1,65535,0),startsWithLetter(field(body,'regulation_document','Регламент',3,255),'Регламент'),startsWithLetter(field(body,'purpose_description','Призначення',10,3000),'Призначення')];
  if(group==='equipment') {
   const id=positiveId(body.type_id);
   const [[type]]=await pool.execute('SELECT type_id FROM equipment_type WHERE type_id=?',[id]);
   if(!type)throw new ValidationError('Тип обладнання не знайдено.');
   const serialRegex=/^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u;
   return [id,match(field(body,'inventory_number','Інвентарний №',3,40),serialRegex,'Інвентарний №'),startsWithLetter(field(body,'equipment_name','Найменування',3,150),'Найменування'),startsWithLetter(field(body,'manufacturer','Виробник',2,100),'Виробник'),field(body,'model','Модель',1,100),match(field(body,'serial_number','Заводський №',2,100),serialRegex,'Заводський №'),dateField(body.commissioned_on,'Дата введення'),startsWithLetter(field(body,'installation_location','Місце встановлення',4,180),'Місце встановлення'),choice(body.technical_state,svc.states,'Технічний стан'),optionalField(body,'note','Примітка',3000)];
  }
  const id=positiveId(body.equipment_id);
  const [[eq]]=await pool.execute('SELECT equipment_id FROM equipment WHERE equipment_id=?',[id]);
  if(!eq)throw new ValidationError('Обладнання не знайдено.');
  const code=/^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u;
  return [id,match(field(body,'plan_number','Номер плану',3,40),code,'Номер плану'),dateField(body.planned_date,'Планова дата'),choice(body.maintenance_kind,svc.kinds,'Вид ТО'),startsWithLetter(field(body,'planned_work','Перелік робіт',10,5000),'Перелік робіт'),choice(body.priority,svc.priorities,'Пріоритет'),decimal(body.estimated_duration_hours,'Тривалість',.01,9999.99,2),choice(body.plan_status,svc.planStatuses,'Статус')];
 }
 async function edit(req,res){
  const id=positiveId(req.params.id);
  const [[record]]=await pool.execute(`SELECT * FROM ${cfg.table} WHERE ${cfg.key}=?`,[id]);
  if(!record)return res.status(404).render('error',{title:'Не знайдено',message:'Запис відсутній.'});
  res.render('edit',{cfg,record,title:cfg.title,types:await svc.getTypes(),equipment:await svc.getEquipment(),states:svc.states,kinds:svc.kinds,priorities:svc.priorities,planStatuses:svc.planStatuses,categories:svc.categories});
 }
 async function update(req,res){
  const id=positiveId(req.params.id); const values=await validate(req.body);
  const names=cfg.fields.map(f=>f[0]);
  const [result]=await pool.execute(`UPDATE ${cfg.table} SET ${names.map(n=>n+'=?').join(', ')} WHERE ${cfg.key}=?`,[...values,id]);
  if(!result.affectedRows)return res.status(404).render('error',{title:'Не знайдено',message:'Запис відсутній.'});
  res.redirect(cfg.redirect+'?updated=1');
 }
 async function remove(req,res){
  const id=positiveId(req.params.id);
  const [result]=await pool.execute(`DELETE FROM ${cfg.table} WHERE ${cfg.key}=?`,[id]);
  if(!result.affectedRows)return res.status(404).render('error',{title:'Не знайдено',message:'Запис відсутній.'});
  res.redirect(cfg.redirect+'?deleted=1');
 }
 return {edit,update,remove};
};
