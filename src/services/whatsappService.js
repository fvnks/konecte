const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const geminiService = require('./geminiService');
const googleSheetService = require('./googleSheetService');
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { prepareRowData } = require('../utils/dataHelpers');
require('dotenv').config();

// Ruta para almacenar los datos de sesión de WhatsApp
const sessionDir = path.join(__dirname, '../../whatsapp-session');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Variables globales
let sock = null;
let connectionState = 'disconnected';
let qrString = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000; // 5 segundos

// Comprobar si la funcionalidad de WhatsApp está habilitada
const isWhatsAppEnabled = process.env.ENABLE_WHATSAPP === 'true';

// Inicializar la conexión de WhatsApp
const initializeWhatsApp = async () => {
  // Comprobar si WhatsApp está habilitado en la configuración
  if (!isWhatsAppEnabled) {
    logger.info('La funcionalidad de WhatsApp está deshabilitada en la configuración de entorno');
    connectionState = 'disabled';
    return;
  }
  
  try {
    // Obtener el estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // Crear un nuevo socket de WhatsApp
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    // Actualizar estado de conexión
    connectionState = 'connecting';

    // Manejar actualizaciones de conexión
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrString = qr;
        connectionState = 'qr-ready';
        logger.info('Código QR disponible para la API.');
      }

      if (connection === 'open') {
        connectionState = 'connected';
        qrString = null;
        reconnectAttempts = 0; // Resetea intentos al conectar exitosamente
        logger.info('Conexión de WhatsApp establecida con éxito');
      } else if (connection === 'close') {
        const oldState = connectionState;
        connectionState = 'disconnected';
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        logger.info(`Conexión cerrada. Razón: ${lastDisconnect?.error?.message || 'Desconocida'}. Estado anterior: ${oldState}`);

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          logger.info(`Reintentando conexión... Intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${RECONNECT_INTERVAL / 1000}s`);
          connectionState = 'connecting'; // Indicar que está intentando reconectar
          setTimeout(initializeWhatsApp, RECONNECT_INTERVAL);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          connectionState = 'reconnecting_failed';
          logger.error('Número máximo de intentos de reconexión alcanzado. El bot NO intentará más reconexiones automáticas. Se requiere intervención manual (reinicio o revisión).');
          // Aquí se podría añadir una notificación externa si existiera
        } else {
          logger.info('Conexión cerrada, no se reintentará (ej. cierre de sesión o deshabilitado).');
          // Si es loggedOut, limpiar la sesión para forzar nuevo QR al reiniciar
          if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
            clearSessionFiles();
          }
        }
      }
    });

    // Guardar credenciales cuando cambien
    sock.ev.on('creds.update', saveCreds);

    // Manejar mensajes entrantes
    sock.ev.on('messages.upsert', async (messageInfo) => {
      const messages = messageInfo.messages;
      if (!messages || messages.length === 0) return;

      // Procesar cada mensaje
      for (const message of messages) {
        try {
          await handleIncomingMessage(message);
        } catch (error) {
          logger.error(`Error al procesar mensaje: ${error.message}`);
        }
      }
    });

  } catch (error) {
    connectionState = 'error';
    logger.error(`Error de inicialización de WhatsApp: ${error.message}`);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      logger.info(`Reintentando conexión tras error de inicialización... Intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${RECONNECT_INTERVAL / 1000}s`);
      connectionState = 'connecting';
      setTimeout(initializeWhatsApp, RECONNECT_INTERVAL);
    } else {
      connectionState = 'reconnecting_failed';
      logger.error('Número máximo de intentos de reconexión alcanzado tras error de inicialización. El bot NO intentará más reconexiones automáticas. Se requiere intervención manual.');
    }
  }
};

