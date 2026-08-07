interface WhatsAppData {
  phone: string;
  name: string;
  bags: number;
  pointsAwarded: number;
  totalPoints: number;
  orderId: string;
  orderTime: string;
}

export async function sendWhatsAppNotification(data: WhatsAppData) {
  // 1. Generate the dynamic image URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const imageUrl = new URL('/api/og', baseUrl);
  imageUrl.searchParams.set('name', data.name);
  imageUrl.searchParams.set('points', data.pointsAwarded.toString());
  imageUrl.searchParams.set('total', data.totalPoints.toString());

  // 2. Format the message according to the approved template
  const date = new Date(data.orderTime).toLocaleDateString('en-IN');
  const time = new Date(data.orderTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const messageText = `🧾 *Vardhaman Group* — MB Builder Perfect Plus Cement

Namaste ${data.name} ji 🙏

Aapka order safaltapoorvak record ho gaya hai / Your order has been recorded:
📦 Bags Ordered: ${data.bags} bags
📅 Date & Time: ${date}, ${time}
🆔 Order ID: ${data.orderId}

🎉 Badhai ho! Aapko ${data.pointsAwarded} Reward Point mila hai.
Congratulations! You've earned ${data.pointsAwarded} Reward Point(s).

⭐ Total Points: ${data.totalPoints}

Points collect karte rahiye — inko aage jaakar khaas tofe/gifts ke liye redeem kiya ja sakta hai.
Keep collecting — these points can be redeemed for gifts ahead.

✅ Yeh reward hamare digital rewards system dwara automatically verify aur record kiya gaya hai. Order ID se kabhi bhi confirm kar sakte hain.`;

  // 3. Send using Meta Cloud API (Mocked for now until credentials are provided)
  console.log('--- MOCK WHATSAPP SEND ---');
  console.log('To:', data.phone);
  console.log('Image URL:', imageUrl.toString());
  console.log('Message:\n', messageText);
  console.log('--------------------------');
  
  // Real implementation will use fetch() to Meta's API here.
  // Example:
  /*
  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: data.phone,
      type: 'image',
      image: {
        link: imageUrl.toString(),
        caption: messageText
      }
    })
  });
  */
}
