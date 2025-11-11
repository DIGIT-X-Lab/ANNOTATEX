#!/bin/bash

# AnnotateX Deployment Script
# Usage: ./deploy.sh [dev|prod]

set -e

ENV=${1:-dev}
PROJECT_NAME="annotatex"

echo "🚀 Deploying AnnotateX (Environment: $ENV)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Build the application
build_app() {
    print_status "Building AnnotateX..."
    
    if [ "$ENV" == "prod" ]; then
        docker-compose build --no-cache
    else
        docker-compose build
    fi
    
    print_status "Build completed"
}

# Deploy the application
deploy_app() {
    print_status "Deploying application..."
    
    # Stop existing containers
    docker-compose down
    
    # Start new containers
    docker-compose up -d
    
    print_status "Application deployed"
}

# Health check
health_check() {
    print_status "Running health check..."
    
    MAX_ATTEMPTS=30
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
            print_status "Health check passed"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        sleep 2
    done
    
    print_error "Health check failed after $MAX_ATTEMPTS attempts"
    docker-compose logs
    exit 1
}

# Show status
show_status() {
    echo ""
    echo "=================================="
    echo "  AnnotateX Deployment Status"
    echo "=================================="
    docker-compose ps
    echo ""
    print_status "AnnotateX is running at: http://localhost:8080"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    docker-compose logs -f"
    echo "  Stop app:     docker-compose down"
    echo "  Restart app:  docker-compose restart"
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    build_app
    deploy_app
    health_check
    show_status
}

# Run main function
main
