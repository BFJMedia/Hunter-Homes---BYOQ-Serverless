const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
  try {
    const { body, params, method } = context;

    let data;
    if (method === 'POST' && body) {
      try {
        data = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (parseError) {
        return {
          statusCode: 400,
          body: { success: false, error: 'Invalid JSON in request body' },
          headers: { 'Content-Type': 'application/json' }
        };
      }
    } else {
      data = params;
    }

    if (!data.dealId) {
      return {
        statusCode: 400,
        body: { success: false, error: 'dealId is required' },
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const hubspotClient = new hubspot.Client({
      accessToken: process.env.PRIVATE_APP_ACCESS_TOKEN
    });

    await hubspotClient.crm.deals.basicApi.update(data.dealId, {
      properties: { email_byoq_pdf: 'true' }
    });

    console.log('Updated email_byoq_pdf to true for deal:', data.dealId);

    return {
      statusCode: 200,
      body: { success: true, message: 'Email quote triggered successfully', dealId: data.dealId },
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error('Error updating deal for email quote:', error.message);
    return {
      statusCode: error.statusCode || 500,
      body: { success: false, error: error.message || 'Failed to trigger email quote' },
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
