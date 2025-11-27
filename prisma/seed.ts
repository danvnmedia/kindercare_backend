import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Bắt đầu quá trình seeding...`);

  // --- 1. SEED DỮ LIỆU NỀN TẢNG (BẮT BUỘC) ---

  // Tạo các loại vai trò trong lớp học
  await prisma.classRole.upsert({
    where: { id: 'HOMEROOM_TEACHER' },
    update: {},
    create: { id: 'HOMEROOM_TEACHER', name: 'Giáo viên Chủ nhiệm' },
  });
  await prisma.classRole.upsert({
    where: { id: 'ASSISTANT' },
    update: {},
    create: { id: 'ASSISTANT', name: 'Giáo viên phụ' },
  });
  console.log('-> Đã tạo Class Roles.');

  // Tạo các loại mối quan hệ phụ huynh
  await prisma.parentRelationship.upsert({
    where: { id: 'FATHER' },
    update: {},
    create: { id: 'FATHER', name: 'Bố' },
  });
  await prisma.parentRelationship.upsert({
    where: { id: 'MOTHER' },
    update: {},
    create: { id: 'MOTHER', name: 'Mẹ' },
  });
  await prisma.parentRelationship.upsert({
    where: { id: 'GUARDIAN' },
    update: {},
    create: { id: 'GUARDIAN', name: 'Người giám hộ' },
  });
  console.log('-> Đã tạo Parent Relationships.');

  // Tạo các vai trò người dùng
  const baseRoles = [
    {
      id: 'admin',
      name: 'admin',
      description: 'Quản trị viên cao nhất của trường',
    },
    {
      id: 'teacher',
      name: 'teacher',
      description: 'Giáo viên giảng dạy và chủ nhiệm',
    },
    {
      id: 'parent',
      name: 'parent',
      description: 'Phụ huynh học sinh',
    },
    {
      id: 'student',
      name: 'student',
      description: 'Học sinh đã được cấp tài khoản',
    },
  ];

  for (const role of baseRoles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        description: role.description,
      },
      create: {
        ...role,
        permissions: {},
      },
    });
  }
  console.log('-> Đã tạo Roles.');

  console.log(`Quá trình seeding hoàn tất.`);
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
