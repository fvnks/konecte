const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const logger = require('../config/logger');
const { pool } = require('../config/database'); // Importar pool para acceder a la DB
require('dotenv').config();

// Caché para la API Key de Gemini
let cachedApiKey = null;
let apiKeyLastFetched = null;
const API_KEY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

/**
 * Obtener la API Key de Gemini desde la base de datos (con caché)
 */
const getGeminiApiKey = async () => {
  const now = Date.now();
  if (cachedApiKey && apiKeyLastFetched && (now - apiKeyLastFetched < API_KEY_CACHE_DURATION)) {
    return cachedApiKey;
  }

  try {
    const [settings] = await pool.query("SELECT value FROM settings WHERE key_name = 'GEMINI_API_KEY'");
    if (settings.length > 0 && settings[0].value) {
      cachedApiKey = settings[0].value;
      apiKeyLastFetched = now;
      logger.info('GEMINI_API_KEY cargada/refrescada desde la base de datos.');
      return cachedApiKey;
    } else {
      logger.warn('GEMINI_API_KEY no encontrada en la configuración de la base de datos. Intentando usar variable de entorno.');
      // Fallback a variable de entorno si no está en la DB (o si está vacía)
      cachedApiKey = process.env.GEMINI_API_KEY;
      if (!cachedApiKey) {
        logger.error('GEMINI_API_KEY no encontrada ni en la base de datos ni en las variables de entorno.');
        return null;
      }
      apiKeyLastFetched = now; // Cachear también la de entorno para evitar re-lectura constante
      return cachedApiKey;
    }
  } catch (error) {
    logger.error(`Error al obtener GEMINI_API_KEY de la DB: ${error.message}. Usando variable de entorno como fallback.`);
    cachedApiKey = process.env.GEMINI_API_KEY; // Fallback en caso de error de DB
    if (!cachedApiKey) {
        logger.error('GEMINI_API_KEY no encontrada en las variables de entorno tras error de DB.');
        return null;
    }
    apiKeyLastFetched = now;
    return cachedApiKey;
  }
};

/**
 * Procesar un mensaje de propiedad utilizando la API de Gemini.
 * @param {string} messageText - El texto del mensaje a procesar.
 * @param {string} basePrompt - El prompt base para Gemini (obtenido de la config).
 * @returns {Promise<Object|null>} - Un objeto con los datos de la propiedad o null si hay error.
 */
const processPropertyMessage = async (messageText, basePrompt) => {
  let fullResponse = ''; // Declarar fullResponse aquí para que esté en scope en el catch

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    logger.error('No se puede procesar el mensaje: Falta la API Key de Gemini.');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

  const generationConfig = {
    temperature: 0.7,
    topK: 0,
    topP: 1,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  // Reemplazar el placeholder en el prompt con el texto del mensaje real
  const promptText = basePrompt.replace('\${messageText}', messageText);

  try {
    logger.info(`Enviando solicitud a Gemini con prompt: ${promptText.substring(0, 100)}...`);
    const result = await model.generateContentStream([
      {
        text: promptText,
      },
    ]);

    // Procesar el stream para obtener la respuesta completa
    for await (const chunk of result.stream) {
        fullResponse += chunk.text();
    }
    
    logger.debug(`Respuesta cruda de Gemini: ${fullResponse}`);

    // Intenta parsear la respuesta como JSON
    const jsonData = JSON.parse(fullResponse);
    logger.info('Datos de propiedad extraídos con éxito por Gemini.');
    return jsonData;

  } catch (error) {
    logger.error(`Error al procesar el mensaje con Gemini: ${error.message}`);
    logger.error(`Prompt enviado a Gemini: ${promptText}`);
    logger.error(`Respuesta (si hubo) antes del error: ${fullResponse || 'N/A'}`);
    return null;
  }
};

module.exports = {
  processPropertyMessage,
  getGeminiApiKey // Exportar para tests o uso futuro si es necesario
}; 