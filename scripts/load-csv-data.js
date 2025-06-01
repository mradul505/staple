const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'csv-loader-init' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: 'logs/csv-init.log' })
  ],
});

// Database configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'compensation_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  ssl: false,
  max: 10,
  connectionTimeoutMillis: 30000,
};

const pool = new Pool(dbConfig);

// Field mapping for different CSV schemas
const FIELD_MAPPINGS = {
  'salary_survey-1.csv': {
    timestamp: 'Timestamp',
    employer: null, // No employer field in CSV 1
    location: 'Where are you located? (City/state/country)',
    job_title: 'Job title',
    years_experience_industry: 'How many years of post-college professional work experience do you have?',
    years_experience_company: null,
    annual_base_pay: 'What is your annual salary?',
    signing_bonus: null,
    annual_bonus: null,
    stock_value: null,
    health_insurance_offered: null,
    annual_vacation_weeks: null,
    industry: 'What industry do you work in?',
    employment_type: null,
    is_manager: null,
    level: null,
    required_hours_per_week: null,
    actual_hours_per_week: null,
    highest_level_of_formal_education: null,
    gender: null,
    final_question: 'If your job title needs additional context, please clarify here:'
  },
  'salary_survey-2.csv': {
    timestamp: 'Timestamp',
    employer: 'Company Name',
    location: 'Primary Location (City)',
    job_title: 'Job Title In Company',
    years_experience_industry: 'Years Experience in Industry',
    years_experience_company: 'Years of Experience in Current Company  ',
    annual_base_pay: 'Total Base Salary in 2018 (in USD)',
    signing_bonus: null,
    annual_bonus: 'Total Bonus in 2018 (cumulative annual value in USD)',
    stock_value: 'Total Stock Options/Equity in 2018 (cumulative annual value in USD)',
    health_insurance_offered: 'Health Insurance Offered',
    annual_vacation_weeks: 'Annual Vacation (in Weeks)',
    industry: 'Industry in Company',
    employment_type: 'Employment Type',
    is_manager: null,
    level: 'Job Level',
    required_hours_per_week: 'Required Hours Per Week',
    actual_hours_per_week: 'Actual Hours Per Week',
    highest_level_of_formal_education: 'Highest Level of Formal Education Completed',
    gender: 'Gender',
    final_question: 'Final Question: What are the top skills (you define what that means) that you believe will be necessary for job growth in your industry over the next 10 years?'
  },
  'salary_survey-3.csv': {
    timestamp: 'Timestamp',
    employer: 'Employer',
    location: 'Location',
    job_title: 'Job Title',
    years_experience_industry: 'Years of Experience',
    years_experience_company: 'Years at Employer',
    annual_base_pay: 'Annual Base Pay',
    signing_bonus: 'Signing Bonus',
    annual_bonus: 'Annual Bonus',
    stock_value: 'Annual Stock Value/Bonus',
    health_insurance_offered: null,
    annual_vacation_weeks: null,
    industry: null,
    employment_type: null,
    is_manager: null,
    level: null,
    required_hours_per_week: null,
    actual_hours_per_week: null,
    highest_level_of_formal_education: null,
    gender: 'Gender',
    final_question: 'Additional Comments'
  }
};

/**
 * Normalize and validate data based on CSV schema
 */
