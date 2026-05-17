# MEMORY.md - 项目长期记忆

## 项目概况
- **项目名**: File Service
- **描述**: 企业级通用文件上传服务，支持多系统上传、Token 权限管理、文件 Hash 去重（秒传）、后台管理
- **技术栈**: NestJS + Fastify + TypeORM + SQLite (sql.js) + JWT + Passport
- **前端**: 原生 HTML + Vue 3 CDN + Axios CDN

## 核心功能
1. Upload Token 管理（创建、禁用、启用、轮换、删除）
2. SHA256 文件 Hash 去重（秒传）
3. 按年/月/日自动归档
4. JWT 后台认证
5. 多环境配置（开发/生产）
6. 完整后台管理前端界面

## 开发状态
- ✅ 开发完成，全部接口测试通过
- 当前无未解决问题

## 关键文件
- 后端入口: `backend/src/main.ts`
- 路由页面: `/` (首页)、`/client.html` (上传)、`/login.html` (登录)、`/admin.html` (管理后台)
