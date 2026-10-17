 'use strict';
module.exports=({pool,dateField,ValidationError})=>({
 async status(req,res){
 const [rows]=await pool.execute(`SELECT t.type_name, COUNT(DISTINCT e.equipment_id) AS equipment_count, COUNT(p.plan_id) AS plans_count, SUM(CASE WHEN p.plan_status='Заплановано' THEN 1 ELSE 0 END) AS scheduled_count, SUM(CASE WHEN p.plan_status='У роботі' THEN 1 ELSE 0 END) AS active_count, SUM(CASE WHEN p.plan_status='Виконано' THEN 1 ELSE 0 END) AS finished_count, COALESCE(ROUND(SUM(p.estimated_duration_hours),2),0) AS hours_total FROM equipment_type t LEFT JOIN equipment e ON e.type_id=t.type_id LEFT JOIN maintenance_plan p ON p.equipment_id=e.equipment_id GROUP BY t.type_id,t.type_name ORDER BY t.type_name`);
 res.render('stat_status',{title:'Статистика планів за типами обладнання',rows});
 },
 async periodForm(req,res){res.render('stat_period',{title:'Аналіз ТО за період',rows:null,from:'',to:'',generated:null});},
 async period(req,res){
 const from=dateField(req.body.from,'Дата початку'); const to=dateField(req.body.to,'Дата завершення');
 if(from>to)throw new ValidationError('Початкова дата не може бути пізнішою за кінцеву.');
 const [rows]=await pool.execute(`SELECT e.inventory_number,e.equipment_name,t.type_name,COUNT(p.plan_id) AS plans_count, SUM(CASE WHEN p.plan_status='Виконано' THEN 1 ELSE 0 END) AS completed_count, SUM(CASE WHEN p.plan_status='Заплановано' AND p.planned_date<CURDATE() THEN 1 ELSE 0 END) AS overdue_count, COALESCE(ROUND(SUM(p.estimated_duration_hours),2),0) AS hours_total FROM equipment e JOIN equipment_type t ON t.type_id=e.type_id LEFT JOIN maintenance_plan p ON p.equipment_id=e.equipment_id AND p.planned_date BETWEEN ? AND ? GROUP BY e.equipment_id,e.inventory_number,e.equipment_name,t.type_name ORDER BY e.inventory_number`,[from,to]);
 res.render('stat_period',{title:'Аналіз ТО за період',rows,from,to,generated:new Date().toLocaleString('uk-UA')});
 }
});