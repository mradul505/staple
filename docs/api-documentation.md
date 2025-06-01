# GraphQL API Documentation

## 📋 **Overview**

This document provides comprehensive documentation for the Compensation Data Management System GraphQL API. The API provides access to compensation data with advanced filtering, sorting, and analytics capabilities.

**Base URL**: `http://localhost:4000/graphql`  
**Protocol**: HTTP/HTTPS  
**Content-Type**: `application/json`  
**Method**: `POST`

## 🌐 **GraphQL Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/graphql` | POST | Main GraphQL endpoint |
| `/health` | GET | API health check |
| `/ready` | GET | Service readiness check |

## 📊 **Assignment Required Queries**

### **1. Engineer Compensation Statistics**

**Purpose**: Get average compensation statistics specifically for engineering roles.

```graphql
query EngineerCompensationStats {
  engineerCompensationStats {
    count
    averageSalary
    medianSalary
    minSalary
    maxSalary
  }
}
```

**Response**:
```json
{
  "data": {
    "engineerCompensationStats": {
      "count": 1369,
      "averageSalary": 125750.50,
      "medianSalary": 110000,
      "minSalary": 45000,
      "maxSalary": 350000
    }
  }
}
```

### **2. Compensation Statistics per City**

**Purpose**: Get compensation statistics grouped by location with min, max, and average values.

```graphql
query LocationStats {
  locationStats(limit: 10) {
    location
    count
    averageSalary
    medianSalary
    minSalary
    maxSalary
  }
}
```

**Response**:
```json
{
  "data": {
    "locationStats": [
      {
        "location": "San Francisco, CA",
        "count": 234,
        "averageSalary": 165000,
        "medianSalary": 155000,
        "minSalary": 90000,
        "maxSalary": 350000
      }
    ]
  }
}
```

### **3. Engineer Compensation by Location**

**Purpose**: Analyze engineering compensation specifically by geographical location.

```graphql
query EngineerCompensationByLocation {
  engineerCompensationByLocation(limit: 15) {
    location
    count
    averageSalary
    medianSalary
    minSalary
    maxSalary
  }
}
```

### **4. Custom Query: Highest Paid Roles by Experience**

**Purpose**: Custom analytical query showing highest paid roles filtered by experience range.

```graphql
query HighestPaidRolesByExperience {
  highestPaidRolesByExperience(
    minExperience: 0
    maxExperience: 20
    limit: 10
  ) {
    jobTitle
    count
    averageSalary
    medianSalary
    minSalary
    maxSalary
  }
}
```

## 🔍 **Data Query Operations**

### **Single Record Retrieval**

**Purpose**: Fetch a specific compensation record by ID.

```graphql
query GetCompensation($id: Int!) {
  compensation(id: $id) {
    id
    employer
    jobTitle
    location
    annualBasePay
    annualBasePayFormatted
    totalCompensation
    totalCompensationFormatted
    yearsExperienceIndustry
    yearsExperienceCurrentCompany
    createdAt
  }
}
```

**Variables**:
```json
{
  "id": 1
}
```

### **List Compensations with Pagination**

**Purpose**: Get a paginated list of compensation records.

```graphql
query ListCompensations {
  compensations(
    pagination: { limit: 10, offset: 0 }
  ) {
    data {
      id
      employer
      jobTitle
      location
      annualBasePay
      totalCompensation
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}
```

### **Advanced Filtering**

**Purpose**: Filter compensation data by multiple criteria.

```graphql
query FilteredCompensations {
  compensations(
    filter: {
      jobTitleContains: "engineer"
      locationContains: "San Francisco"
      annualBasePay: { min: 100000, max: 200000 }
      yearsExperienceIndustry: { min: 2, max: 10 }
    }
    pagination: { limit: 20, offset: 0 }
  ) {
    data {
      employer
      jobTitle
      location
      annualBasePay
      yearsExperienceIndustry
    }
    totalCount
  }
}
```

### **Sorting and Ordering**

**Purpose**: Sort compensation data by various fields.

```graphql
query SortedCompensations {
  compensations(
    sort: [
      { field: ANNUAL_BASE_PAY, direction: DESC }
      { field: YEARS_EXPERIENCE_INDUSTRY, direction: ASC }
    ]
    pagination: { limit: 10 }
  ) {
    data {
      employer
      jobTitle
      location
      annualBasePayFormatted
      yearsExperienceIndustry
    }
    totalCount
    hasNextPage
  }
}
```

