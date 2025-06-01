-- Compensation Data Management System
-- PostgreSQL Database Initialization Script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the main compensation data table
CREATE TABLE IF NOT EXISTS compensation_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_file VARCHAR(100) NOT NULL,
    row_number INTEGER NOT NULL,
    
    -- Temporal Data
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Company Information
    employer VARCHAR(500),
    company_size VARCHAR(100),
    industry VARCHAR(200),
    public_private VARCHAR(20),
    
    -- Location Data
    location VARCHAR(500),
    city VARCHAR(200),
    state_province VARCHAR(100),
    country VARCHAR(100),
    
    -- Job Information
    job_title VARCHAR(500),
    job_ladder VARCHAR(200),
    job_level VARCHAR(100),
    employment_type VARCHAR(100),
    
    -- Experience Data
    years_experience_industry DECIMAL(5,2),
    years_experience_company DECIMAL(5,2),
    years_at_employer DECIMAL(5,2),
    
    -- Compensation Data (stored in cents to avoid floating point issues)
    annual_base_pay BIGINT, -- in cents
    annual_bonus BIGINT,    -- in cents
    signing_bonus BIGINT,   -- in cents
    stock_value BIGINT,     -- in cents
    
    -- Work Schedule
    required_hours_per_week INTEGER,
    actual_hours_per_week INTEGER,
    annual_vacation_weeks INTEGER,
    
    -- Personal Information
    gender VARCHAR(100),
    education_level VARCHAR(300),
    
    -- Job Satisfaction
    is_happy_at_position BOOLEAN,
    plans_to_resign BOOLEAN,
    
    -- Additional Data
    health_insurance_offered BOOLEAN,
    additional_comments TEXT,
    
    -- Metadata
    data_quality_score DECIMAL(5,2) DEFAULT 1.0,
    is_validated BOOLEAN DEFAULT FALSE,
    
    -- Constraints
    CONSTRAINT valid_compensation CHECK (annual_base_pay >= 0 OR annual_base_pay IS NULL),
    CONSTRAINT valid_experience CHECK (years_experience_industry >= 0 OR years_experience_industry IS NULL),
    CONSTRAINT valid_hours CHECK (actual_hours_per_week >= 0 AND actual_hours_per_week <= 168 OR actual_hours_per_week IS NULL)
);

-- Supporting tables for normalization
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) UNIQUE NOT NULL,
    size_category VARCHAR(100),
    industry VARCHAR(200),
    is_public BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(200),
    state_province VARCHAR(100),
    country VARCHAR(100),
    full_location VARCHAR(500),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(city, state_province, country)
);

CREATE TABLE IF NOT EXISTS job_titles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) UNIQUE NOT NULL,
    normalized_title VARCHAR(500),
    category VARCHAR(200),
    seniority_level VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
