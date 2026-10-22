'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'substation_maintenance_lb1',
  waitForConnections: true,
  connectionLimit: 8,
  decimalNumbers: true,
  dateStrings: true
});
const queries = {
  q1: 'SELECT type_id, type_name FROM equipment_type ORDER BY type_name',
  q2: 'SELECT equipment_id, inventory_number, equipment_name FROM equipment ORDER BY inventory_number',
  q3: 'SELECT * FROM equipment_type ORDER BY type_id',
  q4: 'INSERT INTO equipment_type (type_name, category, voltage_class_kv, maintenance_interval_months, regulation_document, purpose_description) VALUES (?, ?, ?, ?, ?, ?)',
  q5: 'SELECT e.*, t.type_name FROM equipment e JOIN equipment_type t ON t.type_id = e.type_id ORDER BY e.equipment_id',
  q6: 'SELECT type_id FROM equipment_type WHERE type_id=?',
  q7: 'INSERT INTO equipment (type_id, inventory_number, equipment_name, manufacturer, model, serial_number, commissioned_on, installation_location, technical_state, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  q8: 'SELECT p.*, e.inventory_number, e.equipment_name FROM maintenance_plan p JOIN equipment e ON e.equipment_id = p.equipment_id ORDER BY p.planned_date, p.plan_id',
  q9: 'SELECT equipment_id FROM equipment WHERE equipment_id=?',
  q10: 'INSERT INTO maintenance_plan (equipment_id, plan_number, planned_date, maintenance_kind, planned_work, priority, estimated_duration_hours, plan_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  q11: 'SELECT e.*, t.type_name FROM equipment e JOIN equipment_type t ON t.type_id = e.type_id WHERE equipment_id=?',
  q12: 'SELECT * FROM maintenance_plan WHERE equipment_id=? ORDER BY planned_date, plan_id',
  q13: 'SELECT equipment_id FROM equipment ORDER BY equipment_id',
  q14: 'SELECT * FROM equipment_type WHERE type_id=?',
  q15: 'UPDATE equipment_type SET '+'type_name=?, category=?, voltage_class_kv=?, maintenance_interval_months=?, regulation_document=?, purpose_description=?'+' WHERE type_id=?',
  q16: 'DELETE FROM equipment_type WHERE type_id=?',
  q17: 'SELECT * FROM equipment WHERE equipment_id=?',
  q18: 'SELECT type_id FROM equipment_type WHERE type_id=?',
  q19: 'UPDATE equipment SET '+'type_id=?, inventory_number=?, equipment_name=?, manufacturer=?, model=?, serial_number=?, commissioned_on=?, installation_location=?, technical_state=?, note=?'+' WHERE equipment_id=?',
  q20: 'DELETE FROM equipment WHERE equipment_id=?',
  q21: 'SELECT * FROM maintenance_plan WHERE plan_id=?',
  q22: 'SELECT equipment_id FROM equipment WHERE equipment_id=?',
  q23: 'UPDATE maintenance_plan SET '+'equipment_id=?, plan_number=?, planned_date=?, maintenance_kind=?, planned_work=?, priority=?, estimated_duration_hours=?, plan_status=?'+' WHERE plan_id=?',
  q24: 'DELETE FROM maintenance_plan WHERE plan_id=?',
  q25: `
    SELECT e.inventory_number, e.equipment_name, t.type_name,
      COUNT(p.plan_id) AS total_plans,
      SUM(CASE WHEN p.planned_date < CURRENT_DATE() AND p.plan_status <> 'Виконано' THEN 1 ELSE 0 END) AS overdue_plans,
      MIN(CASE WHEN p.planned_date < CURRENT_DATE() AND p.plan_status <> 'Виконано' THEN p.planned_date END) AS oldest_overdue_date
    FROM equipment e
    JOIN equipment_type t ON t.type_id=e.type_id
    LEFT JOIN maintenance_plan p ON p.equipment_id=e.equipment_id
    GROUP BY e.equipment_id, e.inventory_number, e.equipment_name, t.type_name
    ORDER BY overdue_plans DESC, e.inventory_number`,
  q26: `
      SELECT t.type_name, COUNT(DISTINCT e.equipment_id) AS equipment_count,
        COUNT(p.plan_id) AS total_plans,
        SUM(CASE WHEN p.plan_status='Виконано' THEN 1 ELSE 0 END) AS completed_plans,
        SUM(CASE WHEN p.planned_date < CURRENT_DATE() AND p.plan_status <> 'Виконано' THEN 1 ELSE 0 END) AS overdue_plans,
        ROUND(AVG(p.estimated_duration_hours),2) AS average_hours
      FROM equipment_type t
      LEFT JOIN equipment e ON e.type_id=t.type_id
      LEFT JOIN maintenance_plan p ON p.equipment_id=e.equipment_id AND p.planned_date BETWEEN ? AND ?
      GROUP BY t.type_id, t.type_name ORDER BY t.type_name`
};
async function execute(name, params = []) { return pool.execute(queries[name], params); }
module.exports = { execute };
