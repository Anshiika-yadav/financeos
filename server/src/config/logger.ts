import winston from 'winston';
import { config } from './index';

export const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.env === 'development'
      ? winston.format.colorize()
      : winston.format.json(),
    config.env === 'development'
      ? winston.format.simple()
      : winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
