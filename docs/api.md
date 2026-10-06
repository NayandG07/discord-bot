# DevGuild — REST API Specification & OpenAPI Documentation

## 1. API Architecture Overview

The DevGuild Backend exposes an enterprise-grade RESTful API served through NestJS at prefix `/api/v1`.

### Key Standards
- **Contract Definition**: Fully annotated with `@nestjs/swagger` OpenAPI 3.1 specifications.
- **Envelope Standard**: Predictable JSON response envelopes with standardized pagination metadata and RFC 7807 `ProblemDetails` error structures.
- **Authentication**: Bearer JWT tokens for REST/Admin consumers; Internal Microservice Secret / HMAC headers for Discord Bot interaction endpoints.
- **Rate Limiting**: Integrated `@nestjs/throttler` policies across tier endpoints.
- **Pagination & Filtering**: Standard `page`, `limit` (default: 20, max: 100), `sortBy`, `sortOrder` (`ASC` | `DESC`), and field-specific filtering.

---

## 2. Global Response & Error Schemas

### Standard Success Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "timestamp": "2026-10-06T13:00:00.000Z"
}
```

### Standard Paginated Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 154,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "timestamp": "2026-10-06T13:00:00.000Z"
}
```

### Standard Error Response (RFC 7807)
```json
{
  "type": "https://devguild.io/errors/RESOURCE_NOT_FOUND",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "LeetCode profile for user 'nayan_dev' was not found.",
  "instance": "/api/v1/leetcode/profile/nayan_dev",
  "code": "ERR_PROFILE_NOT_FOUND",
  "timestamp": "2026-10-06T13:00:00.000Z"
}
```

---

## 3. Endpoints Matrix

### 3.1. Authentication (`/api/v1/auth`)

#### `GET /api/v1/auth/discord/login`
- **Description**: Initiates Discord OAuth2 authorization flow.
- **Responses**: 302 Redirect to Discord authorization gateway.

#### `GET /api/v1/auth/discord/callback`
- **Description**: Handles Discord OAuth2 code exchange, creates or updates `User` and `AdminUser`, and issues JWT cookies.
- **Query Params**: `code` (string), `state` (string)
- **Responses**: 200 OK with session tokens.

