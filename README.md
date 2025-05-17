# Bot de WhatsApp para Propiedades Inmobiliarias

Un bot de WhatsApp que procesa mensajes de grupos inmobiliarios, extrae información de propiedades utilizando la API de Gemini, y almacena los datos en Google Sheets y MySQL.

## Características

- Conexión a WhatsApp utilizando Baileys
- Procesamiento de mensajes con IA (Gemini API)
- Almacenamiento de datos en Google Sheets y MySQL
- API REST para gestionar usuarios, grupos, y configuraciones
- Interfaz para monitorear el estado del bot
- Generador de claves API para integraciones externas (WordPress, etc.)

## Requisitos

- Node.js 18 o superior
- MySQL
- Cuenta de servicio de Google con acceso a Google Sheets API
- Clave API de Gemini

## Instalación

1. Clonar el repositorio:
   ```
   git clone <url-del-repositorio>
   cd whatsapp-real-estate-bot
   ```

2. Instalar dependencias:
   ```
   npm install
   ```

3. Configurar variables de entorno copiando `.env.example` a `.env` y modificando según sea necesario.

## Configuración

El archivo `.env` debe contener las siguientes variables:

```
# Google Sheets Config
GOOGLE_SHEETS_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="your_private_key"

# API Configuration
GEMINI_API_KEY=your_gemini_api_key
USE_OPENAI=false
OPENAI_API_KEY=your_openai_api_key (opcional)

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=whatsapp_bot_db
DB_USER=root
DB_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# WhatsApp Configuration
ENABLE_WHATSAPP=true

# Logging Configuration
LOG_LEVEL=info
ENABLE_FILE_LOGGING=true
```

## Uso

Para iniciar la aplicación en modo desarrollo:

```
npm run dev
```

Para iniciar la aplicación en producción:

```
npm start
```

## Autenticación de WhatsApp

1. Al iniciar el bot, aparecerá un código QR en la consola.
2. Escanea el código QR con WhatsApp en tu teléfono.
3. El bot estará listo para usar una vez autenticado.

## API Endpoints

- `GET /api/bot/status` - Obtener estado del bot
- `POST /api/bot/restart` - Reiniciar el bot
- `GET /api/bot/qr-code` - Obtener código QR
- `GET /api/users` - Listar usuarios
- `POST /api/users` - Crear usuario
- `GET /api/groups` - Listar grupos
- `POST /api/groups` - Crear grupo
- `GET /api/api-keys` - Listar claves API
- `POST /api/api-keys` - Crear clave API
- `GET /api/api-keys/validate/:api_key` - Validar clave API

## Generación de Claves API

Para generar y gestionar claves API para integraciones con WordPress u otras plataformas:

1. Accede a la URL `/api-keys` en el navegador (e.j., `http://localhost:3000/api-keys`)
2. Usa la interfaz para crear nuevas claves API, especificando una descripción y fecha de expiración opcional
3. Las claves generadas se pueden usar para autenticar llamadas a la API desde WordPress o cualquier otro sistema externo

## Integración con WordPress

Para integrar el bot con WordPress:

1. Genera una clave API usando la interfaz web en `/api-keys`
2. En WordPress, configura el plugin para utilizar la URL base de la API y la clave API generada
3. Las llamadas a la API deben incluir la clave API en el encabezado `X-API-Key` o como parámetro de consulta `api_key`

Por ejemplo:
```
GET https://tu-dominio.com/api/bot/status?api_key=tu_clave_api
```

o

```
GET https://tu-dominio.com/api/bot/status
X-API-Key: tu_clave_api
```

## Contribuir

Las contribuciones son bienvenidas. Para cambios importantes, por favor abre un issue primero para discutir lo que te gustaría cambiar.

## Licencia

[ISC](https://opensource.org/licenses/ISC) 