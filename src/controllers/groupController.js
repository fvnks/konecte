const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Obtener todos los grupos de WhatsApp permitidos
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getAllGroups = async (req, res) => {
  try {
    const [groups] = await pool.query(
      'SELECT id, group_id, group_name, is_active, created_at, updated_at FROM whatsapp_groups'
    );
    res.status(200).json({ groups });
  } catch (error) {
    logger.error(`Error al obtener grupos: ${error.message}`);
    res.status(500).json({ error: 'Error interno al obtener grupos' });
  }
};

/**
 * Obtener un grupo específico por su ID de base de datos
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const [group] = await pool.query(
      'SELECT id, group_id, group_name, is_active, created_at, updated_at FROM whatsapp_groups WHERE id = ?',
      [id]
    );

    if (group.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    res.status(200).json(group[0]);
  } catch (error) {
    logger.error(`Error al obtener grupo por ID: ${error.message}`);
    res.status(500).json({ error: 'Error interno al obtener grupo' });
  }
};

/**
 * Crear un nuevo grupo de WhatsApp permitido
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const createGroup = async (req, res) => {
  try {
    const { group_id, group_name } = req.body;

    if (!group_id || !group_name) {
      return res.status(400).json({ error: 'Los campos group_id y group_name son obligatorios' });
    }

    // Verificar si el group_id ya existe
    const [existingGroup] = await pool.query('SELECT id FROM whatsapp_groups WHERE group_id = ?', [group_id]);
    if (existingGroup.length > 0) {
      return res.status(409).json({ error: 'El group_id ya está registrado' });
    }

    const [result] = await pool.query(
      'INSERT INTO whatsapp_groups (group_id, group_name) VALUES (?, ?)',
      [group_id, group_name]
    );
    res.status(201).json({
      message: 'Grupo creado con éxito',
      id: result.insertId,
      group_id,
      group_name
    });
  } catch (error) {
    logger.error(`Error al crear grupo: ${error.message}`);
    res.status(500).json({ error: 'Error interno al crear grupo' });
  }
};

/**
 * Actualizar un grupo de WhatsApp existente
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { group_name, is_active } = req.body;

    // Verificar si el grupo existe
    const [existingGroup] = await pool.query('SELECT id FROM whatsapp_groups WHERE id = ?', [id]);
    if (existingGroup.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    let query = 'UPDATE whatsapp_groups SET ';
    const params = [];
    if (group_name !== undefined) {
      query += 'group_name = ?, ';
      params.push(group_name);
    }
    if (is_active !== undefined) {
      query += 'is_active = ?, ';
      params.push(is_active);
    }

    // Si no hay campos para actualizar, no hacer nada
    if (params.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    query = query.slice(0, -2); // Remover la última coma y espacio
    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);
    res.status(200).json({ message: 'Grupo actualizado con éxito' });
  } catch (error) {
    logger.error(`Error al actualizar grupo: ${error.message}`);
    res.status(500).json({ error: 'Error interno al actualizar grupo' });
  }
};

/**
 * Eliminar un grupo de WhatsApp
 * @param {Object} req - La solicitud HTTP
 * @param {Object} res - La respuesta HTTP
 */
const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el grupo existe
    const [existingGroup] = await pool.query('SELECT id FROM whatsapp_groups WHERE id = ?', [id]);
    if (existingGroup.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    await pool.query('DELETE FROM whatsapp_groups WHERE id = ?', [id]);
    res.status(200).json({ message: 'Grupo eliminado con éxito' });
  } catch (error) {
    logger.error(`Error al eliminar grupo: ${error.message}`);
    res.status(500).json({ error: 'Error interno al eliminar grupo' });
  }
};

module.exports = {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup
}; 