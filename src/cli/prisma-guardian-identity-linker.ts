import { PrismaClient } from "@prisma/client";
import { fixtureId } from "../../prisma/seeds/seed-support";
import { GuardianIdentityLinker, GuardianSeedFixture } from "./clerk-dev-tools";

export interface GuardianIdentityRecord {
  id: string;
  campusId: string;
  email: string;
  userId: string | null;
}

export interface InternalIdentityRecord {
  id: string;
  clerkUid: string;
  isActive: boolean;
}

export interface GuardianIdentityTransaction {
  findGuardianById(id: string): Promise<GuardianIdentityRecord | null>;
  findUserById(id: string): Promise<InternalIdentityRecord | null>;
  findUserByClerkUid(clerkUid: string): Promise<InternalIdentityRecord | null>;
  createUser(input: InternalIdentityRecord): Promise<InternalIdentityRecord>;
  updateUser(
    id: string,
    input: { clerkUid?: string; isActive: boolean },
  ): Promise<InternalIdentityRecord>;
  updateGuardianUser(guardianId: string, userId: string): Promise<void>;
}

export interface GuardianIdentityDatabase {
  campusExists(campusId: string): Promise<boolean>;
  findGuardianById(id: string): Promise<GuardianIdentityRecord | null>;
  transaction<T>(
    work: (transaction: GuardianIdentityTransaction) => Promise<T>,
  ): Promise<T>;
}

export class PrismaGuardianIdentityLinker implements GuardianIdentityLinker {
  constructor(private readonly database: GuardianIdentityDatabase) {}

  async preflight(
    fixtures: readonly GuardianSeedFixture[],
    campusId: string,
  ): Promise<void> {
    if (!(await this.database.campusExists(campusId))) {
      throw new Error(
        `Seed campus ${campusId} was not found. Run the database seeds first.`,
      );
    }

    for (const fixture of fixtures) {
      const guardianId = fixtureId(campusId, "guardian", fixture.seedKey);
      const guardian = await this.database.findGuardianById(guardianId);
      if (
        !guardian ||
        guardian.campusId !== campusId ||
        guardian.email.trim().toLowerCase() !==
          fixture.email.trim().toLowerCase()
      ) {
        throw new Error(
          `Guardian fixture ${fixture.seedKey} is missing or does not match the database seed. Run seed:dev-data first.`,
        );
      }
    }
  }

  async linkIdentity(input: {
    fixture: GuardianSeedFixture;
    campusId: string;
    clerkUid: string;
  }): Promise<void> {
    const guardianId = fixtureId(
      input.campusId,
      "guardian",
      input.fixture.seedKey,
    );
    const fixtureUserId = fixtureId(
      input.campusId,
      "user",
      input.fixture.seedKey,
    );

    await this.database.transaction(async (transaction) => {
      const guardian = await transaction.findGuardianById(guardianId);
      if (!guardian || guardian.campusId !== input.campusId) {
        throw new Error(
          `Guardian fixture ${input.fixture.seedKey} is missing.`,
        );
      }

      const [fixtureUser, clerkUser] = await Promise.all([
        transaction.findUserById(fixtureUserId),
        transaction.findUserByClerkUid(input.clerkUid),
      ]);
      if (fixtureUser && clerkUser && fixtureUser.id !== clerkUser.id) {
        throw new Error(
          `Internal identity conflict for guardian fixture ${input.fixture.seedKey}.`,
        );
      }

      let user: InternalIdentityRecord;
      if (clerkUser) {
        user = await transaction.updateUser(clerkUser.id, { isActive: true });
      } else if (fixtureUser) {
        user = await transaction.updateUser(fixtureUser.id, {
          clerkUid: input.clerkUid,
          isActive: true,
        });
      } else {
        user = await transaction.createUser({
          id: fixtureUserId,
          clerkUid: input.clerkUid,
          isActive: true,
        });
      }

      await transaction.updateGuardianUser(guardianId, user.id);
    });
  }
}

type PrismaIdentityClient = Pick<PrismaClient, "guardian" | "user">;

function prismaTransactionAdapter(
  client: PrismaIdentityClient,
): GuardianIdentityTransaction {
  return {
    async findGuardianById(id) {
      return client.guardian.findUnique({
        where: { id },
        select: { id: true, campusId: true, email: true, userId: true },
      });
    },
    async findUserById(id) {
      return client.user.findUnique({
        where: { id },
        select: { id: true, clerkUid: true, isActive: true },
      });
    },
    async findUserByClerkUid(clerkUid) {
      return client.user.findUnique({
        where: { clerkUid },
        select: { id: true, clerkUid: true, isActive: true },
      });
    },
    async createUser(input) {
      return client.user.create({
        data: input,
        select: { id: true, clerkUid: true, isActive: true },
      });
    },
    async updateUser(id, input) {
      return client.user.update({
        where: { id },
        data: input,
        select: { id: true, clerkUid: true, isActive: true },
      });
    },
    async updateGuardianUser(guardianId, userId) {
      await client.guardian.update({
        where: { id: guardianId },
        data: { userId },
      });
    },
  };
}

export function createPrismaGuardianIdentityDatabase(
  prisma: PrismaClient,
): GuardianIdentityDatabase {
  const adapter = prismaTransactionAdapter(prisma);
  return {
    async campusExists(campusId) {
      return Boolean(
        await prisma.campus.findUnique({
          where: { id: campusId },
          select: { id: true },
        }),
      );
    },
    findGuardianById: adapter.findGuardianById,
    async transaction(work) {
      return prisma.$transaction((transaction) =>
        work(prismaTransactionAdapter(transaction)),
      );
    },
  };
}
