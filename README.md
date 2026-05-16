# File Service

企业级文件上传服务，支持多系统上传、Token 权限管理、文件 Hash 去重（秒传）、后台管理。

## 技术栈

- **Backend**: NestJS + Fastify + TypeORM + SQLite (sql.js) + JWT + Passport
- **Frontend**: 原生 HTML + Vue 3 CDN + Axios CDN
- **数据库**: SQLite (通过 TypeORM + sql.js)

## 快速开始

```bash
cd backend

# 安装依赖
pnpm install

# 开发环境运行
pnpm start:dev

# 生产环境构建
pnpm build
pnpm start:prod
```

## 环境配置

开发环境配置文件: `backend/.env.development`
生产环境配置文件: `backend/.env.production`

关键配置项:
- `UPLOAD_BASE_DIR` - 文件上传根目录
- `DATABASE_PATH` - SQLite 数据库路径
- `BASE_URL` - 服务基础 URL
- `JWT_SECRET` - JWT 密钥
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` - 管理员账号

## API 接口

### 上传文件
```
POST /upload
Header: x-upload-token: <upload_token>
Body: multipart/form-data (file)

返回: { code: 0, data: { duplicated, fileName, relativePath, fullUrl, size, hash } }
```

### 管理员登录
```
POST /auth/login
Body: { username, password }

返回: { code: 0, data: { access_token } }
```

### 文件管理（需要 JWT）
```
GET    /admin/files          分页查询 ?page=1&limit=20
DELETE /admin/files/:id      删除文件（含物理文件）
```

### Token 管理（需要 JWT）
```
POST   /admin/tokens              创建 Token
GET    /admin/tokens              分页查询
PATCH  /admin/tokens/:id/disable  禁用 Token
PATCH  /admin/tokens/:id/enable   启用 Token
PATCH  /admin/tokens/:id/rotate   轮换 Token
DELETE /admin/tokens/:id          删除 Token
```

## 核心功能

1. **Upload Token 管理**: 后台生成、禁用、启用、轮换、删除
2. **文件 Hash 去重**: SHA256 哈希校验，重复文件直接秒传
3. **按日期存储**: 自动按 年/月/日 组织文件目录
4. **JWT 后台认证**: 管理接口需要 JWT Token
5. **多环境切换**: 开发环境 / 生产环境配置分离
6. **完整后台管理**: 文件管理 + Token 管理前端界面

## 页面

- `/` - 首页
- `/client.html` - 文件上传客户端
- `/login.html` - 管理员登录
- `/admin.html` - 管理后台

## 目录结构

```
file-service/
├── DEVELOPMENT_PROGRESS.md
├── README.md
├── .gitignore
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── common/
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   ├── guards/
│   │   │   └── utils/
│   │   ├── entities/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── upload/
│   │   │   ├── admin-files/
│   │   │   └── admin-tokens/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env.development
│   ├── .env.production
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
└── frontend/
    ├── index.html
    ├── client.html
    ├── login.html
    └── admin.html
```
