#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";

const prisma = new PrismaClient();

// Default Super Admin role ID (matches seed.ts)
const DEFAULT_SUPER_ADMIN_ROLE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface AdminInput {
  email: string;
  fullName: string;
  clerkUid?: string;
  phoneNumber?: string;
  password?: string;
  roleId?: string;
}

export interface ParsedAdminCliArgs {
  command: string;
  help?: boolean;
  email?: string;
  name?: string;
  clerkUid?: string;
  phone?: string;
  passwordStdin?: boolean;
  roleId?: string;
}

export async function readPasswordFromStdin(
  input: NodeJS.ReadableStream = process.stdin,
): Promise<string> {
  let rawPassword = "";

  for await (const chunk of input as AsyncIterable<string | Buffer>) {
    rawPassword += chunk.toString();
  }

  const password = rawPassword.replace(/\r?\n$/, "");
  if (password.length < 8) {
    throw new Error("Password from stdin must contain at least 8 characters");
  }

  return password;
}

function requireClerkSecretKey() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is not set in .env file");
  }
}

function printClerkApiErrors(error: unknown) {
  if ((error as any).errors) {
    console.error("\nClerk API Errors:");
    (error as any).errors.forEach((err: any) => {
      console.error(`  - ${err.message} (${err.code})`);
      if (err.meta) {
        console.error(`    Meta:`, err.meta);
      }
    });
  }
}

async function createClerkUser(
  email: string,
  fullName: string,
  phoneNumber?: string,
  password?: string,
): Promise<string> {
  try {
    console.log("Creating user on Clerk...");

    // Check if CLERK_SECRET_KEY exists
    requireClerkSecretKey();

    // Check if user already exists on Clerk
    console.log(`   Checking if ${email} exists on Clerk...`);
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (existingUsers.totalCount > 0) {
      console.log("User already exists on Clerk, using existing Clerk UID");
      return existingUsers.data[0].id;
    }

    // Create new user on Clerk
    console.log("   Creating new user on Clerk...");
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      phoneNumber: phoneNumber ? [phoneNumber] : undefined,
      password: password || undefined,
      skipPasswordRequirement: !password, // Skip only if no password provided
      publicMetadata: { fullName: fullName.trim() },
    });

    console.log(`User created on Clerk with UID: ${clerkUser.id}`);
    return clerkUser.id;
  } catch (error) {
    console.error("\nFailed to create user on Clerk");
    console.error("Error details:", JSON.stringify(error, null, 2));

    // Check specific error types
    printClerkApiErrors(error);

    // Common issues
    console.error("\nCommon solutions:");
    console.error("  1. Check CLERK_SECRET_KEY is valid in .env");
    console.error("  2. Email might already exist - check Clerk Dashboard");
    console.error(
      "  3. Clerk instance might have restrictions (allowlist/blocklist)",
    );
    console.error("  4. Check your Clerk plan limits\n");

    throw error;
  }
}