## ✨ **Sparse Fieldsets (Field Selection)**

**Purpose**: Request only specific fields for performance optimization.

### **Minimal Fields**
```graphql
query MinimalFields {
  compensations(pagination: { limit: 100 }) {
    data {
      employer
      annualBasePay
      location
    }
  }
}
```

### **Summary Fields Only**
```graphql
query SummaryFields {
  compensations(pagination: { limit: 50 }) {
    data {
      jobTitle
      annualBasePayFormatted
      totalCompensationFormatted
    }
  }
}
```

### **Analytics Fields**
```graphql
query AnalyticsFields {
  compensations(pagination: { limit: 25 }) {
    data {
      id
      jobTitle
      location
      annualBasePay
      yearsExperienceIndustry
    }
  }
}
```

## 📈 **Analytics Queries**

### **Overall Compensation Statistics**

```graphql
query OverallStats {
  compensationStats {
    count
    averageSalary
    medianSalary
    minSalary
    maxSalary
    q1Salary
    q3Salary
    standardDeviation
    averageExperience
  }
}
```

### **Job Title Analysis**

```graphql
query JobTitleAnalysis {
  jobTitleStats(limit: 15) {
    jobTitle
    count
    averageSalary
    medianSalary
    minSalary
    maxSalary
  }
}
```

### **Experience-based Analysis**

```graphql
query ExperienceAnalysis {
  highestPaidRolesByExperience(
    minExperience: 10
    maxExperience: 30
    limit: 5
  ) {
    jobTitle
    count
    averageSalary
    medianSalary
  }
}
```

## 🏥 **Health and System Queries**

### **System Health Check**

```graphql
query SystemHealth {
  health {
    status
    timestamp
    version
    environment
    services {
      postgres
      elasticsearch
      redis
    }
  }
}
```

### **Service Readiness**

```graphql
query ServiceReadiness {
  ready {
    status
    services {
      postgres
      elasticsearch
    }
  }
}
```

## 🔧 **Advanced Query Examples**

### **Complex Multi-Filter Query**

```graphql
query ComplexFiltering {
  compensations(
    filter: {
      jobTitleContains: "Senior"
      locationContains: "CA"
      annualBasePay: { min: 120000 }
      yearsExperienceIndustry: { min: 5 }
      healthInsuranceOffered: true
    }
    sort: [{ field: ANNUAL_BASE_PAY, direction: DESC }]
    pagination: { limit: 10 }
  ) {
    data {
      employer
      jobTitle
      location
      yearsExperienceIndustry
      annualBasePay
      totalCompensation
      healthInsuranceOffered
    }
    totalCount
  }
}
```

### **Salary Range Analysis**

```graphql
query SalaryRangeAnalysis {
  compensations(
    filter: {
      annualBasePay: { min: 150000, max: 300000 }
    }
    sort: [{ field: ANNUAL_BASE_PAY, direction: DESC }]
    pagination: { limit: 15 }
  ) {
    data {
      employer
      jobTitle
      location
      annualBasePay
      annualBasePayFormatted
    }
    totalCount
  }
}
```

### **Experience Level Filtering**

```graphql
query ExperienceLevelFiltering {
  compensations(
    filter: {
      yearsExperienceIndustry: { min: 5, max: 10 }
    }
    sort: [{ field: YEARS_EXPERIENCE_INDUSTRY, direction: ASC }]
    pagination: { limit: 10 }
  ) {
    data {
      employer
      jobTitle
      yearsExperienceIndustry
      yearsExperienceCurrentCompany
      annualBasePay
    }
    totalCount
  }
}
```

## 📊 **GraphQL Schema Types**

### **Main Types**

```graphql
type Compensation {
  id: Int!
  employer: String
  jobTitle: String
  location: String
  annualBasePay: Float
  annualBasePayFormatted: String
  totalCompensation: Float
  totalCompensationFormatted: String
  yearsExperienceIndustry: Int
  yearsExperienceCurrentCompany: Int
  createdAt: String
  updatedAt: String
}

type CompensationStats {
  count: Int!
  averageSalary: Float!
  medianSalary: Float!
  minSalary: Float!
  maxSalary: Float!
  q1Salary: Float
  q3Salary: Float
  standardDeviation: Float
  averageExperience: Float
}

type LocationStats {
  location: String!
  count: Int!
  averageSalary: Float!
  medianSalary: Float!
  minSalary: Float!
  maxSalary: Float!
}

type JobTitleStats {
  jobTitle: String!
  count: Int!
  averageSalary: Float!
  medianSalary: Float!
  minSalary: Float!
  maxSalary: Float!
}
```

