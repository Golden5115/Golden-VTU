import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import prisma from "@/lib/prisma"
import authConfig from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null

        const rawIdentifier = (credentials.identifier as string).trim()
        const password = credentials.password as string

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: rawIdentifier.toLowerCase() },
              { phone: rawIdentifier },
            ],
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
          return null
        }

        if (user.isSuspended) {
          throw new Error("This account has been suspended.")
        }

        return user
      },
    }),
  ],
})

