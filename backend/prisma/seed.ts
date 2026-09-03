/// <reference types="node" />

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial system users & settings...');

  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  const analystHash = await bcrypt.hash('Analyst@12345', 10);
  const viewerHash = await bcrypt.hash('Viewer@12345', 10);

  // Admin User
  await prisma.user.upsert({
    where: { email: 'admin@reconcile.ai' },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      name: 'System Admin',
      email: 'admin@reconcile.ai',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // Analyst User
  await prisma.user.upsert({
    where: { email: 'analyst@reconcile.ai' },
    update: { passwordHash: analystHash, role: Role.ANALYST },
    create: {
      name: 'Finance Analyst',
      email: 'analyst@reconcile.ai',
      passwordHash: analystHash,
      role: Role.ANALYST,
    },
  });

  // Viewer User
  await prisma.user.upsert({
    where: { email: 'viewer@reconcile.ai' },
    update: { passwordHash: viewerHash, role: Role.VIEWER },
    create: {
      name: 'Finance Viewer',
      email: 'viewer@reconcile.ai',
      passwordHash: viewerHash,
      role: Role.VIEWER,
    },
  });

  // Default Settings
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {
      matchedThreshold: 95.0,
      reviewThreshold: 80.0,
      settlementWindowDays: 2,
    },
    create: {
      id: 'default',
      matchedThreshold: 95.0,
      reviewThreshold: 80.0,
      settlementWindowDays: 2,
    },
  });

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
