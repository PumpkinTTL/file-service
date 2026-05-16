export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  uploadBaseDir: process.env.UPLOAD_BASE_DIR || 'E:\\uploads',
  databasePath: process.env.DATABASE_PATH || 'E:\\file-service.db',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800,
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,zip,rar,mp4,mp3',
});
