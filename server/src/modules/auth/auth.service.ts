import prisma from '../../lib/prisma.js';
import { signToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { AppError } from '../../plugins/error.js';
import type { LoginInput, ChangePasswordInput } from './auth.schema.js';

export const authService = {
    /**
     * Admin login
     */
    async login(input: LoginInput, ip?: string) {
        const { username, password } = input;

        // Query admin
        const admin = await prisma.admin.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                passwordHash: true,
                role: true,
                status: true,
            },
        });

        // Admin doesn't exist, check if it's the default admin
        if (!admin) {
            if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
                // If it's the default admin but doesn't exist in database, auto-create
                const passwordHash = await hashPassword(password);
                const newAdmin = await prisma.admin.create({
                    data: {
                        username,
                        passwordHash,
                        role: 'SUPER_ADMIN',
                        status: 'ACTIVE',
                    },
                });

                // Generate Token using newly created admin info
                const token = await signToken({
                    sub: newAdmin.id.toString(),
                    username: newAdmin.username,
                    role: newAdmin.role,
                });

                return {
                    token,
                    admin: {
                        id: newAdmin.id,
                        username: newAdmin.username,
                        role: newAdmin.role,
                    },
                };
            }

            throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
        }

        // Check status
        if (admin.status !== 'ACTIVE') {
            throw new AppError('ACCOUNT_DISABLED', 'Account is disabled', 403);
        }

        // Verify password
        const isValid = await verifyPassword(password, admin.passwordHash);
        if (!isValid) {
            throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
        }

        // Update login info
        await prisma.admin.update({
            where: { id: admin.id },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: ip,
            },
        });

        // Generate Token
        const token = await signToken({
            sub: admin.id.toString(),
            username: admin.username,
            role: admin.role,
        });

        return {
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
            },
        };
    },

    /**
     * Change password
     */
    async changePassword(adminId: number, input: ChangePasswordInput) {
        const { oldPassword, newPassword } = input;

        // Environment variable admin (id=0) cannot change password
        if (adminId === 0) {
            throw new AppError('CANNOT_CHANGE', 'Cannot change password for default admin', 400);
        }

        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            select: { passwordHash: true },
        });

        if (!admin) {
            throw new AppError('NOT_FOUND', 'Admin not found', 404);
        }

        const isValid = await verifyPassword(oldPassword, admin.passwordHash);
        if (!isValid) {
            throw new AppError('INVALID_PASSWORD', 'Invalid old password', 400);
        }

        const newHash = await hashPassword(newPassword);
        await prisma.admin.update({
            where: { id: adminId },
            data: { passwordHash: newHash },
        });

        return { success: true };
    },

    /**
     * Get current admin info
     */
    async getMe(adminId: number) {
        if (adminId === 0) {
            return {
                id: 0,
                username: env.ADMIN_USERNAME,
                role: 'SUPER_ADMIN',
            };
        }

        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!admin) {
            throw new AppError('NOT_FOUND', 'Admin not found', 404);
        }

        return admin;
    },
};