#### `POST /api/v1/auth/refresh`
- **Description**: Exchanges HttpOnly refresh cookie for a renewed short-lived access token.
- **Responses**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "expiresIn": 900
  }
}
```

#### `GET /api/v1/auth/me`
- **Description**: Returns authenticated user profile, permissions, and linked LeetCode status.
- **Security**: Bearer JWT (`AuthGuard`).

---

### 3.2. Users & Profiles (`/api/v1/users`)

#### `GET /api/v1/users/:id`
- **Description**: Retrieves comprehensive profile metrics for a given user.
- **Parameters**: `id` (UUID or Discord Snowflake)
- **Response**:
```json
{
  "id": "c138f31b-7a72-4bc6-a979-b1d5bf72861c",
  "discordId": "123456789012345678",
  "username": "CodeNinja",
  "reliabilityScore": 96.50,
  "currentStreak": 14,
  "longestStreak": 32,
  "rankTier": "DIAMOND",
  "totalXp": 4820,
  "leetCodeProfile": {
    "username": "codeninja99",
    "totalSolved": 342,
    "easySolved": 120,
    "mediumSolved": 182,
    "hardSolved": 40,
    "contestRating": 1845.20,
    "isVerified": true
  }
}
```

#### `GET /api/v1/users/:id/reliability`
- **Description**: Returns granular reliability breakdown (contest attendance, challenge completions, drop rate).

---

### 3.3. LeetCode Integration (`/api/v1/leetcode`)

#### `POST /api/v1/leetcode/link-init`
- **Description**: Starts verification flow; generates cryptographic token for user profile bio.
- **Request Body**:
```json
{
  "discordId": "123456789012345678",
  "leetCodeUsername": "codeninja99"
}
```
- **Response**:
```json
{
  "verificationToken": "dg-verify-7c9e2b8a",
  "instructions": "Place this token inside your LeetCode profile 'About Me' section and run verification within 15 minutes.",
  "expiresAt": "2026-10-06T13:15:00.000Z"
}
```

#### `POST /api/v1/leetcode/verify`
- **Description**: Triggers worker to verify token in LeetCode profile bio and finalize link.
- **Request Body**:
```json
{
  "discordId": "123456789012345678",
  "leetCodeUsername": "codeninja99"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Account successfully linked and verified.",
  "profile": {
    "username": "codeninja99",
    "totalSolved": 342,
    "isVerified": true
  }
}
```

#### `POST /api/v1/leetcode/unlink`
- **Description**: Unlinks LeetCode profile from user account.
- **Security**: Must be self or Guild Admin.

---

### 3.4. Activities & Feed (`/api/v1/activities`)

#### `GET /api/v1/activities`
- **Query Params**:
  - `guildId` (UUID, optional)
  - `userId` (UUID, optional)
  - `difficulty` (`EASY` | `MEDIUM` | `HARD`)
  - `topic` (`ARRAYS` | `DP` | `TREES` | etc.)
  - `page` (int, default: 1)
  - `limit` (int, default: 20)
- **Response**: Paginated array of verified `Activity` records with associated `XPTransaction`.

---

### 3.5. XP & Balancing (`/api/v1/xp`)

#### `GET /api/v1/xp/transactions`
- **Description**: Transaction ledger with filtering by `source`, `userId`, `dateFrom`, `dateTo`.

#### `POST /api/v1/xp/simulate`
- **Description**: Utility endpoint for administrators to simulate XP calculations given solve difficulty and daily solve count.
- **Request Body**:
```json
{
  "difficulty": "EASY",
  "dailyEasySolvesPrior": 5,
  "streakDays": 10
}
```
- **Response**:
```json
{
  "baseXp": 10,
  "antiFarmingMultiplier": 0.75,
  "streakMultiplier": 1.20,
  "finalXpAwarded": 9
}
```

---

### 3.6. Challenges (`/api/v1/challenges`)

#### `POST /api/v1/challenges`
- **Description**: Creates a new challenge lobby.
- **Request Body**:
```json
{
  "guildId": "d54b868a-cf8e-4a8f-b98a-7c988b49e6d1",
  "creatorDiscordId": "123456789012345678",
  "format": "TWO_V_TWO",
  "durationHours": 24,
  "intensity": "COMPETITIVE",
  "participantDiscordIds": [
    "234567890123456789",
    "345678901234567890",
    "456789012345678901"
  ]
}
```

#### `POST /api/v1/challenges/:id/vote`
- **Description**: Casts participant vote during the voting window.
- **Request Body**:
```json
{
  "discordId": "123456789012345678",
  "topicVote": "DYNAMIC_PROGRAMMING",
  "durationVoteHours": 48,
  "intensityVote": "HARDCORE"
}
```

#### `GET /api/v1/challenges/:id`
- **Description**: Returns live challenge scorecard, team contributions, time remaining, and status.

---

### 3.7. Boss Battles & Contests (`/api/v1/boss-battles`)

#### `GET /api/v1/boss-battles/active`
- **Description**: Returns ongoing or upcoming Weekly/Mega Boss Battle for a guild.
- **Response**:
```json
{
  "bossName": "The Graph Golem",
  "bossType": "WEEKLY_BOSS",
  "totalHealthPoints": 5000,
  "currentHealthPoints": 1850,
  "participantsCount": 14,
  "contestStartTime": "2026-10-11T08:00:00.000Z",
  "contestEndTime": "2026-10-11T09:30:00.000Z",
  "topRaiders": [
    { "username": "Alice", "damageDealt": 950, "problemsSolved": 3 },
    { "username": "Bob", "damageDealt": 600, "problemsSolved": 2 }
  ]
}
```

---

### 3.8. Leaderboards (`/api/v1/leaderboards`)

#### `GET /api/v1/leaderboards/:type`
- **Parameters**: `type` (`weekly` | `monthly` | `streak` | `consistency` | `improvement` | `contests`)
- **Query Params**: `guildId` (required), `limit` (default: 10)
- **Response**:
```json
{
  "type": "weekly",
  "period": "2026-W41",
  "rankings": [
    {
      "rank": 1,
      "userId": "c138f31b-7a72-4bc6-a979-b1d5bf72861c",
      "username": "CodeNinja",
      "avatarUrl": "https://cdn.discordapp.com/avatars/...",
      "metricValue": 850,
      "metricLabel": "XP",
      "rankTier": "DIAMOND",
      "trend": "+2"
    }
  ]
}
```

---

### 3.9. Seasons & Recaps (`/api/v1/seasons`, `/api/v1/recaps`)

#### `GET /api/v1/seasons/current`
- **Description**: Returns current season configuration, remaining days, and tier distribution.

#### `GET /api/v1/recaps/monthly-wrapped/:userId`
- **Query Params**: `year` (int), `month` (int)
- **Response**:
```json
{
  "userId": "c138f31b-7a72-4bc6-a979-b1d5bf72861c",
  "totalProblemsSolved": 64,
  "favoriteTopic": "DYNAMIC_PROGRAMMING",
  "longestStreak": 21,
  "bestDay": "2026-09-18",
  "contestRatingChange": "+112",
  "seasonRankAchieved": "DIAMOND",
  "cardImageUrl": "https://devguild.io/cdn/cards/wrapped-2026-09-c138.png"
}
```

---

### 3.10. Admin Control Plane (`/api/v1/admin`)
- Guarded by `SuperAdminGuard` & `GuildAdminGuard`.
- Includes endpoints for:
  - `GET /api/v1/admin/audit-logs`
  - `PATCH /api/v1/admin/guilds/:id/xp-config`
  - `POST /api/v1/admin/seasons/trigger-reset`
  - `POST /api/v1/admin/achievements`
