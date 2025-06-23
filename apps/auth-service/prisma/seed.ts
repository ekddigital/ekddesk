import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

// Load environment variables from root .env file
const envPath = "../../.env";
console.log("Loading .env from:", envPath);
const dotenvResult = dotenv.config({ path: envPath });
console.log("Dotenv result:", dotenvResult);
console.log("SEED_DEFAULT_PASSWORD:", process.env.SEED_DEFAULT_PASSWORD);

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Get configuration from environment variables
  const password = process.env.SEED_DEFAULT_PASSWORD;
  const saltRounds = parseInt(process.env.SEED_BCRYPT_ROUNDS || "10");

  if (!password) {
    throw new Error("SEED_DEFAULT_PASSWORD environment variable is required");
  }

  console.log(`🔐 Using bcrypt rounds: ${saltRounds}`);

  // Delete existing users (optional - remove if you want to keep existing data)
  await prisma.user.deleteMany({});
  console.log("🗑️  Cleared existing users");

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create users
  const users = [
    {
      email: "ekd@ekddigital.com",
      firstName: "Enoch",
      lastName: "Kwateh Dongbo",
      role: "SUPER_ADMIN" as const,
    },
    {
      email: "patie@ekddigital.com",
      firstName: "Patience",
      lastName: "Dongbo",
      role: "USER" as const,
    },
    {
      email: "john@ekddigital.com",
      firstName: "John",
      lastName: "Smith",
      role: "USER" as const,
    },
    {
      email: "sarah@ekddigital.com",
      firstName: "Sarah",
      lastName: "Johnson",
      role: "USER" as const,
    },
    {
      email: "mike@ekddigital.com",
      firstName: "Mike",
      lastName: "Davis",
      role: "USER" as const,
    },
  ];

  console.log("👥 Creating users...");

  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash: hashedPassword,
      },
    });
    console.log(
      `✅ Created user: ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`
    );
  }

  console.log("\n🎉 Database seeding completed successfully!");
  console.log(`\n📝 All users have the password: ${password}`);
  console.log("\n👤 Available users:");

  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  allUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log("");
  });
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
