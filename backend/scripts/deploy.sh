#!/bin/bash

# Configuration
AWS_REGION="us-east-1"  # Change this to your preferred region
APP_NAME="scrum-poker"
ECR_REPO_NAME="${APP_NAME}-backend"
ECS_CLUSTER_NAME="${APP_NAME}-backend"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Error handling function
function handle_error() {
    echo -e "${RED}Error: $1${NC}"
    exit 1
}

# Verify AWS CLI is installed
if ! command -v aws &> /dev/null; then
    handle_error "AWS CLI is not installed. Please install it first."
fi

# Verify Docker is installed
if ! command -v docker &> /dev/null; then
    handle_error "Docker is not installed. Please install it first."
fi

# Verify jq is installed
if ! command -v jq &> /dev/null; then
    handle_error "jq is not installed. Please install it first."
fi

# Get the environment from command line argument
ENVIRONMENT=$1
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo "Usage: ./deploy.sh <dev|prod>"
    exit 1
fi

echo -e "${BLUE}Starting deployment to ${ENVIRONMENT}...${NC}"

# Verify AWS credentials
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
    handle_error "Failed to get AWS account ID. Please check your AWS credentials."
fi

ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

# Login to ECR
echo "Logging in to ECR..."
if ! aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO_URI}; then
    handle_error "Failed to login to ECR"
fi

# Navigate to backend directory
cd "$(dirname "$0")/.." || handle_error "Failed to navigate to backend directory"

# Build and tag Docker image
echo "Building Docker image..."
IMAGE_TAG="${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"
if ! docker build -t ${ECR_REPO_NAME}:${IMAGE_TAG} \
    --build-arg NODE_ENV=${ENVIRONMENT} \
    -f Dockerfile .; then
    handle_error "Docker build failed"
fi

# Tag and push the image
echo "Tagging and pushing image to ECR..."
if ! docker tag ${ECR_REPO_NAME}:${IMAGE_TAG} ${ECR_REPO_URI}:${IMAGE_TAG}; then
    handle_error "Failed to tag Docker image"
fi

if ! docker push ${ECR_REPO_URI}:${IMAGE_TAG}; then
    handle_error "Failed to push image to ECR"
fi

# Update ECS task definition
echo "Updating ECS task definition..."
TASK_FAMILY="${APP_NAME}-${ENVIRONMENT}"

if ! TASK_DEFINITION=$(aws ecs describe-task-definition \
    --task-definition ${TASK_FAMILY} \
    --region ${AWS_REGION} \
    --no-paginate); then
    handle_error "Failed to get task definition"
fi

if ! NEW_TASK_DEFINITION=$(echo $TASK_DEFINITION | jq --arg IMAGE "${ECR_REPO_URI}:${IMAGE_TAG}" \
    '.taskDefinition | .containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)'); then
    handle_error "Failed to process task definition JSON"
fi

if ! NEW_TASK_INFO=$(aws ecs register-task-definition \
    --region ${AWS_REGION} \
    --cli-input-json "${NEW_TASK_DEFINITION}"); then
    handle_error "Failed to register new task definition"
fi

NEW_REVISION=$(echo $NEW_TASK_INFO | jq '.taskDefinition.revision')

# Update ECS service
echo "Updating ECS service..."
if ! aws ecs update-service \
    --cluster ${ECS_CLUSTER_NAME} \
    --service ${APP_NAME}-${ENVIRONMENT} \
    --task-definition ${TASK_FAMILY}:${NEW_REVISION} \
    --region ${AWS_REGION} \
    --force-new-deployment \
    --no-paginate; then
    handle_error "Failed to update ECS service"
fi

# Wait for service to stabilize
echo "Waiting for service to stabilize..."
if ! aws ecs wait services-stable \
    --cluster ${ECS_CLUSTER_NAME} \
    --services ${APP_NAME}-${ENVIRONMENT} \
    --region ${AWS_REGION}; then
    handle_error "Service failed to stabilize"
fi

echo -e "${GREEN}Deployment to ${ENVIRONMENT} completed successfully!${NC}"
echo -e "${BLUE}Image: ${ECR_REPO_URI}:${IMAGE_TAG}${NC}"
