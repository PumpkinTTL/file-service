import * as Joi from 'joi';

export const envValidation = {
  validate: {
    NODE_ENV: Joi.string().valid('development', 'production').default('development'),
    PORT: Joi.number().default(3000),
    UPLOAD_BASE_DIR: Joi.string().required(),
    DATABASE_PATH: Joi.string().required(),
    BASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('7d'),
    ADMIN_USERNAME: Joi.string().required(),
    ADMIN_PASSWORD: Joi.string().required(),
    MAX_FILE_SIZE: Joi.number().default(52428800),
    ALLOWED_FILE_TYPES: Joi.string().required(),
  },
};
