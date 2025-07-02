/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_ADMIN_API_URL: string;
  readonly AUTH0_DOMAIN: string;
  readonly AUTH0_AUDIENCE: string;
  readonly AUTH0_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user?: import('./middleware/admin-auth').AdminUser;
  }
}