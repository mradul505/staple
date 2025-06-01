# Compensation Data Management System - Automated Start Script
# This script sets up and starts the complete system in Docker containers

param(
    [switch]$Clean,
    [switch]$NoBuild,
    [switch]$Logs
)

Write-Host "🚀 Compensation Data Management System - Docker Setup" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker version | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to wait for service health
function Wait-ForServiceHealth {
    param($ServiceName, $MaxAttempts = 30)
    
    Write-Host "⏳ Waiting for $ServiceName to be healthy..." -ForegroundColor Yellow
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $status = docker-compose ps --services --filter "status=running" | Where-Object { $_ -eq $ServiceName }
        
        if ($status) {
            $health = docker inspect --format='{{.State.Health.Status}}' "compensation-$ServiceName" 2>$null
            if ($health -eq "healthy") {
                Write-Host "✅ $ServiceName is healthy!" -ForegroundColor Green
                return $true
            }
        }
        
        Write-Host "   Attempt $i/$MaxAttempts - waiting..." -ForegroundColor Gray
        Start-Sleep -Seconds 10
    }
    
    Write-Host "❌ $ServiceName failed to become healthy" -ForegroundColor Red
    return $false
}

# Check Docker
if (!(Test-DockerRunning)) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker is running" -ForegroundColor Green

# Clean up if requested
if ($Clean) {
    Write-Host "🧹 Cleaning up existing containers and volumes..." -ForegroundColor Yellow
    docker-compose down -v --remove-orphans
    docker system prune -f
    Write-Host "✅ Cleanup completed" -ForegroundColor Green
}

# Create environment file if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    Copy-Item "environment.example" ".env"
    Write-Host "✅ Environment file created" -ForegroundColor Green
}

# Build images if not skipping
if (!$NoBuild) {
    Write-Host "🔨 Building Docker images..." -ForegroundColor Yellow
    docker-compose build --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build Docker images" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Docker images built successfully" -ForegroundColor Green
}

# Start infrastructure services first
Write-Host "🐘 Starting PostgreSQL..." -ForegroundColor Yellow
docker-compose up -d postgres
if (!(Wait-ForServiceHealth "postgres")) {
    Write-Host "❌ PostgreSQL failed to start" -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Starting ElasticSearch..." -ForegroundColor Yellow
docker-compose up -d elasticsearch
if (!(Wait-ForServiceHealth "elasticsearch")) {
    Write-Host "❌ ElasticSearch failed to start" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Starting Redis..." -ForegroundColor Yellow
docker-compose up -d redis
if (!(Wait-ForServiceHealth "redis")) {
    Write-Host "❌ Redis failed to start" -ForegroundColor Red
    exit 1
}

# Start API service
Write-Host "🌐 Starting API service..." -ForegroundColor Yellow
docker-compose up -d api
if (!(Wait-ForServiceHealth "api")) {
    Write-Host "❌ API service failed to start" -ForegroundColor Red
    exit 1
}

# Start Kibana
Write-Host "📈 Starting Kibana..." -ForegroundColor Yellow
docker-compose up -d kibana

# Load data
Write-Host "📥 Loading CSV data..." -ForegroundColor Yellow
docker-compose up data-loader
$dataLoaderExit = docker wait compensation-data-loader

if ($dataLoaderExit -eq "0") {
    Write-Host "✅ Data loading completed successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Data loader finished with exit code: $dataLoaderExit" -ForegroundColor Yellow
}

# Show system status
Write-Host ""
Write-Host "🎉 System startup completed!" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Service URLs:" -ForegroundColor Cyan
Write-Host "   • API Health:     http://localhost:4000/health" -ForegroundColor White
Write-Host "   • API Ready:      http://localhost:4000/ready" -ForegroundColor White
Write-Host "   • GraphQL:        http://localhost:4000/graphql" -ForegroundColor White
Write-Host "   • PostgreSQL:     localhost:5432" -ForegroundColor White
Write-Host "   • ElasticSearch:  http://localhost:9200" -ForegroundColor White
Write-Host "   • Kibana:         http://localhost:5601" -ForegroundColor White
Write-Host "   • Redis:          localhost:6379" -ForegroundColor White
Write-Host ""

# Test API health
Write-Host "🔍 Testing API health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 10
    if ($health.status -eq "healthy") {
        Write-Host "✅ API is healthy and responding" -ForegroundColor Green
    } else {
        Write-Host "⚠️  API health check returned: $($health.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ API health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test readiness
Write-Host "🔍 Testing API readiness..." -ForegroundColor Yellow
try {
    $ready = Invoke-RestMethod -Uri "http://localhost:4000/ready" -Method GET -TimeoutSec 10
    if ($ready.status -eq "ready") {
        Write-Host "✅ API is ready with all services connected" -ForegroundColor Green
        Write-Host "   • PostgreSQL: $($ready.services.postgres)" -ForegroundColor White
        Write-Host "   • ElasticSearch: $($ready.services.elasticsearch)" -ForegroundColor White
    } else {
        Write-Host "⚠️  API readiness check returned: $($ready.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ API readiness check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📖 Sample GraphQL Queries:" -ForegroundColor Cyan
Write-Host "   • Engineer compensation: { engineerCompensationByLocation { location count averageSalary } }" -ForegroundColor White
Write-Host "   • Location stats: { locationStats { location count averageSalary } }" -ForegroundColor White
Write-Host "   • Highest paid roles: { highestPaidRolesByExperience { jobTitle count averageSalary } }" -ForegroundColor White
Write-Host ""

if ($Logs) {
    Write-Host "📋 Showing container logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    docker-compose logs -f
} else {
    Write-Host "💡 Use 'docker-compose logs -f' to see live logs" -ForegroundColor Cyan
    Write-Host "💡 Use 'docker-compose down' to stop all services" -ForegroundColor Cyan
    Write-Host "💡 Use './start.ps1 -Clean' to reset and restart everything" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🎯 System is ready for testing and submission!" -ForegroundColor Green 