const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'error-handler' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  next(error);
}

/**
 * General error handler
 */
function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';
  
  logger.error('Error occurred:', {
    status,
    message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't expose stack traces in production
  const response = {
    error: {
      status,
      message,
      timestamp: new Date().toISOString(),
    }
  };
  
  if (process.env.NODE_ENV !== 'production') {
    response.error.stack = error.stack;
  }
  
  res.status(status).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler
}; 