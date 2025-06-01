const { gql } = require('apollo-server-express');

const typeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar BigInt

  # Enums
  enum SortDirection {
    ASC
    DESC
  }

  enum CompensationSortField {
    TIMESTAMP
    ANNUAL_BASE_PAY
    ANNUAL_BONUS
    YEARS_EXPERIENCE_INDUSTRY
    YEARS_EXPERIENCE_COMPANY
    CREATED_AT
  }

  enum EmploymentType {
    FULL_TIME
    PART_TIME
    CONTRACT
    FREELANCE
    INTERN
  }

  enum Gender {
    MALE
    FEMALE
    NON_BINARY
    OTHER
    PREFER_NOT_TO_SAY
  }

  # Input types for filtering
  input IntRange {
    min: Int
    max: Int
  }

  input FloatRange {
    min: Float
    max: Float
  }

  input BigIntRange {
    min: BigInt
    max: BigInt
  }

  input CompensationFilter {
    # Text searches
    employer: String
    employerContains: String
    location: String
    locationContains: String
    jobTitle: String
    jobTitleContains: String
    
    # Exact matches
    industry: String
    companySize: String
    gender: Gender
    employmentType: EmploymentType
    educationLevel: String
    publicPrivate: String
    
    # Range filters
    annualBasePay: BigIntRange
    annualBonus: BigIntRange
    yearsExperienceIndustry: FloatRange
    yearsExperienceCompany: FloatRange
    actualHoursPerWeek: IntRange
    
    # Boolean filters
    healthInsuranceOffered: Boolean
    isHappyAtPosition: Boolean
    plansToResign: Boolean
    isValidated: Boolean
    
    # Date filters
    timestampAfter: DateTime
    timestampBefore: DateTime
    createdAfter: DateTime
    createdBefore: DateTime
    
    # Advanced filters
    dataQualityScoreMin: Float
    salaryRange: BigIntRange
    experienceRange: FloatRange
  }

  input CompensationSort {
    field: CompensationSortField!
    direction: SortDirection = ASC
  }

  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
    cursor: String
  }

  # Main compensation data type
  type CompensationData {
    id: ID!
    sourceFile: String!
    rowNumber: Int!
    
    # Temporal data
    timestamp: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Company information
    employer: String
    companySize: String
    industry: String
    publicPrivate: String
    
    # Location data
    location: String
    city: String
    stateProvince: String
    country: String
    
    # Job information
    jobTitle: String
    jobLadder: String
    jobLevel: String
    employmentType: String
    
    # Experience data
    yearsExperienceIndustry: Float
    yearsExperienceCompany: Float
    yearsAtEmployer: Float
    
    # Compensation data (in cents, converted to dollars in resolvers)
    annualBasePay: BigInt
    annualBasePayCents: BigInt  # Raw value in cents
    annualBonus: BigInt
    signingBonus: BigInt
    stockValue: BigInt
    
    # Formatted compensation (for display)
    annualBasePayFormatted: String
    totalCompensation: BigInt
    totalCompensationFormatted: String
    
    # Work schedule
    requiredHoursPerWeek: Int
    actualHoursPerWeek: Int
    annualVacationWeeks: Int
    
    # Personal information
    gender: String
    educationLevel: String
    
    # Job satisfaction
    isHappyAtPosition: Boolean
    plansToResign: Boolean
    
    # Additional data
    healthInsuranceOffered: Boolean
    additionalComments: String
    
    # Metadata
    dataQualityScore: Float
    isValidated: Boolean
  }

  # Aggregation types
  type CompensationStats {
    count: Int!
    averageSalary: Float
    medianSalary: Float
    minSalary: BigInt
    maxSalary: BigInt
    q1Salary: Float
    q3Salary: Float
    standardDeviation: Float
    
    # Experience stats
    averageExperience: Float
    medianExperience: Float
    minExperience: Float
    maxExperience: Float
    
    # Additional metrics
    totalCompensationSum: BigInt
    averageTotalCompensation: Float
  }

  type LocationStats {
    location: String!
    count: Int!
    averageSalary: Float!
    medianSalary: Float!
    minSalary: BigInt!
    maxSalary: BigInt!
  }

  type JobTitleStats {
    jobTitle: String!
    count: Int!
    averageSalary: Float!
    medianSalary: Float!
    minSalary: BigInt!
    maxSalary: BigInt!
  }

  type CompanyStats {
    employer: String!
    count: Int!
    averageSalary: Float!
    medianSalary: Float!
    minSalary: BigInt!
    maxSalary: BigInt!
  }

  type ExperienceBracketStats {
    experienceBracket: String!
    count: Int!
    averageSalary: Float!
    medianSalary: Float!
  }

  type GenderStats {
    gender: String!
    count: Int!
    averageSalary: Float!
    payGapPercentage: Float
  }

  # Paginated response types
  type CompensationConnection {
    data: [CompensationData!]!
    totalCount: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    pageInfo: PageInfo!
  }

  type PageInfo {
    startCursor: String
    endCursor: String
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Search suggestions
  type Suggestion {
    text: String!
    score: Float!
  }

  # System health
  type HealthStatus {
    status: String!
    timestamp: DateTime!
    version: String!
    services: ServiceStatus!
  }

  type ServiceStatus {
    postgres: String!
    elasticsearch: String!
    redis: String
  }

  # Root query type
  type Query {
    # Single record queries
    compensation(id: ID!): CompensationData
    compensations(
      filter: CompensationFilter
      sort: [CompensationSort!]
      pagination: PaginationInput
    ): CompensationConnection!
    
    # Statistics and aggregations
    compensationStats(filter: CompensationFilter): CompensationStats!
    locationStats(filter: CompensationFilter, limit: Int = 10): [LocationStats!]!
    jobTitleStats(filter: CompensationFilter, limit: Int = 10): [JobTitleStats!]!
    companyStats(filter: CompensationFilter, limit: Int = 10): [CompanyStats!]!
    experienceBracketStats(filter: CompensationFilter): [ExperienceBracketStats!]!
    genderStats(filter: CompensationFilter): [GenderStats!]!
    
    # Engineer-specific queries (as required by assessment)
    engineerCompensationStats(filter: CompensationFilter): CompensationStats!
    engineerCompensationByLocation(limit: Int = 10): [LocationStats!]!
    
    # Search and suggestions
    searchCompensation(
      query: String!
      filter: CompensationFilter
      limit: Int = 20
    ): [CompensationData!]!
    
    employerSuggestions(query: String!, limit: Int = 10): [Suggestion!]!
    jobTitleSuggestions(query: String!, limit: Int = 10): [Suggestion!]!
    locationSuggestions(query: String!, limit: Int = 10): [Suggestion!]!
    
    # System queries
    health: HealthStatus!
    
    # Custom interesting query (bonus requirement)
    highestPaidRolesByExperience(
      minExperience: Float = 0
      maxExperience: Float = 50
      limit: Int = 10
    ): [JobTitleStats!]!
    
    # Salary trends over time
    salaryTrendsByLocation(
      location: String!
      startDate: DateTime
      endDate: DateTime
    ): [CompensationData!]!
  }

  # Mutations (for future extensibility)
  type Mutation {
    # Note: For the assessment, this is read-only API
    # These mutations would be implemented for a full system
    
    # validateCompensationData(id: ID!): CompensationData
    # updateDataQualityScore(id: ID!, score: Float!): CompensationData
    # flagInvalidData(id: ID!, reason: String!): CompensationData
    
    # Placeholder mutation to satisfy GraphQL schema requirements
    _placeholder: String
  }

  # Subscriptions (for real-time updates)
  type Subscription {
    # Note: For the assessment, subscriptions are not required
    # These would be implemented for real-time data updates
    
    # compensationDataAdded: CompensationData!
    # compensationStatsUpdated: CompensationStats!
    
    # Placeholder subscription to satisfy GraphQL schema requirements
    _placeholder: String
  }
`;

module.exports = { typeDefs }; 