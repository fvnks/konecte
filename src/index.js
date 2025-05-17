const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { initializeDatabase } = require('./config/database');
const whatsappService = require('./services/whatsappService');
const logger = require('./config/logger');

// Carga de variables de entorno
dotenv.config();

// Creación de la aplicación Express
const app = express();
// const PORT = process.env.PORT || 3000; // PORT se usará solo si es el script principal

// Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger de solicitudes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Servir archivos estáticos desde el directorio 'views'
app.use(express.static(path.join(__dirname, 'views')));

// Importación de rutas
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const settingRoutes = require('./routes/settingRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const botRoutes = require('./routes/botRoutes');

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/bot', botRoutes);

// Endpoint raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API del Bot de WhatsApp para Propiedades Inmobiliarias',
    status: 'running'
  });
});

// Ruta para la página de generación de claves API
app.get('/api-keys', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'apiKey.html'));
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  logger.error(`Error no controlado: ${err.message}`);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Función de inicialización para tests y para el inicio real
const initializeApp = async () => {
  try {
    // Inicializar base de datos y crear tablas
    await initializeDatabase();
    logger.info('Base de datos inicializada.');

    // Comprobar si WhatsApp está habilitado en el entorno
    const isWhatsAppEnabled = process.env.ENABLE_WHATSAPP === 'true';
    
    if (!isWhatsAppEnabled) {
      logger.info('La funcionalidad de WhatsApp está deshabilitada en la configuración (initializeApp).');
      return; // No inicializar WhatsApp si está deshabilitado
    }
    
    // Comprobar si el bot debe iniciarse automáticamente
    // Esta lógica podría ser condicional en tests para evitar arrancar WhatsApp innecesariamente
    if (process.env.NODE_ENV !== 'test') { // No iniciar WhatsApp automáticamente en modo test
        const { pool } = require('./config/database'); // Mover require aquí para evitarlo en tests si no se usa
        const [botActiveSetting] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['BOT_ACTIVE']);
        
        if (botActiveSetting[0]?.value === 'true') {
          logger.info('Bot configurado como activo, inicializando WhatsApp (initializeApp)...');
          whatsappService.initializeWhatsApp(); // No se espera (await) para no bloquear
        } else {
          logger.info('Bot configurado como inactivo en la configuración (initializeApp).');
        }
    } else {
        logger.info('Modo TEST: Inicialización de WhatsApp omitida en initializeApp.');
    }

  } catch (error) {
    logger.error(`Error durante la inicialización de la aplicación: ${error.message}`);
    // No salir del proceso aquí, permitir que el llamador maneje el error
    // process.exit(1); 
    throw error; // Re-lanzar para que el llamador (tests o script principal) lo maneje
  }
};

// Manejo de excepciones no capturadas y rechazos de promesas
// Estos deben estar en el script principal, no necesariamente aquí si solo se exporta 'app'
// process.on('uncaughtException', ...);
// process.on('unhandledRejection', ...);

// Iniciar el servidor solo si este script es el principal
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initializeApp().then(() => {
    app.listen(PORT, () => {
      logger.info(`Servidor ejecutándose en el puerto ${PORT}`);
    });
  }).catch(error => {
    logger.error(`Error al iniciar el servidor principal: ${error.message}`);
    process.exit(1);
  });

  // Manejo de excepciones no capturadas
  process.on('uncaughtException', (error) => {
    logger.error(`Excepción no capturada: ${error.message}`);
    // Considerar un cierre más gradual en producción
    process.exit(1); 
  });

  // Manejo de rechazos de promesas no controlados
  process.on('unhandledRejection', (reason, promise) => {
    // En desarrollo, es útil saber sobre estos. En producción, podría ser solo log.
    logger.error(`Rechazo de promesa no controlado: ${reason instanceof Error ? reason.message : reason}`);
  });

}

module.exports = { app, initializeApp }; // Exportar app para Supertest e initializeApp 