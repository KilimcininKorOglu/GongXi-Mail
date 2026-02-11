import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import prisma from './lib/prisma.js';

async function main() {
    const app = await buildApp();

    // Graceful shutdown
    const shutdown = async () => {
        logger.info('Shutting down...');
        await app.close();
        await prisma.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        // Test database connection
        await prisma.$connect();
        logger.info('Database connected');

        // Start server
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        logger.info(`Server running at http://localhost:${env.PORT}`);
    } catch (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
}

main();
