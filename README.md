# TenderVault 🔐

**Tamper-proof, time-locked government tender bid management SaaS built on AWS.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CloudFront (CDN)                         │
│                     React 18 + Vite + Tailwind                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────────────────┐
│               API Gateway HTTP API (REST)                       │
│           Custom Lambda Authorizer (JWT)                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    Lambda Functions (Node.js 20.x)              │
│                                                                 │
│  create-tender  │ list-tenders │ get-tender │ generate-upload   │
│  confirm-upload │ generate-download (TIME-LOCK) │ list-bids     │
│  list-versions  │ restore-version │ list-audit-logs             │
└────┬──────────────────┬──────────────────────┬──────────────────┘
     │                  │                      │
┌────▼─────┐    ┌───────▼──────┐     ┌─────────▼───────┐
│ DynamoDB │    │  S3 (Versioned│     │    Cognito      │
│ 3 Tables │    │  + Encrypted) │     │   User Pool     │
│ + GSIs   │    │  + CRR Replica│     │  3 Role Groups  │
└──────────┘    └──────────────┘     └─────────────────┘
```

## Prerequisites

- **Node.js** ≥ 20.x
- **AWS CLI** configured with appropriate credentials
- **AWS SAM CLI** ≥ 1.x
- **npm** ≥ 9.x

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url> && cd TenderVault
npm install            # Installs all workspace dependencies
```

### 2. Deploy Backend (SAM)

```bash
cd infrastructure
sam build --template template.yaml
sam deploy --guided    # First time — follow prompts
```

This creates all AWS resources: S3 buckets, DynamoDB tables, Cognito User Pool, API Gateway, Lambda functions, CloudFront distribution, and monitoring alarms.

### 3. Create Test Users

```bash
chmod +x infrastructure/scripts/create-test-users.sh
./infrastructure/scripts/create-test-users.sh tendervault us-east-1
```

Creates 3 users with temporary password `TenderVault@2026!`:
| Email | Role | Access |
|---|---|---|
| `admin@tendervault.com` | tv-admin | Full system access |
| `bidder@tendervault.com` | tv-bidder | Submit bids only |
| `evaluator@tendervault.com` | tv-evaluator | View bids post-deadline |

### 4. Configure & Deploy Frontend

```bash
chmod +x infrastructure/scripts/deploy-frontend.sh
./infrastructure/scripts/deploy-frontend.sh tendervault us-east-1
```

Or manually:

```bash
chmod +x infrastructure/scripts/update-frontend-config.sh
./infrastructure/scripts/update-frontend-config.sh tendervault us-east-1
cd frontend
npm run build
```

### 5. Access the App

The deploy script outputs the CloudFront URL. Open it and log in with any test user.

## Project Structure

```
TenderVault/
├── docs/
│   ├── PRD.md                    # Product Requirements Document
│   ├── DESIGN.md                 # Technical Design Document
│   └── TASKS.md                  # Engineering Task Breakdown
├── backend/
│   ├── shared/                   # Shared utilities
│   │   ├── db.mjs                # DynamoDB helpers
│   │   ├── s3.mjs                # S3 + pre-signed URL helpers
│   │   ├── audit.mjs             # Audit logging (never throws)
│   │   ├── errors.mjs            # Error handling utilities
│   │   └── validate.mjs          # Input validation
│   ├── functions/                # Lambda handlers
│   │   ├── authorizer/           # JWT verification
│   │   ├── create-tender/        # POST /tenders
│   │   ├── list-tenders/         # GET /tenders
│   │   ├── get-tender/           # GET /tenders/{id}
│   │   ├── generate-upload-url/  # POST /tenders/{id}/bids/upload-url
│   │   ├── confirm-upload/       # S3 trigger
│   │   ├── generate-download-url/# GET (TIME-LOCKED)
│   │   ├── list-bids/            # GET /tenders/{id}/bids
│   │   ├── list-versions/        # GET versions
│   │   ├── restore-version/      # POST restore
│   │   └── list-audit-logs/      # GET /audit-logs
│   └── tests/                    # Jest unit tests
├── frontend/
│   └── src/
│       ├── services/             # Auth, API, Types
│       ├── components/           # React components
│       └── pages/                # Page components
├── infrastructure/
│   ├── template.yaml             # SAM template (complete stack)
│   └── scripts/                  # Deployment scripts
└── .github/workflows/deploy.yml  # CI/CD pipeline
```

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/tenders` | tv-admin | Create tender |
| GET | `/tenders` | All | List tenders (role-filtered) |
| GET | `/tenders/{id}` | All | Get tender details |
| POST | `/tenders/{id}/bids/upload-url` | tv-bidder | Get pre-signed upload URL |
| GET | `/tenders/{id}/bids` | tv-admin, tv-evaluator | List bids (time-locked) |
| GET | `/tenders/{id}/bids/{bid}/download-url` | tv-admin, tv-evaluator | Get download URL (**423 if locked**) |
| GET | `/tenders/{id}/bids/{bid}/versions` | tv-admin | List bid versions |
| POST | `/tenders/{id}/bids/{bid}/restore` | tv-admin | Restore a version |
| GET | `/audit-logs` | tv-admin | Query audit trail |

## Security Highlights

- **Time-Lock:** Bid downloads return `423 Locked` with `secondsRemaining` until deadline passes
- **Encryption:** S3 SSE-S3 (AES-256), HTTPS-only, bucket policies deny unencrypted uploads
- **Versioning:** Full S3 version history, admin-only restore capability
- **Audit:** Every action logged to DynamoDB with TTL, GSIs for compliance queries
- **Auth:** Cognito JWT with Lambda authorizer, role-based access on every endpoint

## Testing

```bash
cd backend
npm test                 # Run all unit tests
npm run test:coverage    # With coverage report
```

## CI/CD

Push to `main` triggers the GitHub Actions pipeline:
1. **Test:** Install deps, run backend tests, build frontend
2. **Deploy Backend:** `sam build` + `sam deploy`
3. **Deploy Frontend:** Build with stack outputs → S3 sync → CloudFront invalidation

## License

Proprietary — Government procurement use only.
