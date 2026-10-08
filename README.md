# DevGuild — Discord-Native LeetCode Community Platform

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![Discord.js](https://img.shields.io/badge/discord.js-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.js.org/)

DevGuild is an enterprise-grade, Discord-native competitive programming and accountability platform engineered specifically for LeetCode communities, university coding clubs, and developer circles.

Unlike simple scraping bots that measure raw question counters, DevGuild introduces a full **Coding Guild Operating System** with anti-farming XP balancing, team challenges, weekly Boss Battles (tied to official LeetCode contests), dynamic achievement progression, and 90-day seasonal resets.

---

## 📚 Complete Architectural Documentation

The repository includes complete technical architectural specifications:

1. 🌟 [**Master Features & System Architecture Guide**](docs/FEATURES_AND_SYSTEM_GUIDE.md) — Complete guide covering all features, XP economy, RPG hierarchy, contest raids, slash commands, and resilience mechanisms.
2. [**Project Context & Philosophy**](docs/context.md) — Core vision, philosophy, and community operating model.
3. [**Architecture Blueprint**](docs/architecture.md) — High-level system topology, decoupled worker vs bot architecture, security model, and resilience strategies.
3. [**Database Specification**](docs/database.md) — Complete data dictionary, 20+ models, foreign key relationships, composite indexes, and partitioning strategy.
4. [**API Specification**](docs/api.md) — REST API specifications, Swagger OpenAPI models, DTOs, query parameters, and error envelopes.
5. [**Discord UX Design**](docs/discord-ux.md) — Slash command hierarchy, interactive buttons, modal dialogs, rank color themes, and Canvas card specifications.
6. [**Challenge Engine**](docs/challenge-engine.md) — Finite state machine, dynamic 3-axis voting, scoring formula, and sub-linear elastic uneven team normalization ($K_1^{0.75}$).
7. [**Achievement Engine**](docs/achievement-engine.md) — Reactive event-driven evaluation, extensible JSON criteria parser, and 20+ built-in achievements.
8. [**Contest & Boss Battle Engine**](docs/contest-engine.md) — Weekly and Biweekly Contest raid bosses, dynamic HP scaling, damage formulas, and raid MVP bonuses.
9. [**Season System**](docs/season-system.md) — 90-day competitive seasons, soft MMR reset compression formula, and Hall of Fame snapshot generation.
10. [**Redis Specification**](docs/redis.md) — Keyspace conventions, cache invalidation, Redlock distributed locking, and Pub/Sub.
11. [**BullMQ Queues**](docs/bullmq.md) — Queue definitions, recurring cron schedules, worker contracts, and retry policies.
12. [**Deployment Guide**](docs/deployment.md) — Ubuntu provisioning, Nginx reverse proxy configuration, disaster recovery, and automated database backups.
13. [**Implementation Roadmap**](docs/roadmap.md) — 6-phase engineering roadmap with verification gates.

---

## 🛠️ Tech Stack

- **Framework**: NestJS (Modular Monolith architecture)
- **Language**: TypeScript (Node.js 20+)
- **Database**: PostgreSQL 16
- **ORM**: Prisma Client
- **Cache & Locks**: Redis 7 Alpine with Redlock
- **Task Queues**: BullMQ
- **Bot Library**: Discord.js v14
- **Graphic Cards**: `@napi-rs/canvas`
- **Orchestration**: Docker & Docker Compose

---

## 🚀 Quickstart & Local Development

### 1. Environment Setup
```bash
cp .env.example .env
# Edit .env with your PostgreSQL, Redis, and Discord Bot credentials
```

### 2. Launch with Docker Compose
```bash
# Build and run Postgres, Redis, API, Discord Bot, and BullMQ Workers
docker compose up -d
```

### 3. Database Migration & Seeding
```bash
# Run database migrations
docker compose exec api npx prisma migrate deploy

# Seed initial achievements and XP configs
docker compose exec api npx prisma db seed
```

### 4. Access REST API & Swagger Docs
- REST API Base: `http://localhost:3000/api/v1`
- Swagger Documentation: `http://localhost:3000/docs`

---

## 🧪 Running Automated Tests

```bash
# Run unit tests (Anti-farming, Challenge normalization, Reliability, Achievements)
npm test

# Run tests with coverage
npm run test:cov
```
