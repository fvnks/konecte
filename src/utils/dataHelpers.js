const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

/**
 * Prepara los datos de una propiedad para ser insertados como una fila en Google Sheets.
 * @param {Object} propertyData - El objeto con los datos de la propiedad extraídos por Gemini.
 * @param {string} userName - Nombre del usuario de WhatsApp que envió el mensaje.
 * @param {string} groupId - ID del grupo de WhatsApp donde se originó el mensaje.
 * @param {string} groupName - Nombre del grupo de WhatsApp.
 * @returns {Array<string>} - Un array de strings listos para ser insertados como fila.
 */
const prepareRowData = (propertyData, userName, groupId, groupName) => {
  const timestamp = moment();

  const type = propertyData?.type || '';
  const operation = propertyData?.operation || '';
  const propertyType = propertyData?.propertyType || '';
  
  const locationDetails = propertyData?.locationDetails || {};
  const region = locationDetails.region || '';
  const city = locationDetails.city || '';
  const comuna = locationDetails.comuna || '';

  const price = propertyData?.price !== undefined ? String(propertyData.price) : '';
  const priceCurrency = propertyData?.priceCurrency || '';
  const commonExpenses = propertyData?.commonExpenses !== undefined ? String(propertyData.commonExpenses) : '';
  
  const bedrooms = propertyData?.bedrooms !== undefined ? String(propertyData.bedrooms) : '';
  const bathrooms = propertyData?.bathrooms !== undefined ? String(propertyData.bathrooms) : '';
  const parkingSlots = propertyData?.parkingSlots !== undefined ? String(propertyData.parkingSlots) : '';
  const storageUnits = propertyData?.storageUnits !== undefined ? String(propertyData.storageUnits) : '';
  const area = propertyData?.area !== undefined ? String(propertyData.area) : '';

  const contactInfo = propertyData?.contactInfo || {};
  const contactPhone = contactInfo.phone || '';
  const contactEmail = contactInfo.email || '';
  const isBroker = contactInfo.isBroker;

  let telefonoParticular = '';
  let telefonoCorredor = '';
  if (contactPhone) {
    if (isBroker === true) {
      telefonoCorredor = contactPhone;
    } else if (isBroker === false) {
      telefonoParticular = contactPhone;
    } else {
      telefonoParticular = contactPhone; 
    }
  }
  const correoElectronico = contactEmail;

  const sheetHeaders = [
    'Busco / Ofrezco', 'Tipo de Operacion', 'Propiedad', 'Region', 'Ciudad', 
    'Opcion Comuna', 'Opcion Comuna 2', 'Opcion Comuna 3', 'Opcion Comuna 4', 
    'Dormitorios', 'Baños', 'Estacionamiento', 'Bodegas', 'Valor', 'Moneda', 
    'Gastos Comunes', 'Metros Cuadrados', 'Telefono', 'Correo Electronico', 
    'Telefono Corredor', 'Nombre Whatsapp', 'Fecha Publicacion', 'Hora Publicacion', 
    'UID', 'Status', 'Null', 'Fecha del Último Seguimiento'
  ];

  const dataMap = {
    'Busco / Ofrezco': type,
    'Tipo de Operacion': operation,
    'Propiedad': propertyType,
    'Region': region,
    'Ciudad': city,
    'Opcion Comuna': comuna,
    'Opcion Comuna 2': '',
    'Opcion Comuna 3': '',
    'Opcion Comuna 4': '',
    'Dormitorios': bedrooms,
    'Baños': bathrooms,
    'Estacionamiento': parkingSlots,
    'Bodegas': storageUnits,
    'Valor': price,
    'Moneda': priceCurrency,
    'Gastos Comunes': commonExpenses,
    'Metros Cuadrados': area,
    'Telefono': telefonoParticular,
    'Correo Electronico': correoElectronico,
    'Telefono Corredor': telefonoCorredor,
    'Nombre Whatsapp': userName,
    'Fecha Publicacion': timestamp.format('YYYY-MM-DD'),
    'Hora Publicacion': timestamp.format('HH:mm:ss'),
    'UID': uuidv4(), // uuidv4 será mockeado en los tests
    'Status': 'Nuevo',
    'Null': '',
    'Fecha del Último Seguimiento': ''
  };
  
  const row = sheetHeaders.map(header => dataMap[header] !== undefined ? dataMap[header] : '');
  return row;
};

module.exports = {
    prepareRowData
}; 