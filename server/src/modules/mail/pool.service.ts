import prisma from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { AppError } from '../../plugins/error.js';

export const poolService = {
    /**
     * 获取未被该 API Key 使用过的邮箱
     */
    async getUnusedEmail(apiKeyId: number) {
        // 使用事务或重试逻辑在通过路由层处理并发
        // 这里仅返回一个看似可用的邮箱
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
     * 标记邮箱已被使用，如果是并发导致的重复使用则抛出异常
     */
    async markUsed(apiKeyId: number, emailAccountId: number) {
        // 检查是否已被其他 API Key "抢占" (如果业务逻辑要求全局唯一)
        // 但目前逻辑是：一个 API Key 不能重复使用同一个邮箱，不同 API Key 可以共用同一个邮箱（如果池是共享的）
        // 根据 "使用过的邮箱不会再被自动分配给同一 API Key"，说明池是共享的，但通过 usage 表隔离
        // 所以这里唯一的冲突是：同一个 API Key 的并发请求可能会尝试分配同一个邮箱

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
     * 检查 API Key 是否拥有该邮箱的使用权
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
     * 获取已分配给该 API Key 的邮箱列表
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
     * 获取使用统计
     */
    async getStats(apiKeyId: number) {
        const [total, used] = await Promise.all([
            prisma.emailAccount.count({ where: { status: 'ACTIVE' } }),
            prisma.emailUsage.count({ where: { apiKeyId } }),
        ]);

        return { total, used, remaining: Math.max(0, total - used) };
    },

    /**
     * 重置使用记录
     */
    async reset(apiKeyId: number) {
        await prisma.emailUsage.deleteMany({ where: { apiKeyId } });
        return { success: true };
    },

    /**
     * 获取所有邮箱及其使用状态 (Admin 用)
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
     * 更新邮箱使用状态 (Admin 用)
     */
    async updateEmailUsage(apiKeyId: number, emailIds: number[]) {
        // 删除所有现有记录
        await prisma.emailUsage.deleteMany({ where: { apiKeyId } });

        // 创建新记录
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
