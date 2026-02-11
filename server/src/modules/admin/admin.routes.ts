import { FastifyPluginAsync } from 'fastify';
import { adminService } from './admin.service.js';
import { createAdminSchema, updateAdminSchema, listAdminSchema } from './admin.schema.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
    // All routes require JWT authentication + super admin permission
    fastify.addHook('preHandler', fastify.authenticateJwt);
    fastify.addHook('preHandler', fastify.requireSuperAdmin);

    // List
    fastify.get('/', async (request) => {
        const input = listAdminSchema.parse(request.query);
        const result = await adminService.list(input);
        return { success: true, data: result };
    });

    // Details
    fastify.get('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const admin = await adminService.getById(parseInt(id));
        return { success: true, data: admin };
    });

    // Create
    fastify.post('/', async (request) => {
        const input = createAdminSchema.parse(request.body);
        const admin = await adminService.create(input);
        return { success: true, data: admin };
    });

    // Update
    fastify.put('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const input = updateAdminSchema.parse(request.body);
        const admin = await adminService.update(parseInt(id), input);
        return { success: true, data: admin };
    });

    // Delete
    fastify.delete('/:id', async (request) => {
        const { id } = request.params as { id: string };
        await adminService.delete(parseInt(id));
        return { success: true, data: { message: 'Admin deleted' } };
    });
};

export default adminRoutes;
