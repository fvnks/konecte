-- Esquema de la base de datos para la aplicación WhatsApp Real Estate Bot

-- Tabla de usuarios: Almacena usuarios autorizados para interactuar con el bot
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE COMMENT 'Número de teléfono del usuario, sin símbolos, solo números. Ej: 569XXXXXXXX',
  name VARCHAR(100) NOT NULL COMMENT 'Nombre del usuario',
  is_admin BOOLEAN DEFAULT FALSE COMMENT 'Indica si el usuario tiene privilegios de administrador',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Indica si la cuenta del usuario está activa',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización del registro'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios autorizados del sistema';

-- Tabla de claves API: Almacena claves API para la autenticación de servicios externos (ej. WordPress)
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_key VARCHAR(255) NOT NULL UNIQUE COMMENT 'La clave API generada',
  description VARCHAR(255) COMMENT 'Descripción para identificar el uso de la clave API',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Indica si la clave API está activa',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación de la clave API',
  expires_at TIMESTAMP NULL COMMENT 'Fecha de expiración de la clave API (opcional)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Claves API para acceso externo';

-- Tabla de grupos de WhatsApp: Almacena los IDs de los grupos de WhatsApp permitidos para el bot
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL UNIQUE COMMENT 'ID del grupo de WhatsApp (ej. 1234567890@g.us)',
  group_name VARCHAR(255) NOT NULL COMMENT 'Nombre del grupo de WhatsApp',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Indica si el bot debe procesar mensajes de este grupo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización del registro'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Grupos de WhatsApp permitidos';

-- Tabla de configuraciones: Almacena configuraciones generales de la aplicación que pueden ser modificadas en tiempo de ejecución
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'Nombre único de la clave de configuración (ej. GOOGLE_SHEET_ID)',
  value TEXT NOT NULL COMMENT 'Valor de la configuración',
  description VARCHAR(255) COMMENT 'Descripción del propósito de la configuración',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización del registro'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuraciones de la aplicación';

-- Tabla de propiedades: Almacena la información de propiedades inmobiliarias extraída por Gemini
CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('Busco', 'Ofrezco') NOT NULL COMMENT 'Indica si es una búsqueda o una oferta de propiedad',
  operation VARCHAR(50) COMMENT 'Tipo de operación (Venta, Arriendo, etc.)',
  property_type VARCHAR(50) COMMENT 'Tipo de propiedad (Casa, Departamento, etc.)',
  location TEXT COMMENT 'Ubicación de la propiedad (puede ser detallada)',
  price DECIMAL(15,2) COMMENT 'Precio de la propiedad',
  price_currency VARCHAR(10) COMMENT 'Moneda del precio (UF, CLP, USD, etc.)',
  bedrooms INT COMMENT 'Número de dormitorios',
  bathrooms INT COMMENT 'Número de baños',
  area INT COMMENT 'Área en metros cuadrados',
  contact_info VARCHAR(255) COMMENT 'Información de contacto extraída del mensaje',
  additional_details TEXT COMMENT 'Cualquier detalle adicional importante',
  user_id INT COMMENT 'ID del usuario (de la tabla users) que envió el mensaje original',
  group_id VARCHAR(255) COMMENT 'ID del grupo de WhatsApp (de la tabla whatsapp_groups) de donde se originó el mensaje',
  whatsapp_name VARCHAR(100) COMMENT 'Nombre del contacto de WhatsApp que envió el mensaje',
  message_id VARCHAR(255) UNIQUE COMMENT 'ID del mensaje original de WhatsApp para evitar duplicados',
  sheet_row_id VARCHAR(50) COMMENT 'ID o número de fila donde se guardó en Google Sheets (opcional)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha en que se registró la propiedad en el sistema',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  -- No se añade FK para group_id a whatsapp_groups.group_id directamente para flexibilidad, se maneja en la lógica de la app
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Propiedades inmobiliarias procesadas';

