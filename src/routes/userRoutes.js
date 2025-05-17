const express = require('express');
const userController = require('../controllers/userController');
// const { authenticateApiKey } = require('../middlewares/apiKeyAuthMiddleware');
// const { validateUserData } = require('../middlewares/validationMiddleware');

const router = express.Router();

/**
 * @route GET /api/users
 * @description Obtener todos los usuarios
 * @access Private
 */
router.get('/', userController.getAllUsers);

/**
 * @route GET /api/users/:id
 * @description Obtener un usuario por ID
 * @access Private
 */
router.get('/:id', userController.getUserById);

/**
 * @route POST /api/users
 * @description Crear un nuevo usuario
 * @access Private
 */
router.post('/', userController.createUser);

/**
 * @route PUT /api/users/:id
 * @description Actualizar un usuario existente
 * @access Private
 */
router.put('/:id', userController.updateUser);

/**
 * @route DELETE /api/users/:id
 * @description Eliminar un usuario
 * @access Private
 */
router.delete('/:id', userController.deleteUser);

module.exports = router; 