### **Input Types**

```graphql
input CompensationFilterInput {
  jobTitleContains: String
  locationContains: String
  employerContains: String
  annualBasePay: RangeInput
  totalCompensation: RangeInput
  yearsExperienceIndustry: RangeInput
  yearsExperienceCurrentCompany: RangeInput
  healthInsuranceOffered: Boolean
}

input RangeInput {
  min: Float
  max: Float
}

input SortInput {
  field: SortField!
  direction: SortDirection!
}

input PaginationInput {
  limit: Int = 10
  offset: Int = 0
}

enum SortField {
  ANNUAL_BASE_PAY
  TOTAL_COMPENSATION
  YEARS_EXPERIENCE_INDUSTRY
  YEARS_EXPERIENCE_CURRENT_COMPANY
  CREATED_AT
  EMPLOYER
  JOB_TITLE
  LOCATION
}

enum SortDirection {
  ASC
  DESC
}
```

## 🚨 **Error Handling**

### **Common Error Responses**

```json
{
  "errors": [
    {
      "message": "Validation error: Invalid field 'invalidField'",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["compensations"],
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

### **Error Types**

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid input or query structure | 400 |
| `NOT_FOUND` | Resource not found | 404 |
| `INTERNAL_ERROR` | Server error | 500 |
| `RATE_LIMITED` | Too many requests | 429 |

## 📝 **Usage Examples**

### **cURL Examples**

**Basic Query**:
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ health { status } }"
  }'
```

**Complex Query with Variables**:
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query($filter: CompensationFilterInput) { compensations(filter: $filter) { data { employer jobTitle annualBasePay } totalCount } }",
    "variables": {
      "filter": {
        "jobTitleContains": "engineer",
        "annualBasePay": { "min": 100000 }
      }
    }
  }'
```

### **JavaScript/Node.js Example**

```javascript
const fetch = require('node-fetch');

async function queryCompensations() {
  const query = `
    query {
      compensations(
        filter: { jobTitleContains: "engineer" }
        pagination: { limit: 5 }
      ) {
        data {
          employer
          jobTitle
          annualBasePayFormatted
        }
        totalCount
      }
    }
  `;

  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const result = await response.json();
  console.log(result.data);
}
```

### **Python Example**

```python
import requests
import json

def query_engineer_stats():
    query = """
    query {
      engineerCompensationStats {
        count
        averageSalary
        medianSalary
      }
    }
    """
    
    response = requests.post(
        'http://localhost:4000/graphql',
        json={'query': query},
        headers={'Content-Type': 'application/json'}
    )
    
    return response.json()

result = query_engineer_stats()
print(json.dumps(result, indent=2))
```

## 🔗 **Postman Collection Usage**

### **Import Collection**
1. Open Postman
2. Click "Import"
3. Select `./postman/postmanCollection.json`
4. Set environment variable: `baseUrl = http://localhost:4000`

### **Collection Structure**
- **Health & Status**: Basic connectivity tests
- **Required Assignment Queries**: All assignment-specific queries
- **Data Queries**: CRUD operations
- **Analytics Queries**: Statistical analysis
- **Advanced Filtering**: Complex query examples
- **Sparse Fieldsets**: Performance optimization examples
- **Error Handling**: Error response examples

## 📊 **Performance Considerations**

### **Query Optimization Tips**

1. **Use Pagination**: Always specify reasonable limits
2. **Select Specific Fields**: Use sparse fieldsets for better performance
3. **Filter Early**: Apply filters to reduce dataset size
4. **Index Usage**: Queries on indexed fields perform better

### **Rate Limiting**

- **Default Limit**: 100 requests per minute per IP
- **Headers**: Check `X-RateLimit-*` headers in responses
- **Exceeded**: Returns HTTP 429 with retry information

### **Caching**

- **Query Caching**: Frequently accessed queries are cached
- **TTL**: Default cache expiration is 5 minutes
- **Cache Headers**: Check `X-Cache` header for cache status

---

**📝 Document Version**: 1.0  
**📅 Last Updated**: 2024  
**👥 Maintainer**: API Development Team  
**🔄 Review Cycle**: Monthly 