# BYOQ Serverless Project - HunterHomes HubSpot Integration

## Project Overview

This project contains serverless functions designed to integrate HunterHomes' BYOQ (Build Your Own Quote) form with HubSpot CRM. The functions will handle complex house quote form submissions and create Deal objects with extensive custom properties in HubSpot.

**Client:** HunterHomes NSW
**Domain:** hunterhomesnsw.com
**HubSpot Account ID:** 44647342
**Platform Version:** 2025.1
**Account Type:** Marketing Hub Enterprise (with CMS Hub access for serverless functions)

---

## Current Status - ✅ PRODUCTION READY

### Deployment Status: SUCCESSFULLY DEPLOYED

**Live Endpoint:** `https://hunterhomesnsw.com/hs/serverless/create-deal`

**Current Build:** #11 (deployed)
**App Name:** Serverless function app (private app)
**App UID:** `serverless-function-app`

### Current Implementation - Complete Deal Creation Workflow

The `create-deal` endpoint is **PRODUCTION READY** with full deal creation and association functionality:

✅ **Creates/Updates Contacts** - Smart duplicate handling by email
✅ **Creates Deals** - With all BYOQ custom properties
✅ **Associates Deal to Contact** - Automatic association
✅ **Associates Deal to House Design** - Via Houses custom object (ID: 2-44132397)
✅ **Associates Deal to Facade** - Via Facades custom object (ID: 2-209779050)
✅ **Validates input** - Email format and required fields
✅ **Error handling** - Graceful error handling with detailed logging

**Previous Test Results (January 16, 2026):**
- Phase 1 Contact Management: Successfully tested and deployed

---

## create-deal.js - Complete Workflow Documentation

### Endpoint Flow (5 Steps)

The `create-deal` endpoint executes a comprehensive workflow to create contacts, deals, and associations in HubSpot CRM.

#### **STEP 1: Contact Management (Lines 64-130)**

**Purpose:** Create new contact or update existing contact

**Logic:**
1. Attempts to create a new contact with the provided email
2. If email already exists (409 conflict):
   - Searches for the existing contact by email
   - Updates the contact with new information
3. Returns `contactId` and `isNewContact` flag

**Contact Properties Mapped:**
```javascript
{
  email: data.email,                                         // Required
  firstname: data.firstname || data.first_name,             // First name
  lastname: data.lastname || data.last_name,                // Last name
  mobilephone: data.phone || data.phone_number || data.mobilephone,
  byoq_lead: 'true'                                         // Always marked as BYOQ lead
}
```

**Output:** `contactId` (used in Step 3)

---

#### **STEP 2: Deal Creation (Lines 132-169)**

**Purpose:** Create a new deal with BYOQ quote information

**Deal Configuration:**
- **Pipeline ID:** `1458855366`
- **Stage ID:** `2420237791`
- **Deal Name Format:** `"First Name Last Name [BYOQ]"`

**Deal Properties Mapped:**
```javascript
{
  dealname: "First Name Last Name [BYOQ]",                  // Auto-generated
  dealstage: "2420237791",                                  // Pipeline stage
  pipeline: "1458855366",                                   // Pipeline ID
  build_region: data.build_region || data.region,
  land_status: data.land_status,
  budget_byoq: data.budget_byoq || data.budget,
  preferred_building_type_byoq: data.preferred_building_type_byoq || data.type || data.building_type,
  click_ons_byoq: data.click_ons_byoq || data.click_ons,
  estimated_investment_byoq: data.estimated_investment_byoq || data.running_total || data.estimated_investment,
  build_location_byoq: data.build_location_byoq || data.build_location || data.postcode,
  hunter_homes_design_byoq: data.hunter_homes_design_byoq || data.selected_design || data.design_name,
  selected_facade_byoq: data.selected_facade_byoq || data.selected_facade
}
```

**Note:** Properties with multiple fallback options support flexible field naming from the form.

**Output:** `dealId` (used in Steps 3-5)

---

#### **STEP 3: Associate Deal to Contact (Lines 171-191)**

**Purpose:** Link the created deal to the contact

