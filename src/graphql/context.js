const { pool } = require('../database/connection');
const { client: esClient } = require('../database/elasticsearch');

/**
 * Create GraphQL context
 * This function is called for every GraphQL request
 */
function createContext({ req, res }) {
  return {
    // Database connections
    db: pool,
    elasticsearch: esClient,
    
    // Request/Response objects
    req,
    res,
    
    // User information (for future authentication)
    user: null,
    
    // Request metadata
    requestId: req.headers['x-request-id'] || Math.random().toString(36).substring(7),
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    
    // Utility functions
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return error;
    },
  };
}

module.exports = {
  createContext
}; 