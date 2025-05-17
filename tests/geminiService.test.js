// Mockear TODAS las dependencias PRIMERO
jest.mock('@google/generative-ai', () => {
  const mockGenerateContentFunction = jest.fn();
  const mockGenerativeModel = {
    generateContentStream: mockGenerateContentFunction,
  };
  const mockGoogleGenerativeAI = jest.fn(() => ({
    getGenerativeModel: jest.fn(() => mockGenerativeModel),
  }));
  return {
    GoogleGenerativeAI: mockGoogleGenerativeAI,
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    },
    HarmBlockThreshold: {
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    __esModule: true,
    mockGenerateContent: mockGenerateContentFunction
  };
});

jest.mock('../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Ahora los imports
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const geminiService = require('../src/services/geminiService');
// const { getConfig } = require('../src/config/config'); // Eliminado
const { pool } = require('../src/config/database'); // Aunque mockeado, se puede requerir si se necesita acceder a la estructura original del mock

describe('geminiService', () => {
  let mockGenerateContent;
  let freshGeminiService; // Para usar una instancia fresca del servicio en cada test

  beforeEach(() => {
    jest.resetModules(); // Primero resetear todos los módulos

    // Volver a mockear explícitamente las dependencias ANTES de re-importar el servicio
    // Esto asegura que freshGeminiService use estas instancias mockeadas.
    jest.doMock('../src/config/database', () => ({
      pool: {
        query: jest.fn(), // Creamos un nuevo mock fn para pool.query cada vez
      },
    }));

    // El mock para @google/generative-ai ya está definido globalmente con jest.mock,
    // pero necesitamos obtener la referencia a la función interna mockGenerateContent.
    // No necesitamos jest.doMock para @google/generative-ai aquí porque su estructura es más compleja
    // y el jest.mock global debería ser suficiente si lo manejamos bien.
    mockGenerateContent = require('@google/generative-ai').mockGenerateContent;
    mockGenerateContent.mockReset();

    freshGeminiService = require('../src/services/geminiService'); // Re-importar DESPUÉS de mockear dependencias
    
    // Obtener la referencia al pool.query mockeado que freshGeminiService usará
    // Esto es importante para configurar mockResolvedValue en los tests individuales.
    // No podemos usar la variable 'pool' importada globalmente porque esa podría ser de una instancia anterior.
    // En su lugar, accedemos al mock a través de require nuevamente o configuramos los tests para que no lo necesiten directamente.
    // Por simplicidad, vamos a asumir que los tests individuales configurarán pool.query así:
    // require('../src/config/database').pool.query.mockResolvedValue(...);
    // Y el reset lo hacemos directamente en la instancia mockeada:
    require('../src/config/database').pool.query.mockReset();

    // Limpiar cualquier mock de process.env que podamos haber establecido
    if (originalProcessEnv) {
      process.env = originalProcessEnv;
      originalProcessEnv = null;
    }
  });

  // Guardar el process.env original para restaurarlo
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

  describe('processPropertyMessage', () => {
    const messageText = 'Se vende casa grande en Las Condes, 3 dormitorios, 2 baños, 5000 UF';
    const basePrompt = 'Extrae la información de la siguiente propiedad: ${messageText}';

    // Helper para crear el mock del stream de Gemini
    const createMockGeminiStream = (jsonData) => {
      return (async function* () {
        yield { text: () => JSON.stringify(jsonData) };
      })();
    };

    test('debería procesar un mensaje y retornar datos estructurados de propiedad en un caso exitoso (API Key de DB)', async () => {
      const expectedData = {
        type: "Ofrezco",
        operation: "Venta",
        propertyType: "Casa",
        locationDetails: { comuna: "Las Condes" },
        price: 5000,
        priceCurrency: "UF",
        bedrooms: 3,
        bathrooms: 2
      };
      const mockStream = createMockGeminiStream(expectedData);
      mockGenerateContent.mockResolvedValue({ stream: mockStream });
      
      // Configurar el mock de pool.query para este test específico
      require('../src/config/database').pool.query.mockResolvedValue([[{ value: 'db-test-api-key' }]]); 
      mockProcessEnv({ GEMINI_API_KEY: undefined });

      const result = await freshGeminiService.processPropertyMessage(messageText, basePrompt);

      expect(result).toEqual(expectedData);
      expect(require('../src/config/database').pool.query).toHaveBeenCalledWith("SELECT value FROM settings WHERE key_name = 'GEMINI_API_KEY'");
      expect(require('@google/generative-ai').GoogleGenerativeAI).toHaveBeenCalledWith('db-test-api-key');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    test('debería procesar un mensaje usando API Key de process.env si no está en DB', async () => {
      const expectedData = { type: 'Ofrezco', operation: 'Arriendo' };
      const mockStream = createMockGeminiStream(expectedData);
      mockGenerateContent.mockResolvedValue({ stream: mockStream });

      // Configurar el mock de pool.query para este test específico
      require('../src/config/database').pool.query.mockResolvedValue([[]]); 
      mockProcessEnv({ GEMINI_API_KEY: 'env-test-api-key' });

      const result = await freshGeminiService.processPropertyMessage(messageText, basePrompt);

      expect(result).toEqual(expectedData);
      expect(require('../src/config/database').pool.query).toHaveBeenCalledWith("SELECT value FROM settings WHERE key_name = 'GEMINI_API_KEY'");
      expect(require('@google/generative-ai').GoogleGenerativeAI).toHaveBeenCalledWith('env-test-api-key');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    test('debería retornar null si la API key de Gemini no está disponible (ni DB ni env)', async () => {
      // Configurar el mock de pool.query para este test específico
      require('../src/config/database').pool.query.mockResolvedValue([[]]); 
      mockProcessEnv({ GEMINI_API_KEY: undefined }); // No hay API key en env

      const result = await freshGeminiService.processPropertyMessage(messageText, basePrompt);
      expect(result).toBeNull();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    test('debería lanzar un error si la API de Gemini falla (después de obtener la key)', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Error de la API de Gemini'));
      // Configurar el mock de pool.query para este test específico
      require('../src/config/database').pool.query.mockResolvedValue([[{ value: 'db-key-for-failure-test' }]]);
      mockProcessEnv({ GEMINI_API_KEY: undefined }); 

      const result = await freshGeminiService.processPropertyMessage(messageText, basePrompt);
      expect(result).toBeNull();
    });

    test('debería retornar null si la respuesta de Gemini no es un JSON válido', async () => {
      const mockInvalidStream = (async function* () {
        yield { text: () => "Esto no es un JSON" };
      })();
      mockGenerateContent.mockResolvedValue({ stream: mockInvalidStream });
      // Configurar el mock de pool.query para este test específico
      require('../src/config/database').pool.query.mockResolvedValue([[{ value: 'db-key-for-json-test' }]]);
      mockProcessEnv({ GEMINI_API_KEY: undefined }); 

      const result = await freshGeminiService.processPropertyMessage(messageText, basePrompt);
      expect(result).toBeNull();
    });
    
    // Test para la caché de la API Key (ejemplo básico)
    test('getGeminiApiKey debería usar la caché después de la primera llamada exitosa (DB)', async () => {
      // Configurar el mock de pool.query para la primera llamada
      require('../src/config/database').pool.query.mockResolvedValueOnce([[{ value: 'db-cached-api-key' }]]);
      mockProcessEnv({ GEMINI_API_KEY: undefined });

      // Primera llamada (debería ir a la DB)
      let apiKey = await freshGeminiService.getGeminiApiKey();
      expect(apiKey).toBe('db-cached-api-key');
      expect(require('../src/config/database').pool.query).toHaveBeenCalledTimes(1);

      // Segunda llamada (debería usar la caché)
      apiKey = await freshGeminiService.getGeminiApiKey();
      expect(apiKey).toBe('db-cached-api-key');
      expect(require('../src/config/database').pool.query).toHaveBeenCalledTimes(1); // No debería haber sido llamada de nuevo

      // Para un test más robusto de caché, necesitaríamos mockear Date.now()
    });

    test('getGeminiApiKey debería usar la caché después de la primera llamada exitosa (env)', async () => {
      // Configurar el mock de pool.query para la primera llamada (no encuentra en DB)
      require('../src/config/database').pool.query.mockResolvedValueOnce([[]]); 
      mockProcessEnv({ GEMINI_API_KEY: 'env-cached-api-key' });

      let apiKey = await freshGeminiService.getGeminiApiKey();
      expect(apiKey).toBe('env-cached-api-key');
      expect(require('../src/config/database').pool.query).toHaveBeenCalledTimes(1);
      
      apiKey = await freshGeminiService.getGeminiApiKey();
      expect(apiKey).toBe('env-cached-api-key');
      expect(require('../src/config/database').pool.query).toHaveBeenCalledTimes(1);
    });

  });
}); 