function normalizeRecord(row, fileName) {
  const mapping = FIELD_MAPPINGS[fileName];
  if (!mapping) {
    logger.warn(`No mapping found for file: ${fileName}`);
    return null;
  }

  // Map fields based on the CSV schema
  const mappedData = {};
  Object.keys(mapping).forEach(targetField => {
    const sourceField = mapping[targetField];
    mappedData[targetField] = sourceField ? row[sourceField] : null;
  });

  return {
    timestamp: parseDate(mappedData.timestamp) || new Date(),
    employer: sanitizeString(mappedData.employer) || 'Unknown Company',
    location: sanitizeString(mappedData.location) || 'Unknown Location',
    job_title: sanitizeString(mappedData.job_title) || 'Unknown Position',
    years_experience_industry: parseNumber(mappedData.years_experience_industry),
    years_experience_company: parseNumber(mappedData.years_experience_company),
    annual_base_pay: parseCurrency(mappedData.annual_base_pay),
    signing_bonus: parseCurrency(mappedData.signing_bonus),
    annual_bonus: parseCurrency(mappedData.annual_bonus),
    stock_value: parseCurrency(mappedData.stock_value),
    health_insurance_offered: parseBoolean(mappedData.health_insurance_offered),
    annual_vacation_weeks: parseNumber(mappedData.annual_vacation_weeks),
    industry: sanitizeString(mappedData.industry) || 'Unknown Industry',
    employment_type: sanitizeString(mappedData.employment_type) || 'Unknown',
    required_hours_per_week: parseNumber(mappedData.required_hours_per_week),
    actual_hours_per_week: parseNumber(mappedData.actual_hours_per_week),
    education_level: sanitizeString(mappedData.highest_level_of_formal_education) || 'Unknown',
    gender: sanitizeString(mappedData.gender) || 'Unknown',
    additional_comments: sanitizeString(mappedData.final_question) || '',
    data_quality_score: calculateDataQuality(mappedData),
    source_file: fileName,
    row_number: 1, // Will be updated during insertion
    created_at: new Date(),
    updated_at: new Date()
  };
}

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return null;
  const cleaned = str.trim().replace(/['"]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

function parseNumber(str) {
  if (!str) return null;
  
  // Handle range formats like "11 - 20 years", "8 - 10 years", "5-7 years"
  const rangeMatch = str.toString().match(/(\d+)\s*[-–]\s*(\d+)\s*years?/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return !isNaN(min) && !isNaN(max) ? (min + max) / 2 : null; // Take average of range
  }
  
  // Handle various number formats
  const cleanStr = str.toString().replace(/[,$\s]/g, '').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleanStr);
  return !isNaN(num) && isFinite(num) ? num : null;
}

function parseCurrency(str) {
  if (!str) return null;
  
  // Handle currency strings like "$50,000", "65,000", "50k", etc.
  let cleanStr = str.toString().toLowerCase().replace(/[,$\s]/g, '').replace(/[^\d.k]/g, '');
  
  // Handle 'k' suffix (thousands)
  if (cleanStr.includes('k')) {
    const num = parseFloat(cleanStr.replace('k', ''));
    return !isNaN(num) ? Math.round(num * 1000 * 100) : null; // Convert to cents
  }
  
  // Handle 'm' suffix (millions)
  if (cleanStr.includes('m')) {
    const num = parseFloat(cleanStr.replace('m', ''));
    return !isNaN(num) ? Math.round(num * 1000000 * 100) : null; // Convert to cents
  }
  
  // Regular number
  const num = parseFloat(cleanStr);
  return !isNaN(num) && num > 0 ? Math.round(num * 100) : null; // Convert to cents
}

function parseBoolean(str) {
  if (!str) return null;
  const lower = str.toString().toLowerCase().trim();
  if (['yes', 'true', '1', 'y', 'offered'].includes(lower)) return true;
  if (['no', 'false', '0', 'n', 'not offered'].includes(lower)) return false;
  return null;
}

function parseDate(str) {
  if (!str) return null;
  try {
    // Handle various date formats
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}$/)) {
      // Format: "4/24/2019 11:43:21"
      const date = new Date(str);
      return !isNaN(date.getTime()) ? date : null;
    }
    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
      // Format: "4/24/2019"
      const date = new Date(str);
      return !isNaN(date.getTime()) ? date : null;
    }
    
    // Try parsing as-is
    const date = new Date(str);
    return !isNaN(date.getTime()) ? date : null;
  } catch (error) {
    logger.warn(`Failed to parse date: ${str} - ${error.message}`);
    return null;
  }
}

function calculateDataQuality(row) {
  let score = 0;
  let total = 0;
  
  // Check completeness of key fields
  const keyFields = ['employer', 'location', 'job_title', 'annual_base_pay'];
  keyFields.forEach(field => {
    total += 25;
    if (row[field] && row[field].toString().trim()) score += 25;
  });
  
  return Math.round((score / total) * 100);
}

/**
 * Insert records in batches
 */
