const express = require('express');
const settingController = require('../controllers/settingController');
const { authenticateApiKey } = require('../middlewares/apiKeyAuthMiddleware'); // Asumiendo autenticación por API Key para configuraciones también

const router = express.Router();

/**
 * @route GET /api/settings
 * @description Obtener todas las configuraciones
 * @access Private (requiere API Key)
 */
router.get('/', authenticateApiKey, settingController.getAllSettings);

/**
 * @route GET /api/settings/:key_name
 * @description Obtener una configuración específica por su nombre de clave
 * @access Private (requiere API Key)
 */
router.get('/:key_name', authenticateApiKey, settingController.getSettingByKey);

/**
 * @route POST /api/settings
 * @description Crear o actualizar una configuración (Upsert). El body debe contener { key_name, value, description? }
 * @access Private (requiere API Key)
 */
router.post('/', authenticateApiKey, settingController.upsertSetting);

/**
 * @route PUT /api/settings/:key_name 
 * @description Actualizar una configuración (alias para POST con key_name en la ruta para claridad, usa upsert)
 *              El body debe contener { value, description? }
 * @access Private (requiere API Key)
 */
router.put('/:key_name', authenticateApiKey, async (req, res) => {
    // Adaptar para que coincida con la lógica de upsertSetting, pasando key_name del path
    req.body.key_name = req.params.key_name;
    settingController.upsertSetting(req, res);
});


/**
 * @route DELETE /api/settings/:key_name
 * @description Eliminar una configuración por su nombre de clave
 * @access Private (requiere API Key)
 */
router.delete('/:key_name', authenticateApiKey, settingController.deleteSetting);

module.exports = router; 