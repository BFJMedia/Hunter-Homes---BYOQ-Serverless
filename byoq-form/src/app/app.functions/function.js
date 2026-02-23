const axios = require('axios');

exports.main = async (context) => {
  try {
  // Make GET request to the ZenQuotes API
  const response = await axios.get('https://zenquotes.io/api/random');

  // Extract the quote data (first item in the array)
  const quoteData = response.data[0];

  // Log the quote and author to console
  console.log(`"${quoteData.q}" — ${quoteData.a}`);

  // Return a properly formatted response with status code and body
    return {
    statusCode: 200,
    body: quoteData,
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
  // Handle any errors that occur during the request
  console.error('Error fetching quote:', error.message);

   // Return an error response
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch quote' },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};