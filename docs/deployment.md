# DevGuild — Production Deployment & Infrastructure Guide

## 1. System Requirements & Hardware Sizing

| Sizing Tier | Discord Users / Servers | CPU Cores | RAM | Storage | Replicas |
|---|---|---|---|---|---|
| **Starter** | Up to 5,000 users / 20 servers | 2 vCPU | 4 GB | 50 GB NVMe | 1 API, 1 Bot, 1 Worker |
| **Standard** | Up to 25,000 users / 100 servers | 4 vCPU | 8 GB | 120 GB NVMe | 2 API, 1 Bot Shard, 3 Workers |
| **Enterprise** | 100,000+ users / 500+ servers | 8+ vCPU | 16+ GB | 250+ GB NVMe | 4 API, Multi-Sharded Bot, 6+ Workers |

---

## 2. Infrastructure Architecture & Network Topology

```
[ Internet Traffic ]
        │
        ▼ (Port 80 / 443)
[ Cloudflare CDN & DDoS Shield ]
        │
        ▼ (Port 443 with TLS)
[ Nginx Reverse Proxy / Load Balancer ]
        │
   ┌────┴───────────────────────────┐
   ▼ (Port 3000)                    ▼ (WSS)
[ NestJS API Cluster ]     [ Discord Gateway ] ◀─── (Bot Shards)
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
   +---------------------------------------+
   |  Private Docker Network (devguild)    |
   |   • Redis 7 Alpine (Port 6379)        |
   |   • PostgreSQL 16 (Port 5432)         |
   |   • BullMQ Worker Cluster             |
   +---------------------------------------+
```

---

## 3. Step-by-Step Provisioning Guide

### 3.1. Server Setup (Ubuntu 22.04 LTS / Debian 12)
```bash
# Update base system packages
sudo apt update && sudo apt upgrade -y

# Install Docker Engine & Docker Compose Plugin
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker daemon on boot
sudo systemctl enable --now docker
```

### 3.2. Project Configuration & Secret Management
```bash
# Clone repository
git clone https://github.com/DevGuild/discord-bot.git /opt/devguild
cd /opt/devguild

# Create production environment file from template
cp .env.example .env

# Generate secure random secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASS=$(openssl rand -hex 16)
REDIS_PASS=$(openssl rand -hex 16)

# Inject secrets into .env
sed -i "s/super_secret_jwt_key_at_least_32_characters_long/$JWT_SECRET/" .env
sed -i "s/super_secret_refresh_jwt_key_at_least_32_chars/$JWT_REFRESH_SECRET/" .env
sed -i "s/devguild_secure_pass_2026/$POSTGRES_PASS/g" .env
sed -i "s/redis_secure_pass_2026/$REDIS_PASS/g" .env

# Configure your Discord Bot credentials
nano .env # Set DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN, etc.
```

### 3.3. Build & Orchestration Launch
```bash
# Build multi-stage images
docker compose build --no-cache

# Start persistence services first
docker compose up -d postgres redis

# Wait for database health check and run migrations
docker compose exec -T api npx prisma migrate deploy

# Run initial database seed (achievements and default XP configs)
docker compose exec -T api npx prisma db seed

# Bring up remaining services (API, Bot, Worker)
docker compose up -d
```

---

## 4. Production Nginx Reverse Proxy Configuration

Place at `/etc/nginx/sites-available/devguild.conf`:

```nginx
server {
    listen 80;
    server_name api.devguild.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.devguild.io;

    ssl_certificate /etc/letsencrypt/live/api.devguild.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.devguild.io/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

---

## 5. Automated Database Backup & Disaster Recovery

Create backup script at `/usr/local/bin/devguild-backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/devguild"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose -f /opt/devguild/docker-compose.yml exec -T postgres pg_dump -U devguild_user devguild_db | gzip > "$FILENAME"

# Retain last 14 days of backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
```

Set up daily cron job via `crontab -e`:
```cron
0 3 * * * /usr/local/bin/devguild-backup.sh >/dev/null 2>&1
```

---

## 6. Observability, Metrics & Health Checks

- **Application Health**: `GET /api/v1/health` reports status of PostgreSQL connection, Redis ping, and BullMQ job latency.
- **Error Tracking**: Integrated Sentry SDK via `@sentry/node` capturing unhandled rejections and worker failures.
- **Prometheus Metrics**: Exposes HTTP request rates, active challenge count, queue backlog sizes at `/api/v1/metrics`.

---

## 7. 100% Free Tier Hosting Guide (Supabase + Render / Koyeb + Redis Cloud)

For communities wishing to run DevGuild with $0 monthly cloud costs, follow this verified architecture:

### 7.1. Database Setup: Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** $\to$ **Database** $\to$ **Connection string**:
   - Select **Mode: Session / Transaction (Port 6543)** and copy the URI into `DATABASE_URL`.
   - Select **Mode: Direct (Port 5432)** and copy the URI into `DIRECT_URL`.
3. In your local repository or deployment pipeline, deploy migrations to Supabase:
   ```bash
   npx prisma migrate deploy
   npx ts-node prisma/seed.ts
   ```

### 7.2. Cache & BullMQ: Redis Cloud
1. Create a free 30MB instance at [redis.io/try-free](https://redis.io/try-free/).
2. Copy the public host endpoint, port, and password into your environment variables:
   ```env
   REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
   REDIS_PORT=12345
   REDIS_PASSWORD=your_redis_cloud_password
   ```

### 7.3. Application & Discord Bot: Render / Koyeb (Single Process)
1. Deploy as a **Web Service** pointing to your Git repository or Dockerfile.
2. In the service environment variables, enable combined mode:
   ```env
   COMBINED_MODE=true
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=... (Supabase transaction pooler URI)
   DIRECT_URL=... (Supabase direct URI)
   REDIS_HOST=... (Redis Cloud host)
   REDIS_PORT=...
   REDIS_PASSWORD=...
   DISCORD_BOT_TOKEN=...
   DISCORD_CLIENT_ID=...
   JWT_SECRET=...
   ```
3. Build Command: `npm install && npx prisma generate && npm run build`
4. Start Command: `npm run start:prod`
   - *Note*: In `COMBINED_MODE=true`, `main.ts` automatically runs the REST API, launches the Discord Bot Gateway connection, and spawns the BullMQ worker threads in a single lightweight Node.js runtime.

### 7.4. 24/7 Keep-Alive via UptimeRobot
Render Free Web Services spin down after 15 minutes of inactivity. To prevent the bot from disconnecting:
1. Create a free account at [uptimerobot.com](https://uptimerobot.com).
2. Add a new **HTTP(s) Monitor**:
   - **URL**: `https://your-service-name.onrender.com/api/v1/health`
   - **Monitoring Interval**: 10 minutes (or 5 minutes).
3. UptimeRobot will ping the health endpoint continuously, keeping the Docker container active and the Discord WebSocket Gateway connected 24 hours a day, 7 days a week.
