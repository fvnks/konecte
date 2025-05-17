const express = require('express');
const apiKeyController = require('../controllers/apiKeyController');
const { authenticateApiKey } = require('../middlewares/apiKeyAuthMiddleware');

const router = express.Router();

/**
 * @route GET /api/api-keys
 * @description Obtener todas las claves API
 * @access Private
 */
router.get('/', apiKeyController.getAllApiKeys);

/**
 * @route POST /api/api-keys
 * @description Crear una nueva clave API
 * @access Private
 */
router.post('/', apiKeyController.createApiKey);

/**
 * @route PUT /api/api-keys/:id
 * @description Activar/desactivar una clave API
 * @access Private
 */
router.put('/:id', apiKeyController.toggleApiKey);

/**
 * @route DELETE /api/api-keys/:id
 * @description Eliminar una clave API
 * @access Private
 */
router.delete('/:id', apiKeyController.deleteApiKey);

/**
 * @route GET /api/api-keys/validate/:api_key
 * @description Validar una clave API
 * @access Public
 */
router.get('/validate/:api_key', apiKeyController.validateApiKey);

module.exports = router; 