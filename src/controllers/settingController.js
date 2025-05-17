const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Obtener todas las configuraciones
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getAllSettings = async (req, res) => {
  try {
    const [settings] = await pool.query(
      'SELECT id, key_name, value, description, created_at, updated_at FROM settings'
    );
    // Para claves sensibles, podríamos querer ocultar o enmascarar el valor aquí
    // Por ejemplo, si tuviéramos GEMINI_API_KEY en la DB:
    // settings = settings.map(s => s.key_name === 'GEMINI_API_KEY' ? { ...s, value: '********' } : s);
    res.status(200).json({ settings });
  } catch (error) {
    logger.error(`Error al obtener configuraciones: ${error.message}`);
    res.status(500).json({ error: 'Error interno al obtener configuraciones' });
  }
};

/**
 * Obtener una configuración específica por su key_name
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getSettingByKey = async (req, res) => {
  try {
    const { key_name } = req.params;
    const [setting] = await pool.query(
      'SELECT id, key_name, value, description, created_at, updated_at FROM settings WHERE key_name = ?',
      [key_name]
    );

    if (setting.length === 0) {
      return res.status(404).json({ error: `Configuración con clave '${key_name}' no encontrada` });
    }
    // Considerar enmascarar valores sensibles también aquí
    res.status(200).json(setting[0]);
  } catch (error) {
    logger.error(`Error al obtener configuración por clave: ${error.message}`);
    res.status(500).json({ error: 'Error interno al obtener la configuración' });
  }
};

/**
 * Crear o actualizar una configuración (Upsert)
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const upsertSetting = async (req, res) => {
  try {
    const { key_name, value, description } = req.body;

    if (!key_name || value === undefined) { // value puede ser una cadena vacía
      return res.status(400).json({ error: 'Los campos key_name y value son obligatorios' });
    }

    // No permitir modificar ciertas claves sensibles directamente desde aquí si están en .env
    // Por ejemplo, las credenciales de la base de datos o JWT_SECRET
    const protectedKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET']; 
    if (protectedKeys.includes(key_name.toUpperCase())) {
        logger.warn(`Intento de modificar clave protegida: ${key_name}`);
        return res.status(403).json({ error: `La clave de configuración '${key_name}' es protegida y no puede ser modificada por esta vía.` });
    }

    const [result] = await pool.query(
      'INSERT INTO settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, description = IFNULL(?, description)',
      [key_name, value, description, value, description]
    );

    if (result.affectedRows === 0 && result.insertId === 0) { // No insertó ni actualizó (caso raro)
        return res.status(500).json({ error: 'No se pudo guardar la configuración' });
    }
    
    const action = result.insertId !== 0 ? 'creada' : 'actualizada';

    res.status(result.insertId !== 0 ? 201 : 200).json({
      message: `Configuración '${key_name}' ${action} con éxito`,
      id: result.insertId || (await pool.query('SELECT id FROM settings WHERE key_name = ?', [key_name]))[0][0].id,
      key_name,
      value
    });
  } catch (error) {
    logger.error(`Error al guardar configuración: ${error.message}`);
    res.status(500).json({ error: 'Error interno al guardar la configuración' });
  }
};


/**
 * Eliminar una configuración
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const deleteSetting = async (req, res) => {
  try {
    const { key_name } = req.params;

    const protectedKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'GEMINI_API_KEY', 'GOOGLE_SHEET_ID', 'BOT_ACTIVE', 'GEMINI_PROMPT', 'SHEET_HEADERS'];
    if (protectedKeys.includes(key_name.toUpperCase())) {
      logger.warn(`Intento de eliminar clave protegida/esencial: ${key_name}`);
      return res.status(403).json({ error: `La clave de configuración '${key_name}' es esencial y no puede ser eliminada.` });
    }

    const [result] = await pool.query(
      'DELETE FROM settings WHERE key_name = ?',
      [key_name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `Configuración con clave '${key_name}' no encontrada` });
    }

    res.status(200).json({ message: `Configuración '${key_name}' eliminada con éxito` });
  } catch (error) {
    logger.error(`Error al eliminar configuración: ${error.message}`);
    res.status(500).json({ error: 'Error interno al eliminar la configuración' });
  }
};


module.exports = {
  getAllSettings,
  getSettingByKey,
  upsertSetting,
  deleteSetting
}; 