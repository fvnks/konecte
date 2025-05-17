const apiKeyController = require('../src/controllers/apiKeyController');
// const { pool } = require('../src/config/database'); // Se mockea con jest.doMock
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Mockear dependencias a nivel de módulo. Jest las "elevará" (hoist).
jest.mock('uuid');
jest.mock('crypto');
jest.mock('../src/config/logger');
jest.mock('../src/config/database');

describe('apiKeyController', () => {
  let mockPoolQuery;
  let mockUuidV4;
  let mockCryptoRandomBytes;
  let mockLoggerError;
  let mockReq;
  let mockRes;
  let freshApiKeyController;

  beforeEach(() => {
    jest.resetModules(); // Resetear módulos para una instancia limpia del controlador y sus dependencias

    // Requerir las dependencias mockeadas DESPUÉS de resetModules
    // Esto nos da acceso a las funciones mockeadas que el controlador usará.
    const { pool } = require('../src/config/database');
    mockPoolQuery = pool.query;
    
    const uuid = require('uuid');
    mockUuidV4 = uuid.v4;
    
    const crypto = require('crypto');
    mockCryptoRandomBytes = crypto.randomBytes;
    
    const logger = require('../src/config/logger');
    mockLoggerError = logger.error;

    // Re-importar el controlador para que use las dependencias recién mockeadas/referenciadas
    const reloadedController = require('../src/controllers/apiKeyController');
    freshApiKeyController = {
        getAllApiKeys: reloadedController.getAllApiKeys,
        createApiKey: reloadedController.createApiKey,
        toggleApiKey: reloadedController.toggleApiKey,
        deleteApiKey: reloadedController.deleteApiKey,
        validateApiKey: reloadedController.validateApiKey
    };

    // Resetear los mocks para asegurar que cada test comience limpio
    mockPoolQuery.mockReset();
    mockUuidV4.mockReset();
    mockCryptoRandomBytes.mockReset();
    mockLoggerError.mockReset();

    // Configurar respuestas mock por defecto para uuid y crypto
    mockUuidV4.mockReturnValue('mock-uuid');
    mockCryptoRandomBytes.mockReturnValue({ toString: () => 'mockrandombytes' });

    mockReq = {
      body: {},
      params: {},
      user: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      sendStatus: jest.fn(),
    };
  });

  // La función generateApiKey no se exporta, pero es llamada por createApiKey.
  // Podemos probarla indirectamente o, si fuera más compleja, se podría exportar para testeo directo.
  // Por ahora, confiaremos en el test de createApiKey para cubrirla.

  describe('createApiKey', () => {
    test('debería crear una API key y retornarla con estado 201', async () => {
      mockReq.body = { description: 'Test Key', expires_at: null };
      const expectedApiKey = 'pk_mock-uuid_mockrandombytes';
      // Para pool.query que devuelve [{ insertId: 123 }]
      // La consulta de inserción devuelve un array con un objeto, donde la primera posición (índice 0) es el objeto de resultado.
      mockPoolQuery.mockResolvedValue([{ insertId: 123 }]);

      await freshApiKeyController.createApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'INSERT INTO api_keys (api_key, description, is_active, expires_at) VALUES (?, ?, TRUE, ?)',
        [expectedApiKey, 'Test Key', null]
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Clave API creada con éxito',
        api_key: expectedApiKey,
        id: 123,
      });
      expect(mockUuidV4).toHaveBeenCalledTimes(1);
      expect(mockCryptoRandomBytes).toHaveBeenCalledWith(16);
    });

    test('debería manejar errores de base de datos y retornar estado 500', async () => {
      mockReq.body = { description: 'Test Key Error' };
      const dbError = new Error('DB error');
      mockPoolQuery.mockRejectedValue(dbError);

      await freshApiKeyController.createApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al crear clave API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al crear clave API: DB error');
    });
  });

  describe('getAllApiKeys', () => {
    test('debería retornar todas las API keys con estado 200', async () => {
      const mockKeys = [
        { id: 1, api_key: 'key1', description: 'Test Key 1', is_active: true, created_at: '2023-01-01', expires_at: null },
        { id: 2, api_key: 'key2', description: 'Test Key 2', is_active: false, created_at: '2023-01-02', expires_at: '2024-01-01' },
      ];
      // pool.query para SELECT devuelve [rows, fields], así que mockeamos solo las filas
      mockPoolQuery.mockResolvedValue([mockKeys]); 

      await freshApiKeyController.getAllApiKeys(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT id, api_key, description, is_active, created_at, expires_at FROM api_keys'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ apiKeys: mockKeys });
    });

    test('debería manejar errores de base de datos y retornar estado 500', async () => {
      const dbError = new Error('DB fetch error');
      mockPoolQuery.mockRejectedValue(dbError);

      await freshApiKeyController.getAllApiKeys(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al obtener claves API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al obtener claves API: DB fetch error');
    });
  });

  describe('toggleApiKey', () => {
    test('debería activar una API key y retornar estado 200', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { is_active: true };

      // Simular que la key existe (primera consulta SELECT)
      mockPoolQuery.mockResolvedValueOnce([[{ id: 1 }]]); 
      // Simular que el UPDATE es exitoso (segunda consulta UPDATE)
      mockPoolQuery.mockResolvedValueOnce([{}]); // El resultado exacto de UPDATE no suele usarse, solo que no falle.

      await freshApiKeyController.toggleApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenNthCalledWith(1, 'SELECT id FROM api_keys WHERE id = ?', ['1']);
      expect(mockPoolQuery).toHaveBeenNthCalledWith(2, 'UPDATE api_keys SET is_active = ? WHERE id = ?', [true, '1']);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Clave API activada con éxito' });
    });

    test('debería desactivar una API key y retornar estado 200', async () => {
      mockReq.params = { id: '2' };
      mockReq.body = { is_active: false };

      mockPoolQuery.mockResolvedValueOnce([[{ id: 2 }]]); // Key existe
      mockPoolQuery.mockResolvedValueOnce([{}]);          // UPDATE exitoso

      await freshApiKeyController.toggleApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenNthCalledWith(1, 'SELECT id FROM api_keys WHERE id = ?', ['2']);
      expect(mockPoolQuery).toHaveBeenNthCalledWith(2, 'UPDATE api_keys SET is_active = ? WHERE id = ?', [false, '2']);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Clave API desactivada con éxito' });
    });

    test('debería retornar estado 400 si is_active no se proporciona', async () => {
      mockReq.params = { id: '3' };
      mockReq.body = {}; // is_active no está aquí

      await freshApiKeyController.toggleApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Se requiere el campo is_active' });
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    test('debería retornar estado 404 si la API key no se encuentra', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { is_active: true };

      mockPoolQuery.mockResolvedValueOnce([[]]); // Simula que la SELECT no encuentra la key

      await freshApiKeyController.toggleApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT id FROM api_keys WHERE id = ?', ['999']);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Clave API no encontrada' });
    });

    test('debería retornar estado 500 si falla la consulta SELECT', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { is_active: true };
      const dbError = new Error('DB SELECT error');
      mockPoolQuery.mockRejectedValueOnce(dbError); // Falla la primera consulta (SELECT)

      await freshApiKeyController.toggleApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al actualizar clave API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al actualizar clave API: DB SELECT error');
    });

    test('debería retornar estado 500 si falla la consulta UPDATE', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { is_active: true };
      const dbError = new Error('DB UPDATE error');

      mockPoolQuery.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT exitoso
      mockPoolQuery.mockRejectedValueOnce(dbError);       // UPDATE falla

      await freshApiKeyController.toggleApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al actualizar clave API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al actualizar clave API: DB UPDATE error');
    });
  });

  describe('deleteApiKey', () => {
    test('debería eliminar una API key y retornar estado 200', async () => {
      mockReq.params = { id: '10' };

      // Simular que la key existe (primera consulta SELECT)
      mockPoolQuery.mockResolvedValueOnce([[{ id: 10 }]]); 
      // Simular que el DELETE es exitoso (segunda consulta DELETE)
      mockPoolQuery.mockResolvedValueOnce([{}]); // El resultado de DELETE no suele usarse, solo que no falle.

      await freshApiKeyController.deleteApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenNthCalledWith(1, 'SELECT id FROM api_keys WHERE id = ?', ['10']);
      expect(mockPoolQuery).toHaveBeenNthCalledWith(2, 'DELETE FROM api_keys WHERE id = ?', ['10']);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Clave API eliminada con éxito' });
    });

    test('debería retornar estado 404 si la API key no se encuentra para eliminar', async () => {
      mockReq.params = { id: '998' };
      mockPoolQuery.mockResolvedValueOnce([[]]); // Simula que la SELECT no encuentra la key

      await freshApiKeyController.deleteApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT id FROM api_keys WHERE id = ?', ['998']);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Clave API no encontrada' });
      // Asegurarse que la consulta DELETE no se llamó
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    });

    test('debería retornar estado 500 si falla la consulta SELECT al intentar eliminar', async () => {
      mockReq.params = { id: '11' };
      const dbError = new Error('DB SELECT error for delete');
      mockPoolQuery.mockRejectedValueOnce(dbError); // Falla la primera consulta (SELECT)

      await freshApiKeyController.deleteApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al eliminar clave API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al eliminar clave API: DB SELECT error for delete');
    });

    test('debería retornar estado 500 si falla la consulta DELETE', async () => {
      mockReq.params = { id: '12' };
      const dbError = new Error('DB DELETE error');

      mockPoolQuery.mockResolvedValueOnce([[{ id: 12 }]]); // SELECT exitoso
      mockPoolQuery.mockRejectedValueOnce(dbError);        // DELETE falla

      await freshApiKeyController.deleteApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al eliminar clave API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al eliminar clave API: DB DELETE error');
    });
  });

  describe('validateApiKey', () => {
    beforeEach(() => {
      // Limpiar timers si se usaron
      jest.useRealTimers();
    });

    test('debería retornar { valid: true } y estado 200 para una API key válida y activa', async () => {
      mockReq.params = { api_key: 'valid_active_key' };
      const apiKeyData = { id: 1, is_active: true, expires_at: null };
      mockPoolQuery.mockResolvedValue([[apiKeyData]]);

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT id, is_active, expires_at FROM api_keys WHERE api_key = ?',
        ['valid_active_key']
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ valid: true });
    });

    test('debería retornar estado 400 si no se proporciona api_key', async () => {
      mockReq.params = {}; // api_key no está aquí

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Se requiere la clave API' });
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    test('debería retornar { valid: false, error: ... } y estado 404 si la API key no se encuentra', async () => {
      mockReq.params = { api_key: 'not_found_key' };
      mockPoolQuery.mockResolvedValue([[]]); // Key no encontrada

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ valid: false, error: 'Clave API no encontrada' });
    });

    test('debería retornar { valid: false, error: ... } y estado 403 si la API key está inactiva', async () => {
      mockReq.params = { api_key: 'inactive_key' };
      const apiKeyData = { id: 2, is_active: false, expires_at: null };
      mockPoolQuery.mockResolvedValue([[apiKeyData]]);

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ valid: false, error: 'Clave API inactiva' });
    });

    test('debería retornar { valid: false, error: ... } y estado 403 si la API key está expirada', async () => {
      jest.useFakeTimers();
      const now = new Date('2023-06-15T10:00:00.000Z');
      const expiredDate = new Date('2023-06-14T23:59:59.000Z'); // Un día antes
      jest.setSystemTime(now);

      mockReq.params = { api_key: 'expired_key' };
      const apiKeyData = { id: 3, is_active: true, expires_at: expiredDate.toISOString() };
      mockPoolQuery.mockResolvedValue([[apiKeyData]]);

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ valid: false, error: 'Clave API expirada' });
      
      jest.useRealTimers(); // Restaurar timers reales
    });

    test('debería retornar { valid: true } y estado 200 para una API key activa con fecha de expiración futura', async () => {
      jest.useFakeTimers();
      const now = new Date('2023-06-15T10:00:00.000Z');
      const futureDate = new Date('2023-06-16T00:00:00.000Z'); // Un día después
      jest.setSystemTime(now);

      mockReq.params = { api_key: 'future_expiry_key' };
      const apiKeyData = { id: 4, is_active: true, expires_at: futureDate.toISOString() };
      mockPoolQuery.mockResolvedValue([[apiKeyData]]);

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ valid: true });

      jest.useRealTimers();
    });
    
    test('debería retornar estado 500 si falla la consulta de base de datos', async () => {
      mockReq.params = { api_key: 'any_key' };
      const dbError = new Error('DB validation error');
      mockPoolQuery.mockRejectedValue(dbError);

      await freshApiKeyController.validateApiKey(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ valid: false, error: 'Error al validar clave API' });
      expect(mockLoggerError).toHaveBeenCalledWith('Error al validar clave API: DB validation error');
    });
  });

}); 