// Manejar mensajes entrantes
const handleIncomingMessage = async (message) => {
  // Comprobar si WhatsApp está habilitado y conectado
  if (!isWhatsAppEnabled || connectionState !== 'connected') {
    return;
  }
  
  try {
    // Extraer información clave del mensaje
    const { key, message: messageContent, pushName } = message;
    if (!key || !messageContent) return;

    // Omitir si el mensaje es nuestro
    if (key.fromMe) return;

    // Comprobar si es un mensaje de grupo (solo procesamos mensajes de grupo)
    if (!key.remoteJid.endsWith('@g.us')) {
        logger.info(`Mensaje ignorado: No es de un grupo (${key.remoteJid})`);
        return;
    }

    // Extraer texto del mensaje
    const messageText = messageContent.conversation || 
                       (messageContent.extendedTextMessage && messageContent.extendedTextMessage.text) || 
                       '';
    
    if (!messageText) {
        logger.info(`Mensaje ignorado: Sin contenido de texto (${key.id} en ${key.remoteJid})`);
        return;
    }

    // Extraer información del remitente
    const senderJid = key.participant || key.remoteJid;
    const groupId = key.remoteJid;
    const messageId = key.id;

    // Obtener configuraciones y comprobar si el bot está activo
    const [botActiveSetting] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['BOT_ACTIVE']);
    if (!botActiveSetting[0] || botActiveSetting[0].value !== 'true') {
      logger.info('El bot está inactivo, ignorando mensaje');
      return;
    }

    // Comprobar si el grupo está en nuestra lista permitida y activo
    const [groupResult] = await pool.query('SELECT id, group_name FROM whatsapp_groups WHERE group_id = ? AND is_active = TRUE', [groupId]);
    if (groupResult.length === 0) {
      logger.warn(`Mensaje del grupo ${groupId} no permitido o inactivo. Mensaje ID: ${messageId}`);
      return;
    }
    const groupName = groupResult[0].group_name;

    // Limpiar el JID del remitente (eliminar @s.whatsapp.net)
    const cleanSenderPhone = senderJid.replace(/@s\.whatsapp\.net/g, '');

    // Comprobar si el usuario remitente está autorizado y activo
    const [userResult] = await pool.query('SELECT id, name, is_active FROM users WHERE phone = ?', [cleanSenderPhone]);
    if (userResult.length === 0) {
      logger.warn(`Usuario con teléfono ${cleanSenderPhone} (JID: ${senderJid}) no encontrado en la base de datos. Mensaje de ${groupName} (${groupId}) ignorado.`);
      // Opcionalmente, podríamos notificar al administrador o registrar este intento
      return;
    }

    const authorizedUser = userResult[0];
    if (!authorizedUser.is_active) {
      logger.warn(`Usuario ${authorizedUser.name} (${cleanSenderPhone}) no está activo. Mensaje de ${groupName} (${groupId}) ignorado.`);
      return;
    }
    
    const userId = authorizedUser.id;
    const userName = authorizedUser.name || pushName || 'Usuario Desconocido';

    // Comprobar si el mensaje ya ha sido procesado
    const [existingMessage] = await pool.query('SELECT id FROM message_logs WHERE message_id = ?', [messageId]);
    if (existingMessage.length > 0) {
      logger.info(`Mensaje ${messageId} de ${userName} en ${groupName} ya fue procesado.`);
      return;
    }

    logger.info(`Procesando mensaje de ${userName} (${cleanSenderPhone}) en grupo ${groupName} (${groupId}): "${messageText.substring(0,50)}..."`);

    // Guardar mensaje en el log
    await pool.query(
      'INSERT INTO message_logs (message_id, user_id, group_id, message_text) VALUES (?, ?, ?, ?)',
      [messageId, userId, groupId, messageText]
    );

    // Obtener prompt de Gemini desde configuraciones
    const [promptSetting] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['GEMINI_PROMPT']);
    const geminiPrompt = promptSetting[0]?.value;
    if (!geminiPrompt) {
        logger.error('Prompt de Gemini no encontrado en la configuración. No se puede procesar el mensaje.');
        return;
    }

    // Procesar el mensaje con la API de Gemini
    const propertyData = await geminiService.processPropertyMessage(messageText, geminiPrompt);
    
    if (!propertyData) {
      logger.info(`No se extrajeron datos válidos de propiedad del mensaje: ${messageId}`);
      return;
    }

    // Añadir información adicional
    propertyData.whatsappName = userName;
    propertyData.userId = userId;
    propertyData.groupId = groupId;
    propertyData.timestamp = new Date().toISOString();

    // Guardar en la base de datos
    const [propertyResult] = await pool.query(
      `INSERT INTO properties 
       (type, operation, property_type, location, price, price_currency, bedrooms, bathrooms, 
        area, contact_info, additional_details, user_id, group_id, whatsapp_name, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        propertyData.type,
        propertyData.operation,
        propertyData.propertyType,
        propertyData.location,
        propertyData.price,
        propertyData.priceCurrency,
        propertyData.bedrooms,
        propertyData.bathrooms,
        propertyData.area,
        propertyData.contactInfo,
        propertyData.additionalDetails,
        userId,
        groupId,
        userName
      ]
    );

    // Preparar datos para Google Sheets
    const rowData = prepareRowData(propertyData, userName, groupId, groupName);
    
    // Añadir a Google Sheets
    if (rowData && rowData.length > 0) {
        const sheetRowId = await googleSheetService.addPropertyToSheet(rowData);
        // Actualizar el ID de fila de la hoja
        await pool.query('UPDATE properties SET sheet_row_id = ? WHERE id = ?', [sheetRowId, propertyResult.insertId]);
    } else {
        logger.warn('No se generaron datos de fila para Google Sheets.');
    }

    // Actualizar el mensaje como procesado
    await pool.query(
      'UPDATE message_logs SET processed = TRUE, processed_at = NOW() WHERE message_id = ?',
      [messageId]
    );

    logger.info(`Mensaje ${messageId} procesado exitosamente`);

  } catch (error) {
    logger.error(`Error al manejar mensaje entrante: ${error.message}`);
  }
};

// Obtener estado de conexión
const getConnectionState = () => {
  return {
    state: connectionState,
    qr: qrString,
    attempts: reconnectAttempts,
    maxAttempts: MAX_RECONNECT_ATTEMPTS
  };
};

// Enviar mensaje
const sendMessage = async (jid, message) => {
  try {
    if (!sock || connectionState !== 'connected') {
      return { success: false, error: 'No hay conexión activa' };
    }
    
    const result = await sock.sendMessage(jid, { text: message });
    return { success: true, result };
  } catch (error) {
    logger.error(`Error al enviar mensaje: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Cerrar sesión
const logout = async () => {
  try {
    if (!sock) {
      return { success: false, error: 'No hay conexión activa' };
    }
    
    logger.info('Iniciando cierre de sesión de WhatsApp...');
    await sock.logout();
    // El evento 'connection.update' con DisconnectReason.loggedOut se encargará de limpiar la sesión y el estado.
    // No es necesario llamar a clearSessionFiles() aquí directamente si el evento lo maneja.
    sock = null; // Asegurar que el socket se anule
    connectionState = 'disconnected'; // Actualizar estado inmediatamente
    reconnectAttempts = 0; // Resetear intentos en logout manual
    
    return { success: true, message: 'Sesión cerrada correctamente. Se requerirá nuevo QR al reiniciar.' };
  } catch (error) {
    logger.error(`Error al cerrar sesión: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Función para limpiar archivos de sesión
const clearSessionFiles = () => {
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      logger.info('Archivos de sesión de WhatsApp eliminados.');
    }
  } catch (error) {
    logger.error(`Error al limpiar archivos de sesión: ${error.message}`);
  }
};

// Función para reiniciar los intentos de reconexión (llamada por botController)
const resetReconnectAttempts = () => {
  logger.info('Intentos de reconexión reseteados manualmente.');
  reconnectAttempts = 0;
  // Si el estado era 'reconnecting_failed', podría ser útil cambiarlo a 'disconnected' 
  // para que un nuevo initializeWhatsApp pueda comenzar el ciclo de conexión limpiamente.
  if (connectionState === 'reconnecting_failed') {
    connectionState = 'disconnected'; 
  }
};

module.exports = {
  initializeWhatsApp,
  getConnectionState,
  sendMessage,
  logout,
  resetReconnectAttempts
}; 