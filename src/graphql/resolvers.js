const { DateTimeResolver, BigIntResolver } = require('graphql-scalars');
const { query } = require('../database/connection');
const { search, aggregate } = require('../database/elasticsearch');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'graphql-resolvers' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

const ENABLE_FALLBACK = process.env.ENABLE_FALLBACK === 'true';

/**
 * Try ElasticSearch first, fallback to PostgreSQL
 */
async function queryWithFallback(esQuery, pgQuery, pgParams = []) {
  if (!ENABLE_FALLBACK) {
    // If fallback is disabled, use PostgreSQL only
    logger.debug('Fallback disabled, using PostgreSQL directly');
    return await query(pgQuery, pgParams);
  }

  try {
    // Try ElasticSearch first
    logger.debug('Attempting ElasticSearch query');
    const esResult = await search(esQuery);
    
    if (esResult && esResult.hits && esResult.hits.hits.length > 0) {
      logger.debug(`ElasticSearch returned ${esResult.hits.hits.length} results`);
      return {
        rows: esResult.hits.hits.map(hit => ({
          ...hit._source,
          id: hit._id
        })),
        rowCount: esResult.hits.hits.length,
        source: 'elasticsearch'
      };
    }
    
    logger.debug('ElasticSearch returned no results, falling back to PostgreSQL');
    
  } catch (error) {
    logger.warn(`ElasticSearch query failed: ${error.message}, falling back to PostgreSQL`);
  }
  
  // Fallback to PostgreSQL
  try {
    const pgResult = await query(pgQuery, pgParams);
    logger.debug(`PostgreSQL returned ${pgResult.rowCount} results`);
    return {
      ...pgResult,
      source: 'postgresql'
    };
  } catch (error) {
    logger.error(`PostgreSQL query also failed: ${error.message}`);
    throw error;
  }
}

/**
 * Aggregate query with fallback
 */
async function aggregateWithFallback(esAggQuery, pgAggQuery, pgParams = []) {
  if (!ENABLE_FALLBACK) {
    return await query(pgAggQuery, pgParams);
  }

  try {
    // Try ElasticSearch first for aggregations
    logger.debug('Attempting ElasticSearch aggregation');
    const esResult = await aggregate(esAggQuery);
    
    if (esResult && esResult.aggregations) {
      logger.debug('ElasticSearch aggregation successful');
      return {
        source: 'elasticsearch',
        aggregations: esResult.aggregations
      };
    }
    
  } catch (error) {
    logger.warn(`ElasticSearch aggregation failed: ${error.message}, falling back to PostgreSQL`);
  }
  
  // Fallback to PostgreSQL
  const pgResult = await query(pgAggQuery, pgParams);
  return {
    ...pgResult,
    source: 'postgresql'
  };
}

/**
 * Convert cents to dollars for display
 */
function centsToDollars(cents) {
  return cents ? Math.round(cents / 100) : null;
}

/**
 * Format currency for display
 */
