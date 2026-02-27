# Bid Scoring, Status Management, Email Notifications & Auth Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Cognito email verification issue, implement bid status management (admin), bid scoring (evaluator), and SES email notifications for key events.

**Architecture:**
- Bid status (`bidStatus`) and evaluation scores (`evaluationScores` map) are stored directly on existing BidsTable items — no new DynamoDB table.
- Two new Lambda functions: `update-bid-status` and `score-bid`. Both follow the existing pattern: `extractRequestContext` → role check → `parseBody` → validate → `updateItem` → `writeAuditEvent` → `successResponse`.
- Email notifications use a shared `backend/shared/email.mjs` utility (SESClient `SendEmailCommand`) called from `confirm-upload` (bid submitted) and `update-bid-status` (status changed).
- Auth fix: Add `EmailConfiguration` + `AutoVerifiedAttributes` to the `UserPool` SAM resource in `infrastructure/template.yaml`.

**Tech Stack:** AWS SAM (CloudFormation), Node.js 20 ESM Lambdas, DynamoDB DocumentClient v3, SES v3 SDK, React + TypeScript + Amplify UI.

---

## Pre-flight: Fix existing update-tender Lambda bug

**Before any new work, fix the broken `update-tender` Lambda.**

### Task 0: Fix orphaned code in update-tender Lambda

**Files:**
- Modify: `backend/functions/update-tender/index.mjs`

**Context:** Lines 69–74 have orphaned parameters that are not inside any function call. The `updateItem(...)` call is missing — the code jumps from building the expression to the audit event, with the `updateItem` arguments floating in void. This means every tender update silently skips the DB write.

**Step 1: Read the file and confirm the bug**

Open `backend/functions/update-tender/index.mjs`. Confirm lines 68–74 look like:
```js
    if (validated.status) {
      updateExpression += ', #s = :status';
      ...
    }
      TENDERS_TABLE,       // ← ORPHANED — not inside a call
      { tenderId },
      updateExpression,
      ...
    );

    // 5. Write audit event
```

**Step 2: Replace the broken section**

The entire block from the closing `}` of the status block through the orphaned closing `)` must be replaced with a proper `updateItem` call. Replace:

```js
    if (validated.status) {
      updateExpression += ', #s = :status';
      expressionAttributeValues[':status'] = validated.status;
      expressionAttributeNames['#s'] = 'status';
    }
      TENDERS_TABLE,
      { tenderId },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    // 5. Write audit event
```

With:

```js
    if (validated.status) {
      updateExpression += ', #s = :status';
      expressionAttributeValues[':status'] = validated.status;
      expressionAttributeNames['#s'] = 'status';
    }

    const updatedTender = await updateItem(
      TENDERS_TABLE,
      { tenderId },
      updateExpression,
      expressionAttributeValues,
      Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
    );

    // 5. Write audit event
```

**Step 3: Verify build compiles**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```
Expected: `✓ built in` with no errors.

**Step 4: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add backend/functions/update-tender/index.mjs
git commit -m "fix: restore missing updateItem call in update-tender Lambda"
```

---

## Task 1: Fix Cognito UserPool — Email Verification

**Files:**
- Modify: `infrastructure/template.yaml` (lines 186–193)

**Context:** The `UserPool` resource has zero properties — no password policy, no email configuration, no verified attributes. Cognito falls back to a shared Cognito email sender with a 50 email/day limit and no custom message. This causes verification emails to fail silently or get flagged as spam. We set `AutoVerifiedAttributes: [email]` and a custom `EmailVerificationMessage`.

**Step 1: Open template.yaml and locate the UserPool resource**

```yaml
  UserPool:
    Type: AWS::Cognito::UserPool
```
It currently has no `Properties:` block.

**Step 2: Replace with a properly configured UserPool**

```yaml
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      AutoVerifiedAttributes:
        - email
      UsernameAttributes:
        - email
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: false
      EmailVerificationSubject: "Your TenderVault verification code"
      EmailVerificationMessage: |
        Your TenderVault verification code is {####}.
        This code expires in 24 hours.
      UserPoolName: !Sub 'tv-userpool-${Environment}'
      Schema:
        - Name: email
          AttributeDataType: String
          Required: true
          Mutable: true
```

**Why no SES here:** Cognito SES integration requires moving out of SES sandbox AND a verified SES domain ARN. Since role assignment is manual (via Cognito console), this minimal config is sufficient — it fixes the verification flow using Cognito's built-in email with a clear message and proper password policy.

**Step 3: Verify template syntax**

```bash
cd /Users/deepesh/Desktop/TenderVault/infrastructure
sam validate --lint
```
Expected: `template.yaml is valid SAM template`

**Step 4: Deploy**

