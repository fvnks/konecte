const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Obtener todos los usuarios
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, phone, name, is_admin, is_active, created_at, updated_at FROM users'
    );
    
    res.status(200).json({ users });
  } catch (error) {
    logger.error(`Error al obtener usuarios: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

/**
 * Obtener un usuario por ID
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [users] = await pool.query(
      'SELECT id, phone, name, is_admin, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.status(200).json({ user: users[0] });
  } catch (error) {
    logger.error(`Error al obtener usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

/**
 * Crear un nuevo usuario
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const createUser = async (req, res) => {
  try {
    const { phone, name, is_admin = false, is_active = true } = req.body;
    
    if (!phone || !name) {
      return res.status(400).json({ error: 'Teléfono y nombre son obligatorios' });
    }
    
    // Comprobar si el usuario ya existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'El número de teléfono ya está registrado' });
    }
    
    // Crear usuario
    const [result] = await pool.query(
      'INSERT INTO users (phone, name, is_admin, is_active) VALUES (?, ?, ?, ?)',
      [phone, name, is_admin, is_active]
    );
    
    res.status(201).json({
      message: 'Usuario creado con éxito',
      user_id: result.insertId
    });
  } catch (error) {
    logger.error(`Error al crear usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

/**
 * Actualizar un usuario existente
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_admin, is_active } = req.body;
    
    // Comprobar si el usuario existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Actualizar usuario
    await pool.query(
      'UPDATE users SET name = COALESCE(?, name), is_admin = COALESCE(?, is_admin), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, is_admin, is_active, id]
    );
    
    res.status(200).json({
      message: 'Usuario actualizado con éxito'
    });
  } catch (error) {
    logger.error(`Error al actualizar usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

/**
 * Eliminar un usuario
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Comprobar si el usuario existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Eliminar usuario
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    
    res.status(200).json({
      message: 'Usuario eliminado con éxito'
    });
  } catch (error) {
    logger.error(`Error al eliminar usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
}; 