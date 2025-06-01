# Compensation Data Management System

A comprehensive, production-ready compensation data management system built with Node.js, PostgreSQL, ElasticSearch, and GraphQL. Features automatic initialization, intelligent fallback logic, and high-performance data streaming with an interactive analytics dashboard.

## 🚀 **Quick Start (Platform Independent)**

### Prerequisites
- **Docker Desktop** (Latest version recommended)
- **Docker Compose** (v2.0+)
- **8GB RAM** minimum (12GB recommended)
- **10GB free disk space**
- **Git** for cloning the repository

### One-Command Deployment
```bash
# Clone the repository
git clone <repository-url>
cd compensation-data-system

# Start the entire system with one command
docker-compose up -d

# Watch the logs (optional)
docker-compose logs -f
```

### 🎯 **Verify Installation**
After running `docker-compose up -d`, verify all services are running:

```bash
# Check service status
docker-compose ps

# Test API health
curl http://localhost:4000/health

# Test GraphQL endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ health { status } }"}' \
  http://localhost:4000/graphql
```

**Expected Output:**
```json
{
  "data": {
    "health": {
      "status": "healthy"
    }
  }
}
```

### 📍 **Service Endpoints**

| Service | URL | Description | Status Check |
|---------|-----|-------------|--------------|
| **📊 Analytics Dashboard** | [http://localhost:4000](http://localhost:4000) | **Main Dashboard Interface** | Open in browser |
| **🌐 GraphQL API** | [http://localhost:4000/graphql](http://localhost:4000/graphql) | Interactive GraphQL Playground | API queries |
| **❤️ API Health** | [http://localhost:4000/health](http://localhost:4000/health) | System health status | Quick check |
| **🔄 API Ready** | [http://localhost:4000/ready](http://localhost:4000/ready) | Service readiness | All services |
| **🐘 PostgreSQL** | `localhost:5432` | Primary database | Data storage |
| **🔍 ElasticSearch** | [http://localhost:9200](http://localhost:9200) | Search engine | Analytics |
| **📈 Kibana** | [http://localhost:5601](http://localhost:5601) | ES visualization | Optional |
| **⚡ Redis** | `localhost:6379` | Caching layer | Performance |

## 📊 **Using the Analytics Dashboard**

### 🎯 **Dashboard Features**

**1. 📈 Real-time Metrics**
- Total compensation records
- Average/median salaries
- Engineer-specific statistics
- Live data updates every 5 minutes

**2. 🎨 Interactive Charts**
- Top locations by salary
- Job title compensation analysis
- Engineer compensation by location
- Experience vs compensation correlation

**3. 🔍 Advanced Filtering**
- Filter by job title keywords
- Location-based filtering
- Salary range selection
- Experience level filtering

**4. 🧪 Assignment Testing Interface**
- **Exercise A**: Test all required database queries
- **Exercise B**: Validate GraphQL API features
- **Interactive Results**: Live JSON response display
- **One-Click Testing**: Run all assignment tests

### 📋 **Step-by-Step Dashboard Usage**

**Step 1: Access the Dashboard**
```bash
# Open your browser and navigate to:
http://localhost:4000
```

**Step 2: Explore Data Metrics**
- View the key metrics cards at the top
- Check system health indicator
- Observe real-time data loading

**Step 3: Use Interactive Charts**
- Hover over chart elements for details
- Charts auto-refresh with new data
- Responsive design works on mobile

**Step 4: Apply Data Filters**
- Use the filter section to narrow down data
- Example filters:
  - Job Title: "engineer", "manager", "developer"
  - Location: "San Francisco", "New York", "CA"
  - Salary Range: 50000 - 300000

**Step 5: Test Assignment Requirements**
- Scroll to the **"API Testing & Project Documentation"** section
- Click **"▶️ Test Query"** buttons to run live tests
- View results in the response boxes
- Use **"🚀 Run All Assignment Tests"** for comprehensive validation

## 🔧 **Using the Postman Collection**

### 📥 **Import Postman Collection**

**Option 1: Direct Import**
```bash
# The collection is located at:
./postman/postmanCollection.json

# In Postman:
# 1. Click "Import" 
# 2. Select "Upload Files"
# 3. Choose postmanCollection.json
# 4. Click "Import"
```

**Option 2: URL Import**
```bash
# If hosted on GitHub, use the raw URL:
https://raw.githubusercontent.com/your-repo/compensation-system/main/postman/postmanCollection.json
```

### 🎯 **Collection Structure**

**1. 🏥 Health & Status**
- `GET /health` - Basic health check
- `GET /ready` - Service readiness check  
- `POST /graphql` - GraphQL health query

**2. 📋 Required Assignment Queries**
- Engineer compensation statistics
- City-based compensation analysis
- Engineer compensation by location
- Custom experience-based analysis

**3. 📊 Data Queries**
- Single record retrieval
- Basic listing with pagination
- Advanced filtering examples
- Sorting and ordering

**4. 📈 Analytics Queries**
- Overall compensation statistics
- Job title analysis
- Location-based insights
- Experience correlation

**5. 🔍 Advanced Filtering Examples**
- Multi-field filtering
- Complex query combinations
- Salary range filtering
- Experience level filtering

**6. ✨ Sparse Fieldsets Examples**
- Minimal field selection
- Performance optimization
- Custom field combinations

**7. ❌ Error Handling Examples**
- Invalid query syntax
- Non-existent records
- Error response formats

### 🚀 **Running Postman Tests**

**Step 1: Set Environment**
```bash
# In Postman, create a new environment with:
Variable: baseUrl
Value: http://localhost:4000
```

**Step 2: Test Basic Connectivity**
```bash
# Run the "Health Check" request first
# Expected: 200 OK with health status
```

**Step 3: Execute Assignment Queries**
```bash
# Run each query in "Required Assignment Queries" folder:
# 1. Average Compensation for Engineers
# 2. Compensation Stats per City  
# 3. Engineer Compensation by Location
# 4. Custom Query - Highest Paid Roles by Experience
```

**Step 4: Test API Features**
```bash
# Validate GraphQL API capabilities:
# - Filtering (multiple fields)
# - Sorting (various fields)
# - Pagination (offset/limit)
# - Sparse fieldsets (custom fields)
```

**Step 5: Run Full Test Suite**
```bash
# Use Postman's Collection Runner:
# 1. Click "Run Collection"
# 2. Select all requests
# 3. Click "Run Compensation Data Management API"
# 4. Review results for 100% pass rate
```

## ✨ **Key Features**

### 🔄 **Intelligent Fallback Logic**
- **Primary**: ElasticSearch for fast, full-text search
- **Fallback**: PostgreSQL when ElasticSearch is unavailable
- **Automatic**: Seamless switching without client knowledge
- **Configurable**: Enable/disable via `ENABLE_FALLBACK=true`

### 🚀 **High-Performance Data Streaming**
- **Bulk Operations**: 1000 records per batch to ElasticSearch
- **Real-time Sync**: PostgreSQL triggers for live updates
- **Retry Logic**: Automatic retry with exponential backoff
- **Monitoring**: Comprehensive logging and metrics

### 🛡️ **Production Ready**
- **Automatic Initialization**: Database schema and data loading
- **Health Checks**: All services monitored
- **Security**: Helmet, CORS, rate limiting
- **Logging**: Structured logging with Winston
- **Error Handling**: Comprehensive error management

### 📊 **Advanced Analytics**
- **Aggregations**: Salary statistics, location analysis
- **Filtering**: Complex multi-field filtering
- **Sorting**: Flexible result ordering
- **Pagination**: Efficient large dataset handling

## 🏗️ **Architecture**

### Database Design
- **PostgreSQL**: Normalized relational structure for ACID compliance
- **ElasticSearch**: Denormalized documents for fast search and analytics
- **Redis**: Caching layer for session management and query caching

### Service Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GraphQL API   │    │   PostgreSQL    │    │  ElasticSearch  │
│  (Port 4000)    │◄──►│  (Port 5432)    │◄──►│  (Port 9200)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Redis       │    │   Data Loader   │    │   ES Streamer   │
│  (Port 6379)    │    │   (Init Only)   │    │  (Background)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 **Configuration**

### Environment Variables
```bash
# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=compensation_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123

# ElasticSearch Configuration
ELASTICSEARCH_HOST=http://elasticsearch:9200

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# API Configuration
PORT=4000
NODE_ENV=production
ENABLE_FALLBACK=true

# Logging
LOG_LEVEL=info
```

### Docker Compose Override
For custom configurations, create `docker-compose.override.yml`:

```yaml
services:
  api:
    environment:
      - LOG_LEVEL=debug
      - ENABLE_FALLBACK=false
    ports:
      - "3000:4000"  # Custom port mapping
```

## 📊 **Data Schema**

### PostgreSQL Tables
- **compensation_data**: Main compensation records
- **companies**: Normalized company information
- **locations**: Standardized location data
- **job_titles**: Job title classifications

### ElasticSearch Index
- **compensation_data**: Optimized for search and analytics
- **Computed Fields**: total_compensation, compensation_range, experience_level
- **Full-text Search**: On employer, job_title, location fields

## 🔍 **Monitoring & Health Checks**

### Health Endpoints
```bash
# API Health
curl http://localhost:4000/health

# Readiness Check
curl http://localhost:4000/ready

# ElasticSearch Health
curl http://localhost:9200/_cluster/health

# PostgreSQL Connection
docker exec compensation-postgres pg_isready -U postgres
```

### Logs
```bash
# View all services
docker-compose logs -f

# Specific service logs
docker-compose logs -f api
docker-compose logs -f es-streamer
docker-compose logs -f db-init
```

## 🚀 **Performance Optimization**

### ElasticSearch Optimizations
- **Bulk Indexing**: 1000 records per batch
- **Mapping Optimization**: Field-specific analyzers
- **Index Settings**: Single shard, no replicas for development
- **Refresh Interval**: 30 seconds for better performance

### PostgreSQL Optimizations
- **Connection Pooling**: Up to 20 connections
- **Query Optimization**: Indexed columns for common queries
- **Batch Inserts**: Efficient CSV loading

### API Optimizations
- **Query Fallback**: ElasticSearch → PostgreSQL
- **Result Caching**: Redis integration ready
- **Pagination**: Efficient large dataset handling
- **Field Selection**: Sparse fieldsets support

## 🧪 **Testing**

### Manual Testing
```bash
# Start the system
docker-compose up

# Test basic query
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status } }"}' \
  http://localhost:4000/graphql

# Test engineer compensation
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ engineerCompensationByLocation { location count averageSalary } }"}' \
  http://localhost:4000/graphql
```

### Load Testing
```bash
# Install k6 for load testing
npm install -g k6

# Run load test
k6 run tests/load-test.js
```

## 🔧 **Troubleshooting**

### Common Issues

#### ElasticSearch Memory Issues
```bash
# Increase Docker memory to 6GB+
# Or reduce ES memory in docker-compose.yml:
ES_JAVA_OPTS=-Xms256m -Xmx256m
```

#### PostgreSQL Connection Issues
```bash
# Check PostgreSQL health
docker exec compensation-postgres pg_isready -U postgres

# View PostgreSQL logs
docker-compose logs postgres
```

#### Data Loading Issues
```bash
# Check CSV files exist
ls -la csv/

# Manually run data loader
docker-compose run --rm db-init
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Monitor service health
watch -n 5 'curl -s http://localhost:4000/health | jq'
```

## 📈 **Scaling Considerations**

### Horizontal Scaling
- **API**: Multiple API containers behind load balancer
- **ElasticSearch**: Multi-node cluster for large datasets
- **PostgreSQL**: Read replicas for read-heavy workloads

### Vertical Scaling
- **Memory**: Increase ElasticSearch heap size
- **CPU**: More cores for concurrent processing
- **Storage**: SSD for better I/O performance

## 🛡️ **Security**

### Production Security Checklist
- [ ] Change default passwords
- [ ] Enable ElasticSearch security
- [ ] Configure SSL/TLS certificates
- [ ] Set up authentication/authorization
- [ ] Configure firewall rules
- [ ] Enable audit logging
- [ ] Regular security updates

## 📝 **Assignment Compliance**

### ✅ Exercise A: Database Design
- **PostgreSQL**: Relational database with normalized schema
- **ElasticSearch**: NoSQL document store for analytics
- **CSV Data**: All three files loaded and processed
- **Required Queries**: Engineer stats, city analysis, custom queries

### ✅ Exercise B: GraphQL API
- **Node.js Backend**: Production-ready API server
- **GraphQL Implementation**: Complete with filtering, sorting, pagination
- **Required Features**: Multi-field filtering, sparse fieldsets, single record access
- **Bonus Features**: Real-time dashboard, health monitoring

### ✅ Bonus Features
- **Interactive Dashboard**: Real-time analytics and testing interface
- **Postman Collection**: Comprehensive API testing suite
- **Production Deployment**: Docker containerization with one-command setup
- **Comprehensive Documentation**: Complete setup and usage guides

## 🎯 **Next Steps**

1. **🚀 Start the system**: `docker-compose up -d`
2. **📊 Access Dashboard**: [http://localhost:4000](http://localhost:4000)
3. **🧪 Test APIs**: Use interactive testing in dashboard
4. **📋 Import Postman**: Load collection for comprehensive testing
5. **📈 Explore Kibana**: [http://localhost:5601](http://localhost:5601) for advanced analytics
6. **🔍 Monitor Health**: [http://localhost:4000/health](http://localhost:4000/health)

---

**🎉 Ready for production deployment and assignment submission!**

For detailed architecture diagrams and technical specifications, see:
- `docs/architecture.md` - Detailed system architecture
- `docs/database-design.md` - Database schema and design decisions
- `TESTING_RESULTS.md` - Comprehensive testing validation 