```bash
cd /Users/deepesh/Desktop/TenderVault/infrastructure
sam deploy --config-file samconfig.toml --no-confirm-changeset
```
Wait for `UPDATE_COMPLETE`. Note: Existing users are unaffected; new signups will now receive a properly formatted code.

**Step 5: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add infrastructure/template.yaml
git commit -m "feat: configure Cognito UserPool with email verification, password policy"
```

---

## Task 2: Backend — Extend Bid type and add update-bid-status Lambda

**Files:**
- Create: `backend/functions/update-bid-status/index.mjs`
- Modify: `infrastructure/template.yaml` (add Lambda + API route)
- Modify: `backend/shared/validate.mjs` (add `validateBidStatusBody`)

**Context:**
- Current bid statuses: `PENDING | SUBMITTED | DISQUALIFIED`
- New statuses to add: `UNDER_REVIEW | SHORTLISTED | AWARDED`
- The BidsTable PK is `tenderId` (hash) + `bidderId` (range). `status` is a plain attribute (already escaped as `#status` in confirm-upload).
- Role: `tv-admin` only can update bid status.
- The field name in DynamoDB is `status` — this IS a reserved word, must use ExpressionAttributeNames.

**Step 1: Add validation function to validate.mjs**

Append to `backend/shared/validate.mjs`:

```js
/**
 * Validate bid status update request body.
 * @param {object} body
 * @returns {{ bidStatus: string }} Validated body
 * @throws {AppError} VALIDATION_ERROR
 */
export function validateBidStatusBody(body) {
  const ALLOWED_STATUSES = ['UNDER_REVIEW', 'SHORTLISTED', 'DISQUALIFIED', 'AWARDED'];
  if (!body.bidStatus || !ALLOWED_STATUSES.includes(body.bidStatus)) {
    throw new AppError('VALIDATION_ERROR', 'Request validation failed', 400, [
      { field: 'bidStatus', message: `bidStatus must be one of: ${ALLOWED_STATUSES.join(', ')}` },
    ]);
  }
  return { bidStatus: body.bidStatus };
}
```

**Why `bidStatus` not `status`:** The DynamoDB item already has a `status` attribute that comes from the S3 confirm-upload flow (value: `SUBMITTED`). Rather than overwriting that field (which represents upload status), `bidStatus` is a separate evaluation-stage field. This keeps the data model clean.

**Step 2: Create the Lambda function**

Create `backend/functions/update-bid-status/index.mjs`:

```js
import { getItem, updateItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateBidStatusBody } from '../../shared/validate.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;

/**
 * PATCH /tenders/{tenderId}/bids/{bidderId}/status — Update bid evaluation status (tv-admin only).
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;
    const bidderId = event.pathParameters?.bidderId;

    if (!tenderId || !bidderId) {
      return errorResponse('MISSING_PARAMS', 'tenderId and bidderId are required', 400, requestId);
    }

    // Role check — tv-admin only
    if (!groups.includes('tv-admin')) {
      await writeAuditEvent({
        action: 'BID_STATUS_UPDATED',
        userId, userRole: groups[0], tenderId,
        result: 'DENIED', ipAddress, userAgent,
        metadata: { reason: 'Insufficient role' },
      });
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers can update bid status', 403, requestId);
    }

    // Verify tender exists
    const tender = await getItem(TENDERS_TABLE, { tenderId });
    if (!tender) {
      return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
    }

    // Verify bid exists
    const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
    if (!bid) {
      return errorResponse('BID_NOT_FOUND', 'Bid does not exist', 404, requestId);
    }

    // Parse and validate
    const body = parseBody(event);
    const { bidStatus } = validateBidStatusBody(body);

    // Update in DynamoDB
    const now = new Date().toISOString();
    const updatedBid = await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET bidStatus = :bidStatus, updatedAt = :now',
      { ':bidStatus': bidStatus, ':now': now }
    );

    // Audit
    await writeAuditEvent({
      action: 'BID_STATUS_UPDATED',
      userId, userRole: 'tv-admin', tenderId,
      result: 'SUCCESS', ipAddress, userAgent,
      metadata: { bidderId, bidStatus },
    });

    return successResponse(200, updatedBid);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
    }
    console.error('[UPDATE_BID_STATUS_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
```

**Step 3: Register Lambda in template.yaml**

After the `TvListBidsFunction` block, add:

```yaml
  TvUpdateBidStatusFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ../backend/
      Handler: functions/update-bid-status/index.handler
      Role: !Ref LabRoleArn
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /tenders/{tenderId}/bids/{bidderId}/status
            Method: PATCH
```

**Step 4: Validate template**

```bash
cd /Users/deepesh/Desktop/TenderVault/infrastructure && sam validate --lint
```