**Method:** HubSpot standard association
- **Association Type ID:** `3` (Deal to Contact)
- **Association Category:** `HUBSPOT_DEFINED`

**Error Handling:** Non-blocking - logs error but doesn't fail the request

---

#### **STEP 4: Associate Deal to House Design (Lines 193-211)**

**Purpose:** Link the deal to the selected house design from the Houses custom object

**Trigger:** Only executes if house design ID is provided

**Accepted Field Names:**
- `house_design_id`
- `selected_design_id`
- `design_id`

**Custom Object Details:**
- **Object Type:** `houses` (internal name)
- **Object ID:** `2-44132397`

**API Call:**
```javascript
PUT /crm/v4/objects/deals/${dealId}/associations/default/2-44132397/${houseDesignId}
```

**Error Handling:** Non-blocking - logs error but doesn't fail the request

---

#### **STEP 5: Associate Deal to Facade (Lines 213-232)**

**Purpose:** Link the deal to the selected facade from the Facades custom object

**Trigger:** Only executes if facade ID is provided

**Accepted Field Names:**
- `selected_facade_id`
- `facade_id`

**Custom Object Details:**
- **Object Type:** `facade` (internal name)
- **Object ID:** `2-209779050`

**API Call:**
```javascript
PUT /crm/v4/objects/deals/${dealId}/associations/default/2-209779050/${facadeId}
```

**Error Handling:** Non-blocking - logs error but doesn't fail the request

---

### Response Format

**Success Response (200):**
```json
{
  "success": true,
  "message": "Deal created successfully",
  "contactId": "273552795070",
  "dealId": "18234567890",
  "isNewContact": false,
  "dealName": "John Smith [BYOQ]"
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Email is required",
  "details": "Additional error details in development mode"
}
```

---

### Execution Order & Dependencies

```
1. Contact Created/Updated
   ↓ (contactId)
2. Deal Created
   ↓ (dealId)
3. Deal ← → Contact Association
   ↓
4. Deal ← → House Design Association (if ID provided)
   ↓
5. Deal ← → Facade Association (if ID provided)
   ↓
Success Response
```

**Why This Order:**
- Contact must be created FIRST to get `contactId` for association
- Deal must be created SECOND to get `dealId` for associations
- Associations happen LAST after both records exist
- Steps 4-5 are optional based on provided data

---

### Recommended HubSpot Workflows

While the serverless function handles data creation, HubSpot workflows should handle business processes:

**1. Sales Notification Workflow**
- **Trigger:** Deal created in pipeline `1458855366`
- **Actions:**
  - Send notification to sales team
  - Auto-assign deal owner by `build_region`
  - Create follow-up task

**2. Lead Nurturing Workflow**
- **Trigger:** Contact property `byoq_lead` = TRUE
- **Actions:**
  - Send thank you email to customer
  - Add to BYOQ nurture sequence
  - Update lifecycle stage to "Lead"

**3. Data Enrichment Workflow**
- **Trigger:** Deal created with `estimated_investment_byoq`
- **Actions:**
  - Calculate deal amount
  - Update contact properties
  - Add to marketing lists by region

**4. Missing Information Workflow**
- **Trigger:** Deal created but missing phone or key data
- **Actions:**
  - Create task for sales rep
  - Flag deal for follow-up

---

## Line Items Integration (Future Phase)

### Status: 📋 Planning Phase

Line Items will represent the quote breakdown (House Design, Facade, Click-Ons, Premium Inclusions, Offers, etc.) associated with each Deal.

### Recommended Approach: **Option A - Product Library with SKU/ID Matching**

**Benefits:**
- Prices controlled in HubSpot Product Library (single source of truth)
- Better deal analytics and revenue reporting
- Easy to update pricing without code changes
- Scalable for adding new products

### Product Categories to Create in HubSpot

