# System Architecture Documentation

## 📋 **Overview**

The Compensation Data Management System is built using a microservices architecture with multiple databases, real-time streaming, and intelligent fallback mechanisms. This document provides detailed technical specifications and architectural decisions.

## 🏗️ **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPENSATION DATA MANAGEMENT SYSTEM                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│  │   Client Tier   │    │  Application    │    │   Data Tier     │            │
│  │                 │    │      Tier       │    │                 │            │
│  │  📊 Dashboard   │◄──►│  🌐 GraphQL     │◄──►│  🐘 PostgreSQL  │            │
│  │  🌐 Postman     │    │     API         │    │  🔍 ES Cluster  │            │
│  │  📱 Mobile      │    │  ⚡ Node.js     │    │  ⚡ Redis       │            │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🔧 **Detailed Component Architecture**

### **1. Client Tier**

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  📊 Dashboard   │  │  🧪 Postman     │  │  📱 Mobile/Web  │ │
│  │                 │  │                 │  │                 │ │
│  │ • Real-time     │  │ • API Testing   │  │ • GraphQL       │ │
│  │   Charts        │  │ • Collection    │  │   Playground    │ │
│  │ • Filtering     │  │ • Automation    │  │ • Documentation │ │
│  │ • Testing UI    │  │ • Validation    │  │ • Query Builder │ │
│  │ • Testing UI    │  │ • Validation    │  │ • Query Builder │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │        │
│           └─────────────────────┼─────────────────────┘        │
│                                 │                              │
│                          HTTP/GraphQL                          │
│                         (Port 4000)                            │
└─────────────────────────────────┼─────────────────────────────┘
                                  ▼
```

### **2. Application Tier**

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION TIER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              🌐 GRAPHQL API SERVER                         │ │
│  │                                                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │   Schema    │  │  Resolvers  │  │ Middleware  │       │ │
│  │  │             │  │             │  │             │       │ │
│  │  │ • Types     │  │ • Queries   │  │ • Auth      │       │ │
│  │  │ • Queries   │  │ • Mutations │  │ • CORS      │       │ │
│  │  │ • Mutations │  │ • Fields    │  │ • Helmet    │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              ⚡ BUSINESS LOGIC LAYER                       │ │
│  │                                                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │   Service   │  │  Fallback   │  │  Streaming  │       │ │
│  │  │   Layer     │  │   Logic     │  │   Service   │       │ │
│  │  │             │  │             │  │             │       │ │
│  │  │ • Analytics │  │ • ES → PG   │  │ • PG → ES   │       │ │
│  │  │ • Filters   │  │ • Health    │  │ • Bulk Ops  │       │ │
│  │  │ • Sorting   │  │ • Retry     │  │ • Real-time │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────┼─────────────────────────────────┘
                                  ▼
```

### **3. Data Tier**

```
┌─────────────────────────────────────────────────────────────────┐
│                          DATA TIER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  🐘 PostgreSQL  │  │ 🔍 Elasticsearch│  │  ⚡ Redis       │ │
│  │                 │  │                 │  │                 │ │
│  │ • ACID Trans    │  │ • Full-text     │  │ • Session       │ │
│  │ • Normalized    │  │   Search        │  │   Storage       │ │
│  │ • Indexed       │  │ • Aggregations  │  │ • Query Cache   │ │
│  │ • Constraints   │  │ • Analytics     │  │ • Rate Limit    │ │
│  │                 │  │                 │  │                 │ │
│  │ Port: 5432      │  │ Port: 9200      │  │ Port: 6379      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 **Data Flow Architecture**

### **1. Read Operations Flow**

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │  GraphQL    │    │ Service     │    │    Data     │
│  Request    │───►│   Server    │───►│   Layer     │───►│   Sources   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                    ┌─────────────────────────────────────────┐
                    │         INTELLIGENT ROUTING              │
                    │                                         │
                    │  ┌─────────────┐  ┌─────────────┐     │
                    │  │ PRIMARY:    │  │ FALLBACK:   │     │
                    │  │ElasticSearch│  │ PostgreSQL  │     │
                    │  │             │  │             │     │
                    │  │ • Fast      │  │ • Reliable  │     │
                    │  │ • Scalable  │  │ • ACID      │     │
                    │  │ • Analytics │  │ • Backup    │     │
                    │  └─────────────┘  └─────────────┘     │
                    └─────────────────────────────────────────┘
```