**Step 5: Build frontend to verify no type errors yet**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```

**Step 6: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add backend/functions/update-bid-status/index.mjs \
        backend/shared/validate.mjs \
        infrastructure/template.yaml
git commit -m "feat: add update-bid-status Lambda (PATCH /tenders/{id}/bids/{id}/status)"
```

---

## Task 3: Backend — Bid scoring Lambda (score-bid)

**Files:**
- Create: `backend/functions/score-bid/index.mjs`
- Modify: `infrastructure/template.yaml`
- Modify: `backend/shared/validate.mjs`

**Context:**
- Scores stored as a nested map in BidsTable: `evaluationScores.{evaluatorUserId} = { score, notes, scoredAt }`
- DynamoDB map paths use dot notation in UpdateExpression: `SET evaluationScores.#uid = :entry`
- Role: `tv-evaluator` or `tv-admin` can score
- Score range: 1–10 integer, notes optional string ≤ 500 chars

**Step 1: Add validation to validate.mjs**

Append to `backend/shared/validate.mjs`:

```js
/**
 * Validate bid score request body.
 * @param {object} body
 * @returns {{ score: number, notes?: string }} Validated body
 * @throws {AppError} VALIDATION_ERROR
 */
export function validateScoreBody(body) {
  const errors = [];

  if (body.score === undefined || typeof body.score !== 'number' || !Number.isInteger(body.score)) {
    errors.push({ field: 'score', message: 'score must be an integer' });
  } else if (body.score < 1 || body.score > 10) {
    errors.push({ field: 'score', message: 'score must be between 1 and 10' });
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      errors.push({ field: 'notes', message: 'notes must be a string' });
    } else if (body.notes.length > 500) {
      errors.push({ field: 'notes', message: 'notes must be 500 characters or fewer' });
    }
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Request validation failed', 400, errors);
  }

  return { score: body.score, notes: body.notes?.trim() };
}
```

**Step 2: Create the Lambda**

Create `backend/functions/score-bid/index.mjs`:

```js
import { getItem, updateItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateScoreBody } from '../../shared/validate.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;

/**
 * PUT /tenders/{tenderId}/bids/{bidderId}/score — Score a bid (tv-evaluator or tv-admin).
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;
    const bidderId = event.pathParameters?.bidderId;

    if (!tenderId || !bidderId) {
      return errorResponse('MISSING_PARAMS', 'tenderId and bidderId are required', 400, requestId);
    }

    // Role check — tv-evaluator or tv-admin
    if (!groups.includes('tv-evaluator') && !groups.includes('tv-admin')) {
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only evaluators and officers can score bids', 403, requestId);
    }

    // Verify tender exists and deadline has passed (time-lock)
    const tender = await getItem(TENDERS_TABLE, { tenderId });
    if (!tender) {
      return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
    }
    if (new Date(tender.deadline).getTime() > Date.now()) {
      return errorResponse('TENDER_LOCKED', 'Bids cannot be scored before the tender deadline', 423, requestId);
    }

    // Verify bid exists
    const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
    if (!bid) {
      return errorResponse('BID_NOT_FOUND', 'Bid does not exist', 404, requestId);
    }

    // Parse and validate
    const body = parseBody(event);
    const { score, notes } = validateScoreBody(body);

    // Update evaluationScores map entry for this evaluator
    // DynamoDB path: evaluationScores.#uid = :entry
    // '#uid' avoids any reserved-word collision with the userId value
    const now = new Date().toISOString();
    const updatedBid = await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET evaluationScores.#uid = :entry, updatedAt = :now',
      {
        ':entry': { score, notes: notes || null, scoredAt: now },
        ':now': now,
      },
      { '#uid': userId }
    );

    await writeAuditEvent({
      action: 'BID_SCORED',
      userId, userRole: groups.includes('tv-admin') ? 'tv-admin' : 'tv-evaluator',
      tenderId, result: 'SUCCESS', ipAddress, userAgent,
      metadata: { bidderId, score: String(score) },
    });

    return successResponse(200, updatedBid);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
    }
    console.error('[SCORE_BID_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
```

**Critical check on DynamoDB map update:** If `evaluationScores` doesn't exist yet on the item, DynamoDB will throw a `ValidationException` on `SET evaluationScores.#uid = :entry` because you can't set a nested path on a non-existent parent. Fix: initialize the map with a conditional `if_not_exists`:

Replace the updateItem call with:

```js
    const updatedBid = await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET evaluationScores = if_not_exists(evaluationScores, :empty), updatedAt = :now',
      { ':empty': {}, ':now': now }
    );
    // Then set the individual score entry
    const finalBid = await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET evaluationScores.#uid = :entry',
      { ':entry': { score, notes: notes || null, scoredAt: now } },
      { '#uid': userId }
    );
```