1. **House Designs** - SKU format: `HOUSE_{design_id}` (e.g., `HOUSE_30213937175`)
2. **Facades** - SKU format: `FACADE_{facade_id}` (e.g., `FACADE_205637956033`)
3. **Click-Ons/Floor Plan Options** - SKU format: `CLICKON_{name}` (e.g., `CLICKON_ALFRESCO`)
4. **Premium/Luxury Inclusions** - SKU format: `PREMIUM_{name}` (e.g., `PREMIUM_LUXURY`)
5. **Offers/Discounts** - SKU format: `OFFER_{name}`, negative price (e.g., `OFFER_GIFT50K`)

### Expected Data Format from BYOQ Form

```javascript
{
  "email": "test@example.com",
  "firstname": "Sarah",
  // ... other contact/deal fields

  "line_items": [
    {
      "sku": "HOUSE_30213937175",
      "name": "Heyfield - 222",
      "quantity": 1,
      "price": 459055,
      "product_id": "12345678", // HubSpot Product Library ID
      "object_id": "30213937175" // For custom object association
    },
    {
      "sku": "FACADE_205637956033",
      "name": "Bowman Alt Facade",
      "quantity": 1,
      "price": 3740,
      "product_id": "87654321",
      "object_id": "205637956033"
    }
    // ... more line items
  ],
  "total_amount": 552795
}
```

### Implementation Strategy

**Code Flow (Step 2.5 - After Deal Creation):**
1. Loop through `line_items` array from form data
2. Create each line item using HubSpot Product Library product ID
3. Associate line item to deal
4. Log any errors but don't fail the entire request

**Required Scopes to Add:**
- `crm.objects.line_items.read`
- `crm.objects.line_items.write`

### Before Implementation

**To-Do List:**
- [ ] Create all products in HubSpot Product Library with SKU format above
- [ ] Get Product IDs for each product from HubSpot
- [ ] Update BYOQ form to send `line_items` array format
- [ ] Decide: Fetch prices from form or from HubSpot Product Library?
- [ ] Test product creation and association flow
- [ ] Update `app.json` with line items scopes
- [ ] Implement line items creation in `create-deal.js`

**Current Status:** Awaiting Product Library setup and final decision on pricing source (form vs. HubSpot).

---

## Actual Use Case - BYOQ House Quote Form

### Implementation Complete

The endpoint now creates **Deal objects** with complete contact management and associations in HubSpot CRM.

### Sample Form Data Structure

Based on the BYOQ form URL parameters, the system will collect:

**Customer Information:**
```
firstname: Jess
lastname: Pedrosa
email: jessiemarpedrosa@gmail.com
phone: 9322501133
```

**Property & Location:**
```
region: Central Coast
postcode: 2322
land_status: I own my land
```

**Budget & Design Preferences:**
```
budget: 400000-500000
type: Single Storey Designs
bedrooms: 4
bathrooms: 2
```

**Design Selection:**
```
selected_design: Heyfield
design_name: Heyfield - 222
selected_design_id: 30213937175
```

**Pricing Details:**
```
running_total: 552795
base_running_total: 459055
```

**Floor Plan Options:**
```
floorplan_options: extended-alfresco, study-/-home-office
floorplan_options_price: 25000
```

**Facade Selection:**
```
selected_facade: Bowman Alt Facade
facade_price: 3740
```

**Upgrades:**
```
upgrades: solar-system, ducted-air, ducted-air-conditioning
```

**Offers & Discounts:**
```
offer_selected: gift-50k
offer_discount: 50000
```

**Luxury Inclusions:**
```
luxury_inclusions: true, luxury-inclusions
luxury_price: 75000
```

**Progress Tracking:**
```
step: 7
```

### Full Sample URL

```
https://44647342-hs-sites-ap1-com.sandbox.hs-sites-ap1.com/byoq-form?firstname=Jess&lastname=Pedrosa&email=jessiemarpedrosa%40gmail.com&phone=9322501133&region=Central+Coast&postcode=2322&land_status=I+own+my+land&budget=400000-500000&type=Single+Storey+Designs&bedrooms=4&bathrooms=2&step=7&selected_design=Heyfield&design_name=Heyfield+-+222&selected_design_id=30213937175&running_total=552795&floorplan_options=extended-alfresco%2Cstudy-%2F-home-office&floorplan_options_price=25000&selected_facade=Bowman+Alt+Facade&facade_price=3740&base_running_total=459055&upgrades=solar-system%2Cducted-air%2Cducted-air-conditioning&offer_selected=gift-50k&offer_discount=50000&luxury_inclusions=true%2Cluxury-inclusions&luxury_price=75000
```

