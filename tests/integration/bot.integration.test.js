const request = require('supertest');
const { app, initializeApp } = require('../../src/index'); // Ajusta la ruta si es necesario
const { pool } = require('../../src/config/database'); // Importar pool para operaciones de DB
const crypto = require('crypto'); // Para generar una API key única

// Mockear whatsappService para controlar getConnectionState durante los tests de integración
// sin afectar la lógica real de whatsappService ni intentar una conexión real.
jest.mock('../../src/services/whatsappService', () => ({
  initializeWhatsApp: jest.fn(), // Mockeado para que no se ejecute en initializeApp si NODE_ENV no es 'test'
  getConnectionState: jest.fn(() => ({ state: 'disconnected', qr: null, message: 'Mocked state' })),
  logout: jest.fn(),
  resetReconnectAttempts: jest.fn(),
  sendMessage: jest.fn(),
  restartClient: jest.fn(),
}));


describe('Bot API Endpoints', () => {
  let testApiKey;

  // Antes de todos los tests de este suite, inicializar la app (ej. DB)
  beforeAll(async () => {
    // Asegurarse de que NODE_ENV esté configurado para tests si es necesario para initializeApp
    // process.env.NODE_ENV = 'test'; // Ya debería estar configurado por el script de test de Jest
    try {
      await initializeApp(); // Llama a la función de inicialización de index.js
      
      testApiKey = crypto.randomBytes(32).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.setDate(now.getDate() + 7)); // Válida por 7 días
      
      // Limpiar cualquier clave de prueba anterior con el mismo user_id o api_key si es necesario
      // Por simplicidad, asumimos que las claves de prueba no persistirán problemáticamente entre ejecuciones de test suites
      // o se pueden limpiar por api_key si se generan con un patrón predecible que no sea testApiKey aún.
      // Una mejor estrategia podría ser usar un user_id específico para tests y limpiar por ese user_id.
      // Por ahora, nos enfocaremos en que el insert y delete de *esta* clave funcione.
      await pool.query('DELETE FROM api_keys WHERE api_key = ?', [testApiKey]); // Limpieza preventiva por si acaso

      // Insertar la API key de prueba
      // No se especifica 'id' (AUTO_INCREMENT)
      // No se especifica 'created_at' (DEFAULT CURRENT_TIMESTAMP)
      // No existe 'updated_at' en la tabla api_keys
      await pool.query(
        'INSERT INTO api_keys (api_key, description, is_active, expires_at) VALUES (?, ?, ?, ?)',
        [testApiKey, 'Clave de prueba de integración', true, expiresAt]
      );
      console.log(`Test API Key sembrada: ${testApiKey}`);
    } catch (error) {
      console.error('Error during beforeAll in integration tests:', error);
      // Dejar que el error se propague para que Jest lo maneje
      throw error; 
    }
  });

  afterAll(async () => {
    try {
      // Limpiar la API key de prueba usando la clave api_key generada
      await pool.query('DELETE FROM api_keys WHERE api_key = ?', [testApiKey]);
      console.log('Test API Key limpiada.');
      // Cerrar el pool de la base de datos para evitar que Jest se quede colgado
      // Esto es crucial si el pool no se cierra automáticamente
      if (pool && pool.end) {
        await pool.end();
      }
    } catch (error) {
      console.error('Error during afterAll in integration tests:', error);
    }
  });

  describe('GET /api/bot/status', () => {
    test('debería retornar el estado actual del bot con código 200 si la API Key es válida', async () => {
      const mockWhatsappService = require('../../src/services/whatsappService');
      mockWhatsappService.getConnectionState.mockReturnValue({
        state: 'connected', 
        qr: null, 
        message: 'Bot conectado exitosamente (mock)'
      });

      const response = await request(app)
        .get('/api/bot/status')
        .set('x-api-key', testApiKey);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toHaveProperty('state', 'connected');
      expect(response.body.status).toHaveProperty('message', 'Bot conectado exitosamente (mock)');
    });

    test('debería retornar 401 si no se provee API Key', async () => {
      const response = await request(app).get('/api/bot/status');
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Se requiere una clave API');
    });

    test('debería retornar 401 si la API Key es inválida', async () => {
      const response = await request(app)
        .get('/api/bot/status')
        .set('x-api-key', 'invalid-api-key-that-does-not-exist');
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Clave API inválida');
    });
  });

  describe('POST /api/bot/restart', () => {
    let mockWhatsappService;

    beforeEach(() => {
      // Obtener una instancia fresca del mock para cada test en este describe
      mockWhatsappService = require('../../src/services/whatsappService');
      // Limpiar cualquier configuración previa de los mocks de whatsappService
      mockWhatsappService.restartClient.mockReset(); 
    });

    test('debería reiniciar el bot y retornar 200 si la API Key es válida y el servicio tiene éxito', async () => {
      mockWhatsappService.restartClient.mockResolvedValue({ success: true, message: 'Servicio de reinicio exitoso' });

      const response = await request(app)
        .post('/api/bot/restart')
        .set('x-api-key', testApiKey);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Servicio de reinicio exitoso');
      expect(mockWhatsappService.restartClient).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 400 si el servicio de reinicio falla de forma controlada', async () => {
      mockWhatsappService.restartClient.mockResolvedValue({ success: false, error: 'Fallo controlado del servicio' });

      const response = await request(app)
        .post('/api/bot/restart')
        .set('x-api-key', testApiKey);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error', 'Fallo controlado del servicio');
      expect(mockWhatsappService.restartClient).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 500 si el servicio de reinicio lanza un error inesperado', async () => {
      mockWhatsappService.restartClient.mockRejectedValue(new Error('Error inesperado del servicio'));

      const response = await request(app)
        .post('/api/bot/restart')
        .set('x-api-key', testApiKey);

      expect(response.statusCode).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error interno al reiniciar el bot');
      expect(mockWhatsappService.restartClient).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 401 si no se provee API Key', async () => {
      const response = await request(app).post('/api/bot/restart');
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Se requiere una clave API');
      expect(mockWhatsappService.restartClient).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/bot/logout', () => {
    let mockWhatsappService;

    beforeEach(() => {
      mockWhatsappService = require('../../src/services/whatsappService');
      mockWhatsappService.logout.mockReset(); 
    });

    test('debería cerrar la sesión del bot y retornar 200 si la API Key es válida y el servicio tiene éxito', async () => {
      mockWhatsappService.logout.mockResolvedValue({ success: true, message: 'Sesión cerrada correctamente' });

      const response = await request(app)
        .post('/api/bot/logout')
        .set('x-api-key', testApiKey);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Sesión cerrada correctamente');
      expect(mockWhatsappService.logout).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 400 si el servicio de logout reporta un fallo (ej. no hay sesión)', async () => {
      mockWhatsappService.logout.mockResolvedValue({ success: false, error: 'No hay sesión activa' });

      const response = await request(app)
        .post('/api/bot/logout')
        .set('x-api-key', testApiKey);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error', 'No hay sesión activa');
      expect(mockWhatsappService.logout).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 500 si el servicio de logout lanza un error inesperado', async () => {
      mockWhatsappService.logout.mockRejectedValue(new Error('Error crítico en el servicio de logout'));

      const response = await request(app)
        .post('/api/bot/logout')
        .set('x-api-key', testApiKey);

      expect(response.statusCode).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error al cerrar sesión del bot');
      expect(mockWhatsappService.logout).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 401 si no se provee API Key para logout', async () => {
      const response = await request(app).post('/api/bot/logout');
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Se requiere una clave API');
      expect(mockWhatsappService.logout).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/bot/qr-code', () => {
    let mockWhatsappService;

    beforeEach(() => {
      mockWhatsappService = require('../../src/services/whatsappService');
      // getConnectionState es la función relevante aquí
      mockWhatsappService.getConnectionState.mockReset(); 
    });

    test('debería retornar el código QR con estado 200 si está disponible y la API Key es válida', async () => {
      const mockQrCode = 'data:image/png;base64,mocked_qr_code_string';
      mockWhatsappService.getConnectionState.mockReturnValue({ 
        state: 'qr-ready', 
        qr: mockQrCode, 
        message: 'QR Code listo' 
      });

      const response = await request(app)
        .get('/api/bot/qr-code')
        .set('x-api-key', testApiKey);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('qr', mockQrCode);
      expect(mockWhatsappService.getConnectionState).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 404 si el estado no es qr-ready', async () => {
      mockWhatsappService.getConnectionState.mockReturnValue({ 
        state: 'connected', // Estado incorrecto
        qr: 'a_qr_code_string_but_state_is_wrong', 
        message: 'Bot ya conectado' 
      });

      const response = await request(app)
        .get('/api/bot/qr-code')
        .set('x-api-key', testApiKey);

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error', 'Código QR no disponible actualmente');
      expect(mockWhatsappService.getConnectionState).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 404 si el estado es qr-ready pero el QR es nulo', async () => {
      mockWhatsappService.getConnectionState.mockReturnValue({ 
        state: 'qr-ready', 
        qr: null, // QR nulo
        message: 'QR Code es nulo' 
      });

      const response = await request(app)
        .get('/api/bot/qr-code')
        .set('x-api-key', testApiKey);

      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error', 'Código QR no disponible actualmente');
      expect(mockWhatsappService.getConnectionState).toHaveBeenCalledTimes(1);
    });

    test('debería retornar 401 si no se provee API Key para qr-code', async () => {
      const response = await request(app).get('/api/bot/qr-code');
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Se requiere una clave API');
      // getConnectionState no debería ser llamado si la autenticación falla primero
      expect(mockWhatsappService.getConnectionState).not.toHaveBeenCalled(); 
    });
  });

  // Fin de los tests para botController
}); 