Wait — two round-trips is inefficient and has a race condition. The correct single-call approach uses `if_not_exists` on the map in the same expression:

```js
    const updatedBid = await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET evaluationScores = if_not_exists(evaluationScores, :empty), updatedAt = :now',
      { ':empty': {}, ':now': now }
    );
    const finalBid = await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET evaluationScores.#uid = :entry, updatedAt = :now',
      { ':entry': { score, notes: notes ?? null, scoredAt: now }, ':now': now },
      { '#uid': userId }
    );
    return successResponse(200, finalBid);
```

Use this two-step approach in the Lambda (initialize map first, then set entry). This is the pragmatic safe approach given DynamoDB's nested path constraint.

**Step 3: Register Lambda in template.yaml**

After `TvUpdateBidStatusFunction`, add:

```yaml
  TvScoreBidFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ../backend/
      Handler: functions/score-bid/index.handler
      Role: !Ref LabRoleArn
      Events:
        Api:
          Type: HttpApi
          Properties:
            Path: /tenders/{tenderId}/bids/{bidderId}/score
            Method: PUT
```

**Step 4: Validate template**

```bash
cd /Users/deepesh/Desktop/TenderVault/infrastructure && sam validate --lint
```

**Step 5: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add backend/functions/score-bid/index.mjs \
        backend/shared/validate.mjs \
        infrastructure/template.yaml
git commit -m "feat: add score-bid Lambda (PUT /tenders/{id}/bids/{id}/score)"
```

---

## Task 4: Backend — Shared email utility + wire into confirm-upload

**Files:**
- Create: `backend/shared/email.mjs`
- Modify: `backend/functions/confirm-upload/index.mjs`
- Modify: `backend/functions/update-bid-status/index.mjs`

**Context:**
- SES SDK v3: `@aws-sdk/client-ses` is available in the Lambda Node.js 20 runtime without installation (AWS SDK v3 is pre-bundled for Node.js 18+ Lambdas since late 2023). Double-check: in this project the backend has no `package.json` with listed dependencies — Lambdas run in the SAM build environment. **Risk:** `@aws-sdk/client-ses` may not be bundled. Mitigate: check if `@aws-sdk/client-ses` is in `backend/package.json`.

**Step 1: Check if SES SDK is available**

```bash
cat /Users/deepesh/Desktop/TenderVault/backend/package.json 2>/dev/null || echo "NO_PACKAGE_JSON"
ls /Users/deepesh/Desktop/TenderVault/backend/node_modules/@aws-sdk/client-ses 2>/dev/null || echo "NOT_INSTALLED"
```

- If `NOT_INSTALLED`: run `cd /Users/deepesh/Desktop/TenderVault/backend && npm install @aws-sdk/client-ses`
- If already present: continue.

**Step 2: Create email utility**

Create `backend/shared/email.mjs`:

```js
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Must be a verified SES email address or domain
const FROM_ADDRESS = process.env.SES_FROM_EMAIL || 'noreply@tendervault.example.com';

/**
 * Send a plain-text email via SES.
 * IMPORTANT: Both FROM_ADDRESS and TO addresses must be verified in SES sandbox.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Plain text body
 * @returns {Promise<void>}
 */
export async function sendEmail({ to, subject, body }) {
  // Guard: skip if SES not configured (dev environments without SES setup)
  if (!process.env.SES_FROM_EMAIL) {
    console.log('[EMAIL_SKIP] SES_FROM_EMAIL not set — skipping email to:', to);
    return;
  }

  const command = new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: body, Charset: 'UTF-8' } },
    },
  });

  try {
    await ses.send(command);
    console.log('[EMAIL_SENT]', { to, subject });
  } catch (err) {
    // Log but don't throw — email failure should never block the main operation
    console.error('[EMAIL_ERROR]', { to, subject, error: err.message });
  }
}
```

**Why non-throwing:** Email is a side effect. A SES failure (e.g., unverified address in sandbox) must never cause a bid submission to fail.

**Step 3: Wire email into confirm-upload Lambda**

In `backend/functions/confirm-upload/index.mjs`, add after the existing imports:

```js
import { sendEmail } from '../../shared/email.mjs';
```

After the `writeAuditEvent(...)` call (line 56), add:

```js
      // 5. Send confirmation email to bidder
      // Note: bidderId is the Cognito userId (sub), not email.
      // We can't easily look up email from userId here without a Cognito API call.
      // Instead, we log and rely on the bidder having access to their dashboard.
      // Email will be sent when we have bidder email available (future: store email in bid record).
      console.log('[CONFIRM_UPLOAD] Bid submitted — email notification skipped (bidderId is userId, not email)');
