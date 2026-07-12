import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard') || 
                      req.nextUrl.pathname.startsWith('/wallet') || 
                      req.nextUrl.pathname.startsWith('/airtime') || 
                      req.nextUrl.pathname.startsWith('/data') || 
                      req.nextUrl.pathname.startsWith('/transactions') ||
                      req.nextUrl.pathname.startsWith('/admin');
  
  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
