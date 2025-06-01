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
  defaultMeta: { service: 'elasticsearch-connection' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

// ElasticSearch configuration
const esConfig = {
  node: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
  maxRetries: parseInt(process.env.ES_MAX_RETRIES) || 3,
  requestTimeout: parseInt(process.env.ES_REQUEST_TIMEOUT) || 60000,
  pingTimeout: parseInt(process.env.ES_PING_TIMEOUT) || 3000,
  resurrectStrategy: 'ping',
};

// Create ElasticSearch client
const client = new Client(esConfig);

// Index name
const INDEX_NAME = 'compensation_data';

// Index mapping configuration
const indexMapping = {
  mappings: {
    properties: {
      id: {
        type: 'keyword'
      },
      source_file: {
        type: 'keyword'
      },
      row_number: {
        type: 'integer'
      },
      timestamp: {
        type: 'date',
        format: 'strict_date_time||strict_date_time_no_millis||epoch_millis'
      },
      created_at: {
        type: 'date'
      },
      employer: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256
          },
          suggest: {
            type: 'completion'
          }
        }
      },
      company_size: {
        type: 'keyword'
      },
      industry: {
        type: 'keyword'
      },
      public_private: {
        type: 'keyword'
      },
      location: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256
          }
        }
      },
      city: {
        type: 'keyword'
      },
      state_province: {
        type: 'keyword'
      },
      country: {
        type: 'keyword'
      },
      job_title: {
        type: 'text',
        analyzer: 'job_title_analyzer',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256
          },
          suggest: {
            type: 'completion'
          }
        }
      },
      job_ladder: {
        type: 'keyword'
      },
      job_level: {
        type: 'keyword'
      },
      employment_type: {
        type: 'keyword'
      },
      years_experience_industry: {
        type: 'float'
      },
      years_experience_company: {
        type: 'float'
      },
      years_at_employer: {
        type: 'float'
      },
      annual_base_pay: {
        type: 'long',
        meta: {
          unit: 'cents'
        }
      },
      annual_bonus: {
        type: 'long'
      },
      signing_bonus: {
        type: 'long'
      },
      stock_value: {
        type: 'long'
      },
      required_hours_per_week: {
        type: 'integer'
      },
      actual_hours_per_week: {
        type: 'integer'
      },
      annual_vacation_weeks: {
        type: 'integer'
      },
      gender: {
        type: 'keyword'
      },
      education_level: {
        type: 'keyword'
      },
      is_happy_at_position: {
        type: 'boolean'
      },
      plans_to_resign: {
        type: 'boolean'
      },
      health_insurance_offered: {
        type: 'boolean'
      },
      additional_comments: {
        type: 'text',
        analyzer: 'standard'
      },
      data_quality_score: {
        type: 'float'
      },
      is_validated: {
        type: 'boolean'
      }
    }
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: process.env.NODE_ENV === 'production' ? 1 : 0,
    refresh_interval: '30s',
    analysis: {
      analyzer: {
        job_title_analyzer: {
          tokenizer: 'standard',
          filter: [
            'lowercase',
            'job_title_synonyms',
            'stemmer'
          ]
        }
      },
      filter: {
        job_title_synonyms: {
          type: 'synonym',
          synonyms: [
            'software engineer,swe,developer,programmer,coder',
            'data scientist,data analyst,analyst',
            'product manager,pm,product owner',
            'senior,sr,lead,principal',
            'junior,jr,entry level',
            'manager,mgr,supervisor',
            'director,dir,head',
            'vice president,vp',
            'chief technology officer,cto',
            'chief executive officer,ceo'
          ]
        }
      }
    }
  }
};

/**
 * Setup ElasticSearch index with proper mapping
 */
async function setupElasticsearch() {
  try {
    // Check if ElasticSearch is available
    const pingResponse = await client.ping();
    if (!pingResponse) {
      throw new Error('ElasticSearch is not responding');
    }

    logger.info('ElasticSearch connection established');

    // Check if index exists
    const indexExists = await client.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      // Create index with mapping
      await client.indices.create({
        index: INDEX_NAME,
        body: indexMapping
      });
      logger.info(`Created ElasticSearch index: ${INDEX_NAME}`);
    } else {
      logger.info(`ElasticSearch index already exists: ${INDEX_NAME}`);
      
      // Update mapping if needed (this won't break existing data)
      try {
        await client.indices.putMapping({
          index: INDEX_NAME,
          body: indexMapping.mappings
        });
        logger.info('Updated ElasticSearch index mapping');
      } catch (mappingError) {
        logger.warn('Could not update mapping (this is normal if no changes needed):', mappingError.message);
      }
    }

    return client;
  } catch (error) {
    logger.error('Failed to setup ElasticSearch:', error);
    throw error;
  }
}

/**
 * Index a document in ElasticSearch
 * @param {string} id - Document ID
 * @param {Object} document - Document to index
 * @returns {Promise} Index response
 */
async function indexDocument(id, document) {
  try {
    const response = await client.index({
      index: INDEX_NAME,
      id: id,
      body: document,
      refresh: 'wait_for'
    });

    logger.debug(`Indexed document ${id} in ElasticSearch`);
    return response;
  } catch (error) {
    logger.error(`Failed to index document ${id}:`, error);
    throw error;
  }
}

/**
 * Bulk index multiple documents
 * @param {Array} documents - Array of documents to index
 * @returns {Promise} Bulk response
 */
async function bulkIndex(documents) {
  try {
    const body = documents.flatMap(doc => [
      { index: { _index: INDEX_NAME, _id: doc.id } },
      doc
    ]);

    const response = await client.bulk({
      body,
      refresh: 'wait_for'
    });

    if (response.errors) {
      const erroredDocuments = [];
      response.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: body[i * 2],
            document: body[i * 2 + 1]
          });
        }
      });
      logger.error('Bulk indexing errors:', erroredDocuments);
    }

    logger.info(`Bulk indexed ${documents.length} documents`);
    return response;
  } catch (error) {
    logger.error('Bulk indexing failed:', error);
    throw error;
  }
}

/**
 * Search documents in ElasticSearch
 * @param {Object} query - ElasticSearch query
 * @param {Object} options - Search options
 * @returns {Promise} Search response
 */
async function search(query, options = {}) {
  try {
    const searchParams = {
      index: INDEX_NAME,
      body: query,
      ...options
    };

    const response = await client.search(searchParams);
    logger.debug(`Search executed, found ${response.hits.total.value} results`);
    return response;
  } catch (error) {
    logger.error('Search failed:', error);
    throw error;
  }
}

/**
 * Get document by ID
 * @param {string} id - Document ID
 * @returns {Promise} Document
 */
async function getDocument(id) {
  try {
    const response = await client.get({
      index: INDEX_NAME,
      id: id
    });

    return response._source;
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }
    logger.error(`Failed to get document ${id}:`, error);
    throw error;
  }
}

/**
 * Perform aggregation query
 * @param {Object} aggregations - ElasticSearch aggregations
 * @param {Object} query - Optional query filter
 * @returns {Promise} Aggregation response
 */
async function aggregate(aggregations, query = {}) {
  try {
    const searchParams = {
      index: INDEX_NAME,
      body: {
        size: 0,
        query: query.query || { match_all: {} },
        aggs: aggregations
      }
    };

    const response = await client.search(searchParams);
    logger.debug('Aggregation executed successfully');
    return response.aggregations;
  } catch (error) {
    logger.error('Aggregation failed:', error);
    throw error;
  }
}

/**
 * Get suggestions for auto-complete
 * @param {string} field - Field to get suggestions for
 * @param {string} text - Text to suggest
 * @returns {Promise} Suggestions
 */
async function getSuggestions(field, text) {
  try {
    const response = await client.search({
      index: INDEX_NAME,
      body: {
        suggest: {
          suggestions: {
            prefix: text,
            completion: {
              field: `${field}.suggest`
            }
          }
        }
      }
    });

    return response.suggest.suggestions[0].options;
  } catch (error) {
    logger.error('Suggestions failed:', error);
    throw error;
  }
}

/**
 * Health check for ElasticSearch
 * @returns {Promise<boolean>} Connection status
 */
async function healthCheck() {
  try {
    const response = await client.ping();
    return response;
  } catch (error) {
    logger.error('ElasticSearch health check failed:', error);
    return false;
  }
}

/**
 * Get cluster health
 * @returns {Promise} Cluster health information
 */
async function getClusterHealth() {
  try {
    const response = await client.cluster.health();
    return response;
  } catch (error) {
    logger.error('Failed to get cluster health:', error);
    throw error;
  }
}

/**
 * Close ElasticSearch connection
 */
async function closeConnection() {
  try {
    await client.close();
    logger.info('ElasticSearch connection closed');
  } catch (error) {
    logger.error('Error closing ElasticSearch connection:', error);
    throw error;
  }
}

module.exports = {
  client,
  setupElasticsearch,
  indexDocument,
  bulkIndex,
  search,
  getDocument,
  aggregate,
  getSuggestions,
  healthCheck,
  getClusterHealth,
  closeConnection,
  INDEX_NAME
}; 