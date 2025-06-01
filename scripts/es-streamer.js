const { Pool } = require('pg');
const { Client } = require('@elastic/elasticsearch');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'es-streamer' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: 'logs/es-streamer.log' })
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
  max: 20,
  connectionTimeoutMillis: 30000,
};

// ElasticSearch configuration
const esConfig = {
  node: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
  requestTimeout: 60000,
  pingTimeout: 3000,
  maxRetries: 3,
};

const pool = new Pool(dbConfig);
const esClient = new Client(esConfig);

const BATCH_SIZE = 1000; // Optimized batch size for bulk operations
const INDEX_NAME = 'compensation_data';
const MAX_RETRIES = 3;

/**
 * Setup ElasticSearch index with optimized mapping
 */
async function setupElasticSearchIndex() {
  try {
    // Check if index exists
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });
    
    if (indexExists) {
      logger.info(`ElasticSearch index '${INDEX_NAME}' already exists`);
      return;
    }
    
    // Create index with optimized mapping
    const mapping = {
      mappings: {
        properties: {
          timestamp: { type: 'date' },
          employer: { 
            type: 'text', 
            fields: { keyword: { type: 'keyword' } },
            analyzer: 'standard'
          },
          location: { 
            type: 'text', 
            fields: { keyword: { type: 'keyword' } },
            analyzer: 'standard'
          },
          job_title: { 
            type: 'text', 
            fields: { keyword: { type: 'keyword' } },
            analyzer: 'standard'
          },
          years_experience_industry: { type: 'float' },
          years_experience_company: { type: 'float' },
          annual_base_pay: { type: 'long' },
          signing_bonus: { type: 'long' },
          annual_bonus: { type: 'long' },
          stock_value: { type: 'long' },
          health_insurance_offered: { type: 'boolean' },
          annual_vacation_weeks: { type: 'float' },
          industry: { 
            type: 'text', 
            fields: { keyword: { type: 'keyword' } }
          },
          employment_type: { 
            type: 'keyword' 
          },
          is_manager: { type: 'boolean' },
          level: { 
            type: 'text', 
            fields: { keyword: { type: 'keyword' } }
          },
          required_hours_per_week: { type: 'float' },
          actual_hours_per_week: { type: 'float' },
          highest_level_of_formal_education: { 
            type: 'keyword' 
          },
          gender: { type: 'keyword' },
          final_question: { type: 'text' },
          data_quality_score: { type: 'float' },
          source_file: { type: 'keyword' },
          created_at: { type: 'date' },
          updated_at: { type: 'date' },
          // Computed fields for analytics
          total_compensation: { type: 'long' },
          compensation_range: { type: 'keyword' },
          experience_level: { type: 'keyword' }
        }
      },
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        refresh_interval: '30s',
        index: {
          max_result_window: 50000
        }
      }
    };
    
    await esClient.indices.create({
      index: INDEX_NAME,
      body: mapping
    });
    
    logger.info(`Created ElasticSearch index '${INDEX_NAME}' with optimized mapping`);
    
  } catch (error) {
    logger.error('Failed to setup ElasticSearch index:', error);
    throw error;
  }
}

/**
 * Transform PostgreSQL record for ElasticSearch
 */
function transformRecord(record) {
  const transformed = { ...record };
  
  // Calculate total compensation
  const basePay = record.annual_base_pay || 0;
  const bonus = record.annual_bonus || 0;
  const stock = record.stock_value || 0;
  transformed.total_compensation = basePay + bonus + stock;
  
  // Add compensation range
  const totalInDollars = transformed.total_compensation / 100;
  if (totalInDollars < 50000) {
    transformed.compensation_range = 'Entry Level';
  } else if (totalInDollars < 100000) {
    transformed.compensation_range = 'Mid Level';
  } else if (totalInDollars < 200000) {
    transformed.compensation_range = 'Senior Level';
  } else {
    transformed.compensation_range = 'Executive Level';
  }
  
  // Add experience level
  const experience = record.years_experience_industry || 0;
  if (experience < 2) {
    transformed.experience_level = 'Junior';
  } else if (experience < 5) {
    transformed.experience_level = 'Mid-Level';
  } else if (experience < 10) {
    transformed.experience_level = 'Senior';
  } else {
    transformed.experience_level = 'Expert';
  }
  
  return transformed;
}

/**
 * Stream data from PostgreSQL to ElasticSearch in batches
 */
