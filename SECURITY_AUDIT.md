# File Service 安全 + 完善度审计报告

> 审计时间: 2026-05-17
> 审计范围: backend/src/ 全部 31 个源文件 + 4 个前端文件 + 配置文件

---

## 🔴 CRITICAL — 必须立即修复

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| 1 | **CORS 全开** | `main.ts:39` | `app.enableCors()` 无任何限制，任意域名都能调接口 |
| 2 | **无速率限制** | 全局 | 没有 `@nestjs/throttler`，`/auth/login` 可被暴力破解 |
| 3 | **无安全头** | `main.ts` | 没有 `@fastify/helmet`，缺 CSP、X-Frame-Options、HSTS 等 |
| 4 | **前端硬编码 Upload Token** | `client.html:883` | `var token = ref('fs_0a511...')` 源码里直接写死了一个真实 token |
| 5 | **TypeORM `synchronize: true`** | `app.module.ts:35` | 生产环境会自动改表结构，可能丢数据 |
| 6 | **生产配置占位符** | `.env.production` | `JWT_SECRET=replace-with-production-secret`、`ADMIN_PASSWORD=replace-with-strong-password` 没换成真值 |

---

## ⚠️ HIGH — 尽快修复

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| 7 | **管理员密码明文比对** | `auth.service.ts` | 没用 bcrypt/argon2，直接 `===` 比较明文 |
| 8 | **代码里有硬编码默认密钥** | `configuration.ts` | `JWT_SECRET` 默认 `your-super-secret-jwt-key-2026`，如果 .env 没加载就生效 |
| 9 | **Passport JwtStrategy 是死代码** | `jwt.strategy.ts` | 注册了但 `JwtAuthGuard` 是手动 verify，Strategy 从未被使用 |
| 10 | **MIME 类型只校验扩展名** | `upload.controller.ts` | `data.filename.split('.').pop()` — 改个扩展名就能绕过 |
| 11 | **Joi 环境变量校验没接入** | `env.validation.ts` | 定义了 Schema 但 `ConfigModule` 没配 `validationSchema`，等于白写 |
| 12 | **JWT 存 localStorage** | `admin.html` | 有 XSS 风险，建议 HttpOnly Cookie |
| 13 | **生产数据库配置待确认** | `app.module.ts` vs `.env.production` | 代码写死 `type: 'mysql'`，确保 `.env.production` 配置了完整的 MySQL 连接参数 |
| 14 | **Source Map 生产暴露** | `tsconfig.json` | `sourceMap: true` 会把 `.js.map` 打到 dist/ |

---

## 🟡 MEDIUM — 值得改进

| # | 问题 | 说明 |
|---|------|------|
| 15 | 无请求日志 | 没有 pino/morgan，审计追踪缺失 |
| 16 | 无 CSRF 防护 | JWT 方案部分缓解，但登录表单没保护 |
| 17 | 三个无用依赖 | `multer`、`fastify-multer`、`crypto`(npm包) 都没用到 |
| 18 | TypeScript 不够严格 | `strictNullChecks: false`、`noImplicitAny: false` |
| 19 | 分片合并用 `readFileSync` | 大文件全读内存，可能 OOM |
| 20 | 无测试 | `test` 脚本只输出 `no test specified` |
| 21 | `.env.development` / `.env.production` 未 gitignore | 只有 `.env` 被 ignore，`.env.*` 没有 |
| 22 | `JwtAuthGuard` 接受无 Bearer 前缀的 token | 不标准，可能被滥用 |
| 23 | 异常过滤器泄露非 HTTP 异常的原始 message | `err.message` 直接返回客户端 |

---

## ✅ 做得好的地方

