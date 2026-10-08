import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export default {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-ignore - NextAuth user type doesn't have role by default
        token.role = user.role || "USER";
      }
      // Strictly enforce that only ayomide.ayoola6866@gmail.com has ADMIN role
      if (token.email?.toLowerCase() === "ayomide.ayoola6866@gmail.com") {
        token.role = "ADMIN";
      } else {
        token.role = "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        // @ts-ignore
        session.user.role = token.email?.toLowerCase() === "ayomide.ayoola6866@gmail.com" ? "ADMIN" : "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig

