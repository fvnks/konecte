const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Definir formato de log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(
    ({ level, message, timestamp, stack }) => 
      `${timestamp} [${level.toUpperCase()}]: ${message} ${stack ? '\n' + stack : ''}`
  )
);

// Obtener nivel de log desde variable de entorno o usar valor predeterminado
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Comprobar si el logging a archivo está habilitado
const enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';

// Crear array de transportes
const transports = [
  // Transporte de consola para todos los logs
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

// Añadir transportes de archivo si están habilitados
if (enableFileLogging) {
  // Transporte de archivo para logs de error
  transports.push(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
  
  // Transporte de archivo para todos los logs
  transports.push(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
}

// Crear instancia del logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'whatsapp-bot' },
  transports: transports
});

module.exports = logger; 