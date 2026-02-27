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