async function createAdmin(input: AdminInput) {
  try {
    console.log("Creating Super Admin account...");

    // 1. Check if user with this clerkUid already exists in database
    const existingUserByClerk = input.clerkUid
      ? await prisma.user.findUnique({
          where: { clerkUid: input.clerkUid },
        })
      : null;

    if (existingUserByClerk) {
      console.error(
        `User with Clerk UID ${input.clerkUid} already exists in database`,
      );
      process.exit(1);
    }

    // 2. Get or create Clerk UID
    let clerkUid = input.clerkUid;
    const skipClerk = process.env.SKIP_CLERK === "true";

    if (!clerkUid) {
      if (skipClerk) {
        // Bypass Clerk creation (for testing or when Clerk is unavailable)
        clerkUid = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log("SKIP_CLERK=true, using temporary UID");
        console.log(`Temporary UID: ${clerkUid}`);
        console.log("   Update with real Clerk UID later!\n");
      } else {
        console.log(
          "No Clerk UID provided, creating user on Clerk automatically...",
        );
        clerkUid = await createClerkUser(
          input.email,
          input.fullName,
          input.phoneNumber,
          input.password,
        );
      }
    } else {
      console.log(`Using provided Clerk UID: ${clerkUid}`);
    }

    // 3. Find or create Super Admin role
    const roleId = input.roleId || DEFAULT_SUPER_ADMIN_ROLE_ID;
    let superAdminRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!superAdminRole) {
      console.log(`Creating Super Admin role with ID: ${roleId}...`);
      superAdminRole = await prisma.role.create({
        data: {
          id: roleId,
          name: "Super Admin",
          description:
            "Global system administrator with full access to all campuses",
          campusId: null, // Global role
          isSystemDefault: true,
          isSystemRole: true, // Grants global admin bypass
        },
      });
      console.log("Super Admin role created with isSystemRole=true");
    } else if (!superAdminRole.isSystemRole) {
      // Update existing role to have isSystemRole=true
      console.log(
        "Updating existing Super Admin role to set isSystemRole=true...",
      );
      superAdminRole = await prisma.role.update({
        where: { id: roleId },
        data: { isSystemRole: true, isSystemDefault: true },
      });
      console.log("Super Admin role updated with isSystemRole=true");
    } else {
      console.log(`Using existing Super Admin role: ${roleId}`);
    }

    // 4. Create admin user in database (User only has clerkUid and isActive)
    console.log("Saving admin user to database...");
    const adminUser = await prisma.user.create({
      data: {
        clerkUid: clerkUid,
        isActive: true,
        userRoles: {
          create: {
            roleId: superAdminRole.id,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    console.log("\nSuper Admin account created successfully!");
    console.log("----------------------------------------");
    console.log(`Email (Clerk):  ${input.email}`);
    console.log(`Full Name:      ${input.fullName}`);
    console.log(
      `Password:       ${input.password ? "Set" : "Not set (needs reset)"}`,
    );
    console.log(`User ID:        ${adminUser.id}`);
    console.log(`Clerk UID:      ${adminUser.clerkUid}`);
    console.log(`Role ID:        ${superAdminRole.id}`);
    console.log(
      `Role Name:      ${adminUser.userRoles.map((ur) => ur.role.name).join(", ")}`,
    );
    console.log(`isSystemRole:   true (global admin bypass)`);
    console.log(
      `Status:         ${adminUser.isActive ? "Active" : "Inactive"}`,
    );
    console.log("----------------------------------------\n");

    if (!input.clerkUid) {
      console.log("Note: User was automatically created on Clerk.");
      if (input.password) {
        console.log(
          "   The user can now login using their email and password.\n",
        );
      } else {
        console.log(
          "   No password set - user must reset password via Clerk.\n",
        );
      }
    }
  } catch (error) {
    console.error("Failed to create admin:", (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function listAdmins() {
  try {
    console.log("Listing all Super Admin accounts...\n");

    // Find all users with any isSystemRole=true role
    const adminUsers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              isSystemRole: true,
            },
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (adminUsers.length === 0) {
      console.log("No Super Admin accounts found.\n");
      return;
    }

    console.log("----------------------------------------");
    adminUsers.forEach((user, index) => {
      const systemRoles = user.userRoles.filter((ur) => ur.role.isSystemRole);
      console.log(`\n${index + 1}. Super Admin User`);
      console.log(`   ID:        ${user.id}`);
      console.log(`   Clerk UID: ${user.clerkUid}`);
      console.log(
        `   Roles:     ${user.userRoles.map((ur) => ur.role.name).join(", ")}`,
      );
      console.log(
        `   Role IDs:  ${systemRoles.map((ur) => ur.role.id).join(", ")}`,
      );
      console.log(`   Status:    ${user.isActive ? "Active" : "Inactive"}`);
    });
    console.log("\n----------------------------------------\n");
  } catch (error) {
    console.error("Failed to list admins:", (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getClerkUidByEmail(email: string): Promise<string> {
  requireClerkSecretKey();

  console.log(`Finding Clerk user by email: ${email}...`);
  const existingUsers = await clerkClient.users.getUserList({
    emailAddress: [email],
  });

  if (existingUsers.totalCount === 0) {
    throw new Error(`No Clerk user found with email ${email}`);
  }

  return existingUsers.data[0].id;
}

async function ensureLocalSuperAdmin(clerkUid: string) {
  const user = await prisma.user.findUnique({
    where: { clerkUid },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User with Clerk UID ${clerkUid} not found in database`);
  }

  const isSuperAdmin = user.userRoles.some(
    (ur) => ur.role.isSystemRole === true,
  );
  if (!isSuperAdmin) {
    throw new Error(
      `User ${clerkUid} is not a Super Admin (no isSystemRole=true role)`,
    );
  }
}

async function updateAdminPassword(input: {
  clerkUid?: string;
  email?: string;
  password: string;
}) {
  try {
    requireClerkSecretKey();

    const clerkUid = input.clerkUid || (await getClerkUidByEmail(input.email!));
    await ensureLocalSuperAdmin(clerkUid);

    console.log(`Updating Clerk password for Super Admin: ${clerkUid}...`);
    await clerkClient.users.updateUser(clerkUid, {
      password: input.password,
      signOutOfOtherSessions: true,
    });

    console.log("Super Admin password updated successfully.");
    console.log("Existing sessions were signed out.\n");
  } catch (error) {
    console.error("Failed to update admin password:", (error as Error).message);
    printClerkApiErrors(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function updateClerkPassword(input: {
  clerkUid?: string;
  email?: string;
  password: string;
}) {
  try {
    requireClerkSecretKey();

    const clerkUid = input.clerkUid || (await getClerkUidByEmail(input.email!));

    console.log(`Updating Clerk password for user: ${clerkUid}...`);
    await clerkClient.users.updateUser(clerkUid, {
      password: input.password,
      signOutOfOtherSessions: true,
    });

    console.log("Clerk user password updated successfully.");
    console.log("Existing sessions were signed out.\n");
  } catch (error) {
    console.error("Failed to update Clerk password:", (error as Error).message);
    printClerkApiErrors(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteAdmin(clerkUid: string) {
  try {
    console.log(`Deleting Super Admin account with Clerk UID: ${clerkUid}...`);

    const user = await prisma.user.findUnique({
      where: { clerkUid },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      console.error(`User with Clerk UID ${clerkUid} not found`);
      process.exit(1);
    }

    const isSuperAdmin = user.userRoles.some(
      (ur) => ur.role.isSystemRole === true,
    );
    if (!isSuperAdmin) {
      console.error(
        `User ${clerkUid} is not a Super Admin (no isSystemRole=true role)`,
      );
      process.exit(1);
    }

    await prisma.user.delete({
      where: { clerkUid },
    });

    console.log(`Super Admin account ${clerkUid} deleted successfully\n`);
  } catch (error) {
    console.error("Failed to delete admin:", (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function printHelp() {
  console.log(`
KinderCare CLI - Super Admin Management
----------------------------------------

Usage:
  npm run cli:create-admin              # Interactive mode
  npm run cli:create-admin -- --email=admin@example.com --name="Admin Name"
  npm run cli:list-admins               # List all Super Admins
  npm run cli:delete-admin -- --clerk-uid=user_abc123
  npm run cli:update-admin-password -- --email=admin@example.com --password-stdin
  npm run cli:update-clerk-password -- --email=user@example.com --password-stdin

Options:
  --email=<email>         Super Admin email for Clerk (required for create)
  --name=<name>           Full name for Clerk (required for create)
  --password-stdin        Read the Clerk password from stdin (optional for create)
  --role-id=<uuid>        Custom UUID for Super Admin role (optional)
  --clerk-uid=<uid>       Clerk UID (optional for create, required for delete)
  --phone=<phone>         Phone number (optional)

Note: In the new schema, User only stores clerkUid and isActive.
      Email/name/phone are stored in Clerk, not in the database.
      If no password is provided, user must use Clerk's password reset.

Super Admin Role:
  - Default ID: ${DEFAULT_SUPER_ADMIN_ROLE_ID}
  - Custom ID can be set with --role-id (must be valid UUID v4)
  - Has isSystemRole=true (grants global admin bypass)
  - Has campusId=null (global, not campus-scoped)

Examples:
  # Create Super Admin with password read from stdin
  printf '%s' "$NEW_PASSWORD" | npm run cli:create-admin -- --email=admin@kindercare.com --name="John Doe" --password-stdin

  # Create Super Admin with custom role UUID
  npm run cli:create-admin -- --email=admin@kindercare.com --name="John Doe" --role-id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

  # Create Super Admin without password (will need to reset via Clerk)
  npm run cli:create-admin -- --email=admin@kindercare.com --name="John Doe"

  # Create Super Admin with existing Clerk UID
  npm run cli:create-admin -- --email=admin@test.com --name="Test Admin" --clerk-uid=user_abc123

  # List all Super Admins (finds all users with isSystemRole=true)
  npm run cli:list-admins

  # Delete Super Admin by Clerk UID
  npm run cli:delete-admin -- --clerk-uid=user_abc123

  # Update Super Admin password on Clerk
  printf '%s' "$NEW_PASSWORD" | npm run cli:update-admin-password -- --email=admin@kindercare.com --password-stdin
  printf '%s' "$NEW_PASSWORD" | npm run cli:update-admin-password -- --clerk-uid=user_abc123 --password-stdin

  # Update any Clerk user password
  printf '%s' "$NEW_PASSWORD" | npm run cli:update-clerk-password -- --email=user@example.com --password-stdin
  printf '%s' "$NEW_PASSWORD" | npm run cli:update-clerk-password -- --clerk-uid=user_abc123 --password-stdin
`);
}

// Parse command line arguments
export function parseArgs(
  args: string[] = process.argv.slice(2),
): ParsedAdminCliArgs {
  const parsed: ParsedAdminCliArgs = { command: "create" };

  args.forEach((arg) => {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("--email=")) {
      parsed.email = arg.slice("--email=".length);
    } else if (arg.startsWith("--name=")) {
      parsed.name = arg.slice("--name=".length);
    } else if (arg.startsWith("--clerk-uid=")) {
      parsed.clerkUid = arg.slice("--clerk-uid=".length);
    } else if (arg.startsWith("--phone=")) {
      parsed.phone = arg.slice("--phone=".length);
    } else if (arg.startsWith("--password=")) {
      throw new Error(
        "Plaintext password arguments are not supported; use --password-stdin",
      );
    } else if (arg === "--password-stdin") {
      parsed.passwordStdin = true;
    } else if (arg.startsWith("--role-id=")) {
      parsed.roleId = arg.slice("--role-id=".length);
    } else if (arg === "list") {
      parsed.command = "list";
    } else if (arg === "delete") {
      parsed.command = "delete";
    } else if (arg === "update-password") {
      parsed.command = "update-password";
    } else if (arg === "update-clerk-password") {
      parsed.command = "update-clerk-password";
    }
  });

  return parsed;
}

// Main
async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const command = process.env.CLI_COMMAND || args.command;

  if (command === "list") {
    await listAdmins();
  } else if (command === "update-password") {
    if (!args.passwordStdin || (!args.email && !args.clerkUid)) {
      console.error(
        "--password-stdin and either email or Clerk UID are required for update-password command",
      );
      console.log(
        "Usage: printf '%s' \"$NEW_PASSWORD\" | npm run cli:update-admin-password -- --email=admin@example.com --password-stdin\n",
      );
      process.exit(1);
    }
    const password = await readPasswordFromStdin();
    await updateAdminPassword({
      email: args.email,
      clerkUid: args.clerkUid,
      password,
    });
  } else if (command === "update-clerk-password") {
    if (!args.passwordStdin || (!args.email && !args.clerkUid)) {
      console.error(
        "--password-stdin and either email or Clerk UID are required for update-clerk-password command",
      );
      console.log(
        "Usage: printf '%s' \"$NEW_PASSWORD\" | npm run cli:update-clerk-password -- --email=user@example.com --password-stdin\n",
      );
      process.exit(1);
    }
    const password = await readPasswordFromStdin();
    await updateClerkPassword({
      email: args.email,
      clerkUid: args.clerkUid,
      password,
    });
  } else if (command === "delete") {
    if (!args.clerkUid) {
      console.error("Clerk UID is required for delete command");
      console.log(
        "Usage: npm run cli:delete-admin -- --clerk-uid=user_abc123\n",
      );
      process.exit(1);
    }
    await deleteAdmin(args.clerkUid);
  } else {
    // Create command
    if (!args.email || !args.name) {
      console.error("Email and name are required");
      console.log(
        'Usage: npm run cli:create-admin -- --email=admin@example.com --name="Admin Name"\n',
      );
      printHelp();
      process.exit(1);
    }

    if (args.clerkUid && args.passwordStdin) {
      throw new Error(
        "--password-stdin cannot be used when --clerk-uid references an existing Clerk user",
      );
    }

    const password = args.passwordStdin
      ? await readPasswordFromStdin()
      : undefined;

    await createAdmin({
      email: args.email,
      fullName: args.name,
      clerkUid: args.clerkUid,
      phoneNumber: args.phone,
      password,
      roleId: args.roleId,
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}