---

## Project Structure

```
byoq-serverless-project/
├── CLAUDE.md                       # This documentation file
├── byoq-form/                      # Main HubSpot project
│   ├── hsproject.json              # HubSpot project configuration
│   └── src/
│       └── app/
│           ├── app.json            # App metadata and scopes
│           └── app.functions/
│               ├── function.js      # Placeholder quote function
│               ├── serverless.json  # Function endpoint configuration
│               ├── package.json     # Dependencies (@hubspot/api-client, axios)
│               ├── create-deal.js   # ✅ PRODUCTION - Complete deal creation endpoint
│               └── test-endpoint.js # Test endpoint (legacy)
└── byoq-functions.functions/       # Legacy structure (not used)
```

---

## Configuration Files

### hsproject.json
```json
{
  "name": "byoq-form",
  "srcDir": "src",
  "platformVersion": "2025.1"
}
```

### app.json
```json
{
  "name": "Serverless function app",
  "description": "This app runs a serverless function for HunterHomes BYOQ Form.",
  "scopes": [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "crm.schemas.contacts.read",
    "crm.schemas.deals.read"
  ],
  "uid": "serverless-function-app",
  "public": false
}
```

### serverless.json
```json
{
  "appFunctions": {
    "quote-function": {
      "file": "function.js",
      "secrets": [],
      "endpoint": {
        "path": "fetch-quote",
        "method": ["GET"]
      }
    },
    "create-deal": {
      "file": "create-deal.js",
      "secrets": [],
      "endpoint": {
        "path": "create-deal",
        "method": ["GET", "POST"]
      }
    }
  }
}
```

---

## Current Implementation - create-deal.js

### Authentication

Uses HubSpot's automatic private app authentication:
```javascript
const hubspotClient = new hubspot.Client({
  accessToken: process.env.PRIVATE_APP_ACCESS_TOKEN
});
```

**Note:** `PRIVATE_APP_ACCESS_TOKEN` is automatically injected by HubSpot - no manual secret configuration needed.

### Key Features

1. **Input Validation**
   - Validates required email field
   - Checks email format with regex
   - Handles both POST (JSON body) and GET (query params)

2. **Smart Contact Management**
   - Creates new contacts if email doesn't exist
   - Updates existing contacts if email already exists (409 conflict handling)
   - Marks all contacts with `byoq_lead: true`

3. **Complete Deal Creation**
   - Creates deals with BYOQ custom properties
   - Sets pipeline and stage automatically
   - Generates deal name: "First Name Last Name [BYOQ]"

4. **Automatic Associations**
   - Deal ← → Contact (always)
   - Deal ← → House Design (if ID provided)
   - Deal ← → Facade (if ID provided)

5. **Error Handling**
   - Proper HTTP status codes (200, 400, 500)
   - Non-blocking association errors
   - Detailed console logging for debugging

### Field Mapping Summary

**Contact Properties:**
```javascript
{
  email: data.email,
  firstname: data.firstname || data.first_name,
  lastname: data.lastname || data.last_name,
  mobilephone: data.phone || data.phone_number || data.mobilephone,
  byoq_lead: 'true'
}
```

**Deal Properties:**
```javascript
{
  dealname: "First Name Last Name [BYOQ]",
  dealstage: "2420237791",
  pipeline: "1458855366",
  build_region: data.build_region || data.region,
  land_status: data.land_status,
  budget_byoq: data.budget_byoq || data.budget,
  preferred_building_type_byoq: data.type || data.building_type,
  click_ons_byoq: data.click_ons,
  estimated_investment_byoq: data.running_total || data.estimated_investment,
  build_location_byoq: data.build_location || data.postcode,
  hunter_homes_design_byoq: data.selected_design || data.design_name,
  selected_facade_byoq: data.selected_facade
}
```