| 项目 | 说明 |
|------|------|
| Upload Token 哈希存储 | 只存 SHA256，创建时返回一次原文 |
| Token 生命周期管理 | 禁用、轮换、过期、IP 追踪都有 |
| 文件 Hash 去重 | SHA256 秒传 + 服务端二次校验 |
| 全局 ValidationPipe | `whitelist: true` 防批量赋值 |
| DTO 校验 | class-validator 用在所有入口 |
| 文件名 UUID 重命名 | 用户文件名不参与路径构建，防路径穿越 |
| 上传大小多级限制 | Fastify body + multipart + 应用层三重限制 |

---

## 📋 修复优先级建议

### P0 (现在就做)
1. CORS 配白名单 → `app.enableCors({ origin: ['https://your-domain.com'], credentials: true })`
2. 装 `@fastify/helmet` → 注册安全头
3. 装 `@nestjs/throttler` → 限流（登录接口重点）
4. 删掉 `client.html` 里硬编码的 token
5. `.env.production` 换真实密钥

### P1 (尽快)
6. 管理员密码改 bcrypt
7. `synchronize: false` + 写迁移脚本
8. MIME 魔数校验（装 `file-type` 包）
9. 接入 Joi 环境变量校验（`validationSchema` 接入 `ConfigModule`）
10. 关掉生产 source map

### P2 (有空做)
11. 清理死依赖：`multer`、`fastify-multer`、`crypto` npm 包
12. 加请求日志（pino）
13. 严格化 TypeScript
14. 分片合并改流式写入
15. 写测试
16. `.gitignore` 加 `.env.*`
17. JWT 改 HttpOnly Cookie
18. `JwtAuthGuard` 统一走 Passport

---

## 📁 审计涉及文件清单

### 后端源码 (backend/src/)
```
config/configuration.ts          — 配置工厂 + 硬编码默认值
config/env.validation.ts         — Joi 校验 Schema（未接入）
main.ts                          — CORS/安全头/限流/全局管道
app.module.ts                    — TypeORM synchronize: true

modules/auth/auth.module.ts      — JWT + Passport 注册
modules/auth/auth.controller.ts  — POST /auth/login
modules/auth/auth.service.ts     — 明文密码比对
modules/auth/jwt.strategy.ts     — 死代码，未被使用
modules/auth/constants.ts        — 死代码，硬编码密钥回退
modules/auth/dto/login.dto.ts    — 登录 DTO

modules/upload/upload.controller.ts  — 上传路由 + MIME 扩展名校验
modules/upload/upload.service.ts     — 上传逻辑 + 磁盘写入
modules/upload/upload.module.ts      — 模块注册
modules/upload/dto/check-upload.dto.ts
modules/upload/dto/merge-chunks.dto.ts

modules/admin-files/admin-files.controller.ts
modules/admin-files/admin-files.service.ts  — 硬删除（非软删除）
modules/admin-files/admin-files.module.ts

modules/admin-tokens/admin-tokens.controller.ts
modules/admin-tokens/admin-tokens.service.ts  — Token CRUD + 哈希存储
modules/admin-tokens/admin-tokens.module.ts
modules/admin-tokens/dto/token.dto.ts

common/guards/jwt-auth.guard.ts       — 自定义 JWT 守卫（未用 Passport）
common/guards/upload-token.guard.ts   — Upload Token 守卫（设计良好）
common/filters/http-exception.filter.ts
common/interceptors/transform.interceptor.ts
common/utils/file-hash.util.ts
common/utils/date-path.util.ts

entities/file.entity.ts           — 含 @DeleteDateColumn 但未使用
entities/upload-token.entity.ts
entities/upload-session.entity.ts
```

### 配置文件
```
backend/.env                      — 开发环境（同 .env.development）
backend/.env.development          — 弱密码 + 硬编码密钥
backend/.env.production           — 占位符密钥
backend/package.json              — 无安全依赖、无测试框架
backend/tsconfig.json             — sourceMap: true
```

### 前端文件
```
frontend/client.html              — 硬编码 Upload Token
frontend/admin.html               — JWT 存 localStorage
frontend/login.html               — 登录表单
frontend/index.html               — 首页
```
