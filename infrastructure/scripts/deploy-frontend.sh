#!/bin/bash
# deploy-frontend.sh — Build and deploy frontend to S3 + invalidate CloudFront
set -e

STACK_NAME="${1:-TenderVault}"
REGION="${2:-us-east-1}"

echo "=== Fetching stack outputs ==="
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)
CF_DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)

echo "  API: $API_ENDPOINT"
echo "  Bucket: $FRONTEND_BUCKET"
echo "  CF Dist: $CF_DIST_ID"

echo ""
echo "=== Building frontend ==="
cd "$(dirname "$0")/../../frontend"

VITE_API_URL="$API_ENDPOINT" \
VITE_USER_POOL_ID="$USER_POOL_ID" \
VITE_USER_POOL_CLIENT_ID="$CLIENT_ID" \
VITE_AWS_REGION="$REGION" \
npm run build

echo ""
echo "=== Syncing to S3 ==="
aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" --delete --region "$REGION"

echo ""
echo "=== Invalidating CloudFront ==="
aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*" --region "$REGION"

echo ""
echo "=== Deployment complete! ==="
echo "URL: https://$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" --output text)"
