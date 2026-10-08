import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

// Ensure production domain is used when deployed on Vercel or in production
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  const prodDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL 
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://ctnwallet.vercel.app";

  if (!process.env.AUTH_URL || process.env.AUTH_URL.includes("localhost")) {
    process.env.AUTH_URL = prodDomain;
  }
  if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost")) {
    process.env.NEXTAUTH_URL = prodDomain;
  }
}

export default {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
      const targetBase = (isProd && (baseUrl.includes("localhost") || !baseUrl))
        ? "https://ctnwallet.vercel.app"
        : baseUrl;

      // Allows relative callback URLs: e.g. "/dashboard", "/login"
      if (url.startsWith("/")) {
        return `${targetBase}${url}`;
      }

      try {
        const parsedUrl = new URL(url);
        // Prevent redirecting to localhost in production
        if (isProd && parsedUrl.origin.includes("localhost")) {
          return `${targetBase}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
        }
        // Allows callback URLs on the same origin
        if (parsedUrl.origin === targetBase || parsedUrl.origin === baseUrl) {
          return url;
        }
      } catch {}

      return targetBase;
    },
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

