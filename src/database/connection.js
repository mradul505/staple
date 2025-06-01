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
  defaultMeta: { service: 'database-connection' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

// Database configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'compensation_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum number of connections
  min: parseInt(process.env.DB_POOL_MIN) || 2,  // Minimum number of connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000, // 2 seconds
  
  // SSL configuration - disabled for Docker containers
  ssl: false,
  
  // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000, // 30 seconds
  
  // Application name for monitoring
  application_name: 'compensation-api',
};

// Create connection pool
const pool = new Pool(dbConfig);

// Pool event handlers
pool.on('connect', (client) => {
  logger.info('New PostgreSQL client connected');
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('remove', (client) => {
  logger.info('Client removed from pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Connect to the database and verify the connection
 */
async function connectDatabase() {
  try {
    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    logger.info('PostgreSQL database connected successfully');
    logger.info(`Connected to database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
    logger.info(`Server time: ${result.rows[0].now}`);
    
    return pool;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL database:', error);
    throw error;
  }
}

/**
 * Execute a query with automatic connection handling
 * @param {string} text - The SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
async function query(text, params) {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error('Query execution failed', {
      query: text,
      params,
      duration: `${duration}ms`,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback function
 * @returns {Promise} Transaction result
 */
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    
    logger.debug('Transaction completed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get connection pool status
 * @returns {Object} Pool status information
 */
function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Close all database connections
 */
async function closeDatabase() {
  try {
    await pool.end();
    logger.info('PostgreSQL connection pool closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL connection pool:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} Connection status
 */
async function healthCheck() {
  try {
    const result = await query('SELECT 1 as healthy');
    return result.rows[0].healthy === 1;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connections...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connections...');
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  pool,
  connectDatabase,
  query,
  transaction,
  getPoolStatus,
  closeDatabase,
  healthCheck,
}; 