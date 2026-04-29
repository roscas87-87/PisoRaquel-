// netlify/functions/create-payment-intent.js
const Stripe = require('stripe');

exports.handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, checkin, checkout, guests, name } = JSON.parse(event.body);

    if (!amount || amount < 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Importe inválido' })
      };
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // en céntimos
      currency: 'eur',
      metadata: {
        checkin,
        checkout,
        guests: String(guests),
        name
      },
      description: `Reserva Vega Granada · ${checkin} → ${checkout}`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
    };

  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
