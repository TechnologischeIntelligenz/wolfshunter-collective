# Reviewer Guide — WOLFSHUNTER COLLECTIVE

## Installation & Setup
1. Install WOLFSHUNTER COLLECTIVE from Shopify App Store
2. Authorize required scopes (read_locations, read_orders, write_assigned_fulfillment_orders, write_fulfillments, write_inventory, write_products, read_markets, read_shipping, read_legal_policies)
3. Grant billing authorization (14-day trial, USD 99/30 days)

## Core Functionality to Test

### 1. Catalog Discovery
- Navigate to Discover section
- Browse supplier products with filtering
- View product details (images, pricing, inventory)
- Add products to favorites

### 2. Import List Management
- Navigate to Import Lists
- Review staged products
- Check margin calculations
- Approve products for import

### 3. Product Import
- Click "Open in Shopify" for approved products
- Verify Shopify DRAFT creation
- Check product variants and images
- Test product activation in Shopify

### 4. Settings Configuration
- Navigate to Settings
- Configure market country
- Set warehouse location
- Adjust margin percentage
- Test approval policy

## Expected Behavior
- Products remain unpublished until explicitly published in Shopify
- No automatic publication or checkout integration
- Session authentication works in embedded environment
- Data respects merchant scope (no cross-merchant data leakage)

## Known Limitations (V1)
- Order fulfillment and tracking are not yet implemented
- Direct supplier API integration is not yet available
- Some products may require manual image assignment
- Inventory sync is periodic, not real-time

## Support & Issues
- Contact: info@wolfshunter.com
- Use in-app support for technical issues
- Check Shopify Admin for error messages