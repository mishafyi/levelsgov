-- scripts/schema.sql

DROP TABLE IF EXISTS employment CASCADE;
DROP TABLE IF EXISTS accessions CASCADE;
DROP TABLE IF EXISTS separations CASCADE;
DROP TABLE IF EXISTS data_imports CASCADE;

CREATE TABLE data_imports (
    id SERIAL PRIMARY KEY,
    dataset_type VARCHAR(20) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64),
    imported_at TIMESTAMP DEFAULT NOW(),
    row_count INTEGER,
    snapshot_month VARCHAR(6),
    status VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE employment (
    id SERIAL PRIMARY KEY,
    age_bracket VARCHAR(20),
    agency VARCHAR(200),
    agency_code VARCHAR(10),
    agency_subelement VARCHAR(200),
    agency_subelement_code VARCHAR(10),
    annualized_adjusted_basic_pay NUMERIC(10,0),
    appointment_type VARCHAR(200),
    appointment_type_code VARCHAR(10),
    employee_count INTEGER,
    duty_station_country VARCHAR(100),
    duty_station_country_code VARCHAR(10),
    duty_station_state VARCHAR(100),
    duty_station_state_abbreviation VARCHAR(10),
    duty_station_state_code VARCHAR(10),
    education_level VARCHAR(100),
    education_level_code VARCHAR(10),
    grade VARCHAR(10),
    length_of_service_years NUMERIC(5,1),
    occupational_group VARCHAR(200),
    occupational_group_code VARCHAR(10),
    occupational_series VARCHAR(200),
    occupational_series_code VARCHAR(10),
    pay_plan VARCHAR(200),
    pay_plan_code VARCHAR(10),
    snapshot_yyyymm VARCHAR(6) CHECK (snapshot_yyyymm ~ '^\d{6}$'),
    stem_occupation VARCHAR(100),
    stem_occupation_type VARCHAR(100),
    supervisory_status VARCHAR(100),
    supervisory_status_code VARCHAR(10),
    work_schedule VARCHAR(50),
    work_schedule_code VARCHAR(10)
);

CREATE TABLE accessions (
    id SERIAL PRIMARY KEY,
    accession_category VARCHAR(200),
    accession_category_code VARCHAR(10),
    age_bracket VARCHAR(20),
    agency VARCHAR(200),
    agency_code VARCHAR(10),
    agency_subelement VARCHAR(200),
    agency_subelement_code VARCHAR(10),
    annualized_adjusted_basic_pay NUMERIC(10,0),
    appointment_type VARCHAR(200),
    appointment_type_code VARCHAR(10),
    employee_count INTEGER,
    duty_station_country VARCHAR(100),
    duty_station_country_code VARCHAR(10),
    duty_station_state VARCHAR(100),
    duty_station_state_abbreviation VARCHAR(10),
    duty_station_state_code VARCHAR(10),
    education_level VARCHAR(100),
    education_level_code VARCHAR(10),
    grade VARCHAR(10),
    length_of_service_years NUMERIC(5,1),
    occupational_group VARCHAR(200),
    occupational_group_code VARCHAR(10),
    occupational_series VARCHAR(200),
    occupational_series_code VARCHAR(10),
    pay_plan VARCHAR(200),
    pay_plan_code VARCHAR(10),
    personnel_action_effective_date_yyyymm VARCHAR(6),
    stem_occupation VARCHAR(100),
    stem_occupation_type VARCHAR(100),
    supervisory_status VARCHAR(100),
    supervisory_status_code VARCHAR(10),
    work_schedule VARCHAR(50),
    work_schedule_code VARCHAR(10)
);

CREATE TABLE separations (
    id SERIAL PRIMARY KEY,
    age_bracket VARCHAR(20),
    agency VARCHAR(200),
    agency_code VARCHAR(10),
    agency_subelement VARCHAR(200),
    agency_subelement_code VARCHAR(10),
    annualized_adjusted_basic_pay NUMERIC(10,0),
    appointment_type VARCHAR(200),
    appointment_type_code VARCHAR(10),
    employee_count INTEGER,
    duty_station_country VARCHAR(100),
    duty_station_country_code VARCHAR(10),
    duty_station_state VARCHAR(100),
    duty_station_state_abbreviation VARCHAR(10),
    duty_station_state_code VARCHAR(10),
    education_level VARCHAR(100),
    education_level_code VARCHAR(10),
    grade VARCHAR(10),
    length_of_service_years NUMERIC(5,1),
    occupational_group VARCHAR(200),
    occupational_group_code VARCHAR(10),
    occupational_series VARCHAR(200),
    occupational_series_code VARCHAR(10),
    pay_plan VARCHAR(200),
    pay_plan_code VARCHAR(10),
    personnel_action_effective_date_yyyymm VARCHAR(6),
    separation_category VARCHAR(200),
    separation_category_code VARCHAR(10),
    stem_occupation VARCHAR(100),
    stem_occupation_type VARCHAR(100),
    supervisory_status VARCHAR(100),
    supervisory_status_code VARCHAR(10),
    work_schedule VARCHAR(50),
    work_schedule_code VARCHAR(10)
);

-- Employment: single-column indexes
CREATE INDEX idx_emp_agency ON employment(agency_code);
CREATE INDEX idx_emp_state ON employment(duty_station_state_abbreviation);
CREATE INDEX idx_emp_occ ON employment(occupational_series_code);
CREATE INDEX idx_emp_occ_group ON employment(occupational_group_code);
CREATE INDEX idx_emp_grade ON employment(grade);
CREATE INDEX idx_emp_pay_plan ON employment(pay_plan_code);
CREATE INDEX idx_emp_education ON employment(education_level_code);
CREATE INDEX idx_emp_age ON employment(age_bracket);
CREATE INDEX idx_emp_snapshot ON employment(snapshot_yyyymm);
CREATE INDEX idx_emp_pay ON employment(annualized_adjusted_basic_pay);

-- Employment: composite indexes for common multi-filter patterns
CREATE INDEX idx_emp_agency_state ON employment(agency_code, duty_station_state_abbreviation);
CREATE INDEX idx_emp_agency_occ ON employment(agency_code, occupational_series_code);
CREATE INDEX idx_emp_snapshot_agency ON employment(snapshot_yyyymm, agency_code);

-- Accessions indexes
CREATE INDEX idx_acc_agency ON accessions(agency_code);
CREATE INDEX idx_acc_state ON accessions(duty_station_state_abbreviation);
CREATE INDEX idx_acc_occ ON accessions(occupational_series_code);
CREATE INDEX idx_acc_date ON accessions(personnel_action_effective_date_yyyymm);
CREATE INDEX idx_acc_date_agency ON accessions(personnel_action_effective_date_yyyymm, agency_code);

-- Separations indexes
CREATE INDEX idx_sep_agency ON separations(agency_code);
CREATE INDEX idx_sep_state ON separations(duty_station_state_abbreviation);
CREATE INDEX idx_sep_occ ON separations(occupational_series_code);
CREATE INDEX idx_sep_date ON separations(personnel_action_effective_date_yyyymm);
CREATE INDEX idx_sep_date_agency ON separations(personnel_action_effective_date_yyyymm, agency_code);
CREATE INDEX idx_sep_category ON separations(separation_category_code);
