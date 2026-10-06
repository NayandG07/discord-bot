# DevGuild — Technical Documentation Index

Welcome to the comprehensive technical documentation for **DevGuild**, an enterprise-grade, Discord-native competitive LeetCode community platform.

---

## 📑 Documentation Directory

### 1. Overview & Vision
| Document | Description |
| :--- | :--- |
| [**Project Context & Philosophy**](context.md) | Product mission, community accountability principles, anti-grinding philosophy, and core scope. |
| [**Architecture Blueprint**](architecture.md) | High-level system topology, decoupled worker vs bot architecture, security model, and resilience strategies. |
| [**Implementation Roadmap**](roadmap.md) | 6-phase engineering roadmap, deliverables, and validation verification gates. |

### 2. Core Game & Community Engines
| Document | Description |
| :--- | :--- |
| [**Challenge Engine**](challenge-engine.md) | Finite state machine (FSM), 3-axis dynamic voting, scoring formulas, and sub-linear elastic team normalization. |
| [**Contest & Boss Battle Engine**](contest-engine.md) | Weekly/Biweekly contest raid bosses, dynamic HP scaling, damage calculation, and MVP bonuses. |
| [**Achievement Engine**](achievement-engine.md) | Event-driven reactive evaluation, JSON criteria parser, and 20+ built-in achievement definitions. |
| [**Season System**](season-system.md) | 90-day competitive seasons, soft MMR reset compression formula, and Hall of Fame snapshot generation. |

### 3. Technical Specifications & Infrastructure
| Document | Description |
| :--- | :--- |
| [**Database Specification**](database.md) | Data dictionary, 20+ Prisma models, foreign key relationships, composite indexes, and partitioning strategy. |
| [**API Specification**](api.md) | NestJS REST API specifications, Swagger OpenAPI models, DTOs, query parameters, and error envelopes. |
| [**Redis Specification**](redis.md) | Keyspace naming conventions, cache invalidation, Redlock distributed locking, and Pub/Sub mechanics. |
| [**BullMQ Queues**](bullmq.md) | Queue topologies, recurring cron schedules, worker contracts, and retry policies. |
| [**Deployment Guide**](deployment.md) | Ubuntu provisioning, Docker Compose orchestration, Nginx reverse proxy, disaster recovery, and automated backups. |

### 4. User Experience & Interfaces
| Document | Description |
| :--- | :--- |
| [**Discord UX Design**](discord-ux.md) | Slash command hierarchy, interactive buttons, modal dialogs, rank color themes, and Canvas cards. |

---

*For local development and setup instructions, refer to the [Root README](../README.md).*
