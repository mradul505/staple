# Database Design Documentation

## Overview

This document outlines the database design decisions for the Compensation Data Management System. The system employs a dual-database architecture using both PostgreSQL (relational) and ElasticSearch (NoSQL) to leverage the strengths of each technology.

## Architecture Decision

### Dual Database Strategy

We chose a dual-database approach to optimize for different use cases:

1. **PostgreSQL**: Primary database for structured data, ACID transactions, and complex relational queries
2. **ElasticSearch**: Secondary database optimized for full-text search, analytics, and real-time aggregations

## PostgreSQL Schema Design

### Table Structure

#### `compensation_data` (Primary Table)

```sql
CREATE TABLE compensation_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    employment_type VARCHAR(50),
    
    -- Experience Data
    years_experience_industry DECIMAL(4,2),
    years_experience_company DECIMAL(4,2),
    years_at_employer DECIMAL(4,2),
    
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
    gender VARCHAR(50),
    education_level VARCHAR(200),
    
    -- Job Satisfaction
    is_happy_at_position BOOLEAN,
    plans_to_resign BOOLEAN,
    
    -- Additional Data
    health_insurance_offered BOOLEAN,
    additional_comments TEXT,
    
    -- Metadata
    data_quality_score DECIMAL(3,2) DEFAULT 1.0,
    is_validated BOOLEAN DEFAULT FALSE,
    
    -- Constraints
    CONSTRAINT valid_compensation CHECK (annual_base_pay >= 0),
    CONSTRAINT valid_experience CHECK (years_experience_industry >= 0),
    CONSTRAINT valid_hours CHECK (actual_hours_per_week >= 0 AND actual_hours_per_week <= 168)
);
```

#### Supporting Tables

```sql
-- Normalization tables for better data integrity
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) UNIQUE NOT NULL,
    size_category VARCHAR(100),
    industry VARCHAR(200),
    is_public BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(200),
    state_province VARCHAR(100),
    country VARCHAR(100),
    full_location VARCHAR(500),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    UNIQUE(city, state_province, country)
);

CREATE TABLE job_titles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) UNIQUE NOT NULL,
    normalized_title VARCHAR(500),
    category VARCHAR(200),
    seniority_level VARCHAR(100)
);
```

### Indexing Strategy

#### Primary Indexes
```sql
-- Performance optimization indexes
CREATE INDEX idx_compensation_employer ON compensation_data(employer);
CREATE INDEX idx_compensation_location ON compensation_data(location);
CREATE INDEX idx_compensation_job_title ON compensation_data(job_title);
CREATE INDEX idx_compensation_salary ON compensation_data(annual_base_pay);
CREATE INDEX idx_compensation_experience ON compensation_data(years_experience_industry);
CREATE INDEX idx_compensation_timestamp ON compensation_data(timestamp);

-- Composite indexes for common query patterns
CREATE INDEX idx_compensation_location_salary ON compensation_data(location, annual_base_pay);
CREATE INDEX idx_compensation_title_salary ON compensation_data(job_title, annual_base_pay);
CREATE INDEX idx_compensation_experience_salary ON compensation_data(years_experience_industry, annual_base_pay);

-- Full-text search indexes
CREATE INDEX idx_compensation_title_fts ON compensation_data USING gin(to_tsvector('english', job_title));
CREATE INDEX idx_compensation_employer_fts ON compensation_data USING gin(to_tsvector('english', employer));
```

#### Partial Indexes
```sql
-- Indexes for filtered queries
CREATE INDEX idx_compensation_engineers ON compensation_data(annual_base_pay) 
WHERE job_title ILIKE '%engineer%';

CREATE INDEX idx_compensation_high_salary ON compensation_data(job_title, location) 
WHERE annual_base_pay > 10000000; -- > $100,000

CREATE INDEX idx_compensation_recent ON compensation_data(annual_base_pay) 
WHERE timestamp > '2020-01-01';
```

### Data Validation Rules

1. **Salary Validation**: Annual base pay must be positive and within reasonable bounds
2. **Experience Validation**: Years of experience cannot be negative or exceed 60 years
3. **Location Validation**: Location data is geocoded when possible
4. **Title Normalization**: Job titles are normalized to standard categories

## ElasticSearch Design

### Index Mapping

```json
{
  "compensation_data": {
    "mappings": {
      "properties": {
        "id": {
          "type": "keyword"
        },
        "timestamp": {
          "type": "date",
          "format": "strict_date_time"
        },
        "employer": {
          "type": "text",
          "analyzer": "standard",
          "fields": {
            "keyword": {
              "type": "keyword",
              "ignore_above": 256
            },
            "suggest": {
              "type": "completion"
            }
          }
        },
        "location": {
          "type": "text",
          "analyzer": "standard",
          "fields": {
            "keyword": {
              "type": "keyword"
            }
          }
        },
        "geo_location": {
          "type": "geo_point"
        },
        "job_title": {
          "type": "text",
          "analyzer": "job_title_analyzer",
          "fields": {
            "keyword": {
              "type": "keyword"
            },
            "suggest": {
              "type": "completion"
            }
          }
        },
        "annual_base_pay": {
          "type": "long",
          "meta": {
            "unit": "cents"
          }
        },
        "annual_bonus": {
          "type": "long"
        },
        "years_experience_industry": {
          "type": "float"
        },
        "gender": {
          "type": "keyword"
        },
        "education_level": {
          "type": "keyword"
        },
        "company_size": {
          "type": "keyword"
        },
        "industry": {
          "type": "keyword"
        }
      }
    },
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "analysis": {
        "analyzer": {
          "job_title_analyzer": {
            "tokenizer": "standard",
            "filter": [
              "lowercase",
              "job_title_synonyms",
              "stemmer"
            ]
          }
        },
        "filter": {
          "job_title_synonyms": {
            "type": "synonym",
            "synonyms": [
              "software engineer,swe,developer,programmer",
              "data scientist,data analyst,analyst",
              "product manager,pm,product owner",
              "senior,sr,lead,principal"
            ]
          }
        }
      }
    }
  }
}
```