**Custom Object Associations:**
- Houses (2-44132397): `house_design_id` or `selected_design_id` or `design_id`
- Facades (2-209779050): `selected_facade_id` or `facade_id`

---

## HubSpot CLI Commands

### Upload and Deploy Project
```bash
cd byoq-form
hs project upload --account HunterHomes
```

### List Recent Builds
```bash
hs project list-builds --account HunterHomes
```

### Check Account Info
```bash
hs accounts info
```

### Check Active Deployment
```bash
hs project list-builds --account HunterHomes
# Look for [deployed] tag
```

### Deploy with Force Flag (When Removing Endpoints)
```bash
cd byoq-form
hs project deploy --build [BUILD_NUMBER] --account HunterHomes --force
```

**Note:** Use `--force` when removing or renaming endpoints to override the component removal warning.

---

## Testing the Endpoint

### Test Complete Deal Creation (POST)
```bash
curl -X POST https://hunterhomesnsw.com/hs/serverless/create-deal \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstname": "John",
    "lastname": "Smith",
    "phone": "0412345678",
    "region": "Central Coast",
    "postcode": "2322",
    "land_status": "I own my land",
    "budget": "400000-500000",
    "type": "Single Storey Designs",
    "selected_design": "Heyfield",
    "design_name": "Heyfield - 222",
    "running_total": "552795",
    "selected_facade": "Bowman Alt Facade",
    "house_design_id": "30213937175",
    "selected_facade_id": "12345678"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Deal created successfully",
  "contactId": "273552795070",
  "dealId": "18234567890",
  "isNewContact": false,
  "dealName": "John Smith [BYOQ]"
}
```

### Test Minimal Deal Creation (POST)
```bash
curl -X POST https://hunterhomesnsw.com/hs/serverless/create-deal \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstname": "Jane",
    "lastname": "Doe"
  }'
```

### Test with GET (Query Params)
```bash
curl "https://hunterhomesnsw.com/hs/serverless/create-deal?email=test@example.com&firstname=John&lastname=Smith&region=Hunter+Valley"
```

---

## Next Steps for Production Integration

### Step 1: Frontend Integration
- Update BYOQ form to call `https://hunterhomesnsw.com/hs/serverless/create-deal`
- Pass all form data as POST request body
- Handle success/error responses
- Display confirmation to users

### Step 2: HubSpot Workflows Setup
- Create "New BYOQ Deal Created" workflow for sales notifications
- Create "BYOQ Lead Welcome" workflow for customer emails
- Set up deal assignment rules by region
- Configure follow-up task creation

### Step 3: Testing & Validation
- Test with real BYOQ form submissions
- Verify all associations are created correctly
- Check that workflows trigger properly
- Monitor console logs for any errors

### Step 4: Monitoring & Optimization
- Set up error monitoring in HubSpot logs
- Track deal creation success rates
- Monitor API usage and performance
- Gather feedback from sales team

### Step 5: Line Items Integration (Phase 3 - Future)
- Create products in HubSpot Product Library with SKU format
- Get Product IDs for all products (House Designs, Facades, Click-Ons, etc.)
- Update BYOQ form to send `line_items` array in request
- Add line items scopes to `app.json`
- Implement line items creation and association in `create-deal.js`
- Test complete quote breakdown with all line items

**See "Line Items Integration (Future Phase)" section above for detailed planning.**

---

## Important Technical Notes

### Platform Version Warning
```
[WARNING] Project platform v2025.1 will be deprecated on 6/1/2026.
Upgrade your platform version to 2025.2 before 6/1/2026 to avoid build failures.
```

**Note:** Platform 2025.2 does NOT support serverless functions for private apps. Stay on 2025.1 or wait for 2026.03 update.

### App Name Consistency
The app name must remain consistent across deployments to avoid "component removal" errors. Current name: `"Serverless function app"`

### Deployment History
- **Build #1-5:** Auto-deploy was skipped due to app name change
- **Build #6-7:** Manual deploy blocked due to "component removal" warning
- **Build #8-10:** Successfully deployed after reverting app name to match original
- **Build #11:** Endpoint renamed from submit-to-crm to create-deal, deployed with `--force` flag (component removal warning)

