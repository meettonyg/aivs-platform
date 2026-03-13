import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@aivs/db';
import { verifyPassword } from '@/lib/crypto';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as never,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email);
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.passwordHash) return null;

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: string }).role ?? 'user';
      }

      // On sign-in or when role not yet in token, fetch from DB
      if (token.userId && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { role: true },
        });
        token.role = dbUser?.role ?? 'user';
      }

      // Handle impersonation
      if (token.impersonatingUserId) {
        const impersonated = await prisma.user.findUnique({
          where: { id: token.impersonatingUserId as string },
          select: { id: true, email: true, name: true, role: true },
        });
        if (impersonated) {
          token.impersonatedUser = impersonated;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      if (token.impersonatedUser && session.user) {
        const imp = token.impersonatedUser as { id: string; email: string; name: string | null; role: string };
        user.id = imp.id;
        user.email = imp.email;
        user.name = imp.name;
        user.role = imp.role;
        user.isImpersonating = true;
        user.originalUserId = token.userId;
      } else if (session.user) {
        user.id = token.userId as string;
        user.role = token.role as string;
        user.isImpersonating = false;
      }
      return session;
    },
  },
});
