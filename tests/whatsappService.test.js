const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { prepareRowData } = require('../src/utils/dataHelpers'); // Importar la función refactorizada

// Mock de 'moment' para que devuelva una fecha y hora consistentes
jest.mock('moment', () => {
  const mMoment = {
    format: jest.fn(),
    // Puedes añadir más funciones de moment que necesites mockear
  };
  const momentInstance = jest.fn(() => mMoment);
  momentInstance.utc = jest.fn(() => mMoment); // Si usas moment.utc()
  return momentInstance;
});

// Mock de 'uuid' para que devuelva un UUID consistente
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

// Ya no necesitamos prepareRowData_testable aquí, la eliminamos.
// const prepareRowData_testable = (propertyData, userName, groupId, groupName) => { ... };

describe('prepareRowData from dataHelpers', () => {
  // Configuración común para los mocks antes de cada prueba
  beforeEach(() => {
    // Resetear mocks para asegurar que cada prueba comience limpia
    moment().format.mockReset();
    uuidv4.mockReset();

    // Configurar valores de retorno mockeados consistentes
    moment().format.mockImplementation((formatString) => {
      if (formatString === 'YYYY-MM-DD') return '2023-01-15';
      if (formatString === 'HH:mm:ss') return '10:30:00';
      return 'mocked-date-format';
    });
    uuidv4.mockReturnValue('mocked-uuid-1234');
  });

  test('debería mapear correctamente los datos completos de una propiedad a una fila de Google Sheets', () => {
    const propertyData = {
      type: 'Ofrezco',
      operation: 'Venta',
      propertyType: 'Casa',
      locationDetails: {
        region: 'Metropolitana',
        city: 'Santiago',
        comuna: 'Las Condes',
      },
      price: 250000000,
      priceCurrency: 'CLP',
      commonExpenses: 150000,
      bedrooms: 3,
      bathrooms: 2,
      parkingSlots: 1,
      storageUnits: 1,
      area: 120,
      contactInfo: {
        name: 'Juan Perez',
        phone: '+56912345678',
        email: 'juan.perez@example.com',
        isBroker: false,
      },
    };
    const userName = 'TestUser';
    const groupId = 'testGroupId'; // No usado directamente por prepareRowData pero pasado para consistencia
    const groupName = 'TestGroup'; // No usado directamente por prepareRowData pero pasado para consistencia

    const expectedRow = [
      'Ofrezco', 'Venta', 'Casa', 'Metropolitana', 'Santiago',
      'Las Condes', '', '', '', '3', '2', '1', '1', '250000000', 'CLP',
      '150000', '120', '+56912345678', 'juan.perez@example.com', '',
      'TestUser', '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];

    // Usamos la función importada directamente
    const resultRow = prepareRowData(propertyData, userName, groupId, groupName);
    expect(resultRow).toEqual(expectedRow);
    expect(moment().format).toHaveBeenCalledWith('YYYY-MM-DD');
    expect(moment().format).toHaveBeenCalledWith('HH:mm:ss');
    expect(uuidv4).toHaveBeenCalledTimes(1);
  });

  test('debería manejar datos incompletos o faltantes gracefully', () => {
    const propertyData = {
      type: 'Busco',
      operation: 'Arriendo',
      // Faltan propertyType, locationDetails, etc.
      contactInfo: {
        phone: '+56987654321',
        // Falta isBroker, email, etc.
      }
    };
    const userName = 'AnotherUser';

    const expectedRow = [
      'Busco', 'Arriendo', '', '', '', // propertyType, region, city vacíos
      '', '', '', '', // comunas vacías
      '', '', '', '', '', '', // dormitorios, baños, etc., vacíos
      '', '', '+56987654321', '', '', // GastosC, m2, correo vacíos, telefonoCorredor vacío
      'AnotherUser', '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    // Usamos la función importada directamente
    const resultRow = prepareRowData(propertyData, userName, 'someGroupId', 'someGroupName');
    expect(resultRow).toEqual(expectedRow);
  });

  test('debería manejar correctamente la información de contacto cuando isBroker no está definido', () => {
    const propertyData = {
      type: 'Ofrezco',
      operation: 'Venta',
      propertyType: 'Departamento',
      contactInfo: {
        phone: '+56911223344', // isBroker es undefined
      }
    };
    const userName = 'BrokerUndefinedUser';

    const expectedRow = [
      'Ofrezco', 'Venta', 'Departamento', '', '', // region, city vacíos
      '', '', '', '', // comunas vacías
      '', '', '', '', '', '', // dormitorios, baños, etc., vacíos
      '', '', '+56911223344', '', '', // GastosC, m2, correo vacíos, telefonoCorredor vacío
      'BrokerUndefinedUser', '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    // Usamos la función importada directamente
    const resultRow = prepareRowData(propertyData, userName, 'grpId', 'grpName');
    expect(resultRow).toEqual(expectedRow);
  });

  test('debería retornar una fila de strings vacíos (excepto fecha, hora, uuid, status, user) si propertyData es null', () => {
    const userName = 'UserWithNullData';
    const expectedRow = [
      '', '', '', '', '', // type, operation, propertyType, region, city
      '', '', '', '',     // comunas
      '', '', '', '', '', '', // dorms, baths, park, stor, price, currency
      '', '', '', '', '', // commonExp, area, phoneP, email, phoneC
      userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow = prepareRowData(null, userName, 'gid', 'gname');
    expect(resultRow).toEqual(expectedRow);
  });

  test('debería retornar una fila de strings vacíos (excepto fecha, hora, uuid, status, user) si propertyData es un objeto vacío', () => {
    const userName = 'UserWithEmptyData';
    const expectedRow = [
      '', '', '', '', '',
      '', '', '', '',
      '', '', '', '', '', '',
      '', '', '', '', '',
      userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow = prepareRowData({}, userName, 'gid', 'gname');
    expect(resultRow).toEqual(expectedRow);
  });

  test('debería manejar locationDetails nulo o vacío', () => {
    const propertyData = {
      type: 'Ofrezco',
      operation: 'Venta',
      propertyType: 'Terreno',
      locationDetails: null, // Testeando locationDetails nulo
      contactInfo: { phone: '+56911111111' }
    };
    const userName = 'UserLocationNull';
    const expectedRow = [
      'Ofrezco', 'Venta', 'Terreno', '', '', // region, city, comuna vacíos
      '', '', '', '',
      '', '', '', '', '', '',
      '', '', '+56911111111', '', '',
      userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow1 = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow1).toEqual(expectedRow);

    propertyData.locationDetails = {}; // Testeando locationDetails vacío
    const resultRow2 = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow2).toEqual(expectedRow);
  });

  test('debería manejar contactInfo nulo o vacío', () => {
    const propertyData = {
      type: 'Busco',
      operation: 'Arriendo',
      propertyType: 'Oficina',
      locationDetails: { comuna: 'Providencia' }, 
      contactInfo: null // Testeando contactInfo nulo
    };
    const userName = 'UserContactNull';
    const expectedRow = [
      'Busco', 'Arriendo', 'Oficina', '', '',
      'Providencia', '', '', '',
      '', '', '', '', '', '',
      '', '', '', '', '', // Teléfonos y email vacíos
      userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow1 = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow1).toEqual(expectedRow);

    propertyData.contactInfo = {}; // Testeando contactInfo vacío
    const resultRow2 = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow2).toEqual(expectedRow);
  });

  test('debería mapear el teléfono a telefonoCorredor si isBroker es true', () => {
    const propertyData = {
      contactInfo: {
        phone: '+56998765432',
        isBroker: true,
        email: 'broker@example.com'
      }
    };
    const userName = 'BrokerUser';
    const expectedRow = [
      '', '', '', '', '',
      '', '', '', '',
      '', '', '', '', '', '',
      '', '', '', 'broker@example.com', '+56998765432',
      userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow).toEqual(expectedRow);
  });

  test('debería manejar valores numéricos como 0 y números directos (no strings)', () => {
    const propertyData = {
      price: 0, // Precio es 0
      bedrooms: 0, // Dormitorios es 0
      bathrooms: 1,
      area: 100.5, // Área con decimal
      commonExpenses: 50000
    };
    const userName = 'NumericUser';
    const expectedRow = [
      '', '', '', '', '',
      '', '', '', '',
      '0', '1', '', '', '0', '', // Dorms '0', Baños '1', Estac/Bodega vacíos, Valor '0'
      '50000', '100.5', '', '', '', // G.Comunes '50000', Area '100.5'
      userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow).toEqual(expectedRow);
  });

  test('debería manejar valores no definidos para campos anidados gracefully', () => {
    const propertyData = {
        type: 'Ofrezco',
        // operation es undefined
        propertyType: 'Casa',
        locationDetails: {
            // region es undefined
            city: 'Santiago',
            comuna: undefined // comuna es undefined
        },
        price: undefined, // price es undefined
        contactInfo: {
            phone: undefined, // phone es undefined
            isBroker: undefined // isBroker es undefined
        }
    };
    const userName = 'UndefinedFieldsUser';
    const expectedRow = [
        'Ofrezco', '', 'Casa', '', 'Santiago',
        '', '', '', '', // comuna vacía
        '', '', '', '', '', '', // dorms, baños, etc. vacíos, price vacío
        '', '', '', '', '', // gastos comunes, area, teléfonos, email vacíos
        userName, '2023-01-15', '10:30:00', 'mocked-uuid-1234', 'Nuevo', '', ''
    ];
    const resultRow = prepareRowData(propertyData, userName, 'gid', 'gname');
    expect(resultRow).toEqual(expectedRow);
  });
}); 