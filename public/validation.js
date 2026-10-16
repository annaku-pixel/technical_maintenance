'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const messages = {
    type_name: 'Вкажіть назву типу (від 3 до 120 символів).',
    category: 'Вкажіть категорію (від 3 до 120 символів).',
    voltage_class_kv: 'Клас напруги має бути додатним числом від 0,01 до 99999,99 кВ.',
    maintenance_interval_months: 'Періодичність ТО має бути цілим додатним числом від 1 до 65535 місяців.',
    regulation_document: 'Вкажіть регламентний документ (від 3 до 255 символів).',
    purpose_description: 'Опишіть призначення (від 10 до 3000 символів).',
    type_id: 'Оберіть тип обладнання зі списку.',
    inventory_number: 'Вкажіть інвентарний номер (3–40 символів: літери, цифри, . _ / -).',
    equipment_name: 'Вкажіть найменування (від 3 до 150 символів).',
    manufacturer: 'Вкажіть виробника (від 2 до 100 символів).',
    model: 'Вкажіть модель (від 1 до 100 символів).',
    serial_number: 'Вкажіть заводський номер (2–100 символів: літери, цифри, . _ / -).',
    commissioned_on: 'Вкажіть правильну дату введення, яка не пізніша за сьогодні.',
    installation_location: 'Вкажіть місце встановлення (від 4 до 180 символів).',
    technical_state: 'Оберіть технічний стан.',
    note: 'Примітка не може перевищувати 3000 символів.',
    equipment_id: 'Оберіть обладнання зі списку.',
    plan_number: 'Вкажіть номер плану (3–40 символів: літери, цифри, . _ / -).',
    planned_date: 'Вкажіть коректну планову дату.',
    maintenance_kind: 'Оберіть вид технічного обслуговування.',
    priority: 'Оберіть пріоритет.',
    estimated_duration_hours: 'Тривалість має бути додатним числом від 0,01 до 9999,99 год.',
    plan_status: 'Оберіть статус.',
    planned_work: 'Опишіть роботи (від 10 до 5000 символів).'
  };
  const today = new Date();
  const todayLocal = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.querySelectorAll('input[name="commissioned_on"]').forEach(input => input.max = todayLocal);
  document.querySelectorAll('form[method="post"]').forEach(form => {
    form.noValidate = true;
    const controls = [...form.querySelectorAll('input[name],select[name],textarea[name]')];
    for (const field of controls) {
      const error = document.createElement('span');
      error.className = 'field-error';
      error.id = 'error-' + field.name;
      error.setAttribute('aria-live', 'polite');
      field.after(error);
      field.setAttribute('aria-describedby', error.id);
      const validate = () => {
        const value = field.value.trim();
        let invalid = !field.validity.valid;
        if (field.required && !value) invalid = true;
        if (field.tagName === 'INPUT' && field.type === 'number') {
          const number = Number(value);
          if (value && (!Number.isFinite(number) || number <= 0)) invalid = true;
        }
        if (field.name === 'maintenance_interval_months' && value && !Number.isInteger(Number(value))) invalid = true;
        if (field.name === 'commissioned_on' && value && value > todayLocal) invalid = true;
        if (field.tagName !== 'SELECT' && field.type !== 'date' && field.type !== 'number') {
          if (value && field.minLength > 0 && value.length < field.minLength) invalid = true;
          if (value && field.maxLength > 0 && value.length > field.maxLength) invalid = true;
          if (value && /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) invalid = true;
        }
        error.textContent = invalid ? (messages[field.name] || 'Перевірте правильність введеного значення.') : '';
        field.classList.toggle('input-invalid', invalid);
        field.setAttribute('aria-invalid', invalid ? 'true' : 'false');
        return !invalid;
      };
      field.addEventListener('input', validate);
      field.addEventListener('change', validate);
      field.addEventListener('blur', validate);
    }
    form.addEventListener('submit', event => {
      const results = controls.map(field => ({field, valid: (() => {
        field.dispatchEvent(new Event('input'));
        return field.getAttribute('aria-invalid') !== 'true';
      })()}));
      const bad = results.find(item => !item.valid);
      if (bad) { event.preventDefault(); bad.field.focus(); }
    });
  });
});
