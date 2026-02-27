const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
  try {
    // Get data from the request body (for POST) or params (for GET)
    const { body, params, method } = context;

    // Parse the incoming data
    let data;
    if (method === 'POST' && body) {
      try {
        data = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (parseError) {
        return {
          statusCode: 400,
          body: {
            success: false,
            error: 'Invalid JSON in request body'
          },
          headers: {
            'Content-Type': 'application/json'
          }
        };
      }
    } else {
      data = params;
    }

    // Validate required fields
    if (!data.email) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Email is required'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Invalid email format'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }

    // Initialize HubSpot client
    const hubspotClient = new hubspot.Client({
      accessToken: process.env.PRIVATE_APP_ACCESS_TOKEN
    });

    // ========================================
    // STEP 1: CREATE OR UPDATE CONTACT
    // ========================================

    const contactProperties = {
      email: data.email,
      firstname: data.firstname || data.first_name || '',
      lastname: data.lastname || data.last_name || '',
      mobilephone: data.phone || data.phone_number || data.mobilephone || '',
      byoq_lead: 'true' // Mark as BYOQ lead (radio select: true/false for Yes/No)
    };

    // Remove empty properties (except byoq_lead which should always be set)
    Object.keys(contactProperties).forEach(key => {
      if (!contactProperties[key] && key !== 'byoq_lead') {
        delete contactProperties[key];
      }
    });

    let contactId;
    let isNewContact = true;

    try {
      // Try to create new contact
      const contactResponse = await hubspotClient.crm.contacts.basicApi.create({
        properties: contactProperties
      });
      contactId = contactResponse.id;
      console.log('Created new contact:', contactId);
    } catch (createError) {
      // If contact already exists, update it instead
      const statusCode = createError.statusCode || createError.code || createError.response?.status;
      const errorBody = createError.body || createError.response?.body;

      if (statusCode === 409 || (errorBody && errorBody.category === 'CONFLICT')) {
        try {
          // Search for existing contact by email
          const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: data.email
              }]
            }]
          });

          if (searchResponse.results && searchResponse.results.length > 0) {
            contactId = searchResponse.results[0].id;

            // Update existing contact
            await hubspotClient.crm.contacts.basicApi.update(contactId, {
              properties: contactProperties
            });

            isNewContact = false;
            console.log('Updated existing contact:', contactId);
          } else {
            throw createError;
          }
        } catch (updateError) {
          console.error('Error updating contact:', updateError);
          throw updateError;
        }
      } else {
        throw createError;
      }
    }

    // ========================================
    // STEP 2: CREATE DEAL
    // ========================================

    // Build deal name: "First Name + Last Name [BYOQ]"
    const firstName = data.firstname || data.first_name || '';
    const lastName = data.lastname || data.last_name || '';
    const dealName = `${firstName} ${lastName} [BYOQ]`.trim();

    // Normalise region to CRM-accepted build_region values
    const regionToCRMValue = {
      // Hunter
      'Hunter':        'Hunter',
      'Cessnock':      'Hunter',
      'Maitland':      'Hunter',
      'Port Stephens': 'Hunter',
      'Singleton':     'Hunter',

      // Already valid CRM values — pass through as-is
      'Newcastle':     'Newcastle',
      'Lochinvar':     'Lochinvar',
      'Central Coast': 'Central Coast',
      'Lake Macquarie':'Lake Macquarie',
      'Hunter Valley': 'Hunter Valley',

      // Upper Hunter
      'Upper Hunter':  'Upper Hunter',
      'Muswellbrook':  'Upper Hunter',

      // Mid North Coast
      'Mid North Coast':'Mid North Coast',
      'Kempsey':       'Mid North Coast',
      'Port Macquarie':'Mid North Coast',

      // Northern Coast NSW
      'North Coast':   'Northern Coast NSW',
      'Coffs Harbour': 'Northern Coast NSW',
      'Nambucca':      'Northern Coast NSW',
      
      // New England
      'New England':   'New England',
      'Tamworth':      'Tamworth',
      'Armidale':      'New England',
      'Walcha':        'New England',
      'Gunnedah':      'New England'
    };

    const rawRegion = data.build_region || data.region || '';
    const normalisedRegion = regionToCRMValue[rawRegion] || rawRegion;

    const dealProperties = {
      dealname: dealName,
      dealstage: '2420237791', // Stage ID
      pipeline: '1458855366', // Pipeline ID
      build_region: normalisedRegion,
      land_status: data.land_status || '',
      budget_byoq: data.budget_byoq || data.budget || '',
      preferred_building_type_byoq: data.preferred_building_type_byoq || data.type || data.building_type || '',
      click_ons_byoq: data.click_ons_byoq || data.click_ons || '',
      estimated_investment_byoq: data.estimated_investment_byoq || data.running_total || data.estimated_investment || '',
      street: data.build_address || data.street || '',
      build_location_byoq: data.build_location_byoq || data.build_location || data.postcode || '',
      hunter_homes_design_byoq: data.hunter_homes_design_byoq || data.selected_design || data.design_name || '',
      selected_facade_byoq: data.selected_facade_byoq || data.selected_facade || ''
    };

    // Remove empty properties
    Object.keys(dealProperties).forEach(key => {
      if (!dealProperties[key] && key !== 'dealstage' && key !== 'pipeline') {
        delete dealProperties[key];
      }
    });

    console.log('Creating deal with properties:', dealProperties);

    const dealResponse = await hubspotClient.crm.deals.basicApi.create({
      properties: dealProperties
    });

    const dealId = dealResponse.id;
    console.log('Created deal:', dealId);

    // ========================================
    // STEP 2.5: CREATE + ASSOCIATE LINE ITEMS TO DEAL
    // ========================================

    const lineItemsAssociated = [];
    const lineItemsFailed = [];

    // --- 2.5a: house_line_item_id is a Product ID — create a line item from it first ---
    const houseProductId = data.house_line_item_id ? String(data.house_line_item_id) : null;
    if (houseProductId) {
      try {
        console.log('Creating house line item from product ID:', houseProductId);
        const houseLineItemResponse = await hubspotClient.crm.lineItems.basicApi.create({
          properties: {
            hs_product_id: houseProductId,
            quantity: '1'
          }
        });
        const houseLineItemId = houseLineItemResponse.id;
        console.log('✓ Created house line item:', houseLineItemId);

        await hubspotClient.crm.lineItems.associationsApi.create(
          houseLineItemId,
          'deals',
          dealId,
          'line_item_to_deal'
        );
        console.log('✓ Associated house line item', houseLineItemId, 'to deal', dealId);
        lineItemsAssociated.push(houseLineItemId);
      } catch (houseLineItemError) {
        console.error('✗ Failed to create/associate house line item from product', houseProductId);
        console.error('  Message:', houseLineItemError.message);
        lineItemsFailed.push({ id: houseProductId, type: 'house_product', error: houseLineItemError.message });
      }
    }

    // --- 2.5b: Associate facade line item ID directly (it's an existing line item ID) ---
    const facadeLineItemId = data.facade_line_item_id ? String(data.facade_line_item_id) : null;
    if (facadeLineItemId) {
      try {
        await hubspotClient.crm.lineItems.associationsApi.create(
          facadeLineItemId,
          'deals',
          dealId,
          'line_item_to_deal'
        );
        console.log('✓ Associated facade line item', facadeLineItemId, 'to deal', dealId);
        lineItemsAssociated.push(facadeLineItemId);
      } catch (facadeLineItemError) {
        console.error('✗ Failed to associate facade line item', facadeLineItemId);
        console.error('  Message:', facadeLineItemError.message);
        lineItemsFailed.push({ id: facadeLineItemId, type: 'facade_line_item', error: facadeLineItemError.message });
      }
    }

    // --- 2.5c: Create line items from product IDs (inclusions, offers, upgrades) ---
    let otherProductIds = data.line_item_ids || data.line_items || [];
    if (typeof otherProductIds === 'string') {
      otherProductIds = otherProductIds.split(',').map(id => id.trim()).filter(id => id);
    }

    // Remove house product ID from the array if present (already handled in 2.5a)
    otherProductIds = otherProductIds.filter(id => id !== houseProductId);

    if (otherProductIds.length > 0) {
      console.log('Creating line items from', otherProductIds.length, 'product IDs:', otherProductIds);

      for (const productId of otherProductIds) {
        try {
          const lineItemResponse = await hubspotClient.crm.lineItems.basicApi.create({
            properties: {
              hs_product_id: productId,
              quantity: '1'
            }
          });
          const newLineItemId = lineItemResponse.id;
          console.log('✓ Created line item', newLineItemId, 'from product', productId);

          await hubspotClient.crm.lineItems.associationsApi.create(
            newLineItemId,
            'deals',
            dealId,
            'line_item_to_deal'
          );
          console.log('✓ Associated line item', newLineItemId, 'to deal', dealId);
          lineItemsAssociated.push(newLineItemId);
        } catch (lineItemError) {
          console.error('✗ Failed to create/associate line item from product', productId);
          console.error('  Message:', lineItemError.message);
          lineItemsFailed.push({ id: productId, type: 'product', error: lineItemError.message });
        }
      }

      console.log('Line items complete. Associated:', lineItemsAssociated.length, '/ Failed:', lineItemsFailed.length);
    } else {
      console.log('No additional product IDs to process');
    }

    // ========================================
    // STEP 3: ASSOCIATE DEAL TO CONTACT
    // ========================================

    console.log('Attempting to associate Deal:', dealId, 'with Contact:', contactId);

    try {
      // Try using v3 associations API (more reliable for standard objects)
      const associationResponse = await hubspotClient.crm.deals.associationsApi.create(
        dealId,
        'contacts',
        contactId,
        'deal_to_contact'
      );
      console.log('✓ Successfully associated deal to contact');
      console.log('Association response:', JSON.stringify(associationResponse, null, 2));
    } catch (assocError) {
      console.error('✗ Error associating deal to contact');
      console.error('Error message:', assocError.message);
      console.error('Error status:', assocError.statusCode || assocError.code);
      console.error('Error body:', JSON.stringify(assocError.body || assocError.response?.body, null, 2));
      console.error('Full error:', assocError);
      // Don't fail the entire request if association fails
    }

    // ========================================
    // STEP 4: ASSOCIATE DEAL TO HOME DESIGN (if provided)
    // ========================================

    const houseDesignId = data.house_design_id || data.selected_design_id || data.design_id;
    if (houseDesignId) {
      try {
        // Associate deal to houses custom object (ID: 2-44132397)
        await hubspotClient.apiRequest({
          method: 'PUT',
          path: `/crm/v4/objects/deals/${dealId}/associations/default/2-44132397/${houseDesignId}`
        });
        console.log('Associated deal to house design (houses):', houseDesignId);
      } catch (designAssocError) {
        console.error('Error associating deal to house design:', designAssocError.message);
        // Don't fail the entire request if association fails
      }
    }

    // ========================================
    // STEP 5: ASSOCIATE DEAL TO FACADE (if provided)
    // ========================================

    const facadeId = data.selected_facade_id || data.facade_id;
    if (facadeId) {
      try {
        // Associate deal to facades custom object (ID: 2-209779050)
        await hubspotClient.apiRequest({
          method: 'PUT',
          path: `/crm/v4/objects/deals/${dealId}/associations/default/2-209779050/${facadeId}`
        });
        console.log('Associated deal to facade (facades):', facadeId);
      } catch (facadeAssocError) {
        console.error('Error associating deal to facade:', facadeAssocError.message);
        console.error('Facade association error details:', facadeAssocError);
        // Don't fail the entire request if association fails
      }
    } else {
      console.log('No facade ID provided, skipping facade association');
    }

    // ========================================
    // SUCCESS RESPONSE
    // ========================================

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Deal created successfully',
        contactId: contactId,
        dealId: dealId,
        isNewContact: isNewContact,
        dealName: dealName,
        lineItemsAssociated: lineItemsAssociated.length,
        lineItemIds: lineItemsAssociated,
        lineItemsFailed: lineItemsFailed
      },
      headers: {
        'Content-Type': 'application/json'
      }
    };

  } catch (error) {
    console.error('Error creating deal:', error.message);
    console.error('Error details:', error);

    // Return appropriate error response
    return {
      statusCode: error.statusCode || 500,
      body: {
        success: false,
        error: error.message || 'Failed to create deal',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
};