### ElasticSearch Optimization

1. **Field Types**: Appropriate field types for different query patterns
2. **Multi-fields**: Text fields have keyword counterparts for exact matching
3. **Completion Suggesters**: Auto-complete functionality for job titles and companies
4. **Synonyms**: Job title synonyms for better search relevance
5. **Geo-points**: Location data for geographic queries

## Data Synchronization

### Sync Strategy

1. **Primary Write**: All writes go to PostgreSQL first
2. **Async Sync**: ElasticSearch is updated asynchronously via event-driven sync
3. **Conflict Resolution**: PostgreSQL is the source of truth for conflicts
4. **Consistency**: Eventually consistent between systems

### Sync Implementation

```javascript
// Event-driven synchronization
const syncToElasticSearch = async (record) => {
  try {
    await esClient.index({
      index: 'compensation_data',
      id: record.id,
      body: transformRecord(record)
    });
  } catch (error) {
    // Handle sync failures with retry logic
    await retrySync(record, error);
  }
};
```

## Query Optimization Patterns

### Common Query Patterns

1. **Salary Range Queries**
   ```sql
   SELECT * FROM compensation_data 
   WHERE annual_base_pay BETWEEN 8000000 AND 15000000  -- $80k-$150k
   AND location ILIKE '%San Francisco%';
   ```

2. **Engineer Salary Analysis**
   ```sql
   SELECT 
     AVG(annual_base_pay::DECIMAL / 100) as avg_salary,
     COUNT(*) as count,
     location
   FROM compensation_data 
   WHERE job_title ILIKE '%engineer%'
   GROUP BY location
   ORDER BY avg_salary DESC;
   ```

3. **Experience vs Salary Correlation**
   ```sql
   SELECT 
     CASE 
       WHEN years_experience_industry < 2 THEN '0-2 years'
       WHEN years_experience_industry < 5 THEN '2-5 years'
       WHEN years_experience_industry < 10 THEN '5-10 years'
       ELSE '10+ years'
     END as experience_bracket,
     AVG(annual_base_pay::DECIMAL / 100) as avg_salary,
     COUNT(*) as count
   FROM compensation_data 
   WHERE annual_base_pay IS NOT NULL
   GROUP BY experience_bracket
   ORDER BY experience_bracket;
   ```

## Performance Considerations

### PostgreSQL Optimizations

1. **Connection Pooling**: PgPool for connection management
2. **Query Planning**: Regular ANALYZE for optimal query plans
3. **Partitioning**: Table partitioning by date for large datasets
4. **Materialized Views**: Pre-computed aggregations for dashboards

### ElasticSearch Optimizations

1. **Shard Strategy**: Single shard for datasets < 10M records
2. **Refresh Interval**: Optimized refresh intervals for near real-time search
3. **Aggregation Caching**: Cache frequently used aggregations
4. **Field Data Circuit Breaker**: Memory protection for large aggregations

## Data Quality and Integrity

### Validation Rules

1. **Salary Bounds**: Reasonable salary ranges (e.g., $1,000 - $10,000,000)
2. **Location Validation**: Geocoding validation for location data
3. **Title Standardization**: Job title normalization and categorization
4. **Duplicate Detection**: De-duplication logic for similar records

### Data Cleaning Pipeline

```javascript
const cleanRecord = (record) => {
  return {
    ...record,
    annual_base_pay: sanitizeSalary(record.annual_base_pay),
    location: normalizeLocation(record.location),
    job_title: normalizeJobTitle(record.job_title),
    employer: normalizeCompanyName(record.employer)
  };
};
```

## Backup and Recovery

### PostgreSQL Backup Strategy

1. **Daily Backups**: Full database backups
2. **WAL Archiving**: Point-in-time recovery capability
3. **Replica Standby**: Hot standby for high availability

### ElasticSearch Backup Strategy

1. **Snapshot Repository**: S3-based snapshot storage
2. **Daily Snapshots**: Automated daily index snapshots
3. **Cross-cluster Replication**: For disaster recovery

## Monitoring and Alerting

### Key Metrics

1. **Query Performance**: Response times and throughput
2. **Data Quality**: Validation failure rates
3. **Sync Health**: PostgreSQL to ElasticSearch sync status
4. **Storage Usage**: Database size and growth trends

### Alert Conditions

1. Query response time > 5 seconds
2. Sync lag > 5 minutes
3. Data validation failure rate > 5%
4. Database connection pool exhaustion

This design provides a robust, scalable foundation for the compensation data management system while optimizing for both relational queries and search/analytics workloads. 