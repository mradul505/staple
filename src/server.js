const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createServer } = require('http');
const path = require('path');
require('dotenv').config();

// Import modules
const { typeDefs } = require('./graphql/schema');
const { resolvers } = require('./graphql/resolvers');
const { createContext } = require('./graphql/context');
const { connectDatabase } = require('./database/connection');
const { setupElasticsearch } = require('./database/elasticsearch');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'compensation-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 4000;

  try {
    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }));

    // CORS configuration
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.RATE_LIMIT || 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    app.use('/graphql', limiter);

    // Request logging
    app.use(requestLogger);

    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, '../public')));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // Readiness check endpoint
    app.get('/ready', async (req, res) => {
      try {
        // Check database connections
        const pgStatus = await checkPostgresConnection();
        const esStatus = await checkElasticsearchConnection();
        
        if (pgStatus && esStatus) {
          res.status(200).json({
            status: 'ready',
            services: {
              postgres: 'connected',
              elasticsearch: 'connected'
            }
          });
        } else {
          res.status(503).json({
            status: 'not ready',
            services: {
              postgres: pgStatus ? 'connected' : 'disconnected',
              elasticsearch: esStatus ? 'connected' : 'disconnected'
            }
          });
        }
      } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
          status: 'not ready',
          error: error.message
        });
      }
    });

    // Initialize database connections
    logger.info('Initializing database connections...');
    await connectDatabase();
    await setupElasticsearch();
    logger.info('Database connections established');

    // Create Apollo Server
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: createContext,
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
      debug: process.env.NODE_ENV !== 'production',
      formatError: (error) => {
        logger.error('GraphQL Error:', error);
        
        if (process.env.NODE_ENV === 'production') {
          // Don't expose internal errors in production
          if (error.message.includes('connect') || error.message.includes('timeout')) {
            return new Error('Database connection error');
          }
        }
        
        return error;
      },
    });

    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });

    // Error handling middleware
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Dashboard route
    app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    });

    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
      logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🔍 Readiness check available at http://localhost:${PORT}/ready`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, starting graceful shutdown...');
      await gracefulShutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, starting graceful shutdown...');
      await gracefulShutdown();
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function checkPostgresConnection() {
  try {
    const { pool } = require('./database/connection');
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    logger.error('PostgreSQL health check failed:', error);
    return false;
  }
}

async function checkElasticsearchConnection() {
  try {
    const { client } = require('./database/elasticsearch');
    const response = await client.ping();
    return response;
  } catch (error) {
    logger.error('Elasticsearch health check failed:', error);
    return false;
  }
}

async function gracefulShutdown() {
  try {
    logger.info('Closing database connections...');
    
    // Close PostgreSQL connection
    const { pool } = require('./database/connection');
    await pool.end();
    
    // Close Elasticsearch connection
    const { client } = require('./database/elasticsearch');
    await client.close();
    
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = { startServer };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
} 