---

## Dependencies

### package.json
```json
{
  "name": "byoq-serverless-function",
  "version": "0.1.0",
  "author": "HubSpot",
  "license": "MIT",
  "dependencies": {
    "@hubspot/api-client": "^7.0.1",
    "axios": "^0.27.2"
  }
}
```

---

## Reference Links

### HubSpot Documentation
- [Serverless Functions for Private Apps](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/build-with-projects/serverless-functions)
- [Serverless Functions Reference](https://developers.hubspot.com/docs/platform/serverless-functions)
- [HubSpot CRM API - Deals](https://developers.hubspot.com/docs/api/crm/deals)
- [HubSpot CRM API - Contacts](https://developers.hubspot.com/docs/api/crm/contacts)

### Project Links
- **HubSpot Project Activity:** https://app.hubspot.com/developer-projects/44647342/project/byoq-form/activity
- **HubSpot CRM Contacts:** https://app.hubspot.com/contacts/44647342/objects/0-1/views/all/list
- **HubSpot CRM Deals:** https://app.hubspot.com/contacts/44647342/objects/0-3/views/all/list

---

## Contact & Support

**Project Owner:** HunterHomes NSW
**HubSpot Account:** 44647342 (Marketing Hub Enterprise with CMS access)
**Domain:** hunterhomesnsw.com
**Developer:** Claude + Jess

For HubSpot support:
- HubSpot Developer Documentation: https://developers.hubspot.com/
- HubSpot Community: https://community.hubspot.com/

---

## Development Timeline

| Date | Milestone | Status |
|------|-----------|--------|
| Jan 15, 2026 | Initial project creation | ✅ Complete |
| Jan 16, 2026 | Resolved CMS Hub deployment issues | ✅ Complete |
| Jan 16, 2026 | Fixed authentication (PRIVATE_APP_ACCESS_TOKEN) | ✅ Complete |
| Jan 16, 2026 | Contact creation/update working (Phase 1) | ✅ Complete |
| Jan 16, 2026 | Phase 1 testing successful | ✅ Complete |
| Jan 20, 2026 | Renamed endpoint from submit-to-crm to create-deal | ✅ Complete |
| Jan 20, 2026 | Gathered Deal property mappings and configuration | ✅ Complete |
| Jan 20, 2026 | Implemented complete Deal creation workflow | ✅ Complete |
| Jan 20, 2026 | Added Deal-Contact-House-Facade associations | ✅ Complete |
| Jan 20, 2026 | Deployed Build #11 with --force flag | ✅ Complete |
| Jan 20, 2026 | Phase 2 Complete - Production Ready | ✅ Complete |
| Jan 21, 2026 | Created all Deal custom properties in HubSpot | ✅ Complete |
| Jan 21, 2026 | Fixed typo: build_locaiton_byoq → build_location_byoq | ✅ Complete |
| Jan 21, 2026 | Deployed Build #14 - Full workflow tested successfully | ✅ Complete |
| Jan 21, 2026 | Identified Contact association issue | ✅ Complete |
| Jan 21, 2026 | Fixed Contact-Deal association (v3 API) | ✅ Complete |
| Jan 21, 2026 | Deployed Build #19 - All associations working | ✅ Complete |
| Jan 21, 2026 | **Phase 2 FULLY COMPLETE** - Production ready | ✅ Complete |
| TBD | Frontend BYOQ form integration | 📋 Pending |
| TBD | HubSpot workflows setup | 📋 Pending |
| TBD | Production testing with real data | 📋 Pending |
| TBD | **Phase 3:** Line Items integration planning | 📋 Future |
| TBD | Create products in HubSpot Product Library | 📋 Future |
| TBD | Implement Line Items creation in create-deal.js | 📋 Future |

---

**Last Updated:** January 21, 2026
**Status:** ✅ **Phase 2 FULLY COMPLETE** - All associations working perfectly (Contact, House Design, Facade). Endpoint is production-ready. Line Items integration planned for Phase 3.
