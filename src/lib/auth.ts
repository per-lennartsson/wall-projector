import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import { prisma } from './prisma';

// Login is delegated entirely to Authentik (passwordless: email code or
// passkey). There is no password login in this app anymore.
//
// Env (see .env.example):
//   BETTER_AUTH_URL / BETTER_AUTH_SECRET  read by Better Auth itself
//   AUTHENTIK_ISSUER                      https://auth.<domain>/application/o/<slug>/
//   AUTHENTIK_CLIENT_ID / _CLIENT_SECRET  from the Authentik provider
//
// The OAuth callback is <BETTER_AUTH_URL>/api/auth/callback/authentik, which
// must be registered as a redirect URI on the Authentik provider.
const issuer = (process.env.AUTHENTIK_ISSUER ?? '').replace(/\/?$/, '/');

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // Existing users have uuid ids; keep every new id the same shape.
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  account: {
    accountLinking: {
      enabled: true,
      // Authentik only lets a user in after they proved they own their email,
      // and the same email is how users are matched across apps, so an
      // existing wall-projector user is linked rather than duplicated.
      trustedProviders: ['authentik'],
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'authentik',
          clientId: process.env.AUTHENTIK_CLIENT_ID ?? '',
          clientSecret: process.env.AUTHENTIK_CLIENT_SECRET ?? '',
          discoveryUrl: `${issuer}.well-known/openid-configuration`,
          scopes: ['openid', 'profile', 'email'],
        },
      ],
    }),
  ],
});
