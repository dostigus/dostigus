import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./.data/cluster.sqlite',
  },
  strict: true,
  verbose: true,
})