-- Primary indexes
CREATE INDEX IF NOT EXISTS idx_compensation_employer ON compensation_data(employer);
CREATE INDEX IF NOT EXISTS idx_compensation_location ON compensation_data(location);
CREATE INDEX IF NOT EXISTS idx_compensation_job_title ON compensation_data(job_title);
CREATE INDEX IF NOT EXISTS idx_compensation_salary ON compensation_data(annual_base_pay);
CREATE INDEX IF NOT EXISTS idx_compensation_experience ON compensation_data(years_experience_industry);
CREATE INDEX IF NOT EXISTS idx_compensation_timestamp ON compensation_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_compensation_created_at ON compensation_data(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_compensation_location_salary ON compensation_data(location, annual_base_pay);
CREATE INDEX IF NOT EXISTS idx_compensation_title_salary ON compensation_data(job_title, annual_base_pay);
CREATE INDEX IF NOT EXISTS idx_compensation_experience_salary ON compensation_data(years_experience_industry, annual_base_pay);
CREATE INDEX IF NOT EXISTS idx_compensation_source_row ON compensation_data(source_file, row_number);

-- Partial indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_compensation_engineers ON compensation_data(annual_base_pay) 
WHERE job_title ILIKE '%engineer%';

CREATE INDEX IF NOT EXISTS idx_compensation_high_salary ON compensation_data(job_title, location) 
WHERE annual_base_pay > 10000000; -- > $100,000

CREATE INDEX IF NOT EXISTS idx_compensation_recent ON compensation_data(annual_base_pay) 
WHERE timestamp > '2020-01-01';

-- Create views for common aggregations
CREATE OR REPLACE VIEW compensation_by_location AS
SELECT 
    location,
    COUNT(*) as total_records,
    AVG(annual_base_pay::DECIMAL / 100) as avg_salary,
    MIN(annual_base_pay::DECIMAL / 100) as min_salary,
    MAX(annual_base_pay::DECIMAL / 100) as max_salary,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
FROM compensation_data 
WHERE annual_base_pay IS NOT NULL 
  AND annual_base_pay > 0
GROUP BY location
ORDER BY avg_salary DESC;

CREATE OR REPLACE VIEW compensation_by_title AS
SELECT 
    job_title,
    COUNT(*) as total_records,
    AVG(annual_base_pay::DECIMAL / 100) as avg_salary,
    MIN(annual_base_pay::DECIMAL / 100) as min_salary,
    MAX(annual_base_pay::DECIMAL / 100) as max_salary,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
FROM compensation_data 
WHERE annual_base_pay IS NOT NULL 
  AND annual_base_pay > 0
  AND job_title IS NOT NULL
GROUP BY job_title
ORDER BY avg_salary DESC;

CREATE OR REPLACE VIEW engineer_compensation AS
SELECT 
    location,
    job_title,
    COUNT(*) as total_records,
    AVG(annual_base_pay::DECIMAL / 100) as avg_salary,
    MIN(annual_base_pay::DECIMAL / 100) as min_salary,
    MAX(annual_base_pay::DECIMAL / 100) as max_salary,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
FROM compensation_data 
WHERE job_title ILIKE '%engineer%'
  AND annual_base_pay IS NOT NULL 
  AND annual_base_pay > 0
GROUP BY location, job_title
ORDER BY avg_salary DESC;

-- Create function for updating the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic updated_at column updates
CREATE TRIGGER update_compensation_data_updated_at 
    BEFORE UPDATE ON compensation_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data if needed (for testing)
-- This can be uncommented for development/testing purposes
/*
INSERT INTO compensation_data (
    source_file, row_number, employer, location, job_title, 
    annual_base_pay, years_experience_industry, gender
) VALUES 
    ('sample.csv', 1, 'Tech Corp', 'San Francisco, CA', 'Software Engineer', 12000000, 5.0, 'Male'),
    ('sample.csv', 2, 'Data Inc', 'New York, NY', 'Data Scientist', 11000000, 3.0, 'Female'),
    ('sample.csv', 3, 'Start Up', 'Austin, TX', 'Product Manager', 9500000, 4.0, 'Male')
ON CONFLICT DO NOTHING;
*/

-- Grant permissions for the application user
-- Note: In production, you should create a specific user with limited permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON compensation_data TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_titles TO postgres;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS compensation_stats AS
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT employer) as unique_companies,
    COUNT(DISTINCT location) as unique_locations,
    COUNT(DISTINCT job_title) as unique_job_titles,
    AVG(annual_base_pay::DECIMAL / 100) as overall_avg_salary,
    MIN(annual_base_pay::DECIMAL / 100) as min_salary,
    MAX(annual_base_pay::DECIMAL / 100) as max_salary,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as q1_salary,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as q3_salary,
    NOW() as last_updated
FROM compensation_data 
WHERE annual_base_pay IS NOT NULL AND annual_base_pay > 0;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_compensation_stats_unique ON compensation_stats(last_updated);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_compensation_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY compensation_stats;
END;
$$ LANGUAGE plpgsql;

-- Analyze tables for query optimization
ANALYZE compensation_data;
ANALYZE companies;
ANALYZE locations;
ANALYZE job_titles; 