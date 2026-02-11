import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import errorPlugin from './plugins/error.js';
import authPlugin from './plugins/auth.js';

// Routes
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import apiKeyRoutes from './modules/api-key/apiKey.routes.js';
import emailRoutes from './modules/email/email.routes.js';
import mailRoutes from './modules/mail/mail.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
    const fastify = Fastify({
        logger: env.NODE_ENV === 'development' ? {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true },
            },
        } : true,
    });

    // Plugins
    await fastify.register(fastifyCors, {
        origin: true,
        credentials: true,
    });

    await fastify.register(fastifyHelmet, {
        contentSecurityPolicy: false, // Allow frontend loading
    });

    await fastify.register(fastifyCookie);

    // Custom plugins
    await fastify.register(errorPlugin);
    await fastify.register(authPlugin);

    // Static files (frontend) - disable fastify-static's default 404 handling
    await fastify.register(fastifyStatic, {
        root: join(__dirname, '../../public'),
        prefix: '/',
        wildcard: false, // Disable wildcard, let us handle SPA custom
    });

    // API routes
    await fastify.register(authRoutes, { prefix: '/admin/auth' });
    await fastify.register(adminRoutes, { prefix: '/admin/admins' });
    await fastify.register(apiKeyRoutes, { prefix: '/admin/api-keys' });
    await fastify.register(emailRoutes, { prefix: '/admin/emails' });
    await fastify.register(dashboardRoutes, { prefix: '/admin/dashboard' });

    // External API
    await fastify.register(mailRoutes, { prefix: '/api' });

    // SPA fallback - now can safely use setNotFoundHandler
    fastify.setNotFoundHandler(async (request, reply) => {
        // If it's an API route, return 404 JSON
        if (request.url.startsWith('/api') || request.url.startsWith('/admin')) {
            return reply.status(404).send({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Route not found' },
            });
        }

        // Otherwise return index.html (SPA)
        return reply.sendFile('index.html');
    });

    return fastify;
}

export default buildApp;
