'use strict';
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
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
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req,res,next)=>{res.locals.query=req.query;next();});

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}
function field(source, key, label, min, max) {
  const raw = source[key];
  if (typeof raw !== 'string') throw new ValidationError(`${label}: введіть значення.`);
  const value = raw.trim().replace(/\s+/gu, ' ');
  if (value.length < min || value.length > max) throw new ValidationError(`${label}: довжина має бути від ${min} до ${max} символів.`);
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u.test(value)) throw new ValidationError(`${label}: заборонені керувальні символи.`);
  return value;
}
function optionalField(source, key, label, max) {
  const raw = source[key] ?? '';
  if (typeof raw !== 'string') throw new ValidationError(`${label}: некоректні дані.`);
  if (!raw.trim()) return null;
  return field(source, key, label, 1, max);
}
function match(value, expression, label) {
  if (!expression.test(value)) throw new ValidationError(`${label}: неправильний формат.`);
  return value;
}
function decimal(value, label, min, max, places) {
  if (typeof value !== 'string' || !/^(?:\d+)(?:\.\d+)?$/.test(value.trim())) throw new ValidationError(`${label}: введіть додатне число через крапку.`);
  const number = Number(value);
  const decimalPart = value.trim().split('.')[1] || '';
  if (!Number.isFinite(number) || number < min || number > max || decimalPart.length > places)
    throw new ValidationError(`${label}: значення від ${min} до ${max}, не більше ${places} знаків після крапки.`);
  return number;
}
function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Некоректний ідентифікатор.');
  return id;
}
function choice(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new ValidationError(`${label}: оберіть допустиме значення зі списку.`);
  return value;
}
function dateField(value, label, noFuture = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError(`${label}: дата має формат РРРР-ММ-ДД.`);
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value || value < '1900-01-01')
    throw new ValidationError(`${label}: некоректна дата.`);
  if (noFuture && value > new Date().toISOString().slice(0,10)) throw new ValidationError(`${label}: дата не може бути в майбутньому.`);
  return value;
}
const categories = ['Трансформаторне','Комутаційне','Вимірювальне','Захисне','Інше'];
function startsWithLetter(value, label) {
  if (!/^\p{L}/u.test(value)) throw new ValidationError(`${label}: значення має починатися з літери.`);
  return value;
}
const states = ['Справний','Потребує огляду','На обслуговуванні','Виведено з експлуатації'];
const kinds = ['Планове ТО','Діагностика','Контрольний огляд','Позаплановий огляд'];
const priorities = ['Низький','Середній','Високий'];
const planStatuses = ['Заплановано','У роботі','Виконано'];
async function getTypes() {
  const [rows] = await pool.execute('SELECT type_id, type_name FROM equipment_type ORDER BY type_name');
  return rows;
}
async function getEquipment() {
  const [rows] = await pool.execute('SELECT equipment_id, inventory_number, equipment_name FROM equipment ORDER BY inventory_number');
  return rows;
}
app.get('/', (_req, res) => res.redirect('/types'));

app.get('/types', asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT * FROM equipment_type ORDER BY type_id');
  res.render('types', { rows, title: 'Типи обладнання' });
}));
app.post('/types', asyncRoute(async (req, res) => {
  const name = startsWithLetter(field(req.body, 'type_name', 'Назва типу', 3, 120), 'Назва типу');
  const category = choice(req.body.category, categories, 'Категорія');
  const kv = decimal(req.body.voltage_class_kv, 'Клас напруги', 0.01, 99999.99, 2);
  const months = decimal(req.body.maintenance_interval_months, 'Періодичність ТО', 1, 65535, 0);
  const regulation = startsWithLetter(field(req.body, 'regulation_document', 'Регламент', 3, 255), 'Регламент');
  const purpose = startsWithLetter(field(req.body, 'purpose_description', 'Призначення', 10, 3000), 'Призначення');
  await pool.execute('INSERT INTO equipment_type (type_name, category, voltage_class_kv, maintenance_interval_months, regulation_document, purpose_description) VALUES (?, ?, ?, ?, ?, ?)',
    [name, category, kv, months, regulation, purpose]);
  res.redirect('/types?added=1');
}));

