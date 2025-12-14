import { Subject as PrismaSubject } from "@prisma/client";
import { Subject } from "@/domain/class-management/entities/subject.entity";
import { Prisma } from "@prisma/client";

export class PrismaSubjectMapper {
  static toDomain(prismaSubject: PrismaSubject): Subject {
    return Subject.create(
      {
        name: prismaSubject.name,
        createdAt: prismaSubject.createdAt,
        updatedAt: prismaSubject.updatedAt,
      },
      prismaSubject.id,
    );
  }

  static toPrisma(subject: Subject): Prisma.SubjectUncheckedCreateInput {
    return {
      id: subject.id,
      name: subject.name,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };
  }

  static toPrismaUpdate(subject: Subject): Prisma.SubjectUpdateInput {
    return {
      name: subject.name,
      updatedAt: subject.updatedAt,
    };
  }

  static toDomainArray(prismaSubjects: PrismaSubject[]): Subject[] {
    return prismaSubjects.map((s) => PrismaSubjectMapper.toDomain(s));
  }
}
