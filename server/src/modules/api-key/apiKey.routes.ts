import { FastifyPluginAsync } from 'fastify';
import { apiKeyService } from './apiKey.service.js';
import { poolService } from '../mail/pool.service.js';
import { createApiKeySchema, updateApiKeySchema, listApiKeySchema } from './apiKey.schema.js';

const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
    // All routes require JWT authentication
    fastify.addHook('preHandler', fastify.authenticateJwt);

    // List
    fastify.get('/', async (request) => {
        const input = listApiKeySchema.parse(request.query);
        const result = await apiKeyService.list(input);
        return { success: true, data: result };
    });

    // Create
    fastify.post('/', async (request) => {
        const input = createApiKeySchema.parse(request.body);
        const apiKey = await apiKeyService.create(input, request.user!.id);
        return { success: true, data: apiKey };
    });

    // Details
    fastify.get('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const apiKey = await apiKeyService.getById(parseInt(id));
        return { success: true, data: apiKey };
    });

    // Usage statistics (call count)
    fastify.get('/:id/usage', async (request) => {
        const { id } = request.params as { id: string };
        // Get email pool statistics
        const poolStats = await poolService.getStats(parseInt(id));
        return { success: true, data: poolStats };
    });

    // Reset email pool
    fastify.post('/:id/reset-pool', async (request) => {
        const { id } = request.params as { id: string };
        await poolService.reset(parseInt(id));
        return { success: true, data: { message: 'Email pool has been reset' } };
    });

    // Update
    fastify.put('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const input = updateApiKeySchema.parse(request.body);
        const apiKey = await apiKeyService.update(parseInt(id), input);
        return { success: true, data: apiKey };
    });

    // Delete
    fastify.delete('/:id', async (request) => {
        const { id } = request.params as { id: string };
        await apiKeyService.delete(parseInt(id));
        return { success: true, data: { message: 'API Key deleted' } };
    });

    // Get email list with usage status
    fastify.get('/:id/pool-emails', async (request) => {
        const { id } = request.params as { id: string };
        const emails = await poolService.getEmailsWithUsage(parseInt(id));
        return { success: true, data: emails };
    });

    // Update email usage status
    fastify.put('/:id/pool-emails', async (request) => {
        const { id } = request.params as { id: string };
        const { emailIds } = request.body as { emailIds: number[] };
        const result = await poolService.updateEmailUsage(parseInt(id), emailIds || []);
        return { success: true, data: result };
    });
};

export default apiKeyRoutes;