async function streamDataToElasticSearch() {
  try {
    logger.info('Starting data streaming from PostgreSQL to ElasticSearch...');
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM compensation_data');
    const totalRecords = parseInt(countResult.rows[0].count);
    
    logger.info(`Total records to stream: ${totalRecords}`);
    
    if (totalRecords === 0) {
      logger.warn('No data found in PostgreSQL to stream');
      return;
    }
    
    let offset = 0;
    let processedRecords = 0;
    let failedRecords = 0;
    
    while (offset < totalRecords) {
      // Fetch batch from PostgreSQL
      const query = `
        SELECT * FROM compensation_data 
        ORDER BY id 
        LIMIT $1 OFFSET $2
      `;
      
      const result = await pool.query(query, [BATCH_SIZE, offset]);
      const records = result.rows;
      
      if (records.length === 0) break;
      
      // Prepare bulk operations
      const bulkOps = [];
      
      records.forEach(record => {
        const transformed = transformRecord(record);
        
        bulkOps.push({
          index: {
            _index: INDEX_NAME,
            _id: record.id
          }
        });
        
        bulkOps.push(transformed);
      });
      
      // Execute bulk operation with retry logic
      let retries = 0;
      let success = false;
      
      while (retries < MAX_RETRIES && !success) {
        try {
          const bulkResponse = await esClient.bulk({
            body: bulkOps,
            refresh: false,
            timeout: '60s'
          });
          
          // Check for errors
          if (bulkResponse.errors) {
            const errorCount = bulkResponse.items.filter(item => 
              item.index && item.index.error
            ).length;
            
            if (errorCount > 0) {
              logger.warn(`Bulk operation had ${errorCount} errors out of ${records.length} documents`);
              failedRecords += errorCount;
            }
          }
          
          success = true;
          processedRecords += records.length;
          
          const batchNumber = Math.floor(offset / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
          
          logger.info(`Streamed batch ${batchNumber}/${totalBatches}: ${records.length} records (${processedRecords}/${totalRecords} total)`);
          
        } catch (error) {
          retries++;
          logger.warn(`Bulk operation failed (attempt ${retries}/${MAX_RETRIES}): ${error.message}`);
          
          if (retries >= MAX_RETRIES) {
            logger.error(`Failed to index batch after ${MAX_RETRIES} retries`);
            failedRecords += records.length;
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retries * 1000));
          }
        }
      }
      
      offset += BATCH_SIZE;
      
      // Small delay between batches to prevent overwhelming ES
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Force refresh to make data searchable
    await esClient.indices.refresh({ index: INDEX_NAME });
    
    logger.info('Data streaming completed!');
    logger.info(`Successfully processed: ${processedRecords} records`);
    logger.info(`Failed records: ${failedRecords}`);
    
    // Verify the data
    const esCountResponse = await esClient.count({ index: INDEX_NAME });
    logger.info(`ElasticSearch index now contains: ${esCountResponse.count} documents`);
    
  } catch (error) {
    logger.error('Failed to stream data to ElasticSearch:', error);
    throw error;
  }
}

/**
 * Setup real-time streaming using PostgreSQL LISTEN/NOTIFY
 */
async function setupRealTimeStreaming() {
  try {
    logger.info('Setting up real-time data streaming...');
    
    // Create a dedicated connection for listening
    const listenClient = await pool.connect();
    
    // Setup trigger for real-time updates (if not exists)
    await listenClient.query(`
      CREATE OR REPLACE FUNCTION notify_compensation_change() 
      RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('compensation_data_change', 
          json_build_object(
            'operation', TG_OP,
            'id', COALESCE(NEW.id, OLD.id),
            'data', row_to_json(NEW)
          )::text
        );
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await listenClient.query(`
      DROP TRIGGER IF EXISTS compensation_data_trigger ON compensation_data;
      CREATE TRIGGER compensation_data_trigger
        AFTER INSERT OR UPDATE OR DELETE ON compensation_data
        FOR EACH ROW EXECUTE FUNCTION notify_compensation_change();
    `);
    
    // Listen for changes
    await listenClient.query('LISTEN compensation_data_change');
    
    listenClient.on('notification', async (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        
        if (payload.operation === 'INSERT' || payload.operation === 'UPDATE') {
          const transformed = transformRecord(payload.data);
          
          await esClient.index({
            index: INDEX_NAME,
            id: payload.id,
            body: transformed,
            refresh: 'wait_for'
          });
          
          logger.debug(`Real-time indexed document ID: ${payload.id}`);
          
        } else if (payload.operation === 'DELETE') {
          await esClient.delete({
            index: INDEX_NAME,
            id: payload.id,
            refresh: 'wait_for'
          });
          
          logger.debug(`Real-time deleted document ID: ${payload.id}`);
        }
        
      } catch (error) {
        logger.error('Failed to process real-time update:', error);
      }
    });
    
    logger.info('Real-time streaming setup completed');
    
  } catch (error) {
    logger.error('Failed to setup real-time streaming:', error);
  }
}

/**
 * Main streaming function
 */
async function startStreaming() {
  try {
    // Test connections
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connection verified');
    
    await esClient.ping();
    logger.info('ElasticSearch connection verified');
    
    // Setup ElasticSearch index
    await setupElasticSearchIndex();
    
    // Stream existing data
    await streamDataToElasticSearch();
    
    // Setup real-time streaming
    await setupRealTimeStreaming();
    
    logger.info('ElasticSearch streaming service is running...');
    
    // Keep the service running
    setInterval(async () => {
      try {
        // Health check
        await esClient.ping();
        await pool.query('SELECT 1');
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000);
    
  } catch (error) {
    logger.error('Failed to start streaming service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await pool.end();
  await esClient.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await pool.end();
  await esClient.close();
  process.exit(0);
});

// Start the streaming service
startStreaming(); 