// Mockear TODAS las dependencias PRIMERO
jest.mock('../src/config/database');

jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Definir el mock de google-spreadsheet de forma autocontenida
// y que exponga sus funciones mock internas para control desde los tests.
// Los nombres deben empezar con "mock" para ser accesibles por la factory de jest.mock
let mockActualAddRow, mockActualLoadInfo; 

jest.mock('google-spreadsheet', () => {
  // Inicializar dentro de la factory pero usando las variables externas con prefijo "mock"
  mockActualAddRow = jest.fn();
  mockActualLoadInfo = jest.fn();

  const mockSheetInternal = {
    addRow: mockActualAddRow,
    title: 'Mocked Sheet Title',
  };
  const mockDocInternal = {
    loadInfo: mockActualLoadInfo,
    sheetsByIndex: [mockSheetInternal],
  };
  
  return {
    GoogleSpreadsheet: jest.fn(() => mockDocInternal),
    // Exponer los mocks para control externo (limpieza, aserciones específicas)
    __getMockActualAddRow: () => mockActualAddRow,
    __getMockActualLoadInfo: () => mockActualLoadInfo,
  };
});

// Ahora los imports de los módulos reales que se están probando u otras dependencias
const { GoogleSpreadsheet } = require('google-spreadsheet'); // Se importa el mock
const { JWT } = require('google-auth-library');
const googleSheetService = require('../src/services/googleSheetService');
const db = require('../src/config/database'); // Se importa el mock

describe('googleSheetService', () => {
  let freshGoogleSheetService;
  let mockPoolQuery;
  let originalProcessEnv;

  const mockProcessEnv = (newEnv) => {
    if (!originalProcessEnv) {
      originalProcessEnv = { ...process.env };
    }
    process.env = {
      ...originalProcessEnv,
      ...newEnv,
    };
  };

  beforeEach(() => {
    jest.resetModules(); // Importante para limpiar el estado de los módulos entre tests

    mockPoolQuery = jest.fn();
    jest.doMock('../src/config/database', () => ({
      pool: {
        query: mockPoolQuery,
      },
    }));

    freshGoogleSheetService = require('../src/services/googleSheetService');
    
    const gsheetMock = require('google-spreadsheet'); 
    gsheetMock.__getMockActualAddRow().mockClear();
    gsheetMock.__getMockActualLoadInfo().mockClear();
    gsheetMock.GoogleSpreadsheet.mockClear(); 

    if (originalProcessEnv) {
      process.env = originalProcessEnv;
      originalProcessEnv = null;
    }
  });

  describe('getGoogleSheetId', () => {
    test('debería obtener GOOGLE_SHEET_ID de la base de datos', async () => {
      mockPoolQuery.mockResolvedValue([[{ value: 'db-sheet-id' }]]);
      mockProcessEnv({ GOOGLE_SHEETS_ID: undefined });
      const sheetId = await freshGoogleSheetService.getGoogleSheetId();
      expect(sheetId).toBe('db-sheet-id');
      expect(mockPoolQuery).toHaveBeenCalledWith("SELECT value FROM settings WHERE key_name = 'GOOGLE_SHEET_ID'");
    });

    test('debería usar GOOGLE_SHEETS_ID de process.env si no está en DB', async () => {
      mockPoolQuery.mockResolvedValue([[]]);
      mockProcessEnv({ GOOGLE_SHEETS_ID: 'env-sheet-id' });
      const sheetId = await freshGoogleSheetService.getGoogleSheetId();
      expect(sheetId).toBe('env-sheet-id');
    });

    test('debería retornar null si GOOGLE_SHEET_ID no está ni en DB ni en env', async () => {
      mockPoolQuery.mockResolvedValue([[]]);
      mockProcessEnv({ GOOGLE_SHEETS_ID: undefined });
      const sheetId = await freshGoogleSheetService.getGoogleSheetId();
      expect(sheetId).toBeNull();
    });

    test('debería usar la caché para GOOGLE_SHEET_ID después de la primera llamada (DB)', async () => {
      mockPoolQuery.mockResolvedValueOnce([[{ value: 'db-cached-sheet-id' }]]);
      mockProcessEnv({ GOOGLE_SHEETS_ID: undefined });
      await freshGoogleSheetService.getGoogleSheetId();
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
      const sheetId = await freshGoogleSheetService.getGoogleSheetId();
      expect(sheetId).toBe('db-cached-sheet-id');
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('addPropertyToSheet', () => {
    const rowData = ['data1', 'data2', 'data3'];
    let gsheetMockInstance; 

    beforeEach(() => {
      gsheetMockInstance = require('google-spreadsheet'); 
    });

    test('debería añadir una fila y retornar rowIndex en un caso exitoso', async () => {
      mockPoolQuery.mockResolvedValue([[{ value: 'test-sheet-id' }]]);
      mockProcessEnv({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
        GOOGLE_PRIVATE_KEY: 'test_private_key',
        GOOGLE_SHEETS_ID: 'this-will-be-overridden-by-db'
      });
      gsheetMockInstance.__getMockActualAddRow().mockResolvedValue({ rowIndex: 5 });
      const rowIndex = await freshGoogleSheetService.addPropertyToSheet(rowData);
      expect(rowIndex).toBe(5);
      expect(gsheetMockInstance.GoogleSpreadsheet).toHaveBeenCalledWith('test-sheet-id', expect.any(Object));
      expect(gsheetMockInstance.__getMockActualLoadInfo()).toHaveBeenCalledTimes(1);
      expect(gsheetMockInstance.__getMockActualAddRow()).toHaveBeenCalledWith(rowData);
    });

    test('debería retornar null si GOOGLE_SHEET_ID no está configurado', async () => {
      mockPoolQuery.mockResolvedValue([[]]);
      mockProcessEnv({
        GOOGLE_SHEETS_ID: undefined,
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
        GOOGLE_PRIVATE_KEY: 'test_private_key'
      });
      const result = await freshGoogleSheetService.addPropertyToSheet(rowData);
      expect(result).toBeNull();
      expect(gsheetMockInstance.__getMockActualAddRow()).not.toHaveBeenCalled();
    });

    test('debería retornar null si faltan credenciales de service account', async () => {
      mockPoolQuery.mockResolvedValue([[{ value: 'test-sheet-id' }]]);
      mockProcessEnv({
        GOOGLE_SHEETS_ID: 'test-sheet-id',
        GOOGLE_SERVICE_ACCOUNT_EMAIL: undefined,
        GOOGLE_PRIVATE_KEY: 'test_private_key'
      });
      const result = await freshGoogleSheetService.addPropertyToSheet(rowData);
      expect(result).toBeNull();
      expect(gsheetMockInstance.__getMockActualAddRow()).not.toHaveBeenCalled();
    });

    test('debería retornar null si sheet.addRow falla', async () => {
      mockPoolQuery.mockResolvedValue([[{ value: 'test-sheet-id' }]]);
      mockProcessEnv({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@example.com',
        GOOGLE_PRIVATE_KEY: 'test_private_key',
      });
      gsheetMockInstance.__getMockActualAddRow().mockRejectedValue(new Error('Error al añadir fila'));
      const result = await freshGoogleSheetService.addPropertyToSheet(rowData);
      expect(result).toBeNull();
    });
  });
}); 