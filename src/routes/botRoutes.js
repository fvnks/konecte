const express = require('express');
const botController = require('../controllers/botController');
const { authenticateApiKey } = require('../middlewares/apiKeyAuthMiddleware');

const router = express.Router();

/**
 * @route GET /api/bot/status
 * @description Obtener el estado actual del bot de WhatsApp
 * @access Private
 */
router.get('/status', authenticateApiKey, botController.getStatus);

/**
 * @route POST /api/bot/restart
 * @description Reiniciar el bot de WhatsApp
 * @access Private
 */
router.post('/restart', authenticateApiKey, botController.restartBot);

/**
 * @route POST /api/bot/logout
 * @description Cerrar sesión del bot de WhatsApp
 * @access Private
 */
router.post('/logout', authenticateApiKey, botController.logout);

/**
 * @route POST /api/bot/send-message
 * @description Enviar un mensaje a través del bot
 * @access Private
 */
router.post('/send-message', authenticateApiKey, botController.sendMessage);

/**
 * @route GET /api/bot/qr-code
 * @description Obtener el código QR actual para la autenticación
 * @access Private
 */
router.get('/qr-code', authenticateApiKey, botController.getQrCode);

module.exports = router; 