const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Middleware para autenticar solicitudes con clave API
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 * @param {Function} next - Función para pasar al siguiente middleware
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    // Obtener la clave API del encabezado o del query parameter
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Se requiere una clave API' });
    }
    
    // Verificar si la clave API existe en la base de datos y está activa
    const [apiKeyResult] = await pool.query(
      'SELECT id, is_active, expires_at FROM api_keys WHERE api_key = ?',
      [apiKey]
    );
    
    if (apiKeyResult.length === 0) {
      logger.warn(`Intento de acceso con clave API inválida: ${apiKey}`);
      return res.status(401).json({ error: 'Clave API inválida' });
    }
    
    const { is_active, expires_at } = apiKeyResult[0];
    
    // Comprobar si la clave API está activa
    if (!is_active) {
      logger.warn(`Intento de acceso con clave API inactiva: ${apiKey}`);
      return res.status(403).json({ error: 'Clave API inactiva' });
    }
    
    // Comprobar si la clave API no ha expirado
    if (expires_at && new Date(expires_at) < new Date()) {
      logger.warn(`Intento de acceso con clave API expirada: ${apiKey}`);
      return res.status(403).json({ error: 'Clave API expirada' });
    }
    
    // Si todo está bien, continuar con la siguiente función de middleware
    next();
  } catch (error) {
    logger.error(`Error en autenticación de clave API: ${error.message}`);
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

module.exports = {
  authenticateApiKey
}; 