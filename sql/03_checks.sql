USE substation_maintenance_lb1;
SHOW TABLES;
SELECT 'equipment_type' AS table_name, COUNT(*) AS row_count FROM equipment_type
UNION ALL SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL SELECT 'maintenance_plan', COUNT(*) FROM maintenance_plan;
SELECT e.equipment_id, e.inventory_number, e.equipment_name, t.type_name,
       COUNT(p.plan_id) AS plans_count
FROM equipment AS e
JOIN equipment_type AS t ON t.type_id = e.type_id
LEFT JOIN maintenance_plan AS p ON p.equipment_id = e.equipment_id
GROUP BY e.equipment_id, e.inventory_number, e.equipment_name, t.type_name
ORDER BY e.equipment_id;
