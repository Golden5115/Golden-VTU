import prisma from "./src/lib/prisma";

async function main() {
  const email = "ayomide.ayoola6866@gmail.com";
  
  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`Successfully promoted ${user.email} to ADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Cannot disconnect adapter directly without special handling sometimes, but we'll try
    // @ts-ignore
    await prisma.$disconnect();
  });
