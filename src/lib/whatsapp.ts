interface WhatsAppData {
  phone: string;
  name: string;
  bags: number;
  sariya: number;
  pointsAwarded: number;
  totalPoints: number;
  orderId: string;
  orderTime: string;
}

export async function sendWhatsAppNotification(data: WhatsAppData) {
  // Format order details in Hindi
  const orderDetails = [];
  if (data.bags > 0) orderDetails.push(`सीमेंट: ${data.bags} बैग`);
  if (data.sariya > 0) orderDetails.push(`सरिया: ${data.sariya}`);
  const orderDetailsText = orderDetails.join(', ') || 'ऑर्डर';

  try {
    // Meta requires the country code. If it's a 10 digit Indian number, add 91.
    let formattedPhone = data.phone.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME || 'order_approved_hindi', // Name of your template in Meta
          language: {
            code: 'hi' // Hindi language code
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: data.name },
                { type: 'text', text: orderDetailsText },
                { type: 'text', text: data.pointsAwarded.toString() },
                { type: 'text', text: data.totalPoints.toString() }
              ]
            }
          ]
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp API Error:', result);
    } else {
      console.log('WhatsApp message sent successfully to', formattedPhone);
    }
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
  }
}

