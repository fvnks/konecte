const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const logger = require('../config/logger');
const { pool } = require('../config/database');
require('dotenv').config();

// Caché para el Google Sheet ID
let cachedSheetId = null;
let sheetIdLastFetched = null;
const SHEET_ID_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtener el Google Sheet ID desde la base de datos (con caché)
 */
const getGoogleSheetId = async () => {
  const now = Date.now();
  if (cachedSheetId && sheetIdLastFetched && (now - sheetIdLastFetched < SHEET_ID_CACHE_DURATION)) {
    return cachedSheetId;
  }

  try {
    const [settings] = await pool.query("SELECT value FROM settings WHERE key_name = 'GOOGLE_SHEET_ID'");
    if (settings.length > 0 && settings[0].value) {
      cachedSheetId = settings[0].value;
      sheetIdLastFetched = now;
      logger.info('GOOGLE_SHEET_ID cargado/refrescado desde la base de datos.');
      return cachedSheetId;
    } else {
      logger.warn('GOOGLE_SHEET_ID no encontrado en la configuración de la base de datos. Intentando usar variable de entorno.');
      cachedSheetId = process.env.GOOGLE_SHEETS_ID;
      if (!cachedSheetId) {
        logger.error('GOOGLE_SHEET_ID no encontrado ni en la base de datos ni en las variables de entorno.');
        return null;
      }
      sheetIdLastFetched = now;
      return cachedSheetId;
    }
  } catch (error) {
    logger.error(`Error al obtener GOOGLE_SHEET_ID de la DB: ${error.message}. Usando variable de entorno como fallback.`);
    cachedSheetId = process.env.GOOGLE_SHEETS_ID;
    if (!cachedSheetId) {
        logger.error('GOOGLE_SHEET_ID no encontrado en las variables de entorno tras error de DB.');
        return null;
    }
    sheetIdLastFetched = now;
    return cachedSheetId;
  }
};

// Configuración de autenticación con Google
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

/**
 * Añadir una propiedad a la hoja de Google Sheets
 * @param {Array<string>} rowData - Array de strings con los datos de la propiedad en orden.
 * @returns {Promise<number|null>} - El índice de la fila añadida o null si hay error.
 */
const addPropertyToSheet = async (rowData) => {
  const sheetId = await getGoogleSheetId();
  if (!sheetId) {
    logger.error('No se puede añadir a Google Sheets: Falta el ID de la hoja.');
    return null;
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    logger.error('Credenciales de Google Service Account no configuradas en .env. No se puede acceder a Google Sheets.');
    return null;
  }

  try {
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo(); // Carga propiedades del documento y hojas
    
    // Asumir que la primera hoja es la que queremos usar
    // Podríamos hacer esto configurable si es necesario
    const sheet = doc.sheetsByIndex[0]; 
    if (!sheet) {
        logger.error(`No se encontró la hoja de cálculo (índice 0) en el documento con ID: ${sheetId}`);
        return null;
    }

    logger.info(`Añadiendo fila a Google Sheet ID: ${sheetId}, Título de hoja: ${sheet.title}`);
    const addedRow = await sheet.addRow(rowData);
    
    logger.info(`Fila añadida a Google Sheets con éxito. Índice de fila: ${addedRow.rowIndex}`);
    return addedRow.rowIndex; // o addedRow.rowNumber dependiendo de la librería y lo que necesites

  } catch (error) {
    logger.error(`Error al añadir datos a Google Sheets: ${error.message}`);
    if (error.response?.data?.error) {
        logger.error(`Detalles del error de Google API: ${JSON.stringify(error.response.data.error)}`);
    }
    return null;
  }
};

/**
 * Obtener encabezados de hoja desde Google Sheet
 * @returns {Array|null} - Array de valores de encabezado o null si la operación falló
 */
const getSheetHeaders = async () => {
  try {
    // Obtener ID de Google Sheet desde variable de entorno primero o desde configuración de base de datos como respaldo
    let sheetId = process.env.GOOGLE_SHEETS_ID;
    
    // Si no está en env, intentar desde configuración de base de datos
    if (!sheetId) {
      const [sheetIdResult] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['GOOGLE_SHEET_ID']);
      sheetId = sheetIdResult[0]?.value;
    }
    
    if (!sheetId) {
      logger.error('ID de Google Sheet no está configurado en el entorno o en la configuración');
      return null;
    }

    // Obtener cliente de Sheets
    const sheets = await getSheetsClient();
    if (!sheets) {
      return null;
    }

    // Obtener la primera fila (encabezados)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z1'
    });

    // Comprobar si la operación fue exitosa
    if (response.status !== 200 || !response.data || !response.data.values || response.data.values.length === 0) {
      logger.error('Error al obtener encabezados desde Google Sheet');
      return null;
    }

    const headers = response.data.values[0];
    logger.info(`Se obtuvieron ${headers.length} encabezados desde Google Sheet con éxito`);
    
    return headers;
  } catch (error) {
    logger.error(`Error al obtener encabezados de hoja: ${error.message}`);
    return null;
  }
};

/**
 * Actualizar una fila en Google Sheet
 * @param {number} rowNumber - El número de fila a actualizar
 * @param {Array} rowData - Array de valores para actualizar la fila
 * @returns {boolean} - Si la operación fue exitosa
 */
const updateSheetRow = async (rowNumber, rowData) => {
  try {
    // Obtener ID de Google Sheet desde variable de entorno primero o desde configuración de base de datos como respaldo
    let sheetId = process.env.GOOGLE_SHEETS_ID;
    
    // Si no está en env, intentar desde configuración de base de datos
    if (!sheetId) {
      const [sheetIdResult] = await pool.query('SELECT value FROM settings WHERE key_name = ?', ['GOOGLE_SHEET_ID']);
      sheetId = sheetIdResult[0]?.value;
    }
    
    if (!sheetId) {
      logger.error('ID de Google Sheet no está configurado en el entorno o en la configuración');
      return false;
    }

    // Obtener cliente de Sheets
    const sheets = await getSheetsClient();
    if (!sheets) {
      return false;
    }

    // Actualizar la fila especificada
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `A${rowNumber}:Z${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData]
      }
    });

    // Comprobar si la operación fue exitosa
    if (response.status !== 200) {
      logger.error(`Error al actualizar fila ${rowNumber} en Google Sheet`);
      return false;
    }

    logger.info(`Fila ${rowNumber} actualizada en Google Sheet con éxito`);
    return true;
  } catch (error) {
    logger.error(`Error al actualizar fila en Google Sheet: ${error.message}`);
    return false;
  }
};

module.exports = {
  addPropertyToSheet,
  getGoogleSheetId,
  getSheetHeaders,
  updateSheetRow
}; 