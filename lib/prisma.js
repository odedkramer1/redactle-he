/**
 * /lib/prisma.js
 * Shared Prisma client for Next.js (avoids hot-reload duplicates in dev).
 */
import { PrismaClient } from '@prisma/client';

if (!global._prismaClient) {
  global._prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = global._prismaClient;