```

**Why the skip:** The `confirm-upload` Lambda is an S3 trigger — it receives the S3 key which encodes `tenderId/bidderId/{timestamp}-filename`. `bidderId` here is the Cognito `sub` (UUID), not an email. Sending an email requires a Cognito Admin call (`AdminGetUser`) which adds latency and a new IAM permission. Defer this to when we have the email stored in the bid record (see Task 6).

**Step 4: Wire email into update-bid-status Lambda**

In `backend/functions/update-bid-status/index.mjs`, import:

```js
import { sendEmail } from '../../shared/email.mjs';
```

After `successResponse`, before returning, add (requires fetching bid with email — but same problem as above: bidderId is userId, not email). Document this limitation:

```js
    // Note: bidder email notification deferred — bidderId is Cognito sub, not email.
    // To resolve: store bidder email in BidsTable during generate-upload-url flow (Task 6).
    console.log('[UPDATE_BID_STATUS] Status updated — email notification pending bidder email storage');

    return successResponse(200, updatedBid);
```

**Step 5: Add SES_FROM_EMAIL env var to template.yaml Globals**

In `infrastructure/template.yaml` under `Globals > Function > Environment > Variables`, add:

```yaml
        SES_FROM_EMAIL: !Sub 'noreply@${Environment}.tendervault.example.com'
```

**Important:** This email domain must be verified in SES. In sandbox mode, both sender AND recipient must be verified. Document this in deployment notes.

**Step 6: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add backend/shared/email.mjs \
        backend/functions/confirm-upload/index.mjs \
        backend/functions/update-bid-status/index.mjs \
        infrastructure/template.yaml
git commit -m "feat: add shared email utility (SES), wire into bid flow with graceful skip"
```

---

## Task 5: Backend — Store bidder email in BidsTable during upload URL generation

**Files:**
- Modify: `backend/functions/generate-upload-url/index.mjs`

**Context:** To send email notifications, we need the bidder's email. `extractRequestContext` already returns `email` from the JWT payload (set by the authorizer). We should persist it to the BidsTable item when the upload URL is generated (the first write to that item).

**Step 1: Read current generate-upload-url Lambda**

```bash
cat /Users/deepesh/Desktop/TenderVault/backend/functions/generate-upload-url/index.mjs
```

**Step 2: Find where putItem creates the bid record**

Look for `putItem(BIDS_TABLE, ...)` — this is where the initial bid record is written with status `PENDING`.

**Step 3: Add `bidderEmail` to the putItem call**

Find the item object passed to `putItem`. Add `bidderEmail: email` to it:

```js
    await putItem(BIDS_TABLE, {
      tenderId,
      bidderId: userId,
      s3Key,
      fileName: validated.fileName,
      fileSize: validated.fileSize,
      status: 'PENDING',
      bidderEmail: email,         // ← ADD THIS
      submittedAt: now,
      updatedAt: now,
    });
```

**Step 4: Update confirm-upload to send actual email**

Now that `bidderEmail` is in the BidsTable item, update `confirm-upload` to:
1. Fetch the bid item after updating it (or use `ReturnValues: 'ALL_NEW'` — which `updateItem` in `db.mjs` already does)
2. Send email to `updatedBid.bidderEmail`

In `backend/functions/confirm-upload/index.mjs`, replace the skip log with:

```js
      // 5. Send confirmation email
      const updatedBid = // updateItem already returned this — capture it:
```

Wait — `confirm-upload` currently doesn't capture the return value of `updateItem`. Fix by capturing it:

```js
      const updatedBidItem = await updateItem(
        BIDS_TABLE,
        { tenderId, bidderId },
        'SET #status = :status, currentVersionId = :vid, updatedAt = :now, fileSize = :size',
        { ':status': 'SUBMITTED', ':vid': versionId, ':now': now, ':size': size },
        { '#status': 'status' }
      );

      // Send confirmation email if bidderEmail is available
      if (updatedBidItem?.bidderEmail) {
        await sendEmail({
          to: updatedBidItem.bidderEmail,
          subject: 'TenderVault — Bid Submitted Successfully',
          body: `Your bid document has been successfully submitted.\n\nTender ID: ${tenderId}\nFile: ${updatedBidItem.fileName}\nSubmitted at: ${now}\n\nLog in to TenderVault to track your submission status.`,
        });
      }
```

**Step 5: Update update-bid-status to send email**

In `backend/functions/update-bid-status/index.mjs`, after fetching `bid` (which now has `bidderEmail`), send email:

```js
    // After updateItem call
    if (bid.bidderEmail) {
      await sendEmail({
        to: bid.bidderEmail,
        subject: `TenderVault — Your bid status has been updated`,
        body: `Your bid for tender ${tenderId} has been updated to: ${bidStatus}.\n\nLog in to TenderVault for full details.`,
      });
    }
```