function formatCurrency(cents) {
  if (!cents) return null;
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Build PostgreSQL WHERE clause from filter
 */
function buildWhereClause(filter) {
  if (!filter) return { whereClause: '', params: [] };

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Text searches
  if (filter.employer) {
    conditions.push(`employer ILIKE $${paramIndex}`);
    params.push(`%${filter.employer}%`);
    paramIndex++;
  }

  if (filter.jobTitleContains) {
    conditions.push(`job_title ILIKE $${paramIndex}`);
    params.push(`%${filter.jobTitleContains}%`);
    paramIndex++;
  }

  if (filter.locationContains) {
    conditions.push(`location ILIKE $${paramIndex}`);
    params.push(`%${filter.locationContains}%`);
    paramIndex++;
  }

  // Exact matches
  if (filter.industry) {
    conditions.push(`industry = $${paramIndex}`);
    params.push(filter.industry);
    paramIndex++;
  }

  if (filter.gender) {
    conditions.push(`gender ILIKE $${paramIndex}`);
    params.push(filter.gender);
    paramIndex++;
  }

  // Range filters
  if (filter.annualBasePay) {
    if (filter.annualBasePay.min !== undefined) {
      conditions.push(`annual_base_pay >= $${paramIndex}`);
      params.push(filter.annualBasePay.min);
      paramIndex++;
    }
    if (filter.annualBasePay.max !== undefined) {
      conditions.push(`annual_base_pay <= $${paramIndex}`);
      params.push(filter.annualBasePay.max);
      paramIndex++;
    }
  }

  if (filter.yearsExperienceIndustry) {
    if (filter.yearsExperienceIndustry.min !== undefined) {
      conditions.push(`years_experience_industry >= $${paramIndex}`);
      params.push(filter.yearsExperienceIndustry.min);
      paramIndex++;
    }
    if (filter.yearsExperienceIndustry.max !== undefined) {
      conditions.push(`years_experience_industry <= $${paramIndex}`);
      params.push(filter.yearsExperienceIndustry.max);
      paramIndex++;
    }
  }

  // Date filters
  if (filter.timestampAfter) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(filter.timestampAfter);
    paramIndex++;
  }

  if (filter.timestampBefore) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(filter.timestampBefore);
    paramIndex++;
  }

  // Boolean filters
  if (filter.healthInsuranceOffered !== undefined) {
    conditions.push(`health_insurance_offered = $${paramIndex}`);
    params.push(filter.healthInsuranceOffered);
    paramIndex++;
  }

  // Data quality filter
  if (filter.dataQualityScoreMin !== undefined) {
    conditions.push(`data_quality_score >= $${paramIndex}`);
    params.push(filter.dataQualityScoreMin);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return { whereClause, params };
}

/**
 * Build ElasticSearch query from filter
 */
function buildElasticSearchQuery(filter, sort, pagination) {
  const esQuery = {
    index: 'compensation_data',
    body: {
      query: { bool: { must: [] } },
      sort: [],
      from: pagination?.offset || 0,
      size: Math.min(pagination?.limit || 20, 100)
    }
  };

  if (!filter) {
    esQuery.body.query = { match_all: {} };
    return esQuery;
  }

  // Text searches with fuzzy matching
  if (filter.employer) {
    esQuery.body.query.bool.must.push({
      match: { employer: { query: filter.employer, fuzziness: 'AUTO' } }
    });
  }

  if (filter.jobTitleContains) {
    esQuery.body.query.bool.must.push({
      match: { job_title: { query: filter.jobTitleContains, fuzziness: 'AUTO' } }
    });
  }

  if (filter.locationContains) {
    esQuery.body.query.bool.must.push({
      match: { location: { query: filter.locationContains, fuzziness: 'AUTO' } }
    });
  }

  // Exact matches
  if (filter.industry) {
    esQuery.body.query.bool.must.push({
      term: { 'industry.keyword': filter.industry }
    });
  }

  if (filter.gender) {
    esQuery.body.query.bool.must.push({
      term: { gender: filter.gender }
    });
  }

  // Range filters
  if (filter.annualBasePay) {
    const range = {};
    if (filter.annualBasePay.min !== undefined) range.gte = filter.annualBasePay.min;
    if (filter.annualBasePay.max !== undefined) range.lte = filter.annualBasePay.max;
    
    esQuery.body.query.bool.must.push({
      range: { annual_base_pay: range }
    });
  }

  if (filter.yearsExperienceIndustry) {
    const range = {};
    if (filter.yearsExperienceIndustry.min !== undefined) range.gte = filter.yearsExperienceIndustry.min;
    if (filter.yearsExperienceIndustry.max !== undefined) range.lte = filter.yearsExperienceIndustry.max;
    
    esQuery.body.query.bool.must.push({
      range: { years_experience_industry: range }
    });
  }

  // Sorting
  if (sort && sort.length > 0) {
    esQuery.body.sort = sort.map(sortItem => {
      const field = sortItem.field.toLowerCase().replace('_', '');
      const direction = sortItem.direction === 'DESC' ? 'desc' : 'asc';
      return { [field]: { order: direction } };
    });
  } else {
    esQuery.body.sort = [{ created_at: { order: 'desc' } }];
  }

  return esQuery;
}

