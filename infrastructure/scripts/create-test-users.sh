#!/bin/bash
# create-test-users.sh
# Creates test users in Cognito for demo purposes

set -e

STACK_NAME="${1:-tendervault}"
REGION="${2:-us-east-1}"

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

echo "User Pool ID: $USER_POOL_ID"

# Create admin user
echo "Creating admin user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "admin@tendervault.com" \
  --user-attributes Name=email,Value=admin@tendervault.com Name=email_verified,Value=true \
  --temporary-password "TenderVault@2026!" \
  --region "$REGION" \
  --message-action SUPPRESS || echo "Admin user may already exist"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "admin@tendervault.com" \
  --group-name "tv-admin" \
  --region "$REGION" || echo "Admin group assignment may already exist"

# Create bidder user
echo "Creating bidder user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "bidder@tendervault.com" \
  --user-attributes Name=email,Value=bidder@tendervault.com Name=email_verified,Value=true \
  --temporary-password "TenderVault@2026!" \
  --region "$REGION" \
  --message-action SUPPRESS || echo "Bidder user may already exist"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "bidder@tendervault.com" \
  --group-name "tv-bidder" \
  --region "$REGION" || echo "Bidder group assignment may already exist"

# Create evaluator user
echo "Creating evaluator user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "evaluator@tendervault.com" \
  --user-attributes Name=email,Value=evaluator@tendervault.com Name=email_verified,Value=true \
  --temporary-password "TenderVault@2026!" \
  --region "$REGION" \
  --message-action SUPPRESS || echo "Evaluator user may already exist"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "evaluator@tendervault.com" \
  --group-name "tv-evaluator" \
  --region "$REGION" || echo "Evaluator group assignment may already exist"

echo ""
echo "Test users created:"
echo "  admin@tendervault.com     (tv-admin)     — temporary password: TenderVault@2026!"
echo "  bidder@tendervault.com    (tv-bidder)     — temporary password: TenderVault@2026!"
echo "  evaluator@tendervault.com (tv-evaluator)  — temporary password: TenderVault@2026!"
echo ""
echo "Users will be prompted to change password on first login."
