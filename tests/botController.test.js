const botController = require('../src/controllers/botController');

// Mockear dependencias a nivel de módulo
jest.mock('../src/services/whatsappService', () => ({
  getConnectionState: jest.fn(),
  initializeWhatsApp: jest.fn(),
  logout: jest.fn(),
  resetReconnectAttempts: jest.fn(),
  sendMessage: jest.fn(),
  restartClient: jest.fn(), // Asegurar que restartClient está mockeado
  // getQrCode no se llama directamente desde el controlador, sino que su info viene de getConnectionState
}));
jest.mock('../src/config/logger');

describe('botController', () => {
  let mockGetConnectionState;
  let mockInitializeWhatsApp;
  let mockLogout;
  let mockResetReconnectAttempts;
  let mockSendMessage;
  let mockRestartClient;
  let mockLoggerError;
  let mockLoggerInfo;
  let mockReq;
  let mockRes;
  let freshBotController;

  beforeEach(() => {
    jest.resetModules(); // Resetear módulos

    // Requerir dependencias mockeadas DESPUÉS de resetModules
    const whatsappService = require('../src/services/whatsappService');
    mockGetConnectionState = whatsappService.getConnectionState;
    mockInitializeWhatsApp = whatsappService.initializeWhatsApp;
    mockLogout = whatsappService.logout;
    mockResetReconnectAttempts = whatsappService.resetReconnectAttempts;
    mockSendMessage = whatsappService.sendMessage;
    mockRestartClient = whatsappService.restartClient;

    const logger = require('../src/config/logger');
    mockLoggerError = logger.error;
    mockLoggerInfo = logger.info;

    // Re-importar el controlador
    const reloadedController = require('../src/controllers/botController');
    freshBotController = {
      getStatus: reloadedController.getStatus,
      restartBot: reloadedController.restartBot,
      logout: reloadedController.logout,
      sendMessage: reloadedController.sendMessage,
      getQrCode: reloadedController.getQrCode,
    };

    // Resetear todos los mocks
    mockGetConnectionState.mockReset();
    mockInitializeWhatsApp.mockReset();
    mockLogout.mockReset();
    mockResetReconnectAttempts.mockReset();
    mockSendMessage.mockReset();
    mockRestartClient.mockReset();
    mockLoggerError.mockReset();
    mockLoggerInfo.mockReset();

    // Configurar mocks para req y res
    mockReq = {
      body: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    
    // Para controlar timers en restartBot
    jest.useRealTimers();
  });

  describe('getStatus', () => {
    test('debería retornar el estado de conexión y estado 200', async () => {
      const mockStatus = { state: 'connected', qr: null, attempts: 0 };
      mockGetConnectionState.mockReturnValue(mockStatus);

      await freshBotController.getStatus(mockReq, mockRes);

      expect(mockGetConnectionState).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: mockStatus });
    });

    test('debería manejar errores y retornar estado 500 si getConnectionState falla', async () => {
      const errorMessage = 'Error al obtener estado';
      // Forzar que getConnectionState lance un error para simular un error interno en el servicio
      // Aunque en el código original llama a una función síncrona, la envolvemos en async para probar el catch del controlador
      mockGetConnectionState.mockImplementation(() => { 
        throw new Error(errorMessage); 
      });

      await freshBotController.getStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al obtener estado del bot' });
      expect(mockLoggerError).toHaveBeenCalledWith(`Error al obtener estado del bot: ${errorMessage}`);
    });
  });

  describe('getQrCode', () => {
    test('debería retornar el código QR y estado 200 si está disponible', async () => {
      const mockState = { state: 'qr-ready', qr: 'mocked_qr_code_string' };
      mockGetConnectionState.mockReturnValue(mockState);

      await freshBotController.getQrCode(mockReq, mockRes);

      expect(mockGetConnectionState).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ qr: 'mocked_qr_code_string' });
    });

    test('debería retornar estado 404 si el estado no es qr-ready', async () => {
      const mockState = { state: 'connected', qr: null }; // Estado no es qr-ready
      mockGetConnectionState.mockReturnValue(mockState);

      await freshBotController.getQrCode(mockReq, mockRes);

      expect(mockGetConnectionState).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Código QR no disponible actualmente' });
    });

    test('debería retornar estado 404 si el estado es qr-ready pero no hay string QR', async () => {
      const mockState = { state: 'qr-ready', qr: null }; // No hay QR string
      mockGetConnectionState.mockReturnValue(mockState);

      await freshBotController.getQrCode(mockReq, mockRes);

      expect(mockGetConnectionState).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Código QR no disponible actualmente' });
    });

    test('debería manejar errores y retornar estado 500 si getConnectionState falla', async () => {
      const errorMessage = 'Error al obtener QR';
      mockGetConnectionState.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await freshBotController.getQrCode(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al obtener código QR' });
      expect(mockLoggerError).toHaveBeenCalledWith(`Error al obtener código QR: ${errorMessage}`);
    });
  });

  describe('logout', () => {
    test('debería cerrar sesión y retornar estado 200 en caso de éxito', async () => {
      const successMessage = 'Sesión cerrada exitosamente';
      mockLogout.mockResolvedValue({ success: true, message: successMessage });

      await freshBotController.logout(mockReq, mockRes);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: successMessage });
    });

    test('debería retornar estado 400 si el servicio de logout reporta un fallo controlado', async () => {
      const serviceErrorMessage = 'No hay sesión activa para cerrar';
      mockLogout.mockResolvedValue({ success: false, error: serviceErrorMessage });

      await freshBotController.logout(mockReq, mockRes);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: serviceErrorMessage });
    });

    test('debería manejar errores y retornar estado 500 si el servicio de logout falla inesperadamente', async () => {
      const errorMessage = 'Error inesperado al cerrar sesión';
      mockLogout.mockRejectedValue(new Error(errorMessage));

      await freshBotController.logout(mockReq, mockRes);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al cerrar sesión del bot' });
      expect(mockLoggerError).toHaveBeenCalledWith(`Error al cerrar sesión del bot: ${errorMessage}`);
    });
  });

  describe('sendMessage', () => {
    test('debería enviar un mensaje y retornar estado 200 en caso de éxito', async () => {
      mockReq.body = { jid: '12345@c.us', message: 'Hola Mundo' };
      mockSendMessage.mockResolvedValue({ success: true });

      await freshBotController.sendMessage(mockReq, mockRes);

      expect(mockSendMessage).toHaveBeenCalledWith('12345@c.us', 'Hola Mundo');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Mensaje enviado con éxito' });
    });

    test('debería retornar estado 400 si falta jid', async () => {
      mockReq.body = { message: 'Hola Mundo' }; // Falta jid

      await freshBotController.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Se requieren ID de WhatsApp (jid) y mensaje' });
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    test('debería retornar estado 400 si falta message', async () => {
      mockReq.body = { jid: '12345@c.us' }; // Falta message

      await freshBotController.sendMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Se requieren ID de WhatsApp (jid) y mensaje' });
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    test('debería retornar estado 400 si el servicio de sendMessage reporta un fallo controlado', async () => {
      mockReq.body = { jid: '12345@c.us', message: 'Hola Mundo' };
      const serviceErrorMessage = 'No se pudo enviar el mensaje al JID';
      mockSendMessage.mockResolvedValue({ success: false, error: serviceErrorMessage });

      await freshBotController.sendMessage(mockReq, mockRes);

      expect(mockSendMessage).toHaveBeenCalledWith('12345@c.us', 'Hola Mundo');
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: serviceErrorMessage });
    });

    test('debería manejar errores y retornar estado 500 si el servicio de sendMessage falla inesperadamente', async () => {
      mockReq.body = { jid: '12345@c.us', message: 'Hola Mundo' };
      const errorMessage = 'Error inesperado de red';
      mockSendMessage.mockRejectedValue(new Error(errorMessage));

      await freshBotController.sendMessage(mockReq, mockRes);

      expect(mockSendMessage).toHaveBeenCalledWith('12345@c.us', 'Hola Mundo');
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error al enviar mensaje' });
      expect(mockLoggerError).toHaveBeenCalledWith(`Error al enviar mensaje: ${errorMessage}`);
    });
  });

  describe('restartBot', () => {
    test('debería reiniciar el bot y retornar estado 200 en caso de éxito', async () => {
      mockRestartClient.mockResolvedValue({ success: true });

      await freshBotController.restartBot(mockReq, mockRes);

      expect(mockRestartClient).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Bot reiniciado con éxito' });
    });

    test('debería retornar estado 400 si el servicio de restartBot reporta un fallo controlado', async () => {
      const serviceErrorMessage = 'No se pudo reiniciar el cliente de WhatsApp';
      mockRestartClient.mockResolvedValue({ success: false, error: serviceErrorMessage });

      await freshBotController.restartBot(mockReq, mockRes);

      expect(mockRestartClient).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: serviceErrorMessage });
    });

    test('debería manejar errores y retornar estado 500 si el servicio de restartBot falla inesperadamente', async () => {
      const errorMessage = 'Error crítico durante el reinicio';
      mockRestartClient.mockRejectedValue(new Error(errorMessage));

      await freshBotController.restartBot(mockReq, mockRes);

      expect(mockRestartClient).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno al reiniciar el bot' });
      expect(mockLoggerError).toHaveBeenCalledWith(`Error al reiniciar el bot de WhatsApp: ${errorMessage}`);
    });
  });
}); 