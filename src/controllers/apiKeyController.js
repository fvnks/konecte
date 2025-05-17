const { pool } = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const moment = require('moment');

/**
 * Generar una clave API segura
 * @returns {string} - Nueva clave API generada
 */
const generateApiKey = () => {
  // Generar una clave API usando UUID + random bytes para mayor seguridad
  const uuid = uuidv4();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `pk_${uuid}_${randomBytes}`;
};

/**
 * Obtener todas las claves API
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getAllApiKeys = async (req, res) => {
  try {
    const [apiKeys] = await pool.query(
      'SELECT id, api_key, description, is_active, created_at, expires_at FROM api_keys'
    );
    
    res.status(200).json({ apiKeys });
  } catch (error) {
    logger.error(`Error al obtener claves API: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener claves API' });
  }
};

/**
 * Crear una nueva clave API
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const createApiKey = async (req, res) => {
  try {
    const { description, expires_at = null } = req.body;
    logger.debug(`[createApiKey] Recibido: description=${description}, expires_at=${expires_at}`);
    
    // Generar nueva clave API
    const apiKey = generateApiKey();
    
    // Formatear expires_at si se proporciona
    let formattedExpiresAt = null;
    if (expires_at) {
      if (!moment(expires_at).isValid()) {
        logger.warn(`Fecha de expiración inválida recibida: ${expires_at}`);
        return res.status(400).json({ error: 'Formato de fecha de expiración inválido.' });
      }
      formattedExpiresAt = moment(expires_at).format('YYYY-MM-DD HH:mm:ss');
      logger.debug(`[createApiKey] expires_at formateado: ${formattedExpiresAt}`);
    }
    
    // Insertar clave API en la base de datos
    const [result] = await pool.query(
      'INSERT INTO api_keys (api_key, description, is_active, expires_at) VALUES (?, ?, TRUE, ?)',
      [apiKey, description, formattedExpiresAt]
    );
    
    res.status(201).json({
      message: 'Clave API creada con éxito',
      api_key: apiKey,
      id: result.insertId
    });
  } catch (error) {
    logger.error(`Error al crear clave API: ${error.message}`);
    res.status(500).json({ error: 'Error al crear clave API' });
  }
};

/**
 * Activar o desactivar una clave API
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const toggleApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (is_active === undefined) {
      return res.status(400).json({ error: 'Se requiere el campo is_active' });
    }
    
    // Verificar si la clave API existe
    const [existingKey] = await pool.query('SELECT id FROM api_keys WHERE id = ?', [id]);
    
    if (existingKey.length === 0) {
      return res.status(404).json({ error: 'Clave API no encontrada' });
    }
    
    // Actualizar estado de la clave API
    await pool.query(
      'UPDATE api_keys SET is_active = ? WHERE id = ?',
      [is_active, id]
    );
    
    res.status(200).json({
      message: `Clave API ${is_active ? 'activada' : 'desactivada'} con éxito`
    });
  } catch (error) {
    logger.error(`Error al actualizar clave API: ${error.message}`);
    res.status(500).json({ error: 'Error al actualizar clave API' });
  }
};

/**
 * Eliminar una clave API
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si la clave API existe
    const [existingKey] = await pool.query('SELECT id FROM api_keys WHERE id = ?', [id]);
    
    if (existingKey.length === 0) {
      return res.status(404).json({ error: 'Clave API no encontrada' });
    }
    
    // Eliminar la clave API
    await pool.query('DELETE FROM api_keys WHERE id = ?', [id]);
    
    res.status(200).json({
      message: 'Clave API eliminada con éxito'
    });
  } catch (error) {
    logger.error(`Error al eliminar clave API: ${error.message}`);
    res.status(500).json({ error: 'Error al eliminar clave API' });
  }
};

/**
 * Validar una clave API
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const validateApiKey = async (req, res) => {
  try {
    const { api_key } = req.params;
    
    if (!api_key) {
      return res.status(400).json({ error: 'Se requiere la clave API' });
    }
    
    // Verificar si la clave API existe y está activa
    const [apiKeyData] = await pool.query(
      'SELECT id, is_active, expires_at FROM api_keys WHERE api_key = ?', 
      [api_key]
    );
    
    if (apiKeyData.length === 0) {
      return res.status(404).json({ valid: false, error: 'Clave API no encontrada' });
    }
    
    const { is_active, expires_at } = apiKeyData[0];
    
    // Verificar si la clave está activa
    if (!is_active) {
      return res.status(403).json({ valid: false, error: 'Clave API inactiva' });
    }
    
    // Verificar si la clave no ha expirado
    if (expires_at && new Date(expires_at) < new Date()) {
      return res.status(403).json({ valid: false, error: 'Clave API expirada' });
    }
    
    res.status(200).json({ valid: true });
  } catch (error) {
    logger.error(`Error al validar clave API: ${error.message}`);
    res.status(500).json({ valid: false, error: 'Error al validar clave API' });
  }
};

module.exports = {
  getAllApiKeys,
  createApiKey,
  toggleApiKey,
  deleteApiKey,
  validateApiKey
}; 