const express = require('express');
const groupController = require('../controllers/groupController');
const { authenticateApiKey } = require('../middlewares/apiKeyAuthMiddleware'); // Asumiendo autenticación por API Key

const router = express.Router();

/**
 * @route GET /api/groups
 * @description Obtener todos los grupos de WhatsApp permitidos
 * @access Private (requiere API Key)
 */
router.get('/', authenticateApiKey, groupController.getAllGroups);

/**
 * @route GET /api/groups/:id
 * @description Obtener un grupo específico por su ID de base de datos
 * @access Private (requiere API Key)
 */
router.get('/:id', authenticateApiKey, groupController.getGroupById);

/**
 * @route POST /api/groups
 * @description Crear un nuevo grupo de WhatsApp permitido
 * @access Private (requiere API Key)
 */
router.post('/', authenticateApiKey, groupController.createGroup);

/**
 * @route PUT /api/groups/:id
 * @description Actualizar un grupo de WhatsApp existente (nombre, estado activo/inactivo)
 * @access Private (requiere API Key)
 */
router.put('/:id', authenticateApiKey, groupController.updateGroup);

/**
 * @route DELETE /api/groups/:id
 * @description Eliminar un grupo de WhatsApp permitido
 * @access Private (requiere API Key)
 */
router.delete('/:id', authenticateApiKey, groupController.deleteGroup);

module.exports = router; 