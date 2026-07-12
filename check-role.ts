import prisma from "./src/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "ayomide.ayoola6866@gmail.com" }
  });
  console.log("USER ROLE IS:", user?.role);
}

main().catch(console.error);
