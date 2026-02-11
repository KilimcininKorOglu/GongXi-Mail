import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { AppError } from '../../plugins/error.js';
import type { CreateEmailInput, UpdateEmailInput, ListEmailInput, ImportEmailInput } from './email.schema.js';

export const emailService = {
    /**
     * Get email list
     */
    async list(input: ListEmailInput) {
        const { page, pageSize, status, keyword } = input;
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (status) where.status = status;
        if (keyword) {
            where.email = { contains: keyword };
        }

        const [list, total] = await Promise.all([
            prisma.emailAccount.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    clientId: true,
                    status: true,
                    lastCheckAt: true,
                    errorMessage: true,
                    createdAt: true,
                },
                skip,
                take: pageSize,
                orderBy: { id: 'desc' },
            }),
            prisma.emailAccount.count({ where }),
        ]);

        return { list, total, page, pageSize };
    },

    /**
     * Get email details
     */
    async getById(id: number, includeSecrets = false) {
        const email = await prisma.emailAccount.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                clientId: true,
                password: !!includeSecrets,
                refreshToken: !!includeSecrets,
                status: true,
                lastCheckAt: true,
                errorMessage: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!email) {
            throw new AppError('NOT_FOUND', 'Email account not found', 404);
        }

        // Decrypt sensitive information
        if (includeSecrets) {
            if (email.refreshToken) (email as any).refreshToken = decrypt(email.refreshToken);
            if (email.password) (email as any).password = decrypt(email.password);
        }

        return email;
    },

    /**
     * Get by email address (for external API)
     */
    async getByEmail(emailAddress: string) {
        const email = await prisma.emailAccount.findUnique({
            where: { email: emailAddress },
            select: {
                id: true,
                email: true,
                clientId: true,
                refreshToken: true,
                password: true,
                status: true,
            },
        });

        if (!email) {
            return null;
        }

        // Decrypt
        return {
            ...email,
            refreshToken: decrypt(email.refreshToken),
            password: email.password ? decrypt(email.password) : undefined,
        };
    },

    /**
     * Create email account
     */
    async create(input: CreateEmailInput) {
        const { email, clientId, refreshToken, password } = input;

        // Check if already exists
        const exists = await prisma.emailAccount.findUnique({ where: { email } });
        if (exists) {
            throw new AppError('DUPLICATE_EMAIL', 'Email already exists', 400);
        }

        // Encrypt sensitive information
        const encryptedToken = encrypt(refreshToken);
        const encryptedPassword = password ? encrypt(password) : null;

        const account = await prisma.emailAccount.create({
            data: {
                email,
                clientId,
                refreshToken: encryptedToken,
                password: encryptedPassword,
            },
            select: {
                id: true,
                email: true,
                clientId: true,
                status: true,
                createdAt: true,
            },
        });

        return account;
    },

    /**
     * Update email account
     */
    async update(id: number, input: UpdateEmailInput) {
        const exists = await prisma.emailAccount.findUnique({ where: { id } });
        if (!exists) {
            throw new AppError('NOT_FOUND', 'Email account not found', 404);
        }

        const updateData: any = { ...input };

        // Encrypt sensitive data
        if (input.refreshToken) {
            updateData.refreshToken = encrypt(input.refreshToken);
        }
        if (input.password) {
            updateData.password = encrypt(input.password);
        }

        const account = await prisma.emailAccount.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                clientId: true,
                status: true,
                updatedAt: true,
            },
        });

        return account;
    },

    /**
     * Update email status
     */
    async updateStatus(id: number, status: 'ACTIVE' | 'ERROR' | 'DISABLED', errorMessage?: string | null) {
        await prisma.emailAccount.update({
            where: { id },
            data: {
                status,
                errorMessage: errorMessage || null,
                lastCheckAt: new Date(),
            },
        });
    },

    /**
     * Delete email account
     */
    async delete(id: number) {
        const exists = await prisma.emailAccount.findUnique({ where: { id } });
        if (!exists) {
            throw new AppError('NOT_FOUND', 'Email account not found', 404);
        }

        await prisma.emailAccount.delete({ where: { id } });
        return { success: true };
    },

    /**
     * Batch delete
     */
    async batchDelete(ids: number[]) {
        await prisma.emailAccount.deleteMany({
            where: { id: { in: ids } },
        });
        return { deleted: ids.length };
    },

    /**
     * Batch import
     */
    async import(input: ImportEmailInput) {
        const { content, separator } = input;
        const lines = content.split('\n').filter(line => line.trim());

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const line of lines) {
            try {
                const parts = line.trim().split(separator);
                if (parts.length < 3) {
                    throw new Error('Invalid format');
                }

                let email, clientId, refreshToken, password;

                // Try to guess format
                // 1. email----password----clientId----refreshToken (4 columns)
                // 2. email----clientId----refreshToken (3 columns)
                // 3. email----clientId----uuid----info----refreshToken (5 columns)

                if (parts.length >= 5) {
                    // email----clientId----uuid----info----refreshToken
                    email = parts[0];
                    clientId = parts[1];
                    refreshToken = parts[4];
                    // This format usually has no password, or password is hidden in info? Not handling password for now
                } else if (parts.length === 4) {
                    // email----password----clientId----refreshToken
                    email = parts[0];
                    password = parts[1];
                    clientId = parts[2];
                    refreshToken = parts[3];
                } else {
                    // email----clientId----refreshToken
                    email = parts[0];
                    clientId = parts[1];
                    refreshToken = parts[2];
                }

                if (!email || !clientId || !refreshToken) {
                    throw new Error('Missing required fields');
                }

                const data: any = {
                    clientId,
                    refreshToken: encrypt(refreshToken),
                    status: 'ACTIVE',
                };
                if (password) data.password = encrypt(password);

                // Check if exists
                const exists = await prisma.emailAccount.findUnique({ where: { email } });
                if (exists) {
                    // Update
                    await prisma.emailAccount.update({
                        where: { email },
                        data,
                    });
                } else {
                    // Create
                    data.email = email;
                    await prisma.emailAccount.create({
                        data,
                    });
                }
                success++;
            } catch (err) {
                failed++;
                errors.push(`Line "${line.substring(0, 30)}...": ${(err as Error).message}`);
            }
        }

        return { success, failed, errors };
    },

    /**
     * Export
     */
    async export(ids?: number[], separator = '----') {
        const where = ids?.length ? { id: { in: ids } } : {};

        const accounts = await prisma.emailAccount.findMany({
            where,
            select: {
                email: true,
                clientId: true,
                refreshToken: true,
            },
        });

        const lines = accounts.map(acc => {
            const token = decrypt(acc.refreshToken);
            return `${acc.email}${separator}${acc.clientId}${separator}${token}`;
        });

        return lines.join('\n');
    },

    /**
     * Get statistics
     */
    async getStats() {
        const [total, active, error] = await Promise.all([
            prisma.emailAccount.count(),
            prisma.emailAccount.count({ where: { status: 'ACTIVE' } }),
            prisma.emailAccount.count({ where: { status: 'ERROR' } }),
        ]);

        return { total, active, error };
    },
};
