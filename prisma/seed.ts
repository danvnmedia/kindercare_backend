import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log(`Bắt đầu quá trình seeding...`);

  // --- 1. SEED DỮ LIỆU NỀN TẢNG (BẮT BUỘC) ---

  // Tạo các loại mối quan hệ người giám hộ
  await prisma.guardianRelationship.upsert({
    where: { id: 'FATHER' },
    update: {},
    create: { id: 'FATHER', name: 'Bố' },
  });
  await prisma.guardianRelationship.upsert({
    where: { id: 'MOTHER' },
    update: {},
    create: { id: 'MOTHER', name: 'Mẹ' },
  });
  await prisma.guardianRelationship.upsert({
    where: { id: 'GUARDIAN' },
    update: {},
    create: { id: 'GUARDIAN', name: 'Người giám hộ' },
  });
  console.log('-> Đã tạo Guardian Relationships.');

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
      id: 'nurse',
      name: 'nurse',
      description: 'Y tá/Nhân viên y tế trường học',
    },
    {
      id: 'principal',
      name: 'principal',
      description: 'Hiệu trưởng/Ban giám hiệu',
    },
    {
      id: 'staff',
      name: 'staff',
      description: 'Nhân viên hành chính',
    },
    {
      id: 'guardian',
      name: 'guardian',
      description: 'Người giám hộ học sinh',
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

  // --- 2. SEED GUARDIANS (5+ guardians) ---
  const guardiansData = [
    {
      id: '11111111-1111-1111-1111-111111111101',
      fullName: 'Nguyễn Văn An',
      email: 'nguyenvanan@example.com',
      phoneNumber: '+84901234501',
      address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
      dateOfBirth: new Date('1980-05-15'),
      gender: 'MALE',
      occupation: 'Kỹ sư phần mềm',
      workAddress: '456 Đường Nguyễn Huệ, Quận 1, TP.HCM',
    },
    {
      id: '11111111-1111-1111-1111-111111111102',
      fullName: 'Trần Thị Bình',
      email: 'tranthibinh@example.com',
      phoneNumber: '+84901234502',
      address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
      dateOfBirth: new Date('1982-08-20'),
      gender: 'FEMALE',
      occupation: 'Giáo viên',
      workAddress: 'Trường THPT Nguyễn Du, Quận 3, TP.HCM',
    },
    {
      id: '11111111-1111-1111-1111-111111111103',
      fullName: 'Lê Văn Cường',
      email: 'levancuong@example.com',
      phoneNumber: '+84901234503',
      address: '789 Đường Trần Hưng Đạo, Quận 5, TP.HCM',
      dateOfBirth: new Date('1978-03-10'),
      gender: 'MALE',
      occupation: 'Bác sĩ',
      workAddress: 'Bệnh viện Chợ Rẫy, Quận 5, TP.HCM',
    },
    {
      id: '11111111-1111-1111-1111-111111111104',
      fullName: 'Phạm Thị Dung',
      email: 'phamthidung@example.com',
      phoneNumber: '+84901234504',
      address: '789 Đường Trần Hưng Đạo, Quận 5, TP.HCM',
      dateOfBirth: new Date('1981-11-25'),
      gender: 'FEMALE',
      occupation: 'Kế toán',
      workAddress: 'Công ty ABC, Quận 7, TP.HCM',
    },
    {
      id: '11111111-1111-1111-1111-111111111105',
      fullName: 'Hoàng Văn Em',
      email: 'hoangvanem@example.com',
      phoneNumber: '+84901234505',
      address: '321 Đường Võ Văn Tần, Quận 3, TP.HCM',
      dateOfBirth: new Date('1975-07-08'),
      gender: 'MALE',
      occupation: 'Doanh nhân',
      workAddress: 'Công ty XYZ, Quận 1, TP.HCM',
    },
    {
      id: '11111111-1111-1111-1111-111111111106',
      fullName: 'Võ Thị Phượng',
      email: 'vothiphuong@example.com',
      phoneNumber: '+84901234506',
      address: '654 Đường Nguyễn Trãi, Quận 5, TP.HCM',
      dateOfBirth: new Date('1983-12-30'),
      gender: 'FEMALE',
      occupation: 'Luật sư',
      workAddress: 'Văn phòng luật ABC, Quận 1, TP.HCM',
    },
  ];

  // Create guardians using upsert
  for (const guardian of guardiansData) {
    await prisma.guardian.upsert({
      where: { id: guardian.id },
      update: {
        fullName: guardian.fullName,
        email: guardian.email,
        phoneNumber: guardian.phoneNumber,
        address: guardian.address,
        dateOfBirth: guardian.dateOfBirth,
        gender: guardian.gender,
        occupation: guardian.occupation,
        workAddress: guardian.workAddress,
      },
      create: guardian,
    });
  }

  // Link spouses (An - Bình)
  await prisma.guardian.update({
    where: { id: '11111111-1111-1111-1111-111111111101' },
    data: { spouseId: '11111111-1111-1111-1111-111111111102' },
  });

  // Link spouses (Cường - Dung)
  await prisma.guardian.update({
    where: { id: '11111111-1111-1111-1111-111111111103' },
    data: { spouseId: '11111111-1111-1111-1111-111111111104' },
  });

  console.log('-> Đã tạo 6 Guardians.');

  // --- 3. SEED STUDENTS (10+ students) ---
  const studentsData = [
    {
      id: '22222222-2222-2222-2222-222222222201',
      studentCode: 'STU-2025-0001',
      fullName: 'Nguyễn Minh Anh',
      email: 'minhanhhs@example.com',
      phoneNumber: null,
      address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
      dateOfBirth: new Date('2019-03-15'),
      nickname: 'Bé Anh',
      gender: 'FEMALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222202',
      studentCode: 'STU-2025-0002',
      fullName: 'Nguyễn Văn Bảo',
      email: null,
      phoneNumber: null,
      address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
      dateOfBirth: new Date('2020-07-22'),
      nickname: 'Bé Bảo',
      gender: 'MALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222203',
      studentCode: 'STU-2025-0003',
      fullName: 'Lê Thị Cẩm',
      email: null,
      phoneNumber: null,
      address: '789 Đường Trần Hưng Đạo, Quận 5, TP.HCM',
      dateOfBirth: new Date('2019-11-08'),
      nickname: 'Bé Cẩm',
      gender: 'FEMALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222204',
      studentCode: 'STU-2025-0004',
      fullName: 'Lê Văn Đức',
      email: null,
      phoneNumber: null,
      address: '789 Đường Trần Hưng Đạo, Quận 5, TP.HCM',
      dateOfBirth: new Date('2020-02-14'),
      nickname: 'Bé Đức',
      gender: 'MALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222205',
      studentCode: 'STU-2025-0005',
      fullName: 'Hoàng Thị Giang',
      email: null,
      phoneNumber: null,
      address: '321 Đường Võ Văn Tần, Quận 3, TP.HCM',
      dateOfBirth: new Date('2019-06-30'),
      nickname: 'Bé Giang',
      gender: 'FEMALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222206',
      studentCode: 'STU-2025-0006',
      fullName: 'Trần Minh Hùng',
      email: null,
      phoneNumber: null,
      address: '456 Đường Nguyễn Du, Quận 1, TP.HCM',
      dateOfBirth: new Date('2020-09-12'),
      nickname: 'Bé Hùng',
      gender: 'MALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222207',
      studentCode: 'STU-2025-0007',
      fullName: 'Phạm Thị Khánh',
      email: null,
      phoneNumber: null,
      address: '654 Đường Nguyễn Trãi, Quận 5, TP.HCM',
      dateOfBirth: new Date('2019-04-25'),
      nickname: 'Bé Khánh',
      gender: 'FEMALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222208',
      studentCode: 'STU-2025-0008',
      fullName: 'Võ Văn Long',
      email: null,
      phoneNumber: null,
      address: '654 Đường Nguyễn Trãi, Quận 5, TP.HCM',
      dateOfBirth: new Date('2020-01-18'),
      nickname: 'Bé Long',
      gender: 'MALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222209',
      studentCode: 'STU-2025-0009',
      fullName: 'Nguyễn Thị Mai',
      email: null,
      phoneNumber: null,
      address: '987 Đường Cách Mạng Tháng 8, Quận 10, TP.HCM',
      dateOfBirth: new Date('2019-08-05'),
      nickname: 'Bé Mai',
      gender: 'FEMALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222210',
      studentCode: 'STU-2025-0010',
      fullName: 'Đặng Văn Nam',
      email: null,
      phoneNumber: null,
      address: '147 Đường Lý Tự Trọng, Quận 1, TP.HCM',
      dateOfBirth: new Date('2020-05-20'),
      nickname: 'Bé Nam',
      gender: 'MALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222211',
      studentCode: 'STU-2025-0011',
      fullName: 'Bùi Thị Oanh',
      email: null,
      phoneNumber: null,
      address: '258 Đường Hai Bà Trưng, Quận 3, TP.HCM',
      dateOfBirth: new Date('2019-12-10'),
      nickname: 'Bé Oanh',
      gender: 'FEMALE',
    },
    {
      id: '22222222-2222-2222-2222-222222222212',
      studentCode: 'STU-2025-0012',
      fullName: 'Lý Văn Phúc',
      email: null,
      phoneNumber: null,
      address: '369 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
      dateOfBirth: new Date('2020-03-28'),
      nickname: 'Bé Phúc',
      gender: 'MALE',
    },
  ];

  // Create students using upsert
  for (const student of studentsData) {
    await prisma.student.upsert({
      where: { id: student.id },
      update: {
        studentCode: student.studentCode,
        fullName: student.fullName,
        email: student.email,
        phoneNumber: student.phoneNumber,
        address: student.address,
        dateOfBirth: student.dateOfBirth,
        nickname: student.nickname,
        gender: student.gender,
      },
      create: student,
    });
  }
  console.log('-> Đã tạo 12 Students.');

  // --- 4. SEED GUARDIAN-STUDENT RELATIONSHIPS ---
  const guardianStudentRelationships = [
    // Nguyễn Minh Anh (con của An và Bình)
    { studentId: '22222222-2222-2222-2222-222222222201', guardianId: '11111111-1111-1111-1111-111111111101', relationshipId: 'FATHER' },
    { studentId: '22222222-2222-2222-2222-222222222201', guardianId: '11111111-1111-1111-1111-111111111102', relationshipId: 'MOTHER' },

    // Nguyễn Văn Bảo (con của An và Bình)
    { studentId: '22222222-2222-2222-2222-222222222202', guardianId: '11111111-1111-1111-1111-111111111101', relationshipId: 'FATHER' },
    { studentId: '22222222-2222-2222-2222-222222222202', guardianId: '11111111-1111-1111-1111-111111111102', relationshipId: 'MOTHER' },

    // Lê Thị Cẩm (con của Cường và Dung)
    { studentId: '22222222-2222-2222-2222-222222222203', guardianId: '11111111-1111-1111-1111-111111111103', relationshipId: 'FATHER' },
    { studentId: '22222222-2222-2222-2222-222222222203', guardianId: '11111111-1111-1111-1111-111111111104', relationshipId: 'MOTHER' },

    // Lê Văn Đức (con của Cường và Dung)
    { studentId: '22222222-2222-2222-2222-222222222204', guardianId: '11111111-1111-1111-1111-111111111103', relationshipId: 'FATHER' },
    { studentId: '22222222-2222-2222-2222-222222222204', guardianId: '11111111-1111-1111-1111-111111111104', relationshipId: 'MOTHER' },

    // Hoàng Thị Giang (con của Em - single parent)
    { studentId: '22222222-2222-2222-2222-222222222205', guardianId: '11111111-1111-1111-1111-111111111105', relationshipId: 'FATHER' },

    // Trần Minh Hùng (người giám hộ là Bình - teacher)
    { studentId: '22222222-2222-2222-2222-222222222206', guardianId: '11111111-1111-1111-1111-111111111102', relationshipId: 'GUARDIAN' },

    // Phạm Thị Khánh (con của Phượng - single parent)
    { studentId: '22222222-2222-2222-2222-222222222207', guardianId: '11111111-1111-1111-1111-111111111106', relationshipId: 'MOTHER' },

    // Võ Văn Long (con của Phượng - single parent)
    { studentId: '22222222-2222-2222-2222-222222222208', guardianId: '11111111-1111-1111-1111-111111111106', relationshipId: 'MOTHER' },

    // Nguyễn Thị Mai (người giám hộ là Em)
    { studentId: '22222222-2222-2222-2222-222222222209', guardianId: '11111111-1111-1111-1111-111111111105', relationshipId: 'GUARDIAN' },

    // Đặng Văn Nam (người giám hộ là An)
    { studentId: '22222222-2222-2222-2222-222222222210', guardianId: '11111111-1111-1111-1111-111111111101', relationshipId: 'GUARDIAN' },

    // Bùi Thị Oanh (người giám hộ là Dung)
    { studentId: '22222222-2222-2222-2222-222222222211', guardianId: '11111111-1111-1111-1111-111111111104', relationshipId: 'GUARDIAN' },

    // Lý Văn Phúc (người giám hộ là Cường)
    { studentId: '22222222-2222-2222-2222-222222222212', guardianId: '11111111-1111-1111-1111-111111111103', relationshipId: 'GUARDIAN' },
  ];

  // Create guardian-student relationships using upsert pattern
  for (const rel of guardianStudentRelationships) {
    await prisma.guardianStudent.upsert({
      where: {
        studentId_guardianId: {
          studentId: rel.studentId,
          guardianId: rel.guardianId,
        },
      },
      update: {
        guardianRelationshipId: rel.relationshipId,
      },
      create: {
        studentId: rel.studentId,
        guardianId: rel.guardianId,
        guardianRelationshipId: rel.relationshipId,
      },
    });
  }
  console.log('-> Đã tạo Guardian-Student relationships.');

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
