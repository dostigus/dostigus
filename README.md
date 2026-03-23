# 🪿 Достигусь / Dostigus

**Self-hosted, open-source personal media tracker with AI recommendations and achievements.**

Track books, music, movies, games — all in one place. Your AI Goose knows your taste.

## Features

- **Unified catalog** — books, music, movies, games in one place
- **AI Goose** — cross-media recommendations with explanations (Claude, OpenAI, Ollama)
- **Achievement system** — gamification with static and AI-generated achievements
- **Self-hosted** — your data, your server, your rules
- **i18n** — Russian and English out of the box

## Tech Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript, Nuxt UI v4, Tailwind CSS v4
- **Backend:** Nitro (built into Nuxt)
- **Database:** PostgreSQL, Drizzle ORM
- **Auth:** nuxt-auth-utils
- **Deploy:** Docker, Kubernetes

## Getting Started

### Prerequisites

- Node.js >= 24.14.0
- pnpm >= 10.32.1
- Docker (for PostgreSQL)

### Setup

```bash
# Clone the repo
git clone https://github.com/dostigus/dostigus.git
cd dostigus

# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d

# Copy environment variables
cp apps/web-app/.env.example apps/web-app/.env
cp packages/database/.env.example packages/database/.env

# Generate database migrations
pnpm --filter @dostigus/database db:generate

# Start dev server
pnpm --filter @dostigus/web-app dev
```

## Project Structure

```
├── apps/
│   └── web-app/          # Nuxt fullstack application
├── packages/
│   └── database/         # Drizzle ORM schema & migrations
├── docker/
│   └── web-app/          # Production Dockerfile
├── k8s/                  # Kubernetes manifests
├── docker-compose.yml    # Dev PostgreSQL
└── .env.example          # Environment variables template
```

## Contributing

Contributions are welcome! Please read our contributing guide before submitting a PR.

## License

[MIT](LICENSE)
