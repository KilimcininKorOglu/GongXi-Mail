import { FastifyPluginAsync } from 'fastify';
import { dashboardService } from './dashboard.service.js';
import { z } from 'zod';

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
    // All routes require JWT authentication
    fastify.addHook('preHandler', fastify.authenticateJwt);

    // Statistics
    fastify.get('/stats', async () => {
        const stats = await dashboardService.getStats();
        return { success: true, data: stats };
    });

    // API call trend
    fastify.get('/api-trend', async (request) => {
        const { days } = z.object({ days: z.coerce.number().default(7) }).parse(request.query);
        const trend = await dashboardService.getApiTrend(days);
        return { success: true, data: trend };
    });

    // Operation logs
    fastify.get('/logs', async (request) => {
        const input = z.object({
            page: z.coerce.number().default(1),
            pageSize: z.coerce.number().default(20),
            action: z.string().optional(),
        }).parse(request.query);

        const logs = await dashboardService.getLogs(input);
        return { success: true, data: logs };
    });
};

export default dashboardRoutes;
