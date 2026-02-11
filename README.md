# GongXi Mail

An API service for email retrieval using Microsoft OAuth2.

## Tech Stack

- **Backend**: Fastify 5 + TypeScript + Prisma 6
- **Database**: PostgreSQL
- **Cache**: Redis
- **Frontend**: React + Ant Design + Vite

## Project Structure

```
├── server/                 # Backend service
│   ├── src/
│   │   ├── config/        # Environment configuration
│   │   ├── lib/           # Core libraries
│   │   ├── plugins/       # Fastify plugins
│   │   ├── modules/       # Business modules
│   ├── prisma/            # Database Schema
│   └── package.json
├── web/                    # Frontend admin panel
├── docker-compose.yml
└── Dockerfile
```

## Quick Start

### Docker Deployment

```bash
docker-compose up -d --build
```

Visit http://localhost:3000

## Environment Variables

| Variable       | Description                      | Default     |
|----------------|----------------------------------|-------------|
| NODE_ENV       | Environment                      | development |
| PORT           | Port                             | 3000        |
| DATABASE_URL   | PostgreSQL connection            | -           |
| REDIS_URL      | Redis connection                 | -           |
| JWT_SECRET     | JWT secret key (>=32 chars)      | -           |
| JWT_EXPIRES_IN | Token expiration time            | 2h          |
| ENCRYPTION_KEY | Encryption key (32 chars)        | -           |
| ADMIN_USERNAME | Default admin username           | admin       |
| ADMIN_PASSWORD | Default admin password           | admin123    |

## API Documentation

### External API (`/api/*`)

Requires API Key in HTTP Header: `X-API-Key: sk_xxx`

#### Endpoint List

| Endpoint              | Description                        | Notes                                        |
|-----------------------|------------------------------------|----------------------------------------------|
| `/api/get-email`      | Get an unused email address        | Marks as used by current Key                 |
| `/api/mail_new`       | Get latest email                   | -                                            |
| `/api/mail_text`      | Get latest email text (script-friendly) | Can use regex to extract content        |
| `/api/mail_all`       | Get all emails                     | -                                            |
| `/api/process-mailbox`| Clear mailbox                      | -                                            |
| `/api/list-emails`    | Get all available system emails    | -                                            |
| `/api/pool-stats`     | Email pool statistics              | -                                            |
| `/api/reset-pool`     | Reset allocation records           | Releases all email marks held by current Key |

#### Usage Flow

1. **Get Email**:
   ```bash
   curl -X POST "/api/get-email" -H "X-API-Key: sk_xxx"
   # {"success": true, "data": {"email": "xxx@outlook.com"}}
   ```

2. **Get Email Content (Recommended)**:
   Auto-extract verification code (6 digits):
   ```bash
   curl "/api/mail_text?email=xxx@outlook.com&match=\\d{6}" -H "X-API-Key: sk_xxx"
   # Returns: 123456
   ```

3. **Get Full Email (JSON)**:
   ```bash
   curl -X POST "/api/mail_new" -H "X-API-Key: sk_xxx" \
     -d '{"email": "xxx@outlook.com"}'
   ```

#### Parameter Description

**Common Parameters**:
| Parameter | Description              |
|-----------|--------------------------|
| email     | Email address (required) |
| mailbox   | Folder: inbox/junk       |
| socks5    | SOCKS5 proxy             |
| http      | HTTP proxy               |

**`/api/mail_text` Specific Parameters**:
| Parameter | Description                                        |
|-----------|----------------------------------------------------|
| match     | Regular expression to extract specific content (e.g. `\d{6}`) |

## License

MIT