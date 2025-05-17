const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

// Configuración del Pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Inicializar base de datos y crear tablas si no existen
const initializeDatabase = async () => {
  try {
    // Probar la conexión
    await pool.query('SELECT 1');
    logger.info('Conexión a la base de datos establecida con éxito');

    // Crear tablas si no existen
    await createTables();
    logger.info('Tablas de la base de datos inicializadas con éxito');
  } catch (error) {
    logger.error(`Error de inicialización de la base de datos: ${error.message}`);
    throw error;
  }
};

// Crear las tablas necesarias para la aplicación
const createTables = async () => {
  try {
    // Tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Tabla de claves API
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        api_key VARCHAR(255) NOT NULL UNIQUE,
        description VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL
      );
    `);

    // Tabla de grupos de WhatsApp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id VARCHAR(255) NOT NULL UNIQUE,
        group_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Tabla de configuraciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_name VARCHAR(50) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    // Tabla de propiedades (para almacenar propiedades inmobiliarias procesadas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('Busco', 'Ofrezco') NOT NULL,
        operation VARCHAR(50),
        property_type VARCHAR(50),
        location VARCHAR(255),
        price DECIMAL(15,2),
        price_currency VARCHAR(10),
        bedrooms INT,
        bathrooms INT,
        area INT,
        contact_info VARCHAR(100),
        additional_details TEXT,
        user_id INT,
        group_id VARCHAR(255),
        whatsapp_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sheet_row_id INT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Tabla de registro de mensajes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL UNIQUE,
        user_id INT,
        group_id VARCHAR(255),
        message_text TEXT,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Insertar configuraciones predeterminadas si no existen
    const defaultGeminiPrompt = 'Por favor, extrae la información de esta propiedad inmobiliaria del siguiente mensaje. Debes distinguir si la persona está buscando una propiedad o ofreciendo una. Mensaje: "${messageText}" Responde solo con un JSON con la siguiente estructura. Intenta ser lo más detallado posible. { "type": "Busco" o "Ofrezco", "operation": "tipo de operación (Venta, Arriendo, Arriendo Temporal, etc.)", "propertyType": "tipo de propiedad (Casa, Departamento, Terreno, Oficina, Local Comercial, Estacionamiento, Bodega, Parcela, etc.)", "locationDetails": { "address": "Dirección completa si está disponible", "comuna": "Comuna principal", "city": "Ciudad", "region": "Región" }, "price": "precio (solo el valor numérico, sin puntos)", "priceCurrency": "moneda (UF, CLP, USD, etc.)", "commonExpenses": "gastos comunes si se mencionan (solo valor numérico, sin puntos)", "bedrooms": "número de dormitorios (número entero)", "bathrooms": "número de baños (número entero)", "parkingSlots": "número de estacionamientos (número entero, si se menciona)", "storageUnits": "número de bodegas (número entero, si se menciona)", "area": "área total en metros cuadrados (número entero)", "contactInfo": { "name": "Nombre del contacto si se menciona", "phone": "Teléfono de contacto", "email": "Correo electrónico de contacto", "isBroker": true o false }, "additionalDetails": "cualquier detalle adicional importante no capturado en otros campos" } Si no puedes identificar alguno de los valores o sub-valores, omite esa clave o sub-clave. No inventes información. Para campos numéricos, devuelve solo el número. Para "isBroker", devuelve un booleano.';
    
    await pool.query(`
      INSERT IGNORE INTO settings (key_name, value, description) VALUES
        ('GOOGLE_SHEET_ID', ?, 'ID de Google Sheet donde se guardan los datos de propiedades'),
        ('GEMINI_PROMPT', ?, 'Prompt utilizado para la API de Gemini'),
        ('BOT_ACTIVE', 'true', 'Si el bot de WhatsApp está activo o no'),
        ('SHEET_HEADERS', ?, 'Encabezados para la hoja de Google');
    `, [
        process.env.GOOGLE_SHEETS_ID || "",
        defaultGeminiPrompt,
        'Busco / Ofrezco,Tipo de Operacion,Propiedad,Region,Ciudad,Opcion Comuna,Opcion Comuna 2,Opcion Comuna 3,Opcion Comuna 4,Dormitorios,Baños,Estacionamiento,Bodegas,Valor,Moneda,Gastos Comunes,Metros Cuadrados,Telefono,Correo Electronico,Telefono Corredor,Nombre Whatsapp,Fecha Publicacion,Hora Publicacion,UID,Status,Null,Fecha del Último Seguimiento'
    ]);

  } catch (error) {
    logger.error(`Error al crear tablas: ${error.message}`);
    throw error;
  }
};

module.exports = {
  pool,
  initializeDatabase
};