import { FastifyPluginAsync } from 'fastify';
import { authService } from './auth.service.js';
import { loginSchema, changePasswordSchema } from './auth.schema.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
    // Login
    fastify.post('/login', async (request, reply) => {
        const input = loginSchema.parse(request.body);
        const result = await authService.login(input, request.ip);

        // Set Cookie
        reply.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7200 * 1000, // 2 hours
        });

        return { success: true, data: result };
    });

    // Logout
    fastify.post('/logout', async (request, reply) => {
        reply.clearCookie('token');
        return { success: true, data: { message: 'Logged out' } };
    });

    // Get current user
    fastify.get('/me', {
        preHandler: [fastify.authenticateJwt],
    }, async (request, reply) => {
        const admin = await authService.getMe(request.user!.id);
        return { success: true, data: admin };
    });

    // Change password
    fastify.post('/change-password', {
        preHandler: [fastify.authenticateJwt],
    }, async (request, reply) => {
        const input = changePasswordSchema.parse(request.body);
        await authService.changePassword(request.user!.id, input);
        return { success: true, data: { message: 'Password changed' } };
    });
};

export default authRoutes;
