import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.CATALOG_DATABASE_URL ?? 'file:./.data/catalog.sqlite',
  },
  strict: true,
  verbose: true,
})
