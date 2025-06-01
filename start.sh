#!/bin/bash

# Compensation Data Management System - Automated Start Script
# This script sets up and starts the complete system in Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Parse command line arguments
CLEAN=false
NO_BUILD=false
LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --logs)
            LOGS=true
            shift
            ;;
        *)
            echo "Unknown option $1"
            echo "Usage: $0 [--clean] [--no-build] [--logs]"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}🚀 Compensation Data Management System - Docker Setup${NC}"
echo -e "${CYAN}======================================================${NC}"

# Function to check if Docker is running
check_docker() {
    if ! docker version >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to wait for service health
wait_for_health() {
    local service_name=$1
    local max_attempts=${2:-30}
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be healthy...${NC}"
    
    for ((i=1; i<=max_attempts; i++)); do
        if docker-compose ps --services --filter "status=running" | grep -q "^$service_name$"; then
            if docker inspect --format='{{.State.Health.Status}}' "compensation-$service_name" 2>/dev/null | grep -q "healthy"; then
                echo -e "${GREEN}✅ $service_name is healthy!${NC}"
                return 0
            fi
        fi
        
        echo -e "   Attempt $i/$max_attempts - waiting..."
        sleep 10
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy${NC}"
    return 1
}

# Check Docker
check_docker

# Clean up if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning up existing containers and volumes...${NC}"
    docker-compose down -v --remove-orphans
    docker system prune -f
    echo -e "${GREEN}✅ Cleanup completed${NC}"
fi

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cp environment.example .env
    echo -e "${GREEN}✅ Environment file created${NC}"
fi

# Build images if not skipping
if [ "$NO_BUILD" = false ]; then
    echo -e "${YELLOW}🔨 Building Docker images...${NC}"
    if ! docker-compose build --no-cache; then
        echo -e "${RED}❌ Failed to build Docker images${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker images built successfully${NC}"
fi

# Start infrastructure services first
echo -e "${YELLOW}🐘 Starting PostgreSQL...${NC}"
docker-compose up -d postgres
if ! wait_for_health "postgres"; then
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Starting ElasticSearch...${NC}"
docker-compose up -d elasticsearch
if ! wait_for_health "elasticsearch"; then
    echo -e "${RED}❌ ElasticSearch failed to start${NC}"
    exit 1
fi

echo -e "${YELLOW}📊 Starting Redis...${NC}"
docker-compose up -d redis
if ! wait_for_health "redis"; then
    echo -e "${RED}❌ Redis failed to start${NC}"
    exit 1
fi

# Start API service
echo -e "${YELLOW}🌐 Starting API service...${NC}"
docker-compose up -d api
if ! wait_for_health "api"; then
    echo -e "${RED}❌ API service failed to start${NC}"
    exit 1
fi

# Start Kibana
echo -e "${YELLOW}📈 Starting Kibana...${NC}"
docker-compose up -d kibana

# Load data
echo -e "${YELLOW}📥 Loading CSV data...${NC}"
docker-compose up data-loader
data_loader_exit=$(docker wait compensation-data-loader)

if [ "$data_loader_exit" = "0" ]; then
    echo -e "${GREEN}✅ Data loading completed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Data loader finished with exit code: $data_loader_exit${NC}"
fi

# Show system status
echo ""
echo -e "${GREEN}🎉 System startup completed!${NC}"
echo -e "${GREEN}==============================${NC}"
echo ""
echo -e "${CYAN}📍 Service URLs:${NC}"
echo -e "${WHITE}   • API Health:     http://localhost:4000/health${NC}"
echo -e "${WHITE}   • API Ready:      http://localhost:4000/ready${NC}"
echo -e "${WHITE}   • GraphQL:        http://localhost:4000/graphql${NC}"
echo -e "${WHITE}   • PostgreSQL:     localhost:5432${NC}"
echo -e "${WHITE}   • ElasticSearch:  http://localhost:9200${NC}"
echo -e "${WHITE}   • Kibana:         http://localhost:5601${NC}"
echo -e "${WHITE}   • Redis:          localhost:6379${NC}"
echo ""

# Test API health
echo -e "${YELLOW}🔍 Testing API health...${NC}"
if health_response=$(curl -s -f "http://localhost:4000/health" 2>/dev/null); then
    if echo "$health_response" | grep -q '"status":"healthy"'; then
        echo -e "${GREEN}✅ API is healthy and responding${NC}"
    else
        echo -e "${YELLOW}⚠️  API health check returned unexpected response${NC}"
    fi
else
    echo -e "${RED}❌ API health check failed${NC}"
fi

# Test readiness
echo -e "${YELLOW}🔍 Testing API readiness...${NC}"
if ready_response=$(curl -s -f "http://localhost:4000/ready" 2>/dev/null); then
    if echo "$ready_response" | grep -q '"status":"ready"'; then
        echo -e "${GREEN}✅ API is ready with all services connected${NC}"
        postgres_status=$(echo "$ready_response" | grep -o '"postgres":"[^"]*"' | cut -d'"' -f4)
        elasticsearch_status=$(echo "$ready_response" | grep -o '"elasticsearch":"[^"]*"' | cut -d'"' -f4)
        echo -e "${WHITE}   • PostgreSQL: $postgres_status${NC}"
        echo -e "${WHITE}   • ElasticSearch: $elasticsearch_status${NC}"
    else
        echo -e "${YELLOW}⚠️  API readiness check returned unexpected response${NC}"
    fi
else
    echo -e "${RED}❌ API readiness check failed${NC}"
fi

echo ""
echo -e "${CYAN}📖 Sample GraphQL Queries:${NC}"
echo -e "${WHITE}   • Engineer compensation: { engineerCompensationByLocation { location count averageSalary } }${NC}"
echo -e "${WHITE}   • Location stats: { locationStats { location count averageSalary } }${NC}"
echo -e "${WHITE}   • Highest paid roles: { highestPaidRolesByExperience { jobTitle count averageSalary } }${NC}"
echo ""

if [ "$LOGS" = true ]; then
    echo -e "${YELLOW}📋 Showing container logs (Ctrl+C to exit)...${NC}"
    docker-compose logs -f
else
    echo -e "${CYAN}💡 Use 'docker-compose logs -f' to see live logs${NC}"
    echo -e "${CYAN}💡 Use 'docker-compose down' to stop all services${NC}"
    echo -e "${CYAN}💡 Use './start.sh --clean' to reset and restart everything${NC}"
fi

echo ""
echo -e "${GREEN}🎯 System is ready for testing and submission!${NC}" 