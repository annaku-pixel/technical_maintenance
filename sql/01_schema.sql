CREATE DATABASE IF NOT EXISTS substation_maintenance_lb1
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE substation_maintenance_lb1;

CREATE TABLE IF NOT EXISTS equipment_type (
  type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(120) NOT NULL,
  category VARCHAR(120) NOT NULL,
  voltage_class_kv DECIMAL(7,2) NOT NULL,
  maintenance_interval_months SMALLINT UNSIGNED NOT NULL,
  regulation_document VARCHAR(255) NOT NULL,
  purpose_description TEXT NOT NULL,
  CONSTRAINT uq_equipment_type_name UNIQUE (type_name),
  CONSTRAINT chk_type_voltage CHECK (voltage_class_kv > 0),
  CONSTRAINT chk_type_period CHECK (maintenance_interval_months > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS equipment (
  equipment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_id INT UNSIGNED NOT NULL,
  inventory_number VARCHAR(40) NOT NULL,
  equipment_name VARCHAR(150) NOT NULL,
  manufacturer VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100) NOT NULL,
  commissioned_on DATE NOT NULL,
  installation_location VARCHAR(180) NOT NULL,
  technical_state VARCHAR(40) NOT NULL,
  note TEXT NULL,
  CONSTRAINT uq_equipment_inventory UNIQUE (inventory_number),
  CONSTRAINT fk_equipment_type FOREIGN KEY (type_id)
    REFERENCES equipment_type(type_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_plan (
  plan_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT UNSIGNED NOT NULL,
  plan_number VARCHAR(40) NOT NULL,
  planned_date DATE NOT NULL,
  maintenance_kind VARCHAR(100) NOT NULL,
  planned_work TEXT NOT NULL,
  priority VARCHAR(30) NOT NULL,
  estimated_duration_hours DECIMAL(6,2) NOT NULL,
  plan_status VARCHAR(40) NOT NULL,
  CONSTRAINT uq_plan_number UNIQUE (plan_number),
  CONSTRAINT chk_plan_duration CHECK (estimated_duration_hours > 0),
  CONSTRAINT fk_plan_equipment FOREIGN KEY (equipment_id)
    REFERENCES equipment(equipment_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX ix_plan_equipment_date (equipment_id, planned_date)
) ENGINE=InnoDB;
