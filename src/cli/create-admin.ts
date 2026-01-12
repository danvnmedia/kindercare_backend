#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";

const prisma = new PrismaClient();

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface AdminInput {
  email: string;
  fullName: string;
  clerkUid?: string;
  phoneNumber?: string;
}

async function createClerkUser(
  email: string,
  fullName: string,
  phoneNumber?: string,
): Promise<string> {
  try {
    console.log("Creating user on Clerk...");

    // Check if CLERK_SECRET_KEY exists
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is not set in .env file");
    }

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
      skipPasswordRequirement: true, // No password required initially
      publicMetadata: { fullName: fullName.trim() },
    });

    console.log(`User created on Clerk with UID: ${clerkUser.id}`);
    return clerkUser.id;
  } catch (error) {
    console.error("\nFailed to create user on Clerk");
    console.error("Error details:", JSON.stringify(error, null, 2));

    // Check specific error types
    if ((error as any).errors) {
      console.error("\nClerk API Errors:");
      (error as any).errors.forEach((err: any) => {
        console.error(`  - ${err.message} (${err.code})`);
        if (err.meta) {
          console.error(`    Meta:`, err.meta);
        }
      });
    }

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
    console.log("Creating admin account...");

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
        );
      }
    } else {
      console.log(`Using provided Clerk UID: ${clerkUid}`);
    }

    // 3. Find or create ADMIN role
    let adminRole = await prisma.role.findUnique({
      where: { id: "admin" },
    });

    if (!adminRole) {
      console.log("Creating ADMIN role...");
      adminRole = await prisma.role.create({
        data: {
          id: "admin",
          name: "ADMIN",
          description: "System Administrator",
          isSystemDefault: true,
          isSystemRole: true, // Grants global admin bypass
          permissions: {
            users: ["create", "read", "update", "delete"],
            students: ["create", "read", "update", "delete"],
            staff: ["create", "read", "update", "delete"],
            classes: ["create", "read", "update", "delete"],
            roles: ["create", "read", "update", "delete"],
          },
        },
      });
      console.log("ADMIN role created with isSystemRole=true");
    } else if (!adminRole.isSystemRole) {
      // Update existing admin role to have isSystemRole=true
      console.log("Updating existing ADMIN role to set isSystemRole=true...");
      adminRole = await prisma.role.update({
        where: { id: "admin" },
        data: { isSystemRole: true, isSystemDefault: true },
      });
      console.log("ADMIN role updated with isSystemRole=true");
    }

    // 4. Create admin user in database (User only has clerkUid and isActive)
    console.log("Saving admin user to database...");
    const adminUser = await prisma.user.create({
      data: {
        clerkUid: clerkUid,
        isActive: true,
        userRoles: {
          create: {
            roleId: adminRole.id,
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

    console.log("\nAdmin account created successfully!");
    console.log("----------------------------------------");
    console.log(`Email (Clerk):  ${input.email}`);
    console.log(`Full Name:      ${input.fullName}`);
    console.log(`User ID:        ${adminUser.id}`);
    console.log(`Clerk UID:      ${adminUser.clerkUid}`);
    console.log(
      `Roles:          ${adminUser.userRoles.map((ur) => ur.role.name).join(", ")}`,
    );
    console.log(
      `Status:         ${adminUser.isActive ? "Active" : "Inactive"}`,
    );
    console.log("----------------------------------------\n");

    if (!input.clerkUid) {
      console.log("Note: User was automatically created on Clerk.");
      console.log("   The user can now login using their email.\n");
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
    console.log("Listing all admin accounts...\n");

    // Find all users with admin role through UserRole join table
    const adminUsers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            roleId: "admin",
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
      console.log("No admin accounts found.\n");
      return;
    }

    console.log("----------------------------------------");
    adminUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. Admin User`);
      console.log(`   ID:        ${user.id}`);
      console.log(`   Clerk UID: ${user.clerkUid}`);
      console.log(
        `   Roles:     ${user.userRoles.map((ur) => ur.role.name).join(", ")}`,
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

async function deleteAdmin(clerkUid: string) {
  try {
    console.log(`Deleting admin account with Clerk UID: ${clerkUid}...`);

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

    const isAdmin = user.userRoles.some((ur) => ur.role.id === "admin");
    if (!isAdmin) {
      console.error(`User ${clerkUid} is not an admin`);
      process.exit(1);
    }

    await prisma.user.delete({
      where: { clerkUid },
    });

    console.log(`Admin account ${clerkUid} deleted successfully\n`);
  } catch (error) {
    console.error("Failed to delete admin:", (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function printHelp() {
  console.log(`
KinderCare CLI - Admin Management
----------------------------------------

Usage:
  npm run cli:create-admin              # Interactive mode
  npm run cli:create-admin -- --email=admin@example.com --name="Admin Name"
  npm run cli:list-admins               # List all admins
  npm run cli:delete-admin -- --clerk-uid=user_abc123

Options:
  --email=<email>         Admin email for Clerk (required for create)
  --name=<name>           Full name for Clerk (required for create)
  --clerk-uid=<uid>       Clerk UID (optional for create, required for delete)
  --phone=<phone>         Phone number (optional)

Note: In the new schema, User only stores clerkUid and isActive.
      Email/name/phone are stored in Clerk, not in the database.

Examples:
  # Create admin with Clerk auto-creation
  npm run cli:create-admin -- --email=admin@kindercare.com --name="John Doe"

  # Create admin with existing Clerk UID
  npm run cli:create-admin -- --email=admin@test.com --name="Test Admin" --clerk-uid=user_abc123

  # List all admins
  npm run cli:list-admins

  # Delete admin by Clerk UID
  npm run cli:delete-admin -- --clerk-uid=user_abc123
`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: any = { command: "create" };

  args.forEach((arg) => {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("--email=")) {
      parsed.email = arg.split("=")[1];
    } else if (arg.startsWith("--name=")) {
      parsed.name = arg.split("=")[1];
    } else if (arg.startsWith("--clerk-uid=")) {
      parsed.clerkUid = arg.split("=")[1];
    } else if (arg.startsWith("--phone=")) {
      parsed.phone = arg.split("=")[1];
    } else if (arg === "list") {
      parsed.command = "list";
    } else if (arg === "delete") {
      parsed.command = "delete";
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

    await createAdmin({
      email: args.email,
      fullName: args.name,
      clerkUid: args.clerkUid,
      phoneNumber: args.phone,
    });
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
