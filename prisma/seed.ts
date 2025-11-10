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
  console.log('-> Đã tạo Parent Relationships.');

  // Tạo các vai trò người dùng
  const adminRole = await prisma.role.upsert({
    where: { name: 'school_admin' },
    update: {},
    create: {
      name: 'school_admin',
      description: 'Quản trị viên cao nhất của trường',
      permissions: {}, // Ví dụ về cấu trúc permissions
    },
  });
  const teacherRole = await prisma.role.upsert({
    where: { name: 'teacher' },
    update: {},
    create: {
      name: 'teacher',
      description: 'Giáo viên giảng dạy và chủ nhiệm',
      permissions: {},
    },
  });
  const parentRole = await prisma.role.upsert({
    where: { name: 'parent' },
    update: {},
    create: {
      name: 'parent',
      description: 'Phụ huynh học sinh',
      permissions: {},
    },
  });
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
