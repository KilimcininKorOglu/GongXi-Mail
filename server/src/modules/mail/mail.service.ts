import { emailService } from '../email/email.service.js';
import { poolService } from './pool.service.js';
import { AppError } from '../../plugins/error.js';
import { logger } from '../../lib/logger.js';
import { setCache, getCache } from '../../lib/redis.js';
import { proxyFetch } from '../../lib/proxy.js';
import prisma from '../../lib/prisma.js';
import type { MailRequestInput } from './mail.schema.js';
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

interface Credentials {
    id: number;
    email: string;
    clientId: string;
    refreshToken: string;
    autoAssigned: boolean;
}

interface EmailMessage {
    id: string;
    from: string;
    subject: string;
    text: string;
    html: string;
    date: string;
}

export const mailService = {
    /**
     * Resolve credentials
     */
    async resolveCredentials(
        input: MailRequestInput,
        apiKeyId?: number
    ): Promise<Credentials> {
        const { email, auto } = input;

        // Auto assignment mode
        if (!email && auto) {
            if (!apiKeyId) {
                throw new AppError('AUTH_REQUIRED', 'Auto assignment requires API Key authentication', 400);
            }

            const account = await poolService.getUnusedEmail(apiKeyId);
            if (!account) {
                const stats = await poolService.getStats(apiKeyId);
                throw new AppError(
                    'NO_UNUSED_EMAIL',
                    `No unused emails available. Used: ${stats.used}/${stats.total}`,
                    400
                );
            }

            return { ...account, autoAssigned: true };
        }

        // Must provide email
        if (!email) {
            throw new AppError('EMAIL_REQUIRED', 'Email is required. Set auto=true to auto-assign.', 400);
        }

        // Query from database
        const account = await emailService.getByEmail(email);
        if (!account) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        return { ...account, autoAssigned: false };
    },

    /**
     * Update email status
     */
    async updateEmailStatus(emailId: number, success: boolean, errorMessage?: string) {
        await emailService.updateStatus(
            emailId,
            success ? 'ACTIVE' : 'ERROR',
            errorMessage
        );
    },

    /**
     * Log API call
     */
    async logApiCall(
        action: string,
        apiKeyId: number | undefined,
        emailAccountId: number | undefined,
        requestIp: string,
        responseCode: number,
        responseTimeMs: number
    ) {
        try {
            await prisma.apiLog.create({
                data: {
                    action,
                    apiKeyId,
                    emailAccountId,
                    requestIp,
                    responseCode,
                    responseTimeMs,
                },
            });
        } catch (err) {
            logger.error({ err }, 'Failed to log API call');
        }
    },

    /**
     * Get Microsoft Graph API Access Token
     */
    async getGraphAccessToken(
        credentials: Credentials,
        proxyConfig?: { socks5?: string; http?: string }
    ): Promise<{ accessToken: string; hasMailRead: boolean } | null> {
        const cacheKey = `graph_api_access_token_${credentials.email}`;

        // Try to get from cache (cached token always has Mail.Read permission)
        const cachedToken = await getCache(cacheKey);
        if (cachedToken) {
            logger.debug({ email: credentials.email }, 'Using cached Graph API token');
            return { accessToken: cachedToken, hasMailRead: true };
        }

        try {
            const response = await proxyFetch(
                'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: credentials.clientId,
                        grant_type: 'refresh_token',
                        refresh_token: credentials.refreshToken,
                        scope: 'https://graph.microsoft.com/.default',
                    }).toString(),
                },
                proxyConfig
            );

            if (!response.ok) {
                const errorText = await response.text();
                logger.error({ email: credentials.email, status: response.status, error: errorText }, 'Graph API token request failed');
                return null;
            }

            const data: any = await response.json();

            // Check if has mail read permission
            const hasMailRead = data.scope && data.scope.includes('https://graph.microsoft.com/Mail.Read');

            if (hasMailRead) {
                // Only cache when has Mail.Read permission
                const expireTime = (data.expires_in || 3600) - 60;
                await setCache(cacheKey, data.access_token, expireTime);
            } else {
                logger.warn({ email: credentials.email }, 'No Mail.Read scope in token, will fallback to IMAP');
            }

            return { accessToken: data.access_token, hasMailRead };
        } catch (err) {
            logger.error({ err, email: credentials.email }, 'Failed to get Graph API token');
            return null;
        }
    },

    /**
     * Get emails via Graph API
     */
    async getEmailsViaGraphApi(
        accessToken: string,
        mailbox: string,
        limit: number = 100,
        proxyConfig?: { socks5?: string; http?: string }
    ): Promise<EmailMessage[]> {
        // Convert mailbox name
        let folder = 'inbox';
        if (mailbox?.toLowerCase() === 'junk') {
            folder = 'junkemail';
        } else if (mailbox?.toLowerCase() === 'inbox') {
            folder = 'inbox';
        }

        try {
            const response = await proxyFetch(
                `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${limit}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
                proxyConfig
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Graph API error: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            const emails = data.value || [];

            return emails.map((item: any) => ({
                id: item.id,
                from: item.from?.emailAddress?.address || '',
                subject: item.subject || '',
                text: item.bodyPreview || '',
                html: item.body?.content || '',
                date: item.createdDateTime || '',
            }));
        } catch (err) {
            logger.error({ err }, 'Failed to fetch emails via Graph API');
            throw err;
        }
    },

    /**
     * Get IMAP Access Token (without scope)
     */
    async getImapAccessToken(
        credentials: Credentials,
        proxyConfig?: { socks5?: string; http?: string }
    ): Promise<string | null> {
        const cacheKey = `imap_api_access_token_${credentials.email}`;

        const cachedToken = await getCache(cacheKey);
        if (cachedToken) {
            logger.debug({ email: credentials.email }, 'Using cached IMAP token');
            return cachedToken;
        }

        try {
            const response = await proxyFetch(
                'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: credentials.clientId,
                        grant_type: 'refresh_token',
                        refresh_token: credentials.refreshToken,
                        // Note: IMAP doesn't need scope
                    }).toString(),
                },
                proxyConfig
            );

            if (!response.ok) {
                const errorText = await response.text();
                logger.error({ email: credentials.email, status: response.status, error: errorText }, 'IMAP token request failed');
                return null;
            }

            const data: any = await response.json();

            const expireTime = (data.expires_in || 3600) - 60;
            await setCache(cacheKey, data.access_token, expireTime);

            return data.access_token;
        } catch (err) {
            logger.error({ err, email: credentials.email }, 'Failed to get IMAP token');
            return null;
        }
    },

    /**
     * Generate IMAP XOAUTH2 authentication string
     */
    generateAuthString(email: string, accessToken: string): string {
        const authString = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
        return Buffer.from(authString).toString('base64');
    },

    /**
     * Get emails via IMAP
     */
    async getEmailsViaImap(
        email: string,
        authString: string,
        mailbox: string = 'INBOX',
        limit: number = 100
    ): Promise<EmailMessage[]> {
        return new Promise((resolve, reject) => {
            const imap = new Imap({
                user: email,
                xoauth2: authString,
                host: 'outlook.office365.com',
                port: 993,
                tls: true,
                tlsOptions: {
                    rejectUnauthorized: false
                }
            } as any);

            const emailList: EmailMessage[] = [];
            let messageCount = 0;
            let processedCount = 0;

            imap.once('ready', async () => {
                try {
                    await new Promise<void>((res, rej) => {
                        imap.openBox(mailbox, true, (err) => {
                            if (err) return rej(err);
                            res();
                        });
                    });

                    imap.search(['ALL'], (err: Error | null, results: number[]) => {
                        if (err) {
                            imap.end();
                            return reject(err);
                        }

                        if (!results || results.length === 0) {
                            imap.end();
                            return resolve([]);
                        }

                        // Limit return count
                        const limitedResults = results.slice(-limit);
                        messageCount = limitedResults.length;

                        const f = imap.fetch(limitedResults, { bodies: '' });

                        f.on('message', (msg: any) => {
                            msg.on('body', (stream: any) => {
                                simpleParser(stream as any)
                                    .then((mail: any) => {
                                        emailList.push({
                                            id: `imap_${Date.now()}_${processedCount}`,
                                            from: mail.from?.text || '',
                                            subject: mail.subject || '',
                                            text: mail.text || '',
                                            html: mail.html || '',
                                            date: mail.date?.toISOString() || '',
                                        });
                                    })
                                    .catch((parseErr: Error) => {
                                        logger.error({ parseErr }, 'Error parsing email');
                                    })
                                    .finally(() => {
                                        processedCount++;
                                        if (processedCount === messageCount) {
                                            imap.end();
                                        }
                                    });
                            });
                        });

                        f.once('error', (fetchErr: Error) => {
                            logger.error({ fetchErr }, 'IMAP fetch error');
                            imap.end();
                            reject(fetchErr);
                        });

                        f.once('end', () => {
                            // If no messages, end directly
                            if (messageCount === 0) {
                                imap.end();
                            }
                        });
                    });
                } catch (err) {
                    imap.end();
                    reject(err);
                }
            });

            imap.once('error', (err: Error) => {
                logger.error({ err }, 'IMAP connection error');
                reject(err);
            });

            imap.once('end', () => {
                logger.debug({ email }, 'IMAP connection ended');
                resolve(emailList);
            });

            imap.connect();
        });
    },

    /**
     * Get emails (main entry) - supports Graph API with IMAP fallback
     */
    async getEmails(
        credentials: Credentials,
        options: { mailbox: string; limit?: number; socks5?: string; http?: string }
    ) {
        const proxyConfig = { socks5: options.socks5, http: options.http };

        // 1. Try Graph API
        const tokenResult = await this.getGraphAccessToken(credentials, proxyConfig);

        if (tokenResult && tokenResult.hasMailRead) {
            // Graph API has permission, use Graph API
            logger.info({ email: credentials.email }, 'Using Graph API for email retrieval');
            try {
                const messages = await this.getEmailsViaGraphApi(
                    tokenResult.accessToken,
                    options.mailbox,
                    options.limit || 100,
                    proxyConfig
                );

                return {
                    email: credentials.email,
                    mailbox: options.mailbox,
                    count: messages.length,
                    messages,
                    method: 'graph_api',
                };
            } catch (graphErr) {
                logger.warn({ graphErr, email: credentials.email }, 'Graph API failed, trying IMAP fallback');
            }
        }

        // 2. Fallback to IMAP
        logger.info({ email: credentials.email }, 'Using IMAP fallback for email retrieval');
        const imapToken = await this.getImapAccessToken(credentials, proxyConfig);

        if (!imapToken) {
            throw new AppError('IMAP_TOKEN_FAILED', 'Failed to get IMAP access token', 500);
        }

        const authString = this.generateAuthString(credentials.email, imapToken);
        const messages = await this.getEmailsViaImap(
            credentials.email,
            authString,
            options.mailbox,
            options.limit || 100
        );

        return {
            email: credentials.email,
            mailbox: options.mailbox,
            count: messages.length,
            messages,
            method: 'imap',
        };
    },

    /**
     * Clear mailbox (delete all emails via Graph API)
     */
    async processMailbox(
        credentials: Credentials,
        options: { mailbox: string; socks5?: string; http?: string }
    ) {
        logger.info({ email: credentials.email, mailbox: options.mailbox }, 'Processing mailbox via Graph API');

        const proxyConfig = { socks5: options.socks5, http: options.http };
        const tokenResult = await this.getGraphAccessToken(credentials, proxyConfig);

        if (!tokenResult) {
            throw new AppError('GRAPH_API_FAILED', 'Failed to get access token', 500);
        }

        // 1. Get all email IDs
        let page = 0;
        let deletedCount = 0;
        let hasMore = true;

        try {
            while (hasMore && page < 10) { // Limit max pages to prevent timeout
                const messages = await this.getEmailsViaGraphApi(
                    tokenResult.accessToken,
                    options.mailbox,
                    500, // Get 500 each time
                    proxyConfig
                );

                if (messages.length === 0) {
                    hasMore = false;
                    break;
                }

                // 2. Batch delete (Graph API doesn't support batch delete, can only delete one by one concurrently)
                // Limit concurrency to 10
                const batchSize = 10;
                for (let i = 0; i < messages.length; i += batchSize) {
                    const chunk = messages.slice(i, i + batchSize);
                    await Promise.all(chunk.map(msg =>
                        this.deleteMessageViaGraphApi(tokenResult.accessToken, (msg as any).id, proxyConfig)
                    ));
                    deletedCount += chunk.length;
                }

                page++;
            }

            return {
                email: credentials.email,
                mailbox: options.mailbox,
                message: `Successfully deleted ${deletedCount} messages`,
                status: 'success',
                deletedCount,
            };

        } catch (err: any) {
            logger.error({ err, email: credentials.email }, 'Error processing mailbox');
            return {
                email: credentials.email,
                mailbox: options.mailbox,
                message: `Partial success or error: ${err.message}`,
                status: 'error',
                deletedCount,
            };
        }
    },

    /**
     * Delete single email
     */
    async deleteMessageViaGraphApi(
        accessToken: string,
        messageId: string,
        proxyConfig?: { socks5?: string; http?: string }
    ) {
        try {
            await proxyFetch(
                `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                },
                proxyConfig
            );
        } catch (err) {
            // Ignore delete errors, continue to next
            logger.warn({ messageId }, 'Failed to delete message');
        }
    },
};
