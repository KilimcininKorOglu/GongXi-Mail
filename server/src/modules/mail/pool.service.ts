import prisma from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { AppError } from '../../plugins/error.js';

export const poolService = {
    /**
     * Get email not used by this API Key
     */
    async getUnusedEmail(apiKeyId: number) {
        // Use transaction or retry logic handled at route layer for concurrency
        // Here we just return an apparently available email
        const email = await prisma.emailAccount.findFirst({
            where: {
                status: 'ACTIVE',
                NOT: {
                    usages: {
                        some: { apiKeyId },
                    },
                },
            },
            select: {
                id: true,
                email: true,
                clientId: true,
                refreshToken: true,
            },
            orderBy: { id: 'asc' },
        });

        if (!email) {
            return null;
        }

        return {
            ...email,
            refreshToken: decrypt(email.refreshToken),
        };
    },

    /**
     * Mark email as used, throw exception if duplicate due to concurrency
     */
    async markUsed(apiKeyId: number, emailAccountId: number) {
        // Check if already "grabbed" by another API Key (if business logic requires global uniqueness)
        // But current logic is: one API Key cannot reuse the same email, different API Keys can share the same email (if pool is shared)
        // According to "used emails won't be auto-assigned to the same API Key again", the pool is shared but isolated via usage table
        // So the only conflict here is: concurrent requests from the same API Key may try to allocate the same email

        try {
            await prisma.emailUsage.create({
                data: { apiKeyId, emailAccountId, usedAt: new Date() },
            });
        } catch (error: any) {
            // P2002: Unique constraint failed
            if (error.code === 'P2002') {
                throw new AppError('ALREADY_USED', 'Email already allocated to this API Key', 409);
            }
            throw error;
        }
    },

    /**
     * Check if API Key has ownership of this email
     */
    async checkOwnership(apiKeyId: number, emailAddress: string) {
        const email = await prisma.emailAccount.findUnique({
            where: { email: emailAddress },
            include: {
                usages: {
                    where: { apiKeyId },
                },
            },
        });

        if (!email) {
            throw new AppError('EMAIL_NOT_FOUND', 'Email account not found', 404);
        }

        if (email.usages.length === 0) {
            return false;
        }

        return true;
    },

    /**
     * Get list of emails allocated to this API Key
     */
    async getAllocatedEmails(apiKeyId: number) {
        const usages = await prisma.emailUsage.findMany({
            where: { apiKeyId },
            include: {
                emailAccount: {
                    select: {
                        id: true,
                        email: true,
                        status: true,
                    },
                },
            },
        });

        return usages.map(u => ({
            email: u.emailAccount.email,
            status: u.emailAccount.status,
            allocatedAt: u.usedAt,
        }));
    },

    /**
     * Get usage statistics
     */
    async getStats(apiKeyId: number) {
        const [total, used] = await Promise.all([
            prisma.emailAccount.count({ where: { status: 'ACTIVE' } }),
            prisma.emailUsage.count({ where: { apiKeyId } }),
        ]);

        return { total, used, remaining: Math.max(0, total - used) };
    },

    /**
     * Reset usage records
     */
    async reset(apiKeyId: number) {
        await prisma.emailUsage.deleteMany({ where: { apiKeyId } });
        return { success: true };
    },

    /**
     * Get all emails with usage status (for Admin)
     */
    async getEmailsWithUsage(apiKeyId: number) {
        const [emails, usedIds] = await Promise.all([
            prisma.emailAccount.findMany({
                where: { status: 'ACTIVE' },
                select: { id: true, email: true },
                orderBy: { id: 'asc' },
            }),
            prisma.emailUsage.findMany({
                where: { apiKeyId },
                select: { emailAccountId: true },
            }),
        ]);

        const usedSet = new Set(usedIds.map(u => u.emailAccountId));

        return emails.map(e => ({
            id: e.id,
            email: e.email,
            used: usedSet.has(e.id),
        }));
    },

    /**
     * Update email usage status (for Admin)
     */
    async updateEmailUsage(apiKeyId: number, emailIds: number[]) {
        // Delete all existing records
        await prisma.emailUsage.deleteMany({ where: { apiKeyId } });

        // Create new records
        if (emailIds.length > 0) {
            await prisma.emailUsage.createMany({
                data: emailIds.map(emailAccountId => ({
                    apiKeyId,
                    emailAccountId,
                })),
                skipDuplicates: true,
            });
        }

        return { success: true, count: emailIds.length };
    },
};