### **2. Write Operations Flow**

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  CSV Data   │───►│ Data Loader │───►│ PostgreSQL  │
│   Import    │    │   Service   │    │  (Primary)  │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                   ┌─────────────────────────────────────┐
                   │         STREAMING SERVICE            │
                   │                                     │
                   │  • Batch Processing (1000 records) │
                   │  • Retry Logic with Backoff        │
                   │  • Real-time Synchronization       │
                   │  • Error Handling & Logging        │
                   └─────────────────────────────────────┘
                                            │
                                            ▼
                                   ┌─────────────┐
                                   │ElasticSearch│
                                   │(Secondary)  │
                                   └─────────────┘
```

## 🐳 **Container Architecture**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER COMPOSE ENVIRONMENT                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   api:4000      │  │postgres:5432    │  │elasticsearch:  │                │
│  │                 │  │                 │  │     9200        │                │
│  │ • Node.js       │  │ • PostgreSQL    │  │ • ES Cluster    │                │
│  │ • GraphQL       │  │ • Data Storage  │  │ • Search Engine │                │
│  │ • Health Checks │  │ • ACID Trans    │  │ • Analytics     │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │  redis:6379     │  │  kibana:5601    │  │  es-streamer    │                │
│  │                 │  │                 │  │                 │                │
│  │ • Caching       │  │ • Visualization │  │ • Data Sync     │                │
│  │ • Sessions      │  │ • Dashboards    │  │ • Bulk Ops      │                │
│  │ • Rate Limiting │  │ • Query Builder │  │ • Background    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────┐                                                           │
│  │   db-init       │                                                           │
│  │                 │                                                           │
│  │ • Schema Setup  │                                                           │
│  │ • Data Loading  │                                                           │
│  │ • Init Only     │                                                           │
│  └─────────────────┘                                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 **Database Architecture**

### **1. PostgreSQL Schema Design**

```
┌─────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL SCHEMA                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                COMPENSATION_DATA (Main Table)              │ │
│  │                                                             │ │
│  │  id (UUID) ───────────────── PRIMARY KEY                  │ │
│  │  source_file (VARCHAR) ────── Tracking                     │ │
│  │  employer (VARCHAR) ───────── Company Name                 │ │
│  │  job_title (VARCHAR) ──────── Position                     │ │
│  │  location (VARCHAR) ───────── Geographical                 │ │
│  │  annual_base_pay (BIGINT) ─── Salary (cents)              │ │
│  │  total_compensation (BIGINT) ── Total Pay                  │ │
│  │  years_experience (DECIMAL) ── Experience                  │ │
│  │  created_at (TIMESTAMP) ───── Audit Trail                  │ │
│  │  updated_at (TIMESTAMP) ───── Audit Trail                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   COMPANIES     │  │   LOCATIONS     │  │  JOB_TITLES     │ │
│  │                 │  │                 │  │                 │ │
│  │ • Normalized    │  │ • Geocoded      │  │ • Categorized   │ │
│  │ • Industry      │  │ • Standardized  │  │ • Leveled       │ │
│  │ • Size          │  │ • Indexed       │  │ • Normalized    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **2. Elasticsearch Index Design**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELASTICSEARCH MAPPING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  {                                                              │
│    "compensation_data": {                                       │
│      "mappings": {                                              │
│        "properties": {                                          │
│          "id": { "type": "keyword" },                          │
│          "employer": {                                          │
│            "type": "text",                                      │
│            "analyzer": "standard",                              │
│            "fields": {                                          │
│              "keyword": { "type": "keyword" },                 │
│              "suggest": { "type": "completion" }               │
│            }                                                    │
│          },                                                     │
│          "jobTitle": {                                          │
│            "type": "text",                                      │
│            "analyzer": "english",                               │
│            "fields": { "keyword": { "type": "keyword" } }      │
│          },                                                     │
│          "location": {                                          │
│            "type": "text",                                      │
│            "fields": { "keyword": { "type": "keyword" } }      │
│          },                                                     │
│          "annualBasePay": { "type": "double" },                │
│          "totalCompensation": { "type": "double" },            │
│          "yearsExperience": { "type": "integer" },             │
│          "timestamp": { "type": "date" }                       │
│        }                                                        │
│      }                                                          │
│    }                                                            │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 **Service Communication Architecture**

### **1. Synchronous Communication**

```
┌─────────────┐    GraphQL     ┌─────────────┐    Database    ┌─────────────┐
│   Client    │───────────────►│   API       │───────────────►│ PostgreSQL  │
│  (Browser)  │◄───────────────│  Server     │◄───────────────│   / ES      │
└─────────────┘   HTTP/JSON    └─────────────┘    Queries     └─────────────┘
                                      │
                                      ▼
                               ┌─────────────┐
                               │   Redis     │
                               │  (Cache)    │
                               └─────────────┘
```

### **2. Asynchronous Communication**

```
┌─────────────┐    Triggers    ┌─────────────┐    Streaming   ┌─────────────┐
│ PostgreSQL  │───────────────►│  Streamer   │───────────────►│ElasticSearch│
│  (Source)   │   Insert/Update│  Service    │   Bulk Indexing│ (Target)    │
└─────────────┘                └─────────────┘                └─────────────┘
                                      │
                                      ▼
                               ┌─────────────┐
                               │   Logging   │
                               │  & Metrics  │
                               └─────────────┘
```

## 🛡️ **Security Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   NETWORK SECURITY                         │ │
│  │                                                             │ │
│  │  • Docker Network Isolation                                │ │
│  │  • Container-to-Container Communication                    │ │
│  │  • Port Restrictions (Only Necessary Ports Exposed)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 APPLICATION SECURITY                       │ │
│  │                                                             │ │
│  │  • Helmet.js (Security Headers)                           │ │
│  │  • CORS (Cross-Origin Resource Sharing)                   │ │
│  │  • Rate Limiting (Request Throttling)                     │ │
│  │  • Input Validation (GraphQL Schema)                      │ │
│  │  • Query Complexity Limiting                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   DATA SECURITY                            │ │
│  │                                                             │ │
│  │  • Database Connection Encryption                          │ │
│  │  • Environment Variable Secrets                           │ │
│  │  • No Hardcoded Credentials                               │ │
│  │  • Audit Logging                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📈 **Performance Architecture**

### **1. Caching Strategy**

```
┌─────────────┐    Cache Hit   ┌─────────────┐
│   Client    │◄──────────────│   Redis     │
│  Request    │               │   Cache     │
└─────────────┘               └─────────────┘
      │                              ▲
      │ Cache Miss                   │ Store
      ▼                              │
┌─────────────┐    Database    ┌─────────────┐
│   API       │───────────────►│ PostgreSQL  │
│  Server     │◄───────────────│   / ES      │
└─────────────┘    Response    └─────────────┘
```

### **2. Database Optimization**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE OPTIMIZATIONS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PostgreSQL:                    ElasticSearch:                  │
│  ┌─────────────────────────┐    ┌─────────────────────────┐     │
│  │ • Connection Pooling    │    │ • Bulk Indexing        │     │
│  │ • Query Optimization    │    │ • Mapping Optimization │     │
│  │ • Index Strategies      │    │ • Shard Configuration  │     │
│  │ • Materialized Views    │    │ • Refresh Intervals    │     │
│  │ • Partial Indexes       │    │ • Query Caching        │     │
│  │ • Statistics Updates    │    │ • Field Data Cache     │     │
│  └─────────────────────────┘    └─────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 **Deployment Architecture**

### **1. Development Environment**

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Local Machine:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  docker-compose up -d                                       │ │
│  │                                                             │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │ │
│  │  │    API    │ │PostgreSQL │ │    ES     │ │   Redis   │   │ │
│  │  │  :4000    │ │   :5432   │ │   :9200   │ │   :6379   │   │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │ │
│  │                                                             │ │
│  │  ┌───────────┐ ┌───────────────────────────────────────┐   │ │
│  │  │  Kibana   │ │          Init & Streaming            │   │ │
│  │  │   :5601   │ │             Services                 │   │ │
│  │  └───────────┘ └───────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### **2. Production Architecture (Recommended)**

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Load Balancer (nginx):                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     :80 / :443                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  API Cluster:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │ │
│  │  │ API Node1 │ │ API Node2 │ │ API Node3 │                 │ │
│  │  │   :4000   │ │   :4001   │ │   :4002   │                 │ │
│  │  └───────────┘ └───────────┘ └───────────┘                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│  Database Cluster:                                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │ │
│  │  │ PG Master │ │PG Replica1│ │PG Replica2│                 │ │
│  │  │   :5432   │ │   :5433   │ │   :5434   │                 │ │
│  │  └───────────┘ └───────────┘ └───────────┘                 │ │
│  │                                                             │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │ │
│  │  │ES Master  │ │ ES Data1  │ │ ES Data2  │                 │ │
│  │  │   :9200   │ │   :9201   │ │   :9202   │                 │ │
│  │  └───────────┘ └───────────┘ └───────────┘                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 **Monitoring Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      MONITORING STACK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Application Monitoring:                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  • Health Endpoints (/health, /ready)                      │ │
│  │  • Structured Logging (Winston)                            │ │
│  │  • Performance Metrics                                     │ │
│  │  • Error Tracking                                          │ │
│  │  • Request/Response Logging                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Infrastructure Monitoring:                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  • Docker Stats                                            │ │
│  │  • Container Health Checks                                 │ │
│  │  • Resource Usage                                          │ │
│  │  • Network Connectivity                                    │ │
│  │  • Disk Usage                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Database Monitoring:                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  • PostgreSQL Query Performance                            │ │
│  │  • ElasticSearch Cluster Health                           │ │
│  │  • Redis Memory Usage                                      │ │
│  │  • Connection Pool Status                                  │ │
│  │  • Backup Status                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 **Data Processing Pipeline**

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA PROCESSING FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input Sources:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  CSV Files → Data Validation → Normalization → Loading     │ │
│  │     │              │                 │            │        │ │
│  │     ▼              ▼                 ▼            ▼        │ │
│  │  Schema       Type Checking    Standardization PostgreSQL  │ │
│  │  Validation   Range Validation  Location Codes   Storage   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Processing Pipeline:                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  PostgreSQL → Trigger → Stream Service → ElasticSearch     │ │
│  │      │           │           │                │             │ │
│  │      ▼           ▼           ▼                ▼             │ │
│  │   Primary     Change      Bulk Ops       Search Index      │ │
│  │   Storage     Detection   (1000/batch)   & Analytics       │ │
│  │               Events      Error Handling                   │ │
│  │                          Retry Logic                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Output Processing:                                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  GraphQL API → Business Logic → Data Sources → Response   │ │
│  │      │              │              │            │          │ │
│  │      ▼              ▼              ▼            ▼          │ │
│  │   Schema         Filtering      Intelligent    JSON       │ │
│  │   Validation     Sorting        Routing       Format      │ │
│  │   Field          Pagination     ES/PG Fall.   Caching     │ │
│  │   Selection      Aggregation    back Logic    Response    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📚 **Technology Stack Summary**

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **API Server** | Node.js + Express | 18.x | Runtime Environment |
| **GraphQL** | Apollo Server | 4.x | API Layer |
| **Primary DB** | PostgreSQL | 15.x | Data Storage |
| **Search Engine** | Elasticsearch | 8.x | Analytics & Search |
| **Cache** | Redis | 7.x | Performance |
| **Container** | Docker | 20.x+ | Deployment |
| **Orchestration** | Docker Compose | 2.x | Multi-container |
| **Frontend** | HTML5 + Chart.js | Latest | Dashboard |
| **Testing** | Postman Collection | N/A | API Testing |

## 🎯 **Architecture Decision Records (ADRs)**

### **ADR-001: Dual Database Strategy**
- **Decision**: Use PostgreSQL as primary + Elasticsearch as secondary
- **Rationale**: Leverage SQL ACID properties + NoSQL search capabilities
- **Consequences**: Better performance but increased complexity

### **ADR-002: GraphQL over REST**
- **Decision**: Implement GraphQL API instead of REST
- **Rationale**: Better field selection, single endpoint, strong typing
- **Consequences**: Learning curve but better developer experience

### **ADR-003: Docker Containerization**
- **Decision**: Full containerization with Docker Compose
- **Rationale**: Platform independence, easy deployment, isolation
- **Consequences**: Additional abstraction layer but improved portability

### **ADR-004: Intelligent Fallback**
- **Decision**: Implement ES → PostgreSQL fallback logic
- **Rationale**: High availability, graceful degradation
- **Consequences**: Increased complexity but better reliability

---

**📝 Document Version**: 1.0  
**📅 Last Updated**: 2024  
**👥 Maintainer**: Development Team  
**🔄 Review Cycle**: Quarterly 