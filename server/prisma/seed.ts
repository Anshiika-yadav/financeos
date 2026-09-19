import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const wildcardPermission = await prisma.permission.upsert({
    where: {
      module_resourceType_action: { module: '*', resourceType: '*', action: '*' },
    },
    update: {},
    create: {
      module: '*',
      resourceType: '*',
      action: '*',
      description: 'Full access - granted to tenant owners',
    },
  });

  const ownerRole = await prisma.role.findFirst({
    where: { tenantId: null, name: 'owner', isBuiltIn: true },
  });

  if (!ownerRole) {
    console.log('No built-in owner role found yet - create a tenant first, then re-run seed.');
    return;
  }

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: ownerRole.id, permissionId: wildcardPermission.id },
    },
    update: {},
    create: { roleId: ownerRole.id, permissionId: wildcardPermission.id },
  });

  console.log('Seeded: owner role now has full access.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