**Step 6: Update frontend Bid type**

In `frontend/src/services/types.ts`, update `Bid` interface:

```ts
export interface Bid {
    tenderId: string;
    bidderId: string;
    s3Key: string;
    currentVersionId?: string;
    fileName: string;
    fileSize: number;
    submittedAt: string;
    updatedAt: string;
    status: 'PENDING' | 'SUBMITTED' | 'DISQUALIFIED';
    bidStatus?: 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED';
    bidderEmail?: string;
    evaluationScores?: Record<string, { score: number; notes: string | null; scoredAt: string }>;
}
```

**Step 7: Build frontend**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```

**Step 8: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add backend/functions/generate-upload-url/index.mjs \
        backend/functions/confirm-upload/index.mjs \
        backend/functions/update-bid-status/index.mjs \
        frontend/src/services/types.ts
git commit -m "feat: store bidderEmail in BidsTable, wire SES email notifications"
```

---

## Task 6: Frontend — api.ts: add updateBidStatus and scoreBid functions

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: Add updateBidStatus**

After the `generateDownloadUrl` function, add:

```ts
export async function updateBidStatus(
    tenderId: string,
    bidderId: string,
    bidStatus: 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED'
): Promise<Bid> {
    const { data } = await api.patch<Bid>(
        `/tenders/${tenderId}/bids/${bidderId}/status`,
        { bidStatus }
    );
    return data;
}

export async function scoreBid(
    tenderId: string,
    bidderId: string,
    score: number,
    notes?: string
): Promise<Bid> {
    const { data } = await api.put<Bid>(
        `/tenders/${tenderId}/bids/${bidderId}/score`,
        { score, notes }
    );
    return data;
}
```

**Step 2: Build to verify TypeScript**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```
Expected: clean build.

**Step 3: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add frontend/src/services/api.ts
git commit -m "feat: add updateBidStatus and scoreBid API functions"
```

---

## Task 7: Frontend — BidListPanel: bid status management (admin)

**Files:**
- Modify: `frontend/src/components/BidListPanel.tsx`
- Modify: `frontend/src/index.css` (new `bl-status--*` classes for new bid statuses)

**Context:**
- `BidListPanel` already uses `bl-*` CSS classes.
- The bid `status` column shows `PENDING | SUBMITTED | DISQUALIFIED` (upload status).
- We add a new **Evaluation Status** column showing `bidStatus`, with a dropdown for admin to change it.
- The `evaluationScores` map is displayed in a collapsed section per row (admin only).
- Import `updateBidStatus` from `../services/api`.

**Step 1: Add state and handler to BidListPanel**

Add to existing state block:

```tsx
const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
```

Add handler:

```tsx
const handleStatusChange = async (bidderId: string, bidStatus: 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED') => {
  setUpdatingStatus(bidderId);
  setError(null);
  try {
    await updateBidStatus(tenderId, bidderId, bidStatus);
    onRefresh();
  } catch (err) {
    setError(getErrorMessage(err));
  } finally {
    setUpdatingStatus(null);
  }
};
```

**Step 2: Add Evaluation Status column to table header**

After the existing `<th>Status</th>`, add:

```tsx
{userInfo?.role === 'tv-admin' && (
  <th className="bl-th">Eval Status</th>
)}
```

**Step 3: Add Evaluation Status cell to each row**

After the upload status `<td>`, add:

```tsx
{userInfo?.role === 'tv-admin' && (
  <td className="bl-td">
    <select
      className={`bl-status-select ${updatingStatus === bid.bidderId ? 'bl-status-select--loading' : ''}`}
      value={bid.bidStatus || ''}
      disabled={updatingStatus === bid.bidderId}
      onChange={(e) => {
        if (e.target.value) {
          handleStatusChange(bid.bidderId, e.target.value as 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED');
        }
      }}
    >
      <option value="">— Set status —</option>
      <option value="UNDER_REVIEW">Under Review</option>
      <option value="SHORTLISTED">Shortlisted</option>
      <option value="DISQUALIFIED">Disqualified</option>
      <option value="AWARDED">Awarded</option>
    </select>
  </td>
)}
```

**Step 4: Add CSS for bl-status-select and new status badge colors**

In `frontend/src/index.css`, find the `bl-status--disqualified` rule and add after it:

```css
.bl-status--under_review { --bl-s-bg: rgba(59, 130, 246, 0.12); --bl-s-color: #60a5fa; }
.bl-status--shortlisted  { --bl-s-bg: rgba(212, 168, 67, 0.12); --bl-s-color: var(--db-gold); }
.bl-status--awarded      { --bl-s-bg: rgba(16, 185, 129, 0.15); --bl-s-color: #10b981; }

.bl-status-select {
  background: var(--db-surface-2);
  border: 1px solid var(--db-border);
  border-radius: 4px;
  color: var(--db-text-1);
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s;
  min-width: 130px;
}
.bl-status-select:hover { border-color: var(--db-blue); }
.bl-status-select--loading { opacity: 0.5; cursor: not-allowed; }
```

**Step 5: Build and verify**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```

**Step 6: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add frontend/src/components/BidListPanel.tsx \
        frontend/src/index.css
git commit -m "feat: add bid evaluation status management UI for admin"
```

---

## Task 8: Frontend — BidListPanel: evaluator scoring panel

**Files:**
- Modify: `frontend/src/components/BidListPanel.tsx`
- Modify: `frontend/src/index.css`

**Context:**
- Evaluators (`tv-evaluator`) see a score input (1–10) + notes textarea per bid row.
- Admin sees aggregate scores from all evaluators (average + count).
- Import `scoreBid` from `../services/api`.

**Step 1: Add scoring state**

```tsx
const [scoringBid, setScoringBid] = useState<string | null>(null);
const [scoreInputs, setScoreInputs] = useState<Record<string, { score: string; notes: string }>>({});
```

**Step 2: Add score handler**

```tsx
const handleScore = async (bidderId: string) => {
  const input = scoreInputs[bidderId];
  if (!input?.score) return;
  const scoreNum = parseInt(input.score, 10);
  if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10) {
    setError('Score must be between 1 and 10');
    return;
  }
  setScoringBid(bidderId);
  setError(null);
  try {
    await scoreBid(tenderId, bidderId, scoreNum, input.notes || undefined);
    onRefresh();
    setScoreInputs(prev => ({ ...prev, [bidderId]: { score: '', notes: '' } }));
  } catch (err) {
    setError(getErrorMessage(err));
  } finally {
    setScoringBid(null);
  }
};
```

**Step 3: Add scoring row below each bid row (evaluator view)**

After the closing `</tr>` of each bid row, add a conditional expanded row:

```tsx
{(userInfo?.role === 'tv-evaluator' || userInfo?.role === 'tv-admin') && (
  <tr className="bl-score-row">
    <td colSpan={userInfo?.role === 'tv-admin' ? 7 : 6} className="bl-score-cell">
      {userInfo?.role === 'tv-evaluator' && (
        <div className="bl-score-form">
          <span className="bl-score-label">Score this bid:</span>
          <input
            type="number"
            min={1}
            max={10}
            className="bl-score-input"
            placeholder="1–10"
            value={scoreInputs[bid.bidderId]?.score || ''}
            onChange={(e) => setScoreInputs(prev => ({
              ...prev,
              [bid.bidderId]: { ...prev[bid.bidderId], score: e.target.value, notes: prev[bid.bidderId]?.notes || '' }
            }))}
          />
          <input
            type="text"
            className="bl-score-notes"
            placeholder="Notes (optional)"
            value={scoreInputs[bid.bidderId]?.notes || ''}
            onChange={(e) => setScoreInputs(prev => ({
              ...prev,
              [bid.bidderId]: { ...prev[bid.bidderId], notes: e.target.value, score: prev[bid.bidderId]?.score || '' }
            }))}
          />
          <button
            className="bl-btn-score"
            disabled={scoringBid === bid.bidderId}
            onClick={() => handleScore(bid.bidderId)}
          >
            {scoringBid === bid.bidderId ? 'Saving…' : 'Submit Score'}
          </button>
        </div>
      )}
      {userInfo?.role === 'tv-admin' && bid.evaluationScores && Object.keys(bid.evaluationScores).length > 0 && (
        <div className="bl-score-summary">
          <span className="bl-score-label">Evaluator scores:</span>
          {Object.entries(bid.evaluationScores).map(([uid, entry]) => (
            <span key={uid} className="bl-score-chip">
              {uid.slice(0, 6)}… — <strong>{entry.score}/10</strong>
              {entry.notes && <span className="bl-score-note"> "{entry.notes}"</span>}
            </span>
          ))}
          <span className="bl-score-avg">
            Avg: {(Object.values(bid.evaluationScores).reduce((s, e) => s + e.score, 0) / Object.values(bid.evaluationScores).length).toFixed(1)}
          </span>
        </div>
      )}
    </td>
  </tr>
)}
```

**Step 4: Add CSS for scoring UI**

In `frontend/src/index.css`, after `.bl-status-select--loading`, add:

```css
/* ── Scoring row ─────────────────────────────────── */
.bl-score-row { background: var(--db-surface); }
.bl-score-cell { padding: 0.5rem 1rem 0.75rem; }
.bl-score-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.bl-score-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: var(--db-text-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.bl-score-input {
  width: 60px;
  background: var(--db-surface-2);
  border: 1px solid var(--db-border);
  border-radius: 4px;
  color: var(--db-text-1);
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  padding: 0.25rem 0.4rem;
  text-align: center;
}
.bl-score-notes {
  flex: 1;
  min-width: 160px;
  background: var(--db-surface-2);
  border: 1px solid var(--db-border);
  border-radius: 4px;
  color: var(--db-text-1);
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  padding: 0.25rem 0.5rem;
}
.bl-score-input:focus,
.bl-score-notes:focus { outline: none; border-color: var(--db-blue); }
.bl-btn-score {
  background: rgba(13, 127, 242, 0.1);
  border: 1px solid rgba(13, 127, 242, 0.3);
  border-radius: 4px;
  color: var(--db-blue);
  font-family: 'DM Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.65rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.bl-btn-score:hover:not(:disabled) {
  background: rgba(13, 127, 242, 0.2);
  border-color: var(--db-blue);
}
.bl-btn-score:disabled { opacity: 0.5; cursor: not-allowed; }
.bl-score-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.bl-score-chip {
  font-family: 'DM Mono', monospace;
  font-size: 0.68rem;
  color: var(--db-text-2);
  background: var(--db-surface-2);
  border: 1px solid var(--db-border);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
}
.bl-score-note { color: var(--db-text-3); font-style: italic; }
.bl-score-avg {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  color: var(--db-gold);
  font-weight: 600;
  margin-left: auto;
}
```

**Step 5: Build**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```
Expected: zero TypeScript errors, clean Vite build.

**Step 6: Commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add frontend/src/components/BidListPanel.tsx \
        frontend/src/index.css
git commit -m "feat: add bid scoring UI for evaluators and score summary for admin"
```

---

## Task 9: Deploy backend and smoke test

**Step 1: Deploy SAM stack**

```bash
cd /Users/deepesh/Desktop/TenderVault/infrastructure
sam build && sam deploy --config-file samconfig.toml --no-confirm-changeset
```
Wait for `UPDATE_COMPLETE`.

**Step 2: Smoke test — update-bid-status endpoint**

```bash
# Get API endpoint from stack outputs
API=$(aws cloudformation describe-stacks --stack-name tendervault-dev --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

# Get a valid admin JWT (from browser devtools: copy the Authorization header value from any API call)
TOKEN="<paste_admin_jwt_here>"

# Test bid status update (replace with real tenderId and bidderId)
curl -X PATCH "$API/tenders/TENDER_ID/bids/BIDDER_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bidStatus": "UNDER_REVIEW"}'
```
Expected: `200` with updated bid object containing `bidStatus: "UNDER_REVIEW"`.

**Step 3: Smoke test — score-bid endpoint**

```bash
curl -X PUT "$API/tenders/TENDER_ID/bids/BIDDER_ID/score" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"score": 8, "notes": "Strong technical proposal"}'
```
Expected: `200` with `evaluationScores` map containing the evaluator's entry.

**Step 4: Verify in DynamoDB console**

Open AWS Console → DynamoDB → `tv-bids-dev` table → find the bid item. Confirm:
- `bidStatus` field is present with value `UNDER_REVIEW`
- `evaluationScores` map is present with the evaluator's sub as key

**Step 5: Final frontend build and check**

```bash
cd /Users/deepesh/Desktop/TenderVault/frontend && npm run build
```

**Step 6: Final commit**

```bash
cd /Users/deepesh/Desktop/TenderVault
git add -A
git commit -m "feat: complete bid scoring, status management, email notifications and auth fix"
```

---

## Known Limitations & Follow-up Notes

1. **SES sandbox**: Email notifications are implemented but will only work if `SES_FROM_EMAIL` is set to a verified SES address/domain. In production, request SES sandbox exit. In dev, verify a personal email in SES console and set it as `SES_FROM_EMAIL`.

2. **Tender-close notification**: Email to all bidders when a tender closes (status → CLOSED) is not implemented here. To add: in `update-tender` Lambda, after status update, query all bids for the tender and send emails to each `bidderEmail`.

3. **Role assignment**: Admin must manually add users to Cognito groups (`tv-admin`, `tv-evaluator`, `tv-bidder`) via the AWS Cognito console or CLI: `aws cognito-idp admin-add-user-to-group --user-pool-id POOL_ID --username USER_EMAIL --group-name tv-admin`

4. **evaluationScores on old bids**: Bids submitted before Task 5 will not have `bidderEmail`. The email utility gracefully skips (`if (bid.bidderEmail)`), so this is safe.