/**
 * Build ORDER BY clause from sort
 */
function buildOrderByClause(sort) {
  if (!sort || sort.length === 0) {
    return 'ORDER BY created_at DESC';
  }

  const orderItems = sort.map(sortItem => {
    let field;
    switch (sortItem.field) {
      case 'TIMESTAMP':
        field = 'timestamp';
        break;
      case 'ANNUAL_BASE_PAY':
        field = 'annual_base_pay';
        break;
      case 'ANNUAL_BONUS':
        field = 'annual_bonus';
        break;
      case 'YEARS_EXPERIENCE_INDUSTRY':
        field = 'years_experience_industry';
        break;
      case 'YEARS_EXPERIENCE_COMPANY':
        field = 'years_experience_company';
        break;
      case 'CREATED_AT':
        field = 'created_at';
        break;
      default:
        field = 'created_at';
    }
    
    const direction = sortItem.direction === 'DESC' ? 'DESC' : 'ASC';
    return `${field} ${direction}`;
  });

  return `ORDER BY ${orderItems.join(', ')}`;
}

const resolvers = {
  // Scalar resolvers
  DateTime: DateTimeResolver,
  BigInt: BigIntResolver,

  // Type resolvers
  CompensationData: {
    annualBasePay: (parent) => centsToDollars(parent.annual_base_pay),
    annualBasePayCents: (parent) => parent.annual_base_pay,
    annualBonus: (parent) => centsToDollars(parent.annual_bonus),
    signingBonus: (parent) => centsToDollars(parent.signing_bonus),
    stockValue: (parent) => centsToDollars(parent.stock_value),
    annualBasePayFormatted: (parent) => formatCurrency(parent.annual_base_pay),
    totalCompensation: (parent) => {
      const base = parent.annual_base_pay || 0;
      const bonus = parent.annual_bonus || 0;
      const stock = parent.stock_value || 0;
      return centsToDollars(base + bonus + stock);
    },
    totalCompensationFormatted: (parent) => {
      const base = parent.annual_base_pay || 0;
      const bonus = parent.annual_bonus || 0;
      const stock = parent.stock_value || 0;
      return formatCurrency(base + bonus + stock);
    },
  },

  // Query resolvers with fallback logic
  Query: {
    // Single compensation record with fallback
    compensation: async (_, { id }) => {
      try {
        const esQuery = {
          index: 'compensation_data',
          body: {
            query: { term: { _id: id } }
          }
        };
        
        const pgQuery = 'SELECT * FROM compensation_data WHERE id = $1';
        const result = await queryWithFallback(esQuery, pgQuery, [id]);
        
        return result.rows[0] || null;
      } catch (error) {
        logger.error('Error fetching compensation by ID:', error);
        throw new Error('Failed to fetch compensation data');
      }
    },

    // List compensations with intelligent fallback
    compensations: async (_, { filter, sort, pagination }) => {
      try {
        const { whereClause, params } = buildWhereClause(filter);
        const orderByClause = buildOrderByClause(sort);
        
        const limit = Math.min(pagination?.limit || 20, 100);
        const offset = pagination?.offset || 0;
        
        // Build ElasticSearch query
        const esQuery = buildElasticSearchQuery(filter, sort, pagination);
        
        // Build PostgreSQL queries
        const countQuery = `SELECT COUNT(*) as total FROM compensation_data ${whereClause}`;
        const dataQuery = `SELECT * FROM compensation_data ${whereClause} ${orderByClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        
        try {
          // Try ElasticSearch first
          if (ENABLE_FALLBACK) {
            const esResult = await search(esQuery);
            
            if (esResult && esResult.hits && esResult.hits.total) {
              const totalCount = typeof esResult.hits.total === 'object' 
                ? esResult.hits.total.value 
                : esResult.hits.total;
              
              return {
                data: esResult.hits.hits.map(hit => ({ ...hit._source, id: hit._id })),
                totalCount,
                hasNextPage: offset + limit < totalCount,
                hasPreviousPage: offset > 0,
                pageInfo: {
                  hasNextPage: offset + limit < totalCount,
                  hasPreviousPage: offset > 0,
                },
                source: 'elasticsearch'
              };
            }
          }
        } catch (esError) {
          logger.warn(`ElasticSearch query failed: ${esError.message}`);
        }
        
        // Fallback to PostgreSQL
        const countResult = await query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].total);
        
        const dataResult = await query(dataQuery, [...params, limit, offset]);
        
        return {
          data: dataResult.rows,
          totalCount,
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          pageInfo: {
            hasNextPage: offset + limit < totalCount,
            hasPreviousPage: offset > 0,
          },
          source: 'postgresql'
        };
      } catch (error) {
        logger.error('Error fetching compensations:', error);
        throw new Error('Failed to fetch compensations');
      }
    },

    // Compensation statistics with fallback
    compensationStats: async (_, { filter }) => {
      try {
        const { whereClause, params } = buildWhereClause(filter);
        
        // ElasticSearch aggregation query
        const esAggQuery = {
          index: 'compensation_data',
          body: {
            query: filter ? buildElasticSearchQuery(filter).body.query : { match_all: {} },
            size: 0,
            aggs: {
              stats: {
                extended_stats: { field: 'annual_base_pay' }
              },
              experience_stats: {
                extended_stats: { field: 'years_experience_industry' }
              }
            }
          }
        };
        
        // PostgreSQL aggregation query
        const pgAggQuery = `
          SELECT 
            COUNT(*) as count,
            AVG(annual_base_pay::DECIMAL / 100) as average_salary,
            MIN(annual_base_pay::DECIMAL / 100) as min_salary,
            MAX(annual_base_pay::DECIMAL / 100) as max_salary,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as q1_salary,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as q3_salary,
            STDDEV(annual_base_pay::DECIMAL / 100) as standard_deviation,
            AVG(years_experience_industry) as average_experience,
            MIN(years_experience_industry) as min_experience,
            MAX(years_experience_industry) as max_experience,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY years_experience_industry) as median_experience
          FROM compensation_data 
          ${whereClause}
          ${whereClause ? 'AND' : 'WHERE'} annual_base_pay IS NOT NULL 
          AND annual_base_pay > 0
        `;
        
        const result = await aggregateWithFallback(esAggQuery, pgAggQuery, params);
        
        let stats;
        if (result.source === 'elasticsearch' && result.aggregations) {
          const salaryStats = result.aggregations.stats;
          const expStats = result.aggregations.experience_stats;
          
          stats = {
            count: salaryStats.count,
            average_salary: salaryStats.avg / 100,
            min_salary: salaryStats.min / 100,
            max_salary: salaryStats.max / 100,
            median_salary: salaryStats.avg / 100, // ES doesn't have median in extended_stats
            q1_salary: salaryStats.avg / 100,
            q3_salary: salaryStats.avg / 100,
            standard_deviation: salaryStats.std_deviation / 100,
            average_experience: expStats.avg,
            min_experience: expStats.min,
            max_experience: expStats.max,
            median_experience: expStats.avg
          };
        } else {
          stats = result.rows[0];
        }
        
        return {
          count: parseInt(stats.count),
          averageSalary: parseFloat(stats.average_salary),
          medianSalary: parseFloat(stats.median_salary),
          minSalary: Math.round(stats.min_salary * 100),
          maxSalary: Math.round(stats.max_salary * 100),
          q1Salary: parseFloat(stats.q1_salary),
          q3Salary: parseFloat(stats.q3_salary),
          standardDeviation: parseFloat(stats.standard_deviation),
          averageExperience: parseFloat(stats.average_experience),
          medianExperience: parseFloat(stats.median_experience),
          minExperience: parseFloat(stats.min_experience),
          maxExperience: parseFloat(stats.max_experience),
        };
      } catch (error) {
        logger.error('Error calculating compensation stats:', error);
        throw new Error('Failed to calculate compensation statistics');
      }
    },

    // Location-based statistics with fallback
    locationStats: async (_, { filter, limit = 10 }) => {
      try {
        const { whereClause, params } = buildWhereClause(filter);
        
        const pgQuery = `
          SELECT 
            location,
            COUNT(*) as count,
            AVG(annual_base_pay::DECIMAL / 100) as average_salary,
            MIN(annual_base_pay::DECIMAL / 100) as min_salary,
            MAX(annual_base_pay::DECIMAL / 100) as max_salary,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
          FROM compensation_data 
          ${whereClause}
          ${whereClause ? 'AND' : 'WHERE'} location IS NOT NULL 
          AND annual_base_pay IS NOT NULL 
          AND annual_base_pay > 0
          GROUP BY location
          HAVING COUNT(*) >= 3
          ORDER BY average_salary DESC
          LIMIT $${params.length + 1}
        `;
        
        const result = await query(pgQuery, [...params, limit]);
        
        return result.rows.map(row => ({
          location: row.location,
          count: parseInt(row.count),
          averageSalary: parseFloat(row.average_salary),
          medianSalary: parseFloat(row.median_salary),
          minSalary: Math.round(row.min_salary * 100),
          maxSalary: Math.round(row.max_salary * 100),
        }));
      } catch (error) {
        logger.error('Error fetching location stats:', error);
        throw new Error('Failed to fetch location statistics');
      }
    },

    // Job title statistics
    jobTitleStats: async (_, { filter, limit = 10 }) => {
      try {
        const { whereClause, params } = buildWhereClause(filter);
        
        const result = await query(`
          SELECT 
            job_title,
            COUNT(*) as count,
            AVG(annual_base_pay::DECIMAL / 100) as average_salary,
            MIN(annual_base_pay::DECIMAL / 100) as min_salary,
            MAX(annual_base_pay::DECIMAL / 100) as max_salary,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
          FROM compensation_data 
          ${whereClause}
          ${whereClause ? 'AND' : 'WHERE'} job_title IS NOT NULL 
          AND annual_base_pay IS NOT NULL 
          AND annual_base_pay > 0
          GROUP BY job_title
          HAVING COUNT(*) >= 2
          ORDER BY average_salary DESC
          LIMIT $${params.length + 1}
        `, [...params, limit]);
        
        return result.rows.map(row => ({
          jobTitle: row.job_title,
          count: parseInt(row.count),
          averageSalary: parseFloat(row.average_salary),
          medianSalary: parseFloat(row.median_salary),
          minSalary: Math.round(row.min_salary * 100),
          maxSalary: Math.round(row.max_salary * 100),
        }));
      } catch (error) {
        logger.error('Error fetching job title stats:', error);
        throw new Error('Failed to fetch job title statistics');
      }
    },

    // Engineer compensation statistics (as required by assessment)
    engineerCompensationStats: async (_, { filter }) => {
      try {
        // Add engineer filter to existing filter
        const engineerFilter = {
          ...filter,
          jobTitleContains: 'engineer'
        };
        
        const { whereClause, params } = buildWhereClause(engineerFilter);
        
        const result = await query(`
          SELECT 
            COUNT(*) as count,
            AVG(annual_base_pay::DECIMAL / 100) as average_salary,
            MIN(annual_base_pay::DECIMAL / 100) as min_salary,
            MAX(annual_base_pay::DECIMAL / 100) as max_salary,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
          FROM compensation_data 
          ${whereClause}
          ${whereClause ? 'AND' : 'WHERE'} annual_base_pay IS NOT NULL 
          AND annual_base_pay > 0
        `, params);
        
        const stats = result.rows[0];
        
        return {
          count: parseInt(stats.count),
          averageSalary: parseFloat(stats.average_salary),
          medianSalary: parseFloat(stats.median_salary),
          minSalary: Math.round(stats.min_salary * 100),
          maxSalary: Math.round(stats.max_salary * 100),
        };
      } catch (error) {
        logger.error('Error calculating engineer compensation stats:', error);
        throw new Error('Failed to calculate engineer compensation statistics');
      }
    },

    // Engineer compensation by location (as required by assessment)
    engineerCompensationByLocation: async (_, { limit = 10 }) => {
      try {
        const result = await query(`
          SELECT 
            location,
            COUNT(*) as count,
            AVG(annual_base_pay::DECIMAL / 100) as average_salary,
            MIN(annual_base_pay::DECIMAL / 100) as min_salary,
            MAX(annual_base_pay::DECIMAL / 100) as max_salary,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary
          FROM compensation_data 
          WHERE job_title ILIKE '%engineer%'
          AND location IS NOT NULL 
          AND annual_base_pay IS NOT NULL 
          AND annual_base_pay > 0
          GROUP BY location
          HAVING COUNT(*) >= 2
          ORDER BY average_salary DESC
          LIMIT $1
        `, [limit]);
        
        return result.rows.map(row => ({
          location: row.location,
          count: parseInt(row.count),
          averageSalary: parseFloat(row.average_salary),
          medianSalary: parseFloat(row.median_salary),
          minSalary: Math.round(row.min_salary * 100),
          maxSalary: Math.round(row.max_salary * 100),
        }));
      } catch (error) {
        logger.error('Error fetching engineer compensation by location:', error);
        throw new Error('Failed to fetch engineer compensation by location');
      }
    },

    // Custom interesting query: Highest paid roles by experience (bonus requirement)
    highestPaidRolesByExperience: async (_, { minExperience = 0, maxExperience = 50, limit = 10 }) => {
      try {
        const result = await query(`
          SELECT 
            job_title,
            COUNT(*) as count,
            AVG(annual_base_pay::DECIMAL / 100) as average_salary,
            MIN(annual_base_pay::DECIMAL / 100) as min_salary,
            MAX(annual_base_pay::DECIMAL / 100) as max_salary,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_base_pay::DECIMAL / 100) as median_salary,
            AVG(years_experience_industry) as avg_experience
          FROM compensation_data 
          WHERE job_title IS NOT NULL 
          AND annual_base_pay IS NOT NULL 
          AND annual_base_pay > 0
          AND years_experience_industry BETWEEN $1 AND $2
          GROUP BY job_title
          HAVING COUNT(*) >= 3 AND AVG(annual_base_pay::DECIMAL / 100) > 50000
          ORDER BY average_salary DESC
          LIMIT $3
        `, [minExperience, maxExperience, limit]);
        
        return result.rows.map(row => ({
          jobTitle: row.job_title,
          count: parseInt(row.count),
          averageSalary: parseFloat(row.average_salary),
          medianSalary: parseFloat(row.median_salary),
          minSalary: Math.round(row.min_salary * 100),
          maxSalary: Math.round(row.max_salary * 100),
        }));
      } catch (error) {
        logger.error('Error fetching highest paid roles by experience:', error);
        throw new Error('Failed to fetch highest paid roles by experience');
      }
    },

    // Health status
    health: async () => {
      try {
        const pgResult = await query('SELECT 1');
        const pgStatus = pgResult.rows.length > 0 ? 'connected' : 'disconnected';
        
        let esStatus = 'unknown';
        try {
          const { client } = require('../database/elasticsearch');
          await client.ping();
          esStatus = 'connected';
        } catch (esError) {
          esStatus = 'disconnected';
        }
        
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          services: {
            postgres: pgStatus,
            elasticsearch: esStatus,
            redis: 'optional'
          },
          fallbackEnabled: ENABLE_FALLBACK
        };
      } catch (error) {
        logger.error('Health check failed:', error);
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          services: {
            postgres: 'disconnected',
            elasticsearch: 'unknown',
            redis: 'unknown'
          },
          fallbackEnabled: ENABLE_FALLBACK
        };
      }
    },
  },

  // Mutation resolvers (placeholder)
  Mutation: {
    _placeholder: () => 'This is a read-only API'
  },

  // Subscription resolvers (placeholder)
  Subscription: {
    _placeholder: () => 'Subscriptions not implemented'
  }
};

module.exports = { resolvers }; 