app.get('/equipment', asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT e.*, t.type_name FROM equipment e JOIN equipment_type t ON t.type_id = e.type_id ORDER BY e.equipment_id');
  res.render('equipment', { rows, types: await getTypes(), title: 'Обладнання' });
}));
app.post('/equipment', asyncRoute(async (req, res) => {
  const typeId = positiveId(req.body.type_id);
  const inventory = match(field(req.body,'inventory_number','Інвентарний №',3,40), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Інвентарний №');
  const name = startsWithLetter(field(req.body,'equipment_name','Найменування',3,150), 'Найменування');
  const manufacturer = startsWithLetter(field(req.body,'manufacturer','Виробник',2,100), 'Виробник');
  const model = field(req.body,'model','Модель',1,100);
  const serial = match(field(req.body,'serial_number','Заводський №',2,100), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Заводський №');
  const date = dateField(req.body.commissioned_on, 'Дата введення');
  const location = startsWithLetter(field(req.body,'installation_location','Місце встановлення',4,180), 'Місце встановлення');
  const state = choice(req.body.technical_state,states,'Технічний стан');
  const note = optionalField(req.body,'note','Примітка',3000);
  const [[type]] = await pool.execute('SELECT type_id FROM equipment_type WHERE type_id=?', [typeId]);
  if (!type) throw new ValidationError('Обраного типу обладнання не існує.');
  await pool.execute('INSERT INTO equipment (type_id, inventory_number, equipment_name, manufacturer, model, serial_number, commissioned_on, installation_location, technical_state, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [typeId, inventory, name, manufacturer, model, serial, date, location, state, note]);
  res.redirect('/equipment?added=1');
}));

app.get('/plans', asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT p.*, e.inventory_number, e.equipment_name FROM maintenance_plan p JOIN equipment e ON e.equipment_id = p.equipment_id ORDER BY p.planned_date, p.plan_id');
  res.render('plans', { rows, equipment: await getEquipment(), title: 'Плани ТО' });
}));
app.post('/plans', asyncRoute(async (req, res) => {
  const equipmentId = positiveId(req.body.equipment_id);
  const number = match(field(req.body,'plan_number','Номер плану',3,40), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Номер плану');
  const date = dateField(req.body.planned_date,'Планова дата');
  const kind = choice(req.body.maintenance_kind,kinds,'Вид ТО');
  const work = startsWithLetter(field(req.body,'planned_work','Перелік робіт',10,5000), 'Перелік робіт');
  const priority = choice(req.body.priority,priorities,'Пріоритет');
  const hours = decimal(req.body.estimated_duration_hours,'Тривалість',0.01,9999.99,2);
  const status = choice(req.body.plan_status,planStatuses,'Статус');
  const [[equipment]] = await pool.execute('SELECT equipment_id FROM equipment WHERE equipment_id=?', [equipmentId]);
  if (!equipment) throw new ValidationError('Обраного обладнання не існує.');
  await pool.execute('INSERT INTO maintenance_plan (equipment_id, plan_number, planned_date, maintenance_kind, planned_work, priority, estimated_duration_hours, plan_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [equipmentId, number, date, kind, work, priority, hours, status]);
  res.redirect('/plans?added=1');
}));

app.get('/equipment/:id/plans', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [[parent]] = await pool.execute('SELECT e.*, t.type_name FROM equipment e JOIN equipment_type t ON t.type_id = e.type_id WHERE equipment_id=?', [id]);
  if (!parent) return res.status(404).render('error', { title: 'Помилка', message: 'Обладнання не знайдено.' });
  const [plans] = await pool.execute('SELECT * FROM maintenance_plan WHERE equipment_id=? ORDER BY planned_date, plan_id', [id]);
  const [neighbors] = await pool.execute('SELECT equipment_id FROM equipment ORDER BY equipment_id');
  const position = neighbors.findIndex(item => Number(item.equipment_id) === id);
  const previousId = neighbors[(position - 1 + neighbors.length) % neighbors.length].equipment_id;
  const nextId = neighbors[(position + 1) % neighbors.length].equipment_id;
  res.render('equipment_plans', { parent, plans, previousId, nextId, title: 'Плани обладнання' });
}));

const services = {pool, positiveId, field, optionalField, match, decimal, choice, dateField, ValidationError, states, kinds, priorities, planStatuses, categories, startsWithLetter, getTypes, getEquipment};
app.use('/types', require('./routes/types')(services));
app.use('/equipment', require('./routes/equipment')(services));
app.use('/plans', require('./routes/plans')(services));
app.use('/statistics', require('./routes/statistics')(services));
app.use((err, _req, res, _next) => {
  const known = err instanceof ValidationError;
  const duplicate = err.code === 'ER_DUP_ENTRY';
  const foreignKey = err.code === 'ER_NO_REFERENCED_ROW_2';
  const inUse = err.code === 'ER_ROW_IS_REFERENCED_2';
  const message = inUse ? 'Неможливо видалити запис: з ним пов’язані дочірні записи. Спочатку видаліть залежні записи.' : duplicate ? 'Такий інвентарний номер, номер плану або назва типу вже існує.'
    : foreignKey ? 'Не знайдено пов’язаний запис.'
    : known ? err.message : 'Помилка сервера або з’єднання з MySQL. Перевірте налаштування.';
  if (!known && !duplicate && !foreignKey && !inUse) console.error(err);
  res.status(known || duplicate || foreignKey || inUse ? 400 : 500).render('error', { title: 'Помилка', message });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Вебзастосунок: http://localhost:${port}`));
