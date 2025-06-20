// src/app/api/whatsapp-bot/conversation/[telefono]/route.ts
import { NextResponse } from 'next/server';
import { getConversation } from '@/lib/whatsappBotStore';

export async function GET(
  request: Request,
  { params }: { params: { telefono: string } }
) {
  try {
    const { telefono } = params;
    console.log(`[API GetConversation] Recibida solicitud GET para telefono: ${telefono}`);
    
    if (!telefono) {
      console.error('[API GetConversation] Error: Número de teléfono no proporcionado en la ruta.');
      return NextResponse.json({ success: false, message: 'Número de teléfono no proporcionado.' }, { status: 400 });
    }

    const conversationMessages = getConversation(telefono);
    console.log(`[API GetConversation] Devolviendo ${conversationMessages.length} mensajes para ${telefono}.`);
    return NextResponse.json(conversationMessages);
  } catch (error: any) {
    // Adding more context to the error log
    console.error(`[API GetConversation] Error procesando la solicitud. Error: ${error.message}`);
    return NextResponse.json({ success: false, message: error.message || 'Error interno del servidor al obtener conversación.' }, { status: 500 });
  }
}
