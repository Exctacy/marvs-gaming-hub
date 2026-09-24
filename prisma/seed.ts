import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  // System settings
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      businessName: "MARVS Gaming Hub",
      systemName: "Gaming Hub Management System",
    },
  });

  // Branches
  const main = await prisma.branch.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Main Branch",
      code: "MAIN",
      address: "123 Gaming Street, Metro City",
      active: true,
    },
  });

  const north = await prisma.branch.upsert({
    where: { code: "NORTH" },
    update: {},
    create: {
      name: "North Hub",
      code: "NORTH",
      address: "456 North Avenue",
      active: true,
    },
  });

  // Super admin
  const { hash: saHash, salt: saSalt } = hashPassword("Admin@123!");
  await prisma.staffProfile.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      passwordHash: saHash,
      salt: saSalt,
      mustChangePassword: false,
      fullName: "System Super Admin",
      email: "admin@marvsgaming.local",
      role: "super_admin",
      status: "active",
      activatedAt: new Date(),
      createdByName: "system",
    },
  });

  // Branch admin
  const { hash: aHash, salt: aSalt } = hashPassword("Admin@123!");
  await prisma.staffProfile.upsert({
    where: { username: "main.admin" },
    update: {},
    create: {
      username: "main.admin",
      passwordHash: aHash,
      salt: aSalt,
      mustChangePassword: false,
      fullName: "Main Branch Admin",
      role: "admin",
      branchId: main.id,
      status: "active",
      activatedAt: new Date(),
      createdByName: "system",
    },
  });

  // Counter admin (must change password)
  const { hash: cHash, salt: cSalt } = hashPassword("TempPass1!");
  await prisma.staffProfile.upsert({
    where: { username: "counter1" },
    update: {},
    create: {
      username: "counter1",
      passwordHash: cHash,
      salt: cSalt,
      mustChangePassword: true,
      fullName: "Counter Staff One",
      role: "counter_admin",
      branchId: main.id,
      status: "active",
      activatedAt: new Date(),
      createdByName: "system",
    },
  });

  // Tech
  const { hash: tHash, salt: tSalt } = hashPassword("Tech@123!");
  await prisma.staffProfile.upsert({
    where: { username: "tech1" },
    update: {},
    create: {
      username: "tech1",
      passwordHash: tHash,
      salt: tSalt,
      mustChangePassword: false,
      fullName: "Computer Tech One",
      role: "computer_tech",
      branchId: main.id,
      status: "active",
      activatedAt: new Date(),
      createdByName: "system",
    },
  });

  // Default config for main
  await prisma.gamingHubConfig.upsert({
    where: { branchId: main.id },
    update: {},
    create: {
      branchId: main.id,
      standardPcs: JSON.stringify(["PC-01", "PC-02", "PC-03", "PC-04", "PC-05", "PC-06", "PC-07", "PC-08"]),
      vipPcs: JSON.stringify(["VIP-01", "VIP-02", "VIP-03", "VIP-04"]),
      games: JSON.stringify(["Valorant", "League of Legends", "CS2", "Dota 2", "Mobile Legends", "Genshin Impact"]),
      gameStatuses: JSON.stringify(["Online", "Offline", "Maintenance", "Update Required"]),
      shiftPcs: JSON.stringify({
        Opening: ["PC-01", "PC-02", "PC-03", "VIP-01"],
        Mid: ["PC-04", "PC-05", "PC-06", "VIP-02"],
        Night: ["PC-07", "PC-08", "VIP-03", "VIP-04"],
      }),
      spareTypes: JSON.stringify(["Keyboard", "Mouse", "Headset", "Monitor", "GPU", "RAM"]),
      peripheralBrands: JSON.stringify({
        Keyboard: ["Logitech", "Razer", "HyperX", "SteelSeries"],
        Mouse: ["Logitech", "Razer", "Zowie", "Finalmouse"],
        Headset: ["HyperX", "Razer", "Logitech", "SteelSeries"],
        Monitor: ["ASUS", "LG", "BenQ", "Samsung"],
      }),
    },
  });

  // Config for north
  await prisma.gamingHubConfig.upsert({
    where: { branchId: north.id },
    update: {},
    create: {
      branchId: north.id,
      standardPcs: JSON.stringify(["N-PC-01", "N-PC-02", "N-PC-03", "N-PC-04"]),
      vipPcs: JSON.stringify(["N-VIP-01", "N-VIP-02"]),
      games: JSON.stringify(["Valorant", "League of Legends", "CS2"]),
      gameStatuses: JSON.stringify(["Online", "Offline", "Maintenance"]),
      shiftPcs: JSON.stringify({ Opening: [], Mid: [], Night: [] }),
      spareTypes: JSON.stringify(["Keyboard", "Mouse", "Headset"]),
      peripheralBrands: JSON.stringify({
        Keyboard: ["Logitech", "Razer"],
        Mouse: ["Logitech", "Razer"],
        Headset: ["HyperX", "Razer"],
      }),
    },
  });

  console.log("Seed completed successfully.");
  console.log("Accounts:");
  console.log("  superadmin / Admin@123!  (super_admin)");
  console.log("  main.admin / Admin@123!  (admin @ MAIN)");
  console.log("  counter1 / TempPass1!    (counter_admin, must change password)");
  console.log("  tech1 / Tech@123!        (computer_tech @ MAIN)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
