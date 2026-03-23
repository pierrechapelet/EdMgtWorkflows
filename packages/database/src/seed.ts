import { PrismaClient, NodeType, Lang } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Root ministry node
  const ministry = await prisma.xeduNode.upsert({
    where: { code: 'MOE-ROOT' },
    update: {},
    create: {
      code: 'MOE-ROOT',
      nodeType: NodeType.ministry,
      name: { en: 'Ministry of Education', ar: 'وزارة التعليم', fr: "Ministère de l'Éducation", es: 'Ministerio de Educación' },
      isActive: true,
    },
  });

  // ── Seed roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { code: 'super_admin' },
      update: {},
      create: {
        code: 'super_admin',
        name: { en: 'Super Administrator', ar: 'مدير النظام', fr: 'Super Administrateur', es: 'Super Administrador' },
        description: { en: 'Full system access', ar: 'وصول كامل للنظام', fr: 'Accès complet au système', es: 'Acceso completo al sistema' },
      },
    }),
    prisma.role.upsert({
      where: { code: 'district_officer' },
      update: {},
      create: {
        code: 'district_officer',
        name: { en: 'District Officer', ar: 'مسؤول المنطقة', fr: 'Agent de District', es: 'Oficial de Distrito' },
        description: { en: 'District-level management', ar: 'إدارة على مستوى المنطقة', fr: 'Gestion au niveau du district', es: 'Gestión a nivel de distrito' },
      },
    }),
    prisma.role.upsert({
      where: { code: 'principal' },
      update: {},
      create: {
        code: 'principal',
        name: { en: 'Principal', ar: 'مدير المدرسة', fr: 'Directeur', es: 'Director' },
        description: { en: 'School principal', ar: 'مدير المدرسة', fr: 'Directeur de l\'école', es: 'Director de escuela' },
      },
    }),
    prisma.role.upsert({
      where: { code: 'teacher' },
      update: {},
      create: {
        code: 'teacher',
        name: { en: 'Teacher', ar: 'معلم', fr: 'Enseignant', es: 'Docente' },
        description: { en: 'Classroom teacher', ar: 'معلم في الفصل الدراسي', fr: 'Enseignant en classe', es: 'Maestro de aula' },
      },
    }),
    prisma.role.upsert({
      where: { code: 'hr_officer' },
      update: {},
      create: {
        code: 'hr_officer',
        name: { en: 'HR Officer', ar: 'مسؤول الموارد البشرية', fr: 'Responsable RH', es: 'Oficial de RRHH' },
        description: { en: 'Human resources management', ar: 'إدارة الموارد البشرية', fr: 'Gestion des ressources humaines', es: 'Gestión de recursos humanos' },
      },
    }),
  ]);

  // ── Seed super-admin user
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edmgt.local' },
    update: {},
    create: {
      email: 'admin@edmgt.local',
      passwordHash: adminHash,
      preferredLang: Lang.en,
      isActive: true,
    },
  });

  // ── Assign super_admin role to admin at ministry node
  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleId_xeduNodeId: {
        userId: admin.id,
        roleId: roles[0].id,
        xeduNodeId: ministry.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: roles[0].id,
      xeduNodeId: ministry.id,
      grantedById: admin.id,
    },
  });

  // ── Self-closure for ministry node
  await prisma.xeduClosure.upsert({
    where: { ancestorId_descendantId: { ancestorId: ministry.id, descendantId: ministry.id } },
    update: {},
    create: { ancestorId: ministry.id, descendantId: ministry.id, depth: 0 },
  });

  console.log('Seeding complete.');
  console.log('Admin login: admin@edmgt.local / Admin@123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
