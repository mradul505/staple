const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'request-logger' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Skip logging for health checks in production
  if (process.env.NODE_ENV === 'production' && (req.path === '/health' || req.path === '/ready')) {
    return next();
  }
  
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length')
    });
    
    originalSend.call(this, data);
  };
  
  next();
}

module.exports = {
  requestLogger
}; 