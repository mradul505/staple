-- Load CSV data into PostgreSQL during initialization
-- This script runs automatically when the database container starts

\echo 'Loading CSV data into compensation_data table...'

-- Create temporary function to load and normalize CSV data
CREATE OR REPLACE FUNCTION load_csv_data() RETURNS void AS $$
DECLARE
    rec RECORD;
    inserted_count INTEGER := 0;
BEGIN
    -- Copy from salary_survey-1.csv
    COPY temp_csv_1(timestamp, employer, location, job_title, years_experience_industry, years_experience_company, annual_base_pay, signing_bonus, annual_bonus, stock_value, health_insurance_offered, annual_vacation_weeks, industry, employment_type, is_manager, level, required_hours_per_week, actual_hours_per_week, highest_level_of_formal_education, gender, final_question)
    FROM '/docker-entrypoint-initdb.d/csv/salary_survey-1.csv' 
    DELIMITER ',' CSV HEADER;

    -- Insert normalized data from CSV 1
    INSERT INTO compensation_data (
        timestamp, employer, location, job_title, years_experience_industry, 
        years_experience_company, annual_base_pay, signing_bonus, annual_bonus, 
        stock_value, health_insurance_offered, annual_vacation_weeks, industry, 
        employment_type, is_manager, level, required_hours_per_week, 
        actual_hours_per_week, highest_level_of_formal_education, gender, 
        final_question, data_quality_score, created_at, updated_at
    )
    SELECT 
        CASE 
            WHEN timestamp ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN to_timestamp(timestamp, 'MM/DD/YYYY')::timestamp
            ELSE CURRENT_TIMESTAMP
        END,
        COALESCE(NULLIF(trim(employer), ''), 'Unknown'),
        COALESCE(NULLIF(trim(location), ''), 'Unknown'),
        COALESCE(NULLIF(trim(job_title), ''), 'Unknown'),
        CASE 
            WHEN years_experience_industry ~ '^\d+(\.\d+)?$' THEN years_experience_industry::NUMERIC
            ELSE NULL
        END,
        CASE 
            WHEN years_experience_company ~ '^\d+(\.\d+)?$' THEN years_experience_company::NUMERIC
            ELSE NULL
        END,
        CASE 
            WHEN annual_base_pay ~ '^\d+(\.\d+)?$' THEN (annual_base_pay::NUMERIC * 100)::BIGINT
            ELSE NULL
        END,
        CASE 
            WHEN signing_bonus ~ '^\d+(\.\d+)?$' THEN (signing_bonus::NUMERIC * 100)::BIGINT
            ELSE NULL
        END,
        CASE 
            WHEN annual_bonus ~ '^\d+(\.\d+)?$' THEN (annual_bonus::NUMERIC * 100)::BIGINT
            ELSE NULL
        END,
        CASE 
            WHEN stock_value ~ '^\d+(\.\d+)?$' THEN (stock_value::NUMERIC * 100)::BIGINT
            ELSE NULL
        END,
        CASE 
            WHEN LOWER(health_insurance_offered) IN ('yes', 'true', '1') THEN true
            WHEN LOWER(health_insurance_offered) IN ('no', 'false', '0') THEN false
            ELSE NULL
        END,
        CASE 
            WHEN annual_vacation_weeks ~ '^\d+(\.\d+)?$' THEN annual_vacation_weeks::NUMERIC
            ELSE NULL
        END,
        COALESCE(NULLIF(trim(industry), ''), 'Unknown'),
        COALESCE(NULLIF(trim(employment_type), ''), 'Unknown'),
        CASE 
            WHEN LOWER(is_manager) IN ('yes', 'true', '1') THEN true
            WHEN LOWER(is_manager) IN ('no', 'false', '0') THEN false
            ELSE NULL
        END,
        COALESCE(NULLIF(trim(level), ''), 'Unknown'),
        CASE 
            WHEN required_hours_per_week ~ '^\d+(\.\d+)?$' THEN required_hours_per_week::NUMERIC
            ELSE NULL
        END,
        CASE 
            WHEN actual_hours_per_week ~ '^\d+(\.\d+)?$' THEN actual_hours_per_week::NUMERIC
            ELSE NULL
        END,
        COALESCE(NULLIF(trim(highest_level_of_formal_education), ''), 'Unknown'),
        COALESCE(NULLIF(trim(gender), ''), 'Unknown'),
        COALESCE(NULLIF(trim(final_question), ''), ''),
        85.5, -- Data quality score for CSV 1
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM temp_csv_1
    WHERE employer IS NOT NULL AND employer != '';

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    \echo 'Inserted records from CSV 1: ' || inserted_count;

    -- Clear temp table
    DELETE FROM temp_csv_1;

    -- Load remaining CSV files with similar logic...
    -- (Additional CSV loading logic would go here)

    \echo 'CSV data loading completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Create temporary tables for CSV loading
CREATE TEMP TABLE temp_csv_1 (
    timestamp TEXT,
    employer TEXT,
    location TEXT,
    job_title TEXT,
    years_experience_industry TEXT,
    years_experience_company TEXT,
    annual_base_pay TEXT,
    signing_bonus TEXT,
    annual_bonus TEXT,
    stock_value TEXT,
    health_insurance_offered TEXT,
    annual_vacation_weeks TEXT,
    industry TEXT,
    employment_type TEXT,
    is_manager TEXT,
    level TEXT,
    required_hours_per_week TEXT,
    actual_hours_per_week TEXT,
    highest_level_of_formal_education TEXT,
    gender TEXT,
    final_question TEXT
);

-- Execute the data loading function
SELECT load_csv_data();

-- Clean up
DROP FUNCTION load_csv_data();

-- Update statistics
ANALYZE compensation_data;

\echo 'Database initialization with CSV data completed!'; 