async function insertBatch(records) {
  if (records.length === 0) return;
  
  // Validate records before insertion
  const validatedRecords = records.map((record, index) => {
    // Add row number based on index
    record.row_number = index + 1;
    
    // Validate numeric fields to prevent overflow
    if (record.annual_base_pay && record.annual_base_pay > 99999999999) { // Cap at $999,999,999.99
      logger.warn(`Extremely large salary detected (${record.annual_base_pay}), capping at 99999999999`);
      record.annual_base_pay = 99999999999;
    }
    
    if (record.signing_bonus && record.signing_bonus > 99999999999) {
      logger.warn(`Extremely large signing bonus detected (${record.signing_bonus}), capping at 99999999999`);
      record.signing_bonus = 99999999999;
    }
    
    if (record.annual_bonus && record.annual_bonus > 99999999999) {
      logger.warn(`Extremely large annual bonus detected (${record.annual_bonus}), capping at 99999999999`);
      record.annual_bonus = 99999999999;
    }
    
    if (record.stock_value && record.stock_value > 99999999999) {
      logger.warn(`Extremely large stock value detected (${record.stock_value}), capping at 99999999999`);
      record.stock_value = 99999999999;
    }
    
    if (record.years_experience_industry && record.years_experience_industry > 99) {
      logger.warn(`Large experience value detected (${record.years_experience_industry}), capping at 50`);
      record.years_experience_industry = 50;
    }
    
    if (record.years_experience_industry && record.years_experience_industry < 0) {
      logger.warn(`Negative experience value detected (${record.years_experience_industry}), setting to NULL`);
      record.years_experience_industry = null;
    }
    
    if (record.years_experience_company && record.years_experience_company > 99) {
      logger.warn(`Large company experience detected (${record.years_experience_company}), capping at 50`);
      record.years_experience_company = 50;
    }
    
    if (record.years_experience_company && record.years_experience_company < 0) {
      logger.warn(`Negative company experience detected (${record.years_experience_company}), setting to NULL`);
      record.years_experience_company = null;
    }
    
    return record;
  });
  
  const values = [];
  const placeholders = [];
  
  validatedRecords.forEach((record, index) => {
    const baseIndex = index * 24; // Updated to include row_number
    placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18}, $${baseIndex + 19}, $${baseIndex + 20}, $${baseIndex + 21}, $${baseIndex + 22}, $${baseIndex + 23}, $${baseIndex + 24})`);
    
    values.push(
      record.timestamp, record.employer, record.location, record.job_title,
      record.years_experience_industry, record.years_experience_company,
      record.annual_base_pay, record.signing_bonus, record.annual_bonus,
      record.stock_value, record.health_insurance_offered,
      record.annual_vacation_weeks, record.industry, record.employment_type,
      record.required_hours_per_week, record.actual_hours_per_week,
      record.education_level, record.gender, record.additional_comments,
      record.data_quality_score, record.source_file, record.row_number,
      record.created_at, record.updated_at
    );
  });
  
  const query = `
    INSERT INTO compensation_data (
      timestamp, employer, location, job_title, years_experience_industry,
      years_experience_company, annual_base_pay, signing_bonus, annual_bonus,
      stock_value, health_insurance_offered, annual_vacation_weeks, industry,
      employment_type, required_hours_per_week, actual_hours_per_week,
      education_level, gender, additional_comments, data_quality_score, 
      source_file, row_number, created_at, updated_at
    ) VALUES ${placeholders.join(', ')}
  `;
  
  try {
    await pool.query(query, values);
  } catch (error) {
    logger.error(`Database insertion error: ${error.message}`);
    logger.error(`Sample record causing error: ${JSON.stringify(validatedRecords[0])}`);
    throw error;
  }
}

/**
 * Load CSV file
 */
async function loadCSVFile(filePath, fileName) {
  return new Promise((resolve, reject) => {
    const records = [];
    let rowCount = 0;
    let validRecords = 0;
    let sampleRows = [];
    
    logger.info(`Loading ${fileName}...`);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        
        // Log first few rows for debugging
        if (rowCount <= 3) {
          sampleRows.push(Object.keys(row).slice(0, 5));
        }
        
        try {
          const normalized = normalizeRecord(row, fileName);
          if (normalized) {
            // Less strict validation - just need some basic data
            if (normalized.annual_base_pay > 0 || normalized.job_title !== 'Unknown Position') {
              records.push(normalized);
              validRecords++;
            }
          }
        } catch (error) {
          logger.warn(`Error processing row ${rowCount} in ${fileName}: ${error.message}`);
        }
      })
      .on('end', () => {
        logger.info(`File: ${fileName}`);
        logger.info(`Sample columns: ${JSON.stringify(sampleRows[0] || [])}`);
        logger.info(`Processed ${rowCount} rows from ${fileName}, ${validRecords} valid records`);
        resolve(records);
      })
      .on('error', reject);
  });
}

/**
 * Main loading function
 */
async function loadAllCSVData() {
  try {
    logger.info('Starting CSV data loading process...');
    
    // Connect to database
    await pool.connect();
    logger.info('Connected to PostgreSQL database');
    
    // CSV files to load
    const csvFiles = [
      'salary_survey-1.csv',
      'salary_survey-2.csv', 
      'salary_survey-3.csv'
    ];
    
    let totalRecords = 0;
    const batchSize = 100;
    
    for (const fileName of csvFiles) {
      const filePath = path.join('/app/csv', fileName);
      
      if (!fs.existsSync(filePath)) {
        logger.warn(`File not found: ${filePath}`);
        continue;
      }
      
      try {
        const records = await loadCSVFile(filePath, fileName);
        
        if (records.length === 0) {
          logger.warn(`No valid records found in ${fileName}`);
          continue;
        }
        
        // Insert in batches
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          await insertBatch(batch);
          
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(records.length / batchSize);
          logger.info(`Inserted batch ${batchNumber}/${totalBatches} from ${fileName} (${i + batch.length}/${records.length} records)`);
        }
        
        totalRecords += records.length;
        logger.info(`Completed loading ${fileName}: ${records.length} records inserted`);
        
      } catch (error) {
        logger.error(`Failed to load ${fileName}: ${error.message}`);
        logger.error(`Stack: ${error.stack}`);
      }
    }
    
    // Update statistics
    await pool.query('ANALYZE compensation_data');
    
    // Get final count
    const countResult = await pool.query('SELECT COUNT(*) FROM compensation_data');
    const finalCount = countResult.rows[0].count;
    
    logger.info(`CSV data loading completed successfully!`);
    logger.info(`Total records processed: ${totalRecords}`);
    logger.info(`Final database count: ${finalCount}`);
    
    // Log some sample data
    const sampleResult = await pool.query('SELECT employer, job_title, annual_base_pay, location FROM compensation_data LIMIT 5');
    logger.info(`Sample records: ${JSON.stringify(sampleResult.rows)}`);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Failed to load CSV data:', error);
    logger.error(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle cleanup
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connection...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connection...');
  await pool.end();
  process.exit(0);
});

// Start loading
loadAllCSVData(); 