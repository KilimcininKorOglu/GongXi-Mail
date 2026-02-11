import { FastifyPluginAsync } from 'fastify';
import { mailService } from './mail.service.js';
import { poolService } from './pool.service.js';
import { emailService } from '../email/email.service.js';
import { z } from 'zod';
import { AppError } from '../../plugins/error.js';

// Mail request Schema
const mailRequestSchema = z.object({
    email: z.string().email(),
    mailbox: z.string().default('inbox'),
    socks5: z.string().optional(),
    http: z.string().optional(),
});

// Plain text mail request Schema
const mailTextRequestSchema = z.object({
    email: z.string().email(),
    match: z.string().optional(), // Regular expression (optional)
});

const mailRoutes: FastifyPluginAsync = async (fastify) => {
    // All routes require API Key authentication
    fastify.addHook('preHandler', fastify.authenticateApiKey);

    // ========================================
    // Get an unused email address (with retry mechanism)
    // ========================================
    fastify.all('/get-email', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        // Retry 3 times to prevent concurrency conflicts
        for (let i = 0; i < 3; i++) {
            const email = await poolService.getUnusedEmail(request.apiKey.id);
            if (!email) {
                // If not found on first try, or still not found after retry
                const stats = await poolService.getStats(request.apiKey.id);
                throw new AppError(
                    'NO_UNUSED_EMAIL',
                    `No unused emails available. Used: ${stats.used}/${stats.total}`,
                    400
                );
            }

            try {
                // Try to mark as used
                await poolService.markUsed(request.apiKey.id, email.id);
                return {
                    success: true,
                    data: {
                        email: email.email,
                        id: email.id,
                    },
                };
            } catch (err: any) {
                // If P2002 (Unique constraint failed), means grabbed by another request, continue retry
                if (err.code === 'ALREADY_USED') {
                    continue;
                }
                // Other errors throw directly
                throw err;
            }
        }

        // Failed after multiple retries
        throw new AppError('CONCURRENCY_LIMIT', 'System busy, please try again', 429);
    });

    // ========================================
    // Get latest email (must specify email)
    // ========================================
    fastify.all('/mail_new', async (request) => {
        const startTime = Date.now();
        const input = mailRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        // Find email
        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.getEmails(credentials, {
                mailbox: input.mailbox,
                limit: 1,
                socks5: input.socks5,
                http: input.http,
            });

            await mailService.updateEmailStatus(credentials.id, true);

            await mailService.logApiCall(
                'mail_new',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            return {
                success: true,
                data: result,
                email: credentials.email,
            };
        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'mail_new',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            throw err;
        }
    });

    // ========================================
    // Get latest email plain text content (script-friendly)
    // ========================================
    fastify.all('/mail_text', async (request, reply) => {
        const startTime = Date.now();
        const input = mailTextRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            reply.code(401).type('text/plain').send('Error: API Key required');
            return;
        }

        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            reply.code(404).type('text/plain').send('Error: Email account not found');
            return;
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.getEmails(credentials, {
                mailbox: 'inbox',
                limit: 1, // Only get the latest one
            });

            await mailService.updateEmailStatus(credentials.id, true);
            await mailService.logApiCall(
                'mail_text',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            if (!result.messages || result.messages.length === 0) {
                reply.type('text/plain').send('Error: No messages found');
                return;
            }

            const message = result.messages[0];
            // Prefer using text field
            let content = message.text || '';

            // If regex match is specified
            if (input.match) {
                try {
                    const regex = new RegExp(input.match);
                    const match = content.match(regex);
                    if (match) {
                        // If there are capture groups, return the first capture group; otherwise return the entire match
                        content = match[1] || match[0];
                    } else {
                        reply.code(404).type('text/plain').send('Error: No match found');
                        return;
                    }
                } catch (e) {
                    reply.code(400).type('text/plain').send('Error: Invalid regex pattern');
                    return;
                }
            }

            return reply.type('text/plain').send(content);

        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'mail_text',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            reply.code(500).type('text/plain').send(`Error: ${err.message}`);
        }
    });

    // ========================================
    // Get all emails (must specify email)
    // ========================================
    fastify.all('/mail_all', async (request) => {
        const startTime = Date.now();
        const input = mailRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.getEmails(credentials, {
                mailbox: input.mailbox,
                socks5: input.socks5,
                http: input.http,
            });

            await mailService.updateEmailStatus(credentials.id, true);

            await mailService.logApiCall(
                'mail_all',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            return {
                success: true,
                data: result,
                email: credentials.email,
            };
        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'mail_all',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            throw err;
        }
    });

    // ========================================
    // Clear mailbox (must specify email)
    // ========================================
    fastify.all('/process-mailbox', async (request) => {
        const startTime = Date.now();
        const input = mailRequestSchema.parse(
            request.method === 'GET' ? request.query : request.body
        );

        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        const emailAccount = await emailService.getByEmail(input.email);
        if (!emailAccount) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        const credentials = {
            id: emailAccount.id,
            email: emailAccount.email,
            clientId: emailAccount.clientId,
            refreshToken: emailAccount.refreshToken!,
            autoAssigned: false,
        };

        try {
            const result = await mailService.processMailbox(credentials, {
                mailbox: input.mailbox,
                socks5: input.socks5,
                http: input.http,
            });

            await mailService.updateEmailStatus(credentials.id, true);

            await mailService.logApiCall(
                'process_mailbox',
                request.apiKey.id,
                credentials.id,
                request.ip,
                200,
                Date.now() - startTime
            );

            return {
                success: true,
                data: result,
                email: credentials.email,
            };
        } catch (err: any) {
            await mailService.updateEmailStatus(credentials.id, false, err.message);
            await mailService.logApiCall(
                'process_mailbox',
                request.apiKey.id,
                credentials.id,
                request.ip,
                500,
                Date.now() - startTime
            );
            throw err;
        }
    });

    // ========================================
    // List all ACTIVE emails in system
    // ========================================
    fastify.all('/list-emails', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }

        // Return all active emails in the system
        const result = await emailService.list({ page: 1, pageSize: 1000, status: 'ACTIVE' });
        const emails = result.list.map(e => ({ email: e.email, status: e.status }));

        return {
            success: true,
            data: {
                total: result.total,
                emails: emails
            }
        };
    });

    // ========================================
    // Email pool statistics
    // ========================================
    fastify.all('/pool-stats', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }
        const stats = await poolService.getStats(request.apiKey.id);
        return { success: true, data: stats };
    });

    // ========================================
    // Reset email pool
    // ========================================
    fastify.all('/reset-pool', async (request) => {
        if (!request.apiKey?.id) {
            throw new AppError('AUTH_REQUIRED', 'API Key required', 401);
        }
        await poolService.reset(request.apiKey.id);
        return { success: true, data: { message: 'Pool reset successfully' } };
    });
};

export default mailRoutes;