-- Tabla de registro de mensajes: Log de todos los mensajes recibidos que intentaron ser procesados
CREATE TABLE IF NOT EXISTS message_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL UNIQUE COMMENT 'ID único del mensaje de WhatsApp',
  user_id INT COMMENT 'ID del usuario (de la tabla users) que envió el mensaje',
  group_id VARCHAR(255) COMMENT 'ID del grupo de WhatsApp donde se recibió el mensaje',
  message_text TEXT COMMENT 'Texto completo del mensaje recibido',
  processed BOOLEAN DEFAULT FALSE COMMENT 'Indica si el mensaje fue procesado exitosamente por Gemini y guardado',
  processed_status VARCHAR(100) DEFAULT 'PENDING' COMMENT 'Estado del procesamiento (PENDING, SUCCESS, IGNORED_USER, IGNORED_GROUP, ERROR_GEMINI, ERROR_SHEET)',
  error_message TEXT COMMENT 'Mensaje de error si el procesamiento falló',
  gemini_response JSON COMMENT 'Respuesta JSON de Gemini (si aplica)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha en que se recibió el mensaje',
  processed_at TIMESTAMP NULL COMMENT 'Fecha en que se completó el procesamiento',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log de mensajes de WhatsApp recibidos';

-- Inserciones iniciales para la tabla de configuraciones (ejemplos)
-- Estos valores deberían ser ajustados según el entorno o manejados por el .env para algunos casos.
INSERT IGNORE INTO settings (key_name, value, description) VALUES
  ('GOOGLE_SHEET_ID', '', 'ID de Google Sheet donde se guardan los datos de propiedades. Se recomienda configurar en .env y luego aquí.'),
  ('GEMINI_API_KEY', '', 'Clave API para Gemini. Se recomienda configurar en .env y NO aquí por seguridad.'),
  ('GEMINI_PROMPT', 'Por favor, extrae la información de esta propiedad inmobiliaria del siguiente mensaje. Debes distinguir si la persona está buscando una propiedad o ofreciendo una. Mensaje: "${messageText}" Responde solo con un JSON con la siguiente estructura. Intenta ser lo más detallado posible. { "type": "Busco" o "Ofrezco", "operation": "tipo de operación (Venta, Arriendo, Arriendo Temporal, etc.)", "propertyType": "tipo de propiedad (Casa, Departamento, Terreno, Oficina, Local Comercial, Estacionamiento, Bodega, Parcela, etc.)", "locationDetails": { "address": "Dirección completa si está disponible", "comuna": "Comuna principal", "city": "Ciudad", "region": "Región" }, "price": "precio (solo el valor numérico, sin puntos)", "priceCurrency": "moneda (UF, CLP, USD, etc.)", "commonExpenses": "gastos comunes si se mencionan (solo valor numérico, sin puntos)", "bedrooms": "número de dormitorios (número entero)", "bathrooms": "número de baños (número entero)", "parkingSlots": "número de estacionamientos (número entero, si se menciona)", "storageUnits": "número de bodegas (número entero, si se menciona)", "area": "área total en metros cuadrados (número entero)", "contactInfo": { "name": "Nombre del contacto si se menciona", "phone": "Teléfono de contacto", "email": "Correo electrónico de contacto", "isBroker": true o false }, "additionalDetails": "cualquier detalle adicional importante no capturado en otros campos" } Si no puedes identificar alguno de los valores o sub-valores, omite esa clave o sub-clave. No inventes información. Para campos numéricos, devuelve solo el número. Para "isBroker", devuelve un booleano.', 'Prompt utilizado para la API de Gemini para extraer datos de propiedades.'),
  ('BOT_ACTIVE', 'true', 'Controla si el bot de WhatsApp está activo (true) o inactivo (false) para procesar mensajes.'),
  ('SHEET_HEADERS', 'Busco / Ofrezco,Tipo de Operacion,Propiedad,Region,Ciudad,Opcion Comuna,Opcion Comuna 2,Opcion Comuna 3,Opcion Comuna 4,Dormitorios,Baños,Estacionamiento,Bodegas,Valor,Moneda,Gastos Comunes,Metros Cuadrados,Telefono,Correo Electronico,Telefono Corredor,Nombre Whatsapp,Fecha Publicacion,Hora Publicacion,UID,Status,Null,Fecha del Último Seguimiento', 'Encabezados para la hoja de Google Sheets, separados por coma.'); 