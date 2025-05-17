const whatsappService = require('../services/whatsappService');
const logger = require('../config/logger');

/**
 * Obtener el estado de conexión del bot
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getStatus = async (req, res) => {
  try {
    const status = whatsappService.getConnectionState();
    res.status(200).json({ status });
  } catch (error) {
    logger.error(`Error al obtener estado del bot: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener estado del bot' });
  }
};

/**
 * Reiniciar la conexión de WhatsApp
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const restartBot = async (req, res) => {
  try {
    logger.info('Solicitud para reiniciar el bot de WhatsApp recibida.');
    
    const result = await whatsappService.restartClient();
    
    if (result.success) {
      res.status(200).json({ message: result.message || 'Bot reiniciado con éxito' });
    } else {
      res.status(400).json({ error: result.error || 'No se pudo reiniciar el bot' });
    }
  } catch (error) {
    logger.error(`Error al reiniciar el bot de WhatsApp: ${error.message}`);
    res.status(500).json({ error: 'Error interno al reiniciar el bot' });
  }
};

/**
 * Cerrar sesión del bot de WhatsApp
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const logout = async (req, res) => {
  try {
    const result = await whatsappService.logout();
    
    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error al cerrar sesión del bot: ${error.message}`);
    res.status(500).json({ error: 'Error al cerrar sesión del bot' });
  }
};

/**
 * Enviar un mensaje a través del bot
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const sendMessage = async (req, res) => {
  try {
    const { jid, message } = req.body;
    
    if (!jid || !message) {
      return res.status(400).json({ error: 'Se requieren ID de WhatsApp (jid) y mensaje' });
    }
    
    const result = await whatsappService.sendMessage(jid, message);
    
    if (result.success) {
      res.status(200).json({ message: 'Mensaje enviado con éxito' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error al enviar mensaje: ${error.message}`);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
};

/**
 * Obtener el código QR para la autenticación
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getQrCode = async (req, res) => {
  try {
    const { state, qr } = whatsappService.getConnectionState();
    
    if (state === 'qr-ready' && qr) {
      res.status(200).json({ qr });
    } else {
      res.status(404).json({ error: 'Código QR no disponible actualmente' });
    }
  } catch (error) {
    logger.error(`Error al obtener código QR: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener código QR' });
  }
};

module.exports = {
  getStatus,
  restartBot,
  logout,
  sendMessage,
  getQrCode
}; 