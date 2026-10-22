'use strict';
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const repository = require('../models/repository');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

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
  const text = String(value ?? '').trim();
  const pattern = places === 0
    ? /^\d+$/
    : new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`);

  if (!pattern.test(text)) {
    throw new ValidationError(
      `${label}: неправильний формат числа.`
    );
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ValidationError(
      `${label}: значення від ${min} до ${max}.`
    );
  }
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
const states = ['Справний','Потребує огляду','На обслуговуванні','Виведено з експлуатації'];
const kinds = ['Планове ТО','Діагностика','Контрольний огляд','Позаплановий огляд'];
const priorities = ['Низький','Середній','Високий'];
const planStatuses = ['Заплановано','У роботі','Виконано','Прострочено'];
async function getTypes() {
  const [rows] = await repository.execute('q1');
  return rows;
}
async function getEquipment() {
  const [rows] = await repository.execute('q2');
  return rows;
}
app.get('/', (_req, res) => res.redirect('/types'));

app.get('/types', asyncRoute(async (_req, res) => {
  const [rows] = await repository.execute('q3');
  res.render('types', { rows, title: 'Типи обладнання' });
}));
app.post('/types', asyncRoute(async (req, res) => {
  const name = field(req.body, 'type_name', 'Назва типу', 3, 120);
  const category = field(req.body, 'category', 'Категорія', 3, 120);
  const kv = decimal(req.body.voltage_class_kv, 'Клас напруги', 0.01, 99999.99, 2);
  const months = decimal(req.body.maintenance_interval_months, 'Періодичність ТО', 1, 65535, 0);
  const regulation = field(req.body, 'regulation_document', 'Регламент', 3, 255);
  const purpose = field(req.body, 'purpose_description', 'Призначення', 10, 3000);
  await repository.execute('q4', [name, category, kv, months, regulation, purpose]);
  res.redirect('/types?added=1');
}));

app.get('/equipment', asyncRoute(async (_req, res) => {
  const [rows] = await repository.execute('q5');
  res.render('equipment', { rows, types: await getTypes(), title: 'Обладнання' });
}));
app.post('/equipment', asyncRoute(async (req, res) => {
  const typeId = positiveId(req.body.type_id);
  const inventory = match(field(req.body,'inventory_number','Інвентарний №',3,40), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Інвентарний №');
  const name = field(req.body,'equipment_name','Найменування',3,150);
  const manufacturer = field(req.body,'manufacturer','Виробник',2,100);
  const model = field(req.body,'model','Модель',1,100);
  const serial = match(field(req.body,'serial_number','Заводський №',2,100), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Заводський №');
  const date = dateField(req.body.commissioned_on, 'Дата введення', true);
  const location = field(req.body,'installation_location','Місце встановлення',4,180);
  const state = choice(req.body.technical_state,states,'Технічний стан');
  const note = optionalField(req.body,'note','Примітка',3000);
  const [[type]] = await repository.execute('q6', [typeId]);
  if (!type) throw new ValidationError('Обраного типу обладнання не існує.');
  await repository.execute('q7', [typeId, inventory, name, manufacturer, model, serial, date, location, state, note]);
  res.redirect('/equipment?added=1');
}));

app.get('/plans', asyncRoute(async (_req, res) => {
  const [rows] = await repository.execute('q8');
  res.render('plans', { rows, equipment: await getEquipment(), title: 'Плани ТО' });
}));
app.post('/plans', asyncRoute(async (req, res) => {
  const equipmentId = positiveId(req.body.equipment_id);
  const number = match(field(req.body,'plan_number','Номер плану',3,40), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Номер плану');
  const date = dateField(req.body.planned_date,'Планова дата');
  const kind = choice(req.body.maintenance_kind,kinds,'Вид ТО');
  const work = field(req.body,'planned_work','Перелік робіт',10,5000);
  const priority = choice(req.body.priority,priorities,'Пріоритет');
  const hours = decimal(req.body.estimated_duration_hours,'Тривалість',0.01,9999.99,2);
  const status = choice(req.body.plan_status,planStatuses,'Статус');
  const [[equipment]] = await repository.execute('q9', [equipmentId]);
  if (!equipment) throw new ValidationError('Обраного обладнання не існує.');
  await repository.execute('q10', [equipmentId, number, date, kind, work, priority, hours, status]);
  res.redirect('/plans?added=1');
}));

app.get('/equipment/:id/plans', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [[parent]] = await repository.execute('q11', [id]);
  if (!parent) return res.status(404).render('error', { title: 'Помилка', message: 'Обладнання не знайдено.' });
  const [plans] = await repository.execute('q12', [id]);
  const [ids] = await repository.execute('q13');
  const index = ids.findIndex(x => x.equipment_id === id);
  const prevId = ids[(index - 1 + ids.length) % ids.length].equipment_id;
  const nextId = ids[(index + 1) % ids.length].equipment_id;
  res.render('equipment_plans', { parent, plans, prevId, nextId, title: 'Плани обладнання' });
}));


app.get('/types/:id/edit', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [[record]] = await repository.execute('q14', [id]);
  if (!record) return res.status(404).render('error', { title: 'Помилка', message: 'Запис не знайдено.' });
  res.render('edit', { title: 'Редагування', section: 'types', record, types: await getTypes(), equipment: await getEquipment(), states, kinds, priorities, planStatuses });
}));
app.post('/types/:id/edit', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const name = field(req.body, 'type_name', 'Назва типу', 3, 120);
  const category = field(req.body, 'category', 'Категорія', 3, 120);
  const kv = decimal(req.body.voltage_class_kv, 'Клас напруги', 0.01, 99999.99, 2);
  const months = decimal(req.body.maintenance_interval_months, 'Періодичність ТО', 1, 65535, 0);
  const regulation = field(req.body, 'regulation_document', 'Регламент', 3, 255);
  const purpose = field(req.body, 'purpose_description', 'Призначення', 10, 3000);
  const values = [name, category, kv, months, regulation, purpose];
  const [result] = await repository.execute('q15', [...values, id]);
  if (!result.affectedRows) return res.status(404).render('error', { title: 'Помилка', message: 'Запис не знайдено.' });
  res.redirect('/types?updated=1');
}));
app.post('/types/:id/delete', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  await repository.execute('q16', [id]);
  res.redirect('/types?deleted=1');
}));
app.get('/equipment/:id/edit', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [[record]] = await repository.execute('q17', [id]);
  if (!record) return res.status(404).render('error', { title: 'Помилка', message: 'Запис не знайдено.' });
  res.render('edit', { title: 'Редагування', section: 'equipment', record, types: await getTypes(), equipment: await getEquipment(), states, kinds, priorities, planStatuses });
}));
app.post('/equipment/:id/edit', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const typeId = positiveId(req.body.type_id);
  const inventory = match(field(req.body,'inventory_number','Інвентарний №',3,40), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Інвентарний №');
  const name = field(req.body,'equipment_name','Найменування',3,150);
  const manufacturer = field(req.body,'manufacturer','Виробник',2,100);
  const model = field(req.body,'model','Модель',1,100);
  const serial = match(field(req.body,'serial_number','Заводський №',2,100), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Заводський №');
  const date = dateField(req.body.commissioned_on, 'Дата введення', true);
  const location = field(req.body,'installation_location','Місце встановлення',4,180);
  const state = choice(req.body.technical_state,states,'Технічний стан');
  const note = optionalField(req.body,'note','Примітка',3000);
  const [[type]] = await repository.execute('q18', [typeId]);
  if (!type) throw new ValidationError('Обраного типу обладнання не існує.');
  const values = [typeId, inventory, name, manufacturer, model, serial, date, location, state, note];
  const [result] = await repository.execute('q19', [...values, id]);
  if (!result.affectedRows) return res.status(404).render('error', { title: 'Помилка', message: 'Запис не знайдено.' });
  res.redirect('/equipment?updated=1');
}));
app.post('/equipment/:id/delete', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  await repository.execute('q20', [id]);
  res.redirect('/equipment?deleted=1');
}));
app.get('/plans/:id/edit', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [[record]] = await repository.execute('q21', [id]);
  if (!record) return res.status(404).render('error', { title: 'Помилка', message: 'Запис не знайдено.' });
  res.render('edit', { title: 'Редагування', section: 'plans', record, types: await getTypes(), equipment: await getEquipment(), states, kinds, priorities, planStatuses });
}));
app.post('/plans/:id/edit', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const equipmentId = positiveId(req.body.equipment_id);
  const number = match(field(req.body,'plan_number','Номер плану',3,40), /^[\p{L}\p{N}][\p{L}\p{N}._\/-]*$/u, 'Номер плану');
  const date = dateField(req.body.planned_date,'Планова дата');
  const kind = choice(req.body.maintenance_kind,kinds,'Вид ТО');
  const work = field(req.body,'planned_work','Перелік робіт',10,5000);
  const priority = choice(req.body.priority,priorities,'Пріоритет');
  const hours = decimal(req.body.estimated_duration_hours,'Тривалість',0.01,9999.99,2);
  const status = choice(req.body.plan_status,planStatuses,'Статус');
  const [[equipment]] = await repository.execute('q22', [equipmentId]);
  if (!equipment) throw new ValidationError('Обраного обладнання не існує.');
  const values = [equipmentId, number, date, kind, work, priority, hours, status];
  const [result] = await repository.execute('q23', [...values, id]);
  if (!result.affectedRows) return res.status(404).render('error', { title: 'Помилка', message: 'Запис не знайдено.' });
  res.redirect('/plans?updated=1');
}));
app.post('/plans/:id/delete', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  await repository.execute('q24', [id]);
  res.redirect('/plans?deleted=1');
}));
app.get('/statistics/overdue', asyncRoute(async (_req, res) => {
  const [rows] = await repository.execute('q25');
  res.render('statistics', { title: 'Прострочені плани ТО', rows, mode: 'overdue' });
}));
app.get('/statistics/activity', asyncRoute(async (req, res) => {
  const from = req.query.from || '';
  const to = req.query.to || '';
  let rows = null;
  if (from || to) {
    const first = dateField(from, 'Дата початку');
    const last = dateField(to, 'Дата завершення');
    if (first > last) throw new ValidationError('Дата початку більша за дату завершення.');
    [rows] = await repository.execute('q26', [first,last]);
  }
  res.render('statistics', { title: 'Активність ТО за період', rows, mode: 'activity', from, to, generatedAt: new Date().toLocaleString('uk-UA') });
}));

app.use(async (err, req, res, next) => {
  if (req.method !== 'POST') return next(err);
  const duplicate = err.code === 'ER_DUP_ENTRY';
  const foreignKey = err.code === 'ER_NO_REFERENCED_ROW_2';
  const restricted = err.code === 'ER_ROW_IS_REFERENCED_2';
  const known = err instanceof ValidationError;
  if (!duplicate && !foreignKey && !restricted && !known) return next(err);
  const message = duplicate ? 'Таке значення вже існує. Перевірте назву типу, інвентарний номер або номер плану.'
    : restricted ? 'Неможливо видалити запис, поки існують пов’язані записи.'
    : foreignKey ? 'Не знайдено пов’язаний запис.' : err.message;
  const match = req.path.match(/^\/(types|equipment|plans)(?:\/(\d+)\/(?:edit|delete))?$/);
  if (!match) return next(err);
  try {
    const section = match[1];
    const title = section === 'types' ? 'Типи обладнання' : section === 'equipment' ? 'Обладнання' : 'Плани ТО';
    const types = await getTypes();
    const equipment = await getEquipment();
    if (match[2] && req.path.endsWith('/edit')) {
      const id = positiveId(match[2]);
      const key = section === 'types' ? 'type_id' : section === 'equipment' ? 'equipment_id' : 'plan_id';
      res.status(400).render('edit', {
        title: 'Редагування', section, record: { ...req.body, [key]: id },
        types, equipment, states, kinds, priorities, planStatuses, error: message
      });
      return;
    }
    const queryName = section === 'types' ? 'q3' : section === 'equipment' ? 'q5' : 'q8';
    const [rows] = await repository.execute(queryName);
    res.status(400).render(section, { title, rows, types, equipment, error: message, values: req.body });
  } catch (renderError) { next(renderError); }
});

app.use((err, _req, res, _next) => {
  const known = err instanceof ValidationError;
  const duplicate = err.code === 'ER_DUP_ENTRY';
  const foreignKey = err.code === 'ER_NO_REFERENCED_ROW_2';
  const restricted = err.code === 'ER_ROW_IS_REFERENCED_2';
  const message = duplicate ? 'Такий інвентарний номер, номер плану або назва типу вже існує.'
    : restricted ? 'Неможливо видалити запис, поки існують пов’язані записи.'
    : foreignKey ? 'Не знайдено пов’язаний запис.'
    : known ? err.message : 'Помилка сервера або з’єднання з MySQL. Перевірте налаштування.';
  if (!known && !duplicate && !foreignKey && !restricted) console.error(err);
  res.status(known || duplicate || foreignKey || restricted ? 400 : 500).render('error', { title: 'Помилка', message });
});
module.exports = app;
