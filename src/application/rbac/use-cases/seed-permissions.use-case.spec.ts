import { CreatePermissionData, Permission } from "@/domain/rbac";

import { PermissionRepository } from "../ports/permission.repository";
import { SeedPermissionsUseCase } from "./seed-permissions.use-case";

const MEAL_MENU_PERMISSION_IDS = [
  "meal_menu.list",
  "meal_menu.read",
  "meal_menu.create",
  "meal_menu.update",
  "meal_menu.delete",
  "meal_menu_config.read",
  "meal_menu_config.update",
];

describe("SeedPermissionsUseCase", () => {
  let repository: jest.Mocked<PermissionRepository>;
  let useCase: SeedPermissionsUseCase;

  beforeEach(() => {
    repository = {
      delete: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByModule: jest.fn(),
      save: jest.fn(
        async (data: CreatePermissionData) =>
          ({
            id: data.id,
            module: data.module,
            description: data.description ?? null,
            createdAt: new Date("2026-05-30T00:00:00.000Z"),
          }) as Permission,
      ),
      saveMany: jest.fn(),
    } as jest.Mocked<PermissionRepository>;
    useCase = new SeedPermissionsUseCase(repository);
  });

  it("includes all meal-menu permission IDs in the system catalog", () => {
    const permissions = useCase.getSystemPermissions();
    const ids = permissions.map((permission) => permission.id);

    expect(ids).toEqual(expect.arrayContaining(MEAL_MENU_PERMISSION_IDS));
    for (const id of MEAL_MENU_PERMISSION_IDS) {
      const permission = permissions.find((item) => item.id === id);
      expect(permission?.module).toBe(id.split(".")[0]);
      expect(permission?.description).toEqual(expect.any(String));
    }
  });

  it("seeds missing meal-menu permissions idempotently", async () => {
    repository.exists.mockImplementation(
      async (id) => !MEAL_MENU_PERMISSION_IDS.includes(id),
    );

    const result = await useCase.execute();

    expect(result.created).toBe(MEAL_MENU_PERMISSION_IDS.length);
    expect(repository.save).toHaveBeenCalledTimes(
      MEAL_MENU_PERMISSION_IDS.length,
    );
    expect(
      repository.save.mock.calls.map(([permission]) => permission.id),
    ).toEqual(MEAL_MENU_PERMISSION_IDS);
  });
});
