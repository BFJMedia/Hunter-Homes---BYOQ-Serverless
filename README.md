# Hunter Homes BYOQ Serverless Function

A HubSpot serverless function that powers the **Build Your Own Quote (BYOQ)** experience for [Hunter Homes NSW](https://hunterhomesnsw.com).

## Overview

This serverless function acts as the backend bridge between the **Hunter Homes BYOQ Module** (built in HubSpot CMS) and **HubSpot CRM**. When a customer completes the BYOQ quote form on the Hunter Homes website, this function processes the submission and creates the corresponding records in HubSpot.

## What It Does

- Creates or updates a **Contact** in HubSpot CRM based on the customer's email
- Creates a **Deal** with all BYOQ quote details (design, facade, budget, region, etc.)
- Associates the Deal to the Contact, selected House Design, and Facade via HubSpot custom objects

## Live Endpoint

```
POST https://hunterhomesnsw.com/hs/serverless/create-deal
```

## Tech Stack

- HubSpot Serverless Functions (Platform 2025.1)
- HubSpot CRM API (`@hubspot/api-client`)
- Node.js

## Project Structure

```
byoq-form/
└── src/app/
    ├── app.json               # App config and CRM scopes
    └── app.functions/
        ├── create-deal.js     # Main endpoint - deal creation workflow
        ├── serverless.json    # Endpoint routing config
        └── package.json       # Dependencies
```

## Related

- **HubSpot Account:** 44647342 (Hunter Homes NSW)
- **BYOQ Module:** Built in HubSpot CMS, hosted on hunterhomesnsw.com
